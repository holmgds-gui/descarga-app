import type { RoleDef } from './types'

/** O cargo de maior poder (o que tem mais permissões; empate = o mais antigo) dá a cor do nome. */
export function topRole(roles: RoleDef[], ids: string[] | undefined): RoleDef | undefined {
  if (!ids?.length) return undefined
  let best: RoleDef | undefined
  for (const r of roles) if (ids.includes(r.id) && (!best || r.permissions.length > best.permissions.length)) best = r
  return best
}
