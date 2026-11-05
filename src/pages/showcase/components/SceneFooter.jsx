/**
 * @fileoverview Футер страницы /new. В конце прокрутки снизу поднимается радужное свечение,
 * затем по световой линии раскрывается синяя карточка с контактами; содержимое
 * появляется по колонкам и строкам синхронно со скроллом.
 */
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useScrollHtmlState } from '@/shared/3d/scrollHtmlState'
import { useLang } from '@/shared/i18n/lang'
import { scrollMax } from '../lib/scrollMetrics'
import { ArrowUpRight } from 'lucide-react'
import { GradientGlow } from '@/shared/ui/GradientGlow'
import { playClickSound } from '@/shared/lib/synthAudio'
import { easeInOutQuint, easeOutCubic, progressBetween, smoothstep } from '@/shared/lib/easing'
import { setOverlayHover } from '../scene/overlayHover'
import { FOOTER_GLOW_START, FOOTER_GLOW_END, FOOTER_CARD_START, FOOTER_CARD_END, footerProgress } from '../data/footerTiming'

const PROJECT_URL = 'https://simakov.space/'

const FOOTER_COLUMNS = [
  {
    title: 'Проект',
    links: [
      { label: 'Оригинальная витрина', href: 'https://simakov.space/new' },
      { label: 'Сайт автора', href: PROJECT_URL },
    ],
  },
  {
    title: 'Контакты',
    links: [
      { label: 'Telegram', href: 'https://t.me/EvgeniiSimakov' },
      { label: 'GitHub', href: 'https://github.com/Spoon221' },
    ],
  },
]

const FOOTER_COLUMNS_EN = [
  {
    title: 'Project',
    links: [
      { label: 'Live showcase', href: 'https://simakov.space/new' },
      { label: 'Author website', href: PROJECT_URL },
    ],
  },
  {
    title: 'Contact',
    links: [
      { label: 'Telegram', href: 'https://t.me/EvgeniiSimakov' },
      { label: 'GitHub', href: 'https://github.com/Spoon221' },
    ],
  },
]

const GLOW_STOPS = [
  { offset: 0, color: '#2a0845' },
  { offset: 0.16, color: '#0358F7' },
  { offset: 0.28, color: '#00F0FF' },
  { offset: 0.42, color: '#FFFFFF' },
  { offset: 0.58, color: '#FFD400' },
  { offset: 0.7, color: '#FA3D1D' },
  { offset: 0.82, color: '#FD02F5' },
  { offset: 1, color: '#FD02F500' },
]

const MOUNT_THRESHOLD = FOOTER_GLOW_START - 0.1
const TOUCH_INERTIA_DECAY = 0.95
const SCAN_LINE_CLASS = 'absolute left-0 right-0 h-[2px] bg-white shadow-[0_0_12px_#ffffff,0_0_24px_#38bdf8] pointer-events-none z-20'

/**
 * Прогресс появления колонки футера: колонки стартуют по очереди.
 *
 * @param {number} openProgress Прогресс раскрытия карточки 0..1.
 * @param {number} index Номер колонки, 0 — блок с именем.
 * @return {number} Сглаженный прогресс 0..1.
 */
function cellProgress(openProgress, index) {
  const start = 0.08 + index * 0.14
  return easeOutCubic(progressBetween(openProgress, start, Math.min(1, start + 0.36)))
}

/**
 * Прогресс появления строки внутри колонки.
 *
 * @param {number} cell Прогресс колонки 0..1.
 * @param {number} index Номер строки.
 * @param {number} total Число строк в колонке.
 * @return {number} Сглаженный прогресс 0..1.
 */
function itemProgress(cell, index, total) {
  if (cell <= 0) return 0
  const start = index * (0.48 / Math.max(1, total))
  return easeOutCubic(progressBetween(cell, start, Math.min(1, start + 0.52)))
}

/**
 * Обёртка, которая поднимает и проявляет содержимое по прогрессу.
 *
 * @param {{progress: number, shift?: number, as?: string, children: React.ReactNode}} props
 *   Прогресс 0..1, сдвиг по вертикали в пикселях, тег и содержимое.
 * @return {JSX.Element}
 */
