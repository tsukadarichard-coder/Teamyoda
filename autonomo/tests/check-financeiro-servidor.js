/* Function do financeiro (netlify/functions/financeiro.js) com um Firebase falso: só o dono entra, lê as duas academias,
   soma a visão geral e grava só campos conhecidos em financeiro/{org}. Rode: node tests/check-financeiro-servidor.js */
const assert = require("assert"), path = require("path"), Module = require("module");
const banco = {
  "orgs/team-yoda/dados/mty:alunos:v2": [{ id: "a1", nome: "Ana", registros: [] }, { id: "a2", nome: "Bia", registros: [] }],
  "orgs/team-yoda/dados/mty:turmas:v1": [{ id: "t1", nome: "Sub-12", membros: ["a1", "a2"], professorUid: "p1" }],
  "orgs/39-ranch/dados/mty:quadras:v1": [{ id: "q1", nome: "Central", faixasPreco: [{ inicio: "06:00", fim: "23:00", preco: "120" }] }],
  "orgs/39-ranch/dados/mty:reservas:v1": [{ id: "r1", quadraId: "q1", data: "2026-11-10", horaInicio: "08:00", horaFim: "10:00" }],
};
const gravados = {};
const doc = (caminho) => ({
  get: async () => {
    if (caminho.startsWith("financeiro/")) { const v = gravados[caminho]; return { exists: !!v, data: () => v }; }
    const v = banco[caminho]; return { exists: !!v, data: () => ({ value: JSON.stringify(v) }) };
  },
  set: async (v) => { gravados[caminho] = v; },
  collection: (c) => col(caminho + "/" + c),
});
const col = (caminho) => ({ doc: (d) => doc(caminho + "/" + d), where: () => ({ get: async () => [{ id: "p1", data: () => ({ nome: "Leo" }) }] }) });
const adminFalso = {
  apps: [1], app: () => {},
  auth: () => ({ verifyIdToken: async (t) => { if (t === "dono") return { email: "Tsukada.Richard@gmail.com", orgId: "team-yoda" }; if (t === "coord") return { email: "coord@x.com", orgId: "team-yoda", role: "coordenador" }; throw new Error("inválido"); } }),
  firestore: () => ({ collection: (c) => col(c) }),
};
const carregar = Module._load;
Module._load = function (pedido, pai) { if (/_firebase-admin$/.test(pedido)) return { admin: adminFalso, app: () => {} }; return carregar.apply(this, arguments); };
const fn = require(path.join(__dirname, "../../netlify/functions/financeiro.js"));
const chamar = (metodo, token, extra) => fn.handler(Object.assign({ httpMethod: metodo, headers: token ? { authorization: "Bearer " + token } : {}, queryStringParameters: {} }, extra)).then((r) => ({ status: r.statusCode, corpo: JSON.parse(r.body) }));

(async () => {
  assert.strictEqual((await chamar("GET", null)).status, 401, "sem login");
  assert.strictEqual((await chamar("GET", "lixo")).status, 401, "token inválido");
  const c = await chamar("GET", "coord"); assert.strictEqual(c.status, 403, "coordenador não vê"); assert(/só do dono/.test(c.corpo.erro));
  assert.strictEqual((await chamar("POST", "coord", { body: JSON.stringify({ org: "team-yoda", config: {} }) })).status, 403, "coordenador não grava");

  /* grava preços do Team Yoda; lixo e campos desconhecidos são descartados */
  const p = await chamar("POST", "dono", { body: JSON.stringify({ org: "team-yoda", config: {
    turmas: { t1: { preco: "350" }, "x y": { preco: 10 } }, descontos: { "t1:a2": { tipo: "pct", valor: 150 } }, hack: 1,
    despesas: [{ id: "d1", nome: "Aluguel", categoria: "aluguel", valor: 1000 }, { nome: "<b>x</b>", categoria: "??", valor: -5 }],
    meses: { "2026-11": { recebidos: { "m:t1:a1": true, "m:t1:a2": "sim" }, valores: { d1: 0 }, manuais: [{ tipo: "saida", descricao: "Bolas", valor: 99 }] }, "2026-13": { recebidos: { a: true } } },
  } }) });
  assert.strictEqual(p.status, 200);
  const g = gravados["financeiro/team-yoda"].config;
  assert.deepStrictEqual(Object.keys(g.turmas), ["t1"]); assert.strictEqual(g.turmas.t1.preco, 350);
  assert.strictEqual(g.descontos["t1:a2"].valor, 100, "desconto em % limitado a 100"); assert(!("hack" in g));
  assert.strictEqual(g.despesas[1].categoria, "outros"); assert.strictEqual(g.despesas[1].valor, 0);
  assert.deepStrictEqual(g.meses["2026-11"].recebidos, { "m:t1:a1": true }, "só true conta como recebido");
  assert.strictEqual(g.meses["2026-11"].valores.d1, 0, "valor zero do mês é guardado"); assert(!g.meses["2026-13"], "mês inválido some");
  assert.strictEqual((await chamar("POST", "dono", { body: JSON.stringify({ org: "outra", config: {} }) })).status, 400, "só as duas academias");

  /* leitura: as duas academias e a soma */
  const r = await chamar("GET", "dono", { queryStringParameters: { mes: "2026-11" } });
  assert.strictEqual(r.status, 200);
  const ty = r.corpo.academias.find((a) => a.org === "team-yoda"), rc = r.corpo.academias.find((a) => a.org === "39-ranch");
  assert.strictEqual(ty.mes.receitas.mensalidades.total, 350, "Ana 350 + Bia com 100% de desconto");
  assert.strictEqual(ty.mes.despesas.fixas.total, 0, "aluguel zerado só neste mês"); assert.strictEqual(ty.mes.despesas.manuais, 99);
  assert.strictEqual(rc.mes.receitas.quadras.total, 240, "39 Ranch: 2 h de quadra a 120");
  assert.strictEqual(r.corpo.geral.entradas, 590, "visão geral soma as duas");
  assert.deepStrictEqual(r.corpo.historicoGeral.map((h) => h.mes), ["2026-11"], "histórico começa em novembro de 2026");
  const jan = await chamar("GET", "dono", { queryStringParameters: { mes: "2027-02" } });
  assert.deepStrictEqual(jan.corpo.historicoGeral.map((h) => h.mes), ["2026-11", "2026-12", "2027-01", "2027-02"], "depois, os meses desde o início");
  assert(ty.catalogo.turmas[0].membros.length === 2 && ty.catalogo.professores.some((x) => x.nome === "Leo"), "catálogo para precificar");
  assert(!JSON.stringify(r.corpo).includes("registros"), "não devolve os cadastros inteiros");
  console.log("check-financeiro-servidor: ok");
})().catch((e) => { console.error(e); process.exit(1); });
