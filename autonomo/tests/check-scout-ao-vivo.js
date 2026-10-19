/* Scout ao vivo: só a academia dona atualiza, a família só lê com o token, revogação e validade, resumo sempre limpo. Rode: node tests/check-scout-ao-vivo.js */
const path = require("path"), assert = require("assert");
const fx = path.join(__dirname, "../netlify/functions/");
const store = {}; const J = (v) => JSON.parse(JSON.stringify(v));
function nested(v, dentroDeArray) { if (Array.isArray(v)) { if (dentroDeArray) throw new Error("Nested arrays are not supported"); v.forEach((x) => nested(x, true)); } else if (v && typeof v === "object") Object.values(v).forEach((x) => nested(x, false)); }
function docRef(p) { return { async get() { return { exists: store[p] !== undefined, data: () => J(store[p]) }; }, async set(v) { nested(v); store[p] = J(v); }, async update(v) { nested(v); Object.assign(store[p], J(v)); }, async delete() { delete store[p]; } }; }
function colRef(c, filtros = []) { return { limit: () => colRef(c, filtros), async add(v) { const id = "n" + Object.keys(store).length + "x"; store[c + "/" + id] = J(v); return { id }; }, doc: (id) => docRef(c + "/" + id), where: (k, op, v) => colRef(c, filtros.concat([[k, v]])), async get() { const ks = Object.keys(store).filter((k) => k.startsWith(c + "/") && filtros.every(([f, v]) => store[k][f] === v)); const docs = ks.map((k) => ({ id: k.split("/")[1], data: () => J(store[k]) })); return { docs, forEach: (f) => docs.forEach(f) }; } }; }
const tokens = { "tok-a": { uid: "u1", orgId: "orgA" }, "tok-e": { uid: "u9", orgId: "orgA", email: "treina@x.com", email_verified: true }, "tok-ne": { uid: "u8", orgId: "orgA", email: "treina@x.com", email_verified: false }, "tok-b": { uid: "u2", orgId: "orgB" }, "tok-sem-org": { uid: "u3" }, "tok-resp": { uid: "r1" }, "tok-resp2": { uid: "r2" }, "tok-treina": { uid: "t1" } };
const contas = { "ana@x.com": { uid: "atl1", displayName: "Ana" }, "bia@x.com": { uid: "resp9", displayName: "Bia" } };
const admin = { firestore: () => ({ collection: (n) => colRef(n) }), auth: () => ({ getUserByEmail: async (e) => { if (!contas[e]) throw new Error("nao"); return contas[e]; }, verifyIdToken: async (t) => { if (!tokens[t]) throw new Error("x"); return tokens[t]; } }) };
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
  /* retomar a mesma partida: o link vencido há pouco tempo volta, o de outra academia e o muito antigo não */
  assert.strictEqual((await POST("tok-b", { acao: "retomar", token: t2.token })).s, 404, "outra academia não retoma");
  const volta = await POST("tok-a", { acao: "retomar", token: t2.token });
  assert.strictEqual(volta.s, 200, "retomar link vencido há pouco"); assert.strictEqual(volta.token, t2.token, "volta o mesmo link");
  assert.strictEqual((await GET({ t: t2.token })).s, 200, "a página dos pais volta a funcionar");
  assert.strictEqual((await POST("tok-a", { acao: "retomar", token: t2.token })).s, 200, "retomar um link ainda válido devolve o mesmo");
  store["scoutsAoVivo/" + t2.token].expiraEm = new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString();
  assert.strictEqual((await POST("tok-a", { acao: "retomar", token: t2.token })).s, 410, "vencido há mais de 7 dias não volta");
  store["scoutsAoVivo/" + t2.token].expiraEm = new Date(Date.now() - 1000).toISOString();
  assert.strictEqual((await POST("tok-a", { acao: "iniciar", resumo: resumo(1) })).s, 200, "link vencido não conta no limite");
  assert.strictEqual((await POST("tok-a", { acao: "atualizar", token: "../x", resumo: resumo(2) })).s, 400);
  assert.strictEqual((await handler({ httpMethod: "PUT", headers: {} })).statusCode, 405);
  /* jogo ligado ao atleta pelo vínculo de treinador */
  store["vinculos/v1"] = { tipo: "treinador", status: "ativo", pessoaUid: "u1", areas: ["partidas"], atletaUid: "at1", atletaNome: "Ana Souza" };
  store["vinculos/v2"] = { tipo: "treinador", status: "ativo", pessoaUid: "uX", pessoaEmail: "treina@x.com", areas: ["partidas"], atletaUid: "at2", atletaNome: "Bia" };
  store["vinculos/v3"] = { tipo: "treinador", status: "ativo", pessoaUid: "u1", areas: ["diario"], atletaUid: "at3", atletaNome: "Sem partidas" };
  store["vinculos/v4"] = { tipo: "responsavel", status: "ativo", pessoaUid: "u1", areas: ["partidas"], atletaUid: "at4", atletaNome: "Resp" };
  const lista = await POST("tok-a", { acao: "atletas" });
  assert.deepStrictEqual(lista.atletas, [{ vinculoId: "v1", nome: "Ana Souza" }], "só treinador ativo com a área partidas");
  assert.deepStrictEqual((await POST("tok-e", { acao: "atletas" })).atletas.map((x) => x.vinculoId), ["v2"], "por e-mail verificado");
  assert.deepStrictEqual((await POST("tok-ne", { acao: "atletas" })).atletas, [], "e-mail não verificado não vale");
  assert.strictEqual((await POST("tok-b", { acao: "iniciar", vinculoId: "v1", resumo: resumo(1) })).s, 403, "vínculo de outro treinador");
  assert.strictEqual((await POST("tok-a", { acao: "iniciar", vinculoId: "v3", resumo: resumo(1) })).s, 403, "sem a área partidas");
  assert.strictEqual((await POST("tok-a", { acao: "iniciar", vinculoId: "v4", resumo: resumo(1) })).s, 403, "responsável não inicia jogo");
  for (const k of Object.keys(store)) if (k.startsWith("scoutsAoVivo/")) delete store[k];
  const lig = await POST("tok-a", { acao: "iniciar", vinculoId: "v1", resumo: resumo(2) });
  assert.strictEqual(lig.s, 200); assert.strictEqual(store["scoutsAoVivo/" + lig.token].atletaUid, "at1"); assert.strictEqual(store["scoutsAoVivo/" + lig.token].vinculoId, "v1");
  assert.ok(!(await GET({ t: lig.token })).raw.includes("at1"), "a leitura pública não revela o atleta");
  /* responsável faz o scout */
  store["vinculos/r1"] = { tipo: "responsavel", status: "ativo", pessoaUid: "r1", areas: ["partidas"], atletaUid: "at1", atletaNome: "Ana Souza" };
  store["vinculos/r2"] = { tipo: "responsavel", status: "ativo", pessoaUid: "r1", areas: ["diario"], atletaUid: "at9", atletaNome: "Sem" };
  assert.strictEqual((await POST("tok-resp", { acao: "iniciar", resumo: resumo(1) })).s, 403, "família sem vinculoId");
  assert.strictEqual((await POST("tok-resp", { acao: "iniciar", vinculoId: "r2", resumo: resumo(1) })).s, 403, "sem a área partidas");
  assert.strictEqual((await POST("tok-resp2", { acao: "iniciar", vinculoId: "r1", resumo: resumo(1) })).s, 403, "vínculo de outra pessoa");
  assert.strictEqual((await POST("tok-resp", { acao: "iniciar", vinculoId: "v1", resumo: resumo(1) })).s, 403, "vínculo de treinador não serve");
  assert.strictEqual((await POST("tok-resp", { acao: "atletas" })).s, 403);
  const fam = await POST("tok-resp", { acao: "iniciar", vinculoId: "r1", resumo: resumo(2) });
  assert.strictEqual(fam.s, 200); assert.strictEqual(store["scoutsAoVivo/" + fam.token].atletaUid, "at1");
  assert.strictEqual((await POST("tok-resp", { acao: "atualizar", token: fam.token, resumo: resumo(5) })).s, 200);
  assert.strictEqual((await POST("tok-resp2", { acao: "atualizar", token: fam.token, resumo: resumo(5) })).s, 404, "outro responsável não mexe");
  assert.strictEqual((await POST("tok-a", { acao: "revogar", token: fam.token })).s, 404, "academia não mexe");
  store["vinculos/r1"].status = "revogado";
  assert.strictEqual((await POST("tok-resp", { acao: "atualizar", token: fam.token, resumo: resumo(6) })).s, 403, "vínculo encerrado para de atualizar");
  assert.strictEqual((await POST("tok-resp", { acao: "revogar", token: fam.token })).s, 200);
  /* treinador de conta sem academia (app Competição) também marca o jogo do atleta vinculado */
  store["vinculos/t1"] = { tipo: "treinador", status: "ativo", pessoaUid: "t1", areas: ["partidas"], atletaUid: "at7", atletaNome: "Caio" };
  store["vinculos/t2"] = { tipo: "treinador", status: "ativo", pessoaUid: "t1", areas: ["diario"], atletaUid: "at8", atletaNome: "Sem" };
  assert.strictEqual((await POST("tok-treina", { acao: "iniciar", vinculoId: "t2", resumo: resumo(1) })).s, 403, "sem a área partidas");
  assert.strictEqual((await POST("tok-treina", { acao: "iniciar", vinculoId: "r1", resumo: resumo(1) })).s, 403, "vínculo de outra pessoa");
  const tr = await POST("tok-treina", { acao: "iniciar", vinculoId: "t1", resumo: resumo(2) });
  assert.strictEqual(tr.s, 200); assert.strictEqual(store["scoutsAoVivo/" + tr.token].atletaUid, "at7"); assert.strictEqual(store["scoutsAoVivo/" + tr.token].orgId, "fam:t1");
  assert.strictEqual((await POST("tok-treina", { acao: "atualizar", token: tr.token, resumo: resumo(4) })).s, 200);
  assert.strictEqual((await POST("tok-resp", { acao: "atualizar", token: tr.token, resumo: resumo(4) })).s, 404, "outro não mexe");
  /* vínculo da academia: código fixo e pedido por e-mail */
  assert.strictEqual((await POST("tok-sem-org", { acao: "meuCodigo" })).s, 403, "conta sem academia não tem código");
  const mc = await POST("tok-a", { acao: "meuCodigo" });
  assert.strictEqual(mc.s, 200); assert.ok(/^[A-Z2-9]{8}$/.test(mc.codigo), "código de 8 caracteres");
  assert.strictEqual((await POST("tok-a", { acao: "meuCodigo" })).codigo, mc.codigo, "o código é fixo");
  assert.strictEqual(store["codigosAcademia/" + mc.codigo].orgId, "orgA");
  assert.notStrictEqual((await POST("tok-b", { acao: "meuCodigo" })).codigo, mc.codigo, "cada treinador tem o seu");
  assert.strictEqual((await POST("tok-a", { acao: "pedirVinculo", email: "lixo" })).s, 400);
  assert.strictEqual((await POST("tok-a", { acao: "pedirVinculo", email: "nao@x.com" })).s, 404, "sem conta");
  store["jogadores/atl1"] = { nome: "Ana Souza", competicao: { papel: "atleta" } }; store["jogadores/resp9"] = { nome: "Bia", competicao: { papel: "responsavel" } };
  assert.strictEqual((await POST("tok-a", { acao: "pedirVinculo", email: "bia@x.com" })).s, 404, "só atleta");
  const pv = await POST("tok-a", { acao: "pedirVinculo", email: " ANA@x.com " });
  assert.strictEqual(pv.s, 200);
  const vin = Object.keys(store).filter((k) => k.startsWith("vinculos/")).map((k) => store[k]).find((v) => v.atletaUid === "atl1");
  assert.ok(vin && vin.status === "aguardando" && vin.origem === "academia" && vin.pessoaUid === "u1" && vin.tipo === "treinador", "pedido aguarda o atleta");
  assert.strictEqual((await POST("tok-a", { acao: "pedirVinculo", email: "ana@x.com" })).s, 409, "não duplica");
  console.log("check-scout-ao-vivo: ok");
})().catch((e) => { console.error(e); process.exit(1); });
