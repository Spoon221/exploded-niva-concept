/**
 * @fileoverview Радужное свечение у нижнего края экрана, которое поднимается по прогрессу.
 * Состоит из размытых вертикальных столбцов с градиентом; самый высокий — в центре.
 */
import { useId } from 'react'
import { createPortal } from 'react-dom'
import { clamp01 } from '@/shared/lib/easing'

const VIEW_W = 1271
const VIEW_H = 599
const GLOW_MASK = 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.3) 18%, black 100%)'

const DEFAULT_STOPS = [
  { offset: 0, color: '#340B05' },
  { offset: 0.1827, color: '#0358F7' },
  { offset: 0.2837, color: '#5092C7' },
  { offset: 0.4135, color: '#E1ECFE' },
  { offset: 0.5866, color: '#FFD400' },
  { offset: 0.6827, color: '#FA3D1D' },
  { offset: 0.8029, color: '#FD02F5' },
  { offset: 1, color: '#FFC0FD00' },
]

/**
 * Высоты столбцов «колоколом»: по краям ниже, в центре выше.
 *
 * @param {number} count Число столбцов.
 * @param {number} peak Высота центрального столбца как доля высоты viewBox.
 * @param {number} valley Высота крайних столбцов как доля пика.
 * @return {number[]} Высоты в единицах viewBox.
 */
function bellHeights(count, peak, valley) {
  const mid = (count - 1) / 2
  return Array.from({ length: count }, (_, i) => {
    const fromCenter = mid === 0 ? 0 : Math.abs(i - mid) / mid
    return peak * VIEW_H * (valley + (1 - valley) * (1 - fromCenter ** 1.24))
  })
}

/**
 * Свечение, закреплённое у нижнего края окна. Рендерится порталом в body.
 *
 * @param {{progress: number, height?: string, bars?: number, blur?: number, peak?: number,
 *   valley?: number, stops?: Array<{offset: number, color: string}>, zIndex?: number}} props
 *   Прогресс 0..1, высота полосы, число столбцов, размытие, форма колокола,
 *   цвета градиента снизу вверх и z-index.
 * @return {?React.ReactPortal}
 */
export function GradientGlow({
  progress,
  height = '65vh',
  bars = 9,
  blur = 15,
  peak = 0.98,
  valley = 0.55,
  stops = DEFAULT_STOPS,
  zIndex = 15,
}) {
  const uid = useId().replace(/:/g, '')
  const p = clamp01(progress)
  if (typeof document === 'undefined') return null

  // По прокрутке меняются только transform и opacity: их видеокарта применяет к готовому
  // слою. Размытые столбцы и маска статичны и растеризуются один раз — иначе 11 гауссовых
  // размытий перерисовывались бы в каждом кадре поверх WebGL.
  const eased = 1 - (1 - p) ** 5
  const hidden = p <= 0.003
  const columnWidth = VIEW_W / bars

  return createPortal(
    <div
      aria-hidden
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        height,
        zIndex,
        pointerEvents: 'none',
        transformOrigin: 'center bottom',
        transform: `scaleY(${Math.max(eased, 0.001)})`,
        opacity: hidden ? 0 : clamp01(p / 0.35),
        visibility: hidden ? 'hidden' : 'visible',
        WebkitMaskImage: GLOW_MASK,
        maskImage: GLOW_MASK,
        transition: 'opacity 0.4s ease-out',
        willChange: 'transform, opacity',
      }}
    >
      <svg style={{ display: 'block', width: '100%', height: '100%' }} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none" fill="none">
        <defs>
          <linearGradient id={`grad-${uid}`} x1="0" y1="1" x2="0" y2="0">
            {stops.map((stop) => <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />)}
          </linearGradient>
          <filter id={`blur-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={blur} />
          </filter>
        </defs>
        {bellHeights(bars, peak, valley).map((barHeight, i) => (
          <rect
            key={i}
            filter={`url(#blur-${uid})`}
            x={i * columnWidth}
            y={VIEW_H - barHeight}
            width={columnWidth * 1.23}
            height={barHeight}
            fill={`url(#grad-${uid})`}
          />
        ))}
      </svg>
    </div>,
    document.body,
  )
}
