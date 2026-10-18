/* QuadraLab Competição — pedidos de consultoria (regras puras e ligação com a Eduzz).

   Fluxo do pedido:
     atleta monta o pedido (escolhe o que compartilhar)
       → menor de idade: aguardando_responsavel (um responsável com vínculo ativo confirma) → aguardando_pagamento
       → adulto:        aguardando_pagamento
     aguardando_pagamento → pago (SÓ pela Eduzz via webhook ou pela confirmação manual no painel do consultor; o app nunca marca pago)
     pago → em_andamento → entregue (painel do consultor). cancelado/reembolsado encerram.

   Pagamento: cada consultoria só ganha checkout quando CHECKOUT_CONSULTORIA tiver o produto da Eduzz e o link https. Enquanto estiver vazio,
   o pedido fica aguardando_pagamento e o pagamento é combinado no WhatsApp; o consultor confirma no painel. Nada é cobrado automaticamente. */
const ASS = require("./_player-assinaturas");

const CHECKOUT_CONSULTORIA = {
  "revisao-estrategia": { eduzzProductId: null, checkoutUrl: null },
  "analise-completa": { eduzzProductId: null, checkoutUrl: null },
  "consultoria-ao-vivo": { eduzzProductId: null, checkoutUrl: null },
  "analise-mais-consultoria": { eduzzProductId: null, checkoutUrl: null },
};

const ESTADOS = ["aguardando_responsavel", "aguardando_pagamento", "pago", "em_andamento", "entregue", "cancelado", "reembolsado"];
const ROTULO_ESTADO = {
  aguardando_responsavel: "Aguardando o responsável", aguardando_pagamento: "Aguardando pagamento", pago: "Pago", em_andamento: "Em andamento",
  entregue: "Entregue", cancelado: "Cancelado", reembolsado: "Reembolsado",
};
/* o que o consultor (painel) pode fazer */
const TRANSICOES_CONSULTOR = {
  aguardando_pagamento: ["pago", "cancelado"], pago: ["em_andamento", "entregue", "cancelado", "reembolsado"],
  em_andamento: ["entregue", "reembolsado"], entregue: [], aguardando_responsavel: ["cancelado"], cancelado: [], reembolsado: [],
};
const ABERTOS = ["aguardando_responsavel", "aguardando_pagamento", "pago", "em_andamento"];
const MAX_ABERTOS = 5;
const ID = /^[A-Za-z0-9_-]{8,40}$/;

function checkoutDe(consultoriaId) {
  const c = CHECKOUT_CONSULTORIA[consultoriaId];
  return c && c.eduzzProductId && /^https:\/\//.test(String(c.checkoutUrl || "")) ? c : null;
}
function consultoriaPorEduzz(produtoCod) {
  const id = Object.keys(CHECKOUT_CONSULTORIA).find((k) => checkoutDe(k) && String(CHECKOUT_CONSULTORIA[k].eduzzProductId) === String(produtoCod));
  return id || null;
}
const txt = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
function lista(v, max) { return [...new Set((Array.isArray(v) ? v : []).map(String).filter((x) => ID.test(x)))].slice(0, max); }
function linkValido(u) {
  const s = String(u || "").trim();
  if (!s) return "";
  if (s.length > 300) return null;
  try { const x = new URL(s); return x.protocol === "https:" ? x.toString() : null; } catch (e) { return null; }
}

/* escolhas do atleta para este pedido: só ids (os dados são conferidos e copiados no servidor) */
function normalizarEscolhas(b) {
  b = b || {};
  const links = [];
  for (const l of Array.isArray(b.links) ? b.links.slice(0, 3) : []) {
    const v = linkValido(l);
    if (v === null) return { ok: false, erro: "Os links dos vídeos precisam começar com https://." };
    if (v) links.push(v);
  }
  if (b.autorizo !== true) return { ok: false, erro: "Marque a autorização para compartilhar com o consultor os dados escolhidos." };
  return { ok: true, dados: {
    torneioId: ID.test(String(b.torneioId || "")) ? String(b.torneioId) : null,
    partidaIds: lista(b.partidaIds, 6), scoutIds: lista(b.scoutIds, 3), devolutivaIds: lista(b.devolutivaIds, 5),
    incluirPerfil: b.incluirPerfil === true, observacao: txt(b.observacao, 800), links,
  } };
}

