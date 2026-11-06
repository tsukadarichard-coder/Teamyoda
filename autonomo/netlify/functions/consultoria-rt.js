/* QuadraLab Competição — Consultoria com Richard Tsukada (regras em _consultoria-rt.js).

   GET                  → as consultorias que eu acompanho (atleta, treinador ou responsável da equipe) e se sou o consultor
   GET ?painel=1        → consultor: atletas, etapa, pendências, próximos torneios e reuniões, última atualização
   GET ?id={id}         → a consultoria do jeito que o MEU papel pode ver (o servidor filtra; nada de esconder só na tela)

   POST { acao, id, ... } — permissões conferidas aqui:
     atleta e consultor ....... salvarEntrada · salvarPartidaDiag · registrarJogo · marcarAcao · convidarEquipe · incluirEquipe · removerEquipe
     responsável da equipe .... salvarEntrada (só os campos da família) · marcarAcao (ações do responsável)
     treinador da equipe ...... registrarTreino · sugerir · marcarAcao (ações do treinador)
     consultor ................ salvarDiagnostico · publicarDiagnostico · salvarPlano · enviarPlano · publicarPlano · responderSugestao
                                salvarAnalise · publicarAnalise · salvarRelatorio · publicarRelatorio · salvarReuniao · excluirReuniao
                                salvarNota · excluirNota · ia (devolve rascunho; nada é salvo nem publicado pela IA)
   A ativação, as datas do ciclo, a renovação e o encerramento ficam no painel do administrador (admin-consultoria-rt). */
const { admin, ErroPublico, resposta, usuarioDoPedido, refJogador } = require("./_player");
const R = require("./_consultoria-rt");
const C = require("./_player-competicao");
const PART = require("./_player-partidas");
const TOR = require("./_player-torneios");
const P = require("./_comp-planejamento");

const db = () => admin.firestore();
const agoraISO = () => new Date().toISOString();
const hojeBR = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const limpo = (o) => JSON.parse(JSON.stringify(o));
const ID = /^[A-Za-z0-9_-]{8,40}$/;
const col = () => db().collection("consultoriasRT");
const hist = (c, por, acao) => [...(c.historico || []).slice(-80), { em: agoraISO(), por, acao }];
async function listar(ref, nome) { const o = []; (await ref.collection(nome).get()).forEach((d) => o.push({ id: d.id, ...d.data() })); return o; }
const porData = (campo) => (a, b) => String(b[campo] || "").localeCompare(String(a[campo] || ""));

async function carregar(id) {
  if (!ID.test(String(id || ""))) throw new ErroPublico(400, "Consultoria inválida.");
  const ref = col().doc(id), s = await ref.get();
  if (!s.exists) throw new ErroPublico(404, "Consultoria não encontrada.");
  return { ref, c: s.data() };
}
/* o papel desta pessoa NESTA consultoria; null = sem acesso (responde 404 para não revelar que existe) */
async function papelEm(c, id, usuario) {
  if (R.ehConsultor(usuario.email)) return { papel: "consultor" };
  if (c.atletaUid === usuario.uid) return { papel: "atleta" };
  const s = await db().collection("vinculos").where("atletaUid", "==", c.atletaUid).where("pessoaUid", "==", usuario.uid).where("status", "==", "ativo").get();
  for (const d of s.docs) {
    const v = d.data();
    const incluido = (v.consultoriaRT === id || (c.equipe || []).includes(d.id)) && !(c.equipeRemovidos || []).includes(d.id);
    if (incluido && (v.tipo === "treinador" || v.tipo === "responsavel")) return { papel: v.tipo, vinculoId: d.id, vinculo: v };
  }
  return null;
}
async function exigirPapel(c, id, usuario, permitidos) {
  const p = await papelEm(c, id, usuario);
  if (!p) throw new ErroPublico(404, "Consultoria não encontrada.");
  if (permitidos && !permitidos.includes(p.papel)) throw new ErroPublico(403, "Esta ação não é do seu perfil.");
  return p;
}
function exigirAtiva(c, papel) { if (c.estado !== "ativa" && papel !== "consultor") throw new ErroPublico(409, c.estado === "encerrada" ? "Este acompanhamento foi encerrado. O histórico continua disponível para leitura." : "Este acompanhamento está pausado."); }

/* equipe: vínculos ATIVOS do atleta incluídos na consultoria; convites abertos feitos para ela */
async function equipeDe(c, id) {
  const s = await db().collection("vinculos").where("atletaUid", "==", c.atletaUid).get(), membros = [], candidatos = [], convites = [];
  s.forEach((d) => {
    const v = d.data(); if (v.tipo !== "treinador" && v.tipo !== "responsavel") return;
    const removido = (c.equipeRemovidos || []).includes(d.id), incluido = (v.consultoriaRT === id || (c.equipe || []).includes(d.id)) && !removido;
    if (v.status === "ativo") (incluido ? membros : candidatos).push({ vinculoId: d.id, tipo: v.tipo, nome: v.pessoaNome || "Pessoa", desde: v.decididoEm || v.aceitoEm || v.criadoEm || null, areas: v.areas || [] });
    else if (v.consultoriaRT === id && ["convite", "aguardando"].includes(v.status) && !C.conviteVencido(v, hojeBR())) convites.push({ vinculoId: d.id, tipo: v.tipo, status: v.status, codigo: v.status === "convite" ? v.codigo : null, expiraEm: v.expiraEm || null, pessoa: v.pessoaNome || null });
  });
  return { membros, candidatos, convites };
}

