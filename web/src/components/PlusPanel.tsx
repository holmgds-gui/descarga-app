import { useState } from 'react'
import { Check, Lock, Minus, Sparkles } from 'lucide-react'
import { backend } from '../lib/backend'
import { useApp } from '../state'
import { Avatar } from './Avatar'
import {
  ANIMATED_LEVEL, AVATAR_FRAMES, BANNER_IMAGE_LEVEL, CUSTOM_COLOR_LEVEL, LIMITS, NAME_COLORS, PLUS_LEVELS, PLUS_NAMES, PROFILE_SKINS,
  plusLevel, type PlusLevel,
} from '../lib/perks'
import type { CosmeticsPatch } from '../lib/types'
import { t } from '../lib/i18n'

/** Aba "Plus": em que nível a pessoa está e o que cada nível libera (quanto maior o nível, mais permissões). */
export function PlusPanel() {
  const { me, upsertProfile, toast } = useApp()
  const [busy, setBusy] = useState(false)
  const lvl = plusLevel(me)
  const cur: CosmeticsPatch = { name_color: me?.name_color ?? null, avatar_frame: me?.avatar_frame ?? null, profile_skin: me?.profile_skin ?? null }
  const save = async (patch: Partial<CosmeticsPatch>) => {
    setBusy(true)
    try {
      upsertProfile(await backend.setCosmetics({ ...cur, ...patch }))
    } catch (err) {
      toast((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const lock = (need: PlusLevel) => (lvl < need ? <Lock size={12} aria-label={t('Precisa de {nivel}', { nivel: PLUS_NAMES[need] })} /> : null)
  const cols: PlusLevel[] = [0, 1, 2, 3]
  const yes = <Check size={16} className="plus-yes" aria-label={t('Sim')} />
  const no = <Minus size={16} className="plus-no" aria-label={t('Não')} />
  const rows: { label: string; cell: (l: PlusLevel) => React.ReactNode }[] = [
    { label: t('Banner com imagem'), cell: (l) => (l >= BANNER_IMAGE_LEVEL ? yes : no) },
    { label: t('Foto e banner animados (GIF)'), cell: (l) => (l >= ANIMATED_LEVEL ? yes : no) },
    { label: t('Cor do nome (como os outros te veem)'), cell: (l) => (l >= 1 ? yes : no) },
    { label: t('Moldura da foto e skin do perfil'), cell: (l) => (l >= 2 ? yes : no) },
    { label: t('Caracteres na bio'), cell: (l) => LIMITS.bio[l] },
    { label: t('Links no perfil'), cell: (l) => LIMITS.links[l] },
    { label: t('Emojis por servidor (nível do dono)'), cell: (l) => LIMITS.emojis[l] },
    { label: t('Servidores que você pode criar'), cell: (l) => LIMITS.servers[l] },
  ]
  return (
    <>
      <h2 className="settings-title">Plus</h2>
      <div className={`plus-now plus-now-${lvl}`}>
        <Sparkles size={22} />
        <div>
          <strong>{lvl ? PLUS_NAMES[lvl] : t('Sem Plus')}</strong>
          <span className="muted small">{lvl ? t('Obrigado por apoiar o Descarga!') : t('O Plus é liberado pelo administrador. Quanto maior o nível, mais permissões.')}</span>
        </div>
      </div>
      <div className="plus-table-wrap">
        <table className="plus-table">
          <thead>
            <tr>
              <th />
              {cols.map((l) => <th key={l} className={l === lvl ? 'me' : ''}>{l ? PLUS_NAMES[l] : t('Sem Plus')}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                {cols.map((l) => <td key={l} className={l === lvl ? 'me' : ''}>{r.cell(l)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">{PLUS_LEVELS.map((l) => `${l} = ${PLUS_NAMES[l]}`).join(' · ')}</p>

      <h3 className="field-label">{t('Cor do nome')}</h3>
      <p className="muted small">{t('É como os outros veem seu nome fora dos servidores (conversas, amigos e perfil).')}</p>
      <div className="perk-grid">
        <button className={`perk-chip ${!cur.name_color ? 'on' : ''}`} disabled={busy} onClick={() => void save({ name_color: null })}>{t('Normal')}</button>
        {NAME_COLORS.map((c) => (
          <button key={c.id} className={`perk-chip ${cur.name_color === c.hex ? 'on' : ''}`} disabled={busy || lvl < c.level}
            onClick={() => void save({ name_color: c.hex })} style={{ color: c.hex }}>
            {c.label} {lock(c.level)}
          </button>
        ))}
        <label className={`perk-chip perk-custom ${lvl < CUSTOM_COLOR_LEVEL ? 'locked' : ''}`}>
          {t('Cor livre')} {lock(CUSTOM_COLOR_LEVEL)}
          <input type="color" disabled={busy || lvl < CUSTOM_COLOR_LEVEL} value={cur.name_color ?? '#a97bff'} onChange={(e) => void save({ name_color: e.target.value })} />
        </label>
      </div>

      <h3 className="field-label">{t('Moldura da foto')}</h3>
      <div className="perk-grid">
        <button className={`perk-chip ${!cur.avatar_frame ? 'on' : ''}`} disabled={busy} onClick={() => void save({ avatar_frame: null })}>{t('Sem moldura')}</button>
        {AVATAR_FRAMES.map((f) => (
          <button key={f.id} className={`perk-chip perk-frame ${cur.avatar_frame === f.id ? 'on' : ''}`} disabled={busy || lvl < f.level} onClick={() => void save({ avatar_frame: f.id })}>
            <Avatar profile={me ? { ...me, avatar_frame: f.id, plus_level: 3, plus_until: null } : null} size={34} />
            <span>{t(f.label)} {lock(f.level)}</span>
          </button>
        ))}
      </div>

      <h3 className="field-label">{t('Skin do perfil')}</h3>
      <div className="perk-grid">
        <button className={`perk-chip ${!cur.profile_skin ? 'on' : ''}`} disabled={busy} onClick={() => void save({ profile_skin: null })}>{t('Sem skin')}</button>
        {PROFILE_SKINS.map((k) => (
          <button key={k.id} className={`perk-chip perk-skin ${cur.profile_skin === k.id ? 'on' : ''}`} disabled={busy || lvl < k.level} onClick={() => void save({ profile_skin: k.id })}>
            <span className="skin-swatch" data-skin={k.id} />
            <span>{t(k.label)} {lock(k.level)}</span>
          </button>
        ))}
      </div>
    </>
  )
}
