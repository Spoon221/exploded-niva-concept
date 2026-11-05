/**
 * @fileoverview HDR-окружение сцены с запасным процедурным освещением на случай,
 * если файл окружения не загрузился.
 */
import { Environment } from '@react-three/drei'
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary'
import { ENVIRONMENT_HDR_URL } from '@/shared/assets/assetUrls'

/**
 * Трёхточечное освещение, которым заменяется HDR-карта при сбое загрузки.
 *
 * @param {{intensity?: number}} props Общая яркость.
 * @return {JSX.Element}
 */
function FallbackLighting({ intensity = 0.6 }) {
  return (
    <>
      <ambientLight intensity={intensity * 0.7} color="#c7d2fe" />
      <directionalLight position={[10, 15, 10]} intensity={intensity * 1.5} color="#e0e7ff" />
      <directionalLight position={[-10, 10, -10]} intensity={intensity * 0.8} color="#38bdf8" />
      <directionalLight position={[0, -10, 5]} intensity={intensity * 0.5} color="#818cf8" />
    </>
  )
}

/**
 * Environment из drei, защищённый от сетевых ошибок.
 *
 * @param {{files?: string, intensity?: number}} props Путь к HDR, яркость и прочие свойства Environment.
 * @return {JSX.Element}
 */
export function SafeEnvironment({ files = ENVIRONMENT_HDR_URL, intensity = 0.6, ...props }) {
  return (
    <ErrorBoundary label="SafeEnvironment" fallback={<FallbackLighting intensity={intensity} />}>
      <Environment files={files} intensity={intensity} {...props} />
    </ErrorBoundary>
  )
}
