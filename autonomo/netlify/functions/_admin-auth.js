/* Autenticação do administrador (painel e functions admin-*).

   Duas formas de entrar, ambas conferidas no servidor:
   1) cabeçalho x-admin-secret com o ADMIN_SECRET (como sempre; usado pelo admin.html e por scripts);
   2) sessão do painel: cookie ql_adm (HttpOnly, Secure, SameSite=Strict, 30 dias) emitido por admin-sessao depois de o administrador digitar o segredo uma vez.
      O cookie é um token assinado com uma chave derivada do ADMIN_SECRET: o segredo em si nunca é guardado no aparelho, o JavaScript da página não consegue ler
      o cookie, e só vale com o cabeçalho x-painel: 1 (um site de fora não consegue mandar esse cabeçalho, o que barra pedidos forjados).
   Trocar o ADMIN_SECRET invalida todas as sessões. "Sair de todos os aparelhos" grava o instante em adminConfig/sessoes e invalida as sessões emitidas antes dele. */
const crypto = require("crypto");
const { admin, app } = require("./_firebase-admin");

const COOKIE = "ql_adm", VALIDADE_DIAS = 30, RENOVAR_APOS_DIAS = 3;
const b64 = (b) => Buffer.from(b).toString("base64url");

function cab(event, nome) { const h = (event && event.headers) || {}; for (const k of Object.keys(h)) if (k.toLowerCase() === nome) return String(h[k] == null ? "" : h[k]); return ""; }
function iguais(a, b) { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); }
function segredoConfere(event) { const rec = cab(event, "x-admin-secret"), esp = String(process.env.ADMIN_SECRET || ""); return esp.length > 0 && iguais(rec, esp); }
function chave() { return crypto.createHmac("sha256", String(process.env.ADMIN_SECRET || "")).update("ql-painel-sessao-v1").digest(); }
function assinar(corpo) { return b64(crypto.createHmac("sha256", chave()).update(corpo).digest()); }

function emitirToken(agora) {
  const iat = agora || Date.now(), corpo = b64(JSON.stringify({ iat, exp: iat + VALIDADE_DIAS * 86400000, n: crypto.randomBytes(8).toString("hex") })); // tempos em milissegundos
  return corpo + "." + assinar(corpo);
}
function lerToken(token, agora) {
  if (!String(process.env.ADMIN_SECRET || "")) return null;
  const [corpo, ass] = String(token || "").split(".");
  if (!corpo || !ass || !iguais(ass, assinar(corpo))) return null;
  let p; try { p = JSON.parse(Buffer.from(corpo, "base64url").toString("utf8")); } catch (e) { return null; }
  const t = agora || Date.now();
  return p && Number.isInteger(p.iat) && Number.isInteger(p.exp) && p.exp > t && p.iat <= t + 60000 ? p : null;
}
function cookieDe(event) {
  const c = cab(event, "cookie"); if (!c) return "";
  for (const parte of c.split(";")) { const i = parte.indexOf("="); if (i > 0 && parte.slice(0, i).trim() === COOKIE) return parte.slice(i + 1).trim(); }
  return "";
}
function setCookie(token) { return COOKIE + "=" + token + "; Max-Age=" + VALIDADE_DIAS * 86400 + "; Path=/.netlify/functions; HttpOnly; Secure; SameSite=Strict"; }
function limparCookie() { return COOKIE + "=; Max-Age=0; Path=/.netlify/functions; HttpOnly; Secure; SameSite=Strict"; }

let cacheRevogacao = { em: 0, v: "" };
async function revogadoEm() {
  if (Date.now() - cacheRevogacao.em < 20000) return cacheRevogacao.v;
  try { app(); const s = await admin.firestore().collection("adminConfig").doc("sessoes").get(); cacheRevogacao = { em: Date.now(), v: s.exists ? String(s.data().revogadoEm || "") : "" }; }
  catch (e) { /* sem leitura: segue sem revogação extra; a troca do ADMIN_SECRET continua valendo */ }
  return cacheRevogacao.v;
}
async function sairDeTodos() {
  app(); const iso = new Date().toISOString();
  await admin.firestore().collection("adminConfig").doc("sessoes").set({ revogadoEm: iso });
  cacheRevogacao = { em: Date.now(), v: iso }; return iso;
}
/* devolve o payload da sessão válida (cookie + x-painel + não revogada) ou null */
async function sessaoValida(event) {
  if (cab(event, "x-painel") !== "1") return null;
  const p = lerToken(cookieDe(event)); if (!p) return null;
  const rev = await revogadoEm();
  if (rev && p.iat < Date.parse(rev)) return null;
  return p;
}
/* true se o pedido vem do administrador, por segredo ou por sessão */
async function autorizar(event) { return segredoConfere(event) || !!(await sessaoValida(event)); }
function enviouCredencial(event) { return !!cab(event, "x-admin-secret"); }

/* limite de tentativas erradas por conexão: mais de 15 por hora devolve 429 */
async function tentativaErrada(event) {
  try {
    app();
    const ip = String(cab(event, "x-nf-client-connection-ip") || cab(event, "x-forwarded-for") || "sem-ip").split(",")[0].trim();
    const h = crypto.createHash("sha256").update(ip + "|adm").digest("hex").slice(0, 24), janela = new Date().toISOString().slice(0, 13), ref = admin.firestore().collection("adminTentativas").doc(h), s = await ref.get();
    const n = (s.exists && s.data().janela === janela ? s.data().n : 0) + 1;
    await ref.set({ janela, n });
    return n > 15;
  } catch (e) { return false; }
}

function _zerarCache() { cacheRevogacao = { em: 0, v: "" }; }
module.exports = { _zerarCache, COOKIE, VALIDADE_DIAS, RENOVAR_APOS_DIAS, cab, segredoConfere, emitirToken, lerToken, cookieDe, setCookie, limparCookie, sessaoValida, autorizar, enviouCredencial, tentativaErrada, sairDeTodos };
