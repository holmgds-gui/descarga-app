/** Avisos da página inicial: o que mudou no Descarga, um bloco por novidade. Mais novo primeiro. Para avisar algo novo, é só incluir no topo. */
interface L { pt: string; en: string }
export interface Novidade {
  date: string // AAAA-MM-DD
  items: { title: L; text: L }[]
}

const n = (tp: string, te: string, xp: string, xe: string) => ({ title: { pt: tp, en: te }, text: { pt: xp, en: xe } })

export const NOVIDADES: Novidade[] = [
  {
    date: '2026-11-24',
    items: [
      n('Design novo', 'New design', 'Painéis flutuantes, ícones arredondados, fontes novas, animações suaves e tema "Tinta". Dá para voltar ao visual antigo em Configurações > Aparência e idioma.', 'Floating panels, rounded icons, new fonts, smooth animations and the "Ink" theme. You can go back to the old look in Settings > Appearance and language.'),
      n('Barra de abas no celular', 'Mobile tab bar', 'Início, Conversas, Servidores e Você ficam sempre à mão embaixo da tela, como nos apps de conversa mais modernos.', 'Home, Chats, Servers and You are always at hand at the bottom of the screen, like the most modern chat apps.'),
      n('Selecionar várias mensagens', 'Select multiple messages', 'Clique com o botão direito (ou segure) numa mensagem e escolha "Selecionar mensagens": marque várias e copie, encaminhe ou apague de uma vez.', 'Right-click (or long-press) a message and pick "Select messages": tick several and copy, forward or delete them at once.'),
      n('Menu com abas', 'Menu with tabs', 'O menu de clique direito em pessoas e mensagens agora tem abas (Ações, Pessoa e Mais), rola quando é grande e abre para o lado certo perto das bordas da tela.', 'The right-click menu for people and messages now has tabs (Actions, Person and More), scrolls when long and opens the right way near screen edges.'),
      n('Perfil privado e Descarga Server', 'Private profile and Descarga Server', 'Em Configurações > Privacidade dá para deixar o perfil privado (só amigos veem os detalhes). Quem for aprovado entra sozinho no DESCARGA SERVER.', 'In Settings > Privacy you can make your profile private (only friends see the details). Anyone who gets approved joins DESCARGA SERVER automatically.'),
      n('Canais do servidor', 'Server channels', 'Servidor novo agora vem só com #geral e a sala de voz Geral. O dono pode renomear ou apagar qualquer canal (lápis ao lado do canal, ou botão direito).', 'New servers now start with just #geral and the Geral voice room. The owner can rename or delete any channel (pencil next to the channel, or right-click).'),
      n('Menu rápido ao tocar numa pessoa', 'Quick menu when you tap a person', 'Tocar num amigo, membro ou nome no chat abre um menu pequeno: Ver perfil, Mandar mensagem, Mencionar, Convidar, Ignorar e Denunciar. O botão direito continua com o menu completo.', 'Tapping a friend, member or name in chat opens a small menu: View profile, Message, Mention, Invite, Ignore and Report. Right-click still opens the full menu.'),
      n('Organize seus servidores', 'Organize your servers', 'Segure um ícone de servidor (ou puxe com o mouse) e arraste para mudar a ordem. No celular, segurar e soltar sem mexer abre o menu. A ordem fica salva na sua conta.', 'Hold a server icon (or drag it with the mouse) to change the order. On a phone, hold and release without moving to open the menu. The order is saved to your account.'),
      n('App para Mac', 'Mac app', 'O Descarga agora também tem instalador para Mac (em Configurações > Conta).', 'Descarga now also has a Mac installer (Settings > Account).'),
    ],
  },
  {
    date: '2026-11-19',
    items: [
      n('Regras e direitos autorais', 'Rules and copyright', 'Novos Termos, Diretrizes da Comunidade e Política de Direitos Autorais (em Configurações > Conta > Termos e regras). Será preciso aceitar de novo.', 'New Terms, Community Guidelines and Copyright Policy (Settings > Account > Terms and rules). You will need to accept again.'),
      n('Início com blocos', 'Home with blocks', 'Recado fixado do administrador, "Para você" (pedidos, conversas novas) e "Ativo agora" (calls rolando e amigos disponíveis).', 'Pinned administrator note, "For you" (requests, new conversations) and "Active now" (calls going on and available friends).'),
      n('Mapa ao vivo', 'Live map', 'Pontos roxos de quem quiser aparecer e fios ligando quem está em call. Opcional e com posição aproximada.', 'Purple dots for people who opt in, and threads linking people in a call. Optional, with approximate position.'),
      n('Página inicial', 'Home page', 'O ícone da privada agora abre esta página, com o mapa e os avisos.', 'The toilet icon now opens this page, with the map and announcements.'),
      n('Nome do servidor', 'Server name', 'Passe o mouse no ícone de um servidor e o nome dele aparece.', 'Hover a server icon and its name shows up.'),
      n('Volume na call', 'Call volume', 'Botão direito numa pessoa na call ajusta o volume da voz e o da tela, separados.', 'Right-click someone in a call to adjust their voice and screen volume separately.'),
      n('Abas redimensionáveis', 'Resizable panels', 'Arraste a borda da barra lateral e da lista de membros para mudar a largura.', 'Drag the edge of the sidebar and member list to resize them.'),
      n('Membros por cargo', 'Members by role', 'A lista de membros é dividida por cargo, como em outros apps de conversa. Cada cargo pode aparecer separado ou não.', 'The member list is split by role, like other chat apps. Each role can be shown separately or not.'),
      n('Cargos', 'Roles', 'Vários cargos por pessoa, nome com a cor do cargo mais poderoso, cargos que criam cargos e novas permissões.', 'Several roles per person, name colored by the most powerful role, roles that can create roles, and new permissions.'),
      n('Menu de botão direito', 'Right-click menu', 'Perfil, mensagem, nota, apelido, ignorar e silenciar servidor, em pessoas e em servidores.', 'Profile, message, note, nickname, ignore and mute server, on people and servers.'),
      n('Fotos e banners', 'Pictures and banners', 'Editor para posicionar e dar zoom na foto de perfil, na foto do servidor e nos banners.', 'Editor to position and zoom profile pictures, server icons and banners.'),
      n('Correções', 'Fixes', 'Criar canal, tela "Algo deu errado" e compartilhar tela sem a opção de 60fps.', 'Creating channels, the "Something went wrong" screen, and screen sharing without the 60fps option.'),
    ],
  },
  {
    date: '2026-11-18',
    items: [
      n('Servidores', 'Servers', 'Cargos com permissões, expulsar, banir e apagar servidor. Nome, foto, banner e descrição nas configurações.', 'Roles with permissions, kick, ban and delete server. Name, picture, banner and description in settings.'),
      n('Chat', 'Chat', 'Responder arrastando, encaminhar, fixar mensagens, "digitando…", visualização única e "visto" por pessoa.', 'Swipe to reply, forward, pin messages, "typing…", view-once and per-person "seen".'),
      n('App do Windows', 'Windows app', 'Ao fechar, vai para a bandeja e continua rodando. Atualiza sozinho.', 'Closing sends it to the tray and keeps it running. Updates itself.'),
      n('Login com Google', 'Google sign-in', 'Entre com a conta Google. Termos e Privacidade publicados.', 'Sign in with your Google account. Terms and Privacy published.'),
      n('Banidos', 'Banned people', 'Mensagem clara para quem foi banido ao tentar usar um convite.', 'Clear message for banned people who try to use an invite.'),
    ],
  },
  {
    date: '2026-11-17',
    items: [
      n('App para Windows', 'Windows app', 'Instalador e link nas configurações.', 'Installer and a link in settings.'),
      n('Galeria na call', 'Call gallery', 'Modo galeria para ver todos e prévia da sua própria tela.', 'Gallery mode to see everyone, and a preview of your own screen.'),
      n('Quem está assistindo', 'Who is watching', 'Contador de quem vê a sua tela e opção de parar de assistir a de alguém.', 'A counter of who sees your screen, and an option to stop watching someone else\'s.'),
      n('Contas e menus', 'Accounts and menus', 'Nomes de usuário livres, excluir conta, menu de botão direito e conexão das calls mais firme.', 'Free-form usernames, delete account, right-click menu and a steadier call connection.'),
    ],
  },
  {
    date: '2026-11-16',
    items: [
      n('Microfone', 'Microphone', 'Se o microfone guardado sumir, o app usa o padrão e mostra o motivo real do erro.', 'If the saved microphone disappears, the app uses the default one and shows the real reason for the error.'),
      n('Compartilhar tela', 'Screen sharing', 'Avisa na hora quando o navegador bloqueia e explica o que aconteceu.', 'Tells you right away when the browser blocks it and explains why.'),
    ],
  },
]
