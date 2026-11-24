import { useEffect, useMemo, useRef, useState } from 'react'
import { Phone, PhoneOff } from 'lucide-react'
import { voice } from '../lib/voice/engine'
import { useActiveCalls, useVoice } from '../lib/voice/hooks'
import { startRingback } from '../lib/voice/sounds'
import { useApp } from '../state'
import { Avatar, displayName } from './Avatar'
import { dmName } from './dm'
import { t } from '../lib/i18n'

const RING_MAX_MS = 45_000

/** Alguém começou uma call numa conversa sua: mostra "Atender / Recusar". E, para quem liga, toca o "chamando" até alguém entrar. */
export function IncomingCall() {
  const { dms, userId, profiles, ensureProfiles, setActiveDmId, ignored, me } = useApp()
  const call = useVoice()
  const ids = useMemo(() => dms.map((d) => d.id), [dms])
  const byRoom = useActiveCalls(ids)
  const seenEmpty = useRef(new Set<string>())   // só toca para call que começou depois de eu ver a sala vazia
  const dismissed = useRef(new Set<string>())
  const [ringing, setRinging] = useState<{ dmId: string; who: string; key: string } | null>(null)

  useEffect(() => {
    let next: { dmId: string; who: string; key: string } | null = null
    for (const id of ids) {
      const list = byRoom[id]
      if (!list) continue
      const members = list.filter((m) => m.channelId === id)
      if (!members.length) {
        seenEmpty.current.add(id)
        for (const k of [...dismissed.current]) if (k.startsWith(id + ':')) dismissed.current.delete(k)
        continue
      }
      if (!seenEmpty.current.has(id)) continue
      if (members.some((m) => m.userId === userId) || call.channelId === id) continue
      const other = members.find((m) => !ignored.has(m.userId))
      if (!other) continue
      const key = `${id}:${other.sessionId}`
      if (dismissed.current.has(key) || me?.status === 'dnd') continue
      next = { dmId: id, who: other.userId, key }
      break
    }
    setRinging((cur) => (cur?.key === next?.key ? cur : next))
  }, [byRoom, ids, userId, call.channelId, ignored, me?.status])

  useEffect(() => {
    if (!ringing) return
    ensureProfiles([ringing.who])
    // o toque de quem RECEBE ainda vai chegar (áudio escolhido depois): por enquanto só o aviso na tela
    const timer = window.setTimeout(() => { dismissed.current.add(ringing.key); setRinging(null) }, RING_MAX_MS)
    return () => window.clearTimeout(timer)
  }, [ringing?.key]) // eslint-disable-line react-hooks/exhaustive-deps

  // quem liga: "chamando" enquanto mais ninguém entrou na call da conversa
  const myDm = call.status !== 'idle' && call.channelId && dms.some((d) => d.id === call.channelId) ? call.channelId : null
  const alone = !!myDm && call.members.filter((m) => m.sessionId !== call.sessionId).length === 0
  useEffect(() => {
    if (!myDm || !alone) return
    let stop: (() => void) | null = null
    const start = window.setTimeout(() => { stop = startRingback() }, 700)
    const end = window.setTimeout(() => stop?.(), RING_MAX_MS)
    return () => { window.clearTimeout(start); window.clearTimeout(end); stop?.() }
  }, [myDm, alone])

  if (!ringing) return null
  const dm = dms.find((d) => d.id === ringing.dmId)
  const who = profiles[ringing.who]
  const title = dm?.is_group ? dmName(dm, profiles, userId) : displayName(who)
  const answer = (video: boolean) => {
    dismissed.current.add(ringing.key)
    setRinging(null)
    setActiveDmId(ringing.dmId)
    void voice.join(ringing.dmId, ringing.dmId, userId).then(() => { if (video && voice.getSnapshot().channelId === ringing.dmId) void voice.toggleCamera() })
  }
  return (
    <div className="incoming-call" role="alertdialog" aria-label={t('{nome} está te ligando', { nome: title })}>
      <Avatar profile={who} size={44} />
      <div className="incoming-call-text">
        <strong className="truncate">{title}</strong>
        <span>{dm?.is_group ? t('{nome} está ligando para o grupo', { nome: displayName(who) }) : t('está te ligando…')}</span>
      </div>
      <button className="btn btn-success" onClick={() => answer(false)}><Phone size={16} /> {t('Atender')}</button>
      <button className="btn btn-danger" onClick={() => { dismissed.current.add(ringing.key); setRinging(null) }}><PhoneOff size={16} /> {t('Recusar')}</button>
    </div>
  )
}
