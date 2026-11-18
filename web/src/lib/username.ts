/** Nome de usuário: 2 a 32 caracteres, qualquer letra (maiúscula, acento), número ou símbolo — sem espaços, sem @. */
export const USERNAME_RE = /^[^\s@\p{Cc}]{2,32}$/u

export const isValidUsername = (s: string) => USERNAME_RE.test(s)

/** Tira o que não pode (espaços, @ e caracteres de controle) enquanto a pessoa digita. */
export const cleanUsername = (s: string) => s.replace(/[\s@\p{Cc}]/gu, '').slice(0, 32)

/** "Gui" e "gui" são o mesmo nome: comparações usam esta forma. */
export const usernameKey = (s: string) => s.toLowerCase()

export const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** @menção de alguém: o nome inteiro, seguido de fim de texto, espaço ou pontuação. */
export const mentionRegex = (username: string) =>
  new RegExp(`(^|\\s)@${escapeRe(username)}(?=$|[\\s.,!?;:)\\]}"'”…])`, 'iu')
