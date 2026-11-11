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
    await pg.screenshot({ path: path.join(capturas, nome + ".png"), fullPage: true });
    if (process.env.DPR) await pg.evaluate(() => document.querySelectorAll(".topo").forEach((e) => { e.style.position = ""; }));
  };
  const pontos = () => p.textContent("[data-pontos]");
  const ponto = async (fim, bola) => { await p.click(`[data-fim="${fim}"]`); await p.click(`[data-bola="${bola || "5-9"}"]`); };
  const nuvemQuieta = () => p.waitForTimeout(3200); // a sincronização roda 2,5 s depois da última mudança

  /* /scout sem link abre o app; link da família continua na página da família */
  await p.goto(origem + "/scout/", { waitUntil: "networkidle" });
  assert.ok(p.url().startsWith(base), "/scout leva ao app: " + p.url());
  await p.goto(origem + "/scout/?l=" + "a".repeat(32), { waitUntil: "domcontentloaded" });
  assert.ok(p.url().includes("/scout/?l="), "link ao vivo fica na página da família: " + p.url());

  /* um jogo marcado na primeira versão do app (sem conta) */
  await p.goto(base, { waitUntil: "networkidle" });
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
  await p.click('[data-saq="ace"]'); assert.strictEqual(await pontos(), "30-0", "ace em um toque");
  await p.click("#detPonto summary"); await p.click('[data-det="golpe"] >> nth=0');
  /* mental no game */
  await p.click("#detMental summary"); await p.click('[data-mjogo="3"]');
  const jl = await p.evaluate((u) => { const s = JSON.parse(localStorage.getItem("qls:v1:" + u)); return s.jogos.filter((j) => j.torneio === "Copa Sul")[0]; }, uid);
  assert.ok(jl.pontos[1].golpe && jl.pontos[1].saque === "ace", "detalhe no último ponto");
  assert.strictEqual(jl.mental.antes.conf, 4); assert.strictEqual(jl.mental.jogo["1"], 3, "mental no game 1");

  /* link ao vivo */
  await p.click("#btAbrirLink");
  await p.waitForSelector("#btEncerrarLink");
  const wa = decodeURIComponent((await p.getAttribute("#lkAoVivoWhats", "href")).split("text=")[1]);
  const tok = /\/scout\/\?l=([a-f0-9]{32})/.exec(wa)[1];
  assert.ok(wa.startsWith("Acompanhe o jogo de Lucas ao vivo"), wa);
  assert.ok(store["scoutsAoVivo/" + tok] && store["scoutsAoVivo/" + tok].orgId === "app:" + uid, "link na coleção da família");
  const fam = (await celular()).p;
  await fam.goto(origem + "/scout/?l=" + tok, { waitUntil: "networkidle" });
  await fam.waitForFunction(() => document.getElementById("titulo").textContent.includes("Lucas"));
  const tf = await fam.evaluate(() => document.body.innerText);
  assert.ok(tf.includes("Partida de Lucas") && !tf.includes("Fulano") && !tf.includes("Andrade"), "família vê só o primeiro nome: " + tf.slice(0, 300));
  await foto(fam, "scout-familia");
  const versao = store["scoutsAoVivo/" + tok].versao;
  await ponto("winner_nos"); await ponto("winner_nos"); // 1-0 em games
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
  await semRolagem(p, "fim"); await foto(p, "scout-4-fim");
  await nuvemQuieta();
  const naNuvem = Object.keys(store).filter((k) => k.startsWith("scoutAppContas/" + uid + "/jogos/")).map((k) => JSON.parse(store[k].dados)).filter((j) => j.torneio === "Copa Sul")[0];
  assert.ok(naNuvem && naNuvem.mental.depois.foco === 5 && naNuvem.observacaoFinal === "Sacou bem no corpo", "jogo completo na nuvem");

  /* comparação e atleta */
  await p.click('a[href^="#/atleta/"]'); await p.waitForSelector("#atNome");
  t = await texto();
  assert.ok(t.includes("Lucas Andrade") && t.includes("2 jogos") && t.includes("1 vitória e 0 derrotas") && t.includes("Evolução jogo a jogo"), "atleta: " + t.slice(0, 600).replace(/\n+/g, " | "));
  await semRolagem(p, "atleta"); await foto(p, "scout-5-atleta");
  /* análise de movimento no grátis */
  const mvGets = []; p.on("request", (rq) => { if (rq.url().includes("scout-app-movimento")) mvGets.push(rq.url()); });
  await p.click("[data-movimento]");
  await p.waitForFunction(() => document.querySelector("#movArea") && document.querySelector("#movArea").children.length > 0, null, { timeout: 15000 }).catch(async (e) => { console.log("TELA", (await texto()).slice(0, 500), "ERROS", erros, "GETS", mvGets); throw e; });
  t = await texto();
  assert.ok(t.includes("Análise de movimento") && t.includes("Lucas Andrade: filme um golpe") && t.includes("Plano grátis"), "tela da análise: " + t.slice(0, 400));
  assert.ok(mvGets.some((u) => /atleta=a/.test(u)), "análises do atleta pedidas ao servidor");
  await semRolagem(p, "análise de movimento"); await foto(p, "scout-7-movimento");

  /* grátis: 1 atleta e relatório no Plus */
  await p.goto(base + "#/novo"); await p.waitForSelector("#btComecar");
  await p.click('[data-atleta="+"]');
  assert.ok(await p.$("[data-limite-atletas]") && !(await p.$("#nvNome")), "grátis: sem segundo atleta");
  await p.goto(base + "#/"); await p.waitForSelector("[data-novo]");
  await p.click('a[href^="#/atleta/"]'); await p.waitForSelector("#atNome");
  assert.ok(!(await p.$("#btRelatorio")) && (await texto()).includes("No grátis, os últimos 3 jogos"), "grátis: relatório e evolução completa no Plus");
  await p.click("[data-relatorio-plus]"); await p.waitForSelector("#lkAssinar");
  t = await texto();
  assert.strictEqual(await p.getAttribute("#lkAssinar", "href"), "https://chk.eduzz.com/6W4GYZEO0Z", "checkout do Essencial");
  assert.ok(t.includes("R$ 29,90 por mês") && t.includes("ana@exemplo.com") && t.includes("mesmo e-mail"), "tela do Plus: " + t.slice(0, 500));
  await semRolagem(p, "Scout Plus"); await foto(p, "scout-8-plus");
  await p.click("#btJaAssinei"); await p.waitForFunction(() => document.body.innerText.includes("O pagamento ainda não chegou"));
  /* a Eduzz confirma (o webhook grava o Plus na conta; testado em check-webhook-eduzz-planos) */
  store["scoutAppContas/" + uid].plano = "plus"; store["scoutAppContas/" + uid].plusAte = new Date(Date.now() + 32 * 86400000).toISOString().slice(0, 10);
  await p.click("#btJaAssinei"); await p.waitForSelector("[data-plus-ativo]");
  assert.ok((await texto()).includes("Você tem o Scout Plus até"), "Plus ativo");
  await p.goto(base + "#/novo"); await p.waitForSelector("#btComecar"); await p.click('[data-atleta="+"]');
  assert.ok(await p.$("#nvNome"), "Plus: segundo atleta liberado");
  await p.goto(base + "#/"); await p.waitForSelector("[data-novo]");
  await p.click('a[href^="#/atleta/"]'); await p.waitForSelector("#btRelatorio");
  /* relatório dos jogos em PDF (janela nova com o documento) */
  const [rel] = await Promise.all([p.waitForEvent("popup"), p.click("#btRelatorio")]);
  await rel.waitForLoadState("load");
  const tr = await rel.evaluate(() => document.body.innerText);
  assert.ok(tr.includes("Lucas") && /QUADRALAB/i.test(tr) && tr.includes("Copa Sul") && !tr.includes("Fulano"), "relatório: " + tr.slice(0, 300));
  await foto(rel, "scout-relatorio"); await rel.close();

  /* segundo celular na mesma conta */
  const c2 = await celular();
  await c2.p.goto(base, { waitUntil: "networkidle" });
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
  assert.ok(t.includes("Ana Andrade") && !t.includes("Pai, mãe") && t.includes("ana@exemplo.com") && t.includes("Scout Plus"), "minha conta: " + t.slice(0, 400));
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#btCopia")]);
  const arquivo = path.join(require("os").tmpdir(), "ql-scout-copia-" + Date.now() + ".json");
  await dl.saveAs(arquivo);
  const copia = JSON.parse(fs.readFileSync(arquivo, "utf8")); fs.unlinkSync(arquivo);
  assert.strictEqual(copia.app, "quadralab-scout"); assert.strictEqual(copia.jogos.length, 1);
  await semRolagem(p, "minha conta"); await foto(p, "scout-6-conta");
  await p.click("#btSair");
  await p.waitForFunction(() => document.body.innerText.includes("Entrar no QuadraLab Scout"));
  assert.ok(await p.$eval("#btConta", (e) => e.hidden), "botão da conta some ao sair");

  /* contagem de uso: só aparelho, evento e pontos */
  const ev = usos.map((x) => JSON.parse(x)), tipos = ev.map((x) => x.e);
  assert.ok(tipos.includes("abriu") && tipos.includes("jogo-iniciado") && tipos.includes("jogo-encerrado"), "eventos: " + tipos.join(","));
  assert.ok(ev.every((x) => Object.keys(x).every((k) => ["a", "e", "n"].includes(k))), "só a, e, n");
  assert.ok(!usos.join("").match(/Lucas|Andrade|Fulano|Copa|Sacou|ana@/), "nada pessoal na contagem");

  assert.deepStrictEqual(erros, [], "sem erro de JavaScript");
  await b.close(); srv.close();
  console.log("smoke-scout-app: ok");
})().catch((e) => { console.error(e); srv.close(); process.exit(1); });
