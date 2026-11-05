/**
 * @fileoverview Скролл-сцена страницы /new: 3D-окружение с разобранной LADA Niva,
 * пролёт камеры по сплайну, привязанный к прокрутке, и HTML-слой с карточками.
 */
import { useRef, useEffect, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import { ScrollControls } from '@/shared/3d/ScrollControls'
import { useScroll } from '@/shared/3d/scrollState'
import { ScrollHtml } from '@/shared/3d/ScrollHtml'
import * as THREE from 'three'
import { SafeEnvironment } from '@/shared/3d/SafeEnvironment'
import { clamp01, easeInOutCubic, lerp } from '@/shared/lib/easing'
import { ResearchCards } from '../components/ResearchCards'
import { AdaptiveQuality } from './AdaptiveQuality'
import { warmUpShaders } from './warmUpShaders'
import { ExplodedLada } from './ExplodedLada'
import { ScannerRobot, GyroscopeScanner, BackgroundElements } from './SceneDecor'
import { PortalShaderMaterial, ScanConeShaderMaterial } from './shaders'
import { isPointerOverOverlay } from './overlayHover'
import { useXRayBlend } from './useXRayBlend'
import { BASE_SCROLL_PAGES, setScrollPages } from '../data/footerTiming'

const SCROLL_PAGES = BASE_SCROLL_PAGES
const CAMERA_SECTIONS = 4
const CAMERA_DAMPING = 4.5
const LOOK_SIDE_OFFSET = -0.22
const STATS_DELAY_MS = 600
// На тач-экранах у прокрутки своя инерция; сглаживание поверх неё заставляет карточки
// отставать от пальца, поэтому там оно короче.
const SCROLL_DAMPING = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches ? 0.05 : 0.12

const CAMERA_CURVE = new THREE.CatmullRomCurve3([
  new THREE.Vector3(4.2, 1.4, 4.5),
  new THREE.Vector3(1.6, 1.0, 1.9),
  new THREE.Vector3(-2.8, 1.25, 3.8),
  new THREE.Vector3(2.8, 2.6, -4.5),
  new THREE.Vector3(0, 1.3, 5.8),
])

const FOCUS_CURVE = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0.15, 0),
  new THREE.Vector3(0, 0.38, 1.35),
  new THREE.Vector3(0, 0.15, -0.2),
  new THREE.Vector3(0, 0.15, 0),
  new THREE.Vector3(0, 0.35, 0),
])

const CAR_KEYFRAMES = {
  rotation: [0, 0.4, 0.75, 1.15, 2].map((turn) => -Math.PI / 2 + Math.PI * turn),
  height: [-0.25, -0.12, -0.02, -0.18, 0.75],
  tilt: [0, -0.03, 0.05, -0.01, 0.02],
}

const COLORS = {
  cyan: new THREE.Color('#00f3ff'),
  magenta: new THREE.Color('#ff007f'),
  deepCyan: new THREE.Color('#004466'),
}

const UP = new THREE.Vector3(0, 1, 0)
const tmp = {
  camTarget: new THREE.Vector3(),
  focus: new THREE.Vector3(),
  forward: new THREE.Vector3(),
  right: new THREE.Vector3(),
  lookAt: new THREE.Vector3(),
  euler: new THREE.Euler(),
  carColor: new THREE.Color(),
}


/** Сколько первых кадров тень пересчитывается без проверки изменений. */
const SHADOW_WARMUP_FRAMES = 30
/** Изменение, меньше которого машина считается неподвижной. */
const SHADOW_EPS = 1e-4

/**
 * Помечает карту теней к пересчёту, если что-то из отслеживаемого изменилось.
 *
 * @param {THREE.WebGLRenderer} gl Рендерер.
 * @param {{warmup: number, values: number[]}} memo Прошлые значения и счётчик прогрева.
 * @param {number[]} values Прокрутка, поворот и высота машины, рентген.
 */
function updateShadowOnChange(gl, memo, values) {
  const changed = memo.warmup > 0 || values.some((v, i) => Math.abs(v - (memo.values[i] ?? Infinity)) > SHADOW_EPS)
  if (!changed) return
  if (memo.warmup > 0) memo.warmup--
  memo.values = values
  gl.shadowMap.needsUpdate = true
}

