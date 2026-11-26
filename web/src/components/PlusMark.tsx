import { useId } from 'react'
import { PLUS_NAMES } from '../lib/perks'

/** cores de cada nível do Plus: [claro, escuro] do degradê do selo. O nome aparece ao passar o mouse. */
const COLORS: Record<1 | 2 | 3, [string, string]> = { 1: ['#FF8FB8', '#C93A74'], 2: ['#8E86FF', '#4B3FC0'], 3: ['#4DB3FF', '#1A5FBF'] }

/** estrela de quatro pontas "gordinha" centrada em (50,50), com raio r */
const star = (cx: number, cy: number, r: number) => {
  const k = r * 0.22 // quanto mais perto de 0, mais fina a ponta
  return `M${cx} ${cy - r} C${cx + k} ${cy - k} ${cx + k} ${cy - k} ${cx + r} ${cy} C${cx + k} ${cy + k} ${cx + k} ${cy + k} ${cx} ${cy + r} C${cx - k} ${cy + k} ${cx - k} ${cy + k} ${cx - r} ${cy} C${cx - k} ${cy - k} ${cx - k} ${cy - k} ${cx} ${cy - r} Z`
}

/**
 * Selo do nível: um círculo com degradê que ocupa o quadrado inteiro (nítido em qualquer tamanho) e um desenho branco por cima:
 * 1 = "+", 2 = estrela de quatro pontas, 3 = estrela grande com duas estrelinhas (e um brilho em volta).
 */
export function PlusMark({ level, size = 32 }: { level: 1 | 2 | 3; size?: number }) {
  const name = PLUS_NAMES[level]
  const id = useId().replace(/:/g, '')
  const [c1, c2] = COLORS[level]
  return (
    <svg
      className={`plus-mark plus-mark-${level}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={name}
    >
      <title>{name}</title>
      <defs>
        <linearGradient id={id} x1="15%" y1="0%" x2="85%" y2="100%">
          <stop offset="0" stopColor={c1} />
          <stop offset="1" stopColor={c2} />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill={`url(#${id})`} />
      <circle cx="50" cy="50" r="47" fill="none" stroke="#fff" strokeOpacity=".28" strokeWidth="2" />
      <g fill="#fff">
        {level === 1 && <path d="M50 24 V76 M24 50 H76" stroke="#fff" strokeWidth="15" strokeLinecap="round" fill="none" />}
        {level === 2 && <path d={star(50, 50, 33)} />}
        {level === 3 && (
          <>
            <path d={star(46, 55, 30)} />
            <path d={star(71, 29, 15)} />
            <path d={star(27, 27, 9)} />
          </>
        )}
      </g>
    </svg>
  )
}
