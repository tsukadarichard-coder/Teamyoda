/* QuadraLab Player — gera o planejamento por semanas (recurso do Plano 1).

   Função em segundo plano, como a do plano tático: o Netlify responde 202
   na hora e o resultado vai para jogadores/{uid}/planejamentos/{id}, que o
   app consulta por player-dados.

   O servidor confere o direito ao recurso (nível do plano do jogador) ANTES
   de chamar a IA — o app esconder o botão não protege nada. O mesmo id de
   planejamento nunca gera duas vezes. */
const Anthropic = require("@anthropic-ai/sdk");
const ASS = require("./_player-assinaturas");
const COTAS = require("./_player-cotas");
const {
  admin, planoFull, ErroPublico, usuarioDoPedido, refJogador, nivelDoJogador, recursosDoNivel,
  normalizarFicha, complementosParaFicha, fichaCompleta,
} = require("./_player");
const {
  ErroParametros, normalizarParametros, promptPlanejamento, SCHEMA_PLANEJAMENTO, planejamentoValido, finalizarPlanejamento,
} = require("./_player-planejamento");

const ID_VALIDO = /^[A-Za-z0-9_-]{8,40}$/;
const LIMITE_POR_DIA = 10;

function hojeNoBrasil() {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "" };

  let usuario, corpo;
  try {
    usuario = await usuarioDoPedido(event);
    corpo = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: e instanceof ErroPublico ? e.status : 400, body: "" };
  }
  const idPlanejamento = String(corpo.planejamentoId || "");
  const idPlano = String(corpo.planoId || "");
  if (!ID_VALIDO.test(idPlanejamento) || !ID_VALIDO.test(idPlano)) return { statusCode: 400, body: "" };

  const refJ = refJogador(usuario.uid);
  const refPlano = refJ.collection("planos").doc(idPlano);
  const refPlan = refJ.collection("planejamentos").doc(idPlanejamento);
  const agora = () => new Date().toISOString();

  async function recusar(mensagem, extras) {
    try {
      const s = await refPlan.get();
      if (!s.exists) await refPlan.set({ status: "erro", erro: mensagem, baseadoEm: idPlano, criadoEm: agora(), ...(extras || {}) });
    } catch (e) { console.error("player-gerar-planejamento: falha ao registrar recusa", e); }
    return { statusCode: 202, body: "" };
  }

  /* ── confere tudo antes de gastar IA ── */
  let dadosJ, planoTatico, escolhidas, ficha, params;
  try {
    const [sJ, sPlano, sPlan] = await Promise.all([refJ.get(), refPlano.get(), refPlan.get()]);
    if (sPlan.exists) return { statusCode: 202, body: "" }; // mesmo pedido de novo: já tratado
    dadosJ = sJ.exists ? sJ.data() : {};
    const modelo = COTAS.modeloAtivo();
    if (!modelo && !recursosDoNivel(nivelDoJogador(dadosJ, usuario.email)).planejamento) {
      return await recusar("O programa de treino faz parte de uma assinatura. Veja as opções em Minha assinatura.");
    }
    const ass = dadosJ.assinatura;
    if (modelo) {
      /* modelo novo: limite de programas ATIVOS por plano (todos os planos têm programa; jogadas e sessões não têm limite) */
      const todos = await refJ.collection("planejamentos").get();
      const lista = []; todos.forEach((d) => lista.push(d.data()));
      const planoId = COTAS.planoIdDoNivel(nivelDoJogador(dadosJ, usuario.email, hojeNoBrasil()), planoFull(usuario.email));
      const av = COTAS.avaliarPrograma(planoId, COTAS.contarProgramasAtivos(lista, hojeNoBrasil()));
      if (!av.ok) return await recusar(av.mensagem, { semCota: true, motivoCota: "limite_programas_ativos" });
    } else if (ASS.assinaturaVigente(ass) && Number.isInteger((ass.limites || {}).programasPorPeriodo) && ((ass.uso || {}).programas || 0) >= ass.limites.programasPorPeriodo) {
      return await recusar("Você atingiu o limite de programas de treino do período da sua assinatura.", { semCota: true, motivoCota: "limite_periodo", renovaEm: ass.ativoAte });
    }
    ficha = normalizarFicha(dadosJ.ficha);
    ficha.complementos = complementosParaFicha(dadosJ.complementos, ficha);
    if (!fichaCompleta(ficha)) return await recusar("Complete o seu perfil antes de organizar os treinos.");
    if (!sPlano.exists || sPlano.data().status !== "pronto") return await recusar("Crie uma estratégia antes de organizar os treinos.");
    planoTatico = sPlano.data().plano;
    escolhidas = Array.isArray(sPlano.data().escolhidas) ? sPlano.data().escolhidas : [];
    try { params = normalizarParametros(corpo.params, hojeNoBrasil()); }
    catch (e) { if (e instanceof ErroParametros) return await recusar(e.message); throw e; }

    const recentes = await refJ.collection("planejamentos").orderBy("criadoEm", "desc").limit(LIMITE_POR_DIA + 1).get();
    const corte = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    let n = 0; recentes.forEach((d) => { if ((d.data().criadoEm || "") > corte && d.data().status !== "erro") n++; });
    if (n >= LIMITE_POR_DIA) return await recusar("Você já montou vários programas de treino hoje. Tente de novo amanhã.");
  } catch (e) {
    console.error("player-gerar-planejamento: falha na checagem", e);
    return { statusCode: 202, body: "" };
  }

  /* reserva (transação): o mesmo pedido nunca conta duas vezes; o uso do período só sobe com assinatura vigente */
  let contouUso = false;
  try {
    const reservou = await admin.firestore().runTransaction(async (t) => {
      const [sJ, sPl] = await Promise.all([t.get(refJ), t.get(refPlan)]);
      if (sPl.exists) return false;
      const d = sJ.exists ? sJ.data() : {};
      t.set(refPlan, { status: "gerando", baseadoEm: idPlano, params, criadoEm: agora() });
      if (!COTAS.modeloAtivo() && ASS.assinaturaVigente(d.assinatura) && !require("./_player").planoFull(usuario.email)) {
        t.set(refJ, { assinatura: { uso: { programas: (((d.assinatura || {}).uso || {}).programas || 0) + 1 } } }, { merge: true });
        contouUso = true;
      }
      return true;
    });
    if (!reservou) return { statusCode: 202, body: "" };
  } catch (e) {
    console.error("player-gerar-planejamento: falha na reserva", e);
    return { statusCode: 202, body: "" };
  }

  async function falhar(mensagem) {
    if (contouUso) {
      try {
        await admin.firestore().runTransaction(async (t) => {
          const d = (await t.get(refJ)).data() || {};
          t.set(refJ, { assinatura: { uso: { programas: Math.max(0, (((d.assinatura || {}).uso || {}).programas || 0) - 1) } } }, { merge: true });
        });
      } catch (e) { console.error("player-gerar-planejamento: falha ao devolver uso", e); }
    }
    await refPlan.update({ status: "erro", erro: mensagem, finalizadoEm: agora() });
  }
  /* histórico do jogador (volume do plano) para ajustar a ênfase do programa; falha aqui não impede a geração */
  let historico = null;
  try {
    const planoCtx = COTAS.planoIdDoNivel(nivelDoJogador(dadosJ, usuario.email, hojeNoBrasil()), planoFull(usuario.email));
    historico = await require("./_player-evolucao").carregarHistorico(refJ, planoCtx, null);
  } catch (e) { console.error("player-gerar-planejamento: falha ao montar o histórico", e); }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("player-gerar-planejamento: ANTHROPIC_API_KEY não configurada");
    await falhar("O gerador está indisponível no momento. Tente de novo mais tarde.");
    return { statusCode: 202, body: "" };
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const r = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA_PLANEJAMENTO } },
      messages: [{ role: "user", content: promptPlanejamento(ficha, planoTatico, escolhidas, params, historico) }],
    });
    if (r.stop_reason === "refusal") { await falhar("Não foi possível montar o programa de treino com este perfil. Tente de novo."); return { statusCode: 202, body: "" }; }
    if (r.stop_reason === "max_tokens") { await falhar("O programa de treino saiu incompleto. Tente com menos semanas ou menos dias por semana."); return { statusCode: 202, body: "" }; }
    const texto = r.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    let bruto = null;
    try { bruto = JSON.parse(texto); } catch (e) { bruto = null; }
    if (!planejamentoValido(bruto, params)) {
      console.error("player-gerar-planejamento: resposta fora do formato", texto.slice(0, 500));
      await falhar("O programa de treino saiu num formato inesperado. Tente gerar de novo.");
      return { statusCode: 202, body: "" };
    }
    const planejamento = finalizarPlanejamento(bruto, params, ficha.nivel, (planoTatico.jogadas || []).length);
    if (planejamento.avisos.length) console.warn("player-gerar-planejamento: avisos", planejamento.avisos.join(" | "));
    await refPlan.update({
      status: "pronto", planejamento, modelo: r.model || null,
      uso: { entrada: (r.usage && r.usage.input_tokens) || 0, saida: (r.usage && r.usage.output_tokens) || 0 },
      finalizadoEm: agora(),
    });
  } catch (e) {
    console.error("player-gerar-planejamento: falha na IA", e);
    await falhar("Não foi possível montar o programa de treino agora. Tente de novo em instantes.");
  }
  return { statusCode: 202, body: "" };
};
