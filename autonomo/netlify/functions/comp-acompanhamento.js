/* QuadraLab Competição — Acompanhamento MTY (programa remoto de 3 meses).

   GET                   → atleta: oferta, meus acompanhamentos e o painel do ciclo · responsável: os dos atletas vinculados · treinador: os que ele conduz
   GET ?id={id}          → detalhe de um acompanhamento (só quem é o atleta, o pagador, o responsável ativo ou o profissional)

   Atleta:        { acao: "solicitar", aceito: true, articulacao? } · { acao: "cancelar", id } · { acao: "pagar", id } · { acao: "perguntar", id, texto }
                  { acao: "decidirContinuidade", id, aceitar }
   Responsável:   { acao: "confirmar", id } (vira o pagador) · também pergunta, cancela e decide a continuidade do atleta menor
   Profissional:  { acao: "agendar", id, n, data, hora, link? } · { acao: "preparar", id, n, texto } · { acao: "registrarEncontro", id, n, resumo, planoDeAcao }
                  { acao: "revisarSemana", id, semana, destaques?, melhorar?, foco?, audioLink? } · { acao: "responder", id, duvidaId, texto }
                  { acao: "encerrar", id, sintese, prioridades, continuidade? }

   "Agendado", "Realizado" e "Revisado" só aparecem quando o profissional fez a ação correspondente aqui. Pagamento: nunca é marcado por este arquivo
   (só o painel do consultor); o profissional é definido pelo consultor no painel, exigindo vínculo ativo com a área "planejamento". */
const { admin, ErroPublico, resposta, usuarioDoPedido, refJogador } = require("./_player");
const A = require("./_comp-acompanhamento");
const C = require("./_player-competicao");
const P = require("./_comp-planejamento");
const TOR = require("./_player-torneios");

const db = () => admin.firestore();
const agoraISO = () => new Date().toISOString();
const hojeBR = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const hist = (a, por, acao) => [...(a.historico || []).slice(-40), { em: agoraISO(), por, acao }];
const limpo = (o) => JSON.parse(JSON.stringify(o));
const MAX_DUVIDAS = 150;

async function listar(ref, nome) { const o = []; (await ref.collection(nome).get()).forEach((d) => o.push({ id: d.id, ...d.data() })); return o; }
async function responsaveisAtivos(atletaUid) {
  const s = await db().collection("vinculos").where("atletaUid", "==", atletaUid).where("tipo", "==", "responsavel").where("status", "==", "ativo").get();
  return s.docs.map((d) => ({ uid: d.data().pessoaUid, nome: d.data().pessoaNome })).filter((x) => x.uid);
}

