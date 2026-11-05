/**
 * @fileoverview Флаги наведения на HTML-слои поверх 3D-сцены /new.
 * Пока курсор над карточкой или футером, клики и наведение по машине игнорируются.
 */

const hovered = { card: false, footer: false }

/**
 * Запоминает, находится ли курсор над HTML-слоем.
 *
 * @param {'card'|'footer'} layer Слой, над которым изменилось наведение.
 * @param {boolean} value true при входе курсора, false при выходе.
 */
export function setOverlayHover(layer, value) {
  hovered[layer] = value
}

/**
 * Сообщает, находится ли курсор над каким-либо HTML-слоем.
 *
 * @return {boolean} true, если 3D-сцена не должна реагировать на указатель.
 */
export function isOverlayHovered() {
  return hovered.card || hovered.footer
}

const OVERLAY_SELECTOR = '.glass-card, .scene-footer, button, a'

/**
 * Проверяет, находится ли указатель над HTML-элементом поверх сцены:
 * по флагам наведения или по элементу под курсором.
 *
 * @param {?PointerEvent|MouseEvent} nativeEvent DOM-событие указателя.
 * @return {boolean} true, если событие предназначено интерфейсу, а не 3D-сцене.
 */
export function isPointerOverOverlay(nativeEvent) {
  if (isOverlayHovered()) return true
  const { clientX, clientY } = nativeEvent ?? {}
  if (typeof clientX !== 'number') return false
  return Boolean(document.elementFromPoint(clientX, clientY)?.closest(OVERLAY_SELECTOR))
}