/* o que existe de fato para calcular etapa e pendências */
async function situacao(id, c, hoje) {
  const ref = col().doc(id);
  const [diags, planos, regs, anals, sugs] = await Promise.all([listar(ref, "diagnosticos"), listar(ref, "planos"), listar(ref, "registros"), listar(ref, "analises"), listar(ref, "sugestoes")]);
  const diagPublicado = diags.filter((d) => d.estado === "publicado").sort(porData("publicadoEm"))[0] || null;
  const diagRascunho = diags.find((d) => d.estado === "rascunho") || null;
  const vig = R.planoVigente(planos);
  const analisadas = new Set(anals.filter((a) => a.estado === "publicado").map((a) => a.partidaId));
  const jogosSemAnalise = regs.filter((r) => r.tipo === "posjogo" && r.video && !analisadas.has(r.partidaId)).length;
  return { hoje, diags, diagPublicado, diagRascunho, planos, planoVigente: vig, regs, anals, sugs, jogosSemAnalise, sugestoesAbertas: sugs.filter((s) => s.estado === "aberta").length };
}

async function visao(id, c, pp, usuario, hoje) {
  const papel = pp.papel, cons = papel === "consultor", ref = col().doc(id), refA = refJogador(c.atletaUid);
  const aj = (await refA.get()).data() || {}, comp = aj.competicao || {};
  const sx = await situacao(id, c, hoje);
  const areas = pp.vinculo ? C.areasValidas(pp.vinculo.areas) : C.AREAS;
  const veAreas = (a) => cons || papel === "atleta" || areas.includes(a);
  const out = {
    id, papel, servico: R.NOME_SERVICO, consultor: R.NOME_CONSULTOR, estado: c.estado, rotuloEstado: R.ESTADOS[c.estado] || c.estado, ciclo: R.cicloAtual(c), ciclos: c.ciclos || [],
    etapa: R.etapaDe(c, sx), atleta: { nome: aj.nome || c.atletaNome || "Atleta", idade: C.idadeEm(comp.nascimento, hoje), menor: C.ehMenor(comp.nascimento, hoje) }, hoje,
    atualizadoEm: c.atualizadoEm || c.criadoEm,
  };
  /* cadastro de entrada: completo para atleta e consultor; a família vê o objetivo e os campos dela; o treinador, o objetivo e a rotina */
  const e = c.entrada || {};
  if (cons || papel === "atleta") { out.entrada = e; out.rotina = comp.rotina || null; out.nascimento = comp.nascimento || null; }
  else if (papel === "responsavel") { out.entrada = { objetivo: e.objetivo || "", objetivoObs: e.objetivoObs || "" }; R.CAMPOS_FAMILIA.forEach((k) => { out.entrada[k] = e[k] || ""; }); }
  else out.entrada = { objetivo: e.objetivo || "", objetivoObs: e.objetivoObs || "", localTreino: e.localTreino || "" }, out.rotina = veAreas("planejamento") ? comp.rotina || null : null;
  out.entradaPronta = R.entradaPronta(e);
  /* partidas do diagnóstico: as marcações e observações de trabalho só o consultor vê */
  out.diagPartidas = (c.diagPartidas || R.partidasIniciais()).map((p) => (cons ? p : R.partidaDiagPublica(p)));
  /* diagnóstico */
  const pubs = sx.diags.filter((d) => d.estado === "publicado" || d.estado === "substituido").sort(porData("publicadoEm"));
  out.diagnostico = sx.diagPublicado && R.visivelPublicado(sx.diagPublicado, papel) ? sx.diagPublicado : null;
  if (cons) { out.diagRascunho = sx.diagRascunho; out.diagHistorico = pubs; }
  /* planos: publicados (vigente e anteriores) para todos da equipe; o treinador também vê a versão aberta para comentário; rascunhos só o consultor */
  const planos = sx.planos.sort((a, b) => b.versao - a.versao);
  out.planos = planos.filter((v) => cons || v.estado === "publicado" || v.estado === "substituido" || (papel === "treinador" && v.estado === "em_comentario"));
  out.planoVigente = sx.planoVigente;
  out.acoes = R.acoesDoPlano(sx.planoVigente, c.acoesStatus);
  /* jogos: as partidas do atleta (as mesmas do app); quem não é o atleta vê sem os textos livres e só com a área "partidas" */
  if (veAreas("partidas")) {
    const parts = (await listar(refA, "partidas")).sort(porData("data")).slice(0, 120);
    out.partidas = cons || papel === "atleta" ? parts.map((p) => ({ id: p.id, data: p.data, tipo: p.tipo, resultado: p.resultado, placar: p.placar || "", adversario: p.adversario || "", superficie: p.superficie || null, torneioId: p.torneioId || null, rodada: p.rodada || "", video: p.videoLink || "" })) : parts.map((p) => TOR.partidaCompartilhada(p.id, p));
  } else out.partidas = [];
  out.registros = sx.regs.filter((r) => R.podeVerRegistro(r, papel, usuario.uid)).sort(porData("em")).map((r) => ({ ...r, souAutor: r.autorUid === usuario.uid }));
  out.analises = sx.anals.filter((a) => R.visivelPublicado(a, papel)).sort(porData("atualizadoEm"));
  out.relatorios = (await listar(ref, "relatorios")).filter((r) => R.visivelPublicado(r, papel)).sort(porData("atualizadoEm"));
  out.reunioes = (c.reunioes || []).filter((m) => cons || (m.participantes || []).includes(papel)).sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
  if (cons) { out.sugestoes = sx.sugs.sort(porData("em")); out.notas = (await listar(ref, "notas")).sort(porData("em")); out.pendencias = R.pendencias(c, sx); out.historico = (c.historico || []).slice(-40).reverse(); }
  else if (papel === "treinador") out.sugestoes = sx.sugs.filter((s) => s.autorUid === usuario.uid).sort(porData("em"));
  /* calendário: torneios e compromissos do próprio app (não há agenda paralela) + reuniões, prazos das ações e a revisão */
  const cal = [];
  if (veAreas("temporada")) (await listar(refA, "torneios")).forEach((t) => cal.push({ tipo: "torneio", data: t.inicio, ate: t.fim || t.inicio, titulo: t.nome, detalhe: [t.cidade, TOR.ROTULO_ESTADO[t.estado]].filter(Boolean).join(" · "), ref: t.id }));
  if (veAreas("planejamento")) (await listar(refA, "compCompromissos")).forEach((x) => cal.push({ tipo: "compromisso", data: x.inicio, ate: x.fim || x.inicio, titulo: x.titulo, detalhe: P.TIPOS_COMPROMISSO[x.tipo] || "", ref: x.id }));
  out.reunioes.forEach((m) => cal.push({ tipo: "reuniao", data: m.data, ate: m.data, titulo: m.titulo, detalhe: m.hora || "", link: m.link || "", ref: m.id }));
  out.acoes.filter((a) => a.prazo && !a.feita).forEach((a) => cal.push({ tipo: "prazo", data: a.prazo, ate: a.prazo, titulo: a.texto, detalhe: R.RESPONSAVEIS_ACAO[a.responsavel] + " · " + a.prioridade, ref: a.id }));
  if (sx.planoVigente) cal.push({ tipo: "revisao", data: sx.planoVigente.conteudo.revisaoEm, ate: sx.planoVigente.conteudo.revisaoEm, titulo: "Revisão do plano", detalhe: "Plano versão " + sx.planoVigente.versao, ref: sx.planoVigente.id });
  out.calendario = cal.filter((x) => R.dataValida(x.data)).sort((a, b) => a.data.localeCompare(b.data));
  out.equipe = await equipeDe(c, id);
  if (!(cons || papel === "atleta")) { delete out.equipe.candidatos; delete out.equipe.convites; }
  out.torneios = veAreas("temporada") ? (await listar(refA, "torneios")).map((t) => ({ id: t.id, nome: t.nome, inicio: t.inicio })).sort((a, b) => String(b.inicio).localeCompare(String(a.inicio))) : [];
  return out;
}

