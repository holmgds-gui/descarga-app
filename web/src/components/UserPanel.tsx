import { useEffect, useRef, useState } from 'react'
import { Check, ChevronUp, Headphones, HeadphoneOff, Mic, MicOff, Settings } from 'lucide-react'
import { voice } from '../lib/voice/engine'
import { useVoice } from '../lib/voice/hooks'
import { backend } from '../lib/backend'
import type { Status } from '../lib/types'
import { useApp } from '../state'
import { Avatar, STATUS_LABEL, StatusDot, displayName } from './Avatar'
import { t } from '../lib/i18n'

type Pop = 'status' | 'mic' | 'out' | null

/** Painel da pessoa (foto, nome, mic, fone, engrenagem): flutua embaixo e atravessa o trilho de servidores e a lista de canais, como no Discord. */
export function UserPanel() {
  const { me, setSettingsOpen, openSettingsTab, upsertProfile, toast, adminPending, openAdminPanel } = useApp()
  const [pop, setPop] = useState<Pop>(null)
  const [custom, setCustom] = useState(me?.custom_status ?? '')
  const [mics, setMics] = useState<MediaDeviceInfo[]>([])
  const ref = useRef<HTMLDivElement>(null)
  const call = useVoice()
  const s = call.settings

  useEffect(() => setCustom(me?.custom_status ?? ''), [me?.custom_status])
  useEffect(() => {
    if (!pop) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setPop(null)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setPop(null)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [pop])

  const toggle = (p: Exclude<Pop, null>) => {
    if (p === 'mic') void navigator.mediaDevices?.enumerateDevices?.().then((l) => setMics(l.filter((d) => d.kind === 'audioinput'))).catch(() => {})
    setPop((cur) => (cur === p ? null : p))
  }
  const setStatus = async (status: Status) => {
    upsertProfile(await backend.updateProfile({ status }))
    setPop(null)
  }
  const saveCustom = async () => {
    upsertProfile(await backend.updateProfile({ custom_status: custom.trim() }))
    toast(t('Status atualizado'))
  }
  const voiceSettings = () => { setPop(null); openSettingsTab('voz') }
  const muted = call.muted || call.deafened

  return (
    <div className="user-panel" ref={ref}>
      <button className="user-panel-me" onClick={() => toggle('status')} aria-expanded={pop === 'status'}>
        <Avatar profile={me} size={34} showStatus />
        <span className="user-panel-text">
          <strong className="truncate">{displayName(me)}</strong>
          <span className="truncate">{me?.custom_status || (me ? STATUS_LABEL[me.status] : '')}</span>
        </span>
      </button>

      <span className={`up-pair ${muted ? 'danger-on' : ''}`}>
        <button className="icon-btn" aria-label={call.muted ? t('Ativar microfone') : t('Silenciar microfone')}
          data-tip={call.muted ? t('Ativar microfone') : t('Silenciar')} onClick={() => voice.toggleMute()}>
          {muted ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        <button className="icon-btn up-chev" aria-label={t('Escolher microfone')} aria-expanded={pop === 'mic'} onClick={() => toggle('mic')}>
          <ChevronUp size={14} />
        </button>
      </span>
      <span className={`up-pair ${call.deafened ? 'danger-on' : ''}`}>
        <button className="icon-btn" aria-label={call.deafened ? t('Ativar áudio') : t('Desativar áudio')}
          data-tip={call.deafened ? t('Ativar áudio') : t('Desativar áudio')} onClick={() => voice.toggleDeafen()}>
          {call.deafened ? <HeadphoneOff size={18} /> : <Headphones size={18} />}
        </button>
        <button className="icon-btn up-chev" aria-label={t('Volume dos sons')} aria-expanded={pop === 'out'} onClick={() => toggle('out')}>
          <ChevronUp size={14} />
        </button>
      </span>

      <span className="gear-wrap">
        <button className="icon-btn" aria-label={adminPending > 0 ? t('Configurações ({n} pedidos para entrar)', { n: adminPending }) : t('Configurações')}
          data-tip={t('Configurações')} onClick={() => (adminPending > 0 ? openAdminPanel() : setSettingsOpen(true))}><Settings size={18} /></button>
        {adminPending > 0 && <span className="badge gear-badge" aria-hidden="true">{adminPending}</span>}
      </span>

      {pop === 'status' && me && (
        <div className="status-menu">
          <div className="status-custom">
            <input value={custom} maxLength={80} placeholder={t('Defina um status personalizado')}
              onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void saveCustom()} />
            <button className="btn btn-primary btn-sm" onClick={() => void saveCustom()}>{t('Salvar')}</button>
          </div>
          {(['online', 'idle', 'dnd', 'invisible'] as Status[]).map((st) => (
            <button key={st} className={`dropdown-item ${me.status === st ? 'selected' : ''}`} onClick={() => void setStatus(st)}>
              <span className="row-gap"><StatusDot status={st} /> {STATUS_LABEL[st]}</span>
            </button>
          ))}
          <div className="dropdown-sep" />
          <button className="dropdown-item" onClick={() => { setPop(null); setSettingsOpen(true) }}>
            {t('Editar perfil')} <Settings size={16} />
          </button>
        </div>
      )}

      {pop === 'mic' && (
        <div className="status-menu up-menu" role="menu">
          <div className="up-menu-title">{t('Microfone')}</div>
          {[{ deviceId: '', label: t('Padrão do sistema') }, ...mics.map((d, i) => ({ deviceId: d.deviceId, label: d.label || t('Microfone {n}', { n: i + 1 }) }))].map((d) => (
            <button key={d.deviceId || 'padrao'} role="menuitemradio" aria-checked={s.inputDeviceId === d.deviceId}
              className={`dropdown-item ${s.inputDeviceId === d.deviceId ? 'selected' : ''}`}
              onClick={() => { voice.updateSettings({ inputDeviceId: d.deviceId }); setPop(null) }}>
              <span className="truncate">{d.label}</span>{s.inputDeviceId === d.deviceId && <Check size={16} />}
            </button>
          ))}
          <div className="dropdown-sep" />
          <button className="dropdown-item" onClick={voiceSettings}>{t('Configurações de voz')} <Settings size={16} /></button>
        </div>
      )}

      {pop === 'out' && (
        <div className="status-menu up-menu">
          <label className="up-menu-title" htmlFor="up-vol">{t('Volume dos sons')} — {Math.round(s.soundVolume * 100)}%</label>
          <input id="up-vol" className="up-slider" type="range" min={0} max={1} step={0.05} value={s.soundVolume}
            onChange={(e) => voice.updateSettings({ soundVolume: Number(e.target.value) })} />
          <div className="dropdown-sep" />
          <button className="dropdown-item" onClick={voiceSettings}>{t('Configurações de voz')} <Settings size={16} /></button>
        </div>
      )}
    </div>
  )
}
