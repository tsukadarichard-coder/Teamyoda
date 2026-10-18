/* Acompanhamento MTY: contratação (menor de idade, pagamento só pelo consultor), início do ciclo, encontros, revisão semanal, dúvidas, encerramento e privacidade.
   Rode: node tests/check-comp-acompanhamento.js */
const path = require("path"), assert = require("assert");
const fx = path.join(__dirname, "../netlify/functions/");
const store = {}; let seq = 0;
const J = (v) => JSON.parse(JSON.stringify(v));
function aninhado(v, dentro) { if (Array.isArray(v)) { if (dentro) throw new Error("Nested arrays are not supported"); v.forEach((x) => aninhado(x, true)); } else if (v && typeof v === "object") { Object.values(v).forEach((x) => { if (x === undefined) throw new Error("undefined no Firestore"); aninhado(x, false); }); } }
function merge(a, b) { const o = { ...a }; for (const k of Object.keys(b)) o[k] = b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) ? merge(a[k] || {}, b[k]) : b[k]; return o; }
function docRef(p) {
  return {
    id: p.split("/").pop(),
    async get() { const v = store[p]; return { exists: v !== undefined, id: p.split("/").pop(), data: () => J(v) }; },
    async set(v, o) { aninhado(v); store[p] = o && o.merge ? merge(store[p] || {}, J(v)) : J(v); },
    async update(v) { aninhado(v); Object.assign(store[p], J(v)); },
    async delete() { delete store[p]; },
    collection: (c) => colRef(p + "/" + c),
  };
}
function colRef(p, filtros = [], lim) {
  const ids = () => Object.keys(store).filter((k) => k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/")).filter((k) => filtros.every(([c, v]) => store[k][c] === v));
  return {
    doc: (id) => docRef(p + "/" + id),
    async add(v) { aninhado(v); const id = "doc" + String(++seq).padStart(12, "0"); store[p + "/" + id] = J(v); return docRef(p + "/" + id); },
    where: (c, op, v) => colRef(p, filtros.concat([[c, v]]), lim),
    limit: (n) => colRef(p, filtros, n),
    async listDocuments() { return ids().map((k) => docRef(k)); },
    async get() { let l = ids(); if (lim) l = l.slice(0, lim); const docs = l.map((k) => ({ id: k.split("/").pop(), ref: docRef(k), data: () => J(store[k]) })); return { empty: !docs.length, docs, forEach: (f) => docs.forEach(f) }; },
  };
}
const apagados = [];
const admin = { firestore: () => ({ collection: (n) => colRef(n) }), auth: () => ({ deleteUser: async (u) => { apagados.push(u); } }) };
const tokens = {};
class ErroPublico extends Error { constructor(s, m) { super(m); this.status = s; } }
const fakePlayer = {
  admin, ErroPublico, OPCOES: {}, resposta: (statusCode, corpo) => ({ statusCode, body: JSON.stringify(corpo) }),
  usuarioDoPedido: async (ev) => { const t = ev.headers.authorization; if (!tokens[t]) throw new ErroPublico(401, "login"); return tokens[t]; },
  refJogador: (uid) => docRef("jogadores/" + uid),
};
require.cache[require.resolve(fx + "_player.js")] = { id: "x", filename: "x", loaded: true, exports: fakePlayer };
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin, app: () => {} } };
const SDK = path.join(__dirname, "fake-sdk.js");
require.cache[SDK] = { id: SDK, filename: SDK, loaded: true, exports: class { constructor() {} } };
const Module = require("module"), resolverOriginal = Module._resolveFilename;
Module._resolveFilename = function (req, ...r) { return req === "@anthropic-ai/sdk" ? SDK : resolverOriginal.call(this, req, ...r); };
process.env.ADMIN_SECRET = "segredo-do-consultor";
const AC = require(fx + "comp-acompanhamento.js").handler, ADM = require(fx + "admin-acompanhamentos.js").handler, PRIV = require(fx + "player-privacidade.js").handler;
const A = require(fx + "_comp-acompanhamento.js");

