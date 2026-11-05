/**
 * @fileoverview Форматирование чисел, дат и цветовой индикации для панелей метрик
 * и протоколов замеров.
 */

/**
 * Сокращает большое число: 1530 → «1.5K», 2400000 → «2.4M».
 *
 * @param {number} value Число.
 * @return {string} Короткая запись.
 */
export function formatCount(value) {
  const n = Math.round(value)
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K`
  return String(n)
}

/**
 * Форматирует дату и время замера по-русски.
 *
 * @param {string|number|Date} date Дата в любом виде, понятном конструктору Date.
 * @return {string} Например «08.10.2026, 21:14:05».
 */
export function formatDateTime(date) {
  return new Date(date).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/**
 * Цвет индикатора по FPS: зелёный от 55, жёлтый от 30, иначе красный.
 *
 * @param {number} fps Кадров в секунду.
 * @return {{line: string, fill: string}} Цвет линии и полупрозрачной заливки графика.
 */
export function fpsTone(fps) {
  if (fps >= 55) return { line: '#4ade80', fill: 'rgba(74,222,128,0.15)' }
  if (fps >= 30) return { line: '#fbbf24', fill: 'rgba(251,191,36,0.15)' }
  return { line: '#f87171', fill: 'rgba(248,113,113,0.15)' }
}
