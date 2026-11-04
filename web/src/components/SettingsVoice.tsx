import { useEffect, useRef, useState } from 'react'
import { Bell, BellOff, Droplets, Mic, Share, Waves } from 'lucide-react'
import { backend } from '../lib/backend'
import { disablePush, enablePush, getPushState, isIOS, type PushState } from '../lib/push'
import { voice } from '../lib/voice/engine'
import { useVoice } from '../lib/voice/hooks'
import { SCREEN_PRESETS, keyLabel, type ScreenQuality } from '../lib/voice/settings'
import { playJoin, playLeave } from '../lib/voice/sounds'
import { useApp } from '../state'
import { t } from '../lib/i18n'

export function VoiceSettingsTab() {
  const call = useVoice()
  const s = call.settings
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [testing, setTesting] = useState(false)
  const [level, setLevel] = useState(0)
  const [capturing, setCapturing] = useState(false)
  const [micError, setMicError] = useState(false)
  const testRef = useRef<{ stream: MediaStream; ctx: AudioContext; timer: number } | null>(null)

  const loadDevices = async () => {
    const list = await navigator.mediaDevices?.enumerateDevices?.().catch(() => [])
    setDevices((list ?? []).filter((d) => d.kind === 'audioinput'))
  }
  useEffect(() => {
    void loadDevices()
    return () => stopTest()
  }, [])

  useEffect(() => {
    if (!capturing) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      if (e.code !== 'Escape') voice.updateSettings({ pttKey: e.code })
      setCapturing(false)
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [capturing])

  function stopTest() {
    const t = testRef.current
    if (!t) return
    clearInterval(t.timer)
    t.stream.getTracks().forEach((tr) => tr.stop())
    void t.ctx.close()
    testRef.current = null
    setTesting(false)
    setLevel(0)
  }

  const startTest = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: s.inputDeviceId ? { exact: s.inputDeviceId } : undefined, noiseSuppression: s.noiseSuppression, echoCancellation: true },
      })
      const ctx = new AudioContext()
      const an = ctx.createAnalyser()
      an.fftSize = 512
      ctx.createMediaStreamSource(stream).connect(an)
      const data = new Uint8Array(an.fftSize)
      const timer = window.setInterval(() => {
        an.getByteTimeDomainData(data)
        let sum = 0
        for (const v of data) sum += ((v - 128) / 128) ** 2
        setLevel(Math.min(1, Math.sqrt(sum / data.length) * 6))
      }, 60)
      testRef.current = { stream, ctx, timer }
      setMicError(false)
      setTesting(true)
      void loadDevices() // com a permissão, os nomes dos microfones aparecem
    } catch {
      setMicError(true)
    }
  }

  return (
    <>
      <h2 className="settings-title">{t('Voz e vídeo')}</h2>
      <p className="muted">{t('As calls são direto entre os aparelhos: grátis, até 6 pessoas.')}</p>
      <div className="form">
        <label htmlFor="mic-select">
          {t('Microfone')}
          <select id="mic-select" className="select" value={s.inputDeviceId}
            onChange={(e) => { stopTest(); voice.updateSettings({ inputDeviceId: e.target.value }) }}>
            <option value="">{t('Padrão do sistema')}</option>
            {devices.map((d, i) => (
              <option key={d.deviceId || i} value={d.deviceId}>{d.label || t('Microfone {n}', { n: i + 1 })}</option>
            ))}
          </select>
        </label>

        <div className="field">
          <span className="field-label">{t('Teste de microfone')}</span>
          <div className="mic-test">
            <button type="button" className={`btn btn-sm ${testing ? 'btn-ghost' : 'btn-primary'}`}
              onClick={() => (testing ? stopTest() : void startTest())}>
              <Mic size={16} /> {testing ? t('Parar teste') : t('Testar')}
            </button>
            <div className="meter" aria-label={t('Nível do microfone')}><span style={{ width: `${Math.round(level * 100)}%` }} /></div>
          </div>
          {micError ? (
            <span className="form-error">{t('Não deu para abrir o microfone. Permita o acesso no navegador e tente de novo.')}</span>
          ) : (
            !testing && <span className="muted small hint">{t('Fale algo depois de clicar em Testar: a barra deve se mexer.')}</span>
          )}
        </div>

        <label className="toggle-row">
          <span>
            <strong>{t('Redução de ruído')}</strong>
            <span className="muted small">{t('Tira barulho de fundo como ventilador e teclado')}</span>
          </span>
          <input type="checkbox" className="toggle" checked={s.noiseSuppression}
            onChange={(e) => voice.updateSettings({ noiseSuppression: e.target.checked })} />
        </label>

        <div className="field">
          <span className="field-label">{t('Modo de entrada')}</span>
          <div className="choice-list">
            <button type="button" className={`choice choice-row ${s.inputMode === 'voice' ? 'selected' : ''}`}
              onClick={() => voice.updateSettings({ inputMode: 'voice' })}>
              <Waves size={22} />
              <span><strong>{t('Detecção de voz')}</strong><span>{t('O microfone fica aberto enquanto você não silenciar')}</span></span>
            </button>
            <button type="button" className={`choice choice-row ${s.inputMode === 'ptt' ? 'selected' : ''}`}
              onClick={() => voice.updateSettings({ inputMode: 'ptt' })}>
              <Mic size={22} />
              <span><strong>{t('Apertar para falar')}</strong><span>{t('O microfone só abre enquanto você segura a tecla')}</span></span>
            </button>
          </div>
        </div>

        {s.inputMode === 'ptt' && (
          <div className="field">
            <span className="field-label">{t('Tecla de apertar para falar')}</span>
            <button type="button" className={`btn btn-ghost key-capture ${capturing ? 'capturing' : ''}`} onClick={() => setCapturing(true)}>
              {capturing ? t('Aperte uma tecla… (Esc cancela)') : keyLabel(s.pttKey)}
            </button>
            <span className="muted small hint">{t('No celular, use o botão "Segure para falar" dentro da call.')}</span>
          </div>
        )}

        <label htmlFor="screen-q">
          {t('Qualidade padrão da tela')}
          <select id="screen-q" className="select" value={s.screenQuality}
            onChange={(e) => voice.updateSettings({ screenQuality: e.target.value as ScreenQuality })}>
            {(Object.keys(SCREEN_PRESETS) as ScreenQuality[]).map((q) => (
              <option key={q} value={q}>{SCREEN_PRESETS[q].label}</option>
            ))}
          </select>
          <span className="muted small hint">{t('Quanto mais pessoas assistindo, mais internet você usa ao compartilhar.')}</span>
        </label>

        <label htmlFor="snd-vol">
          {t('Volume dos sons')} — {Math.round(s.soundVolume * 100)}%
          <input id="snd-vol" type="range" min={0} max={1} step={0.05} value={s.soundVolume}
            onChange={(e) => voice.updateSettings({ soundVolume: Number(e.target.value) })} />
        </label>
        <div className="row-gap">
          <button type="button" className="btn btn-ghost btn-sm" onClick={playJoin}><Droplets size={16} /> {t('Ouvir entrada (gotas subindo)')}</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={playLeave}><Waves size={16} /> {t('Ouvir saída (gotas descendo)')}</button>
        </div>
      </div>
    </>
  )
}

