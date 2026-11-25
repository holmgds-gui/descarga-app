import { backend } from './backend'
import { local } from './storage'
import type { Profile } from './types'

/**
 * Atividade ("Jogando X"): o app de PC descobre o jogo aberto e o coloca em window.__descargaJogo.
 * Aqui o site lê isso a cada 20 s e conta ao banco (para os outros verem). Só vale com o app de PC;
 * no navegador e no celular o site não consegue ver o que está aberto no computador.
 */
const KEY = 'descarga-mostrar-atividade'
/** a atividade só vale enquanto o aviso for recente (o app renova de tempos em tempos) */
const FRESH_MS = 6 * 60 * 1000
const RENEW_MS = 4 * 60 * 1000
const POLL_MS = 20 * 1000

export const activityShared = () => local.get(KEY) !== '0'
export const setActivityShared = (on: boolean) => local.set(KEY, on ? '1' : '0')

/** o jogo que a pessoa está jogando agora, ou null */
export function playingNow(p: Pick<Profile, 'activity' | 'activity_at'> | null | undefined): string | null {
  if (!p?.activity || !p.activity_at) return null
  return Date.now() - new Date(p.activity_at).getTime() < FRESH_MS ? p.activity : null
}

/** liga a leitura do jogo aberto; devolve a função que desliga (e limpa a atividade) */
export function startActivityReporter(): () => void {
  let sent: string | null = null
  let sentAt = 0
  const send = (name: string | null) => {
    sent = name
    sentAt = Date.now()
    void backend.setActivity(name ?? '').catch(() => {})
  }
  const tick = () => {
    const game = (window as unknown as { __descargaJogo?: string | null }).__descargaJogo ?? null
    const wanted = game && activityShared() ? game : null
    if (wanted !== sent || (wanted && Date.now() - sentAt > RENEW_MS)) send(wanted)
  }
  tick()
  const id = window.setInterval(tick, POLL_MS)
  return () => {
    window.clearInterval(id)
    if (sent) void backend.setActivity('').catch(() => {})
  }
}
