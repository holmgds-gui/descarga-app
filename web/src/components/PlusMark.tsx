import { PLUS_NAMES } from '../lib/perks'

/** cor de cada nível do Plus (só o símbolo, sem escrita). O nome aparece ao passar o mouse. */
const COLORS: Record<1 | 2 | 3, string> = { 1: '#D4537E', 2: '#534AB7', 3: '#185FA5' }

/** símbolo do nível: 1 = +, 2 = estrela de quatro pontas, 3 = estrela central com estrelas em volta */
export function PlusMark({ level, size = 32 }: { level: 1 | 2 | 3; size?: number }) {
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
      {level === 1 && <path d="M50 22 V78 M22 50 H78" stroke="currentColor" strokeWidth="12" strokeLinecap="round" fill="none" />}
      {level === 2 && <path d="M50 14 Q50 50 86 50 Q50 50 50 86 Q50 50 14 50 Q50 50 50 14 Z" fill="currentColor" />}
      {level === 3 && (
        <g fill="currentColor">
          {/* estrela central e quatro estrelas menores nas diagonais: tudo simétrico em torno do centro */}
          <path d="M50 24 Q50 50 76 50 Q50 50 50 76 Q50 50 24 50 Q50 50 50 24 Z" />
          <path d="M18 9 Q18 18 27 18 Q18 18 18 27 Q18 18 9 18 Q18 18 18 9 Z" />
          <path d="M82 9 Q82 18 91 18 Q82 18 82 27 Q82 18 73 18 Q82 18 82 9 Z" />
          <path d="M18 73 Q18 82 27 82 Q18 82 18 91 Q18 82 9 82 Q18 82 18 73 Z" />
          <path d="M82 73 Q82 82 91 82 Q82 82 82 91 Q82 82 73 82 Q82 82 82 73 Z" />
        </g>
      )}
    </svg>
  )
}