export function NotificationsTab() {
  const { toast } = useApp()
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = () => void getPushState().then(setState)
  useEffect(refresh, [])

  const turnOn = async () => {
    setBusy(true)
    try {
      await enablePush()
      toast(t('Notificações ativadas neste aparelho'))
    } catch (err) {
      toast((err as Error).message)
    } finally {
      setBusy(false)
      refresh()
    }
  }
  const turnOff = async () => {
    setBusy(true)
    await disablePush().catch(() => undefined)
    setBusy(false)
    toast(t('Notificações desativadas neste aparelho'))
    refresh()
  }

  return (
    <>
      <h2 className="settings-title">{t('Notificações')}</h2>
      <p className="muted">{t('Você recebe aviso mesmo com o Descarga fechado quando:')}</p>
      <ul className="notif-list">
        <li>{t('alguém te menciona com')} <code>@{t('seunome')}</code></li>
        <li>{t('alguém responde uma mensagem sua')}</li>
        <li>{t('alguém entra numa call de um servidor seu')}</li>
      </ul>

      {!backend.pushSupported ? (
        <div className="account-card">{t('As notificações funcionam na versão online do Descarga.')}</div>
      ) : state === 'needs-install' ? (
        <div className="account-card install-hint">
          <strong>{t('No iPhone, instale o Descarga primeiro')}</strong>
          <p>
            {t('Toque em')} <Share size={14} /> <strong>{t('Compartilhar')}</strong> {t('no Safari, depois em')} <strong>{t('Adicionar à Tela de Início')}</strong>.{' '}
            {t('Abra o Descarga pelo ícone novo e volte aqui para ativar.')}
          </p>
        </div>
      ) : state === 'unsupported' ? (
        <div className="account-card">{t('Este navegador não aceita notificações. Tente o Chrome, Edge ou Firefox.')}</div>
      ) : state === 'denied' ? (
        <div className="account-card">
          {t('As notificações estão bloqueadas para este site. Libere nas configurações do navegador (ícone de cadeado ao lado do endereço) e volte aqui.')}
        </div>
      ) : (
        <div className="notif-actions">
          <span className={`notif-status ${state === 'on' ? 'on' : ''}`}>
            {state === 'on' ? <Bell size={18} /> : <BellOff size={18} />}
            {state === 'on' ? t('Ativadas neste aparelho') : t('Desativadas neste aparelho')}
          </span>
          {state === 'on' ? (
            <button className="btn btn-ghost" disabled={busy} onClick={() => void turnOff()}>{t('Desativar')}</button>
          ) : (
            <button className="btn btn-primary" disabled={busy || state === null} onClick={() => void turnOn()}>
              <Bell size={16} /> {t('Ativar notificações')}
            </button>
          )}
        </div>
      )}
      {isIOS() && state !== 'needs-install' && (
        <p className="muted small">{t('No iPhone, as notificações funcionam com o Descarga aberto pelo ícone da Tela de Início.')}</p>
      )}
    </>
  )
}
