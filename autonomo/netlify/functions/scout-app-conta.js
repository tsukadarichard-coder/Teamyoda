/* QuadraLab Scout: criação de conta (e-mail e senha), pelo Admin SDK, como no Player.
   POST { nome, email, senha, papel } → { ok }. A conta nasce com a claim tipo "scout" (sem orgId: nenhuma regra de academia vale para ela)
   e com scoutAppContas/{uid} pronto. Quem já tem conta no QuadraLab (Player, Competição, Treinador) entra com a mesma senha:
   o documento do Scout é criado no primeiro acesso (scout-app.js). Depois de criada, o app entra com signInWithEmailAndPassword. */
const { admin, app } = require("./_firebase-admin");
const R = require("./_scout-app");

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function resposta(statusCode, corpo) { return { statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(corpo) }; }

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });
  if (String(event.body || "").length > 2000) return resposta(413, { erro: "Pedido grande demais." });
  let b; try { b = JSON.parse(event.body || "{}"); } catch (e) { return resposta(400, { erro: "Pedido inválido." }); }
  try {
    const p = R.perfil(b);
    const email = String(b.email || "").trim().toLowerCase().slice(0, 120), senha = String(b.senha || "");
    if (!EMAIL.test(email)) return resposta(400, { erro: "Informe um e-mail válido." });
    if (senha.length < 8) return resposta(400, { erro: "A senha precisa ter pelo menos 8 caracteres." });
    app();
    let u;
    try { u = await admin.auth().createUser({ email, password: senha, displayName: p.nome }); }
    catch (e) {
      if (e.code === "auth/email-already-exists") return resposta(409, { erro: "Este e-mail já tem uma conta no QuadraLab. Use \"Entrar\" com a mesma senha." });
      if (e.code === "auth/invalid-password") return resposta(400, { erro: "A senha precisa ter pelo menos 8 caracteres." });
      if (e.code === "auth/invalid-email") return resposta(400, { erro: "Informe um e-mail válido." });
      throw e;
    }
    await admin.auth().setCustomUserClaims(u.uid, { tipo: "scout" });
    const agora = new Date().toISOString();
    await admin.firestore().collection("scoutAppContas").doc(u.uid).set({ ...R.contaNova({ email, name: p.nome }, agora), ...p });
    return resposta(200, { ok: true });
  } catch (e) {
    if (e instanceof R.ErroPedido) return resposta(e.status, { erro: e.message });
    console.error("scout-app-conta:", e && e.message);
    return resposta(500, { erro: "Não foi possível criar a conta agora. Tente de novo em instantes." });
  }
};
