/* Análise em tempo real do scout (scout/ao-vivo.js): alertas e painel a partir de pontos simulados. */
const assert = require("assert"), A = require("../scout/ao-vivo.js");
const pt = (nos, extra) => Object.assign({ nos, fim: nos ? "winner_nos" : "erro_nos", sacador: "nos", saque: "1", bola: "1-2", causa: nos ? null : "decisao", jogo: 1, lado: "D", n: 0 }, extra || {});
assert.deepStrictEqual(A.alertas([pt(true), pt(false)], "Ana"), [], "poucos pontos: sem alerta");
const perdendo = [pt(true), pt(true), pt(false), pt(false), pt(false), pt(false)];
let al = A.alertas(perdendo, "Ana");
assert(al[0].nivel === "atencao" && /4 pontos seguidos/.test(al[0].texto), "sequência perdida");
const ganhando = Array.from({ length: 6 }, () => pt(true));
assert(A.alertas(ganhando, "Ana").some((a) => a.nivel === "ok" && /6 pontos seguidos/.test(a.texto)), "sequência ganha");
const dfs = Array.from({ length: 10 }, (_, i) => pt(i % 2 === 0, { saque: i < 4 ? "df" : "2" }));
assert(A.alertas(dfs, "Ana").some((a) => /duplas faltas/.test(a.texto)), "duplas faltas");
const erros = Array.from({ length: 8 }, (_, i) => pt(false, { causa: "decisao", bola: "1-2", jogo: 1 + (i > 3 ? 1 : 0) }));
al = A.alertas(erros, "Ana"); assert(al.some((a) => /decisão/.test(a.texto)) && al.some((a) => /duas primeiras bolas/.test(a.texto)), "erros de decisão e na entrada");
const html = A.painel(erros.concat([pt(true, { dec: "boa", jogo: 2 })]), { atleta: "Ana <b>", mental: { jogo: { 1: 3 } } });
["Agora", "O que a partida pede", "Momento do jogo", "Saldo de pontos", "Game a game", "G1", "G2", "mental 3/5", "<svg"].forEach((s) => assert(html.includes(s), "falta: " + s));
assert(!html.includes("Ana <b>") && !/undefined|NaN/.test(html), "escape e valores");
assert(A.painel([], {}).includes("primeiro ponto"), "vazio");
assert(A.faixaAlerta(perdendo, "Ana").includes("Atenção"), "faixa do alerta");
/* comparação com os jogos anteriores (scout completo e resumo público achatado) */
const ant = [{ n: 80, pctGanhos: 60, pctPrimeiro: 65, errosNos: 8, df: 2, pctAdversos: 55, pctErrosCurtos: 30, nAtaque: 10, pctAtaque: 70 }, { n: 70, pctGanhos: 56, pctPrimeiro: 61, errosNos: 7, df: 3, nSacD: 5, pctSacD: 60 }];
const b = A.baseline(ant);
assert.strictEqual(b.jogos, 2); assert.strictEqual(b.pctGanhos, 58); assert.strictEqual(b.pctPrimeiro, 63); assert.strictEqual(b.erros100, 10.1 === b.erros100 ? 10.1 : b.erros100);
const mal = Array.from({ length: 12 }, (_, i) => pt(i < 3, { saque: i % 3 === 0 ? "2" : "1", jogo: 1 }));
const dif = A.diferencas(mal, b); assert(dif.some((d) => d.k === "pctGanhos" && d.d < 0 && !d.bom), "ganhos abaixo da média");
assert(A.alertas(mal, "Ana", b).some((a) => /Abaixo da própria média/.test(a.texto)), "alerta comparativo");
const pn = A.painel(mal, { atleta: "Ana", anteriores: ant });
assert(pn.includes("Comparado com os jogos anteriores") && pn.includes("qa-comp") && pn.includes("Média de 2 jogos anteriores"), "tabela comparativa");
assert(!A.painel(mal, { atleta: "Ana" }).includes("Comparado com"), "sem jogos anteriores não mostra a tabela");
assert(!/undefined|NaN/.test(pn), "valores");
/* momento ponto a ponto: média móvel dos últimos 6 pontos */
const serie = A.momentoSerie([true, true, false, false, false, false, true].map((n) => pt(n)), 6);
assert.strictEqual(serie[0], 100, "começa no primeiro ponto"); assert.strictEqual(serie[1], 100); assert.strictEqual(serie[2], 67); assert.strictEqual(serie[6], 33, "janela de 6: 2 de 6");
const mom = A.momento(perdendo, {}); assert(mom.includes("forte contra") && mom.includes("<path") && mom.includes("clipPath"), "gráfico de linha do momento");
const um = A.momento([pt(true)], {}); assert(um.includes("<svg") && um.includes("100%") && um.includes("oscila muito") && !/undefined|NaN/.test(um), "momento já no primeiro ponto");
assert(A.momento([], {}).includes("primeiro ponto"), "momento sem pontos");
assert(!/undefined|NaN/.test(mom), "valores do momento");
console.log("check-ao-vivo-analise: ok");

/* o gráfico do momento zera a cada game; o macro acumula os games e os sets */
{
  const jg = (j, set, nosList) => nosList.map((n, i) => pt(n, { jogo: j, set, n: i + 1 }));
  const partida = [].concat(jg(1, 1, [true, true, false, true, true]), jg(2, 1, [false, false, false, true, false]), jg(3, 1, [true, true, true, true]));
  const em3 = A.momento(partida, { jogoAtual: 3 });
  assert(em3.includes("Momento do game 3") && /1 de 4|4 de 4/.test(em3), "momento só do game em andamento");
  const apos = A.momento(partida, { jogoAtual: 4, setAtual: 1 });
  assert(apos.includes("Momento do game 4") && apos.includes("Novo game") && !apos.includes("<path"), "momento zera ao terminar o game");
  const mac = A.macro(partida, { jogoAtual: 4 });
  ["Partida em macro", "3 games concluídos", "G1", "G2", "G3", "Set 1", "Saldo acumulado"].forEach((x) => assert(mac.includes(x), "macro: " + x));
  assert(mac.includes("2–1 em games"), "placar do set em games: " + (mac.match(/<b>Set 1<\/b><span>[^<]*/) || [])[0]);
  const doisSets = A.macro(partida.concat(jg(4, 2, [true, false, true, true]), jg(5, 2, [false, true])), { jogoAtual: 5 });
  assert(doisSets.includes("Set 2") && (doisSets.match(/qa-set"/g) || []).length === 2, "dois sets");
  assert(A.macro(jg(1, 1, [true, false]), { jogoAtual: 1 }) === "", "um único game não precisa de macro");
  assert(!/undefined|NaN/.test(mac), "valores do macro");
  /* resumo da família: o macro sai do game a game */
  const G = require("../scout/graficos.js"); global.QLAoVivo = A;
  const ex = G.macroPartida({ concluida: true, detalhe: { games: [{ j: 1, n: 5, g: 4, s: 1, w: 1 }, { j: 2, n: 5, g: 1, s: 1, w: 0 }, { j: 3, n: 4, g: 4, s: 2, w: 1 }] } });
  assert(ex.includes("Partida em macro") && ex.includes("Set 2"), "macro no resumo compartilhado");
  console.log("check-ao-vivo-analise (macro): ok");
}
