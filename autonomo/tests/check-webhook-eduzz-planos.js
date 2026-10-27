/* Webhook da Eduzz × planos do QuadraLab para treinadores (conta original da Eduzz):
   · fatura paga do produto 3124922 libera o Essencial por 32 dias; do 3124932, o Premium; renovação soma a partir da validade;
   · reembolso devolve ao plano grátis sem apagar nada; evento repetido não é processado duas vezes;
   · sem a chave certa → 401; payload de TESTE do Developer Hub não cria conta;
   · os botões dos dois apps de treinador apontam para os checkouts desses produtos.
   Firebase em memória. Rode: node tests/check-webhook-eduzz-planos.js */
const path = require("path"), fs = require("fs"), assert = require("assert");
const fx = path.join(__dirname, "..", "netlify/functions/");
/* ── Firestore em memória (com transação) ── */
const store = {}; const J = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const APAGAR = "__apagar__";
function mesclar(a, b) { const r = { ...(a || {}), ...b }; Object.keys(r).forEach((k) => { if (r[k] === APAGAR) delete r[k]; }); return r; }
function docRef(p) { return { id: p.split("/").pop(), async get() { const v = store[p]; return { exists: v !== undefined, id: p.split("/").pop(), data: () => J(v) }; }, async set(v, o) { store[p] = o && o.merge ? mesclar(store[p], J(v)) : J(v); }, async update(v) { Object.assign(store[p], J(v)); }, async delete() { delete store[p]; }, collection: (s) => colRef(p + "/" + s) }; }
let seq = 0;
function colRef(p, f = [], ord = null, lim = 0) {
  return {
    doc: (id) => docRef(p + "/" + id), where: (c, o, v) => colRef(p, f.concat([[c, v]]), ord, lim), orderBy: (c, d) => colRef(p, f, [c, d || "asc"], lim), limit: (n) => colRef(p, f, ord, n),
    async add(v) { const id = "doc" + String(++seq).padStart(12, "0"); store[p + "/" + id] = J(v); return docRef(p + "/" + id); },
    async get() {
      let ks = Object.keys(store).filter((k) => k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/")).filter((k) => f.every(([c, v]) => store[k][c] === v));
      if (ord) ks.sort((a, b) => (String(store[a][ord[0]]) < String(store[b][ord[0]]) ? -1 : 1) * (ord[1] === "desc" ? -1 : 1));
      if (lim) ks = ks.slice(0, lim);
      const d = ks.map((k) => ({ id: k.split("/").pop(), ref: docRef(k), data: () => J(store[k]) }));
      return { docs: d, empty: !d.length, size: d.length, forEach: (g) => d.forEach(g) };
    },
  };
}
const db = { collection: (n) => colRef(n), runTransaction: async (fn) => fn({ get: (r) => r.get(), set: (r, v, o) => r.set(v, o), update: (r, v) => r.update(v) }) };
const usuarios = {}; let nUid = 0;
const auth = {
  async getUserByEmail(e) { const u = Object.values(usuarios).find((x) => x.email === e); if (!u) { const err = new Error("nf"); err.code = "auth/user-not-found"; throw err; } return u; },
  async createUser(d) { const uid = "u" + (++nUid); usuarios[uid] = { uid, email: d.email, customClaims: {} }; return usuarios[uid]; },
  async setCustomUserClaims(uid, c) { usuarios[uid].customClaims = c; },
};
const admin = { firestore: Object.assign(() => db, { FieldValue: { delete: () => APAGAR } }), auth: () => auth };
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin, app: () => {} } };
process.env.WEBHOOK_EDUZZ_SECRET = "segredo-teste";
const { handler } = require(fx + "webhook-eduzz.js");
let nFat = 0;
const evento = (tipo, produto, email, extra) => ({ id: "ev" + nFat, event: "myeduzz.invoice_" + tipo, sentDate: new Date().toISOString(),
  data: { id: extra && extra.fatura || "fat" + (++nFat), status: tipo, buyer: { email, name: "Treinador Teste" }, items: [{ productId: produto }], producer: extra && extra.teste ? { originSecret: "x" } : {} } });
const chamar = (corpo, chave = "segredo-teste") => handler({ httpMethod: "POST", queryStringParameters: { chave }, body: JSON.stringify(corpo) });
const info = (email) => { const u = Object.values(usuarios).find((x) => x.email === email); return u && store["orgs/" + u.customClaims.orgId + "/meta/info"]; };
const dias = (iso) => Math.round((Date.parse(iso) - Date.parse(new Date().toISOString().slice(0, 10))) / 86400000);

(async () => {
  /* chave errada e payload de teste */
  assert.strictEqual((await chamar(evento("paid", "3124922", "x@x.com"), "errada")).statusCode, 401);
  const t = await chamar(evento("paid", "3124922", "alice.johnson@example.com", { teste: true }));
  assert(JSON.parse(t.body).teste && !Object.keys(usuarios).length, "payload de teste não cria conta");

  /* Essencial (3124922): conta nova, 32 dias */
  const e1 = evento("paid", "3124922", "ana@treino.com");
  { const r = await chamar(e1); assert.strictEqual(r.statusCode, 200, r.body); }
  let i = info("ana@treino.com");
  assert(i && i.plano === "essencial" && dias(i.planoAtivoAte) === 32, "Essencial por 32 dias: " + JSON.stringify(i));
  assert.strictEqual(JSON.parse((await chamar(e1)).body).jaProcessado, true, "evento repetido não reprocessa");
  /* renovação soma a partir da validade */
  await chamar(evento("paid", "3124922", "ana@treino.com"));
  assert.strictEqual(dias(info("ana@treino.com").planoAtivoAte), 64, "renovação estende");
  /* reembolso → grátis */
  await chamar(evento("refunded", "3124922", "ana@treino.com"));
  i = info("ana@treino.com"); assert(i.plano === "gratis" && !i.planoAtivoAte, "reembolso volta ao grátis");

  /* Premium (3124932) e as duplicatas criadas na outra conta (3136975 / 3136981) */
  await chamar(evento("paid", "3124932", "bia@treino.com")); assert.strictEqual(info("bia@treino.com").plano, "premium");
  await chamar(evento("paid", "3136975", "caio@treino.com")); assert.strictEqual(info("caio@treino.com").plano, "essencial");
  await chamar(evento("paid", "3136981", "duda@treino.com")); assert.strictEqual(info("duda@treino.com").plano, "premium");
  /* produto desconhecido nunca dá plano pago */
  await chamar(evento("paid", "9999999", "eva@treino.com")); assert.strictEqual(info("eva@treino.com").plano, "gratis");

  /* botões dos dois apps apontam para os produtos da conta original */
  for (const f of ["autonomo/index.html", "mty/index.html"]) {
    const h = fs.readFileSync(path.join(__dirname, "..", "..", f), "utf8");
    assert(h.includes('essencial: "https://chk.eduzz.com/6W4GYZEO0Z"') && h.includes('premium: "https://chk.eduzz.com/D0R8KEP69Y"'), f + ": checkouts");
  }
  console.log("check-webhook-eduzz-planos: ok");
})().catch((e) => { console.error(e); process.exit(1); });
