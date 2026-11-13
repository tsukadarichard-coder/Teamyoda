/* QuadraLab Scout (scout-app/) no celular (390×844), com conta: login de mentira no lugar do Firebase e as functions de verdade
   (scout-app, scout-app-conta, scout-app-uso, scout-ao-vivo) sobre um Firestore de mentira.
   · /scout sem link abre o app; sem conta abre a tela de entrar; criar conta (nome, papel, e-mail, senha);
   · o jogo marcado antes de existir conta passa para a conta; marcar em 2 toques, ace, desfazer, detalhes, mental antes/no game/depois;
   · link ao vivo: abre, a página da família mostra o jogo (só primeiro nome), atualiza a cada ponto, fim mostra a partida encerrada;
   · fechar e abrir no meio do jogo; fim com placar, gráficos, texto do WhatsApp (sem adversário nem sobrenome); comparação; atleta;
   · segundo celular com a mesma conta recebe os jogos; apagar num celular tira do outro; sair da conta;
   · cópia dos jogos em Minha conta; contagem de uso só com aparelho, evento e pontos; sem erro de JavaScript e sem rolagem lateral.
   Rode: node tests/smoke-scout-app.js [pasta-das-capturas] */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
const raiz = path.join(__dirname, ".."), fx = path.join(raiz, "netlify/functions/");
const capturas = process.argv[2] || "";
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webp": "image/webp" };

/* ── Firestore e login de mentira (no lugar do Admin SDK) ── */
const store = {}, J = (v) => JSON.parse(JSON.stringify(v)), DEL = { __apagar: true };
function docRef(p) {
  return { id: p.split("/").pop(), path: p, async get() { const v = store[p]; return { exists: v !== undefined, id: p.split("/").pop(), data: () => J(v) }; },
    async set(v) { store[p] = J(v); }, async delete() { delete store[p]; },
    async update(v) { if (store[p] === undefined) throw new Error("sem documento " + p); for (const k of Object.keys(v)) { if (v[k] === DEL) delete store[p][k]; else store[p][k] = J(v[k]); } },
    collection: (c) => colRef(p + "/" + c) };
}
function colRef(p, f = []) {
  const ids = () => Object.keys(store).filter((k) => k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/")).filter((k) => f.every(([c, v]) => store[k][c] === v));
  return { doc: (id) => docRef(p + "/" + id), where: (c, o, v) => colRef(p, f.concat([[c, v]])),
    async get() { const d = ids().map((k) => ({ id: k.split("/").pop(), data: () => J(store[k]) })); return { docs: d, size: d.length, forEach: (fn) => d.forEach(fn) }; } };
}
const firestore = () => ({ collection: (n) => colRef(n), runTransaction: async (fn) => fn({ get: (r) => r.get(), set: (r, v, o) => (o && o.merge ? (store[r.path] = { ...(store[r.path] || {}), ...J(v) }) : r.set(v)), update: (r, v) => r.update(v) }) });
firestore.FieldValue = { delete: () => DEL };
const usuarios = {}, tokens = {};
const admin = { firestore, auth: () => ({
  verifyIdToken: async (t) => { if (!tokens[t]) throw new Error("token"); return tokens[t]; },
  createUser: async (u) => { if (usuarios[u.email]) { const e = new Error("existe"); e.code = "auth/email-already-exists"; throw e; } const uid = "u" + (Object.keys(usuarios).length + 1); usuarios[u.email] = { uid, senha: u.password, nome: u.displayName }; return { uid }; },
  setCustomUserClaims: async () => {} }) };
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "fa", filename: "fa", loaded: true, exports: { admin, app: () => {} } };
require.cache[require.resolve(fx + "_scout-copias.js")] = { id: "sc", filename: "sc", loaded: true, exports: { vinculosDoTreinador: async () => new Map(), gravarCopia: async () => {}, idAoVivo: (t) => t, academiaComCompeticao: async () => false, ERRO_PLANO_COMPETICAO: "" } };
const FUNCOES = { "scout-app": require(fx + "scout-app.js").handler, "scout-app-conta": require(fx + "scout-app-conta.js").handler, "scout-ao-vivo": require(fx + "scout-ao-vivo.js").handler, "scout-app-uso": require(fx + "scout-app-uso.js").handler, "scout-app-movimento": require(fx + "scout-app-movimento.js").handler };
const usos = [];

const FIREBASE_FALSO = `(function () {
  var CHAVE = "fake-auth", ouvintes = [];
  function ler() { try { return JSON.parse(localStorage.getItem(CHAVE) || "null"); } catch (e) { return null; } }
  function usuario(u) { return { uid: u.uid, email: u.email, displayName: u.nome, getIdToken: async function () { return u.token; } }; }
  var auth = { languageCode: "", currentUser: null,
    onAuthStateChanged: function (cb) { ouvintes.push(cb); var u = ler(); auth.currentUser = u ? usuario(u) : null; setTimeout(function () { cb(auth.currentUser); }, 10); },
    signInWithEmailAndPassword: async function (email, senha) {
      var r = await fetch("/__fake/login", { method: "POST", body: JSON.stringify({ email: email, senha: senha }) });
      if (!r.ok) { var e = new Error("credencial"); e.code = "auth/invalid-credential"; throw e; }
      var u = await r.json(); localStorage.setItem(CHAVE, JSON.stringify(u)); auth.currentUser = usuario(u); ouvintes.forEach(function (cb) { cb(auth.currentUser); });
    },
    sendPasswordResetEmail: async function () {},
    signOut: async function () { localStorage.removeItem(CHAVE); auth.currentUser = null; ouvintes.forEach(function (cb) { cb(null); }); } };
  window.firebase = { apps: [], initializeApp: function () { this.apps.push({}); }, auth: function () { return auth; } };
})();`;

