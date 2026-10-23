/* Painel do administrador — QuadraLab Hub: moderação e indicadores agregados.

   GET                                                   → indicadores (sem conteúdo de conversas), denúncias e perfis
   POST { acao: "suspender", uid, motivo, motivoPublico? }   → tira o perfil da busca (pedidos em andamento continuam)
   POST { acao: "reativar", uid, motivo }                → volta ao estado escolhido pelo profissional (pausa e rascunho são respeitados)
   POST { acao: "verificar", uid, itens, motivo }        → selo só depois de conferir de fato (os comprovantes nunca ficam públicos)
   POST { acao: "removerVerificacao", uid, motivo }
   POST { acao: "ocultarAvaliacao" | "mostrarAvaliacao", avaliacaoId, motivo }
   POST { acao: "ocultarMensagem", denunciaId, motivo }  → só a mensagem denunciada; o administrador não navega pelas conversas
   POST { acao: "resolverDenuncia", denunciaId, decisao, motivo }

   Toda ação grava o motivo. Mesma autenticação dos outros painéis (x-admin-secret ou sessão do painel). */
const { admin, app } = require("./_firebase-admin");
const AUTH = require("./_admin-auth");
const H = require("./_hub");

function resposta(statusCode, corpo) { return { statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(corpo) }; }
const UID = /^[A-Za-z0-9]{1,128}$/;

