/* QuadraLab Hub — leitura e gravação compartilhadas pelos handlers hub-* e admin-hub (Admin SDK; o navegador nunca acessa direto). */
const crypto = require("crypto");
const { admin } = require("./_player");
const H = require("./_hub");

const db = () => admin.firestore();
const col = (n) => db().collection(n);

/* plano do profissional: o que o webhook da Eduzz já grava na organização dele (só leitura) */
async function infoOrg(orgId) {
  if (!orgId) return {};
  const s = await col("orgs").doc(orgId).collection("meta").doc("info").get();
  return s.exists ? s.data() || {} : {};
}
async function elegivel(orgId, hoje, cache) {
  if (cache && orgId in cache) return cache[orgId];
  const v = H.assinaturaAtiva(await infoOrg(orgId), hoje);
  if (cache) cache[orgId] = v;
  return v;
}
async function perfil(uid) {
  const s = await col("hubProfissionais").doc(uid).get();
  return s.exists ? s.data() : null;
}
async function temFoto(uid) { return (await col("hubFotos").doc(uid).get()).exists; }

/* contadores: leitura-soma-gravação (métricas; uma corrida rara só perde uma unidade) */
async function somar(ref, campos, raiz) {
  const s = await ref.get(), atual = s.exists ? s.data() : {};
  const base = raiz ? atual[raiz] || {} : atual, novo = {};
  for (const [k, v] of Object.entries(campos)) novo[k] = (Number(base[k]) || 0) + v;
  await ref.set(raiz ? { [raiz]: { ...base, ...novo } } : novo, { merge: true });
}
const metrica = (campos) => somar(col("hubMetricas").doc(H.hojeBR()), campos).catch(() => {});
const metricaProfissional = (uid, campos) => somar(col("hubProfissionais").doc(uid), campos, "metricas").catch(() => {});

async function notificar(uids, tipo, pedidoId, texto) {
  const em = H.agora();
  for (const u of [...new Set(uids)].filter(Boolean)) {
    await col("hubNotificacoes").doc(u).collection("itens").add({ tipo, pedidoId: pedidoId || null, texto: String(texto).slice(0, 200), em, lida: false });
  }
}

const idBloqueio = (prof, pessoa) => prof + "__" + pessoa;
async function bloqueado(prof, pessoas) {
  for (const p of pessoas.filter(Boolean)) if ((await col("hubBloqueios").doc(idBloqueio(prof, p)).get()).exists) return true;
  return false;
}

async function responsaveisAtivos(atletaUid) {
  const s = await col("vinculos").where("atletaUid", "==", atletaUid).where("tipo", "==", "responsavel").where("status", "==", "ativo").get();
  return s.docs.map((d) => ({ uid: d.data().pessoaUid, nome: d.data().pessoaNome || "" })).filter((x) => x.uid);
}
async function atletasDoResponsavel(uid) {
  const s = await col("vinculos").where("pessoaUid", "==", uid).where("tipo", "==", "responsavel").where("status", "==", "ativo").get();
  return s.docs.map((d) => ({ uid: d.data().atletaUid, nome: d.data().atletaNome || "" })).filter((x) => x.uid);
}

/* id do pedido a partir de quem pede + chave do aparelho: reenviar o mesmo formulário nunca cria outro pedido */
const idPedido = (uid, chave) => "hp" + crypto.createHash("sha256").update(uid + "|" + chave).digest("hex").slice(0, 26);

module.exports = { db, col, infoOrg, elegivel, perfil, temFoto, metrica, metricaProfissional, notificar, idBloqueio, bloqueado, responsaveisAtivos, atletasDoResponsavel, idPedido };
