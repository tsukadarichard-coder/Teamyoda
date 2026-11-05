/* Canal da turma e do aluno (netlify/functions/canal.js) sobre um Firestore em memória:
   · professor (token com orgId) e aluno (link com token ou conta da Área do aluno) entram só onde podem;
   · grupo aberto da turma: todos leem e escrevem; conversa do aluno só com o professor;
   · apagar (o aluno só as próprias; o professor qualquer), silenciar, "só o professor escreve", limite de mensagens seguidas;
   · "meus" (canais do aluno) e "resumo" (professor); as duas cópias da function são iguais. Rode: node tests/check-canal.js */
const assert = require("assert"), fs = require("fs"), path = require("path");
const raiz = path.join(__dirname, "../.."), fx = path.join(raiz, "netlify/functions/");
assert.strictEqual(fs.readFileSync(fx + "canal.js", "utf8"), fs.readFileSync(path.join(raiz, "autonomo/netlify/functions/canal.js"), "utf8"), "as duas cópias de canal.js são iguais");
assert.strictEqual(fs.readFileSync(path.join(raiz, "autonomo/canal-aluno.js"), "utf8"), fs.readFileSync(path.join(raiz, "mty/canal-aluno.js"), "utf8"), "as duas cópias de canal-aluno.js são iguais");

const store = {}; const J = (v) => JSON.parse(JSON.stringify(v)); let seq = 0;
function docRef(p) { return { id: p.split("/").pop(), collection: (n) => colRef(p + "/" + n), async get() { const v = store[p]; return { exists: v !== undefined, id: p.split("/").pop(), data: () => J(v) }; }, async set(v, o) { store[p] = o && o.merge ? { ...(store[p] || {}), ...J(v) } : J(v); }, async delete() { delete store[p]; } }; }
function colRef(p, f = [], ord = null, lim = 0) {
  return {
    doc: (id) => docRef(p + "/" + id), where: (c, o, v) => colRef(p, f.concat([[c, v]]), ord, lim), orderBy: (c, d) => colRef(p, f, [c, d || "asc"], lim), limit: (n) => colRef(p, f, ord, n),
    async add(v) { const id = "m" + String(++seq).padStart(6, "0"); store[p + "/" + id] = J(v); return docRef(p + "/" + id); },
    async get() {
      let ks = Object.keys(store).filter((k) => k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/")).filter((k) => f.every(([c, v]) => store[k][c] === v));
      if (ord) ks.sort((a, b) => (String(store[a][ord[0]]) < String(store[b][ord[0]]) ? -1 : String(store[a][ord[0]]) > String(store[b][ord[0]]) ? 1 : a < b ? -1 : 1) * (ord[1] === "desc" ? -1 : 1));
      if (lim) ks = ks.slice(0, lim);
      const d = ks.map((k) => ({ id: k.split("/").pop(), ref: docRef(k), data: () => J(store[k]) }));
      return { docs: d, empty: !d.length, size: d.length, forEach: (g) => d.forEach(g) };
    },
  };
}
const tokens = { prof: { uid: "p1", orgId: "org1", name: "Paula Lima", email: "p@x" }, outro: { uid: "p9", orgId: "org2", name: "Zé" }, contaAna: { uid: "ua" } };
const admin = { firestore: () => ({ collection: (n) => colRef(n) }), auth: () => ({ verifyIdToken: async (t) => { if (!tokens[t]) throw new Error("x"); return tokens[t]; } }) };
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin, app: () => {} } };
const avisos = [];
require.cache[require.resolve(fx + "_push.js")] = { id: "z", filename: "z", loaded: true, exports: { avisar: async (a, filtro, aviso) => { avisos.push({ filtro, aviso }); return {}; } } };
const { handler } = require(fx + "canal.js");

