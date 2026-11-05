/**
 * @fileoverview Текущий экран загрузки сайта (главная, витрина, стенд) — второй,
 * «редакционный» вариант: фамилия крупным гротеском
 * с поочерёдным проявлением букв из размытия, имя и отчество курсивной антиквой, тема диплома,
 * огромный счётчик-одометр (цифры прокручиваются барабаном), шкала из делений и подпись
 * текущего шага. По готовности буквы уходят вверх, а экран разъезжается пятью колоннами-
 * шторками снизу вверх. Принимает те же свойства, что и изначальный Preloader, — варианты
 * взаимозаменяемы.
 */
import { useEffect, useState } from 'react'
import { defaultCaption, itemLabel, useSmoothValue } from './preloaderShared'
import { usePreloaderPresence } from './preloaderPresence'
import { detectSoftwareRenderer } from '@/shared/lib/device'
import { useLang } from '@/shared/i18n/lang'
import './PreloaderEditorial.css'

/** Длительность ухода экрана, мс (совпадает с CSS: задержка последней колонны + её ход). */
const EXIT_MS = 1400
/** Делений на шкале прогресса. */
const TICKS = 48
/** Колонн-шторок при уходе. */
const COLUMNS = 5
/** Имя, тема работы (две строки, на телефоне переносится свободно) и подписи по языкам. */
const TEXT = {
  ru: {
    surname: 'Симаков',
    given: 'Евгений Сергеевич',
    thesis: [
      'Исследование методов оптимизации производительности',
      'интерактивных 3D-сцен в веб-приложениях на базе React Three Fiber',
    ],
    tag: 'ВКР',
    loading: 'Загрузка',
    done: 'Готово',
  },
  en: {
    surname: 'Simakov',
    given: 'Evgeny Sergeevich',
    thesis: [
      'A study of performance optimization methods',
      'for interactive 3D scenes in web applications built on React Three Fiber',
    ],
    tag: 'Thesis',
    loading: 'Loading',
    done: 'Done',
  },
}

/**
 * Процент загрузки, приведённый к 0..100 (NaN и выход за пределы у загрузчика — не редкость).
 *
 * @param {number} progress Процент от загрузчика.
 * @return {number} 0..100.
 */
const clampPercent = (progress) => (Number.isFinite(progress) ? Math.min(100, Math.max(0, progress)) : 0)

/** Разряды счётчика 000–100: сотни, десятки, единицы. */
const PLACES = [100, 10, 1]

/**
 * Один разряд одометра. Столбик — не 0–9, а все положения разряда от 0 до 100 % подряд
 * (у единиц — 101 ячейка, у десятков — 11, у сотен — 2), и прокручивается он к
 * floor(значение / разряд). Так барабан при росте значения едет только вперёд: при 99 → 100
 * десятки и единицы докручиваются 9 → 0 вперёд, а не откатываются назад через 8, 7, 6
 * (в середине такого отката было видно «176 %»).
 *
 * @param {{value: number, place: number}} props Значение 0..100 и разряд (100, 10, 1).
 * @return {JSX.Element}
 */
function OdometerDigit({ value, place }) {
  const cells = Math.floor(100 / place) + 1
  const index = Math.floor(value / place)
  return (
    <span className="pl2-digit">
      <span className="pl2-digit-strip" style={{ transform: `translateY(${(-index * 100) / cells}%)` }}>
        {Array.from({ length: cells }, (_, d) => <span key={d}>{d % 10}</span>)}
      </span>
    </span>
  )
}

/**
 * «Редакционный» экран загрузки. После done уходит и размонтируется.
 *
 * @param {{progress: number, item?: string, done?: boolean, caption?: string, still?: boolean}} props
 *   Прогресс в процентах, загружаемый файл, признак готовности, подпись
 *   и неподвижный кадр (для картинки превью ссылки).
 * @return {?JSX.Element} Полноэкранный экран загрузки.
 */
export function PreloaderEditorial({ progress, item = '', done = false, caption, still = false }) {
  const [hidden, setHidden] = useState(false)
  const lang = useLang()
  const text = TEXT[lang]
  const displayedCaption = caption ?? defaultCaption(lang)
  // Программный GPU (VDI и т. п.): без размытия и пружинящих делений — только transform/opacity.
  const [lite] = useState(detectSoftwareRenderer)
  // Загрузчик three.js может уменьшить процент, когда в очередь встают новые файлы; счётчик
  // не откатывается назад и не выходит за 0..100.
  const [peak, setPeak] = useState(0)
  const percent = clampPercent(progress)
  if (percent > peak) setPeak(percent)
  const shown = useSmoothValue(done ? 100 : Math.min(Math.max(peak, percent), 99), still)
  // Пока страница грузится, интерфейс (шапка) скрыт.
  usePreloaderPresence(!done)
  const value = Math.min(100, Math.max(0, shown))

  useEffect(() => {
    if (!done) return undefined
    const timer = setTimeout(() => setHidden(true), EXIT_MS)
    return () => clearTimeout(timer)
  }, [done])

  if (hidden) return null
  const filled = Math.round((shown / 100) * TICKS)

  return (
    <div className={`pl2 ${lite ? 'is-lite' : ''} ${done ? 'is-done' : ''}`} role="status" aria-live="polite" aria-label={`${text.loading}: ${value}%`}>
      <div className="pl2-columns" aria-hidden="true">
        {Array.from({ length: COLUMNS }, (_, i) => <span key={i} style={{ '--i': i }} />)}
      </div>

      <div className="pl2-frame">
        <header className="pl2-top">
          <span>{displayedCaption}</span>
          <span>{text.tag} · {new Date().getFullYear()}</span>
        </header>

        <div className="pl2-name">
          <p className="pl2-surname" aria-label={text.surname}>
            {text.surname.split('').map((letter, i) => (
              <span key={i} aria-hidden="true" style={{ '--d': `${0.1 + i * 0.06}s` }}>{letter}</span>
            ))}
          </p>
          <p className="pl2-given">{text.given}</p>
          <p className="pl2-thesis">
            {text.thesis.map((line) => <span key={line} className="pl2-thesis-line">{line} </span>)}
          </p>
        </div>

        <footer className="pl2-bottom">
          <div className="pl2-status">
            <span key={done ? 'done' : itemLabel(item, lang)} className="pl2-step">
              {done ? text.done : itemLabel(item, lang)}
            </span>
            <span className="pl2-ticks" aria-hidden="true">
              {Array.from({ length: TICKS }, (_, i) => <span key={i} className={i < filled ? 'is-on' : ''} />)}
            </span>
          </div>
          <div className="pl2-counter" aria-hidden="true">
            {PLACES.map((place) => <OdometerDigit key={place} value={value} place={place} />)}
            <span className="pl2-percent">%</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