function RevealItem({ progress, shift = 20, as: Tag = 'div', children }) {
  return (
    <Tag
      style={{
        opacity: progress,
        transform: `translateY(${(1 - progress) * shift}px)`,
        transition: 'opacity 0.12s ease-out, transform 0.12s ease-out',
      }}
    >
      {children}
    </Tag>
  )
}

/**
 * Следит за прокруткой контейнера ScrollControls и возвращает прогрессы футера.
 *
 * @param {?HTMLElement} el Элемент прокрутки.
 * @return {{scroll: number, glow: number, card: number}} Прогресс страницы, свечения и карточки.
 */
function useFooterProgress(el) {
  const [state, setState] = useState({ scroll: 0, glow: 0, card: 0 })

  useEffect(() => {
    if (!el) return
    const update = () => {
      const max = scrollMax(el)
      if (max <= 0) return
      const scroll = footerProgress(el.scrollTop / max)
      // Пока футер не смонтирован, его состояние не меняется — не перерисовываем
      // компонент на каждом событии прокрутки по всей странице.
      if (scroll <= MOUNT_THRESHOLD) {
        setState((prev) => (prev.scroll <= MOUNT_THRESHOLD ? prev : { scroll, glow: 0, card: 0 }))
        return
      }
      setState({
        scroll,
        glow: easeInOutQuint(progressBetween(scroll, FOOTER_GLOW_START, FOOTER_GLOW_END)),
        card: progressBetween(scroll, FOOTER_CARD_START, FOOTER_CARD_END),
      })
    }
    el.addEventListener('scroll', update, { passive: true })
    update()
    return () => el.removeEventListener('scroll', update)
  }, [el])

  return state
}

/**
 * Элементы, над которыми прокрутку нужно переносить в контейнер сцены: сам футер и
 * контейнер страницы. Пока футер открыт, сцена вместе с контейнером прокрутки поднята
 * вверх, и внизу экрана под пальцем остаётся только контейнер страницы.
 *
 * @param {HTMLElement} scrollEl Элемент прокрутки.
 * @param {Array<React.RefObject<HTMLElement>>} refs Элементы футера.
 * @return {HTMLElement[]} Элементы для перехвата.
 */
function passthroughTargets(scrollEl, refs) {
  return [...refs.map((ref) => ref.current), scrollEl.closest('.sandbox-container')].filter(Boolean)
}

/**
 * Перенаправляет колесо мыши над фиксированным футером в контейнер прокрутки сцены,
 * иначе страница «застревает», пока курсор над карточкой.
 *
 * @param {?HTMLElement} scrollEl Элемент прокрутки.
 * @param {Array<React.RefObject<HTMLElement>>} refs Элементы, над которыми перехватывается колесо.
 * @param {boolean} active Смонтирован ли футер.
 */
function useWheelPassthrough(scrollEl, refs, active) {
  useEffect(() => {
    if (!scrollEl || !active) return
    const targets = passthroughTargets(scrollEl, refs)
    const onWheel = (e) => {
      // Над самой сценой браузер прокручивает контейнер сам.
      if (scrollEl.contains(e.target)) return
      const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 800 : 1
      scrollEl.scrollTop += e.deltaY * unit
      e.preventDefault()
    }
    targets.forEach((el) => el.addEventListener('wheel', onWheel, { passive: false }))
    return () => targets.forEach((el) => el.removeEventListener('wheel', onWheel))
  }, [scrollEl, refs, active])
}

/**
 * То же для свайпов на тач-экранах: футер лежит поверх сцены в body, поэтому сам браузер
 * не прокручивает под ним контейнер сцены. Сдвиг пальца переносится в scrollTop,
 * после отпускания прокрутка продолжается по инерции.
 *
 * @param {?HTMLElement} scrollEl Элемент прокрутки.
 * @param {Array<React.RefObject<HTMLElement>>} refs Элементы, над которыми перехватываются свайпы.
 * @param {boolean} active Смонтирован ли футер.
 */
