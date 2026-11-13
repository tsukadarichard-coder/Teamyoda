/* Consultoria: avisos agendados (de hora em hora) — encontro na véspera e 1 hora antes; lembrete do check-in no domingo às 18h. */
const { admin, app } = require("./_firebase-admin");
const AC = require("./_consultoria-acomp");
const P = require("./_push");

exports.handler = async function () {
  try {
    app();
    const ctx = { db: () => admin.firestore(), agora: () => new Date().toISOString(),
      avisarCliente: (uid, titulo, corpo, url) => P.avisar(admin, { app: "consultoria", uid }, { titulo, corpo, url: url || "/richard/", tag: "consultoria-agenda" }),
      avisarRichard: (titulo, corpo, url) => P.avisar(admin, { app: "consultoria", papel: "richard" }, { titulo, corpo, url: url || "/richard/", tag: "consultoria-agenda" }) };
    const r = await AC.avisosAgendados(ctx);
    console.log("consultoria-avisos:", JSON.stringify(r));
    return { statusCode: 200, body: JSON.stringify(r) };
  } catch (e) { console.error("consultoria-avisos:", e); return { statusCode: 500, body: JSON.stringify({ erro: String(e && e.message) }) }; }
};
