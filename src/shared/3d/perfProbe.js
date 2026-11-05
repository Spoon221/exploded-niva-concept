/**
 * @fileoverview Замер производительности рендера: компонент-зонд внутри Canvas снимает
 * время кадра, вызовы отрисовки и треугольники каждого кадра и публикует сводку
 * в общее хранилище, которое читают HTML-панели и бенчмарк.
 *
 * Счётчики WebGLRenderer.info сбрасываются вручную раз в кадр: при постобработке
 * рендер вызывается несколько раз за кадр, и автосброс оставил бы только последний проход.
 */
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

const SAMPLE_MS = 500
const HISTORY_LENGTH = 60
/** Кадры длиннее этого (вкладка была скрыта, отладчик) не учитываются. */
const MAX_FRAME_MS = 1000
/** Отрицательный приоритет: зонд срабатывает до остальных подписчиков useFrame. */
const PROBE_PRIORITY = -1000

const EMPTY_STATS = {
  fps: 0,
  frameMs: 0,
  worstFrameMs: 0,
  drawCalls: 0,
  triangles: 0,
  objects: 0,
  vertices: 0,
  geometries: 0,
  textures: 0,
  dpr: 1,
  history: [],
}

let snapshot = EMPTY_STATS
let recording = null
const listeners = new Set()

/**
 * Заменяет сводку и уведомляет подписчиков.
 *
 * @param {Object} next Новая сводка.
 */
function publish(next) {
  snapshot = next
  listeners.forEach((listener) => listener())
}

/**
 * Считает итоги записанных кадров.
 *
 * @param {{frames: number[], calls: number, triangles: number}} rec Длительности кадров в мс
 *   и суммы вызовов отрисовки и треугольников.
 * @return {{frames: number, avgFps: number, low1Fps: number, avgFrameMs: number,
 *   p95FrameMs: number, drawCalls: number, triangles: number}} Средний FPS, FPS худшего 1 %
 *   кадров, среднее и 95-й перцентиль времени кадра, средние вызовы и треугольники за кадр.
 */
function summarize({ frames, calls, triangles }) {
  const n = frames.length
  if (!n) return { frames: 0, avgFps: 0, low1Fps: 0, avgFrameMs: 0, p95FrameMs: 0, drawCalls: 0, triangles: 0 }
  const sorted = [...frames].sort((a, b) => b - a)
  const avgFrameMs = frames.reduce((sum, ms) => sum + ms, 0) / n
  const worst = sorted.slice(0, Math.max(1, Math.ceil(n * 0.01)))
  const worstAvg = worst.reduce((sum, ms) => sum + ms, 0) / worst.length
  const round1 = (x) => Math.round(x * 10) / 10
  return {
    frames: n,
    avgFps: round1(1000 / avgFrameMs),
    low1Fps: round1(1000 / worstAvg),
    avgFrameMs: round1(avgFrameMs),
    p95FrameMs: round1(sorted[Math.floor(n * 0.05)]),
    drawCalls: Math.round(calls / n),
    triangles: Math.round(triangles / n),
  }
}

/** Хранилище последней сводки и записи кадров для бенчмарка. */
export const perfStore = {
  /**
   * Подписывает на обновления сводки.
   *
   * @param {function(): void} listener Колбэк.
   * @return {function(): void} Отписка.
   */
  subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  /**
   * Возвращает последнюю сводку.
   *
   * @return {Object} Сводка: fps, frameMs, worstFrameMs, drawCalls, triangles, objects,
   *   vertices, geometries, textures, dpr и история FPS.
   */
  getSnapshot: () => snapshot,

  /** Начинает запись каждого кадра (для бенчмарка). */
  startRecording() {
    recording = { frames: [], calls: 0, triangles: 0 }
  },

  /**
   * Останавливает запись и возвращает итоги.
   *
   * @return {Object} Итоги в формате summarize.
   */
  stopRecording() {
    const result = summarize(recording ?? { frames: [], calls: 0, triangles: 0 })
    recording = null
    return result
  },
}

/**
 * Считает видимые меши и их вершины в сцене.
 *
 * @param {THREE.Scene} scene Сцена.
 * @return {{objects: number, vertices: number}} Число мешей и вершин.
 */
function measureScene(scene) {
  let objects = 0
  let vertices = 0
  scene.traverseVisible((object) => {
    if (!object.isMesh) return
    const instances = object.isInstancedMesh ? object.count : 1
    objects += instances
    vertices += (object.geometry?.attributes.position?.count ?? 0) * instances
  })
  return { objects, vertices }
}

/**
 * Невидимый компонент внутри Canvas: собирает метрики каждого кадра и раз в sampleMs
 * публикует сводку в perfStore.
 *
 * @param {{sampleMs?: number}} props Период обновления сводки в мс.
 * @return {null}
 */
export function PerfProbe({ sampleMs = SAMPLE_MS }) {
  const { gl, scene } = useThree()
  const acc = useRef({ frames: 0, time: 0, worst: 0, calls: 0, triangles: 0, windowStart: 0, last: 0 })
  const history = useRef([])

  useEffect(() => {
    const previous = gl.info.autoReset
    gl.info.autoReset = false
    publish(EMPTY_STATS)
    return () => {
      gl.info.autoReset = previous
    }
  }, [gl])

  // Кадры не рисуются (рендер по требованию в покое): честно показываем 0 FPS,
  // а не последнее значение, которое осталось бы на экране.
  useEffect(() => {
    const timer = setInterval(() => {
      if (!acc.current.last || performance.now() - acc.current.last < sampleMs * 2) return
      if (snapshot.fps === 0) return
      history.current = [...history.current, 0].slice(-HISTORY_LENGTH)
      publish({ ...snapshot, fps: 0, frameMs: 0, worstFrameMs: 0, drawCalls: 0, triangles: 0, history: history.current })
    }, sampleMs)
    return () => clearInterval(timer)
  }, [sampleMs])

  useFrame(() => {
    const now = performance.now()
    const a = acc.current
    const { calls, triangles } = gl.info.render
    gl.info.reset()

    const dt = a.last ? now - a.last : 0
    a.last = now
    if (!dt || dt > MAX_FRAME_MS) {
      a.windowStart = now
      return
    }
    a.frames++
    a.time += dt
    a.worst = Math.max(a.worst, dt)
    a.calls += calls
    a.triangles += triangles
    if (recording) {
      recording.frames.push(dt)
      recording.calls += calls
      recording.triangles += triangles
    }

    if (now - a.windowStart < sampleMs) return
    const fps = Math.round((a.frames * 1000) / a.time)
    history.current = [...history.current, fps].slice(-HISTORY_LENGTH)
    publish({
      fps,
      frameMs: Math.round((a.time / a.frames) * 10) / 10,
      worstFrameMs: Math.round(a.worst),
      drawCalls: Math.round(a.calls / a.frames),
      triangles: Math.round(a.triangles / a.frames),
      ...measureScene(scene),
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
      dpr: gl.getPixelRatio(),
      history: history.current,
    })
    Object.assign(a, { frames: 0, time: 0, worst: 0, calls: 0, triangles: 0, windowStart: now })
  }, PROBE_PRIORITY)

  return null
}

/**
 * Подписывает компонент на сводку производительности.
 *
 * @return {Object} Последняя сводка из perfStore.
 */
export function usePerfStats() {
  return useSyncExternalStore(perfStore.subscribe, perfStore.getSnapshot)
}
