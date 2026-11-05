/** @fileoverview The standalone Exploded Niva Concept experience. */
import { Suspense, useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { Volume2, VolumeX, Box, ScanLine, Eye, EyeOff } from 'lucide-react'
import { useLang } from '@/shared/i18n/lang'
import { AssetPreloader } from '@/shared/ui/preloader/AssetPreloader'
import { usePageReady } from '@/shared/ui/preloader/preloaderPresence'
import { AnimatedTabBar } from '@/shared/ui/AnimatedTabBar'
import { CanvasSafeWrapper } from '@/shared/3d/CanvasSafeWrapper'
import { SceneReadySignal } from '@/shared/3d/sceneReady'
import { playClickSound, setAudioMuted } from '@/shared/lib/synthAudio'
import { detectSoftwareRenderer } from '@/shared/lib/device'
import { progressBetween } from '@/shared/lib/easing'
import { ScrollScene } from './scene/ScrollScene'
import { adaptiveDpr } from './scene/adaptiveDpr'
import { setOverlayHover } from './scene/overlayHover'
import { TechHud } from './components/TechHud'
import { ColorCustomizerDock } from './components/ColorCustomizerDock'
import { DEFAULT_PART_COLORS, DEFAULT_PART_MATERIALS, FALLBACK_MATERIAL } from './data/carParts'
import { FOOTER_GLOW_START, FOOTER_GLOW_END, FOOTER_CARD_END, footerProgress } from './data/footerTiming'
import { scrollMax } from './lib/scrollMetrics'
import './ShowcasePage.css'

const TAB_COLOR = '#4343f5'
const MAX_WHEEL_DELTA = 120
const CAR_CLICK_GUARD_MS = 300
const FOOTER_ACTIVE_ON = 0.25
const FOOTER_ACTIVE_OFF = 0.05

/**
 * Насколько интерфейс должен «уступить» футеру: 0 — футер не виден, 1 — полностью раскрыт.
 * Первая часть приходится на подъём свечения, вторая — на раскрытие карточки.
 *
 * @param {number} progress Прогресс прокрутки 0..1.
 * @return {number} Коэффициент подъёма 0..1.
 */
function footerLift(progress) {
  if (progress <= FOOTER_GLOW_START) return 0
  const glow = 1 - Math.pow(1 - progressBetween(progress, FOOTER_GLOW_START, FOOTER_GLOW_END), 2.5)
  const card = progress > FOOTER_GLOW_END ? progressBetween(progress, FOOTER_GLOW_END, FOOTER_CARD_END) : 0
  return Math.min(1, glow * 0.55 + card * 0.45)
}

/**
 * Плавно гасит элемент интерфейса по мере подъёма футера и отключает клики по нему.
 *
 * @param {?HTMLElement} el Элемент.
 * @param {number} lift Коэффициент подъёма 0..1.
 * @param {{speed: number, blockAt: number, transform?: string}} options Скорость затухания,
 *   порог отключения кликов и дополнительное преобразование.
 */
function fadeForFooter(el, lift, { speed, blockAt, transform }) {
  if (!el) return
  // Пока футер не виден, стили не трогаем: запись даже того же значения на каждом
  // событии прокрутки заставляет браузер пересчитывать стили.
  if (lift <= 0.01 && !el.style.opacity) return
  const active = lift > 0.01
  el.style.opacity = active ? `${Math.max(0, 1 - lift * speed)}` : ''
  el.style.pointerEvents = active && lift > blockAt ? 'none' : ''
  if (transform !== undefined) el.style.transform = active ? transform : ''
}

/**
 * Ограничивает шаг колеса мыши, чтобы страницу нельзя было пролистать одним рывком.
 *
 * @param {HTMLElement} el Элемент прокрутки.
 * @return {function(WheelEvent): void} Обработчик wheel.
 */
const clampWheel = (el) => (e) => {
  if (Math.abs(e.deltaY) <= MAX_WHEEL_DELTA) return
  e.preventDefault()
  e.stopPropagation()
  el.scrollTop += Math.sign(e.deltaY) * MAX_WHEEL_DELTA
}

/**
 * Страница 3D-витрины. Держит состояние покраски и режимов, синхронизирует интерфейс
 * с прокруткой сцены и собирает шапку, HUD, док покраски и Canvas.
 *
 * @return {JSX.Element} Полноэкранный контейнер страницы.
 */
export function ShowcasePage() {
  const lang = useLang()
  const text = lang === 'en'
    ? {
        inspect: '3D view',
        xray: 'X-ray',
        showDescription: 'Show description',
        hideDescription: 'Hide description',
        enableSound: 'Enable sound',
        disableSound: 'Mute sound',
        showPanels: 'Show panels',
        hidePanels: 'Hide panels',
        showcaseCaption: 'Exploded Niva Concept',
        sceneDescription: 'Interactive 3D model of the LADA Niva Concept car. Scroll to move through assembly stages; drag or touch to orbit the camera; select parts to customize body colors and materials.',
      }
    : {
        inspect: '3D-осмотр',
        xray: 'Рентген',
        showDescription: 'Показать описание',
        hideDescription: 'Скрыть описание',
        enableSound: 'Включить звук',
        disableSound: 'Отключить звук',
        showPanels: 'Показать панели',
        hidePanels: 'Скрыть панели',
        showcaseCaption: 'Exploded Niva Concept',
        sceneDescription: 'Интерактивная трёхмерная модель автомобиля LADA Niva Concept. Управление: прокрутка страницы для перемещения по этапам сборки, зажатие мыши или касание для вращения камеры вокруг автомобиля, выбор деталей для настройки цвета и материалов кузова.',
      }
  // Шапка с вкладками появляется только после полной загрузки страницы.
  const pageReady = usePageReady()
  const isSoftwareGpu = useMemo(() => detectSoftwareRenderer(), [])

  const [selectedPart, setSelectedPart] = useState(null)
  const [hoverColor, setHoverColor] = useState(null)
  const [partColors, setPartColors] = useState(DEFAULT_PART_COLORS)
  const [partMaterials, setPartMaterials] = useState(DEFAULT_PART_MATERIALS)
  const [xRayMode, setXRayMode] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [cardsHidden, setCardsHidden] = useState(false)
  const [isFooterActive, setIsFooterActive] = useState(false)

  const dockRef = useRef(null)
  const headerRef = useRef(null)
  const hudRef = useRef(null)
  const canvasWrapRef = useRef(null)
  const scrollTextRef = useRef(null)
  const verticesTextRef = useRef(null)
  const trianglesTextRef = useRef(null)
  const lastCarClick = useRef(0)
  const footerActiveRef = useRef(false)

  const selectPart = useCallback((part) => {
    lastCarClick.current = Date.now()
    setSelectedPart(part)
    setHoverColor(null)
  }, [])

  useEffect(() => {
    const closeOnOutsideClick = (e) => {
      if (Date.now() - lastCarClick.current < CAR_CLICK_GUARD_MS) return
      if (dockRef.current && !dockRef.current.contains(e.target)) selectPart(null)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [selectPart])

  useEffect(() => {
    document.body.classList.toggle('cards-hidden', cardsHidden)
    if (cardsHidden) setOverlayHover('card', false)
    return () => document.body.classList.remove('cards-hidden')
  }, [cardsHidden])

  const handleRegisterScrollEl = useCallback((el) => {
    if (!el) return

    // Сдвиг сравнивается числом: браузер нормализует style.transform
    // («translate3d(0px, 0px, 0px)»), и сравнение строк никогда не совпадало —
    // transform обёртки canvas переписывался на каждом событии прокрутки.
    let lastLiftPx = null
    let tabBar = null
    const onScroll = () => {
      const max = scrollMax(el)
      if (max <= 0) return
      const progress = el.scrollTop / max
      const lift = footerLift(footerProgress(progress))
      const liftPx = Math.round(lift * window.innerHeight * 0.38)

      if (canvasWrapRef.current && liftPx !== lastLiftPx) {
        lastLiftPx = liftPx
        canvasWrapRef.current.style.transform = `translate3d(0, -${liftPx}px, 0)`
      }
      if (!tabBar?.isConnected) tabBar = document.querySelector('.animated-tab-bar-container')
      fadeForFooter(tabBar, lift, {
        speed: 2.2,
        blockAt: 0.25,
        transform: `translate3d(0, ${-Math.round(lift * 42)}px, 0) scale(${1 - lift * 0.04})`,
      })
      fadeForFooter(headerRef.current, lift, { speed: 2.2, blockAt: 0.25 })
      fadeForFooter(hudRef.current, lift, { speed: 2.5, blockAt: 0.2 })

      if (lift > FOOTER_ACTIVE_ON && !footerActiveRef.current) {
        footerActiveRef.current = true
        setIsFooterActive(true)
        selectPart(null)
      } else if (lift <= FOOTER_ACTIVE_OFF && footerActiveRef.current) {
        footerActiveRef.current = false
        setIsFooterActive(false)
      }
    }

    const onWheel = clampWheel(el)
    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('scroll', onScroll)
      el.removeEventListener('wheel', onWheel)
    }
  }, [selectPart])

  const changeColor = (color, withSound) => {
    if (!selectedPart || xRayMode) return
    if (withSound) playClickSound()
    setPartColors((prev) => ({ ...prev, [selectedPart]: color }))
    setHoverColor(null)
  }

  const changeMaterial = (property, value) => {
    if (!selectedPart || xRayMode) return
    setPartMaterials((prev) => ({
      ...prev,
      [selectedPart]: { ...FALLBACK_MATERIAL, ...prev[selectedPart], [property]: value },
    }))
  }

  const handleScenePartSelect = (part) => {
    if (xRayMode) return
    if (part) playClickSound()
    selectPart(part)
  }

  const setXRay = (enabled) => {
    setXRayMode(enabled)
    if (enabled) selectPart(null)
  }

  const toggleMute = () => {
    const next = !isMuted
    setIsMuted(next)
    setAudioMuted(next)
    if (!next) playClickSound()
  }

  const tabActions = [
    () => setXRay(false),
    () => setXRay(true),
    () => setCardsHidden((hidden) => !hidden),
    toggleMute,
  ]

  const tabItems = [
    { color: TAB_COLOR, label: text.inspect, icon: <Box size={19} strokeWidth={2} />, ariaPressed: !xRayMode },
    { color: TAB_COLOR, label: text.xray, icon: <ScanLine size={19} strokeWidth={2} />, ariaPressed: xRayMode },
    {
      color: TAB_COLOR,
      label: cardsHidden ? text.showDescription : text.hideDescription,
      icon: cardsHidden ? <EyeOff size={19} strokeWidth={2} /> : <Eye size={19} strokeWidth={2} />,
      ariaPressed: !cardsHidden,
    },
    {
      color: TAB_COLOR,
      label: isMuted ? text.enableSound : text.disableSound,
      icon: isMuted ? <VolumeX size={19} strokeWidth={2} /> : <Volume2 size={19} strokeWidth={2} />,
      ariaPressed: !isMuted,
    },
  ]

  const displayColors = useMemo(
    () => (hoverColor && selectedPart ? { ...partColors, [selectedPart]: hoverColor } : partColors),
    [partColors, selectedPart, hoverColor],
  )

  return (
    <div className="sandbox-container">
      <AssetPreloader caption={text.showcaseCaption} />

      <header ref={headerRef} className={`sandbox-header ${pageReady ? '' : 'is-awaiting'}`}>
        <div className="header-tabbar-wrapper">
          <AnimatedTabBar
            className={isFooterActive ? 'tab-bar-hidden' : ''}
            items={tabItems}
            activeIndex={xRayMode ? 1 : 0}
            onTabChange={(index) => {
              playClickSound()
              tabActions[index]?.()
            }}
          />
        </div>
      </header>

      <TechHud
        hudRef={hudRef}
        xRayMode={xRayMode}
        scrollRef={scrollTextRef}
        verticesRef={verticesTextRef}
        trianglesRef={trianglesTextRef}
      />

      {selectedPart && !xRayMode && (
        <ColorCustomizerDock
          dockRef={dockRef}
          selectedPart={selectedPart}
          partColors={partColors}
          displayColors={displayColors}
          partMaterials={partMaterials}
          hoverColor={hoverColor}
          onSelectPart={(part) => {
            playClickSound()
            selectPart(part)
          }}
          onClose={() => {
            playClickSound()
            selectPart(null)
          }}
          onHoverColor={setHoverColor}
          onColorChange={changeColor}
          onMaterialChange={changeMaterial}
          lang={lang}
        />
      )}

      <div ref={canvasWrapRef} className="canvas-viewport-wrap">
        <div className="sr-only">
          {text.sceneDescription}
        </div>
        <CanvasSafeWrapper>
          <Canvas
            role="img"
            aria-label={text.sceneDescription}
            camera={{ position: [0, 2.5, 6], fov: 50 }}
            gl={{
              powerPreference: 'high-performance',
              antialias: !isSoftwareGpu,
              stencil: false,
              alpha: false,
              depth: true,
              precision: isSoftwareGpu ? 'mediump' : 'highp',
              failIfMajorPerformanceCaveat: false,
            }}
            dpr={isSoftwareGpu ? 1 : adaptiveDpr([1, 1.5])}
            performance={{ min: 0.5 }}
            style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
          >
            <Suspense fallback={null}>
              <ScrollScene
                graphicsQuality={isSoftwareGpu ? 'low' : 'high'}
                carColor={displayColors.body}
                partColors={displayColors}
                partMaterials={partMaterials}
                selectedPart={selectedPart}
                onSelectPart={handleScenePartSelect}
                xRayMode={xRayMode}
                trianglesTextRef={trianglesTextRef}
                verticesTextRef={verticesTextRef}
                scrollProgressTextRef={scrollTextRef}
                onRegisterScrollEl={handleRegisterScrollEl}
              />
              {/* Экран загрузки закроется, когда сцена загрузится и отрисует первые кадры. */}
              <SceneReadySignal />
            </Suspense>
          </Canvas>
        </CanvasSafeWrapper>
      </div>
    </div>
  )
}
