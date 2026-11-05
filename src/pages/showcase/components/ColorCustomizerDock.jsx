/**
 * @fileoverview Док покраски на странице /new: выбор детали, палитра, системный
 * колор-пикер, ввод HEX, копирование, пипетка и ползунки глянца и металлика.
 */
import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react'
import { X, Palette, Pipette, Copy, Check, Hash } from 'lucide-react'
import { playClickSound } from '@/shared/lib/synthAudio'
import { CAR_PARTS, getCarParts, getPaletteColors, PALETTE_COLORS, FALLBACK_MATERIAL } from '../data/carParts'

const PICKER_SOUND_DELAY_MS = 250
const COPIED_FEEDBACK_MS = 1400
const canUseEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window

/**
 * Приводит ввод к полному HEX-цвету: принимает 3 или 6 шестнадцатеричных цифр.
 *
 * @param {string} raw Цифры без решётки.
 * @return {?string} Цвет вида #RRGGBB или null, если ввод неполный.
 */
function normalizeHex(raw) {
  if (raw.length === 6) return `#${raw}`
  if (raw.length === 3) return `#${[...raw].map((ch) => ch + ch).join('')}`
  return null
}

/**
 * Сравнивает два цвета без учёта регистра.
 *
 * @param {string} a Первый цвет.
 * @param {string} b Второй цвет.
 * @return {boolean}
 */
const sameColor = (a = '', b = '') => a.toLowerCase() === b.toLowerCase()

/**
 * Двигает «пилюлю» под активной вкладкой детали и следит за изменением размеров.
 *
 * @param {?string} selectedPart Выбранная деталь.
 * @return {{trackRef: React.RefObject, indicatorRef: React.RefObject,
 *   tabRefs: React.MutableRefObject<HTMLElement[]>}} Ref-ы трека, индикатора и вкладок.
 */
function useTabIndicator(selectedPart) {
  const trackRef = useRef(null)
  const indicatorRef = useRef(null)
  const tabRefs = useRef([])

  const update = useCallback(() => {
    const indicator = indicatorRef.current
    const tab = tabRefs.current[CAR_PARTS.findIndex((part) => part.id === selectedPart)]
    if (!indicator) return
    if (!tab) {
      indicator.style.opacity = '0'
      return
    }
    indicator.style.transform = `translate3d(${tab.offsetLeft}px, 0, 0)`
    indicator.style.width = `${tab.offsetWidth}px`
    indicator.style.opacity = '1'
  }, [selectedPart])

  useLayoutEffect(() => {
    update()
    window.addEventListener('resize', update)
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null
    if (trackRef.current) observer?.observe(trackRef.current)
    return () => {
      window.removeEventListener('resize', update)
      observer?.disconnect()
    }
  }, [update])

  return { trackRef, indicatorRef, tabRefs }
}

/**
 * Проигрывает щелчок один раз после того, как пользователь отпустил системный колор-пикер.
 * Пока ползунок тянут, звук не играет; если событие отпускания перехватит ОС, звук
 * сработает по таймеру.
 *
 * @return {{onDrag: function(): void, onCommit: function(): void}} Обработчики перетаскивания и фиксации.
 */
function usePickerSound() {
  const pending = useRef(false)
  const timer = useRef(null)

  const onCommit = useCallback(() => {
    clearTimeout(timer.current)
    if (!pending.current) return
    pending.current = false
    playClickSound()
  }, [])

  const onDrag = useCallback(() => {
    pending.current = true
    clearTimeout(timer.current)
    timer.current = setTimeout(onCommit, PICKER_SOUND_DELAY_MS)
  }, [onCommit])

  useEffect(() => {
    window.addEventListener('pointerup', onCommit)
    window.addEventListener('mouseup', onCommit)
    return () => {
      window.removeEventListener('pointerup', onCommit)
      window.removeEventListener('mouseup', onCommit)
      clearTimeout(timer.current)
    }
  }, [onCommit])

  return { onDrag, onCommit }
}

/**
 * Обновляет CSS-переменные «оттаивающего» стекла дока под курсором.
 *
 * @param {MouseEvent} e Событие мыши над доком.
 */