const srv = http.createServer((q, r) => {
  const [u, qs] = q.url.split("?");
  let corpo = ""; q.on("data", (c) => (corpo += c));
  q.on("end", async () => {
    if (u === "/__fake/login") {
      const b = JSON.parse(corpo || "{}"), x = usuarios[String(b.email || "").toLowerCase()];
      if (!x || x.senha !== b.senha) { r.writeHead(400); return r.end("{}"); }
      const token = "tk-" + x.uid; tokens[token] = { uid: x.uid, email: b.email.toLowerCase(), name: x.nome };
      r.writeHead(200, { "content-type": "application/json" }); return r.end(JSON.stringify({ uid: x.uid, email: b.email.toLowerCase(), nome: x.nome, token }));
    }
    const fn = u.startsWith("/.netlify/functions/") && FUNCOES[u.slice(20)];
    if (fn) {
      if (u.endsWith("scout-app-uso")) usos.push(corpo);
      const res = await fn({ httpMethod: q.method, headers: q.headers, body: corpo, queryStringParameters: Object.fromEntries(new URLSearchParams(qs || "")) });
      r.writeHead(res.statusCode, res.headers); return r.end(res.body);
    }
    let f = path.join(raiz, decodeURIComponent(u));
    if (u.endsWith("/")) f = path.join(f, "index.html");
    if (f.startsWith(raiz) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { "content-type": TIPOS[path.extname(f)] || "application/octet-stream" }); return r.end(fs.readFileSync(f)); }
    r.writeHead(404); r.end();
  });
}).listen(0);
const origem = "http://localhost:" + srv.address().port, base = origem + "/scout-app/";

