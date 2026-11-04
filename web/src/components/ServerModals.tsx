import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Camera, Copy, Hash, ImagePlus, Trash2, Volume2 } from 'lucide-react'
import { backend } from '../lib/backend'
import type { ChannelType, Server, ServerEmoji } from '../lib/types'
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

const MAX_EMOJIS = 50

/** Emojis próprios do servidor (o dono adiciona e apaga). */
export function EmojiManagerModal({ server, onClose }: { server: Server; onClose: () => void }) {
  const { toast, ask } = useApp()
  const [list, setList] = useState<ServerEmoji[]>([])
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const load = () => void backend.listServerEmojis([server.id]).then(setList).catch(() => undefined)
    load()
    return backend.onEmojisChange(load)
  }, [server.id])

  const pick = (f: File | undefined) => {
    if (!f) return
    if (!f.type.startsWith('image/')) return setError(t('Escolha um arquivo de imagem.'))
    setError(null)
    setFile(f)
    setPreview(URL.createObjectURL(f))
    if (!name) setName(f.name.replace(/\.[^.]+$/, '').toLowerCase().normalize('NFD').replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32))
  }

  const clean = name.toLowerCase().replace(/[^a-z0-9_]/g, '')
  const valid = /^[a-z0-9_]{2,32}$/.test(clean)

  const add = async (e: FormEvent) => {
    e.preventDefault()
    if (!file || !valid) return
    setBusy(true)
    setError(null)
    try {
      const em = await backend.addServerEmoji(server.id, clean, file)
      setList((prev) => [...prev.filter((x) => x.id !== em.id), em].sort((a, b) => a.name.localeCompare(b.name)))
      setName('')
      setFile(null)
      setPreview(null)
      toast(t('Emoji :{nome}: adicionado', { nome: clean }))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (em: ServerEmoji) => {
    const ok = await ask({ title: t('Apagar emoji'), message: t('Apagar o emoji :{nome}:? Ele some das mensagens antigas também.', { nome: em.name }), confirmLabel: t('Apagar'), danger: true })
    if (!ok) return
    try {
      await backend.deleteServerEmoji(em.id)
      setList((prev) => prev.filter((x) => x.id !== em.id))
    } catch (err) {
      toast((err as Error).message)
    }
  }

  return (
    <Modal title={t('Emojis do servidor')} subtitle={t('Quem está no servidor pode usar estes emojis em qualquer conversa. Até {n} emojis.', { n: MAX_EMOJIS })} onClose={onClose} wide>
      <form className="emoji-upload" onSubmit={add}>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
        <button type="button" className="emoji-upload-pick" onClick={() => fileRef.current?.click()} aria-label={t('Escolher imagem do emoji')}>
          {preview ? <img src={preview} alt="" /> : <ImagePlus size={26} />}
        </button>
        <label className="flex-1">
          {t('Nome do emoji')}
          <input value={name} maxLength={32} onChange={(e) => setName(e.target.value)} placeholder="ex.: descarga_feliz" />
          <span className="muted small">{t('Só letras sem acento, números e _ (de 2 a 32).')}</span>
        </label>
        <button className="btn btn-primary" disabled={!file || !valid || busy || list.length >= MAX_EMOJIS}>{t('Enviar emoji')}</button>
      </form>
      {error && <p className="error-text small" role="alert">{error}</p>}
      <h3 className="field-label">{t('{n} de {max} emojis', { n: list.length, max: MAX_EMOJIS })}</h3>
      <div className="emoji-admin-list">
        {!list.length && <p className="muted small">{t('Nenhum emoji ainda. Envie uma imagem quadrada (PNG, GIF ou WebP) para começar.')}</p>}
        {list.map((em) => (
          <div key={em.id} className="emoji-admin-row">
            <img src={em.url} alt="" />
            <span className="truncate">:{em.name}:</span>
            <button className="icon-btn tiny danger" aria-label={t('Apagar :{nome}:', { nome: em.name })} onClick={() => void remove(em)}><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    </Modal>
  )
}
