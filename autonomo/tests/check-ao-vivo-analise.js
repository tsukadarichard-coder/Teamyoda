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
["Agora", "O que a partida pede", "Ponto a ponto", "Game a game", "G1", "G2", "mental 3/5", "<svg"].forEach((s) => assert(html.includes(s), "falta: " + s));
assert(!html.includes("Ana <b>") && !/undefined|NaN/.test(html), "escape e valores");
assert(A.painel([], {}).includes("primeiro ponto"), "vazio");
assert(A.faixaAlerta(perdendo, "Ana").includes("Atenção"), "faixa do alerta");
console.log("check-ao-vivo-analise: ok");