function useTouchPassthrough(scrollEl, refs, active) {
  useEffect(() => {
    if (!scrollEl || !active) return
    const targets = passthroughTargets(scrollEl, refs)
    let tracking = false
    let lastY = 0
    let lastTime = 0
    let velocity = 0
    let frame = 0

    const stopInertia = () => cancelAnimationFrame(frame)
    const onTouchStart = (e) => {
      stopInertia()
      tracking = !scrollEl.contains(e.target)
      lastY = e.touches[0].clientY
      lastTime = performance.now()
      velocity = 0
    }
    const onTouchMove = (e) => {
      if (!tracking) return
      const y = e.touches[0].clientY
      const now = performance.now()
      const dy = lastY - y
      scrollEl.scrollTop += dy
      velocity = dy / Math.max(1, now - lastTime)
      lastY = y
      lastTime = now
      if (e.cancelable) e.preventDefault()
    }
    const onTouchEnd = () => {
      if (!tracking) return
      tracking = false
      let prev = performance.now()
      const step = (now) => {
        scrollEl.scrollTop += velocity * (now - prev)
        velocity *= Math.pow(TOUCH_INERTIA_DECAY, (now - prev) / 16)
        prev = now
        if (Math.abs(velocity) > 0.02) frame = requestAnimationFrame(step)
      }
      if (performance.now() - lastTime < 100) frame = requestAnimationFrame(step)
    }

    targets.forEach((el) => {
      el.addEventListener('touchstart', onTouchStart, { passive: true })
      el.addEventListener('touchmove', onTouchMove, { passive: false })
      el.addEventListener('touchend', onTouchEnd, { passive: true })
    })
    return () => {
      stopInertia()
      targets.forEach((el) => {
        el.removeEventListener('touchstart', onTouchStart)
        el.removeEventListener('touchmove', onTouchMove)
        el.removeEventListener('touchend', onTouchEnd)
      })
    }
  }, [scrollEl, refs, active])
}

/**
 * Футер с градиентным свечением и раскрывающейся карточкой контактов.
 * Карточка рендерится порталом в body, чтобы оставаться фиксированной поверх сцены.
 *
 * @return {JSX.Element}
 */
