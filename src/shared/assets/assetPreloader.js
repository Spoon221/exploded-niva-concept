/**
 * @fileoverview Фоновая предзагрузка тяжёлых моделей и HDR-окружения при старте приложения.
 */
import * as THREE from 'three'
import { useEnvironment, useGLTF } from '@react-three/drei'
import { CAR_MODEL_URL, ENVIRONMENT_HDR_URL, ROBOT_MODEL_URL } from './assetUrls'

if (typeof window !== 'undefined') {
  THREE.Cache.enabled = true
}

const CRITICAL_MODELS = [CAR_MODEL_URL, ROBOT_MODEL_URL]
const CRITICAL_TEXTURES = [ENVIRONMENT_HDR_URL]

let preloadingStarted = false

/**
 * Однократно запускает фоновую загрузку моделей и текстур в простое браузера,
 * чтобы не задерживать первый рендер.
 */
export function initAssetPreloader() {
  if (typeof window === 'undefined' || preloadingStarted) return
  preloadingStarted = true

  const schedulePreload = window.requestIdleCallback?.bind(window) ?? ((cb) => setTimeout(cb, 100))

  schedulePreload(() => {
    CRITICAL_MODELS.forEach((url) => {
      try {
        useGLTF.preload(url)
      } catch (err) {
        console.warn(`[AssetPreloader] Preload skipped for ${url}:`, err)
      }
    })

    // Через тот же загрузчик и кеш, что у <Environment>: иначе HDR скачивается дважды.
    CRITICAL_TEXTURES.forEach((url) => {
      try {
        useEnvironment.preload({ files: url })
      } catch (err) {
        console.warn(`[AssetPreloader] Preload skipped for ${url}:`, err)
      }
    })
  })
}