const hojeStr = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const mais = (n) => A.addDias(hojeStr, n);
const ano = +hojeStr.slice(0, 4);
function pessoa(uid, papel, nasc) { tokens[uid] = { uid, email: uid + "@t.com", name: uid, tipo: "jogador" }; store["jogadores/" + uid] = { nome: uid, competicao: { papel, ...(papel === "atleta" ? { nascimento: nasc || (ano - 25) + "-03-03" } : {}) } }; }
const U = async (uid, corpo, id) => { const r = await AC({ httpMethod: corpo ? "POST" : "GET", headers: { authorization: uid }, queryStringParameters: id ? { id } : {}, body: corpo ? JSON.stringify(corpo) : undefined }); return { s: r.statusCode, ...JSON.parse(r.body) }; };
const D = async (corpo, segredo) => { const r = await ADM({ httpMethod: corpo ? "POST" : "GET", headers: { "x-admin-secret": segredo === undefined ? "segredo-do-consultor" : segredo }, body: corpo ? JSON.stringify(corpo) : undefined }); return { s: r.statusCode, ...JSON.parse(r.body) }; };
function vinculo(id, atleta, p, tipo, areas) { store["vinculos/" + id] = { atletaUid: atleta, atletaNome: atleta, pessoaUid: p, pessoaNome: p, pessoaEmail: p + "@t.com", tipo, status: "ativo", areas, criadoEm: "2026-01-01" }; }

