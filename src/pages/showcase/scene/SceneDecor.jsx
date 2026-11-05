/**
 * @fileoverview Декоративные 3D-объекты сцены /new: робот-ассистент, кольца-гироскопы
 * и парящие на фоне кристаллы. Все они плавно меняют вид в режиме рентгена.
 */
import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Float, useAnimations, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useSafeGLTF } from '@/shared/assets/useSafeGLTF'
import { ROBOT_MODEL_URL } from '@/shared/assets/assetUrls'
import { lerp } from '@/shared/lib/easing'
import { useXRayBlend } from './useXRayBlend'

const WIRE_NAME = 'robot_wire'
const COLOR_SCAN_BLUE = new THREE.Color('#38bdf8')
const COLOR_SCAN_CYAN = new THREE.Color('#00f3ff')

const GYRO_RINGS = [
  { radius: 3.25, rotation: [Math.PI / 2, 0, 0] },
  { radius: 2.55, rotation: [Math.PI / 4, Math.PI / 4, 0] },
  { radius: 1.85, rotation: [0, Math.PI / 2, 0] },
]

const CRYSTAL_COUNT = 16
const CRYSTAL_COLORS = ['#00f3ff', '#ff007f']

/**
 * Добавляет к мешу робота каркасную копию для режима рентгена (один раз на меш).
 *
 * @param {THREE.Mesh} mesh Исходный меш модели.
 * @return {{mesh: THREE.Mesh, wireframe: THREE.Mesh, originalOpacity: number}}
 *   Меш, его каркас и исходная прозрачность.
 */
function attachWireframe(mesh) {
  let wireframe = mesh.children.find((c) => c.name === WIRE_NAME)
  if (!wireframe) {
    mesh.material = mesh.material.clone()
    mesh.material.transparent = true
    mesh.userData.originalOpacity = mesh.material.opacity ?? 1

    const wireMat = new THREE.MeshBasicMaterial({
      color: COLOR_SCAN_CYAN,
      wireframe: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
    if (mesh.isSkinnedMesh) {
      wireframe = new THREE.SkinnedMesh(mesh.geometry, wireMat)
      wireframe.bind(mesh.skeleton, mesh.bindMatrix)
    } else {
      wireframe = new THREE.Mesh(mesh.geometry, wireMat)
    }
    wireframe.name = WIRE_NAME
    mesh.add(wireframe)
  }
  return { mesh, wireframe, originalOpacity: mesh.userData.originalOpacity ?? 1 }
}

/**
 * Робот-ассистент рядом с машиной: проигрывает Idle-анимацию, слегка покачивается
 * и в режиме рентгена плавно меняет сплошные материалы на каркасные.
 *
 * @param {{position: number[], rotation: number[], xRayMode: boolean}} props
 *   Position, rotation and X-ray state.
 * @return {JSX.Element} Группа с моделью робота.
 */
export function ScannerRobot({ position, rotation, xRayMode }) {
  const { scene, animations } = useSafeGLTF(ROBOT_MODEL_URL, 'robot')
  const group = useRef()
  const meshes = useRef([])
  const { actions } = useAnimations(animations, group)

  useEffect(() => {
    actions?.Idle?.play()
  }, [actions])

  useEffect(() => {
    if (!scene) return
    const list = []
    scene.traverse((child) => {
      if (child.isMesh && child.name !== WIRE_NAME) list.push(attachWireframe(child))
    })
    meshes.current = list
  }, [scene])

  useXRayBlend(xRayMode, (t) => {
    for (const { mesh, wireframe, originalOpacity } of meshes.current) {
      mesh.material.opacity = originalOpacity * (1 - t)
      mesh.material.visible = t < 0.999
      wireframe.material.opacity = 0.55 * t
      wireframe.visible = t > 0.02
    }
  })

  useFrame(({ clock }) => {
    if (!group.current) return
    group.current.position.y = position[1]
    group.current.rotation.y = rotation[1] + Math.sin(clock.getElapsedTime() * 0.4) * 0.08
  })

  return (
    <group ref={group} position={position} rotation={rotation} scale={0.13}>
      {scene && <primitive object={scene} />}
    </group>
  )
}

/**
 * Три вращающихся по разным осям кольца вокруг машины; в рентгене ярче и бирюзовее.
 *
 * @param {{xRayMode: boolean}} props Флаг режима рентгена.
 * @return {JSX.Element} Группа из трёх колец.
 */
export function GyroscopeScanner({ xRayMode }) {
  const groupRef = useRef()

  useXRayBlend(xRayMode, (t) => {
    for (const ring of groupRef.current?.children ?? []) {
      ring.material.opacity = lerp(0.12, 0.55, t)
      ring.material.color.lerpColors(COLOR_SCAN_BLUE, COLOR_SCAN_CYAN, t)
    }
  })

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const time = clock.getElapsedTime()
    const [outer, middle, inner] = groupRef.current.children
    outer.rotation.z = time * 0.12
    middle.rotation.x = time * -0.09
    middle.rotation.y = time * 0.08
    inner.rotation.y = time * -0.07
    inner.rotation.z = time * 0.14
  })

  return (
    <group ref={groupRef} position={[0, 0.15, 0]}>
      {GYRO_RINGS.map(({ radius, rotation }) => (
        <mesh key={radius} rotation={rotation}>
          <ringGeometry args={[radius, radius + 0.02, 48]} />
          {/* Кольца проходят сквозь машину: без записи глубины они не закрывают её каркас в рентгене. */}
          {/* forceSinglePass: плоскому кольцу второй проход (задние грани) ничего не добавляет. */}
          <meshBasicMaterial transparent opacity={0.12} color="#38bdf8" side={THREE.DoubleSide} depthWrite={false} forceSinglePass />
        </mesh>
      ))}
    </group>
  )
}

