import { t } from '../i18n'

/** Diz o motivo real de o microfone não abrir (antes tudo aparecia como "permita o microfone"). */
export function micErrorMessage(err: unknown, action: 'call' | 'gravar' = 'call'): string {
  const name = (err as { name?: string })?.name
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return action === 'call'
        ? t('O navegador bloqueou o microfone. Clique no cadeado ao lado do endereço, permita o microfone e tente de novo. Se já permitiu, confira em Configurações do Windows → Privacidade → Microfone.')
        : t('O navegador bloqueou o microfone. Permita o acesso no cadeado ao lado do endereço e tente de novo.')
    case 'NotFoundError':
    case 'OverconstrainedError':
      return t('Nenhum microfone foi encontrado. Conecte um microfone e tente de novo.')
    case 'NotReadableError':
    case 'AbortError':
      return t('Não deu para abrir o microfone: outro programa pode estar usando ele (outro app de conversa, jogo, outra aba). Feche e tente de novo.')
    default:
      return t('Não deu para abrir o microfone. Tente de novo.')
  }
}
