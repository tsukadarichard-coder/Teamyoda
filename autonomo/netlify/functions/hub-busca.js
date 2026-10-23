/* QuadraLab Hub — "Encontrar um treinador" (Player e Competição).

   GET ?catalogos=1                       → listas de filtros (sem login)
   GET ?foto=<uid>                        → foto do profissional, só enquanto o perfil está visível (sem login, para <img>)
   GET ?modo=player|competicao&filtros    → cartões dos profissionais visíveis (login)
   GET ?perfil=<uid>&modo=                → perfil público, avaliações visíveis e se dá para pedir (login)

   Ordem: compatibilidade com os filtros e o foco do app, disponibilidade declarada e completude do perfil.
   Nunca entra na ordem: plano pago, patrocínio, destaque comprado ou preço mais baixo. */
const { ErroPublico, resposta, usuarioDoPedido } = require("./_player");
const H = require("./_hub");
const D = require("./_hub-dados");

async function visiveis(hoje) {
  const cache = {}, out = [];
  for (const d of (await D.col("hubProfissionais").where("estado", "==", "publicado").get()).docs) {
    const p = d.data();
    if (p.moderacao && p.moderacao.suspenso) continue;
    const el = await D.elegivel(p.orgId, hoje, cache);
    if (!el) continue;
    out.push({ uid: d.id, p, elegivel: el, temFoto: !!p.fotoVersao && (await D.temFoto(d.id)) });
  }
  return out;
}

async function avaliacoesVisiveis(uid) {
  const l = (await D.col("hubAvaliacoes").where("profissionalUid", "==", uid).get()).docs.map((d) => ({ id: d.id, ...d.data() })).filter((a) => !a.oculta);
  l.sort((a, b) => String(b.em).localeCompare(String(a.em)));
  const media = l.length ? Math.round((10 * l.reduce((s, a) => s + a.nota, 0)) / l.length) / 10 : null;
  return {
    media, total: l.length,
    itens: l.slice(0, 20).map((a) => ({ id: a.id, nota: a.nota, comentario: a.comentario || "", autor: a.autorNome || "Jogador", servico: a.servicoNome || "", em: a.em,
      origem: "Avaliação de um atendimento concluído e confirmado na plataforma", resposta: a.resposta && !a.resposta.oculta ? { texto: a.resposta.texto, em: a.resposta.em } : null })),
  };
}

exports.handler = async function (event) {
  try {
    if (event.httpMethod !== "GET") return resposta(405, { erro: "Método não permitido." });
    const q = event.queryStringParameters || {}, hoje = H.hojeBR();
    if (q.catalogos) {
      return resposta(200, { categorias: H.CATEGORIAS, publicos: H.PUBLICOS, niveis: H.NIVEIS, objetivos: Object.fromEntries(Object.entries(H.OBJETIVOS).map(([k, v]) => [k, v.nome])),
        unidades: H.UNIDADES, dias: H.DIAS, turnos: H.TURNOS, motivosDenuncia: H.MOTIVOS_DENUNCIA, textos: { envio: H.TEXTO_ENVIO, enviado: H.TEXTO_ENVIADO, aceite: H.TEXTO_ACEITE } });
    }
    if (q.foto) {
      const uid = String(q.foto);
      if (!/^[A-Za-z0-9]{1,128}$/.test(uid)) return { statusCode: 404, body: "" };
      const p = await D.perfil(uid);
      if (!p || !H.visivelNaBusca(p, await D.elegivel(p.orgId, hoje))) return { statusCode: 404, body: "" };
      const f = await D.col("hubFotos").doc(uid).get();
      const m = f.exists && /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(f.data().dataUrl || "");
      if (!m) return { statusCode: 404, body: "" };
      return { statusCode: 200, headers: { "content-type": m[1], "cache-control": "public, max-age=600", "x-content-type-options": "nosniff" }, body: m[2], isBase64Encoded: true };
    }
    const u = await usuarioDoPedido(event);
    const modo = q.modo === "competicao" ? "competicao" : "player";

    if (q.perfil) {
      const uid = String(q.perfil);
      const p = /^[A-Za-z0-9]{1,128}$/.test(uid) ? await D.perfil(uid) : null;
      const el = p ? await D.elegivel(p.orgId, hoje) : false;
      const proprio = uid === u.uid;
      if (!p || (!H.visivelNaBusca(p, el) && !proprio)) throw new ErroPublico(404, "Este perfil não está disponível no momento.");
      if (!proprio) { await D.metricaProfissional(uid, { visualizacoes: 1 }); await D.metrica({ visualizacoes: 1 }); }
      const av = await avaliacoesVisiveis(uid);
      const meus = (await D.col("hubPedidos").where("profissionalUid", "==", uid).get()).docs
        .filter((d) => H.ABERTOS.includes(d.data().estado) && [d.data().contratanteUid, d.data().solicitanteUid, d.data().atletaUid].includes(u.uid)).map((d) => ({ id: d.id, estado: d.data().estado, rotulo: H.ESTADOS_PEDIDO[d.data().estado], atletaNome: d.data().atletaNome }));
      return resposta(200, {
        perfil: H.perfilPublico(uid, p, { temFoto: !!p.fotoVersao && (await D.temFoto(uid)), avaliacoes: av.itens, media: av.media }),
        totalAvaliacoes: av.total, recebePedidos: H.recebePedidos(p, el), bloqueado: await D.bloqueado(uid, [u.uid]), pedidosAbertos: meus, proprio,
      });
    }

    const f = H.normFiltros(q, modo);
    const lista = H.buscar(await visiveis(hoje), f, hoje);
    await D.metrica(lista.length ? { buscas: 1 } : { buscas: 1, buscasSemResultado: 1 });
    return resposta(200, {
      resultados: lista.slice(0, 60), total: lista.length, filtros: f,
      avisoPreco: f.precoMaxCentavos != null ? "O filtro de preço compara só valores " + H.UNIDADES[f.unidade] + ". Serviços sob consulta ou com outra unidade ficam de fora." : null,
    });
  } catch (e) {
    if (e instanceof ErroPublico) return resposta(e.status, { erro: e.message });
    console.error("hub-busca:", e && e.message);
    return resposta(500, { erro: "Não foi possível buscar agora. Tente de novo em instantes." });
  }
};
