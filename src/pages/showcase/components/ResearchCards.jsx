/** @fileoverview Scroll-driven feature cards for the standalone showcase. */
import { useEffect, useRef } from 'react'
import { Reveal, SplitText } from '@/shared/ui/motion'
import { stopEvent } from '@/shared/lib/dom'
import { useLang } from '@/shared/i18n/lang'
import { setOverlayHover } from '../scene/overlayHover'
import { SceneFooter } from './SceneFooter'

const SPOT_RADIUS = 340
const enterCard = () => setOverlayHover('card', true)
const leaveCard = () => setOverlayHover('card', false)

function moveSpotlight(event) {
  const card = event.currentTarget
  const blob = card.querySelector('.card-spotlight-blob')
  if (!blob) return
  const rect = card.getBoundingClientRect()
  blob.style.transform = `translate3d(${event.clientX - rect.left - SPOT_RADIUS}px, ${event.clientY - rect.top + card.scrollTop - SPOT_RADIUS}px, 0)`
}

function CardShell({ children, side = 'left', hero = false }) {
  return (
    <Reveal className={`scroll-section standard-section section-${side}`}>
      <div className={hero ? 'glass-card hero-card theme-cyan' : 'glass-card info-card'} onPointerEnter={enterCard} onPointerLeave={leaveCard} onMouseEnter={enterCard} onMouseLeave={leaveCard} onPointerMove={moveSpotlight} onPointerDown={stopEvent} onClick={stopEvent}>
        <div className={`glass-card-shader-bg theme-${hero ? 'cyan' : 'mono'}`} aria-hidden="true" />
        <span className="card-spotlight" aria-hidden="true"><span className="card-spotlight-blob" /></span>
        <div className="glass-card-inner">{children}</div>
      </div>
    </Reveal>
  )
}

function FeatureCard({ index, title, lead, rows, side }) {
  return (
    <CardShell side={side}>
      <div className="card-header"><span className="card-index">{index}</span><h2 className="section-title">{title}</h2></div>
      <p className="section-text">{lead}</p>
      <div className="tech-table">
        {rows.map(([label, value]) => (
          <div className="table-row" key={label}><span className="table-label">{label}</span><span className="table-leader" /><span className="table-value">{value}</span></div>
        ))}
      </div>
    </CardShell>
  )
}

