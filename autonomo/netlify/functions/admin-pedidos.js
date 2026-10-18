/* Painel do consultor — pedidos de consultoria da Competição.

   Protegido pelo mesmo segredo de provisionar-org (cabeçalho x-admin-secret). Só o administrador alcança esta function.

   GET [?estado=…]                      → pedidos (com o que o atleta escolheu compartilhar) e pagamentos da Eduzz sem pedido correspondente
   POST { acao: "atualizar", id, estado, nota?, entrega?: { texto, link }, confirmoPagamento? }
   POST { acao: "vincularPagamento", faturaId, pedidoId }  → casa à mão um pagamento da Eduzz que não achou o pedido

   Transições permitidas em CONS.TRANSICOES_CONSULTOR. "pago" feito à mão exige confirmoPagamento: true (fica registrado como manual). */
const { admin, app } = require("./_firebase-admin");
const CONS = require("./_player-consultorias");
const A = require("./_admin-auth");

function resposta(statusCode, corpo) {
  return { statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(corpo) };
}
const agora = () => new Date().toISOString();

exports.handler = async function (event) {
  if (!(await A.autorizar(event))) return resposta(401, { erro: "Segredo de administrador ausente ou incorreto." });
  try {
    app();
    const db = admin.firestore();
    if (event.httpMethod === "GET") {
      const filtro = (event.queryStringParameters || {}).estado;
      const snap = await db.collection("pedidosConsultoria").get(), pedidos = [];
      snap.forEach((d) => { const p = d.data(); if (!filtro || p.estado === filtro) pedidos.push({ id: d.id, ...p, rotulo: CONS.ROTULO_ESTADO[p.estado] || p.estado }); });
      pedidos.sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));
      const sem = []; (await db.collection("consultoriasPagamentosSemPedido").get()).forEach((d) => sem.push({ id: d.id, ...d.data() }));
      return resposta(200, { pedidos, pagamentosSemPedido: sem, transicoes: CONS.TRANSICOES_CONSULTOR });
    }
    if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });
    let body;
    try { body = JSON.parse(event.body || "{}"); } catch (e) { return resposta(400, { erro: "Pedido inválido." }); }

    if (body.acao === "atualizar") {
      if (!CONS.ID.test(String(body.id || ""))) return resposta(400, { erro: "Pedido inválido." });
      const ref = db.collection("pedidosConsultoria").doc(body.id), s = await ref.get();
      if (!s.exists) return resposta(404, { erro: "Pedido não encontrado." });
      const p = s.data(), upd = {}, nota = CONS.txt(body.nota, 500);
      if (body.estado && body.estado !== p.estado) {
        if (!CONS.ESTADOS.includes(body.estado) || !(CONS.TRANSICOES_CONSULTOR[p.estado] || []).includes(body.estado)) return resposta(409, { erro: "Mudança de " + p.estado + " para " + body.estado + " não é permitida." });
        if (body.estado === "pago") {
          if (body.confirmoPagamento !== true) return resposta(400, { erro: "Confirme que recebeu o pagamento para marcar como pago." });
          upd.pagoEm = agora(); upd.pagoPor = "manual";
        }
        upd.estado = body.estado;
      }
      if (body.entrega) {
        const link = CONS.linkValido(body.entrega.link);
        if (link === null) return resposta(400, { erro: "O link da entrega precisa começar com https://." });
        const texto = String(body.entrega.texto || "").trim().slice(0, 4000);
        upd.entrega = { texto, link: link || "", entregueEm: (p.entrega && p.entrega.entregueEm) || null };
      }
      if ((upd.estado || p.estado) === "entregue") {
        const e = upd.entrega || p.entrega;
        if (!e || (!e.texto && !e.link)) return resposta(400, { erro: "Para marcar como entregue, escreva a entrega (texto ou link)." });
        if (upd.estado === "entregue") upd.entrega = { ...e, entregueEm: agora() };
      }
      if (!Object.keys(upd).length && !nota) return resposta(400, { erro: "Nada a atualizar." });
      upd.historico = [...(p.historico || []).slice(-30), { em: agora(), por: "consultor", acao: (upd.estado ? "estado: " + upd.estado : "atualizado") + (nota ? " · " + nota : "") }];
      await ref.update(upd);
      return resposta(200, { ok: true });
    }
    if (body.acao === "vincularPagamento") {
      const ref = db.collection("consultoriasPagamentosSemPedido").doc(String(body.faturaId || "")), pg = await ref.get();
      if (!pg.exists || !CONS.ID.test(String(body.pedidoId || ""))) return resposta(404, { erro: "Pagamento ou pedido não encontrado." });
      const rp = db.collection("pedidosConsultoria").doc(body.pedidoId), ped = await rp.get();
      if (!ped.exists || ped.data().estado !== "aguardando_pagamento" || ped.data().consultoriaId !== pg.data().consultoriaId) return resposta(409, { erro: "O pedido precisa estar aguardando pagamento e ser da mesma consultoria." });
      await rp.update({ estado: "pago", faturaId: pg.data().faturaId, pagoEm: agora(), pagoPor: "eduzz-manual", historico: [...(ped.data().historico || []).slice(-30), { em: agora(), por: "consultor", acao: "pagamento da Eduzz vinculado à mão" }] });
      await ref.delete();
      return resposta(200, { ok: true });
    }
    return resposta(400, { erro: "Ação desconhecida." });
  } catch (e) {
    console.error("admin-pedidos:", e && e.message);
    return resposta(500, { erro: "Não foi possível concluir agora." });
  }
};
