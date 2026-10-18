/* Scout ao vivo: só a academia dona atualiza, a família só lê com o token, revogação e validade, resumo sempre limpo. Rode: node tests/check-scout-ao-vivo.js */
const path = require("path"), assert = require("assert");
const fx = path.join(__dirname, "../netlify/functions/");
const store = {}; const J = (v) => JSON.parse(JSON.stringify(v));
function nested(v, dentroDeArray) { if (Array.isArray(v)) { if (dentroDeArray) throw new Error("Nested arrays are not supported"); v.forEach((x) => nested(x, true)); } else if (v && typeof v === "object") Object.values(v).forEach((x) => nested(x, false)); }
function docRef(p) { return { async get() { return { exists: store[p] !== undefined, data: () => J(store[p]) }; }, async set(v) { nested(v); store[p] = J(v); }, async update(v) { nested(v); Object.assign(store[p], J(v)); }, async delete() { delete store[p]; } }; }
function colRef(c, filtros = []) { return { doc: (id) => docRef(c + "/" + id), where: (k, op, v) => colRef(c, filtros.concat([[k, v]])), async get() { const ks = Object.keys(store).filter((k) => k.startsWith(c + "/") && filtros.every(([f, v]) => store[k][f] === v)); const docs = ks.map((k) => ({ id: k.split("/")[1], data: () => J(store[k]) })); return { docs, forEach: (f) => docs.forEach(f) }; } }; }
const tokens = { "tok-a": { uid: "u1", orgId: "orgA" }, "tok-b": { uid: "u2", orgId: "orgB" }, "tok-sem-org": { uid: "u3" } };
const admin = { firestore: () => ({ collection: (n) => colRef(n) }), auth: () => ({ verifyIdToken: async (t) => { if (!tokens[t]) throw new Error("x"); return tokens[t]; } }) };
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin, app: () => {} } };
const { handler } = require(fx + "scout-ao-vivo.js");
const resumo = (n) => ({ atleta: "Ana", data: "2026-10-18", torneio: "Copa X", resultado: "6-4 2-1", n, ganhos: Math.floor(n / 2), pctGanhos: 50, adversario: "NUNCA", obs: "NUNCA", bolas: { pctCurtos: 60 }, numeros: { errosNos: 3 }, zonas: {}, serie: Array.from({ length: n }, (_, i) => [i % 2, 0]), sinais: ["x"] });
const POST = async (tk, corpo) => { const r = await handler({ httpMethod: "POST", headers: tk ? { authorization: "Bearer " + tk } : {}, body: JSON.stringify(corpo) }); return { s: r.statusCode, h: r.headers, raw: r.body, ...JSON.parse(r.body) }; };
const GET = async (q) => { const r = await handler({ httpMethod: "GET", headers: {}, queryStringParameters: q }); return { s: r.statusCode, h: r.headers, raw: r.body, ...JSON.parse(r.body) }; };
(async () => {
  assert.strictEqual((await POST(null, { acao: "iniciar", resumo: resumo(3) })).s, 401, "sem login");
  assert.strictEqual((await POST("tok-ruim", { acao: "iniciar", resumo: resumo(3) })).s, 401);
  assert.strictEqual((await POST("tok-sem-org", { acao: "iniciar", resumo: resumo(3) })).s, 403, "conta sem academia");
  const ini = await POST("tok-a", { acao: "iniciar", resumo: resumo(3) });
  assert.strictEqual(ini.s, 200); assert.ok(/^[a-f0-9]{32}$/.test(ini.token));
  /* família lê */
  let g = await GET({ t: ini.token });
  assert.strictEqual(g.s, 200); assert.strictEqual(g.publico.aoVivo, true); assert.strictEqual(g.publico.atleta, "Ana"); assert.strictEqual(g.h["cache-control"], "no-store");
  assert.ok(!g.raw.includes("NUNCA") && !g.raw.includes("orgA") && !g.raw.includes("u1"), "nada interno ou proibido na resposta");
  assert.strictEqual(g.versao, 1);
  assert.strictEqual((await GET({ t: ini.token, v: "1" })).semMudanca, true, "sem mudança não reenvia o resumo");
  assert.strictEqual((await GET({ t: "x".repeat(32) })).s, 404); assert.strictEqual((await GET({ t: "curto" })).s, 404); assert.strictEqual((await GET({})).s, 404);
  /* atualizar: só a academia dona */
  assert.strictEqual((await POST("tok-b", { acao: "atualizar", token: ini.token, resumo: resumo(9) })).s, 404, "outra academia não mexe");
  assert.strictEqual((await POST("tok-b", { acao: "revogar", token: ini.token })).s, 404);
  const up = await POST("tok-a", { acao: "atualizar", token: ini.token, resumo: resumo(9) });
  assert.strictEqual(up.s, 200); assert.strictEqual(up.versao, 2);
  g = await GET({ t: ini.token, v: "1" }); assert.strictEqual(g.versao, 2); assert.strictEqual(g.publico.n, 9);
  /* fim da partida */
  await POST("tok-a", { acao: "atualizar", token: ini.token, resumo: resumo(12), fim: true });
  assert.strictEqual((await GET({ t: ini.token })).publico.aoVivo, false, "encerrada deixa de ser ao vivo");
  assert.ok(Date.parse(store["scoutsAoVivo/" + ini.token].expiraEm) - Date.now() <= 2 * 3600 * 1000 + 1000, "depois do fim o link vale só mais 2 horas");
  /* limite por academia */
  const t2 = await POST("tok-a", { acao: "iniciar", resumo: resumo(1) }), t3 = await POST("tok-a", { acao: "iniciar", resumo: resumo(1) });
  assert.strictEqual(t2.s, 200); assert.strictEqual(t3.s, 200);
  assert.strictEqual((await POST("tok-a", { acao: "iniciar", resumo: resumo(1) })).s, 409, "no máximo 3 abertos");
  assert.strictEqual((await POST("tok-b", { acao: "iniciar", resumo: resumo(1) })).s, 200, "o limite é por academia");
  /* revogar */
  assert.strictEqual((await POST("tok-a", { acao: "revogar", token: ini.token })).s, 200);
  assert.strictEqual((await GET({ t: ini.token })).s, 404, "revogado");
  /* validade */
  store["scoutsAoVivo/" + t2.token].expiraEm = new Date(Date.now() - 1000).toISOString();
  assert.strictEqual((await GET({ t: t2.token })).s, 404, "vencido");
  assert.strictEqual((await POST("tok-a", { acao: "atualizar", token: t2.token, resumo: resumo(2) })).s, 410);
  assert.strictEqual((await POST("tok-a", { acao: "iniciar", resumo: resumo(1) })).s, 200, "link vencido não conta no limite");
  assert.strictEqual((await POST("tok-a", { acao: "atualizar", token: "../x", resumo: resumo(2) })).s, 400);
  assert.strictEqual((await handler({ httpMethod: "PUT", headers: {} })).statusCode, 405);
  console.log("check-scout-ao-vivo: ok");
})().catch((e) => { console.error(e); process.exit(1); });
