/* QuadraLab Player Competição — papéis e vínculos (atleta, responsável, treinador).

   GET                         → meu papel, os vínculos que eu criei como atleta e os vínculos em que sou a pessoa vinculada
   GET ?ver={vinculoId}        → o que o vínculo ativo me deixa ver do atleta (só as áreas marcadas)
   POST { acao: "ativar", papel, nascimento? }   → escolhe o papel (atleta exige data de nascimento)
   POST { acao: "convidar", tipo, areas }        → atleta gera um código de convite (responsavel | treinador)
   POST { acao: "aceitarCodigo", codigo }        → responsável/treinador usa o código; o vínculo fica aguardando aprovação
   POST { acao: "decidir", id, aprovar }         → aprova ou recusa (atleta; responsável quando o atleta é menor e o vínculo é de treinador)
   POST { acao: "areas", id, areas }             → muda as áreas compartilhadas
   POST { acao: "revogar", id }                  → encerra o vínculo (atleta, responsável do menor ou a própria pessoa)

   Tudo pelo uid do token. Os vínculos moram em vinculos/{id}, sem regra de Firestore: só estas functions alcançam. */
const { admin, ErroPublico, resposta, usuarioDoPedido, refJogador, OPCOES } = require("./_player");
const C = require("./_player-competicao");

const db = () => admin.firestore();
const agoraISO = () => new Date().toISOString();
const hojeNoBrasil = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const ID_VALIDO = /^[A-Za-z0-9]{10,40}$/;

async function dadosJogador(uid) { const s = await refJogador(uid).get(); return s.exists ? s.data() : {}; }
function comp(d) { return (d && d.competicao) || {}; }

async function responsaveisAtivos(atletaUid) {
  const s = await db().collection("vinculos").where("atletaUid", "==", atletaUid).where("tipo", "==", "responsavel").where("status", "==", "ativo").get();
  const uids = []; s.forEach((d) => { if (d.data().pessoaUid) uids.push(d.data().pessoaUid); });
  return uids;
}
function evento(v, quem, acao) {
  const h = Array.isArray(v.historico) ? v.historico.slice(-30) : [];
  h.push({ em: agoraISO(), por: quem, acao });
  return h;
}
async function carregarVinculo(id) {
  if (!ID_VALIDO.test(String(id || ""))) throw new ErroPublico(400, "Vínculo inválido.");
  const ref = db().collection("vinculos").doc(id), s = await ref.get();
  if (!s.exists) throw new ErroPublico(404, "Vínculo não encontrado.");
  return { ref, v: s.data() };
}
async function menorDoAtleta(atletaUid) {
  return C.ehMenor(comp(await dadosJogador(atletaUid)).nascimento, hojeNoBrasil());
}

/* ao perder o último responsável ativo, um atleta menor não pode manter treinadores */
async function encerrarTreinadoresSeMenorSemResponsavel(atletaUid, quem) {
  if (!(await menorDoAtleta(atletaUid))) return;
  if ((await responsaveisAtivos(atletaUid)).length) return;
  const s = await db().collection("vinculos").where("atletaUid", "==", atletaUid).where("tipo", "==", "treinador").get();
  for (const d of s.docs) {
    const v = d.data();
    if (v.status === "ativo" || v.status === "aguardando") await d.ref.update({ status: "revogado", encerradoEm: agoraISO(), historico: evento(v, quem, "encerrado: atleta menor sem responsável ativo") });
  }
}

