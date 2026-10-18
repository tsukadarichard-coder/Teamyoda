/* Scouts do treinador importados pelo atleta: só com link válido, token nunca devolvido, revogação e vencimento respeitados,
   cada atleta só vê os seus. Rode: node tests/check-scouts-integrados.js */
const path = require("path"), assert = require("assert");
const fx = path.join(__dirname, "../netlify/functions/");

/* Firestore em memória, por caminho */
const store = {}; let seq = 0;
const J = (v) => JSON.parse(JSON.stringify(v));
function merge(a, b) { const o = { ...a }; for (const k of Object.keys(b)) o[k] = b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) ? merge(a[k] || {}, b[k]) : b[k]; return o; }
function docRef(p) {
  return {
    id: p.split("/").pop(),
    async get() { const v = store[p]; return { exists: v !== undefined, id: p.split("/").pop(), data: () => J(v) }; },
    async set(v, o) { store[p] = o && o.merge ? merge(store[p] || {}, J(v)) : J(v); },
    async update(v) { Object.assign(store[p], J(v)); },
    async delete() { delete store[p]; },
    collection: (c) => colRef(p + "/" + c),
  };
}
function colRef(p, filtros = [], lim) {
  const ids = () => Object.keys(store).filter((k) => k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/")).filter((k) => filtros.every(([c, v]) => store[k][c] === v));
  return {
    doc: (id) => docRef(p + "/" + id),
    async add(v) { const id = "doc" + String(++seq).padStart(12, "0"); store[p + "/" + id] = J(v); return docRef(p + "/" + id); },
    where: (c, op, v) => colRef(p, filtros.concat([[c, v]]), lim),
    limit: (n) => colRef(p, filtros, n),
    async get() { let l = ids(); if (lim) l = l.slice(0, lim); const docs = l.map((k) => ({ id: k.split("/").pop(), ref: docRef(k), data: () => J(store[k]) })); return { empty: !docs.length, docs, forEach: (f) => docs.forEach(f) }; },
  };
}
const admin = { firestore: () => ({ collection: (n) => colRef(n) }), auth: () => ({}) };
const tokens = {};
class ErroPublico extends Error { constructor(s, m) { super(m); this.status = s; } }
const fakePlayer = {
  admin, ErroPublico, OPCOES: {}, resposta: (statusCode, corpo) => ({ statusCode, body: JSON.stringify(corpo) }),
  usuarioDoPedido: async (ev) => { const t = ev.headers.authorization; if (!tokens[t]) throw new ErroPublico(401, "login"); return tokens[t]; },
  refJogador: (uid) => docRef("jogadores/" + uid),
};
require.cache[require.resolve(fx + "_player.js")] = { id: "x", filename: "x", loaded: true, exports: fakePlayer };
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin, app: () => {} } };
const scouts = require(fx + "player-scouts.js").handler;
const competicao = require(fx + "player-competicao.js").handler;
const privacidade = require(fx + "player-privacidade.js").handler;

