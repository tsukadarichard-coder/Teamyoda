/* Central Tsukada — avisos agendados (a cada 5 minutos; netlify.toml). Horário de São Paulo.
   Etapa 1: tarefas da Implantação com data (na hora marcada, ou às 9h quando não há hora) e o resumo de segunda às 8h,
   só para o Richard. As etapas 2 a 4 acrescentam os blocos da rotina, a rotina do administrativo e os pagamentos.
   Quem recebe: só quem ativou os avisos na Central (pushInscricoes com app "central"), com o tipo ligado e fora do
   horário de silêncio. No silêncio nada sai (e não fica guardado para depois). Cada aviso sai uma vez só:
   centralEnviados/{hash(uid + chave)} é criado antes do envio. */
const crypto = require("crypto");
const { admin, app } = require("./_firebase-admin");
const A = require("./_central-avisos");
const P = require("./_push");

const idEnvio = (uid, chave) => crypto.createHash("sha256").update(uid + "|" + chave).digest("hex").slice(0, 40);

async function rodar(ctx) {
  const db = ctx.db, agoraMs = ctx.agoraMs;
  const snap = await db.collection(P.COLECAO).where("app", "==", "central").get();
  const pessoas = {};
  snap.forEach((d) => { const x = d.data(); if (x.uid && A.PAPEIS.indexOf(x.papel) >= 0) pessoas[x.uid] = x.papel; });
  const out = { pessoas: Object.keys(pessoas).length, enviados: 0, silencio: 0, repetidos: 0 };
  if (!out.pessoas) return out;
  const [impDoc, donoDoc] = await Promise.all([db.collection("central").doc("implantacao").get(), db.collection("central").doc("dono").get()]);
  const implantacao = impDoc.exists ? A.limparImplantacao(impDoc.data().tarefas) : A.implantacaoPadrao();
  const agenda = donoDoc.exists ? ((donoDoc.data().dados || {}).agenda || []) : [];
  for (const uid of Object.keys(pessoas)) {
    const papel = pessoas[uid], pd = await db.collection("centralAvisos").doc(uid).get();
    const prefs = A.prefsDe(pd.exists ? pd.data() : null, papel);
    const itens = [];
    if (papel === "richard") {
      itens.push(...A.tarefasDevidas(implantacao, agoraMs));
      const r = A.resumoDevido(implantacao, agenda, agoraMs); if (r) itens.push(r);
    }
    const valem = itens.filter((i) => A.ativo(i.tipo) && prefs.tipos[i.tipo] && A.TIPOS[i.tipo].papeis.indexOf(papel) >= 0);
    if (!valem.length) continue;
    if (A.emSilencio(prefs, agoraMs)) { out.silencio += valem.length; continue; }
    for (const i of valem) {
      try { await db.collection("centralEnviados").doc(idEnvio(uid, i.chave)).create({ uid, chave: i.chave, em: new Date(agoraMs).toISOString() }); }
      catch (e) { out.repetidos++; continue; } // já saiu numa rodada anterior
      const r = await ctx.enviar({ app: "central", uid }, i.aviso);
      out.enviados += r && r.enviados ? r.enviados : 0;
    }
  }
  return out;
}

exports.handler = async function () {
  app();
  try {
    const r = await rodar({ db: admin.firestore(), agoraMs: Date.now(), enviar: (filtro, aviso) => P.avisar(admin, filtro, aviso) });
    console.log("central-avisos:", JSON.stringify(r));
    return { statusCode: 200, body: JSON.stringify(r) };
  } catch (e) {
    console.error("central-avisos:", e);
    return { statusCode: 500, body: "erro" };
  }
};
exports._rodar = rodar;
exports._idEnvio = idEnvio;
