/* Scout: lado do saque, saque do adversário, ace e tipo de ponto. Extrai as funções puras do index.html. Rode: node tests/check-scout-saque.js */
const fs = require("fs"), assert = require("assert"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
function trecho(ini, fim) { const a = src.indexOf(ini), b = src.indexOf(fim, a); assert.ok(a > 0 && b > a, "trecho: " + ini); return src.slice(a, b); }
const codigo = [
  'const PONTOS_TENIS = ["0", "15", "30", "40"];',
  trecho("function placarInicial(", "/* placar adverso"),
  trecho("function gamesParaSet(", "const FIM_PONTO"),
  trecho("function resume(pontos)", "function leitura(r)"),
  trecho("function leitura(r)", "\n}\n") + "\n}\n",
].join("\n");
const { placarInicial, aplicaPonto, quemSaca, ladoDoSaque, resume, leitura } = new Function(codigo + "; return { placarInicial, aplicaPonto, quemSaca, ladoDoSaque, resume, leitura };")();

/* lado: pontos somados pares = igualdade (D), ímpares = vantagem (E) */
let e = placarInicial("1set", "nos", false, false);
assert.strictEqual(ladoDoSaque(e), "D"); assert.strictEqual(quemSaca(e), "nos");
e = aplicaPonto(e, true); assert.strictEqual(ladoDoSaque(e), "E");
e = aplicaPonto(e, false); assert.strictEqual(ladoDoSaque(e), "D");
/* game fecha: troca o sacador e volta ao lado da igualdade */
for (let i = 0; i < 3; i++) e = aplicaPonto(e, true);
assert.strictEqual(e.g[0], 1); assert.strictEqual(quemSaca(e), "ele"); assert.strictEqual(ladoDoSaque(e), "D");
/* 40-40 e vantagem: 6 pontos somados = igualdade, 7 = vantagem */
let d = placarInicial("1set", "nos", false, false);
for (const n of [true, false, true, false, true, false]) d = aplicaPonto(d, n);
assert.deepStrictEqual(d.p, [3, 3]); assert.strictEqual(ladoDoSaque(d), "D");
d = aplicaPonto(d, true); assert.strictEqual(ladoDoSaque(d), "E"); d = aplicaPonto(d, false); assert.strictEqual(ladoDoSaque(d), "D");

/* tie-break: o saque troca a cada dois pontos e o set seguinte começa com o outro jogador */
let t = placarInicial("1set", "nos", false, false);
const jogaGame = (x, nos) => { for (let i = 0; i < 4; i++) x = aplicaPonto(x, nos); return x; };
for (let g = 0; g < 5; g++) { t = jogaGame(t, true); t = jogaGame(t, false); }
t = jogaGame(t, true); t = jogaGame(t, false); // 6-6
assert.ok(t.tiebreak, "tie-break"); const abre = t.saque;
const outro = (x) => (x === "nos" ? "ele" : "nos");
const seq = [];
for (let i = 0; i < 6; i++) { seq.push(quemSaca(t)); t = aplicaPonto(t, i % 2 === 0); }
assert.deepStrictEqual(seq, [abre, outro(abre), outro(abre), abre, abre, outro(abre)], "1 ponto, depois 2 e 2");
assert.strictEqual(ladoDoSaque(placarInicial("1set", "nos")), "D");

/* estatísticas */
const P = (o) => ({ fim: "winner_nos", nos: true, bola: "1-2", causa: null, adverso: false, sacador: "nos", lado: "D", ...o });
const pts = [
  P({ saque: "ace" }), P({ saque: "1", lado: "E" }), P({ saque: "2", nos: false, fim: "winner_dele", lado: "E" }), P({ saque: "df", nos: false, fim: "erro_nos", causa: "execucao" }),
  P({ sacador: "ele", saque: "ace", nos: false, fim: "winner_dele" }), P({ sacador: "ele", saque: "1", lado: "E" }), P({ sacador: "ele", saque: "df", fim: "erro_dele" }),
  P({ sacador: "ele", saque: "2", situacao: "defesa", nos: false, fim: "winner_dele", lado: "E" }), P({ situacao: "ataque" }), P({ situacao: "contra", nos: false, fim: "erro_nos", causa: "decisao" }),
];
const r = resume(pts);
assert.strictEqual(r.aces, 1); assert.strictEqual(r.acesAdv, 1); assert.strictEqual(r.dfAdv, 1); assert.strictEqual(r.df, 1);
assert.strictEqual(r.pctPrimeiro, 33, "1º saque conta só 1, 2 e dupla falta (ace fica fora)"); // 1 de 3
assert.strictEqual(r.nSaqueDele, 4); assert.strictEqual(r.pctPrimeiroAdv, 33);
assert.strictEqual(r.nSacD, 4); assert.strictEqual(r.nSacE, 2); assert.strictEqual(r.nDevD, 2); assert.strictEqual(r.nDevE, 2);
assert.strictEqual(r.pctDevE, 50);
assert.strictEqual(r.nAtaque, 1); assert.strictEqual(r.pctAtaque, 100); assert.strictEqual(r.nContra, 1); assert.strictEqual(r.pctContra, 0); assert.strictEqual(r.nDefesa, 1);
assert.strictEqual(r.pctProtocolo, 0, "protocolo não é mais marcado");
/* jogos antigos continuam lendo */
const antigo = resume([{ fim: "winner_nos", nos: true, bola: "1-2", protocolo: true, rede: true, sacador: "nos", saque: "1" }]);
assert.strictEqual(antigo.pctProtocolo, 100); assert.strictEqual(antigo.pctPrimeiro, 100); assert.strictEqual(antigo.aces, 0);
/* leitura: lado com diferença grande */
const lado = Array.from({ length: 8 }, (_, i) => P({ lado: "D", nos: true })).concat(Array.from({ length: 8 }, () => P({ lado: "E", nos: false, fim: "winner_dele" })));
assert.ok(leitura(resume(lado)).some((s) => /igualdade/.test(s[1])), "sinal de diferença entre os lados do saque");
console.log("check-scout-saque: ok");
/* o resumo público leva os números novos e o servidor os conserva */
const fx = path.join(__dirname, "../netlify/functions/");
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin: {}, app: () => {} } };
const { limpar } = require(fx + "_scout-publico.js");
const pub = limpar({ numeros: { aces: 2, acesAdv: 1, dfAdv: 3, pctPrimeiroAdv: 61, pctSacD: 70, nSacD: 10, pctSacE: 50, nSacE: 8, nAtaque: 4, pctAtaque: 75, segredo: 9 } });
assert.strictEqual(pub.numeros.aces, 2); assert.strictEqual(pub.numeros.pctSacE, 50); assert.strictEqual(pub.numeros.pctAtaque, 75); assert.ok(!("segredo" in pub.numeros));
console.log("check-scout-saque (público): ok");
