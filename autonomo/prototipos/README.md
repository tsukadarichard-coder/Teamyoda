# Protótipos (uso particular)

- `biomecanica/` — golpe em vídeo (forehand, backhand, saque) → pose (MediaPipe, no navegador) → 6 fases com fotos, checklist, conclusão com intervenções, comparação com a análise anterior e evolução.
- `video-scout/` — jogo em vídeo → pontos separados pelo som das batidas → revisão por clipe → estatísticas, comparação com jogos anteriores, JSON/CSV.

As duas páginas usam os módulos compartilhados de `autonomo/scout/` (`movimento*.js`, `video-*.js`), os mesmos usados dentro do app do treinador (QuadraLab e Team Yoda, aba "Análise de movimento"). O histórico dos protótipos fica no localStorage do navegador.

Testes: `node tests/check-prototipos-biomec.js`, `check-prototipos-video.js`, `check-sync-scout.js`, `check-comparacao-jogos.js`, `smoke-prototipos.js`, `smoke-movimento-app.js`.
