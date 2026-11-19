import { useState } from 'react'
import { termsFor } from '../lib/terms'
import { COPYRIGHT, GUIDELINES, type LegalDoc, type LegalKind } from '../lib/legalDocs'
import { useLang } from '../lib/i18n'
import { Modal } from './Modal'
import { t } from '../lib/i18n'

export function legalDocFor(kind: LegalKind, lang: string): LegalDoc {
  const l = lang.startsWith('en') ? 'en' : 'pt'
  return kind === 'terms' ? termsFor(lang) : kind === 'guidelines' ? GUIDELINES[l] : COPYRIGHT[l]
}

/** O texto de um documento legal, no idioma do app. */
export function TermsDocument({ kind = 'terms' }: { kind?: LegalKind }) {
  const lang = useLang()
  const tx = legalDocFor(kind, lang)
  return (
    <div className="terms-doc">
      <p className="muted small">{tx.updated}</p>
      <p>{tx.intro}</p>
      {tx.sections.map((s) => (
        <section key={s.h}>
          <h3>{s.h}</h3>
          {s.p.map((p, i) => <p key={i}>{p}</p>)}
        </section>
      ))}
    </div>
  )
}

/** Abas para ler os três documentos: Termos de Uso, Diretrizes da Comunidade e Direitos Autorais. */
export function LegalReader({ initial = 'terms' }: { initial?: LegalKind }) {
  const [kind, setKind] = useState<LegalKind>(initial)
  const tabs: { id: LegalKind; label: string }[] = [
    { id: 'terms', label: t('Termos de Uso') },
    { id: 'guidelines', label: t('Diretrizes da Comunidade') },
    { id: 'copyright', label: t('Direitos Autorais') },
  ]
  return (
    <>
      <div className="legal-tabs" role="tablist">
        {tabs.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={kind === x.id} className={kind === x.id ? 'on' : ''} onClick={() => setKind(x.id)}>{x.label}</button>
        ))}
      </div>
      <TermsDocument kind={kind} />
    </>
  )
}

export function TermsModal({ onClose, initial = 'terms' }: { onClose: () => void; initial?: LegalKind }) {
  const lang = useLang()
  return (
    <Modal title={termsFor(lang).title} onClose={onClose} wide
      footer={<button className="btn btn-primary" onClick={onClose}>{t('Fechar')}</button>}>
      <LegalReader initial={initial} />
    </Modal>
  )
}
