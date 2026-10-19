/* QuadraLab Competição — scouts do treinador importados pelo atleta.

   GET                                  → os scouts importados (cada um reconferido agora: se o treinador desativou o link, só sobra o aviso)
   POST { acao: "importar", link }      → o atleta cola o link de família que o treinador gerou; o servidor confere e guarda uma cópia
   POST { acao: "vincular", id, torneioId?, partidaId? } → liga o scout a um torneio e/ou a uma partida do próprio atleta
   POST { acao: "excluir", id }         → apaga a cópia da conta do atleta

   Segurança:
   · a autorização é a do treinador: só entra quem tem um link válido (token da partida, validade, não revogado). Nada é descoberto por busca;
   · o token fica só no servidor (campo "fonte"): o navegador nunca o recebe de volta, nem nos dados exportados;
   · a cada leitura o link é conferido de novo. Se o treinador desativar ou o link vencer, o conteúdo some da tela do atleta e de quem ele
     compartilhou: a cópia guardada fica sem uso até um novo link ser importado (mesma partida = mesmo registro, sem duplicar);
   · tentativas inválidas por dia são limitadas, e cada atleta só enxerga os próprios scouts. */
const crypto = require("crypto");
const { ErroPublico, resposta, usuarioDoPedido, refJogador } = require("./_player");
const { lerResumoPublico, ID_CURTO, limpar } = require("./_scout-publico");

const MAX_SCOUTS = 100;
const MAX_FALHAS_DIA = 10;
const ID_DOC = /^[A-Za-z0-9]{10,40}$/;
const hojeBR = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

/* aceita o endereço colado (https://…/scout/?org=…&id=…&j=…&t=…). Só os parâmetros são usados: o servidor nunca abre o endereço. */
function lerLink(texto) {
  let u;
  try { u = new URL(String(texto || "").trim()); } catch (e) { return null; }
  if (!/^https?:$/.test(u.protocol) || !/\/scout\/?$/.test(u.pathname)) return null;
  const ref = { org: u.searchParams.get("org"), id: u.searchParams.get("id"), j: u.searchParams.get("j"), t: u.searchParams.get("t") };
  if (![ref.org, ref.id, ref.j].every((v) => v && ID_CURTO.test(v)) || !ref.t || ref.t.length < 16 || ref.t.length > 200) return null;
  return ref;
}
const impressao = (ref) => crypto.createHash("sha256").update([ref.org, ref.id, ref.j].join("|")).digest("hex").slice(0, 32);

/* o que o navegador recebe: nunca "fonte" */
function publico(id, d, resumo) {
  const base = { id, importadoEm: d.importadoEm, torneioId: d.torneioId || null, partidaId: d.partidaId || null, data: d.dataJogo || "", rotulo: d.rotulo || "Partida", origem: d.origem || "link" };
  return resumo ? { ...base, estado: "ativo", ate: resumo.ate, resumo: resumo.publico } : { ...base, estado: "encerrado" };
}

/* lê os scouts do atleta e reconfere cada link (um documento de academia por vez) */
async function scoutsVigentes(refJ, filtro) {
  const snap = await refJ.collection("scouts").get(), cache = new Map(), saida = [];
  for (const doc of snap.docs) {
    const d = doc.data();
    if (filtro && !filtro(d)) continue;
    let r = null;
    /* cópia enviada pelo treinador ou guardada de um jogo ao vivo: não depende de link, fica até o atleta excluir */
    if (d.copia) { try { r = { publico: limpar(JSON.parse(d.copia)), ate: null }; } catch (e) { r = null; } }
    else { try { r = await lerResumoPublico(d.fonte, cache); } catch (e) { r = null; } }
    saida.push(publico(doc.id, d, r));
  }
  saida.sort((a, b) => String(b.data || b.importadoEm).localeCompare(String(a.data || a.importadoEm)));
  return saida;
}

