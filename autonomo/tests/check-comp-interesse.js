/* Formulário de interesse da página de vendas: validação, gravação real, isca contra robôs, limite por hora, repetição e painel.
   Rode: node tests/check-comp-interesse.js */
const path = require("path"), assert = require("assert");
const fx = path.join(__dirname, "../netlify/functions/");
const store = {}; let seq = 0, falhaApp = false;
const J = (v) => JSON.parse(JSON.stringify(v));
function docRef(p) { return { id: p.split("/").pop(), async get() { const v = store[p]; return { exists: v !== undefined, data: () => J(v) }; }, async set(v) { store[p] = J(v); }, async update(v) { Object.assign(store[p], J(v)); } }; }
function colRef(p, f = []) {
  const ids = () => Object.keys(store).filter((k) => k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/")).filter((k) => f.every(([c, v]) => store[k][c] === v));
  return { doc: (id) => docRef(p + "/" + id), async add(v) { const id = "doc" + String(++seq).padStart(10, "0"); store[p + "/" + id] = J(v); return docRef(p + "/" + id); }, where: (c, o, v) => colRef(p, f.concat([[c, v]])), async get() { const docs = ids().map((k) => ({ id: k.split("/").pop(), data: () => J(store[k]) })); return { docs, forEach: (fn) => docs.forEach(fn) }; } };
}
const admin = { firestore: () => ({ collection: (n) => colRef(n) }) };
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin, app: () => { if (falhaApp) throw new Error("sem credencial"); } } };
process.env.ADMIN_SECRET = "segredo";
const I = require(fx + "comp-interesse.js"), ADM = require(fx + "admin-interesses.js").handler;
const ok = { nome: "Maria Souza", email: "Maria@Exemplo.com", telefone: "(11) 94177-3228", faixa: "13-14", categoria: "estadual", servico: "acompanhamento", objetivo: "Organizar a temporada", consentimento: true };
const POST = async (b, ip) => { const r = await I.handler({ httpMethod: "POST", headers: { "x-nf-client-connection-ip": ip || "1.1.1.1" }, body: JSON.stringify(b) }); return { s: r.statusCode, ...JSON.parse(r.body) }; };
(async () => {
  assert.strictEqual((await I.handler({ httpMethod: "GET", headers: {} })).statusCode, 405);
  for (const [campo, valor, trecho] of [["nome", "A", /nome/i], ["email", "x", /e-mail/i], ["telefone", "123", /telefone/i], ["faixa", "x", /faixa/i], ["categoria", "x", /categoria/i], ["servico", "x", /serviço/i], ["objetivo", "", /objetivo/i], ["consentimento", false, /autoriza/i]]) {
    const r = await POST({ ...ok, [campo]: valor }); assert.strictEqual(r.s, 400, campo); assert.ok(trecho.test(r.erro), campo + ": " + r.erro);
  }
  assert.strictEqual(Object.keys(store).filter((k) => k.startsWith("interessesCompeticao/")).length, 0, "inválido não grava nada");
  const r1 = await POST(ok); assert.strictEqual(r1.s, 200); assert.ok(r1.ok && !r1.repetido);
  const salvo = Object.values(store).find((x) => x.servico === "acompanhamento");
  assert.strictEqual(salvo.email, "maria@exemplo.com"); assert.strictEqual(salvo.telefone, "11941773228"); assert.strictEqual(salvo.status, "novo"); assert.ok(salvo.ipHash && !JSON.stringify(salvo).includes("1.1.1.1"), "o IP não é guardado");
  assert.ok(!("cpf" in salvo) && Object.keys(salvo).sort().join() === ["categoria", "criadoEm", "email", "faixa", "ipHash", "nome", "objetivo", "origem", "servico", "status", "telefone"].sort().join(), "só os dados necessários");
  const r2 = await POST(ok); assert.strictEqual(r2.s, 200); assert.strictEqual(r2.repetido, true); assert.strictEqual(Object.keys(store).filter((k) => k.startsWith("interessesCompeticao/")).length, 1, "mesmo e-mail e serviço no dia não duplica");
  const rb = await POST({ ...ok, email: "bot@x.com", site: "http://spam" }); assert.strictEqual(rb.s, 200); assert.ok(!Object.values(store).some((x) => x.email === "bot@x.com"), "robô não grava");
  for (let i = 0; i < 4; i++) assert.strictEqual((await POST({ ...ok, email: "p" + i + "@x.com" }, "9.9.9.9")).s, 200);
  assert.strictEqual((await POST({ ...ok, email: "p9@x.com" }, "9.9.9.9")).s, 200);
  const lim = await POST({ ...ok, email: "p10@x.com" }, "9.9.9.9"); assert.strictEqual(lim.s, 429, "limite por hora");
  falhaApp = true; const f = await POST({ ...ok, email: "novo@x.com" }, "8.8.8.8"); assert.strictEqual(f.s, 503); assert.ok(!f.ok && /WhatsApp/.test(f.erro), "sem configuração: sem sucesso falso"); falhaApp = false;
  const A = async (corpo, seg) => { const r = await ADM({ httpMethod: corpo ? "POST" : "GET", headers: { "x-admin-secret": seg === undefined ? "segredo" : seg }, body: corpo ? JSON.stringify(corpo) : undefined }); return { s: r.statusCode, ...JSON.parse(r.body) }; };
  assert.strictEqual((await A(null, "errado")).s, 401);
  const lista = await A(); assert.ok(lista.contatos.length >= 6 && lista.contatos[0].rotuloServico && !JSON.stringify(lista).includes("ipHash"));
  const id = lista.contatos.find((c) => c.email === "maria@exemplo.com").id;
  assert.strictEqual((await A({ acao: "status", id, status: "contatado", nota: "Liguei" })).s, 200); assert.strictEqual(store["interessesCompeticao/" + id].status, "contatado");
  assert.strictEqual((await A({ acao: "status", id, status: "x" })).s, 400);
  console.log("check-comp-interesse: ok");
})().catch((e) => { console.error(e); process.exit(1); });
