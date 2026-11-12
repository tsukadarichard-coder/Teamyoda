/* Consultoria com Richard Tsukada (teamyoda.com.br/richard) no navegador (390 px), com a function real (consultoria.js) sobre
   Firestore, Auth e Storage em memória:
   · cliente cria a conta, faz o cadastro de atleta menor (com a autorização do responsável) e espera a liberação;
   · o Richard vê o pedido em Clientes e libera; o cliente recebe o aviso;
   · vídeo de mais de 3 min é recusado; o vídeo certo sobe em pedaços, a internet cai no meio e o envio continua sozinho;
   · pausar no meio e retomar escolhendo o mesmo vídeo;
   · o Richard vê a fila com o prazo, assiste, anexa um áudio, escreve o que viu e o que treinar e envia;
   · o cliente vê a devolutiva nova no Início, ouve, marca "Entendi" e manda uma dúvida em texto;
   · sem erro de JavaScript e sem rolagem lateral.
   Rode: node tests/smoke-consultoria.js [pasta-das-capturas] */
const http = require("http"), fs = require("fs"), path = require("path"), assert = require("assert");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const raizMty = path.join(__dirname, "../../mty"), fx = path.join(__dirname, "../../netlify/functions/");
const capturas = process.argv[2] || "";
const VIDEOS = process.env.VIDEOS_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/consult";
if (!fs.existsSync(path.join(VIDEOS, "curto.webm"))) { console.log("smoke-consultoria: pulado (sem os vídeos de teste; defina VIDEOS_DIR)"); process.exit(0); }

/* ── Firestore e Auth em memória ── */
const store = {}; const J = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
let nDoc = 0;
function docRef(p) { return { id: p.split("/").pop(), async get() { const v = store[p]; return { exists: v !== undefined, id: p.split("/").pop(), data: () => J(v) }; }, async set(v) { store[p] = J(v); }, async delete() { delete store[p]; } }; }
function colRef(p, f = []) {
  return {
    doc: (id) => docRef(p + "/" + (id || "env" + String(++nDoc).padStart(12, "0"))),
    where: (c, o, v) => colRef(p, f.concat([[c, v]])), limit: () => colRef(p, f),
    async get() {
      const ks = Object.keys(store).filter((k) => k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/")).filter((k) => f.every(([c, v]) => store[k][c] === v));
      const docs = ks.map((k) => ({ id: k.split("/").pop(), data: () => J(store[k]) }));
      return { docs, size: docs.length, empty: !docs.length, forEach: (fn) => docs.forEach(fn) };
    },
  };
}
const usuarios = { uRichard01: { uid: "uRichard01", email: "tsukada.richard@gmail.com", name: "Richard Tsukada", senha: "segredo123", email_verified: true } };
let nUid = 0;
const auth = {
  async createUser(d) { if (Object.values(usuarios).some((u) => u.email === d.email)) { const e = new Error("x"); e.code = "auth/email-already-exists"; throw e; } const uid = "uCli" + String(++nUid).padStart(6, "0"); usuarios[uid] = { uid, email: d.email, name: d.displayName, senha: d.password }; return { uid }; },
  async verifyIdToken(t) { const u = usuarios[t]; if (!u) throw new Error("token"); return { uid: u.uid, email: u.email, name: u.name, email_verified: u.email_verified !== false }; },
};
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "a", filename: "a", loaded: true, exports: { admin: { firestore: () => ({ collection: (n) => colRef(n) }), auth: () => auth }, app: () => {} } };
const avisos = [];
require.cache[require.resolve(fx + "_push.js")] = { id: "p", filename: "p", loaded: true, exports: { avisar: async (a, filtro, aviso) => { avisos.push({ filtro, aviso }); return { enviados: 1 }; } } };

