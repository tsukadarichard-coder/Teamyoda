/* QuadraLab Competição — pedidos de consultoria feitos dentro do app.

   GET                              → catálogo, políticas, meus pedidos (atleta; responsável vê os dos atletas vinculados) e o que dá para compartilhar
   POST { acao: "criar", consultoriaId, torneioId?, partidaIds?, scoutIds?, devolutivaIds?, incluirPerfil?, observacao?, links?, autorizo }
   POST { acao: "confirmar", id }   → responsável vinculado confirma o pedido de um atleta menor (e passa a ser o pagador)
   POST { acao: "pagar", id }       → devolve o link de pagamento (Eduzz) ou o contato para combinar o pagamento; NUNCA marca pago
   POST { acao: "cancelar", id }    → cancela antes do pagamento

   Segurança:
   · o atleta escolhe o que compartilhar; o servidor copia só esses itens, conferindo que são do próprio atleta (nunca o que não foi marcado);
   · atleta menor de idade: só um responsável com vínculo ativo confirma e paga;
   · "pago" só vem da Eduzz (webhook) ou do painel do consultor: nenhuma chamada deste arquivo altera o pagamento;
   · cada pessoa só vê pedidos em que é o atleta, o pagador ou o responsável vinculado do atleta. */
const { admin, ErroPublico, resposta, usuarioDoPedido, refJogador, OPCOES } = require("./_player");
const ASS = require("./_player-assinaturas");
const CONS = require("./_player-consultorias");
const C = require("./_player-competicao");
const PART = require("./_player-partidas");
const SC = require("./player-scouts");

const db = () => admin.firestore();
const hojeBR = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const agora = () => new Date().toISOString();
const hist = (p, por, acao) => [...(p.historico || []).slice(-30), { em: agora(), por, acao }];

async function responsaveisAtivos(atletaUid) {
  const s = await db().collection("vinculos").where("atletaUid", "==", atletaUid).where("tipo", "==", "responsavel").where("status", "==", "ativo").get();
  return s.docs.map((d) => ({ uid: d.data().pessoaUid, nome: d.data().pessoaNome })).filter((x) => x.uid);
}

/* copia, do próprio atleta, só o que foi marcado */
async function montarContexto(uid, jog, e) {
  const ref = refJogador(uid), ctx = { observacao: e.observacao, links: e.links };
  if (e.torneioId) {
    const s = await ref.collection("torneios").doc(e.torneioId).get();
    if (!s.exists) throw new ErroPublico(404, "Torneio não encontrado.");
    const t = s.data();
    ctx.torneio = { nome: t.nome, inicio: t.inicio, fim: t.fim, cidade: t.cidade || "", local: t.local || "", categoria: t.categoria || "", circuito: t.circuito || "", superficie: t.superficie || "" };
  }
  ctx.partidas = [];
  for (const id of e.partidaIds) {
    const s = await ref.collection("partidas").doc(id).get();
    if (!s.exists) throw new ErroPublico(404, "Uma das partidas escolhidas não foi encontrada.");
    const p = s.data();
    ctx.partidas.push({ data: p.data, adversario: p.adversario || "", resultado: p.resultado, placar: p.placar || "", tipo: p.tipo, rodada: p.rodada || "", execucao: p.execucao || null,
      dificuldades: (p.dificuldades || []).map((a) => PART.ASPECTOS[a]).filter(Boolean), funcionouTexto: p.funcionouTexto || "", naoFuncionouTexto: p.naoFuncionouTexto || "", obs: p.obs || "" });
  }
  ctx.scouts = [];
  if (e.scoutIds.length) {
    const vig = await SC.scoutsVigentes(ref, (d) => true);
    for (const id of e.scoutIds) {
      const x = vig.find((s) => s.id === id);
      if (!x) throw new ErroPublico(404, "Um dos scouts escolhidos não foi encontrado.");
      if (x.estado !== "ativo") throw new ErroPublico(409, "Um dos scouts escolhidos teve o link desativado pelo treinador e não pode ser compartilhado.");
      ctx.scouts.push({ rotulo: x.rotulo, data: x.data, resumo: x.resumo });
    }
  }
  ctx.devolutivas = [];
  for (const id of e.devolutivaIds) {
    const s = await ref.collection("devolutivas").doc(id).get();
    if (!s.exists) throw new ErroPublico(404, "Uma das devolutivas escolhidas não foi encontrada.");
    const d = s.data();
    ctx.devolutivas.push({ refRotulo: d.refRotulo || "Geral", autorNome: d.autorNome || "", destaques: d.destaques || "", melhorar: d.melhorar || "", foco: d.foco || "", criadoEm: d.criadoEm });
  }
  if (e.incluirPerfil) ctx.perfil = C.perfilCompartilhavel(jog.ficha, OPCOES);
  return ctx;
}

