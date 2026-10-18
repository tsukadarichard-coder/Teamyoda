/* "Olhar do treinador": preço central, prazo em dias úteis, pedido, pagamento pela Eduzz (idempotente), snapshot, acesso e entrega da devolutiva.
   Rode: node tests/check-olhar.js */
const path = require("path"), assert = require("assert");
const fx = path.join(__dirname, "../netlify/functions/");
const store = {}; let seq = 0;
const J = (v) => JSON.parse(JSON.stringify(v));
function docRef(p) {
  return {
    id: p.split("/").pop(),
    async get() { const v = store[p]; return { exists: v !== undefined, id: p.split("/").pop(), data: () => J(v) }; },
    async set(v) { store[p] = J(v); }, async update(v) { Object.assign(store[p], J(v)); }, async delete() { delete store[p]; },
    collection: (sub) => colRef(p + "/" + sub),
  };
}
function colRef(p, f = []) {
  const ids = () => Object.keys(store).filter((k) => k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/")).filter((k) => f.every(([c, v]) => store[k][c] === v));
  return {
    doc: (id) => docRef(p + "/" + id), where: (c, o, v) => colRef(p, f.concat([[c, v]])),
    async add(v) { const id = "doc" + String(++seq).padStart(12, "0"); store[p + "/" + id] = J(v); return docRef(p + "/" + id); },
    async get() { const d = ids().map((k) => ({ id: k.split("/").pop(), ref: docRef(k), data: () => J(store[k]) })); return { docs: d, empty: !d.length, size: d.length, forEach: (g) => d.forEach(g) }; },
  };
}
const admin = { firestore: () => ({ collection: (n) => colRef(n) }) };
const tokens = { a: { uid: "ua", email: "ana@exemplo.com", name: "Ana" }, b: { uid: "ub", email: "bia@exemplo.com", name: "Bia" } };
class ErroPublico extends Error { constructor(s, m) { super(m); this.status = s; } }
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin, app: () => {} } };
require.cache[require.resolve(fx + "_player.js")] = { id: "x", filename: "x", loaded: true, exports: {
  admin, ErroPublico, resposta: (statusCode, corpo) => ({ statusCode, body: JSON.stringify(corpo) }), refJogador: (uid) => docRef("jogadores/" + uid),
  usuarioDoPedido: async (ev) => { const t = tokens[(ev.headers.authorization || "").replace("Bearer ", "")]; if (!t) throw new ErroPublico(401, "login"); return t; } } };
/* armazenamento simulado (o real fala com o Google Cloud Storage) */
const objetos = {};
const ARQ = require(fx + "_olhar-armazenamento.js");
Object.assign(ARQ, {
  urlParaEnvio: async (pedidoId, contentType, tamanho) => { const v = ARQ.validarArquivo(contentType, tamanho); if (!v.ok) return v; const caminho = ARQ.novoCaminho(pedidoId, v.info.ext); return { ok: true, url: "https://armazenamento.exemplo/envio/" + caminho, caminho, contentType, tipo: v.info.tipo }; },
  conferirArquivo: async (caminho, pedidoId) => { if (!ARQ.caminhoDoPedido(caminho, pedidoId)) return { ok: false, erro: "Arquivo não pertence a este pedido." }; const o = objetos[caminho]; if (!o) return { ok: false, erro: "O arquivo não foi encontrado. Envie de novo." }; const v = ARQ.validarArquivo(o.contentType, o.tamanho); if (!v.ok) return v; return { ok: true, tipo: v.info.tipo, contentType: o.contentType, tamanho: o.tamanho, md5: o.md5, geracao: o.geracao }; },
  mesmoArquivo: async (a) => { const o = objetos[a.caminho]; return !!o && o.tamanho === a.tamanho && o.geracao === a.geracao && o.md5 === a.md5; },
  urlParaLeitura: async (caminho) => ({ url: "https://armazenamento.exemplo/leitura/" + caminho + "?assinatura=curta", expiraEm: "x" }),
  removerArquivo: async (caminho) => { delete objetos[caminho]; return true; },
});
process.env.ADMIN_SECRET = "segredo"; delete process.env.OLHAR_WEBHOOK_URL;
const O = require(fx + "_player-olhar.js");
const JOG = require(fx + "player-olhar.js").handler, ADM = require(fx + "admin-olhar.js").handler;
const call = async (h, ev) => { const r = await h(ev); return { s: r.statusCode, raw: r.body, ...JSON.parse(r.body) }; };
const get = (t, qs) => call(JOG, { httpMethod: "GET", headers: { authorization: "Bearer " + t }, queryStringParameters: qs });
const post = (t, corpo) => call(JOG, { httpMethod: "POST", headers: { authorization: "Bearer " + t }, body: JSON.stringify(corpo) });
const aget = (qs) => call(ADM, { httpMethod: "GET", headers: { "x-admin-secret": "segredo" }, queryStringParameters: qs });
const apost = (corpo, seg) => call(ADM, { httpMethod: "POST", headers: { "x-admin-secret": seg === undefined ? "segredo" : seg }, body: JSON.stringify(corpo) });
const DUVIDA = "Minha estratégia sugere atacar a segunda bola, mas tenho medo de errar e acabo apenas devolvendo.";

