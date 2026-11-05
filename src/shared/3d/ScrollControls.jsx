/**
 * @fileoverview Замена ScrollControls из drei (только вертикальная прокрутка).
 * drei при смене `pages` пересоздаёт контейнер прокрутки: ставит scrollTop = 1 и обнуляет
 * offset, поэтому сцена и HTML-слой отпрыгивали к началу и заново «доезжали» до места.
 * На телефоне `pages` считается по фактической высоте карточек и меняется прямо во время
 * прокрутки (счётчики, появление, загрузка шрифтов), отсюда и скачки. Здесь контейнер
 * создаётся один раз, а длина прокрутки меняется на месте с сохранением видимой позиции.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { easing } from 'maath'
import { ScrollContext } from './scrollState'

/**
 * Создаёт объект состояния прокрутки с теми же полями, что у drei.
 *
 * @param {HTMLElement} el Контейнер прокрутки.
 * @param {HTMLElement} fixed Липкий слой для HTML-содержимого.
 * @param {number} pages Длина прокрутки в экранах.
 * @return {Object} Состояние прокрутки.
 */
function createState(el, fixed, pages) {
  return {
    el,
    fixed,
    horizontal: false,
    eps: 0.00001,
    damping: 0.25,
    offset: 0,
    delta: 0,
    scroll: { current: 0 },
    pages,
    range(from, distance, margin = 0) {
      const start = from - margin
      const end = start + distance + margin * 2
      return this.offset < start ? 0 : this.offset > end ? 1 : (this.offset - start) / (end - start)
    },
    curve(from, distance, margin = 0) {
      return Math.sin(this.range(from, distance, margin) * Math.PI)
    },
    visible(from, distance, margin = 0) {
      const start = from - margin
      const end = start + distance + margin * 2
      return this.offset >= start && this.offset <= end
    },
  }
}

/**
 * Контейнер прокрутки поверх Canvas, связывающий scrollTop с прогрессом 0..1.
 *
 * @param {{pages?: number, distance?: number, damping?: number, eps?: number,
 *   children: React.ReactNode}} props Длина в экранах, множитель длины, сглаживание и содержимое.
 * @return {JSX.Element}
 */
export function ScrollControls({ pages = 1, distance = 1, damping = 0.25, eps = 0.00001, children }) {
  const { get, setEvents, gl, events, invalidate } = useThree()
  const [{ el, fill, fixed }] = useState(() => ({
    el: document.createElement('div'),
    fill: document.createElement('div'),
    fixed: document.createElement('div'),
  }))
  const [state] = useState(() => createState(el, fixed, pages))
  const threshold = useRef(0)
  const target = gl.domElement.parentNode

  state.damping = damping
  state.eps = eps

  useEffect(() => {
    Object.assign(el.style, {
      position: 'absolute', top: '0px', left: '0px', width: '100%', height: '100%',
      overflowY: 'auto', overflowX: 'hidden',
    })
    Object.assign(fixed.style, {
      position: 'sticky', top: '0px', left: '0px', width: '100%', height: '100%', overflow: 'hidden',
    })
    fill.style.width = '100%'
    fill.style.pointerEvents = 'none'
    el.appendChild(fixed)
    el.appendChild(fill)
    target.appendChild(el)

    const measure = () => {
      threshold.current = el.scrollHeight - el.clientHeight
    }
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    observer.observe(fill)

    // Один пиксель от начала, чтобы на iOS можно было потянуть вверх.
    el.scrollTop = 1
    let firstRun = true
    const firstFrame = requestAnimationFrame(() => { firstRun = false })
    const onScroll = () => {
      if (firstRun || threshold.current <= 0) return
      state.scroll.current = el.scrollTop / threshold.current
      invalidate()
    }
    el.addEventListener('scroll', onScroll, { passive: true })

    const oldTarget = events.connected || gl.domElement
    const connectFrame = requestAnimationFrame(() => events.connect?.(el))
    const oldCompute = get().events.compute
    setEvents({
      compute(event, s) {
        const { left, top } = target.getBoundingClientRect()
        s.pointer.set(((event.clientX - left) / s.size.width) * 2 - 1, -((event.clientY - top) / s.size.height) * 2 + 1)
        s.raycaster.setFromCamera(s.pointer, s.camera)
      },
    })

    return () => {
      cancelAnimationFrame(firstFrame)
      cancelAnimationFrame(connectFrame)
      observer.disconnect()
      el.removeEventListener('scroll', onScroll)
      target.removeChild(el)
      setEvents({ compute: oldCompute })
      events.connect?.(oldTarget)
    }
    // Контейнер создаётся один раз на монтирование; смена pages обрабатывается ниже.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [el, fill, fixed, target])

  // Смена длины: HTML-слой сдвинут на height × (pages − 1) × offset, поэтому offset
  // пересчитывается так, чтобы сдвиг остался прежним, и scrollTop ставится под него.
  useLayoutEffect(() => {
    const prevPages = state.pages
    fill.style.height = `${pages * distance * 100}%`
    threshold.current = el.scrollHeight - el.clientHeight
    if (prevPages === pages) return
    const ratio = pages > 1 ? (prevPages - 1) / (pages - 1) : 0
    const keep = (value) => Math.min(1, Math.max(0, value * ratio))
    state.pages = pages
    state.offset = keep(state.offset)
    state.scroll.current = keep(state.scroll.current)
    if (threshold.current > 0) el.scrollTop = Math.max(1, state.scroll.current * threshold.current)
    invalidate()
  }, [pages, distance, el, fill, state, invalidate])

  useFrame((_, delta) => {
    const last = state.offset
    easing.damp(state, 'offset', state.scroll.current, state.damping, delta, Infinity, undefined, state.eps)
    easing.damp(state, 'delta', Math.abs(last - state.offset), state.damping, delta, Infinity, undefined, state.eps)
    if (state.delta > state.eps) invalidate()
  })

  return <ScrollContext.Provider value={state}>{children}</ScrollContext.Provider>
}
