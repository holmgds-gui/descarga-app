import './lib/authUrl'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/plus-jakarta-sans'
import '@fontsource-variable/bricolage-grotesque'
import './styles.css'
import './design-novo.css'
import './design-classico.css'
import './design-extras.css'
import '@fontsource-variable/noto-sans'
import '@fontsource-variable/orbitron'
import '@fontsource-variable/exo-2'
import '@fontsource-variable/lora'
import '@fontsource-variable/inter'
import '@fontsource-variable/source-serif-4'
import '@fontsource-variable/jetbrains-mono'
import '@fontsource/press-start-2p'
import '@fontsource/vt323'
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
