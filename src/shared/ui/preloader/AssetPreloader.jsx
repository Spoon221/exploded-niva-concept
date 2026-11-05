/**
 * @fileoverview Экран загрузки страниц. Закрывается, только когда страница готова целиком:
 * загружен её код, 3D-сцена смонтирована и отрисовала первые кадры (SceneReadySignal),
 * загрузчики three.js ничего не ждут и загружены шрифты. Рисует текущий вариант экрана —
 * компонентом PreloaderEditorial.
 */
import { useEffect, useRef, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { useScenesReady } from '@/shared/3d/sceneReady'
import { isWebGLAvailable } from '@/shared/lib/device'
import { PreloaderEditorial } from './PreloaderEditorial'

/** Минимальное время показа, мс: имя успевает проявиться, даже если всё уже в кэше. */
const MIN_VISIBLE_MS = 1400
/** Страховка, мс: если сцена так и не сообщила о готовности (сбой), экран всё равно уходит. */
const MAX_WAIT_MS = 30000
/**
 * Мс до «уверенного» состояния загрузчиков: если за это время active ни разу не стал true,
 * считаем что всё в кэше и загрузчики не активируются. Защита от ложного active=false при старте.
 */
const LOADER_SETTLE_MS = 400

/** Страницы (по подписи), где экран загрузки уже отыграл в этой сессии. */
const completed = new Set()

/**
 * Экран загрузки страницы: уходит, когда сцена готова (смонтирована, ресурсы загружены,
 * первые кадры отрисованы), шрифты загружены и прошло не меньше MIN_VISIBLE_MS; если
 * WebGL недоступен, сцену не ждёт. На странице, где он уже отыграл, при возврате не показывается.
 *
 * @param {{caption: string, waitFor?: boolean, withScene?: boolean}} props Подпись над именем
 *   (и ключ страницы), признак, что страница ещё не готова (например, загружается её код),
 *   и есть ли на странице 3D-сцена, готовности которой нужно дождаться.
 * @return {?JSX.Element} Экран загрузки.
 */
export function AssetPreloader({ caption, waitFor = false, withScene = true }) {
  const { active, progress, item } = useProgress()
  const scenesReady = useScenesReady()
  const [needScene] = useState(() => withScene && isWebGLAvailable())
  const [skip] = useState(() => completed.has(caption))
  const [minShown, setMinShown] = useState(false)
  const [fontsReady, setFontsReady] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [done, setDone] = useState(false)
  // Флаг: useProgress хотя бы раз сообщил об активной загрузке ИЛИ прошло LOADER_SETTLE_MS.
  // Нужен, чтобы не считать active=false финальным до реальной регистрации ресурсов.
  const [loadersSettled, setLoadersSettled] = useState(false)
  const seenActive = useRef(false)

  useEffect(() => {
    const minTimer = setTimeout(() => setMinShown(true), MIN_VISIBLE_MS)
    const maxTimer = setTimeout(() => setTimedOut(true), MAX_WAIT_MS)
    // Если за LOADER_SETTLE_MS active ни разу не стал true — всё в кэше, считаем settled.
    const settleTimer = setTimeout(() => setLoadersSettled(true), LOADER_SETTLE_MS)
    let alive = true
    const fonts = document.fonts?.ready ?? Promise.resolve()
    fonts.then(() => alive && setFontsReady(true), () => alive && setFontsReady(true))
    return () => {
      alive = false
      clearTimeout(minTimer)
      clearTimeout(maxTimer)
      clearTimeout(settleTimer)
    }
  }, [])

  // Фиксируем первый active=true.
  if (active && !seenActive.current) seenActive.current = true

  // Загрузчики завершены: active=false И (видели active=true, или progress=100, или прошёл таймер).
  const loadersIdle = !active && (seenActive.current || progress === 100 || loadersSettled)

  const pageReady = !waitFor && loadersIdle && fontsReady && (scenesReady || !needScene)

  useEffect(() => {
    if (done || !minShown || !(pageReady || timedOut)) return
    completed.add(caption)
    // Готовность фиксируется один раз: последующие догрузки экран не возвращают.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDone(true)
  }, [minShown, pageReady, timedOut, done, caption])

  if (skip) return null
  return <PreloaderEditorial progress={progress} item={item} done={done} caption={caption} />
}
