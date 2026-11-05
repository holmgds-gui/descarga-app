# O que falta fazer

## 1. Ações no Supabase (precisam de você no PC)

O Supabase pede um clique de **"aprovar"** na tela do Claude para cada mudança no banco. No celular esse pedido se cancela sozinho em menos de 1 segundo, por isso isso só dá certo com você no **app do PC**, com a tela do Claude aberta e parada.

Ordem (o Claude faz tudo; você só aprova cada pedido):

1. Aplicar `0003_social.sql` (amigos, DMs, arquivos, reações)
2. Aplicar `0004_aprovacao.sql` (aprovação de contas e administrador)
3. Aplicar `0005_termos.sql` (registro do aceite dos termos)
4. Publicar a função `notificar` (avisos de DM, chamadas e novos cadastros)
5. Publicar a função `turn`
6. Conferir: `holmgds@gmail.com` é administrador e aprovado; as outras contas continuam aprovadas

## 2. Publicar no GitHub

**Só depois** do item 1. O site novo usa tabelas e funções que ainda não existem no banco; se for publicado antes, o app no ar quebra para todo mundo.

Hoje o código novo está salvo na branch `etapa-3-pronta`. Quando o banco estiver pronto, ela entra na `main` e o GitHub Pages publica sozinho em poucos minutos. Depois, o Claude testa o app no ar.

## 3. Ajustes depois de publicar

- **Notificações para o administrador:** para receber o aviso de novos cadastros no celular, ative as notificações do Descarga nesse aparelho.
- **Ícone na tela inicial:** o ícone reforçado (fundo cheio, versão para Android) só chega ao celular após publicar. Quem já adicionou à tela inicial pode precisar remover e adicionar de novo para ver o novo ícone.

## 4. Pendências antigas

- **Servidor de apoio das calls (TURN):** crie conta grátis no **ExpressTURN** (sem cartão). Mande no chat só o **servidor** e o **usuário**. A **senha** vai pelo campo seguro que o Claude abrir (`TURN_PASSWORD`); nunca cole no chat. O Claude coloca `turn_urls` e `turn_username` na configuração. Se algum site pedir cartão ou PayPal, pare e avise.
- **Login com Google** (opcional, escondido por enquanto): precisa criar credenciais no Google Cloud.
- **E-mail próprio para os avisos de cadastro** e **domínio próprio** (opcionais).
- **Revisão jurídica dos Termos de Uso** (recomendada antes de divulgar).
