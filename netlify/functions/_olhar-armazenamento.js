/* Armazenamento PRIVADO das devolutivas do "Olhar do treinador" (Firebase Storage / Google Cloud Storage).

   · O bucket nunca é público: o navegador só toca no arquivo por URL assinada, curta e gerada depois de o servidor conferir quem está pedindo.
   · Envio (Richard): o servidor devolve uma URL assinada de escrita (15 min) presa ao tipo do arquivo e ao tamanho máximo; o navegador envia
     direto ao bucket (assim o arquivo não passa pelo limite de corpo das functions). Depois o servidor confere o arquivo no bucket
     (existe, tipo e tamanho permitidos, no caminho do pedido) e guarda a impressão digital (md5 + geração) para conferir de novo na publicação.
   · Leitura (jogador ou Richard): URL assinada de 10 min, gerada só para o dono do pedido (ou administrador).

   Configuração externa (uma vez): bucket do projeto Firebase (FIREBASE_STORAGE_BUCKET, ou <projeto>.firebasestorage.app / .appspot.com),
   conta de serviço com permissão de Storage e CORS liberando PUT do endereço do Painel — o botão "Preparar armazenamento" do Painel aplica o CORS. */
const { admin, app } = require("./_firebase-admin");

const TIPOS = {
  "audio/mpeg": { ext: "mp3", tipo: "audio" }, "audio/mp4": { ext: "m4a", tipo: "audio" }, "audio/x-m4a": { ext: "m4a", tipo: "audio" },
  "audio/aac": { ext: "aac", tipo: "audio" }, "audio/webm": { ext: "webm", tipo: "audio" },
  "video/mp4": { ext: "mp4", tipo: "video" }, "video/webm": { ext: "webm", tipo: "video" },
};
const LIMITE_BYTES = { audio: 30 * 1024 * 1024, video: 250 * 1024 * 1024 };
const VALIDADE_ENVIO_MS = 15 * 60 * 1000, VALIDADE_LEITURA_MS = 10 * 60 * 1000;
const ID_PEDIDO = /^[A-Za-z0-9]{10,40}$/;
const CAMINHO = /^olhar\/[A-Za-z0-9]{10,40}\/[0-9]{10,16}-[a-z0-9]{6}\.(mp3|m4a|aac|webm|mp4)$/;

function infoDoTipo(contentType) { return TIPOS[String(contentType || "").toLowerCase().split(";")[0].trim()] || null; }
function limites() {
  return {
    formatos: "áudio MP3, M4A, AAC ou WebM; vídeo MP4 ou WebM",
    audioMaxMB: Math.round(LIMITE_BYTES.audio / 1048576), videoMaxMB: Math.round(LIMITE_BYTES.video / 1048576),
  };
}
function validarArquivo(contentType, tamanho) {
  const t = infoDoTipo(contentType);
  if (!t) return { ok: false, erro: "Formato não aceito. Use " + limites().formatos + "." };
  const n = Number(tamanho);
  if (!Number.isFinite(n) || n <= 0) return { ok: false, erro: "O arquivo está vazio." };
  if (n > LIMITE_BYTES[t.tipo]) return { ok: false, erro: "O arquivo passa do limite de " + Math.round(LIMITE_BYTES[t.tipo] / 1048576) + " MB para " + t.tipo + "." };
  return { ok: true, info: t };
}

let bucketCache = null;
function nomesCandidatos() {
  const env = String(process.env.FIREBASE_STORAGE_BUCKET || "").trim();
  if (env) return [env];
  let proj = "";
  try { proj = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}").project_id || ""; } catch (e) { proj = ""; }
  return proj ? [proj + ".firebasestorage.app", proj + ".appspot.com"] : [];
}
async function bucket() {
  if (bucketCache) return bucketCache;
  app();
  const nomes = nomesCandidatos();
  if (!nomes.length) throw new Error("Armazenamento não configurado: defina FIREBASE_STORAGE_BUCKET no Netlify.");
  for (const nome of nomes) {
    const b = admin.storage().bucket(nome);
    try { const [existe] = await b.exists(); if (existe) return (bucketCache = b); } catch (e) { /* tenta o próximo nome */ }
  }
  throw new Error("Bucket de armazenamento não encontrado (" + nomes.join(", ") + "). Ative o Firebase Storage ou defina FIREBASE_STORAGE_BUCKET.");
}

