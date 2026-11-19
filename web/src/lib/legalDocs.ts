/** Diretrizes da Comunidade e Política de Direitos Autorais do Descarga (sem imports: o gerador das páginas públicas lê este arquivo direto). */
export const COPYRIGHT_CONTACT = 'holmgds@gmail.com'

export interface LegalSection { h: string; p: string[] }
export interface LegalDoc { title: string; updated: string; intro: string; sections: LegalSection[] }
export type LegalKind = 'terms' | 'guidelines' | 'copyright'

const GUIDELINES_PT: LegalDoc = {
  title: 'Diretrizes da Comunidade do Descarga',
  updated: 'Versão de 19 de novembro de 2026',
  intro:
    'Regras práticas para conversar, jogar e transmitir no Descarga. Elas fazem parte dos Termos de Uso: quem não segue pode ter conteúdo apagado e a conta suspensa ou bloqueada.',
  sections: [
    {
      h: '1. Você é responsável pelo que mostra e fala',
      p: [
        'Você é o único responsável pelo que aparece na sua tela, pelo áudio do seu microfone e do seu computador, e pelo que envia no chat, nos arquivos e nas calls. Antes de compartilhar a tela, feche o que não quer mostrar (senhas, e-mails, conversas, dados de outras pessoas).',
      ],
    },
    {
      h: '2. Respeito nas conversas e nas calls',
      p: [
        'Não toleramos assédio, ameaças, perseguição, discurso de ódio ou discriminação.',
        'Não exponha dados pessoais de outras pessoas (endereço, telefone, documentos, fotos íntimas) e não se passe por outra pessoa.',
        'Não envie golpes, fraudes, spam nem conteúdo ilegal. Qualquer conteúdo sexual envolvendo menores de idade é crime e será denunciado às autoridades.',
        'Não grave nem divulgue conversas ou calls de outras pessoas sem que elas saibam e concordem.',
      ],
    },
    {
      h: '3. Transmissão de tela e áudio',
      p: [
        'Tenha atenção a músicas, filmes, séries, eventos e jogos protegidos por direitos autorais ao transmitir a tela ou o som. Não transmita o que você não tem permissão para mostrar a outras pessoas. Veja a Política de Direitos Autorais.',
        'O Descarga apenas conecta as pessoas em tempo real e não grava as calls. Mesmo assim, quem transmite responde pelo que transmite.',
      ],
    },
    {
      h: '4. Sem pirataria, malware ou trapaça maliciosa',
      p: [
        'É proibido promover a distribuição ilegal de jogos ou programas, divulgar trapaças (cheats) maliciosas, enviar vírus, malware, phishing ou links perigosos, e tentar invadir, sobrecarregar ou prejudicar o app e as contas de outras pessoas.',
      ],
    },
    {
      h: '5. Moderação e consequências',
      p: [
        'O administrador e os moderadores dos servidores podem apagar mensagens, encerrar transmissões, expulsar, banir, suspender ou bloquear contas que violem estas diretrizes ou a lei, com ou sem aviso. Quem reincidir pode ser bloqueado de forma permanente.',
        `Para denunciar algo, escreva para ${COPYRIGHT_CONTACT} ou use a opção de denúncia no menu da pessoa (clique com o botão direito). Tente informar a pessoa ou o conteúdo e o que aconteceu.`,
      ],
    },
  ],
}

const GUIDELINES_EN: LegalDoc = {
  title: 'Descarga Community Guidelines',
  updated: 'Version of November 19, 2026',
  intro:
    'Practical rules for chatting, playing and streaming on Descarga. They are part of the Terms of Use: people who do not follow them may have content removed and their account suspended or blocked.',
  sections: [
    {
      h: '1. You are responsible for what you show and say',
      p: [
        'You alone are responsible for what appears on your screen, for the audio from your microphone and computer, and for what you send in chat, files and calls. Before sharing your screen, close anything you do not want to show (passwords, emails, conversations, other people\'s data).',
      ],
    },
    {
      h: '2. Respect in conversations and calls',
      p: [
        'We do not tolerate harassment, threats, stalking, hate speech or discrimination.',
        'Do not expose other people\'s personal data (address, phone number, documents, intimate photos) and do not impersonate anyone.',
        'Do not send scams, fraud, spam or illegal content. Any sexual content involving minors is a crime and will be reported to the authorities.',
        'Do not record or share other people\'s conversations or calls without their knowledge and consent.',
      ],
    },
    {
      h: '3. Screen and audio streaming',
      p: [
        'Be careful with music, movies, shows, events and games protected by copyright when you stream your screen or sound. Do not stream what you do not have permission to show to other people. See the Copyright Policy.',
        'Descarga only connects people in real time and does not record calls. Even so, whoever streams is responsible for what is streamed.',
      ],
    },
    {
      h: '4. No piracy, malware or malicious cheating',
      p: [
        'It is forbidden to promote the illegal distribution of games or software, to spread malicious cheats, to send viruses, malware, phishing or dangerous links, and to try to break into, overload or harm the app or other people\'s accounts.',
      ],
    },
    {
      h: '5. Moderation and consequences',
      p: [
        'The administrator and server moderators may delete messages, end streams, kick, ban, suspend or block accounts that violate these guidelines or the law, with or without notice. Repeat offenders may be blocked permanently.',
        `To report something, write to ${COPYRIGHT_CONTACT} or use the report option in the person's menu (right-click). Try to say which person or content and what happened.`,
      ],
    },
  ],
}

