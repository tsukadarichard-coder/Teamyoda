/* Notificações no celular (netlify/functions/_push.js, push-inscricao.js, push-avisar.js, push-lembretes.js e _push-aulas.js dos
   dois sites), com Firestore em memória e um serviço de push falso que DECIFRA cada mensagem com a chave privada do "aparelho":
   · criptografia igual ao exemplo da RFC 8291; assinatura VAPID válida; chaves geradas uma vez e guardadas no servidor;
   · inscrição: quem recebe vem do login (treinador, aluno com conta, link do aluno, atleta do Player), endereço só de serviço de push;
   · avisos por evento (aluno pede acesso, jogo ao vivo, plano/relatório do treinador, novidades só do dono) chegam a quem deve;
   · lembretes: aulas do dia, aula amanhã e aulas sem marcar, nos dois modelos de agenda; inscrição vencida (410) é apagada.
   Rode: node tests/check-push.js */
const assert = require("assert"), path = require("path"), crypto = require("crypto"), Module = require("module");

/* ── Firestore em memória ── */
const docs = new Map();
function docRef(caminho) {
  return {
    id: caminho.split("/").pop(), path: caminho,
    async get() { const v = docs.get(caminho); return { exists: v !== undefined, id: caminho.split("/").pop(), data: () => (v === undefined ? undefined : JSON.parse(JSON.stringify(v))) }; },
    async set(v) { docs.set(caminho, JSON.parse(JSON.stringify(v))); },
    async create(v) { if (docs.has(caminho)) throw new Error("ALREADY_EXISTS"); docs.set(caminho, JSON.parse(JSON.stringify(v))); },
    async update(v) { docs.set(caminho, { ...(docs.get(caminho) || {}), ...JSON.parse(JSON.stringify(v)) }); },
    async delete() { docs.delete(caminho); },
    collection: (n) => colRef(caminho + "/" + n),
  };
}
function colRef(caminho, filtros) {
  filtros = filtros || [];
  return {
    doc: (id) => docRef(caminho + "/" + id),
    where: (k, op, v) => colRef(caminho, filtros.concat([[k, v]])),
    limit: () => colRef(caminho, filtros),
    async add(v) { const id = "id" + docs.size; docs.set(caminho + "/" + id, v); return { id }; },
    async get() {
      const out = [];
      for (const [k, v] of docs) { const resto = k.slice(caminho.length + 1); if (k.startsWith(caminho + "/") && !resto.includes("/") && filtros.every(([c, x]) => v[c] === x)) out.push({ id: resto, data: () => JSON.parse(JSON.stringify(v)) }); }
      return { docs: out, forEach: (f) => out.forEach(f), size: out.length };
    },
  };
}
const firestore = { collection: (n) => colRef(n), runTransaction: async (fn) => fn({ get: (r) => r.get(), set: (r, v) => r.set(v) }) };
const CLAIMS = {
  "tk-treinador": { uid: "prof1", orgId: "org1", role: "treinador", email: "prof@x.com" },
  "tk-coord": { uid: "coord1", orgId: "org1", role: "coordenador", email: "c@x.com" },
  "tk-dono": { uid: "dono", orgId: "org1", role: "treinador", email: "tsukada.richard@gmail.com" },
  "tk-aluno": { uid: "alu1", email: "aluno@x.com" },
  "tk-atleta": { uid: "atl1", email: "atleta@x.com" },
};
const admin = { firestore: () => firestore, auth: () => ({ async verifyIdToken(t) { if (!CLAIMS[t]) throw new Error("x"); return CLAIMS[t]; } }) };

