import { termsFor } from '../lib/terms'
import { useLang } from '../lib/i18n'
import { Modal } from './Modal'
import { t } from '../lib/i18n'

/** O texto dos Termos de Uso, no idioma do app. */
export function TermsDocument() {
  const lang = useLang()
  const tx = termsFor(lang)
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

export function TermsModal({ onClose }: { onClose: () => void }) {
  const lang = useLang()
  return (
    <Modal title={termsFor(lang).title} onClose={onClose} wide
      footer={<button className="btn btn-primary" onClick={onClose}>{t('Fechar')}</button>}>
      <TermsDocument />
    </Modal>
  )
}
