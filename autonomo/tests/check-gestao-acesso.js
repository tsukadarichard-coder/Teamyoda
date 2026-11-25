/* Acesso total ao painel de gestão (25/11/2026, "Eu preciso do acesso total e o Adm tb"): as functions da Equipe da organização
   (aprovar, corrigir cadastro, promover e remover professor) aceitam o coordenador e também o Richard (dono do Financeiro) e o
   administrativo (Financeiro › Acessos), sempre na academia da própria conta; professor comum continua recusado.
   Rode: node autonomo/tests/check-gestao-acesso.js */
const assert = require("assert"), path = require("path");
const fx = path.join(__dirname, "../../netlify/functions/");
const store = { "financeiro/_acesso": { admins: ["adm@x.com"] } };
const docRef = (p) => ({ id: p.split("/").pop(), collection: (n) => colRef(p + "/" + n), get: async () => ({ exists: store[p] !== undefined, data: () => store[p] }), set: async (v) => { store[p] = v; }, update: async (v) => { store[p] = { ...(store[p] || {}), ...v }; }, delete: async () => { delete store[p]; } });
const colRef = (p) => ({ doc: (id) => docRef(p + "/" + id), where: () => colRef(p), get: async () => ({ docs: [], forEach: () => {}, empty: true, size: 0 }) });
const dono = (/const DONOS_FINANCEIRO = \["([^"]+)"/.exec(require("fs").readFileSync(path.join(__dirname, "../../mty/index.html"), "utf8")) || [])[1];
const TK = { coord: { uid: "c", orgId: "team-yoda", role: "coordenador", email: "c@x.com" }, prof: { uid: "p", orgId: "team-yoda", role: "treinador", email: "p@x.com" },
  dono: { uid: "d", orgId: "team-yoda", role: "treinador", email: dono }, adm: { uid: "a", orgId: "team-yoda", role: "treinador", email: "adm@x.com" }, admSemOrg: { uid: "z", email: "adm@x.com" } };
const fsFalso = () => ({ collection: (n) => colRef(n), doc: (p) => docRef(p) });
fsFalso.FieldValue = { serverTimestamp: () => 1, delete: () => undefined };
const admin = { firestore: fsFalso, auth: () => ({ verifyIdToken: async (t) => TK[t], setCustomUserClaims: async () => {}, getUser: async () => ({ customClaims: {} }), updateUser: async () => {}, getUserByEmail: async () => { throw new Error("x"); } }) };
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin, app: () => {} } };
assert(dono, "dono do Financeiro");
(async () => {
  for (const f of ["aprovar-treinador", "corrigir-cadastro", "promover-treinador", "remover-treinador"]) {
    const H = require(fx + f + ".js").handler;
    const st = async (tk) => (await H({ httpMethod: "POST", headers: { authorization: "Bearer " + tk }, body: JSON.stringify({ uid: "ninguem", email: "n@x.com", nome: "N" }) })).statusCode;
    assert.strictEqual(await st("prof"), 403, f + ": professor recusado");
    assert.strictEqual(await st("admSemOrg"), 403, f + ": conta sem academia recusada");
    for (const quem of ["coord", "dono", "adm"]) assert.notStrictEqual(await st(quem), 403, f + ": " + quem + " passa da permissão");
  }
  console.log("check-gestao-acesso: ok");
})().catch((e) => { console.error(e.stack || e); process.exit(1); });