/* ── serviço de push falso: guarda a mensagem decifrada; endereços terminados em /vencido respondem 410 ── */
const https = require("https"), entregues = [];
const aparelhos = new Map();
function novoAparelho(host, nome) {
  const ecdh = crypto.createECDH("prime256v1"); ecdh.generateKeys();
  const auth = crypto.randomBytes(16), b64u = (b) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const endpoint = "https://" + host + "/push/" + nome;
  aparelhos.set(endpoint, { ecdh, auth });
  return { endpoint, keys: { p256dh: b64u(ecdh.getPublicKey()), auth: b64u(auth) } };
}
function decifrar(endpoint, corpo) {
  const a = aparelhos.get(endpoint), hmac = (k, d) => crypto.createHmac("sha256", k).update(d).digest();
  const salt = corpo.subarray(0, 16), idlen = corpo[20], asPub = corpo.subarray(21, 21 + idlen), cifrado = corpo.subarray(21 + idlen);
  const segredo = a.ecdh.computeSecret(asPub), uaPub = a.ecdh.getPublicKey();
  const ikm = hmac(hmac(a.auth, segredo), Buffer.concat([Buffer.from("WebPush: info\0"), uaPub, asPub, Buffer.from([1])]));
  const prk = hmac(salt, ikm), cek = hmac(prk, Buffer.from("Content-Encoding: aes128gcm\0\x01", "binary")).subarray(0, 16), nonce = hmac(prk, Buffer.from("Content-Encoding: nonce\0\x01", "binary")).subarray(0, 12);
  const d = crypto.createDecipheriv("aes-128-gcm", cek, nonce); d.setAuthTag(cifrado.subarray(cifrado.length - 16));
  const plano = Buffer.concat([d.update(cifrado.subarray(0, cifrado.length - 16)), d.final()]);
  assert.strictEqual(plano[plano.length - 1], 2, "delimitador do último registro");
  return JSON.parse(plano.subarray(0, plano.length - 1).toString("utf8"));
}
https.request = function (op, cb) {
  let corpo = Buffer.alloc(0);
  const req = { on() { return req; }, destroy() {}, end(b) {
    corpo = Buffer.from(b);
    const endpoint = "https://" + op.hostname + op.path;
    const [t] = /t=([^,]+)/.exec(op.headers.authorization).slice(1);
    entregues.push({ endpoint, jwt: t, k: /k=(.+)$/.exec(op.headers.authorization)[1], msg: op.path.endsWith("/vencido") ? null : decifrar(endpoint, corpo), cab: op.headers });
    const status = op.path.endsWith("/vencido") ? 410 : 201;
    const res = { statusCode: status, resume() {}, on(ev, f) { if (ev === "end") setImmediate(f); return res; } };
    setImmediate(() => cb(res));
  } };
  return req;
};

/* ── carrega as functions com o Firestore falso ── */
function carregar(dir) {
  const fx = path.join(__dirname, dir);
  for (const k of Object.keys(require.cache)) if (k.startsWith(fx)) delete require.cache[k];
  require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "f", filename: "f", loaded: true, exports: { admin, app: () => {} } };
  return { P: require(fx + "_push.js"), I: require(fx + "push-inscricao.js").handler, A: require(fx + "push-avisar.js").handler, L: require(fx + "push-lembretes.js"), AU: require(fx + "_push-aulas.js") };
}
const chamar = async (h, metodo, corpo, token) => { const r = await h({ httpMethod: metodo, headers: token ? { authorization: "Bearer " + token } : {}, body: corpo ? JSON.stringify(corpo) : "" }); return { s: r.statusCode, ...JSON.parse(r.body) }; };