/* tudo o que o painel do ciclo mostra, calculado dos registros reais */
async function detalhes(id, a, visao, hoje, uid) {
  const base = A.publicoAcompanhamento(id, a, visao);
  base.souPagador = a.pagadorUid === uid; base.souAtleta = a.atletaUid === uid;
  if (visao === "profissional" && a.profissional) base.vinculoId = a.profissional.vinculoId || null;
  if (!["ativo", "encerrado"].includes(a.estado)) return base;
  const ref = refJogador(a.atletaUid);
  const ciclo = A.cicloDe(a.inicio);
  const devs = (await listar(ref, "devolutivas")).filter((d) => d.acompanhamentoId === id).sort((x, y) => String(y.criadoEm).localeCompare(String(x.criadoEm)));
  const semanaN = A.semanaAtualDoCiclo(a, hoje);
  const revisadas = new Set(devs.map((d) => d.semana));
  const ult = devs.length ? devs[0].criadoEm : a.inicio + "T00:00:00.000Z";
  const partidas = (await listar(ref, "partidas")).filter((p) => String(p.criadoEm || "") > ult), exec = (await listar(ref, "compExecucoes")).filter((x) => String(x.criadoEm || "") > ult);
  const planos = await listar(ref, "compPlanejamentos"), vig = P.vigente(planos);
  const semPlano = vig ? ((vig.conteudo || {}).semanas || []).find((s) => s.inicio <= hoje && hoje <= s.fim) : null;
  const duvidas = (await db().collection("acompanhamentos").doc(id).collection("duvidas").get()).docs.map((d) => ({ id: d.id, ...d.data() })).sort((x, y) => String(x.em).localeCompare(String(y.em)));
  return {
    ...base, ciclo: { semanas: ciclo.semanas, semanaAtual: semanaN }, hoje,
    revisoes: ciclo.semanas.map((s) => ({ n: s.n, de: s.de, ate: s.ate, revisada: revisadas.has(s.n), devolutivaId: (devs.find((d) => d.semana === s.n) || {}).id || null })),
    ultimaDevolutiva: devs[0] ? { id: devs[0].id, semana: devs[0].semana, autorNome: devs[0].autorNome, destaques: devs[0].destaques || "", melhorar: devs[0].melhorar || "", foco: devs[0].foco || "", audioLink: devs[0].audioLink || "", criadoEm: devs[0].criadoEm } : null,
    registrosAguardando: { partidas: partidas.length, treinos: exec.length, total: partidas.length + exec.length, desde: ult },
    proximoEncontro: (() => { const e = A.proximoEncontro(a, hoje); if (!e) return null; const { preparo, ...resto } = e; return visao === "profissional" ? e : resto; })(),
    plano: { vigente: vig ? { id: vig.id, versao: vig.versao, status: vig.status, rotulo: P.rotuloStatus(vig), aprovadoPorNome: vig.aprovadoPorNome || null, aprovadoEm: vig.aprovadoEm || null } : null,
      semana: semPlano ? { inicio: semPlano.inicio, fim: semPlano.fim, objetivo: semPlano.objetivo, focos: semPlano.focos || [] } : null,
      emRevisao: planos.some((p) => p.status === "em_revisao") },
    duvidas: duvidas.map((d) => ({ id: d.id, autorPapel: d.autorPapel, autorNome: d.autorNome, texto: d.texto, em: d.em, respondeA: d.respondeA || null, prazo: d.autorPapel === "profissional" ? null : A.prazoDiasUteis(d.em, 2), respondida: d.autorPapel !== "profissional" && duvidas.some((r) => r.respondeA === d.id) })),
    pendentes: { duvidas: duvidas.filter((d) => d.autorPapel !== "profissional" && !duvidas.some((r) => r.respondeA === d.id)).length },
  };
}

function podeVer(a, uid, respUids) { return a.atletaUid === uid || a.pagadorUid === uid || (a.profissional && a.profissional.uid === uid) || respUids.includes(uid); }

