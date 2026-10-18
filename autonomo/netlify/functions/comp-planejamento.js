/* QuadraLab Competição — Meu planejamento (temporada, próximas 4 semanas e esta semana).

   Atleta (pelo uid do token):
   GET                              → vigente, propostas, histórico, rotina, compromissos, semana atual, registros e se o calendário mudou
   POST { acao: "salvarRotina", ...rotina }
   POST { acao: "salvarCompromisso", id?, tipo, titulo, inicio, fim?, obs? } · { acao: "excluirCompromisso", id }
   POST { acao: "gerar" }           → nova sugestão da plataforma (proposta de ajuste quando já existe um plano aprovado)
   POST { acao: "editar", baseId, conteudo } → ajuste do atleta (nova versão, sem revisão profissional)
   POST { acao: "enviar", id } · { acao: "retirar", id } · { acao: "descartar", id }
   POST { acao: "registrar", data, atividadeId?, versaoId?, titulo?, feito, esforco?, recuperacao?, obs? } · { acao: "excluirRegistro", id }

   Treinador/responsável (vínculo ativo com a área "planejamento"):
   GET ?ver={vinculoId}             → versões e registros do atleta
   POST { acao: "treinadorSalvar", vinculoId, baseId, conteudo }  → versão em revisão assinada pelo treinador
   POST { acao: "aprovar", vinculoId, id }                        → aprova (só treinador); a aprovada anterior vira "substituída"

   Nada aqui substitui um plano aprovado sem a aprovação de um treinador: mudanças no calendário só criam PROPOSTA. */
const { admin, ErroPublico, resposta, usuarioDoPedido, refJogador } = require("./_player");
const P = require("./_comp-planejamento");
const C = require("./_player-competicao");
const T = require("./_player-torneios");
const PART = require("./_player-partidas");

const db = () => admin.firestore();
const agoraISO = () => new Date().toISOString();
const hojeBR = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const ID_DOC = /^[A-Za-z0-9_-]{8,60}$/;
const hist = (v, por, acao) => [...((v && v.historico) || []).slice(-30), { em: agoraISO(), por, acao }];
const limpo = (o) => JSON.parse(JSON.stringify(o)); // o Firestore recusa undefined

async function listar(ref, nome) { const o = []; (await ref.collection(nome).get()).forEach((d) => o.push({ id: d.id, ...d.data() })); return o; }

async function treinadoresAtivos(uid) {
  const s = await db().collection("vinculos").where("atletaUid", "==", uid).where("tipo", "==", "treinador").where("status", "==", "ativo").get();
  return s.docs.map((d) => ({ id: d.id, nome: d.data().pessoaNome || "Treinador", pessoaUid: d.data().pessoaUid, areas: C.areasValidas(d.data().areas) }));
}

/* tudo o que a sugestão considera, lido do próprio atleta */
async function contexto(uid, jog, hoje) {
  const ref = refJogador(uid), comp = jog.competicao || {};
  const torneios = (await listar(ref, "torneios")).map((t) => T.publicoTorneio(t.id, t, hoje));
  const compromissos = (await listar(ref, "compCompromissos")).sort((a, b) => a.inicio.localeCompare(b.inicio));
  const rotina = comp.rotina || null;
  const partidas = (await listar(ref, "partidas")).sort((a, b) => String(b.data).localeCompare(String(a.data))).slice(0, 5);
  const focos = (await listar(ref, "focos")).filter((f) => f.status !== "resolvido").sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));
  const devolutivas = (await listar(ref, "devolutivas")).sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm))).slice(0, 5);
  const corte = P.addDias(hoje, -14);
  const execucoes = (await listar(ref, "compExecucoes")).filter((x) => x.data >= corte);
  const trein = (await treinadoresAtivos(uid)).filter((t) => t.areas.includes("planejamento"));
  const idade = C.idadeEm(comp.nascimento, hoje);
  return { torneios, compromissos, rotina, partidas, focos, devolutivas, execucoes, trein, idade, ficha: jog.ficha || {} };
}
function entradaGeracao(cx, hoje) {
  return {
    hoje, torneios: cx.torneios, compromissos: cx.compromissos, rotina: cx.rotina, idade: cx.idade, nivel: cx.ficha.nivel || "", temTreinador: cx.trein.length > 0,
    registros: {
      aspectos: PART.ASPECTOS,
      partidasRecentes: cx.partidas.map((p) => ({ id: p.id, data: p.data, dificuldades: p.dificuldades || [], execucao: p.execucao || null, resultado: p.resultado })),
      focosAbertos: cx.focos.map((f) => ({ id: f.id, texto: f.texto })), devolutivas: cx.devolutivas.map((d) => ({ id: d.id, foco: d.foco || "", autorNome: d.autorNome })),
      execucoes: cx.execucoes.map((x) => ({ data: x.data, esforco: x.esforco, recuperacao: x.recuperacao })),
    },
  };
}

