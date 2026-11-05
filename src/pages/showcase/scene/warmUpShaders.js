/**
 * @fileoverview Прогрев шейдеров сцены /new. three.js компилирует шейдер при первой
 * отрисовке материала в новом состоянии, и первое наведение на деталь, включение
 * рентгена или подсветка каркаса давали рывок в десятки миллисекунд. Здесь все
 * варианты компилируются заранее, пока сцена появляется.
 */

/**
 * Материалы объекта списком.
 *
 * @param {THREE.Object3D} object Объект сцены.
 * @return {THREE.Material[]}
 */
const materialsOf = (object) => (object.material ? [].concat(object.material) : [])

/**
 * Компилирует шейдеры всех объектов сцены, включая скрытые, в обычном и в прозрачном
 * варианте материала, и возвращает сцену в прежнее состояние.
 *
 * @param {THREE.WebGLRenderer} gl Рендерер.
 * @param {THREE.Scene} scene Сцена.
 * @param {THREE.Camera} camera Камера.
 */
export function warmUpShaders(gl, scene, camera) {
  const hidden = []
  const opaque = new Set()
  scene.traverse((object) => {
    // compile обходит только видимые объекты: каркасы рентгена и подсветки скрыты.
    if (!object.visible) {
      hidden.push(object)
      object.visible = true
    }
    for (const material of materialsOf(object)) if (!material.transparent) opaque.add(material)
  })

  gl.compile(scene, camera)

  // Детали становятся прозрачными при наведении и в рентгене — это другой шейдер.
  const setTransparent = (value) =>
    opaque.forEach((material) => {
      material.transparent = value
      material.needsUpdate = true
    })
  setTransparent(true)
  gl.compile(scene, camera)
  setTransparent(false)

  hidden.forEach((object) => (object.visible = false))
}
