/* Área do aluno do Team Yoda: acesso por e-mail sem link (netlify/functions/digital.js, pedido do Richard em 17/11/2026).
   · o professor cadastra até 2 e-mails na ficha (emailsAcesso); "Primeiro acesso" cria a conta só para e-mail que está numa ficha,
     com a mesma resposta para qualquer e-mail; o professor convida só aluno da própria unidade e só e-mail já salvo na ficha;
   · quem entra com o e-mail CONFIRMADO vê o aluno e abre o Meu plano sem link; e-mail não confirmado não vê nada;
   · tirar o e-mail da ficha corta o acesso; o link do aluno continua valendo como antes. Rode: node tests/check-acesso-email.js */
const assert = require("assert"), path = require("path");
const fx = path.join(__dirname, "../../netlify/functions/");
const store = {}; const J = (v) => JSON.parse(JSON.stringify(v));
function docRef(p) { return { id: p.split("/").pop(), collection: (n) => colRef(p + "/" + n), async get() { const v = store[p]; return { exists: v !== undefined, id: p.split("/").pop(), data: () => J(v) }; }, async set(v, o) { store[p] = o && o.merge ? { ...(store[p] || {}), ...J(v) } : J(v); } }; }
function colRef(p, f = []) {
  return {
    doc: (id) => docRef(p + "/" + id), where: (c, o, v) => colRef(p, f.concat([[c, o, v]])), limit: () => colRef(p, f),
    async get() {
      const ks = Object.keys(store).filter((k) => k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/"))
        .filter((k) => f.every(([c, o, v]) => (o === "array-contains" ? (store[k][c] || []).includes(v) : store[k][c] === v)));
      const d = ks.map((k) => ({ id: k.split("/").pop(), ref: docRef(k), data: () => J(store[k]) }));
      return { docs: d, size: d.length, empty: !d.length, forEach: (g) => d.forEach(g) };
    },
  };
}
const usuarios = {}; let uidSeq = 0;
const tokens = { prof: { uid: "p1", orgId: "team-yoda", role: "treinador", email: "prof@ty.com" }, prof39: { uid: "p2", orgId: "39-ranch", role: "treinador", email: "prof@39.com" } };
const admin = {
  firestore: () => ({ collection: (n) => colRef(n) }),
  auth: () => ({
    verifyIdToken: async (t) => { if (tokens[t]) return tokens[t]; throw new Error("x"); },
    getUserByEmail: async (email) => { const uid = Object.keys(usuarios).find((u) => usuarios[u] === email); if (!uid) { const e = new Error("no user record"); e.code = "auth/user-not-found"; throw e; } return { uid, email }; },
    createUser: async ({ email }) => { if (Object.values(usuarios).includes(email)) { const e = new Error("exists"); e.code = "auth/email-already-exists"; throw e; } const uid = "u" + (++uidSeq); usuarios[uid] = email; return { uid }; },
  }),
};
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin, app: () => {} } };
const D = require(fx + "digital.js");
const chamar = async (metodo, corpo, tk) => { const r = await D.handler({ httpMethod: metodo, headers: tk ? { authorization: "Bearer " + tk } : {}, body: corpo ? JSON.stringify(corpo) : null, queryStringParameters: {} }); return { status: r.statusCode, ...JSON.parse(r.body) }; };
const alunos = (org, l) => { store["orgs/" + org + "/dados/mty:alunos:v2"] = { value: JSON.stringify(l) }; };
alunos("team-yoda", [
  { id: "a1", nome: "Ana Souza", linkToken: "tA", emailsAcesso: ["Mae.Ana@Exemplo.com", "ana@exemplo.com"] },
  { id: "a2", nome: "Beto Souza", linkToken: "tB", emailsAcesso: ["mae.ana@exemplo.com"] },
  { id: "a3", nome: "Caio Lima", linkToken: "tC" },
  { id: "a4", nome: "Duda Reis", emailsAcesso: ["duda@exemplo.com"] },
]);
alunos("39-ranch", [{ id: "r1", nome: "Rui Costa", linkToken: "tR", emailsAcesso: ["rui@exemplo.com", "x", "y@z.com", "w@z.com"] }]);
const entrar = (email, confirmado) => { const uid = Object.keys(usuarios).find((u) => usuarios[u] === email); tokens["tk-" + email] = { uid, email, email_verified: confirmado }; return "tk-" + email; };

