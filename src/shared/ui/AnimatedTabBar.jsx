/**
 * @fileoverview «Островная» панель вкладок с подвижной выемкой под активной вкладкой
 * и матовым стеклом, которое оттаивает под курсором и снова запотевает через паузу.
 */
import { useState, useRef, useLayoutEffect, useCallback, useEffect } from 'react'
import { easeInOutQuad } from '@/shared/lib/easing'
import './AnimatedTabBar.css'

const DEFROST_MS = 400
const REFROST_MS = 2000
const IDLE_BEFORE_REFROST_MS = 1200
const BORDER_SETTLE_MS = 40


/**
 * Анимирует CSS-переменные --frost-opacity и --defrost-glow на переданных элементах.
 *
 * @param {Array<React.RefObject<HTMLElement>>} targets Элементы, получающие переменные.
 * @return {{defrost: function(): void, refrost: function(): void}} Запуск оттаивания и запотевания.
 */
function useFrost(targets) {
  const frame = useRef(null)
  const idleTimer = useRef(null)
  const anim = useRef({ from: 1, to: 1, current: 1, start: 0, duration: REFROST_MS })

  const apply = (value) => {
    targets.forEach(({ current: el }) => {
      el?.style.setProperty('--frost-opacity', value.toFixed(3))
      el?.style.setProperty('--defrost-glow', (1 - value).toFixed(3))
    })
  }

  const step = (now) => {
    const a = anim.current
    a.start ||= now
    const progress = Math.min(1, (now - a.start) / a.duration)
    a.current = a.from + (a.to - a.from) * easeInOutQuad(progress)
    apply(a.current)
    frame.current = progress < 1 ? requestAnimationFrame(step) : null
  }

  const animateTo = (to, duration) => {
    const a = anim.current
    if (a.to === to && (frame.current || Math.abs(a.current - to) < 0.003)) return
    Object.assign(a, { from: a.current, to, duration, start: 0 })
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(step)
  }

  const defrost = () => {
    animateTo(0, DEFROST_MS)
    clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => animateTo(1, REFROST_MS), IDLE_BEFORE_REFROST_MS)
  }

  const refrost = () => {
    clearTimeout(idleTimer.current)
    animateTo(1, REFROST_MS)
  }

  useEffect(() => () => {
    cancelAnimationFrame(frame.current)
    clearTimeout(idleTimer.current)
  }, [])

  return { defrost, refrost }
}

/**
 * Панель вкладок.
 *
 * @param {{items: Array<{color: string, label?: string, icon: React.ReactNode,
 *   ariaPressed?: boolean, toggle?: boolean, badge?: React.ReactNode, badgeDone?: boolean}>,
 *   defaultIndex?: number, activeIndex?: number, onTabChange?: function(number): void,
 *   backButton?: React.ReactNode, className?: string, children?: React.ReactNode}} props
 *   Вкладки (подпись показывается подсказкой при наведении; toggle — кнопка-переключатель,
 *   над которой выпуклость не встаёт), начальный или управляемый
 *   активный индекс, колбэк смены вкладки, кнопка «назад» слева, дополнительные классы
 *   и содержимое справа.
 * @return {JSX.Element}
 */
