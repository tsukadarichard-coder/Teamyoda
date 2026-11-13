/* Central Tsukada — agente em segundo plano (o sufixo -background deixa rodar até 15 min). Só aceita o pedido com o segredo
   interno de central/agentesConfig (quem chama é o próprio servidor: central.js e central-agentes.js). */
const crypto = require("crypto");
const { admin, app } = require("./_firebase-admin");
const M = require("./_central-agentes-motor");
const P = require("./_push");

function igual(a, b) { const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || "")); return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y); }

async function processar(event, ctx) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "" };
  const cfg = await M.lerConfig(ctx.db), cab = event.headers || {};
  if (!igual(cab["x-central-segredo"] || cab["X-Central-Segredo"], cfg.segredo)) return { statusCode: 403, body: "" };
  let b = {}; try { b = JSON.parse(event.body || "{}"); } catch (e) { b = {}; }
  if (!/^[A-Za-z0-9_-]{3,80}$/.test(String(b.id || ""))) return { statusCode: 400, body: "" };
  const r = await M.gerar(ctx, b.id);
  return { statusCode: 200, body: JSON.stringify(r) };
}

exports.handler = async function (event) {
  app();
  try { return await processar(event, { db: admin.firestore(), agoraMs: Date.now(), enviar: (filtro, aviso) => P.avisar(admin, filtro, aviso) }); }
  catch (e) { console.error("central-agentes-background:", e); return { statusCode: 500, body: "erro" }; }
};
exports._processar = processar;
