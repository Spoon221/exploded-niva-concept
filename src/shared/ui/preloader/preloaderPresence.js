/**
 * @fileoverview Признак «на экране экран загрузки»: прелоадеры отмечаются, пока показаны,
 * а элементы интерфейса (шапка) по нему появляются только после полной загрузки страницы.
 */
import { useEffect, useState, useSyncExternalStore } from 'react'

/** Пауза перед появлением интерфейса, мс: один прелоадер может сразу смениться другим. */
const SETTLE_MS = 250

let active = 0
const listeners = new Set()

/** Уведомляет подписчиков об изменении. */
const notify = () => listeners.forEach((listener) => listener())
/**
 * Подписывает на изменения.
 *
 * @param {function(): void} listener Колбэк.
 * @return {function(): void} Отписка.
 */
const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
/**
 * Число показанных экранов загрузки.
 *
 * @return {number}
 */
const getActive = () => active

/**
 * Отмечает прелоадер показанным, пока isShown истинно.
 *
 * @param {boolean} isShown Показан ли экран загрузки (до готовности страницы).
 */
export function usePreloaderPresence(isShown) {
  useEffect(() => {
    if (!isShown) return undefined
    active++
    notify()
    return () => {
      active--
      notify()
    }
  }, [isShown])
}

/**
 * Загружена ли страница: ни одного экрана загрузки уже SETTLE_MS.
 *
 * @return {boolean} true, когда интерфейс можно показывать.
 */
export function usePageReady() {
  const loading = useSyncExternalStore(subscribe, getActive, getActive) > 0
  const [settled, setSettled] = useState(!loading)

  useEffect(() => {
    if (loading) return undefined
    const timer = setTimeout(() => setSettled(true), SETTLE_MS)
    return () => clearTimeout(timer)
  }, [loading])

  return !loading && settled
}
