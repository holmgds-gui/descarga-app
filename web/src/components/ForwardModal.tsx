import { useEffect, useMemo, useState } from 'react'
import { Check, Hash, Search } from 'lucide-react'
import { backend } from '../lib/backend'
import type { Channel, Message } from '../lib/types'
import { useApp } from '../state'
import { Modal } from './Modal'
import { DmAvatar, dmName } from './dm'
import { t } from '../lib/i18n'

const MAX_TARGETS = 10


/** Encaminhar uma mensagem para várias conversas e canais de uma vez. */
export function ForwardModal({ messages, onClose }: { messages: Message[]; onClose: () => void }) {
  const message = messages[0]
  const { dms, servers, profiles, userId, toast } = useApp()
  const [channels, setChannels] = useState<(Channel & { serverName: string })[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    void Promise.all(
      servers.map((s) => backend.listChannels(s.id).then((list) => list.filter((c) => c.type === 'text').map((c) => ({ ...c, serverName: s.name }))).catch(() => [])),
    ).then((all) => alive && setChannels(all.flat()))
    return () => {
      alive = false
    }
  }, [servers])

  const query = q.trim().toLowerCase()
  const dmItems = useMemo(
    () => [...dms].sort((a, b) => (b.last_message_at ?? '').localeCompare(a.last_message_at ?? ''))
      .map((d) => ({ d, label: dmName(d, profiles, userId) }))
      .filter((x) => !query || x.label.toLowerCase().includes(query)),
    [dms, profiles, userId, query],
  )
  const chItems = channels.filter((c) => !query || c.name.toLowerCase().includes(query) || c.serverName.toLowerCase().includes(query))

  const toggle = (id: string) => {
    if (selected.includes(id)) setSelected(selected.filter((x) => x !== id))
    else if (selected.length < MAX_TARGETS) setSelected([...selected, id])
  }

  const submit = async () => {
    setBusy(true)
    try {
      for (const m of messages) await backend.forwardMessage(m.id, selected) // na ordem em que foram escritas
      toast(messages.length > 1 ? t('{n} mensagens encaminhadas', { n: messages.length }) : selected.length > 1 ? t('Mensagem encaminhada para {n} conversas', { n: selected.length }) : t('Mensagem encaminhada'))
      onClose()
    } catch (err) {
      toast((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const preview = message.content.replace(/[*_~`]/g, '') || (message.attachments.length ? t('Arquivo') : '')
  return (
    <Modal title={messages.length > 1 ? t('Encaminhar {n} mensagens', { n: messages.length }) : t('Encaminhar mensagem')} subtitle={t('Escolha até {n} conversas ou canais.', { n: MAX_TARGETS })} onClose={onClose}
      footer={<button className="btn btn-primary" disabled={!selected.length || busy} onClick={() => void submit()}>
        {selected.length ? t('Encaminhar ({n})', { n: selected.length }) : t('Encaminhar')}
      </button>}>
      <div className="stack">
        <p className="forward-preview truncate">{preview}{messages.length > 1 ? ` (+${messages.length - 1})` : ''}</p>
        <label className="search-field">
          <Search size={16} />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Procurar conversa ou canal')} aria-label={t('Procurar conversa ou canal')} />
        </label>
        <div className="people-pick">
          {!dmItems.length && !chItems.length && <p className="muted small pad">{t('Nada encontrado.')}</p>}
          {dmItems.map(({ d, label }) => {
            const on = selected.includes(d.id)
            return (
              <button key={d.id} type="button" className={`person-row ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggle(d.id)}
                disabled={!on && selected.length >= MAX_TARGETS}>
                <DmAvatar dm={d} profiles={profiles} me={userId} size={32} />
                <span className="person-text">
                  <strong className="truncate">{label}</strong>
                  <span className="muted small truncate">{d.is_group ? t('Grupo') : t('Conversa direta')}</span>
                </span>
                <span className={`check-box ${on ? 'on' : ''}`}>{on && <Check size={14} />}</span>
              </button>
            )
          })}
          {chItems.map((c) => {
            const on = selected.includes(c.id)
            return (
              <button key={c.id} type="button" className={`person-row ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggle(c.id)}
                disabled={!on && selected.length >= MAX_TARGETS}>
                <span className="forward-chan-icon"><Hash size={18} /></span>
                <span className="person-text">
                  <strong className="truncate">{c.name}</strong>
                  <span className="muted small truncate">{c.serverName}</span>
                </span>
                <span className={`check-box ${on ? 'on' : ''}`}>{on && <Check size={14} />}</span>
              </button>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}
