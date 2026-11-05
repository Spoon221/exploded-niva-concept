/**
 * @fileoverview Разрешение, выбранное регулятором AdaptiveQuality. Canvas получает его в проп
 * dpr: React Three Fiber сверяет проп с текущим dpr при каждом ререндере страницы (футер, выбор детали,
 * рентген) и иначе возвращал максимум — буфер кадра пересоздавался, а регулятор терял
 * своё значение.
 */

let currentDpr = null

/**
 * Значение для пропа dpr у Canvas: выбранное регулятором или исходное.
 *
 * @param {number|number[]} fallback Исходный dpr, пока регулятор его не менял.
 * @return {number|number[]}
 */
export function adaptiveDpr(fallback) {
  return currentDpr ?? fallback
}

/**
 * Запоминает выбранный регулятором dpr; null — регулятор снят.
 *
 * @param {?number} dpr Плотность пикселей.
 */
export function setAdaptiveDpr(dpr) {
  currentDpr = dpr
}
