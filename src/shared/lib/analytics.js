/**
 * @fileoverview Отправка просмотров и целей в Яндекс Метрику.
 * Если счётчик не загружен (блокировщик, локальная разработка), вызовы ничего не делают.
 */

const YM_ID = 108283867

/**
 * Передаёт команду счётчику, если он подключён.
 *
 * @param {...*} args Аргументы вызова ym после идентификатора счётчика.
 */
function ym(...args) {
  if (typeof window !== 'undefined' && typeof window.ym === 'function') window.ym(YM_ID, ...args)
}

/**
 * Отмечает просмотр страницы в SPA.
 *
 * @param {string} url Путь страницы.
 */
export function trackPageView(url) {
  ym('hit', url)
}

/**
 * Отмечает достижение цели.
 *
 * @param {string} goalName Идентификатор цели в Метрике.
 */
export function trackGoal(goalName) {
  ym('reachGoal', goalName)
}

/**
 * Отмечает открытие подробной теории по теме.
 *
 * @param {string} variant Вариант интерфейса, например '3d_new'.
 * @param {string} topic Ключ темы.
 */
export function trackOpenTheoryDetail(variant, topic) {
  if (!variant || !topic) return
  trackGoal(`open_theory_detail_${variant}_${topic}`)
  trackGoal(`open_theory_any_${variant}`)
}

/**
 * Передаёт параметры визита, например результаты замера производительности.
 *
 * @param {Object} params Вложенный объект параметров; попадает в отчёт «Параметры визитов».
 */
export function trackParams(params) {
  ym('params', params)
}
