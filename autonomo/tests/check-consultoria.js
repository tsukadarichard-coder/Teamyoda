/* Consultoria com Richard Tsukada (netlify/functions/consultoria.js, Etapa 1) com Firebase e Storage falsos:
   conta e cadastro (menor com aceite do responsável), liberação pelo Richard, envio de vídeo (limites, sessão retomável, conferência),
   fila com prazo, devolutiva com gravação, avisos no celular, dúvida em texto, quem vê o quê e a limpeza de 90 dias.
   Rode: node tests/check-consultoria.js */
const assert = require("assert"), path = require("path");
const fx = path.join(__dirname, "../../netlify/functions/");

/* ── Firestore em memória ── */
const store = {}; const J = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
let nDoc = 0;
function docRef(p) { return { id: p.split("/").pop(), async get() { const v = store[p]; return { exists: v !== undefined, id: p.split("/").pop(), data: () => J(v) }; }, async set(v) { store[p] = J(v); }, async delete() { delete store[p]; } }; }
function colRef(p, f = []) {
  return {
    doc: (id) => docRef(p + "/" + (id || "doc" + String(++nDoc).padStart(10, "0") + "abc")),
    where: (c, o, v) => colRef(p, f.concat([[c, v]])),
    async get() {
      const ks = Object.keys(store).filter((k) => k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/")).filter((k) => f.every(([c, v]) => store[k][c] === v));
      const docs = ks.map((k) => ({ id: k.split("/").pop(), data: () => J(store[k]) }));
      return { docs, size: docs.length, empty: !docs.length, forEach: (fn) => docs.forEach(fn) };
    },
  };
}
const usuarios = { "tk-richard": { uid: "uRichard01", email: "tsukada.richard@gmail.com", email_verified: true }, "tk-impostor": { uid: "uImpostor1", email: "tsukada.richard@gmail.com", email_verified: false } };
const criados = [];
const auth = {
  async createUser(u) { if (criados.some((x) => x.email === u.email)) { const e = new Error("x"); e.code = "auth/email-already-exists"; throw e; } const uid = "uNovo" + String(criados.length + 1).padStart(5, "0"); criados.push({ ...u, uid }); return { uid }; },
  async getUserByEmail(email) { const c = criados.filter((x) => x.email === email)[0] || Object.values(usuarios).filter((x) => x.email === email)[0]; if (!c) { const e = new Error("x"); e.code = "auth/user-not-found"; throw e; } return { uid: c.uid }; },
  async verifyIdToken(t) { if (!usuarios[t]) throw new Error("token"); return usuarios[t]; },
};
const adminFalso = { firestore: () => ({ collection: (n) => colRef(n) }), auth: () => auth };
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "a", filename: "a", loaded: true, exports: { admin: adminFalso, app: () => {} } };
/* avisos no celular: só registra */
const avisos = [];
require.cache[require.resolve(fx + "_push.js")] = { id: "p", filename: "p", loaded: true, exports: { avisar: async (adm, filtro, aviso) => { avisos.push({ filtro, aviso }); return { enviados: 1 }; } } };
/* Storage falso: o "bucket" guarda metadados por caminho */
const bucket = {}, sessoes = [], corsGravado = [];
require.cache[require.resolve(fx + "_olhar-armazenamento.js")] = { id: "o", filename: "o", loaded: true, exports: { bucket: async () => ({
  name: "metodologia-mty.firebasestorage.app",
  file: (c) => ({
    async createResumableUpload(o) { sessoes.push({ caminho: c, ...o }); return ["https://storage.googleapis.com/upload/sessao-" + sessoes.length]; },
    async getMetadata() { if (!bucket[c]) throw new Error("404"); return [bucket[c]]; },
    async getSignedUrl(o) { return ["https://assinado.exemplo/" + c + "?ct=" + o.responseType]; },
    async delete() { if (!bucket[c]) throw new Error("404"); delete bucket[c]; },
  }),
  async getMetadata() { return [{ cors: [{ origin: ["https://painel.exemplo"], method: ["PUT"] }] }]; },
  async setCorsConfiguration(c) { corsGravado.push(c); },
}) } };
const C = require(fx + "_consultoria.js");
const { handler } = require(fx + "consultoria.js");
const ORIGEM = "https://teamyoda.com.br";
const chama = async (tk, corpo, extra) => {
  const h = { origin: ORIGEM }; if (tk) h.authorization = "Bearer " + tk;
  const r = await handler({ httpMethod: corpo ? "POST" : "GET", headers: { ...h, ...(extra || {}) }, body: corpo ? JSON.stringify(corpo) : "" });
  return { s: r.statusCode, ...JSON.parse(r.body) };
};
const hoje = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const anosAtras = (n) => String(Number(hoje.slice(0, 4)) - n) + hoje.slice(4);
const videoOk = { tema: "saque", duvida: "Perco força no segundo saque quando estou cansado.", contentType: "video/quicktime", tamanho: 48 * 1048576, duracaoSeg: 52 };

