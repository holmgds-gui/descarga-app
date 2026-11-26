import { useSyncExternalStore } from 'react'

/** botão "Voltar": a tela de navegação (NavHistory) avisa se há para onde voltar e registra como voltar */
let can = false
let back: () => void = () => undefined
const subs = new Set<() => void>()
export function setCanBack(v: boolean) {
  if (can === v) return
  can = v
  subs.forEach((f) => f())
}
export const registerBack = (fn: () => void) => { back = fn }
export const goBack = () => back()
export const useCanBack = () =>
  useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => can)
