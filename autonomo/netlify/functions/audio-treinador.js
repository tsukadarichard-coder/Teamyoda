/* Áudios do treinador (observações durante o jogo, conversas e comentários para o jogador) — armazenamento PRIVADO.

   O arquivo vai direto do aparelho para o bucket (URL assinada de escrita, curta, presa ao tipo e ao tamanho), no caminho
   audios/<academia>/<jogador>/<arquivo>; só se ouve por URL assinada de leitura de 10 min, gerada aqui para a própria academia.
   O texto (ditado do aparelho) e a referência ao arquivo ficam no caderno do jogador, no app do treinador.
   Planos Essencial e Premium (academia sem plano definido segue liberada, como no resto do QuadraLab).

   POST (login de treinador):
     { acao: "envio", alunoId, contentType, tamanho } → { url, caminho, cabecalhos }
     { acao: "ouvir", caminho }                        → { url }
     { acao: "apagar", caminho }                       → { ok } */
const { admin, app } = require("./_firebase-admin");
const A = require("./_olhar-armazenamento");

const LIMITE = 30 * 1024 * 1024, VALIDADE_ENVIO_MS = 15 * 60 * 1000, VALIDADE_LEITURA_MS = 10 * 60 * 1000;
const ID = /^[A-Za-z0-9_-]{1,80}$/;
const TIPOS = { "audio/webm": "webm", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/aac": "aac", "audio/mpeg": "mp3", "audio/ogg": "ogg" };
const CAMINHO = /^audios\/[A-Za-z0-9_-]{1,80}\/[A-Za-z0-9_-]{1,80}\/[0-9]{10,16}-[a-z0-9]{6}\.(webm|m4a|aac|mp3|ogg)$/;
const ERRO_PLANO = "Gravar áudio faz parte dos planos Essencial e Premium.";

function resposta(statusCode, corpo) { return { statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(corpo) }; }
const tipoBase = (ct) => String(ct || "").toLowerCase().split(";")[0].trim();

async function academiaPaga(db, orgId) {
  const s = await db.collection("orgs").doc(orgId).collection("meta").doc("info").get();
  const i = s.exists ? s.data() : {};
  if (!i.plano) return true;
  if (i.plano !== "essencial" && i.plano !== "premium") return false;
  return !(i.planoAtivoAte && i.planoAtivoAte < new Date().toISOString().slice(0, 10));
}

exports.handler = async function (event) {
  try {
    app();
    if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });
    const cab = event.headers.authorization || event.headers.Authorization || "";
    const idToken = cab.startsWith("Bearer ") ? cab.slice(7) : "";
    if (!idToken) return resposta(401, { erro: "Entre na sua conta." });
    let claims;
    try { claims = await admin.auth().verifyIdToken(idToken); } catch (e) { return resposta(401, { erro: "Sua sessão expirou. Entre de novo." }); }
    if (!claims.orgId || !ID.test(claims.orgId)) return resposta(403, { erro: "Esta conta não é de treinador." });
    let body;
    try { body = JSON.parse(event.body || "{}"); } catch (e) { return resposta(400, { erro: "Pedido inválido." }); }
    const db = admin.firestore();
    const minha = (c) => CAMINHO.test(String(c || "")) && String(c).split("/")[1] === claims.orgId;

    if (body.acao === "envio") {
      if (!(await academiaPaga(db, claims.orgId))) return resposta(403, { erro: ERRO_PLANO });
      const alunoId = String(body.alunoId || ""), tipo = tipoBase(body.contentType), ext = TIPOS[tipo], tam = Number(body.tamanho);
      if (!ID.test(alunoId)) return resposta(400, { erro: "Jogador inválido." });
      if (!ext) return resposta(400, { erro: "Formato de áudio não aceito." });
      if (!Number.isFinite(tam) || tam <= 0) return resposta(400, { erro: "O áudio está vazio." });
      if (tam > LIMITE) return resposta(400, { erro: "O áudio passa de 30 MB. Grave em partes menores." });
      const caminho = "audios/" + claims.orgId + "/" + alunoId + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8).padEnd(6, "0") + "." + ext;
      const cabecalhos = { "content-type": tipo, "x-goog-content-length-range": "1," + LIMITE };
      const [url] = await (await A.bucket()).file(caminho).getSignedUrl({ version: "v4", action: "write", expires: Date.now() + VALIDADE_ENVIO_MS, contentType: tipo, extensionHeaders: { "x-goog-content-length-range": "1," + LIMITE } });
      return resposta(200, { ok: true, url, caminho, cabecalhos, contentType: tipo });
    }
    if (body.acao === "ouvir") {
      const caminho = String(body.caminho || "");
      if (!minha(caminho)) return resposta(404, { erro: "Áudio não encontrado." });
      const [url] = await (await A.bucket()).file(caminho).getSignedUrl({ version: "v4", action: "read", expires: Date.now() + VALIDADE_LEITURA_MS, responseDisposition: "inline" });
      return resposta(200, { ok: true, url });
    }
    if (body.acao === "apagar") {
      const caminho = String(body.caminho || "");
      if (!minha(caminho)) return resposta(404, { erro: "Áudio não encontrado." });
      try { await (await A.bucket()).file(caminho).delete(); } catch (e) { /* já não existia */ }
      return resposta(200, { ok: true });
    }
    return resposta(400, { erro: "Ação desconhecida." });
  } catch (e) {
    console.error("audio-treinador:", e);
    return resposta(500, { erro: /Armazenamento não configurado|Bucket/.test(String(e.message)) ? "O armazenamento de áudio ainda não está pronto. Avise o suporte." : "Não foi possível concluir agora. Tente de novo." });
  }
};
module.exports.interno = { CAMINHO, academiaPaga };
