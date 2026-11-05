/**
 * @fileoverview Состояние прокрутки ScrollControls для HTML-слоя ScrollHtml.
 */
import { createContext, useContext } from 'react'

export const ScrollStateContext = createContext(null)

/**
 * Состояние прокрутки ScrollControls внутри HTML-слоя (аналог useScroll из drei,
 * который в отдельном root недоступен).
 *
 * @return {?Object} Состояние прокрутки drei: el, offset, range() и т.д.
 */
export function useScrollHtmlState() {
  return useContext(ScrollStateContext)
}
