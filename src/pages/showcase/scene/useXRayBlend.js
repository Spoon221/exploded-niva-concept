/**
 * @fileoverview Хук плавного перехода 3D-объектов в режим рентгена и обратно.
 */
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { lerp } from '@/shared/lib/easing'

const BLEND_SPEED = 0.08
const CHANGE_EPSILON = 0.002

/**
 * Каждый кадр подводит коэффициент рентгена к 0 или 1 и вызывает onChange,
 * только когда значение заметно изменилось. Так материалы не обновляются впустую.
 *
 * @param {boolean} xRayMode Включён ли режим рентгена.
 * @param {function(number): void} [onChange] Колбэк с новым коэффициентом 0..1.
 * @return {React.MutableRefObject<number>} Ref с текущим коэффициентом.
 */
export function useXRayBlend(xRayMode, onChange) {
  const blend = useRef(0)
  const lastApplied = useRef(-1)

  useFrame(() => {
    blend.current = lerp(blend.current, xRayMode ? 1 : 0, BLEND_SPEED)
    if (onChange && Math.abs(blend.current - lastApplied.current) > CHANGE_EPSILON) {
      lastApplied.current = blend.current
      onChange(blend.current)
    }
  })

  return blend
}
