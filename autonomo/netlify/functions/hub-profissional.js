/* QuadraLab Hub — "Meu perfil profissional" (app QuadraLab Treinador).

   GET                                      → perfil, estado efetivo, assinatura (só leitura), o que falta, prévia pública, catálogos e indicadores
   POST { acao: "salvar", perfil }          → grava o rascunho (ou atualiza o perfil publicado, se continuar completo)
   POST { acao: "foto", dataUrl }           → foto JPEG/PNG/WebP pequena (o app reduz antes de enviar)
   POST { acao: "removerFoto" }
   POST { acao: "publicar", confirmo }      → só com assinatura ativa do plano Essencial ou superior + confirmação explícita
   POST { acao: "pausar" } | { acao: "voltarRascunho" }

   Só contas de treinador (claim orgId). Nada aqui cria, altera ou cancela cobrança. */
const { ErroPublico, resposta, usuarioDoPedido } = require("./_player");
const H = require("./_hub");
const D = require("./_hub-dados");

const MAX_FOTO = 280000; // caracteres do data URL (~200 KB)

async function painel(uid, orgId) {
  const hoje = H.hojeBR(), info = await D.infoOrg(orgId), ativa = H.assinaturaAtiva(info, hoje);
  const p = (await D.perfil(uid)) || { estado: "rascunho", servicos: [] }, foto = await D.temFoto(uid);
  const estado = H.estadoEfetivo(p, ativa);
  const abertos = (await D.col("hubPedidos").where("profissionalUid", "==", uid).get()).docs.map((d) => d.data());
  const m = p.metricas || {};
  return {
    perfil: { ...p, metricas: undefined, moderacao: undefined, orgId: undefined },
    estado, rotulo: H.ROTULO_PERFIL[estado], escolha: p.estado || "rascunho",
    suspensao: p.moderacao && p.moderacao.suspenso ? { em: p.moderacao.em, motivo: p.moderacao.motivoPublico || "Perfil em análise pela moderação." } : null,
    assinatura: { ativa, plano: info.plano || "gratis", ate: info.planoAtivoAte || null, publicacaoIncluida: H.PLANOS_COM_PUBLICACAO.includes(info.plano) },
    faltas: H.faltasParaPublicar(p), completude: H.completude(p, foto), temFoto: foto,
    previa: H.perfilPublico(uid, p, { temFoto: foto }),
    indicadores: {
      visualizacoes: m.visualizacoes || 0, pedidos: m.pedidos || 0, respondidos: m.respondidos || 0, propostas: m.propostas || 0, combinados: m.combinados || 0, concluidos: m.concluidos || 0,
      primeiraRespostaMin: m.respondidos ? Math.round((m.minPrimeiraResposta || 0) / m.respondidos) : null,
      abertos: abertos.filter((x) => H.ABERTOS.includes(x.estado) && x.estado !== "aguardando_responsavel").length,
    },
    catalogos: { categorias: H.CATEGORIAS, publicos: H.PUBLICOS, niveis: H.NIVEIS, modalidades: H.MODALIDADES, formatos: H.FORMATOS, unidades: H.UNIDADES, tiposPreco: H.TIPOS_PRECO, exibicao: H.EXIBICAO, dias: H.DIAS, turnos: H.TURNOS },
  };
}

exports.handler = async function (event) {
  try {
    const u = await usuarioDoPedido(event), uid = u.uid, orgId = u.orgId;
    if (!orgId) throw new ErroPublico(403, "O perfil profissional é do QuadraLab Treinador. Entre com a sua conta de treinador.");
    if (event.httpMethod === "GET") return resposta(200, await painel(uid, orgId));
    if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });
    let b;
    try { b = JSON.parse(event.body || "{}"); } catch (e) { throw new ErroPublico(400, "Pedido inválido."); }
    const ref = D.col("hubProfissionais").doc(uid), atual = (await D.perfil(uid)) || { estado: "rascunho", criadoEm: H.agora() };
    const hoje = H.hojeBR(), ativa = H.assinaturaAtiva(await D.infoOrg(orgId), hoje), suspenso = !!(atual.moderacao && atual.moderacao.suspenso);

    if (b.acao === "salvar") {
      const r = H.validarPerfil(b.perfil || {});
      if (!r.ok) return resposta(400, { erro: r.erros[0], erros: r.erros });
      if (atual.estado === "publicado") {
        const f = H.faltasParaPublicar(r.perfil);
        if (f.length) return resposta(409, { erro: "Seu perfil está publicado: para salvar, mantenha preenchido " + f.join(", ") + ". Ou volte para rascunho.", faltas: f });
      }
      await ref.set({ ...r.perfil, orgId, estado: atual.estado || "rascunho", criadoEm: atual.criadoEm || H.agora(), atualizadoEm: H.agora() }, { merge: true });
      return resposta(200, { ok: true, ...(await painel(uid, orgId)) });
    }
    if (b.acao === "foto") {
      const d = String(b.dataUrl || "");
      if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(d)) throw new ErroPublico(400, "Envie uma foto em JPG, PNG ou WebP.");
      if (d.length > MAX_FOTO) throw new ErroPublico(413, "A foto ficou grande demais. Escolha outra ou recorte mais.");
      await D.col("hubFotos").doc(uid).set({ dataUrl: d, em: H.agora() });
      await ref.set({ orgId, fotoVersao: H.idAleatorio(6), estado: atual.estado || "rascunho", criadoEm: atual.criadoEm || H.agora() }, { merge: true });
      return resposta(200, { ok: true });
    }
    if (b.acao === "removerFoto") {
      await D.col("hubFotos").doc(uid).delete();
      return resposta(200, { ok: true });
    }
    if (b.acao === "publicar") {
      if (suspenso) throw new ErroPublico(409, "Seu perfil está suspenso pela moderação e não pode ser publicado agora.");
      if (!ativa) return resposta(402, { erro: "A publicação do perfil faz parte do plano Essencial e superiores. Seu rascunho continua salvo.", semAssinatura: true });
      if (b.confirmo !== true) throw new ErroPublico(400, "Confirme que quer publicar o perfil.");
      const f = H.faltasParaPublicar(atual);
      if (f.length) return resposta(409, { erro: "Antes de publicar, preencha: " + f.join(", ") + ".", faltas: f });
      await ref.set({ estado: "publicado", publicadoEm: H.agora(), consentimentoPublicacao: { em: H.agora(), texto: "Publicar meu perfil profissional no QuadraLab Player e Competição." } }, { merge: true });
      await D.metrica({ publicacoes: 1 });
      return resposta(200, { ok: true, ...(await painel(uid, orgId)) });
    }
    if (b.acao === "pausar" || b.acao === "voltarRascunho") {
      if (!(await D.perfil(uid))) throw new ErroPublico(404, "Crie o perfil primeiro.");
      await ref.set({ estado: b.acao === "pausar" ? "pausado" : "rascunho", pausadoEm: H.agora() }, { merge: true });
      return resposta(200, { ok: true, ...(await painel(uid, orgId)) });
    }
    throw new ErroPublico(400, "Ação desconhecida.");
  } catch (e) {
    if (e instanceof ErroPublico) return resposta(e.status, { erro: e.message });
    console.error("hub-profissional:", e && e.message);
    return resposta(500, { erro: "Não foi possível concluir agora. Tente de novo em instantes." });
  }
};
