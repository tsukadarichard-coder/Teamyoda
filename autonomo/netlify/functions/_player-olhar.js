/* QuadraLab Player — produto "Olhar do treinador" (regras puras, configuração central e ligação com a Eduzz).

   Uma dúvida sobre uma estratégia do jogador, respondida por Richard Tsukada em uma devolutiva gravada (áudio ou vídeo de 3 a 5 minutos).
   Pagamento único, sem assinatura. É um produto à parte das consultorias e da assinatura do Player.

   Fonte única de preço, textos de escopo, prazo e limites: a página de vendas, os cartões do app, o formulário, o pedido e o checkout leem DAQUI
   (via player-publico / player-olhar). O navegador nunca manda valor; o servidor sempre usa PRODUTO.precoCentavos.

   Estados do ATENDIMENTO (pedido.estado):
     rascunho · aguardando_pagamento · recebido · em_analise · devolutiva_disponivel · cancelado · reembolsado
   Estado do PAGAMENTO (pedido.pagamento.estado), separado do atendimento:
     pendente · aprovado · falhou · reembolsado
   "recebido" só existe com pagamento aprovado pela Eduzz (webhook). Nenhuma chamada do app marca pago.

   Pagamento: o produto só tem checkout quando CHECKOUT_OLHAR tem o productId da Eduzz e o link https. Enquanto estiver vazio, o app
   avisa que o pagamento está indisponível, registra a pendência para o administrador e NÃO simula pagamento. */

const PRODUTO = {
  id: "olhar-do-treinador",
  nome: "Olhar do treinador",
  descricaoCurta: "Uma dúvida sobre sua estratégia. Uma orientação individual de Richard Tsukada.",
  precoCentavos: 4790,
  moeda: "BRL",
  modalidade: "pagamento_unico",
  condicao: "Pagamento único · Sem assinatura",
  prazoDiasUteis: 3,
  duracaoMinSeg: 180,
  duracaoMaxSeg: 300,
  duvida: { min: 30, max: 800 },
  contexto: { max: 400 },
  maxPendentes: 3,
};

/* produto da Eduzz: preencha quando o produto de R$ 47,90 (pagamento único) for criado no painel da Eduzz */
const CHECKOUT_OLHAR = { eduzzProductId: null, checkoutUrl: null };

/* feriados que não contam como dia útil no prazo, além dos nacionais calculados abaixo (ex.: feriado municipal, recesso): "AAAA-MM-DD" */
const FERIADOS_EXTRAS = [];

const ESTADOS = ["rascunho", "aguardando_pagamento", "recebido", "em_analise", "devolutiva_disponivel", "cancelado", "reembolsado"];
const ROTULO_ESTADO = {
  rascunho: "Rascunho", aguardando_pagamento: "Aguardando pagamento", recebido: "Recebido", em_analise: "Em análise",
  devolutiva_disponivel: "Devolutiva disponível", cancelado: "Cancelado", reembolsado: "Reembolsado",
};
const ROTULO_PAGAMENTO = { pendente: "Pagamento pendente", aprovado: "Pagamento confirmado", falhou: "Pagamento não concluído", reembolsado: "Pagamento reembolsado" };
const ABERTOS = ["aguardando_pagamento", "recebido", "em_analise"];
const ID = /^[A-Za-z0-9]{10,40}$/;

const txt = (v, n) => String(v == null ? "" : v).replace(/\r\n?/g, "\n").trim().slice(0, n);

function checkoutOlhar() {
  return CHECKOUT_OLHAR.eduzzProductId && /^https:\/\//.test(String(CHECKOUT_OLHAR.checkoutUrl || "")) ? CHECKOUT_OLHAR : null;
}
function produtoEhOlhar(produtoCod) {
  const c = checkoutOlhar();
  return !!c && String(c.eduzzProductId) === String(produtoCod);
}