function novoCaminho(pedidoId, ext) {
  if (!ID_PEDIDO.test(String(pedidoId || ""))) throw new Error("Pedido inválido.");
  return "olhar/" + pedidoId + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8).padEnd(6, "0") + "." + ext;
}
const caminhoDoPedido = (caminho, pedidoId) => CAMINHO.test(String(caminho || "")) && String(caminho).split("/")[1] === pedidoId;

async function urlParaEnvio(pedidoId, contentType, tamanho) {
  const v = validarArquivo(contentType, tamanho);
  if (!v.ok) return v;
  const b = await bucket(), caminho = novoCaminho(pedidoId, v.info.ext), tipo = String(contentType).toLowerCase().split(";")[0].trim();
  const [url] = await b.file(caminho).getSignedUrl({
    version: "v4", action: "write", expires: Date.now() + VALIDADE_ENVIO_MS, contentType: tipo,
    extensionHeaders: { "x-goog-content-length-range": "1," + LIMITE_BYTES[v.info.tipo] },
  });
  return { ok: true, url, caminho, contentType: tipo, tipo: v.info.tipo, cabecalhos: { "content-type": tipo, "x-goog-content-length-range": "1," + LIMITE_BYTES[v.info.tipo] }, expiraEm: new Date(Date.now() + VALIDADE_ENVIO_MS).toISOString() };
}

/* confere o arquivo que está no bucket; devolve a impressão digital para guardar no pedido */
async function conferirArquivo(caminho, pedidoId) {
  if (!caminhoDoPedido(caminho, pedidoId)) return { ok: false, erro: "Arquivo não pertence a este pedido." };
  const b = await bucket(), f = b.file(caminho);
  let meta;
  try { [meta] = await f.getMetadata(); } catch (e) { return { ok: false, erro: "O arquivo não foi encontrado. Envie de novo." }; }
  const v = validarArquivo(meta.contentType, meta.size);
  if (!v.ok) { try { await f.delete(); } catch (e) { /* já sumiu */ } return v; }
  return { ok: true, tipo: v.info.tipo, contentType: String(meta.contentType).toLowerCase().split(";")[0].trim(), tamanho: Number(meta.size), md5: meta.md5Hash || null, geracao: String(meta.generation || "") };
}
/* na publicação: o arquivo continua sendo exatamente o que foi conferido? */
async function mesmoArquivo(arq) {
  const r = await conferirArquivo(arq.caminho, arq.pedidoId);
  return r.ok && r.tamanho === arq.tamanho && String(r.geracao) === String(arq.geracao) && (r.md5 || null) === (arq.md5 || null);
}

async function urlParaLeitura(caminho, contentType) {
  const b = await bucket();
  const [url] = await b.file(caminho).getSignedUrl({ version: "v4", action: "read", expires: Date.now() + VALIDADE_LEITURA_MS, responseType: contentType, responseDisposition: "inline" });
  return { url, expiraEm: new Date(Date.now() + VALIDADE_LEITURA_MS).toISOString() };
}
async function removerArquivo(caminho) {
  if (!CAMINHO.test(String(caminho || ""))) return false;
  try { await (await bucket()).file(caminho).delete(); return true; } catch (e) { return false; }
}
/* libera o envio direto do navegador do Painel para o bucket (PUT) e a leitura pelo player */
async function prepararCors(origens) {
  const b = await bucket();
  await b.setCorsConfiguration([{ origin: origens, method: ["PUT", "GET", "HEAD"], responseHeader: ["content-type", "x-goog-content-length-range", "range"], maxAgeSeconds: 3600 }]);
  return b.name;
}

module.exports = { TIPOS, LIMITE_BYTES, CAMINHO, limites, validarArquivo, infoDoTipo, bucket, novoCaminho, caminhoDoPedido, urlParaEnvio, conferirArquivo, mesmoArquivo, urlParaLeitura, removerArquivo, prepararCors };
