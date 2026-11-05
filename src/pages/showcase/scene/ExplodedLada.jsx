/**
 * @fileoverview Модель LADA Niva, которая «разбирается» при прокрутке: открываются капот,
 * двери и багажник, в моторном отсеке загорается подсветка. Детали можно выбирать
 * и перекрашивать, а в режиме рентгена модель становится каркасной.
 */
import { useEffect, useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Bvh, useGLTF } from '@react-three/drei'
import { useScroll } from '@/shared/3d/scrollState'
import * as THREE from 'three'
import { useSafeGLTF } from '@/shared/assets/useSafeGLTF'
import { CAR_MODEL_URL } from '@/shared/assets/assetUrls'
import { easeOutBack, easeOutCubic, lerp } from '@/shared/lib/easing'
import { PlasmaCoreShaderMaterial } from './shaders'
import { isOverlayHovered, isPointerOverOverlay } from './overlayHover'
import { useXRayBlend } from './useXRayBlend'
import { DEFAULT_PART_COLORS, FALLBACK_MATERIAL } from '../data/carParts'

const WIRE_NAME = 'wireframe_duplicate'
const BODY_MATERIAL = 'kuzov'
const PAINTED_PARTS = ['body', 'hood', 'doors', 'trunk']
const DARK_GLASS = ['#0a0a0a', '#000000', '#111827']
const SPRING_OVERSHOOT = 1.35
const INTERACTION_SCROLL_LIMIT = 0.8
const TAP_TOLERANCE_PX = 10
const ACCENT = { glass: '#ff007f', default: '#00f3ff' }


/**
 * Петли открывающихся деталей: узел модели, ось и угол поворота, точка крепления
 * и диапазон прокрутки, в котором деталь открывается.
 */
const HINGES = [
  { node: 'Capot', axis: 'x', angle: -1.1, pivot: new THREE.Vector3(0, 1.02, -0.22), range: [0.1, 0.4] },
  { node: 'doorL', axis: 'z', angle: -0.8, pivot: new THREE.Vector3(0.16, 0, 0.2), range: [0.35, 0.7] },
  { node: 'dooP', axis: 'z', angle: 0.8, pivot: new THREE.Vector3(-0.16, 0, 0.2), range: [0.35, 0.7] },
  { node: 'Bag', axis: 'x', angle: -1.35, pivot: new THREE.Vector3(0, -0.01, 0.01), range: [0.35, 0.7] },
]
const TRACKED_NODES = ['Capot', 'doorL', 'dooP', 'Bag', 'Kuzov']
const rotatedPivot = new THREE.Vector3()

/**
 * Проверяет, содержит ли имя хотя бы одну из подстрок.
 *
 * @param {string} name Имя меша или материала в нижнем регистре.
 * @param {string[]} parts Подстроки для поиска.
 * @return {boolean}
 */
const hasAny = (name, parts) => parts.some((part) => name.includes(part))

/**
 * Проверяет, является ли объект потомком (или самим) родителя.
 *
 * @param {THREE.Object3D} obj Проверяемый объект.
 * @param {?THREE.Object3D} parent Предполагаемый родитель.
 * @return {boolean}
 */
function isInside(obj, parent) {
  for (let node = obj; parent && node; node = node.parent) {
    if (node === parent) return true
  }
  return false
}

/**
 * Определяет деталь автомобиля, к которой относится меш.
 *
 * @param {THREE.Mesh} mesh Меш модели.
 * @param {Object<string, THREE.Object3D>} nodes Узлы модели по именам.
 * @return {?string} body, hood, doors, trunk, glass, wheels или null.
 */
function detectPart(mesh, nodes) {
  const name = (mesh.name || '').toLowerCase()
  const material = (mesh.material?.name || '').toLowerCase()

  if (hasAny(name, ['steklo', 'steclo', 'glass']) || hasAny(material, ['steklo', 'stecloton', 'glass'])) return 'glass'
  if (material === 'disk' || hasAny(name, ['wheel_disk', 'disk_0', 'wheel'])) return 'wheels'
  if (isInside(mesh, nodes.Capot) || name.includes('capot')) return 'hood'
  if (isInside(mesh, nodes.doorL) || isInside(mesh, nodes.dooP) || hasAny(name, ['door', 'doop'])) return 'doors'
  if (isInside(mesh, nodes.Bag) || name.includes('bag')) return 'trunk'
  if (material === BODY_MATERIAL || isInside(mesh, nodes.Kuzov) || hasAny(name, ['kuzov', 'bamp', 'bump'])) return 'body'
  return null
}