/* o que o navegador pode saber do produto (página de vendas e app) */
function produtoPublico() {
  return {
    id: PRODUTO.id, nome: PRODUTO.nome, descricaoCurta: PRODUTO.descricaoCurta, precoCentavos: PRODUTO.precoCentavos, moeda: PRODUTO.moeda,
    condicao: PRODUTO.condicao, prazoDiasUteis: PRODUTO.prazoDiasUteis, duracaoMinSeg: PRODUTO.duracaoMinSeg, duracaoMaxSeg: PRODUTO.duracaoMaxSeg,
    duvida: PRODUTO.duvida, contexto: PRODUTO.contexto, pagamentoDisponivel: !!checkoutOlhar(),
  };
}

/* ── datas e dias úteis (America/Sao_Paulo) ── */
function hojeSP(agora) {
  return new Date(agora == null ? Date.now() : agora).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}
function somarDias(iso, n) {
  const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/* Páscoa (algoritmo de Meeus/Jones/Butcher) */
function pascoa(ano) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return ano + "-" + String(mes).padStart(2, "0") + "-" + String(dia).padStart(2, "0");
}
const cacheFeriados = {};
function feriadosDoAno(ano) {
  if (cacheFeriados[ano]) return cacheFeriados[ano];
  const fixos = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"].map((x) => ano + "-" + x);
  const p = pascoa(ano);
  /* Carnaval (segunda e terça), Sexta-feira Santa e Corpus Christi: ponto facultativo ou feriado, tratados como dia sem expediente */
  const moveis = [somarDias(p, -48), somarDias(p, -47), somarDias(p, -2), somarDias(p, 60)];
  return (cacheFeriados[ano] = new Set(fixos.concat(moveis)));
}
function ehDiaUtil(iso) {
  const dow = new Date(iso + "T12:00:00Z").getUTCDay();
  if (dow === 0 || dow === 6) return false;
  return !feriadosDoAno(+iso.slice(0, 4)).has(iso) && !FERIADOS_EXTRAS.includes(iso);
}
/* data limite: n dias úteis DEPOIS do dia da confirmação (confirmou no sábado: segunda é o 1º dia útil) */
function somarDiasUteis(iso, n) {
  let d = iso, falta = n;
  while (falta > 0) { d = somarDias(d, 1); if (ehDiaUtil(d)) falta--; }
  return d;
}
function prazoDe(confirmadoEmISO) { return somarDiasUteis(hojeSP(Date.parse(confirmadoEmISO)), PRODUTO.prazoDiasUteis); }
const dataExtensa = (iso) => { const p = String(iso || "").split("-"); return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : ""; };

/* ── solicitação do jogador ── */
function validarSolicitacao(b) {
  b = b || {};
  const estrategiaId = String(b.estrategiaId || "");
  if (!ID.test(estrategiaId)) return { ok: false, erro: "Escolha a estratégia que você quer comentar." };
  const duvida = txt(b.duvida, 5000), contexto = txt(b.contexto, 5000);
  if (duvida.length < PRODUTO.duvida.min) return { ok: false, erro: "Descreva a sua principal dúvida com pelo menos " + PRODUTO.duvida.min + " caracteres." };
  if (duvida.length > PRODUTO.duvida.max) return { ok: false, erro: "A dúvida pode ter até " + PRODUTO.duvida.max + " caracteres. Escolha um ponto para aprofundar." };
  if (contexto.length > PRODUTO.contexto.max) return { ok: false, erro: "O detalhe adicional pode ter até " + PRODUTO.contexto.max + " caracteres." };
  if (b.aceite !== true) return { ok: false, erro: "Confirme que entendeu o que o atendimento contempla." };
  return { ok: true, dados: { estrategiaId, duvida, contexto } };
}

/* prévia curta da estratégia (nome, data, objetivo) — nunca o plano inteiro */
function previaEstrategia(id, p) {
  const pl = (p && p.plano) || {};
  return { id, titulo: txt(pl.titulo, 120) || "Estratégia", criadoEm: (p && p.criadoEm) || null, objetivo: txt(pl.resumo, 240) };
}

