/* QuadraLab Scout: análise de movimento (biomecânica) de cada atleta da conta. A análise roda no celular (o vídeo não é enviado);
   aqui ficam o resumo, o relatório completo e o trecho do golpe, com as mesmas regras e limites do Player (_player-movimento.js):
   no plano grátis, 1 análise de cada golpe (forehand, backhand e saque) por conta; no Scout Plus e no acesso completo, sem limite.

   GET ?atleta=<id>                            → { analises: [resumos do atleta, mais antigos primeiro], cota }
   GET ?id=mv…                                 → { relatorio }       GET ?clip=mv… → { clip }
   POST { acao: "salvar", atletaId, resumo }   → { ok, cota }       (conta no limite do grátis se for nova)
   POST { acao: "relatorio", id, relatorio }   → { ok }             POST { acao: "clip", id, clip } → { ok }
   POST { acao: "remover", id }                → { ok }             (o uso do grátis continua contado)
   Firestore: scoutAppContas/{uid}/movimentos/{id} → { resumo, atletaId, golpe, criadoEm, relatorio? }; .../movimentoClips/{id} → { clip };
   o uso do grátis fica em scoutAppContas/{uid}.movimentoUso. */
const { admin, app } = require("./_firebase-admin");
const MV = require("./_player-movimento");
const { planoFull } = require("./_player");
const R = require("./_scout-app");

function resposta(statusCode, corpo) { return { statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(corpo) }; }
const nivel = (conta) => (R.plusAtivo(conta, false) ? "plus" : "gratis");

exports.handler = async function (event) {
  try {
    app();
    const cab = event.headers.authorization || event.headers.Authorization || "";
    const idToken = cab.startsWith("Bearer ") ? cab.slice(7) : null;
    if (!idToken) return resposta(401, { erro: "Entre na sua conta para continuar." });
    let tk; try { tk = await admin.auth().verifyIdToken(idToken); } catch (e) { return resposta(401, { erro: "Sua sessão expirou. Entre de novo." }); }
    const db = admin.firestore(), ref = db.collection("scoutAppContas").doc(tk.uid), col = ref.collection("movimentos"), clips = ref.collection("movimentoClips");
    const full = planoFull(tk.email);
    const sConta = await ref.get();
    if (!sConta.exists) return resposta(404, { erro: "Abra o app uma vez para criar a sua conta do Scout." });
    const conta = sConta.data(), atletas = new Set((conta.atletas || []).map((a) => a.id));

    if (event.httpMethod === "GET") {
      const q = event.queryStringParameters || {};
      if (q.clip || q.id) {
        const id = String(q.clip || q.id);
        if (!MV.ID_ANALISE.test(id)) return resposta(400, { erro: "Análise inválida." });
        if (q.clip) { const c = await clips.doc(id).get(); let clip = null; try { clip = c.exists ? JSON.parse(c.data().clip) : null; } catch (e) { clip = null; } return resposta(200, { clip }); }
        const d = await col.doc(id).get();
        if (!d.exists) return resposta(404, { erro: "Análise não encontrada." });
        let relatorio = null; try { relatorio = d.data().relatorio ? JSON.parse(d.data().relatorio) : null; } catch (e) { relatorio = null; }
        return resposta(200, { relatorio });
      }
      const atleta = String(q.atleta || "");
      if (!atletas.has(atleta)) return resposta(404, { erro: "Atleta não encontrado na conta." });
      const s = await col.get(), analises = [];
      s.forEach((d) => { const x = d.data(); if (x.atletaId === atleta && x.resumo) analises.push(x.resumo); });
      analises.sort((a, b) => String(a.criadoEm).localeCompare(String(b.criadoEm)));
      return resposta(200, { analises, cota: MV.cota(conta, { nivel: nivel(conta), full }) });
    }
    if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });
    if (String(event.body || "").length > 2 * MV.MAX_RELATORIO) return resposta(413, { erro: "Pedido grande demais." });
    let b; try { b = JSON.parse(event.body || "{}"); } catch (e) { return resposta(400, { erro: "Pedido inválido." }); }

    if (b.acao === "salvar") {
      const resumo = MV.limparResumo(b.resumo);
      if (!resumo) return resposta(400, { erro: "Análise inválida." });
      if (!atletas.has(String(b.atletaId))) return resposta(400, { erro: "Atleta não encontrado na conta." });
      const agora = new Date().toISOString();
      const saida = await db.runTransaction(async (tx) => {
        const [sc, doc, todas] = await Promise.all([tx.get(ref), tx.get(col.doc(resumo.id)), tx.get(col)]);
        const dados = sc.data() || {};
        if (doc.exists && doc.data().resumo && doc.data().resumo.golpe !== resumo.golpe) throw new R.ErroPedido(400, "Análise inválida.");
        const av = MV.avaliarSalvar(dados, { nivel: nivel(dados), full, golpe: resumo.golpe, novo: !doc.exists, total: todas.docs.length });
        if (!av.ok) throw new R.ErroPedido(av.status, av.mensagem.replace("amplie o plano", "assine o Scout Plus"));
        if (doc.exists) tx.update(col.doc(resumo.id), { resumo, atualizadoEm: agora });
        else tx.set(col.doc(resumo.id), { resumo, atletaId: String(b.atletaId), golpe: resumo.golpe, criadoEm: agora });
        let uso = MV.usoDe(dados);
        if (av.conta) { uso = { ...uso, [resumo.golpe]: uso[resumo.golpe] + 1 }; tx.set(ref, { movimentoUso: uso }, { merge: true }); }
        return MV.cota({ ...dados, movimentoUso: uso }, { nivel: nivel(dados), full });
      });
      return resposta(200, { ok: true, cota: saida });
    }
    if (b.acao === "relatorio" || b.acao === "clip" || b.acao === "remover") {
      const id = String(b.id || "");
      if (!MV.ID_ANALISE.test(id)) return resposta(400, { erro: "Análise inválida." });
      const d = col.doc(id), existe = (await d.get()).exists;
      if (b.acao === "remover") { if (existe) await d.delete(); await clips.doc(id).delete().catch(() => {}); return resposta(200, { ok: true }); }
      if (!existe) return resposta(404, { erro: "Salve a análise antes." });
      if (b.acao === "relatorio") {
        if (!MV.relatorioValido(b.relatorio, id)) return resposta(400, { erro: "Relatório inválido ou grande demais." });
        await d.update({ relatorio: b.relatorio, relatorioEm: new Date().toISOString() });
      } else {
        if (!MV.clipValido(b.clip)) return resposta(400, { erro: "Trecho inválido ou grande demais." });
        await clips.doc(id).set({ clip: b.clip, em: new Date().toISOString() });
      }
      return resposta(200, { ok: true });
    }
    return resposta(400, { erro: "Ação desconhecida." });
  } catch (e) {
    if (e instanceof R.ErroPedido) return resposta(e.status, { erro: e.message });
    console.error("scout-app-movimento:", e && e.message);
    return resposta(500, { erro: "Não foi possível concluir agora. Tente de novo em instantes." });
  }
};