store["orgs/org1/dados/mty:alunos:v2"] = { value: JSON.stringify([{ id: "a1", nome: "Ana Souza", linkToken: "tA" }, { id: "a2", nome: "Beto Lima", linkToken: "tB" }, { id: "a3", nome: "Caio Reis", linkToken: "tC" }]) };
store["orgs/org1/dados/mty:turmas:v1"] = { value: JSON.stringify([{ id: "t1", nome: "Sub-12", membros: ["a1", "a2"], professorUid: "p1" }]) };
store["contasAluno/ua"] = { vinculo: { status: "ativo", orgId: "org1", alunoId: "a1" } };

const chamar = async (corpo, tk) => { const r = await handler({ httpMethod: "POST", headers: tk ? { authorization: "Bearer " + tk } : {}, body: JSON.stringify(corpo) }); return { status: r.statusCode, ...JSON.parse(r.body) }; };
const ana = { link: { org: "org1", id: "a1", t: "tA" } }, beto = { link: { org: "org1", id: "a2", t: "tB" } }, caio = { link: { org: "org1", id: "a3", t: "tC" } };

(async () => {
  /* acesso */
  assert.strictEqual((await chamar({ acao: "listar", canal: "turma:t1" })).status, 401);
  assert.strictEqual((await chamar({ acao: "listar", canal: "turma:t1", link: { org: "org1", id: "a1", t: "errado" } })).status, 404);
  assert.strictEqual((await chamar({ acao: "listar", canal: "turma:t1", ...caio })).status, 403, "Caio não é da turma");
  assert.strictEqual((await chamar({ acao: "listar", canal: "aluno:a2", ...ana })).status, 403, "Ana não lê a conversa do Beto");
  assert.strictEqual((await chamar({ acao: "listar", canal: "turma:t1" }, "outro")).status, 404, "professor de outra academia");
  assert.strictEqual((await chamar({ acao: "listar", canal: "nada" }, "prof")).status, 400);

  /* grupo aberto: professor, Ana e Beto escrevem e todos veem */
  let r = await chamar({ acao: "enviar", canal: "turma:t1", texto: "Treino de sábado confirmado às 9h." }, "prof");
  assert.strictEqual(r.status, 200); assert.strictEqual(r.mensagem.autor.nome, "Paula");
  assert(avisos.some((a) => a.filtro.app === "aluno" && a.filtro.alunoId === "a1") && avisos.some((a) => a.filtro.alunoId === "a2"), "avisa os alunos da turma");
  avisos.length = 0;
  r = await chamar({ acao: "enviar", canal: "turma:t1", texto: "Vou levar a minha raquete nova!", ...ana });
  assert.strictEqual(r.mensagem.autor.nome, "Ana");
  assert(avisos.some((a) => a.filtro.alunoId === "a2") && !avisos.some((a) => a.filtro.alunoId === "a1"), "avisa o Beto, não a própria Ana");
  assert(avisos.some((a) => a.filtro.app === "treinador" && a.filtro.uid === "p1"), "avisa o professor da turma");
  r = await chamar({ acao: "enviar", canal: "turma:t1", texto: "Posso chegar 9h10?", comoResponsavel: true, ...beto });
  assert.strictEqual(r.mensagem.autor.nome, "Responsável de Beto");
  r = await chamar({ acao: "listar", canal: "turma:t1", ...beto });
  assert.deepStrictEqual(r.mensagens.map((m) => m.autor.nome), ["Paula", "Ana", "Responsável de Beto"]);
  assert.deepStrictEqual(r.mensagens.map((m) => m.minha), [false, false, true]);
  assert.strictEqual(r.nome, "Sub-12");
  assert.deepStrictEqual(r.participantes.map((p) => p.nome), ["Ana", "Beto"]);
  assert(!JSON.stringify(r).includes("Souza"), "o grupo só mostra o primeiro nome");
  /* conta da Área do aluno também entra */
  r = await chamar({ acao: "listar", canal: "turma:t1" }, "contaAna");
  assert.strictEqual(r.status, 200); assert.strictEqual(r.mensagens.length, 3);

  /* apagar: o Beto não apaga a mensagem da Ana; a Ana apaga a dela; o professor apaga qualquer uma */
  const idAna = r.mensagens[1].id, idBeto = r.mensagens[2].id;
  assert.strictEqual((await chamar({ acao: "apagar", canal: "turma:t1", mensagemId: idAna, ...beto })).status, 403);
  assert.strictEqual((await chamar({ acao: "apagar", canal: "turma:t1", mensagemId: idAna, ...ana })).status, 200);
  assert.strictEqual((await chamar({ acao: "apagar", canal: "turma:t1", mensagemId: idBeto }, "prof")).status, 200);
  r = await chamar({ acao: "listar", canal: "turma:t1" }, "prof");
  assert.deepStrictEqual(r.mensagens.map((m) => [m.apagada, m.texto]), [[false, "Treino de sábado confirmado às 9h."], [true, ""], [true, ""]]);

  /* moderação */
  assert.strictEqual((await chamar({ acao: "silenciar", canal: "turma:t1", alunoId: "a2", sim: true, ...ana })).status, 403, "aluno não modera");
  assert.strictEqual((await chamar({ acao: "silenciar", canal: "turma:t1", alunoId: "a2", sim: true }, "prof")).status, 200);
  r = await chamar({ acao: "enviar", canal: "turma:t1", texto: "oi", ...beto });
  assert.strictEqual(r.status, 403); assert(/pausou/.test(r.erro));
  assert((await chamar({ acao: "listar", canal: "turma:t1", ...beto })).silenciado);
  await chamar({ acao: "silenciar", canal: "turma:t1", alunoId: "a2", sim: false }, "prof");
  assert.strictEqual((await chamar({ acao: "enviar", canal: "turma:t1", texto: "voltei", ...beto })).status, 200);
  await chamar({ acao: "modo", canal: "turma:t1", soProfessor: true }, "prof");
  r = await chamar({ acao: "enviar", canal: "turma:t1", texto: "oi", ...ana });
  assert.strictEqual(r.status, 403); assert(/só o professor/.test(r.erro));
  assert.strictEqual((await chamar({ acao: "enviar", canal: "turma:t1", texto: "Aviso: quadra 2 amanhã." }, "prof")).status, 200, "o professor continua escrevendo");
  await chamar({ acao: "modo", canal: "turma:t1", soProfessor: false }, "prof");

  /* validações e limite de mensagens seguidas */
  assert.strictEqual((await chamar({ acao: "enviar", canal: "turma:t1", texto: "   ", ...ana })).status, 400);
  assert.strictEqual((await chamar({ acao: "enviar", canal: "turma:t1", texto: "x".repeat(1001), ...ana })).status, 400);
  let ult; for (let i = 0; i < 21; i++) ult = await chamar({ acao: "enviar", canal: "aluno:a1", texto: "msg " + i, ...ana });
  assert.strictEqual(ult.status, 429, "limite de mensagens seguidas");

  /* conversa individual e listas */
  r = await chamar({ acao: "listar", canal: "aluno:a1", ...ana });
  assert.strictEqual(r.nome, "Conversa com o professor"); assert.strictEqual(r.mensagens.length, 20);
  r = await chamar({ acao: "meus", ...ana });
  assert.deepStrictEqual(r.canais.map((c) => c.canal), ["aluno:a1", "turma:t1"]);
  assert(r.canais[1].ultima && r.canais[1].total >= 4);
  r = await chamar({ acao: "meus", ...caio });
  assert.deepStrictEqual(r.canais.map((c) => c.canal), ["aluno:a3"]);
  r = await chamar({ acao: "resumo" }, "prof");
  assert(r.canais["turma:t1"] && r.canais["aluno:a1"].total === 20);
  assert.strictEqual((await chamar({ acao: "resumo", ...ana })).status, 403);
  console.log("check-canal: ok");
})().catch((e) => { console.error(e); process.exit(1); });
