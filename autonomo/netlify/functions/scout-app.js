/* QuadraLab Scout: conta, atletas e jogos na nuvem, e o link ao vivo para a família. Sempre com login (Firebase do QuadraLab).

   GET                                          → { conta, atletas, jogos: [{ id, atletaId, atualizadoEm }], apagados }
   POST { acao: "perfil", nome, papel }         → { conta }
   POST { acao: "atletas", atletas }            → { atletas } (a lista inteira; jogos de atleta que saiu continuam até o app apagar)
   POST { acao: "salvarJogos", jogos: [...] }   → { salvos: [id], antigos: [id] } (até 10; o mais novo por atualizadoEm vence)
   POST { acao: "baixar", ids: [...] }          → { jogos: [...] } (até 40)
   POST { acao: "apagarJogo", id }              → { ok } (encerra o link ao vivo do jogo, se houver)
   POST { acao: "aoVivo", jogoId, resumo, fim } → { token, expiraEm } (cria ou atualiza; a família abre /scout/?l=<token>)
   POST { acao: "encerrarAoVivo", jogoId }      → { ok }
   Regras e formatos em _scout-app.js. O link ao vivo usa a mesma coleção e a mesma página da família do scout do treinador (scoutsAoVivo),
   com dono "app:<uid>", e o resumo passa por limpar(): primeiro nome, placar e números, nunca adversário nem anotações. */
const crypto = require("crypto");
const { admin, app } = require("./_firebase-admin");
const R = require("./_scout-app");
const { limpar } = require("./_scout-publico");

const VALIDADE_MS = 12 * 3600 * 1000, APOS_FIM_MS = 2 * 3600 * 1000, MAX_AO_VIVO = 3;
const TOKEN = /^[a-f0-9]{32}$/;

function resposta(statusCode, corpo) { return { statusCode, headers: { "content-type": "application/json", "cache-control": "no-store", "x-robots-tag": "noindex" }, body: JSON.stringify(corpo) }; }
const agora = () => new Date().toISOString();

async function usuario(event) {
  const cab = event.headers.authorization || event.headers.Authorization || "";
  const idToken = cab.startsWith("Bearer ") ? cab.slice(7) : null;
  if (!idToken) throw new R.ErroPedido(401, "Entre na sua conta para continuar.");
  try { return await admin.auth().verifyIdToken(idToken); } catch (e) { throw new R.ErroPedido(401, "Sua sessão expirou. Entre de novo."); }
}
const lerJogo = (snap) => { try { return JSON.parse(snap.data().dados); } catch (e) { return null; } };