/**
 * Геометрия кристалла одного из трёх типов.
 *
 * @param {{type: number, size: number}} props 0 — куб, 1 — октаэдр, 2 — додекаэдр; размер.
 * @return {JSX.Element} Элемент геометрии.
 */
function CrystalGeometry({ type, size }) {
  if (type === 0) return <boxGeometry args={[size, size, size]} />
  if (type === 1) return <octahedronGeometry args={[size]} />
  return <dodecahedronGeometry args={[size]} />
}

/**
 * Создаёт случайную раскладку кристаллов по кольцу вокруг сцены.
 *
 * @return {Array<{id: number, position: number[], size: number, speed: number, type: number}>}
 */
function createCrystals() {
  return Array.from({ length: CRYSTAL_COUNT }, (_, id) => {
    const angle = (id / CRYSTAL_COUNT) * Math.PI * 2 + Math.random() * 0.5
    const radius = 10 + Math.random() * 12
    return {
      id,
      position: [Math.cos(angle) * radius, -1.5 + Math.random() * 6, Math.sin(angle) * radius],
      size: 0.3 + Math.random() * 0.8,
      speed: 0.05 + Math.random() * 0.12,
      type: Math.floor(Math.random() * 3),
    }
  })
}

/**
 * Медленно вращающееся кольцо парящих кристаллов; в рентгене они становятся каркасами.
 *
 * @param {{xRayMode: boolean}} props Флаг режима рентгена.
 * @return {JSX.Element} Группа фоновых объектов.
 */
export function BackgroundElements({ xRayMode }) {
  const groupRef = useRef()
  const solidRefs = useRef([])
  const wireRefs = useRef([])
  const crystals = useMemo(() => createCrystals(), [])

  useXRayBlend(xRayMode, (t) => {
    solidRefs.current.forEach((mesh) => {
      if (!mesh) return
      mesh.material.opacity = lerp(0.85, 0.05, t)
      // Почти прозрачный кристалл не должен писать глубину: иначе, отрисовавшись раньше
      // портала или каркаса машины, он вырезает в них чёрный силуэт.
      mesh.material.depthWrite = t < 0.1
    })
    wireRefs.current.forEach((mesh) => {
      if (!mesh) return
      mesh.material.opacity = lerp(0, 0.6, t)
      // Невидимый каркас всё равно стоил бы вызова отрисовки — скрываем его вне рентгена.
      mesh.visible = t > 0.01
    })
  })

  useFrame(({ clock }) => {
    if (groupRef.current) groupRef.current.rotation.y = clock.getElapsedTime() * 0.015
  })

  return (
    <group ref={groupRef}>
      {crystals.map(({ id, position, size, speed, type }) => {
        const color = CRYSTAL_COLORS[id % 2]
        return (
          <group key={id} position={position}>
            <Float speed={speed * 8} rotationIntensity={1.2} floatIntensity={1.0}>
              <mesh ref={(el) => (solidRefs.current[id] = el)}>
                <CrystalGeometry type={type} size={size} />
                <meshStandardMaterial color={color} roughness={0.2} metalness={0.8} transparent opacity={0.85} />
              </mesh>
              <mesh ref={(el) => (wireRefs.current[id] = el)} visible={false}>
                <CrystalGeometry type={type} size={size * 1.01} />
                <meshBasicMaterial color={color} wireframe transparent opacity={0} depthWrite={false} />
              </mesh>
            </Float>
          </group>
        )
      })}
    </group>
  )
}

useGLTF.preload(ROBOT_MODEL_URL)
