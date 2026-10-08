/* Lista todas as contas (orgs) do QuadraLab pro painel de admin —
   única forma, antes disso, era abrir o Firebase Console direto.
   Protegida pelo mesmo segredo de provisionar-org (x-admin-secret). */
const { admin, app } = require("./_firebase-admin");

exports.handler = async function (event) {
  if (event.httpMethod !== "GET") {
    return resposta(405, { erro: "Método não permitido." });
  }

  const segredo = event.headers["x-admin-secret"] || event.headers["X-Admin-Secret"];
  if (!segredo || segredo !== process.env.ADMIN_SECRET) {
    return resposta(401, { erro: "Segredo de administrador ausente ou incorreto." });
  }

  try {
    app();
    const db = admin.firestore();
    const orgsRef = db.collection("orgs");
    const orgsSnap = await orgsRef.listDocuments();

    const orgs = await Promise.all(orgsSnap.map(async (orgDoc) => {
      const infoSnap = await orgDoc.collection("meta").doc("info").get();
      const info = infoSnap.exists ? infoSnap.data() : {};

      // conta jogadores/alunos cadastrados — mesmo documento que o app usa (mty:alunos:v2)
      let totalJogadores = null;
      try {
        const dadosSnap = await orgDoc.collection("dados").doc("mty:alunos:v2").get();
        if (dadosSnap.exists) {
          const alunos = JSON.parse(dadosSnap.data().value || "[]");
          totalJogadores = Array.isArray(alunos) ? alunos.length : null;
        }
      } catch (e) { /* alunos malformado ou ausente — não trava a listagem */ }

      return {
        orgId: orgDoc.id,
        nome: info.nome || orgDoc.id,
        plano: info.plano || null,
        planoAtivoAte: info.planoAtivoAte || null,
        criadoEm: info.criadoEm || null,
        eduzzUltimaFatura: info.eduzzUltimaFatura || null,
        eduzzAtualizadoEm: info.eduzzAtualizadoEm || null,
        eduzzRevogadoEm: info.eduzzRevogadoEm || null,
        totalJogadores,
      };
    }));

    orgs.sort((a, b) => (b.eduzzAtualizadoEm || b.criadoEm || "").localeCompare(a.eduzzAtualizadoEm || a.criadoEm || ""));

    return resposta(200, { ok: true, orgs });
  } catch (e) {
    return resposta(500, { erro: String(e.message || e) });
  }
};

function resposta(statusCode, corpo) {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) };
}
