/* Notificações no celular (Web Push), sem biblioteca: criptografia da mensagem (RFC 8291, aes128gcm) e identificação do servidor
   (VAPID, RFC 8292) com o crypto do Node. Funciona no Android (navegador e app instalado), no computador e no iPhone/iPad com o app
   na tela de início (iOS 16.4+).

   Chaves do servidor (VAPID): geradas pelo próprio servidor no primeiro uso e guardadas em configPush/vapid no Firestore — coleção
   que as regras não liberam ao navegador; a chave privada nunca sai do servidor. Se PUSH_VAPID_PUBLICA e PUSH_VAPID_PRIVADA
   existirem no Netlify, valem elas. PUSH_CONTATO opcional (mailto: ou https:).

   Inscrições: Firestore pushInscricoes/{sha256(endpoint)} → { endpoint, keys: { p256dh, auth }, app, uid, orgId?, papel?, alunoId?,
   atletaUid?, criadoEm, atualizadoEm }. Uma inscrição que o serviço de push dá como vencida (404/410) é apagada no envio.

   exports: chaves(admin), chavePublica(admin), criptografar(...), enviarUma(inscricao, aviso, chaves), enviarPara(admin, filtro, aviso), avisar(admin, filtro, aviso) → { enviados, falhas, removidos }
   aviso: { titulo, corpo, url, tag, icone? } (url relativa ao site, ou "@app" = a tela onde a pessoa ativou; tag agrupa avisos do mesmo tipo). */
const crypto = require("crypto");
const https = require("https");

const b64u = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const deB64u = (s) => Buffer.from(String(s || "").replace(/-/g, "+").replace(/_/g, "/"), "base64");
const hmac = (chave, dados) => crypto.createHmac("sha256", chave).update(dados).digest();
const COLECAO = "pushInscricoes";

let chavesCache = null;
async function chaves(admin) {
  if (process.env.PUSH_VAPID_PUBLICA && process.env.PUSH_VAPID_PRIVADA) return { publica: process.env.PUSH_VAPID_PUBLICA, privada: process.env.PUSH_VAPID_PRIVADA };
  if (chavesCache) return chavesCache;
  const ref = admin.firestore().collection("configPush").doc("vapid");
  chavesCache = await admin.firestore().runTransaction(async (tx) => {
    const d = await tx.get(ref);
    if (d.exists && d.data().publica && d.data().privada) return { publica: d.data().publica, privada: d.data().privada };
    const e = crypto.createECDH("prime256v1"); e.generateKeys();
    const novas = { publica: b64u(e.getPublicKey()), privada: b64u(e.getPrivateKey()), criadoEm: new Date().toISOString() };
    tx.set(ref, novas);
    return { publica: novas.publica, privada: novas.privada };
  });
  return chavesCache;
}
async function chavePublica(admin) { return (await chaves(admin)).publica; }
function idDaInscricao(endpoint) { return crypto.createHash("sha256").update(String(endpoint)).digest("hex").slice(0, 40); }

/* RFC 8291 §3–4: uma mensagem só (registro único), com rs = 4096 */
function criptografar(texto, p256dh, authSecret, opc) {
  opc = opc || {};
  const uaPublica = deB64u(p256dh), auth = deB64u(authSecret);
  if (uaPublica.length !== 65 || auth.length !== 16) throw new Error("Chaves da inscrição inválidas.");
  const ecdh = crypto.createECDH("prime256v1");
  if (opc.privadaRemetente) ecdh.setPrivateKey(deB64u(opc.privadaRemetente)); else ecdh.generateKeys();
  const asPublica = ecdh.getPublicKey();
  const segredo = ecdh.computeSecret(uaPublica);
  const prkChave = hmac(auth, segredo);
  const ikm = hmac(prkChave, Buffer.concat([Buffer.from("WebPush: info\0"), uaPublica, asPublica, Buffer.from([1])]));
  const salt = opc.salt ? deB64u(opc.salt) : crypto.randomBytes(16);
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from("Content-Encoding: aes128gcm\0\x01", "binary")).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from("Content-Encoding: nonce\0\x01", "binary")).subarray(0, 12);
  const cifra = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const corpo = Buffer.concat([cifra.update(Buffer.concat([Buffer.from(texto, "utf8"), Buffer.from([2])])), cifra.final(), cifra.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublica.length]), asPublica, corpo]);
}