async function estadoCompleto(uid) {
  const d = await dadosJogador(uid), c = comp(d), hoje = hojeNoBrasil();
  const saida = { competicao: { ativo: !!c.papel, papel: c.papel || null, menor: c.papel === "atleta" ? C.ehMenor(c.nascimento, hoje) : null, idade: c.papel === "atleta" ? C.idadeEm(c.nascimento, hoje) : null }, meus: [], comigo: [] };
  if (!c.papel) return saida;
  const meus = await db().collection("vinculos").where("atletaUid", "==", uid).get();
  meus.forEach((s) => {
    const v = s.data(); if (C.conviteVencido(v, hoje)) v.status = "expirado";
    saida.meus.push(C.publicoVinculo(s.id, v, true));
  });
  const comigo = await db().collection("vinculos").where("pessoaUid", "==", uid).get();
  comigo.forEach((s) => saida.comigo.push(C.publicoVinculo(s.id, s.data(), false)));
  /* responsável de atleta menor também decide os pedidos de treinador desse atleta */
  if (c.papel === "responsavel") {
    saida.paraDecidir = [];
    for (const l of saida.comigo.filter((x) => x.tipo === "responsavel" && x.status === "ativo")) {
      const { v } = await carregarVinculo(l.id);
      const pend = await db().collection("vinculos").where("atletaUid", "==", v.atletaUid).where("status", "==", "aguardando").get();
      pend.forEach((s) => { if (s.data().tipo === "treinador") saida.paraDecidir.push(C.publicoVinculo(s.id, s.data(), true)); });
    }
  }
  const ordem = (a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm));
  saida.meus.sort(ordem); saida.comigo.sort(ordem);
  return saida;
}

