import { useEffect, useRef, useState } from 'react'
import { ImagePlus, LogOut, Plus, Trash2, X } from 'lucide-react'
import { backend } from '../lib/backend'
import type { Profile, ProfileLink } from '../lib/types'
import { useApp } from '../state'
import { THEMES, customTheme, type ThemeDef } from '../lib/themes'
import { ProfileCardBody } from './ProfileCard'
import { NotificationsTab, VoiceSettingsTab } from './SettingsVoice'
import { LANGS, setLang, t as tr, useLang, type Lang } from '../lib/i18n'

const BG_SWATCHES = ['#26303A', '#1F2937', '#0F3D3E', '#3B2A1E', '#3A1F2B', '#2E2A3B', '#1E3A5F', '#F5F0E8', '#E8F1EC', '#EAF0F8']
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
          <h4>{tr('Configurações de usuário')}</h4>
          <button className={tab === 'perfil' ? 'active' : ''} onClick={() => setTab('perfil')}>{tr('Meu perfil')}</button>
          <button className={tab === 'aparencia' ? 'active' : ''} onClick={() => setTab('aparencia')}>{tr('Aparência e idioma')}</button>
          <button className={tab === 'voz' ? 'active' : ''} onClick={() => setTab('voz')}>{tr('Voz e vídeo')}</button>
          <button className={tab === 'notificacoes' ? 'active' : ''} onClick={() => setTab('notificacoes')}>{tr('Notificações')}</button>
          <button className={tab === 'conta' ? 'active' : ''} onClick={() => setTab('conta')}>{tr('Conta')}</button>
          <div className="dropdown-sep" />
          <button className="danger" onClick={() => void backend.signOut()}>{tr('Sair')} <LogOut size={16} /></button>
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
        <button className="settings-close" onClick={close} aria-label={tr('Fechar configurações')}>
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
      setError(tr('O nome de usuário pode ter letras minúsculas, números, ponto e _ (2 a 32).'))
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
      toast(tr('Perfil salvo'))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <h2 className="settings-title">{tr('Meu perfil')}</h2>
      <p className="muted">{tr('Tudo aqui é grátis. Mostre o que quiser — o que ficar em branco não aparece.')}</p>
      <div className="profile-editor">
        <div className="form">
          <label>
            {tr('Nome de exibição')}
            <input value={draft.display_name} maxLength={32} onChange={(e) => set('display_name', e.target.value)} placeholder={draft.username} />
          </label>
          <label>
            {tr('Nome de usuário')}
            <input value={draft.username} maxLength={32} onChange={(e) => set('username', e.target.value.toLowerCase())} />
          </label>
          <label>
            {tr('Pronomes')}
            <input value={draft.pronouns} maxLength={40} onChange={(e) => set('pronouns', e.target.value)} placeholder={tr('ele/dele')} />
          </label>

          <div className="field">
            <span className="field-label">{tr('Foto de perfil')}</span>
            <div className="row-gap">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => avatarRef.current?.click()}><ImagePlus size={16} /> {tr('Trocar foto')}</button>
              {draft.avatar_url && <button type="button" className="btn btn-ghost btn-sm" onClick={() => set('avatar_url', null)}>{tr('Remover')}</button>}
            </div>
            <input ref={avatarRef} type="file" accept="image/*" hidden onChange={(e) => void upload(e.target.files?.[0], 'avatar')} />
          </div>

          <div className="field">
            <span className="field-label">{tr('Banner (imagem ou GIF animado)')}</span>
            <div className="row-gap">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => bannerRef.current?.click()}><ImagePlus size={16} /> {tr('Trocar banner')}</button>
              {draft.banner_url && <button type="button" className="btn btn-ghost btn-sm" onClick={() => set('banner_url', null)}>{tr('Remover')}</button>}
            </div>
            <input ref={bannerRef} type="file" accept="image/*" hidden onChange={(e) => void upload(e.target.files?.[0], 'banner')} />
          </div>

          <div className="field">
            <span className="field-label">{tr('Cor do perfil')}</span>
            <div className="swatches">
              {SWATCHES.map((c) => (
                <button key={c} type="button" className={`swatch ${draft.accent_color.toLowerCase() === c.toLowerCase() ? 'on' : ''}`}
                  style={{ background: c }} aria-label={tr('Cor {c}', { c })} onClick={() => set('accent_color', c)} />
              ))}
              <label className="swatch swatch-custom" aria-label={tr('Escolher outra cor')} data-tip={tr('Outra cor')}>
                <input type="color" value={draft.accent_color} onChange={(e) => set('accent_color', e.target.value.toUpperCase())} />
                <Plus size={16} />
              </label>
            </div>
          </div>

          <label>
            {tr('Status personalizado')}
            <input value={draft.custom_status} maxLength={80} onChange={(e) => set('custom_status', e.target.value)} placeholder={tr('Jogando, estudando, dormindo…')} />
          </label>

          <label>
            {tr('Sobre mim')} <span className="counter">{draft.bio.length}/300</span>
            <textarea rows={4} value={draft.bio} maxLength={300} onChange={(e) => set('bio', e.target.value)} placeholder={tr('Conte um pouco sobre você')} />
          </label>

          <div className="two-col">
            <label>
              {tr('Aniversário')}
              <input type="date" value={draft.birthday ?? ''} onChange={(e) => set('birthday', e.target.value || null)} />
            </label>
            <label>
              {tr('Cidade')}
              <input value={draft.city} maxLength={60} onChange={(e) => set('city', e.target.value)} placeholder={tr('Curitiba, PR')} />
            </label>
          </div>

          <div className="field">
            <span className="field-label">{tr('Links e redes sociais')}</span>
            {draft.links.map((l, i) => (
              <div key={i} className="link-row">
                <input value={l.label} placeholder="Instagram" maxLength={30} onChange={(e) => setLink(i, { label: e.target.value })} />
                <input value={l.url} placeholder={tr('instagram.com/voce')} onChange={(e) => setLink(i, { url: e.target.value })} />
                <button type="button" className="icon-btn danger" aria-label={tr('Remover link')} onClick={() => set('links', draft.links.filter((_, j) => j !== i))}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {draft.links.length < 5 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => set('links', [...draft.links, { label: '', url: '' }])}>
                <Plus size={16} /> {tr('Adicionar link')}
              </button>
            )}
          </div>
          {error && <p className="form-error">{error}</p>}
        </div>

        <div className="profile-preview">
          <span className="field-label">{tr('Prévia')}</span>
          <ProfileCardBody profile={draft} />
        </div>
      </div>

      {dirty && (
        <div className="unsaved-bar">
          <span>{tr('Cuidado — você tem alterações não salvas!')}</span>
          <div className="row-gap">
            <button className="btn btn-ghost btn-sm" onClick={() => setDraft(me)}>{tr('Redefinir')}</button>
            <button className="btn btn-success btn-sm" onClick={() => void save()} disabled={saving}>
              {saving ? tr('Salvando…') : tr('Salvar alterações')}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function AppearanceEditor() {
  const { appearance, setAppearance } = useApp()
  const lang = useLang()
  const custom = customTheme(appearance.customBg)
  const preview = (t: ThemeDef, on: boolean, onClick: () => void, key: string) => (
    <button key={key} className={`theme-option ${on ? 'on' : ''}`} onClick={onClick} aria-pressed={on}>
      <span className="theme-mini" style={{ background: t.colors.chat }}>
        <span className="tm-rail" style={{ background: t.colors.rail }} />
        <span className="tm-side" style={{ background: t.colors.side }} />
        <span className="tm-chat">
          <span style={{ background: t.colors.text ?? (t.tone === 'light' ? '#1F2023' : '#F2F3F5') }} />
          <span style={{ background: t.colors.text3 ?? '#80848E' }} />
          <span className="tm-accent" style={{ background: appearance.accent }} />
        </span>
      </span>
      <span className="theme-name">{tr(t.label)}</span>
    </button>
  )
  return (
    <>
      <h2 className="settings-title">{tr('Aparência e idioma')}</h2>
      <div className="form">
        <label htmlFor="lang-select">
          {tr('Idioma')}
          <select id="lang-select" className="select" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
            {LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </label>
      </div>
      <div className="form">
        <div className="field">
          <span className="field-label">{tr('Fundo — escuros')}</span>
          <div className="theme-picker">
            {THEMES.filter((t) => t.tone === 'dark').map((t) =>
              preview(t, appearance.theme === t.id, () => setAppearance({ theme: t.id }), t.id))}
          </div>
        </div>
        <div className="field">
          <span className="field-label">{tr('Fundo — claros')}</span>
          <div className="theme-picker">
            {THEMES.filter((t) => t.tone === 'light').map((t) =>
              preview(t, appearance.theme === t.id, () => setAppearance({ theme: t.id }), t.id))}
          </div>
        </div>
        <div className="field">
          <span className="field-label">{tr('Fundo personalizado')}</span>
          <div className="custom-bg">
            {preview(custom, appearance.theme === 'custom', () => setAppearance({ theme: 'custom' }), 'custom')}
            <div className="custom-bg-controls">
              <label className="color-pick">
                <input type="color" value={appearance.customBg} aria-label={tr('Escolher a cor do fundo')}
                  onChange={(e) => setAppearance({ theme: 'custom', customBg: e.target.value.toUpperCase() })} />
                <span>{tr('Escolher cor do fundo')}</span>
              </label>
              <div className="swatches small">
                {BG_SWATCHES.map((c) => (
                  <button key={c} className={`swatch ${appearance.theme === 'custom' && appearance.customBg.toLowerCase() === c.toLowerCase() ? 'on' : ''}`}
                    style={{ background: c }} aria-label={tr('Fundo {c}', { c })} onClick={() => setAppearance({ theme: 'custom', customBg: c })} />
                ))}
              </div>
              <span className="muted small hint">{tr('O app monta os tons claros e escuros a partir da cor escolhida.')}</span>
            </div>
          </div>
        </div>

        <div className="field">
          <span className="field-label">{tr('Cor de destaque')}</span>
          <span className="muted small hint">{tr('Muda botões, links, seleções e detalhes. Não muda o fundo.')}</span>
          <div className="swatches">
            {SWATCHES.map((c) => (
              <button key={c} className={`swatch ${appearance.accent.toLowerCase() === c.toLowerCase() ? 'on' : ''}`} style={{ background: c }}
                aria-label={tr('Cor {c}', { c })} onClick={() => setAppearance({ accent: c })} />
            ))}
            <label className="swatch swatch-custom" aria-label={tr('Escolher outra cor')}>
              <input type="color" value={appearance.accent} onChange={(e) => setAppearance({ accent: e.target.value })} />
              <Plus size={16} />
            </label>
          </div>
        </div>

        <label>
          {tr('Tamanho do texto')} — {Math.round(appearance.fontScale * 100)}%
          <input type="range" min={0.85} max={1.3} step={0.05} value={appearance.fontScale}
            onChange={(e) => setAppearance({ fontScale: Number(e.target.value) })} />
        </label>

        <label className="toggle-row">
          <span>
            <strong>{tr('Modo compacto')}</strong>
            <span className="muted small">{tr('Mostra mais mensagens na tela')}</span>
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
      <h2 className="settings-title">{tr('Conta')}</h2>
      <div className="account-card">
        <p><strong>{tr('Usuário:')}</strong> {me?.username}</p>
        <p><strong>{tr('Servidor:')}</strong> {backend.mode === 'demo' ? tr('Modo demonstração (dados só neste navegador)') : tr('Supabase (na nuvem)')}</p>
      </div>
      <PrivacySettings />
      <button className="btn btn-danger" onClick={() => void backend.signOut()}><LogOut size={16} /> {tr('Sair da conta')}</button>
    </>
  )
}

function PrivacySettings() {
  const { me, upsertProfile, toast } = useApp()
  const [busy, setBusy] = useState(false)
  if (!me) return null
  const toggle = async (v: boolean) => {
    setBusy(true)
    try {
      upsertProfile(await backend.updateProfile({ read_receipts: v }))
    } catch (err) {
      toast((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="settings-form privacy-box">
      <h3 className="field-label">{tr('Privacidade')}</h3>
      <label className="toggle-row">
        <span>
          <strong>{tr('Confirmação de leitura')}</strong>
          <span className="muted small">{tr('Mostra "Visto" nas conversas diretas. Se desligar, ninguém vê quando você leu, e você também não vê dos outros.')}</span>
        </span>
        <input type="checkbox" className="toggle" disabled={busy} checked={me.read_receipts !== false} onChange={(e) => void toggle(e.target.checked)} />
      </label>
    </div>
  )
}
