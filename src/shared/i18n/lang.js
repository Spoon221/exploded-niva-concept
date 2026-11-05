/**
 * @fileoverview Язык интерфейса сайта: русский или английский. Выбор хранится в
 * localStorage и общий для всех компонентов; компоненты подписываются через useLang.
 */
import { useSyncExternalStore } from 'react'

/** @typedef {'ru'|'en'} Lang */

const STORAGE_KEY = 'diplom_lang'
const LANGS = ['ru', 'en']
const listeners = new Set()

/**
 * Читает сохранённый язык; если хранилище недоступно или пусто — английский.
 *
 * @return {Lang}
 */
function readLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return LANGS.includes(saved) ? saved : 'en'
  } catch {
    return 'en'
  }
}

let current = readLang()
if (typeof document !== 'undefined') document.documentElement.lang = current

/**
 * Меняет язык, сохраняет выбор и оповещает подписчиков.
 *
 * @param {Lang} lang Новый язык.
 */
export function setLang(lang) {
  if (!LANGS.includes(lang) || lang === current) return
  current = lang
  document.documentElement.lang = lang
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // Хранилище недоступно: выбор действует до перезагрузки.
  }
  listeners.forEach((listener) => listener())
}

/** @return {Lang} Текущий язык вне React. */
export const getLang = () => current

const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Текущий язык; компонент перерисовывается при переключении.
 *
 * @return {Lang}
 */
export const useLang = () => useSyncExternalStore(subscribe, getLang)
