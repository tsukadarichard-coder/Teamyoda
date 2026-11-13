/* Central Tsukada — agendador dos agentes (de hora em hora; netlify.toml). Vê quem está na hora (São Paulo), cria o rascunho
   uma vez só por período e chama central-agentes-background.js, que faz o trabalho (a IA pode passar dos 30 s de uma function
   agendada). Rascunho que ficou "gerando" por mais de 20 min é disparado de novo (até 3 tentativas). */
const { admin, app } = require("./_firebase-admin");
const AG = require("./_central-agentes");
const M = require("./_central-agentes-motor");

async function rodar(ctx) {
  const cfg = await M.lerConfig(ctx.db), out = { criados: [], redisparados: [] };
  for (const d of AG.devidos(ctx.agoraMs, cfg)) if (await M.criar(ctx, d.id, d.agente, { periodo: d.periodo })) out.criados.push(d.id);
  const presos = await ctx.db.collection("centralAgentes").where("estado", "==", "gerando").get(), lista = [];
  presos.forEach((d) => lista.push({ id: d.id, ...d.data() }));
  for (const x of lista) {
    if (Date.parse(x.criadoEm) > ctx.agoraMs - 20 * 60000 || (x.tentativas || 1) >= 3) continue;
    const { id, ...resto } = x;
    await ctx.db.collection("centralAgentes").doc(id).set({ ...resto, tentativas: (x.tentativas || 1) + 1 });
    await M.disparar(ctx, x.id); out.redisparados.push(x.id);
  }
  return out;
}

exports.handler = async function () {
  app();
  try {
    const r = await rodar({ db: admin.firestore(), agoraMs: Date.now() });
    console.log("central-agentes:", JSON.stringify(r));
    return { statusCode: 200, body: JSON.stringify(r) };
  } catch (e) { console.error("central-agentes:", e); return { statusCode: 500, body: "erro" }; }
};
exports._rodar = rodar;
