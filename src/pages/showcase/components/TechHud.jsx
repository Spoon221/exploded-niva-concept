/** @fileoverview A minimal HUD for the standalone showcase. */
import { useLang } from '@/shared/i18n/lang'

/**
 * Угловые подписи поверх сцены. Числовые поля обновляются напрямую через ref,
 * без ререндера React. На телефоне счётчик свёрнут до числа; касание раскрывает
 * гистограмму и MIN/AVG, повторное — сворачивает.
 *
 * @param {{hudRef: React.Ref, xRayMode: boolean, scrollRef: React.Ref, verticesRef: React.Ref,
 *   trianglesRef: React.Ref}} props HUD state and value refs.
 * @return {JSX.Element}
 */
export function TechHud({ hudRef, xRayMode, scrollRef, verticesRef, trianglesRef }) {
  const lang = useLang()

  return (
    <div ref={hudRef} className={`tech-hud-overlay ${xRayMode ? 'scan-active' : ''}`}>
      <div className="hud-corner bottom-left" aria-hidden="true">
        <div>{lang === 'en' ? 'SCROLL' : 'ПРОКРУТКА'}: <span ref={scrollRef}>0%</span></div>
      </div>

      <div className="hud-corner bottom-right">
        <div>{lang === 'en' ? 'VERTICES' : 'ВЕРШИНЫ'}: <span ref={verticesRef}>-</span></div>
        <div>{lang === 'en' ? 'TRIANGLES' : 'ПОЛИГОНЫ'}: <span ref={trianglesRef}>-</span></div>
      </div>
    </div>
  )
}
