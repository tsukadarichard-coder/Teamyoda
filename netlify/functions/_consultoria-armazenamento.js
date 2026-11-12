/* Arquivos da consultoria no Storage PRIVADO do Team Yoda (o mesmo bucket dos áudios do treinador; _olhar-armazenamento acha o bucket).
   · Envio: sessão de envio retomável (resumable upload do Google Cloud Storage), presa à origem do site. O navegador manda o arquivo
     em pedaços direto ao bucket e, se a internet cair, pergunta quanto já chegou e continua de onde parou. A sessão vale uma semana.
   · Conferência: depois do envio, o servidor olha o arquivo no bucket (existe, tipo e tamanho) e guarda a impressão digital.
   · Leitura: link assinado de 10 minutos, gerado só para o dono do envio ou para o Richard.
   · CORS: "Preparar armazenamento" (tela do Richard) junta ao CORS do bucket a regra do teamyoda.com.br, sem apagar as que já existem. */
const A = require("./_olhar-armazenamento");

const LEITURA_MS = 10 * 60 * 1000;

async function sessaoDeEnvio(caminho, contentType, origem) {
  const b = await A.bucket();
  const [uri] = await b.file(caminho).createResumableUpload({ origin: origem, metadata: { contentType } });
  return uri;
}
async function conferir(caminho) {
  const b = await A.bucket();
  try { const [m] = await b.file(caminho).getMetadata(); return { existe: true, contentType: String(m.contentType || "").toLowerCase().split(";")[0].trim(), tamanho: Number(m.size), md5: m.md5Hash || null, geracao: String(m.generation || "") }; }
  catch (e) { return { existe: false }; }
}
async function urlDeLeitura(caminho, contentType) {
  const b = await A.bucket();
  const [url] = await b.file(caminho).getSignedUrl({ version: "v4", action: "read", expires: Date.now() + LEITURA_MS, responseType: contentType, responseDisposition: "inline" });
  return { url, expiraEm: new Date(Date.now() + LEITURA_MS).toISOString() };
}
async function apagar(caminho) { try { await (await A.bucket()).file(caminho).delete(); return true; } catch (e) { return false; } }

/* junta a regra do site ao CORS do bucket (sem apagar as outras): envio em pedaços (PUT), leitura (GET/HEAD) e o cabeçalho Range,
   que o navegador precisa ler para saber quanto do arquivo já chegou */
const REGRA = { method: ["PUT", "POST", "GET", "HEAD"], responseHeader: ["content-type", "content-range", "range", "x-goog-resumable", "x-goog-content-length-range"], maxAgeSeconds: 3600 };
function juntarCors(atual, origens) {
  const outras = (Array.isArray(atual) ? atual : []).filter((r) => !(r && Array.isArray(r.origin) && r.origin.some((o) => origens.includes(o))));
  return outras.concat([{ origin: origens.slice(), ...REGRA }]);
}
async function prepararCors(origens) {
  const b = await A.bucket();
  const [m] = await b.getMetadata();
  await b.setCorsConfiguration(juntarCors(m.cors, origens));
  return b.name;
}

module.exports = { sessaoDeEnvio, conferir, urlDeLeitura, apagar, prepararCors, juntarCors, REGRA };
