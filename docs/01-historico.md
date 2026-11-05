# Histórico do projeto

## Regras que valem para tudo

- **100% grátis.** Nada de Cloudflare, nenhum cartão, nenhuma forma de pagamento. Se algum site pedir cartão ou PayPal, o Claude para e avisa antes.
- **Senhas e chaves nunca vão no chat.** Segredos entram só pela ferramenta segura do Supabase (`create_edge_function_secret`).
- **Você é perguntado antes de cada trabalho grande** e vê opções antes de mudanças importantes.
- Plataformas: **web, PC e celular**, com o mesmo código sempre que possível.

## Decisões de design

| Assunto | Escolha |
|---|---|
| Cor principal | Roxo "uva" `#7B3FE4` |
| Logo | Estilo **Cartoon** (opção 7): vaso roxo com a descarga soltando ondinhas de som |
| Login com Google | Escondido por enquanto (precisa de configuração no Google Cloud) |
| Som de entrar na call | Três gotas subindo |
| Som de sair da call | Três gotas descendo (mais suave) |
| Temas | 11 temas prontos + fundo personalizado |
| Idiomas | Português e inglês, o app inteiro |
| Perfil | Personalização grátis (foto, banner, cor, bio, links...). Sem loja de skins |
| Limite de arquivo | 50 MB |
| Transcrição/tradução | Rodam no próprio aparelho (nada de serviço pago) |
| Idade mínima | 18 anos |

## Etapa 1 — Base (pronta e no ar)

Login por e-mail e senha, servidores com convite por link ou código, canais de texto e de voz por categoria, chat em tempo real (responder, editar, apagar, formatação), lista de membros com status, perfil completo e personalizável, temas e layout para PC e celular.

## Etapa 2 — Calls e notificações (pronta e no ar)

- Calls de voz **direto entre os aparelhos** (até 6 pessoas), sem servidor de mídia — por isso é grátis.
- Câmera e compartilhamento de tela com som (720p, 1080p, 1080p/60fps).
- Redução de ruído, apertar-para-falar, volume por pessoa, indicador de quem fala.
- Menções com `@usuario` e notificações com o app fechado (menções, respostas, alguém entrou na call).
- App instalável (PWA) e inglês/português.
- Preparado para servidor de apoio (TURN), para calls entre redes difíceis.

## Etapa 3 — Social e comunidade (em andamento)

Foi dividida em três blocos, nesta ordem:

### Bloco 1 — Social: **pronto, testado, ainda não publicado**

- **Amigos:** pedir amizade pelo nome de usuário, aceitar/recusar, lista (online, todos, pendentes).
- **Mensagens diretas (DMs)** e **grupos** (até 10 pessoas), com lista de conversas e contador de não lidas.
- **Calls nas DMs** (chamar um amigo direto).
- **Reações** com emojis nas mensagens e **emojis próprios do servidor** (o dono do servidor cadastra).
- **Seletor de emojis** completo (em português e inglês).
- **Arquivos** até 50 MB: imagens, vídeos, documentos, com visualizador.
- **Mensagens de voz** com forma de onda e velocidade (1×, 1,5×, 2×).
- **Confirmação de leitura** ("Visto") nas DMs, que cada pessoa pode desligar.
- Notificações de DM e de chamada.

### Bloco 2 — Comunidade (não começou)

Cargos editáveis com permissões (gerenciar canais e servidor, moderar membros, apagar mensagens dos outros, canais privados por cargo), fóruns, enquetes, eventos.

### Bloco 3 — Extras (não começou)

Assistir junto, quadro branco, transcrição/tradução no próprio aparelho, bots e webhooks.

## Aprovação de contas e Termos de Uso (pronto, ainda não publicado)

Pedidos de 5 de novembro de 2026. Detalhes em [03-aprovacao-e-termos.md](03-aprovacao-e-termos.md).

- Toda conta nova precisa ser aprovada pela conta **holmgds@gmail.com**, que é a única administradora.
- Termos de Uso em português e inglês, com aceite obrigatório no cadastro.

## Linha do tempo resumida

1. Escolha de nome, cor e logo; etapa 1 criada e publicada no GitHub Pages.
2. Etapa 2: calls, tela com som, notificações, temas, inglês.
3. Preparo para TURN (aguardando você criar a conta no ExpressTURN, que é grátis e sem cartão).
4. Etapa 3, bloco 1 (social): construída e testada (66 verificações automáticas).
5. Aprovação de contas e painel de administração.
6. Termos de Uso, ícone da tela inicial reforçado.
7. Tudo salvo no Git, **mas ainda não publicado**, porque depende de ações no Supabase que só você pode aprovar no PC (veja [04-pendencias.md](04-pendencias.md)).