function frostFollow(e) {
  const el = e.currentTarget
  const rect = el.getBoundingClientRect()
  el.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`)
  el.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`)
  el.style.setProperty('--defrost-glow', '1')
  el.style.setProperty('--frost-opacity', '0')
}

/**
 * Возвращает доку матовое стекло, когда курсор ушёл.
 *
 * @param {MouseEvent} e Событие ухода мыши.
 */
function frostReset(e) {
  e.currentTarget.style.setProperty('--defrost-glow', '0')
  e.currentTarget.style.setProperty('--frost-opacity', '1')
}

/**
 * Ползунок параметра материала со звуком при отпускании.
 *
 * @param {{label: string, title: string, value: number, onChange: function(number): void}} props
 * @return {JSX.Element}
 */
function MaterialSlider({ label, title, value, onChange }) {
  return (
    <div className="material-slider-group">
      <span className="material-label">{label}</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseUp={playClickSound}
        onTouchEnd={playClickSound}
        className="material-slider"
        title={title}
      />
    </div>
  )
}

/**
 * Плавающий док покраски выбранной детали.
 *
 * @param {{dockRef: React.Ref, selectedPart: string, partColors: Object<string, string>,
 *   displayColors: Object<string, string>, partMaterials: Object<string, Object>,
 *   hoverColor: ?string, onSelectPart: function(string): void, onClose: function(): void,
 *   onHoverColor: function(?string): void, onColorChange: function(string, boolean): void,
 *   onMaterialChange: function(string, number): void}} props
 *   Ref дока для клика снаружи, выбранная деталь, сохранённые и отображаемые цвета,
 *   материалы, цвет под курсором и колбэки изменений.
 * @return {JSX.Element}
 */
