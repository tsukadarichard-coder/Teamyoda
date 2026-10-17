/* QuadraLab Player — gera o plano tático do jogador com IA.

   Function em segundo plano (sufixo "-background"): o Netlify responde
   202 na hora e deixa esta rodar até 15 minutos. O resultado vai para
   jogadores/{uid}/planos/{planoId}, que o app consulta por player-dados.

   A cota é conferida e consumida AQUI, numa transação, antes de chamar
   a IA — nunca no navegador. O planoId vem do app: se o mesmo id chegar
   duas vezes (clique duplo, reenvio), a segunda chamada não faz nada,
   então ninguém é cobrado duas vezes pelo mesmo plano. Se a geração
   falhar, a cota volta para o jogador. */
const Anthropic = require("@anthropic-ai/sdk");
const {
  admin, ErroPublico, usuarioDoPedido, refJogador,
  PLANOS_GRATIS, fonteDeEstrategia, normalizarFicha, complementosParaFicha, fichaCompleta, adversarioUtil,
  promptPlano, SCHEMA_PLANO, planoValido, finalizarPlano, nivelDoJogador, planoFull,
} = require("./_player");
const COTAS = require("./_player-cotas");

const ID_VALIDO = /^[A-Za-z0-9_-]{8,40}$/;

/* A cota volta para quem a gastou — na mesma conta de onde saiu (grátis, crédito ou uso do período da assinatura). */
async function devolverCota(refJ, fonte, modelo) {
  if (fonte === "full") return; // acesso completo não consome cota
  if (modelo) {
    await admin.firestore().runTransaction(async (t) => {
      const d = (await t.get(refJ)).data() || {};
      if (modelo.fonte === "credito") t.set(refJ, { creditosPlano: (d.creditosPlano || 0) + 1 }, { merge: true });
      else { const volta = COTAS.devolverReserva(d, modelo); if (volta) t.set(refJ, volta, { merge: true }); }
      if (modelo.novoAdversario && d.adversarios && d.adversarios[modelo.slug]) {
        const mapa = { ...d.adversarios }; delete mapa[modelo.slug];
        t.update(refJ, { adversarios: mapa });
      }
    });
    return;
  }
  if (fonte === "assinatura") {
    await admin.firestore().runTransaction(async (t) => {
      const d = (await t.get(refJ)).data() || {};
      const usadas = Math.max(0, (((d.assinatura || {}).uso || {}).estrategias || 0) - 1);
      t.set(refJ, { assinatura: { uso: { estrategias: usadas } } }, { merge: true });
    });
    return;
  }
  const campo = fonte === "gratis" ? "planosGratisUsados" : "creditosPlano";
  const delta = fonte === "gratis" ? -1 : 1;
  await refJ.update({ [campo]: admin.firestore.FieldValue.increment(delta) });
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "" };

  let usuario, planoId;
  try {
    usuario = await usuarioDoPedido(event);
    planoId = JSON.parse(event.body || "{}").planoId;
  } catch (e) {
    return { statusCode: e instanceof ErroPublico ? e.status : 400, body: "" };
  }
  if (!ID_VALIDO.test(String(planoId || ""))) return { statusCode: 400, body: "" };

  const refJ = refJogador(usuario.uid);
  const refP = refJ.collection("planos").doc(planoId);
  const db = admin.firestore();

  /* ── reserva da cota (transação) ── */
  let reserva;
  try {
    reserva = await db.runTransaction(async (t) => {
      const [sJ, sP] = await Promise.all([t.get(refJ), t.get(refP)]);
      if (sP.exists) return null; // mesmo pedido de novo: já tratado
      const dados = sJ.exists ? sJ.data() : {};
      const ficha = normalizarFicha(dados.ficha);
      ficha.complementos = complementosParaFicha(dados.complementos, ficha);
      const agora = new Date().toISOString();
      if (!fichaCompleta(ficha)) {
        t.set(refP, { status: "erro", erro: "Complete o seu perfil antes de criar a estratégia.", criadoEm: agora });
        return null;
      }
      /* modelo novo de planos (chave PLAYER_MODELO_PLANOS): cota por plano de jogo / estratégia contra adversário */
      let modelo = null;
      const comAdv = adversarioUtil(ficha);
      if (COTAS.modeloAtivo()) {
        const hoje = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
        const planoId = COTAS.planoIdDoNivel(nivelDoJogador(dados, usuario.email, hoje), planoFull(usuario.email));
        const tipo = comAdv ? "estrategiasAdversario" : "planosJogo";
        const av = COTAS.avaliarGeracao(dados, { planoId, tipo, hoje });
        const recusa = (msg, extra) => t.set(refP, { status: "erro", semCota: true, criadoEm: agora, erro: msg, ...extra });
        if (!av.fonte) { recusa(av.mensagem, { motivoCota: av.motivo, ...(av.renovaEm ? { renovaEm: av.renovaEm } : {}) }); return null; }
        let reg = null;
        if (comAdv) {
          /* geração por crédito avulso (paga à parte) não esbarra no limite de adversários do plano */
          reg = COTAS.registrarAdversario(dados, ficha.adversario.nome || "Adversário", av.fonte === "credito" ? "full" : planoId, agora);
          if (!reg.ok) { recusa(reg.mensagem, { motivoCota: reg.motivo }); return null; }
        }
        modelo = { fonte: av.fonte, planoId, tipo, ciclo: av.ciclo || "vitalicio", novoAdversario: !!(reg && reg.novo), slug: reg ? reg.slug : null };
        let upd = {};
        if (av.fonte === "modelo") upd = COTAS.reservarCota(dados, modelo);
        else if (av.fonte === "credito") upd = { creditosPlano: dados.creditosPlano - 1 };
        if (reg && reg.novo) upd.adversarios = reg.mapa;
        if (Object.keys(upd).length) t.set(refJ, upd, { merge: true });
        t.set(refP, {
          status: "gerando", criadoEm: agora, fonte: av.fonte, fichaUsada: ficha, cotaModelo: modelo,
          adversarioNome: comAdv ? (ficha.adversario.nome || "Adversário") : null,
        });
        return { ficha, fonte: av.fonte, modelo };
      }
      const cota = fonteDeEstrategia(dados, usuario.email);
      const fonte = cota.fonte;
      if (!fonte) {
        const limitePeriodo = cota.motivo === "limite_periodo";
        t.set(refP, {
          status: "erro", semCota: true, criadoEm: agora, motivoCota: cota.motivo, ...(cota.renovaEm ? { renovaEm: cota.renovaEm } : {}),
          erro: limitePeriodo ? "Você atingiu o limite de estratégias do período da sua assinatura." : "Você já usou a sua estratégia grátis.",
        });
        return null;
      }
      if (fonte === "gratis") t.set(refJ, { planosGratisUsados: (dados.planosGratisUsados || 0) + 1 }, { merge: true });
      else if (fonte === "credito") t.set(refJ, { creditosPlano: dados.creditosPlano - 1 }, { merge: true });
      else if (fonte === "assinatura") t.set(refJ, { assinatura: { uso: { estrategias: (((dados.assinatura || {}).uso || {}).estrategias || 0) + 1 } } }, { merge: true });
      const comAdversario = adversarioUtil(ficha);
      t.set(refP, {
        status: "gerando", criadoEm: agora, fonte, fichaUsada: ficha,
        adversarioNome: comAdversario ? (ficha.adversario.nome || "Adversário") : null,
      });
      return { ficha, fonte };
    });
  } catch (e) {
    console.error("player-gerar-plano: falha na reserva", e);
    return { statusCode: 202, body: "" };
  }
  if (!reserva) return { statusCode: 202, body: "" };

  async function falhar(mensagem) {
    try { await devolverCota(refJ, reserva.fonte, reserva.modelo); } catch (e) { console.error("player-gerar-plano: falha ao devolver cota", e); }
    await refP.update({ status: "erro", erro: mensagem, finalizadoEm: new Date().toISOString() });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("player-gerar-plano: ANTHROPIC_API_KEY não configurada");
    await falhar("O gerador de estratégias está indisponível no momento. Tente de novo mais tarde.");
    return { statusCode: 202, body: "" };
  }

  /* ── geração ──
     Saída estruturada (json_schema) para o app sempre receber o mesmo
     formato; fallbacks "default" refaz o pedido em outro modelo se o
     principal recusar por engano um texto de tática de tênis. */
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const r = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: SCHEMA_PLANO },
      },
      messages: [{ role: "user", content: promptPlano(reserva.ficha) }],
    });

    if (r.stop_reason === "refusal") {
      await falhar("Não foi possível criar a estratégia com este perfil. Revise as observações e tente de novo.");
      return { statusCode: 202, body: "" };
    }
    if (r.stop_reason === "max_tokens") {
      await falhar("A estratégia saiu incompleta. Tente criar de novo.");
      return { statusCode: 202, body: "" };
    }
    const texto = r.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    let plano = null;
    try { plano = JSON.parse(texto); } catch (e) { plano = null; }
    if (!planoValido(plano)) {
      console.error("player-gerar-plano: resposta fora do formato", texto.slice(0, 500));
      await falhar("A estratégia saiu num formato inesperado. Tente criar de novo.");
      return { statusCode: 202, body: "" };
    }
    finalizarPlano(plano, reserva.ficha.nivel, adversarioUtil(reserva.ficha));
    await refP.update({
      status: "pronto",
      plano,
      modelo: r.model || null,
      uso: { entrada: (r.usage && r.usage.input_tokens) || 0, saida: (r.usage && r.usage.output_tokens) || 0 },
      finalizadoEm: new Date().toISOString(),
    });
  } catch (e) {
    console.error("player-gerar-plano: falha na IA", e);
    await falhar("Não foi possível criar a estratégia agora. Sua cota foi mantida — tente de novo em instantes.");
  }

  return { statusCode: 202, body: "" };
};
