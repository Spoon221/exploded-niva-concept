/**
 * @fileoverview Защитная обёртка для 3D-холста: проверяет поддержку WebGL, восстанавливает
 * сцену после потери контекста и показывает понятный экран при сбое.
 */
import { useState, useEffect, useRef } from 'react'
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary'
import { isWebGLAvailable } from '@/shared/lib/device'
import './CanvasSafeWrapper.css'

/**
 * Полноэкранное сообщение вместо 3D-сцены.
 *
 * @param {{icon: string, title: string, text: string, tone?: 'info'|'error',
 *   action?: {label: string, onClick: function(): void}}} props
 *   Иконка, заголовок, текст, оформление и необязательная кнопка.
 * @return {JSX.Element}
 */
function CanvasNotice({ icon, title, text, tone = 'info', action }) {
  return (
    <div className={`canvas-notice canvas-notice--${tone}`}>
      <div className="canvas-notice-card">
        <div className="canvas-notice-icon">{icon}</div>
        <h3 className="canvas-notice-title">{title}</h3>
        <p className="canvas-notice-text">{text}</p>
        {action && (
          <button type="button" className="canvas-notice-button" onClick={action.onClick}>
            {action.label}
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Подписывается на потерю и восстановление WebGL-контекста холста внутри контейнера.
 *
 * @param {React.RefObject<HTMLElement>} containerRef Контейнер с canvas.
 * @param {number} restartKey Ключ перезапуска: подписка обновляется вместе с новым canvas.
 * @param {function(function(number): number): void} setRestartKey Сеттер ключа перезапуска.
 * @return {boolean} true, пока контекст потерян.
 */
function useContextLoss(containerRef, restartKey, setRestartKey) {
  const [lost, setLost] = useState(false)

  useEffect(() => {
    const canvas = containerRef.current?.querySelector('canvas')
    if (!canvas) return
    const handleLost = (e) => {
      e.preventDefault()
      setLost(true)
    }
    const handleRestored = () => {
      setLost(false)
      setRestartKey((key) => key + 1)
    }
    canvas.addEventListener('webglcontextlost', handleLost)
    canvas.addEventListener('webglcontextrestored', handleRestored)
    return () => {
      canvas.removeEventListener('webglcontextlost', handleLost)
      canvas.removeEventListener('webglcontextrestored', handleRestored)
    }
  }, [containerRef, restartKey, setRestartKey])

  return lost
}

/**
 * Контейнер для Canvas с защитой от сбоев WebGL.
 *
 * @param {{children: React.ReactNode, className?: string, style?: Object}} props
 *   Холст и необязательные класс и стили контейнера.
 * @return {JSX.Element}
 */
export function CanvasSafeWrapper({ children, className = '', style }) {
  const [hasWebGL] = useState(isWebGLAvailable)
  const [restartKey, setRestartKey] = useState(0)
  const containerRef = useRef(null)
  const restart = () => setRestartKey((key) => key + 1)
  const contextLost = useContextLoss(containerRef, restartKey, setRestartKey)

  if (!hasWebGL) {
    return (
      <CanvasNotice
        icon="🖥️"
        title="WebGL НЕ ПОДДЕРЖИВАЕТСЯ"
        text="Ваш браузер или видеокарта временно отключили аппаратное ускорение WebGL. Проверьте настройки графики в браузере."
      />
    )
  }

  return (
    <ErrorBoundary
      key={restartKey}
      label="CanvasSafeWrapper"
      onReset={restart}
      fallback={(_, reset) => (
        <CanvasNotice
          tone="error"
          icon="⚠️"
          title="СБОЙ 3D-ВИЗУАЛИЗАЦИИ"
          text="Произошла ошибка при инициализации WebGL. Вы можете перезапустить движок без перезагрузки вкладки."
          action={{ label: 'ПЕРЕЗАПУСТИТЬ 3D-ДВИЖОК', onClick: reset }}
        />
      )}
    >
      <div ref={containerRef} className={`canvas-safe-wrapper ${className}`} style={style}>
        {children}
        {contextLost && <div className="canvas-context-toast">Восстановление 3D-контекста...</div>}
      </div>
    </ErrorBoundary>
  )
}
