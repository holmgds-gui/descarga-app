import './lib/authUrl'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App'
import { applyAppearance, loadAppearance } from './state'
import { registerServiceWorker } from './lib/push'

applyAppearance(loadAppearance())
void registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
