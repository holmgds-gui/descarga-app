import { local } from './storage'

/** "novo" = design atual (painéis flutuantes); "classico" = o visual anterior, guardado como backup. */
export type Design = 'novo' | 'classico'
const KEY = 'descarga-design'

export function getDesign(): Design {
  return local.get(KEY) === 'classico' ? 'classico' : 'novo'
}

export function applyDesign(d: Design = getDesign()) {
  document.documentElement.dataset.design = d
}

export function setDesign(d: Design) {
  local.set(KEY, d)
  applyDesign(d)
}
