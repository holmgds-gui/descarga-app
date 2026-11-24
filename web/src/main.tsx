import './lib/authUrl'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/plus-jakarta-sans'
import '@fontsource-variable/bricolage-grotesque'
import './styles.css'
import './design-novo.css'
import App from './App'
import { applyAppearance, loadAppearance } from './state'
import { applyDesign } from './lib/design'
import { registerServiceWorker } from './lib/push'
import { diag } from './lib/voice/engine'
import { ErrorBoundary } from './components/ErrorBoundary'

applyDesign()
applyAppearance(loadAppearance())
void registerServiceWorker()

// erros inesperados vão para o diagnóstico (só neste aparelho)
window.addEventListener('error', (e) => diag(`erro: ${e.message} @${e.filename?.split('/').pop()}:${e.lineno}`))
window.addEventListener('unhandledrejection', (e) => diag(`promessa rejeitada: ${(e.reason as Error)?.message ?? e.reason}`))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