exports.handler = async function (event) {
  if (!(await AUTH.autorizar(event))) return resposta(401, { erro: "Segredo de administrador ausente ou incorreto." });
  try {
    app();
    const db = admin.firestore(), col = (n) => db.collection(n), hoje = H.hojeBR();
    if (event.httpMethod === "GET") {
      const cache = {}, perfis = [];
      for (const d of (await col("hubProfissionais").get()).docs) {
        const p = d.data();
        if (!(p.orgId in cache)) { const s = await col("orgs").doc(p.orgId || "x").collection("meta").doc("info").get(); cache[p.orgId] = H.assinaturaAtiva(s.exists ? s.data() : {}, hoje); }
        const est = H.estadoEfetivo(p, cache[p.orgId]);
        perfis.push({ uid: d.id, nome: p.nomeProfissional || "(sem nome)", cidade: p.cidade || "", estado: est, rotulo: H.ROTULO_PERFIL[est], verificado: !!(p.verificacao && p.verificacao.verificado),
          moderacao: p.moderacao || null, metricas: p.metricas || {}, servicos: (p.servicos || []).length });
      }
      const porEstado = {}; for (const p of perfis) porEstado[p.estado] = (porEstado[p.estado] || 0) + 1;
      const pedidos = { total: 0, porEstado: {} };
      for (const d of (await col("hubPedidos").get()).docs) { const e = d.data().estado; pedidos.total++; pedidos.porEstado[e] = (pedidos.porEstado[e] || 0) + 1; }
      const dias = (await col("hubMetricas").get()).docs.map((d) => ({ dia: d.id, ...d.data() })).sort((a, b) => a.dia.localeCompare(b.dia));
      const soma = {};
      for (const d of dias) for (const [k, v] of Object.entries(d)) if (k !== "dia" && typeof v === "number") soma[k] = (soma[k] || 0) + v;
      const denuncias = (await col("hubDenuncias").get()).docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.em).localeCompare(String(a.em))).slice(0, 100)
        .map((x) => ({ id: x.id, tipo: x.tipo, alvo: x.alvo, conteudo: x.conteudo, motivo: H.MOTIVOS_DENUNCIA[x.motivo] || x.motivo, texto: x.texto, em: x.em, estado: x.estado, decisao: x.decisao || null }));
      return resposta(200, {
        indicadores: {
          perfisPublicados: porEstado.publicado || 0, perfisPorEstado: porEstado, visualizacoes: soma.visualizacoes || 0, buscas: soma.buscas || 0, buscasComResultado: (soma.buscas || 0) - (soma.buscasSemResultado || 0),
          buscasSemResultado: soma.buscasSemResultado || 0, pedidos: soma.pedidos || 0, respostas: soma.respostas || 0, propostas: soma.propostas || 0, aceites: soma.aceites || 0, concluidos: soma.concluidos || 0,
          primeiraRespostaMediaMin: soma.respostas ? Math.round((soma.minPrimeiraResposta || 0) / soma.respostas) : null,
        },
        porDia: dias.slice(-60), pedidos, perfis, denuncias,
      });
    }
    if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });
    let b;
    try { b = JSON.parse(event.body || "{}"); } catch (e) { return resposta(400, { erro: "Pedido inválido." }); }
    const motivo = H.txt(b.motivo, 500, true);
    if (!motivo) return resposta(400, { erro: "Registre o motivo da decisão." });
    const reg = (lista, acao) => [...(lista || []).slice(-40), { em: H.agora(), acao, motivo }];

    if (["suspender", "reativar", "verificar", "removerVerificacao"].includes(b.acao)) {
      if (!UID.test(String(b.uid || ""))) return resposta(400, { erro: "Perfil inválido." });
      const ref = col("hubProfissionais").doc(b.uid), s = await ref.get();
      if (!s.exists) return resposta(404, { erro: "Perfil não encontrado." });
      const p = s.data(), m = p.moderacao || {};
      if (b.acao === "suspender") await ref.set({ moderacao: { ...m, suspenso: true, em: H.agora(), motivoPublico: H.txt(b.motivoPublico, 200) || "Perfil em análise pela moderação.", historico: reg(m.historico, "suspenso") } }, { merge: true });
      if (b.acao === "reativar") await ref.set({ moderacao: { ...m, suspenso: false, em: H.agora(), historico: reg(m.historico, "reativado") } }, { merge: true });
      if (b.acao === "verificar") {
        const itens = (Array.isArray(b.itens) ? b.itens : []).map((x) => H.txt(x, 80)).filter(Boolean).slice(0, 5);
        if (!itens.length) return resposta(400, { erro: "Diga o que foi conferido (ex.: formação, registro profissional)." });
        await ref.set({ verificacao: { verificado: true, em: H.agora(), itens }, moderacao: { ...m, historico: reg(m.historico, "verificado: " + itens.join(", ")) } }, { merge: true });
      }
      if (b.acao === "removerVerificacao") await ref.set({ verificacao: { verificado: false, em: H.agora(), itens: [] }, moderacao: { ...m, historico: reg(m.historico, "verificação removida") } }, { merge: true });
      return resposta(200, { ok: true });
    }
    if (b.acao === "ocultarAvaliacao" || b.acao === "mostrarAvaliacao") {
      const ref = col("hubAvaliacoes").doc(String(b.avaliacaoId || "x")), s = await ref.get();
      if (!s.exists) return resposta(404, { erro: "Avaliação não encontrada." });
      await ref.set({ oculta: b.acao === "ocultarAvaliacao", moderacao: reg((s.data().moderacao || []), b.acao) }, { merge: true });
      if (b.denunciaId) await col("hubDenuncias").doc(String(b.denunciaId)).set({ estado: "resolvida", decisao: b.acao === "ocultarAvaliacao" ? "avaliação ocultada" : "avaliação mantida", motivoDecisao: motivo, resolvidaEm: H.agora() }, { merge: true });
      return resposta(200, { ok: true });
    }
    if (b.acao === "ocultarMensagem" || b.acao === "resolverDenuncia") {
      const ref = col("hubDenuncias").doc(String(b.denunciaId || "x")), s = await ref.get();
      if (!s.exists) return resposta(404, { erro: "Denúncia não encontrada." });
      const dn = s.data();
      if (b.acao === "ocultarMensagem") {
        if (dn.tipo !== "mensagem") return resposta(400, { erro: "Esta denúncia não é de uma mensagem." });
        const mref = col("hubPedidos").doc(dn.alvo.pedidoId).collection("mensagens").doc(dn.alvo.mensagemId);
        if (!(await mref.get()).exists) return resposta(404, { erro: "Mensagem não encontrada." });
        await mref.set({ oculta: true, ocultaEm: H.agora(), ocultaMotivo: motivo }, { merge: true });
        await ref.set({ estado: "resolvida", decisao: "mensagem ocultada", motivoDecisao: motivo, resolvidaEm: H.agora() }, { merge: true });
        return resposta(200, { ok: true });
      }
      const decisao = H.txt(b.decisao, 120) || "sem ação";
      await ref.set({ estado: "resolvida", decisao, motivoDecisao: motivo, resolvidaEm: H.agora() }, { merge: true });
      return resposta(200, { ok: true });
    }
    return resposta(400, { erro: "Ação desconhecida." });
  } catch (e) {
    console.error("admin-hub:", e && e.message);
    return resposta(500, { erro: "Não foi possível concluir agora." });
  }
};
