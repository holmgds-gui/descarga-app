import { Component, type ErrorInfo, type ReactNode } from 'react'
import { diag } from '../lib/voice/engine'
import { t } from '../lib/i18n'

/** Se alguma tela quebrar por um erro inesperado, mostra um aviso com botão de recarregar (em vez de uma tela vazia). */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    diag(`tela quebrou: ${error.message} | ${(info.componentStack ?? '').split('\n').slice(1, 4).join(' <')}`)
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="boot-error" role="alert" style={{ display: 'grid', placeContent: 'center', justifyItems: 'center', gap: 12, minHeight: '100vh', padding: 24, textAlign: 'center' }}>
        <h2>{t('Algo deu errado')}</h2>
        <p className="muted">{t('O Descarga encontrou um erro inesperado. Recarregue para continuar — o erro ficou registrado no diagnóstico das calls (Configurações > Voz).')}</p>
        <button className="btn btn-primary" onClick={() => location.reload()}>{t('Recarregar')}</button>
      </div>
    )
  }
}
