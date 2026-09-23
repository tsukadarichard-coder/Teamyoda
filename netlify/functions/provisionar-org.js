/* Onboarding de uma nova academia. Não existe tela de cadastro no app —
   por enquanto, você chama esta function (com o segredo de admin) para
   criar (ou reaproveitar) a conta do treinador e ligá-la a uma
   organização. É o único lugar que atribui orgId a alguém.

   Exemplo:
   curl -X POST https://SEU-SITE.netlify.app/.netlify/functions/provisionar-org \
     -H "content-type: application/json" \
     -H "x-admin-secret: SEU_ADMIN_SECRET" \
     -d '{"orgId":"team-yoda","nomeAcademia":"Team Yoda Tennis Pro","logoUrl":"https://SEU-SITE.netlify.app/assets/logo-team-yoda.jpg","email":"treinador@exemplo.com","senha":"umaSenhaForte123"}'
   logoUrl é opcional — sem ele, a academia vê o próprio nome como logotipo de texto no lugar do logo. */
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

  const { orgId, nomeAcademia, logoUrl, email, senha } = corpo;
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
    await admin.auth().setCustomUserClaims(usuario.uid, { orgId, role: "coordenador" });
    /* nome e logoUrl são a identidade que troca a marca fixa do app
       (Team Yoda) pela da própria academia, assim que ela loga — ver
       o componente Marca no index.html. logoUrl aceita qualquer URL
       pública de imagem, inclusive um asset já hospedado no próprio
       site (ex.: a Team Yoda pode apontar pro próprio logo dela em
       https://SEU-SITE.netlify.app/assets/logo-team-yoda.jpg, sem
       precisar subir nada nem mudar de código). */
    const identidade = { nome: nomeAcademia || orgId, atualizadoEm: new Date().toISOString() };
    if (logoUrl) identidade.logoUrl = logoUrl;
    await admin.firestore().collection("orgs").doc(orgId).collection("meta").doc("info").set(identidade, { merge: true });

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
