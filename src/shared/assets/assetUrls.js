/**
 * @fileoverview Пути к общим 3D-ресурсам из папки public. Единый источник,
 * чтобы предзагрузчик, сцены и загрузчики ссылались на одни и те же файлы. Пути строятся
 * от базового адреса сборки: сайт может жить не в корне домена (например, /~login/diplom/).
 */

/**
 * Адрес файла из папки public с учётом базового пути сборки.
 *
 * @param {string} path Путь от корня public, начиная с «/».
 * @return {string} Адрес файла.
 */
export const publicUrl = (path) => import.meta.env.BASE_URL.replace(/\/$/, '') + path

/**
 * Модель автомобиля «Нива», оптимизированная: сетка упрощена meshoptimizer (134 тыс. →
 * 73 тыс. треугольников), геометрия сжата Meshopt (5,3 МБ → 0,9 МБ). Узлы, имена и
 * материалы деталей сохранены — по ним работают разборка и покраска.
 */
export const CAR_MODEL_URL = publicUrl('/lada_niva.opt.glb')

/** Модель робота-ассистента, геометрия и анимации сжаты Meshopt (453 → 216 КБ). */
export const ROBOT_MODEL_URL = publicUrl('/RobotExpressive.opt.glb')

/** HDR-карта окружения для освещения и отражений. */
export const ENVIRONMENT_HDR_URL = publicUrl('/spruit_sunrise.hdr')

/**
 * GLB-модель торгового здания для парковки лаборатории («Big Box Store», hnanw, CC BY 4.0;
 * автор указан в ASSET_CREDITS) или null — тогда строится процедурное здание.
 *
 * @type {?string}
 */
export const MALL_MODEL_URL = publicUrl('/models/big_box_store.glb')

/**
 * Та же модель гипермаркета в исходном виде (9,9 МБ, PNG-текстуры, без сжатия геометрии) —
 * для сравнения со сжатой версией (meshopt + JPEG, 2,4 МБ) на стенде.
 */
export const MALL_MODEL_RAW_URL = publicUrl('/models/big_box_store.raw.glb')

/** Небо-скайбокс: HDRI «Sunflowers (Pure Sky)», Poly Haven, CC0 — кучевые облака, ясный полдень. */
export const SKY_HDR_URL = publicUrl('/hdri/sky_sunflowers_2k.hdr')

/**
 * Направление на солнце в HDRI-небе (рассчитано по самому яркому пикселю карты):
 * по нему ставится источник теней, чтобы тени совпадали с небом.
 */
export const SKY_SUN_DIRECTION = [0.578, 0.69, 0.436]

/** Кустарник «Shrub 03», Poly Haven, CC0. */
export const SHRUB_URL = publicUrl('/models/shrub_03/shrub_03_1k.gltf')

/**
 * PBR-материалы Poly Haven (CC0): папка с картами diff/nor/arm в WebP и размер
 * одной плитки текстуры в метрах (из метаданных Poly Haven).
 *
 * @type {Object<string, {path: string, tile: number}>}
 */
export const PBR_TEXTURES = {
  asphalt: { path: publicUrl('/textures/asphalt_02'), tile: 3 },
  grass: { path: publicUrl('/textures/sparse_grass'), tile: 2 },
  sand: { path: publicUrl('/textures/gravelly_sand'), tile: 2.48 },
  rock: { path: publicUrl('/textures/rocky_trail'), tile: 2 },
  pavement: { path: publicUrl('/textures/concrete_pavement'), tile: 1.8 },
  cladding: { path: publicUrl('/textures/exterior_wall_cladding'), tile: 2 },
}
