import { useState, type FormEvent } from 'react'
import { Check, Search } from 'lucide-react'
import { backend } from '../lib/backend'
import type { DmChannel, Profile } from '../lib/types'
import { useApp } from '../state'
import { Avatar, displayName } from './Avatar'
import { Modal } from './Modal'
import { t } from '../lib/i18n'

const MAX_OTHERS = 9

function useFriendProfiles(extra: string[] = []) {
  const { friendships, userId, profiles } = useApp()
  const ids = new Set(extra)
  for (const f of friendships) if (f.status === 'accepted') ids.add(f.requester === userId ? f.addressee : f.requester)
  ids.delete(userId)
  return [...ids].map((id) => profiles[id]).filter((p): p is Profile => !!p)
    .sort((a, b) => displayName(a).localeCompare(displayName(b)))
}

function PeoplePicker({ people, selected, setSelected, locked = [], max }: {
  people: Profile[]
  selected: string[]
  setSelected: (ids: string[]) => void
  locked?: string[]
  max: number
}) {
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()
  const list = people.filter((p) => !query || p.username.includes(query) || p.display_name.toLowerCase().includes(query))
  const toggle = (id: string) => {
    if (locked.includes(id)) return
    if (selected.includes(id)) setSelected(selected.filter((x) => x !== id))
    else if (selected.length < max) setSelected([...selected, id])
  }
  return (
    <>
      <label className="search-field">
        <Search size={16} />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Digite o nome de um amigo')} aria-label={t('Procurar amigos')} />
      </label>
      <p className="muted small">{t('Você pode adicionar mais {n} pessoas.', { n: Math.max(0, max - selected.length) })}</p>
      <div className="people-pick">
        {!list.length && <p className="muted small pad">{people.length ? t('Ninguém com esse nome.') : t('Você ainda não tem amigos para adicionar. Mande um pedido na aba "Adicionar amigo".')}</p>}
        {list.map((p) => {
          const on = selected.includes(p.id) || locked.includes(p.id)
          return (
            <button key={p.id} type="button" className={`person-row ${on ? 'on' : ''}`} onClick={() => toggle(p.id)} aria-pressed={on}
              disabled={locked.includes(p.id) || (!on && selected.length >= max)}>
              <Avatar profile={p} size={32} showStatus />
              <span className="person-text">
                <strong className="truncate">{displayName(p)}</strong>
                <span className="muted small truncate">{p.username}</span>
              </span>
              <span className={`check-box ${on ? 'on' : ''}`}>{on && <Check size={14} />}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}

/** Nova conversa direta ou grupo (até 10 pessoas). */
export function NewDmModal({ onClose, preselect = [] }: { onClose: () => void; preselect?: string[] }) {
  const { openDmWith, toast } = useApp()
  const people = useFriendProfiles(preselect)
  const [selected, setSelected] = useState<string[]>(preselect)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const group = selected.length > 1 || preselect.length > 0

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!selected.length) return
    setBusy(true)
    try {
      await openDmWith(selected, group ? title.trim() : null)
      onClose()
    } catch (err) {
      toast((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={t('Selecionar amigos')} subtitle={t('Converse com uma pessoa ou monte um grupo de até 10.')} onClose={onClose}
      footer={<button className="btn btn-primary" form="new-dm" disabled={!selected.length || busy}>
        {group ? t('Criar grupo') : t('Abrir conversa')}
      </button>}>
      <form id="new-dm" onSubmit={submit} className="stack">
        <PeoplePicker people={people} selected={selected} setSelected={setSelected} max={MAX_OTHERS} />
        {group && (
          <label>
            {t('Nome do grupo (opcional)')}
            <input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder={t('Ex.: Galera do fim de semana')} />
          </label>
        )}
      </form>
    </Modal>
  )
}

export function AddToGroupModal({ dm, onClose }: { dm: DmChannel; onClose: () => void }) {
  const { toast, refreshDms } = useApp()
  const people = useFriendProfiles().filter((p) => !dm.member_ids.includes(p.id))
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const room = 10 - dm.member_ids.length

  const submit = async () => {
    setBusy(true)
    try {
      await backend.addToGroup(dm.id, selected)
      await refreshDms()
      toast(t('Pessoas adicionadas ao grupo'))
      onClose()
    } catch (err) {
      toast((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={t('Adicionar ao grupo')} onClose={onClose}
      footer={<button className="btn btn-primary" disabled={!selected.length || busy} onClick={() => void submit()}>{t('Adicionar')}</button>}>
      <div className="stack">
        {room <= 0 ? <p className="muted">{t('Este grupo já tem 10 pessoas, o máximo.')}</p>
          : <PeoplePicker people={people} selected={selected} setSelected={setSelected} max={room} />}
      </div>
    </Modal>
  )
}

export function RenameGroupModal({ dm, onClose }: { dm: DmChannel; onClose: () => void }) {
  const { toast, refreshDms } = useApp()
  const [title, setTitle] = useState(dm.title ?? '')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await backend.renameGroup(dm.id, title.trim())
      await refreshDms()
      onClose()
    } catch (err) {
      toast((err as Error).message)
    }
  }
  return (
    <Modal title={t('Mudar o nome do grupo')} onClose={onClose}
      footer={<button className="btn btn-primary" form="rename-group">{t('Salvar')}</button>}>
      <form id="rename-group" onSubmit={submit}>
        <label>
          {t('Nome do grupo')}
          <input autoFocus value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder={t('Deixe vazio para usar os nomes')} />
        </label>
      </form>
    </Modal>
  )
}