const hoje = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const mais = (n) => new Date(Date.parse(hoje + "T12:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const TOKEN = "T".repeat(32);
const resumo = { atleta: "Ana", data: hoje, torneio: "Copa X", resultado: "6-4 6-3", concluida: true, n: 40, ganhos: 25, pctGanhos: 63, bolas: { pctCurtos: 60 }, numeros: { errosNos: 5 }, zonas: { "D-FUNDO": { n: 8, ganhos: 5 } }, serie: [[1, 0], [0, 0]], sinais: ["x"] };
function academia(comp) { store["orgs/o1/dados/mty:alunos:v2"] = { value: JSON.stringify([{ id: "al1", nome: "Ana Souza", registros: [{ id: "r1", tipo: "jogo", compartilhado: comp }] }]) }; }
const link = (t = TOKEN) => "https://app.exemplo.com.br/scout/?org=o1&id=al1&j=r1&t=" + t;
function pessoa(uid, papel) { tokens[uid] = { uid, email: uid + "@t.com", name: uid }; store["jogadores/" + uid] = { nome: uid, competicao: { papel, nascimento: "2000-01-01" } }; }
const S = async (uid, corpo) => { const r = await scouts({ httpMethod: corpo ? "POST" : "GET", headers: { authorization: uid }, body: corpo ? JSON.stringify(corpo) : undefined }); return { s: r.statusCode, raw: r.body, ...JSON.parse(r.body) }; };

(async () => {
  pessoa("ana", "atleta"); pessoa("bia", "atleta"); pessoa("trein", "treinador");
  academia({ token: TOKEN, ate: mais(10), publico: resumo });
  assert.strictEqual((await S("trein")).s, 403, "só atleta");
  assert.strictEqual((await S("ana", { acao: "importar", link: "isto não é um link" })).s, 404);
  assert.strictEqual((await S("ana", { acao: "importar", link: link("curto") })).s, 404);
  assert.strictEqual((await S("ana", { acao: "importar", link: "https://x.com/outra-pagina?org=o1&id=al1&j=r1&t=" + TOKEN })).s, 404, "só endereços /scout/");
  assert.strictEqual((await S("ana", { acao: "importar", link: link("W".repeat(32)) })).s, 404, "token errado");

  /* importar com link válido */
  const imp = await S("ana", { acao: "importar", link: link() });
  assert.strictEqual(imp.s, 200); assert.strictEqual(imp.atualizado, false);
  let lista = await S("ana");
  assert.strictEqual(lista.scouts.length, 1); assert.strictEqual(lista.scouts[0].estado, "ativo"); assert.strictEqual(lista.scouts[0].resumo.atleta, "Ana");
  for (const proibido of [TOKEN, "org", "o1", "al1", "fonte", "Souza"]) assert.ok(!lista.raw.includes(proibido), "vazou na lista: " + proibido);
  assert.ok(!imp.raw.includes(TOKEN));
  /* importar de novo = mesmo registro */
  const imp2 = await S("ana", { acao: "importar", link: link() });
  assert.strictEqual(imp2.id, imp.id); assert.strictEqual(imp2.atualizado, true);
  assert.strictEqual((await S("ana")).scouts.length, 1, "sem duplicar");
  /* outro atleta não vê nada */
  assert.strictEqual((await S("bia")).scouts.length, 0);
  assert.strictEqual((await S("bia", { acao: "excluir", id: imp.id })).s, 404);
  assert.strictEqual((await S("bia", { acao: "vincular", id: imp.id, torneioId: "x" })).s, 404);

  /* vincular só a dados do próprio atleta */
  store["jogadores/ana/torneios/torneio0001"] = { nome: "Copa X", inicio: hoje, fim: hoje };
  store["jogadores/bia/torneios/torneio0002"] = { nome: "Da Bia", inicio: hoje, fim: hoje };
  store["jogadores/ana/partidas/partida0001"] = { data: hoje, resultado: "vitoria" };
  assert.strictEqual((await S("ana", { acao: "vincular", id: imp.id, torneioId: "torneio0002" })).s, 404, "torneio de outra conta");
  assert.strictEqual((await S("ana", { acao: "vincular", id: imp.id, torneioId: "torneio0001", partidaId: "partida0001" })).s, 200);
  lista = await S("ana"); assert.strictEqual(lista.scouts[0].torneioId, "torneio0001"); assert.strictEqual(lista.scouts[0].partidaId, "partida0001");
  assert.strictEqual((await S("ana", { acao: "vincular", id: imp.id })).s, 400);

  /* o treinador do vínculo vê o scout (área partidas) e só enquanto o link vale */
  store["vinculos/vinculo0001"] = { atletaUid: "ana", atletaNome: "ana", tipo: "treinador", status: "ativo", areas: ["perfil", "partidas"], pessoaUid: "trein", pessoaNome: "trein", criadoEm: "2026-01-01", historico: [] };
  const ver = async () => { const r = await competicao({ httpMethod: "GET", headers: { authorization: "trein" }, queryStringParameters: { ver: "vinculo0001" } }); return { s: r.statusCode, raw: r.body, ...JSON.parse(r.body) }; };
  let v = await ver();
  assert.strictEqual(v.s, 200); assert.strictEqual(v.dados.scouts.length, 1); assert.ok(!v.raw.includes(TOKEN) && !v.raw.includes('"fonte"'));
  store["vinculos/vinculo0001"].areas = ["perfil"];
  assert.ok(!("scouts" in (await ver()).dados), "sem a área partidas, sem scouts");
  store["vinculos/vinculo0001"].areas = ["perfil", "partidas"];

  /* o treinador desativa o link: some para o atleta e para quem ele compartilhou */
  academia(null);
  lista = await S("ana");
  assert.strictEqual(lista.scouts[0].estado, "encerrado"); assert.ok(!("resumo" in lista.scouts[0]), "nada de conteúdo");
  assert.strictEqual((await ver()).dados.scouts.length, 0);
  assert.strictEqual((await S("ana", { acao: "importar", link: link() })).s, 404, "não importa link desativado");
  /* link vencido */
  academia({ token: TOKEN, ate: mais(-1), publico: resumo });
  assert.strictEqual((await S("ana")).scouts[0].estado, "encerrado");
  /* link novo (outro token) da mesma partida reativa o mesmo registro */
  const NOVO = "N".repeat(32);
  academia({ token: NOVO, ate: mais(30), publico: { ...resumo, resultado: "7-5 6-2" } });
  const reimp = await S("ana", { acao: "importar", link: link(NOVO) });
  assert.strictEqual(reimp.id, imp.id); lista = await S("ana");
  assert.strictEqual(lista.scouts.length, 1); assert.strictEqual(lista.scouts[0].estado, "ativo"); assert.strictEqual(lista.scouts[0].resumo.resultado, "7-5 6-2");
  assert.strictEqual(lista.scouts[0].partidaId, "partida0001", "vínculo preservado");

  /* dados exportados nunca levam a origem do link */
  const exp = await privacidade({ httpMethod: "GET", headers: { authorization: "ana" } });
  assert.ok(!exp.body.includes(NOVO) && !exp.body.includes('"fonte"') && !exp.body.includes('"hash"'), "exportação vazou a origem");
  assert.ok(exp.body.includes('"scouts"'));
  /* limite de tentativas inválidas por dia */
  for (let i = 0; i < 10; i++) assert.strictEqual((await S("bia", { acao: "importar", link: link("Z".repeat(32)) })).s, 404);
  assert.strictEqual((await S("bia", { acao: "importar", link: link(NOVO) })).s, 429, "bloqueada depois de 10 falhas");
  /* excluir */
  assert.strictEqual((await S("ana", { acao: "excluir", id: imp.id })).s, 200);
  assert.strictEqual((await S("ana")).scouts.length, 0);
  console.log("check-scouts-integrados: ok");
})().catch((e) => { console.error(e); process.exit(1); });
