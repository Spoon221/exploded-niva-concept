/**
 * @fileoverview Синтезированные звуки интерфейса на Web Audio API, без аудиофайлов.
 * Общий AudioContext создаётся заранее, в простое после первого действия пользователя
 * (создание занимает до ~150 мс и давало рывок на первом клике), и возобновляется по клику.
 */

let audioCtx = null
let isMuted = false

/**
 * Создаёт общий AudioContext, если его ещё нет. Без жеста пользователя он создаётся
 * приостановленным — запускает его getAudioContext при первом звуке.
 *
 * @return {?AudioContext} Контекст или null, если Web Audio недоступен.
 */
function ensureAudioContext() {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (AudioContextClass) audioCtx = new AudioContextClass()
  }
  return audioCtx
}

/**
 * Возвращает общий AudioContext, создавая и возобновляя его при необходимости.
 *
 * @return {?AudioContext} Контекст или null, если Web Audio недоступен.
 */
function getAudioContext() {
  const ctx = ensureAudioContext()
  if (ctx?.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

// Первое действие пользователя (движение мыши, касание, прокрутка, клавиша) — сигнал,
// что скоро понадобится звук: создаём контекст в простое, а не на самом клике.
if (typeof window !== 'undefined') {
  const PREPARE_EVENTS = ['pointermove', 'pointerdown', 'touchstart', 'wheel', 'keydown']
  const prepare = () => {
    PREPARE_EVENTS.forEach((type) => window.removeEventListener(type, prepare, true))
    const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 200))
    idle(() => {
      try {
        ensureAudioContext()
      } catch {
        // Web Audio недоступен — звуки просто не играют.
      }
    })
  }
  PREPARE_EVENTS.forEach((type) => window.addEventListener(type, prepare, { capture: true, passive: true }))
}

/**
 * Выполняет функцию воспроизведения, если звук включён и контекст доступен.
 * Ошибки Web Audio не пробрасываются: звук не должен ломать интерфейс.
 *
 * @param {function(AudioContext): void} play Функция, строящая граф звука.
 */
function withAudio(play) {
  if (isMuted) return
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    play(ctx)
  } catch {
    return
  }
}

/**
 * Создаёт осциллятор с огибающей громкости и подключает его к выходу.
 *
 * @param {AudioContext} ctx Аудиоконтекст.
 * @param {{type: OscillatorType, freq: number, start: number, duration: number,
 *   gain: number, output?: AudioNode}} options Форма волны, частота в Гц, время старта,
 *   длительность в секундах, начальная громкость и узел, через который звук идёт на выход.
 * @return {{osc: OscillatorNode, gain: GainNode}} Созданные узлы для дополнительной настройки.
 */
function tone(ctx, { type, freq, start, duration, gain: volume, output }) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  gain.gain.setValueAtTime(volume, start)
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
  if (output) {
    osc.connect(output)
    output.connect(gain)
  } else {
    osc.connect(gain)
  }
  gain.connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration + 0.005)
  return { osc, gain }
}

/**
 * Включает или выключает все звуки.
 *
 * @param {boolean} muted true, чтобы отключить звук.
 */
export function setAudioMuted(muted) {
  isMuted = muted
}

/** Короткий щелчок для кнопок и переключателей. */
export function playClickSound() {
  withAudio((ctx) => {
    const t = ctx.currentTime
    const { osc } = tone(ctx, { type: 'sine', freq: 800, start: t, duration: 0.04, gain: 0.12 })
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.04)
  })
}

/** Восходящее арпеджио при сборе бонуса. */
export function playCollectSound() {
  withAudio((ctx) => {
    ;[587.33, 880, 1174.66, 1760].forEach((freq, i) => {
      const start = ctx.currentTime + i * 0.045
      const { osc } = tone(ctx, { type: 'triangle', freq, start, duration: 0.28, gain: 0.15 })
      osc.frequency.exponentialRampToValueAtTime(freq * 1.05, start + 0.25)
    })
  })
}

/** Нарастающий гул с фильтром при включении нитро. */
export function playNitroSound() {
  withAudio((ctx) => {
    const t = ctx.currentTime
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(300, t)
    filter.frequency.exponentialRampToValueAtTime(1400, t + 0.3)
    filter.frequency.exponentialRampToValueAtTime(250, t + 0.9)

    const { osc, gain } = tone(ctx, { type: 'sawtooth', freq: 80, start: t, duration: 0.9, gain: 0.18, output: filter })
    osc.frequency.exponentialRampToValueAtTime(280, t + 0.45)
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.9)
    gain.gain.cancelScheduledValues(t)
    gain.gain.setValueAtTime(0.18, t)
    gain.gain.linearRampToValueAtTime(0.25, t + 0.2)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9)
  })
}

/** Мажорный аккорд при прохождении трассы. */
export function playVictorySound() {
  withAudio((ctx) => {
    ;[523.25, 659.25, 783.99, 1046.5].forEach((freq) => {
      tone(ctx, { type: 'sine', freq, start: ctx.currentTime, duration: 1.2, gain: 0.15 })
    })
  })
}
