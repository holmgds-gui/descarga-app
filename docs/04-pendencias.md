# O que falta fazer

## Concluído em 17 de novembro de 2026 (noite)

- Nomes de usuário com maiúsculas, acentos e símbolos (sem espaços); "Gui" e "gui" são o mesmo nome (migração `0006`).
- Excluir conta (administrador exclui qualquer conta; cada pessoa exclui a sua): libera o e-mail, apaga perfil e arquivos, mantém mensagens como "Usuário excluído" (migração `0007` + função `excluir-conta`). Bloquear continua reversível só pelo administrador.
- Botão direito com menu próprio do app (mensagens, pessoas, canais, servidores, telas da call).
- Layout do palco da call corrigido (tela compartilhada e faixa de pessoas não ficam mais cortadas).
- Conexões da call: sinais agora são tratados em ordem (candidatos de rede não se perdem), nova tentativa automática aos 10 s, reinício da conexão aos ~22 s, botão "Tentar de novo" refaz do zero.
- Compartilhar tela: som sem eco (`restrictOwnAudio`), mensagem clara quando o navegador não envia som; diário técnico em Configurações > Voz > Diagnóstico.
- Galeria na call (botão alterna Foco ⇄ Galeria) e prévia da própria tela para quem compartilha.
- Contador "N assistindo" na prévia de quem compartilha a tela; quem assiste pode "Parar de assistir" (a tela deixa de ser enviada para ele) e voltar quando quiser.
- Função `notificar` (v5) reconhece @menções com maiúsculas e símbolos.

## Concluído em 5 de novembro de 2026 (noite)

- Migrações `0003`, `0004` e `0005` aplicadas no Supabase.
- Funções `notificar` e `turn` publicadas (versão 3).
- Conferido no banco: `holmgds@gmail.com` (usuário `theguigs`) é a administradora; as outras 4 contas continuam aprovadas.
- Código novo na `main` e site publicado no GitHub Pages (tela de login já mostra "Termos de Uso").

## Ainda falta

- **Notificações para o administrador:** ative as notificações do Descarga no seu celular/PC para receber o aviso de novos cadastros.
- **Ícone na tela inicial:** quem já adicionou o app pode precisar remover e adicionar de novo para ver o ícone novo.
- **Testar com uma conta nova** (cadastro → tela de espera → aprovação no painel) em produção.

## 4. Pendências antigas

- **Servidor de apoio das calls (TURN):** crie conta grátis no **ExpressTURN** (sem cartão). Mande no chat só o **servidor** e o **usuário**. A **senha** vai pelo campo seguro que o Claude abrir (`TURN_PASSWORD`); nunca cole no chat. O Claude coloca `turn_urls` e `turn_username` na configuração. Se algum site pedir cartão ou PayPal, pare e avise.
- **Login com Google** (feito em 18/11/2026): projeto `descarga-515103` no Google Cloud (grátis, sem faturamento), app externo em produção, cliente OAuth Web "Descarga Web" (origem `https://holmgds-gui.github.io`, retorno `https://ebumtgqfiygrfaafjctg.supabase.co/auth/v1/callback`), provedor Google ligado no Supabase com Client ID + secret. Termos/privacidade públicos em `web/public/termos.html` e `privacidade.html` (gerados por `web/scripts/gen-legal.mjs` a partir de `terms.ts`: rode de novo se o texto mudar). Contas novas do Google também passam pela aprovação do administrador. Se o secret vazar, gere outro em Google Auth Platform > Clientes e cole no Supabase.
- **E-mail próprio para os avisos de cadastro** e **domínio próprio** (opcionais).
- **Revisão jurídica dos Termos de Uso** (recomendada antes de divulgar).