/* ── preço, textos e prazo ── */
assert.strictEqual(O.PRODUTO.precoCentavos, 4790); assert.strictEqual(O.produtoPublico().precoCentavos, 4790); assert.strictEqual(O.PRODUTO.moeda, "BRL");
assert.strictEqual(O.PRODUTO.estrategiasGratis, +/const PLANOS_GRATIS = (\d+)/.exec(require("fs").readFileSync(path.join(fx, "_player.js"), "utf8"))[1], "limite gratuito igual ao do servidor");
assert.strictEqual(O.PRODUTO.modalidade, "pagamento_unico"); assert.strictEqual(O.PRODUTO.condicao, "Pagamento único · Sem assinatura");
assert.strictEqual(O.produtoPublico().pagamentoDisponivel, false, "sem checkout configurado");
assert.strictEqual(O.pascoa(2026), "2026-04-05");
assert.strictEqual(O.somarDiasUteis("2026-10-17", 3), "2026-10-21", "sábado: segunda é o 1º dia útil");
assert.strictEqual(O.somarDiasUteis("2026-10-09", 3), "2026-10-15", "12/10 (feriado) não conta");
assert.strictEqual(O.somarDiasUteis("2027-02-05", 3), "2027-02-12", "Carnaval (8 e 9/2) não conta");
assert.strictEqual(O.somarDiasUteis("2026-12-23", 3), "2026-12-29", "25/12 não conta");
assert.strictEqual(O.hojeSP(Date.parse("2026-10-18T01:30:00Z")), "2026-10-17", "fuso America/Sao_Paulo");
assert.strictEqual(O.prazoDe("2026-10-16T22:00:00Z"), "2026-10-21", "sexta às 19h em São Paulo");
const base = { acao: "criar", estrategiaId: "plano00001", duvida: DUVIDA, contexto: "", aceite: true };
assert.ok(O.validarSolicitacao(base).ok);
assert.ok(!O.validarSolicitacao({ ...base, duvida: "x".repeat(29) }).ok); assert.ok(O.validarSolicitacao({ ...base, duvida: "x".repeat(30) }).ok);
assert.ok(O.validarSolicitacao({ ...base, duvida: "x".repeat(800) }).ok); assert.ok(!O.validarSolicitacao({ ...base, duvida: "x".repeat(801) }).ok);
assert.ok(O.validarSolicitacao({ ...base, contexto: "y".repeat(400) }).ok); assert.ok(!O.validarSolicitacao({ ...base, contexto: "y".repeat(401) }).ok);
assert.ok(!O.validarSolicitacao({ ...base, aceite: false }).ok); assert.ok(!O.validarSolicitacao({ ...base, estrategiaId: "../x" }).ok);

