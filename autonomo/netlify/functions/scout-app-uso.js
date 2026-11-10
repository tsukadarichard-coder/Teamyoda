/* QuadraLab Scout: recebe a contagem de uso anônima do app (scout-app/). Regras e formato em _scout-app-uso.js.
   POST { a, e, n? } → { ok: true }. Sem login: o app funciona sem conta. Nada pessoal entra: campos além de a, e, n são recusados. */
const { admin, app } = require("./_firebase-admin");
const USO = require("./_scout-app-uso");

function resposta(statusCode, corpo) {
  return { statusCode, headers: { "content-type": "application/json", "cache-control": "no-store", "x-robots-tag": "noindex" }, body: JSON.stringify(corpo) };
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });
  if (String(event.body || "").length > 300) return resposta(413, { erro: "Pedido grande demais." });
  let corpo;
  try { corpo = JSON.parse(event.body || "{}"); } catch (e) { return resposta(400, { erro: "Pedido inválido." }); }
  const ev = USO.validar(corpo);
  if (ev.erro) return resposta(400, { erro: ev.erro });
  try {
    app();
    const r = await USO.registrar(admin.firestore(), ev);
    if (r.limite) return resposta(429, { erro: "Muitos registros hoje neste aparelho." });
    return resposta(200, { ok: true });
  } catch (e) {
    console.error("scout-app-uso:", e && e.message);
    return resposta(500, { erro: "Não foi possível registrar agora." });
  }
};
