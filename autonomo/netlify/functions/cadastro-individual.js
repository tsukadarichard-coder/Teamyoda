/* Autocadastro do treinador independente — sem coordenador, sem convite,
   sem segredo de admin. Diferente de solicitar-acesso.html (que entra
   numa academia que já existe) e de provisionar-org (que só o admin
   roda manualmente): aqui a pessoa cria a própria academia, sozinha,
   na hora, e já é a "coordenador" dela — porque não existe ninguém
   acima pra aprovar.

   Fica marcada como conta individual no plano "gratis" (orgs/{org}/meta/info).
   É o único lugar que decide os limites do plano — o app lê esse campo,
   nunca decide sozinho. */
const { admin, app } = require("./_firebase-admin");

function apelido(nome) {
  return String(nome || "treinador")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30) || "treinador";
}
function sufixo() {
  return Math.random().toString(36).slice(2, 7);
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });

  let corpo;
  try { corpo = JSON.parse(event.body || "{}"); }
  catch (e) { return resposta(400, { erro: "Corpo da requisição inválido." }); }

  const nome = String(corpo.nome || "").trim();
  const email = String(corpo.email || "").trim();
  const senha = String(corpo.senha || "");
  if (!nome || !email || !senha) return resposta(400, { erro: "Faltou nome, e-mail ou senha." });
  if (senha.length < 6) return resposta(400, { erro: "A senha precisa de pelo menos 6 caracteres." });

  try {
    app();

    try {
      await admin.auth().getUserByEmail(email);
      return resposta(409, { erro: "Já existe uma conta com este e-mail. Se já é sua, entre na tela principal." });
    } catch (e) {
      if (e.code !== "auth/user-not-found") throw e;
    }

    const usuario = await admin.auth().createUser({ email, password: senha, displayName: nome });

    const base = apelido(nome);
    const db = admin.firestore();
    let orgId = null;
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const candidato = base + "-" + sufixo();
      const doc = await db.collection("orgs").doc(candidato).collection("meta").doc("info").get();
      if (!doc.exists) { orgId = candidato; break; }
    }
    if (!orgId) throw new Error("Não consegui gerar um identificador único — tente de novo.");

    await admin.auth().setCustomUserClaims(usuario.uid, { orgId, role: "coordenador" });
    await db.collection("orgs").doc(orgId).collection("meta").doc("info").set({
      nome: nome, individual: true, plano: "gratis",
      criadoEm: new Date().toISOString(),
    });
    await db.collection("orgs").doc(orgId).collection("solicitacoes").doc(usuario.uid).set({
      nome: nome, email: email, status: "aprovada", role: "coordenador", criadoEm: new Date().toISOString(),
    });

    return resposta(200, { ok: true, orgId, email });
  } catch (e) {
    return resposta(500, { erro: String(e.message || e) });
  }
};

function resposta(statusCode, corpo) {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) };
}
