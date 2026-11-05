# Como o Descarga funciona por dentro

## As peças

| Peça | Para que serve | Custo |
|---|---|---|
| **App** (React + TypeScript + Vite, pasta `web/`) | A tela que você vê, no navegador, no PC e no celular | grátis |
| **GitHub Pages** | Hospeda o site. Cada `push` na `main` publica sozinho | grátis |
| **Supabase** | Contas, banco de dados, arquivos, tempo real e funções do servidor | plano grátis |
| **Calls** | Vão direto de aparelho a aparelho (WebRTC). Um servidor de apoio (TURN) só entra quando a rede atrapalha | grátis |

## Modo demonstração

Sem as chaves do Supabase, o app abre em **modo demonstração**: tudo fica só no navegador. Serve para testar e é nele que rodam os testes automáticos.

## Segurança (o que o banco garante)

A regra de verdade fica **no banco de dados**, não só na tela. Mesmo que alguém mexa no app pelo navegador, o banco recusa o que não é permitido.

- **RLS (segurança por linha):** cada tabela só mostra e aceita o que a pessoa pode ver e fazer.
- **Funções seguras:** ações sensíveis (abrir DM, pedir amizade, aprovar conta) são funções do banco que conferem permissão antes.
- **Permissões por coluna:** a pessoa só consegue editar as colunas do próprio perfil que devem ser editáveis. Aprovação e "é administrador" ficam fora do alcance dela.
- **Arquivos:** fotos de perfil ficam em um espaço público (`media`); anexos de conversas ficam em um espaço **privado** (`anexos`, até 50 MB) e só quem participa da conversa lê.
- **Notificações:** função `notificar` (envia push) e função `turn` (entrega o servidor de apoio das calls só a contas aprovadas).

## Limites honestos

- As mensagens **não têm criptografia de ponta a ponta**. Quem administra o banco tecnicamente tem acesso. Isso está dito nos Termos de Uso.
- Calls não são gravadas pelo app.
- Plano grátis do Supabase tem limites de armazenamento e de uso; se o app crescer, pode ser preciso revisar.

## Estrutura das pastas

```
web/                  o app
  src/lib/            conexão com o Supabase, modo demonstração, textos (inglês), termos
  src/components/     telas e componentes (chat, amigos, DMs, painel de administração...)
  public/             logo, ícones, emojis, service worker (notificações)
supabase/migrations/  banco de dados, segurança e tempo real (0001 a 0005)
supabase/functions/   notificar e turn
docs/                 esta documentação
```

## Migrações do banco

| Arquivo | O que faz | Estado |
|---|---|---|
| `0001_etapa1.sql` | Base: perfis, servidores, canais, mensagens, convites | aplicada |
| `0002_etapa2.sql` | Calls, notificações, menções | aplicada |
| `0003_social.sql` | Amigos, DMs e grupos, reações, emojis, anexos, confirmação de leitura | **pendente** |
| `0004_aprovacao.sql` | Aprovação de contas e administrador | **pendente** |
| `0005_termos.sql` | Registro do aceite dos Termos de Uso | **pendente** |

A ordem importa: 0003 → 0004 → 0005.
