/**
 * @fileoverview Сбор характеристик устройства для протокола замеров производительности:
 * браузер, ОС, модель, процессор, память, видеокарта, экран и частота обновления.
 * Браузер раскрывает не всё: модель ПК, частота CPU и точный объём памяти недоступны,
 * поэтому пользователь может дописать название устройства вручную.
 */
import { getGpuInfo } from './device'

const COMMON_REFRESH_RATES = [30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 180, 240]

/**
 * Разбирает строку User-Agent, когда Client Hints недоступны (Safari, Firefox).
 *
 * @param {string} ua Строка User-Agent.
 * @return {{browser: string, os: string, model: string}} Браузер с версией, ОС и модель.
 */
function parseUserAgent(ua) {
  const match = (re) => ua.match(re)
  const browser =
    (match(/YaBrowser\/([\d.]+)/) && `Яндекс Браузер ${match(/YaBrowser\/([\d.]+)/)[1]}`) ||
    (match(/Edg\/([\d.]+)/) && `Edge ${match(/Edg\/([\d.]+)/)[1]}`) ||
    (match(/OPR\/([\d.]+)/) && `Opera ${match(/OPR\/([\d.]+)/)[1]}`) ||
    (match(/Firefox\/([\d.]+)/) && `Firefox ${match(/Firefox\/([\d.]+)/)[1]}`) ||
    (match(/Chrome\/([\d.]+)/) && `Chrome ${match(/Chrome\/([\d.]+)/)[1]}`) ||
    (match(/Version\/([\d.]+).*Safari/) && `Safari ${match(/Version\/([\d.]+).*Safari/)[1]}`) ||
    'Неизвестный браузер'

  const ios = match(/(iPhone|iPad|iPod).*OS ([\d_]+)/)
  const android = match(/Android ([\d.]+);\s*([^;)]+)/)
  const os =
    (ios && `iOS ${ios[2].replace(/_/g, '.')}`) ||
    (android && `Android ${android[1]}`) ||
    (match(/Windows NT 10/) && 'Windows 10/11') ||
    (match(/Windows NT ([\d.]+)/) && `Windows NT ${match(/Windows NT ([\d.]+)/)[1]}`) ||
    (match(/Mac OS X ([\d_]+)/) && `macOS ${match(/Mac OS X ([\d_]+)/)[1].replace(/_/g, '.')}`) ||
    (match(/Linux/) && 'Linux') ||
    'Неизвестная ОС'

  const model = (ios && ios[1]) || (android && android[2].replace(/\s*Build.*$/, '').trim()) || ''
  return { browser, os, model }
}

/**
 * Уточняет браузер, ОС и модель через User-Agent Client Hints (Chromium-браузеры).
 *
 * @param {{browser: string, os: string, model: string}} fallback Данные из User-Agent.
 * @return {Promise<{browser: string, os: string, model: string, architecture: string}>}
 *   Уточнённые данные или исходные, если Client Hints недоступны.
 */
async function readClientHints(fallback) {
  const uaData = navigator.userAgentData
  if (!uaData?.getHighEntropyValues) return { ...fallback, architecture: '' }
  try {
    const hints = await uaData.getHighEntropyValues(['model', 'platformVersion', 'fullVersionList', 'architecture', 'bitness'])
    const brand = hints.fullVersionList?.find((b) => !/Not.?A.?Brand|Chromium/i.test(b.brand))
    let os = `${hints.platform || uaData.platform} ${hints.platformVersion || ''}`.trim()
    // Windows 11 сообщает platformVersion 13 и выше, Windows 10 — от 1 до 10.
    if (/Windows/i.test(hints.platform)) os = parseInt(hints.platformVersion, 10) >= 13 ? 'Windows 11' : 'Windows 10'
    return {
      browser: brand ? `${brand.brand} ${brand.version}` : fallback.browser,
      os,
      model: hints.model || fallback.model,
      architecture: [hints.architecture, hints.bitness && `${hints.bitness}-bit`].filter(Boolean).join(' '),
    }
  } catch {
    return { ...fallback, architecture: '' }
  }
}

