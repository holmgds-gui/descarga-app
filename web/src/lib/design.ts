import { local } from './storage'
import type { PlusLevel } from './perks'

/**
 * "novo" = design atual (painéis flutuantes); "classico" = o visual clássico, parecido com aquele outro app de conversa.
 * Os outros são extras do Plus: Super Plus (nível 2) libera uns, o Ultra Mega Plus (nível 3) libera todos.
 */
export type Design = 'novo' | 'classico' | 'futurista' | 'rustico' | 'papel' | 'vidro' | 'retro' | 'pixel' | 'terminal'

export interface DesignDef {
  id: Design
  label: string
  desc: string
  /** nível do Plus que libera (0 = todo mundo) */
  level: PlusLevel
  /** cores da miniatura: fundo, barra lateral, destaque */
  swatch: [string, string, string]
}

export const DESIGNS: DesignDef[] = [
  { id: 'novo', label: 'Design novo', desc: 'Painéis flutuantes, animações e barra de abas no celular.', level: 0, swatch: ['#1A1626', '#15121F', '#7B3FE4'] },
  { id: 'classico', label: 'Design clássico', desc: 'O visual clássico, bem parecido com aquele outro app de conversa.', level: 0, swatch: ['#313338', '#2B2D31', '#5865F2'] },
  { id: 'futurista', label: 'Futurista', desc: 'Neon ciano e magenta, cantos cortados e fonte tecnológica.', level: 2, swatch: ['#0D1226', '#0A0E1C', '#00E5FF'] },
  { id: 'rustico', label: 'Rústico', desc: 'Madeira, couro e papel envelhecido, com letras de livro antigo.', level: 2, swatch: ['#463120', '#3A2818', '#C8642B'] },
  { id: 'papel', label: 'Minimalista (papel)', desc: 'Claro, limpo e silencioso, com bastante espaço em branco.', level: 2, swatch: ['#FDFCF8', '#F6F3EC', '#2A2823'] },
  { id: 'vidro', label: 'Vidro', desc: 'Painéis transparentes com desfoque sobre um fundo colorido.', level: 2, swatch: ['#3B2A66', '#2A2050', '#8E6BFF'] },
  { id: 'retro', label: 'Retrô anos 90', desc: 'Janelas cinzas com relevo e barras azuis, como computadores antigos.', level: 3, swatch: ['#C0C0C0', '#008080', '#000080'] },
  { id: 'pixel', label: 'Pixel 8-bit', desc: 'Letras e bordas de videogame antigo, cores vivas.', level: 3, swatch: ['#1A1033', '#21144A', '#FF4F9A'] },
  { id: 'terminal', label: 'Terminal', desc: 'Verde sobre preto, tudo em letra de máquina, estilo hacker.', level: 3, swatch: ['#000000', '#050805', '#33FF66'] },
]

const KEY = 'descarga-design'
const IDS = new Set<string>(DESIGNS.map((d) => d.id))

export const designLevel = (d: Design): PlusLevel => DESIGNS.find((x) => x.id === d)?.level ?? 0

export function getDesign(): Design {
  const v = local.get(KEY)
  return v && IDS.has(v) ? (v as Design) : 'novo'
}

export function applyDesign(d: Design = getDesign()) {
  document.documentElement.dataset.design = d
}

export function setDesign(d: Design) {
  local.set(KEY, d)
  applyDesign(d)
}
