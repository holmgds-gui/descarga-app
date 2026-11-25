import { PLUS_NAMES } from '../lib/perks'

/** cor de cada nível do Plus (só o símbolo, sem escrita). O nome aparece ao passar o mouse. */
const COLORS: Record<1 | 2 | 3, string> = { 1: '#D4537E', 2: '#534AB7', 3: '#185FA5' }

/** símbolo do nível: 1 = +, 2 = estrela de quatro pontas, 3 = estrela central com estrelas em volta */
export function PlusMark({ level, size = 24 }: { level: 1 | 2 | 3; size?: number }) {
  const name = PLUS_NAMES[level]
  return (
    <svg
      className={`plus-mark plus-mark-${level}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={name}
      style={{ color: COLORS[level] }}
    >
      <title>{name}</title>
      {level === 1 && <path d="M50 30 V70 M30 50 H70" stroke="currentColor" strokeWidth="10" strokeLinecap="round" fill="none" />}
      {level === 2 && <path d="M50 20 Q50 50 80 50 Q50 50 50 80 Q50 50 20 50 Q50 50 50 20 Z" fill="currentColor" />}
      {level === 3 && (
        <g fill="currentColor">
          <path d="M50 20 Q50 50 80 50 Q50 50 50 80 Q50 50 20 50 Q50 50 50 20 Z" />
          <path d="M80 15 Q80 22 87 22 Q80 22 80 29 Q80 22 73 22 Q80 22 80 15 Z" />
          <path d="M22 70 Q22 78 30 78 Q22 78 22 86 Q22 78 14 78 Q22 78 22 70 Z" />
          <path d="M80 72 Q80 78 86 78 Q80 78 80 84 Q80 78 74 78 Q80 78 80 72 Z" />
        </g>
      )}
    </svg>
  )
}
