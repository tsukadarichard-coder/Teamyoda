/* QuadraLab Player — criação de conta do jogador (e-mail e senha).

   A conta é criada aqui, pelo Admin SDK, e não pelo navegador: assim ela
   já nasce marcada com a claim tipo: "jogador" e com o documento
   jogadores/{uid} pronto. Essa conta não tem orgId, então as regras do
   Firestore continuam negando a ela qualquer dado de academia. Depois de
   criada, o app entra normalmente com signInWithEmailAndPassword. */
const { admin, app, ErroPublico, resposta, refJogador } = require("./_player");

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });
  try {
    app();
    let body;
    try { body = JSON.parse(event.body || "{}"); }
    catch (e) { throw new ErroPublico(400, "Corpo da requisição inválido."); }

    const nome = String(body.nome || "").trim().slice(0, 80);
    const email = String(body.email || "").trim().toLowerCase().slice(0, 120);
    const senha = String(body.senha || "");
    if (!nome) throw new ErroPublico(400, "Informe seu nome.");
    if (!EMAIL_VALIDO.test(email)) throw new ErroPublico(400, "Informe um e-mail válido.");
    if (senha.length < 8) throw new ErroPublico(400, "A senha precisa ter pelo menos 8 caracteres.");

    let usuario;
    try {
      usuario = await admin.auth().createUser({ email, password: senha, displayName: nome });
    } catch (e) {
      if (e.code === "auth/email-already-exists") {
        throw new ErroPublico(409, "Este e-mail já tem uma conta. Use \"Entrar\" com a sua senha.");
      }
      if (e.code === "auth/invalid-password") throw new ErroPublico(400, "A senha precisa ter pelo menos 8 caracteres.");
      if (e.code === "auth/invalid-email") throw new ErroPublico(400, "Informe um e-mail válido.");
      throw e;
    }

    await admin.auth().setCustomUserClaims(usuario.uid, { tipo: "jogador" });
    await refJogador(usuario.uid).set({
      nome, email,
      criadoEm: new Date().toISOString(),
      planosGratisUsados: 0,
      creditosPlano: 0,
    });

    return resposta(200, { ok: true });
  } catch (e) {
    if (e instanceof ErroPublico) return resposta(e.status, { erro: e.message });
    console.error("player-conta:", e);
    return resposta(500, { erro: "Não foi possível criar a conta agora. Tente de novo em instantes." });
  }
};