/**
 * Длина прокрутки в экранах по фактической высоте HTML-слоя. На компьютере секции ровно
 * в экран (SCROLL_PAGES), на телефоне карточки во всю свою высоту, и слой длиннее.
 *
 * @return {[number, function(number): void]} Число экранов и колбэк с высотой слоя.
 */
function useContentPages() {
  const viewportHeight = useThree((state) => state.size.height)
  const [contentHeight, setContentHeight] = useState(0)
  const pages = contentHeight > 0 && viewportHeight > 0
    ? Math.max(SCROLL_PAGES, Math.round((contentHeight / viewportHeight) * 100) / 100)
    : SCROLL_PAGES

  useEffect(() => setScrollPages(pages), [pages])

  return [pages, setContentHeight]
}

/**
 * Переводит прогресс скролла в прогресс камеры: внутри каждой из секций движение
 * ускоряется и замедляется, поэтому камера «доводится» до ракурса каждой карточки.
 *
 * @param {number} offset Прогресс прокрутки 0..1.
 * @return {number} Сглаженный прогресс 0..1.
 */
function sectionedProgress(offset) {
  const scaled = offset * CAMERA_SECTIONS
  const index = Math.floor(scaled)
  if (index >= CAMERA_SECTIONS) return 1
  return (index + easeInOutCubic(scaled - index)) / CAMERA_SECTIONS
}

/**
 * Интерполирует значение по массиву ключевых кадров.
 *
 * @param {number[]} keys Значения в равномерно распределённых ключевых точках.
 * @param {number} progress Прогресс 0..1.
 * @return {number} Значение между соседними ключами.
 */
function sampleKeyframes(keys, progress) {
  const segments = keys.length - 1
  const raw = progress * segments
  const index = Math.min(Math.floor(raw), segments - 1)
  return lerp(keys[index], keys[index + 1], raw - index)
}

/**
 * Считает вершины и треугольники видимой геометрии, без каркасных копий.
 *
 * @param {THREE.Object3D} root Корневой объект.
 * @return {{vertices: number, triangles: number}} Суммарная статистика.
 */
function countGeometry(root) {
  let vertices = 0
  let triangles = 0
  root.traverse((object) => {
    const positions = object.isMesh && object.geometry?.attributes.position
    if (!positions || object.material?.wireframe) return
    vertices += positions.count
    triangles += (object.geometry.index?.count ?? positions.count) / 3
  })
  return { vertices: Math.round(vertices), triangles: Math.round(triangles) }
}

/**
 * Записывает значение в текстовый узел HUD, если он смонтирован.
 *
 * @param {React.RefObject<HTMLElement>} ref Ref текстового узла.
 * @param {string} text Новый текст.
 */
function writeHud(ref, text) {
  // Запись в DOM только при изменении: иначе браузер каждый кадр пересчитывает стили.
  if (ref?.current && ref.current.textContent !== text) ref.current.textContent = text
}

/**
 * 3D-содержимое сцены: свет, окружение, машина и пролёт камеры, привязанный к прокрутке.
 * Пишет в HUD прогресс скролла и статистику геометрии через переданные ref.
 *
 * @param {Object} props Свойства ScrollScene.
 * @return {JSX.Element} Корневая группа сцены.
 */