export function AnimatedTabBar({
  items,
  defaultIndex = 0,
  activeIndex: controlledIndex,
  onTabChange,
  backButton,
  className = '',
  children,
}) {
  const [internalIndex, setInternalIndex] = useState(defaultIndex)
  const activeIndex = controlledIndex ?? internalIndex
  const menuRef = useRef(null)
  const borderRef = useRef(null)
  const itemRefs = useRef([])
  const [frostTargets] = useState(() => [menuRef, borderRef])
  const frost = useFrost(frostTargets)

  // Крайней вкладке нужно место по бокам, чтобы выпуклость (всегда полной ширины)
  // встала ровно над ней, а не прижималась внутрь панели: при нехватке добавляем отступ у края.
  const fitEdges = useCallback(() => {
    const menu = menuRef.current
    const border = borderRef.current
    // Выпуклость встаёт только над вкладками; кнопки-переключатели (toggle) её не получают.
    const selectable = items.map((item, i) => (item.toggle ? null : itemRefs.current[i])).filter(Boolean)
    const first = selectable[0]
    const last = selectable.at(-1)
    if (!menu || !border || !first || !last) return
    menu.style.removeProperty('padding-left')
    menu.style.removeProperty('padding-right')
    const menuRect = menu.getBoundingClientRect()
    const style = getComputedStyle(menu)
    const lack = (room, item) => Math.max(0, Math.ceil((border.offsetWidth - item.offsetWidth) / 2 - room))
    const extraLeft = lack(first.getBoundingClientRect().left - menuRect.left, first)
    const extraRight = lack(menuRect.right - last.getBoundingClientRect().right, last)
    if (extraLeft) menu.style.paddingLeft = `${parseFloat(style.paddingLeft) + extraLeft}px`
    if (extraRight) menu.style.paddingRight = `${parseFloat(style.paddingRight) + extraRight}px`
  }, [items])

  const moveBorder = useCallback(() => {
    const item = itemRefs.current[activeIndex]
    const menu = menuRef.current
    const border = borderRef.current
    if (!item || !menu || !border) return
    const itemRect = item.getBoundingClientRect()
    const menuRect = menu.getBoundingClientRect()
    const left = Math.round(itemRect.left - menuRect.left - (border.offsetWidth - itemRect.width) / 2)
    border.style.transform = `translate3d(${left}px, 0, 0)`
  }, [activeIndex])

  useLayoutEffect(() => {
    fitEdges()
    moveBorder()
    const onResize = () => {
      menuRef.current?.style.setProperty('--timeOut', 'none')
      fitEdges()
      moveBorder()
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [fitEdges, moveBorder])

  useEffect(() => {
    const timer = setTimeout(() => {
      fitEdges()
      moveBorder()
    }, BORDER_SETTLE_MS)
    return () => clearTimeout(timer)
  }, [items, fitEdges, moveBorder])

  const handleItemClick = (index) => {
    menuRef.current?.style.removeProperty('--timeOut')
    if (controlledIndex === undefined) setInternalIndex(index)
    onTabChange?.(index)
  }

  const handleMouseMove = (e) => {
    const menu = menuRef.current
    if (menu) {
      const rect = menu.getBoundingClientRect()
      menu.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`)
      menu.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`)
    }
    frost.defrost()
  }

  return (
    <div className={`animated-tab-bar-container ${className}`} onMouseMove={handleMouseMove} onMouseLeave={frost.refrost}>
      <div className="svg-container" aria-hidden="true">
        <svg viewBox="0 0 202.9 45.5">
          <defs>
            <clipPath id="menu-clip-path" clipPathUnits="objectBoundingBox" transform="scale(0.0049285362247413 0.021978021978022)">
              <path d="M6.7,45.5c5.7,0.1,14.1-0.4,23.3-4c5.7-2.3,9.9-5,18.1-10.5c10.7-7.1,11.8-9.2,20.6-14.3c5-2.9,9.2-5.2,15.2-7 c7.1-2.1,13.3-2.3,17.6-2.1c4.2-0.2,10.5,0.1,17.6,2.1c6.1,1.8,10.2,4.1,15.2,7c8.8,5,9.9,7.1,20.6,14.3c8.3,5.5,12.4,8.2,18.1,10.5 c9.2,3.6,17.6,4.2,23.3,4H6.7z" />
            </clipPath>
          </defs>
        </svg>
      </div>

      <nav className="menu" ref={menuRef} aria-label="Режим просмотра" style={{ '--bgColorActive': items[activeIndex]?.color || '#3b82f6' }}>
        <div className="menu-frost-layer" aria-hidden="true" />
        <div className="menu-defrost-spotlight" aria-hidden="true" />

        {backButton}

        {items.map((item, index) => (
          <button
            key={index}
            ref={(el) => (itemRefs.current[index] = el)}
            type="button"
            className={`menu__item ${activeIndex === index ? 'active' : ''}`}
            style={{ '--bgColorItem': item.color }}
            onClick={() => handleItemClick(index)}
            aria-label={item.label || `Tab ${index + 1}`}
            title={item.label}
            aria-pressed={item.ariaPressed ?? activeIndex === index}
          >
            {item.icon}
            {item.badge !== undefined && <span className={`menu-badge ${item.badgeDone ? 'badge-done' : ''}`}>{item.badge}</span>}
          </button>
        ))}

        <div className="menu__border" ref={borderRef}>
          <div className="menu__border-frost" aria-hidden="true" />
          <div className="menu__border-spotlight" aria-hidden="true" />
        </div>

        {children}
      </nav>
    </div>
  )
}
