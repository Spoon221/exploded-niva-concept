/**
 * @fileoverview Детали автомобиля, палитра покраски, материалы по умолчанию
 * и этапы прокрутки страницы /new.
 */

export const CAR_PARTS = [
  { id: 'body', label: 'Кузов' },
  { id: 'hood', label: 'Капот' },
  { id: 'doors', label: 'Двери' },
  { id: 'trunk', label: 'Багажник' },
  { id: 'glass', label: 'Стёкла' },
  { id: 'wheels', label: 'Диски' },
]

const CAR_PART_LABELS = {
  en: ['Body', 'Hood', 'Doors', 'Trunk', 'Glass', 'Wheels'],
}

/**
 * Возвращает названия деталей на выбранном языке.
 *
 * @param {'ru'|'en'} lang Язык интерфейса.
 * @return {typeof CAR_PARTS} Детали с локализованными названиями.
 */
export const getCarParts = (lang) => CAR_PARTS.map((part, index) => ({ ...part, label: CAR_PART_LABELS[lang]?.[index] ?? part.label }))

export const PALETTE_COLORS = [
  { name: 'Черный Обсидиан', value: '#0a0a0a' },
  { name: 'Темный Графит', value: '#1e293b' },
  { name: 'Красный', value: '#dc2626' },
  { name: 'Кибер Неон', value: '#00f3ff' },
  { name: 'Фиолетовый', value: '#c026d3' },
  { name: 'Золотой', value: '#f59e0b' },
  { name: 'Лайм', value: '#10b981' },
  { name: 'Белый Перламутр', value: '#f8fafc' },
  { name: 'Пламя Оранж', value: '#ff5500' },
  { name: 'Королевский Синий', value: '#2563eb' },
]

const PALETTE_NAMES = {
  en: ['Obsidian Black', 'Dark Graphite', 'Red', 'Cyber Neon', 'Violet', 'Gold', 'Lime', 'Pearl White', 'Flame Orange', 'Royal Blue'],
}

/**
 * Возвращает палитру с локализованными названиями оттенков.
 *
 * @param {'ru'|'en'} lang Язык интерфейса.
 * @return {typeof PALETTE_COLORS} Палитра выбранного языка.
 */
export const getPaletteColors = (lang) => PALETTE_COLORS.map((color, index) => ({ ...color, name: PALETTE_NAMES[lang]?.[index] ?? color.name }))

export const DEFAULT_PART_COLORS = {
  body: '#0a0a0a',
  hood: '#0a0a0a',
  doors: '#0a0a0a',
  trunk: '#0a0a0a',
  glass: '#0a0a0a',
  wheels: '#cbd5e1',
}

export const FALLBACK_MATERIAL = { roughness: 0.4, metalness: 0.6 }

export const DEFAULT_PART_MATERIALS = {
  body: FALLBACK_MATERIAL,
  hood: FALLBACK_MATERIAL,
  doors: FALLBACK_MATERIAL,
  trunk: FALLBACK_MATERIAL,
  glass: { roughness: 0.1, metalness: 0.9 },
  wheels: { roughness: 0.5, metalness: 0.8 },
}

export const STAGES = [
  { label: 'Обзор', until: 0.2 },
  { label: 'Двигатель', until: 0.3 },
  { label: 'Кузов', until: 0.5 },
  { label: 'Шасси', until: Infinity },
]
