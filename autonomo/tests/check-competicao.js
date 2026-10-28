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
    where(c, op, v) { return colRef(nome, filtros.concat([[c, v, op]]), lim); },
    limit(n) { return colRef(nome, filtros, n); },
    async get() {
      let ids = Object.keys(col(nome)).filter((id) => filtros.every(([c, v, op]) => (op === "in" ? v.includes(col(nome)[id][c]) : col(nome)[id][c] === v)));
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
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin: fake.admin, app: () => {} } };
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
  /* diário por registro: sem a área marcada, só o que o atleta compartilhou com este vínculo, um a um */
  const di2 = await postT("adulto", { acao: "salvarDiario", data: hojeD, texto: "segundo registro, privado", humor: 3 });
  assert.strictEqual((await postT("adulto", { acao: "compartilharDiario", id: di.id, vinculoIds: ["vinculoQueNaoExiste"] })).s, 400, "só vínculo ativo do próprio atleta");
  assert.strictEqual((await postT("menor", { acao: "compartilharDiario", id: di.id, vinculoIds: [idT] })).s, 404, "outro atleta não alcança o registro");
  assert.strictEqual((await postT("adulto", { acao: "compartilharDiario", id: di.id, vinculoIds: [idT] })).s, 200);
  let v4 = await get("trein", { ver: idT });
  assert.strictEqual(v4.dados.diario.length, 1); assert.strictEqual(v4.dados.diario[0].id, di.id); assert.ok(!JSON.stringify(v4).includes("segundo registro"), "o outro registro continua privado"); assert.strictEqual(v4.diarioPorRegistro, true);
  assert.ok(!JSON.stringify(v4).includes("compartilhadoCom"));
  await postT("adulto", { acao: "salvarDiario", id: di.id, data: hojeD, texto: "editado", humor: 4 });
  assert.strictEqual((await get("trein", { ver: idT })).dados.diario.length, 1, "editar não revoga o compartilhamento");
  assert.strictEqual((await postT("adulto", { acao: "compartilharDiario", id: di.id, vinculoIds: [] })).s, 200);
  assert.ok(!(await get("trein", { ver: idT })).dados.diario, "revogado: nada do diário");
  await post("adulto", { acao: "areas", id: idT, areas: ["perfil", "diario"] });
  assert.strictEqual((await get("trein", { ver: idT })).dados.diario.length, 2, "com a área marcada vê todo o diário");
  /* excluir o torneio leva a preparação e solta partida e diário */
  assert.strictEqual((await postT("adulto", { acao: "excluir", id: t1.id })).s, 200);
  assert.strictEqual(Object.keys(col("jogadores/adulto/preparos")).length, 0);
  assert.strictEqual(col("jogadores/adulto/partidas").pa1.torneioId, null);
  assert.strictEqual(col("jogadores/adulto/diario")[di.id].torneioId, null);
  const PARTT = require(fx + "_player-partidas.js");
  const np = PARTT.normalizarPartida({ data: hojeD, resultado: "vitoria", torneioId: "abcdefghij12", rodada: "  Final  " }, hojeD);
  assert.strictEqual(np.torneioId, "abcdefghij12"); assert.strictEqual(np.rodada, "Final");

  /* ── devolutiva do treinador e "levar para o treino" ── */
  await post("adulto", { acao: "areas", id: idT, areas: ["perfil", "temporada", "partidas", "treinos"] });
  const t3b = await postT("adulto", { acao: "salvar", nome: "Copa Devolutiva", inicio: mais(9) });
  col("jogadores/adulto/partidas").partida0001 = { data: hojeD, tipo: "treino", resultado: "vitoria", dificuldades: [] };
  col("jogadores/adulto/partidas").partida0002 = { data: hojeD, tipo: "competicao", resultado: "derrota", placar: "4-6 4-6", adversario: "Caio", torneioId: t3b.id, rodada: "Final", dificuldades: ["saque", "devolucao", "inexistente"], obs: "segredo2" };
  assert.strictEqual((await post("resp", { acao: "devolutiva", id: idT, tipo: "geral", destaques: "x" })).s, 403, "só o treinador do vínculo escreve");
  assert.strictEqual((await post("trein", { acao: "devolutiva", id: idT, tipo: "geral" })).s, 400, "devolutiva vazia");
  assert.strictEqual((await post("trein", { acao: "devolutiva", id: idT, tipo: "partida", refId: "naoexiste12", destaques: "x" })).s, 404);
  /* recomendação livre: texto aberto, sem ligar a torneio ou partida; só o treinador do vínculo escreve */
  assert.strictEqual((await post("trein", { acao: "devolutiva", id: idT, tipo: "recomendacao", recomendacao: "x" })).s, 400, "recomendação vazia");
  assert.strictEqual((await post("resp", { acao: "devolutiva", id: idT, tipo: "recomendacao", recomendacao: "Leia sobre rotina entre pontos." })).s, 403);
  const rec = await post("trein", { acao: "devolutiva", id: idT, tipo: "recomendacao", assunto: "Rotina", recomendacao: "Leia sobre rotina entre pontos e teste no próximo treino.", foco: "respirar antes do saque" });
  assert.strictEqual(rec.s, 200); const dRec = Object.keys(dados).filter((k) => /devolutivas$/.test(k)).map((k) => dados[k][rec.id]).filter(Boolean)[0];
  assert.strictEqual(dRec.tipo, "recomendacao"); assert.strictEqual(dRec.refRotulo, "Recomendação · Rotina"); assert.strictEqual(dRec.refId, null); assert.ok(dRec.recomendacao.startsWith("Leia sobre")); assert.strictEqual(dRec.autorUid, "trein");
  assert.strictEqual((await post("trein", { acao: "excluirDevolutiva", id: idT, devolutivaId: rec.id })).s, 200);
  const dv = await post("trein", { acao: "devolutiva", id: idT, tipo: "partida", refId: "partida0002", destaques: "Boa agressividade.", melhorar: "Primeiro saque.", foco: "Primeiro saque em 65%" });
  assert.strictEqual(dv.s, 200);
  const dvT = await post("trein", { acao: "devolutiva", id: idT, tipo: "torneio", refId: t3b.id, destaques: "Evolução clara no torneio." });
  assert.strictEqual(dvT.s, 200);
  await post("adulto", { acao: "areas", id: idT, areas: ["perfil", "treinos"] });
  assert.strictEqual((await post("trein", { acao: "devolutiva", id: idT, tipo: "partida", refId: "partida0002", destaques: "x" })).s, 403, "sem a área partidas não comenta partida");
  const meus = await getT("adulto");
  assert.strictEqual(meus.devolutivas.length, 2); assert.ok(meus.devolutivas.some((d) => d.autorNome === "Treinador" && d.refRotulo === "Contra Caio · " + hojeD));
  assert.strictEqual((await getT("menor")).devolutivas.length, 0, "devolutiva é do atleta");
  /* levar para o treino: um foco por aspecto, sem duplicar */
  assert.strictEqual((await postT("adulto", { acao: "levarParaTreino", partidaId: "partida0001" })).s, 409, "partida sem dificuldades");
  const lv = await postT("adulto", { acao: "levarParaTreino", partidaId: "partida0002" });
  assert.strictEqual(lv.s, 200); assert.strictEqual(lv.novos, 2);
  const lv2 = await postT("adulto", { acao: "levarParaTreino", partidaId: "partida0002" });
  assert.strictEqual(lv2.novos, 0, "repetir não duplica");
  const idDev = meus.devolutivas.filter((d) => d.foco)[0].id;
  assert.strictEqual((await postT("adulto", { acao: "levarParaTreino", devolutivaId: idDev })).novos, 1);
  assert.strictEqual((await postT("adulto", { acao: "levarParaTreino", devolutivaId: meus.devolutivas.filter((d) => !d.foco)[0].id })).s, 409);
  let focos = (await getT("adulto")).focos;
  assert.strictEqual(focos.length, 3); assert.ok(focos.every((f) => f.status === "aberto"));
  const fSaque = focos.filter((f) => f.aspecto === "saque")[0];
  assert.strictEqual((await postT("adulto", { acao: "atualizarFoco", id: fSaque.id, status: "treinando" })).s, 200);
  assert.strictEqual((await postT("adulto", { acao: "atualizarFoco", id: fSaque.id, status: "invalido" })).s, 400);
  await postT("adulto", { acao: "levarParaTreino", partidaId: "partida0002" });
  assert.strictEqual((await getT("adulto")).focos.filter((f) => f.id === fSaque.id)[0].status, "treinando", "repetir não desfaz o andamento");
  assert.strictEqual((await postT("menor", { acao: "atualizarFoco", id: fSaque.id, status: "resolvido" })).s, 404, "foco é do dono");
  /* o treinador vê os focos (área treinos) e só as devolutivas que escreveu */
  const vt3 = await get("trein", { ver: idT });
  assert.strictEqual(vt3.dados.focos.length, 3); assert.strictEqual(vt3.devolutivas.length, 2);
  assert.ok(!JSON.stringify(vt3).includes("segredo2"));
  col("jogadores/adulto/devolutivas").outradevolut1 = { autorUid: "outro", autorNome: "Outro", tipo: "geral", destaques: "de outro treinador", criadoEm: "2026-01-01" };
  assert.ok(!(await get("trein", { ver: idT })).devolutivas.some((d) => d.id === "outradevolut1"), "treinador não vê devolutiva de outro treinador");
  assert.strictEqual((await post("trein", { acao: "excluirDevolutiva", id: idT, devolutivaId: "outradevolut1" })).s, 404, "só apaga a própria");
  assert.strictEqual((await post("trein", { acao: "excluirDevolutiva", id: idT, devolutivaId: dvT.id })).s, 200);
  /* pai e mãe: sem responsável ativo o atleta aprova o primeiro (a mãe); o segundo (o pai) só entra com a aprovação dela */
  const cMae = await post("menor", { acao: "convidar", tipo: "responsavel", parentesco: "mae" }); assert.strictEqual(cMae.s, 200);
  assert.strictEqual((await post("resp", { acao: "aceitarCodigo", codigo: cMae.codigo })).s, 200);
  const idMae = (await get("menor")).meus.filter((x) => x.status === "aguardando")[0].id;
  assert.strictEqual((await post("menor", { acao: "decidir", id: idMae, aprovar: true })).s, 200, "primeiro responsável: o atleta aprova");
  pessoa("pai", "Pai"); assert.strictEqual((await post("pai", { acao: "ativar", papel: "responsavel" })).s, 200);
  assert.strictEqual((await post("menor", { acao: "convidar", tipo: "responsavel", parentesco: "tio-avo" })).s, 400, "parentesco desconhecido");
  const crm = await post("menor", { acao: "convidar", tipo: "responsavel", parentesco: "pai" });
  assert.strictEqual(crm.s, 200);
  assert.strictEqual((await post("pai", { acao: "aceitarCodigo", codigo: crm.codigo })).s, 200);
  const meus1 = (await get("menor")).meus, vPai = meus1.filter((x) => x.status === "aguardando")[0], idRm = vPai.id;
  assert.strictEqual(vPai.parentesco, "pai");
  assert.strictEqual((await post("menor", { acao: "decidir", id: idRm, aprovar: true })).s, 403, "menor sozinho não aprova o 2º responsável");
  assert.strictEqual((await post("pai", { acao: "decidir", id: idRm, aprovar: true })).s, 403, "o próprio convidado não se aprova");
  const paraDec = (await get("resp")).paraDecidir; assert.ok(paraDec.some((x) => x.id === idRm && x.tipo === "responsavel" && x.parentesco === "pai"), "a mãe vê o pedido do pai para decidir");
  assert.strictEqual((await post("resp", { acao: "decidir", id: idRm, aprovar: true })).s, 200, "a mãe aprova o pai");
  assert.strictEqual((await get("pai", { ver: idRm })).s, 200, "o pai passa a ver o atleta");
  /* um responsável não mexe no vínculo do outro; o atleta e a própria pessoa mexem */
  assert.strictEqual((await post("resp", { acao: "revogar", id: idRm })).s, 403, "a mãe não encerra o vínculo do pai");
  assert.strictEqual((await post("resp", { acao: "areas", id: idRm, areas: ["perfil"] })).s, 403);
  /* o mesmo responsável não usa dois códigos para o mesmo atleta */
  const dup = await post("menor", { acao: "convidar", tipo: "responsavel", parentesco: "outro" }); assert.strictEqual((await post("pai", { acao: "aceitarCodigo", codigo: dup.codigo })).s, 409);
  /* limite de responsáveis por atleta */
  assert.strictEqual((await post("menor", { acao: "convidar", tipo: "responsavel" })).s, 200);
  assert.strictEqual((await post("menor", { acao: "convidar", tipo: "responsavel" })).s, 409, "o quarto vínculo já passa do limite (mãe, pai, convite do duplicado e mais um)");
  const nResp = (await get("menor")).meus.filter((x) => x.tipo === "responsavel" && ["convite", "aguardando", "ativo"].includes(x.status)).length; assert.ok(nResp <= 4, "no máximo 4 responsáveis");
  /* encerrar um dos dois não derruba os treinadores: ainda há um responsável ativo */
  assert.strictEqual((await post("pai", { acao: "revogar", id: idRm })).s, 200, "o pai pode sair");
  assert.strictEqual((await get("resp", { ver: idMae })).s, 200, "a mãe continua vinculada");
  col("jogadores/menor/devolutivas").dm1 = { autorUid: "xx", autorNome: "Coach", tipo: "geral", destaques: "ok", criadoEm: "2026-01-01" };
  assert.strictEqual((await get("resp", { ver: idMae })).devolutivas.length, 1);
  assert.strictEqual(col("jogadores/adulto/focos") && Object.keys(col("jogadores/adulto/focos")).length, 3);

  /* jogo ao vivo ligado ao atleta: aparece para o próprio atleta e para quem o acompanha com a área "partidas" */
  const futuro = new Date(Date.now() + 3600000).toISOString(), pub = (r) => JSON.stringify({ aoVivo: true, resultado: r, torneio: "Copa", atleta: "Atleta" });
  col("vinculos").avz1 = { tipo: "responsavel", status: "ativo", pessoaUid: "resp", atletaUid: "menor", atletaNome: "Atleta Menor", areas: ["partidas"] };
  col("vinculos").avz2 = { tipo: "treinador", status: "ativo", pessoaUid: "trein", atletaUid: "menor", atletaNome: "Atleta Menor", areas: ["diario"] };
  col("scoutsAoVivo").t1 = { atletaUid: "menor", expiraEm: futuro, criadoEm: "2026-10-18T10:00:00Z", publico: pub("6-4 1-0") };
  col("scoutsAoVivo").t2 = { atletaUid: "menor", expiraEm: new Date(Date.now() - 1000).toISOString(), criadoEm: "x", publico: pub("velho") };
  col("scoutsAoVivo").t3 = { atletaUid: "adulto", expiraEm: futuro, criadoEm: "x", publico: pub("outro") };
  const tk = (u) => get(u, { aoVivo: "1" });
  assert.deepStrictEqual((await tk("menor")).jogos.map((j) => j.token), ["t1"], "o atleta vê o próprio jogo (vencido e de outros não)");
  const rj = await tk("resp"); assert.deepStrictEqual(rj.jogos.map((j) => j.token), ["t1"]); assert.strictEqual(rj.jogos[0].atleta, "Atleta Menor"); assert.strictEqual(rj.jogos[0].resultado, "6-4 1-0");
  assert.deepStrictEqual((await tk("trein")).jogos, [], "treinador sem a área partidas não vê");
  col("vinculos").avz2.areas = ["partidas"]; assert.deepStrictEqual((await tk("trein")).jogos.map((j) => j.token), ["t1"]);
  col("vinculos").avz2.status = "revogado"; assert.deepStrictEqual((await tk("trein")).jogos, [], "vínculo encerrado não vê");
  assert.deepStrictEqual((await tk("intruso")).jogos, [], "estranho não vê");
  assert.ok(!JSON.stringify(await tk("resp")).includes("publico"), "só o recorte mínimo");

  /* vínculo da academia: o termo da matrícula cobre o menor — código fixo do treinador ativa direto; pedido do treinador é aprovado pelo próprio atleta */
  pessoa("menor2", "Atleta Menor 2"); pessoa("treinA", "Treinador Academia"); await post("treinA", { acao: "ativar", papel: "treinador" });
  assert.strictEqual((await post("menor2", { acao: "ativar", papel: "atleta", nascimento: (ano - 12) + "-03-01" })).s, 200);
  assert.strictEqual((await post("menor2", { acao: "convidar", tipo: "treinador" })).s, 409, "o convite comum de um menor sem responsável continua bloqueado");
  col("codigosAcademia").ABCD2345 = { treinadorUid: "treinA", treinadorNome: "Treinador Academia", treinadorEmail: "treinA@t.com", orgId: "orgA" };
  assert.strictEqual((await post("trein", { acao: "vincularAcademia", codigo: "ABCD2345" })).s, 403, "só atleta usa o código da academia");
  assert.strictEqual((await post("menor2", { acao: "vincularAcademia", codigo: "ZZZZZZZZ" })).s, 404, "código inexistente");
  const va = await post("menor2", { acao: "vincularAcademia", codigo: "abcd-2345" });
  assert.strictEqual(va.s, 200); assert.strictEqual(va.treinador, "Treinador Academia");
  const vv = col("vinculos")[va.id];
  assert.ok(vv.status === "ativo" && vv.origem === "academia" && vv.pessoaUid === "treinA" && vv.atletaUid === "menor2" && vv.orgId === "orgA", "vínculo ativo da academia, sem responsável");
  assert.strictEqual((await post("menor2", { acao: "vincularAcademia", codigo: "ABCD2345" })).s, 409, "não duplica");
  const meus2 = (await get("menor2")).meus.find((v) => v.id === va.id);
  assert.strictEqual(meus2.origem, "academia"); assert.ok(!JSON.stringify(meus2).includes("orgA"), "orgId não sai para o navegador");
  assert.strictEqual((await post("menor2", { acao: "revogar", id: va.id })).s, 200, "o atleta encerra quando quiser");
  /* pedido do treinador (aguardando): o próprio atleta menor aprova; o responsável de outro atleta não */
  col("vinculos").pedidoAcademiaA1 = { atletaUid: "menor2", atletaNome: "Atleta Menor 2", tipo: "treinador", origem: "academia", status: "aguardando", areas: ["perfil"], pessoaUid: "treinA", pessoaNome: "Treinador Academia", historico: [], criadoEm: "2026-10-01" };
  assert.strictEqual((await post("resp", { acao: "decidir", id: "pedidoAcademiaA1", aprovar: true })).s, 403, "estranho não aprova");
  assert.strictEqual((await post("treinA", { acao: "decidir", id: "pedidoAcademiaA1", aprovar: true })).s, 403, "o treinador não aprova o próprio pedido");
  assert.strictEqual((await post("menor2", { acao: "decidir", id: "pedidoAcademiaA1", aprovar: true })).s, 200, "menor da academia aprova sem responsável");
  assert.strictEqual(col("vinculos").pedidoAcademiaA1.status, "ativo");
  /* pedido comum (sem origem academia) de menor continua exigindo responsável */
  col("vinculos").pedidoComumB001 = { atletaUid: "menor2", atletaNome: "Atleta Menor 2", tipo: "treinador", status: "aguardando", areas: ["perfil"], pessoaUid: "trein", pessoaNome: "T", historico: [], criadoEm: "2026-10-01" };
  assert.strictEqual((await post("menor2", { acao: "decidir", id: "pedidoComumB001", aprovar: true })).s, 403, "fluxo comum de menor segue exigindo responsável");

  /* treinador pelo app QuadraLab Treinador (conta de academia): ver o atleta e escrever devolutivas só no Essencial/Premium (academia sem plano: liberado) */
  tokens.treinA = { ...(tokens.treinA || { uid: "treinA", name: "Treinador Academia" }), orgId: "orgA" };
  assert.strictEqual((await get("treinA", { ver: "pedidoAcademiaA1" })).s, 200, "academia sem plano definido vê");
  col("orgs/orgA/meta").info = { plano: "gratis" };
  const bloq = await get("treinA", { ver: "pedidoAcademiaA1" });
  assert.strictEqual(bloq.s, 403); assert.ok(/Essencial e Premium/.test(bloq.erro));
  assert.strictEqual((await post("treinA", { acao: "devolutiva", id: "pedidoAcademiaA1", tipo: "geral", destaques: "Boa semana." })).s, 403, "grátis não escreve devolutiva");
  col("orgs/orgA/meta").info = { plano: "essencial", planoAtivoAte: "2000-01-01" };
  assert.strictEqual((await get("treinA", { ver: "pedidoAcademiaA1" })).s, 403, "plano vencido bloqueia");
  col("orgs/orgA/meta").info = { plano: "essencial" };
  assert.strictEqual((await get("treinA", { ver: "pedidoAcademiaA1" })).s, 200, "Essencial vê");
  assert.strictEqual((await post("treinA", { acao: "devolutiva", id: "pedidoAcademiaA1", tipo: "geral", destaques: "Boa semana." })).s, 200, "Essencial escreve devolutiva");
  assert.strictEqual((await get("trein", { ver: idT })).s, 200, "treinador sem academia (só Competição) não muda");

  console.log("check-competicao: ok");
})().catch((e) => { console.error(e); process.exit(1); });
