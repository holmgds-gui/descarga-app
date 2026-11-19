import { useCallback, useEffect, useState } from 'react'
import { Ban, Check, Crown, RefreshCw, RotateCcw, ShieldCheck, Trash2, X } from 'lucide-react'
import { backend } from '../lib/backend'
import type { AdminUser, Report } from '../lib/types'
import { useApp } from '../state'
import { Avatar } from './Avatar'
import { locale, t } from '../lib/i18n'

const when = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat(locale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '—'

/** Painel do administrador: aprova, recusa, bloqueia e desbloqueia contas. */
export function AdminPanel() {
  const { toast, ask, me } = useApp()
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [showDone, setShowDone] = useState(false)

  const load = useCallback(async () => {
    try {
      setUsers(await backend.adminListUsers())
      setReports(await backend.adminListReports().catch(() => []))
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [])

  useEffect(() => {
    void load()
    let timer: number | undefined
    const off = backend.onAdminUsersChange(() => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => void load(), 300)
    })
    return () => {
      window.clearTimeout(timer)
      off()
    }
  }, [load])

  const set = async (u: AdminUser, status: 'approved' | 'blocked', done: string) => {
    setBusyId(u.id)
    try {
      await backend.adminSetApproval(u.id, status)
      toast(done)
      await load()
    } catch (err) {
      toast((err as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  const block = async (u: AdminUser) => {
    const ok = await ask({
      title: t('Bloquear {nome}', { nome: u.display_name || u.username }),
      message: t('Essa pessoa perde o acesso ao app na hora, inclusive se estiver numa call. Você pode desbloquear quando quiser.'),
      confirmLabel: t('Bloquear'),
      danger: true,
    })
    if (ok) await set(u, 'blocked', t('Conta bloqueada'))
  }

  const remove = async (u: AdminUser) => {
    const ok = await ask({
      title: t('Excluir a conta de {nome}', { nome: u.display_name || u.username }),
      message: t('A conta, o perfil e os arquivos dessa pessoa são apagados e o e-mail {email} fica livre para um novo cadastro. As mensagens dela continuam, assinadas como "Usuário excluído". Não dá para desfazer. (Para só impedir o acesso, use Bloquear.)', { email: u.email }),
      confirmLabel: t('Excluir conta'),
      danger: true,
    })
    if (!ok) return
    setBusyId(u.id)
    try {
      await backend.deleteAccount(u.id)
      toast(t('Conta excluída'))
      await load()
    } catch (err) {
      toast((err as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  const resolve = async (r: Report, done: boolean) => {
    try {
      await backend.adminResolveReport(r.id, done)
      await load()
    } catch (err) {
      toast((err as Error).message)
    }
  }
  const reasonLabel: Record<Report['reason'], string> = {
    harassment: t('Assédio ou ameaça'), hate: t('Discurso de ódio'), illegal: t('Conteúdo ilegal, golpe ou malware'),
    copyright: t('Direitos autorais'), spam: t('Spam'), other: t('Outro motivo'),
  }

  if (error) {
    return (
      <>
        <h2 className="settings-title">{t('Administração')}</h2>
        <p className="error-text">{error}</p>
        <button className="btn btn-ghost" onClick={() => void load()}><RefreshCw size={16} /> {t('Tentar de novo')}</button>
      </>
    )
  }
  if (!users) return <div className="loading-dots"><span /><span /><span /></div>

  const pending = users.filter((u) => u.approval === 'pending')
  const active = users.filter((u) => u.approval === 'approved')
  const blocked = users.filter((u) => u.approval === 'blocked')

  const row = (u: AdminUser, actions: React.ReactNode) => (
    <div key={u.id} className="admin-row">
      <Avatar profile={{ id: u.id, username: u.username, display_name: u.display_name, avatar_url: u.avatar_url, accent_color: '#7B3FE4', status: 'online' } as never} size={40} />
      <div className="admin-row-text">
        <span className="admin-row-name">
          <strong className="truncate">{u.display_name || u.username}</strong>
          {u.is_admin && <span className="profile-chip ok"><Crown size={12} /> {t('Administrador')}</span>}
        </span>
        <span className="muted small truncate">@{u.username} • {u.email}</span>
        <span className="muted small">{t('Cadastro em {data}', { data: when(u.created_at) })}</span>
      </div>
      <div className="admin-row-actions">{actions}</div>
    </div>
  )

  return (
    <>
      <h2 className="settings-title">{t('Administração')}</h2>
      <p className="muted">{t('Só você vê este painel. Quem se cadastra fica esperando aqui até você aprovar.')}</p>

      <h3 className="field-label admin-h">{t('Aguardando aprovação')} — {pending.length}</h3>
      {!pending.length && <p className="muted small">{t('Ninguém esperando. Quando alguém se cadastrar, aparece aqui e você recebe um aviso.')}</p>}
      {pending.map((u) => row(u, <>
        <button className="btn btn-success btn-sm" disabled={busyId === u.id}
          onClick={() => void set(u, 'approved', t('Conta aprovada'))}><Check size={16} /> {t('Aprovar')}</button>
        <button className="btn btn-ghost btn-sm" disabled={busyId === u.id}
          onClick={() => void set(u, 'blocked', t('Pedido recusado'))}><X size={16} /> {t('Recusar')}</button>
      </>))}

      <h3 className="field-label admin-h">{t('Contas liberadas')} — {active.length}</h3>
      {active.map((u) => row(u, u.is_admin || u.id === me?.id
        ? <span className="muted small"><ShieldCheck size={14} /> {t('Você')}</span>
        : <>
          <button className="btn btn-ghost btn-sm danger-text" disabled={busyId === u.id} onClick={() => void block(u)}>
            <Ban size={16} /> {t('Bloquear')}
          </button>
          <button className="btn btn-ghost btn-sm danger-text" disabled={busyId === u.id} onClick={() => void remove(u)}>
            <Trash2 size={16} /> {t('Excluir')}
          </button>
        </>))}

      <h3 className="field-label admin-h">{t('Denúncias')} — {reports.filter((r) => r.status === 'open').length}</h3>
      {!reports.some((r) => r.status === 'open') && <p className="muted small">{t('Nenhuma denúncia em aberto.')}</p>}
      {reports.filter((r) => showDone || r.status === 'open').map((r) => {
        const who = users.find((u) => u.id === r.reported_id)
        const by = users.find((u) => u.id === r.reporter_id)
        return (
          <div key={r.id} className={`admin-row report-row ${r.status === 'resolved' ? 'done' : ''}`}>
            <div className="admin-row-text">
              <span className="admin-row-name"><strong className="truncate">{who ? who.display_name || who.username : t('Usuário excluído')}</strong>
                <span className="profile-chip">{reasonLabel[r.reason]}</span></span>
              <span className="report-details">{r.details}</span>
              <span className="muted small">{t('Denunciado por {nome}', { nome: by ? '@' + by.username : t('Usuário excluído') })} • {when(r.created_at)}</span>
            </div>
            <div className="admin-row-actions">
              {who && r.status === 'open' && !who.is_admin && who.approval === 'approved' && (
                <button className="btn btn-ghost btn-sm danger-text" disabled={busyId === who.id} onClick={() => void block(who)}><Ban size={16} /> {t('Bloquear')}</button>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => void resolve(r, r.status === 'open')}>
                {r.status === 'open' ? <><Check size={16} /> {t('Resolvida')}</> : <><RotateCcw size={16} /> {t('Reabrir')}</>}
              </button>
            </div>
          </div>
        )
      })}
      {reports.some((r) => r.status === 'resolved') && (
        <button className="btn btn-ghost btn-sm" onClick={() => setShowDone((v) => !v)}>{showDone ? t('Esconder resolvidas') : t('Mostrar resolvidas')}</button>
      )}

      {blocked.length > 0 && (
        <>
          <h3 className="field-label admin-h">{t('Bloqueadas ou recusadas')} — {blocked.length}</h3>
          {blocked.map((u) => row(u, <>
            <button className="btn btn-ghost btn-sm" disabled={busyId === u.id}
              onClick={() => void set(u, 'approved', t('Conta liberada'))}><RotateCcw size={16} /> {t('Liberar')}</button>
            <button className="btn btn-ghost btn-sm danger-text" disabled={busyId === u.id} onClick={() => void remove(u)}>
              <Trash2 size={16} /> {t('Excluir')}
            </button>
          </>))}
        </>
      )}
    </>
  )
}
