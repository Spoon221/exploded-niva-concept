/**
 * @fileoverview Математика анимаций: ограничение, интерполяция и функции сглаживания.
 * Все функции чистые; сглаживающие функции ограничивают прогресс t диапазоном 0..1.
 */

/**
 * Ограничивает число диапазоном 0..1.
 *
 * @param {number} x Исходное значение.
 * @return {number} Значение в диапазоне 0..1.
 */
export const clamp01 = (x) => Math.max(0, Math.min(1, x))

/**
 * Линейная интерполяция между a и b.
 *
 * @param {number} a Начальное значение.
 * @param {number} b Конечное значение.
 * @param {number} t Прогресс 0..1.
 * @return {number} Промежуточное значение.
 */
export const lerp = (a, b, t) => a + (b - a) * t

/**
 * Нормализует x в отрезке [from, to] до прогресса 0..1.
 *
 * @param {number} x Текущее значение.
 * @param {number} from Начало отрезка.
 * @param {number} to Конец отрезка.
 * @return {number} Прогресс 0..1.
 */
export const progressBetween = (x, from, to) => clamp01((x - from) / (to - from))

/**
 * Плавная ступенька Эрмита между двумя порогами.
 *
 * @param {number} edge0 Нижний порог.
 * @param {number} edge1 Верхний порог.
 * @param {number} x Текущее значение.
 * @return {number} Сглаженный прогресс 0..1.
 */
export const smoothstep = (edge0, edge1, x) => {
  const t = progressBetween(x, edge0, edge1)
  return t * t * (3 - 2 * t)
}

/**
 * Кубическое ускорение.
 *
 * @param {number} t Прогресс 0..1.
 * @return {number} Сглаженный прогресс.
 */
export const easeInCubic = (t) => clamp01(t) ** 3

/**
 * Кубическое замедление.
 *
 * @param {number} t Прогресс 0..1.
 * @return {number} Сглаженный прогресс.
 */
export const easeOutCubic = (t) => 1 - (1 - clamp01(t)) ** 3

/**
 * Кубическое ускорение и замедление.
 *
 * @param {number} t Прогресс 0..1.
 * @return {number} Сглаженный прогресс.
 */
export const easeInOutCubic = (t) => {
  const x = clamp01(t)
  return x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2
}

/**
 * Квадратичное ускорение и замедление.
 *
 * @param {number} t Прогресс 0..1.
 * @return {number} Сглаженный прогресс.
 */
export const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

/**
 * Ускорение и замедление пятой степени.
 *
 * @param {number} t Прогресс 0..1.
 * @return {number} Сглаженный прогресс.
 */
export const easeInOutQuint = (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2)

/**
 * Экспоненциальное замедление.
 *
 * @param {number} t Прогресс 0..1.
 * @return {number} Сглаженный прогресс.
 */
export const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t))

/**
 * Замедление с небольшим перелётом за конечное значение.
 *
 * @param {number} t Прогресс 0..1.
 * @param {number} [overshoot=1.70158] Сила перелёта.
 * @return {number} Сглаженный прогресс.
 */
export const easeOutBack = (t, overshoot = 1.70158) => {
  const c3 = overshoot + 1
  return 1 + c3 * Math.pow(t - 1, 3) + overshoot * Math.pow(t - 1, 2)
}

/**
 * Ускорение с небольшим откатом назад в начале.
 *
 * @param {number} t Прогресс 0..1.
 * @param {number} [overshoot=1.70158] Сила отката.
 * @return {number} Сглаженный прогресс.
 */
export const easeInBack = (t, overshoot = 1.70158) => {
  const c3 = overshoot + 1
  return c3 * t * t * t - overshoot * t * t
}

/**
 * Арка 0 → 1 → 0 по половине синусоиды: удобна для «вспышки» туда и обратно.
 *
 * @param {number} t Прогресс 0..1.
 * @return {number} Значение 0..1, максимум в середине.
 */
export const arch = (t) => Math.sin(Math.PI * clamp01(t))

/**
 * Затухающая синусоида для пружинящих колебаний.
 *
 * @param {number} t Время или прогресс.
 * @param {number} freq Частота колебаний.
 * @param {number} decay Скорость затухания.
 * @return {number} Значение в диапазоне -1..1.
 */
export const dampedSine = (t, freq, decay) => Math.sin(t * freq * Math.PI * 2) * Math.exp(-t * decay)