/**
 * Готовит меш к интерактиву: свой материал, тени и скрытая каркасная копия для подсветки.
 *
 * @param {THREE.Mesh} mesh Меш модели.
 * @param {?string} part Деталь, к которой относится меш.
 * @return {{mesh: THREE.Mesh, wireframe: THREE.Mesh, part: ?string, originalOpacity: number,
 *   isGlass: boolean, accent: string}} Описание меша для покадрового обновления.
 */
function prepareMesh(mesh, part) {
  mesh.castShadow = true
  mesh.receiveShadow = true
  if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere()

  mesh.material = mesh.material.clone()
  mesh.material.emissive ??= new THREE.Color(0x000000)
  // Прозрачный двусторонний материал three.js рисует в два прохода (задние, затем передние
  // грани) с пересборкой шейдера между ними в каждом кадре. Стёкла — тонкие панели:
  // один проход выглядит так же.
  mesh.material.forceSinglePass = true
  const originalOpacity = mesh.material.opacity ?? 1

  const isGlass = part === 'glass'
  // Прозрачной деталь делается только на время рентгена или подсветки (setOpacity):
  // прозрачные объекты рисуются без отсечения по глубине и сортируются каждый кадр,
  // и 43 «прозрачные» детали были самой дорогой частью кадра.
  setOpacity(mesh.material, originalOpacity)
  const accent = isGlass ? ACCENT.glass : ACCENT.default
  const wireframe = new THREE.Mesh(
    mesh.geometry,
    new THREE.MeshBasicMaterial({
      color: accent,
      wireframe: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    }),
  )
  wireframe.name = WIRE_NAME
  // Каркас — визуальная копия того же меша: лучи наведения по нему не проверяются.
  wireframe.raycast = () => {}
  wireframe.visible = false
  mesh.add(wireframe)

  return { mesh, wireframe, part, originalOpacity, isGlass, accent }
}

/**
 * Задаёт прозрачность материала и включает режим прозрачности, только если он нужен.
 * Смена режима меняет шейдер (three.js кэширует оба варианта), поэтому needsUpdate —
 * только при переключении.
 *
 * @param {THREE.Material} material Материал детали.
 * @param {number} opacity Непрозрачность 0..1.
 */
function setOpacity(material, opacity) {
  material.opacity = opacity
  const transparent = material.userData.alwaysTransparent || opacity < 0.999
  if (material.transparent !== transparent) {
    material.transparent = transparent
    material.needsUpdate = true
  }
}

/**
 * Применяет цвет и параметры материала выбранной детали к мешу.
 *
 * @param {{mesh: THREE.Mesh, part: ?string}} item Описание меша.
 * @param {Object<string, string>} colors Цвета деталей.
 * @param {Object<string, {roughness?: number, metalness?: number}>} materials Материалы деталей.
 */
function paintMesh({ mesh, part }, colors, materials) {
  const material = mesh.material
  const materialName = (material.name || '').toLowerCase()
  if (!material.color || !part) return

  if (part === 'glass') {
    material.color.set(colors.glass)
    setOpacity(material, DARK_GLASS.includes(colors.glass) ? 0.88 : 0.6)
    material.roughness = 0.1
    material.metalness = 0.2
    return
  }
  if (part === 'wheels') {
    if (materialName === 'disk' || mesh.name.toLowerCase().includes('disk')) {
      material.color.set(colors.wheels)
      material.roughness = 0.3
      material.metalness = 0.8
    }
    return
  }
  if (PAINTED_PARTS.includes(part) && materialName === BODY_MATERIAL) {
    const { roughness, metalness } = { ...FALLBACK_MATERIAL, ...materials[part] }
    material.color.set(colors[part])
    material.roughness = roughness
    material.metalness = metalness
  }
}

/**
 * Обновляет вид меша: рентген, подсветка при наведении, выделение или обычный вид.
 *
 * @param {Object} item Описание меша из prepareMesh.
 * @param {number} xRay Коэффициент рентгена 0..1.
 * @param {?string} hovered Деталь под курсором.
 * @param {?string} selected Выбранная деталь.
 */
