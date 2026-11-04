/**
 * Lê erros que o servidor de login devolve no endereço (ex.: link de e-mail vencido)
 * ANTES do Supabase limpar o endereço, para mostrar uma mensagem clara na tela de login.
 */
import { t } from './i18n'
function read(): string | null {
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''))
  const query = new URLSearchParams(location.search)
  const code = hash.get('error_code') ?? query.get('error_code')
  const desc = hash.get('error_description') ?? query.get('error_description')
  const err = hash.get('error') ?? query.get('error')
  if (!code && !desc && !err) return null
  // limpa o endereço para o erro não aparecer de novo ao recarregar
  history.replaceState(null, '', location.pathname)
  if (code === 'otp_expired' || /expired|invalid/i.test(desc ?? ''))
    return t('Esse link já foi usado ou venceu. Entre com seu e-mail e senha (ou use "Esqueci minha senha").')
  if (err === 'access_denied') return t('O login foi cancelado.')
  return desc ? decodeURIComponent(desc.replace(/\+/g, ' ')) : t('Não foi possível entrar. Tente de novo.')
}

/** Abriu o link de "esqueci minha senha"? (lido antes do Supabase limpar o endereço) */
export const isRecoveryLink = /(^|[#&])type=recovery(&|$)/.test(location.hash)
export const authUrlError = read()