/**
 * Оценивает частоту обновления экрана по интервалам requestAnimationFrame.
 * FPS в браузере не может превысить эту частоту, поэтому она нужна для трактовки замеров.
 * Берётся 10-й перцентиль интервалов: если страница в это время нагружена и часть
 * кадров запаздывает, самые короткие интервалы всё равно равны периоду обновления.
 *
 * @param {number} [frames=60] Сколько кадров измерять.
 * @return {Promise<number>} Частота в Гц, округлённая до ближайшего стандартного значения.
 */
function estimateRefreshRate(frames = 60) {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'undefined') {
      resolve(60)
      return
    }
    const deltas = []
    let last = 0
    const tick = (now) => {
      if (last) deltas.push(now - last)
      last = now
      if (deltas.length < frames) {
        requestAnimationFrame(tick)
        return
      }
      deltas.sort((a, b) => a - b)
      const hz = 1000 / deltas[Math.floor(deltas.length * 0.1)]
      resolve(COMMON_REFRESH_RATES.reduce((best, rate) => (Math.abs(rate - hz) < Math.abs(best - hz) ? rate : best)))
    }
    requestAnimationFrame(tick)
  })
}

/**
 * Проверяет, есть ли у устройства сенсорный экран.
 *
 * @return {boolean} true, если поддерживаются касания.
 */
const hasTouchScreen = () => navigator.maxTouchPoints > 0 || 'ontouchstart' in window

/**
 * Определяет класс устройства: основной указатель «грубый» (палец) — телефон или
 * планшет в зависимости от размера экрана, иначе компьютер.
 *
 * @return {'Телефон'|'Планшет'|'Компьютер'} Класс устройства.
 */
function detectDeviceType() {
  if (!window.matchMedia('(pointer: coarse)').matches) return 'Компьютер'
  return Math.min(screen.width, screen.height) >= 600 ? 'Планшет' : 'Телефон'
}

/**
 * Собирает характеристики устройства для протокола замера.
 *
 * @return {Promise<{deviceType: string, model: string, os: string, browser: string,
 *   architecture: string, cpuCores: ?number, memoryGb: ?number, gpuVendor: string,
 *   gpuRenderer: string, webgl: string, maxTextureSize: ?number, screen: string,
 *   viewport: string, dpr: number, refreshRate: number, touch: boolean,
 *   language: string, timezone: string, userAgent: string}>} Характеристики;
 *   недоступные браузеру значения равны null или пустой строке.
 */
export async function collectDeviceInfo() {
  const ua = navigator.userAgent
  const [{ browser, os, model, architecture }, refreshRate] = await Promise.all([
    readClientHints(parseUserAgent(ua)),
    estimateRefreshRate(),
  ])
  const gpu = getGpuInfo()

  return {
    deviceType: detectDeviceType(),
    model,
    os,
    browser,
    architecture,
    cpuCores: navigator.hardwareConcurrency ?? null,
    memoryGb: navigator.deviceMemory ?? null,
    gpuVendor: gpu?.vendor ?? '',
    gpuRenderer: gpu?.renderer ?? 'WebGL недоступен',
    webgl: gpu ? (gpu.webgl2 ? 'WebGL 2' : 'WebGL 1') : 'нет',
    maxTextureSize: gpu?.maxTextureSize ?? null,
    screen: `${screen.width}×${screen.height}`,
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    dpr: Math.round(window.devicePixelRatio * 100) / 100,
    refreshRate,
    touch: hasTouchScreen(),
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    userAgent: ua,
  }
}

/**
 * Короткое описание устройства для таблиц и подписей.
 *
 * @param {{deviceType: string, model: string, os: string, gpuRenderer: string}} info
 *   Характеристики из collectDeviceInfo.
 * @return {string} Например «Компьютер · macOS 15.0 · Apple M2».
 */
export function describeDevice(info) {
  const gpu = info.gpuRenderer.replace(/^ANGLE \((.*)\)$/, '$1').replace(/,\s*(OpenGL|Direct3D|Metal|Vulkan).*$/i, '')
  return [info.model || info.deviceType, info.os, gpu].filter(Boolean).join(' · ')
}