exports.handler = async function (event) {
  try {
    const usuario = await usuarioDoPedido(event);
    const uid = usuario.uid;
    const hoje = hojeNoBrasil();

    if (event.httpMethod === "GET") {
      const ver = event.queryStringParameters && event.queryStringParameters.ver;
      if (!ver) return resposta(200, await estadoCompleto(uid));
      const { v } = await carregarVinculo(ver);
      /* a pessoa vinculada, e só com vínculo ativo; qualquer outro caso é "não encontrado" para não revelar que existe */
      if (v.pessoaUid !== uid || v.status !== "ativo") throw new ErroPublico(404, "Vínculo não encontrado.");
      const aj = await dadosJogador(v.atletaUid);
      const areas = C.areasValidas(v.areas), out = { atleta: { nome: aj.nome || v.atletaNome || "Atleta" }, areas, dados: {} };
      if (areas.includes("perfil")) out.dados.perfil = C.perfilCompartilhavel(aj.ficha, OPCOES);
      /* estratégias, partidas, treinos e diário entram nas próximas fatias; hoje só o que existe é entregue */
      if (areas.includes("temporada")) {
        const TOR = require("./_player-torneios"), snap = await refJogador(v.atletaUid).collection("torneios").get(), lista = [];
        snap.forEach((d) => lista.push(TOR.publicoCompartilhado(d.id, d.data(), hoje)));
        out.dados.torneios = TOR.ordenar(lista);
      }
      /* estrategias = preparação por partida; partidas sem os textos livres; diário só se o atleta marcou */
      const sub = async (nome) => { const l = []; (await refJogador(v.atletaUid).collection(nome).get()).forEach((d) => l.push({ id: d.id, ...d.data() })); return l; };
      if (areas.includes("estrategias")) out.dados.preparos = (await sub("preparos")).sort((x, y) => String(y.data || y.criadoEm).localeCompare(String(x.data || x.criadoEm)));
      if (areas.includes("partidas")) { const TOR = require("./_player-torneios"); out.dados.partidas = (await sub("partidas")).map((p) => TOR.partidaCompartilhada(p.id, p)).sort((x, y) => y.data.localeCompare(x.data)); }
      if (areas.includes("diario")) out.dados.diario = (await sub("diario")).sort((x, y) => String(y.data).localeCompare(String(x.data)));
      out.emBreve = areas.filter((a) => a === "treinos");
      return resposta(200, out);
    }

    if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });
    let body;
    try { body = JSON.parse(event.body || "{}"); } catch (e) { throw new ErroPublico(400, "Pedido inválido."); }
    const jog = await dadosJogador(uid), c = comp(jog);

    if (body.acao === "ativar") {
      if (!C.PAPEIS.includes(body.papel)) throw new ErroPublico(400, "Escolha um papel.");
      if (c.papel && c.papel !== body.papel) {
        const a = await db().collection("vinculos").where("atletaUid", "==", uid).get(), b = await db().collection("vinculos").where("pessoaUid", "==", uid).get();
        const abertos = a.docs.concat(b.docs).some((d) => ["convite", "aguardando", "ativo"].includes(d.data().status));
        if (abertos) throw new ErroPublico(409, "Encerre os vínculos e convites atuais antes de mudar de papel.");
      }
      const novo = { papel: body.papel, ativadoEm: c.ativadoEm || agoraISO() };
      if (body.papel === "atleta") {
        const idade = C.idadeEm(body.nascimento, hoje);
        if (idade === null) throw new ErroPublico(400, "Informe uma data de nascimento válida.");
        novo.nascimento = body.nascimento;
      }
      await refJogador(uid).set({ competicao: novo }, { merge: true });
      return resposta(200, { ok: true });
    }

    if (!c.papel) throw new ErroPublico(409, "Escolha o seu papel na Competição primeiro.");

    if (body.acao === "convidar") {
      if (c.papel !== "atleta") throw new ErroPublico(403, "Só o atleta convida.");
      if (!C.TIPOS.includes(body.tipo)) throw new ErroPublico(400, "Escolha responsável ou treinador.");
      const menor = C.ehMenor(c.nascimento, hoje);
      if (body.tipo === "treinador" && menor && !(await responsaveisAtivos(uid)).length) {
        throw new ErroPublico(409, "Como atleta menor de idade, vincule primeiro um responsável. Ele aprova o treinador.");
      }
      const abertos = (await db().collection("vinculos").where("atletaUid", "==", uid).where("status", "==", "convite").get()).docs.filter((d) => !C.conviteVencido(d.data(), hoje));
      if (abertos.length >= C.MAX_CONVITES_ABERTOS) throw new ErroPublico(409, "Você já tem " + C.MAX_CONVITES_ABERTOS + " convites abertos. Cancele um ou espere vencer.");
      const areas = body.areas === undefined ? C.AREAS_PADRAO.slice() : C.areasValidas(body.areas);
      if (!areas.length) throw new ErroPublico(400, "Escolha pelo menos uma área para compartilhar.");
      let codigo = "";
      for (let i = 0; i < 5; i++) {
        codigo = C.gerarCodigo();
        if ((await db().collection("vinculos").where("codigo", "==", codigo).limit(1).get()).empty) break;
        codigo = "";
      }
      if (!codigo) throw new ErroPublico(500, "Não foi possível gerar o código agora. Tente de novo.");
      const v = {
        atletaUid: uid, atletaNome: jog.nome || usuario.name || "Atleta", tipo: body.tipo, status: "convite", areas, codigo,
        criadoEm: agoraISO(), expiraEm: C.somarDias(hoje, C.VALIDADE_CONVITE_DIAS), pessoaUid: null, historico: [],
      };
      v.historico = evento(v, uid, "convite criado");
      const ref = await db().collection("vinculos").add(v);
      return resposta(200, { ok: true, id: ref.id, codigo, expiraEm: v.expiraEm });
    }

    if (body.acao === "aceitarCodigo") {
      if (c.papel === "atleta") throw new ErroPublico(403, "Use o código na conta do responsável ou do treinador.");
      /* tentativas erradas por dia: o código tem 40 bits, mas ninguém precisa testar à força */
      const t = c.tentativas && c.tentativas.dia === hoje ? c.tentativas.n || 0 : 0;
      if (t >= C.MAX_TENTATIVAS_DIA) throw new ErroPublico(429, "Muitas tentativas hoje. Tente de novo amanhã ou peça um código novo.");
      const cod = C.normalizarCodigo(body.codigo);
      const falha = async () => { await refJogador(uid).set({ competicao: { tentativas: { dia: hoje, n: t + 1 } } }, { merge: true }); throw new ErroPublico(404, "Código inválido ou vencido. Confira com o atleta."); };
      if (cod.length !== 8) await falha();
      const q = await db().collection("vinculos").where("codigo", "==", cod).limit(1).get();
      if (q.empty) await falha();
      const doc = q.docs[0], v = doc.data();
      if (v.status !== "convite" || C.conviteVencido(v, hoje)) await falha();
      if (v.atletaUid === uid) throw new ErroPublico(400, "Você não pode se vincular a você mesmo.");
      if (v.tipo !== c.papel) throw new ErroPublico(409, "Este código é para " + (v.tipo === "responsavel" ? "um responsável" : "um treinador") + ". Seu papel é " + (c.papel === "responsavel" ? "responsável" : "treinador") + ".");
      await doc.ref.update({ status: "aguardando", pessoaUid: uid, pessoaNome: jog.nome || usuario.name || "Pessoa", pessoaEmail: usuario.email || null, aceitoEm: agoraISO(), historico: evento(v, uid, "código usado, aguardando aprovação") });
      return resposta(200, { ok: true, atleta: v.atletaNome || "Atleta" });
    }

    if (body.acao === "decidir") {
      const { ref, v } = await carregarVinculo(body.id);
      const menor = await menorDoAtleta(v.atletaUid);
      const ok = C.podeDecidir(v, uid, menor, await responsaveisAtivos(v.atletaUid));
      if (!ok.ok) throw new ErroPublico(403, ok.motivo);
      const aprovar = body.aprovar === true;
      await ref.update({ status: aprovar ? "ativo" : "recusado", decididoEm: agoraISO(), decididoPor: uid, historico: evento(v, uid, aprovar ? "aprovado" : "recusado") });
      return resposta(200, { ok: true });
    }

    if (body.acao === "areas") {
      const { ref, v } = await carregarVinculo(body.id);
      const menor = await menorDoAtleta(v.atletaUid);
      if (!C.podeEditarAreas(v, uid, menor, await responsaveisAtivos(v.atletaUid))) throw new ErroPublico(403, "Você não pode mudar o que é compartilhado neste vínculo.");
      if (!["convite", "aguardando", "ativo"].includes(v.status)) throw new ErroPublico(409, "Este vínculo já foi encerrado.");
      const areas = C.areasValidas(body.areas);
      if (!areas.length) throw new ErroPublico(400, "Deixe pelo menos uma área compartilhada ou revogue o vínculo.");
      await ref.update({ areas, historico: evento(v, uid, "áreas: " + areas.join(", ")) });
      return resposta(200, { ok: true });
    }

    if (body.acao === "revogar") {
      const { ref, v } = await carregarVinculo(body.id);
      const menor = await menorDoAtleta(v.atletaUid);
      if (!C.podeRevogar(v, uid, menor, await responsaveisAtivos(v.atletaUid))) throw new ErroPublico(403, "Você não pode encerrar este vínculo.");
      if (!["convite", "aguardando", "ativo"].includes(v.status)) throw new ErroPublico(409, "Este vínculo já foi encerrado.");
      await ref.update({ status: v.status === "convite" ? "cancelado" : "revogado", encerradoEm: agoraISO(), encerradoPor: uid, historico: evento(v, uid, "encerrado") });
      if (v.tipo === "responsavel") await encerrarTreinadoresSeMenorSemResponsavel(v.atletaUid, uid);
      return resposta(200, { ok: true });
    }

    throw new ErroPublico(400, "Ação desconhecida.");
  } catch (e) {
    if (e instanceof ErroPublico) return resposta(e.status, { erro: e.message });
    console.error("player-competicao:", e);
    return resposta(500, { erro: "Não foi possível concluir agora. Tente de novo em instantes." });
  }
};
