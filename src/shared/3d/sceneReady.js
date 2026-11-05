/**
 * @fileoverview Готовность 3D-сцены для экрана загрузки. Компонент SceneReadySignal ставится
 * внутрь Canvas в ту же границу Suspense, что и содержимое сцены: он монтируется, только когда
 * содержимое загружено, затем ждёт, пока загрузчики three.js освободятся, и несколько
 * отрисованных кадров (на телефоне при первых кадрах компилируются шейдеры). Экран загрузки
 * закрывается только после этого — до тех пор интерфейс не появляется.
 */
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useFrame } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'

/** Сколько кадров сцена должна отрисовать после загрузки, прежде чем считаться готовой. */
const READY_FRAMES = 4
/**
 * Минимальное число кадров, через которые «active=false при нулевом прогрессе» считается
 * финальным (всё в кэше): защита от ложного старта, когда useProgress ещё не
 * зарегистрировал ни одного ресурса и сразу возвращает active=false, progress=0.
 */
const IDLE_CONFIRM_FRAMES = 6

const scenes = new Map()
const listeners = new Set()
let version = 0

/** Уведомляет подписчиков об изменении готовности сцен. */
const notify = () => {
  version++
  listeners.forEach((listener) => listener())
}

/**
 * Подписывает на изменения готовности сцен.
 *
 * @param {function(): void} listener Колбэк.
 * @return {function(): void} Отписка.
 */
const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Номер изменения: растёт при каждой смене готовности (снимок для useSyncExternalStore).
 *
 * @return {number}
 */
const getVersion = () => version

/**
 * Готовы ли сцены на странице: хотя бы одна смонтирована и все отрисовали первые кадры.
 *
 * @return {boolean}
 */
export function areScenesReady() {
  if (!scenes.size) return false
  for (const ready of scenes.values()) if (!ready) return false
  return true
}

/**
 * Подписывает компонент на готовность сцен.
 *
 * @return {boolean} Готовы ли сцены.
 */
export function useScenesReady() {
  useSyncExternalStore(subscribe, getVersion, getVersion)
  return areScenesReady()
}

/**
 * Невидимый компонент внутри Canvas: сообщает о готовности сцены.
 *
 * @param {{ready?: boolean, onReady?: function(): void}} props Дополнительное условие
 *   готовности (например, разложена парковка) и колбэк, вызываемый один раз.
 * @return {null}
 */
export function SceneReadySignal({ ready = true, onReady }) {
  const token = useRef(Symbol('scene'))
  const frames = useRef(0)
  const done = useRef(false)
  // Флаг: загрузчик хотя бы раз сообщил о активной загрузке.
  // Нужен для защиты от гонки: useProgress при монтировании сразу отдаёт
  // { active: false, progress: 0 }, ещё до регистрации ресурсов.
  const seenActive = useRef(false)
  // Счётчик кадров «холостого» состояния (active=false до первого active=true).
  const idleFrames = useRef(0)
  const { active, progress } = useProgress()

  // Отслеживаем, был ли active=true хотя бы один кадр.
  if (active) seenActive.current = true

  // Загрузчики «реально завершены», если:
  // 1. active=false И мы видели active=true (загрузка началась и кончилась), ИЛИ
  // 2. active=false И progress===100 (всё из кэша, загрузчик не активировался), ИЛИ
  // 3. active=false И прошло IDLE_CONFIRM_FRAMES кадров подряд (долгая пауза до загрузки).
  const loadersIdle = !active && (seenActive.current || progress === 100)
  const waiting = !ready || (active || (!loadersIdle && !seenActive.current))

  useEffect(() => {
    const key = token.current
    scenes.set(key, false)
    notify()
    return () => {
      scenes.delete(key)
      notify()
    }
  }, [])

  useFrame(() => {
    if (done.current) return

    // Подтверждение холостого состояния: active=false с самого начала,
    // но прогресс ещё не 100 — считаем кадры паузы.
    if (!active && !seenActive.current && progress !== 100) {
      idleFrames.current++
      if (idleFrames.current < IDLE_CONFIRM_FRAMES) return
      // Достаточно кадров подряд: считаем, что загрузки нет (всё в кэше).
      seenActive.current = true // разблокирует loadersIdle
    }

    if (!ready || active) {
      frames.current = 0
      return
    }
    frames.current++
    if (frames.current < READY_FRAMES) return
    done.current = true
    scenes.set(token.current, true)
    notify()
    onReady?.()
  })

  return null
}
