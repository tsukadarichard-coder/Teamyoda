/* Corrige um cadastro de treinador que "sumiu" — a conta foi criada em
   solicitar-acesso.html, mas com o identificador da academia errado
   (digitado errado), então o pedido ficou pendurado numa organização
   que o coordenador não enxerga. Como o e-mail já está em uso, o
   treinador não consegue tentar de novo sozinho (auth/email-already-in-use).

   Aqui o coordenador resolve pelo próprio e-mail do treinador: vincula
   a conta dele à academia certa direto, sem precisar achar o pedido
   antigo perdido em outro lugar. */
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
    return resposta(403, { erro: "Só o coordenador da academia pode corrigir um cadastro." });
  }

  let corpo;
  try { corpo = JSON.parse(event.body || "{}"); }
  catch (e) { return resposta(400, { erro: "Corpo da requisição inválido." }); }

  const email = (corpo.email || "").trim();
  if (!email) return resposta(400, { erro: "Faltou o e-mail do treinador." });

  try {
    const usuario = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(usuario.uid, { orgId: claims.orgId, role: "treinador" });
    await admin.firestore().collection("orgs").doc(claims.orgId).collection("solicitacoes").doc(usuario.uid)
      .set({
        nome: usuario.displayName || email, email,
        status: "aprovada", corrigidaEm: new Date().toISOString(),
      }, { merge: true });

    return resposta(200, { ok: true });
  } catch (e) {
    if (e.code === "auth/user-not-found") {
      return resposta(404, { erro: "Não existe nenhuma conta com esse e-mail." });
    }
    return resposta(500, { erro: String(e.message || e) });
  }
};

function resposta(statusCode, corpo) {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) };
}