(async () => {
  const { P, I, A, L, AU } = carregar("../netlify/functions/");
  /* 1. criptografia (RFC 8291) */
  const ex = P.criptografar("When I grow up, I want to be a watermelon", "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4", "BTBZMqHH6r4Tts7J_aSIgg",
    { privadaRemetente: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw", salt: "DGv6ra1nlYgDCS1FRnbzlw" });
  assert.strictEqual(P.b64u(ex), "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN", "exemplo da RFC 8291");

  /* 2. chave pública: gerada uma vez e guardada no servidor (a privada nunca sai) */
  const g1 = await chamar(I, "GET"), g2 = await chamar(I, "GET");
  assert.strictEqual(g1.chave, g2.chave, "mesma chave"); assert.strictEqual(P.deB64u(g1.chave).length, 65, "ponto P-256");
  assert(docs.get("configPush/vapid").privada && !JSON.stringify(g1).includes(docs.get("configPush/vapid").privada), "privada só no servidor");

  /* 3. inscrições */
  const dTre = novoAparelho("fcm.googleapis.com", "treinador"), dCoord = novoAparelho("web.push.apple.com", "coord"), dAlu = novoAparelho("fcm.googleapis.com", "aluno-conta");
  const dPais = novoAparelho("updates.push.services.mozilla.com", "pais"), dAtl = novoAparelho("fcm.googleapis.com", "atleta"), dVenc = novoAparelho("fcm.googleapis.com", "vencido");
  docs.set("orgs/org1/dados/mty:alunos:v2", { value: JSON.stringify([
    { id: "a1", nome: "Nicolas Prado", linkToken: "tok-nicolas", horarios: [{ dia: 4, hora: "17:00" }], professorUid: "prof1", agendaExcecoes: {} },
    { id: "a2", nome: "Pedro Lima", horarios: [{ dia: 4, hora: "08:00" }], professorUid: "outro", agendaExcecoes: { "2026-10-29|08:00": { status: "realizada" } } }]) });
  docs.set("orgs/org1/dados/mty:turmas:v1", { value: JSON.stringify([{ id: "t1", nome: "Sub-12", membros: ["a1"], horarios: [{ dia: 5, hora: "18:00" }], professorUid: "prof1" }]) });
  docs.set("contasAluno/alu1", { vinculo: { status: "ativo", orgId: "org1", alunoId: "a1" } });
  assert.strictEqual((await chamar(I, "POST", { acao: "inscrever", app: "treinador", inscricao: dTre, url: "/treinador" }, "tk-treinador")).ok, true, "treinador");
  assert.strictEqual((await chamar(I, "POST", { acao: "inscrever", app: "treinador", inscricao: dCoord, url: "/treinador" }, "tk-coord")).ok, true, "coordenação");
  assert.strictEqual((await chamar(I, "POST", { acao: "inscrever", app: "aluno", inscricao: dAlu, url: "/aluno" }, "tk-aluno")).ok, true, "aluno com conta");
  assert.strictEqual((await chamar(I, "POST", { acao: "inscrever", app: "aluno", inscricao: dPais, link: { org: "org1", id: "a1", t: "tok-nicolas" }, url: "/aluno.html?org=org1&id=a1&t=tok-nicolas" })).ok, true, "pais pelo link");
  assert.strictEqual((await chamar(I, "POST", { acao: "inscrever", app: "player", inscricao: dAtl, url: "/player/" }, "tk-atleta")).ok, true, "atleta");
  assert.strictEqual((await chamar(I, "POST", { acao: "inscrever", app: "treinador", inscricao: dVenc }, "tk-treinador")).ok, true, "aparelho que vai vencer");
  assert.strictEqual((await chamar(I, "POST", { acao: "inscrever", app: "aluno", inscricao: novoAparelho("fcm.googleapis.com", "x1"), link: { org: "org1", id: "a1", t: "errado" } })).s, 404, "link errado");
  assert.strictEqual((await chamar(I, "POST", { acao: "inscrever", app: "treinador", inscricao: novoAparelho("fcm.googleapis.com", "x2") }, "tk-aluno")).s, 403, "aluno não vira treinador");
  assert.strictEqual((await chamar(I, "POST", { acao: "inscrever", app: "treinador", inscricao: { ...novoAparelho("fcm.googleapis.com", "x3"), endpoint: "https://169.254.169.254/push" } }, "tk-treinador")).s, 400, "só serviços de push conhecidos");
  assert.strictEqual((await chamar(I, "POST", { acao: "inscrever", app: "treinador", inscricao: novoAparelho("fcm.googleapis.com", "x4"), url: "//evil.com" }, "tk-treinador")).ok, true);
  assert.strictEqual([...docs.values()].find((d) => d.endpoint && d.endpoint.endsWith("/x4")).url, "/", "endereço de outro site vira /");
  assert.strictEqual((await chamar(I, "POST", { acao: "estado", endpoint: dTre.endpoint })).inscrito, true, "estado");
  await chamar(I, "POST", { acao: "cancelar", endpoint: novoAparelho("fcm.googleapis.com", "x4").endpoint.replace(/x4$/, "x4") });
  assert.strictEqual((await chamar(I, "POST", { acao: "estado", endpoint: "https://fcm.googleapis.com/push/x4" })).inscrito, false, "cancelar");

  /* 4. avisos por evento */
  entregues.length = 0;
  const r1 = await P.avisar(admin, { app: "treinador", orgId: "org1" }, { titulo: "Aluno pedindo acesso", corpo: "Ana pediu", url: "@app", tag: "pedido-aluno" });
  assert.deepStrictEqual([r1.enviados, r1.removidos], [2, 1], "treinador + coordenação; o vencido é apagado");
  assert(![...docs.values()].some((d) => d.endpoint && d.endpoint.endsWith("/vencido")), "inscrição vencida apagada");
  const paraTre = entregues.find((e) => e.endpoint === dTre.endpoint);
  assert.deepStrictEqual([paraTre.msg.titulo, paraTre.msg.url, paraTre.msg.tag], ["Aluno pedindo acesso", "/treinador", "pedido-aluno"], "mensagem decifrada no aparelho, abre a tela do app");
  const jwt = JSON.parse(P.deB64u(paraTre.jwt.split(".")[1]));
  assert.strictEqual(jwt.aud, "https://fcm.googleapis.com", "VAPID aud = serviço de push");
  const pub = P.deB64u(paraTre.k), kpub = crypto.createPublicKey({ key: { kty: "EC", crv: "P-256", x: P.b64u(pub.subarray(1, 33)), y: P.b64u(pub.subarray(33)) }, format: "jwk" });
  assert(crypto.verify("sha256", Buffer.from(paraTre.jwt.split(".").slice(0, 2).join(".")), { key: kpub, dsaEncoding: "ieee-p1363" }, P.deB64u(paraTre.jwt.split(".")[2])), "assinatura VAPID");
  assert.strictEqual(paraTre.cab["content-encoding"], "aes128gcm");

  entregues.length = 0;
  await P.avisar(admin, { app: "aluno", orgId: "org1", alunoId: "a1" }, { titulo: "Jogo ao vivo", corpo: "Nicolas começou", url: "/scout/?l=abc", tag: "ao-vivo" });
  await P.avisar(admin, { app: "player", atletaUid: "atl1" }, { titulo: "Devolutiva", corpo: "x", url: "@app" });
  assert.deepStrictEqual(entregues.map((e) => e.endpoint).sort(), [dAlu.endpoint, dPais.endpoint, dAtl.endpoint].sort(), "aluno (conta e pais) e atleta");
  assert.strictEqual(entregues.find((e) => e.endpoint === dPais.endpoint).msg.url, "/scout/?l=abc", "ao vivo abre o placar");
  assert.strictEqual(entregues.find((e) => e.endpoint === dAtl.endpoint).msg.icone, "/assets/player-icon-192.png", "ícone do Player");

  /* push-avisar: plano/relatório do treinador e novidades só do dono */
  entregues.length = 0;
  const pa = await chamar(A, "POST", { tipo: "plano", alunoId: "a1" }, "tk-treinador");
  assert.strictEqual(pa.enviados, 2, "plano: aluno com conta e pais");
  assert(/Nicolas/.test(entregues[0].msg.corpo) && /aluno/.test(entregues.find((e) => e.endpoint === dPais.endpoint).msg.url), "texto e link do aluno");
  assert.strictEqual((await chamar(A, "POST", { tipo: "plano", alunoId: "zzz" }, "tk-treinador")).s, 404, "jogador de outra academia");
  assert.strictEqual((await chamar(A, "POST", { tipo: "novidades" }, "tk-treinador")).s, 403, "novidades só do dono");
  entregues.length = 0;
  const nv = await chamar(A, "POST", { tipo: "novidades", corpo: "Relatório do aluno" }, "tk-dono");
  assert.strictEqual(nv.enviados, 5, "novidades: todo mundo inscrito"); assert.strictEqual(entregues.find((e) => e.endpoint === dPais.endpoint).msg.tag, "novidades");

  /* 5. lembretes (funções puras + agenda dos dois sites) */
  const aulasQL = AU.aulasDoDia({ alunos: JSON.parse(docs.get("orgs/org1/dados/mty:alunos:v2").value), turmas: JSON.parse(docs.get("orgs/org1/dados/mty:turmas:v1").value) }, "2026-10-29");
  assert.deepStrictEqual(aulasQL.map((a) => [a.hora, a.titulo, a.status]), [["08:00", "Pedro Lima", "realizada"], ["17:00", "Nicolas Prado", "agendada"]], "quinta: duas aulas");
  const tre = { uid: "prof1", papel: "treinador" }, coord = { uid: "c", papel: "coordenador" };
  assert.strictEqual(L.avisoAulasHoje(aulasQL, tre).titulo, "Hoje: 1 aula", "só as do professor");
  assert.strictEqual(L.avisoAulasHoje(aulasQL, coord).titulo, "Hoje: 2 aulas", "coordenação vê todas");
  assert(/17:00 Nicolas Prado/.test(L.avisoSemMarcar(aulasQL, tre, "21:00").corpo) && L.avisoSemMarcar(aulasQL, tre, "16:00") === null, "sem marcar só depois do fim");
  const amanha = AU.aulasDoDia({ alunos: [], turmas: JSON.parse(docs.get("orgs/org1/dados/mty:turmas:v1").value) }, "2026-10-30");
  assert.strictEqual(L.avisoAulaAmanha(amanha, { alunoId: "a1" }).corpo, "Amanhã tem aula às 18:00 (Sub-12).", "aula da turma");
  assert.strictEqual(L.avisoAulaAmanha(amanha, { alunoId: "a2" }), null, "não é da turma");
  assert.deepStrictEqual(L.agoraBrasilia(new Date("2026-10-30T10:05:00Z")), { hora: 7, iso: "2026-10-30", amanha: "2026-10-31" }, "07h de Brasília");
  entregues.length = 0;
  const n = await L.rodar("aula-amanha", "2026-10-30", "21:00");
  assert.strictEqual(n, 2, "aula amanhã para conta e pais do Nicolas");

  /* Team Yoda: mesma interface, a partir das ocorrências da Agenda */
  const TY = carregar("../../netlify/functions/");
  const oc = [{ id: "o1", tipo: "regular", origemTipo: "individual", origemId: "a1", data: "2026-10-29", horaInicio: "17:00", horaFim: "18:00", status: "agendada", professorUid: "prof1" },
    { id: "o2", tipo: "regular", origemTipo: "turma", origemId: "t1", data: "2026-10-29", horaInicio: "19:00", horaFim: "20:00", status: "cancelada", professorUid: "prof1" }];
  const aulasTY = TY.AU.aulasDoDia({ alunos: [{ id: "a1", nome: "Nicolas Prado", registros: [] }], turmas: [{ id: "t1", nome: "Sub-12", membros: ["a1", "a3"] }], ocorrencias: oc }, "2026-10-29");
  assert.deepStrictEqual(aulasTY.map((a) => [a.hora, a.titulo, a.status, a.alunoIds.join()]), [["17:00", "Nicolas Prado", "agendada", "a1"], ["19:00", "Sub-12", "cancelada", "a1,a3"]], "Team Yoda");
  assert.strictEqual(TY.L.avisoAulasHoje(aulasTY, tre).corpo, "17:00 Nicolas Prado.", "cancelada fica de fora");
  console.log("check-push: ok");
})().catch((e) => { console.error(e); process.exit(1); });