const COPYRIGHT_PT: LegalDoc = {
  title: 'Política de Direitos Autorais e Conteúdo de Terceiros',
  updated: 'Versão de 19 de novembro de 2026',
  intro:
    'O Descarga respeita os direitos de propriedade intelectual de terceiros e espera que todas as pessoas que usam o app façam o mesmo. Esta política faz parte dos Termos de Uso.',
  sections: [
    {
      h: '1. Responsabilidade de quem usa',
      p: [
        'Ao transmitir telas de jogos, áudios, músicas, imagens, vídeos ou qualquer outro conteúdo pelo Descarga, você declara que tem os direitos, licenças ou permissões necessários, ou que o uso se enquadra nas exceções previstas em lei.',
        'O Descarga é um aplicativo que conecta pessoas e hospeda o que elas enviam no chat. Ele não endossa nem se responsabiliza pelo conteúdo transmitido ou compartilhado por usuários.',
      ],
    },
    {
      h: '2. Conteúdo proibido',
      p: [
        'É proibido usar o Descarga para transmitir, distribuir ou compartilhar conteúdo que viole direitos autorais, marcas, segredos comerciais ou outros direitos de terceiros sem autorização. Isso inclui, por exemplo, músicas protegidas sem licença, transmissões não autorizadas de eventos ou filmes, e materiais pirateados.',
      ],
    },
    {
      h: '3. Como o Descarga funciona',
      p: [
        'Chamadas de voz, vídeo e tela vão direto entre os aparelhos sempre que possível; quando não é possível, passam por um servidor de retransmissão. O Descarga não grava as chamadas.',
        'Mensagens e arquivos enviados no chat ficam guardados nos serviços de infraestrutura usados pelo app, para que as pessoas da conversa possam ver.',
      ],
    },
    {
      h: '4. Como avisar sobre uma violação',
      p: [
        'Se você é titular de direitos autorais (ou representante autorizado) e acredita que algum conteúdo disponibilizado pelo Descarga viola seus direitos, envie uma notificação com:',
        '• identificação completa da obra protegida que teria sido violada;',
        '• informações para localizar o conteúdo (pessoa, servidor, canal, link, data e horário);',
        '• seus dados de contato (nome, e-mail e telefone ou endereço);',
        '• declaração de boa-fé de que o uso não é autorizado pelo titular, por seu representante ou pela lei;',
        '• declaração de que as informações são verdadeiras e de que você está autorizado a agir em nome do titular.',
        `Canal oficial: ${COPYRIGHT_CONTACT}. Avaliaremos o pedido e, se for o caso, removeremos o conteúdo. Quem teve conteúdo removido pode responder pelo mesmo contato.`,
      ],
    },
    {
      h: '5. Reincidência',
      p: [
        'Contas envolvidas em violações repetidas de direitos autorais podem ter recursos suspensos ou ser bloqueadas de forma permanente, conforme as regras do app e a lei.',
      ],
    },
  ],
}

const COPYRIGHT_EN: LegalDoc = {
  title: 'Copyright and Third-Party Content Policy',
  updated: 'Version of November 19, 2026',
  intro:
    'Descarga respects the intellectual property rights of others and expects everyone who uses the app to do the same. This policy is part of the Terms of Use.',
  sections: [
    {
      h: '1. Responsibility of users',
      p: [
        'When you stream game screens, audio, music, images, videos or any other content through Descarga, you declare that you have the necessary rights, licenses or permissions, or that the use falls under the exceptions allowed by law.',
        'Descarga is an application that connects people and hosts what they send in chat. It does not endorse and is not responsible for content streamed or shared by users.',
      ],
    },
    {
      h: '2. Prohibited content',
      p: [
        'You must not use Descarga to stream, distribute or share content that infringes copyright, trademarks, trade secrets or other rights of third parties without authorization. This includes, for example, protected music without a license, unauthorized broadcasts of events or movies, and pirated material.',
      ],
    },
    {
      h: '3. How Descarga works',
      p: [
        'Voice, video and screen calls go directly between devices whenever possible; when that is not possible, they go through a relay server. Descarga does not record calls.',
        'Messages and files sent in chat are stored on the infrastructure services used by the app so that the people in the conversation can see them.',
      ],
    },
    {
      h: '4. How to report an infringement',
      p: [
        'If you are a copyright owner (or an authorized representative) and believe that content made available through Descarga infringes your rights, send a notice with:',
        '• full identification of the protected work allegedly infringed;',
        '• information to locate the content (person, server, channel, link, date and time);',
        '• your contact details (name, email and phone or address);',
        '• a good-faith statement that the use is not authorized by the owner, its representative or the law;',
        '• a statement that the information is accurate and that you are authorized to act on behalf of the owner.',
        `Official channel: ${COPYRIGHT_CONTACT}. We will review the request and, where appropriate, remove the content. People whose content was removed can reply through the same contact.`,
      ],
    },
    {
      h: '5. Repeat infringement',
      p: [
        'Accounts involved in repeated copyright violations may have features suspended or be blocked permanently, according to the app rules and the law.',
      ],
    },
  ],
}

export const GUIDELINES = { pt: GUIDELINES_PT, en: GUIDELINES_EN }
export const COPYRIGHT = { pt: COPYRIGHT_PT, en: COPYRIGHT_EN }
