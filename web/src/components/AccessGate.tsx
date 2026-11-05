import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Clock, LogOut, RefreshCw, ShieldX } from 'lucide-react'
import { backend } from '../lib/backend'
import { voice } from '../lib/voice/engine'
import type { Approval, Profile } from '../lib/types'
import { t } from '../lib/i18n'

/**
 * Só deixa entrar no app quem foi aprovado pelo administrador.
 * Quem está pendente (ou foi bloqueado) vê só uma tela de espera. A regra de verdade está no banco de dados;
 * esta tela é a parte que a pessoa enxerga.
 */
export function AccessGate({ userId, children }: { userId: string; children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [failed, setFailed] = useState(false)
  const [checking, setChecking] = useState(false)
  const alive = useRef(true)

  const load = useCallback(async () => {
    setChecking(true)
    try {
      const [p] = await backend.getProfiles([userId])
      if (!alive.current) return
      if (p) {
        setProfile(p)
        setFailed(false)
      } else setFailed(true)
    } catch {
      if (alive.current) setFailed(true)
    } finally {
      if (alive.current) setChecking(false)
    }
  }, [userId])

  useEffect(() => {
    alive.current = true
    void load()
    const off = backend.onProfileChange((p) => p.id === userId && setProfile((cur) => ({ ...(cur ?? p), ...p })))
    return () => {
      alive.current = false
      off()
    }
  }, [load, userId])

  // versões antigas do banco não têm o campo: nesse caso, a conta conta como aprovada
  const approval: Approval | null = profile ? (profile.approval ?? 'approved') : null

  // enquanto espera, confere de tempos em tempos (além do aviso em tempo real)
  useEffect(() => {
    if (approval === 'approved' || approval === null) return
    const id = window.setInterval(() => void load(), 20000)
    return () => window.clearInterval(id)
  }, [approval, load])

  // alguém bloqueado durante o uso sai de qualquer call na hora
  useEffect(() => {
    if (approval && approval !== 'approved') void voice.leave(false)
  }, [approval])

  // avisa o administrador (uma vez) que tem gente nova esperando
  useEffect(() => {
    if (approval === 'pending') void backend.notify({ type: 'signup' })
  }, [approval])

  if (approval === 'approved') return <>{children}</>

  if (approval === null) {
    return (
      <div className="splash">
        <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" />
        {failed ? (
          <>
            <p className="muted">{t('Não deu para conectar. Verifique a internet.')}</p>
            <button className="btn btn-primary" onClick={() => void load()}>{t('Tentar de novo')}</button>
            <button className="btn btn-ghost" onClick={() => void backend.signOut()}>{t('Sair da conta')}</button>
          </>
        ) : (
          <div className="loading-dots"><span /><span /><span /></div>
        )}
      </div>
    )
  }

  const blocked = approval === 'blocked'
  const name = profile?.display_name || profile?.username || ''
  return (
    <div className="auth-page gate-screen">
      <div className="auth-card" role="status" aria-live="polite">
        <img className="auth-logo" src={`${import.meta.env.BASE_URL}logo.svg`} alt="" />
        <div className={`gate-icon ${blocked ? 'bad' : ''}`}>{blocked ? <ShieldX size={26} /> : <Clock size={26} />}</div>
        <h1>{blocked ? t('Acesso não liberado') : t('Quase lá, {nome}!', { nome: name })}</h1>
        <p className="muted">
          {blocked
            ? t('O administrador não liberou o acesso desta conta. Se você acha que foi engano, fale com ele.')
            : t('Sua conta foi criada e está aguardando a aprovação do administrador. Assim que for aprovada, esta tela abre o app sozinha.')}
        </p>
        <div className="gate-actions">
          {!blocked && (
            <button className="btn btn-primary" disabled={checking} onClick={() => void load()}>
              <RefreshCw size={16} className={checking ? 'spin' : ''} /> {t('Verificar agora')}
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => void backend.signOut()}>
            <LogOut size={16} /> {t('Sair da conta')}
          </button>
        </div>
      </div>
    </div>
  )
}