(async () => {
  /* ── regras puras ── */
  assert.strictEqual(C.idade("2010-11-13", "2026-11-12"), 15, "aniversário amanhã: ainda 15");
  assert.strictEqual(C.idade("2010-11-12", "2026-11-12"), 16);
  assert.throws(() => C.limparCadastro({ nome: "Lia", nascimento: anosAtras(14) }, hoje), /nome do responsável/);
  assert.throws(() => C.limparCadastro({ nome: "Lia", nascimento: anosAtras(14), responsavel: { nome: "Ana", email: "ana@x.com" } }, hoje), /autorizar/);
  assert.deepStrictEqual(C.limparCadastro({ nome: " Lia  Souza ", nascimento: anosAtras(30), objetivo: "Jogar torneios", responsavel: { nome: "x" } }, hoje),
    { nome: "Lia Souza", nascimento: anosAtras(30), objetivo: "Jogar torneios", menor: false }, "adulto não leva responsável");
  assert.throws(() => C.validarVideo({ ...videoOk, duracaoSeg: 200 }), /3 minutos/);
  assert.throws(() => C.validarVideo({ ...videoOk, tamanho: 700 * 1048576 }), /1080p/);
  assert.throws(() => C.validarVideo({ ...videoOk, contentType: "image/png" }), /Formato/);
  assert.throws(() => C.validarVideo({ ...videoOk, tema: "pintura" }), /Escolha/);
  assert.strictEqual(C.validarVideo({ ...videoOk, contentType: "video/quicktime" }).ext, "mov", "vídeo do iPhone (MOV) aceito");
  assert.throws(() => C.validarVideo({ ...videoOk, duracaoSeg: null }), /duração/);
  assert.strictEqual(C.validarVideo({ ...videoOk, duracaoSeg: null, duracaoDesconhecida: true }).duracaoSeg, null, "duração ilegível: vale o limite de tamanho");
  const agoraT = "2026-11-12T15:00:00.000Z";
  assert.strictEqual(C.prazo({ recebidoEm: "2026-11-08T12:00:00.000Z" }, agoraT).estado, "atrasado");
  assert.strictEqual(C.prazo({ recebidoEm: "2026-11-10T12:00:00.000Z" }, agoraT).rotulo, "Vence amanhã");
  assert.strictEqual(C.prazo({ recebidoEm: "2026-11-12T12:00:00.000Z" }, agoraT).estado, "no-prazo");
  assert.ok(C.origemPermitida("https://teamyoda.com.br") && C.origemPermitida("https://abc--teamyoda.netlify.app") && !C.origemPermitida("https://teamyoda.com.br.evil.com"));
  assert.ok(C.ehDono({ email: "tsukada.richard@gmail.com" }) && C.ehDono({ email: " Tsukada.Richard@Gmail.com", email_verified: false }), "o e-mail do Richard vale mesmo sem verificação, como no financeiro");
  assert.ok(!C.ehDono({ email: "outro@gmail.com" }) && !C.ehDono({}), "outro e-mail não é o Richard");

  /* links do YouTube */
  for (const u of ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ?t=42", "https://m.youtube.com/watch?feature=x&v=dQw4w9WgXcQ", "https://youtube.com/shorts/dQw4w9WgXcQ"])
    assert.strictEqual(C.idYoutube(u), "dQw4w9WgXcQ", u);
  for (const u of ["https://vimeo.com/123", "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ", "javascript:alert(1)", "https://youtu.be/curto", ""]) assert.strictEqual(C.idYoutube(u), null, u);
  assert.throws(() => C.validarLink({ tema: "saque", duvida: "Meu saque", url: "https://vimeo.com/1" }), /YouTube/);
  assert.deepStrictEqual(C.limparDevolutiva({ linkVideo: "https://youtu.be/dQw4w9WgXcQ" }, false).youtube, { id: "dQw4w9WgXcQ" }, "devolutiva só com vídeo do YouTube");
  assert.throws(() => C.limparDevolutiva({ texto: "ok", linkVideo: "https://vimeo.com/1" }, false), /YouTube/);

  /* ── conta ── */
  assert.strictEqual((await chama(null)).s, 401);
  assert.strictEqual((await chama(null, { acao: "criarConta", nome: "Lia", email: "lia@x.com", senha: "123" })).s, 400, "senha curta");
  assert.strictEqual((await chama(null, { acao: "criarConta", nome: "Lia Souza", email: "lia@x.com", senha: "12345678" })).s, 200);
  let r = await chama(null, { acao: "criarConta", nome: "Lia", email: "lia@x.com", senha: "12345678" });
  assert.strictEqual(r.s, 409); assert.ok(/Entre com ela/.test(r.erro));
  usuarios["tk-lia"] = { uid: "uLia000001", email: "lia@x.com" }; usuarios["tk-beto"] = { uid: "uBeto00001", email: "beto@x.com" };

  /* sem cadastro: não envia */
  r = await chama("tk-lia");
  assert.strictEqual(r.papel, "cliente"); assert.strictEqual(r.cliente, null); assert.ok(/cadastro/.test(r.motivoSemEnvio));
  assert.strictEqual((await chama("tk-lia", { acao: "envioIniciar", ...videoOk })).s, 403);
  /* cadastro de menor: aceite do responsável guardado com data; entra pendente e o Richard é avisado */
  r = await chama("tk-lia", { acao: "cadastro", nome: "Lia Souza", nascimento: anosAtras(15), objetivo: "Melhorar o saque", responsavel: { nome: "Ana Souza", email: "ana@x.com", aceite: true } });
  assert.strictEqual(r.s, 200); assert.strictEqual(r.cliente.estado, "pendente"); assert.strictEqual(r.cliente.menor, true); assert.ok(r.cliente.responsavel.aceiteEm);
  assert.ok(avisos.some((a) => a.filtro.papel === "richard" && /Novo cliente/.test(a.aviso.titulo)), "Richard avisado do cliente novo");
  assert.strictEqual(store["consultoriaClientes/uLia000001"].email, "lia@x.com");
  r = await chama("tk-lia", { acao: "envioIniciar", ...videoOk });
  assert.strictEqual(r.s, 403); assert.ok(/liberar/.test(r.erro), "pendente não envia");

  /* ── Richard: impostor e cliente não entram no painel ── */
  assert.strictEqual((await chama("tk-impostor")).papel, "richard", "conta do Richard sem verificação abre o painel");
  assert.strictEqual((await chama("tk-lia")).eu.email, "lia@x.com", "a tela recebe com qual e-mail a pessoa entrou");
  assert.strictEqual((await chama("tk-lia", { acao: "liberar", uid: "uLia000001" })).s, 403, "cliente não libera ninguém");
  r = await chama("tk-richard");
  assert.strictEqual(r.papel, "richard"); assert.strictEqual(r.clientes[0].estado, "pendente"); assert.deepStrictEqual(r.fila, []);
  r = await chama("tk-richard", { acao: "liberar", uid: "uLia000001" });
  assert.strictEqual(r.cliente.estado, "ativo"); assert.ok(r.cliente.liberadoEm);
  assert.ok(avisos.some((a) => a.filtro.uid === "uLia000001" && /liberada/.test(a.aviso.titulo)), "cliente avisada da liberação");

  /* ── envio de vídeo ── */
  assert.strictEqual((await chama("tk-lia", { acao: "envioIniciar", ...videoOk }, { origin: "https://outro-site.com" })).s, 400, "origem estranha não abre sessão");
  assert.strictEqual((await chama("tk-lia", { acao: "envioIniciar", ...videoOk, duracaoSeg: 240 })).s, 400);
  r = await chama("tk-lia", { acao: "envioIniciar", ...videoOk });
  assert.strictEqual(r.s, 200); assert.ok(/^https:\/\/storage\.googleapis\.com\/upload\//.test(r.sessao));
  const id1 = r.envioId, s1 = sessoes[sessoes.length - 1];
  assert.strictEqual(s1.origin, ORIGEM); assert.strictEqual(s1.metadata.contentType, "video/quicktime"); assert.ok(C.CAMINHO.test(s1.caminho) && s1.caminho.startsWith("consultoria/uLia000001/" + id1 + "/v-"));
  /* ainda subindo: não aparece na lista nem na fila; aparece como interrompido; retomar devolve a mesma sessão */
  r = await chama("tk-lia");
  assert.deepStrictEqual(r.envios, []); assert.strictEqual(r.interrompidos[0].id, id1);
  assert.strictEqual((await chama("tk-lia", { acao: "envioRetomar", envioId: id1 })).sessao, "https://storage.googleapis.com/upload/sessao-" + sessoes.length);
  assert.strictEqual((await chama("tk-beto", { acao: "envioRetomar", envioId: id1 })).s, 404, "outra pessoa não retoma o envio da Lia");
  assert.strictEqual((await chama("tk-lia", { acao: "envioConcluir", envioId: id1 })).s, 409, "arquivo ainda não chegou");
  /* chegou diferente do declarado: apaga */
  bucket[s1.caminho] = { contentType: "video/quicktime", size: 10, md5Hash: "x", generation: 1 };
  r = await chama("tk-lia", { acao: "envioConcluir", envioId: id1 });
  assert.strictEqual(r.s, 400); assert.ok(!bucket[s1.caminho] && !store["consultoriaEnvios/" + id1], "arquivo e envio apagados");
  /* agora certo */
  r = await chama("tk-lia", { acao: "envioIniciar", ...videoOk });
  const id2 = r.envioId, s2 = sessoes[sessoes.length - 1];
  bucket[s2.caminho] = { contentType: "video/quicktime", size: videoOk.tamanho, md5Hash: "abc==", generation: 77 };
  r = await chama("tk-lia", { acao: "envioConcluir", envioId: id2 });
  assert.strictEqual(r.s, 200); assert.strictEqual(r.envio.estado, "recebido"); assert.strictEqual(r.envio.video.duracaoSeg, 52);
  assert.ok(!("sessao" in store["consultoriaEnvios/" + id2]) && store["consultoriaEnvios/" + id2].video.md5 === "abc==", "sessão apagada, impressão digital guardada");
  assert.ok(!JSON.stringify(r.envio).includes("consultoria/"), "o cliente não recebe o caminho do arquivo");
  assert.ok(avisos.some((a) => a.filtro.papel === "richard" && /Vídeo novo: Saque/.test(a.aviso.titulo) && a.aviso.url === "/richard/#/responder/" + id2));
  /* limite de 3 aguardando */
  for (let i = 0; i < 2; i++) {
    const x = await chama("tk-lia", { acao: "envioIniciar", ...videoOk, tema: "forehand" }), sx = sessoes[sessoes.length - 1];
    bucket[sx.caminho] = { contentType: "video/quicktime", size: videoOk.tamanho, generation: 1 };
    assert.strictEqual((await chama("tk-lia", { acao: "envioConcluir", envioId: x.envioId })).s, 200);
  }
  r = await chama("tk-lia", { acao: "envioIniciar", ...videoOk });
  assert.strictEqual(r.s, 409); assert.ok(/3 envios esperando/.test(r.erro));
  /* cancelar um envio interrompido apaga o pedaço */
  store["consultoriaEnvios/envioPerdido0001"] = { uid: "uLia000001", tipo: "video", tema: "jogo", estado: "enviando", criadoEm: new Date().toISOString(), video: { caminho: "consultoria/uLia000001/envioPerdido0001/v-1700000000000-aaaaaa.mp4", contentType: "video/mp4", tamanho: 5 } };
  bucket["consultoria/uLia000001/envioPerdido0001/v-1700000000000-aaaaaa.mp4"] = { size: 2 };
  assert.strictEqual((await chama("tk-lia", { acao: "envioCancelar", envioId: "envioPerdido0001" })).s, 200);
  assert.ok(!store["consultoriaEnvios/envioPerdido0001"] && !bucket["consultoria/uLia000001/envioPerdido0001/v-1700000000000-aaaaaa.mp4"]);

  /* ── ver o vídeo: a dona e o Richard sim; outra pessoa não ── */
  assert.ok(/^https:\/\/assinado\.exemplo\//.test((await chama("tk-lia", { acao: "verVideo", envioId: id2 })).url));
  assert.ok((await chama("tk-richard", { acao: "verVideo", envioId: id2 })).url);
  assert.strictEqual((await chama("tk-beto", { acao: "verVideo", envioId: id2 })).s, 404);

  /* ── fila do Richard: mais antigo primeiro, com prazo e nome ── */
  store["consultoriaEnvios/" + id2].recebidoEm = "2026-01-02T10:00:00.000Z";
  r = await chama("tk-richard");
  assert.strictEqual(r.fila.length, 3); assert.strictEqual(r.fila[0].id, id2); assert.strictEqual(r.fila[0].cliente, "Lia Souza"); assert.strictEqual(r.fila[0].prazo.estado, "atrasado");
  assert.strictEqual(r.clientes[0].naFila, 3);

  /* ── responder com áudio ── */
  assert.strictEqual((await chama("tk-richard", { acao: "respostaIniciar", envioId: id2, contentType: "image/png", tamanho: 10 })).s, 400);
  r = await chama("tk-richard", { acao: "respostaIniciar", envioId: id2, contentType: "audio/webm;codecs=opus", tamanho: 300000 });
  assert.strictEqual(r.s, 200); assert.strictEqual(r.tipo, "audio"); assert.ok(r.caminho.startsWith("consultoria/uLia000001/" + id2 + "/r-"));
  const resp = r.caminho;
  assert.strictEqual((await chama("tk-richard", { acao: "responder", envioId: id2, texto: "", midia: { caminho: resp } })).s, 409, "gravação ainda não chegou");
  bucket[resp] = { contentType: "audio/webm", size: 300000 };
  assert.strictEqual((await chama("tk-richard", { acao: "responder", envioId: id2, texto: "x", midia: { caminho: "consultoria/uBeto00001/" + id2 + "/r-1700000000000-aaaaaa.webm" } })).s, 400, "gravação de outro envio");
  assert.strictEqual((await chama("tk-richard", { acao: "responder", envioId: id2 })).s, 400, "devolutiva vazia");
  r = await chama("tk-richard", { acao: "responder", envioId: id2, viu: "O lançamento cai para trás.", texto: "Bom começo.", treinar: ["Lançamento com alvo, 3x10", "Saque com pés juntos", "", "x"], midia: { caminho: resp } });
  assert.strictEqual(r.s, 200); assert.strictEqual(r.envio.estado, "respondido"); assert.deepStrictEqual(r.envio.devolutiva.treinar, ["Lançamento com alvo, 3x10", "Saque com pés juntos"]);
  assert.deepStrictEqual(r.envio.devolutiva.midia, { tipo: "audio" });
  assert.ok(avisos.some((a) => a.filtro.uid === "uLia000001" && /Devolutiva do Richard/.test(a.aviso.titulo) && /saque/.test(a.aviso.corpo) && a.aviso.url === "/richard/#/envio/" + id2));
  assert.strictEqual((await chama("tk-richard", { acao: "responder", envioId: id2, texto: "de novo" })).s, 409, "não responde duas vezes");
  assert.ok(/ct=audio\/webm/.test((await chama("tk-lia", { acao: "verResposta", envioId: id2 })).url));
  /* a cliente vê a devolutiva; "entendi"; dúvida em texto volta para a fila */
  r = await chama("tk-lia");
  const env = r.envios.filter((x) => x.id === id2)[0];
  assert.strictEqual(env.devolutiva.viu, "O lançamento cai para trás."); assert.ok(env.apagarVideoEm, "mostra quando o vídeo será apagado");
  assert.strictEqual((await chama("tk-lia", { acao: "entendi", envioId: id2 })).envio.entendidoEm != null, true);
  r = await chama("tk-lia", { acao: "pergunta", envioId: id2, texto: "Faço o lançamento com a mão esticada?" });
  assert.strictEqual(r.s, 200); assert.strictEqual(r.envio.tipo, "pergunta"); assert.strictEqual(r.envio.refEnvio, id2);
  assert.ok(avisos.some((a) => /Dúvida sobre uma devolutiva/.test(a.aviso.titulo)));
  /* agora são 3 esperando (2 vídeos + a dúvida): nem vídeo nem outra dúvida */
  assert.strictEqual((await chama("tk-lia", { acao: "pergunta", envioId: id2, texto: "E o pé?" })).s, 409, "dúvida respeita o limite de 3 esperando");
  assert.strictEqual((await chama("tk-lia", { acao: "pergunta", envioId: r.envio.id, texto: "oi?" })).s, 409, "só pergunta sobre devolutiva já respondida");

  /* ── ficha do cliente e anotação privada ── */
  assert.strictEqual((await chama("tk-richard", { acao: "nota", uid: "uLia000001", texto: "Mãe muito presente; falar de rotina." })).s, 200);
  r = await chama("tk-richard", { acao: "cliente", uid: "uLia000001" });
  assert.strictEqual(r.nota, "Mãe muito presente; falar de rotina."); assert.ok(r.envios.length >= 4);
  assert.ok(!JSON.stringify(await chama("tk-lia")).includes("Mãe muito presente"), "a anotação nunca vai para a cliente");
  /* outro cliente manda pelo link do YouTube (sem armazenamento) e recebe a devolutiva também por link */
  usuarios["tk-caio"] = { uid: "uCaio00001", email: "caio@x.com" };
  await chama("tk-caio", { acao: "cadastro", nome: "Caio Reis", nascimento: anosAtras(32), objetivo: "Voleio" });
  await chama("tk-richard", { acao: "liberar", uid: "uCaio00001" });
  assert.strictEqual((await chama("tk-caio", { acao: "envioLink", tema: "rede", duvida: "Voleio de backhand", url: "https://exemplo.com/v" })).s, 400);
  r = await chama("tk-caio", { acao: "envioLink", tema: "rede", duvida: "Voleio de backhand sai alto.", url: "https://youtu.be/dQw4w9WgXcQ" });
  assert.strictEqual(r.s, 200); assert.strictEqual(r.envio.estado, "recebido"); assert.deepStrictEqual(r.envio.youtube, { id: "dQw4w9WgXcQ" }); assert.strictEqual(r.envio.video, null);
  const idYt = r.envio.id;
  assert.ok(avisos.some((a) => a.filtro.papel === "richard" && /link do YouTube/.test(a.aviso.corpo)));
  assert.strictEqual((await chama("tk-richard")).fila.filter((x) => x.id === idYt)[0].youtube, true);
  assert.strictEqual((await chama("tk-caio", { acao: "verVideo", envioId: idYt })).s, 404, "link do YouTube não passa pelo armazenamento");
  r = await chama("tk-richard", { acao: "responder", envioId: idYt, viu: "Cabeça da raquete cai.", linkVideo: "https://www.youtube.com/watch?v=abcdefghijk" });
  assert.strictEqual(r.s, 200); assert.deepStrictEqual(r.envio.devolutiva.youtube, { id: "abcdefghijk" });

  /* convite: o Richard cadastra quem já combinou; entra liberado, completa o cadastro no primeiro acesso */
  assert.strictEqual((await chama("tk-lia", { acao: "convidar", nome: "X", email: "x@x.com" })).s, 403, "cliente não convida");
  assert.strictEqual((await chama("tk-richard", { acao: "convidar", nome: "Duda", email: "duda" })).s, 400);
  r = await chama("tk-richard", { acao: "convidar", nome: "Duda  Ramos", email: "Duda@X.com" });
  assert.strictEqual(r.s, 200); assert.strictEqual(r.contaNova, true); assert.strictEqual(r.cliente.estado, "ativo"); assert.strictEqual(r.cliente.cadastroPendente, true); assert.strictEqual(r.cliente.nome, "Duda Ramos");
  const uidDuda = r.cliente.uid; usuarios["tk-duda"] = { uid: uidDuda, email: "duda@x.com" };
  r = await chama("tk-duda"); assert.ok(/cadastro/.test(r.motivoSemEnvio), "convidado completa o cadastro antes de enviar"); assert.strictEqual(r.cliente.cadastroPendente, true);
  r = await chama("tk-duda", { acao: "cadastro", nome: "Duda Ramos", nascimento: anosAtras(28), objetivo: "Saque" });
  assert.strictEqual(r.cliente.estado, "ativo", "continua liberado depois do cadastro"); assert.strictEqual(r.cliente.cadastroPendente, false);
  assert.strictEqual((await chama("tk-duda")).motivoSemEnvio, "", "já pode enviar");
  assert.ok(!avisos.some((a) => /Novo cliente/.test(a.aviso.titulo) && /Duda/.test(a.aviso.corpo)), "convidado não aparece como pedido novo");
  /* convidar quem já tem conta no Team Yoda usa a mesma conta */
  r = await chama("tk-richard", { acao: "convidar", nome: "Beto", email: "beto@x.com" });
  assert.strictEqual(r.contaNova, false); assert.strictEqual(r.cliente.uid, "uBeto00001");

  /* pausar: não envia mais, mas vê o histórico */
  await chama("tk-richard", { acao: "pausar", uid: "uLia000001" });
  r = await chama("tk-lia"); assert.ok(/pausada/.test(r.motivoSemEnvio)); assert.ok(r.envios.length >= 4);

  /* ── armazenamento: junta a regra do site ao CORS, sem apagar as outras ── */
  r = await chama("tk-richard", { acao: "prepararArmazenamento" });
  assert.strictEqual(r.bucket, "metodologia-mty.firebasestorage.app");
  const cors = corsGravado.pop();
  assert.strictEqual(cors.length, 2); assert.deepStrictEqual(cors[0].origin, ["https://painel.exemplo"]); assert.ok(cors[1].origin.includes("https://teamyoda.com.br") && cors[1].responseHeader.includes("range"));
  assert.strictEqual(require(fx + "_consultoria-armazenamento.js").juntarCors(cors, ["https://teamyoda.com.br", "https://www.teamyoda.com.br"]).length, 2, "preparar de novo não duplica");
  assert.strictEqual((await chama("tk-lia", { acao: "prepararArmazenamento" })).s, 403);

  /* ── limpeza: vídeo com devolutiva há mais de 90 dias sai; a devolutiva fica ── */
  const L = require(fx + "consultoria-limpeza.js");
  store["consultoriaEnvios/" + id2].devolutiva.respondidoEm = "2026-01-01T10:00:00.000Z";
  store["consultoriaEnvios/abandonado0001"] = { uid: "uLia000001", tipo: "video", estado: "enviando", criadoEm: "2026-01-01T10:00:00.000Z", video: { caminho: "consultoria/uLia000001/abandonado0001/v-1700000000000-bbbbbb.mp4" } };
  bucket["consultoria/uLia000001/abandonado0001/v-1700000000000-bbbbbb.mp4"] = { size: 1 };
  r = await L.limpar(new Date().toISOString());
  assert.deepStrictEqual(r, { videosApagados: 1, enviosAbandonados: 1 });
  assert.ok(!bucket[s2.caminho] && store["consultoriaEnvios/" + id2].videoApagadoEm && store["consultoriaEnvios/" + id2].devolutiva.viu, "vídeo apagado, devolutiva guardada");
  assert.ok(bucket[resp], "a gravação do Richard fica");
  r = await chama("tk-lia", { acao: "verVideo", envioId: id2 }); assert.strictEqual(r.s, 410); assert.ok(/90 dias/.test(r.erro));
  assert.strictEqual((await chama("tk-lia")).envios.filter((x) => x.id === id2)[0].video.apagado, true);

  /* ── avisos no celular: a inscrição "consultoria" separa o Richard dos clientes ── */
  const PI = require(fx + "push-inscricao.js");
  assert.deepStrictEqual(await PI.destinatario("consultoria", { uid: "uRichard01", email: "tsukada.richard@gmail.com" }), { app: "consultoria", uid: "uRichard01", papel: "richard" });
  assert.deepStrictEqual(await PI.destinatario("consultoria", { uid: "uLia000001", email: "lia@x.com" }), { app: "consultoria", uid: "uLia000001", papel: "cliente" });
  await assert.rejects(PI.destinatario("consultoria", null), /Entre/);
  console.log("check-consultoria: ok");
})().catch((e) => { console.error(e); process.exit(1); });
