/* Gráficos do resumo do scout: renderiza com dados completos e vazios, escapa texto, e a página pública carrega o arquivo. */
const assert = require("assert"), fs = require("fs"), path = require("path");
const G = require("../scout/graficos.js");
const det = { fins: { winner_nos: 8, erro_dele: 5, erro_nos: 6, winner_dele: 4 }, golpes: { forehand: { n: 10, w: 5, e: 3, c: 2 }, smash: { n: 2, w: 2, e: 0, c: 0 } }, direcao: { cruzado: { n: 6, g: 4, c: 1 }, paralelo: { n: 3, g: 1, c: 0 } }, corrida: { n: 4, g: 1 },
  saqueDir: { nos: { aberto: { n: 4, g: 3, a: 1 }, fechado: { n: 2, g: 1, a: 0 }, corpo: { n: 0, g: 0, a: 0 } }, ele: { aberto: { n: 0, g: 0, a: 0 }, fechado: { n: 0, g: 0, a: 0 }, corpo: { n: 0, g: 0, a: 0 } } },
  decisoes: { boa: { n: 6, g: 5 }, disc: { n: 3, g: 1 }, ruim: { n: 2, g: 0 } }, games: [{ j: 1, n: 6, g: 4, boa: 2, disc: 1, ruim: 0 }, { j: 2, n: 8, g: 3, boa: 1, disc: 1, ruim: 2 }], situacoes: { neutra: { n: 5, g: 2 }, construcao: { n: 3, g: 2 } }, devolucao: { nos: { n: 8, e: 2, q: { boa: { n: 3, g: 2 }, regular: { n: 2, g: 1 }, fraca: { n: 1, g: 0 } } }, ele: { n: 6, e: 1 } } };
const p = { atleta: "Ana <b>", n: 23, ganhos: 14, pctGanhos: 61, numeros: { errosDecisao: 2, errosExec: 4, pctPrimeiro: 62, aces: 1, acesAdv: 0, df: 1, nSacD: 3, pctSacD: 66, nSacE: 3, pctSacE: 33 }, detalhe: det, mental: { antes: { conf: 3, foco: 4, energia: 5, calma: 2 }, depois: { conf: 4, foco: 4, energia: 3, calma: 3 }, jogo: { 1: 4, 2: 2 } }, torneio: "Copa X", nivelAdversario: "intermediario", observacaoFinal: "Boa <script>x</script> evolução" };
const html = G.topo(p) + G.secoes(p);
["Como os pontos terminaram", "Saque", "Lado da quadra", "Neutra", "Construção", "Smash", "Cruzado", "Paralelo", "Bolas na corrida", "Decisões de Ana", "Game a game", "Avaliação mental", "Controle emocional", "Devolução de saque", "Qualidade da devolução", "Intermediário", "Torneio", "Observação do treinador", "Ver como tabela"].forEach(t => assert(html.includes(t), "falta: " + t));
assert(!html.includes("<script>") && !html.includes("Ana <b>"), "texto sem escape");
assert(html.includes("61%"), "donut");
const vazio = { atleta: "Ana", n: 0, ganhos: 0, pctGanhos: 0, numeros: {} };
assert.strictEqual(G.secoes(vazio), "");
assert(!G.observacao(vazio));
const pub = fs.readFileSync(path.join(__dirname, "../scout/index.html"), "utf8");
assert(pub.includes("graficos.js") && pub.includes("graficos.css"));
["../competicao/index.html", "../player/index.html"].forEach(f => assert(fs.readFileSync(path.join(__dirname, f), "utf8").includes("scout/graficos.js"), f));
console.log("check-scout-graficos: ok");