export function ColorCustomizerDock({
  dockRef,
  selectedPart,
  partColors,
  displayColors,
  partMaterials,
  hoverColor,
  onSelectPart,
  onClose,
  onHoverColor,
  onColorChange,
  onMaterialChange,
  lang = 'ru',
}) {
  const text = lang === 'en'
    ? { close: 'Close', chooseColor: 'Choose a shade in the system palette', hex: 'Enter or paste a HEX colour code (press Enter to apply)', copied: 'HEX copied!', copy: 'Copy HEX code', eyedropper: 'Eyedropper (pick a colour from the screen)', gloss: 'Gloss', glossTitle: 'Gloss level', metallic: 'Metallic', metallicTitle: 'Metallic intensity' }
    : { close: 'Закрыть', chooseColor: 'Выбрать оттенок в системной палитре', hex: 'Ввести или вставить HEX код цвета (Enter для применения)', copied: 'HEX скопирован!', copy: 'Скопировать HEX код', eyedropper: 'Пипетка (выбрать цвет с экрана)', gloss: 'Глянец', glossTitle: 'Уровень блеска (глянцевость)', metallic: 'Металлик', metallicTitle: 'Интенсивность металлика' }
  const parts = getCarParts(lang)
  const palette = getPaletteColors(lang)
  const [editingHex, setEditingHex] = useState(null)
  const [copied, setCopied] = useState(false)
  const { trackRef, indicatorRef, tabRefs } = useTabIndicator(selectedPart)
  const pickerSound = usePickerSound()

  const currentColor = partColors[selectedPart] || '#0a0a0a'
  const isCustomColor = !PALETTE_COLORS.some((c) => sameColor(c.value, currentColor))
  const material = partMaterials[selectedPart] || FALLBACK_MATERIAL

  const handleHexChange = (e) => {
    const raw = e.target.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6).toUpperCase()
    setEditingHex(raw)
    const hex = normalizeHex(raw)
    if (hex) onColorChange(hex, false)
  }

  const handleHexBlur = () => {
    if (editingHex === null) return
    const hex = normalizeHex(editingHex)
    if (hex) onColorChange(hex, true)
    setEditingHex(null)
  }

  const handleCopy = () => {
    navigator.clipboard?.writeText(currentColor.toUpperCase()).catch(() => {})
    setCopied(true)
    playClickSound()
    setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS)
  }

  const handleEyeDropper = async () => {
    try {
      const { sRGBHex } = await new window.EyeDropper().open()
      if (sRGBHex) onColorChange(sRGBHex, true)
    } catch {
      return
    }
  }

  const handlePickerInput = (e) => {
    onColorChange(e.target.value, false)
    pickerSound.onDrag()
  }

  return (
    <div className="customizer-studio-dock" ref={dockRef} onMouseMove={frostFollow} onMouseLeave={frostReset}>
      <div className="menu-frost-layer" aria-hidden="true" />
      <div className="menu-defrost-spotlight" aria-hidden="true" />

      <div className="dock-parts-row">
        <div className="dock-tabs-track" ref={trackRef}>
          <div className="dock-tab-indicator" ref={indicatorRef} />
          {parts.map((part, idx) => (
            <button
              key={part.id}
              ref={(el) => (tabRefs.current[idx] = el)}
              type="button"
              className={`dock-tab ${selectedPart === part.id ? 'active' : ''}`}
              onClick={() => onSelectPart(part.id)}
            >
              <span className="dock-tab-dot" style={{ backgroundColor: displayColors[part.id] || '#0a0a0a' }} />
              <span>{part.label}</span>
            </button>
          ))}
        </div>
        <button type="button" className="dock-close" onClick={onClose} title={text.close}>
          <X size={14} />
        </button>
      </div>

      <div className="dock-colors-row">
        {palette.map((c, idx) => (
          <button
            key={c.value}
            type="button"
            className={`dock-color ${sameColor(c.value, currentColor) ? 'active' : ''} ${hoverColor === c.value ? 'hovered' : ''}`}
            style={{ '--swatch': c.value, '--i': idx }}
            onMouseEnter={() => onHoverColor(c.value)}
            onMouseLeave={() => onHoverColor(null)}
            onClick={() => onColorChange(c.value, true)}
            title={c.name}
          />
        ))}

        <span className="dock-colors-divider" />

        <div className="dock-custom-color-cluster">
          <label className={`dock-custom-swatch-btn ${isCustomColor ? 'is-active-custom' : ''}`} title={text.chooseColor}>
            <div className="dock-custom-swatch-preview">
              <div className="dock-swatch-rainbow-ring" />
              <div className="dock-swatch-inner-color" style={{ backgroundColor: currentColor }}>
                <Palette size={10} className="dock-swatch-icon" />
              </div>
            </div>
            <input
              type="color"
              value={currentColor}
              onInput={handlePickerInput}
              onChange={handlePickerInput}
              onBlur={pickerSound.onCommit}
              onMouseUp={pickerSound.onCommit}
              className="dock-picker-native"
            />
          </label>

          <div className="dock-hex-box" title={text.hex}>
            <span className="dock-hex-hash"><Hash size={11} /></span>
            <input
              type="text"
              className="dock-hex-input"
              value={editingHex ?? currentColor.replace(/^#/, '').toUpperCase()}
              maxLength={6}
              placeholder="1C315F"
              spellCheck={false}
              onChange={handleHexChange}
              onBlur={handleHexBlur}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
          </div>

          <button
            type="button"
            className={`dock-hex-action-btn ${copied ? 'copied' : ''}`}
            onClick={handleCopy}
            title={copied ? text.copied : text.copy}
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
          </button>

          {canUseEyeDropper && (
            <button type="button" className="dock-hex-action-btn dock-pipette-btn" onClick={handleEyeDropper} title={text.eyedropper}>
              <Pipette size={11} />
            </button>
          )}
        </div>
      </div>

      <div className="dock-materials-row">
        <MaterialSlider
          label={text.gloss}
          title={text.glossTitle}
          value={1 - material.roughness}
          onChange={(gloss) => onMaterialChange('roughness', 1 - gloss)}
        />
        <span className="dock-colors-divider dock-colors-divider--short" />
        <MaterialSlider
          label={text.metallic}
          title={text.metallicTitle}
          value={material.metalness}
          onChange={(value) => onMaterialChange('metalness', value)}
        />
      </div>
    </div>
  )
}
