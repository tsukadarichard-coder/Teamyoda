/* Onboarding de uma nova academia. Não existe tela de cadastro no app —
   por enquanto, você chama esta function (com o segredo de admin) para
   criar (ou reaproveitar) a conta do treinador e ligá-la a uma
   organização. É o único lugar que atribui orgId a alguém.

   Exemplo:
   curl -X POST https://SEU-SITE.netlify.app/.netlify/functions/provisionar-org \
     -H "content-type: application/json" \
     -H "x-admin-secret: SEU_ADMIN_SECRET" \
     -d '{"orgId":"team-yoda","nomeAcademia":"Team Yoda Tennis Pro","email":"treinador@exemplo.com","senha":"umaSenhaForte123"}' */
const { admin, app } = require("./_firebase-admin");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return resposta(405, { erro: "Método não permitido." });
  }

  const segredo = event.headers["x-admin-secret"] || event.headers["X-Admin-Secret"];
  if (!segredo || segredo !== process.env.ADMIN_SECRET) {
    return resposta(401, { erro: "Segredo de administrador ausente ou incorreto." });
  }

  let corpo;
  try {
    corpo = JSON.parse(event.body || "{}");
  } catch (e) {
    return resposta(400, { erro: "Corpo da requisição inválido." });
  }

  const { orgId, nomeAcademia, email, senha } = corpo;
  if (!orgId || !email || !senha) {
    return resposta(400, { erro: "Faltou orgId, email ou senha." });
  }
  if (!/^[a-z0-9-]+$/.test(orgId)) {
    return resposta(400, { erro: "orgId só pode ter letras minúsculas, números e hífen." });
  }
  if (String(senha).length < 6) {
    return resposta(400, { erro: "A senha precisa de pelo menos 6 caracteres." });
  }

  try {
    app();
    let usuario;
    try {
      usuario = await admin.auth().getUserByEmail(email);
    } catch (e) {
      usuario = await admin.auth().createUser({ email, password: senha });
    }
    await admin.auth().setCustomUserClaims(usuario.uid, { orgId });
    await admin.firestore().collection("orgs").doc(orgId).collection("meta").doc("info").set({
      nome: nomeAcademia || orgId,
      atualizadoEm: new Date().toISOString(),
    }, { merge: true });

    return resposta(200, {
      ok: true,
      orgId,
      uid: usuario.uid,
      email,
      aviso: "Se a conta já existia e estava logada em algum aparelho, ela só enxerga a academia depois de sair e entrar de novo (o token antigo não carrega a claim nova).",
    });
  } catch (e) {
    return resposta(500, { erro: String(e.message || e) });
  }
};

function resposta(statusCode, corpo) {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) };
}
