/* Lançamentos manuais do controle financeiro: segredo, validação, criar/editar/excluir.
   Rode: node tests/check-admin-financeiro.js */
const path = require("path"), assert = require("assert");
const fx = path.join(__dirname, "../netlify/functions/");
const store = {};
const J = (v) => JSON.parse(JSON.stringify(v));
function docRef(p) { return { id: p.split("/").pop(), async get() { const v = store[p]; return { exists: v !== undefined, id: p.split("/").pop(), data: () => J(v) }; }, async set(v) { store[p] = J(v); }, async delete() { delete store[p]; } }; }
function colRef(p) {
  const docs = () => Object.keys(store).filter((k) => k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/")).map((k) => ({ id: k.split("/").pop(), data: () => J(store[k]) }));
  return { doc: (id) => docRef(p + "/" + id), async get() { const d = docs(); return { docs: d, size: d.length, forEach: (f) => d.forEach(f) }; } };
}
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin: { firestore: () => ({ collection: (n) => colRef(n) }) }, app: () => {} } };
process.env.ADMIN_SECRET = "segredo";
const H = require(fx + "admin-financeiro.js").handler, F = require(fx + "_admin-financeiro.js");
const call = async (metodo, corpo, seg) => { const r = await H({ httpMethod: metodo, headers: { "x-admin-secret": seg === undefined ? "segredo" : seg }, body: corpo ? JSON.stringify(corpo) : undefined }); return { s: r.statusCode, ...JSON.parse(r.body) }; };
const ok = { acao: "criar", tipo: "despesa", data: "2026-10-05", valor: "1.234,56", categoria: "ferramentas", produto: "geral", descricao: "  Hospedagem   do mês " };

(async () => {
  assert.strictEqual((await call("GET", null, "")).s, 401); assert.strictEqual((await call("POST", ok, "errado")).s, 401);
  assert.strictEqual((await call("PUT", ok)).s, 405);
  assert.strictEqual(F.centavosDe("149,9"), 14990); assert.strictEqual(F.centavosDe("R$ 10"), 1000); assert.ok(isNaN(F.centavosDe("abc"))); assert.ok(isNaN(F.centavosDe("1,234"))); assert.strictEqual(F.centavosDe(5000), 5000); assert.ok(isNaN(F.centavosDe(50.5)));
  for (const mau of [{ tipo: "outro" }, { data: "2026-02-31" }, { data: "05/10/2026" }, { valor: "0" }, { valor: "-5" }, { valor: "99999999999" }, { categoria: "reembolso", tipo: "receita" }, { produto: "x" }, { descricao: "   " }])
    assert.strictEqual((await call("POST", Object.assign({}, ok, mau))).s, 400, "recusa " + JSON.stringify(mau));
  assert.strictEqual(Object.keys(store).length, 0, "nada gravado quando inválido");

  const c = await call("POST", ok); assert.strictEqual(c.s, 200); assert.ok(c.id);
  const g = await call("GET"); assert.strictEqual(g.lancamentos.length, 1);
  assert.deepStrictEqual([g.lancamentos[0].valorCentavos, g.lancamentos[0].descricao, g.lancamentos[0].tipo], [123456, "Hospedagem do mês", "despesa"]);
  assert.ok(g.produtos.geral && g.categoriasReceita.eduzz && g.categoriasDespesa.impostos);
  const e = await call("POST", Object.assign({}, ok, { acao: "editar", id: c.id, valor: 200, descricao: "Corrigido" })); assert.strictEqual(e.s, 200);
  assert.strictEqual((await call("GET")).lancamentos[0].valorCentavos, 200);
  assert.strictEqual((await call("POST", { ...ok, acao: "editar", id: "naoexiste1" })).s, 404); assert.strictEqual((await call("POST", { acao: "excluir", id: "../x" })).s, 400);
  assert.strictEqual((await call("POST", { acao: "excluir", id: c.id })).s, 200); assert.strictEqual((await call("GET")).lancamentos.length, 0);
  assert.strictEqual((await call("POST", { acao: "qualquer" })).s, 400);
  console.log("check-admin-financeiro: ok");
})().catch((e) => { console.error(e); process.exit(1); });