/* cópia, no momento da confirmação, do que o Richard vai ler: ficha e estratégia como estavam. Mudanças futuras não alteram o pedido. */
function montarSnapshot(jog, planoDoc, planoId, agoraISO) {
  const copia = (v) => JSON.parse(JSON.stringify(v == null ? null : v));
  const p = planoDoc || null;
  return {
    copiadoEm: agoraISO,
    ficha: copia((jog && jog.ficha) || {}),
    estrategia: p ? { id: planoId, criadoEm: p.criadoEm || null, adversarioNome: p.adversarioNome || null, plano: copia(p.plano || {}) } : null,
    estrategiaIndisponivel: !p,
  };
}

const NUM_ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function novoNumero(rnd) {
  rnd = rnd || (() => Math.random());
  let s = ""; for (let i = 0; i < 6; i++) s += NUM_ALFABETO[Math.floor(rnd() * NUM_ALFABETO.length)];
  return "OT-" + s;
}

/* o que o jogador recebe de um pedido: nunca o caminho do arquivo, nem dados do snapshot além do necessário */
function publicoPedido(id, p) {
  const d = p.devolutiva || {}, pub = !!d.publicadaEm;
  return {
    id, numero: p.numero || null, produto: p.produtoNome || PRODUTO.nome, precoCentavos: p.precoCentavos, estado: p.estado, rotulo: ROTULO_ESTADO[p.estado] || p.estado,
    pagamento: { estado: (p.pagamento && p.pagamento.estado) || "pendente", rotulo: ROTULO_PAGAMENTO[(p.pagamento && p.pagamento.estado) || "pendente"], pagoEm: (p.pagamento && p.pagamento.pagoEm) || null, iniciado: !!p.pagamentoIniciadoEm },
    estrategia: p.estrategia || null, duvida: p.duvida, contexto: p.contexto || "", criadoEm: p.criadoEm, confirmadoEm: p.confirmadoEm || null,
    prazoEm: p.prazoEm || null, prazoTexto: p.prazoEm ? dataExtensa(p.prazoEm) : null,
    devolutiva: pub ? { publicadaEm: d.publicadaEm, tipo: d.tipo, resumo: d.resumo || "", autor: "Richard Tsukada", duracaoSeg: d.duracaoSeg || null, vista: !!p.acessadaEm } : null,
    nova: pub && !p.acessadaEm,
    checkout: !!checkoutOlhar(),
  };
}

/* Pagamento aprovado (pela Eduzz, ou vinculado à mão pelo administrador a um pagamento já reconhecido pela Eduzz):
   o pedido vira "recebido", ganha a data limite e uma cópia da ficha e da estratégia daquele momento. */
async function confirmarPagamento(db, ref, p, faturaId, agora, por) {
  let jog = {}, plano = null;
  try {
    const rj = db.collection("jogadores").doc(p.uid);
    jog = (await rj.get()).data() || {};
    const sp = await rj.collection("planos").doc(p.estrategia.id).get();
    plano = sp.exists ? sp.data() : null;
  } catch (e) { /* sem a cópia: o pedido segue e o painel mostra que a estratégia não pôde ser copiada */ }
  const notificacoes = [...(p.notificacoes || []), { tipo: "pedido_recebido", em: agora, app: true, email: "indisponivel" }];
  await ref.update({
    estado: "recebido", faturaId, confirmadoEm: agora, prazoEm: prazoDe(agora),
    pagamento: { estado: "aprovado", faturaId, pagoEm: agora, via: por },
    snapshot: montarSnapshot(jog, plano, p.estrategia.id, agora), notificacoes,
    historico: [...(p.historico || []).slice(-40), { em: agora, por, acao: "pagamento confirmado" }],
  });
  await avisarEquipe(p.numero);
}

