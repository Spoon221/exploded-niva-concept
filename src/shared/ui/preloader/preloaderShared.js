/**
 * @fileoverview Общее для вариантов экрана загрузки: подписи шагов по загружаемым файлам,
 * подпись по умолчанию и плавно догоняющий счётчик.
 */
import { useEffect, useRef, useState } from 'react'

/** Подпись над именем по умолчанию. */
export const DEFAULT_CAPTION = 'Exploded Niva Concept'

/**
 * Возвращает подпись экрана загрузки для выбранного языка.
 *
 * @param {'ru'|'en'} lang Язык интерфейса.
 * @return {string} Локализованная подпись.
 */
export function defaultCaption(lang = 'ru') {
  return DEFAULT_CAPTION
}

/** Понятные подписи для загружаемых файлов: фрагмент пути → что грузится (ru, en). */
const ITEM_LABELS = [
  ['hdri', 'Небо', 'Sky'],
  ['big_box_store', 'Гипермаркет', 'Hypermarket'],
  ['lada_niva', 'Нива', 'Niva'],
  ['RobotExpressive', 'Робот', 'Robot'],
  ['spruit_sunrise', 'Освещение', 'Lighting'],
  ['asphalt', 'Асфальт', 'Asphalt'],
  ['grass', 'Газон', 'Lawn'],
  ['gravelly_sand', 'Песок', 'Sand'],
  ['rocky_trail', 'Камень', 'Stone'],
  ['pavement', 'Тротуар', 'Pavement'],
  ['cladding', 'Фасад', 'Facade'],
  ['shrub', 'Кустарник', 'Shrubs'],
]

/**
 * Подпись текущего шага загрузки.
 *
 * @param {string} item URL файла из useProgress или пустая строка.
 * @param {'ru'|'en'} [lang] Язык подписи.
 * @return {string} Подпись.
 */
export function itemLabel(item, lang = 'ru') {
  const labels = ITEM_LABELS.find(([key]) => item?.includes(key))
  if (lang === 'en') return labels?.[2] ?? 'Scene'
  return labels?.[1] ?? 'Сцена'
}

/** Время, за которое счётчик проходит ~63% пути до цели, мс (не зависит от частоты кадров). */
const SMOOTH_TAU_MS = 180

/**
 * Плавно догоняющее значение: счётчик не прыгает рывками за загрузчиком.
 * Возвращает целое число и перерисовывает компонент только при его смене (не чаще ~100 раз
 * за загрузку, а не каждый кадр) — на слабых машинах и VDI основной поток занят сценой.
 * Шаг считается по реальному времени кадра, поэтому при просадке FPS счётчик не замедляется.
 *
 * @param {number} target Целевое значение.
 * @param {boolean} [still=false] Сразу показать целевое значение, без анимации (кадр превью).
 * @return {number} Текущее отображаемое значение (целое).
 */
export function useSmoothValue(target, still = false) {
  const [value, setValue] = useState(still ? Math.round(target) : 0)
  const current = useRef(still ? target : 0)
  useEffect(() => {
    let frame
    let last = performance.now()
    const tick = (now) => {
      const dt = Math.min(now - last, 100)
      last = now
      current.current += (target - current.current) * (1 - Math.exp(-dt / SMOOTH_TAU_MS))
      if (Math.abs(target - current.current) < 0.5) current.current = target
      // React пропускает рендер, если целое значение не изменилось.
      setValue(Math.round(current.current))
      if (current.current !== target) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target])
  return value
}