function styleMesh(item, xRay, hovered, selected) {
  const { mesh, wireframe, part, originalOpacity, isGlass, accent } = item
  const material = mesh.material

  if (xRay > 0.005) {
    setOpacity(material, originalOpacity * (1 - xRay))
    material.visible = xRay < 0.999
    material.depthWrite = xRay < 0.85
    wireframe.material.opacity = (isGlass ? 0.08 : 0.22) * xRay
    wireframe.visible = xRay > 0.02
    return
  }

  const isHovered = hovered && part === hovered
  const isSelected = selected && part === selected
  material.visible = true
  setOpacity(material, isHovered ? 0.28 : originalOpacity)
  material.depthWrite = !isHovered
  material.emissive.set(isHovered ? accent : '#000000')
  material.emissiveIntensity = isHovered ? 0.35 : 0
  wireframe.visible = Boolean(isHovered || isSelected)
  wireframe.material.opacity = isHovered ? 0.95 : isSelected ? 0.35 : 0
  wireframe.material.color.set(accent)
}

/**
 * Поворачивает деталь вокруг точки крепления: перенос, поворот и обратный перенос.
 *
 * @param {THREE.Object3D} node Узел детали.
 * @param {{position: THREE.Vector3, rotation: THREE.Euler}} initial Исходное положение.
 * @param {'x'|'z'} axis Ось поворота.
 * @param {number} angle Угол поворота в радианах.
 * @param {THREE.Vector3} pivot Точка крепления в локальных координатах.
 */
function rotateAroundHinge(node, initial, axis, angle, pivot) {
  node.rotation[axis] = initial.rotation[axis] + angle
  rotatedPivot.copy(pivot).applyEuler(node.rotation)
  node.position.copy(initial.position).add(pivot).sub(rotatedPivot)
}

/**
 * Разборная модель автомобиля, привязанная к прокрутке ScrollControls.
 *
 * @param {{position?: number[], scale?: number, rotation?: number[], carColor?: string,
 *   partColors?: Object<string, string>, partMaterials?: Object<string, Object>,
 *   selectedPart?: ?string, onSelectPart?: function(string): void,
 *   onHoverPart?: function(?string): void, xRayMode: boolean}} props
 *   Положение и масштаб, цвета и материалы деталей, выбранная деталь, колбэки, режим
 *   рентгена.
 * @return {JSX.Element} Группа с моделью, плазменным ядром и подсветкой мотора.
 */
