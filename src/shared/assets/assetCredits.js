/**
 * @fileoverview Сторонние 3D-ресурсы проекта и их лицензии. Модели под CC BY требуют
 * указания автора — подпись выводится рядом со сценой, где модель используется.
 */
import { MALL_MODEL_RAW_URL, MALL_MODEL_URL } from './assetUrls'

/** «Big Box Store», hnanw, CC BY 4.0 — сжатая и исходная версии модели гипермаркета. */
const BIG_BOX_STORE = {
  title: 'Big Box Store',
  author: 'hnanw',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  source: 'https://sketchfab.com/3d-models/big-box-store-d63d9811b6e5452f9ac3660983bbbe73',
}

/**
 * Атрибуция по пути к файлу.
 *
 * @type {Object<string, {title: string, author: string, license: string, licenseUrl: string,
 *   source: string}>}
 */
export const ASSET_CREDITS = {
  [MALL_MODEL_URL]: BIG_BOX_STORE,
  [MALL_MODEL_RAW_URL]: BIG_BOX_STORE,
}
