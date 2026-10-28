/* Área do aluno (cadastro-aluno.js + aluno-conta.js), com Firebase em memória:
   · o aluno cria a conta (claim tipo "aluno", sem orgId) e já pede o vínculo pelo código do professor; código errado → 404;
   · antes da aprovação ele não vê nada da academia; o professor vê o pedido, aprova ligando a um jogador da lista dele;
   · depois o aluno vê SÓ o próprio jogador (plano aprovado, análises) e manda dúvida/jogo/feedback como no link;
   · outro treinador não aprova pedido de outra academia; desvincular corta o acesso; jogador removido da lista corta o acesso;
   · o código é o mesmo código fixo do treinador (codigosAcademia). Rode: node tests/check-aluno-conta.js */
const path = require("path"), assert = require("assert");
const fx = path.join(__dirname, "..", "netlify/functions/");
const store = {}; const J = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const campo = (o, c) => c.split(".").reduce((x, k) => (x == null ? undefined : x[k]), o);
function docRef(p) { return { id: p.split("/").pop(), async get() { const v = store[p]; return { exists: v !== undefined, id: p.split("/").pop(), data: () => J(v) }; }, async set(v) { store[p] = J(v); }, collection: (n) => colRef(p + "/" + n) }; }
function colRef(p, f = [], lim = 0) {
  return {
    doc: (id) => docRef(p + "/" + id), where: (c, o, v) => colRef(p, f.concat([[c, v]]), lim), limit: (n) => colRef(p, f, n),
    async get() {
      let ks = Object.keys(store).filter((k) => k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/")).filter((k) => f.every(([c, v]) => campo(store[k], c) === v));
      if (lim) ks = ks.slice(0, lim);
      const d = ks.map((k) => ({ id: k.split("/").pop(), ref: docRef(k), data: () => J(store[k]) }));
      return { docs: d, empty: !d.length, size: d.length };
    },
  };
}
const db = { collection: (n) => colRef(n) };
const usuarios = {}; let nUid = 0;
const auth = {
  async createUser(d) { if (Object.values(usuarios).some((u) => u.email === d.email)) { const e = new Error("x"); e.code = "auth/email-already-exists"; throw e; } const uid = "aluno" + (++nUid) + "xx"; usuarios[uid] = { uid, email: d.email, name: d.displayName, claims: {} }; return usuarios[uid]; },
  async setCustomUserClaims(uid, c) { usuarios[uid].claims = c; },
  async verifyIdToken(t) { const u = usuarios[t]; if (!u) throw new Error("token"); return { uid: u.uid, email: u.email, name: u.name, ...u.claims }; },
};
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin: { firestore: () => db, auth: () => auth }, app: () => {} } };
const cadastro = require(fx + "cadastro-aluno.js").handler, conta = require(fx + "aluno-conta.js").handler;
const cad = async (b) => { const r = await cadastro({ httpMethod: "POST", body: JSON.stringify(b) }); return { s: r.statusCode, d: JSON.parse(r.body) }; };
const get = async (uid, qs) => { const r = await conta({ httpMethod: "GET", headers: { authorization: "Bearer " + uid }, queryStringParameters: qs || {} }); return { s: r.statusCode, d: JSON.parse(r.body) }; };
const post = async (uid, b) => { const r = await conta({ httpMethod: "POST", headers: { authorization: "Bearer " + uid }, body: JSON.stringify(b) }); return { s: r.statusCode, d: JSON.parse(r.body) }; };

/* duas academias: o professor Paulo (org1) com 2 jogadores; a professora Rita (org2) */
usuarios.prof1 = { uid: "prof1", email: "paulo@x.com", name: "Paulo", claims: { orgId: "org1", role: "coordenador" } };
usuarios.prof2 = { uid: "prof2", email: "rita@x.com", name: "Rita", claims: { orgId: "org2", role: "coordenador" } };
const plano = { aprovado: true, tipo: "ciclo", prioridade: "Saque", blocos: [{ nome: "B1", semanasLista: [{ n: 1, foco: "Saque", aulas: [{ t: "Saque 1" }] }] }] };
store["orgs/org1/dados/mty:alunos:v2"] = { value: JSON.stringify([
  { id: "j1", nome: "Lia", horarios: [], plano, regPlano: {}, movimentos: [{ id: "m1", criadoEm: "2026-10-01T10:00:00Z", golpe: "saque", itens: [], res: { ok: 3, atencao: 1, nao: 0 }, texto: "bom", prio: [] }] },
  { id: "j2", nome: "Beto", horarios: [], plano, regPlano: {}, segredo: "não pode vazar" },
]) };

