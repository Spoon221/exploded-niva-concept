/**
 * @fileoverview ПОКА НЕ ТРОГАЕМ. Изначальный (первый) вариант экрана загрузки: имя автора
 * крупной типографикой с поочерёдным проявлением слов, тонкая линия прогресса с плавным
 * счётчиком, подпись текущего шага и мягкое «северное сияние» на фоне. По готовности имя
 * уезжает вверх, экран поднимается шторкой и открывает сцену.
 *
 * На сайте сейчас используется второй вариант — PreloaderEditorial (через AssetPreloader
 * на главной и витрине, напрямую на стенде). Этот сохранён для сравнения и возможного
 * возврата; посмотреть его можно на странице /preloader (кнопка «Изначальный»).
 */
import { useEffect, useState } from 'react'
import { defaultCaption, itemLabel, useSmoothValue } from './preloaderShared'
import { useLang } from '@/shared/i18n/lang'
import './Preloader.css'

/** Длительность ухода экрана, мс (совпадает с CSS). */
const EXIT_MS = 1100

const NAME = {
  ru: [['Симаков'], ['Евгений', 'Сергеевич']],
  en: [['Simakov'], ['Evgeny', 'Sergeevich']],
}


/**
 * Изначальный экран загрузки (пока не трогаем). После done уходит и размонтируется.
 *
 * @param {{progress: number, item?: string, done?: boolean, caption?: string, still?: boolean}} props
 *   Прогресс в процентах, загружаемый файл, признак готовности, подпись над именем
 *   и неподвижный кадр (для картинки превью ссылки).
 * @return {?JSX.Element} Полноэкранный экран загрузки.
 */
export function Preloader({ progress, item = '', done = false, caption, still = false }) {
  const [hidden, setHidden] = useState(false)
  const lang = useLang()
  const displayedCaption = caption ?? defaultCaption(lang)
  const name = NAME[lang]
  const shown = useSmoothValue(done ? 100 : Math.min(progress, 99), still)

  useEffect(() => {
    if (!done) return undefined
    const timer = setTimeout(() => setHidden(true), EXIT_MS)
    return () => clearTimeout(timer)
  }, [done])

  if (hidden) return null
  let wordIndex = 0

  return (
    <div className={`app-preloader ${done ? 'is-done' : ''}`} role="status" aria-live="polite" aria-label={`${lang === 'en' ? 'Loading' : 'Загрузка'}: ${Math.round(shown)}%`}>
      <div className="app-preloader-aurora" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="app-preloader-grain" aria-hidden="true" />

      <div className="app-preloader-content">
        <p className="app-preloader-eyebrow">{displayedCaption}</p>

        <p className="app-preloader-name">
          {name.map((line, l) => (
            <span key={l} className={`app-preloader-line ${l ? 'is-light' : ''}`}>
              {line.map((word) => {
                const delay = 0.15 + wordIndex++ * 0.12
                return (
                  <span key={word} className="app-preloader-mask">
                    <span className="app-preloader-word" style={{ animationDelay: `${delay}s` }}>{word}</span>
                  </span>
                )
              })}
            </span>
          ))}
        </p>

        <div className="app-preloader-progress">
          <div className="app-preloader-track">
            <div className="app-preloader-bar" style={{ transform: `scaleX(${shown / 100})` }} />
          </div>
          <div className="app-preloader-meta">
            <span key={done ? 'done' : itemLabel(item, lang)} className="app-preloader-step">
              {done ? lang === 'en' ? 'Done' : 'Готово' : `${lang === 'en' ? 'Loading' : 'Загрузка'} — ${itemLabel(item, lang)}`}
            </span>
            <span className="app-preloader-count">{String(Math.round(shown)).padStart(3, '0')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
