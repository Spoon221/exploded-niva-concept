/**
 * @fileoverview Контекст состояния прокрутки ScrollControls для 3D-сцены.
 */
import { createContext, useContext } from 'react'

export const ScrollContext = createContext(null)

/**
 * Состояние прокрутки ближайшего ScrollControls (аналог useScroll из drei).
 *
 * @return {Object} el, fixed, offset, delta, pages и методы range/curve/visible.
 */
export function useScroll() {
  return useContext(ScrollContext)
}
