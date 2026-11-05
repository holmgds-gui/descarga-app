# Descarga

**No ar:** https://holmgds-gui.github.io/descarga-app/

App de conversa inspirado no Discord: servidores, canais, chat em tempo real, perfil 100% grátis e personalizável — e, nas próximas etapas, voz, vídeo e tela com som.

## O que já funciona (etapa 1)

- Login com e-mail e senha ou com Google
- Servidores: criar, entrar por convite (link ou código), sair
- Canais de texto e de voz, organizados por categoria
- Chat em tempo real: enviar, responder, editar (↑ edita a última), apagar
- Formatação: `**negrito**`, `*itálico*`, `__sublinhado__`, `~~riscado~~`, `` `código` ``, links
- Lista de membros com status (disponível, ausente, não perturbe, invisível) e status personalizado
- Perfil grátis: foto, banner (imagem ou GIF), cor, nome, pronomes, bio, aniversário, cidade e até 5 links
- Aparência: tema escuro, claro e meia-noite, cor do app, tamanho do texto, modo compacto
- Funciona no PC e no celular (layout adaptado)

## O que já funciona (etapa 2)

- Calls de voz direto entre os aparelhos (grátis, até 6 pessoas), sem servidor de mídia
- Câmera e compartilhamento de tela com som, em 720p, 1080p ou 1080p/60fps
- Redução de ruído, "apertar para falar" (tecla configurável) e volume separado para cada pessoa
- Indicador de quem está falando, lista de quem está em cada call na barra lateral
- Som de gotas subindo ao entrar e gotas descendo ao sair (gerados pelo próprio app)
- Menções com `@usuario` (com sugestões ao digitar) e destaque das mensagens para você
- Notificações com o app fechado: menções, respostas e quando alguém entra numa call
- App instalável (PWA): no celular, "Adicionar à Tela de Início"
- Idiomas: português e inglês (detecta o idioma do aparelho; troca em Configurações → Aparência e idioma ou na tela de login)
- Fundos: 11 temas prontos + fundo personalizado

## Documentação completa

Tudo o que foi decidido e construído, explicado passo a passo, está na pasta [`docs/`](docs/README.md). Comece por [`docs/04-pendencias.md`](docs/04-pendencias.md) para ver o que falta fazer.

## Rodar no seu computador

Precisa do [Node.js](https://nodejs.org) 20 ou mais novo.

```bash
cd web
npm install
npm run dev
```

Abra o endereço que aparecer (normalmente http://localhost:5173).

Sem configurar nada, o app abre no **modo demonstração**: tudo fica salvo só no seu navegador. Abra duas abas, crie duas contas e converse entre elas para testar o tempo real.

## Ligar o servidor de verdade (Supabase)

1. Crie uma conta grátis em [supabase.com](https://supabase.com) e um projeto novo (região: São Paulo).
2. No projeto, vá em **SQL Editor**, cole todo o arquivo [`supabase/migrations/0001_etapa1.sql`](supabase/migrations/0001_etapa1.sql) e clique em **Run**.
3. Vá em **Project Settings → API** e copie a **Project URL** e a chave **anon public**.
4. Na pasta `web`, copie `.env.example` para `.env.local` e cole os dois valores.
5. Rode `npm run dev` de novo. Agora as contas e mensagens ficam na nuvem.

### Login com Google

1. No [Google Cloud Console](https://console.cloud.google.com), crie credenciais **OAuth** do tipo "Aplicativo da Web".
2. Em "URIs de redirecionamento autorizados", coloque o endereço que o Supabase mostra em **Authentication → Providers → Google**.
3. Cole o Client ID e o Client Secret nesse mesmo lugar do Supabase e ative.
4. Em **Authentication → URL Configuration**, adicione o endereço do seu site (ex.: `https://descarga.vercel.app`).

## Publicação

O site é publicado sozinho no GitHub Pages a cada `git push` na `main` (veja `.github/workflows/deploy.yml`).

## Colocar no ar na Vercel (opcional)

1. Crie uma conta em [vercel.com](https://vercel.com) entrando com o GitHub.
2. **Add New → Project** e escolha o repositório `descarga-app`.
3. Em **Root Directory**, escolha `web`.
4. Em **Environment Variables**, adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
5. Clique em **Deploy**. Cada `git push` atualiza o site sozinho.

## Próximas etapas

| Etapa | O que entra |
|---|---|
| 3 | Cargos e permissões, amigos e DMs em grupo, tópicos, fóruns, enquetes, reações e emojis próprios, eventos, bots e webhooks, arquivos e áudios, transcrição/tradução, assistir junto, quadro branco, confirmação de leitura |
| 4 | App de PC (Tauri) |
| 5 | App de celular (Android e iPhone) |

## Estrutura

```
web/                 o app (React + TypeScript + Vite)
  src/lib/           conexão com o Supabase e o modo demonstração
  src/components/    telas e componentes
  public/            logo e ícones
supabase/migrations/ banco de dados, segurança e tempo real
supabase/functions/  função que envia as notificações
```