/* resumo para a lista e para o painel do consultor */
async function resumo(id, c, papel, hoje) {
  const sx = await situacao(id, c, hoje), cic = R.cicloAtual(c);
  const datas = [c.atualizadoEm || c.criadoEm].concat(sx.regs.map((r) => r.em)).filter(Boolean).sort();
  const base = { id, atleta: c.atletaNome || "Atleta", estado: c.estado, rotuloEstado: R.ESTADOS[c.estado], etapa: R.etapaDe(c, sx), ciclo: cic, papel, ultimaAtualizacao: datas[datas.length - 1] || null };
  if (papel !== "consultor") return base;
  const refA = refJogador(c.atletaUid), lim = R.addDias(hoje, 30);
  const proximos = [];
  (await listar(refA, "torneios")).forEach((t) => { if (t.inicio && t.inicio >= hoje && t.inicio <= lim) proximos.push({ tipo: "torneio", data: t.inicio, titulo: t.nome }); });
  (c.reunioes || []).forEach((m) => { if (m.data >= hoje && m.data <= lim) proximos.push({ tipo: "reuniao", data: m.data, titulo: m.titulo + (m.hora ? " · " + m.hora : "") }); });
  proximos.sort((a, b) => a.data.localeCompare(b.data));
  return { ...base, pendencias: R.pendencias(c, sx), proximos: proximos.slice(0, 5) };
}

