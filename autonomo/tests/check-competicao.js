/* Competição: papéis e vínculos (regras puras + o handler contra um Firestore em memória). Rode: node tests/check-competicao.js */
const path = require("path");
const assert = require("assert");
const fx = path.join(__dirname, "../netlify/functions/");
const C = require(fx + "_player-competicao.js");

/* ── regras puras ── */
assert.strictEqual(C.idadeEm("2010-06-15", "2026-06-14"), 15);
assert.strictEqual(C.idadeEm("2010-06-15", "2026-06-15"), 16);
assert.strictEqual(C.idadeEm("2010-02-31", "2026-06-15"), null);
assert.strictEqual(C.idadeEm("1800-01-01", "2026-06-15"), null);
assert.ok(C.ehMenor("2010-06-15", "2026-06-15") && !C.ehMenor("2008-06-15", "2026-06-15"));
assert.deepStrictEqual(C.areasValidas(["perfil", "x", "perfil", "diario"]), ["perfil", "diario"]);
assert.ok(!C.AREAS_PADRAO.includes("diario"));
assert.strictEqual(C.normalizarCodigo(" ab-cd 12345 xyz"), "ABCD1234");
assert.strictEqual(C.gerarCodigo().length, 8);
assert.deepStrictEqual(C.perfilCompartilhavel({ nivel: "a", mao: "destro", relato: "segredo", observacoes: "x", adversario: { nome: "y" }, piso: "" }, { mao: { destro: "Destro" } }), [{ campo: "nivel", rotulo: "Nível", valor: "a" }, { campo: "mao", rotulo: "Mão", valor: "Destro" }]);

/* ── Firestore em memória ── */
const dados = {}; let seq = 0;
function col(nome) { return dados[nome] || (dados[nome] = {}); }
function docRef(nome, id) {
  return {
    id,
    async get() { const v = col(nome)[id]; return { exists: !!v, id, data: () => v && JSON.parse(JSON.stringify(v)) }; },
    async set(v, o) { col(nome)[id] = o && o.merge ? merge(col(nome)[id] || {}, v) : JSON.parse(JSON.stringify(v)); },
    async update(v) { Object.assign(col(nome)[id], JSON.parse(JSON.stringify(v))); },
    async delete() { delete col(nome)[id]; },
    collection(sub) { return colRef(nome + "/" + id + "/" + sub); },
  };
}
function merge(a, b) { const o = { ...a }; for (const k of Object.keys(b)) o[k] = b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) ? merge(a[k] || {}, b[k]) : b[k]; return o; }
function colRef(nome, filtros = [], lim) {
  return {
    doc: (id) => docRef(nome, id),
    async add(v) { const id = "doc" + String(++seq).padStart(12, "0"); col(nome)[id] = JSON.parse(JSON.stringify(v)); return docRef(nome, id); },
    where(c, op, v) { return colRef(nome, filtros.concat([[c, v]]), lim); },
    limit(n) { return colRef(nome, filtros, n); },
    async get() {
      let ids = Object.keys(col(nome)).filter((id) => filtros.every(([c, v]) => col(nome)[id][c] === v));
      if (lim) ids = ids.slice(0, lim);
      const docs = ids.map((id) => ({ id, ref: docRef(nome, id), data: () => JSON.parse(JSON.stringify(col(nome)[id])) }));
      return { empty: !docs.length, docs, forEach: (f) => docs.forEach(f) };
    },
    async listDocuments() { return Object.keys(col(nome)).map((id) => docRef(nome, id)); },
  };
}
const tokens = {};
const fake = {
  admin: { firestore: () => ({ collection: (n) => colRef(n) }), auth: () => ({}) },
  ErroPublico: class extends Error { constructor(s, m) { super(m); this.status = s; } },
  resposta: (statusCode, corpo) => ({ statusCode, body: JSON.stringify(corpo) }),
  usuarioDoPedido: async (ev) => { const t = ev.headers.authorization; if (!tokens[t]) throw new fake.ErroPublico(401, "login"); return tokens[t]; },
  refJogador: (uid) => docRef("jogadores", uid), OPCOES: { nivel: { intermediario: "Intermediário — sustenta trocas" } },
};
require.cache[require.resolve(fx + "_player.js")] = { id: "x", filename: "x", loaded: true, exports: fake };
/* Anthropic simulado: devolve o que a variável respostaIA mandar */
let respostaIA = null, chamadasIA = 0;
const SDK = path.join(__dirname, "fake-sdk.js");
require.cache[SDK] = { id: SDK, filename: SDK, loaded: true, exports: class { constructor() {} get messages() { return { create: async () => { chamadasIA++; if (respostaIA instanceof Error) throw respostaIA; return { content: [{ type: "text", text: JSON.stringify(respostaIA) }] }; } }; } } };
const Module = require("module"), resolverOriginal = Module._resolveFilename;
Module._resolveFilename = function (req, ...r) { return req === "@anthropic-ai/sdk" ? SDK : resolverOriginal.call(this, req, ...r); };
process.env.ANTHROPIC_API_KEY = "teste";
const handler = require(fx + "player-competicao.js").handler;
const handlerT = require(fx + "player-torneios.js").handler;
const TT = require(fx + "_player-torneios.js");

