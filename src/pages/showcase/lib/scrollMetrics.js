/**
 * @fileoverview Размеры контейнера прокрутки без принудительной перекладки страницы.
 * Чтение scrollHeight/clientHeight в обработчике scroll после записи стилей заставляет
 * браузер синхронно пересчитать раскладку на каждом событии. Здесь размеры кешируются
 * и обновляются только при изменении размеров контейнера или его содержимого.
 */

const cache = new WeakMap()

/**
 * Максимальная прокрутка контейнера (scrollHeight - clientHeight) из кеша.
 *
 * @param {HTMLElement} el Контейнер прокрутки.
 * @return {number} Максимальное значение scrollTop.
 */
export function scrollMax(el) {
  let entry = cache.get(el)
  if (!entry) {
    const measure = () => {
      entry.value = el.scrollHeight - el.clientHeight
    }
    entry = { value: 0, observer: new ResizeObserver(measure), observed: new Set() }
    entry.observer.observe(el)
    // Первый вызов может прийти раньше, чем ScrollControls вставит в контейнер слой
    // заполнения: без слежения за ним длина оставалась бы прежней, когда страница
    // вырастает (на телефоне ~15 экранов вместо 9), и футер открывался бы на середине.
    new MutationObserver(() => {
      observeChildren(entry, el)
      measure()
    }).observe(el, { childList: true })
    observeChildren(entry, el)
    measure()
    cache.set(el, entry)
  }
  return entry.value
}

/**
 * Подписывает ResizeObserver на детей контейнера, за которыми он ещё не следит.
 *
 * @param {{observer: ResizeObserver, observed: Set<Element>}} entry Запись кеша.
 * @param {HTMLElement} el Контейнер прокрутки.
 */
function observeChildren(entry, el) {
  for (const child of el.children) {
    if (entry.observed.has(child)) continue
    entry.observed.add(child)
    entry.observer.observe(child)
  }
}