exports.handler = async function (event) {
  try {
    app();
    const db = admin.firestore(), tk = await usuario(event), uid = tk.uid;
    const refConta = db.collection("scoutAppContas").doc(uid), jogos = refConta.collection("jogos");
    let sConta = await refConta.get(), conta = sConta.exists ? sConta.data() : null;
    if (!conta) { conta = R.contaNova(tk, agora()); await refConta.set(conta); }

    if (event.httpMethod === "GET") {
      const s = await jogos.get(), lista = [];
      s.forEach((d) => { const x = d.data(); lista.push({ id: d.id, atletaId: x.atletaId, atualizadoEm: x.atualizadoEm }); });
      return resposta(200, { conta: R.contaPublica(conta), atletas: conta.atletas || [], jogos: lista, apagados: conta.apagados || [] });
    }
    if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });
    if (String(event.body || "").length > 3000000) return resposta(413, { erro: "Pedido grande demais." });
    let b; try { b = JSON.parse(event.body || "{}"); } catch (e) { return resposta(400, { erro: "Pedido inválido." }); }

    if (b.acao === "perfil") {
      const p = R.perfil(b); await refConta.update({ ...p, atualizadoEm: agora() });
      return resposta(200, { conta: R.contaPublica({ ...conta, ...p }) });
    }
    if (b.acao === "atletas") {
      const lista = R.atletas(b.atletas); await refConta.update({ atletas: lista, atualizadoEm: agora() });
      return resposta(200, { atletas: lista });
    }
    if (b.acao === "salvarJogos") {
      if (!Array.isArray(b.jogos) || !b.jogos.length || b.jogos.length > R.MAX_LOTE) throw new R.ErroPedido(400, "Envie de 1 a " + R.MAX_LOTE + " jogos por vez.");
      const ids = new Set((conta.atletas || []).map((a) => a.id)), apagados = new Set((conta.apagados || []).map((x) => x.id));
      const limpos = b.jogos.map((j) => R.jogo(j, ids));
      const existentes = await Promise.all(limpos.map((j) => jogos.doc(j.id).get()));
      const novos = existentes.filter((s) => !s.exists).length;
      if (novos) { const total = (await jogos.get()).size; if (total + novos > R.MAX_JOGOS) throw new R.ErroPedido(409, "Limite de " + R.MAX_JOGOS + " jogos por conta. Apague jogos antigos para guardar novos."); }
      const salvos = [], antigos = [];
      for (let i = 0; i < limpos.length; i++) {
        const j = limpos[i], s = existentes[i];
        if (apagados.has(j.id)) { antigos.push(j.id); continue; }
        if (s.exists && String(s.data().atualizadoEm) >= j.atualizadoEm) { antigos.push(j.id); continue; }
        await jogos.doc(j.id).set({ atletaId: j.atletaId, atualizadoEm: j.atualizadoEm, dados: JSON.stringify(j), ...(s.exists && s.data().aoVivo ? { aoVivo: s.data().aoVivo } : {}) });
        salvos.push(j.id);
      }
      return resposta(200, { salvos, antigos });
    }
    if (b.acao === "baixar") {
      const ids = (Array.isArray(b.ids) ? b.ids : []).filter((x) => R.ID_JOGO.test(String(x))).slice(0, R.MAX_BAIXAR);
      const snaps = await Promise.all(ids.map((id) => jogos.doc(id).get()));
      return resposta(200, { jogos: snaps.filter((s) => s.exists).map(lerJogo).filter(Boolean) });
    }
    if (b.acao === "apagarJogo") {
      if (!R.ID_JOGO.test(String(b.id))) throw new R.ErroPedido(400, "Jogo inválido.");
      const s = await jogos.doc(b.id).get();
      if (s.exists && s.data().aoVivo && TOKEN.test(s.data().aoVivo.token)) { try { await db.collection("scoutsAoVivo").doc(s.data().aoVivo.token).delete(); } catch (e) { /* segue */ } }
      if (s.exists) await jogos.doc(b.id).delete();
      await refConta.update({ apagados: R.comApagado(conta.apagados, b.id, agora()), atualizadoEm: agora() });
      return resposta(200, { ok: true });
    }
    if (b.acao === "aoVivo" || b.acao === "encerrarAoVivo") {
      if (!R.ID_JOGO.test(String(b.jogoId))) throw new R.ErroPedido(400, "Jogo inválido.");
      const refJ = jogos.doc(b.jogoId), sJ = await refJ.get();
      if (!sJ.exists) throw new R.ErroPedido(404, "Salve o jogo na conta antes de abrir o link ao vivo.");
      const atual = sJ.data().aoVivo, col = db.collection("scoutsAoVivo"), dono = "app:" + uid;
      let sAv = atual && TOKEN.test(atual.token) ? await col.doc(atual.token).get() : null;
      if (sAv && (!sAv.exists || sAv.data().orgId !== dono)) sAv = null;
      if (b.acao === "encerrarAoVivo") {
        if (sAv) await col.doc(atual.token).delete();
        await refJ.update({ aoVivo: admin.firestore.FieldValue.delete() });
        return resposta(200, { ok: true });
      }
      if (String(JSON.stringify(b.resumo || {})).length > 120000) throw new R.ErroPedido(413, "Resumo grande demais.");
      const fim = b.fim === true, publico = (aoVivo) => JSON.stringify({ ...limpar(b.resumo || {}), aoVivo, atualizadoEm: agora() });
      if (sAv && Date.parse(sAv.data().expiraEm) > Date.now()) {
        const d = sAv.data(), expiraEm = fim ? new Date(Math.min(Date.parse(d.expiraEm), Date.now() + APOS_FIM_MS)).toISOString() : d.expiraEm;
        await col.doc(atual.token).update({ versao: (d.versao || 1) + 1, expiraEm, publico: publico(!fim) });
        if (expiraEm !== atual.expiraEm) await refJ.update({ aoVivo: { token: atual.token, expiraEm } });
        return resposta(200, { token: atual.token, expiraEm });
      }
      if (fim) return resposta(200, { token: null, expiraEm: null });
      const ativos = (await col.where("orgId", "==", dono).get()).docs.filter((d) => Date.parse(d.data().expiraEm) > Date.now());
      if (ativos.length >= MAX_AO_VIVO) throw new R.ErroPedido(409, "Você já tem " + MAX_AO_VIVO + " links ao vivo abertos. Encerre um jogo antes de abrir outro link.");
      const token = crypto.randomBytes(16).toString("hex"), expiraEm = new Date(Date.now() + VALIDADE_MS).toISOString();
      await col.doc(token).set({ orgId: dono, uid, criadoEm: agora(), expiraEm, versao: 1, publico: publico(true) });
      await refJ.update({ aoVivo: { token, expiraEm } });
      return resposta(200, { token, expiraEm });
    }
    return resposta(400, { erro: "Ação desconhecida." });
  } catch (e) {
    if (e instanceof R.ErroPedido) return resposta(e.status, { erro: e.message });
    console.error("scout-app:", e && e.message);
    return resposta(500, { erro: "Não foi possível concluir agora. Tente de novo em instantes." });
  }
};
