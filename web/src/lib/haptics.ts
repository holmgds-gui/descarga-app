import { local } from './storage'

const KEY = 'descarga-vibrar'

/** vibração curtinha de confirmação nos gestos do celular (Android; no iPhone o navegador não deixa) */
export function haptic(ms = 8) {
  if (local.get(KEY) === '0') return
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* sem suporte: tudo bem */
  }
}
export const hapticsOn = () => local.get(KEY) !== '0'
export const setHaptics = (on: boolean) => local.set(KEY, on ? '1' : '0')
