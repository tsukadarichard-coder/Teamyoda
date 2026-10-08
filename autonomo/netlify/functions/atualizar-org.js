/* Atualiza manualmente o plano/validade de uma conta já existente —
   pro painel de admin (upgrade/downgrade manual, sem precisar que o
   webhook da Eduzz dispare). Mais simples que provisionar-org: não
   mexe em login/senha, só no documento orgs/{orgId}/meta/info.
   Protegida pelo mesmo segredo (x-admin-secret). */
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

  const { orgId, plano, planoAtivoAte, limparPlanoAtivoAte } = corpo;
  if (!orgId) return resposta(400, { erro: "Faltou orgId." });
  if (plano && !["gratis", "essencial", "premium"].includes(plano)) {
    return resposta(400, { erro: 'plano precisa ser "gratis", "essencial" ou "premium".' });
  }
  if (planoAtivoAte && !/^\d{4}-\d{2}-\d{2}$/.test(planoAtivoAte)) {
    return resposta(400, { erro: 'planoAtivoAte precisa estar no formato "AAAA-MM-DD".' });
  }

  try {
    app();
    const db = admin.firestore();
    const ref = db.collection("orgs").doc(orgId).collection("meta").doc("info");
    const atual = await ref.get();
    if (!atual.exists) return resposta(404, { erro: 'Conta "' + orgId + '" não encontrada.' });

    const campos = {
      adminAtualizadoEm: new Date().toISOString(),
    };
    if (plano) campos.plano = plano;
    if (planoAtivoAte) campos.planoAtivoAte = planoAtivoAte;
    if (limparPlanoAtivoAte) campos.planoAtivoAte = admin.firestore.FieldValue.delete();

    await ref.set(campos, { merge: true });
    return resposta(200, { ok: true, orgId });
  } catch (e) {
    return resposta(500, { erro: String(e.message || e) });
  }
};

function resposta(statusCode, corpo) {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) };
}
