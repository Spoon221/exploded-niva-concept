import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initAssetPreloader } from '@/shared/assets/assetPreloader'
import { ShowcasePage } from '@/pages/showcase/ShowcasePage'
import './styles/index.css'

initAssetPreloader()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ShowcasePage />
  </StrictMode>,
)
