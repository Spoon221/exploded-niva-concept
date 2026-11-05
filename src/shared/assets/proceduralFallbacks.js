/**
 * @fileoverview Процедурные 3D-модели, которыми заменяются GLB-файлы при сбое загрузки.
 * Замены сохраняют имена узлов оригиналов, чтобы физика, анимации и подсветка деталей
 * продолжали работать.
 */
import * as THREE from 'three'

/**
 * Создаёт группу с одним мешем внутри, как у деталей в исходной модели.
 *
 * @param {{groupName: string, meshName: string, geometry: THREE.BufferGeometry,
 *   material: THREE.Material, position?: number[]}} options Имена группы и меша,
 *   геометрия, материал и положение группы.
 * @return {THREE.Group} Группа с мешем.
 */
function createPart({ groupName, meshName, geometry, material, position = [0, 0, 0] }) {
  const group = new THREE.Group()
  group.name = groupName
  group.position.set(...position)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = meshName
  group.add(mesh)
  return group
}

/**
 * Создаёт меш с заданным положением.
 *
 * @param {THREE.BufferGeometry} geometry Геометрия.
 * @param {THREE.Material} material Материал.
 * @param {number[]} position Положение [x, y, z].
 * @param {string} [name=''] Имя меша.
 * @return {THREE.Mesh} Меш.
 */
function createMesh(geometry, material, position, name = '') {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = name
  mesh.position.set(...position)
  return mesh
}

/**
 * Создаёт процедурную модель автомобиля на случай сбоя загрузки lada_niva.glb.
 * Имена кузова, капота, дверей, багажника и колёс совпадают с оригиналом.
 *
 * @return {THREE.Group} Корневая группа модели.
 */
export function createProceduralCarFallback() {
  const root = new THREE.Group()
  root.name = 'fallback-lada-niva'

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.25 })
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.1, transparent: true, opacity: 0.85 })
  const lightMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff })
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.8, metalness: 0.2 })

  const kuzov = new THREE.Group()
  kuzov.name = 'Kuzov'
  kuzov.add(
    createMesh(new THREE.BoxGeometry(2.6, 0.7, 1.4), bodyMat, [0, 0.45, 0], 'kuzov_main'),
    createMesh(new THREE.BoxGeometry(1.5, 0.6, 1.25), roofMat, [-0.2, 1.0, 0], 'steklo_cabin'),
  )

  const doorGeom = new THREE.BoxGeometry(0.8, 0.5, 0.08)
  root.add(
    kuzov,
    createPart({ groupName: 'Capot', meshName: 'capot_panel', geometry: new THREE.BoxGeometry(0.9, 0.08, 1.35), material: bodyMat, position: [0.8, 0.75, 0] }),
    createPart({ groupName: 'doorL', meshName: 'door_left', geometry: doorGeom, material: bodyMat, position: [-0.1, 0.6, 0.7] }),
    createPart({ groupName: 'dooP', meshName: 'door_right', geometry: doorGeom, material: bodyMat, position: [-0.1, 0.6, -0.7] }),
    createPart({ groupName: 'Bag', meshName: 'bag_door', geometry: new THREE.BoxGeometry(0.2, 0.55, 1.3), material: bodyMat, position: [-1.15, 0.7, 0] }),
  )

  const lightGeom = new THREE.BoxGeometry(0.1, 0.15, 0.3)
  root.add(
    createMesh(lightGeom, lightMat, [1.3, 0.5, 0.45]),
    createMesh(lightGeom, lightMat, [1.3, 0.5, -0.45]),
  )

  const wheelGeom = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 24)
  wheelGeom.rotateX(Math.PI / 2)
  const wheels = [
    { name: 'wheel_fl', position: [1.0, 0.1, 0.8] },
    { name: 'wheel_fr', position: [1.0, 0.1, -0.8] },
    { name: 'wheel_rl', position: [-1.0, 0.1, 0.8] },
    { name: 'wheel_rr', position: [-1.0, 0.1, -0.8] },
  ]
  wheels.forEach(({ name, position }) => {
    root.add(createPart({ groupName: 'wheel', meshName: name, geometry: wheelGeom.clone(), material: wheelMat, position }))
  })

  return root
}

/**
 * Создаёт процедурную модель дрона-робота на случай сбоя загрузки RobotExpressive.glb.
 *
 * @return {THREE.Group} Корневая группа модели.
 */
export function createProceduralRobotFallback() {
  const root = new THREE.Group()
  root.name = 'fallback-robot'

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e1b4b, metalness: 0.9, roughness: 0.15 })
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff })
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.6 })

  const ring = createMesh(new THREE.RingGeometry(1.4, 1.45, 48), ringMat, [0, 0, 0])
  ring.rotation.x = Math.PI / 2

  root.add(
    createMesh(new THREE.SphereGeometry(1.2, 32, 32), bodyMat, [0, 0, 0]),
    createMesh(new THREE.SphereGeometry(0.4, 24, 24), eyeMat, [0, 0.2, 1.0]),
    ring,
  )

  return root
}
