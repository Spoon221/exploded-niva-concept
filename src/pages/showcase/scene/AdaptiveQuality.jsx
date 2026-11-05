/**
 * @fileoverview Адаптивное разрешение сцены /new: держит частоту кадров вровень с частотой
 * экрана (60, 120, 144 Гц…). Сцена упирается в число пикселей, поэтому регулируется
 * плотность пикселей (dpr): при пропусках кадров она снижается на шаг, при запасе —
 * возвращается. Смена dpr пересоздаёт буфер кадра (~20 мс), поэтому меняется редко.
 * Карточки — HTML, их чёткость это не затрагивает.
 */
import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { setAdaptiveDpr } from './adaptiveDpr'
/** Нижняя граница dpr: ниже картинка становится заметно мыльной. */
const MIN_DPR = 0.75
/** Шаг изменения dpr. */
const DPR_STEP = 0.125
/** Окно замера, мс. */
const WINDOW_MS = 1000
/** Кадр считается пропущенным, если он длиннее периода экрана в столько раз. */
const MISS_RATIO = 1.5
/** Доля пропущенных кадров в окне, при которой окно плохое. */
const DECLINE_AT = 0.05
/** Окно плохое и тогда, когда средний кадр длиннее периода экрана во столько раз:
 * равномерные 19 мс вместо 16,7 не дают «пропусков», но это 53 кадра вместо 60. */
const SLOW_AVG_RATIO = 1.08
/** Окно чистое, только если средний кадр не длиннее периода во столько раз. */
const CLEAN_AVG_RATIO = 1.03
/** Доля, ниже которой окно считается чистым. */
const CLEAN_BELOW = 0.01
/** Сколько плохих окон подряд нужно, чтобы снизить разрешение: единичный рывок
 * (сборка мусора, первый звук) — не повод, а смена dpr сама стоит ~20 мс. */
const BAD_WINDOWS_TO_DECLINE = 2
/** Сколько чистых окон подряд нужно, чтобы поднять разрешение. */
const CLEAN_WINDOWS_TO_INCLINE = 4
/** Сколько чистых окон подряд нужно, чтобы снова попробовать уровень, где были пропуски. */
const CLEAN_WINDOWS_TO_RELAX = 20
/** Цель не ниже 60 кадров/с, даже если видеокарта ещё ни разу не успела за экраном. */
const TARGET_PERIOD_MS = 1000 / 60
/** И не выше 144: на экранах 240–360 Гц гнаться за частотой ценой резкости незачем. */
const MIN_PERIOD_MS = 1000 / 144
/** Частоты экранов, к которым приводится замеренный период. */
const REFRESH_RATES = [360, 240, 165, 144, 120, 100, 90, 75, 60, 50, 30]
/** Сколько окон подряд должна подтвердиться более высокая частота экрана: случайно
 * короткие интервалы не должны поднять цель выше настоящей частоты. */
const PERIOD_CONFIRM_WINDOWS = 3
/** Кадры длиннее этого (вкладка была скрыта, отладчик) не учитываются. */
const MAX_FRAME_MS = 250

/**
 * Приводит замеренный период кадра к ближайшей стандартной частоте экрана.
 *
 * @param {number} ms Период, мс.
 * @return {number} Период стандартной частоты, мс.
 */
function snapPeriod(ms) {
  const hz = 1000 / ms
  const nearest = REFRESH_RATES.reduce((best, rate) => (Math.abs(rate - hz) < Math.abs(best - hz) ? rate : best))
  return 1000 / nearest
}

/**
 * Невидимый компонент внутри Canvas: управляет dpr.
 *
 * @return {null}
 */
export function AdaptiveQuality() {
  const setDpr = useThree((s) => s.setDpr)
  const maxDpr = useThree((s) => s.viewport.initialDpr)
  const q = useRef({
    level: maxDpr,
    // Уровни, на которых уже были пропуски: выше них разрешение больше не поднимается.
    ceiling: maxDpr,
    applied: maxDpr,
    period: TARGET_PERIOD_MS,
    candidate: TARGET_PERIOD_MS,
    confirmed: 0,
    last: 0,
    windowStart: 0,
    frames: 0,
    misses: 0,
    deltas: [],
    clean: 0,
    bad: 0,
    skipWindow: true,
  })

  const apply = () => {
    const s = q.current
    if (s.level === s.applied) return
    s.applied = s.level
    // Смена dpr пересоздаёт буфер кадра — это окно в замер не берём.
    s.skipWindow = true
    setAdaptiveDpr(s.level)
    setDpr(s.level)
  }

  useEffect(() => () => setAdaptiveDpr(null), [])

  useFrame(() => {
    const s = q.current
    const now = performance.now()
    const dt = s.last ? now - s.last : 0
    s.last = now
    if (!dt || dt > MAX_FRAME_MS) return
    if (!s.windowStart) s.windowStart = now

    s.frames++
    s.deltas.push(dt)
    if (dt > s.period * MISS_RATIO) s.misses++
    if (now - s.windowStart < WINDOW_MS) return

    // Период экрана: нижний дециль интервалов — кадры, пришедшие вовремя. На 120/144 Гц
    // он короче 60-герцового, и цель поднимается до частоты экрана.
    const sorted = s.deltas.sort((a, b) => a - b)
    const measured = Math.max(MIN_PERIOD_MS, snapPeriod(sorted[Math.floor(sorted.length * 0.1)]))
    if (measured < s.period) {
      s.confirmed = measured === s.candidate ? s.confirmed + 1 : 1
      s.candidate = measured
      if (s.confirmed >= PERIOD_CONFIRM_WINDOWS) s.period = measured
    } else {
      s.confirmed = 0
    }
    const missRate = s.misses / s.frames
    const avg = (now - s.windowStart) / s.frames
    const bad = missRate > DECLINE_AT || avg > s.period * SLOW_AVG_RATIO
    const clean = missRate < CLEAN_BELOW && avg <= s.period * CLEAN_AVG_RATIO
    const skip = s.skipWindow
    s.windowStart = now
    s.frames = 0
    s.misses = 0
    s.deltas = []
    s.skipWindow = false
    if (skip) return

    s.bad = bad ? s.bad + 1 : 0
    if (s.bad >= BAD_WINDOWS_TO_DECLINE && s.level > MIN_DPR) {
      s.bad = 0
      // Снижаем разрешение и не поднимаемся выше нового уровня, пока не наберётся
      // долгая чистая серия.
      s.level = Math.max(MIN_DPR, s.level - DPR_STEP)
      s.ceiling = s.level
      s.clean = 0
      apply()
    } else if (clean) {
      s.clean++
      if (s.level < s.ceiling && s.clean >= CLEAN_WINDOWS_TO_INCLINE) {
        s.level = Math.min(s.ceiling, s.level + DPR_STEP)
        s.clean = 0
        apply()
      } else if (s.level === s.ceiling && s.ceiling < maxDpr && s.clean >= CLEAN_WINDOWS_TO_RELAX) {
        s.ceiling = Math.min(maxDpr, s.ceiling + DPR_STEP)
        s.level = s.ceiling
        s.clean = 0
        apply()
      }
    } else {
      s.clean = 0
    }
  })

  return null
}