(async () => {
  const { chromium } = require("/opt/node22/lib/node_modules/playwright");
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  async function celular() {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: Number(process.env.DPR || 1), hasTouch: true, serviceWorkers: "block", acceptDownloads: true });
    await ctx.route(/gstatic\.com\/firebasejs\/.*firebase-app-compat\.js/, (rt) => rt.fulfill({ contentType: "text/javascript", body: FIREBASE_FALSO }));
    await ctx.route(/gstatic\.com\/firebasejs\/.*firebase-auth-compat\.js/, (rt) => rt.fulfill({ contentType: "text/javascript", body: "/* auth no arquivo acima */" }));
    const p = await ctx.newPage(), erros = [];
    p.on("pageerror", (e) => erros.push(e.message));
    p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text()) && !p.url().includes("/scout/?l=")) erros.push(m.text()); });
    return { ctx, p, erros };
  }
  const { p, erros } = await celular();
  const texto = () => p.evaluate(() => document.body.innerText);
  const tem = (t, trecho) => t.toLowerCase().includes(trecho.toLowerCase()); // rótulos em MAIÚSCULO via CSS
  const semRolagem = async (pg, onde) => { const w = await pg.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]); assert.ok(w[0] <= w[1], onde + ": rolagem lateral " + w); };
  /* DPR=2 (capturas para a página de vendas): cabeçalho solto e um nome comum no lugar do adversário de teste */
  const foto = async (pg, nome) => {
    if (!capturas) return;
    fs.mkdirSync(capturas, { recursive: true });
    if (process.env.DPR) await pg.evaluate(() => {
      document.querySelectorAll(".topo").forEach((e) => { e.style.position = "static"; });
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) n.nodeValue = n.nodeValue.replace(/Fulano Secreto/g, "Pedro");
    });
    await pg.screenshot({ path: path.join(capturas, nome + ".png"), fullPage: !nome.startsWith("scout-guia") });
    if (process.env.DPR) await pg.evaluate(() => document.querySelectorAll(".topo").forEach((e) => { e.style.position = ""; }));
  };
  const pontos = () => p.textContent("[data-pontos]");
  const ponto = async (fim, bola) => { await p.click(`[data-fim="${fim}"]`); await p.click(`[data-bola="${bola || "5-9"}"]`); };
  const nuvemQuieta = () => p.waitForTimeout(3200); // a sincronização roda 2,5 s depois da última mudança

  /* /scout sem link leva ao app e, sem conta entrada neste aparelho, a página principal é a de apresentação */
  await p.goto(origem + "/scout/", { waitUntil: "networkidle" });
  assert.strictEqual(p.url(), base + "conheca.html", "/scout sem conta entrada abre a apresentação: " + p.url());
  await p.goto(base, { waitUntil: "networkidle" });
  assert.strictEqual(p.url(), base + "conheca.html", "o endereço do app, sem conta entrada, abre a apresentação");
  const tApr = await p.evaluate(() => document.body.innerText);
  assert.ok(tApr.includes("Comece grátis. O Plus anual abre em breve.") && /Scout Plus/.test(tApr) && /Plano anual · em breve/i.test(tApr) && /Grátis com 1 atleta/.test(tApr) && !/3 atletas/.test(tApr), "é a página de apresentação, com o grátis e o Plus");
  assert.ok(!/R\$ ?\d+,\d\d|29,90|eduzz/i.test(tApr) && !(await p.$('a[href*="eduzz"]')), "apresentação sem preço do Plus nem link de compra");
  /* os botões da apresentação levam para o app, sem voltar para ela */
  await p.click('a[href="./#/entrar"]'); await p.waitForSelector("#acEmail");
  assert.ok(p.url().startsWith(base + "#/entrar") && (await p.evaluate(() => document.body.innerText)).includes("Entrar no QuadraLab Scout"), "Entrar abre a tela de entrar do app: " + p.url());
  await p.goto(base + "conheca.html", { waitUntil: "networkidle" });
  await p.click('a[data-cta="topo"]'); await p.waitForSelector("#acEmail");
  assert.ok(p.url().startsWith(base + "#/criar"), "Criar conta grátis abre o cadastro do app: " + p.url());
  await p.goto(origem + "/scout/?l=" + "a".repeat(32), { waitUntil: "domcontentloaded" });
  assert.ok(p.url().includes("/scout/?l="), "link ao vivo fica na página da família: " + p.url());

  /* um jogo marcado na primeira versão do app (sem conta) */
  await p.goto(base + "#/entrar", { waitUntil: "networkidle" });
  await p.evaluate(() => {
    const D = window.QLScoutApp, M = window.QLScoutMotor, s = D.normalizar(null), a = D.addAtleta(s, "Lucas Andrade").atleta, j = D.novoJogo(s, { atletaId: a.id, torneio: "Treino antigo", cfg: { formato: "1set" } }).jogo;
    for (let i = 0; i < 12; i++) D.marcarPonto(M, j, { fim: "winner_nos", nos: true, bola: "1-4" });
    j.fim = true; delete s.atual; localStorage.setItem("qls:v1", JSON.stringify(s));
  });
  await p.reload({ waitUntil: "networkidle" });
  let t = await texto();
  assert.ok(t.includes("Entrar no QuadraLab Scout") && t.includes("Criar conta grátis"), "sem conta: tela de entrar: " + t.slice(0, 300));
  assert.ok(await p.evaluate(() => { const i = document.querySelector(".marca img"); return i && i.complete && i.naturalWidth > 0; }), "logo carregado");
  await semRolagem(p, "entrar"); await foto(p, "scout-0-entrar");

  /* criar conta */
  await p.click('a[href="#/criar"]');
  await p.fill("#acNome", "Ana Andrade"); await p.fill("#acEmail", "ana@exemplo.com"); await p.fill("#acSenha", "123");
  assert.ok(!(await p.$("[data-papel]")) && !(await texto()).includes("Quem é você"), "acompanhamento livre: sem escolher papel");
  await p.click("#btAcesso");
  assert.ok((await texto()).includes("pelo menos 8"), "senha curta");
  await p.fill("#acSenha", "12345678"); await p.click("#btAcesso");
  await p.waitForSelector("[data-novo]");
  await p.waitForFunction(() => document.body.innerText.includes("foi para a sua conta"));
  t = await texto();
  assert.ok(t.includes("Olá, Ana") && t.includes("Treino antigo"), "conta criada e o jogo antigo veio junto: " + t.slice(0, 400));
  assert.strictEqual(await p.textContent("#btConta"), "A", "botão da conta com a inicial");
  await nuvemQuieta();
  const uid = usuarios["ana@exemplo.com"].uid;
  assert.strictEqual(store["scoutAppContas/" + uid].nome, "Ana Andrade");
  assert.strictEqual(Object.keys(store).filter((k) => k.startsWith("scoutAppContas/" + uid + "/jogos/")).length, 1, "jogo antigo na nuvem");
  assert.ok(await p.evaluate(() => !localStorage.getItem("qls:v1") && !!localStorage.getItem("qls:v1:antigo")), "cópia antiga guardada à parte");
  await semRolagem(p, "início"); await foto(p, "scout-1-inicio");

  /* novo jogo com mental antes */
  await p.click("[data-novo]");
  assert.strictEqual(await p.getAttribute('[data-atleta]:not([data-atleta="+"])', "aria-pressed"), "true", "único atleta já escolhido");
  await p.fill("#nvTorneio", "Copa Sul"); await p.fill("#nvAdv", "Fulano Secreto");
  await p.click('[data-formato="4games"]');
  await p.click("#detMentalAntes summary"); await p.click('[data-ment="antes"][data-mk="conf"][data-mv="4"]');
  assert.strictEqual(await p.getAttribute('[data-ment="antes"][data-mk="conf"][data-mv="4"]', "aria-pressed"), "true");
  assert.strictEqual(await p.inputValue("#nvAdv"), "Fulano Secreto", "campos mantidos depois de mexer no mental");
  await semRolagem(p, "novo jogo"); await foto(p, "scout-2-novo");
  await p.click("#btComecar"); await p.waitForSelector("[data-pontos]");
  assert.strictEqual(await pontos(), "0-0");
  t = await texto();
  assert.ok(tem(t, "Saque de Lucas") && t.includes("Lucas × Fulano Secreto · Copa Sul"), "placar: " + t.slice(0, 300));

  /* 2 toques, trocar, desfazer, ace, detalhes */
  await ponto("winner_nos"); assert.strictEqual(await pontos(), "15-0");
  await p.click('[data-fim="erro_nos"]'); await p.click("#btTrocar"); await ponto("erro_dele", "1-4"); assert.strictEqual(await pontos(), "30-0");
  await p.click("#btDesfazer"); assert.strictEqual(await pontos(), "15-0", "desfazer");
  /* modo completo (padrão): direção do saque antes do ponto */
  assert.strictEqual(await p.textContent("#btModo"), "Modo completo ✓", "modo completo é o padrão");
  await p.click('[data-dsq="aberto"]'); await p.click('[data-saq="ace"]'); assert.strictEqual(await pontos(), "30-0", "ace em um toque");
  assert.ok((await p.textContent("[data-registrado]")).includes("Ace"), "faixa do ponto registrado");
  /* modo rápido: detalhes do último ponto depois; e volta ao completo */
  await p.click("#btModo"); assert.strictEqual(await p.textContent("#btModo"), "Modo rápido ✓");
  await p.click("#detPonto summary"); await p.click('[data-det="golpe"] >> nth=0');
  await p.click("#btModo"); assert.ok(!(await p.$("#detPonto")), "completo não mostra os detalhes depois");
  /* mental no game */
  await p.click("#detMental summary"); await p.click('[data-mjogo="3"]');
  const jl = await p.evaluate((u) => { const s = JSON.parse(localStorage.getItem("qls:v1:" + u)); return s.jogos.filter((j) => j.torneio === "Copa Sul")[0]; }, uid);
  assert.ok(jl.pontos[1].golpe && jl.pontos[1].saque === "ace" && jl.pontos[1].dirSaque === "aberto", "direção do saque e detalhe no último ponto: " + JSON.stringify(jl.pontos[1]));
  assert.strictEqual(jl.mental.antes.conf, 4); assert.strictEqual(jl.mental.jogo["1"], 3, "mental no game 1");

  /* grátis: o link ao vivo fica com cadeado (Scout Plus), sem preço nem link de compra */
  assert.ok(await p.$('[data-plus-bloqueio="aovivo"]') && !(await p.$("#btAbrirLink")), "grátis: link ao vivo com cadeado");
  assert.ok(!/R\$|Assinar|Eduzz/i.test(await p.innerText('[data-plus-bloqueio="aovivo"]')), "cadeado sem preço");
  await foto(p, "scout-3b-cadeado");
  /* a conta passa a ter o Plus: o app recebe na sincronização e o link ao vivo abre */
  store["scoutAppContas/" + uid].plano = "plus"; store["scoutAppContas/" + uid].plusAte = "2099-12-31";
  await p.goto(base + "#/conta"); await p.waitForSelector("#btSync"); await p.click("#btSync");
  await p.waitForFunction(() => document.body.innerText.includes("Tudo sincronizado"));
  await p.waitForFunction(() => !document.body.innerText.includes("Tudo sincronizado"), null, { timeout: 15000 });
  await p.goto(base + "#/jogo/" + jl.id); await p.waitForSelector("#btAbrirLink");

  /* link ao vivo */
  await p.click("#btAbrirLink");
  await p.waitForSelector("#btEncerrarLink");
  const wa = decodeURIComponent((await p.getAttribute("#lkAoVivoWhats", "href")).split("text=")[1]);
  const tok = /\/scout\/\?l=([a-f0-9]{32})/.exec(wa)[1];
  assert.ok(wa.startsWith("Acompanhe o jogo de Lucas ao vivo"), wa);
  assert.ok(store["scoutsAoVivo/" + tok] && store["scoutsAoVivo/" + tok].orgId === "app:" + uid, "link na coleção da família");
  assert.ok(new RegExp("/scout/\\?l=" + tok + "&s=1").test(wa), "o link do app já leva o aviso das cores do Scout: " + wa);
  const fam = (await celular()).p;
  /* a página da família com as cores do app: roxo no topo, marca QuadraLab Scout, nada de "treinador" */
  const coresFamilia = () => fam.evaluate(() => ({ tema: document.documentElement.classList.contains("tema-scout"), topo: getComputedStyle(document.querySelector("header")).backgroundColor,
    fundo: getComputedStyle(document.body).backgroundColor, marca: document.getElementById("marca").textContent, rodape: (document.querySelector("footer") || {}).textContent || "" }));
  await fam.goto(origem + "/scout/?l=" + tok + "&s=1", { waitUntil: "domcontentloaded" });
  assert.strictEqual((await coresFamilia()).topo, "rgb(38, 10, 62)", "com o &s=1 o topo já nasce roxo, antes de os dados chegarem");
  await fam.waitForFunction(() => document.getElementById("titulo").textContent.includes("Lucas"));
  let cf = await coresFamilia();
  assert.deepStrictEqual([cf.tema, cf.topo, cf.fundo, cf.marca], [true, "rgb(38, 10, 62)", "rgb(245, 243, 248)", "QuadraLab Scout · ao vivo"], "cores do Scout no link ao vivo");
  assert.ok(/Compartilhado pelo QuadraLab Scout/.test(cf.rodape) && !/treinador/i.test(cf.rodape), cf.rodape);
  assert.strictEqual(await fam.evaluate(() => { const x = document.querySelector(".qg-pl"); return x ? getComputedStyle(x).backgroundColor : "sem placar"; }), "rgb(38, 10, 62)", "o placar ao vivo também fica roxo");
  /* link antigo, sem o &s=1: o servidor avisa que nasceu no app e as cores entram do mesmo jeito */
  await fam.goto(origem + "/scout/?l=" + tok, { waitUntil: "networkidle" });
  await fam.waitForFunction(() => document.getElementById("titulo").textContent.includes("Lucas"));
  cf = await coresFamilia();
  assert.deepStrictEqual([cf.tema, cf.topo, cf.marca], [true, "rgb(38, 10, 62)", "QuadraLab Scout · ao vivo"], "link antigo também fica com as cores do Scout");
  const tf = await fam.evaluate(() => document.body.innerText);
  assert.ok(tf.includes("Partida de Lucas") && !tf.includes("Fulano") && !tf.includes("Andrade"), "família vê só o primeiro nome: " + tf.slice(0, 300));
  await foto(fam, "scout-familia");
  const versao = store["scoutsAoVivo/" + tok].versao;
  /* modo completo: detalhes antes da bola */
  await p.click('[data-fim="winner_nos"]'); await p.waitForSelector('[data-tour="detalhes"]');
  await p.click('[data-rd="situacao"][data-v="ataque"]'); await p.click('[data-rd="zona"] >> nth=0'); await p.click('[data-rdb="rede"]');
  assert.strictEqual(await p.getAttribute('[data-rd="situacao"][data-v="ataque"]', "aria-pressed"), "true");
  await p.click('[data-bola="1-4"]');
  const p3 = await p.evaluate((u) => { const s = JSON.parse(localStorage.getItem("qls:v1:" + u)); const j = s.jogos.filter((x) => x.torneio === "Copa Sul")[0]; return j.pontos[2]; }, uid);
  assert.ok(p3.situacao === "ataque" && p3.zona && p3.rede === true && p3.bola === "1-4", "detalhes gravados com o ponto: " + JSON.stringify(p3));
  await ponto("winner_nos"); // 1-0 em games
  await p.waitForTimeout(1800);
  assert.ok(store["scoutsAoVivo/" + tok].versao > versao, "link atualiza a cada ponto");
  assert.strictEqual(JSON.parse(store["scoutsAoVivo/" + tok].publico).n, 4);
  assert.strictEqual(await p.textContent("[data-sets]"), "1-0");
  await ponto("winner_dele");
  await semRolagem(p, "marcação"); await foto(p, "scout-3-marcacao");

  /* análise ao vivo */
  await p.click("#detAnalise summary");
  await p.waitForFunction(() => document.body.innerText.toLowerCase().includes("o que a partida pede"), null, { timeout: 4000 });

  /* fechar e abrir no meio do jogo */
  await p.goto(base + "#/", { waitUntil: "networkidle" }); await p.reload({ waitUntil: "load" }); await p.waitForTimeout(1500);
  /* com a conta entrada neste aparelho, o endereço do app abre direto os jogos (não a apresentação) */
  assert.strictEqual(await p.evaluate(() => localStorage.getItem("qls:sessao")), "1");
  await p.goto(base + "conheca.html", { waitUntil: "load" }); await p.goto(base, { waitUntil: "load" });
  await p.waitForSelector("[data-novo]");
  assert.ok(p.url() === base || p.url() === base + "#/", "com conta entrada o app abre direto: " + p.url());
  await p.waitForSelector("[data-andamento]");
  t = await texto();
  assert.ok(tem(t, "Jogo em andamento") && t.includes("Lucas · 0-15"), "jogo em andamento: " + t.slice(0, 300));
  await p.click("[data-andamento]");
  assert.strictEqual(await pontos(), "0-15", "continua do mesmo ponto");
  assert.ok(await p.$("#btEncerrarLink"), "link ao vivo continua aberto");

  /* termina 4-0 */
  for (let i = 0; i < 40 && !(await p.$("[data-fim-jogo]")); i++) await ponto("erro_dele");
  await p.waitForSelector("[data-fim-jogo]");
  t = await texto();
  assert.ok(t.includes("Lucas venceu") && t.includes("4-0") && t.includes("O link ao vivo mostra o resultado final"), "fim: " + t.slice(0, 400));
  assert.ok(await p.$(".graficos section"), "gráficos");
  await p.waitForTimeout(800);
  assert.strictEqual(JSON.parse(store["scoutsAoVivo/" + tok].publico).aoVivo, false, "link mostra a partida encerrada");
  const zap = decodeURIComponent((await p.getAttribute("#lkWhats", "href")).split("text=")[1]);
  assert.ok(zap.startsWith("Lucas venceu · Copa Sul") && zap.includes("Placar: 4-0") && zap.includes("quadralab.com.br/scout"), zap);
  assert.ok(!zap.includes("Fulano") && !zap.includes("Andrade"), "texto sem adversário e sem sobrenome");
  await p.click("#detMentalDepois summary"); await p.click('[data-ment="depois"][data-mk="foco"][data-mv="5"]');
  await p.fill("#fmObs", "Sacou bem no corpo");
  /* tempo de partida: contado do primeiro ponto ao fim, no resultado e no texto para compartilhar; dá para ajustar à mão */
  assert.ok(/Tempo de jogo: /.test(await p.innerText("[data-duracao]")) && /Tempo de jogo: /.test(zap), "tempo de jogo no fim e no texto: " + zap);
  await p.fill("#fmDuracao", "75"); await p.locator("#fmDuracao").blur();
  await p.waitForFunction(() => document.querySelector("[data-duracao]").innerText.includes("1h15"));
  await semRolagem(p, "fim"); await foto(p, "scout-4-fim");
  await nuvemQuieta();
  const naNuvem = Object.keys(store).filter((k) => k.startsWith("scoutAppContas/" + uid + "/jogos/")).map((k) => JSON.parse(store[k].dados)).filter((j) => j.torneio === "Copa Sul")[0];
  assert.ok(naNuvem && naNuvem.mental.depois.foco === 5 && naNuvem.observacaoFinal === "Sacou bem no corpo", "jogo completo na nuvem");
  assert.ok(naNuvem.inicioEm && naNuvem.fimEm && naNuvem.fimEm >= naNuvem.inicioEm && naNuvem.duracaoMin === 75, "tempo de partida na nuvem: " + JSON.stringify([naNuvem.inicioEm, naNuvem.fimEm, naNuvem.duracaoMin]));

  /* o placar por sets no resultado: fundo escuro e letras claras, com os games dos DOIS lados legíveis (antes o adversário sumia no branco) */
  const plFim = await p.evaluate(() => {
    const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; };
    const sec = document.querySelector(".graficos .qg-pl"), tds = [...sec.querySelectorAll("tbody tr:nth-child(2) td")], nota = sec.querySelector(".qg-pl-nota");
    /* o fundo que se vê atrás da célula: o primeiro antepassado com cor (a tabela do app é branca por padrão) */
    const fundoDe = (el) => { for (let x = el; x; x = x.parentElement) { const c = getComputedStyle(x).backgroundColor; if (!/rgba\(.*, 0\)|transparent/.test(c)) return lum(c); } return 1; };
    return { fundo: fundoDe(tds[0]), fundoNome: fundoDe(sec.querySelector("tbody tr:nth-child(2) th")), adv: tds.map((td) => td.textContent.trim()), letra: lum(getComputedStyle(tds[0]).color), nome: lum(getComputedStyle(sec.querySelector("tbody tr:nth-child(2) th")).color), nota: lum(getComputedStyle(nota).color), textoNota: nota.textContent };
  });
  assert.ok(plFim.fundo < 0.2 && plFim.fundoNome < 0.2 && plFim.letra > 0.8 && plFim.nome > 0.8 && plFim.nota > 0.8, "placar do resultado com contraste: " + JSON.stringify(plFim));
  assert.ok(plFim.adv.length >= 1 && plFim.adv.every((x) => /^\d+$/.test(x)) && /Partida encerrada/.test(plFim.textoNota), "games do adversário e a linha da partida aparecem: " + JSON.stringify(plFim));

  /* exportar o relatório deste jogo, direto da tela do fim: placar, tempo de jogo e a comparação, sem o adversário */
  assert.ok(await p.$("[data-exportar] #btRelatorioJogo"), "botão de exportar o relatório do jogo");
  const [relJogo] = await Promise.all([p.waitForEvent("popup"), p.click("#btRelatorioJogo")]);
  await relJogo.waitForLoadState("load");
  const trj = await relJogo.evaluate(() => document.body.innerText);
  assert.ok(trj.includes("Lucas") && /QUADRALAB/i.test(trj) && trj.includes("Copa Sul") && /tempo de jogo 1h15/i.test(trj) && !trj.includes("Fulano") && !trj.includes("Andrade"), "relatório do jogo: " + trj.slice(0, 400));
  await foto(relJogo, "scout-relatorio-jogo"); await relJogo.close();

  /* comparação e atleta */
  await p.click('a[href^="#/atleta/"]'); await p.waitForSelector("#atNome");
  t = await texto();
  assert.ok(t.includes("Lucas Andrade") && t.includes("2 jogos") && t.includes("1 vitória e 0 derrotas") && t.includes("Evolução jogo a jogo"), "atleta: " + t.slice(0, 600).replace(/\n+/g, " | "));
  await semRolagem(p, "atleta"); await foto(p, "scout-5-atleta");
  assert.ok(/1h15/.test(await p.innerText("a.jogo-l >> nth=0")), "o tempo de jogo aparece na lista de jogos do atleta");
  /* UTR e WTN saíram do app: sem cartão na tela do atleta */
  assert.ok(!(await p.$("[data-notas]")) && !/UTR|WTN/.test(await texto()), "sem UTR e WTN na tela do atleta");
  /* relatório dos jogos em PDF (Plus; janela nova com o documento) */
  const [rel] = await Promise.all([p.waitForEvent("popup"), p.click("#btRelatorio")]);
  await rel.waitForLoadState("load");
  const tr = await rel.evaluate(() => document.body.innerText);
  assert.ok(tr.includes("Lucas") && /QUADRALAB/i.test(tr) && tr.includes("Copa Sul") && !tr.includes("Fulano"), "relatório: " + tr.slice(0, 300));
  assert.ok(!/UTR|WTN/.test(tr), "relatório dos jogos sem UTR e WTN");
  await foto(rel, "scout-relatorio"); await rel.close();
  /* a análise de movimento saiu do app: sem aba, sem botão, e o link antigo cai nos jogos */
  const mvGets = []; p.on("request", (rq) => { if (rq.url().includes("scout-app-movimento")) mvGets.push(rq.url()); });
  assert.ok(!(await p.$('#navBaixo [data-aba="movimento"]')) && !(await p.$("[data-movimento]")) && !/Análise de movimento/i.test(await texto()), "sem análise de movimento");
  await p.goto(base + "#/movimento"); await p.waitForSelector("[data-novo]");
  assert.ok(!/Análise de movimento/i.test(await texto()) && mvGets.length === 0, "link antigo do movimento abre os jogos, sem chamar o servidor");

  /* volta ao grátis (14/11/2026: 1 atleta) e evolução completa; link ao vivo e PDF com cadeado; nada de preço nem link de compra */
  delete store["scoutAppContas/" + uid].plano; delete store["scoutAppContas/" + uid].plusAte;
  await p.goto(base + "#/conta"); await p.waitForSelector("#btSync"); await p.click("#btSync");
  await p.waitForFunction(() => document.body.innerText.includes("Tudo sincronizado"));
  await p.waitForFunction(() => !document.body.innerText.includes("Tudo sincronizado"), null, { timeout: 15000 });
  await p.goto(base + "#/jogo/" + jl.id); await p.waitForSelector('[data-plus-bloqueio="pdf"]');
  assert.ok(!(await p.$("#btRelatorioJogo")) && !(await p.$("[data-exportar]")), "grátis: exportar o relatório do jogo com cadeado");
  await p.goto(base + "#/novo"); await p.waitForSelector("#btComecar");
  await p.click('[data-atleta="+"]');
  assert.ok(await p.$("[data-limite-atletas]") && !(await p.$("#nvNome")), "grátis com 1 atleta: o segundo não entra");
  assert.ok(/No grátis é 1 atleta por conta/.test(await p.innerText("[data-limite-atletas]")) && /plano anual/.test(await p.innerText("[data-limite-atletas]")));
  await p.goto(base + "#/plus"); await p.waitForSelector("[data-plano-gratis]");
  t = await texto();
  assert.ok(t.includes("Seu plano") && t.includes("1 atleta na conta") && await p.$("[data-plano-plus]") && /plano anual/i.test(t) && /Link ao vivo/.test(t) && /Relatório em PDF/.test(t) && t.includes("A assinatura anual abre em breve"), "tela do plano: " + t.slice(0, 600));
  assert.ok(!/R\$|29,90|Assinar|Eduzz|Análise de movimento/i.test(t) && !(await p.$('a[href*="eduzz"]')) && !(await p.$("#lkAssinar")), "sem preço, sem link de compra");
  await semRolagem(p, "plano"); await foto(p, "scout-8-plano");
  await p.goto(base + "#/"); await p.waitForSelector("[data-novo]");
  await p.click('a[href^="#/atleta/"]'); await p.waitForSelector('[data-plus-bloqueio="pdf"]');
  assert.ok(!(await p.$("#btRelatorio")) && (await texto()).includes("Evolução jogo a jogo"), "grátis: relatório em PDF com cadeado, evolução completa");

  /* segundo celular na mesma conta */
  const c2 = await celular();
  await c2.p.goto(base + "#/entrar", { waitUntil: "networkidle" });
  await c2.p.fill("#acEmail", "ana@exemplo.com"); await c2.p.fill("#acSenha", "errada"); await c2.p.click("#btAcesso");
  await c2.p.waitForFunction(() => document.body.innerText.includes("E-mail ou senha incorretos"));
  await c2.p.fill("#acSenha", "12345678"); await c2.p.click("#btAcesso");
  await c2.p.waitForFunction(() => document.body.innerText.includes("Copa Sul") && document.body.innerText.includes("Treino antigo"), null, { timeout: 8000 });
  /* apagar no segundo celular tira do primeiro */
  await c2.p.click("a.jogo-l >> text=Treino antigo");
  await c2.p.waitForSelector("#btApagar"); await c2.p.click("#btApagar"); await c2.p.click("#btApagarSim");
  await c2.p.waitForTimeout(1500);
  await p.goto(base + "#/conta"); await p.waitForSelector("#btSync"); await p.click("#btSync");
  await p.waitForFunction(() => document.body.innerText.includes("Tudo sincronizado"));
  await p.goto(base + "#/"); await p.waitForSelector("[data-novo]");
  t = await texto();
  assert.ok(!t.includes("Treino antigo") && t.includes("Copa Sul"), "jogo apagado no outro celular sumiu daqui: " + t.slice(0, 400));
  assert.deepStrictEqual(c2.erros, [], "sem erro de JavaScript no segundo celular");

  /* Minha conta: cópia dos jogos e sair */
  await p.goto(base + "#/conta"); await p.waitForSelector("#btCopia");
  t = await texto();
  assert.ok(t.includes("Ana Andrade") && !t.includes("Pai, mãe") && t.includes("ana@exemplo.com") && t.includes("Grátis") && t.includes("1 atleta") && !t.includes("Scout Plus"), "minha conta: " + t.slice(0, 400));
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#btCopia")]);
  const arquivo = path.join(require("os").tmpdir(), "ql-scout-copia-" + Date.now() + ".json");
  await dl.saveAs(arquivo);
  const copia = JSON.parse(fs.readFileSync(arquivo, "utf8")); fs.unlinkSync(arquivo);
  assert.strictEqual(copia.app, "quadralab-scout"); assert.strictEqual(copia.jogos.length, 1);
  await semRolagem(p, "minha conta"); await foto(p, "scout-6-conta");
  await p.click("#btSair");
  await p.waitForFunction(() => document.body.innerText.includes("Entrar no QuadraLab Scout"));
  /* com a conta entrada, o endereço do app abria direto os jogos; */
  assert.strictEqual(await p.evaluate(() => localStorage.getItem("qls:sessao")), "0", "sair desmarca a conta entrada neste aparelho");
  assert.ok(await p.$eval("#btConta", (e) => e.hidden), "botão da conta some ao sair");
  /* depois de sair, o endereço do app volta a abrir a apresentação */
  await p.goto(base, { waitUntil: "networkidle" });
  assert.strictEqual(p.url(), base + "conheca.html", "sem conta entrada: apresentação");

  /* guia do primeiro acesso: conta nova, sem jogos; só avança tocando no lugar iluminado */
  const c3 = await celular(), g = c3.p;
  await g.addInitScript(() => { window.QL_GUIA_DEMO_MS = 500; }); // demonstração mais rápida no teste
  await g.goto(base + "#/criar", { waitUntil: "networkidle" });
  await g.fill("#acNome", "Bruno"); await g.fill("#acEmail", "bruno@exemplo.com"); await g.fill("#acSenha", "12345678"); await g.click("#btAcesso");
  const balao = () => g.textContent(".guia-balao");
  const visivel = () => g.evaluate(() => { const b = document.querySelector(".guia-balao"); return !!b && !b.hidden; });
  await g.waitForFunction(() => { const b = document.querySelector(".guia-balao"); return b && !b.hidden && b.textContent.includes("Marcar um jogo"); }, null, { timeout: 10000 });
  await foto(g, "scout-guia-1");
  /* tocar fora da área iluminada não faz nada */
  await g.click('#navBaixo [data-aba="conta"]', { force: true });
  assert.ok(!g.url().includes("#/conta") && await visivel(), "fora da área iluminada não navega");
  await g.click("[data-novo]");
  await g.waitForFunction(() => document.querySelector(".guia-balao") && document.querySelector(".guia-balao").textContent.includes("nome do atleta"));
  await g.click("[data-guia-ok]"); assert.ok((await balao()).includes("Digite o nome do atleta"), "Pronto sem nome não segue");
  await g.fill("#nvNome", "Duda"); await g.click("[data-guia-ok]");
  await g.waitForFunction(() => document.querySelector(".guia-balao").textContent.includes("formato"));
  await g.click('[data-formato="4games"]');
  assert.strictEqual(await g.inputValue("#nvNome"), "Duda", "nome mantido");
  await g.waitForFunction(() => document.querySelector(".guia-balao").textContent.includes("Começar o jogo"));
  await g.click("#btComecar");
  for (const [trecho, acao] of [["Este é o placar", "ok"], ["marque o saque", "ok"], ["como ele terminou", '[data-fim="winner_nos"]'], ["detalhes do ponto", "ok"], ["em que bola", '[data-bola="5-9"]'],
    ["Ponto registrado", "ok"], ["Veja o app marcando", "demo"], ["modo completo", "ok"], ["link ao vivo", "ok"], ["Como o jogo termina", "demo"], ["jogo de treino", "ok"]]) {
    await g.waitForFunction((x) => { const b = document.querySelector(".guia-balao"); return b && !b.hidden && b.textContent.includes(x); }, trecho, { timeout: 20000 });
    if (acao === "demo") {
      /* demonstração: o app toca sozinho; durante ela, tocar fora não faz nada */
      await g.click("[data-guia-demo]");
      await g.waitForFunction(() => /Demonstração · 1 de/.test(document.querySelector(".guia-balao").textContent));
      if (trecho === "Veja o app marcando") await foto(g, "scout-guia-4-demo");
      continue;
    }
    if (trecho === "como ele terminou") await foto(g, "scout-guia-2");
    if (trecho === "detalhes do ponto") await foto(g, "scout-guia-3");
    await g.click(acao === "ok" ? "[data-guia-ok]" : acao);
  }
  await g.waitForFunction(() => document.querySelector(".guia-balao").textContent.includes("Bom jogo"));
  await g.click("[data-guia-ok]");
  await g.waitForFunction(() => document.body.innerText.includes("Guia concluído"));
  assert.ok(!(await visivel()), "guia fechado");
  /* o ponto do guia e o da demonstração ficaram (o ace foi desfeito na demonstração); o jogo terminou pela demonstração do fim */
  assert.ok(await g.$("[data-fim-jogo]"), "a demonstração encerrou o jogo de treino");
  assert.ok(/2 pontos · Duda ganhou 1/.test(await g.innerText("[data-fim-jogo]")), await g.innerText("[data-fim-jogo]"));
  assert.strictEqual(await g.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("qls:guia:")).map((k) => localStorage.getItem(k)).join()), "feito");
  /* não volta sozinho; Conta › Ver o guia de novo reabre */
  await g.reload({ waitUntil: "load" }); await g.waitForTimeout(800); assert.ok(!(await visivel()), "guia não volta sozinho");
  await g.goto(base + "#/conta"); await g.waitForSelector("#btGuia"); await g.click("#btGuia");
  await g.waitForFunction(() => { const b = document.querySelector(".guia-balao"); return b && !b.hidden && b.textContent.includes("Marcar um jogo"); });
  await g.click("[data-guia-pular]"); assert.ok(!(await visivel()), "pular fecha o guia");

  /* ── dupla: parceiro, quem saca primeiro, 6 botões de fim, rodízio e troca do saque, "Na dupla" no fim ── */
  await g.goto(base + "#/novo"); await g.waitForSelector("#btComecar");
  await g.click('[data-modalidade="dupla"]'); await g.waitForSelector("#nvParceiro");
  assert.strictEqual(await g.getAttribute('[data-tog="semVantagem"]', "aria-pressed"), "true", "dupla já vem com ponto decisivo");
  await g.fill("#nvParceiro", "Pedro Lima"); await g.fill("#nvAdv", "Irmãos Silva");
  await g.click('[data-sacadupla="parceiro"]');
  assert.strictEqual(await g.getAttribute('[data-sacadupla="parceiro"]', "aria-pressed"), "true");
  await semRolagem(g, "novo jogo de dupla"); await foto(g, "scout-dupla-1-novo");
  await g.click("#btComecar"); await g.waitForSelector("[data-pontos]");
  assert.ok(/Saque de Pedro/i.test(await g.innerText(".placar")) && /Duda e Pedro × Irmãos Silva/.test(await g.innerText(".placar")), await g.innerText(".placar"));
  assert.strictEqual(await g.locator("[data-fim]").count(), 6, "seis botões: winner e erro de cada um, e os dos adversários");
  const pontoD = async (sel) => { await g.click(sel); await g.click('[data-bola="1-4"]'); };
  for (let i = 0; i < 4; i++) await pontoD('[data-fim="winner_nos"][data-quem="parceiro"]');
  assert.ok(/Saque dos adversários/i.test(await g.innerText(".placar")), "game 2: saque dos adversários");
  for (let i = 0; i < 4; i++) await pontoD('[data-fim="erro_dele"]');
  assert.ok(/Saque de Duda/i.test(await g.innerText(".placar")), "game 3: a vez da Duda sacar");
  await g.click("#btTrocarSaque"); await g.waitForFunction(() => /Saque de Pedro/i.test(document.querySelector(".placar").innerText));
  await pontoD('[data-fim="erro_nos"][data-quem="atleta"]');
  await semRolagem(g, "marcação de dupla"); await foto(g, "scout-dupla-2-marcacao");
  await g.click("#btEncerrar"); await g.click("#btFimSim"); await g.waitForSelector("[data-dupla]");
  assert.ok(/Duda e Pedro/.test(await g.innerText("[data-fim-jogo]")) || /encerrado/.test(await g.innerText("[data-fim-jogo]")), await g.innerText("[data-fim-jogo]"));
  const td = await g.innerText("[data-dupla]");
  assert.ok(/Pedro/.test(td) && /Winners\s+0\s+4/.test(td) && /Erros\s+1\s+0/.test(td), td);
  await semRolagem(g, "fim de dupla"); await foto(g, "scout-dupla-3-fim");
  await g.goto(base + "#/"); await g.waitForSelector("[data-novo]");
  assert.ok(/Duda e Pedro/.test(await g.innerText("a.jogo-l >> nth=0")) && /dupla/.test(await g.innerText("a.jogo-l >> nth=0")), "lista mostra a dupla");
  assert.deepStrictEqual(c3.erros, [], "sem erro de JavaScript no guia");

  /* contagem de uso: só aparelho, evento e pontos */
  const ev = usos.map((x) => JSON.parse(x)), tipos = ev.map((x) => x.e);
  assert.ok(tipos.includes("abriu") && tipos.includes("jogo-iniciado") && tipos.includes("jogo-encerrado"), "eventos: " + tipos.join(","));
  assert.ok(ev.every((x) => Object.keys(x).every((k) => ["a", "e", "n"].includes(k))), "só a, e, n");
  assert.ok(!usos.join("").match(/Lucas|Andrade|Fulano|Copa|Sacou|ana@/), "nada pessoal na contagem");

  assert.deepStrictEqual(erros, [], "sem erro de JavaScript");
  await b.close(); srv.close();
  console.log("smoke-scout-app: ok");
})().catch((e) => { console.error(e); srv.close(); process.exit(1); });