(async () => {
  pessoa("adulto", "atleta"); pessoa("menor", "atleta", (ano - 14) + "-05-05"); pessoa("mae", "responsavel"); pessoa("richard", "treinador"); pessoa("outro", "treinador"); pessoa("intruso", "atleta");
  vinculo("vincRichard001", "adulto", "richard", "treinador", ["perfil", "temporada", "partidas"]);

  /* oferta: preço total e período transparentes */
  const g0 = await U("adulto");
  assert.strictEqual(g0.s, 200); assert.strictEqual(g0.produto.totalCentavos, 237000); assert.strictEqual(g0.produto.parcelas, 3); assert.strictEqual(g0.produto.parcelaCentavos, 79000); assert.strictEqual(g0.produto.meses, 3);
  assert.ok(/não há renovação automática/.test(g0.produto.formato) && /3 pagamentos de R\$ 790/.test(g0.produto.formato) && /R\$ 2\.370/.test(g0.produto.formato));
  assert.ok(g0.produto.naoInclui.length === 5 && g0.produto.inclui.length === 6);
  assert.deepStrictEqual(g0.acompanhamentos, []);

  /* contratação */
  assert.strictEqual((await U("adulto", { acao: "solicitar" })).s, 400, "exige aceite das condições");
  const s1 = await U("adulto", { acao: "solicitar", aceito: true, articulacao: true });
  assert.strictEqual(s1.s, 200); assert.strictEqual(s1.estado, "aguardando_pagamento");
  assert.strictEqual((await U("adulto", { acao: "solicitar", aceito: true })).s, 409, "só um em aberto");
  let a = (await U("adulto")).acompanhamentos[0];
  assert.strictEqual(a.parcelas.length, 3); assert.ok(a.parcelas.every((p) => p.estado === "pendente" && p.valorCentavos === 79000));
  assert.strictEqual(a.encontros.length, 0, "nada de encontros antes do início");
  const pg = await U("adulto", { acao: "pagar", id: s1.id }); assert.ok(pg.manual && /wa\.me/.test(pg.contato)); assert.strictEqual((await U("adulto")).acompanhamentos[0].parcelas[0].estado, "pendente", "o app nunca marca pago");
  assert.strictEqual((await U("intruso", { acao: "cancelar", id: s1.id })).s, 404);

  /* menor de idade: responsável primeiro */
  assert.strictEqual((await U("menor", { acao: "solicitar", aceito: true })).s, 409);
  vinculo("vincMae000001", "menor", "mae", "responsavel", ["perfil"]);
  const sm = await U("menor", { acao: "solicitar", aceito: true }); assert.strictEqual(sm.estado, "aguardando_responsavel");
  assert.strictEqual((await U("menor", { acao: "confirmar", id: sm.id })).s, 403, "o menor não confirma");
  assert.strictEqual((await U("menor", { acao: "pagar", id: sm.id })).s, 409, "ainda não está em pagamento");
  assert.strictEqual((await U("mae", { acao: "confirmar", id: sm.id })).s, 200);
  assert.strictEqual((await U("menor", { acao: "pagar", id: sm.id })).s, 403, "quem paga é o responsável");
  assert.strictEqual((await U("mae", { acao: "pagar", id: sm.id })).s, 200);
  assert.strictEqual((await U("mae")).acompanhamentos.length, 1, "o responsável vê o do atleta");
  assert.strictEqual((await U("mae", { acao: "cancelar", id: sm.id })).s, 200);

  /* painel do consultor */
  assert.strictEqual((await D(null, "errado")).s, 401);
  assert.strictEqual((await D({ acao: "pagamento", id: s1.id, n: 1, estado: "pago" })).s, 400, "pagamento exige confirmação");
  assert.strictEqual((await D({ acao: "iniciar", id: s1.id, vinculoId: "vincRichard001", inicio: hojeStr })).s, 409, "sem o 1º pagamento não inicia");
  assert.strictEqual((await D({ acao: "pagamento", id: s1.id, n: 1, estado: "pago", confirmo: true })).s, 200);
  a = (await U("adulto")).acompanhamentos[0]; assert.strictEqual(a.estado, "aguardando_inicio"); assert.strictEqual(a.parcelas[0].estado, "pago");
  assert.strictEqual((await D({ acao: "iniciar", id: s1.id, vinculoId: "vincRichard001", inicio: hojeStr })).s, 409, "o vínculo ainda não compartilha o planejamento");
  store["vinculos/vincRichard001"].areas.push("planejamento");
  assert.strictEqual((await D({ acao: "iniciar", id: s1.id, vinculoId: "vincMae000001", inicio: hojeStr })).s, 409, "só treinador do atleta");
  const ini = await D({ acao: "iniciar", id: s1.id, vinculoId: "vincRichard001", inicio: hojeStr }); assert.strictEqual(ini.s, 200); assert.strictEqual(ini.fim, A.addDias(A.addMeses(hojeStr, 3), -1));

  /* painel do atleta: só o que existe */
  let d = (await U("adulto", null, s1.id)).acompanhamento;
  assert.strictEqual(d.estado, "ativo"); assert.strictEqual(d.profissional.nome, "richard"); assert.strictEqual(d.encontros.length, 4);
  assert.deepStrictEqual(d.encontros.map((e) => e.duracaoMin), [60, 50, 50, 50]); assert.ok(d.encontros.every((e) => e.estado === "a_agendar" && !e.data), "nada agendado sem ação do profissional");
  assert.strictEqual(d.proximoEncontro, null); assert.strictEqual(d.ultimaDevolutiva, null); assert.ok(d.revisoes.length >= 13 && d.revisoes.length <= 14); assert.ok(d.revisoes.every((r) => !r.revisada));
  assert.strictEqual(d.plano.vigente, null, "sem plano aprovado, nada de plano vigente");
  assert.strictEqual(d.registrosAguardando.total, 0);
  assert.ok(!JSON.stringify(d).includes("preparo"), "o atleta nunca vê o preparo do profissional");

  /* profissional conduz */
  assert.strictEqual((await U("adulto", { acao: "agendar", id: s1.id, n: 1, data: mais(2), hora: "19:00" })).s, 403, "o atleta não agenda");
  assert.strictEqual((await U("outro", { acao: "agendar", id: s1.id, n: 1, data: mais(2), hora: "19:00" })).s, 404);
  assert.strictEqual((await U("richard", { acao: "agendar", id: s1.id, n: 1, data: mais(-1), hora: "19:00" })).s, 400);
  assert.strictEqual((await U("richard", { acao: "agendar", id: s1.id, n: 1, data: mais(2), hora: "19:00", link: "http://x.com" })).s, 400, "link precisa de https");
  assert.strictEqual((await U("richard", { acao: "agendar", id: s1.id, n: 1, data: mais(2), hora: "19:00", link: "https://meet.example.com/abc" })).s, 200);
  assert.strictEqual((await U("richard", { acao: "registrarEncontro", id: s1.id, n: 2, resumo: "x", planoDeAcao: "y" })).s, 409, "não registra o que não foi agendado");
  assert.strictEqual((await U("richard", { acao: "preparar", id: s1.id, n: 1, texto: "pauta privada" })).s, 200);
  d = (await U("adulto", null, s1.id)).acompanhamento;
  assert.strictEqual(d.encontros[0].estado, "agendado"); assert.strictEqual(d.proximoEncontro.n, 1); assert.ok(!JSON.stringify(d).includes("pauta privada"));
  const dp = (await U("richard", null, s1.id)).acompanhamento; assert.strictEqual(dp.encontros[0].preparo, "pauta privada", "o profissional vê o próprio preparo");
  assert.strictEqual((await U("richard", { acao: "registrarEncontro", id: s1.id, n: 1, resumo: "Conversa inicial", planoDeAcao: "Três prioridades" })).s, 200);
  d = (await U("adulto", null, s1.id)).acompanhamento; assert.strictEqual(d.encontros[0].estado, "realizado"); assert.strictEqual(d.encontros[0].registro.planoDeAcao, "Três prioridades");

  /* registros aguardando e revisão semanal */
  store["jogadores/adulto/partidas/partidaAd001"] = { data: hojeStr, adversario: "Z", resultado: "vitoria", criadoEm: new Date().toISOString() };
  store["jogadores/adulto/compExecucoes/execucaoAd1"] = { data: hojeStr, titulo: "treino", feito: "sim", criadoEm: new Date().toISOString() };
  d = (await U("adulto", null, s1.id)).acompanhamento; assert.strictEqual(d.registrosAguardando.total, 2);
  assert.strictEqual((await U("richard", { acao: "revisarSemana", id: s1.id, semana: 1 })).s, 400, "devolutiva vazia");
  assert.strictEqual((await U("richard", { acao: "revisarSemana", id: s1.id, semana: 1, audioLink: "javascript:x" })).s, 400);
  const rv = await U("richard", { acao: "revisarSemana", id: s1.id, semana: 1, destaques: "Saque evoluiu", foco: "Devolução", audioLink: "https://audio.example.com/a.m4a" });
  assert.strictEqual(rv.s, 200);
  assert.strictEqual((await U("richard", { acao: "revisarSemana", id: s1.id, semana: 1, destaques: "outra" })).s, 409, "uma devolutiva por semana");
  d = (await U("adulto", null, s1.id)).acompanhamento;
  assert.strictEqual(d.revisoes[0].revisada, true); assert.strictEqual(d.ultimaDevolutiva.destaques, "Saque evoluiu"); assert.strictEqual(d.ultimaDevolutiva.audioLink, "https://audio.example.com/a.m4a"); assert.strictEqual(d.registrosAguardando.total, 0);
  const dev = Object.keys(store).filter((k) => k.startsWith("jogadores/adulto/devolutivas/")); assert.strictEqual(dev.length, 1); assert.strictEqual(store[dev[0]].autorUid, "richard");

  /* dúvidas: prazo em dias úteis, sem simular resposta */
  assert.strictEqual((await U("adulto", { acao: "perguntar", id: s1.id, texto: "" })).s, 400);
  const pr = await U("adulto", { acao: "perguntar", id: s1.id, texto: "Posso trocar o treino de quinta?" }); assert.strictEqual(pr.s, 200); assert.ok(pr.respostaAte >= mais(2) && pr.respostaAte <= mais(4));
  d = (await U("richard", null, s1.id)).acompanhamento; assert.strictEqual(d.pendentes.duvidas, 1);
  const duv = d.duvidas[0]; assert.strictEqual(duv.respondida, false);
  assert.strictEqual((await U("adulto", { acao: "responder", id: s1.id, duvidaId: duv.id, texto: "eu mesmo" })).s, 403);
  assert.strictEqual((await U("richard", { acao: "responder", id: s1.id, duvidaId: duv.id, texto: "Pode sim." })).s, 200);
  assert.strictEqual((await U("richard", { acao: "responder", id: s1.id, duvidaId: duv.id, texto: "de novo" })).s, 409);
  d = (await U("adulto", null, s1.id)).acompanhamento; assert.strictEqual(d.duvidas.find((x) => x.id === duv.id).respondida, true); assert.strictEqual(d.pendentes.duvidas, 0);

  /* encerramento do ciclo e continuidade */
  assert.strictEqual((await U("richard", { acao: "encerrar", id: s1.id, sintese: "ok", prioridades: "ok" })).s, 409, "sem o 4º encontro registrado");
  assert.strictEqual((await U("richard", { acao: "encerrar", id: s1.id, sintese: "", prioridades: "x", semAvaliacaoFinal: true })).s, 400);
  assert.strictEqual((await U("richard", { acao: "encerrar", id: s1.id, sintese: "Evolução no saque", prioridades: "Devolução", continuidade: "Novo ciclo de 3 meses", semAvaliacaoFinal: true })).s, 200);
  d = (await U("adulto", null, s1.id)).acompanhamento; assert.strictEqual(d.estado, "encerrado"); assert.strictEqual(d.continuidade.estado, "proposta"); assert.strictEqual(d.encerramento.sintese, "Evolução no saque");
  assert.strictEqual((await U("adulto", { acao: "perguntar", id: s1.id, texto: "e agora?" })).s, 409, "o canal fecha com o ciclo");
  assert.strictEqual((await U("richard", { acao: "decidirContinuidade", id: s1.id, aceitar: true })).s, 403);
  assert.strictEqual((await U("adulto", { acao: "decidirContinuidade", id: s1.id, aceitar: true })).s, 200);
  d = (await U("adulto", null, s1.id)).acompanhamento; assert.strictEqual(d.continuidade.estado, "aceita"); assert.strictEqual(d.parcelas.length, 3, "aceitar não cria cobrança: continua com as 3 parcelas do ciclo");

  /* exportação e exclusão */
  const exp = JSON.parse((await PRIV({ httpMethod: "GET", headers: { authorization: "adulto" } })).body);
  assert.strictEqual(exp.acompanhamentos.length, 1); assert.strictEqual(exp.acompanhamentos[0].duvidas.length, 2);
  const del = await PRIV({ httpMethod: "POST", headers: { authorization: "adulto" }, body: JSON.stringify({ acao: "excluirConta", confirmar: "adulto@t.com" }) }); assert.strictEqual(del.statusCode, 200);
  const rest = store["acompanhamentos/" + s1.id]; assert.ok(rest && rest.anonimizadoEm && !rest.encerramento && !rest.encontros && !rest.atletaNome, "pago: fica só o registro financeiro");
  assert.ok(!Object.keys(store).some((k) => k.startsWith("acompanhamentos/" + s1.id + "/")), "dúvidas apagadas");
  console.log("check-comp-acompanhamento: ok");
})().catch((e) => { console.error(e); process.exit(1); });
