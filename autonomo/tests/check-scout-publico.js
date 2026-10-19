/* Link da família do scout: só abre com o token certo, dentro da validade, e só devolve o resumo limpo. Rode: node tests/check-scout-publico.js */
const path = require("path"), assert = require("assert");
const fx = path.join(__dirname, "../netlify/functions/");
let dados = null;
const fake = { admin: { firestore: () => ({ collection: () => ({ doc: () => ({ collection: () => ({ doc: () => ({ get: async () => ({ exists: dados !== null, data: () => ({ value: JSON.stringify(dados) }) }) }) }) }) }) }) }, app: () => {} };
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "x", filename: "x", loaded: true, exports: fake };
const { handler } = require(fx + "scout-publico.js");
const hoje = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const mais = (n) => new Date(Date.parse(hoje + "T12:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const TOKEN = "a".repeat(32);
const publico = { atleta: "Ana", data: hoje, torneio: "Copa X", resultado: "6-4 6-3", concluida: true, n: 40, ganhos: 25, pctGanhos: 63, adversario: "NUNCA", obs: "NUNCA",
  bolas: { pctCurtos: 60, pctMedios: 30, pctLongos: 10, pctAte4: 90, extra: 1 }, numeros: { errosNos: 5, df: 1 }, zonas: { "D-FUNDO": { n: 8, ganhos: 5 }, "X-INVALIDA": { n: 1, ganhos: 1 } },
  serie: [[1, 0], [0, 0], [1, 9]], sinais: ["Leitura <b>1</b>"] };
function alunos(comp) { return [{ id: "al1", nome: "Ana Souza Lima", registros: [{ id: "r1", tipo: "jogo", adversario: "Adversário Secreto", compartilhado: comp }, { id: "r2", tipo: "jogo" }] }, { id: "al2", nome: "Outro", registros: [] }]; }
const chama = async (q) => { const r = await handler({ httpMethod: "GET", queryStringParameters: q }); return { s: r.statusCode, h: r.headers, ...JSON.parse(r.body) }; };
(async () => {
  dados = alunos({ token: TOKEN, ate: mais(10), publico });
  const base = { org: "o1", id: "al1", j: "r1", t: TOKEN };
  const ok = await chama(base);
  assert.strictEqual(ok.s, 200); assert.strictEqual(ok.h["cache-control"], "no-store");
  assert.strictEqual(ok.publico.atleta, "Ana"); assert.strictEqual(ok.publico.n, 40);
  assert.deepStrictEqual(Object.keys(ok.publico.zonas), ["D-FUNDO"], "zona inválida sai");
  assert.deepStrictEqual(ok.publico.serie, [[1, 0], [0, 0], [1, 4]], "set limitado");
  assert.ok(!("extra" in ok.publico.bolas));
  const bruto = JSON.stringify(ok);
  for (const proibido of ["NUNCA", "Adversário Secreto", "Souza", "token", TOKEN]) assert.ok(!bruto.includes(proibido), "vazou: " + proibido);
  assert.strictEqual((await chama({ ...base, t: "b".repeat(32) })).s, 404, "token errado");
  assert.strictEqual((await chama({ ...base, t: "curto" })).s, 404);
  assert.strictEqual((await chama({ ...base, j: "r2" })).s, 404, "partida sem compartilhamento");
  assert.strictEqual((await chama({ ...base, id: "al2" })).s, 404, "outro aluno");
  assert.strictEqual((await chama({ org: "o1", id: "al1", t: TOKEN })).s, 404, "link incompleto");
  dados = alunos({ token: TOKEN, ate: mais(-1), publico });
  assert.strictEqual((await chama(base)).s, 404, "vencido");
  dados = alunos(null);
  assert.strictEqual((await chama(base)).s, 404, "revogado");
  dados = null;
  assert.strictEqual((await chama(base)).s, 404, "academia inexistente");
  assert.strictEqual((await handler({ httpMethod: "POST", queryStringParameters: base })).statusCode, 405);
  console.log("check-scout-publico: ok");
})().catch((e) => { console.error(e); process.exit(1); });

/* contagem ponto a ponto: o terceiro e o quarto item são opcionais e saneados */
{
  const { limpar } = require("../netlify/functions/_scout-publico");
  const r = limpar({ serie: [[1, 0, "30-15", "winner_nos"], [0, 0, "<b>Game 1-0 muito longo demais</b>", "invalido"], [1, 1]] });
  assert.deepStrictEqual(r.serie[0], [1, 0, "30-15", "winner_nos"]);
  assert.strictEqual(r.serie[1][2].length, 14, "contagem limitada");
  assert.strictEqual(r.serie[1][3], "", "fim fora da lista é descartado");
  assert.deepStrictEqual(r.serie[2], [1, 1], "link antigo continua com dois itens");
  console.log("contagem ponto a ponto ok");
}

/* qualidade da devolução e nível do adversário: só valores da lista e números */
{
  const { limpar } = require("../netlify/functions/_scout-publico");
  const r = limpar({ nivelAdversario: "avancado", detalhe: { devolucao: { nos: { n: 5, e: 1, q: { boa: { n: 2, g: 1, x: 9 }, estranha: { n: 7 } } }, ele: { n: 3, e: 0 } } } });
  assert.strictEqual(r.nivelAdversario, "avancado");
  assert.deepStrictEqual(r.detalhe.devolucao.nos.q, { boa: { n: 2, g: 1 }, regular: { n: 0, g: 0 }, fraca: { n: 0, g: 0 } });
  assert.strictEqual(limpar({ nivelAdversario: "<script>" }).nivelAdversario, "", "nível fora da lista é descartado");
  console.log("qualidade da devolução e nível ok");
}

/* mental, decisões e games */
{
  const { limpar } = require("../netlify/functions/_scout-publico");
  const r = limpar({ mental: { antes: { conf: 4, foco: 9, x: 3 }, depois: { calma: "2" }, jogo: { 1: 5, 2: 0, 99: 3, abc: 2 } },
    detalhe: { decisoes: { boa: { n: 2, g: 1 }, tosca: { n: 5 } }, games: [{ j: 1, n: 4, g: 2, boa: 1, disc: 0, ruim: 1, extra: 7 }] } });
  assert.deepStrictEqual(r.mental.antes, { conf: 4, foco: 0, energia: 0, calma: 0 });
  assert.strictEqual(r.mental.depois.calma, 2);
  assert.deepStrictEqual(r.mental.jogo, { 1: 5 });
  assert.deepStrictEqual(r.detalhe.decisoes.boa, { n: 2, g: 1 }); assert.ok(!r.detalhe.decisoes.tosca);
  assert.deepStrictEqual(r.detalhe.games[0], { j: 1, n: 4, g: 2, boa: 1, disc: 0, ruim: 1, s: 0, w: 0 });
  console.log("mental, decisões e games ok");
}
