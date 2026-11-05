/**
 * @fileoverview Замена <Scroll html> из drei: HTML-слой, прокручиваемый вместе с ScrollControls.
 * drei создаёт для слоя отдельный React-root и никогда его не размонтирует, поэтому после
 * ухода со страницы порталы слоя (футер, свечение в body) оставались на экране, а их
 * обработчики продолжали работать. Здесь root размонтируется вместе с компонентом.
 */
import { useLayoutEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { useFrame, useThree } from '@react-three/fiber'
import { useScroll } from './scrollState'
import { ScrollStateContext } from './scrollHtmlState'

/**
 * HTML-слой внутри ScrollControls.
 *
 * @param {{children: React.ReactNode, style?: Object}} props Содержимое слоя и стили обёртки.
 * @return {null} Слой рендерится в собственный root внутри контейнера drei.
 */
export function ScrollHtml({ children, style, ...props }) {
  const state = useScroll()
  const group = useRef(null)
  const { width, height } = useThree((s) => s.size)
  const root = useRef(null)

  // Свой контейнер на каждое монтирование: StrictMode монтирует эффекты дважды,
  // и два root не должны делить один элемент.
  useLayoutEffect(() => {
    const container = document.createElement('div')
    state.fixed.appendChild(container)
    const nextRoot = createRoot(container)
    root.current = nextRoot
    return () => {
      root.current = null
      // Синхронно размонтировать root во время рендера другого root React не позволяет.
      setTimeout(() => {
        nextRoot.unmount()
        container.remove()
      })
    }
  }, [state.fixed])

  // Сдвиг пишется по факту изменения, а не только пока идёт прокрутка: после смены
  // высоты экрана или длины прокрутки слой иначе оставался бы на старом месте.
  const lastTransform = useRef('')
  useFrame(() => {
    if (!group.current) return
    const x = state.horizontal ? -width * (state.pages - 1) * state.offset : 0
    const y = state.horizontal ? 0 : height * (state.pages - 1) * -state.offset
    const transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0)`
    if (transform === lastTransform.current) return
    lastTransform.current = transform
    group.current.style.transform = transform
  })

  // Объявлен после эффекта создания root, поэтому при монтировании выполняется следом за ним.
  useLayoutEffect(() => {
    root.current?.render(
      <div ref={group} {...props} style={{ ...style, position: 'absolute', top: 0, left: 0, willChange: 'transform' }}>
        <ScrollStateContext.Provider value={state}>{children}</ScrollStateContext.Provider>
      </div>,
    )
  })

  return null
}