exports.handler = async function (event) {
  try {
    const usuario = await usuarioDoPedido(event), uid = usuario.uid, hoje = hojeBR();
    const jog = (await refJogador(uid).get()).data() || {}, comp = jog.competicao || {};
    if (!["atleta", "responsavel", "treinador"].includes(comp.papel)) throw new ErroPublico(403, "Ative a Competição para ver o Acompanhamento MTY.");
    const email = String(usuario.email || "").trim().toLowerCase();
    const col = db().collection("acompanhamentos");
    const q = event.queryStringParameters || {};

    async function doUsuario() {
      const vistos = new Map();
      const add = (d) => vistos.set(d.id, d.data());
      if (comp.papel === "atleta") (await col.where("atletaUid", "==", uid).get()).forEach(add);
      (await col.where("pagadorUid", "==", uid).get()).forEach(add);
      if (comp.papel === "responsavel") {
        const v = await db().collection("vinculos").where("pessoaUid", "==", uid).where("tipo", "==", "responsavel").where("status", "==", "ativo").get();
        for (const d of v.docs) (await col.where("atletaUid", "==", d.data().atletaUid).get()).forEach(add);
      }
      if (comp.papel === "treinador") (await col.where("profissionalUid", "==", uid).get()).forEach(add);
      return vistos;
    }

    if (event.httpMethod === "GET") {
      const vistos = await doUsuario();
      const visao = comp.papel === "treinador" ? "profissional" : comp.papel;
      if (q.id) {
        const a = vistos.get(q.id);
        if (!a) throw new ErroPublico(404, "Acompanhamento não encontrado.");
        return resposta(200, { acompanhamento: await detalhes(q.id, a, visao, hoje, uid), papel: comp.papel });
      }
      const lista = [...vistos.entries()].sort((x, y) => String(y[1].criadoEm).localeCompare(String(x[1].criadoEm)));
      const saida = { papel: comp.papel, hoje, produto: A.PRODUTO, contato: "https://wa.me/" + A.WHATSAPP, acompanhamentos: [] };
      for (const [id, a] of lista) saida.acompanhamentos.push(await detalhes(id, a, visao, hoje, uid));
      if (comp.papel === "atleta") {
        saida.menor = C.ehMenor(comp.nascimento, hoje);
        saida.responsaveis = (await responsaveisAtivos(uid)).length;
        saida.treinadores = (await db().collection("vinculos").where("atletaUid", "==", uid).where("tipo", "==", "treinador").where("status", "==", "ativo").get()).docs.map((d) => ({ nome: d.data().pessoaNome, areas: C.areasValidas(d.data().areas) }));
      }
      return resposta(200, saida);
    }
    if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });
    let body;
    try { body = JSON.parse(event.body || "{}"); } catch (e) { throw new ErroPublico(400, "Pedido inválido."); }

    if (body.acao === "solicitar") {
      if (comp.papel !== "atleta") throw new ErroPublico(403, "O pedido é feito pelo atleta.");
      const r = A.normalizarSolicitacao(body);
      if (!r.ok) throw new ErroPublico(400, r.erro);
      const meus = (await col.where("atletaUid", "==", uid).get()).docs.filter((d) => A.ABERTOS.includes(d.data().estado));
      if (meus.length) throw new ErroPublico(409, "Você já tem um Acompanhamento MTY em andamento ou em contratação.");
      const menor = C.ehMenor(comp.nascimento, hoje);
      if (menor && !(await responsaveisAtivos(uid)).length) throw new ErroPublico(409, "Como atleta menor de idade, vincule primeiro um responsável: ele confirma e responde pelo pagamento.");
      const base = {
        atletaUid: uid, atletaNome: jog.nome || usuario.name || "Atleta", menor, produto: { id: A.PRODUTO.id, nome: A.PRODUTO.nome, meses: A.PRODUTO.meses, parcelas: A.PRODUTO.parcelas, parcelaCentavos: A.PRODUTO.parcelaCentavos, totalCentavos: A.PRODUTO.totalCentavos },
        parcelas: A.parcelasIniciais(), articulacao: r.dados.articulacao, criadoEm: agoraISO(), profissionalUid: null,
        aceite: { porUid: uid, em: agoraISO(), versao: A.TEXTO_ACEITE_VERSAO, texto: "Li as condições: programa de 3 meses, 3 pagamentos de R$ 790 (R$ 2.370 no total), encontros e acompanhamento remotos, sem renovação automática." },
      };
      const novo = menor ? { ...base, estado: "aguardando_responsavel", pagadorUid: null } : { ...base, estado: "aguardando_pagamento", pagadorUid: uid, pagadorNome: jog.nome || "", pagadorEmail: email };
      novo.historico = hist(novo, uid, menor ? "solicitado, aguarda o responsável" : "solicitado");
      const ref = await col.add(limpo(novo));
      return resposta(200, { ok: true, id: ref.id, estado: novo.estado });
    }

    const id = String(body.id || "");
    if (!A.ID.test(id)) throw new ErroPublico(400, "Acompanhamento inválido.");
    const ref = col.doc(id), snap = await ref.get();
    if (!snap.exists) throw new ErroPublico(404, "Acompanhamento não encontrado.");
    const a = snap.data(), resp = await responsaveisAtivos(a.atletaUid), respUids = resp.map((x) => x.uid);
    if (!podeVer(a, uid, respUids)) throw new ErroPublico(404, "Acompanhamento não encontrado.");
    const ehProf = !!(a.profissional && a.profissional.uid === uid), ehAtleta = a.atletaUid === uid, ehResp = respUids.includes(uid), ehPagador = a.pagadorUid === uid;

    if (body.acao === "confirmar") {
      if (a.estado !== "aguardando_responsavel") throw new ErroPublico(409, "Este pedido não está aguardando o responsável.");
      if (!ehResp) throw new ErroPublico(403, "Só um responsável com vínculo ativo confirma o pedido de um atleta menor de idade.");
      const eu = resp.find((x) => x.uid === uid);
      await ref.update({ estado: "aguardando_pagamento", pagadorUid: uid, pagadorNome: eu.nome || jog.nome || "", pagadorEmail: email, confirmadoEm: agoraISO(), historico: hist(a, uid, "confirmado pelo responsável") });
      return resposta(200, { ok: true });
    }
    if (body.acao === "cancelar") {
      if (!(ehAtleta || ehResp || ehPagador)) throw new ErroPublico(403, "Você não pode cancelar este pedido.");
      if (!["aguardando_responsavel", "aguardando_pagamento"].includes(a.estado) || (a.parcelas || []).some((p) => p.estado === "pago")) throw new ErroPublico(409, "Depois do primeiro pagamento o cancelamento é combinado com o consultor.");
      await ref.update({ estado: "cancelado", canceladoEm: agoraISO(), historico: hist(a, uid, "cancelado antes do pagamento") });
      return resposta(200, { ok: true });
    }
    if (body.acao === "pagar") {
      if (a.estado !== "aguardando_pagamento") throw new ErroPublico(409, "Este pedido não está aguardando pagamento.");
      if (!ehPagador) throw new ErroPublico(403, a.menor ? "Quem paga é o responsável que confirmou o pedido." : "Só quem fez o pedido paga.");
      await ref.update({ pagamentoIniciadoEm: agoraISO() });
      const msg = "Olá, Richard! Solicitei o Acompanhamento MTY (" + id.slice(0, 8) + ") pelo QuadraLab Competição e quero combinar os 3 pagamentos de R$ 790.";
      return resposta(200, { ok: true, manual: true, contato: "https://wa.me/" + A.WHATSAPP + "?text=" + encodeURIComponent(msg) });
    }
    if (body.acao === "perguntar") {
      if (!(ehAtleta || ehResp || ehPagador)) throw new ErroPublico(403, "Só o atleta ou o responsável fazem perguntas.");
      if (a.estado !== "ativo") throw new ErroPublico(409, "O canal de dúvidas fica aberto durante o ciclo.");
      const texto = A.txt(body.texto, 1000);
      if (!texto) throw new ErroPublico(400, "Escreva a sua dúvida.");
      const cd = col.doc(id).collection("duvidas");
      if ((await cd.get()).docs.length >= MAX_DUVIDAS) throw new ErroPublico(409, "O canal de dúvidas chegou ao limite deste ciclo.");
      const em = agoraISO();
      await cd.add({ autorUid: uid, autorPapel: ehAtleta ? "atleta" : "responsavel", autorNome: jog.nome || usuario.name || "", texto, em });
      return resposta(200, { ok: true, respostaAte: A.prazoDiasUteis(em, 2) });
    }
    if (body.acao === "decidirContinuidade") {
      if (!(ehPagador || (ehAtleta && !a.menor))) throw new ErroPublico(403, a.menor ? "Quem decide a continuidade é o responsável." : "Só o atleta decide a continuidade.");
      if (a.estado !== "encerrado" || !a.continuidade || a.continuidade.estado !== "proposta") throw new ErroPublico(409, "Não há proposta de continuidade para decidir.");
      const aceitar = body.aceitar === true;
      await ref.update({ continuidade: { ...a.continuidade, estado: aceitar ? "aceita" : "recusada", decididoEm: agoraISO(), decididoPor: uid }, historico: hist(a, uid, aceitar ? "proposta de continuidade aceita (sem cobrança automática)" : "proposta de continuidade recusada") });
      return resposta(200, { ok: true });
    }

    /* ── profissional ── */
    if (["agendar", "preparar", "registrarEncontro", "revisarSemana", "responder", "encerrar"].includes(body.acao)) {
      if (!ehProf) throw new ErroPublico(403, "Só o profissional responsável conduz este acompanhamento.");
      if (a.estado !== "ativo") throw new ErroPublico(409, "O ciclo não está em andamento.");
      const enc = (a.encontros || []).slice();
      const idx = enc.findIndex((e) => e.n === Number(body.n));
      if (["agendar", "preparar", "registrarEncontro"].includes(body.acao) && idx < 0) throw new ErroPublico(400, "Escolha o encontro (1 a 4).");

      if (body.acao === "agendar") {
        const r = A.normalizarAgendamento(body, hoje);
        if (!r.ok) throw new ErroPublico(400, r.erro);
        if (enc[idx].estado === "realizado") throw new ErroPublico(409, "Este encontro já foi realizado.");
        enc[idx] = { ...enc[idx], ...r.dados, estado: "agendado", agendadoEm: agoraISO() };
        await ref.update(limpo({ encontros: enc, historico: hist(a, uid, "encontro " + enc[idx].n + " agendado para " + r.dados.data) }));
        return resposta(200, { ok: true });
      }
      if (body.acao === "preparar") {
        enc[idx] = { ...enc[idx], preparo: A.txt(body.texto, 1500) };
        await ref.update(limpo({ encontros: enc }));
        return resposta(200, { ok: true });
      }
      if (body.acao === "registrarEncontro") {
        const r = A.normalizarRegistroEncontro(body);
        if (!r.ok) throw new ErroPublico(400, r.erro);
        if (enc[idx].estado !== "agendado") throw new ErroPublico(409, "Agende o encontro antes de registrar que ele aconteceu.");
        enc[idx] = { ...enc[idx], estado: "realizado", registro: { ...r.dados, em: agoraISO() } };
        await ref.update(limpo({ encontros: enc, historico: hist(a, uid, "encontro " + enc[idx].n + " realizado") }));
        return resposta(200, { ok: true });
      }
      if (body.acao === "revisarSemana") {
        const r = A.normalizarRevisao(body, A.cicloDe(a.inicio));
        if (!r.ok) throw new ErroPublico(400, r.erro);
        const dev = refJogador(a.atletaUid).collection("devolutivas");
        const existentes = await listar(refJogador(a.atletaUid), "devolutivas");
        if (existentes.some((d) => d.acompanhamentoId === id && d.semana === r.dados.semana)) throw new ErroPublico(409, "A semana " + r.dados.semana + " já tem devolutiva.");
        if (existentes.length >= TOR.MAX_DEVOLUTIVAS) throw new ErroPublico(409, "Limite de devolutivas deste atleta atingido.");
        const n = await dev.add(limpo({ tipo: "geral", refId: null, refRotulo: "Acompanhamento MTY · semana " + r.dados.semana, destaques: r.dados.destaques, melhorar: r.dados.melhorar, foco: r.dados.foco, audioLink: r.dados.audioLink || "", semana: r.dados.semana, acompanhamentoId: id, autorUid: uid, autorNome: a.profissional.nome, criadoEm: agoraISO() }));
        await ref.update(limpo({ historico: hist(a, uid, "revisão da semana " + r.dados.semana) }));
        await require("./_push").avisar(admin, { app: "player", atletaUid: String(a.atletaUid) },
          { titulo: "Devolutiva da semana " + r.dados.semana, corpo: "Seu treinador revisou a semana " + r.dados.semana + " do Acompanhamento. Toque para ver.", url: "@app", tag: "devolutiva" });
        return resposta(200, { ok: true, id: n.id });
      }
      if (body.acao === "responder") {
        const cd = col.doc(id).collection("duvidas"), todas = await listar(col.doc(id), "duvidas");
        const alvo = todas.find((d) => d.id === String(body.duvidaId || ""));
        if (!alvo || alvo.autorPapel === "profissional") throw new ErroPublico(404, "Dúvida não encontrada.");
        if (todas.some((d) => d.respondeA === alvo.id)) throw new ErroPublico(409, "Esta dúvida já foi respondida.");
        const texto = A.txt(body.texto, 1500);
        if (!texto) throw new ErroPublico(400, "Escreva a resposta.");
        await cd.add({ autorUid: uid, autorPapel: "profissional", autorNome: a.profissional.nome, texto, em: agoraISO(), respondeA: alvo.id });
        return resposta(200, { ok: true });
      }
      if (body.acao === "encerrar") {
        const r = A.normalizarEncerramento(body);
        if (!r.ok) throw new ErroPublico(400, r.erro);
        if (!enc.some((e) => e.n === 4 && e.estado === "realizado") && body.semAvaliacaoFinal !== true) throw new ErroPublico(409, "O encontro de avaliação do ciclo (o quarto) ainda não foi registrado. Registre-o ou confirme o encerramento sem ele.");
        await ref.update(limpo({
          estado: "encerrado", encerradoEm: agoraISO(), encerramento: { sintese: r.dados.sintese, prioridades: r.dados.prioridades, em: agoraISO(), porNome: a.profissional.nome },
          continuidade: r.dados.continuidade ? { estado: "proposta", texto: r.dados.continuidade, em: agoraISO() } : { estado: "sem_proposta" },
          historico: hist(a, uid, "ciclo encerrado"),
        }));
        return resposta(200, { ok: true });
      }
    }
    throw new ErroPublico(400, "Ação desconhecida.");
  } catch (e) {
    if (e instanceof ErroPublico) return resposta(e.status, { erro: e.message });
    console.error("comp-acompanhamento:", e && e.message);
    return resposta(500, { erro: "Não foi possível concluir agora. Tente de novo em instantes." });
  }
};
