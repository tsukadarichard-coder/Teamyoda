/* Consultoria (teamyoda.com.br/richard): limpeza diária do Storage.
   · O vídeo do cliente é apagado 90 dias depois da devolutiva (decisão do Richard ao aprovar o plano). A devolutiva, a dúvida e
     a gravação do Richard ficam; o envio passa a mostrar "vídeo apagado".
   · Envio que começou e nunca terminou de subir (7 dias) sai, com o pedaço que chegou. */
const { admin, app } = require("./_firebase-admin");
const C = require("./_consultoria");
const ARQ = require("./_consultoria-armazenamento");

async function limpar(agora) {
  const col = admin.firestore().collection("consultoriaEnvios");
  const [r, e] = await Promise.all([col.where("estado", "==", "respondido").get(), col.where("estado", "==", "enviando").get()]);
  const todos = r.docs.concat(e.docs).map((d) => ({ id: d.id, e: d.data() }));
  const { apagarVideo, abandonados } = C.paraLimpar(todos, agora);
  for (const x of apagarVideo) { await ARQ.apagar(x.e.video.caminho); await col.doc(x.id).set({ ...x.e, videoApagadoEm: agora }); }
  for (const x of abandonados) { if (x.e.video) await ARQ.apagar(x.e.video.caminho); await col.doc(x.id).delete(); }
  return { videosApagados: apagarVideo.length, enviosAbandonados: abandonados.length };
}

exports.handler = async function () {
  try { app(); const r = await limpar(new Date().toISOString()); console.log("consultoria-limpeza:", JSON.stringify(r)); return { statusCode: 200, body: JSON.stringify(r) }; }
  catch (e) { console.error("consultoria-limpeza:", e); return { statusCode: 500, body: JSON.stringify({ erro: String(e && e.message) }) }; }
};
exports.limpar = limpar;
