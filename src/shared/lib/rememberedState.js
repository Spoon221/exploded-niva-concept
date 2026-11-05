/**
 * @fileoverview Состояние, которое переживает размонтирование компонента: переключатели
 * стенда остаются как были, когда уходишь со стенда и возвращаешься. Хранится только
 * в памяти страницы — без localStorage и cookie, после перезагрузки всё по умолчанию.
 */
import { useCallback, useState } from 'react'

/** Значения по ключам на время жизни вкладки. */
const memory = new Map()

/**
 * Как useState, но значение запоминается по ключу до перезагрузки страницы.
 *
 * @template T
 * @param {string} key Уникальный ключ значения.
 * @param {T|function(): T} initial Значение по умолчанию (или функция, которая его вернёт),
 *   если запомненного ещё нет.
 * @return {[T, function((T|function(T): T)): void]} Значение и его установщик.
 */
export function useRememberedState(key, initial) {
  const [value, setValue] = useState(() => {
    if (memory.has(key)) return memory.get(key)
    return typeof initial === 'function' ? initial() : initial
  })

  const setRemembered = useCallback((next) => {
    setValue((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next
      memory.set(key, resolved)
      return resolved
    })
  }, [key])

  return [value, setRemembered]
}