/* ── Storage em memória: sessões de envio retomável servidas por este mesmo servidor ── */
let PORTA = 0;
const arquivos = {}, sessoes = {}; let nSessao = 0, quedas = 0, atrasoMs = 0;
const pedidosUpload = [];
require.cache[require.resolve(fx + "_olhar-armazenamento.js")] = { id: "o", filename: "o", loaded: true, exports: { bucket: async () => ({
  name: "metodologia-mty.firebasestorage.app",
  file: (c) => ({
    async createResumableUpload(o) { const id = "s" + ++nSessao; sessoes[id] = { caminho: c, contentType: o.metadata.contentType, origem: o.origin, partes: [], recebidos: 0 }; return ["http://127.0.0.1:" + PORTA + "/__upload/" + id]; },
    async getMetadata() { const a = arquivos[c]; if (!a) throw new Error("404"); return [{ contentType: a.contentType, size: String(a.dados.length), md5Hash: "m", generation: "1" }]; },
    async getSignedUrl(o) { return ["http://127.0.0.1:" + PORTA + "/__arq?c=" + encodeURIComponent(c)]; },
    async delete() { delete arquivos[c]; },
  }),
  async getMetadata() { return [{ cors: [] }]; },
  async setCorsConfiguration() {},
}) } };
const fnConsultoria = require(fx + "consultoria.js").handler;

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json" };
const servidor = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  const pedacos = []; req.on("data", (d) => pedacos.push(d)); await new Promise((r) => req.on("end", r));
  const corpo = Buffer.concat(pedacos);
  if (u.pathname === "/__login") { const b = JSON.parse(corpo.toString() || "{}"); const x = Object.values(usuarios).find((v) => v.email === b.email && v.senha === b.senha); res.writeHead(x ? 200 : 401, { "content-type": "application/json" }); return res.end(JSON.stringify(x ? { uid: x.uid, email: x.email, name: x.name } : {})); }
  if (u.pathname.startsWith("/__upload/")) {
    const s = sessoes[u.pathname.split("/").pop()]; if (!s) { res.writeHead(404); return res.end(); }
    const cr = String(req.headers["content-range"] || ""), m = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(cr), q = /^bytes \*\/(\d+)$/.exec(cr);
    pedidosUpload.push(cr);
    if (atrasoMs) await new Promise((r) => setTimeout(r, atrasoMs));
    const resp308 = () => { res.writeHead(308, s.recebidos ? { Range: "bytes=0-" + (s.recebidos - 1), "Access-Control-Expose-Headers": "Range" } : {}); res.end(); };
    if (q) { if (s.recebidos === Number(q[1]) && s.recebidos) { res.writeHead(200); return res.end("{}"); } return resp308(); }
    if (!m) { res.writeHead(400); return res.end(); }
    /* a internet "cai" no meio do segundo pedaço do primeiro vídeo: a conexão fecha sem resposta */
    if (quedas > 0 && Number(m[1]) > 0) { quedas--; return req.socket.destroy(); }
    if (Number(m[1]) !== s.recebidos) return resp308();
    s.partes.push(corpo); s.recebidos += corpo.length;
    if (s.recebidos === Number(m[3])) { arquivos[s.caminho] = { contentType: s.contentType, dados: Buffer.concat(s.partes) }; res.writeHead(200); return res.end("{}"); }
    return resp308();
  }
  if (u.pathname === "/__arq") { const a = arquivos[u.searchParams.get("c")]; if (!a) { res.writeHead(404); return res.end(); } res.writeHead(200, { "content-type": a.contentType }); return res.end(a.dados); }
  if (u.pathname === "/.netlify/functions/consultoria") {
    try { const r = await fnConsultoria({ httpMethod: req.method, headers: req.headers, body: corpo.length ? corpo.toString() : null }); res.writeHead(r.statusCode, r.headers || {}); return res.end(r.body); }
    catch (e) { res.writeHead(500); return res.end(JSON.stringify({ erro: String(e.message) })); }
  }
  if (u.pathname === "/.netlify/functions/push-inscricao") { res.writeHead(200, { "content-type": "application/json" }); return res.end(req.method === "GET" ? '{"chave":"x"}' : '{"inscrito":false}'); }
  /* como o Netlify: /richard (sem a barra) também entrega a página */
  let f = path.join(raizMty, decodeURIComponent(u.pathname === "/richard" ? "/richard/index.html" : u.pathname)); if (u.pathname.endsWith("/")) f = path.join(f, "index.html");
  if (!f.startsWith(raizMty) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end("não encontrado"); }
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); res.end(fs.readFileSync(f));
});
/* Firebase de mentira no navegador: a sessão fica no localStorage; o token é o uid */
const FIREBASE_STUB = `(function(){var cbs=[];function ler(){try{return JSON.parse(localStorage.getItem("__usr")||"null")}catch(e){return null}}
function usr(x){return x?{uid:x.uid,email:x.email,displayName:x.name,getIdToken:function(){return Promise.resolve(x.uid)}}:null}
var a={get currentUser(){return usr(ler())},onAuthStateChanged:function(cb){cbs.push(cb);setTimeout(function(){cb(a.currentUser)},0);return function(){}},
signInWithEmailAndPassword:function(e,s){return fetch("/__login",{method:"POST",body:JSON.stringify({email:e,senha:s})}).then(function(r){if(!r.ok){var er=new Error("x");er.code="auth/wrong-password";throw er}return r.json()}).then(function(x){localStorage.setItem("__usr",JSON.stringify(x));cbs.forEach(function(c){c(usr(x))});return {user:usr(x)}})},
signOut:function(){localStorage.removeItem("__usr");cbs.forEach(function(c){c(null)});return Promise.resolve()},sendPasswordResetEmail:function(){return Promise.resolve()}};
window.firebase={apps:[],initializeApp:function(){this.apps.push({})},auth:function(){return a},firestore:function(){return {}}};})();`;

