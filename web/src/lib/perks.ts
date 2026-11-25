import type { Profile } from './types'

/**
 * Base do "Plus" do Descarga: o visual extra do perfil (como os OUTROS veem a pessoa, fora dos servidores).
 * Três níveis: 1 = Plus · 2 = Super Plus · 3 = Ultra Mega Plus.
 * Por enquanto não há pagamento: o administrador libera o nível de cada conta (Configurações > Administração).
 * Os itens abaixo são só o catálogo (rascunho dos níveis); as telas para escolher e desenhar cada item vêm depois.
 */

export type PlusLevel = 0 | 1 | 2 | 3

export const PLUS_NAMES: Record<PlusLevel, string> = { 0: '', 1: 'Plus', 2: 'Super Plus', 3: 'Ultra Mega Plus' }
export const PLUS_LEVELS: PlusLevel[] = [1, 2, 3]

export interface PerkItem {
  /** guardado no banco (só letras minúsculas, números, - e _) */
  id: string
  label: string
  /** nível mínimo para usar (1 Plus, 2 Super Plus, 3 Ultra Mega Plus) */
  level: PlusLevel
}

/** cores sugeridas para o nome. Qualquer cor #RRGGBB livre fica para o nível 3 ({@link CUSTOM_COLOR_LEVEL}). */
export const NAME_COLORS: (PerkItem & { hex: string })[] = [
  { id: 'uva', label: 'Uva', hex: '#A97BFF', level: 1 },
  { id: 'agua', label: 'Água', hex: '#4FC3F7', level: 1 },
  { id: 'limao', label: 'Limão', hex: '#9CCC3C', level: 1 },
  { id: 'sol', label: 'Sol', hex: '#FFC93C', level: 1 },
  { id: 'brasa', label: 'Brasa', hex: '#FF7043', level: 1 },
  { id: 'rosa', label: 'Rosa', hex: '#FF6FB5', level: 1 },
]
export const CUSTOM_COLOR_LEVEL: PlusLevel = 3

/** molduras/bordas da foto (o desenho de cada uma será feito na etapa da tela) */
export const AVATAR_FRAMES: PerkItem[] = [
  { id: 'neon', label: 'Neon', level: 2 },
  { id: 'ouro', label: 'Ouro', level: 2 },
  { id: 'gelo', label: 'Gelo', level: 2 },
  { id: 'chamas', label: 'Chamas', level: 3 },
  { id: 'galaxia', label: 'Galáxia', level: 3 },
]

/** skins do perfil: o fundo/tema do cartão de perfil */
export const PROFILE_SKINS: PerkItem[] = [
  { id: 'aurora', label: 'Aurora', level: 2 },
  { id: 'oceano', label: 'Oceano', level: 2 },
  { id: 'noite', label: 'Noite', level: 2 },
  { id: 'brasa', label: 'Brasa', level: 3 },
  { id: 'floresta', label: 'Floresta', level: 3 },
]

type LevelFields = Pick<Profile, 'plus_level' | 'plus_until'>

/** nível que vale agora: 0 se não tem Plus ou se já venceu (sem data final = não expira) */
export function plusLevel(p: LevelFields | null | undefined): PlusLevel {
  if (!p || !p.plus_level) return 0
  if (p.plus_until && new Date(p.plus_until).getTime() <= Date.now()) return 0
  return Math.min(3, Math.max(0, Math.round(p.plus_level))) as PlusLevel
}

/** o visual extra que os outros veem: se o Plus acabou (ou o nível caiu), volta ao normal sem apagar a escolha */
export function activePerks(p: (Partial<Pick<Profile, 'name_color' | 'avatar_frame' | 'profile_skin'>> & LevelFields) | null | undefined) {
  const lvl = plusLevel(p)
  return {
    level: lvl,
    nameColor: lvl >= 1 ? p?.name_color ?? null : null,
    frame: lvl >= 2 ? p?.avatar_frame ?? null : null,
    skin: lvl >= 2 ? p?.profile_skin ?? null : null,
  }
}