/* RFC 8292: JWT ES256 assinado com a chave privada do servidor; aud = origem do serviço de push */
function cabecalhoVapid(endpoint, k) {
  const pub = deB64u(k && k.publica), d = k && k.privada;
  if (pub.length !== 65 || !d) throw new Error("Chaves VAPID inválidas.");
  const chave = crypto.createPrivateKey({ key: { kty: "EC", crv: "P-256", d, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) }, format: "jwk" });
  const aud = new URL(endpoint).origin;
  const sub = process.env.PUSH_CONTATO || "https://quadralab.com.br";
  const dados = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" })) + "." + b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub }));
  const assinatura = crypto.sign("sha256", Buffer.from(dados), { key: chave, dsaEncoding: "ieee-p1363" });
  return "vapid t=" + dados + "." + b64u(assinatura) + ", k=" + k.publica;
}

function postar(endpoint, corpo, cab) {
  return new Promise((ok) => {
    let u; try { u = new URL(endpoint); } catch (e) { return ok({ status: 0 }); }
    if (u.protocol !== "https:") return ok({ status: 0 });
    const req = https.request({ method: "POST", hostname: u.hostname, port: u.port || 443, path: u.pathname + u.search, headers: { ...cab, "content-length": corpo.length }, timeout: 10000 }, (res) => {
      res.resume(); res.on("end", () => ok({ status: res.statusCode }));
    });
    req.on("timeout", () => { req.destroy(); ok({ status: 0 }); });
    req.on("error", () => ok({ status: 0 }));
    req.end(corpo);
  });
}

function textoDoAviso(aviso) {
  const a = aviso || {};
  return JSON.stringify({ titulo: String(a.titulo || "QuadraLab").slice(0, 80), corpo: String(a.corpo || "").slice(0, 240), url: String(a.url || "/").slice(0, 300), tag: String(a.tag || "").slice(0, 60),
    ...(a.icone ? { icone: String(a.icone).slice(0, 120) } : {}) });
}

async function enviarUma(insc, aviso, k) {
  const corpo = criptografar(textoDoAviso(aviso), insc.keys.p256dh, insc.keys.auth);
  return postar(insc.endpoint, corpo, { authorization: cabecalhoVapid(insc.endpoint, k), "content-encoding": "aes128gcm", "content-type": "application/octet-stream", ttl: "86400", urgency: "normal" });
}

/* filtro: { app?, orgId?, alunoId?, uid?, atletaUid?, papel?, apps?: [..] } — todos os campos informados precisam bater */
async function enviarPara(admin, filtro, aviso) {
  let q = admin.firestore().collection(COLECAO);
  for (const k of ["app", "orgId", "alunoId", "uid", "atletaUid", "papel"]) if (filtro[k] != null && filtro[k] !== "") q = q.where(k, "==", String(filtro[k]));
  const snap = await q.limit(500).get();
  let enviados = 0, falhas = 0, removidos = 0;
  const k = await chaves(admin);
  const lista = [];
  snap.forEach((d) => { const x = d.data(); if (!filtro.apps || filtro.apps.indexOf(x.app) >= 0) lista.push({ id: d.id, ...x }); });
  for (const insc of lista) {
    /* "@app": abre a tela de onde a pessoa ativou (gravada na inscrição); o atleta recebe com o ícone do Player */
    const av = { ...aviso, url: aviso.url === "@app" ? insc.url || "/" : aviso.url, icone: aviso.icone || (insc.app === "player" ? "/assets/player-icon-192.png" : undefined) };
    let r; try { r = await enviarUma(insc, av, k); } catch (e) { r = { status: 0 }; }
    if (r.status >= 200 && r.status < 300) enviados++;
    else if (r.status === 404 || r.status === 410) { removidos++; await admin.firestore().collection(COLECAO).doc(insc.id).delete().catch(() => {}); }
    else falhas++;
  }
  return { enviados, falhas, removidos };
}

/* Para não derrubar a ação principal (aprovar, iniciar o jogo…) se o envio falhar: o aviso é extra. */
async function avisar(admin, filtro, aviso) {
  try { return await enviarPara(admin, filtro, aviso); } catch (e) { console.error("push:", e && e.message); return null; }
}

module.exports = { chaves, chavePublica, idDaInscricao, criptografar, cabecalhoVapid, enviarUma, enviarPara, avisar, textoDoAviso, COLECAO, b64u, deB64u };