async function versoes(uid) { return (await listar(refJogador(uid), "compPlanejamentos")); }

async function gravarVersao(uid, dados) {
  const col = refJogador(uid).collection("compPlanejamentos"), todas = await versoes(uid);
  const n = Math.max(0, ...todas.map((v) => v.versao || 0)) + 1;
  if (todas.length >= P.MAX_VERSOES) {
    const velho = todas.filter((v) => v.status === "substituido").sort((a, b) => a.versao - b.versao)[0];
    if (!velho) throw new ErroPublico(409, "Muitas versões em andamento. Descarte ou aprove algumas antes de criar outra.");
    await col.doc(velho.id).delete();
  }
  const doc = limpo({ ...dados, versao: n, criadoEm: agoraISO() });
  const r = await col.add(doc);
  return { id: r.id, ...doc };
}

/* nova sugestão da plataforma; com plano aprovado vira proposta de ajuste (compara com a vigente e não a substitui) */
async function gerarSugestao(uid, jog, hoje, motivo) {
  const cx = await contexto(uid, jog, hoje), todas = await versoes(uid), vig = P.vigente(todas);
  if (todas.some((v) => v.status === "em_revisao" && v.origem !== "treinador")) throw new ErroPublico(409, "Há uma versão em revisão com o treinador. Aguarde a revisão ou retire o envio antes de gerar outra sugestão.");
  const base = P.snapshotBase(cx.torneios, cx.compromissos, cx.rotina, hoje), hash = P.hashBase(base);
  if (todas.some((v) => ["sugestao", "em_revisao"].includes(v.status) && v.base && v.base.hash === hash && v.origem === "plataforma")) throw new ErroPublico(409, "Já existe uma sugestão feita com o calendário e a rotina de agora.");
  const conteudo = P.gerarConteudo(entradaGeracao(cx, hoje));
  const dados = { status: "sugestao", origem: "plataforma", autorUid: null, autorNome: "Plataforma QuadraLab", base: { ...base, hash, geradoEm: agoraISO(), perfil: { idade: cx.idade, nivel: cx.ficha.nivel || "" } }, conteudo };
  if (vig && vig.status === "aprovado") {
    dados.substituiId = vig.id;
    dados.comparacao = P.compararVersoes(vig.conteudo, conteudo);
    dados.mudancas = vig.base ? P.mudancasCalendario(vig.base, base) : [];
  }
  /* sugestões antigas que ninguém revisou saem do caminho: continuam no histórico como substituídas */
  const nova = await gravarVersao(uid, { ...dados, historico: [{ em: agoraISO(), por: "plataforma", acao: motivo || "sugestão gerada" }] });
  for (const v of todas.filter((x) => x.status === "sugestao" && x.origem === "plataforma")) {
    await refJogador(uid).collection("compPlanejamentos").doc(v.id).update({ status: "substituido", substituidoPor: nova.id, historico: hist(v, "plataforma", "substituída por uma sugestão mais nova") });
  }
  return nova;
}

/* chamado quando o calendário muda (torneio, compromisso, rotina): cria a proposta de ajuste se há plano aprovado e ainda não existe proposta para este calendário */
async function proporAjusteSeNecessario(uid) {
  try {
    const hoje = hojeBR(), jog = (await refJogador(uid).get()).data() || {};
    if (!jog.competicao || jog.competicao.papel !== "atleta") return null;
    const todas = await versoes(uid), vig = P.vigente(todas);
    if (!vig || vig.status !== "aprovado" || !vig.base) return null;
    const cx = await contexto(uid, jog, hoje), hash = P.hashBase(P.snapshotBase(cx.torneios, cx.compromissos, cx.rotina, hoje));
    if (hash === vig.base.hash) return null;
    return await gerarSugestao(uid, jog, hoje, "proposta de ajuste: o calendário mudou");
  } catch (e) {
    if (!(e instanceof ErroPublico)) console.error("comp-planejamento (proposta):", e && e.message);
    return null;
  }
}

