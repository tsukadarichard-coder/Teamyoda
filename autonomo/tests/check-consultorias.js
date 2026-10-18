/* Pedidos de consultoria dentro do app: o que o atleta compartilha, menor de idade, pagamento só pela Eduzz/consultor, painel e exclusão de dados.
   Rode: node tests/check-consultorias.js */
const path = require("path"), assert = require("assert");
const fx = path.join(__dirname, "../netlify/functions/");
/* Firestore em memória, por caminho */
const store = {}; let seq = 0;
const J = (v) => JSON.parse(JSON.stringify(v));
function merge(a, b) { const o = { ...a }; for (const k of Object.keys(b)) o[k] = b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) ? merge(a[k] || {}, b[k]) : b[k]; return o; }
function docRef(p) {
  return {
    id: p.split("/").pop(),
    async get() { const v = store[p]; return { exists: v !== undefined, id: p.split("/").pop(), data: () => J(v) }; },
    async set(v, o) { store[p] = o && o.merge ? merge(store[p] || {}, J(v)) : J(v); },
    async update(v) { Object.assign(store[p], J(v)); },
    async delete() { delete store[p]; },
    collection: (c) => colRef(p + "/" + c),
  };
}
function colRef(p, filtros = [], lim) {
  const ids = () => Object.keys(store).filter((k) => k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/")).filter((k) => filtros.every(([c, v]) => store[k][c] === v));
  return {
    doc: (id) => docRef(p + "/" + id),
    async add(v) { const id = "doc" + String(++seq).padStart(12, "0"); store[p + "/" + id] = J(v); return docRef(p + "/" + id); },
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


fakePlayer.OPCOES = { nivel: { competidor: "Competidor — joga torneios" } };
const cons = require(fx + "player-consultorias.js").handler;
const adminPed = require(fx + "admin-pedidos.js").handler;
const privacidade = require(fx + "player-privacidade.js").handler;
const CONS = require(fx + "_player-consultorias.js");
process.env.ADMIN_SECRET = "segredo-do-consultor";
const hojeStr = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const ano = +hojeStr.slice(0, 4);

function pessoa(uid, papel, nasc, extra) { tokens[uid] = { uid, email: uid + "@t.com", name: uid, tipo: "jogador" }; store["jogadores/" + uid] = { nome: uid, email: uid + "@t.com", competicao: { papel, nascimento: nasc || (ano - 30) + "-01-01" }, ...(extra || {}) }; }
const C1 = async (uid, corpo) => { const r = await cons({ httpMethod: corpo ? "POST" : "GET", headers: { authorization: uid }, body: corpo ? JSON.stringify(corpo) : undefined }); return { s: r.statusCode, raw: r.body, ...JSON.parse(r.body) }; };
const ADM = async (corpo, segredo) => { const r = await adminPed({ httpMethod: corpo ? "POST" : "GET", headers: { "x-admin-secret": segredo === undefined ? "segredo-do-consultor" : segredo }, body: corpo ? JSON.stringify(corpo) : undefined, queryStringParameters: {} }); return { s: r.statusCode, raw: r.body, ...JSON.parse(r.body) }; };
const ok = { acao: "criar", consultoriaId: "revisao-estrategia", autorizo: true };

(async () => {
  pessoa("adulto", "atleta", null, { ficha: { nivel: "competidor", observacoes: "texto livre privado" } });
  pessoa("menor", "atleta", (ano - 14) + "-05-05"); pessoa("mae", "responsavel"); pessoa("intruso", "atleta"); pessoa("treinador", "treinador");
  store["jogadores/adulto/torneios/torneio0001"] = { nome: "Copa X", inicio: hojeStr, fim: hojeStr, cidade: "Itajaí" };
  store["jogadores/intruso/torneios/torneio0009"] = { nome: "Da outra conta", inicio: hojeStr, fim: hojeStr };
  store["jogadores/adulto/partidas/partida0001"] = { data: hojeStr, adversario: "João", resultado: "vitoria", placar: "6-4", dificuldades: ["saque"], obs: "anotação escolhida" };
  store["jogadores/adulto/partidas/partida0002"] = { data: hojeStr, adversario: "Caio", resultado: "derrota", obs: "NAO-ESCOLHIDA" };
  store["jogadores/adulto/devolutivas/devolutiva01"] = { refRotulo: "Geral", autorNome: "Carlos", destaques: "bom", melhorar: "saque", foco: "1º saque", criadoEm: hojeStr };

  assert.strictEqual((await C1("treinador")).s, 403, "treinador não contrata");
  /* catálogo */
  const g = await C1("adulto");
  assert.strictEqual(g.s, 200); assert.ok(g.catalogo.length >= 4); assert.ok(g.catalogo.every((c) => c.pagamento === "combinado"));
  assert.ok(!g.raw.includes("precoRegularPrevistoCentavos"), "preço regular nunca sai");
  assert.strictEqual(g.opcoes.partidas.length, 2);

  /* criar: validações */
  assert.strictEqual((await C1("adulto", { acao: "criar", consultoriaId: "nao-existe", autorizo: true })).s, 400);
  assert.strictEqual((await C1("adulto", { acao: "criar", consultoriaId: "revisao-estrategia" })).s, 400, "sem autorização");
  assert.strictEqual((await C1("adulto", { ...ok, links: ["http://inseguro.com/v"] })).s, 400, "só https");
  { const rr = await C1("adulto", { ...ok, torneioId: "torneio0009" }); assert.strictEqual(rr.s, 404, "torneio de outra conta: " + rr.raw); }
  assert.strictEqual((await C1("adulto", { ...ok, partidaIds: ["partida9999"] })).s, 404);
  assert.strictEqual((await C1("mae", { ...ok })).s, 403, "responsável não monta pedido");

  /* adulto: só o escolhido vai no pedido */
  const ped = await C1("adulto", { ...ok, torneioId: "torneio0001", partidaIds: ["partida0001"], devolutivaIds: ["devolutiva01"], incluirPerfil: true, observacao: "Quero focar no saque", links: ["https://youtu.be/abc"] });
  assert.strictEqual(ped.s, 200); assert.strictEqual(ped.estado, "aguardando_pagamento");
  const docPed = store["pedidosConsultoria/" + ped.id];
  assert.strictEqual(docPed.contexto.partidas.length, 1); assert.strictEqual(docPed.contexto.partidas[0].adversario, "João"); assert.deepStrictEqual(docPed.contexto.partidas[0].dificuldades, ["Saque"]);
  assert.ok(!JSON.stringify(docPed).includes("NAO-ESCOLHIDA"), "partida não escolhida não entra");
  assert.deepStrictEqual(docPed.contexto.perfil, [{ campo: "nivel", rotulo: "Nível", valor: "Competidor" }]);
  assert.ok(!JSON.stringify(docPed).includes("texto livre privado"), "texto livre da ficha nunca entra");
  assert.strictEqual(docPed.precoCentavos, 14900); assert.ok(docPed.consentimento.em);
  /* o app nunca marca pago */
  const pago = await C1("adulto", { acao: "pagar", id: ped.id });
  assert.strictEqual(pago.s, 200); assert.strictEqual(pago.manual, true); assert.ok(pago.contato.startsWith("https://wa.me/"));
  assert.strictEqual(store["pedidosConsultoria/" + ped.id].estado, "aguardando_pagamento", "pagar só devolve o contato");
  await C1("adulto", { acao: "cancelar", id: ped.id, estado: "pago" });
  assert.strictEqual(store["pedidosConsultoria/" + ped.id].estado, "cancelado", "cancelar não aceita estado vindo do cliente");
  /* checkout configurado: devolve o link da Eduzz */
  CONS.CHECKOUT_CONSULTORIA["revisao-estrategia"] = { eduzzProductId: "999", checkoutUrl: "https://sun.eduzz.com/999" };
  const ped2 = await C1("adulto", ok);
  const pg2 = await C1("adulto", { acao: "pagar", id: ped2.id });
  assert.strictEqual(pg2.checkoutUrl, "https://sun.eduzz.com/999"); assert.ok(pg2.aviso.includes("adulto@t.com"));
  assert.strictEqual((await C1("adulto")).catalogo.find((c) => c.id === "revisao-estrategia").pagamento, "eduzz");
  /* terceiros não veem nem mexem */
  assert.strictEqual((await C1("intruso", { acao: "pagar", id: ped2.id })).s, 404);
  assert.strictEqual((await C1("intruso", { acao: "cancelar", id: ped2.id })).s, 404);
  assert.strictEqual((await C1("intruso")).pedidos.length, 0);

  /* webhook da Eduzz: casa pelo produto e pelo e-mail do pagador */
  const evBase = { produtoCod: "999", aprovado: true, revogar: false, faturaId: "F1", email: "adulto@t.com" };
  assert.strictEqual(await CONS.processarEventoConsultoria(admin.firestore(), { ...evBase, produtoCod: "outro" }), false, "produto desconhecido segue o fluxo normal");
  assert.strictEqual(await CONS.processarEventoConsultoria(admin.firestore(), { ...evBase, email: "outro@x.com", faturaId: "F0" }), true);
  assert.ok(store["consultoriasPagamentosSemPedido/F0"], "e-mail diferente vai para revisão manual");
  assert.strictEqual(store["pedidosConsultoria/" + ped2.id].estado, "aguardando_pagamento");
  await CONS.processarEventoConsultoria(admin.firestore(), evBase);
  assert.strictEqual(store["pedidosConsultoria/" + ped2.id].estado, "pago"); assert.strictEqual(store["pedidosConsultoria/" + ped2.id].faturaId, "F1");
  await CONS.processarEventoConsultoria(admin.firestore(), { ...evBase, aprovado: false, revogar: true });
  assert.strictEqual(store["pedidosConsultoria/" + ped2.id].estado, "reembolsado");
  CONS.CHECKOUT_CONSULTORIA["revisao-estrategia"] = { eduzzProductId: null, checkoutUrl: null };

  /* menor de idade */
  assert.strictEqual((await C1("menor", ok)).s, 409, "sem responsável vinculado");
  store["vinculos/vinculo0001"] = { atletaUid: "menor", tipo: "responsavel", status: "ativo", pessoaUid: "mae", pessoaNome: "Mãe" };
  const pm = await C1("menor", ok);
  assert.strictEqual(pm.estado, "aguardando_responsavel");
  assert.strictEqual((await C1("menor", { acao: "pagar", id: pm.id })).s, 409, "ainda não confirmado");
  assert.strictEqual((await C1("menor", { acao: "confirmar", id: pm.id })).s, 403, "o menor não confirma");
  assert.strictEqual((await C1("intruso", { acao: "confirmar", id: pm.id })).s, 404);
  const vistaMae = await C1("mae");
  assert.strictEqual(vistaMae.pedidos.length, 1); assert.strictEqual(vistaMae.pedidos[0].estado, "aguardando_responsavel");
  assert.strictEqual((await C1("mae", { acao: "confirmar", id: pm.id })).s, 200);
  assert.strictEqual(store["pedidosConsultoria/" + pm.id].pagadorUid, "mae"); assert.strictEqual(store["pedidosConsultoria/" + pm.id].pagadorEmail, "mae@t.com");
  assert.strictEqual((await C1("menor", { acao: "pagar", id: pm.id })).s, 403, "quem paga é o responsável");
  assert.strictEqual((await C1("mae", { acao: "pagar", id: pm.id })).s, 200);

  /* limite de pedidos abertos */
  for (let i = 0; i < 5; i++) assert.strictEqual((await C1("adulto", ok)).s, 200);
  assert.strictEqual((await C1("adulto", ok)).s, 409);

  /* painel do consultor */
  assert.strictEqual((await ADM(null, "errado")).s, 401); assert.strictEqual((await ADM(null, "")).s, 401);
  const lista = await ADM();
  assert.strictEqual(lista.s, 200); assert.ok(lista.pedidos.length >= 6); assert.ok(lista.pagamentosSemPedido.some((x) => x.id === "F0"));
  assert.strictEqual((await ADM({ acao: "atualizar", id: pm.id, estado: "entregue" })).s, 409, "não pula etapas");
  assert.strictEqual((await ADM({ acao: "atualizar", id: pm.id, estado: "pago" })).s, 400, "pago à mão exige confirmação");
  assert.strictEqual((await ADM({ acao: "atualizar", id: pm.id, estado: "pago", confirmoPagamento: true })).s, 200);
  assert.strictEqual(store["pedidosConsultoria/" + pm.id].pagoPor, "manual");
  assert.strictEqual((await ADM({ acao: "atualizar", id: pm.id, estado: "em_andamento" })).s, 200);
  assert.strictEqual((await ADM({ acao: "atualizar", id: pm.id, estado: "entregue" })).s, 400, "entrega precisa de conteúdo");
  assert.strictEqual((await ADM({ acao: "atualizar", id: pm.id, estado: "entregue", entrega: { texto: "ok", link: "http://x" } })).s, 400);
  assert.strictEqual((await ADM({ acao: "atualizar", id: pm.id, estado: "entregue", entrega: { texto: "Revisão pronta: 3 prioridades.", link: "https://drive.exemplo/a" } })).s, 200);
  assert.ok(store["pedidosConsultoria/" + pm.id].entrega.entregueEm);
  assert.strictEqual((await ADM({ acao: "atualizar", id: pm.id, estado: "cancelado" })).s, 409, "entregue não volta");
  const vistaMenor = await C1("menor");
  assert.strictEqual(vistaMenor.pedidos[0].estado, "entregue"); assert.ok(vistaMenor.pedidos[0].entrega.texto.startsWith("Revisão pronta"));
  assert.ok(!vistaMenor.raw.includes("pagadorEmail") && !vistaMenor.raw.includes("consentimento") && !vistaMenor.raw.includes("faturaId"), "dados internos não saem");
  /* pagamento sem pedido vinculado à mão */
  const pedC = await C1("intruso", ok);
  store["consultoriasPagamentosSemPedido/F9"] = { consultoriaId: "revisao-estrategia", faturaId: "F9", email: "x@x.com" };
  assert.strictEqual((await ADM({ acao: "vincularPagamento", faturaId: "F9", pedidoId: pedC.id })).s, 200);
  assert.strictEqual(store["pedidosConsultoria/" + pedC.id].estado, "pago"); assert.ok(!store["consultoriasPagamentosSemPedido/F9"]);

  /* privacidade: exportação inclui os pedidos; exclusão apaga o não pago e anonimiza o pago */
  const exp = await privacidade({ httpMethod: "GET", headers: { authorization: "menor" } });
  assert.ok(exp.body.includes("pedidosConsultoria"));
  const del = await privacidade({ httpMethod: "POST", headers: { authorization: "menor" }, body: JSON.stringify({ acao: "excluirConta", confirmar: "menor@t.com" }) });
  assert.strictEqual(del.statusCode, 200);
  const restante = store["pedidosConsultoria/" + pm.id];
  assert.ok(restante && restante.estado === "entregue" && restante.precoCentavos === 14900, "registro financeiro fica");
  for (const k of ["contexto", "entrega", "atletaNome", "pagadorEmail", "consentimento"]) assert.ok(!(k in restante), "anonimizado: " + k);
  console.log("check-consultorias: ok");
})().catch((e) => { console.error(e); process.exit(1); });
