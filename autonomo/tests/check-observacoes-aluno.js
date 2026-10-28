/* Observações e conversas compartilhadas com o aluno (ver-aluno.js), com Firestore e bucket em memória:
   · só vão as marcadas "compartilhado" (descritivo, itens, se tem áudio); o caminho do arquivo nunca vai no conteúdo;
   · ?audio=<registro>:<observação> devolve link temporário só para áudio compartilhado do próprio jogador.
   Rode: node tests/check-observacoes-aluno.js */
const path = require("path"), assert = require("assert");
const fx = path.join(__dirname, "..", "netlify/functions/");
const dados = {};
const docRef = (k) => ({ get: async () => ({ exists: k in dados, data: () => dados[k] }), set: async (v) => { dados[k] = v; } });
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin: { firestore: () => ({ collection: () => ({ doc: () => ({ collection: () => ({ doc: docRef }) }) }) }) }, app: () => {} } };
require.cache[require.resolve(fx + "_olhar-armazenamento.js")] = { id: "z", filename: "z", loaded: true, exports: { bucket: async () => ({ file: (c) => ({ async getSignedUrl() { return ["https://assinada/" + c]; } }) }) } };
const { handler } = require(fx + "ver-aluno.js");
const get = async (q) => { const r = await handler({ httpMethod: "GET", queryStringParameters: Object.assign({ org: "org1", id: "j1", t: "tok" }, q || {}) }); return { s: r.statusCode, d: JSON.parse(r.body) }; };
const aud = (n) => ({ caminho: "audios/org1/j1/1730000000000-abc12" + n + ".webm", tipo: "audio/webm", duracaoSeg: 42 });
dados["mty:alunos:v2"] = { value: JSON.stringify([
  { id: "j1", nome: "Lia", linkToken: "tok", horarios: [],
    relatoriosAtleta: [{ id: "rel1", status: "rascunho", observacao: "rascunho secreto", dados: { nome: "Lia" } }, { id: "rel2", status: "publicado", publicadoEm: "2026-10-30T10:00:00Z", publicadoPor: "Richard", observacao: "Bom mês", dados: { nome: "Lia", numeros: { jogos: 2 } } }],
    registros: [
    { id: "o1", tipo: "observacao", contexto: "partida", data: "2026-10-20", torneio: "Copa", adversario: "Carla", compartilhado: true, descritivo: "Você sacou bem.",
      resumo: { positivos: "- Saque firme", atencao: "", insights: "", perguntas: "- Pergunta interna", prioridades: "" },
      obs: [{ id: "a", cat: "saque", tipo: "bom", em: "2026-10-20T10:00:00Z" }, { id: "b", cat: "geral", texto: "Respire entre os pontos", audio: aud(1) }, { id: "p", natureza: "pergunta", texto: "Pergunta interna" }] },
    { id: "o2", tipo: "observacao", contexto: "conversa", titulo: "Almoço", data: "2026-10-21", compartilhado: false, obs: [{ id: "c", cat: "geral", texto: "Segredo", audio: aud(2) }] },
    { id: "o3", tipo: "observacao", contexto: "conversa", titulo: "Outro aluno?", data: "2026-10-22", compartilhado: true, obs: [{ id: "d", cat: "geral", audio: { caminho: "audios/org1/j2/1730000000000-zzzzzz.webm" } }] },
  ] },
]) };
(async () => {
  let r = await get();
  assert.strictEqual(r.s, 200);
  assert.deepStrictEqual(r.d.observacoes.map((o) => o.id), ["o3", "o1"], "só as compartilhadas, mais recente primeiro");
  const o1 = r.d.observacoes[1];
  assert(o1.descritivo === "Você sacou bem." && o1.itens.length === 3 && o1.itens[1].audio === true && o1.itens[1].duracaoSeg === 42, "descritivo e itens");
  assert(!JSON.stringify(r.d).includes("audios/") && !JSON.stringify(r.d).includes("Segredo"), "nem caminho de arquivo nem conversa não compartilhada");
  assert(o1.resumo && o1.resumo.positivos === "- Saque firme" && !JSON.stringify(r.d).includes("Pergunta interna"), "resumo sem as perguntas internas");
  assert.deepStrictEqual(r.d.relatoriosAtleta.map((x) => [x.id, x.treinador, x.observacao]), [["rel2", "Richard", "Bom mês"]], "só o relatório publicado");
  assert(!JSON.stringify(r.d).includes("rascunho secreto"), "rascunho não sai");
  r = await get({ audio: "o1:b" }); assert(r.s === 200 && r.d.url === "https://assinada/audios/org1/j1/1730000000000-abc121.webm", "áudio compartilhado abre");
  assert.strictEqual((await get({ audio: "o2:c" })).s, 404, "não compartilhado não abre");
  assert.strictEqual((await get({ audio: "o3:d" })).s, 404, "arquivo de outro jogador não abre");
  assert.strictEqual((await get({ audio: "o1:a" })).s, 404, "observação sem áudio");
  assert.strictEqual((await get({ audio: "o1:b", t: "errado" })).s, 404, "sem o token do link não abre");
  console.log("check-observacoes-aluno: ok");
})().catch((e) => { console.error(e); process.exit(1); });
