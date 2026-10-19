/* Sessão da aula no relógio: só a academia dona publica e revoga; o link só entrega o que a aula tem; token, validade e formatos. Rode: node tests/check-sessao-relogio.js */
const path = require("path"), assert = require("assert");
const fx = path.join(__dirname, "../netlify/functions/");
const store = {}; const J = (v) => JSON.parse(JSON.stringify(v));
function docRef(p) { return { async get() { return { exists: store[p] !== undefined, id: p.split("/")[1], data: () => J(store[p]) }; }, async set(v) { store[p] = J(v); }, async delete() { delete store[p]; } }; }
function colRef(c, filtros = []) { return { doc: (id) => docRef(c + "/" + id), where: (k, op, v) => colRef(c, filtros.concat([[k, v]])), async get() { const ks = Object.keys(store).filter((k) => k.startsWith(c + "/") && filtros.every(([f, v]) => store[k][f] === v)); return { docs: ks.map((k) => ({ id: k.split("/")[1], data: () => J(store[k]) })) }; } }; }
const tokens = { "tok-a": { uid: "u1", orgId: "orgA" }, "tok-b": { uid: "u2", orgId: "orgB" }, "tok-sem": { uid: "u3" } };
const admin = { firestore: () => ({ collection: (n) => colRef(n) }), auth: () => ({ verifyIdToken: async (t) => { if (!tokens[t]) throw new Error("x"); return tokens[t]; } }) };
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin, app: () => {} } };
const { handler } = require(fx + "sessao-relogio.js");
const POST = async (tk, corpo) => { const r = await handler({ httpMethod: "POST", headers: tk ? { authorization: "Bearer " + tk } : {}, body: JSON.stringify(corpo) }); return { s: r.statusCode, raw: r.body, h: r.headers, ...(r.body.startsWith("{") ? JSON.parse(r.body) : {}) }; };
const GET = async (q) => { const r = await handler({ httpMethod: "GET", headers: {}, queryStringParameters: q }); return { s: r.statusCode, raw: r.body, h: r.headers }; };
const aula = { alunoId: "a1", nome: "Ana Souza Lima", titulo: "Aula 3 · Saque", ficha: "NUNCA", secoes: [{ t: "Aquecimento", itens: [{ n: "Mini-tênis", min: 8, d: "Bolas curtas no quadrado, foco em contato à frente." }] }, { t: "Conteúdo", itens: [{ n: "Saque em 3 alvos", min: 15, d: "20 saques por alvo", obs: "NUNCA" }, { n: "Devolução + 1ª bola", min: 12 }] }] };
(async () => {
  assert.strictEqual((await POST(null, { acao: "publicar", ...aula })).s, 401, "sem login");
  assert.strictEqual((await POST("ruim", { acao: "publicar", ...aula })).s, 401);
  assert.strictEqual((await POST("tok-sem", { acao: "publicar", ...aula })).s, 403, "conta sem academia");
  assert.strictEqual((await POST("tok-a", { acao: "publicar", alunoId: "a1", secoes: [] })).s, 400, "aula vazia");
  const p = await POST("tok-a", { acao: "publicar", ...aula });
  assert.strictEqual(p.s, 200); assert.ok(/^[a-f0-9]{32}$/.test(p.token));
  const t = await GET({ t: p.token });
  assert.strictEqual(t.s, 200); assert.ok(t.h["content-type"].startsWith("text/plain")); assert.strictEqual(t.h["cache-control"], "no-store");
  assert.ok(t.raw.startsWith("Aula 3 · Saque · Ana\n"), "só o primeiro nome: " + t.raw.slice(0, 40));
  assert.ok(t.raw.includes("1. Mini-tênis (8 min)") && t.raw.includes("3. Devolução + 1ª bola (12 min)") && t.raw.includes("AQUECIMENTO"), "texto da aula");
  assert.ok(!t.raw.includes("NUNCA") && !t.raw.includes("orgA") && !t.raw.includes("Souza"), "nada além da aula");
  assert.strictEqual((await GET({ t: p.token, f: "lista" })).raw, "1. Mini-tênis · 8 min\n2. Saque em 3 alvos · 15 min\n3. Devolução + 1ª bola · 12 min", "formato lista");
  assert.strictEqual(JSON.parse((await GET({ t: p.token, f: "json" })).raw).secoes.length, 2, "formato json");
  assert.strictEqual((await GET({ t: "x".repeat(32) })).s, 404); assert.strictEqual((await GET({ t: "curto" })).s, 404); assert.strictEqual((await GET({})).s, 404);
  /* republicar mantém o mesmo link e troca o conteúdo; outra academia não mexe */
  const p2 = await POST("tok-a", { acao: "publicar", ...aula, titulo: "Aula 4", secoes: [{ t: "Conteúdo", itens: [{ n: "Voleio", min: 10 }] }] });
  assert.strictEqual(p2.token, p.token, "mesmo link do mesmo jogador"); assert.ok((await GET({ t: p.token })).raw.startsWith("Aula 4"));
  const pb = await POST("tok-b", { acao: "publicar", ...aula }); assert.notStrictEqual(pb.token, p.token, "academia B tem o próprio link");
  assert.strictEqual((await POST("tok-b", { acao: "revogar", alunoId: "a1" })).s, 200); assert.strictEqual((await GET({ t: p.token })).s, 200, "revogar da outra academia não afeta");
  /* limites */
  const grande = await POST("tok-a", { acao: "publicar", alunoId: "a2", nome: "Bia", secoes: [{ t: "x".repeat(200), itens: Array.from({ length: 40 }, (_, i) => ({ n: "Ex " + i, min: 999, d: "d".repeat(500) })) }] });
  const g = JSON.parse((await GET({ t: grande.token, f: "json" })).raw); assert.strictEqual(g.secoes[0].itens.length, 14); assert.ok(g.secoes[0].itens[0].d.length <= 160 && g.secoes[0].itens[0].min === 240 && g.secoes[0].t.length <= 40);
  /* validade e revogação */
  store["sessoesRelogio/" + p.token].expiraEm = new Date(Date.now() - 1000).toISOString(); assert.strictEqual((await GET({ t: p.token })).s, 404, "vencido");
  assert.strictEqual((await POST("tok-a", { acao: "revogar", alunoId: "a2" })).s, 200); assert.strictEqual((await GET({ t: grande.token })).s, 404, "revogado");
  assert.strictEqual((await POST("tok-a", { acao: "xyz", alunoId: "a1" })).s, 400);
  console.log("check-sessao-relogio: ok");
})().catch((e) => { console.error(e); process.exit(1); });
