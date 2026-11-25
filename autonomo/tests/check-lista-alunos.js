/* Lista de jogadores em partes (26/11/2026, netlify/functions/_lista-alunos.js): a lista do Team Yoda passou de 1 MiB (limite de um
   documento do Firestore) e nada mais salvava. Confere: dividir e juntar; ler a v2 enquanto a v3 não existe; a primeira gravação
   cria a v3 em partes sem mexer na v2; gravar menor apaga as partes que sobraram; partes de versões diferentes não são misturadas;
   ver-aluno (link do aluno) grava só a mudança daquele jogador. Rode: node autonomo/tests/check-lista-alunos.js */
const assert = require("assert"), path = require("path");
const fx = path.join(__dirname, "../../netlify/functions/");
const LA = require(fx + "_lista-alunos.js");
const store = {};
const J = (v) => JSON.parse(JSON.stringify(v));
const docRef = (p) => ({ path: p, id: p.split("/").pop(), collection: (n) => colRef(p + "/" + n), get: async () => ({ exists: store[p] !== undefined, data: () => J(store[p]) }), set: async (v) => { store[p] = J(v); }, delete: async () => { delete store[p]; } });
const colRef = (p) => ({ doc: (id) => docRef(p + "/" + id) });
const db = { collection: (n) => colRef(n), runTransaction: async (fn) => { const escritas = []; const tx = { get: (r) => r.get(), set: (r, v) => escritas.push(() => r.set(v)), delete: (r) => escritas.push(() => r.delete()) }; const out = await fn(tx); for (const w of escritas) await w(); return out; } };
const base = db.collection("orgs").doc("team-yoda").collection("dados");
const grande = [...Array(400).keys()].map((i) => ({ id: "a" + i, nome: "Aluno " + i + " ção", registros: [...Array(10).keys()].map((k) => ({ id: "r" + k, texto: "x".repeat(250) + "ã" })) }));

(async () => {
  /* dividir */
  const t = "á".repeat(LA.MAX_CHARS * 2 + 5);
  assert.strictEqual(LA.dividir(t).join(""), t); assert.strictEqual(LA.dividir(t).length, 3);
  assert(LA.dividir(t).every((p) => Buffer.byteLength(p, "utf8") < 1000000), "cada parte abaixo de 1 MB");
  /* sem v3: lê a v2 */
  store["orgs/team-yoda/dados/mty:alunos:v2"] = { value: JSON.stringify(grande) };
  const bytesV2 = Buffer.byteLength(store["orgs/team-yoda/dados/mty:alunos:v2"].value);
  assert(bytesV2 > 1100000, "lista de teste maior que 1 MiB: " + bytesV2);
  assert.strictEqual((await LA.lerAlunos(base)).length, 400);
  /* primeira gravação cria a v3 em partes; a v2 fica como estava */
  await LA.mudarAlunos(db, base, (l) => [...l, { id: "novo", nome: "Lia" }]);
  const pr = store["orgs/team-yoda/dados/mty:alunos:v3"];
  assert(pr && pr.partes >= 2 && pr.versao && pr.bytes > 1100000, JSON.stringify(pr));
  for (let i = 1; i <= pr.partes; i++) { const d = store["orgs/team-yoda/dados/mty:alunos:v3~" + i]; assert(d && d.versao === pr.versao && Buffer.byteLength(JSON.stringify(d)) < 1048576, "parte " + i); }
  assert.strictEqual(JSON.parse(store["orgs/team-yoda/dados/mty:alunos:v2"].value).length, 400, "v2 intacta");
  const lida = await LA.lerAlunos(base);
  assert.strictEqual(lida.length, 401); assert.strictEqual(lida[400].nome, "Lia"); assert.strictEqual(lida[3].nome, "Aluno 3 ção");
  /* gravar menor apaga as partes que sobraram */
  const antes = pr.partes;
  await LA.mudarAlunos(db, base, () => [{ id: "so", nome: "Um" }]);
  assert.strictEqual(store["orgs/team-yoda/dados/mty:alunos:v3"].partes, 1);
  for (let i = 2; i <= antes; i++) assert(!store["orgs/team-yoda/dados/mty:alunos:v3~" + i], "parte " + i + " apagada");
  assert.deepStrictEqual(await LA.lerAlunos(base), [{ id: "so", nome: "Um" }]);
  /* partes de versões diferentes: não mistura */
  store["orgs/team-yoda/dados/mty:alunos:v3~1"].versao = "outra";
  await assert.rejects(() => LA.lerTexto(base), /sendo gravada/);
  /* ver-aluno: o link do aluno grava só a mudança dele, na v3 */
  store["orgs/team-yoda/dados/mty:alunos:v3~1"].versao = store["orgs/team-yoda/dados/mty:alunos:v3"].versao;
  await LA.mudarAlunos(db, base, () => [{ id: "x1", nome: "Ana", linkToken: "tok-1234567890abcdef" }, { id: "x2", nome: "Bia", notas: "do professor" }]);
  const fsFalso = () => db; fsFalso.FieldValue = {};
  require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin: { firestore: fsFalso }, app: () => {} } };
  const VA = require(fx + "ver-aluno.js").interno;
  const ctx = await VA.carregarContexto("team-yoda", "x1", "tok-1234567890abcdef");
  /* um professor muda a Bia enquanto isso: a gravação do aluno não pode desfazer */
  await LA.mudarAlunos(db, base, (l) => l.map((a) => (a.id === "x2" ? { ...a, notas: "mudou agora" } : a)));
  const r = await VA.executarAcao("team-yoda", "x1", { acao: "duvida", texto: "Quero treinar o saque" }, ctx);
  assert.strictEqual(r.statusCode, 200, r.body);
  const fim = await LA.lerAlunos(base);
  assert.strictEqual(fim.find((a) => a.id === "x1").pedidosConteudo[0].texto, "Quero treinar o saque");
  assert.strictEqual(fim.find((a) => a.id === "x2").notas, "mudou agora", "não desfez a mudança do professor");
  console.log("check-lista-alunos: ok");
})().catch((e) => { console.error(e.stack || e); process.exit(1); });