(async () => {
  assert.deepStrictEqual(D.interno.emailsDoAluno({ emailsAcesso: ["rui@exemplo.com", "x", "y@z.com", "w@z.com"] }), ["rui@exemplo.com", "y@z.com"], "até 2 e-mails válidos");

  /* Primeiro acesso: a mesma resposta para qualquer e-mail; conta só para e-mail de ficha */
  let r = await chamar("POST", { acao: "primeiroAcesso", email: "ninguem@exemplo.com" });
  assert.deepStrictEqual([r.status, r.ok], [200, true]);
  assert.strictEqual(Object.values(usuarios).length, 0, "e-mail fora das fichas não cria conta");
  assert.strictEqual((await chamar("POST", { acao: "primeiroAcesso", email: "nao-e-email" })).status, 400);
  r = await chamar("POST", { acao: "primeiroAcesso", email: " MAE.ANA@exemplo.com " });
  assert.deepStrictEqual([r.status, r.ok], [200, true]);
  assert.deepStrictEqual(Object.values(usuarios), ["mae.ana@exemplo.com"], "conta criada para o e-mail da ficha");
  const uidMae = Object.keys(usuarios)[0];
  assert.strictEqual(store["digitalContas/" + uidMae].criadaPor, "acesso-por-email");
  assert.strictEqual((await chamar("POST", { acao: "primeiroAcesso", email: "mae.ana@exemplo.com" })).status, 200, "pedir de novo não quebra");
  assert.strictEqual(Object.values(usuarios).length, 1);

  /* e-mail ainda não confirmado: não vê os alunos */
  let tk = entrar("mae.ana@exemplo.com", false);
  r = await chamar("GET", null, tk);
  assert.strictEqual(r.unidades.length, 0, "sem e-mail confirmado, nenhum aluno"); assert.strictEqual(r.emailConfirmado, false);
  assert.strictEqual((await chamar("POST", { acao: "meuLink", org: "team-yoda", alunoId: "a1" }, tk)).status, 403);

  /* confirmado: vê os dois filhos e abre o Meu plano sem link */
  tk = entrar("mae.ana@exemplo.com", true);
  r = await chamar("GET", null, tk);
  assert.deepStrictEqual(r.unidades.map((u) => [u.alunoId, u.nome, u.linkAtual, u.porEmail]), [["a1", "Ana", true, true], ["a2", "Beto", true, true]]);
  assert.strictEqual(r.acesso.tipo, "unidade");
  r = await chamar("POST", { acao: "meuLink", org: "team-yoda", alunoId: "a2" }, tk);
  assert.strictEqual(r.url, "/aluno.html?org=team-yoda&id=a2&t=tB");
  assert.strictEqual((await chamar("POST", { acao: "meuLink", org: "team-yoda", alunoId: "a3" }, tk)).status, 403, "aluno sem o e-mail: não abre");
  assert.strictEqual((await chamar("POST", { acao: "meuLink", org: "39-ranch", alunoId: "r1" }, tk)).status, 403, "outra unidade: não abre");

  /* conta ligada pelo link e também pelo e-mail: aparece uma vez só, e o link trocado não corta quem tem o e-mail */
  store["digitalContas/" + uidMae].vinculos = [{ org: "team-yoda", alunoId: "a1", desde: "x", marca: "velha" }];
  store["digitalContas/" + uidMae].vinculoChaves = ["team-yoda:a1"];
  r = await chamar("GET", null, tk);
  assert.deepStrictEqual(r.unidades.map((u) => [u.alunoId, u.linkAtual]), [["a1", true], ["a2", true]]);

  /* aluno sem link ainda: aparece, mas pede para o professor liberar */
  await chamar("POST", { acao: "primeiroAcesso", email: "duda@exemplo.com" });
  const tkD = entrar("duda@exemplo.com", true);
  r = await chamar("GET", null, tkD);
  assert.deepStrictEqual(r.unidades.map((u) => [u.alunoId, u.linkAtual]), [["a4", false]]);
  assert.strictEqual((await chamar("POST", { acao: "meuLink", org: "team-yoda", alunoId: "a4" }, tkD)).status, 409);

  /* tirar o e-mail da ficha corta o acesso */
  alunos("team-yoda", [
    { id: "a1", nome: "Ana Souza", linkToken: "tA", emailsAcesso: ["ana@exemplo.com"] },
    { id: "a2", nome: "Beto Souza", linkToken: "tB", emailsAcesso: ["mae.ana@exemplo.com"] },
    { id: "a3", nome: "Caio Lima", linkToken: "tC" },
  ]);
  r = await chamar("GET", null, tk);
  assert.deepStrictEqual(r.unidades.map((u) => [u.alunoId, u.linkAtual, !!u.porEmail]), [["a1", false, false], ["a2", true, true]], "a1 volta a depender do link");
  assert.strictEqual((await chamar("POST", { acao: "meuLink", org: "team-yoda", alunoId: "a1" }, tk)).status, 409);

  /* convite do professor: só aluno da própria unidade e só e-mail salvo na ficha */
  assert.strictEqual((await chamar("POST", { acao: "convidarAluno", alunoId: "a1", email: "ana@exemplo.com" }, "tk-duda@exemplo.com")).status, 403, "aluno não convida");
  assert.strictEqual((await chamar("POST", { acao: "convidarAluno", alunoId: "a1", email: "ana@exemplo.com" }, "prof39")).status, 404, "outra unidade");
  assert.strictEqual((await chamar("POST", { acao: "convidarAluno", alunoId: "a1", email: "outro@exemplo.com" }, "prof")).status, 409, "e-mail fora da ficha");
  r = await chamar("POST", { acao: "convidarAluno", alunoId: "a1", email: "ANA@exemplo.com" }, "prof");
  assert.deepStrictEqual([r.status, r.ok], [200, true]);
  assert.ok(Object.values(usuarios).includes("ana@exemplo.com"), "conta criada pelo convite");

  /* o link do aluno continua como antes */
  usuarios.u99 = "pai@exemplo.com"; tokens["tk-pai"] = { uid: "u99", email: "pai@exemplo.com", email_verified: false };
  r = await chamar("POST", { acao: "vincular", link: { org: "team-yoda", id: "a3", t: "tC" } }, "tk-pai");
  assert.strictEqual(r.status, 200);
  r = await chamar("POST", { acao: "meuLink", org: "team-yoda", alunoId: "a3" }, "tk-pai");
  assert.strictEqual(r.url, "/aluno.html?org=team-yoda&id=a3&t=tC");
  console.log("check-acesso-email: ok");
})().catch((e) => { console.error(e); process.exit(1); });