exports.handler = async function (event) {
  try {
    const usuario = await usuarioDoPedido(event);
    const ref = refJogador(usuario.uid), hoje = hojeBR();
    const jog = (await ref.get()).data() || {};
    if (!jog.competicao || jog.competicao.papel !== "atleta") throw new ErroPublico(403, "Os scouts são do atleta. Ative a Competição como atleta.");
    const col = ref.collection("scouts");

    if (event.httpMethod === "GET") return resposta(200, { scouts: await scoutsVigentes(ref) });
    if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });
    let body;
    try { body = JSON.parse(event.body || "{}"); } catch (e) { throw new ErroPublico(400, "Pedido inválido."); }

    if (body.acao === "importar") {
      const falhas = jog.scoutsFalhas && jog.scoutsFalhas.dia === hoje ? jog.scoutsFalhas.n || 0 : 0;
      if (falhas >= MAX_FALHAS_DIA) throw new ErroPublico(429, "Muitas tentativas hoje. Peça um link novo ao treinador ou tente amanhã.");
      const falha = async () => { await ref.set({ scoutsFalhas: { dia: hoje, n: falhas + 1 } }, { merge: true }); throw new ErroPublico(404, "Link inválido ou vencido. Peça um novo ao seu treinador."); };
      const fonte = lerLink(body.link);
      if (!fonte) await falha();
      const resumo = await lerResumoPublico(fonte);
      if (!resumo) await falha();
      const hash = impressao(fonte), existente = await col.where("hash", "==", hash).limit(1).get();
      const agora = new Date().toISOString();
      const dados = { fonte, hash, dataJogo: resumo.publico.data, rotulo: (resumo.publico.torneio || "Partida") + (resumo.publico.resultado ? " · " + resumo.publico.resultado : "") };
      if (!existente.empty) {
        await existente.docs[0].ref.update({ ...dados, atualizadoEm: agora });
        return resposta(200, { ok: true, id: existente.docs[0].id, atualizado: true });
      }
      if ((await col.get()).docs.length >= MAX_SCOUTS) throw new ErroPublico(409, "Você chegou ao limite de " + MAX_SCOUTS + " scouts. Exclua os mais antigos.");
      const n = await col.add({ ...dados, importadoEm: agora, torneioId: null, partidaId: null });
      return resposta(200, { ok: true, id: n.id, atualizado: false });
    }

    if (body.acao === "vincular") {
      if (!ID_DOC.test(String(body.id || ""))) throw new ErroPublico(400, "Scout inválido.");
      const rs = col.doc(body.id);
      if (!(await rs.get()).exists) throw new ErroPublico(404, "Scout não encontrado.");
      const upd = {};
      if (body.torneioId !== undefined) {
        if (body.torneioId && !(await ref.collection("torneios").doc(String(body.torneioId)).get()).exists) throw new ErroPublico(404, "Torneio não encontrado.");
        upd.torneioId = body.torneioId || null;
      }
      if (body.partidaId !== undefined) {
        if (body.partidaId && !(await ref.collection("partidas").doc(String(body.partidaId)).get()).exists) throw new ErroPublico(404, "Partida não encontrada.");
        upd.partidaId = body.partidaId || null;
      }
      if (!Object.keys(upd).length) throw new ErroPublico(400, "Nada para vincular.");
      await rs.update(upd);
      return resposta(200, { ok: true });
    }

    if (body.acao === "excluir") {
      if (!ID_DOC.test(String(body.id || ""))) throw new ErroPublico(400, "Scout inválido.");
      const rs = col.doc(body.id);
      if (!(await rs.get()).exists) throw new ErroPublico(404, "Scout não encontrado.");
      await rs.delete();
      return resposta(200, { ok: true });
    }

    throw new ErroPublico(400, "Ação desconhecida.");
  } catch (e) {
    if (e instanceof ErroPublico) return resposta(e.status, { erro: e.message });
    console.error("player-scouts:", e && e.message);
    return resposta(500, { erro: "Não foi possível concluir agora. Tente de novo em instantes." });
  }
};
module.exports.scoutsVigentes = scoutsVigentes;
