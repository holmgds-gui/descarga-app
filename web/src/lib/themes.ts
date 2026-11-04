/** Fundos do Descarga. "Cor do app" (destaques) é separada e combina com qualquer fundo. */
export type Tone = 'dark' | 'light'

export interface ThemeColors {
  rail: string // barra de servidores (mais escura)
  side: string // barra de canais e membros
  chat: string // área das mensagens
  elev: string // cartões, menus
  input: string // campo de digitar
  float: string // janelas flutuantes
  text?: string
  text2?: string
  text3?: string
}

export interface ThemeDef {
  id: string
  label: string
  tone: Tone
  colors: ThemeColors
}

export const THEMES: ThemeDef[] = [
  { id: 'dark', label: 'Grafite', tone: 'dark', colors: { rail: '#1E1F22', side: '#2B2D31', chat: '#313338', elev: '#383A40', input: '#383A40', float: '#111214' } },
  { id: 'midnight', label: 'Meia-noite', tone: 'dark', colors: { rail: '#000000', side: '#0B0B0D', chat: '#000000', elev: '#141417', input: '#17171A', float: '#0B0B0D' } },
  { id: 'carvao', label: 'Carvão', tone: 'dark', colors: { rail: '#121212', side: '#181818', chat: '#1F1F1F', elev: '#2A2A2A', input: '#2C2C2C', float: '#0E0E0E' } },
  { id: 'roxo', label: 'Roxo noturno', tone: 'dark', colors: { rail: '#15121C', side: '#1C1925', chat: '#221F2C', elev: '#2A2636', input: '#2E2A3B', float: '#14111A', text: '#EEEAF6', text2: '#B6AEC8', text3: '#7F7793' } },
  { id: 'marinho', label: 'Azul-marinho', tone: 'dark', colors: { rail: '#0B1120', side: '#111A2E', chat: '#16213A', elev: '#1D2A47', input: '#22304F', float: '#0A0F1C', text: '#E8EEF8', text2: '#A9B6CC', text3: '#73829C' } },
  { id: 'floresta', label: 'Floresta', tone: 'dark', colors: { rail: '#0E1813', side: '#13211A', chat: '#182A21', elev: '#1F362B', input: '#233D31', float: '#0C140F', text: '#E7F2EC', text2: '#A6BEB1', text3: '#71897C' } },
  { id: 'vinho', label: 'Vinho', tone: 'dark', colors: { rail: '#1A0F13', side: '#24141A', chat: '#2C1920', elev: '#38212A', input: '#3D2530', float: '#150C10', text: '#F6EAEE', text2: '#C8AEB7', text3: '#93777F' } },
  { id: 'cafe', label: 'Café', tone: 'dark', colors: { rail: '#17120F', side: '#201915', chat: '#28201B', elev: '#332923', input: '#382D27', float: '#120E0B', text: '#F4EDE7', text2: '#C3B4A8', text3: '#8E7F73' } },
  { id: 'light', label: 'Claro', tone: 'light', colors: { rail: '#E3E5E8', side: '#F2F3F5', chat: '#FFFFFF', elev: '#FFFFFF', input: '#EBEDEF', float: '#FFFFFF' } },
  { id: 'lavanda', label: 'Lavanda', tone: 'light', colors: { rail: '#E4DFEE', side: '#F1EEF7', chat: '#FCFAFF', elev: '#FFFFFF', input: '#EDE9F4', float: '#FFFFFF', text: '#1F1A2B', text2: '#5A5268', text3: '#8C849B' } },
  { id: 'areia', label: 'Areia', tone: 'light', colors: { rail: '#E7DFD2', side: '#F3EEE6', chat: '#FBF8F3', elev: '#FFFFFF', input: '#EEE7DC', float: '#FFFFFF', text: '#2A2219', text2: '#6B5F52', text3: '#998C7E' } },
]

export function themeById(id: string) {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}

// ---------- fundo personalizado: a pessoa escolhe uma cor e o app monta os tons ----------
function hexToRgb(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase()
}
/** Mistura a cor com preto (t<0) ou branco (t>0). */
function shade(hex: string, t: number) {
  const [r, g, b] = hexToRgb(hex)
  const target = t < 0 ? 0 : 255
  const p = Math.abs(t)
  return rgbToHex(r + (target - r) * p, g + (target - g) * p, b + (target - b) * p)
}
export function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function customTheme(base: string): ThemeDef {
  const light = luminance(base) > 0.45
  const colors: ThemeColors = light
    ? { rail: shade(base, -0.1), side: shade(base, -0.04), chat: base, elev: shade(base, 0.5), input: shade(base, -0.07), float: shade(base, 0.6),
        text: shade(base, -0.88), text2: shade(base, -0.62), text3: shade(base, -0.42) }
    : { rail: shade(base, -0.35), side: shade(base, -0.18), chat: base, elev: shade(base, 0.08), input: shade(base, 0.11), float: shade(base, -0.45),
        text: shade(base, 0.9), text2: shade(base, 0.62), text3: shade(base, 0.4) }
  return { id: 'custom', label: 'Personalizado', tone: light ? 'light' : 'dark', colors }
}
