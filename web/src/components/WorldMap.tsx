import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../state'
import { WORLD_BORDERS, WORLD_LAND } from '../lib/worldPaths'
import { WORLD_H, WORLD_W } from '../lib/worldMeta'
import { projectPoint, useMapPeople } from '../lib/mapa'
import { t } from '../lib/i18n'
import { displayName } from './Avatar'

/** Mapa-múndi parado (só países). O que se mexe são as luzes, os pontos e os fios das calls. */
export default function WorldMap() {
  const people = useMapPeople()
  const { profiles, ensureProfiles } = useApp()
  const [hover, setHover] = useState<string | null>(null)

  useEffect(() => {
    ensureProfiles(people.map((p) => p.userId))
  }, [people, ensureProfiles])

  const dots = useMemo(() => people.map((p) => ({ ...p, xy: projectPoint(p.lat, p.lng) })), [people])

  // um fio entre cada par de pessoas que está na mesma call (com várias pessoas vira uma teia)
  const wires = useMemo(() => {
    const byCall = new Map<string, typeof dots>()
    for (const d of dots) if (d.callId) byCall.set(d.callId, [...(byCall.get(d.callId) ?? []), d])
    const out: { id: string; d: string }[] = []
    for (const [callId, list] of byCall) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const [x1, y1] = list[i].xy
          const [x2, y2] = list[j].xy
          const dist = Math.hypot(x2 - x1, y2 - y1)
          // o fio faz um arco, como as rotas de voo (curva para o lado de cima)
          let nx = -(y2 - y1) / (dist || 1)
          let ny = (x2 - x1) / (dist || 1)
          if (ny > 0 || (ny === 0 && nx < 0)) { nx = -nx; ny = -ny }
          const bow = Math.max(14, dist * 0.24)
          const cx = (x1 + x2) / 2 + nx * bow
          const cy = (y1 + y2) / 2 + ny * bow
          out.push({ id: `${callId}-${list[i].userId}-${list[j].userId}`, d: `M${x1.toFixed(1)} ${y1.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}` })
        }
      }
    }
    return out
  }, [dots])

  const hovered = dots.find((d) => d.userId === hover)

  return (
    <div className="world-map">
      <svg viewBox={`0 0 ${WORLD_W} ${WORLD_H}`} role="img" aria-label={t('Mapa-múndi com quem está online')}>
        <defs>
          <radialGradient id="wm-halo">
            <stop offset="0%" stopColor="#9b6bff" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#9b6bff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path d={WORLD_LAND} className="wm-land" />
        <path d={WORLD_BORDERS} className="wm-borders" />
        {wires.map((w) => (
          <g key={w.id}>
            <path d={w.d} className="wm-wire" />
            <path d={w.d} className="wm-wire-flow" />
          </g>
        ))}
        {dots.map((d, i) => (
          <g key={d.userId} transform={`translate(${d.xy[0].toFixed(1)} ${d.xy[1].toFixed(1)})`} className="wm-dot"
            onMouseEnter={() => setHover(d.userId)} onMouseLeave={() => setHover(null)}>
            <circle r="9" fill="url(#wm-halo)" className="wm-pulse" style={{ animationDelay: `${(i % 6) * 0.5}s` }} />
            <circle r="2.6" className="wm-core" />
            <circle r="10" fill="transparent" />
          </g>
        ))}
      </svg>
      {hovered && (
        <div className="wm-tip" style={{ left: `${(hovered.xy[0] / WORLD_W) * 100}%`, top: `${(hovered.xy[1] / WORLD_H) * 100}%` }}>
          {displayName(profiles[hovered.userId])}{hovered.callId ? ` · ${t('em call')}` : ''}
        </div>
      )}
    </div>
  )
}
