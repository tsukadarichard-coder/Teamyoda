/* Scout ao vivo: a família acompanha a partida enquanto o treinador marca os pontos.

   POST (treinador, com login da academia)
     { acao: "iniciar", resumo }               → cria o link ao vivo e devolve { token, expiraEm }
     { acao: "atualizar", token, resumo, fim? } → troca o resumo publicado pelo mais recente (fim: true marca a partida como encerrada)
     { acao: "revogar", token }                 → apaga o link na hora
   GET ?t=<token>&v=<versão>  (família, sem login) → { versao, publico, aoVivo, expiraEm }, ou { semMudanca: true } se já está na versão v

   Segurança:
   · só uma conta de academia (claim orgId) cria, atualiza ou revoga, e só os links da própria academia;
   · o que a família recebe passa por limpar() (_scout-publico): primeiro nome, números, mapa e momento; nunca adversário, anotações ou caderno;
   · token aleatório de 128 bits, validade de 12 horas (2 horas depois do fim da partida), no máximo 3 links ao vivo por academia, e revogação imediata;
   · a leitura pública nunca é guardada em cache. O resumo é montado no app do treinador a partir dos pontos já marcados. */
const crypto = require("crypto");
const { admin, app } = require("./_firebase-admin");
const { limpar } = require("./_scout-publico");

const VALIDADE_MS = 12 * 3600 * 1000;
const APOS_FIM_MS = 2 * 3600 * 1000; // depois do fim da partida o link ainda vale por 2 horas, para a família ver o resultado final
const MAX_ATIVOS = 3;
const TOKEN = /^[a-f0-9]{32}$/;

function resposta(statusCode, corpo, publico) {
  return { statusCode, headers: { "content-type": "application/json", "cache-control": "no-store", "x-robots-tag": "noindex", "referrer-policy": "no-referrer" }, body: JSON.stringify(corpo) };
}
const agora = () => new Date().toISOString();

exports.handler = async function (event) {
  try {
    app();
    const col = admin.firestore().collection("scoutsAoVivo");

    if (event.httpMethod === "GET") {
      const q = event.queryStringParameters || {};
      const invalido = () => resposta(404, { erro: "Este link foi encerrado ou venceu. Peça um novo ao treinador." });
      if (!TOKEN.test(String(q.t || ""))) return invalido();
      const snap = await col.doc(q.t).get();
      if (!snap.exists) return invalido();
      const d = snap.data();
      if (!(Date.parse(d.expiraEm) > Date.now())) return invalido();
      if (String(q.v || "") === String(d.versao)) return resposta(200, { semMudanca: true, versao: d.versao, aoVivo: !!d.publico.aoVivo });
      return resposta(200, { versao: d.versao, publico: limpar(d.publico), expiraEm: d.expiraEm });
    }
    if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });

    const cab = event.headers.authorization || event.headers.Authorization || "";
    const idToken = cab.startsWith("Bearer ") ? cab.slice(7) : null;
    if (!idToken) return resposta(401, { erro: "Entre na sua conta para compartilhar ao vivo." });
    let claims;
    try { claims = await admin.auth().verifyIdToken(idToken); } catch (e) { return resposta(401, { erro: "Sua sessão expirou. Entre de novo." }); }
    if (!claims.orgId) return resposta(403, { erro: "Esta conta ainda não está ligada a uma academia." });
    if (String(event.body || "").length > 120000) return resposta(413, { erro: "Resumo grande demais." });
    let body;
    try { body = JSON.parse(event.body || "{}"); } catch (e) { return resposta(400, { erro: "Pedido inválido." }); }

    if (body.acao === "iniciar") {
      const ativos = (await col.where("orgId", "==", claims.orgId).get()).docs.filter((d) => Date.parse(d.data().expiraEm) > Date.now());
      if (ativos.length >= MAX_ATIVOS) return resposta(409, { erro: "Sua academia já tem " + MAX_ATIVOS + " links ao vivo abertos. Encerre um antes de abrir outro." });
      const token = crypto.randomBytes(16).toString("hex"), expiraEm = new Date(Date.now() + VALIDADE_MS).toISOString();
      await col.doc(token).set({ orgId: claims.orgId, uid: claims.uid, criadoEm: agora(), expiraEm, versao: 1, publico: { ...limpar(body.resumo), aoVivo: true, atualizadoEm: agora() } });
      return resposta(200, { ok: true, token, expiraEm });
    }

    const token = String(body.token || "");
    if (!TOKEN.test(token)) return resposta(400, { erro: "Link inválido." });
    const ref = col.doc(token), snap = await ref.get();
    /* link de outra academia responde como se não existisse */
    if (!snap.exists || snap.data().orgId !== claims.orgId) return resposta(404, { erro: "Link não encontrado." });
    const d = snap.data();

    if (body.acao === "revogar") { await ref.delete(); return resposta(200, { ok: true }); }
    if (body.acao === "atualizar") {
      if (!(Date.parse(d.expiraEm) > Date.now())) return resposta(410, { erro: "Este link ao vivo venceu. Inicie outro." });
      const fim = body.fim === true;
      const expiraEm = fim ? new Date(Math.min(Date.parse(d.expiraEm), Date.now() + APOS_FIM_MS)).toISOString() : d.expiraEm;
      await ref.update({ versao: d.versao + 1, expiraEm, publico: { ...limpar(body.resumo), aoVivo: !fim, atualizadoEm: agora() } });
      return resposta(200, { ok: true, versao: d.versao + 1 });
    }
    return resposta(400, { erro: "Ação desconhecida." });
  } catch (e) {
    console.error("scout-ao-vivo:", e && e.message);
    return resposta(500, { erro: "Não foi possível concluir agora. Tente de novo em instantes." });
  }
};
