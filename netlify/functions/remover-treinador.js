/* Remove o acesso de um treinador aprovado a esta academia. Só quem já
   é coordenador pode chamar isso — mesma checagem de aprovar-treinador,
   pela própria claim de quem está logado. Não apaga a conta do
   Firebase (isso é destrutivo demais e pode ter efeito em outras
   academias dele) — só revoga a claim desta org e marca o pedido como
   removido, o que já basta pra ele sumir de listaProfessores() e parar
   de conseguir ler/escrever os dados desta academia (as regras do
   Firestore checam orgId/role da claim). */
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
    return resposta(403, { erro: "Só o coordenador da academia pode remover treinadores." });
  }

  let corpo;
  try { corpo = JSON.parse(event.body || "{}"); }
  catch (e) { return resposta(400, { erro: "Corpo da requisição inválido." }); }

  const { uid } = corpo;
  if (!uid) return resposta(400, { erro: "Faltou o uid do treinador." });
  if (uid === claims.uid) return resposta(400, { erro: "Você não pode remover a própria conta por aqui." });

  try {
    const ref = admin.firestore().collection("orgs").doc(claims.orgId).collection("solicitacoes").doc(uid);
    const snap = await ref.get();
    if (!snap.exists || snap.data().status !== "aprovada") {
      return resposta(404, { erro: "Não encontrei esse treinador aprovado nesta academia." });
    }

    await admin.auth().setCustomUserClaims(uid, null);
    await ref.set({ status: "removida", removidaEm: new Date().toISOString() }, { merge: true });

    return resposta(200, { ok: true });
  } catch (e) {
    return resposta(500, { erro: String(e.message || e) });
  }
};

function resposta(statusCode, corpo) {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) };
}