async function chamarIA(prompt) {
  if (!process.env.ANTHROPIC_API_KEY) throw new ErroPublico(503, "A organização por IA não está disponível agora. Continue pelo formulário: nada se perde.");
  const Anthropic = require("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 9000, maxRetries: 0 });
  let msg;
  try { msg = await client.messages.create({ model: "claude-haiku-4-5", max_tokens: 1400, messages: [{ role: "user", content: prompt }] }); }
  catch (e) { throw new ErroPublico(503, "A IA não respondeu a tempo. Tente de novo ou continue pelo formulário."); }
  const texto = (msg.content || []).map((b) => b.text || "").join("");
  const j = R.extrairJSON(texto);
  if (!j) throw new ErroPublico(502, "A IA devolveu algo que não deu para aproveitar. Continue pelo formulário.");
  return j;
}

exports.handler = async function (event) {
  try {
    const usuario = await usuarioDoPedido(event), uid = usuario.uid, hoje = hojeBR(), q = event.queryStringParameters || {};
    const souConsultor = R.ehConsultor(usuario.email);

    if (event.httpMethod === "GET") {
      if (q.painel) {
        if (!souConsultor) throw new ErroPublico(403, "Área do consultor.");
        const lista = [];
        for (const d of (await col().get()).docs) lista.push(await resumo(d.id, d.data(), "consultor", hoje));
        const ordem = { revisao: 0, diagnostico: 1, plano: 2, cadastro: 3, acompanhamento: 4, encerrada: 9 };
        lista.sort((a, b) => (a.estado === "ativa" ? 0 : 1) - (b.estado === "ativa" ? 0 : 1) || b.pendencias.length - a.pendencias.length || (ordem[a.etapa] - ordem[b.etapa]));
        return resposta(200, { souConsultor: true, hoje, etapas: R.ETAPAS, consultorias: lista });
      }
      if (q.id) {
        const { c } = await carregar(q.id), pp = await exigirPapel(c, q.id, usuario);
        return resposta(200, await visao(q.id, c, pp, usuario, hoje));
      }
      /* as que eu acompanho: como atleta e pelos vínculos ativos incluídos na equipe (um responsável pode ter vários atletas) */
      const minhas = [], vistos = new Set();
      for (const d of (await col().where("atletaUid", "==", uid).get()).docs) { vistos.add(d.id); minhas.push(await resumo(d.id, d.data(), "atleta", hoje)); }
      const vincs = await db().collection("vinculos").where("pessoaUid", "==", uid).where("status", "==", "ativo").get();
      for (const v of vincs.docs) {
        for (const d of (await col().where("atletaUid", "==", v.data().atletaUid).get()).docs) {
          if (vistos.has(d.id)) continue;
          const pp = await papelEm(d.data(), d.id, usuario);
          if (pp && pp.papel !== "consultor") { vistos.add(d.id); minhas.push(await resumo(d.id, d.data(), pp.papel, hoje)); }
        }
      }
      return resposta(200, { souConsultor, servico: R.NOME_SERVICO, consultorias: minhas });
    }

    if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });
    let b; try { b = JSON.parse(event.body || "{}"); } catch (e) { throw new ErroPublico(400, "Pedido inválido."); }
    const { ref, c } = await carregar(b.id), id = b.id;
    const quemNome = souConsultor ? R.NOME_CONSULTOR : (usuario.name || "Pessoa");
    const salvarC = async (mudanca, acao) => { await ref.set(limpo({ ...mudanca, atualizadoEm: agoraISO(), historico: hist(c, souConsultor ? "consultor" : uid, acao) }), { merge: true }); };

    /* ── cadastro de entrada ── */
    if (b.acao === "salvarEntrada") {
      const pp = await exigirPapel(c, id, usuario, ["consultor", "atleta", "responsavel"]); exigirAtiva(c, pp.papel);
      let nova = R.normalizarEntrada(b.entrada, c.entrada);
      if (pp.papel === "responsavel") { const ant = c.entrada || {}, so = {}; R.CAMPOS_FAMILIA.forEach((k) => { so[k] = nova[k]; }); nova = { ...ant, ...so }; }
      await salvarC({ entrada: { ...nova, salvoEm: agoraISO() } }, "cadastro de entrada salvo");
      /* rotina semanal: a mesma do "Meu planejamento" (não existe outra) */
      if (b.rotina && (pp.papel === "atleta" || pp.papel === "consultor")) {
        const r = P.normalizarRotina(b.rotina); if (!r.ok) throw new ErroPublico(400, r.erro);
        await refJogador(c.atletaUid).set({ competicao: { rotina: r.dados } }, { merge: true });
      }
      return resposta(200, { ok: true, pronta: R.entradaPronta(nova) });
    }

    /* ── partidas do diagnóstico: o atleta envia o material; o consultor marca, observa e conclui ── */
    if (b.acao === "salvarPartidaDiag") {
      const pp = await exigirPapel(c, id, usuario, ["consultor", "atleta"]); exigirAtiva(c, pp.papel);
      const n = Number(b.n); if (![1, 2, 3].includes(n)) throw new ErroPublico(400, "Escolha a partida 1, 2 ou 3.");
      const lista = (c.diagPartidas || R.partidasIniciais()).map((x) => ({ ...x }));
      const ant = lista[n - 1], refA = refJogador(c.atletaUid);
      const dados = { ...(b.dados || {}) };
      if (pp.papel !== "consultor") { delete dados.status; delete dados.marcacoes; delete dados.obs; }
      /* usar uma partida que já está no app (não duplica): copia data, adversário, placar e vídeo */
      if (b.partidaExistenteId) {
        if (!ID.test(String(b.partidaExistenteId))) throw new ErroPublico(400, "Partida inválida.");
        const s = await refA.collection("partidas").doc(b.partidaExistenteId).get(); if (!s.exists) throw new ErroPublico(404, "Partida não encontrada.");
        const p = s.data(); ant.partidaId = s.id;
        dados.data = dados.data || p.data; dados.adversario = dados.adversario || p.adversario || ""; dados.placar = dados.placar || p.placar || ""; dados.video = dados.video || p.videoLink || "";
        if (p.superficie && !dados.superficie) dados.superficie = p.superficie === "outra" ? "" : p.superficie;
      }
      const r = R.normalizarPartidaDiag(dados, ant, pp.papel); if (!r.ok) throw new ErroPublico(400, r.erro);
      const nova = r.dados;
      /* partida nova com data e resultado: entra nas partidas do app (uma só vez) e fica ligada aqui */
      if (!nova.partidaId && b.resultado && nova.data) {
        let p; try { p = PART.normalizarPartida({ data: nova.data, resultado: b.resultado, tipo: "competicao", adversario: nova.adversario, placar: nova.placar, superficie: nova.superficie === "indoor" ? "outra" : nova.superficie, videoLink: nova.video, obs: nova.contexto.slice(0, 500) }, hoje); }
        catch (e) { throw new ErroPublico(400, e.message); }
        const nr = await refA.collection("partidas").add(limpo({ ...p, criadoEm: agoraISO(), origem: "consultoria" }));
        nova.partidaId = nr.id;
      } else if (nova.partidaId && nova.video && nova.video !== ant.video) {
        await refA.collection("partidas").doc(nova.partidaId).set({ videoLink: nova.video }, { merge: true }); // o vídeo fica também na partida do app
      }
      lista[n - 1] = nova;
      await salvarC({ diagPartidas: lista }, "partida " + n + " do diagnóstico: " + R.STATUS_PARTIDA[nova.status]);
      return resposta(200, { ok: true, partida: pp.papel === "consultor" ? nova : R.partidaDiagPublica(nova) });
    }

    /* ── jogos e relato pós-jogo do atleta (a partida é a mesma do app) ── */
    if (b.acao === "registrarJogo") {
      const pp = await exigirPapel(c, id, usuario, ["atleta"]); exigirAtiva(c, pp.papel);
      const refA = refJogador(c.atletaUid);
      let partidaId = b.partidaId || null, video = "";
      if (partidaId) {
        if (!ID.test(String(partidaId))) throw new ErroPublico(400, "Partida inválida.");
        const s = await refA.collection("partidas").doc(partidaId).get(); if (!s.exists) throw new ErroPublico(404, "Partida não encontrada.");
        video = s.data().videoLink || "";
      } else {
        let p; try { p = PART.normalizarPartida({ ...(b.partida || {}), tipo: (b.partida && b.partida.tipo) || "competicao" }, hoje); } catch (e) { throw new ErroPublico(400, e.message); }
        if (p.torneioId && !(await refA.collection("torneios").doc(p.torneioId).get()).exists) p.torneioId = null;
        const nr = await refA.collection("partidas").add(limpo({ ...p, criadoEm: agoraISO(), origem: "consultoria" }));
        partidaId = nr.id; video = p.videoLink || "";
      }
      let pos = null;
      if (b.posjogo && (b.posjogo.aplicou || b.posjogo.dificuldade || b.posjogo.obs)) { const r = R.normalizarPosJogo(b.posjogo); if (!r.ok) throw new ErroPublico(400, r.erro); pos = r.dados; }
      if (pos) await ref.collection("registros").add(limpo({ tipo: "posjogo", partidaId, video, ...pos, autorUid: uid, autorPapel: "atleta", autorNome: quemNome, visivelPara: R.normalizarVisivel(b.visivelPara || R.VER_PADRAO.atleta, "atleta"), em: agoraISO() }));
      await salvarC({}, "jogo registrado");
      return resposta(200, { ok: true, partidaId });
    }

    /* ── trabalho do treinador ── */
    if (b.acao === "registrarTreino") {
      const pp = await exigirPapel(c, id, usuario, ["treinador"]); exigirAtiva(c, pp.papel);
      const r = R.normalizarTreino(b, hoje); if (!r.ok) throw new ErroPublico(400, r.erro);
      await ref.collection("registros").add(limpo({ tipo: "treino", ...r.dados, autorUid: uid, autorPapel: "treinador", autorNome: quemNome, visivelPara: R.normalizarVisivel(b.visivelPara || R.VER_PADRAO.treinador, "treinador"), em: agoraISO() }));
      await salvarC({}, "registro de treino");
      return resposta(200, { ok: true });
    }
    if (b.acao === "sugerir") {
      const pp = await exigirPapel(c, id, usuario, ["treinador"]); exigirAtiva(c, pp.papel);
      const texto = R.txt(b.texto, 1500); if (!texto) throw new ErroPublico(400, "Escreva a sugestão.");
      let planoId = null;
      if (b.planoId) { const s = await ref.collection("planos").doc(String(b.planoId)).get(); if (!s.exists || !["em_comentario", "publicado"].includes(s.data().estado)) throw new ErroPublico(404, "Versão do plano não encontrada."); planoId = s.id; }
      await ref.collection("sugestoes").add(limpo({ texto, planoId, autorUid: uid, autorNome: quemNome, em: agoraISO(), estado: "aberta" }));
      await salvarC({}, "sugestão do treinador");
      return resposta(200, { ok: true });
    }

    /* ── ações do plano: quem é responsável marca; o consultor marca qualquer uma ── */
    if (b.acao === "marcarAcao") {
      const pp = await exigirPapel(c, id, usuario); exigirAtiva(c, pp.papel);
      const vig = R.planoVigente(await listar(ref, "planos")); if (!vig) throw new ErroPublico(409, "Ainda não há plano publicado.");
      const acao = R.acoesDoPlano(vig, c.acoesStatus).find((a) => a.id === b.acaoId); if (!acao) throw new ErroPublico(404, "Ação não encontrada.");
      if (pp.papel !== "consultor" && acao.responsavel !== pp.papel) throw new ErroPublico(403, "Esta ação é de outra pessoa da equipe.");
      await salvarC({ acoesStatus: { ...(c.acoesStatus || {}), [acao.id]: { feita: !!b.feita, em: agoraISO(), por: pp.papel } } }, (b.feita ? "ação concluída: " : "ação reaberta: ") + acao.texto.slice(0, 60));
      return resposta(200, { ok: true });
    }

    /* ── equipe (vínculos do app): incluir, remover, convidar ── */
    if (b.acao === "incluirEquipe" || b.acao === "removerEquipe") {
      const pp = await exigirPapel(c, id, usuario, ["consultor", "atleta", "responsavel"]);
      const vid = String(b.vinculoId || ""); if (!ID.test(vid)) throw new ErroPublico(400, "Vínculo inválido.");
      const s = await db().collection("vinculos").doc(vid).get(); if (!s.exists || s.data().atletaUid !== c.atletaUid) throw new ErroPublico(404, "Vínculo não encontrado.");
      if (pp.papel === "responsavel" && s.data().tipo !== "treinador") throw new ErroPublico(403, "O responsável inclui ou retira o treinador; os responsáveis são decididos pelo atleta.");
      let eq = (c.equipe || []).filter((x) => x !== vid), rem = (c.equipeRemovidos || []).filter((x) => x !== vid);
      if (b.acao === "incluirEquipe") { if (s.data().status !== "ativo") throw new ErroPublico(409, "O vínculo ainda não está ativo."); eq.push(vid); }
      else rem.push(vid);
      await salvarC({ equipe: eq, equipeRemovidos: rem }, (b.acao === "incluirEquipe" ? "incluído na equipe: " : "retirado da equipe: ") + (s.data().pessoaNome || s.data().tipo));
      return resposta(200, { ok: true });
    }
    if (b.acao === "convidarEquipe") {
      const pp = await exigirPapel(c, id, usuario, ["consultor", "atleta"]); exigirAtiva(c, pp.papel);
      if (!C.TIPOS.includes(b.tipo)) throw new ErroPublico(400, "Escolha treinador ou responsável.");
      const aj = (await refJogador(c.atletaUid).get()).data() || {}, comp = aj.competicao || {}, menor = C.ehMenor(comp.nascimento, hoje);
      const todos = (await db().collection("vinculos").where("atletaUid", "==", c.atletaUid).get()).docs.map((d) => d.data()).filter((x) => ["convite", "aguardando", "ativo"].includes(x.status) && !C.conviteVencido(x, hoje));
      if (b.tipo === "treinador" && menor && !todos.some((x) => x.tipo === "responsavel" && x.status === "ativo")) throw new ErroPublico(409, "Como o atleta é menor de idade, vincule primeiro um responsável. Ele aprova o treinador.");
      if (b.tipo === "responsavel" && todos.filter((x) => x.tipo === "responsavel").length >= C.MAX_RESPONSAVEIS) throw new ErroPublico(409, "O atleta já tem " + C.MAX_RESPONSAVEIS + " responsáveis vinculados ou convidados.");
      if (todos.filter((x) => x.status === "convite").length >= C.MAX_CONVITES_ABERTOS) throw new ErroPublico(409, "Há " + C.MAX_CONVITES_ABERTOS + " convites abertos. Espere vencer ou cancele um.");
      let codigo = "";
      for (let i = 0; i < 5 && !codigo; i++) { const cand = C.gerarCodigo(); if ((await db().collection("vinculos").where("codigo", "==", cand).limit(1).get()).empty) codigo = cand; }
      if (!codigo) throw new ErroPublico(500, "Não foi possível gerar o código agora. Tente de novo.");
      const v = { atletaUid: c.atletaUid, atletaNome: aj.nome || c.atletaNome || "Atleta", tipo: b.tipo, ...(b.tipo === "responsavel" ? { parentesco: C.PARENTESCOS[b.parentesco] ? b.parentesco : "outro" } : {}), status: "convite", areas: C.AREAS_PADRAO.slice(), codigo,
        criadoEm: agoraISO(), expiraEm: C.somarDias(hoje, C.VALIDADE_CONVITE_DIAS), pessoaUid: null, consultoriaRT: id, historico: [{ em: agoraISO(), por: pp.papel === "consultor" ? "consultor" : uid, acao: "convite criado pela consultoria" }] };
      const nr = await db().collection("vinculos").add(v);
      await salvarC({}, "convite de " + b.tipo);
      return resposta(200, { ok: true, vinculoId: nr.id, codigo, expiraEm: v.expiraEm, aprova: b.tipo === "treinador" && menor ? "o responsável" : "o atleta" });
    }

    /* ── daqui em diante: só o consultor ── */
    if (!souConsultor) throw new ErroPublico((await papelEm(c, id, usuario)) ? 403 : 404, (await papelEm(c, id, usuario)) ? "Esta ação é do consultor." : "Consultoria não encontrada.");

    if (b.acao === "salvarDiagnostico" || b.acao === "publicarDiagnostico") {
      const conteudo = R.normalizarDiagnostico(b.conteudo || {});
      const diags = await listar(ref, "diagnosticos"); let rasc = diags.find((d) => d.estado === "rascunho");
      const refD = rasc ? ref.collection("diagnosticos").doc(rasc.id) : ref.collection("diagnosticos").doc(R.novoId());
      if (b.acao === "salvarDiagnostico") {
        await refD.set(limpo({ estado: "rascunho", ...conteudo, versao: (diags.length ? Math.max(...diags.map((d) => d.versao || 1)) : 0) + (rasc ? 0 : 1), atualizadoEm: agoraISO() }), { merge: false });
        await salvarC({}, "diagnóstico salvo como rascunho");
        return resposta(200, { ok: true });
      }
      const erros = R.errosPublicarDiagnostico(conteudo, c.diagPartidas); if (erros.length) return resposta(422, { erro: erros[0], erros });
      for (const d of diags.filter((x) => x.estado === "publicado")) await ref.collection("diagnosticos").doc(d.id).set({ estado: "substituido" }, { merge: true });
      await refD.set(limpo({ ...conteudo, estado: "publicado", versao: rasc ? rasc.versao : (diags.length ? Math.max(...diags.map((d) => d.versao || 1)) + 1 : 1), destinatarios: R.normalizarDestinos(b.destinatarios || ["atleta", "treinador", "responsavel"]), publicadoEm: agoraISO(), atualizadoEm: agoraISO() }));
      await salvarC({}, "diagnóstico publicado");
      return resposta(200, { ok: true });
    }

    if (b.acao === "salvarPlano") {
      const conteudo = R.normalizarPlano(b.conteudo || {}, hoje), planos = await listar(ref, "planos");
      const aberto = planos.find((v) => v.estado === "rascunho" || v.estado === "em_comentario");
      if (aberto) { await ref.collection("planos").doc(aberto.id).set(limpo({ conteudo, atualizadoEm: agoraISO() }), { merge: true }); await salvarC({}, "plano v" + aberto.versao + " salvo"); return resposta(200, { ok: true, planoId: aberto.id }); }
      const versao = (planos.length ? Math.max(...planos.map((v) => v.versao)) : 0) + 1, novo = ref.collection("planos").doc(R.novoId());
      await novo.set(limpo({ versao, estado: "rascunho", conteudo, criadoEm: agoraISO(), atualizadoEm: agoraISO() }));
      await salvarC({}, "plano v" + versao + " criado");
      return resposta(200, { ok: true, planoId: novo.id });
    }
    if (b.acao === "enviarPlano" || b.acao === "publicarPlano") {
      const s = await ref.collection("planos").doc(String(b.planoId || "x")).get();
      if (!s.exists || !["rascunho", "em_comentario"].includes(s.data().estado)) throw new ErroPublico(404, "Versão aberta do plano não encontrada.");
      const v = s.data();
      if (b.acao === "enviarPlano") { await s.ref.set({ estado: "em_comentario", enviadoEm: agoraISO() }, { merge: true }); await salvarC({}, "plano v" + v.versao + " enviado ao treinador"); return resposta(200, { ok: true }); }
      const erros = R.errosPublicarPlano(v.conteudo); if (erros.length) return resposta(422, { erro: erros[0], erros });
      for (const x of (await listar(ref, "planos")).filter((x) => x.estado === "publicado")) await ref.collection("planos").doc(x.id).set({ estado: "substituido", substituidoEm: agoraISO() }, { merge: true });
      await s.ref.set({ estado: "publicado", publicadoEm: agoraISO() }, { merge: true });
      await salvarC({}, "plano v" + v.versao + " publicado");
      return resposta(200, { ok: true });
    }
    if (b.acao === "responderSugestao") {
      const s = await ref.collection("sugestoes").doc(String(b.sugestaoId || "x")).get(); if (!s.exists) throw new ErroPublico(404, "Sugestão não encontrada.");
      await s.ref.set({ estado: "respondida", resposta: R.txt(b.resposta, 1200), respondidaEm: agoraISO() }, { merge: true });
      await salvarC({}, "sugestão respondida");
      return resposta(200, { ok: true });
    }

    if (b.acao === "salvarAnalise" || b.acao === "salvarRelatorio") {
      const nome = b.acao === "salvarAnalise" ? "analises" : "relatorios", dados = b.acao === "salvarAnalise" ? R.normalizarAnalise(b.conteudo) : R.normalizarRelatorio(b.conteudo);
      const alvo = b.itemId ? ref.collection(nome).doc(String(b.itemId)) : ref.collection(nome).doc(R.novoId());
      if (b.itemId) { const s = await alvo.get(); if (!s.exists) throw new ErroPublico(404, "Item não encontrado."); if (s.data().estado === "publicado") throw new ErroPublico(409, "Publicado não se edita: crie uma nova versão."); }
      await alvo.set(limpo({ ...dados, estado: "rascunho", atualizadoEm: agoraISO(), ...(b.itemId ? {} : { criadoEm: agoraISO() }) }), { merge: true });
      await salvarC({}, (nome === "analises" ? "análise" : "relatório") + " salvo como rascunho");
      return resposta(200, { ok: true, itemId: alvo.id });
    }
    if (b.acao === "publicarAnalise" || b.acao === "publicarRelatorio") {
      const nome = b.acao === "publicarAnalise" ? "analises" : "relatorios", s = await ref.collection(nome).doc(String(b.itemId || "x")).get();
      if (!s.exists || s.data().estado !== "rascunho") throw new ErroPublico(404, "Rascunho não encontrado.");
      const x = s.data();
      if (nome === "relatorios") { const erros = R.errosPublicarRelatorio(x); if (erros.length) return resposta(422, { erro: erros[0], erros }); }
      else { if (!x.resumo && !x.marcacoes.length) return resposta(422, { erro: "A análise está vazia." }); if (!x.destinatarios.length) return resposta(422, { erro: "Escolha para quem publicar." }); }
      await s.ref.set({ estado: "publicado", publicadoEm: agoraISO(), atualizadoEm: agoraISO() }, { merge: true });
      await salvarC({}, (nome === "analises" ? "análise" : "relatório") + " publicado para " + x.destinatarios.join(", "));
      return resposta(200, { ok: true });
    }

    if (b.acao === "salvarReuniao" || b.acao === "excluirReuniao") {
      let lista = (c.reunioes || []).slice();
      if (b.acao === "excluirReuniao") lista = lista.filter((m) => m.id !== b.reuniaoId);
      else {
        const r = R.normalizarReuniao(b, hoje); if (!r.ok) throw new ErroPublico(400, r.erro);
        const rid = b.reuniaoId && lista.some((m) => m.id === b.reuniaoId) ? b.reuniaoId : R.novoId();
        lista = lista.filter((m) => m.id !== rid).concat([{ id: rid, ...r.dados }]);
      }
      await salvarC({ reunioes: lista }, b.acao === "excluirReuniao" ? "reunião excluída" : "reunião salva");
      return resposta(200, { ok: true });
    }

    if (b.acao === "salvarNota") {
      const texto = R.txt(b.texto, 3000); if (!texto) throw new ErroPublico(400, "Escreva a anotação.");
      await ref.collection("notas").add({ texto, em: agoraISO() });
      return resposta(200, { ok: true });
    }
    if (b.acao === "excluirNota") { await ref.collection("notas").doc(String(b.notaId || "x")).delete(); return resposta(200, { ok: true }); }

    if (b.acao === "ia") {
      const tipo = ["diagnostico", "plano", "relatorio", "organizar"].includes(b.tipo) ? b.tipo : null; if (!tipo) throw new ErroPublico(400, "Tipo inválido.");
      const sx = await situacao(id, c, hoje), e = c.entrada || {};
      const base = { objetivo: R.OBJETIVOS[e.objetivo] || "", historico: e.historico || "", anotacoes: R.txt(b.texto, 6000) };
      if (tipo === "diagnostico") base.partidas = (c.diagPartidas || []).map((p) => ({ partida: p.n, torneio: p.torneio, adversario: p.adversario, placar: p.placar, contexto: p.contexto, situacao: R.STATUS_PARTIDA[p.status], observacoes: p.obs, marcacoes: p.marcacoes }));
      if (tipo === "plano") base.diagnostico = sx.diagPublicado || sx.diagRascunho || null;
      if (tipo === "relatorio") {
        base.plano = sx.planoVigente ? sx.planoVigente.conteudo : null; base.acoes = R.acoesDoPlano(sx.planoVigente, c.acoesStatus).map((a) => ({ acao: a.texto, responsavel: a.responsavel, prazo: a.prazo, feita: a.feita }));
        base.registros = sx.regs.slice(0, 40).map((r) => ({ tipo: r.tipo, em: String(r.em).slice(0, 10), aplicou: r.aplicou, dificuldade: r.dificuldade, trabalhado: r.trabalhado, resposta: r.resposta, dificuldades: r.dificuldades }));
        base.analises = sx.anals.filter((a) => a.estado === "publicado").map((a) => ({ titulo: a.titulo, resumo: a.resumo }));
      }
      const rascunho = await chamarIA(R.promptIA(tipo, base));
      return resposta(200, { ok: true, tipo, rascunho, aviso: "Rascunho gerado pela IA a partir do material fornecido. Revise e corrija antes de salvar; nada foi salvo nem publicado." });
    }

    throw new ErroPublico(400, "Ação desconhecida.");
  } catch (e) {
    if (e instanceof ErroPublico) return resposta(e.status, { erro: e.message });
    console.error("consultoria-rt", e);
    return resposta(500, { erro: "Algo deu errado. Tente de novo em instantes." });
  }
};
