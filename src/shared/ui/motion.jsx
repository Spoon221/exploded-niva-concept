/**
 * @fileoverview Лёгкие примитивы анимации для страницы /new в духе 21st.dev:
 * появление по скроллу, побуквенный вывод заголовка и счётчик чисел.
 * Работают без сторонних библиотек: IntersectionObserver + CSS-переходы + rAF.
 */
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { easeOutExpo } from '@/shared/lib/easing'

const RevealContext = createContext(false)

/**
 * Следит за видимостью элемента во вьюпорте.
 *
 * @param {React.RefObject<Element>} ref Элемент для наблюдения.
 * @param {{threshold?: number, rootMargin?: string, once?: boolean}} [options]
 *   Порог видимости, отступы корня и флаг однократного срабатывания.
 * @return {boolean} true, пока элемент находится в зоне видимости.
 */
function useInView(ref, { threshold = 0.2, rootMargin = '0px', once = false } = {}) {
  const [inView, setInView] = useState(() => typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    // Элемент выше экрана никогда не виден на долю threshold целиком, поэтому достаточно,
    // чтобы он занял ту же долю высоты экрана; частые пороги дают колбэк по пути.
    const steps = Array.from({ length: Math.ceil(threshold * 100) + 1 }, (_, i) => Math.min(threshold, i / 100))
    const io = new IntersectionObserver(([entry]) => {
      const rootHeight = entry.rootBounds?.height ?? window.innerHeight
      const visible = entry.isIntersecting && (
        entry.intersectionRatio >= threshold || entry.intersectionRect.height >= rootHeight * threshold
      )
      if (visible) {
        setInView(true)
        if (once) io.disconnect()
      } else if (!once && !entry.isIntersecting) {
        setInView(false)
      }
    }, { threshold: steps, rootMargin })
    io.observe(el)
    return () => io.disconnect()
  }, [ref, threshold, rootMargin, once])

  return inView
}

/**
 * Обёртка, которая проставляет классы появления и раздаёт состояние видимости потомкам.
 *
 * @param {{children: React.ReactNode, className?: string, threshold?: number}} props
 *   Содержимое, дополнительные классы и порог срабатывания.
 * @return {JSX.Element} div с классами `reveal` и `is-revealed` в зоне видимости.
 */
export function Reveal({ children, className = '', threshold = 0.2 }) {
  const ref = useRef(null)
  const inView = useInView(ref, { threshold })

  return (
    <RevealContext.Provider value={inView}>
      <div ref={ref} className={`${className} reveal${inView ? ' is-revealed' : ''}`}>
        {children}
      </div>
    </RevealContext.Provider>
  )
}

/**
 * Возвращает состояние видимости ближайшего родительского Reveal.
 *
 * @return {boolean} true, если родительский блок виден.
 */
function useRevealed() {
  return useContext(RevealContext)
}

/**
 * Выводит текст по буквам или по словам с размытием и сдвигом, как BlurIn/SplitText на 21st.dev.
 * Задержка каждого фрагмента передаётся в CSS через переменную `--d`.
 *
 * @param {{text: string, as?: string, className?: string, stagger?: number,
 *   by?: 'char'|'word'}} props Текст, тег-обёртка, классы, шаг задержки в мс и единица разбиения.
 * @return {JSX.Element} Элемент с фрагментами-span, доступный скринридерам через aria-label.
 */
export function SplitText({ text, as: Tag = 'span', className = '', stagger = 35, by = 'char' }) {
  const words = text.split(' ')
  let index = 0

  return (
    <Tag className={`split-text ${className}`} aria-label={text}>
      {words.map((word, wi) => {
        const parts = by === 'word' ? [word] : [...word]
        return (
          <span className="split-word" aria-hidden="true" key={wi}>
            {parts.map((part, ci) => (
              <span className="split-char" style={{ '--d': `${index++ * stagger}ms` }} key={ci}>
                {part}
              </span>
            ))}
            {wi < words.length - 1 && '\u00A0'}
          </span>
        )
      })}
    </Tag>
  )
}

/**
 * Плавно досчитывает число от нуля до значения, когда родительский Reveal становится видимым.
 *
 * @param {{value: number, decimals?: number, duration?: number, suffix?: string}} props
 *   Целевое значение, знаков после запятой, длительность в мс и суффикс.
 * @return {JSX.Element} span с текущим значением счётчика.
 */
export function NumberTicker({ value, decimals = 0, duration = 1400, suffix = '' }) {
  const revealed = useRevealed()
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (!revealed) return
    let raf
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      setDisplay(value * easeOutExpo(t))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [revealed, value, duration])

  return (
    <span className="number-ticker" aria-label={`${value}${suffix}`}>
      {(revealed ? display : 0).toFixed(decimals)}{suffix}
    </span>
  )
}
