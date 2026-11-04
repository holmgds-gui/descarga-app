import { useRef, useState, type FormEvent } from 'react'
import { Camera, Copy, Hash, Volume2 } from 'lucide-react'
import { backend } from '../lib/backend'
import type { ChannelType, Server } from '../lib/types'
import { useApp } from '../state'
import { Modal } from './Modal'
import { t } from '../lib/i18n'

export function ServerCreateModal({ onClose }: { onClose: () => void }) {
  const { me, refreshServers, setActiveServerId, toast } = useApp()
  const [step, setStep] = useState<'choose' | 'create' | 'join'>('choose')
  const [name, setName] = useState(me ? t('Servidor de {nome}', { nome: me.display_name || me.username }) : '')
  const [icon, setIcon] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const done = async (s: Server) => {
    await refreshServers()
    setActiveServerId(s.id)
    onClose()
  }

  const create = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    try {
      await done(await backend.createServer(name.trim(), icon))
      toast(t('Servidor criado'))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const join = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const raw = code.trim()
      const clean = raw.includes('convite=') ? raw.split('convite=')[1].split('&')[0] : raw.split('/').pop() ?? ''
      await done(await backend.joinServer(clean))
      toast(t('Você entrou no servidor'))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const pickIcon = async (f: File | undefined) => {
    if (!f) return
    try {
      setIcon(await backend.uploadImage(f, 'server'))
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (step === 'choose')
    return (
      <Modal title={t('Adicionar um servidor')} subtitle={t('Seu servidor é onde você e seus amigos se encontram.')} onClose={onClose}>
        <div className="choice-list">
          <button className="choice" onClick={() => setStep('create')}>
            <strong>{t('Criar o meu')}</strong>
            <span>{t('Comece do zero, com canais de texto e voz')}</span>
          </button>
          <button className="choice" onClick={() => setStep('join')}>
            <strong>{t('Entrar com um convite')}</strong>
            <span>{t('Tem um código ou link? Cole aqui')}</span>
          </button>
        </div>
      </Modal>
    )

  if (step === 'create')
    return (
      <Modal title={t('Personalize seu servidor')} subtitle={t('Dê um nome e um ícone. Dá para mudar depois.')} onClose={onClose}>
        <form className="form" onSubmit={create}>
          <button type="button" className="icon-upload" onClick={() => fileRef.current?.click()} aria-label={t('Escolher ícone')}>
            {icon ? <img src={icon} alt="" /> : <><Camera size={22} /><span>{t('Ícone')}</span></>}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void pickIcon(e.target.files?.[0])} />
          <label>
            {t('Nome do servidor')}
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required autoFocus />
          </label>
          {error && <p className="form-error">{error}</p>}
          <div className="row-end">
            <button type="button" className="btn btn-ghost" onClick={() => setStep('choose')}>{t('Voltar')}</button>
            <button className="btn btn-primary" disabled={busy}>{t('Criar')}</button>
          </div>
        </form>
      </Modal>
    )

  return (
    <Modal title={t('Entrar em um servidor')} subtitle={t('Cole o código ou o link de convite.')} onClose={onClose}>
      <form className="form" onSubmit={join}>
        <label>
          {t('Código ou link de convite')}
          <input value={code} onChange={(e) => setCode(e.target.value)} required autoFocus placeholder="descarga" />
        </label>
        {backend.mode === 'demo' && <p className="muted small">{t('No modo demonstração, experimente o código')} <code>descarga</code>.</p>}
        {error && <p className="form-error">{error}</p>}
        <div className="row-end">
          <button type="button" className="btn btn-ghost" onClick={() => setStep('choose')}>{t('Voltar')}</button>
          <button className="btn btn-primary" disabled={busy}>{t('Entrar')}</button>
        </div>
      </form>
    </Modal>
  )
}

export function InviteModal({ server, onClose }: { server: Server; onClose: () => void }) {
  const { toast } = useApp()
  const link = `${location.origin}${location.pathname}?convite=${server.invite_code}`
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast(t('Copiado'))
    } catch {
      toast(t('Não deu para copiar. Selecione e copie manualmente.'))
    }
  }
  return (
    <Modal title={t('Convidar amigos para {nome}', { nome: server.name })} onClose={onClose}>
      <div className="form">
        <label>
          {t('Link de convite')}
          <div className="copy-field">
            <input readOnly value={link} onFocus={(e) => e.target.select()} />
            <button className="btn btn-primary" onClick={() => void copy(link)}><Copy size={16} /> {t('Copiar')}</button>
          </div>
        </label>
        <label>
          {t('Ou só o código')}
          <div className="copy-field">
            <input readOnly value={server.invite_code} onFocus={(e) => e.target.select()} />
            <button className="btn btn-ghost" onClick={() => void copy(server.invite_code)}><Copy size={16} /></button>
          </div>
        </label>
      </div>
    </Modal>
  )
}

export function CreateChannelModal({
  serverId,
  defaultType = 'text',
  defaultCategory,
  onClose,
}: {
  serverId: string
  defaultType?: ChannelType
  defaultCategory?: string
  onClose: () => void
}) {
  const { setActiveChannelId, toast } = useApp()
  const [type, setType] = useState<ChannelType>(defaultType)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const clean = type === 'text' ? name.trim().toLowerCase().replace(/\s+/g, '-') : name.trim()
    if (!clean) return
    try {
      const c = await backend.createChannel(
        serverId,
        clean,
        type,
        defaultCategory ?? (type === 'text' ? 'Canais de texto' : 'Canais de voz'),
      )
      if (c.type === 'text') setActiveChannelId(c.id)
      toast(t('Canal criado'))
      onClose()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <Modal title={t('Criar canal')} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="choice-list">
          <button type="button" className={`choice choice-row ${type === 'text' ? 'selected' : ''}`} onClick={() => setType('text')}>
            <Hash size={22} />
            <span><strong>{t('Texto')}</strong><span>{t('Mensagens, imagens, opiniões e piadas')}</span></span>
          </button>
          <button type="button" className={`choice choice-row ${type === 'voice' ? 'selected' : ''}`} onClick={() => setType('voice')}>
            <Volume2 size={22} />
            <span><strong>{t('Voz')}</strong><span>{t('Conversar por voz, vídeo e compartilhar a tela')}</span></span>
          </button>
        </div>
        <label>
          {t('Nome do canal')}
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required autoFocus placeholder={type === 'text' ? t('novo-canal') : t('Sala de jogos')} />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="row-end">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t('Cancelar')}</button>
          <button className="btn btn-primary">{t('Criar canal')}</button>
        </div>
      </form>
    </Modal>
  )
}
