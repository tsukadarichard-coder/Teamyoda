# Regras do projeto (Team Yoda · QuadraLab)

- Responder sempre em português.
- **Novidades:** toda entrega visível ao usuário entra na janela de novidades do app correspondente, no mesmo commit:
  - QuadraLab treinador: `NOVIDADES` e `NOVIDADES_VERSAO` em `autonomo/index.html`.
  - Team Yoda: `NOVIDADES_TY` e `NOVIDADES_TY_VERSAO` em `mty/index.html`.
  - Item novo no topo com `novo: true`, `onde` e `aba`; os anteriores perdem o `novo`; trocar a versão para a janela abrir de novo.
- **Publicar** (branch `claude/new-session-feee4c`, que o Netlify publica) só quando o usuário escrever "Publique". Trabalho do dia a dia vai para `claude/39ranch-site-mobile`.
- **Segurança:** não ativar novas cobranças, restringir usuários existentes nem alterar integrações financeiras sem aprovação.
- Os arquivos de `mty/scout/` e `autonomo/scout/` são cópias idênticas (`autonomo/tests/check-sync-scout.js`).

## Congelamento (de 7/11/2026 até 7/2/2027)

Decisão do Richard: parar de construir e testar uma venda só.

- **Manter, só com correção de erro:** app do Team Yoda (`mty/`), Academia Digital, scout e análise de movimento (`scout/`), site do 39 Ranch, Central do dono.
- **Congelado (fica no ar, sem função nova, sem página de venda nova, sem divulgação):** QuadraLab Treinador (`autonomo/` fora de `competicao/` e `painel/`), QuadraLab Player (`autonomo/player/`) e os planos pagos, Hub (`autonomo/hub/`).
- **Em teste (desde 10/11/2026):** QuadraLab Scout, app separado só com o scout (`autonomo/scout-app/`), grátis e sem cobrança nova. Reaproveita o motor do scout (`autonomo/player/scout-motor.js`) e os módulos de `scout/` sem mudar o que eles fazem nos outros apps. Etapas no plano do app. Teste fechado: por enquanto só o Richard usa (quadralab.com.br/scout, fora dos buscadores); sem aviso na janela de novidades, sem link nos outros apps e sem divulgação até ele liberar.
- **Parado (10/11/2026):** Consultoria com Richard Tsukada (`autonomo/competicao/comp-consultoria.js`). Fica no ar como está, sem desligar nada e sem tirar de quem já contratou; sem trabalho novo nem divulgação até o Richard retomar.
- Pedido de função nova em parte congelada ou mantida: lembrar o congelamento e perguntar antes de construir. Correção de erro pode seguir normalmente.
- **Exceção aprovada (8/11/2026):** QuadraLab Treinador 2.0 — só a **Etapa 1 (MVP Liberdade)**: onboarding de 6 perguntas, metas de renda e jornada, painel Minha Liberdade (`autonomo/liberdade.js` + telas no `autonomo/index.html`). Aditivo: não apagar dado nem tela, não mudar o menu atual, nada de cobrança nova nem mudança na Eduzz. Etapas 2 a 4 voltam para aprovação. Plano: https://claude.ai/artifact/BaECVvuPwxZcXnsFkPFZfU
- Regra de corte: a da Consultoria (5 famílias pagantes até 6/1/2027) está suspensa com a pausa. A do QuadraLab Scout está proposta no plano do app e vale quando o Richard confirmar. O app do Team Yoda continua como ferramenta da casa.
- Painel de acompanhamento: https://claude.ai/artifact/NFSAU5ZvTtB2opsKZxbbpj