/* ── Eduzz: pagamento aprovado/revogado do produto ──
   Devolve true quando o evento é deste produto (e foi tratado); false deixa o webhook seguir o fluxo de sempre.
   Casa o pagamento com o pedido pelo produto + e-mail do pagador. Idempotente: a mesma fatura nunca confirma dois pedidos. */
async function processarEventoOlhar(db, ev, agoraISO) {
  if (!produtoEhOlhar(ev.produtoCod)) return false;
  if (!ev.aprovado && !ev.revogar) return true;
  const agora = agoraISO || new Date().toISOString();
  const col = db.collection("olharPedidos");
  const hist = (p, acao) => [...(p.historico || []).slice(-40), { em: agora, por: "eduzz", acao }];
  const porFatura = (await col.where("faturaId", "==", ev.faturaId).get()).docs[0];
  if (ev.aprovado) {
    if (porFatura) return true; // já confirmada
    const cands = (await col.where("pagadorEmail", "==", ev.email).get()).docs.filter((d) => d.data().estado === "aguardando_pagamento");
    const alvo = cands.sort((a, b) => String(a.data().criadoEm).localeCompare(String(b.data().criadoEm)))[0];
    if (!alvo) {
      await db.collection("olharPagamentosSemPedido").doc(ev.faturaId).set({ email: ev.email, faturaId: ev.faturaId, recebidoEm: agora, motivo: "sem pedido aguardando pagamento para este e-mail" });
      return true;
    }
    await confirmarPagamento(db, alvo.ref, alvo.data(), ev.faturaId, agora, "eduzz");
    return true;
  }
  /* estorno, cancelamento ou chargeback */
  if (porFatura) {
    const p = porFatura.data();
    if (["recebido", "em_analise", "devolutiva_disponivel"].includes(p.estado)) {
      await porFatura.ref.update({ estado: "reembolsado", pagamento: { ...(p.pagamento || {}), estado: "reembolsado", reembolsadoEm: agora }, historico: hist(p, "pagamento estornado ou cancelado") });
    }
    return true;
  }
  const cands = (await col.where("pagadorEmail", "==", ev.email).get()).docs.filter((d) => d.data().estado === "aguardando_pagamento" && d.data().pagamentoIniciadoEm);
  const alvo = cands.sort((a, b) => String(b.data().pagamentoIniciadoEm).localeCompare(String(a.data().pagamentoIniciadoEm)))[0];
  if (alvo) {
    const p = alvo.data();
    await alvo.ref.update({ pagamento: { estado: "falhou", faturaId: ev.faturaId, falhouEm: agora }, historico: hist(p, "pagamento não concluído (cancelado na Eduzz)") });
  } else {
    await db.collection("olharPagamentosSemPedido").doc(ev.faturaId + "-revogado").set({ email: ev.email, faturaId: ev.faturaId, recebidoEm: agora, motivo: "estorno ou cancelamento sem pedido correspondente" });
  }
  return true;
}

/* aviso opcional para a equipe quando entra um pedido pago (OLHAR_WEBHOOK_URL, https): só texto, sem dados pessoais além do número */
async function avisarEquipe(numero, fetchFn) {
  const url = String(process.env.OLHAR_WEBHOOK_URL || "");
  if (!/^https:\/\//.test(url)) return false;
  try {
    const f = fetchFn || fetch;
    await f(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "Olhar do treinador: novo pedido pago " + numero + ". Abra o Painel QuadraLab." }) });
    return true;
  } catch (e) { return false; }
}

module.exports = {
  PRODUTO, CHECKOUT_OLHAR, FERIADOS_EXTRAS, ESTADOS, ROTULO_ESTADO, ROTULO_PAGAMENTO, ABERTOS, ID,
  checkoutOlhar, produtoEhOlhar, produtoPublico, hojeSP, somarDias, pascoa, ehDiaUtil, somarDiasUteis, prazoDe, dataExtensa,
  validarSolicitacao, previaEstrategia, montarSnapshot, novoNumero, publicoPedido, confirmarPagamento, processarEventoOlhar, avisarEquipe, txt,
};
