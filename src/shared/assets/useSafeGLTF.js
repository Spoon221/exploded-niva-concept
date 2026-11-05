/**
 * @fileoverview Загрузка GLTF-моделей с процедурной заменой, если файл недоступен.
 */
import { useGLTF } from '@react-three/drei'
import { createProceduralCarFallback, createProceduralRobotFallback } from './proceduralFallbacks'

const FALLBACKS = { car: createProceduralCarFallback, robot: createProceduralRobotFallback }

/**
 * Загружает модель через useGLTF (с кешем и Suspense). Если загрузка упала,
 * возвращает процедурную модель с теми же именами узлов, чтобы сцена продолжила работать.
 *
 * @param {string} url Путь к GLB-файлу.
 * @param {'car'|'robot'} [fallbackType='car'] Какую замену построить при ошибке.
 * @return {{scene: THREE.Object3D, nodes: Object, materials: Object, animations: Array,
 *   isFallback: boolean}} Результат useGLTF или процедурная замена.
 */
export function useSafeGLTF(url, fallbackType = 'car') {
  try {
    return { ...useGLTF(url), isFallback: false }
  } catch (err) {
    if (typeof err?.then === 'function') throw err
    console.warn(`[useSafeGLTF] Процедурная замена для ${url}:`, err)
    return { scene: FALLBACKS[fallbackType](), nodes: {}, materials: {}, animations: [], isFallback: true }
  }
}
