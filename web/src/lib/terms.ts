/** Termos de Uso do Descarga. Mude TERMS_VERSION sempre que o texto mudar de verdade: todo mundo precisa aceitar de novo. */
export const TERMS_VERSION = '2026-11-19'
export const TERMS_CONTACT = 'holmgds@gmail.com'

export interface TermsSection {
  h: string
  p: string[]
}
export interface TermsText {
  title: string
  updated: string
  intro: string
  sections: TermsSection[]
}

const PT: TermsText = {
  title: 'Termos de Uso do Descarga',
  updated: 'Versão de 19 de novembro de 2026',
  intro:
    'Estes termos explicam as regras para usar o Descarga, um app gratuito de conversas, chamadas de voz e vídeo e compartilhamento de tela. Ao criar uma conta ou usar o app, você declara que leu e concorda com tudo abaixo. Se não concordar, não use o app.',
  sections: [
    {
      h: '1. Quem pode usar',
      p: [
        'O Descarga é só para pessoas com 18 anos ou mais. Ao criar a conta você declara ter essa idade.',
        'Cada conta precisa ser aprovada pelo administrador antes de usar o app. A aprovação pode ser recusada ou retirada a qualquer momento.',
        'Você é responsável pela sua conta e senha. Não compartilhe sua senha e avise o administrador se achar que alguém entrou na sua conta.',
      ],
    },
    {
      h: '2. O que você compartilha é responsabilidade sua',
      p: [
        'Tudo o que é enviado dentro do Descarga (mensagens, arquivos, imagens, vídeos, mensagens de voz, fotos de perfil, transmissões de tela, chamadas) é de responsabilidade de quem enviou.',
        'O Descarga não revisa o conteúdo antes de ele aparecer e, nos limites da lei, não se responsabiliza por nenhum arquivo, mensagem ou dado impróprio, ilegal, ofensivo, falso ou que viole direitos de terceiros compartilhado por usuários dentro do app. Quem compartilha responde pelo que compartilha.',
        'Isso não afasta o que a lei determina. Quando houver ordem judicial ou obrigação legal, o conteúdo será removido e as informações exigidas poderão ser entregues às autoridades, como prevê a legislação brasileira (incluindo o Marco Civil da Internet e a LGPD).',
        'O conteúdo continua sendo seu. Ao enviar, você autoriza o Descarga a armazená-lo e mostrá-lo às pessoas para quem você o enviou, só para o app funcionar.',
      ],
    },
    {
      h: '3. Regras de conduta',
      p: [
        'É proibido usar o Descarga para: compartilhar conteúdo ilegal; qualquer conteúdo sexual envolvendo menores de idade (isso é crime e será denunciado às autoridades); ameaçar, perseguir, assediar ou discriminar pessoas; aplicar golpes, fraudes ou phishing; espalhar vírus ou programas maliciosos; violar direitos autorais ou de imagem; divulgar dados pessoais de outras pessoas sem autorização; se passar por outra pessoa; enviar spam; ou tentar invadir, sobrecarregar ou prejudicar o app e as contas de outras pessoas.',
        'Você também deve respeitar a lei do local onde está.',
        'As Diretrizes da Comunidade e a Política de Direitos Autorais fazem parte destes termos e valem como regras de conduta.',
      ],
    },
    {
      h: '4. Chamadas, transmissão de tela e direitos autorais',
      p: [
        'Nas chamadas e transmissões de tela, quem transmite é o único responsável pelo que mostra e pelo som que envia, inclusive músicas, filmes, jogos e outros conteúdos protegidos por direitos autorais. O Descarga apenas conecta as pessoas e não grava as chamadas.',
        'Quem violar direitos autorais pode ter o conteúdo removido, a transmissão encerrada e a conta suspensa ou bloqueada, principalmente em caso de reincidência. Titulares de direitos podem enviar notificação como descrito na Política de Direitos Autorais.',
      ],
    },
    {
      h: '5. Moderação e bloqueio de contas',
      p: [
        'O administrador pode recusar, suspender ou bloquear qualquer conta e apagar qualquer conteúdo a qualquer momento, com ou sem aviso, principalmente se houver violação destes termos ou da lei.',
        'Quem for bloqueado perde o acesso ao app, inclusive a chamadas em andamento.',
      ],
    },
    {
      h: '6. Privacidade e seus dados (LGPD)',
      p: [
        'Dados que o app guarda: e-mail, nome de usuário, nome de exibição, foto, banner e dados de perfil que você preencher; mensagens, reações e arquivos que você enviar; configurações; e dados técnicos necessários para avisos (notificações) no seu aparelho.',
        'Para que usamos: só para o app funcionar (entrar na conta, entregar mensagens, chamadas, avisos e segurança). Não vendemos seus dados e não mostramos anúncios.',
        'Onde ficam: em serviços de infraestrutura de terceiros usados pelo app (como Supabase, para banco de dados e arquivos, e a hospedagem do site). Chamadas de voz, vídeo e tela vão direto entre os aparelhos quando possível; se não for possível, passam por um servidor de retransmissão. As chamadas não são gravadas pelo Descarga.',
        'As mensagens não têm criptografia de ponta a ponta. Quem administra o banco de dados tem, tecnicamente, acesso a elas e só deve consultá-las quando necessário (segurança, suporte, denúncia ou ordem legal).',
        'Seus direitos: você pode pedir acesso, correção ou exclusão dos seus dados, e a exclusão da sua conta, escrevendo para o contato abaixo. Algumas informações podem ser mantidas quando a lei exigir.',
      ],
    },
    {
      h: '7. O serviço é oferecido como está',
      p: [
        'O Descarga é gratuito e oferecido "como está". Não há garantia de funcionamento contínuo: pode haver falhas, instabilidade, perda de mensagens ou arquivos, mudanças ou até o fim do serviço, a qualquer momento. Guarde uma cópia do que for importante.',
        'Na máxima extensão permitida pela lei, o Descarga e seu administrador não respondem por danos causados pelo uso ou pela impossibilidade de usar o app, nem pelo que outros usuários fazem. Nada nestes termos tira direitos que a lei garante e que não podem ser afastados.',
      ],
    },
    {
      h: '8. Denúncias e contato',
      p: [
        `Para denunciar conteúdo ou conta, pedir exclusão de dados ou tirar dúvidas, escreva para ${TERMS_CONTACT}. Tente informar a pessoa ou o conteúdo e o que aconteceu.`,
      ],
    },
    {
      h: '9. Mudanças e lei aplicável',
      p: [
        'Estes termos podem mudar. Quando mudarem de forma importante, o app pedirá que você aceite de novo. Continuar usando depois disso significa que você concorda com a nova versão.',
        'Estes termos seguem as leis do Brasil.',
      ],
    },
  ],
}

