/* QuadraLab Player — análise biomecânica do jogador.

   GET                                      → { analises: [resumos, mais antigos primeiro], cota }
   GET ?id=mv…                              → { relatorio } (o relatório completo guardado, ou null)
   POST { acao: "salvar", resumo }          → salva o resumo de uma análise (conta no limite do Free se for nova)
   POST { acao: "relatorio", id, relatorio } → guarda o relatório completo (fotos das fases) de uma análise já salva
   POST { acao: "remover", id }             → apaga a análise (no Free o uso do golpe continua contado)

   Regras em _player-movimento.js. O limite é conferido aqui, numa transação com o documento do jogador: o app só mostra. */
const { admin, ErroPublico, resposta, usuarioDoPedido, refJogador, nivelDoJogador, planoFull } = require("./_player");
const { hojeISO } = require("./_player-assinaturas");
const M = require("./_player-movimento");

exports.handler = async function (event) {
  try {
    const usuario = await usuarioDoPedido(event);
    const ref = refJogador(usuario.uid), col = ref.collection("movimentos");
    const full = planoFull(usuario.email);
    const nivelDe = (dados) => nivelDoJogador(dados, usuario.email, hojeISO());

    if (event.httpMethod === "GET") {
      const q = event.queryStringParameters || {};
      if (q.id) {
        if (!M.ID_ANALISE.test(String(q.id))) throw new ErroPublico(400, "Análise inválida.");
        const d = await col.doc(q.id).get();
        if (!d.exists) throw new ErroPublico(404, "Análise não encontrada.");
        const rel = d.data().relatorio;
        let relatorio = null; try { relatorio = rel ? JSON.parse(rel) : null; } catch (e) { relatorio = null; }
        return resposta(200, { relatorio });
      }
      const [jog, snap] = await Promise.all([ref.get(), col.get()]);
      const dados = jog.data() || {};
      const analises = snap.docs.map((d) => d.data().resumo).filter(Boolean).sort((a, b) => String(a.criadoEm).localeCompare(String(b.criadoEm)));
      return resposta(200, { analises, cota: M.cota(dados, { nivel: nivelDe(dados), full }) });
    }
    if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });
    let body;
    try { body = JSON.parse(event.body || "{}"); } catch (e) { throw new ErroPublico(400, "Pedido inválido."); }

    if (body.acao === "salvar") {
      const resumo = M.limparResumo(body.resumo);
      if (!resumo) throw new ErroPublico(400, "Análise inválida.");
      const agora = new Date().toISOString();
      const saida = await admin.firestore().runTransaction(async (tx) => {
        const [jog, doc, todas] = await Promise.all([tx.get(ref), tx.get(col.doc(resumo.id)), tx.get(col)]);
        const dados = jog.data() || {};
        if (doc.exists && doc.data().resumo && doc.data().resumo.golpe !== resumo.golpe) throw new ErroPublico(400, "Análise inválida.");
        const av = M.avaliarSalvar(dados, { nivel: nivelDe(dados), full, golpe: resumo.golpe, novo: !doc.exists, total: todas.docs.length });
        if (!av.ok) throw new ErroPublico(av.status, av.mensagem);
        if (doc.exists) tx.update(col.doc(resumo.id), { resumo, atualizadoEm: agora });
        else tx.set(col.doc(resumo.id), { resumo, golpe: resumo.golpe, criadoEm: agora });
        let uso = M.usoDe(dados);
        if (av.conta) { uso = { ...uso, [resumo.golpe]: uso[resumo.golpe] + 1 }; tx.set(ref, { movimentoUso: uso }, { merge: true }); }
        return M.cota({ ...dados, movimentoUso: uso }, { nivel: nivelDe(dados), full });
      });
      return resposta(200, { ok: true, cota: saida });
    }

    if (body.acao === "relatorio") {
      const id = String(body.id || "");
      if (!M.ID_ANALISE.test(id)) throw new ErroPublico(400, "Análise inválida.");
      if (!M.relatorioValido(body.relatorio, id)) throw new ErroPublico(400, "Relatório inválido ou grande demais.");
      const d = col.doc(id);
      if (!(await d.get()).exists) throw new ErroPublico(404, "Salve a análise antes do relatório.");
      await d.update({ relatorio: body.relatorio, relatorioEm: new Date().toISOString() });
      return resposta(200, { ok: true });
    }

    if (body.acao === "remover") {
      const id = String(body.id || "");
      if (!M.ID_ANALISE.test(id)) throw new ErroPublico(400, "Análise inválida.");
      const d = col.doc(id);
      if ((await d.get()).exists) await d.delete();
      return resposta(200, { ok: true });
    }

    throw new ErroPublico(400, "Ação desconhecida.");
  } catch (e) {
    if (e instanceof ErroPublico) return resposta(e.status, { erro: e.message });
    console.error("player-movimento:", e && e.message);
    return resposta(500, { erro: "Não foi possível concluir agora. Tente de novo em instantes." });
  }
};
