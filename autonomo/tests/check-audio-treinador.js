/* Áudios do treinador (audio-treinador.js), com Firebase e bucket em memória:
   · só treinador logado; plano grátis não grava (Essencial/Premium e academia sem plano gravam);
   · o caminho é sempre audios/<academia>/<jogador>/…; formato e tamanho conferidos; ouvir e apagar só os da própria academia.
   Rode: node tests/check-audio-treinador.js */
const path = require("path"), assert = require("assert");
const fx = path.join(__dirname, "..", "netlify/functions/");
const store = {}, apagados = [];
const docRef = (p) => ({ async get() { return { exists: store[p] !== undefined, data: () => store[p] }; }, collection: (n) => colRef(p + "/" + n) });
const colRef = (p) => ({ doc: (id) => docRef(p + "/" + id) });
const auth = { async verifyIdToken(t) { const m = { prof1: { uid: "prof1", orgId: "org1" }, prof2: { uid: "prof2", orgId: "org2" }, aluno: { uid: "al1", tipo: "aluno" } }; if (!m[t]) throw new Error("x"); return m[t]; } };
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin: { firestore: () => ({ collection: (n) => colRef(n) }), auth: () => auth }, app: () => {} } };
const copias = [];
const bucket = { file: (c) => ({ caminho: c, async getSignedUrl(o) { return ["https://bucket/" + o.action + "/" + c]; }, async delete() { apagados.push(c); }, async copy(dest) { copias.push([c, dest.caminho]); } }) };
require.cache[require.resolve(fx + "_olhar-armazenamento.js")] = { id: "z", filename: "z", loaded: true, exports: { bucket: async () => bucket } };
const { handler } = require(fx + "audio-treinador.js");
const post = async (tk, b) => { const r = await handler({ httpMethod: "POST", headers: tk ? { authorization: "Bearer " + tk } : {}, body: JSON.stringify(b) }); return { s: r.statusCode, ...JSON.parse(r.body) }; };

(async () => {
  assert.strictEqual((await post(null, { acao: "envio" })).s, 401);
  assert.strictEqual((await post("aluno", { acao: "envio" })).s, 403, "conta de aluno não grava");
  store["orgs/org1/meta/info"] = { plano: "gratis" };
  assert.strictEqual((await post("prof1", { acao: "envio", alunoId: "j1", contentType: "audio/webm", tamanho: 1000 })).s, 403, "grátis não grava");
  store["orgs/org1/meta/info"] = { plano: "essencial" };
  let r = await post("prof1", { acao: "envio", alunoId: "j1", contentType: "audio/mp4;codecs=mp4a", tamanho: 2000 });
  assert(r.s === 200 && /^audios\/org1\/j1\/\d+-[a-z0-9]{6}\.m4a$/.test(r.caminho) && /write/.test(r.url) && r.cabecalhos["content-type"] === "audio/mp4", JSON.stringify(r));
  assert.strictEqual((await post("prof1", { acao: "envio", alunoId: "j1", contentType: "video/mp4", tamanho: 10 })).s, 400, "só áudio");
  assert.strictEqual((await post("prof1", { acao: "envio", alunoId: "j1", contentType: "audio/webm", tamanho: 31 * 1024 * 1024 })).s, 400, "até 30 MB");
  assert.strictEqual((await post("prof1", { acao: "envio", alunoId: "../x", contentType: "audio/webm", tamanho: 10 })).s, 400, "jogador inválido");
  const caminho = r.caminho;
  r = await post("prof1", { acao: "ouvir", caminho }); assert(r.s === 200 && /read/.test(r.url), "ouve o próprio");
  assert.strictEqual((await post("prof2", { acao: "ouvir", caminho })).s, 404, "outra academia não ouve");
  assert.strictEqual((await post("prof1", { acao: "ouvir", caminho: "olhar/x/1.mp3" })).s, 404, "fora de audios/ não");
  assert.strictEqual((await post("prof2", { acao: "apagar", caminho })).s, 404);
  assert.strictEqual((await post("prof1", { acao: "apagar", caminho })).s, 200); assert.deepStrictEqual(apagados, [caminho]);
  /* mover para outro jogador (registro corrigido): copia para a pasta dele e apaga o antigo; outra academia não move */
  const r2 = await post("prof1", { acao: "envio", alunoId: "j1", contentType: "audio/webm", tamanho: 10 });
  assert.strictEqual((await post("prof2", { acao: "mover", caminho: r2.caminho, alunoId: "j2" })).s, 404);
  assert.strictEqual((await post("prof1", { acao: "mover", caminho: r2.caminho, alunoId: "../x" })).s, 400);
  const mv = await post("prof1", { acao: "mover", caminho: r2.caminho, alunoId: "j2" });
  assert(mv.s === 200 && mv.caminho === r2.caminho.replace("/j1/", "/j2/") && copias.length === 1 && apagados.includes(r2.caminho), JSON.stringify(mv));
  assert.strictEqual((await post("prof1", { acao: "mover", caminho: mv.caminho, alunoId: "j2" })).caminho, mv.caminho, "mesmo jogador: nada muda");
  delete store["orgs/org2/meta/info"];
  assert.strictEqual((await post("prof2", { acao: "envio", alunoId: "j9", contentType: "audio/webm", tamanho: 10 })).s, 200, "academia sem plano definido grava");
  console.log("check-audio-treinador: ok");
})().catch((e) => { console.error(e); process.exit(1); });
