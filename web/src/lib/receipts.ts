import { useCallback, useEffect, useState } from 'react'
import { backend } from './backend'
import type { ReceiptOff } from './types'

const EMPTY: ReceiptOff = { mine: [], theirs: [] }

/** Quem desligou a confirmação de leitura: eu para alguém (mine) ou alguém para mim (theirs). Vale nos dois sentidos. */
export function useReceiptOff() {
  const [off, setOff] = useState<ReceiptOff>(EMPTY)
  useEffect(() => {
    let alive = true
    const load = () => void backend.listReceiptOff().then((r) => alive && setOff(r)).catch(() => undefined)
    load()
    const un = backend.onReceiptOffChange(load)
    return () => {
      alive = false
      un()
    }
  }, [])
  const set = useCallback(async (peerId: string, value: boolean) => {
    setOff((o) => ({ ...o, mine: value ? [...new Set([...o.mine, peerId])] : o.mine.filter((x) => x !== peerId) }))
    await backend.setReceiptOff(peerId, value)
  }, [])
  /** a confirmação entre mim e essa pessoa está valendo? */
  const active = useCallback((peerId: string) => !off.mine.includes(peerId) && !off.theirs.includes(peerId), [off])
  return { off, set, active }
}
