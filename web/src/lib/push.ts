import { backend } from './backend'
import { t } from './i18n'

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on'

export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

const supported = () =>
  backend.pushSupported && !!VAPID && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

/** Registra o "service worker" que recebe as notificações mesmo com o app fechado. */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
  } catch {
    return null
  }
}

export async function getPushState(): Promise<PushState> {
  if (isIOS() && !isStandalone()) return 'needs-install'
  if (!supported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
  const sub = await reg?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

function base64ToBytes(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export async function enablePush() {
  if (!supported()) throw new Error(t('Este navegador não aceita notificações.'))
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error(t('Você não permitiu as notificações. Dá para liberar nas configurações do navegador.'))
  const reg = (await registerServiceWorker()) ?? (await navigator.serviceWorker.ready)
  await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(VAPID!) }))
  await backend.savePushSubscription(sub.toJSON())
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await backend.removePushSubscription(sub.endpoint)
  await sub.unsubscribe()
}

/** Se a pessoa já ativou antes, garante que a inscrição deste aparelho está salva na conta atual. */
export async function refreshPushSubscription() {
  if (!supported() || Notification.permission !== 'granted') return
  const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
  const sub = await reg?.pushManager.getSubscription()
  if (sub) await backend.savePushSubscription(sub.toJSON()).catch(() => undefined)
}