const EN: TermsText = {
  title: 'Descarga Terms of Use',
  updated: 'Version of November 19, 2026',
  intro:
    'These terms explain the rules for using Descarga, a free app for chat, voice and video calls and screen sharing. By creating an account or using the app, you state that you have read and agree to everything below. If you do not agree, do not use the app.',
  sections: [
    {
      h: '1. Who can use it',
      p: [
        'Descarga is only for people aged 18 or older. By creating an account you state that you are.',
        'Every account must be approved by the administrator before using the app. Approval can be refused or withdrawn at any time.',
        'You are responsible for your account and password. Do not share your password, and tell the administrator if you think someone got into your account.',
      ],
    },
    {
      h: '2. What you share is your responsibility',
      p: [
        'Everything sent inside Descarga (messages, files, images, videos, voice messages, profile pictures, screen shares, calls) is the responsibility of whoever sent it.',
        'Descarga does not review content before it appears and, within the limits of the law, is not responsible for any improper, illegal, offensive or false file, message or data, or any that violates third-party rights, shared by users inside the app. Whoever shares something is responsible for it.',
        'This does not override what the law requires. When there is a court order or legal obligation, content will be removed and the required information may be handed to the authorities, as provided by Brazilian law (including the Marco Civil da Internet and the LGPD).',
        'Your content remains yours. By sending it, you allow Descarga to store it and show it to the people you sent it to, only so the app can work.',
      ],
    },
    {
      h: '3. Rules of conduct',
      p: [
        'You must not use Descarga to: share illegal content; share any sexual content involving minors (this is a crime and will be reported to the authorities); threaten, stalk, harass or discriminate against people; run scams, fraud or phishing; spread viruses or malicious software; infringe copyright or image rights; publish other people\'s personal data without permission; impersonate someone; send spam; or try to break into, overload or harm the app or other people\'s accounts.',
        'You must also respect the law where you are.',
        'The Community Guidelines and the Copyright Policy are part of these terms and count as rules of conduct.',
      ],
    },
    {
      h: '4. Calls, screen sharing and copyright',
      p: [
        'In calls and screen sharing, whoever streams is solely responsible for what they show and the sound they send, including music, movies, games and other content protected by copyright. Descarga only connects people and does not record calls.',
        'People who infringe copyright may have content removed, the stream ended and the account suspended or blocked, especially if it happens again. Rights holders can send a notice as described in the Copyright Policy.',
      ],
    },
    {
      h: '5. Moderation and blocking accounts',
      p: [
        'The administrator may refuse, suspend or block any account and delete any content at any time, with or without notice, especially if these terms or the law are violated.',
        'Blocked people lose access to the app, including calls in progress.',
      ],
    },
    {
      h: '6. Privacy and your data (LGPD)',
      p: [
        'Data the app keeps: email, username, display name, picture, banner and any profile data you fill in; messages, reactions and files you send; settings; and technical data needed for notifications on your device.',
        'What we use it for: only to make the app work (signing in, delivering messages, calls, notifications and security). We do not sell your data and we do not show ads.',
        'Where it lives: on third-party infrastructure services used by the app (such as Supabase, for the database and files, and the website hosting). Voice, video and screen calls go directly between devices when possible; if not, they go through a relay server. Descarga does not record calls.',
        'Messages are not end-to-end encrypted. Whoever runs the database technically has access to them and should only look at them when necessary (security, support, a report or a legal order).',
        'Your rights: you can ask for access to, correction or deletion of your data, and deletion of your account, by writing to the contact below. Some information may be kept when the law requires.',
      ],
    },
    {
      h: '7. The service is provided as is',
      p: [
        'Descarga is free and provided "as is". There is no guarantee of continuous operation: there may be failures, instability, loss of messages or files, changes or even the end of the service, at any time. Keep a copy of anything important.',
        'To the fullest extent allowed by law, Descarga and its administrator are not liable for damages caused by using or being unable to use the app, or for what other users do. Nothing in these terms removes rights that the law guarantees and that cannot be waived.',
      ],
    },
    {
      h: '8. Reports and contact',
      p: [
        `To report content or an account, ask for your data to be deleted or ask questions, write to ${TERMS_CONTACT}. Try to say which person or content and what happened.`,
      ],
    },
    {
      h: '9. Changes and governing law',
      p: [
        'These terms may change. When they change in an important way, the app will ask you to accept them again. Continuing to use the app afterwards means you agree to the new version.',
        'These terms are governed by the laws of Brazil.',
      ],
    },
  ],
}

export const termsFor = (lang: string): TermsText => (lang.startsWith('en') ? EN : PT)

import { local } from './storage'

const OK_KEY = (userId: string) => `descarga-termos:${userId}`
const SIGNUP_KEY = 'descarga-termos-cadastro'

/** No cadastro a pessoa marca "li e aceito"; guardamos isso até ela entrar pela primeira vez. */
export const rememberSignupAcceptance = (username: string) => local.set(SIGNUP_KEY, `${TERMS_VERSION}:${username}`)
/** o nome pode ter ganhado um número no fim (nome já usado) e não diferencia maiúsculas */
export const signupAcceptedFor = (username: string) => {
  const saved = local.get(SIGNUP_KEY) ?? ''
  const prefix = `${TERMS_VERSION}:`
  if (!saved.startsWith(prefix)) return false
  const typed = saved.slice(prefix.length).toLowerCase().slice(0, 26)
  const now = username.toLowerCase()
  return !!typed && now.startsWith(typed) && /^\d*$/.test(now.slice(typed.length))
}
export const rememberAcceptance = (userId: string) => local.set(OK_KEY(userId), TERMS_VERSION)
export const acceptedLocally = (userId: string) => local.get(OK_KEY(userId)) === TERMS_VERSION
