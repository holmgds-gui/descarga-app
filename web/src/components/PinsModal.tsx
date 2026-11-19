import { useEffect, useState } from 'react'
import { PinOff } from 'lucide-react'
import { backend } from '../lib/backend'
import type { Message, Pin } from '../lib/types'
import { useApp } from '../state'
import { formatTimestamp } from '../lib/format'
import { Avatar, displayName } from './Avatar'
import { Modal } from './Modal'
import { t } from '../lib/i18n'

/** Mensagens fixadas da conversa ou do canal. */
export function PinsModal({ pins, loaded, canPin, onJump, onUnpin, onClose }: {
  pins: Pin[]
  loaded: Message[]
  canPin: boolean
  onJump: (messageId: string) => void
  onUnpin: (messageId: string) => void
  onClose: () => void
}) {
  const { profiles, ensureProfiles } = useApp()
  const [extra, setExtra] = useState<Message[]>([])

  // mensagens fixadas que ainda não foram carregadas na tela (as antigas)
  useEffect(() => {
    const have = new Set(loaded.map((m) => m.id))
    const missing = pins.map((p) => p.message_id).filter((id) => !have.has(id))
    if (!missing.length) return setExtra([])
    let alive = true
    void backend.getMessages(missing).then((list) => alive && setExtra(list)).catch(() => undefined)
    return () => {
      alive = false
    }
  }, [pins, loaded])

  const byId = new Map([...extra, ...loaded].map((m) => [m.id, m]))
  useEffect(() => {
    ensureProfiles([...byId.values()].map((m) => m.author_id))
  }, [extra, loaded]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal title={t('Mensagens fixadas')} onClose={onClose}>
      <div className="pins-list">
        {!pins.length && <p className="muted">{t('Nenhuma mensagem fixada ainda. Clique com o botão direito numa mensagem para fixar.')}</p>}
        {pins.map((p) => {
          const m = byId.get(p.message_id)
          const author = m ? profiles[m.author_id] : undefined
          return (
            <div key={p.message_id} className="pin-card">
              <button className="pin-main" onClick={() => { onJump(p.message_id); onClose() }}>
                {m ? (
                  <>
                    <span className="pin-head"><Avatar profile={author} size={22} /><strong>{displayName(author)}</strong><time>{formatTimestamp(m.created_at)}</time></span>
                    <span className="pin-text">{m.content.replace(/[*_~`]/g, '') || (m.attachments.length ? t('Arquivo') : '')}</span>
                  </>
                ) : <span className="muted">{t('Carregando…')}</span>}
              </button>
              {canPin && (
                <button className="icon-btn tiny" aria-label={t('Desafixar')} data-tip={t('Desafixar')} onClick={() => onUnpin(p.message_id)}><PinOff size={16} /></button>
              )}
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
