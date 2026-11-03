import { useEffect, useRef, useState } from 'react'
import { ImagePlus, LogOut, Plus, Trash2, X } from 'lucide-react'
import { backend } from '../lib/backend'
import type { Profile, ProfileLink } from '../lib/types'
import { useApp, type ThemeName } from '../state'
import { ProfileCardBody } from './ProfileCard'
import { NotificationsTab, VoiceSettingsTab } from './SettingsVoice'

const SWATCHES = ['#7B3FE4', '#5226A8', '#B04FD9', '#E0457B', '#F0643C', '#F5A524', '#2DBE7A', '#1FB5E0', '#3D7BF0', '#6B7280']

type Tab = 'perfil' | 'aparencia' | 'voz' | 'notificacoes' | 'conta'

export function SettingsModal() {
  const { settingsOpen, setSettingsOpen } = useApp()
  const [tab, setTab] = useState<Tab>('perfil')
  const close = () => setSettingsOpen(false)

  useEffect(() => {
    if (!settingsOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!settingsOpen) return null

  return (
    <div className="settings">
      <nav className="settings-nav">
        <div className="settings-nav-inner">
          <h4>Configurações de usuário</h4>
          <button className={tab === 'perfil' ? 'active' : ''} onClick={() => setTab('perfil')}>Meu perfil</button>
          <button className={tab === 'aparencia' ? 'active' : ''} onClick={() => setTab('aparencia')}>Aparência</button>
          <button className={tab === 'voz' ? 'active' : ''} onClick={() => setTab('voz')}>Voz e vídeo</button>
          <button className={tab === 'notificacoes' ? 'active' : ''} onClick={() => setTab('notificacoes')}>Notificações</button>
          <button className={tab === 'conta' ? 'active' : ''} onClick={() => setTab('conta')}>Conta</button>
          <div className="dropdown-sep" />
          <button className="danger" onClick={() => void backend.signOut()}>Sair <LogOut size={16} /></button>
        </div>
      </nav>
      <main className="settings-content">
        <div className="settings-content-inner">
          {tab === 'perfil' && <ProfileEditor />}
          {tab === 'aparencia' && <AppearanceEditor />}
          {tab === 'voz' && <VoiceSettingsTab />}
          {tab === 'notificacoes' && <NotificationsTab />}
          {tab === 'conta' && <AccountTab />}
        </div>
        <button className="settings-close" onClick={close} aria-label="Fechar configurações">
          <X size={20} />
          <span>ESC</span>
        </button>
      </main>
    </div>
  )
}

function ProfileEditor() {
  const { me, upsertProfile, toast } = useApp()
  const [draft, setDraft] = useState<Profile | null>(me)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const avatarRef = useRef<HTMLInputElement>(null)
  const bannerRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (me && !draft) setDraft(me)
  }, [me, draft])

  if (!me || !draft) return null
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setDraft({ ...draft, [k]: v })
  const dirty = JSON.stringify(draft) !== JSON.stringify(me)

  const upload = async (f: File | undefined, kind: 'avatar' | 'banner') => {
    if (!f) return
    try {
      const url = await backend.uploadImage(f, kind)
      set(kind === 'avatar' ? 'avatar_url' : 'banner_url', url)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const setLink = (i: number, patch: Partial<ProfileLink>) =>
    set('links', draft.links.map((l, j) => (j === i ? { ...l, ...patch } : l)))

  const save = async () => {
    setError(null)
    if (!/^[a-z0-9_.]{2,32}$/.test(draft.username)) {
      setError('O nome de usuário pode ter letras minúsculas, números, ponto e _ (2 a 32).')
      return
    }
    const links = draft.links
      .filter((l) => l.url.trim())
      .map((l) => ({ label: l.label.trim(), url: /^https?:\/\//.test(l.url.trim()) ? l.url.trim() : `https://${l.url.trim()}` }))
    setSaving(true)
    try {
      const saved = await backend.updateProfile({
        display_name: draft.display_name.trim(),
        username: draft.username,
        avatar_url: draft.avatar_url,
        banner_url: draft.banner_url,
        accent_color: draft.accent_color,
        bio: draft.bio,
        pronouns: draft.pronouns.trim(),
        birthday: draft.birthday || null,
        city: draft.city.trim(),
        links,
        custom_status: draft.custom_status.trim(),
      })
      upsertProfile(saved)
      setDraft(saved)
      toast('Perfil salvo')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <h2 className="settings-title">Meu perfil</h2>
      <p className="muted">Tudo aqui é grátis. Mostre o que quiser — o que ficar em branco não aparece.</p>
      <div className="profile-editor">
        <div className="form">
          <label>
            Nome de exibição
            <input value={draft.display_name} maxLength={32} onChange={(e) => set('display_name', e.target.value)} placeholder={draft.username} />
          </label>
          <label>
            Nome de usuário
            <input value={draft.username} maxLength={32} onChange={(e) => set('username', e.target.value.toLowerCase())} />
          </label>
          <label>
            Pronomes
            <input value={draft.pronouns} maxLength={40} onChange={(e) => set('pronouns', e.target.value)} placeholder="ele/dele" />
          </label>

          <div className="field">
            <span className="field-label">Foto de perfil</span>
            <div className="row-gap">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => avatarRef.current?.click()}><ImagePlus size={16} /> Trocar foto</button>
              {draft.avatar_url && <button type="button" className="btn btn-ghost btn-sm" onClick={() => set('avatar_url', null)}>Remover</button>}
            </div>
            <input ref={avatarRef} type="file" accept="image/*" hidden onChange={(e) => void upload(e.target.files?.[0], 'avatar')} />
          </div>

          <div className="field">
            <span className="field-label">Banner (imagem ou GIF animado)</span>
            <div className="row-gap">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => bannerRef.current?.click()}><ImagePlus size={16} /> Trocar banner</button>
              {draft.banner_url && <button type="button" className="btn btn-ghost btn-sm" onClick={() => set('banner_url', null)}>Remover</button>}
            </div>
            <input ref={bannerRef} type="file" accept="image/*" hidden onChange={(e) => void upload(e.target.files?.[0], 'banner')} />
          </div>

          <div className="field">
            <span className="field-label">Cor do perfil</span>
            <div className="swatches">
              {SWATCHES.map((c) => (
                <button key={c} type="button" className={`swatch ${draft.accent_color.toLowerCase() === c.toLowerCase() ? 'on' : ''}`}
                  style={{ background: c }} aria-label={`Cor ${c}`} onClick={() => set('accent_color', c)} />
              ))}
              <label className="swatch swatch-custom" aria-label="Escolher outra cor" data-tip="Outra cor">
                <input type="color" value={draft.accent_color} onChange={(e) => set('accent_color', e.target.value.toUpperCase())} />
                <Plus size={16} />
              </label>
            </div>
          </div>

          <label>
            Status personalizado
            <input value={draft.custom_status} maxLength={80} onChange={(e) => set('custom_status', e.target.value)} placeholder="Jogando, estudando, dormindo…" />
          </label>

          <label>
            Sobre mim <span className="counter">{draft.bio.length}/300</span>
            <textarea rows={4} value={draft.bio} maxLength={300} onChange={(e) => set('bio', e.target.value)} placeholder="Conte um pouco sobre você" />
          </label>

          <div className="two-col">
            <label>
              Aniversário
              <input type="date" value={draft.birthday ?? ''} onChange={(e) => set('birthday', e.target.value || null)} />
            </label>
            <label>
              Cidade
              <input value={draft.city} maxLength={60} onChange={(e) => set('city', e.target.value)} placeholder="Curitiba, PR" />
            </label>
          </div>

          <div className="field">
            <span className="field-label">Links e redes sociais</span>
            {draft.links.map((l, i) => (
              <div key={i} className="link-row">
                <input value={l.label} placeholder="Instagram" maxLength={30} onChange={(e) => setLink(i, { label: e.target.value })} />
                <input value={l.url} placeholder="instagram.com/voce" onChange={(e) => setLink(i, { url: e.target.value })} />
                <button type="button" className="icon-btn danger" aria-label="Remover link" onClick={() => set('links', draft.links.filter((_, j) => j !== i))}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {draft.links.length < 5 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => set('links', [...draft.links, { label: '', url: '' }])}>
                <Plus size={16} /> Adicionar link
              </button>
            )}
          </div>
          {error && <p className="form-error">{error}</p>}
        </div>

        <div className="profile-preview">
          <span className="field-label">Prévia</span>
          <ProfileCardBody profile={draft} />
        </div>
      </div>

      {dirty && (
        <div className="unsaved-bar">
          <span>Cuidado — você tem alterações não salvas!</span>
          <div className="row-gap">
            <button className="btn btn-ghost btn-sm" onClick={() => setDraft(me)}>Redefinir</button>
            <button className="btn btn-success btn-sm" onClick={() => void save()} disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function AppearanceEditor() {
  const { appearance, setAppearance } = useApp()
  const themes: { id: ThemeName; label: string; bg: string; fg: string }[] = [
    { id: 'dark', label: 'Escuro', bg: '#211D2B', fg: '#2C2738' },
    { id: 'light', label: 'Claro', bg: '#FFFFFF', fg: '#EEEAF5' },
    { id: 'midnight', label: 'Meia-noite', bg: '#000000', fg: '#121016' },
  ]
  return (
    <>
      <h2 className="settings-title">Aparência</h2>
      <div className="form">
        <div className="field">
          <span className="field-label">Tema</span>
          <div className="theme-picker">
            {themes.map((t) => (
              <button key={t.id} className={`theme-option ${appearance.theme === t.id ? 'on' : ''}`} onClick={() => setAppearance({ theme: t.id })}>
                <span className="theme-swatch" style={{ background: t.bg }}>
                  <span style={{ background: t.fg }} />
                  <span style={{ background: appearance.accent }} />
                </span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field-label">Cor do app</span>
          <div className="swatches">
            {SWATCHES.map((c) => (
              <button key={c} className={`swatch ${appearance.accent.toLowerCase() === c.toLowerCase() ? 'on' : ''}`} style={{ background: c }}
                aria-label={`Cor ${c}`} onClick={() => setAppearance({ accent: c })} />
            ))}
            <label className="swatch swatch-custom" aria-label="Escolher outra cor">
              <input type="color" value={appearance.accent} onChange={(e) => setAppearance({ accent: e.target.value })} />
              <Plus size={16} />
            </label>
          </div>
        </div>

        <label>
          Tamanho do texto — {Math.round(appearance.fontScale * 100)}%
          <input type="range" min={0.85} max={1.3} step={0.05} value={appearance.fontScale}
            onChange={(e) => setAppearance({ fontScale: Number(e.target.value) })} />
        </label>

        <label className="toggle-row">
          <span>
            <strong>Modo compacto</strong>
            <span className="muted small">Mostra mais mensagens na tela</span>
          </span>
          <input type="checkbox" className="toggle" checked={appearance.compact} onChange={(e) => setAppearance({ compact: e.target.checked })} />
        </label>
      </div>
    </>
  )
}

function AccountTab() {
  const { me } = useApp()
  return (
    <>
      <h2 className="settings-title">Conta</h2>
      <div className="account-card">
        <p><strong>Usuário:</strong> {me?.username}</p>
        <p><strong>Servidor:</strong> {backend.mode === 'demo' ? 'Modo demonstração (dados só neste navegador)' : 'Supabase (na nuvem)'}</p>
      </div>
      <button className="btn btn-danger" onClick={() => void backend.signOut()}><LogOut size={16} /> Sair da conta</button>
    </>
  )
}
