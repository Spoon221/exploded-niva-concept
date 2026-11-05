/**
 * @fileoverview Определение возможностей устройства: тач-ввод, ширина экрана, тип GPU.
 */

const SOFTWARE_RENDERERS = ['llvmpipe', 'swiftshader', 'vmware', 'virtualbox', 'citrix', 'basic render', 'software', 'mesa']

/**
 * Проверяет, что код выполняется в браузере.
 *
 * @return {boolean} true в браузере, false при рендере вне его.
 */
const hasWindow = () => typeof window !== 'undefined'

/**
 * Проверяет, что экран уже заданной ширины.
 *
 * @param {number} [maxWidth=640] Граница в пикселях.
 * @return {boolean} true, если ширина окна меньше границы.
 */
export function isNarrowViewport(maxWidth = 640) {
  return hasWindow() && window.innerWidth < maxWidth
}

/**
 * Определяет тач-устройство или узкий экран, где колесо мыши не используется для навигации.
 *
 * @return {boolean} true для телефонов, планшетов и экранов уже 1024 px.
 */
export function isTouchDevice() {
  if (!hasWindow()) return false
  return (
    isNarrowViewport(1024) ||
    window.matchMedia('(pointer: coarse)').matches ||
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0
  )
}

/** Результат проверки WebGL: за сессию он не меняется. */
let webglAvailable = null

/**
 * Проверяет, может ли браузер создать WebGL-контекст. Проверка выполняется один раз,
 * пробный контекст сразу освобождается: раньше каждый вызов оставлял живой контекст,
 * и за пару переходов между страницами их набиралось до лимита браузера (16).
 *
 * @return {boolean} true, если WebGL доступен.
 */
export function isWebGLAvailable() {
  if (!hasWindow()) return false
  if (webglAvailable !== null) return webglAvailable
  try {
    const canvas = document.createElement('canvas')
    const gl = window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    webglAvailable = Boolean(gl)
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    webglAvailable = false
  }
  return webglAvailable
}

/**
 * Читает сведения о видеокарте и возможностях WebGL через временный контекст.
 *
 * @return {?{vendor: string, renderer: string, webgl2: boolean, maxTextureSize: number}}
 *   Производитель и модель GPU (если браузер их раскрывает), поддержка WebGL 2
 *   и максимальный размер текстуры; null, если WebGL недоступен.
 */
export function getGpuInfo() {
  if (!hasWindow()) return null
  try {
    const canvas = document.createElement('canvas')
    const gl2 = canvas.getContext('webgl2')
    const gl = gl2 || canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (!gl) return null
    const dbg = gl.getExtension('WEBGL_debug_renderer_info')
    const info = {
      vendor: String((dbg && gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)) || gl.getParameter(gl.VENDOR) || ''),
      renderer: String((dbg && gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || ''),
      webgl2: Boolean(gl2),
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    }
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return info
  } catch {
    return null
  }
}

/**
 * Определяет программный или виртуализированный GPU (VDI, SwiftShader, llvmpipe и т. п.).
 *
 * @return {boolean} true, если WebGL недоступен или рендерер программный.
 */
export function detectSoftwareRenderer() {
  if (!hasWindow()) return false
  const gpu = getGpuInfo()
  if (!gpu) return true
  const renderer = gpu.renderer.toLowerCase()
  return SOFTWARE_RENDERERS.some((name) => renderer.includes(name))
}
