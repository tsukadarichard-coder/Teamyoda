# Regras do projeto (Team Yoda · QuadraLab)

- Responder sempre em português.
- **Novidades:** toda entrega visível ao usuário entra na janela de novidades do app correspondente, no mesmo commit:
  - QuadraLab treinador: `NOVIDADES` e `NOVIDADES_VERSAO` em `autonomo/index.html`.
  - Team Yoda: `NOVIDADES_TY` e `NOVIDADES_TY_VERSAO` em `mty/index.html`.
  - Item novo no topo com `novo: true`, `onde` e `aba`; os anteriores perdem o `novo`; trocar a versão para a janela abrir de novo.
- **Publicar** (branch `claude/new-session-feee4c`, que o Netlify publica) só quando o usuário escrever "Publique". Trabalho do dia a dia vai para `claude/39ranch-site-mobile`.
- **Segurança:** não ativar novas cobranças, restringir usuários existentes nem alterar integrações financeiras sem aprovação.
- Os arquivos de `mty/scout/` e `autonomo/scout/` são cópias idênticas (`autonomo/tests/check-sync-scout.js`).
