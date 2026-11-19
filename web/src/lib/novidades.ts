/** Avisos da página inicial: o que mudou no Descarga. Mais novo primeiro. Para avisar algo novo, é só incluir uma entrada no topo. */
interface L { pt: string; en: string }
export interface Novidade {
  date: string // AAAA-MM-DD
  title: L
  items: L[]
}

export const NOVIDADES: Novidade[] = [
  {
    date: '2026-11-19',
    title: { pt: 'Início, cargos e calls mais completas', en: 'Home, roles and better calls' },
    items: [
      { pt: '🏠 Página inicial nova (esta aqui!) para avisos e novidades.', en: '🏠 New home page (this one!) for announcements and news.' },
      { pt: '🖱️ Passe o mouse no ícone de um servidor e o nome dele aparece.', en: '🖱️ Hover a server icon to see its name.' },
      { pt: '🔊 Na call, clique com o botão direito numa pessoa para ajustar o volume da voz e da tela dela, separados.', en: '🔊 In a call, right-click someone to adjust their voice and screen volume separately.' },
      { pt: '↔️ Arraste a borda da barra lateral e da lista de membros para mudar a largura.', en: '↔️ Drag the edge of the sidebar and member list to resize them.' },
      { pt: '👥 Lista de membros dividida por cargo, como no Discord (cada cargo pode aparecer separado ou não).', en: '👥 Member list split by role, like Discord (each role can be shown separately or not).' },
      { pt: '🎭 Vários cargos por pessoa, a cor do nome vem do cargo mais poderoso, cargos que criam cargos e novas permissões.', en: '🎭 Several roles per person, name color from the most powerful role, roles that can create roles, and new permissions.' },
      { pt: '📋 Menu de botão direito completo em pessoas e servidores (perfil, mensagem, nota, apelido, ignorar, silenciar servidor…).', en: '📋 Full right-click menu on people and servers (profile, message, note, nickname, ignore, mute server…).' },
      { pt: '🖼️ Editor para posicionar e dar zoom nas fotos de perfil, de servidor e nos banners.', en: '🖼️ Editor to position and zoom profile pictures, server icons and banners.' },
      { pt: '🛠️ Corrigidos: criar canal, tela “Algo deu errado” e compartilhar tela sem a opção de 60fps.', en: '🛠️ Fixed: creating channels, the “Something went wrong” screen, and screen sharing without the 60fps option.' },
    ],
  },
  {
    date: '2026-11-18',
    title: { pt: 'Servidores, chat e app do Windows', en: 'Servers, chat and the Windows app' },
    items: [
      { pt: '🛡️ Servidores com cargos e permissões, expulsar, banir e apagar servidor; nome, foto, banner e descrição nas configurações.', en: '🛡️ Servers with roles and permissions, kick, ban and delete server; name, picture, banner and description in settings.' },
      { pt: '💬 Chat: responder arrastando, encaminhar, fixar mensagens, “digitando…”, visualização única e “visto” por pessoa.', en: '💬 Chat: swipe to reply, forward, pin messages, “typing…”, view-once and per-person “seen”.' },
      { pt: '🖥️ App do Windows: ao fechar, vai para a bandeja e continua rodando; atualiza sozinho.', en: '🖥️ Windows app: closing sends it to the tray and keeps it running; updates itself.' },
      { pt: '🔐 Login com Google e páginas de Termos e Privacidade.', en: '🔐 Google sign-in and public Terms and Privacy pages.' },
      { pt: '🚫 Aviso claro para quem foi banido ao tentar usar um convite.', en: '🚫 Clear message for banned people who try to use an invite.' },
    ],
  },
  {
    date: '2026-11-17',
    title: { pt: 'App para Windows e calls melhores', en: 'Windows app and better calls' },
    items: [
      { pt: '🪟 Chegou o app para Windows, com instalador e link nas configurações.', en: '🪟 The Windows app is here, with an installer and a link in settings.' },
      { pt: '🎞️ Calls: modo galeria, prévia da sua própria tela e contador de quem está assistindo (dá para parar de assistir).', en: '🎞️ Calls: gallery mode, preview of your own screen and a counter of who is watching (you can stop watching).' },
      { pt: '✏️ Nomes de usuário livres, excluir conta, menu de botão direito e conexão das calls mais firme.', en: '✏️ Free-form usernames, delete account, right-click menu and a steadier call connection.' },
    ],
  },
  {
    date: '2026-11-16',
    title: { pt: 'Microfone e tela mais confiáveis', en: 'More reliable microphone and screen' },
    items: [
      { pt: '🎤 Se o microfone guardado sumir, o app usa o padrão e mostra o motivo real do erro.', en: '🎤 If the saved microphone disappears, the app uses the default one and shows the real reason for the error.' },
      { pt: '🖥️ Compartilhar tela: avisa na hora quando o navegador bloqueia e explica o que aconteceu.', en: '🖥️ Screen sharing: tells you right away when the browser blocks it and explains why.' },
    ],
  },
]
