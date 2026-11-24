# Design novo ("Tinta") e como voltar ao antigo

Em 24 de novembro de 2026 o visual do Descarga foi redesenhado, mantendo **todas** as funções.

## O que mudou
- **Painéis flutuantes**: barra de canais, conversa e lista de membros viram cartões arredondados sobre um fundo mais escuro.
- **Ícones de servidor "squircle"** com animação de mola; avatares arredondados; menus, janelas e avisos com entrada suave.
- **Fontes**: Bricolage Grotesque (títulos, nomes) e Plus Jakarta Sans (texto). Ficam dentro do app (pacotes `@fontsource-variable/*`), funcionam sem internet.
- **Tema novo "Tinta"** (padrão para quem nunca escolheu fundo). Os outros 11 fundos continuam.
- **Celular**: barra de abas embaixo (Início, Conversas, Servidores, Você) nas telas de lista.
- Animações respeitam "reduzir movimento" do aparelho (`prefers-reduced-motion`).

## Como funciona por dentro
- Todo o visual novo está em `web/src/design-novo.css`, escopado em `html[data-design='novo']`. O `styles.css` antigo não foi alterado.
- A escolha fica no aparelho (`localStorage` `descarga-design`: `novo` ou `classico`), em Configurações > Aparência e idioma.
- Barra de abas: `web/src/components/MobileTabs.tsx` (escondida no clássico).

## Como voltar ao visual antigo
1. **Só para você**: Configurações > Aparência e idioma > **Design clássico**.
2. **Para todo mundo**: em `web/src/lib/design.ts`, trocar o padrão de `'novo'` para `'classico'` (função `getDesign`).
3. **Código antigo completo**: branch `layout-antigo` no GitHub (cópia do projeto antes do redesign). Para restaurar de vez: `git checkout layout-antigo -- web/src` e publicar.
