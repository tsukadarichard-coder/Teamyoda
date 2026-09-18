/* Aprova um pedido de acesso pendente. Só quem já é coordenador da
   academia pode chamar isso — verificado pela própria claim de quem
   está logado, não por um segredo à parte (diferente de
   provisionar-org, que cria a primeira conta de uma academia nova). */
const { admin, app } = require("./_firebase-admin");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });

  const cabecalho = event.headers.authorization || event.headers.Authorization || "";
  const idToken = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : null;
  if (!idToken) return resposta(401, { erro: "Faltou o login." });

  let claims;
  try {
    app();
    claims = await admin.auth().verifyIdToken(idToken);
  } catch (e) {
    return resposta(401, { erro: "Login inválido ou expirado." });
  }
  if (!claims.orgId || claims.role !== "coordenador") {
    return resposta(403, { erro: "Só o coordenador da academia pode aprovar pedidos." });
  }

  let corpo;
  try { corpo = JSON.parse(event.body || "{}"); }
  catch (e) { return resposta(400, { erro: "Corpo da requisição inválido." }); }

  const { uid } = corpo;
  if (!uid) return resposta(400, { erro: "Faltou o uid do pedido." });

  try {
    const ref = admin.firestore().collection("orgs").doc(claims.orgId).collection("solicitacoes").doc(uid);
    const snap = await ref.get();
    if (!snap.exists) return resposta(404, { erro: "Não encontrei esse pedido." });

    await admin.auth().setCustomUserClaims(uid, { orgId: claims.orgId, role: "treinador" });
    await ref.set({ status: "aprovada", aprovadaEm: new Date().toISOString() }, { merge: true });

    return resposta(200, { ok: true });
  } catch (e) {
    return resposta(500, { erro: String(e.message || e) });
  }
};

function resposta(statusCode, corpo) {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) };
}