function pedidoParaVoce(id, p, uid) {
  const x = CONS.publicoPedido(id, p);
  x.pagadorEhVoce = p.pagadorUid === uid;
  x.euSouAtleta = p.atletaUid === uid;
  return x;
}

exports.handler = async function (event) {
  try {
    const usuario = await usuarioDoPedido(event), uid = usuario.uid, hoje = hojeBR();
    const jog = (await refJogador(uid).get()).data() || {}, comp = jog.competicao || {};
    if (!["atleta", "responsavel"].includes(comp.papel)) throw new ErroPublico(403, "Ative a Competição como atleta ou responsável para contratar consultorias.");
    const email = String(usuario.email || "").trim().toLowerCase();

    if (event.httpMethod === "GET") {
      const pedidos = [], vistos = new Set();
      const add = (s) => { if (!vistos.has(s.id)) { vistos.add(s.id); pedidos.push(pedidoParaVoce(s.id, s.data(), uid)); } };
      if (comp.papel === "atleta") (await db().collection("pedidosConsultoria").where("atletaUid", "==", uid).get()).forEach(add);
      (await db().collection("pedidosConsultoria").where("pagadorUid", "==", uid).get()).forEach(add);
      if (comp.papel === "responsavel") {
        const v = await db().collection("vinculos").where("pessoaUid", "==", uid).where("tipo", "==", "responsavel").where("status", "==", "ativo").get();
        for (const d of v.docs) (await db().collection("pedidosConsultoria").where("atletaUid", "==", d.data().atletaUid).get()).forEach(add);
      }
      pedidos.sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));
      const saida = {
        papel: comp.papel, pedidos,
        catalogo: ASS.consultoriasPublicas().map((c) => ({ ...c, pagamento: CONS.checkoutDe(c.id) ? "eduzz" : "combinado" })),
        politicas: ASS.politicasPublicas(), contato: "https://wa.me/" + ASS.WHATSAPP,
      };
      if (comp.papel === "atleta") {
        const ref = refJogador(uid), ls = async (n) => { const o = []; (await ref.collection(n).get()).forEach((d) => o.push({ id: d.id, ...d.data() })); return o; };
        saida.opcoes = {
          torneios: (await ls("torneios")).map((t) => ({ id: t.id, nome: t.nome, inicio: t.inicio })).sort((a, b) => String(b.inicio).localeCompare(String(a.inicio))),
          partidas: (await ls("partidas")).map((p) => ({ id: p.id, data: p.data, adversario: p.adversario || "", resultado: p.resultado, placar: p.placar || "" })).sort((a, b) => String(b.data).localeCompare(String(a.data))).slice(0, 40),
          scouts: (await SC.scoutsVigentes(ref)).filter((s) => s.estado === "ativo").map((s) => ({ id: s.id, rotulo: s.rotulo, data: s.data })),
          devolutivas: (await ls("devolutivas")).map((d) => ({ id: d.id, refRotulo: d.refRotulo || "Geral", autorNome: d.autorNome || "", criadoEm: d.criadoEm })).sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm))).slice(0, 20),
        };
        saida.menor = C.ehMenor(comp.nascimento, hoje);
      }
      return resposta(200, saida);
    }
    if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });
    let body;
    try { body = JSON.parse(event.body || "{}"); } catch (e) { throw new ErroPublico(400, "Pedido inválido."); }

    if (body.acao === "criar") {
      if (comp.papel !== "atleta") throw new ErroPublico(403, "O pedido é montado pelo atleta.");
      const cat = ASS.CONSULTORIAS.find((c) => c.id === body.consultoriaId);
      if (!cat) throw new ErroPublico(400, "Escolha uma consultoria.");
      const r = CONS.normalizarEscolhas(body);
      if (!r.ok) throw new ErroPublico(400, r.erro);
      const abertos = (await db().collection("pedidosConsultoria").where("atletaUid", "==", uid).get()).docs.filter((d) => CONS.ABERTOS.includes(d.data().estado));
      if (abertos.length >= CONS.MAX_ABERTOS) throw new ErroPublico(409, "Você já tem " + CONS.MAX_ABERTOS + " pedidos em andamento. Conclua ou cancele algum antes de pedir outro.");
      const menor = C.ehMenor(comp.nascimento, hoje);
      if (menor && !(await responsaveisAtivos(uid)).length) throw new ErroPublico(409, "Como atleta menor de idade, vincule primeiro um responsável: ele confirma e paga a consultoria.");
      const contexto = await montarContexto(uid, jog, r.dados);
      const base = {
        atletaUid: uid, atletaNome: jog.nome || usuario.name || "Atleta", menor, consultoriaId: cat.id, nome: cat.nome, precoCentavos: cat.precoCentavos,
        contexto, consentimento: { porUid: uid, em: agora(), texto: "Autorizo compartilhar com o consultor os dados escolhidos, apenas para esta consultoria." }, criadoEm: agora(),
      };
      const novo = menor
        ? { ...base, estado: "aguardando_responsavel", pagadorUid: null, pagadorEmail: null }
        : { ...base, estado: "aguardando_pagamento", pagadorUid: uid, pagadorNome: jog.nome || "", pagadorEmail: email };
      novo.historico = hist(novo, uid, menor ? "pedido criado, aguarda o responsável" : "pedido criado");
      const ref = await db().collection("pedidosConsultoria").add(novo);
      return resposta(200, { ok: true, id: ref.id, estado: novo.estado });
    }

    /* demais ações: sobre um pedido existente */
    const idPed = String(body.id || "");
    if (!CONS.ID.test(idPed)) throw new ErroPublico(400, "Pedido inválido.");
    const refPed = db().collection("pedidosConsultoria").doc(idPed), snap = await refPed.get();
    if (!snap.exists) throw new ErroPublico(404, "Pedido não encontrado.");
    const p = snap.data();
    const resp = await responsaveisAtivos(p.atletaUid), ehRespAtivo = resp.some((x) => x.uid === uid);
    const envolvido = p.atletaUid === uid || p.pagadorUid === uid || ehRespAtivo;
    if (!envolvido) throw new ErroPublico(404, "Pedido não encontrado.");

    if (body.acao === "confirmar") {
      if (p.estado !== "aguardando_responsavel") throw new ErroPublico(409, "Este pedido não está aguardando o responsável.");
      if (!ehRespAtivo) throw new ErroPublico(403, "Só um responsável com vínculo ativo confirma o pedido de um atleta menor de idade.");
      const eu = resp.find((x) => x.uid === uid);
      await refPed.update({ estado: "aguardando_pagamento", pagadorUid: uid, pagadorNome: eu.nome || jog.nome || "", pagadorEmail: email, confirmadoEm: agora(), historico: hist(p, uid, "confirmado pelo responsável") });
      return resposta(200, { ok: true });
    }
    if (body.acao === "cancelar") {
      if (!["aguardando_responsavel", "aguardando_pagamento"].includes(p.estado)) throw new ErroPublico(409, "Depois do pagamento o cancelamento é combinado com o consultor.");
      await refPed.update({ estado: "cancelado", canceladoEm: agora(), historico: hist(p, uid, "cancelado antes do pagamento") });
      return resposta(200, { ok: true });
    }
    if (body.acao === "pagar") {
      if (p.estado !== "aguardando_pagamento") throw new ErroPublico(409, "Este pedido não está aguardando pagamento.");
      if (p.pagadorUid !== uid) throw new ErroPublico(403, p.menor ? "Quem paga é o responsável que confirmou o pedido." : "Só quem fez o pedido paga.");
      await refPed.update({ pagamentoIniciadoEm: agora() });
      const ck = CONS.checkoutDe(p.consultoriaId);
      if (ck) return resposta(200, { ok: true, checkoutUrl: ck.checkoutUrl, aviso: "Use o mesmo e-mail da sua conta (" + email + ") na compra, para o pagamento ser reconhecido sozinho." });
      const msg = "Olá, Richard! Fiz o pedido de " + p.nome + " (" + idPed.slice(0, 8) + ") pelo QuadraLab Competição e quero combinar o pagamento.";
      return resposta(200, { ok: true, manual: true, contato: "https://wa.me/" + ASS.WHATSAPP + "?text=" + encodeURIComponent(msg) });
    }
    throw new ErroPublico(400, "Ação desconhecida.");
  } catch (e) {
    if (e instanceof ErroPublico) return resposta(e.status, { erro: e.message });
    console.error("player-consultorias:", e && e.message);
    return resposta(500, { erro: "Não foi possível concluir agora. Tente de novo em instantes." });
  }
};