(async () => {
  store["jogadores/ua"] = { nome: "Ana Souza", ficha: { nivel: "intermediario", mao: "destro" }, criadoEm: "2026-09-01T10:00:00Z" };
  store["jogadores/ua/planos/plano00001"] = { status: "pronto", criadoEm: "2026-10-01T10:00:00Z", plano: { titulo: "Atacar a segunda bola", resumo: "Ganhar iniciativa cedo.", diretrizes: [{ titulo: "Segunda bola", acao: "Atacar" }] } };
  store["jogadores/ua/planos/plano00002"] = { status: "gerando", criadoEm: "2026-10-02T10:00:00Z" };
  store["jogadores/ub"] = { nome: "Bia" };
  store["jogadores/ub/planos/plano0000b"] = { status: "pronto", criadoEm: "2026-10-03T10:00:00Z", plano: { titulo: "Plano da Bia", resumo: "x" } };

  /* lista: só estratégias prontas do próprio jogador */
  let l = await get("a");
  assert.strictEqual(l.s, 200); assert.deepStrictEqual(l.estrategias.map((e) => e.id), ["plano00001"]); assert.strictEqual(l.estrategias[0].titulo, "Atacar a segunda bola");
  assert.strictEqual((await call(JOG, { httpMethod: "GET", headers: {} })).s, 401, "sem login");

  /* criar: validações, dono da estratégia e preço sempre do servidor */
  assert.strictEqual((await post("a", { ...base, aceite: false })).s, 400);
  assert.strictEqual((await post("a", { ...base, duvida: "curta" })).s, 400);
  { const rr = await post("a", { ...base, estrategiaId: "plano0000b" }); assert.strictEqual(rr.s, 404, "estratégia de outra pessoa: " + rr.erro); }
  assert.strictEqual((await post("a", { ...base, estrategiaId: "plano00002" })).s, 404, "estratégia ainda não pronta");
  const c1 = await post("a", { ...base, precoCentavos: 1, preco: 1, valor: 1 });
  assert.strictEqual(c1.s, 200); const ped = store["olharPedidos/" + c1.id];
  assert.strictEqual(ped.precoCentavos, 4790, "valor do navegador ignorado"); assert.strictEqual(ped.estado, "aguardando_pagamento"); assert.strictEqual(ped.pagamento.estado, "pendente");
  assert.ok(/^OT-[A-Z2-9]{6}$/.test(ped.numero)); assert.strictEqual(ped.pagadorEmail, "ana@exemplo.com");
  /* mesmo pedido pendente para a mesma estratégia: reaproveita, sem duplicar */
  const c2 = await post("a", { ...base, duvida: DUVIDA + " Atualizado." });
  assert.strictEqual(c2.id, c1.id); assert.strictEqual(c2.reutilizado, true); assert.strictEqual(Object.keys(store).filter((k) => /^olharPedidos\/[^/]+$/.test(k)).length, 1);
  assert.ok(store["olharPedidos/" + c1.id].duvida.endsWith("Atualizado."));
  /* dono */
  assert.strictEqual((await get("b", { id: c1.id })).s, 404, "pedido de outra pessoa"); assert.strictEqual((await post("b", { acao: "pagar", id: c1.id })).s, 404);
  assert.strictEqual((await get("a", { id: c1.id })).pedido.numero, ped.numero);
  assert.ok(!(await get("a", { id: c1.id })).raw.includes("caminho"), "nada de arquivo na resposta");

  /* pagar sem checkout configurado: pendência registrada, nada simulado */
  const sem = await post("a", { acao: "pagar", id: c1.id });
  assert.strictEqual(sem.s, 503); assert.ok(/indispon/i.test(sem.erro)); assert.ok(store["olharPendencias/checkout-nao-configurado"]);
  assert.strictEqual(store["olharPedidos/" + c1.id].estado, "aguardando_pagamento");
  /* com checkout */
  O.CHECKOUT_OLHAR.eduzzProductId = "9990001"; O.CHECKOUT_OLHAR.checkoutUrl = "https://sun.eduzz.com/9990001";
  const pg = await post("a", { acao: "pagar", id: c1.id });
  assert.strictEqual(pg.s, 200); assert.strictEqual(pg.checkoutUrl, "https://sun.eduzz.com/9990001"); assert.ok(pg.aviso.includes("ana@exemplo.com"));
  assert.strictEqual(store["olharPedidos/" + c1.id].estado, "aguardando_pagamento", "abrir o pagamento não marca pago");
  const pg2 = await post("a", { acao: "pagar", id: c1.id }); assert.strictEqual(pg2.s, 200); assert.strictEqual(Object.keys(store).filter((k) => /^olharPedidos\/[^/]+$/.test(k)).length, 1, "tentar de novo não duplica");

  /* limite de pedidos pendentes */
  for (const [i, id] of ["plano00003", "plano00004", "plano00005"].entries()) store["jogadores/ua/planos/" + id] = { status: "pronto", criadoEm: "2026-10-0" + (4 + i) + "T10:00:00Z", plano: { titulo: "P" + i, resumo: "r" } };
  assert.strictEqual((await post("a", { ...base, estrategiaId: "plano00003" })).s, 200); assert.strictEqual((await post("a", { ...base, estrategiaId: "plano00004" })).s, 200);
  assert.strictEqual((await post("a", { ...base, estrategiaId: "plano00005" })).s, 409, "no máximo 3 aguardando pagamento");
  const cancelar = await post("a", { acao: "cancelar", id: (await get("a")).pedidos.find((x) => x.estrategia.id === "plano00004").id }); assert.strictEqual(cancelar.s, 200);

  /* ── Eduzz ── */
  const W = require(fx + "_player-olhar.js").processarEventoOlhar, db = admin.firestore();
  const ev = (o) => ({ faturaId: "F1", email: "ana@exemplo.com", produtoCod: "9990001", aprovado: true, revogar: false, ...o });
  assert.strictEqual(await W(db, ev({ produtoCod: "outro" }), "2026-10-16T22:00:00.000Z"), false, "outro produto segue o fluxo de sempre");
  store["jogadores/ua/planos/plano00001"].plano.titulo = "Titulo na contratação";
  assert.strictEqual(await W(db, ev(), "2026-10-17T15:00:00.000Z"), true); // sábado
  let p1 = store["olharPedidos/" + c1.id];
  assert.strictEqual(p1.estado, "recebido"); assert.strictEqual(p1.pagamento.estado, "aprovado"); assert.strictEqual(p1.faturaId, "F1");
  assert.strictEqual(p1.prazoEm, "2026-10-21", "prazo = 3 dias úteis depois do sábado"); assert.strictEqual(p1.snapshot.estrategia.plano.titulo, "Titulo na contratação"); assert.strictEqual(p1.snapshot.ficha.nivel, "intermediario");
  assert.ok(p1.notificacoes.some((n) => n.tipo === "pedido_recebido" && n.email === "indisponivel"), "notificação no app; e-mail honestamente indisponível");
  /* snapshot não muda quando o jogador altera a estratégia depois */
  store["jogadores/ua/planos/plano00001"].plano.titulo = "Alterado depois"; store["jogadores/ua"].ficha.nivel = "avancado";
  assert.strictEqual(store["olharPedidos/" + c1.id].snapshot.estrategia.plano.titulo, "Titulo na contratação");
  /* idempotência: mesma fatura de novo */
  await W(db, ev(), "2026-10-18T10:00:00.000Z"); assert.strictEqual(store["olharPedidos/" + c1.id].confirmadoEm, "2026-10-17T15:00:00.000Z"); assert.strictEqual(Object.keys(store).filter((k) => k.startsWith("olharPagamentosSemPedido/")).length, 0);
  /* outra fatura sem pedido aguardando (ou e-mail diferente): vai para revisão, nunca confirma pedido alheio */
  await W(db, ev({ faturaId: "F2", email: "outro@exemplo.com" }), "2026-10-18T10:00:00.000Z");
  assert.ok(store["olharPagamentosSemPedido/F2"]); assert.strictEqual(store["olharPedidos/" + c1.id].faturaId, "F1");
  /* pagamento cancelado antes de pagar: o pedido não vira pago e o jogador pode tentar de novo */
  const c3 = await post("b", { ...base, estrategiaId: "plano0000b" }); await post("b", { acao: "pagar", id: c3.id });
  await W(db, ev({ faturaId: "F3", email: "bia@exemplo.com", aprovado: false, revogar: true }), "2026-10-18T11:00:00.000Z");
  assert.strictEqual(store["olharPedidos/" + c3.id].estado, "aguardando_pagamento"); assert.strictEqual(store["olharPedidos/" + c3.id].pagamento.estado, "falhou");
  assert.strictEqual((await get("b", { id: c3.id })).pedido.pagamento.rotulo, "Pagamento não concluído");
  assert.strictEqual((await post("b", { acao: "pagar", id: c3.id })).s, 200); assert.strictEqual(store["olharPedidos/" + c3.id].pagamento.estado, "pendente", "tentar de novo reabre o pagamento");

  /* ── painel: fila e entrega ── */
  assert.strictEqual((await apost({ acao: "iniciar", id: c1.id }, "errado")).s, 401); assert.strictEqual((await aget({})).fila.length, 1, "só pedidos pagos entram na fila");
  assert.strictEqual((await aget({})).fila[0].numero, p1.numero);
  const det = await aget({ id: c1.id }); assert.strictEqual(det.snapshot.estrategia.plano.titulo, "Titulo na contratação"); assert.strictEqual(det.duvida.endsWith("Atualizado."), true);
  assert.strictEqual((await apost({ acao: "iniciar", id: c3.id })).s, 409, "pedido sem pagamento confirmado não entra em atendimento");
  assert.strictEqual((await apost({ acao: "iniciar", id: c1.id })).s, 200); assert.strictEqual(store["olharPedidos/" + c1.id].estado, "em_analise");
  assert.strictEqual((await apost({ acao: "urlEnvio", id: c1.id, contentType: "video/x-msvideo", tamanho: 1000 })).s, 400, "tipo não aceito");
  assert.strictEqual((await apost({ acao: "urlEnvio", id: c1.id, contentType: "audio/mpeg", tamanho: 31 * 1048576 })).s, 400, "passa do limite");
  const env = await apost({ acao: "urlEnvio", id: c1.id, contentType: "audio/mpeg", tamanho: 4 * 1048576 }); assert.strictEqual(env.s, 200); assert.ok(ARQ.caminhoDoPedido(env.caminho, c1.id));
  assert.strictEqual((await apost({ acao: "publicar", id: c1.id, confirmo: true })).s, 400, "sem arquivo");
  assert.strictEqual((await apost({ acao: "registrarArquivo", id: c1.id, caminho: env.caminho, duracaoSeg: 240 })).s, 400, "arquivo ainda não está no armazenamento");
  objetos[env.caminho] = { contentType: "audio/mpeg", tamanho: 4 * 1048576, md5: "abc", geracao: "1" };
  assert.strictEqual((await apost({ acao: "registrarArquivo", id: c1.id, caminho: "olhar/outroPedido12/1760000000000-abcdef.mp3", duracaoSeg: 240 })).s, 400, "arquivo de outro pedido");
  const reg = await apost({ acao: "registrarArquivo", id: c1.id, caminho: env.caminho, duracaoSeg: 100 }); assert.strictEqual(reg.s, 200); assert.strictEqual(reg.foraDoPadrao, true);
  assert.strictEqual((await apost({ acao: "publicar", id: c1.id })).s, 400, "exige confirmação de quem publica");
  const fora = await apost({ acao: "publicar", id: c1.id, confirmo: true }); assert.strictEqual(fora.s, 409); assert.strictEqual(fora.foraDoPadrao, true);
  assert.strictEqual((await apost({ acao: "registrarArquivo", id: c1.id, caminho: env.caminho, duracaoSeg: 240 })).s, 200);
  assert.strictEqual((await apost({ acao: "salvarRascunho", id: c1.id, resumo: "Teste o ataque na segunda bola cruzada." })).s, 200);
  /* jogador ainda não vê nada */
  assert.strictEqual((await get("a", { id: c1.id, arquivo: "1" })).s, 404, "antes de publicar não há arquivo"); assert.strictEqual((await get("a", { id: c1.id })).pedido.devolutiva, null);
  /* arquivo trocado no armazenamento depois da conferência: não publica */
  objetos[env.caminho].md5 = "adulterado"; assert.strictEqual((await apost({ acao: "publicar", id: c1.id, confirmo: true })).s, 409); objetos[env.caminho].md5 = "abc";
  assert.strictEqual((await apost({ acao: "publicar", id: c1.id, confirmo: true })).s, 200);
  const pub = store["olharPedidos/" + c1.id]; assert.strictEqual(pub.estado, "devolutiva_disponivel"); assert.strictEqual(pub.rascunhoDevolutiva, null); assert.ok(pub.notificacoes.some((n) => n.tipo === "devolutiva_publicada"));
  /* entrega */
  const vis = await get("a", { id: c1.id }); assert.strictEqual(vis.pedido.nova, true, "orientação chegou e ainda não foi aberta"); assert.strictEqual(vis.pedido.devolutiva.autor, "Richard Tsukada"); assert.ok(!vis.raw.includes("armazenamento"));
  assert.strictEqual((await get("b", { id: c1.id, arquivo: "1" })).s, 404, "outra pessoa não acessa o arquivo");
  const arq = await get("a", { id: c1.id, arquivo: "1" }); assert.strictEqual(arq.s, 200); assert.ok(arq.url.startsWith("https://armazenamento.exemplo/leitura/olhar/" + c1.id + "/")); assert.strictEqual(arq.tipo, "audio");
  assert.ok(store["olharPedidos/" + c1.id].acessadaEm); assert.strictEqual((await get("a", { id: c1.id })).pedido.nova, false);
  assert.strictEqual((await apost({ acao: "iniciar", id: c1.id })).s, 409, "já entregue");
  /* reembolso confirmado pelo provedor bloqueia a entrega */
  await W(db, ev({ aprovado: false, revogar: true }), "2026-10-19T10:00:00.000Z");
  assert.strictEqual(store["olharPedidos/" + c1.id].estado, "reembolsado"); assert.strictEqual(store["olharPedidos/" + c1.id].pagamento.estado, "reembolsado");
  assert.strictEqual((await get("a", { id: c1.id, arquivo: "1" })).s, 404, "reembolsado: sem acesso ao arquivo");
  /* pagamento sem pedido: vínculo manual de um pagamento reconhecido pela Eduzz */
  const v = await apost({ acao: "vincularPagamento", faturaId: "F2", pedidoId: c3.id }); assert.strictEqual(v.s, 200);
  assert.strictEqual(store["olharPedidos/" + c3.id].estado, "recebido"); assert.strictEqual(store["olharPedidos/" + c3.id].pagamento.via, "eduzz-manual"); assert.ok(!store["olharPagamentosSemPedido/F2"]);

  /* ── arquivos: tipos e limites reais ── */
  assert.ok(ARQ.validarArquivo("audio/mpeg", 1000).ok); assert.ok(ARQ.validarArquivo("video/mp4", 200 * 1048576).ok); assert.ok(!ARQ.validarArquivo("video/mp4", 251 * 1048576).ok);
  assert.ok(!ARQ.validarArquivo("application/pdf", 10).ok); assert.ok(!ARQ.validarArquivo("audio/mpeg", 0).ok); assert.ok(!ARQ.validarArquivo("video/quicktime", 10).ok);
  console.log("check-olhar: ok");
})().catch((e) => { console.error(e); process.exit(1); });