(async () => {
  /* o professor pega o código (gerado uma vez, sempre o mesmo) */
  let r = await get("prof1", { treinador: "1" });
  assert.strictEqual(r.s, 200, JSON.stringify(r.d));
  const codigo = r.d.codigo;
  assert(/^[A-Z0-9]{8}$/.test(codigo) && store["codigosAcademia/" + codigo].orgId === "org1", "código fixo do professor");
  assert.strictEqual((await get("prof1", { treinador: "1" })).d.codigo, codigo, "o código não muda");
  assert.deepStrictEqual(r.d.pedidos, [], "sem pedidos ainda");

  /* cadastro do aluno: validações e código errado */
  assert.strictEqual((await cad({ nome: "Lia", email: "lia@x.com", senha: "123" })).s, 400);
  assert.strictEqual((await cad({ nome: "Lia", email: "lia@x.com", senha: "12345678", codigo: "ZZZZZZZZ" })).s, 404, "código inexistente");
  r = await cad({ nome: "Lia Souza", email: "lia@x.com", senha: "12345678", codigo: codigo.toLowerCase() });
  assert(r.s === 200 && r.d.vinculoPedido && r.d.treinadorNome === "Paulo", JSON.stringify(r.d));
  const lia = Object.values(usuarios).find((u) => u.email === "lia@x.com").uid;
  assert.deepStrictEqual(usuarios[lia].claims, { tipo: "aluno" }, "conta de aluno sem orgId");
  assert.strictEqual((await cad({ nome: "Outra", email: "lia@x.com", senha: "12345678" })).s, 409, "e-mail repetido");

  /* antes da aprovação: só o status, nenhum dado da academia */
  r = await get(lia);
  assert(r.s === 200 && r.d.vinculo.status === "aguardando" && r.d.vinculo.treinadorNome === "Paulo" && !r.d.dados, "aguardando, sem dados");
  assert.strictEqual((await post(lia, { acao: "duvida", texto: "oi" })).s, 403, "sem vínculo não age");

  /* o professor vê o pedido; outra academia não aprova */
  r = await get("prof1", { treinador: "1" });
  assert(r.d.pedidos.length === 1 && r.d.pedidos[0].nome === "Lia Souza" && r.d.pedidos[0].email === "lia@x.com", "pedido aparece para o professor");
  assert.deepStrictEqual((await get("prof2", { treinador: "1" })).d.pedidos, [], "outra academia não vê");
  assert.strictEqual((await post("prof2", { acao: "aprovar", uid: lia, alunoId: "j1" })).s, 404, "outra academia não aprova");
  assert.strictEqual((await post("prof1", { acao: "aprovar", uid: lia, alunoId: "naoexiste" })).s, 400, "jogador precisa existir na lista");
  assert.strictEqual((await post("prof1", { acao: "aprovar", uid: lia, alunoId: "j1" })).s, 200);
  r = await get("prof1", { treinador: "1" });
  assert(r.d.pedidos.length === 0 && r.d.vinculados[0].alunoNome === "Lia", "vinculada a Lia");

  /* o aluno vê só o que é dele */
  r = await get(lia);
  assert(r.s === 200 && r.d.vinculo.status === "ativo" && r.d.dados.nome === "Lia" && r.d.dados.temPlano && r.d.dados.movimentos.length === 1, "dados do próprio jogador");
  assert(!JSON.stringify(r.d).includes("Beto") && !JSON.stringify(r.d).includes("não pode vazar"), "nada de outro jogador");
  r = await post(lia, { acao: "duvida", texto: "Quero treinar o saque" });
  assert.strictEqual(r.s, 200, JSON.stringify(r.d));
  assert.strictEqual(JSON.parse(store["orgs/org1/dados/mty:alunos:v2"].value)[0].pedidosConteudo[0].texto, "Quero treinar o saque", "dúvida chega ao professor");
  assert.strictEqual((await post(lia, { acao: "vincular", codigo })).s, 409, "já vinculada");

  /* desvincular corta o acesso */
  assert.strictEqual((await post("prof1", { acao: "desvincular", uid: lia })).s, 200);
  r = await get(lia); assert(r.d.vinculo.status === "encerrado" && !r.d.dados, "sem acesso depois de desvincular");

  /* novo pedido pelo código (sem ter mandado no cadastro) e jogador removido da lista */
  assert.strictEqual((await post(lia, { acao: "vincular", codigo: "XX" })).s, 400);
  assert.strictEqual((await post(lia, { acao: "vincular", codigo })).s, 200);
  await post("prof1", { acao: "aprovar", uid: lia, alunoId: "j1" });
  const lista = JSON.parse(store["orgs/org1/dados/mty:alunos:v2"].value).filter((a) => a.id !== "j1");
  store["orgs/org1/dados/mty:alunos:v2"] = { value: JSON.stringify(lista) };
  r = await get(lia); assert(r.d.vinculo.status === "encerrado" && !r.d.dados, "jogador removido: sem acesso");

  /* sem login e conta de outra pessoa */
  assert.strictEqual((await conta({ httpMethod: "GET", headers: {}, queryStringParameters: {} })).statusCode, 401);
  r = await cad({ nome: "Caio", email: "caio@x.com", senha: "12345678" });
  const caio = Object.values(usuarios).find((u) => u.email === "caio@x.com").uid;
  r = await get(caio); assert(r.s === 200 && r.d.vinculo === null && !r.d.dados, "conta nova sem vínculo");
  assert.strictEqual((await post("prof1", { acao: "aprovar", uid: caio, alunoId: "j2" })).s, 404, "professor não liga conta que não pediu");
  console.log("check-aluno-conta: ok");
})().catch((e) => { console.error(e); process.exit(1); });
