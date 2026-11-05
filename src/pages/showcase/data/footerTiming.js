/**
 * @fileoverview Тайминги появления футера как доли общей прокрутки (0..1).
 * The standalone story contains ten full-screen sections followed by the footer.
 * На телефоне карточки во всю высоту и прокрутка длиннее — прогресс для футера
 * пересчитывается так, чтобы последний экран прокрутки занимал ту же долю, что и в базе.
 */

export const BASE_SCROLL_PAGES = 10

export const FOOTER_GLOW_START = 0.9
export const FOOTER_GLOW_END = 0.97
export const FOOTER_CARD_START = 0.94
export const FOOTER_CARD_END = 1.0

let scrollPages = BASE_SCROLL_PAGES

/**
 * Сообщает фактическую длину прокрутки в экранах.
 *
 * @param {number} pages Число экранов.
 */
export function setScrollPages(pages) {
  scrollPages = pages
}

/**
 * Переводит прогресс прокрутки в прогресс базовой страницы для таймингов футера.
 *
 * @param {number} progress Прогресс прокрутки 0..1.
 * @return {number} Прогресс в масштабе базовой страницы (может быть меньше 0).
 */
export function footerProgress(progress) {
  return 1 - ((1 - progress) * (scrollPages - 1)) / (BASE_SCROLL_PAGES - 1)
}
