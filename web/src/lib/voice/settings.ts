import { local } from '../storage'
import { t } from '../i18n'

export type InputMode = 'voice' | 'ptt'
export type ScreenQuality = '720p30' | '1080p30'

export interface VoiceSettings {
  inputDeviceId: string
  noiseSuppression: boolean
  inputMode: InputMode
  pttKey: string
  screenQuality: ScreenQuality
  soundVolume: number
  volumes: Record<string, number>
}

const KEY = 'descarga-voz'

export const DEFAULT_VOICE: VoiceSettings = {
  inputDeviceId: '',
  noiseSuppression: true,
  inputMode: 'voice',
  pttKey: 'KeyV',
  screenQuality: '1080p30',
  soundVolume: 0.6,
  volumes: {},
}

export const SCREEN_PRESETS: Record<ScreenQuality, { label: string; height: number; fps: number; bitrate: number }> = {
  '720p30': { label: '720p • 30fps', height: 720, fps: 30, bitrate: 2_500_000 },
  '1080p30': { label: '1080p • 30fps', height: 1080, fps: 30, bitrate: 4_500_000 },
}

export function loadVoiceSettings(): VoiceSettings {
  try {
    const saved = { ...DEFAULT_VOICE, ...JSON.parse(local.get(KEY) ?? '{}') } as VoiceSettings
    // quem tinha escolhido 60fps (opção que saiu) volta para o padrão
    if (!(saved.screenQuality in SCREEN_PRESETS)) saved.screenQuality = DEFAULT_VOICE.screenQuality
    return saved
  } catch {
    return { ...DEFAULT_VOICE }
  }
}

export function saveVoiceSettings(s: VoiceSettings) {
  local.set(KEY, JSON.stringify(s))
}

export function keyLabel(code: string) {
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  const names: Record<string, string> = {
    Space: t('Espaço'), Backquote: '`', ControlLeft: 'Ctrl', ControlRight: t('Ctrl dir.'), AltLeft: 'Alt',
    ShiftLeft: 'Shift', CapsLock: 'Caps Lock', Tab: 'Tab',
  }
  return names[code] ?? code
}