(async () => {
  await new Promise((r) => servidor.listen(0, "127.0.0.1", r));
  PORTA = servidor.address().port;
  const base = "http://127.0.0.1:" + PORTA + "/richard/";
  const nav = await chromium.launch();
  async function celular() {
    const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: capturas ? 2 : 1 });
    await ctx.addInitScript(() => { window.QL_ENVIO_PEDACO = 64 * 1024; });
    await ctx.route("https://www.gstatic.com/**", (r) => r.fulfill({ contentType: "text/javascript", body: /app-compat/.test(r.request().url()) ? FIREBASE_STUB : "" }));
    await ctx.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ contentType: "text/css", body: "" }));
    await ctx.route("https://www.youtube-nocookie.com/**", (r) => r.fulfill({ contentType: "text/html", body: "<title>YouTube</title>" }));
    const p = await ctx.newPage(), erros = [];
    p.on("pageerror", (e) => erros.push(e.message));
    p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_|net::/.test(m.text())) erros.push(m.text()); });
    return { ctx, p, erros };
  }
  const foto = async (pg, nome) => { if (capturas) await pg.screenshot({ path: path.join(capturas, nome + ".png"), fullPage: true }); };
  const semRolagem = async (pg, onde) => assert.ok(await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "rolagem lateral em " + onde);
  const texto = (pg) => pg.evaluate(() => document.body.innerText);

  /* ── cliente: criar conta e cadastro de atleta menor ── */
  const cli = await celular(), p = cli.p;
  /* endereço sem a barra no fim (o que a pessoa digita): a página carrega com estilo e vai para /richard/ */
  await p.goto(base.replace(/\/$/, ""), { waitUntil: "load" }); await p.waitForSelector("#fEntrar");
  assert.ok(new URL(p.url()).pathname === "/richard/", "foi para /richard/: " + p.url());
  assert.strictEqual(await p.evaluate(() => getComputedStyle(document.querySelector(".topo")).position), "sticky", "o estilo da página carregou");
  assert.ok((await texto(p)).includes("Seu tênis analisado pelo Richard Tsukada"));
  await semRolagem(p, "entrada"); await foto(p, "consultoria-1-entrada");
  await p.click("#mCriar");
  await p.fill('[name="nome"]', "Lia Souza"); await p.fill('[name="email"]', "lia@exemplo.com"); await p.fill('[name="senha"]', "12345678");
  await p.click("#btEnt"); await p.waitForSelector("#fCad");
  const nasc = (new Date().getFullYear() - 15) + "-03-10";
  await p.fill('[name="nascimento"]', nasc); await p.dispatchEvent('[name="nascimento"]', "change");
  await p.waitForSelector("#blocoMenor:not([hidden])");
  await p.fill('[name="objetivo"]', "Ganhar consistência no segundo saque.");
  await p.click("#btCad");
  await p.waitForFunction(() => document.querySelector("#mCad") && !document.querySelector("#mCad").hidden);
  assert.ok(/nome do responsável/.test(await p.innerText("#mCad")), "menor sem responsável não passa");
  await p.fill('[name="rnome"]', "Ana Souza"); await p.fill('[name="remail"]', "ana@exemplo.com"); await p.check('[name="aceite"]');
  await semRolagem(p, "cadastro"); await foto(p, "consultoria-2-cadastro");
  await p.click("#btCad"); await p.waitForSelector("#btAtualizar");
  assert.ok((await texto(p)).includes("Quase lá, Lia"));
  const uid = Object.keys(usuarios).filter((k) => usuarios[k].email === "lia@exemplo.com")[0];
  const c0 = store["consultoriaClientes/" + uid];
  assert.ok(c0.menor && c0.responsavel.nome === "Ana Souza" && c0.responsavel.aceiteEm && c0.estado === "pendente", JSON.stringify(c0));
  await foto(p, "consultoria-3-pendente");

  /* ── Richard: libera ── */
  const ric = await celular(), r = ric.p;
  await r.goto(base, { waitUntil: "load" }); await r.waitForSelector("#fEntrar");
  await r.fill('[name="email"]', "tsukada.richard@gmail.com"); await r.fill('[name="senha"]', "segredo123"); await r.click("#btEnt");
  await r.waitForFunction(() => document.body.innerText.includes("Fila em dia"));
  assert.strictEqual(await r.innerText('#nav [data-aba="clientes"] .n'), "1", "pedido novo marcado em Clientes");
  await r.click('#nav [data-aba="clientes"]'); await r.waitForSelector("[data-pendente]");
  const tc = await texto(r);
  assert.ok(tc.includes("Lia Souza") && tc.includes("15 anos") && tc.includes("responsável: Ana Souza"), tc.slice(0, 600));
  await semRolagem(r, "clientes"); await foto(r, "consultoria-4-clientes");
  await r.click("[data-liberar]"); await r.waitForFunction(() => !document.querySelector("[data-pendente]") && document.body.innerText.includes("Ativo"));
  assert.ok(avisos.some((a) => a.filtro.uid === uid && /liberada/.test(a.aviso.titulo)));

  /* ── cliente: envia ── */
  await p.click("#btAtualizar"); await p.waitForSelector('#nav [data-aba="enviar"]');
  assert.ok((await texto(p)).includes("Mande o seu primeiro vídeo"));
  await p.click('#nav [data-aba="enviar"]'); await p.waitForSelector("#fEnv");
  /* começa pelo link do YouTube (o padrão, para testar sem o armazenamento) */
  assert.strictEqual(await p.getAttribute('[data-modo="link"]', "aria-pressed"), "true");
  await p.click('[data-tema="jogo"]'); await p.fill('[name="duvida"]', "Decido mal quando subo à rede. Olhe de 0:40 a 2:10.");
  await p.fill('[name="url"]', "https://vimeo.com/123"); await p.click("#btEnviar");
  await p.waitForFunction(() => /link de um vídeo do YouTube/.test(document.querySelector("#mEnv").textContent));
  await p.fill('[name="url"]', "https://youtu.be/dQw4w9WgXcQ");
  await semRolagem(p, "enviar link"); await foto(p, "consultoria-5a-link");
  await p.click("#btEnviar");
  await p.waitForFunction(() => location.hash.startsWith("#/envio/")); await p.waitForSelector('[data-video] iframe[src*="youtube-nocookie.com/embed/dQw4w9WgXcQ"]');
  assert.ok(Object.values(store).some((e) => e && e.youtube && e.youtube.id === "dQw4w9WgXcQ" && e.estado === "recebido"), "envio por link na fila");
  await p.click('#nav [data-aba="enviar"]'); await p.waitForSelector("#fEnv");
  await p.click('[data-modo="arquivo"]'); await p.waitForSelector("#arqVideo", { state: "attached" });
  /* vídeo de 3min20 é recusado */
  await p.setInputFiles("#arqVideo", path.join(VIDEOS, "longo.webm"));
  await p.waitForFunction(() => { const m = document.querySelector("#mEnv"); return m && !m.hidden && /3:20/.test(m.textContent); });
  assert.ok(!(await p.$("[data-arquivo]")), "vídeo longo não fica escolhido");
  await p.click('[data-tema="saque"]'); await p.fill('[name="duvida"]', "Perco força no segundo saque quando estou cansado.");
  await p.setInputFiles("#arqVideo", path.join(VIDEOS, "curto.webm"));
  await p.waitForSelector("[data-arquivo]");
  assert.ok(/curto\.webm · 0,2 MB · 0:20/.test(await p.innerText("[data-arquivo]")), await p.innerText("[data-arquivo]"));
  await semRolagem(p, "enviar"); await foto(p, "consultoria-5-enviar");
  quedas = 1; atrasoMs = 0;
  await p.click("#btEnviar");
  await p.waitForFunction(() => location.hash.startsWith("#/envio/"), null, { timeout: 30000 });
  await p.waitForSelector("[data-duvida]");
  const enviados = Object.keys(store).filter((k) => k.startsWith("consultoriaEnvios/")).map((k) => store[k]).filter((e) => e.video);
  assert.strictEqual(enviados.length, 1); assert.strictEqual(enviados[0].estado, "recebido");
  const original = fs.readFileSync(path.join(VIDEOS, "curto.webm"));
  assert.ok(arquivos[enviados[0].video.caminho].dados.equals(original), "o vídeo chegou inteiro e igual, mesmo com a queda no meio");
  assert.ok(pedidosUpload.some((x) => /^bytes \*\//.test(x)), "depois da queda o app perguntou quanto já tinha chegado");
  assert.ok(avisos.some((a) => a.filtro.papel === "richard" && /Vídeo novo: Saque/.test(a.aviso.titulo)));
  assert.ok((await texto(p)).includes("O Richard recebeu e vai responder por aqui"));

  /* pausar no meio e retomar escolhendo o mesmo vídeo */
  await p.goto(base + "#/enviar"); await p.waitForSelector("#fEnv");
  await p.click('[data-modo="arquivo"]'); await p.waitForSelector("#arqVideo", { state: "attached" });
  await p.click('[data-tema="forehand"]'); await p.fill('[name="duvida"]', "Forehand na corrida sai curto.");
  await p.setInputFiles("#arqVideo", path.join(VIDEOS, "curto.webm")); await p.waitForSelector("[data-arquivo]");
  atrasoMs = 250;
  await p.click("#btEnviar"); await p.waitForSelector("[data-progresso]");
  await p.waitForFunction(() => /^[1-9]\d?% /.test(document.querySelector("#pgTexto").textContent));
  await foto(p, "consultoria-6-progresso");
  await p.click("#btPausar");
  await p.waitForSelector("[data-interrompido]");
  assert.ok(/Continuar o envio de Forehand/.test(await texto(p)));
  atrasoMs = 0;
  await p.setInputFiles("#arqRetomar", path.join(VIDEOS, "longo.webm"));
  await p.waitForFunction(() => /não é o mesmo vídeo/.test(document.querySelector("#mRet").textContent));
  await p.setInputFiles("#arqRetomar", path.join(VIDEOS, "curto.webm"));
  await p.waitForFunction(() => location.hash.startsWith("#/envio/"), null, { timeout: 30000 });
  assert.strictEqual(Object.keys(store).filter((k) => k.startsWith("consultoriaEnvios/") && store[k].estado === "recebido").length, 3, "o envio pausado terminou (link + 2 vídeos)");

  /* ── Richard: fila e devolutiva com áudio ── */
  await r.click('#nav [data-aba="fila"]'); await r.waitForSelector("[data-fila]"); // abrir a aba busca a fila de novo
  assert.ok(/3 envios aguardando/.test(await texto(r)) && /Lia Souza · Saque/.test(await texto(r)) && /No prazo/.test(await texto(r)));
  await semRolagem(r, "fila"); await foto(r, "consultoria-7-fila");
  assert.ok(/YouTube/.test(await r.innerText("[data-fila] >> nth=0")), "o link do YouTube é o mais antigo da fila");
  await r.click('[data-fila]:has-text("Saque")'); await r.waitForSelector("#fResp");
  assert.ok((await texto(r)).includes("Perco força no segundo saque"));
  await r.click("#btVideo"); await r.waitForSelector("[data-video] video");
  await r.waitForFunction(() => document.querySelector("[data-video] video").readyState >= 1, null, { timeout: 10000 });
  await r.setInputFiles("#arqResp", path.join(VIDEOS, "resp.webm")); await r.waitForSelector("[data-gravacao]");
  await r.fill('[name="viu"]', "O lançamento cai para trás e você perde a perna de apoio.");
  await r.fill('[name="texto"]', "Bom começo. Foque no lançamento esta semana.");
  await r.fill("#treinar input >> nth=0", "Lançamento com alvo, 3 séries de 10"); await r.fill("#treinar input >> nth=1", "Saque com pés juntos, 20 bolas");
  await semRolagem(r, "responder"); await foto(r, "consultoria-8-responder");
  await r.click("#btResponder");
  await r.waitForFunction(() => location.hash === "#/fila" && document.body.innerText.includes("2 envios aguardando"), null, { timeout: 20000 });
  const resp = Object.keys(store).filter((k) => k.startsWith("consultoriaEnvios/")).map((k) => store[k]).filter((e) => e.estado === "respondido")[0];
  assert.ok(resp && resp.devolutiva.midia && arquivos[resp.devolutiva.midia.caminho].dados.equals(fs.readFileSync(path.join(VIDEOS, "resp.webm"))), "áudio da devolutiva guardado");
  assert.deepStrictEqual(resp.devolutiva.treinar, ["Lançamento com alvo, 3 séries de 10", "Saque com pés juntos, 20 bolas"]);
  assert.ok(avisos.some((a) => a.filtro.uid === uid && /Devolutiva do Richard/.test(a.aviso.titulo)));

  /* ── cliente: devolutiva nova, ouvir, entendi, dúvida ── */
  await p.goto(base + "#/"); await p.waitForSelector("[data-nova]");
  assert.strictEqual(await p.innerText('#nav [data-aba="devolutivas"] .n'), "1");
  await semRolagem(p, "início com devolutiva"); await foto(p, "consultoria-9-inicio");
  await p.click("[data-nova]"); await p.waitForSelector("[data-devolutiva]");
  const td = await texto(p);
  assert.ok(td.includes("O que eu vi") && td.includes("perna de apoio") && td.includes("Lançamento com alvo") && /guardado até \d{2}\/\d{2}\/\d{4}/.test(td), td.slice(0, 900));
  await p.click("#btResp"); await p.waitForSelector("[data-midia-resp] audio, [data-midia-resp] video", { state: "attached" }); // arquivo .webm escolhido no celular chega como vídeo
  await semRolagem(p, "devolutiva"); await foto(p, "consultoria-10-devolutiva");
  await p.click("#btEntendi"); await p.waitForFunction(() => document.body.innerText.includes("Você marcou como entendido"));
  await p.click("#btDuvida"); await p.fill('#fDuv [name="texto"]', "O lançamento é com a mão esticada?");
  await p.click("#btMandarDuv");
  await p.waitForFunction(() => document.body.innerText.includes("O lançamento é com a mão esticada?") && document.body.innerText.includes("Com o Richard"));
  assert.ok(Object.values(store).some((e) => e && e.tipo === "pergunta" && e.estado === "recebido"));

  assert.deepStrictEqual(cli.erros, [], "sem erro de JavaScript (cliente)");
  assert.deepStrictEqual(ric.erros, [], "sem erro de JavaScript (Richard)");
  await nav.close(); servidor.close();
  console.log("smoke-consultoria: ok");
})().catch((e) => { console.error(e); process.exit(1); });
