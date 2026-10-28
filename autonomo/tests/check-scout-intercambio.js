/* Intercâmbio de scouts treinador ⇄ atleta: enviar, retirar, jogos marcados ao vivo, cópia ao fim do jogo, leitura pelo atleta. Rode: node tests/check-scout-intercambio.js */
const path = require("path"), assert = require("assert");
const fx = path.join(__dirname, "../netlify/functions/");
const store = {}; const J = (v) => JSON.parse(JSON.stringify(v));
function nested(v, dentro) { if (Array.isArray(v)) { if (dentro) throw new Error("Nested arrays are not supported"); v.forEach((x) => nested(x, true)); } else if (v && typeof v === "object") Object.values(v).forEach((x) => nested(x, false)); }
function docRef(p) { return { id: p.split("/").pop(), async get() { return { exists: store[p] !== undefined, data: () => J(store[p]), id: p.split("/").pop() }; }, async set(v) { nested(v); store[p] = J(v); }, async update(v) { nested(v); Object.assign(store[p], J(v)); }, async delete() { delete store[p]; }, collection: (n) => colRef(p + "/" + n) }; }
function colRef(c, filtros = []) {
  return { doc: (id) => docRef(c + "/" + id), where: (k, op, v) => colRef(c, filtros.concat([[k, v]])),
    async get() { const ks = Object.keys(store).filter((k) => k.startsWith(c + "/") && !k.slice(c.length + 1).includes("/") && filtros.every(([f, v]) => store[k][f] === v)); const docs = ks.map((k) => ({ id: k.split("/").pop(), data: () => J(store[k]), ref: docRef(k) })); return { docs, empty: !docs.length, size: docs.length, forEach: (fn) => docs.forEach(fn) }; } };
}
const tokens = { "tok-a": { uid: "u1", orgId: "orgA" }, "tok-b": { uid: "u2", orgId: "orgB" }, "tok-sem": { uid: "u3" }, "tok-fam": { uid: "u1" } };
const admin = { firestore: () => ({ collection: (n) => colRef(n) }), auth: () => ({ verifyIdToken: async (t) => { if (!tokens[t]) throw new Error("x"); return tokens[t]; } }) };
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin, app: () => {} } };
const IC = require(fx + "scout-intercambio.js"), AV = require(fx + "scout-ao-vivo.js"), SC = require(fx + "player-scouts.js");
const resumo = (n, extra) => Object.assign({ atleta: "Ana", data: "2026-10-18", torneio: "Copa X", resultado: "6-4", n, ganhos: Math.floor(n / 2), pctGanhos: 50, adversario: "NUNCA", obs: "NUNCA", detalhe: { games: [{ j: 1, n: 4, g: 3, s: 1, w: 1 }] }, mental: { antes: { conf: 3 }, jogo: {}, depois: {} } }, extra || {});
const POST = async (h, tk, corpo) => { const r = await h({ httpMethod: "POST", headers: tk ? { authorization: "Bearer " + tk } : {}, body: JSON.stringify(corpo) }); return { s: r.statusCode, ...JSON.parse(r.body) }; };
(async () => {
  store["vinculos/v1"] = { tipo: "treinador", status: "ativo", pessoaUid: "u1", areas: ["partidas"], atletaUid: "at1", atletaNome: "Ana Souza" };
  store["vinculos/v9"] = { tipo: "treinador", status: "ativo", pessoaUid: "u1", areas: ["diario"], atletaUid: "at9", atletaNome: "Sem partidas" };
  assert.strictEqual((await POST(IC.handler, null, { acao: "jogos", vinculoId: "v1" })).s, 401, "sem login");
  assert.strictEqual((await POST(IC.handler, "tok-sem", { acao: "jogos", vinculoId: "v1" })).s, 403, "sem academia");
  assert.strictEqual((await POST(IC.handler, "tok-b", { acao: "enviar", vinculoId: "v1", jogos: [{ id: "j1", resumo: resumo(10) }] })).s, 403, "outra academia não envia para este atleta");
  assert.strictEqual((await POST(IC.handler, "tok-a", { acao: "enviar", vinculoId: "v9", jogos: [{ id: "j1", resumo: resumo(10) }] })).s, 403, "vínculo sem a área partidas");
  assert.strictEqual((await POST(IC.handler, "tok-a", { acao: "enviar", vinculoId: "v1", jogos: [] })).s, 400);
  /* plano grátis: troca de scouts com o Competição tem cadeado (Essencial e Premium) */
  store["orgs/orgA/meta/info"] = { plano: "gratis" };
  assert.strictEqual((await POST(IC.handler, "tok-a", { acao: "enviar", vinculoId: "v1", jogos: [{ id: "j1", resumo: resumo(10) }] })).s, 403, "grátis não troca scouts");
  delete store["orgs/orgA/meta/info"];
  /* enviar: cópia na conta do atleta, sem o que é proibido, sem duplicar */
  let r = await POST(IC.handler, "tok-a", { acao: "enviar", vinculoId: "v1", jogos: [{ id: "j1", resumo: resumo(10) }, { id: "j2", resumo: resumo(30) }, { id: "", resumo: {} }] });
  assert.strictEqual(r.s, 200); assert.strictEqual(r.enviados, 2);
  const ids = Object.keys(store).filter((k) => k.startsWith("jogadores/at1/scouts/")); assert.strictEqual(ids.length, 2);
  assert.ok(!JSON.stringify(store).includes("NUNCA"), "adversário e anotações nunca vão para o atleta");
  assert.strictEqual(store[ids[0]].origem, "treinador");
  await POST(IC.handler, "tok-a", { acao: "enviar", vinculoId: "v1", jogos: [{ id: "j1", resumo: resumo(12) }] });
  assert.strictEqual(Object.keys(store).filter((k) => k.startsWith("jogadores/at1/scouts/")).length, 2, "mesmo jogo = mesma cópia");
  /* o atleta lê as cópias na aba de scouts, sem link */
  const lidos = await SC.scoutsVigentes(admin.firestore().collection("jogadores").doc("at1"));
  assert.strictEqual(lidos.length, 2); assert.ok(lidos.every((x) => x.estado === "ativo" && x.origem === "treinador" && x.resumo && x.resumo.detalhe.games[0].s === 1), "cópia aparece como ativa, com o game a game");
  assert.ok(lidos.some((x) => x.resumo.n === 12), "reenviar atualiza a cópia");
  /* retirar: só o que este treinador enviou */
  store["jogadores/at1/scouts/outra"] = { origem: "treinador", orgId: "orgZ", copia: JSON.stringify(resumo(5)), dataJogo: "x" };
  r = await POST(IC.handler, "tok-a", { acao: "retirar", vinculoId: "v1", ids: ["j1"] });
  assert.strictEqual(r.retirados, 1); assert.ok(store["jogadores/at1/scouts/outra"], "cópia de outra academia fica");
  assert.strictEqual(Object.keys(store).filter((k) => k.startsWith("jogadores/at1/scouts/")).length, 2);
  /* jogo ao vivo ligado ao atleta: ao terminar a partida a cópia fica na conta dele */
  const ini = await POST(AV.handler, "tok-a", { acao: "iniciar", vinculoId: "v1", resumo: resumo(4) });
  assert.strictEqual(ini.s, 200);
  await POST(AV.handler, "tok-a", { acao: "atualizar", token: ini.token, resumo: resumo(20) });
  assert.ok(!Object.keys(store).some((k) => k.startsWith("jogadores/at1/scouts/av")), "durante o jogo ainda não há cópia");
  await POST(AV.handler, "tok-a", { acao: "atualizar", token: ini.token, resumo: resumo(40, { concluida: true }), fim: true });
  const av = Object.keys(store).filter((k) => k.startsWith("jogadores/at1/scouts/av")); assert.strictEqual(av.length, 1, "cópia ao fim da partida");
  store["scoutsAoVivo/" + ini.token].expiraEm = new Date(Date.now() - 1000).toISOString();
  assert.ok((await SC.scoutsVigentes(admin.firestore().collection("jogadores").doc("at1"))).some((x) => x.origem === "ao-vivo" && x.resumo.n === 40), "o link vence, a cópia continua");
  /* trazer: só os jogos que este treinador marcou */
  store["jogadores/at1/scouts/avOutro"] = { origem: "ao-vivo", marcadoPor: "uZ", copia: JSON.stringify(resumo(50)), dataJogo: "2026-10-01" };
  r = await POST(IC.handler, "tok-a", { acao: "jogos", vinculoId: "v1" });
  assert.strictEqual(r.s, 200); assert.strictEqual(r.jogos.length, 1, "só o que ele marcou"); assert.strictEqual(r.jogos[0].resumo.n, 40);
  assert.ok(!JSON.stringify(r).includes("NUNCA"), "resposta limpa");
  /* encerrar no meio também guarda, se o jogo já tem pontos */
  const i2 = await POST(AV.handler, "tok-a", { acao: "iniciar", vinculoId: "v1", resumo: resumo(14) });
  await POST(AV.handler, "tok-a", { acao: "revogar", token: i2.token });
  assert.ok(Object.keys(store).some((k) => k === "jogadores/at1/scouts/av" + i2.token.slice(0, 30)), "encerrar guarda a cópia com 10 pontos ou mais");
  const i3 = await POST(AV.handler, "tok-a", { acao: "iniciar", vinculoId: "v1", resumo: resumo(3) });
  await POST(AV.handler, "tok-a", { acao: "revogar", token: i3.token });
  assert.ok(!Object.keys(store).some((k) => k === "jogadores/at1/scouts/av" + i3.token.slice(0, 30)), "jogo com poucos pontos não guarda");
  assert.strictEqual((await IC.handler({ httpMethod: "GET", headers: {} })).statusCode, 405);
  console.log("check-scout-intercambio: ok");
})().catch((e) => { console.error(e); process.exit(1); });