/** The text layer presents interaction and production details, without academic material. */
export function ResearchCards({ onHeightChange }) {
  const rootRef = useRef(null)
  const lang = useLang()
  const local = (ru, en) => (lang === 'en' ? en : ru)

  useEffect(() => {
    const root = rootRef.current
    if (!root || !onHeightChange) return undefined
    const observer = new ResizeObserver(() => onHeightChange(root.offsetHeight))
    observer.observe(root)
    return () => observer.disconnect()
  }, [onHeightChange])

  const cards = [
    ['03 / CAMERA PATH', local('Камера как часть истории', 'Camera as storytelling'), local('Прокрутка проводит камеру через последовательность ракурсов. Каждый этап кадрирует новую группу деталей, не отрывая пользователя от модели.', 'Scrolling guides the camera through a sequence of viewpoints. Every stage frames a new group of parts while keeping the vehicle as the focus.'), [[local('Навигация', 'Navigation'), local('Прокрутка + перетаскивание', 'Scroll + drag')], [local('Траектория', 'Path'), 'Catmull–Rom spline'], [local('Камера', 'Camera'), local('Плавное наведение', 'Smooth look-at')]]],
    ['04 / ASSEMBLY', local('Разобранный вид', 'Exploded view'), local('Детали кузова и колёса разъезжаются по независимым осям. Анимация показывает конструкцию, но сохраняет силуэт автомобиля читаемым.', 'Body panels and wheels move along independent axes. The animation exposes the construction while keeping the car silhouette readable.'), [[local('Анимация', 'Animation'), local('Группы Object3D', 'Object3D groups')], [local('Трансформации', 'Transforms'), 'Matrix4 / Euler'], [local('Пересборка мешей', 'Mesh rebuild'), local('Не требуется', 'Not required')]]],
    ['05 / X-RAY', local('Рентген-режим', 'X-ray mode'), local('Второй режим навигации меняет визуальный язык сцены: внешний корпус становится прозрачнее, а внутренние объекты получают контрастный акцент.', 'A second viewing mode changes the visual language of the scene: the outer shell becomes transparent and inner objects receive a high-contrast accent.'), [[local('Переключение', 'Switch'), local('Вкладка в верхнем меню', 'Top navigation tab')], [local('Переход', 'Transition'), local('Плавное смешение материалов', 'Smooth material blend')], [local('Управление', 'Control'), local('Без перезагрузки сцены', 'No scene reload')]]],
    ['06 / CUSTOMIZE', local('Настройка материалов', 'Material customization'), local('Выберите элемент кузова прямо на модели и измените цвет, глянец или металличность. Состояние применяется мгновенно к выбранной части.', 'Select a body element directly on the model and change its color, gloss or metallic finish. The state is applied instantly to the selected part.'), [[local('Выбор детали', 'Part selection'), local('Нажатие по модели', 'Direct picking')], [local('Параметры', 'Parameters'), local('Цвет · глянец · металлик', 'Color · gloss · metallic')], [local('Обратная связь', 'Feedback'), local('Предпросмотр при наведении', 'Hover preview')]]],
    ['07 / LIGHTING', local('Свет и окружение', 'Light and environment'), local('HDR-окружение добавляет отражения, а локальные источники света подчёркивают объём и внутренние зоны модели.', 'An HDR environment provides reflections, while local lights define the volume and interior areas of the model.'), [['HDRI', local('Окружение и отражения', 'Environment and reflections')], [local('Основной свет', 'Key light'), local('Направленный', 'Directional')], [local('Подсветка двигателя', 'Engine glow'), local('Анимирована прокруткой', 'Scroll-driven')]]],
    ['08 / WEBGL', local('Сцена для браузера', 'Built for the browser'), local('Витрина использует WebGL через Three.js и React Three Fiber. Модель и окружение загружаются асинхронно, а интерфейс остаётся доступным поверх Canvas.', 'The showcase uses WebGL through Three.js and React Three Fiber. The model and environment load asynchronously while the interface remains available above the canvas.'), [['Renderer', 'WebGL / Three.js'], ['Framework', 'React Three Fiber'], [local('Ресурсы', 'Assets'), 'glTF + HDRI']]],
    ['09 / EXPLORE', local('Исследуйте модель', 'Explore the model'), local('Прокрутите страницу, вращайте камеру и выбирайте элементы кузова. Режимы просмотра и настройка материалов доступны в верхней панели в любой момент.', 'Scroll through the experience, orbit the camera and select body elements. Viewing modes and material customization stay available from the top panel at any time.'), [[local('Прокрутка', 'Scroll'), local('Переход между сценами', 'Move through scenes')], [local('Перетаскивание', 'Drag'), local('Вращение камеры', 'Orbit the camera')], [local('Выбор', 'Select'), local('Открывает панель материалов', 'Opens the material panel')]]],
  ]

  return (
    <div ref={rootRef}>
      <CardShell hero><SplitText as="h1" className="title" text="EXPLODED NIVA CONCEPT" /><div className="scroll-hint-wrapper"><div className="scroll-mouse"><span className="scroll-wheel" /></div></div></CardShell>
      <FeatureCard side="left" index="01 / PROPULSION" title={local('Силовая установка', 'Power unit')} lead={local('При прокрутке открывается капот и включается бирюзовая подсветка моторного отсека. Её интенсивность следует за положением в истории.', 'As you scroll, the hood opens and turquoise lighting reveals the engine bay. Its intensity follows the story position.')} rows={[[local('Источник света', 'Light source'), local('Динамическая интенсивность', 'Dynamic intensity')], [local('Рендеринг', 'Rendering'), local('Прямой проход', 'Direct pass')], [local('Тени', 'Shadows'), local('Отключены для акцента', 'Disabled for emphasis')]]} />
      <FeatureCard side="right" index="02 / CHASSIS" title={local('Декомпозиция кузова', 'Body decomposition')} lead={local('Кузовные элементы организованы в логические узлы с независимыми осями вращения и смещения.', 'Body elements are organised into logical nodes with independent rotation and offset axes.')} rows={[[local('Подвижные узлы', 'Movable nodes'), local('5 групп', '5 groups')], [local('Вынос колёс', 'Wheel offset'), `0.95 ${local('м', 'm')}`], [local('Иерархия', 'Hierarchy'), 'Object3D rig']]} />
      {cards.map(([index, title, lead, rows], cardIndex) => <FeatureCard key={index} index={index} title={title} lead={lead} rows={rows} side={cardIndex % 2 ? 'right' : 'left'} />)}
      <div className="scroll-section section-footer"><SceneFooter /></div>
    </div>
  )
}