function ScrollSceneContent({
  carColor,
  partColors,
  partMaterials,
  selectedPart,
  onSelectPart,
  onHoverPart,
  xRayMode,
  graphicsQuality,
  trianglesTextRef,
  verticesTextRef,
  scrollProgressTextRef,
  onRegisterScrollEl,
}) {
  const scroll = useScroll()
  const { camera } = useThree()
  const isLowQuality = graphicsQuality === 'low'
  const baseAmbient = isLowQuality ? 0.6 : 0.45
  const shadowMapSize = isLowQuality ? 512 : 1024

  const carGroupRef = useRef()
  const ambientLightRef = useRef()
  const dirLightRef = useRef()
  const floorGridRef = useRef()
  const portalMaterialRef = useRef()
  const scanConeMaterialRef = useRef()
  const backLightRef = useRef()
  const camPos = useRef(new THREE.Vector3())
  const camLook = useRef(new THREE.Vector3())
  const prevOffset = useRef(0)
  const scrollSpeed = useRef(0)
  const xRay = useXRayBlend(xRayMode)
  const gl = useThree((s) => s.gl)
  // Тень пересчитывается, только когда машина сдвинулась (см. useFrame): свет неподвижен,
  // а тень отбрасывает только машина. Первые кадры — принудительно, пока модель
  // и её флаги теней настраиваются в эффектах.
  const shadowState = useRef({ warmup: SHADOW_WARMUP_FRAMES, values: [] })

  // Child effects have prepared model materials; warm up shader programs once.
  const { scene: rootScene, camera: rootCamera } = useThree()
  useEffect(() => {
    warmUpShaders(gl, rootScene, rootCamera)
  }, [gl, rootScene, rootCamera])

  useEffect(() => {
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = true
    return () => {
      gl.shadowMap.autoUpdate = true
    }
  }, [gl])

  useEffect(() => {
    if (scroll?.el && onRegisterScrollEl) return onRegisterScrollEl(scroll.el)
  }, [scroll, onRegisterScrollEl])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!carGroupRef.current) return
      const { vertices, triangles } = countGeometry(carGroupRef.current)
      if (!vertices) return
      writeHud(verticesTextRef, vertices.toLocaleString())
      writeHud(trianglesTextRef, triangles.toLocaleString())
    }, STATS_DELAY_MS)
    return () => clearTimeout(timer)
  }, [trianglesTextRef, verticesTextRef])

  useFrame((state, delta) => {
    const offset = clamp01(scroll.offset)
    const time = state.clock.getElapsedTime()
    const t = xRay.current
    writeHud(scrollProgressTextRef, `${Math.round(offset * 100)}%`)

    scrollSpeed.current = lerp(scrollSpeed.current, (offset - prevOffset.current) / Math.max(0.0001, delta), 0.1)
    prevOffset.current = offset

    const progress = sectionedProgress(offset)
    const damp = 1 - Math.exp(-CAMERA_DAMPING * delta)
    const carRotation = sampleKeyframes(CAR_KEYFRAMES.rotation, progress)
    const carHeight = sampleKeyframes(CAR_KEYFRAMES.height, progress)
    const carTilt = sampleKeyframes(CAR_KEYFRAMES.tilt, progress)

    camPos.current.lerp(CAMERA_CURVE.getPointAt(progress, tmp.camTarget), damp)
    camera.position.copy(camPos.current)

    FOCUS_CURVE.getPointAt(progress, tmp.focus)
    tmp.focus.applyEuler(tmp.euler.set(carTilt, carRotation, 0))
    tmp.focus.y += carHeight
    camLook.current.lerp(tmp.focus, damp)

    tmp.forward.subVectors(camLook.current, camera.position).normalize()
    tmp.right.crossVectors(tmp.forward, UP).normalize()
    tmp.lookAt.copy(camLook.current).addScaledVector(tmp.right, LOOK_SIDE_OFFSET)

    camera.position.x += Math.sin(time * 1.6) * 0.004 + Math.cos(time * 3.2) * 0.002
    camera.position.y += Math.cos(time * 1.9) * 0.004 + Math.sin(time * 2.7) * 0.002
    camera.position.z += Math.sin(time * 2.2) * 0.002
    camera.position.addScaledVector(tmp.right, state.pointer.x * 0.18)
    camera.position.addScaledVector(UP, state.pointer.y * 0.14)
    camera.lookAt(tmp.lookAt)
    camera.rotation.z -= scrollSpeed.current * 0.06
    camera.updateMatrixWorld()

    const car = carGroupRef.current
    if (car) {
      car.rotation.y = lerp(car.rotation.y, carRotation, damp)
      car.rotation.x = lerp(car.rotation.x, carTilt, damp)
      car.position.y = lerp(car.position.y, carHeight, damp)
      updateShadowOnChange(state.gl, shadowState.current, [offset, car.rotation.x, car.rotation.y, car.position.y, t])
    }

    if (ambientLightRef.current) ambientLightRef.current.intensity = lerp(baseAmbient, 0.28, t)
    if (dirLightRef.current) dirLightRef.current.intensity = lerp(1.8, 0.75, t)
    if (state.scene.environmentIntensity !== undefined) state.scene.environmentIntensity = lerp(0.5, 0.2, t)
    if (floorGridRef.current?.material) floorGridRef.current.material.opacity = lerp(0.2, 0.5, t)
    else floorGridRef.current?.children.forEach((line) => (line.material.opacity = lerp(0.2, 0.5, t)))
    if (backLightRef.current) backLightRef.current.color.lerpColors(tmp.carColor.set(carColor), COLORS.cyan, t)

    const portal = portalMaterialRef.current
    if (portal) {
      portal.uniforms.uTime.value = time
      portal.uniforms.uColorMagenta.value.lerpColors(COLORS.magenta, COLORS.deepCyan, t)
    }
    const scanCone = scanConeMaterialRef.current
    if (scanCone) {
      scanCone.uniforms.uTime.value = time
      scanCone.uniforms.uTransition.value = t
    }
  })

  const deselectOnEmptyClick = (e) => {
    if (!isPointerOverOverlay(e.nativeEvent)) onSelectPart?.(null)
  }

  return (
    <group>
      <ambientLight ref={ambientLightRef} intensity={baseAmbient} />
      <directionalLight
        ref={dirLightRef}
        castShadow={!isLowQuality}
        position={[20, 35, 15]}
        intensity={1.8}
        shadow-bias={-0.0006}
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
        shadow-camera-far={80}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
      />
      <spotLight
        ref={backLightRef}
        position={[0, 5, -6]}
        intensity={2.8}
        color={xRayMode ? '#00f3ff' : carColor}
        distance={15}
        angle={Math.PI / 3}
        penumbra={1}
      />
      <SafeEnvironment intensity={0.5} />

      <color attach="background" args={['#020617']} />
      <fog attach="fog" args={['#020617', 15, 45]} />

      <mesh position={[0, 1.5, -22]}>
        <planeGeometry args={[65, 45]} />
        <shaderMaterial ref={portalMaterialRef} {...PortalShaderMaterial} transparent depthWrite={false} />
      </mesh>

      <mesh position={[0, 2.5, 0]}>
        <cylinderGeometry args={[0.2, 3.2, 5.5, 32, 1, true]} />
        <shaderMaterial
          ref={scanConeMaterialRef}
          {...ScanConeShaderMaterial}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          // Аддитивному смешиванию порядок граней безразличен — хватает одного прохода.
          forceSinglePass
        />
      </mesh>

      <BackgroundElements xRayMode={xRayMode} />
      <GyroscopeScanner xRayMode={xRayMode} />

      <group ref={carGroupRef} position={[0, -0.25, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <ExplodedLada
          scale={0.8}
          position={[0, 0, 0]}
          rotation={[0, 0, 0]}
          carColor={carColor}
          partColors={partColors}
          partMaterials={partMaterials}
          selectedPart={selectedPart}
          onSelectPart={onSelectPart}
          onHoverPart={onHoverPart}
          xRayMode={xRayMode}
        />
      </group>

      <ScannerRobot position={[3.5, 0, 1.5]} rotation={[0, 0, 0]} xRayMode={xRayMode} />
      <Sparkles count={45} scale={10} size={2.2} speed={0.25} opacity={0.22} color="#00f3ff" />
      <gridHelper ref={floorGridRef} args={[40, 40, '#00f3ff', '#1e293b']} position={[0, -0.26, 0]} />

      <mesh onClick={deselectOnEmptyClick} onPointerDown={deselectOnEmptyClick}>
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

/**
 * Корневой компонент сцены: связывает ScrollControls с 3D-содержимым и HTML-карточками.
 *
 * @param {{graphicsQuality: 'low'|'high', carColor: string,
 *   partColors: Object<string, string>, partMaterials: Object<string, Object>,
 *   selectedPart: ?string, onSelectPart: function(?string): void,
 *   onHoverPart: function(?string): void, xRayMode: boolean,
 *   trianglesTextRef: React.RefObject, verticesTextRef: React.RefObject,
 *   scrollProgressTextRef: React.RefObject,
 *   onRegisterScrollEl: function(HTMLElement): (function(): void)}} props
 *   Настройки графики, цвета и материалы деталей, колбэки выбора, режим рентгена,
 *   ref-ы полей HUD и колбэк, получающий DOM-элемент прокрутки.
 * @return {JSX.Element} ScrollControls с 3D- и HTML-слоями.
 */
export function ScrollScene(props) {
  const [pages, onContentHeight] = useContentPages()
  return (
    <ScrollControls pages={pages} damping={SCROLL_DAMPING} distance={1.2}>
      <ScrollSceneContent {...props} />
      <AdaptiveQuality />
      <ScrollHtml style={{ width: '100vw', height: '100dvh', pointerEvents: 'none' }}>
        <ResearchCards onHeightChange={onContentHeight} />
      </ScrollHtml>
    </ScrollControls>
  )
}