export function SceneFooter() {
  const lang = useLang()
  const columns = lang === 'en' ? FOOTER_COLUMNS_EN : FOOTER_COLUMNS
  const scrollEl = useScrollHtmlState()?.el
  const { scroll, glow, card } = useFooterProgress(scrollEl)
  const bannerRef = useRef(null)
  const overlayRef = useRef(null)
  const [wheelTargets] = useState(() => [bannerRef, overlayRef])

  const isMounted = scroll > MOUNT_THRESHOLD
  useWheelPassthrough(scrollEl, wheelTargets, isMounted)
  useTouchPassthrough(scrollEl, wheelTargets, isMounted)

  const beam = smoothstep(0, 0.18, card)
  const openProgress = progressBetween(card, 0.12, 1)
  const open = easeOutCubic(openProgress)
  const edgeInset = `${(1 - open) * 50}%`
  const isVisible = card > 0.002
  const showInitialBeam = openProgress <= 0.04 && card > 0.005
  const nameCell = cellProgress(openProgress, 0)

  const footerCard = isMounted && (
    <div
      ref={overlayRef}
      className="scene-footer-fixed-overlay"
      onPointerEnter={() => setOverlayHover('footer', true)}
      onPointerLeave={() => setOverlayHover('footer', false)}
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        zIndex: 35,
        padding: '0 0 clamp(400px, 49vh, 550px) 0',
        // Прозрачный отступ под карточкой не должен ловить касания: под ним сцена,
        // которую нужно прокручивать обратно вверх. Клики принимает только сама карточка.
        pointerEvents: 'none',
        opacity: isVisible ? 1 : 0,
        visibility: isVisible ? 'visible' : 'hidden',
        transition: 'opacity 0.2s ease-out, visibility 0.2s ease-out',
      }}
    >
      <div className="relative w-full">
        {showInitialBeam && (
          <div
            className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] bg-white shadow-[0_0_15px_#ffffff,0_0_30px_#00e5ff] z-20 pointer-events-none"
            style={{ transform: `scaleX(${beam})`, transformOrigin: 'center', opacity: beam }}
          />
        )}

        <div
          ref={bannerRef}
          className="relative w-full overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.75),0_10px_35px_rgba(22,104,232,0.5)] border-y border-white/20"
          style={{
            backgroundColor: '#1668e8',
            backgroundImage:
              'repeating-linear-gradient(to right, rgba(255, 255, 255, 0.09) 0px, rgba(255, 255, 255, 0.09) 1px, transparent 1px, transparent 64px)',
            clipPath: `inset(${edgeInset} 0 ${edgeInset} 0)`,
            opacity: openProgress > 0 ? 1 : 0,
            pointerEvents: openProgress > 0.3 ? 'auto' : 'none',
          }}
        >
          {openProgress < 0.999 && (
            <>
              <div className={SCAN_LINE_CLASS} style={{ top: edgeInset }} />
              <div className={SCAN_LINE_CLASS} style={{ bottom: edgeInset }} />
            </>
          )}

          <div className="scene-footer-inner w-full max-w-[1720px]">
            <div className="flex flex-col lg:flex-row items-start justify-between w-full gap-3 sm:gap-8 lg:gap-12">
              <div className="scene-footer-name w-full lg:w-auto relative shrink-0" style={{ opacity: nameCell > 0.02 ? 1 : 0 }}>
                <RevealItem progress={itemProgress(nameCell, 0, 2)}>
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">{lang === 'en' ? 'Evgenii Simakov' : 'Симаков Евгений'}</h2>
                </RevealItem>
                <RevealItem progress={itemProgress(nameCell, 1, 2)}>
                  <p className="text-sm sm:text-base font-medium text-white/90">{lang === 'en' ? 'Backend developer at Alfa-Bank' : 'backend разработчик Альфа-Банк'}</p>
                </RevealItem>
              </div>

              <div className="w-full lg:w-auto flex justify-start lg:justify-end">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 sm:gap-8 lg:gap-10 xl:gap-12 w-full sm:w-auto">
                  {columns.map((col, idx) => {
                    const cell = cellProgress(openProgress, idx + 1)
                    const total = col.links.length + 1
                    return (
                      <div
                        key={col.title}
                        className="scene-footer-col min-w-0 sm:min-w-[160px] lg:min-w-[190px] xl:min-w-[210px] font-sans relative border-t sm:border-t-0 sm:border-l border-white/15"
                        style={{ opacity: cell > 0.02 ? 1 : 0 }}
                      >
                        <div
                          className="hidden sm:block absolute left-0 top-0 bottom-0 w-[1px] bg-white/20 origin-top pointer-events-none"
                          style={{ transform: `scaleY(${cell})`, transition: 'transform 0.15s ease-out' }}
                        />
                        <RevealItem progress={itemProgress(cell, 0, total)} shift={18}>
                          <h3 className="text-base font-semibold text-white tracking-normal">{col.title}</h3>
                        </RevealItem>
                        <ul className="scene-footer-links text-sm">
                          {col.links.map((link, linkIdx) => (
                            <RevealItem as="li" key={link.label} progress={itemProgress(cell, linkIdx + 1, total)} shift={18}>
                              <a
                                href={link.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={playClickSound}
                                className="group inline-flex items-center gap-1.5 py-0.5 text-white/75 transition-colors duration-200 hover:text-white"
                              >
                                <span className="relative">
                                  {link.label}
                                  <span className="absolute -bottom-0.5 left-0 h-[1.5px] w-0 bg-white transition-all duration-200 ease-out group-hover:w-full" />
                                </span>
                                <ArrowUpRight className="size-3.5 text-white/40 transition-all duration-200 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                              </a>
                            </RevealItem>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Монтируется заранее, ещё невидимым: SVG с размытием не создаётся в момент появления. */}
      {isMounted && <GradientGlow progress={glow} height="70vh" bars={11} blur={22} stops={GLOW_STOPS} />}
      {footerCard && typeof document !== 'undefined' ? createPortal(footerCard, document.body) : null}
    </>
  )
}
