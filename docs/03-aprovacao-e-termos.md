# Aprovação de contas e Termos de Uso

## Aprovação de contas

**Regra:** toda pessoa que criar conta fica esperando até a conta **holmgds@gmail.com** aprovar. Só essa conta é administradora.

### Como funciona para quem se cadastra
1. Cria a conta (marcando que aceita os Termos de Uso).
2. Vê a tela **"Quase lá!"**, aguardando aprovação. A tela confere sozinha e abre o app quando for aprovada.
3. Se for recusada ou bloqueada, vê **"Acesso não liberado"**.

### Como funciona para o administrador
- Abre **Configurações → Administração** (a aba só existe para essa conta).
- Vê **Aguardando aprovação** (Aprovar / Recusar), **Contas liberadas** (Bloquear) e **Bloqueadas ou recusadas** (Liberar).
- Um número vermelho na engrenagem avisa de novos pedidos; também chega notificação no celular se as notificações estiverem ativas nele.
- A conta do administrador não pode ser bloqueada.

### Garantias no banco
- A conta de administrador é a existente com e-mail `holmgds@gmail.com` (usuário `theguigs`). **Ninguém vira administrador se cadastrando**: existe um índice que só permite um administrador.
- Quem não está aprovado não consegue ver outras pessoas, entrar em servidores, mandar mensagens, abrir DMs nem usar o servidor de calls.
- As 4 contas que já existiam continuam aprovadas. O administrador pode bloquear qualquer uma.
- Não existe "apagar conta" no painel, só bloquear.

## Termos de Uso

Texto completo no app (Configurações → Conta → Termos de Uso, e na tela de login). Fica em `web/src/lib/terms.ts`, em português e inglês.

Temas cobertos:
1. Quem pode usar (18+, conta aprovada pelo administrador)
2. **O que a pessoa compartilha é responsabilidade dela; o app não se responsabiliza por arquivos ou dados impróprios, nos limites da lei**
3. Regras de conduta (conteúdo ilegal, material de abuso infantil, assédio, golpes, vírus, direitos autorais...)
4. Moderação e bloqueio de contas pelo administrador
5. Privacidade e dados (LGPD): o que é guardado, para quê, onde, direitos da pessoa
6. Serviço "como está" e limite de responsabilidade
7. Denúncias e contato: holmgds@gmail.com
8. Mudanças e lei aplicável (Brasil)

### Como o aceite funciona
- No cadastro, caixinha obrigatória "Tenho 18 anos ou mais e li e aceito os Termos de Uso".
- Contas que já existem veem os termos uma vez ao entrar e precisam aceitar.
- Quando o texto mudar de verdade, altere `TERMS_VERSION` em `terms.ts`: todo mundo precisará aceitar de novo.
- O aceite é gravado no banco (versão e data) pela migração 0005; sem ela, fica guardado só no aparelho.

> **Aviso importante:** o Claude não é advogado. Um aviso de "não nos responsabilizamos" **não vale contra tudo**: ordens judiciais de remoção, conteúdo claramente ilegal (como abuso infantil) e direitos dos titulares de dados (LGPD) continuam valendo. Antes de divulgar o app para muita gente, vale uma revisão jurídica dos termos.