export function ExplodedLada({
  position = [0, 0, 0],
  scale = 0.8,
  rotation = [0, -Math.PI / 2, 0],
  carColor,
  partColors,
  partMaterials,
  selectedPart,
  onSelectPart,
  onHoverPart,
  xRayMode,
}) {
  const { scene } = useSafeGLTF(CAR_MODEL_URL, 'car')
  const scroll = useScroll()
  const clone = useMemo(() => scene?.clone(true) ?? null, [scene])

  const nodes = useRef({})
  const initialTransforms = useRef(new Map())
  const meshItems = useRef([])
  const hoveredPart = useRef(null)
  const lastPointerType = useRef('mouse')
  const selectedPartRef = useRef(selectedPart)
  const lastStyled = useRef({ hover: undefined, select: undefined, xRay: -1 })
  const plasmaCoreRef = useRef()
  const plasmaMaterialRef = useRef()
  const engineLightRef = useRef()
  const xRay = useXRayBlend(xRayMode)
  const paint = useRef({ colors: DEFAULT_PART_COLORS, materials: {} })

  useEffect(() => {
    selectedPartRef.current = selectedPart
  }, [selectedPart])

  useEffect(() => {
    if (!clone) return
    const found = {}
    const transforms = new Map()
    const meshes = []
    clone.traverse((child) => {
      if (child.isMesh) meshes.push(child)
      if (TRACKED_NODES.includes(child.name)) {
        found[child.name] = child
        transforms.set(child, { position: child.position.clone(), rotation: child.rotation.clone() })
      }
    })
    nodes.current = found
    initialTransforms.current = transforms
    meshItems.current = meshes.map((mesh) => prepareMesh(mesh, detectPart(mesh, found)))
    lastStyled.current = { hover: undefined, select: undefined, xRay: -1 }

    return () => {
      transforms.forEach(({ position: p, rotation: r }, node) => {
        node.position.copy(p)
        node.rotation.copy(r)
      })
    }
  }, [clone])

  useEffect(() => {
    const fallback = carColor ? { ...DEFAULT_PART_COLORS, body: carColor, hood: carColor, doors: carColor, trunk: carColor } : DEFAULT_PART_COLORS
    const colors = partColors ?? fallback
    paint.current = { colors, materials: partMaterials ?? {} }
    meshItems.current.forEach((item) => paintMesh(item, colors, partMaterials ?? {}))
  }, [clone, carColor, partColors, partMaterials])

  const setHover = (part) => {
    hoveredPart.current = part
    onHoverPart?.(part)
    document.body.style.cursor = part && !xRayMode ? 'pointer' : 'auto'
  }

  const partOf = (object) => {
    const mesh = object.name === WIRE_NAME ? object.parent : object
    return meshItems.current.find((item) => item.mesh === mesh)?.part ?? null
  }

  const isBlocked = (e) => scroll.offset > INTERACTION_SCROLL_LIMIT || isPointerOverOverlay(e.nativeEvent)

  const handlePointerOver = (e) => {
    e.stopPropagation()
    if (isBlocked(e)) {
      setHover(null)
      return
    }
    const part = partOf(e.object)
    if (part) setHover(part)
  }

  const handlePointerOut = (e) => {
    e.stopPropagation()
    setHover(null)
  }

  const handlePointerDown = (e) => {
    e.stopPropagation()
    // Обработчик висит и на pointerdown, и на click. Мышью деталь выбирается сразу по
    // pointerdown, а последующий click пропускается — иначе выбор и звук срабатывают дважды.
    // На тач-экране касание машины — чаще начало прокрутки: деталь выбираем только по тапу.
    // Тип указателя запоминается на pointerdown: у click в Safari его нет.
    if (e.type === 'pointerdown') lastPointerType.current = e.pointerType
    const isTouch = lastPointerType.current === 'touch'
    if (e.type === 'click' && !isTouch) return
    if (isTouch && (e.type === 'pointerdown' || e.delta > TAP_TOLERANCE_PX)) return
    if (xRayMode || isBlocked(e)) return
    const part = partOf(e.object)
    if (part) onSelectPart?.(part)
  }

  useFrame(({ clock }) => {
    if (!initialTransforms.current.size) return

    if (hoveredPart.current && (scroll.offset > INTERACTION_SCROLL_LIMIT || isOverlayHovered())) setHover(null)

    for (const { node, axis, angle, pivot, range } of HINGES) {
      const target = nodes.current[node]
      const initial = target && initialTransforms.current.get(target)
      if (initial) rotateAroundHinge(target, initial, axis, angle * easeOutBack(scroll.range(...range), SPRING_OVERSHOOT), pivot)
    }

    plasmaCoreRef.current?.scale.setScalar(easeOutCubic(scroll.range(0.15, 0.5)))
    if (plasmaMaterialRef.current) plasmaMaterialRef.current.uniforms.uTime.value = clock.getElapsedTime()
    if (engineLightRef.current) {
      engineLightRef.current.intensity = lerp(engineLightRef.current.intensity, scroll.range(0.18, 0.5) * 4.5, 0.1)
    }

    const t = xRay.current
    const hover = hoveredPart.current
    const select = selectedPartRef.current

    const last = lastStyled.current
    if (Math.abs(t - last.xRay) <= 0.002 && hover === last.hover && select === last.select) return
    lastStyled.current = { hover, select, xRay: t }
    for (const item of meshItems.current) styleMesh(item, t, hover, select)
  })

  return (
    <group position={position} scale={scale} rotation={rotation}>
      {/* BVH keeps pointer picking responsive on dense vehicle geometry. */}
      <Bvh firstHitOnly>
        {clone && (
          <primitive
            object={clone}
            rotation={[0, Math.PI, 0]}
            onPointerOver={handlePointerOver}
            onPointerOut={handlePointerOut}
            onPointerDown={handlePointerDown}
            onClick={handlePointerDown}
          />
        )}
      </Bvh>

      <mesh ref={plasmaCoreRef} position={[0, 0.45, 1.35]} scale={0} visible={false}>
        <sphereGeometry args={[0.2, 32, 32]} />
        <shaderMaterial
          ref={plasmaMaterialRef}
          {...PlasmaCoreShaderMaterial}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <pointLight
        ref={engineLightRef}
        position={[0, 0.65, 1.35]}
        color="#00f3ff"
        intensity={0}
        distance={6}
        decay={1.8}
        castShadow={false}
      />
    </group>
  )
}

useGLTF.preload(CAR_MODEL_URL)
