/* QuadraLab Player Competição — torneios da temporada do atleta.

   GET                                  → torneios do atleta (próximos primeiro, depois os passados)
   POST { acao: "salvar", id?, ...campos } → cria ou atualiza um torneio (validado em _player-torneios.js)
   POST { acao: "excluir", id }            → apaga um torneio
   POST { acao: "extrair", texto }         → propõe os campos a partir do texto colado; NÃO salva (o atleta revisa)

   Só o atleta, pelo uid do token. Treinador e responsável leem o calendário por player-competicao?ver=, e só com vínculo ativo
   e a área "temporada" marcada. */
const Anthropic = require("@anthropic-ai/sdk");
const { ErroPublico, resposta, usuarioDoPedido, refJogador } = require("./_player");
const T = require("./_player-torneios");

const hojeNoBrasil = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const ID_VALIDO = /^[A-Za-z0-9]{10,40}$/;

exports.handler = async function (event) {
  try {
    const usuario = await usuarioDoPedido(event);
    const ref = refJogador(usuario.uid), hoje = hojeNoBrasil();
    const jog = (await ref.get()).data() || {};
    if (!jog.competicao || jog.competicao.papel !== "atleta") throw new ErroPublico(403, "A temporada é do atleta. Ative a Competição como atleta.");
    const col = ref.collection("torneios");

    if (event.httpMethod === "GET") {
      const snap = await col.get(), lista = [];
      snap.forEach((d) => lista.push(T.publicoTorneio(d.id, d.data(), hoje)));
      return resposta(200, { torneios: T.ordenar(lista), estados: T.ROTULO_ESTADO });
    }
    if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });
    let body;
    try { body = JSON.parse(event.body || "{}"); } catch (e) { throw new ErroPublico(400, "Pedido inválido."); }

    if (body.acao === "salvar") {
      const v = T.normalizarTorneio(body, hoje);
      if (!v.ok) throw new ErroPublico(400, v.erro);
      if (body.id) {
        if (!ID_VALIDO.test(String(body.id))) throw new ErroPublico(400, "Torneio inválido.");
        const s = await col.doc(body.id).get();
        if (!s.exists) throw new ErroPublico(404, "Torneio não encontrado.");
        const antigo = s.data();
        await col.doc(body.id).set({ ...v.dados, origem: antigo.origem || v.dados.origem, coletadoEm: antigo.coletadoEm || null, criadoEm: antigo.criadoEm, atualizadoEm: new Date().toISOString() });
        return resposta(200, { ok: true, id: body.id });
      }
      if ((await col.get()).docs.length >= T.MAX_TORNEIOS) throw new ErroPublico(409, "Você chegou ao limite de " + T.MAX_TORNEIOS + " torneios cadastrados. Exclua os mais antigos.");
      const agora = new Date().toISOString();
      const novo = await col.add({ ...v.dados, coletadoEm: v.dados.origem === "manual" ? null : agora, criadoEm: agora });
      return resposta(200, { ok: true, id: novo.id });
    }

    if (body.acao === "excluir") {
      if (!ID_VALIDO.test(String(body.id || ""))) throw new ErroPublico(400, "Torneio inválido.");
      const d = col.doc(body.id);
      if (!(await d.get()).exists) throw new ErroPublico(404, "Torneio não encontrado.");
      await d.delete();
      return resposta(200, { ok: true });
    }

    if (body.acao === "extrair") {
      const texto = String(body.texto || "").trim();
      if (texto.length < 20) throw new ErroPublico(400, "Cole o texto da inscrição ou da página do torneio.");
      if (texto.length > T.MAX_TEXTO_COLADO) throw new ErroPublico(400, "O texto é longo demais. Cole só a parte com os dados do torneio.");
      if (!process.env.ANTHROPIC_API_KEY) throw new ErroPublico(503, "A leitura automática está indisponível agora. Preencha os dados à mão.");
      const uso = jog.torneiosIA && jog.torneiosIA.dia === hoje ? jog.torneiosIA.n || 0 : 0;
      if (uso >= T.MAX_EXTRACOES_DIA) throw new ErroPublico(429, "Você chegou ao limite de leituras de hoje. Preencha à mão ou tente amanhã.");
      await ref.set({ torneiosIA: { dia: hoje, n: uso + 1 } }, { merge: true });
      let bruto = null;
      try {
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 9000, maxRetries: 0 });
        const r = await client.messages.create({
          model: "claude-haiku-4-5", max_tokens: 700,
          output_config: { format: { type: "json_schema", schema: T.SCHEMA_EXTRACAO } },
          messages: [{ role: "user", content: T.promptExtracao(texto, hoje) }],
        });
        const t = r.content.filter((b) => b.type === "text").map((b) => b.text).join("");
        try { bruto = JSON.parse(t); } catch (e) { bruto = null; }
      } catch (e) {
        console.error("player-torneios: falha na IA", e && e.message);
        throw new ErroPublico(502, "Não consegui ler o texto agora. Preencha os dados à mão ou tente de novo.");
      }
      const proposta = T.normalizarExtracao(bruto, hoje);
      if (!proposta) throw new ErroPublico(422, "Não encontrei os dados de um torneio nesse texto. Confira o que colou ou preencha à mão.");
      return resposta(200, { ok: true, proposta });
    }

    throw new ErroPublico(400, "Ação desconhecida.");
  } catch (e) {
    if (e instanceof ErroPublico) return resposta(e.status, { erro: e.message });
    console.error("player-torneios:", e);
    return resposta(500, { erro: "Não foi possível concluir agora. Tente de novo em instantes." });
  }
};