function resumoVersao(v) { return { id: v.id, versao: v.versao, status: v.status, rotulo: P.rotuloStatus(v), origem: v.origem, autorNome: v.autorNome || "", criadoEm: v.criadoEm, aprovadoEm: v.aprovadoEm || null, aprovadoPorNome: v.aprovadoPorNome || null }; }

function semanaAtual(vig, hoje) {
  if (!vig) return null;
  return ((vig.conteudo || {}).semanas || []).find((s) => s.inicio <= hoje && hoje <= s.fim) || null;
}

async function vinculoDoTreinador(uid, id) {
  if (!/^[A-Za-z0-9]{10,40}$/.test(String(id || ""))) throw new ErroPublico(400, "Vínculo inválido.");
  const s = await db().collection("vinculos").doc(id).get();
  const v = s.exists ? s.data() : null;
  if (!v || v.pessoaUid !== uid || v.status !== "ativo") throw new ErroPublico(404, "Vínculo não encontrado.");
  if (!C.areasValidas(v.areas).includes("planejamento")) throw new ErroPublico(403, "O atleta não compartilhou o planejamento com você. Peça para ele incluir a área “Meu planejamento” no vínculo.");
  return v;
}

exports.proporAjusteSeNecessario = proporAjusteSeNecessario;
exports.handler = async function (event) {
  try {
    const usuario = await usuarioDoPedido(event), uid = usuario.uid, hoje = hojeBR();
    const ref = refJogador(uid), jog = (await ref.get()).data() || {}, comp = jog.competicao || {};
    const q = event.queryStringParameters || {};

    /* ── pessoa vinculada lendo o plano do atleta ── */
    if (event.httpMethod === "GET" && q.ver) {
      const v = await vinculoDoTreinador(uid, q.ver);
      const aj = (await refJogador(v.atletaUid).get()).data() || {};
      const todas = (await versoes(v.atletaUid)).sort((a, b) => b.versao - a.versao), vig = P.vigente(todas);
      const exec = (await listar(refJogador(v.atletaUid), "compExecucoes")).sort((a, b) => String(b.data).localeCompare(String(a.data))).slice(0, 60);
      return resposta(200, {
        atleta: { nome: aj.nome || v.atletaNome || "Atleta" }, hoje, podeEditar: v.tipo === "treinador", tipo: v.tipo,
        vigente: vig ? P.publicoVersao(vig.id, vig) : null, versoes: todas.map((x) => P.publicoVersao(x.id, x)), execucoes: exec,
        semana: semanaAtual(vig, hoje),
        focos: C.areasValidas(v.areas).includes("treinos") ? (await listar(refJogador(v.atletaUid), "focos")).filter((f) => f.status !== "resolvido").map((f) => ({ id: f.id, texto: f.texto, origemRotulo: f.origemRotulo || "", status: f.status })) : [],
      });
    }

    let body = {};
    if (event.httpMethod === "POST") { try { body = JSON.parse(event.body || "{}"); } catch (e) { throw new ErroPublico(400, "Pedido inválido."); } }
    const acaoTreinador = body.acao === "treinadorSalvar" || body.acao === "aprovar";
    if (comp.papel !== "atleta" && !acaoTreinador) throw new ErroPublico(403, "O planejamento é do atleta. Ative a Competição como atleta.");

    if (event.httpMethod === "GET") {
      const cx = await contexto(uid, jog, hoje), todas = (await versoes(uid)).sort((a, b) => b.versao - a.versao), vig = P.vigente(todas);
      const base = P.snapshotBase(cx.torneios, cx.compromissos, cx.rotina, hoje), hash = P.hashBase(base);
      const propostas = P.propostasAbertas(todas, vig);
      const execucoes = (await listar(ref, "compExecucoes")).sort((a, b) => String(b.data).localeCompare(String(a.data)) || String(b.criadoEm).localeCompare(String(a.criadoEm))).slice(0, 80);
      const mudou = !!(vig && vig.status === "aprovado" && vig.base && vig.base.hash !== hash);
      return resposta(200, {
        hoje, menor: C.ehMenor(comp.nascimento, hoje), responsaveis: (await db().collection("vinculos").where("atletaUid", "==", uid).where("tipo", "==", "responsavel").where("status", "==", "ativo").get()).docs.length,
        focos: cx.focos.map((f) => ({ id: f.id, texto: f.texto, origemRotulo: f.origemRotulo || "" })), temTreinador: cx.trein.length > 0, treinadores: cx.trein.map((t) => ({ id: t.id, nome: t.nome })),
        treinadoresSemArea: (await treinadoresAtivos(uid)).filter((t) => !t.areas.includes("planejamento")).map((t) => ({ id: t.id, nome: t.nome })),
        torneios: cx.torneios.filter((t) => t.fase !== "passado" && t.estado !== "desistiu").map((t) => ({ id: t.id, nome: t.nome, inicio: t.inicio, fim: t.fim, prioridade: t.prioridade || "", cidade: t.cidade || "", estado: t.estado })),
        compromissos: cx.compromissos, rotina: cx.rotina,
        vigente: vig ? P.publicoVersao(vig.id, vig) : null,
        propostas: propostas.map((x) => P.publicoVersao(x.id, x)),
        historico: todas.map(resumoVersao),
        mudou, motivosMudanca: mudou ? P.mudancasCalendario(vig.base, base) : [],
        semana: semanaAtual(vig, hoje), execucoes,
        rotulos: { prioridade: P.ROTULO_PRIORIDADE, compromisso: P.TIPOS_COMPROMISSO, parceiros: P.PARCEIROS, quadras: P.QUADRAS, origemFoco: P.ROTULO_ORIGEM_FOCO },
      });
    }
    if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });

    /* ── treinador ── */
    if (acaoTreinador) {
      const v = await vinculoDoTreinador(uid, body.vinculoId);
      if (v.tipo !== "treinador") throw new ErroPublico(403, "Só o treinador revisa e aprova o planejamento.");
      const atleta = v.atletaUid, col = refJogador(atleta).collection("compPlanejamentos");
      if (!ID_DOC.test(String(body.id || body.baseId || ""))) throw new ErroPublico(400, "Versão inválida.");
      const alvoId = String(body.id || body.baseId), snap = await col.doc(alvoId).get();
      if (!snap.exists) throw new ErroPublico(404, "Versão não encontrada.");
      const alvo = { id: alvoId, ...snap.data() };
      const todas = await versoes(atleta);
      const nomeTrein = jog.nome || usuario.name || "Treinador";

      if (body.acao === "treinadorSalvar") {
        if (alvo.status === "substituido") throw new ErroPublico(409, "Esta versão já foi substituída. Revise a versão mais recente.");
        const r = P.normalizarConteudo(body.conteudo || alvo.conteudo, alvo.conteudo);
        if (!r.ok) throw new ErroPublico(400, r.erro);
        const vig = P.vigente(todas);
        const nova = await gravarVersao(atleta, {
          status: "em_revisao", origem: "treinador", autorUid: uid, autorNome: nomeTrein, baseId: alvo.id, base: alvo.base || null, conteudo: r.conteudo,
          substituiId: vig && vig.status === "aprovado" ? vig.id : null, comparacao: vig && vig.status === "aprovado" ? P.compararVersoes(vig.conteudo, r.conteudo) : null,
          historico: [{ em: agoraISO(), por: uid, acao: "rascunho do treinador criado a partir da versão " + alvo.versao }],
        });
        for (const x of todas.filter((o) => o.status === "em_revisao" && (o.id === alvo.id ? alvo.origem !== "treinador" : o.origem === "treinador" && o.autorUid === uid))) {
          await col.doc(x.id).update({ status: "substituido", substituidoPor: nova.id, historico: hist(x, uid, "revisada: substituída pela versão " + nova.versao) });
        }
        return resposta(200, { ok: true, id: nova.id });
      }

      /* aprovar */
      if (alvo.status !== "em_revisao") throw new ErroPublico(409, "Só uma versão em revisão pode ser aprovada. Se a versão é uma sugestão, crie primeiro a versão de revisão.");
      let aprovada;
      const dadosAprov = { status: "aprovado", aprovadoPor: uid, aprovadoPorNome: nomeTrein, aprovadoEm: agoraISO() };
      if (alvo.origem === "treinador" && alvo.autorUid === uid) {
        await col.doc(alvo.id).update({ ...dadosAprov, historico: hist(alvo, uid, "aprovado pelo treinador") });
        aprovada = alvo.id;
      } else {
        const r = P.normalizarConteudo(alvo.conteudo, alvo.conteudo);
        const nova = await gravarVersao(atleta, { ...dadosAprov, origem: "treinador", autorUid: uid, autorNome: nomeTrein, baseId: alvo.id, base: alvo.base || null, conteudo: r.ok ? r.conteudo : alvo.conteudo, historico: [{ em: agoraISO(), por: uid, acao: "aprovado sem alterações a partir da versão " + alvo.versao }] });
        await col.doc(alvo.id).update({ status: "substituido", substituidoPor: nova.id, historico: hist(alvo, uid, "revisada e aprovada pelo treinador (nova versão " + nova.versao + ")") });
        aprovada = nova.id;
      }
      for (const x of todas.filter((o) => o.status === "aprovado" && o.id !== aprovada)) await col.doc(x.id).update({ status: "substituido", substituidoPor: aprovada, historico: hist(x, uid, "substituída por uma versão aprovada mais nova") });
      return resposta(200, { ok: true, id: aprovada });
    }

    /* ── atleta ── */
    if (body.acao === "salvarRotina") {
      const r = P.normalizarRotina(body);
      if (!r.ok) throw new ErroPublico(400, r.erro);
      await ref.set({ competicao: { rotina: r.dados } }, { merge: true });
      await proporAjusteSeNecessario(uid);
      return resposta(200, { ok: true });
    }
    if (body.acao === "salvarCompromisso") {
      const r = P.normalizarCompromisso(body, hoje);
      if (!r.ok) throw new ErroPublico(400, r.erro);
      const col = ref.collection("compCompromissos");
      if (body.id) {
        if (!ID_DOC.test(String(body.id))) throw new ErroPublico(400, "Compromisso inválido.");
        const s0 = await col.doc(body.id).get();
        if (!s0.exists) throw new ErroPublico(404, "Compromisso não encontrado.");
        await col.doc(body.id).set({ ...r.dados, criadoEm: s0.data().criadoEm, atualizadoEm: agoraISO() });
      } else {
        if ((await col.get()).docs.length >= P.MAX_COMPROMISSOS) throw new ErroPublico(409, "Limite de compromissos atingido. Exclua os mais antigos.");
        await col.add({ ...r.dados, criadoEm: agoraISO() });
      }
      await proporAjusteSeNecessario(uid);
      return resposta(200, { ok: true });
    }
    if (body.acao === "excluirCompromisso") {
      if (!ID_DOC.test(String(body.id || ""))) throw new ErroPublico(400, "Compromisso inválido.");
      const d = ref.collection("compCompromissos").doc(body.id);
      if (!(await d.get()).exists) throw new ErroPublico(404, "Compromisso não encontrado.");
      await d.delete();
      await proporAjusteSeNecessario(uid);
      return resposta(200, { ok: true });
    }
    if (body.acao === "gerar") {
      const n = await gerarSugestao(uid, jog, hoje, "sugestão gerada a pedido do atleta");
      return resposta(200, { ok: true, id: n.id });
    }
    if (body.acao === "editar") {
      if (!ID_DOC.test(String(body.baseId || ""))) throw new ErroPublico(400, "Versão inválida.");
      const col = ref.collection("compPlanejamentos"), s0 = await col.doc(body.baseId).get();
      if (!s0.exists) throw new ErroPublico(404, "Versão não encontrada.");
      const base = { id: body.baseId, ...s0.data() };
      if (base.status === "substituido") throw new ErroPublico(409, "Esta versão já foi substituída.");
      const r = P.normalizarConteudo(body.conteudo, base.conteudo);
      if (!r.ok) throw new ErroPublico(400, r.erro);
      const todas = await versoes(uid), vig = P.vigente(todas);
      const nova = await gravarVersao(uid, {
        status: "sugestao", origem: "atleta", autorUid: uid, autorNome: jog.nome || usuario.name || "Atleta", baseId: base.id, base: base.base || null, conteudo: r.conteudo,
        substituiId: vig && vig.status === "aprovado" ? vig.id : null, comparacao: vig && vig.status === "aprovado" ? P.compararVersoes(vig.conteudo, r.conteudo) : null,
        historico: [{ em: agoraISO(), por: uid, acao: "ajuste do atleta a partir da versão " + base.versao }],
      });
      /* o que o atleta editou substitui a própria sugestão anterior (nunca um plano aprovado nem uma versão em revisão) */
      if (base.status === "sugestao") await col.doc(base.id).update({ status: "substituido", substituidoPor: nova.id, historico: hist(base, uid, "substituída pelo ajuste do atleta") });
      return resposta(200, { ok: true, id: nova.id });
    }
    if (body.acao === "enviar" || body.acao === "retirar" || body.acao === "descartar") {
      if (!ID_DOC.test(String(body.id || ""))) throw new ErroPublico(400, "Versão inválida.");
      const col = ref.collection("compPlanejamentos"), s0 = await col.doc(body.id).get();
      if (!s0.exists) throw new ErroPublico(404, "Versão não encontrada.");
      const v = { id: body.id, ...s0.data() };
      if (body.acao === "enviar") {
        if (v.status !== "sugestao") throw new ErroPublico(409, "Só uma sugestão pode ser enviada para revisão.");
        const trein = (await treinadoresAtivos(uid)).filter((t) => t.areas.includes("planejamento"));
        if (!trein.length) throw new ErroPublico(409, "Para enviar à revisão é preciso ter um treinador vinculado e compartilhar com ele a área “Meu planejamento”.");
        await col.doc(v.id).update({ status: "em_revisao", enviadoEm: agoraISO(), historico: hist(v, uid, "enviada ao treinador para revisão") });
      } else if (body.acao === "retirar") {
        if (v.status !== "em_revisao" || v.origem === "treinador") throw new ErroPublico(409, "Só um envio seu ainda sem revisão pode ser retirado.");
        await col.doc(v.id).update({ status: "sugestao", historico: hist(v, uid, "envio retirado pelo atleta") });
      } else {
        if (v.status !== "sugestao") throw new ErroPublico(409, "Só uma sugestão sem revisão pode ser descartada.");
        await col.doc(v.id).update({ status: "substituido", historico: hist(v, uid, "descartada pelo atleta") });
      }
      return resposta(200, { ok: true });
    }
    if (body.acao === "registrar") {
      const r = P.normalizarExecucao(body, hoje);
      if (!r.ok) throw new ErroPublico(400, r.erro);
      const col = ref.collection("compExecucoes");
      if ((await col.get()).docs.length >= P.MAX_EXECUCOES) throw new ErroPublico(409, "Limite de registros atingido.");
      const id = r.dados.atividadeId && r.dados.versaoId ? (r.dados.versaoId + "_" + r.dados.atividadeId).slice(0, 100) : null;
      const doc = limpo({ ...r.dados, criadoEm: agoraISO() });
      if (id) await col.doc(id).set(doc); else await col.add(doc);
      return resposta(200, { ok: true });
    }
    if (body.acao === "excluirRegistro") {
      if (!ID_DOC.test(String(body.id || "")) && !/^[A-Za-z0-9_-]{8,120}$/.test(String(body.id || ""))) throw new ErroPublico(400, "Registro inválido.");
      const d = ref.collection("compExecucoes").doc(body.id);
      if (!(await d.get()).exists) throw new ErroPublico(404, "Registro não encontrado.");
      await d.delete();
      return resposta(200, { ok: true });
    }
    throw new ErroPublico(400, "Ação desconhecida.");
  } catch (e) {
    if (e instanceof ErroPublico) return resposta(e.status, { erro: e.message });
    console.error("comp-planejamento:", e && e.message);
    return resposta(500, { erro: "Não foi possível concluir agora. Tente de novo em instantes." });
  }
};
