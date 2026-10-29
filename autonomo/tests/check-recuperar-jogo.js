/* Function recuperar-jogo (só o dono, só leitura): acha um jogo apagado nas cópias que ficaram — caderno de outro jogador, partida em
   andamento guardada, link ao vivo da família (resumo com a série ponto a ponto) e cópia no Competição. Rode: node tests/check-recuperar-jogo.js */
const assert = require("assert"), path = require("path"), Module = require("module");
const serie = Array.from({ length: 195 }, (_, i) => [i % 2, i < 120 ? 1 : 2, "15-0", "erro_dele"]);
const pub = { atleta: "Nicolas", data: "2026-10-20", torneio: "ITF Foz do Iguaçu", resultado: "4-6 7-6", concluida: false, n: 195, ganhos: 95, pctGanhos: 49, serie, observacaoFinal: "Jogador teve câimbra no 1/1 do terceiro set" };
const alunos = [
  { id: "n1", nome: "Nicolas Kanashiro", registros: [{ id: "j9", tipo: "jogo", data: "2026-10-28", torneio: "jogo-treino", adversario: "Leo", scout: { pontos: [{ n: 1 }] } }] },
  { id: "n2", nome: "Nicolas K.", registros: [], scoutRascunho: { salvoEm: "2026-10-20T04:30:00Z", cfg: { torneio: "ITF Foz do Iguaçu", adversario: "Simon Escudeiro" }, pontos: Array.from({ length: 195 }, (_, i) => ({ n: i + 1 })), placar: {} } },
  { id: "a3", nome: "Ana", registros: [] },
];
const docs = {
  "orgs/team-yoda/dados/mty:alunos:v2": { value: JSON.stringify(alunos) },
};
const vivos = [
  { id: "aaaabbbbccccddddeeeeffff00001111", data: () => ({ orgId: "team-yoda", publico: JSON.stringify(pub), criadoEm: "2026-10-20T01:00:00Z" }) },
  { id: "9999bbbbccccddddeeeeffff00001111", data: () => ({ orgId: "outra-academia", publico: JSON.stringify(pub) }) },
];
const copias = [{ id: "tyJ1", data: () => ({ orgId: "team-yoda", copia: JSON.stringify(pub), dataJogo: "2026-10-20", rotulo: "ITF Foz do Iguaçu · 4-6 7-6" }) }];
let escreveu = false;
const doc = (c) => ({ get: async () => ({ exists: !!docs[c], data: () => docs[c] }), set: async () => { escreveu = true; }, update: async () => { escreveu = true; }, delete: async () => { escreveu = true; }, collection: (x) => col(c + "/" + x) });
const col = (c) => ({ doc: (d) => doc(c + "/" + d), where: (campo, op, v) => ({ get: async () => (c === "scoutsAoVivo" ? vivos.filter((d) => d.data()[campo] === v) : []) }) });
const adminFalso = {
  auth: () => ({ verifyIdToken: async (t) => { if (t === "dono") return { email: "tsukada.richard@gmail.com", orgId: "team-yoda" }; if (t === "prof") return { email: "prof@x.com", orgId: "team-yoda" }; throw new Error("x"); } }),
  firestore: () => ({ collection: (c) => col(c), collectionGroup: () => ({ get: async () => copias }) }),
};
const carregar = Module._load;
Module._load = function (pedido) { if (/_firebase-admin$/.test(pedido)) return { admin: adminFalso, app: () => {} }; return carregar.apply(this, arguments); };
const fn = require(path.join(__dirname, "../../netlify/functions/recuperar-jogo.js"));
const chamar = (token, corpo, metodo) => fn.handler({ httpMethod: metodo || "POST", headers: token ? { authorization: "Bearer " + token } : {}, body: JSON.stringify(corpo) }).then((r) => ({ status: r.statusCode, corpo: JSON.parse(r.body) }));
(async () => {
  assert.strictEqual((await chamar(null, { acao: "buscar", termo: "nicolas" })).status, 401, "sem login");
  assert.strictEqual((await chamar("prof", { acao: "buscar", termo: "nicolas" })).status, 403, "professor não procura");
  assert.strictEqual((await chamar("dono", { acao: "buscar" })).status, 400, "precisa de termo ou data");
  let r = await chamar("dono", { acao: "buscar", termo: "Foz do Iguacu" });
  assert.strictEqual(r.status, 200);
  const fontes = r.corpo.achados.map((x) => x.fonte);
  assert.deepStrictEqual(fontes.sort(), ["ao-vivo", "competicao", "rascunho"], "acha a partida guardada, o link ao vivo e a cópia " + fontes);
  assert.strictEqual(r.corpo.achados[0].fonte, "rascunho", "a partida com todos os pontos vem primeiro");
  assert.strictEqual(r.corpo.achados[0].rascunho.pontos.length, 195);
  const vivo = r.corpo.achados.find((x) => x.fonte === "ao-vivo");
  assert(vivo.resumo.serie.length === 195 && vivo.resumo.observacaoFinal.includes("câimbra") && vivo.id.length === 8, "resumo com a série ponto a ponto; o token não volta inteiro");
  r = await chamar("dono", { acao: "buscar", data: "2026-10-28" });
  assert.deepStrictEqual(r.corpo.achados.map((x) => x.fonte + ":" + x.id), ["caderno:j9"], "busca por data acha o jogo do caderno");
  r = await chamar("dono", { acao: "buscar", termo: "nicolas", data: "2026-10-20" });
  assert(r.corpo.achados.every((x) => x.data === "2026-10-20"), "termo + data filtram juntos");
  assert(!r.corpo.achados.some((x) => x.id === "9999bbbb"), "link de outra academia não aparece");
  assert.strictEqual(escreveu, false, "só lê");
  console.log("check-recuperar-jogo: ok");
})().catch((e) => { console.error(e); process.exit(1); });
