/**
 * @fileoverview Безопасная загрузка необязательного 3D-ресурса (текстуры, модели окружения):
 * пока файл грузится — показывается fallback, если загрузка упала — тоже fallback,
 * а остальная сцена продолжает работать.
 */
import { Suspense } from 'react'
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary'

/**
 * Граница ошибок и Suspense вокруг компонента, загружающего ресурсы.
 *
 * @param {{children: React.ReactNode, fallback?: React.ReactNode, label?: string}} props
 *   Содержимое, запасной вариант (на время загрузки и при ошибке) и метка для консоли.
 * @return {JSX.Element} Обёрнутое содержимое.
 */
export function SafeAsset({ children, fallback = null, label = 'SafeAsset' }) {
  return (
    <ErrorBoundary label={label} fallback={fallback}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </ErrorBoundary>
  )
}
