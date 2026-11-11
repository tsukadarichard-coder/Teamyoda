/* Alto rendimento · registro do atleta em viagem (netlify/functions/ar-atleta.js) sobre um Firestore em memória:
   link do aluno como credencial; atleta fora do alto rendimento; semana atual e conteúdos; registro de treino e jogo entra no
   marcador e na carga (origem viagem, a confirmar); conteúdo que não é do plano é ignorado; data futura ou antiga recusada;
   limite por dia; link trocado corta. Rode: node tests/check-ar-atleta.js */
const assert = require("assert"), path = require("path");
const fx = path.join(__dirname, "../../netlify/functions/");
const store = {}; const J = (v) => JSON.parse(JSON.stringify(v));
function docRef(p) { return { id: p.split("/").pop(), collection: (n) => colRef(p + "/" + n), async get() { const v = store[p]; return { exists: v !== undefined, id: p.split("/").pop(), data: () => J(v) }; },
  async set(v, o) { store[p] = o && o.merge ? { ...(store[p] || {}), ...J(v) } : J(v); } }; }
function colRef(p, f = [], ord = null, lim = 0) {
  return {
    doc: (id) => docRef(p + "/" + id), where: (c, o, v) => colRef(p, f.concat([[c, o, v]]), ord, lim), orderBy: (c, d) => colRef(p, f, [c, d], lim), limit: (n) => colRef(p, f, ord, n),
    async get() {
      let ks = Object.keys(store).filter((k) => k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/")).filter((k) => f.every(([c, o, v]) => store[k][c] === v));
      if (ord) ks.sort((a, b) => (store[a][ord[0]] < store[b][ord[0]] ? -1 : 1) * (ord[1] === "desc" ? -1 : 1));
      if (lim) ks = ks.slice(0, lim);
      const d = ks.map((k) => ({ id: k.split("/").pop(), data: () => J(store[k]) }));
      return { docs: d, size: d.length, empty: !d.length, forEach: (g) => d.forEach(g) };
    },
  };
}
const admin = { firestore: () => ({ collection: (n) => colRef(n) }) };
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin, app: () => {} } };
const { handler } = require(fx + "ar-atleta.js");
const AR = require(fx + "_alto-rendimento.js");
const chama = async (m, corpo, q) => { const r = await handler({ httpMethod: m, body: corpo ? JSON.stringify(corpo) : null, queryStringParameters: q || {} }); return { s: r.statusCode, ...JSON.parse(r.body) }; };
const hoje = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

store["orgs/team-yoda/dados/mty:alunos:v2"] = { value: JSON.stringify([{ id: "a1", nome: "Ana Souza", linkToken: "tA" }, { id: "a2", nome: "Rui", linkToken: "tR" }]) };
const cal = [{ id: "t1", nome: "Copa", inicio: AR.somaDias(hoje, -2), fim: AR.somaDias(hoje, 2), prioridade: "secundario" }];
const plano = AR.gerarPlano({ calendario: cal, inicio: AR.somaDias(hoje, -7), semanas: 8, minutosSemana: 600, prioridades: ["fundo", "saque"] });
store["orgs/team-yoda/ar/a1"] = { ativo: true, calendario: cal, plano, progresso: { cumpridos: {} }, cargaSemanas: {} };

(async () => {
  assert.strictEqual((await chama("GET", null, { org: "team-yoda", id: "a1", t: "errado" })).s, 404, "link errado");
  assert.strictEqual((await chama("GET", null, { org: "x", id: "a1", t: "tA" })).s, 400);
  assert.deepStrictEqual((await chama("GET", null, { org: "team-yoda", id: "a2", t: "tR" })).ativo, false, "fora do alto rendimento");
  let g = await chama("GET", null, { org: "team-yoda", id: "a1", t: "tA" });
  assert.strictEqual(g.s, 200); assert.strictEqual(g.ativo, true);
  assert.strictEqual(g.status.v, "torneio"); assert.strictEqual(g.semana.n, 2);
  assert(g.semana.conteudos.length && g.semana.conteudos.some((c) => c.tipo === "fora_do_ct"), "semana de torneio com os jogos");
  const jogos = g.semana.conteudos.find((c) => c.tipo === "fora_do_ct");

  /* registra um jogo e um treino */
  let p = await chama("POST", { org: "team-yoda", id: "a1", t: "tA", registro: { tipo: "jogo", minutos: 110, pse: 8, torneioId: "t1", conteudosFeitos: [jogos.id, "inventado"], jogo: { adversario: "Lia", placar: "6/3 6/4", resultado: "vitoria" } } });
  assert.strictEqual(p.s, 200, JSON.stringify(p)); assert.strictEqual(p.registro.ua, 880);
  const regs = Object.keys(store).filter((k) => k.startsWith("orgs/team-yoda/ar/a1/registros/")).map((k) => store[k]);
  assert.strictEqual(regs.length, 1);
  assert.deepStrictEqual([regs[0].origem, regs[0].autor, regs[0].confirmado, regs[0].torneioId], ["viagem", "atleta", false, "t1"]);
  assert.deepStrictEqual(regs[0].conteudosFeitos, [jogos.id], "conteúdo fora do plano é ignorado");
  assert.strictEqual(store["orgs/team-yoda/ar/a1"].progresso.cumpridos[jogos.id].vezes, 1, "marcador atualizado");
  assert.strictEqual(store["orgs/team-yoda/ar/a1"].cargaSemanas[AR.chaveSemana(hoje)].ua, 880, "carga da semana");
  p = await chama("POST", { org: "team-yoda", id: "a1", t: "tA", registro: { tipo: "treino", minutos: 60, pse: 4, data: AR.somaDias(hoje, -1) } });
  assert.strictEqual(p.s, 200); assert.strictEqual(p.registros.length, 2);
  assert.strictEqual((await chama("POST", { org: "team-yoda", id: "a1", t: "tA", registro: { tipo: "treino", minutos: 60, pse: 4, data: AR.somaDias(hoje, 1) } })).s, 400, "data futura");
  assert.strictEqual((await chama("POST", { org: "team-yoda", id: "a1", t: "tA", registro: { tipo: "treino", minutos: 60, pse: 4, data: AR.somaDias(hoje, -40) } })).s, 400, "data antiga");
  assert.strictEqual((await chama("POST", { org: "team-yoda", id: "a1", t: "tA", registro: { tipo: "treino", pse: 4 } })).s, 400, "sem minutos");
  assert.strictEqual((await chama("POST", { org: "team-yoda", id: "a2", t: "tR", registro: { tipo: "treino", minutos: 30, pse: 4 } })).s, 403, "fora do alto rendimento não registra");
  for (let i = 0; i < 7; i++) await chama("POST", { org: "team-yoda", id: "a1", t: "tA", registro: { tipo: "treino", minutos: 10, pse: 2 } });
  assert.strictEqual((await chama("POST", { org: "team-yoda", id: "a1", t: "tA", registro: { tipo: "treino", minutos: 10, pse: 2 } })).s, 429, "limite por dia");
  /* link trocado corta */
  store["orgs/team-yoda/dados/mty:alunos:v2"] = { value: JSON.stringify([{ id: "a1", nome: "Ana Souza", linkToken: "tA2" }]) };
  assert.strictEqual((await chama("GET", null, { org: "team-yoda", id: "a1", t: "tA" })).s, 404);
  assert.strictEqual((await chama("PUT", {})).s, 405);
  console.log("check-ar-atleta: ok");
})().catch((e) => { console.error(e); process.exit(1); });
