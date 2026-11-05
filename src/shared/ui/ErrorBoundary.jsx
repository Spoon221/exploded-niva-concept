/**
 * @fileoverview Универсальная граница ошибок React для изоляции сбоев 3D-сцены и загрузки ресурсов.
 */
import { Component } from 'react'

/**
 * Ловит ошибки рендера потомков и показывает запасной вариант вместо падения страницы.
 *
 * @param {{children: React.ReactNode,
 *   fallback?: React.ReactNode|function(Error, function(): void): React.ReactNode,
 *   label?: string, onReset?: function(): void}} props Защищаемое содержимое;
 *   запасной элемент или функция (error, reset) => элемент (без него ничего не рендерится);
 *   метка для сообщения в консоли; колбэк после сброса ошибки.
 */
export class ErrorBoundary extends Component {
  state = { error: null }

  /**
   * Переводит границу в состояние ошибки.
   *
   * @param {Error} error Пойманная ошибка.
   * @return {{error: Error}} Новое состояние.
   */
  static getDerivedStateFromError(error) {
    return { error }
  }

  /**
   * Пишет ошибку в консоль с меткой границы.
   *
   * @param {Error} error Пойманная ошибка.
   * @param {React.ErrorInfo} info Стек компонентов.
   */
  componentDidCatch(error, info) {
    console.warn(`[${this.props.label ?? 'ErrorBoundary'}]`, error, info)
  }

  /** Сбрасывает ошибку и пробует отрендерить содержимое заново. */
  reset = () => {
    this.setState({ error: null })
    this.props.onReset?.()
  }

  /**
   * Рендерит потомков или запасной вариант, если была поймана ошибка.
   *
   * @return {React.ReactNode} Содержимое или запасной вариант.
   */
  render() {
    const { error } = this.state
    const { fallback = null, children } = this.props
    if (!error) return children
    return typeof fallback === 'function' ? fallback(error, this.reset) : fallback
  }
}