function pessoa(uid, nome) { tokens[uid] = { uid, email: uid + "@t.com", name: nome }; col("jogadores")[uid] = { nome, email: uid + "@t.com" }; }
async function post(uid, corpo) { const r = await handler({ httpMethod: "POST", headers: { authorization: uid }, body: JSON.stringify(corpo) }); return { s: r.statusCode, ...JSON.parse(r.body) }; }
async function postT(uid, corpo) { const r = await handlerT({ httpMethod: "POST", headers: { authorization: uid }, body: JSON.stringify(corpo) }); return { s: r.statusCode, ...JSON.parse(r.body) }; }
async function getT(uid) { const r = await handlerT({ httpMethod: "GET", headers: { authorization: uid } }); return { s: r.statusCode, ...JSON.parse(r.body) }; }
async function get(uid, qs) { const r = await handler({ httpMethod: "GET", headers: { authorization: uid }, queryStringParameters: qs }); return { s: r.statusCode, ...JSON.parse(r.body) }; }

(async () => {
  pessoa("menor", "Atleta Menor"); pessoa("adulto", "Atleta Adulto"); pessoa("resp", "Mãe"); pessoa("trein", "Treinador"); pessoa("intruso", "Intruso");
  const ano = new Date().getFullYear();
  assert.strictEqual((await get("intruso")).competicao.ativo, false);
  assert.strictEqual((await post("intruso", { acao: "convidar", tipo: "treinador" })).s, 409, "sem papel não convida");
  assert.strictEqual((await post("menor", { acao: "ativar", papel: "atleta", nascimento: "lixo" })).s, 400);
  assert.strictEqual((await post("menor", { acao: "ativar", papel: "atleta", nascimento: (ano - 14) + "-01-10" })).s, 200);
  assert.strictEqual((await post("adulto", { acao: "ativar", papel: "atleta", nascimento: (ano - 30) + "-01-10" })).s, 200);
  assert.strictEqual((await post("resp", { acao: "ativar", papel: "responsavel" })).s, 200);
  assert.strictEqual((await post("trein", { acao: "ativar", papel: "treinador" })).s, 200);
  assert.strictEqual((await post("intruso", { acao: "ativar", papel: "treinador" })).s, 200);
  assert.strictEqual((await get("menor")).competicao.menor, true);

  /* menor: treinador só depois de um responsável ativo */
  assert.strictEqual((await post("menor", { acao: "convidar", tipo: "treinador" })).s, 409);
  const cr = await post("menor", { acao: "convidar", tipo: "responsavel", areas: ["perfil", "diario"] });
  assert.strictEqual(cr.s, 200); assert.strictEqual(cr.codigo.length, 8);
  /* o convite do atleta mostra o código só para ele */
  assert.ok((await get("menor")).meus[0].codigo);
  /* papel errado e código errado */
  assert.strictEqual((await post("trein", { acao: "aceitarCodigo", codigo: cr.codigo })).s, 409);
  assert.strictEqual((await post("resp", { acao: "aceitarCodigo", codigo: "ZZZZZZZZ" })).s, 404);
  assert.strictEqual((await post("menor", { acao: "aceitarCodigo", codigo: cr.codigo })).s, 403);
  assert.strictEqual((await post("resp", { acao: "aceitarCodigo", codigo: cr.codigo.toLowerCase() })).s, 200);
  /* ainda sem aprovação: não enxerga nada */
  const idResp = (await get("menor")).meus[0].id;
  assert.strictEqual((await get("resp", { ver: idResp })).s, 404);
  /* ninguém além do atleta decide */
  assert.strictEqual((await post("resp", { acao: "decidir", id: idResp, aprovar: true })).s, 403);
  assert.strictEqual((await post("intruso", { acao: "decidir", id: idResp, aprovar: true })).s, 403);
  assert.strictEqual((await post("menor", { acao: "decidir", id: idResp, aprovar: true })).s, 200);
  /* o código não vale duas vezes */
  assert.strictEqual((await post("intruso", { acao: "aceitarCodigo", codigo: cr.codigo })).s, 404);
  /* responsável ativo vê só o perfil; diário marcado mas ainda sem dados nesta fatia */
  col("jogadores").menor.ficha = { nivel: "intermediario", relato: "segredo", observacoes: "x" };
  const ver = await get("resp", { ver: idResp });
  assert.strictEqual(ver.s, 200); assert.deepStrictEqual(ver.dados.perfil, [{ campo: "nivel", rotulo: "Nível", valor: "Intermediário" }]); assert.deepStrictEqual(ver.emBreve, []); assert.deepStrictEqual(ver.dados.diario, [], "diário marcado e ainda vazio");
  assert.strictEqual((await get("intruso", { ver: idResp })).s, 404, "terceiros não leem");
  assert.strictEqual((await get("trein", { ver: idResp })).s, 404);

  /* treinador do menor: aprovação é do responsável, não do atleta */
  const ct = await post("menor", { acao: "convidar", tipo: "treinador" });
  assert.strictEqual(ct.s, 200);
  assert.strictEqual((await post("trein", { acao: "aceitarCodigo", codigo: ct.codigo })).s, 200);
  const idTr = (await get("trein")).comigo[0].id;
  assert.strictEqual((await post("menor", { acao: "decidir", id: idTr, aprovar: true })).s, 403, "menor sozinho não aprova treinador");
  assert.strictEqual((await get("resp")).paraDecidir.length, 1);
  assert.strictEqual((await post("resp", { acao: "decidir", id: idTr, aprovar: true })).s, 200);
  assert.strictEqual((await get("trein", { ver: idTr })).s, 200);
  /* diário não vem por padrão */
  assert.ok(!(await get("trein", { ver: idTr })).areas.includes("diario"));
  /* áreas: responsável do menor pode editar; treinador não */
  assert.strictEqual((await post("trein", { acao: "areas", id: idTr, areas: ["perfil", "diario"] })).s, 403);
  assert.strictEqual((await post("resp", { acao: "areas", id: idTr, areas: ["perfil"] })).s, 200);
  assert.strictEqual((await post("resp", { acao: "areas", id: idTr, areas: [] })).s, 400);

  /* revogar o último responsável encerra o treinador do menor */
  assert.strictEqual((await post("intruso", { acao: "revogar", id: idResp })).s, 403);
  assert.strictEqual((await post("resp", { acao: "revogar", id: idResp })).s, 200);
  assert.strictEqual((await get("resp", { ver: idResp })).s, 404);
  assert.strictEqual((await get("trein", { ver: idTr })).s, 404, "treinador do menor cai junto");
  assert.strictEqual((await post("resp", { acao: "revogar", id: idResp })).s, 409);

  /* adulto: aprova sozinho; a própria pessoa também revoga */
  const ca = await post("adulto", { acao: "convidar", tipo: "treinador" });
  await post("trein", { acao: "aceitarCodigo", codigo: ca.codigo });
  const idA = (await get("adulto")).meus[0].id;
  assert.strictEqual((await post("adulto", { acao: "decidir", id: idA, aprovar: true })).s, 200);
  assert.strictEqual((await get("trein", { ver: idA })).s, 200);
  assert.strictEqual((await post("trein", { acao: "revogar", id: idA })).s, 200);
  assert.strictEqual((await get("trein", { ver: idA })).s, 404);

  /* convite vencido e cancelamento; mudar de papel com vínculo aberto */
  const cv = await post("adulto", { acao: "convidar", tipo: "treinador" });
  const idV = (await get("adulto")).meus.filter((x) => x.status === "convite")[0].id;
  col("vinculos")[idV].expiraEm = "2000-01-01";
  assert.strictEqual((await post("trein", { acao: "aceitarCodigo", codigo: cv.codigo })).s, 404);
  assert.strictEqual((await get("adulto")).meus.filter((x) => x.id === idV)[0].status, "expirado");
  const cc = await post("adulto", { acao: "convidar", tipo: "responsavel" });
  assert.strictEqual((await post("adulto", { acao: "ativar", papel: "treinador" })).s, 409);
  const idC = (await get("adulto")).meus.filter((x) => x.codigo === cc.codigo)[0].id;
  assert.strictEqual((await post("adulto", { acao: "revogar", id: idC })).s, 200);
  assert.strictEqual(col("vinculos")[idC].status, "cancelado");

  /* limite de tentativas erradas */
  pessoa("forca", "Força"); await post("forca", { acao: "ativar", papel: "treinador" });
  for (let i = 0; i < 10; i++) assert.strictEqual((await post("forca", { acao: "aceitarCodigo", codigo: "AAAAAAAA" })).s, 404);
  assert.strictEqual((await post("forca", { acao: "aceitarCodigo", codigo: "AAAAAAAA" })).s, 429);

  /* ── torneios ── */
  const hojeBR = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  const mais = (n) => TT.diasAte(hojeBR, hojeBR) === 0 && new Date(Date.parse(hojeBR + "T12:00:00Z") + n * 86400000).toISOString().slice(0, 10);
  assert.strictEqual((await getT("resp")).s, 403, "só atleta tem temporada");
  assert.strictEqual((await postT("adulto", { acao: "salvar", nome: "", inicio: mais(10) })).s, 400);
  assert.strictEqual((await postT("adulto", { acao: "salvar", nome: "X", inicio: "2026-13-40" })).s, 400);
  assert.strictEqual((await postT("adulto", { acao: "salvar", nome: "X", inicio: mais(10), fim: mais(5) })).s, 400);
  assert.strictEqual((await postT("adulto", { acao: "salvar", nome: "X", inicio: mais(10), urlOrigem: "javascript:alert(1)" })).s, 400);
  const t1 = await postT("adulto", { acao: "salvar", nome: "Copa Teste", inicio: mais(20), fim: mais(25), cidade: "Itajaí", superficie: "saibro", urlOrigem: "https://exemplo.org/t/1", observacao: "privado", origem: "link" });
  assert.strictEqual(t1.s, 200);
  const t2 = await postT("adulto", { acao: "salvar", nome: "Aberto Passado", inicio: mais(-30), fim: mais(-28), estado: "encerrado" });
  assert.strictEqual(t2.s, 200);
  const lista = await getT("adulto");
  assert.deepStrictEqual(lista.torneios.map((t) => t.nome), ["Copa Teste", "Aberto Passado"]);
  assert.strictEqual(lista.torneios[0].fase, "proximo"); assert.strictEqual(lista.torneios[1].fase, "passado");
  assert.ok(col("jogadores/adulto/torneios")[t1.id].coletadoEm, "origem por link guarda a data da coleta");
  assert.strictEqual((await postT("adulto", { acao: "salvar", id: t1.id, nome: "Copa Teste II", inicio: mais(20), estado: "inscrito" })).s, 200);
  assert.strictEqual((await getT("adulto")).torneios[0].estado, "inscrito");
  assert.strictEqual((await postT("menor", { acao: "salvar", id: t1.id, nome: "Invasão", inicio: mais(20) })).s, 404, "não edita o torneio de outro atleta");
  assert.strictEqual(col("jogadores/adulto/torneios")[t1.id].nome, "Copa Teste II");
  /* treinador vê o calendário sem a observação, só com a área marcada */
  const cT = await post("adulto", { acao: "convidar", tipo: "treinador", areas: ["perfil", "temporada"] });
  await post("trein", { acao: "aceitarCodigo", codigo: cT.codigo });
  const idT = (await get("adulto")).meus.filter((x) => x.codigo === cT.codigo || x.status === "aguardando")[0].id;
  await post("adulto", { acao: "decidir", id: idT, aprovar: true });
  const vt = await get("trein", { ver: idT });
  assert.strictEqual(vt.dados.torneios.length, 2); assert.ok(!("observacao" in vt.dados.torneios[0]));
  assert.deepStrictEqual(vt.emBreve, []);
  await post("adulto", { acao: "areas", id: idT, areas: ["perfil"] });
  assert.ok(!("torneios" in (await get("trein", { ver: idT })).dados), "sem a área, sem torneios");
  /* extração: proposta validada, nada salvo, limite diário, erro e texto sem torneio */
  const antes = Object.keys(col("jogadores/adulto/torneios")).length;
  respostaIA = { encontrado: true, nome: "ADK Juniors Cup", inicio: mais(40), fim: mais(45), cidade: "Itajaí", local: "", categoria: "G2 Sub-16", superficie: "saibro", circuito: "COSAT", prazoInscricao: mais(50) };
  const ex = await postT("adulto", { acao: "extrair", texto: "Confirmação de inscrição no torneio ADK Juniors Cup, Itajaí, categoria G2 Sub-16." });
  assert.strictEqual(ex.s, 200); assert.strictEqual(ex.proposta.nome, "ADK Juniors Cup"); assert.strictEqual(ex.proposta.prazoInscricao, "", "prazo depois do início é descartado");
  assert.strictEqual(ex.proposta.origem, "colado");
  assert.strictEqual(Object.keys(col("jogadores/adulto/torneios")).length, antes, "extrair não salva");
  respostaIA = { encontrado: false, nome: "", inicio: "", fim: "", cidade: "", local: "", categoria: "", superficie: "", circuito: "", prazoInscricao: "" };
  assert.strictEqual((await postT("adulto", { acao: "extrair", texto: "texto qualquer sem torneio nenhum aqui dentro" })).s, 422);
  respostaIA = new Error("falhou");
  assert.strictEqual((await postT("adulto", { acao: "extrair", texto: "texto qualquer sem torneio nenhum aqui dentro" })).s, 502);
  assert.strictEqual((await postT("adulto", { acao: "extrair", texto: "curto" })).s, 400);
  assert.strictEqual((await postT("adulto", { acao: "extrair", texto: "x".repeat(6001) })).s, 400);
  respostaIA = { encontrado: false };
  for (let i = 0; i < 10; i++) await postT("adulto", { acao: "extrair", texto: "texto qualquer sem torneio nenhum aqui dentro" });
  assert.strictEqual((await postT("adulto", { acao: "extrair", texto: "texto qualquer sem torneio nenhum aqui dentro" })).s, 429);
  assert.strictEqual((await postT("adulto", { acao: "excluir", id: t2.id })).s, 200);
  assert.strictEqual((await postT("adulto", { acao: "excluir", id: t2.id })).s, 404);

  /* ── preparação, diário e partidas do torneio ── */
  const hojeD = hojeBR;
  assert.strictEqual((await postT("adulto", { acao: "salvarPreparo", torneioId: t1.id })).s, 400, "preparo vazio");
  assert.strictEqual((await postT("adulto", { acao: "salvarPreparo", torneioId: "naoexiste123", adversario: "X" })).s, 404);
  const pr = await postT("adulto", { acao: "salvarPreparo", torneioId: t1.id, rodada: "Oitavas", adversario: "João", prioridades: ["Saque no T", " ", "Devolução funda", "Rede", "quarta ignorada"], padrao: "Direita inside-out", hipoteses: "Joga muito cruzado", planoId: "planoinexistente1" });
  assert.strictEqual(pr.s, 200);
  const salvoPr = col("jogadores/adulto/preparos")[pr.id];
  assert.deepStrictEqual(salvoPr.prioridades, ["Saque no T", "Devolução funda", "Rede"]); assert.strictEqual(salvoPr.planoId, null, "estratégia de outra conta/inexistente é descartada");
  assert.strictEqual((await postT("menor", { acao: "salvarPreparo", id: pr.id, torneioId: t1.id, adversario: "Y" })).s, 404, "não edita preparo de outro");
  const di = await postT("adulto", { acao: "salvarDiario", data: hojeD, texto: "Dormi mal, mas joguei solto.", humor: 4, torneioId: t1.id });
  assert.strictEqual(di.s, 200);
  assert.strictEqual((await postT("adulto", { acao: "salvarDiario", data: mais(3), texto: "futuro" })).s, 400);
  assert.strictEqual((await postT("adulto", { acao: "salvarDiario", data: hojeD, texto: "  " })).s, 400);
  const all = await getT("adulto");
  assert.strictEqual(all.preparos.length, 1); assert.strictEqual(all.diario.length, 1);
  assert.strictEqual((await getT("menor")).diario.length, 0, "diário é do dono");
  /* o treinador só vê preparo/partida/diário conforme as áreas marcadas */
  col("jogadores/adulto/partidas").pa1 = { data: hojeD, tipo: "competicao", resultado: "vitoria", placar: "6-4 6-3", adversario: "João", torneioId: t1.id, rodada: "Oitavas", obs: "segredo", funcionouTexto: "segredo" };
  await post("adulto", { acao: "areas", id: idT, areas: ["perfil", "estrategias", "partidas"] });
  const v3 = await get("trein", { ver: idT });
  assert.strictEqual(v3.dados.preparos.length, 1); assert.strictEqual(v3.dados.partidas.length, 1);
  assert.ok(!JSON.stringify(v3).includes("segredo"), "texto livre da partida não sai");
  assert.ok(!("diario" in v3.dados), "diário continua privado sem marcação");
  await post("adulto", { acao: "areas", id: idT, areas: ["perfil", "diario"] });
  assert.strictEqual((await get("trein", { ver: idT })).dados.diario.length, 1);
  /* excluir o torneio leva a preparação e solta partida e diário */
  assert.strictEqual((await postT("adulto", { acao: "excluir", id: t1.id })).s, 200);
  assert.strictEqual(Object.keys(col("jogadores/adulto/preparos")).length, 0);
  assert.strictEqual(col("jogadores/adulto/partidas").pa1.torneioId, null);
  assert.strictEqual(col("jogadores/adulto/diario")[di.id].torneioId, null);
  const PARTT = require(fx + "_player-partidas.js");
  const np = PARTT.normalizarPartida({ data: hojeD, resultado: "vitoria", torneioId: "abcdefghij12", rodada: "  Final  " }, hojeD);
  assert.strictEqual(np.torneioId, "abcdefghij12"); assert.strictEqual(np.rodada, "Final");

  console.log("check-competicao: ok");
})().catch((e) => { console.error(e); process.exit(1); });
