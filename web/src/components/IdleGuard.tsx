import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { backend } from '../lib/backend'
import { voice } from '../lib/voice/engine'
import { t } from '../lib/i18n'

/** Depois de tanto tempo sem usar, a conexão em tempo real é solta (o plano gratuito só aguenta 200 ao mesmo tempo). */
export const IDLE_MS = 30 * 60 * 1000
const CHECK_MS = 30 * 1000
const BEAT_MS = 5 * 60 * 1000

/** Algo que não pode ser perdido: call/compartilhamento ativo ou texto digitado e ainda não enviado. */
function busy() {
  const v = voice.getSnapshot()
  if (v.status !== 'idle' || v.camera || v.screen) return true
  return Array.from(document.querySelectorAll('textarea')).some((el) => (el as HTMLTextAreaElement).value.trim() !== '')
}

/** Avisa o servidor, a cada 5 minutos, que esta pessoa está com o app aberto (contador do painel do administrador). */
function Heartbeat() {
  useEffect(() => {
    const beat = () => void backend.touchSeen().catch(() => {})
    beat()
    const id = window.setInterval(beat, BEAT_MS)
    return () => window.clearInterval(id)
  }, [])
  return null
}

export function IdleGuard({ children }: { children: ReactNode }) {
  const [asleep, setAsleep] = useState(false)
  const last = useRef(Date.now())

  const wake = useCallback(() => {
    last.current = Date.now()
    setAsleep(false)
  }, [])

  useEffect(() => {
    const touch = () => {
      last.current = Date.now()
    }
    const opts = { passive: true } as const
    const evs = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel'] as const
    for (const e of evs) window.addEventListener(e, touch, opts)
    // voltar para a aba/janela conta como uso (e acorda sozinho se estava em pausa)
    const back = () => {
      if (document.visibilityState === 'visible') wake()
    }
    document.addEventListener('visibilitychange', back)
    window.addEventListener('focus', back)
    const timer = window.setInterval(() => {
      if (Date.now() - last.current < IDLE_MS) return
      if (busy()) {
        last.current = Date.now() - IDLE_MS + 5 * 60 * 1000 // tenta de novo em 5 min
        return
      }
      setAsleep(true)
    }, CHECK_MS)
    return () => {
      for (const e of evs) window.removeEventListener(e, touch)
      document.removeEventListener('visibilitychange', back)
      window.removeEventListener('focus', back)
      window.clearInterval(timer)
    }
  }, [wake])

  if (asleep)
    return (
      <div className="splash idle-screen" data-testid="idle-screen">
        <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" />
        <h2>{t('Sessão em pausa')}</h2>
        <p className="muted">{t('Você ficou 30 minutos sem usar o Descarga, então a conexão foi pausada para liberar espaço. Suas mensagens estão salvas.')}</p>
        <button className="btn btn-primary" onClick={wake}>{t('Continuar')}</button>
      </div>
    )

  return (
    <>
      <Heartbeat />
      {children}
    </>
  )
}
