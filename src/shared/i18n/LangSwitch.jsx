/**
 * @fileoverview Переключатель языка RU / EN. Выбор сохраняется в localStorage.
 */
import { setLang, useLang } from './lang'
import './LangSwitch.css'

const LANGS = ['ru', 'en']

/**
 * Два языка через разделитель, как счётчик слайдов: активный подсвечен цветом слайда.
 *
 * @param {{accent?: string, className?: string}} props Цвет активного языка и дополнительный класс.
 * @return {JSX.Element}
 */
export function LangSwitch({ accent = '#818cf8', className = '' }) {
  const lang = useLang()
  return (
    <div
      className={`lang-switch ${className}`}
      role="group"
      aria-label={lang === 'en' ? 'Language' : 'Язык'}
      style={{ '--lang-accent': accent }}
    >
      {LANGS.map((code, i) => (
        <span key={code} className="lang-switch-item">
          {i > 0 && <span className="lang-switch-sep" aria-hidden="true" />}
          <button
            type="button"
            className={`lang-switch-btn ${lang === code ? 'active' : ''}`}
            aria-pressed={lang === code}
            onClick={(e) => {
              e.stopPropagation()
              setLang(code)
            }}
          >
            {code.toUpperCase()}
          </button>
        </span>
      ))}
    </div>
  )
}
