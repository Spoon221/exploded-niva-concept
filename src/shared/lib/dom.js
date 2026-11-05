/**
 * @fileoverview Небольшие DOM-хелперы, общие для страниц.
 */

/**
 * Передаёт координаты курсора внутри элемента в CSS-переменные --spot-x и --spot-y.
 * Используется для подсветки-«спотлайта» за курсором; учитывает прокрутку элемента.
 *
 * @param {PointerEvent} e Событие движения указателя.
 */
export function trackSpotlight(e) {
  const el = e.currentTarget
  const rect = el.getBoundingClientRect()
  el.style.setProperty('--spot-x', `${e.clientX - rect.left}px`)
  el.style.setProperty('--spot-y', `${e.clientY - rect.top + el.scrollTop}px`)
}

/**
 * Останавливает всплытие события, чтобы клик по HTML-слою не доходил до 3D-сцены.
 *
 * @param {Event} e Любое DOM-событие.
 */
export const stopEvent = (e) => e.stopPropagation()

/**
 * Разбирает HEX-цвет в компоненты RGB.
 *
 * @param {string} hex Цвет в формате #rgb или #rrggbb.
 * @param {{r: number, g: number, b: number}} [fallback] Значение при некорректном вводе.
 * @return {{r: number, g: number, b: number}} Компоненты 0..255.
 */
export function hexToRgb(hex, fallback = { r: 167, g: 139, b: 250 }) {
  const full = hex.replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i, (_, r, g, b) => r + r + g + g + b + b)
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(full)
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : fallback
}

/**
 * Меняет курсор всей страницы, например при наведении на 3D-объект.
 *
 * @param {string} cursor CSS-значение курсора.
 */
export function setCursor(cursor) {
  document.body.style.cursor = cursor
}
