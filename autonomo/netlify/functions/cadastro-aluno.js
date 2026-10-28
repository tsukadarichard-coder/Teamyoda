/* QuadraLab Treinador — criação de conta do ALUNO (Área do aluno).

   Criada aqui, pelo Admin SDK, com a claim tipo: "aluno" e SEM orgId: as regras do Firestore continuam negando a ela qualquer dado
   de academia. O que o aluno vê vem só pela function aluno-conta, depois que o professor aprova o vínculo. Com o código do professor
   no cadastro, o pedido de vínculo já sai junto. Depois de criada, a página entra com signInWithEmailAndPassword. */
const { admin, app } = require("./_firebase-admin");

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });
  try {
    app();
    let body;
    try { body = JSON.parse(event.body || "{}"); } catch (e) { return resposta(400, { erro: "Corpo da requisição inválido." }); }
    const nome = String(body.nome || "").trim().slice(0, 80);
    const email = String(body.email || "").trim().toLowerCase().slice(0, 120);
    const senha = String(body.senha || "");
    const codigo = String(body.codigo || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!nome) return resposta(400, { erro: "Informe seu nome." });
    if (!EMAIL_VALIDO.test(email)) return resposta(400, { erro: "Informe um e-mail válido." });
    if (senha.length < 8) return resposta(400, { erro: "A senha precisa ter pelo menos 8 caracteres." });
    if (codigo && codigo.length !== 8) return resposta(400, { erro: "O código do professor tem 8 letras e números." });

    const db = admin.firestore();
    let cod = null;
    if (codigo) {
      const c = await db.collection("codigosAcademia").doc(codigo).get();
      if (!c.exists || !c.data().orgId) return resposta(404, { erro: "Não encontrei esse código. Confira com o seu professor ou deixe em branco e vincule depois." });
      cod = c.data();
    }

    let usuario;
    try {
      usuario = await admin.auth().createUser({ email, password: senha, displayName: nome });
    } catch (e) {
      if (e.code === "auth/email-already-exists") return resposta(409, { erro: "Este e-mail já tem uma conta. Use \"Entrar\" com a sua senha." });
      if (e.code === "auth/invalid-password") return resposta(400, { erro: "A senha precisa ter pelo menos 8 caracteres." });
      if (e.code === "auth/invalid-email") return resposta(400, { erro: "Informe um e-mail válido." });
      throw e;
    }
    await admin.auth().setCustomUserClaims(usuario.uid, { tipo: "aluno" });
    const quando = new Date().toISOString();
    const conta = { nome, email, criadoEm: quando };
    if (cod) {
      conta.vinculo = { orgId: cod.orgId, treinadorUid: cod.treinadorUid || null, treinadorNome: String(cod.treinadorNome || "Professor").slice(0, 80), codigo, status: "aguardando",
        alunoId: null, pedidoEm: quando, historico: [{ em: quando, acao: "pedido de vínculo no cadastro" }] };
    }
    await db.collection("contasAluno").doc(usuario.uid).set(conta);
    return resposta(200, { ok: true, vinculoPedido: !!cod, treinadorNome: cod ? conta.vinculo.treinadorNome : null });
  } catch (e) {
    console.error("cadastro-aluno:", e);
    return resposta(500, { erro: "Não foi possível criar a conta agora. Tente de novo em instantes." });
  }
};

function resposta(statusCode, corpo) {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) };
}