/* o que o navegador recebe de um pedido: sem dados do pagamento além do necessário */
function publicoPedido(id, p) {
  return {
    id, consultoriaId: p.consultoriaId, nome: p.nome, precoCentavos: p.precoCentavos, estado: p.estado, rotulo: ROTULO_ESTADO[p.estado] || p.estado,
    criadoEm: p.criadoEm, atletaNome: p.atletaNome, menor: !!p.menor, pagadorNome: p.pagadorNome || null,
    contexto: p.contexto ? { torneio: p.contexto.torneio ? p.contexto.torneio.nome : null, partidas: (p.contexto.partidas || []).length, scouts: (p.contexto.scouts || []).length, devolutivas: (p.contexto.devolutivas || []).length, perfil: !!p.contexto.perfil, observacao: p.contexto.observacao || "", links: p.contexto.links || [] } : null,
    entrega: p.entrega ? { texto: p.entrega.texto || "", link: p.entrega.link || "", entregueEm: p.entrega.entregueEm || null } : null,
    checkout: checkoutDe(p.consultoriaId) ? true : false,
  };
}

/* ── Eduzz: pagamento aprovado/revogado de um produto de consultoria ──
   Devolve true quando o evento é de consultoria (e foi tratado); false deixa o webhook seguir o fluxo de sempre.
   Casa o pagamento com o pedido pelo produto + e-mail do pagador; sem pedido casado, guarda para revisão manual. Nunca cria acesso. */
async function processarEventoConsultoria(db, ev, agoraISO) {
  const consultoriaId = consultoriaPorEduzz(ev.produtoCod);
  if (!consultoriaId) return false;
  if (!ev.aprovado && !ev.revogar) return true;
  const agora = agoraISO || new Date().toISOString();
  const snap = await db.collection("pedidosConsultoria").where("consultoriaId", "==", consultoriaId).get();
  const candidatos = snap.docs.filter((d) => String(d.data().pagadorEmail || "").toLowerCase() === ev.email);
  if (ev.aprovado) {
    const alvo = candidatos.filter((d) => d.data().estado === "aguardando_pagamento").sort((a, b) => String(a.data().criadoEm).localeCompare(String(b.data().criadoEm)))[0];
    if (alvo) {
      await alvo.ref.update({ estado: "pago", faturaId: ev.faturaId, pagoEm: agora, pagoPor: "eduzz", historico: [...(alvo.data().historico || []).slice(-30), { em: agora, por: "eduzz", acao: "pagamento confirmado" }] });
    } else {
      await db.collection("consultoriasPagamentosSemPedido").doc(ev.faturaId).set({ consultoriaId, email: ev.email, faturaId: ev.faturaId, recebidoEm: agora, motivo: "sem pedido aguardando pagamento para este e-mail" });
    }
  } else if (ev.revogar) {
    const alvo = candidatos.find((d) => d.data().faturaId === ev.faturaId);
    if (alvo && ["pago", "em_andamento"].includes(alvo.data().estado)) {
      await alvo.ref.update({ estado: "reembolsado", historico: [...(alvo.data().historico || []).slice(-30), { em: agora, por: "eduzz", acao: "pagamento estornado ou cancelado" }] });
    } else if (!alvo) {
      await db.collection("consultoriasPagamentosSemPedido").doc(ev.faturaId + "-revogado").set({ consultoriaId, email: ev.email, faturaId: ev.faturaId, recebidoEm: agora, motivo: "estorno sem pedido correspondente" });
    }
  }
  return true;
}

module.exports = {
  CHECKOUT_CONSULTORIA, ESTADOS, ROTULO_ESTADO, TRANSICOES_CONSULTOR, ABERTOS, MAX_ABERTOS, ID,
  checkoutDe, consultoriaPorEduzz, normalizarEscolhas, publicoPedido, processarEventoConsultoria, linkValido, txt,
};
