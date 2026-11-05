# Desenvolvimento

## Rodar no seu computador
Precisa do Node.js 20+.
```bash
cd web
npm install
npm run dev
```
Sem configurar nada, abre em modo demonstração. Para o servidor de verdade, copie `web/.env.example` para `.env.local` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

## Verificações
```bash
cd web
npx tsc -b        # tipos
npx oxlint src    # qualidade do código
```

## Testes automáticos
Foram feitos com Playwright no modo demonstração (três roteiros): fluxo completo (43 verificações), social (23) e aprovação/termos (12). Todos passavam antes do último commit. Os roteiros ficam fora do repositório; se quiser, o Claude pode incluí-los em `web/tests/`.

Para testar a aprovação no modo demonstração, defina no navegador `localStorage['descarga-demo-aprovacao'] = '1'`; o administrador demo é o e-mail `holmgds@gmail.com`.

## Textos em inglês
O texto em português é a chave: `t('Texto em português')`. As traduções ficam em `web/src/lib/i18n.en.ts`. Todo texto novo precisa de uma linha lá.

## Publicar
O GitHub Pages publica a cada `push` na `main` (`.github/workflows/deploy.yml`). **Antes**, confira se as migrações do Supabase que o código novo usa já foram aplicadas.

## Commits
Os commits entram com autor `Claude <noreply@anthropic.com>`.
