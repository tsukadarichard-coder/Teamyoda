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
const PART = require("./_player-partidas");

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
      const preparos = [], diario = [];
      (await ref.collection("preparos").get()).forEach((d) => preparos.push({ id: d.id, ...d.data() }));
      (await ref.collection("diario").get()).forEach((d) => diario.push({ id: d.id, ...d.data() }));
      preparos.sort((a, b) => String(b.data || b.criadoEm).localeCompare(String(a.data || a.criadoEm)));
      diario.sort((a, b) => String(b.data).localeCompare(String(a.data)) || String(b.criadoEm).localeCompare(String(a.criadoEm)));
      const focos = [], devolutivas = [];
      (await ref.collection("focos").get()).forEach((d) => focos.push({ id: d.id, ...d.data() }));
      (await ref.collection("devolutivas").get()).forEach((d) => devolutivas.push({ id: d.id, ...d.data() }));
      focos.sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));
      devolutivas.sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));
      return resposta(200, { torneios: T.ordenar(lista), estados: T.ROTULO_ESTADO, preparos, diario, focos, devolutivas, aspectos: PART.ASPECTOS });
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
      /* o que era do torneio não fica órfão: a preparação sai junto; partidas e diário continuam, só sem o vínculo */
      for (const x of (await ref.collection("preparos").where("torneioId", "==", body.id).get()).docs) await x.ref.delete();
      for (const x of (await ref.collection("partidas").where("torneioId", "==", body.id).get()).docs) await x.ref.update({ torneioId: null, rodada: "" });
      for (const x of (await ref.collection("diario").where("torneioId", "==", body.id).get()).docs) await x.ref.update({ torneioId: null });
      await d.delete();
      return resposta(200, { ok: true });
    }

    if (body.acao === "salvarPreparo") {
      const v = T.normalizarPreparo(body, hoje);
      if (!v.ok) throw new ErroPublico(400, v.erro);
      if (!(await col.doc(v.dados.torneioId).get()).exists) throw new ErroPublico(404, "Torneio não encontrado.");
      if (v.dados.planoId) {
        const sp = await ref.collection("planos").doc(v.dados.planoId).get();
        if (!sp.exists) v.dados.planoId = null; else v.dados.planoTitulo = String(((sp.data().plano || {}).titulo) || "").slice(0, 120);
      }
      const cp = ref.collection("preparos"), agora = new Date().toISOString();
      if (body.id) {
        if (!ID_VALIDO.test(String(body.id))) throw new ErroPublico(400, "Preparação inválida.");
        const s0 = await cp.doc(body.id).get();
        if (!s0.exists) throw new ErroPublico(404, "Preparação não encontrada.");
        await cp.doc(body.id).set({ ...v.dados, criadoEm: s0.data().criadoEm, atualizadoEm: agora });
        return resposta(200, { ok: true, id: body.id });
      }
      if ((await cp.get()).docs.length >= T.MAX_PREPAROS) throw new ErroPublico(409, "Limite de preparações atingido. Exclua as mais antigas.");
      const n = await cp.add({ ...v.dados, criadoEm: agora });
      return resposta(200, { ok: true, id: n.id });
    }
    if (body.acao === "excluirPreparo") {
      if (!ID_VALIDO.test(String(body.id || ""))) throw new ErroPublico(400, "Preparação inválida.");
      const d = ref.collection("preparos").doc(body.id);
      if (!(await d.get()).exists) throw new ErroPublico(404, "Preparação não encontrada.");
      await d.delete();
      return resposta(200, { ok: true });
    }

    if (body.acao === "levarParaTreino") {
      /* uma dificuldade de partida ou o foco sugerido numa devolutiva vira um foco de treino; repetir não duplica nem desfaz o andamento */
      const cf = ref.collection("focos"), agora = new Date().toISOString(), criar = [];
      if (body.partidaId) {
        if (!ID_VALIDO.test(String(body.partidaId))) throw new ErroPublico(400, "Partida inválida.");
        const sp = await ref.collection("partidas").doc(body.partidaId).get();
        if (!sp.exists) throw new ErroPublico(404, "Partida não encontrada.");
        const p = sp.data(), rot = (p.adversario ? "Contra " + p.adversario : "Partida") + " · " + p.data;
        const asp = (p.dificuldades || []).filter((a) => PART.ASPECTOS[a]);
        if (!asp.length) throw new ErroPublico(409, "Esta partida não tem dificuldades registradas. Edite o registro e marque o que foi difícil.");
        for (const a of asp) criar.push({ id: T.idFoco("partida", body.partidaId, a), dados: { origem: "partida", origemId: body.partidaId, origemRotulo: rot, aspecto: a, texto: PART.ASPECTOS[a] } });
      } else if (body.devolutivaId) {
        if (!ID_VALIDO.test(String(body.devolutivaId))) throw new ErroPublico(400, "Devolutiva inválida.");
        const sd = await ref.collection("devolutivas").doc(body.devolutivaId).get();
        if (!sd.exists) throw new ErroPublico(404, "Devolutiva não encontrada.");
        const d = sd.data();
        if (!d.foco) throw new ErroPublico(409, "Esta devolutiva não sugere um foco de treino.");
        criar.push({ id: T.idFoco("devolutiva", body.devolutivaId), dados: { origem: "devolutiva", origemId: body.devolutivaId, origemRotulo: "Devolutiva de " + (d.autorNome || "treinador"), aspecto: null, texto: d.foco } });
      } else throw new ErroPublico(400, "Escolha a partida ou a devolutiva.");
      let novos = 0;
      for (const c of criar) {
        const rf = cf.doc(c.id);
        if ((await rf.get()).exists) continue;
        if ((await cf.get()).docs.length >= T.MAX_FOCOS) throw new ErroPublico(409, "Você tem focos demais em aberto. Resolva ou exclua alguns.");
        await rf.set({ ...c.dados, status: "aberto", criadoEm: agora }); novos++;
      }
      return resposta(200, { ok: true, novos, total: criar.length });
    }
    if (body.acao === "atualizarFoco") {
      const id = String(body.id || "");
      if (!/^[A-Za-z0-9_-]{8,200}$/.test(id) || !T.STATUS_FOCO.includes(body.status)) throw new ErroPublico(400, "Foco inválido.");
      const rf = ref.collection("focos").doc(id);
      if (!(await rf.get()).exists) throw new ErroPublico(404, "Foco não encontrado.");
      await rf.update({ status: body.status, atualizadoEm: new Date().toISOString() });
      return resposta(200, { ok: true });
    }
    if (body.acao === "excluirFoco") {
      const id = String(body.id || "");
      if (!/^[A-Za-z0-9_-]{8,200}$/.test(id)) throw new ErroPublico(400, "Foco inválido.");
      const rf = ref.collection("focos").doc(id);
      if (!(await rf.get()).exists) throw new ErroPublico(404, "Foco não encontrado.");
      await rf.delete();
      return resposta(200, { ok: true });
    }

    if (body.acao === "salvarDiario") {
      const v = T.normalizarDiario(body, hoje);
      if (!v.ok) throw new ErroPublico(400, v.erro);
      if (v.dados.torneioId && !(await col.doc(v.dados.torneioId).get()).exists) v.dados.torneioId = null;
      const cd = ref.collection("diario"), agora = new Date().toISOString();
      if (body.id) {
        if (!ID_VALIDO.test(String(body.id))) throw new ErroPublico(400, "Registro inválido.");
        const s0 = await cd.doc(body.id).get();
        if (!s0.exists) throw new ErroPublico(404, "Registro não encontrado.");
        await cd.doc(body.id).set({ ...v.dados, criadoEm: s0.data().criadoEm, atualizadoEm: agora });
        return resposta(200, { ok: true, id: body.id });
      }
      if ((await cd.get()).docs.length >= T.MAX_DIARIO) throw new ErroPublico(409, "Limite de registros do diário atingido. Exclua os mais antigos.");
      const n = await cd.add({ ...v.dados, criadoEm: agora });
      return resposta(200, { ok: true, id: n.id });
    }
    if (body.acao === "excluirDiario") {
      if (!ID_VALIDO.test(String(body.id || ""))) throw new ErroPublico(400, "Registro inválido.");
      const d = ref.collection("diario").doc(body.id);
      if (!(await d.get()).exists) throw new ErroPublico(404, "Registro não encontrado.");
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
