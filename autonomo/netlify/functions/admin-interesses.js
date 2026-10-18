/* Painel do consultor — contatos recebidos pela página de vendas do QuadraLab Competição.

   Protegido pelo segredo de administrador (x-admin-secret).
   GET                                  → contatos, do mais novo ao mais antigo
   POST { acao: "status", id, status: "novo"|"contatado"|"arquivado", nota? } */
const crypto = require("crypto");
const { admin, app } = require("./_firebase-admin");
const I = require("./comp-interesse");

function resposta(statusCode, corpo) { return { statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(corpo) }; }
function segredoOk(event) {
  const rec = String(event.headers["x-admin-secret"] || event.headers["X-Admin-Secret"] || ""), esp = String(process.env.ADMIN_SECRET || "");
  const a = Buffer.from(rec), b = Buffer.from(esp);
  return esp.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}
exports.handler = async function (event) {
  if (!segredoOk(event)) return resposta(401, { erro: "Segredo de administrador ausente ou incorreto." });
  try {
    app();
    const col = admin.firestore().collection("interessesCompeticao");
    if (event.httpMethod === "GET") {
      const lista = []; (await col.get()).forEach((d) => { const { ipHash, ...x } = d.data(); lista.push({ id: d.id, ...x, rotuloServico: I.SERVICOS[x.servico] || x.servico, rotuloFaixa: I.FAIXAS[x.faixa] || x.faixa, rotuloCategoria: I.CATEGORIAS[x.categoria] || x.categoria }); });
      lista.sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));
      return resposta(200, { contatos: lista });
    }
    if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });
    let body; try { body = JSON.parse(event.body || "{}"); } catch (e) { return resposta(400, { erro: "Pedido inválido." }); }
    if (body.acao !== "status" || !["novo", "contatado", "arquivado"].includes(body.status)) return resposta(400, { erro: "Pedido inválido." });
    const ref = col.doc(String(body.id || "x")), s = await ref.get();
    if (!s.exists) return resposta(404, { erro: "Contato não encontrado." });
    await ref.update({ status: body.status, nota: String(body.nota || "").trim().slice(0, 500), atualizadoEm: new Date().toISOString() });
    return resposta(200, { ok: true });
  } catch (e) {
    console.error("admin-interesses:", e && e.message);
    return resposta(500, { erro: "Não foi possível concluir agora." });
  }
};
