/* QuadraLab Player — análise de movimento (biomecânica), ponta a ponta no navegador, com a function real player-movimento sobre um
   Firestore em memória:
   · plano gratuito: 1 análise de cada golpe. Depois de salvar o forehand, o forehand fica bloqueado (na tela e no servidor) e o
     backhand continua liberado; remover a análise não devolve o uso; o relatório completo (com as fotos) reabre depois;
   · plano pago: sem limite (duas análises de forehand);
   · a tabela de planos mostra a linha da análise de movimento.
   A pose vem do motor sintético (o modelo MediaPipe não é baixado no teste). Rode: node tests/smoke-player-movimento.js [pasta-das-capturas] */
const http = require("http"), fs = require("fs"), path = require("path"), assert = require("assert");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const raiz = path.join(__dirname, ".."), fx = path.join(raiz, "netlify/functions/");
const capturas = process.argv[2] || "";

/* ── regras puras ── */
const M = require(fx + "_player-movimento.js");
assert.deepStrictEqual(M.cota({}, { nivel: "gratis" }).porGolpe.saque, { usadas: 0, limite: 1, liberado: true });
assert.strictEqual(M.avaliarSalvar({ movimentoUso: { forehand: 1 } }, { nivel: "gratis", golpe: "forehand", novo: true, total: 1 }).ok, false, "free: 2º forehand barrado");
assert.strictEqual(M.avaliarSalvar({ movimentoUso: { forehand: 1 } }, { nivel: "gratis", golpe: "forehand", novo: false, total: 1 }).conta, false, "refazer a mesma análise não conta");
assert.strictEqual(M.avaliarSalvar({ movimentoUso: { forehand: 9 } }, { nivel: "p1", golpe: "forehand", novo: true, total: 9 }).ok, true, "pago: sem limite");
assert.strictEqual(M.avaliarSalvar({}, { nivel: "gratis", full: true, golpe: "saque", novo: true, total: 0 }).ok, true);
assert.strictEqual(M.limparResumo({ id: "x", golpe: "forehand", criadoEm: "2026-10-01T10:00:00Z" }), null, "id inválido");
assert.strictEqual(M.limparResumo({ id: "mvabc12345", golpe: "voleio", criadoEm: "2026-10-01T10:00:00Z" }), null, "golpe inválido");

/* ── Firestore em memória (com transação) ── */
const store = {}; const J = (v) => JSON.parse(JSON.stringify(v));
function docRef(p) { return { id: p.split("/").pop(), async get() { const v = store[p]; return { exists: v !== undefined, id: p.split("/").pop(), data: () => J(v) }; }, async set(v, o) { store[p] = o && o.merge ? { ...(store[p] || {}), ...J(v) } : J(v); }, async update(v) { Object.assign(store[p], J(v)); }, async delete() { delete store[p]; }, collection: (s) => colRef(p + "/" + s) }; }
let seq = 0;
function colRef(p, f = [], ord = null, lim = 0) {
  return {
    doc: (id) => docRef(p + "/" + id), where: (c, o, v) => colRef(p, f.concat([[c, v]]), ord, lim), orderBy: (c, d) => colRef(p, f, [c, d || "asc"], lim), limit: (n) => colRef(p, f, ord, n),
    async add(v) { const id = "doc" + String(++seq).padStart(12, "0"); store[p + "/" + id] = J(v); return docRef(p + "/" + id); },
    async get() {
      let ks = Object.keys(store).filter((k) => k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/")).filter((k) => f.every(([c, v]) => store[k][c] === v));
      if (ord) ks.sort((a, b) => (String(store[a][ord[0]]) < String(store[b][ord[0]]) ? -1 : 1) * (ord[1] === "desc" ? -1 : 1));
      if (lim) ks = ks.slice(0, lim);
      const d = ks.map((k) => ({ id: k.split("/").pop(), ref: docRef(k), data: () => J(store[k]) }));
      return { docs: d, empty: !d.length, size: d.length, forEach: (g) => d.forEach(g) };
    },
  };
}
const db = { collection: (n) => colRef(n), runTransaction: async (fn) => fn({ get: (r) => r.get(), set: (r, v, o) => r.set(v, o), update: (r, v) => r.update(v) }) };
let usuarioAtual = { uid: "ua", email: "ana@exemplo.com", name: "Ana" };
const admin = { firestore: () => db, auth: () => ({ verifyIdToken: async (t) => { if (t !== "tok") throw new Error("x"); return usuarioAtual; } }) };
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin, app: () => {} } };
const handler = (n) => require(fx + n + ".js").handler;

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp" };
const servidor = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname.startsWith("/.netlify/functions/")) {
    const nome = u.pathname.split("/").pop(); let corpo = ""; req.on("data", (d) => (corpo += d));
    req.on("end", async () => {
      try {
        const r = await handler(nome)({ httpMethod: req.method, headers: req.headers, body: corpo || null, queryStringParameters: Object.fromEntries(u.searchParams) });
        res.writeHead(r.statusCode, r.headers || { "content-type": "application/json" }); res.end(r.body);
      } catch (e) { res.writeHead(500); res.end(JSON.stringify({ erro: String(e.message) })); }
    });
    return;
  }
  let f = path.join(raiz, decodeURIComponent(u.pathname)); if (u.pathname.endsWith("/")) f = path.join(f, "index.html");
  if (!f.startsWith(raiz) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end("não encontrado"); }
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); res.end(fs.readFileSync(f));
});
const FIREBASE_STUB = `(function(){var cbs=[],a={currentUser:{uid:"ua",email:"ana@exemplo.com",displayName:"Ana",getIdToken:function(){return Promise.resolve("tok")}},languageCode:"",onAuthStateChanged:function(cb){cbs.push(cb);setTimeout(function(){cb(a.currentUser)},0)},signOut:function(){return Promise.resolve()}};
window.firebase={initializeApp:function(){},auth:function(){return a}};})();`;

(async () => {
  store["jogadores/ua"] = { nome: "Ana Souza", email: "ana@exemplo.com", criadoEm: "2026-09-01T10:00:00Z", planosGratisUsados: 1, ficha: { nivel: "intermediario", mao: "destro", backhand: "duas", adversario: {} } };
  await new Promise((r) => servidor.listen(0, r));
  const base = "http://localhost:" + servidor.address().port;
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const erros = [];
  async function pagina(largura) {
    const ctx = await browser.newContext({ viewport: { width: largura || 390, height: 844 } });
    await ctx.route("https://www.gstatic.com/firebasejs/**", (r) => r.fulfill({ contentType: "text/javascript", body: r.request().url().includes("app-compat") ? FIREBASE_STUB : "" }));
    const pg = await ctx.newPage();
    pg.on("pageerror", (e) => erros.push(e.message)); pg.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) erros.push(m.text()); });
    return pg;
  }
  const api = (pg, corpo) => pg.evaluate(async (c) => { const r = await fetch("/.netlify/functions/player-movimento", { method: "POST", headers: { authorization: "Bearer tok", "content-type": "application/json" }, body: JSON.stringify(c) }); return { status: r.status, corpo: await r.json() }; }, corpo);
  /* uma análise "de vídeo" com a pose do motor sintético (como se o vídeo tivesse sido lido) */
  const analisar = (pg, golpe) => pg.evaluate((g) => { document.querySelector('[data-r="tabs"] [data-g="' + g + '"]').click(); window.QL_MOVIMENTO.injetar(QLBiomec.sintetico(g === "saque" ? 70 : 60, "D", g)); }, golpe);
  const cotaTxt = (pg) => pg.evaluate(() => (document.querySelector("#qm-cota-slot") || {}).textContent || "");

  /* ── plano gratuito ── */
  let p = await pagina(390);
  await p.goto(base + "/player/#/movimento");
  await p.waitForSelector("#movArea .qm-card", { timeout: 15000 });
  let t = await p.evaluate(() => document.body.innerText);
  assert(/Análise de movimento/.test(t) && /Plano gratuito:\s*1 análise de cada golpe/.test(t), "tela com o aviso do plano gratuito");
  assert(/você tem 1 análise de forehand/.test(await cotaTxt(p)), "forehand liberado");
  assert(await p.evaluate(() => !!document.querySelector('a[href="#/movimento"]')), "item no menu");
  if (capturas) { fs.mkdirSync(capturas, { recursive: true }); await p.screenshot({ path: path.join(capturas, "player-movimento-free.png"), fullPage: true }); }

  await analisar(p, "forehand");
  await p.waitForFunction(() => /Relatório guardado/.test(document.querySelector('[data-r="salvoMsg"]').textContent), null, { timeout: 15000 });
  assert(/já usou a análise gratuita de forehand/.test(await cotaTxt(p)), "depois de salvar, o forehand fica bloqueado");
  assert(await p.evaluate(() => document.querySelector('[data-r="go"]').disabled), "botão Analisar desligado no forehand");
  const docs = Object.keys(store).filter((k) => k.startsWith("jogadores/ua/movimentos/"));
  assert.strictEqual(docs.length, 1, "uma análise guardada");
  const rel = JSON.parse(store[docs[0]].relatorio);
  assert(rel.resultado && rel.fotos.length >= 3 && rel.fotos.every((f) => /^data:image\/jpeg/.test(f)), "relatório completo com as fotos das fases");
  assert.deepStrictEqual(store["jogadores/ua"].movimentoUso, { forehand: 1, backhand: 0, saque: 0 });
  if (capturas) await p.screenshot({ path: path.join(capturas, "player-movimento-resultado.png"), fullPage: true });

  /* outro golpe continua liberado */
  await p.click('[data-r="tabs"] [data-g="backhand"]');
  assert(/você tem 1 análise de backhand/.test(await cotaTxt(p)), "backhand liberado");
  await p.click('[data-r="tabs"] [data-g="forehand"]');
  assert(/já usou a análise gratuita de forehand/.test(await cotaTxt(p)), "voltar ao forehand: bloqueado");

  /* o servidor barra mesmo sem a tela (outro registro de forehand) */
  const resumo = JSON.parse(JSON.stringify(store[docs[0]].resumo));
  const r2 = await api(p, { acao: "salvar", resumo: { ...resumo, id: "mvoutro12345" } });
  assert.strictEqual(r2.status, 403); assert(/já usou a análise gratuita de forehand/.test(r2.corpo.erro), "servidor barra o 2º forehand no Free");
  const r3 = await api(p, { acao: "salvar", resumo });
  assert.strictEqual(r3.status, 200, "salvar de novo a mesma análise não conta"); assert.strictEqual(store["jogadores/ua"].movimentoUso.forehand, 1);

  /* trecho do golpe (vídeo e boneco juntos), num documento à parte, como no app do treinador */
  const px = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==";
  const clip = { prop: 1.5, t: [0.1, 0.2, 0.3], fotos: [px, px, px], poses: [[[0.5, 0.5]], [[0.5, 0.5]], [[0.5, 0.5]]], fases: [0.1, 0.3], nomes: ["Preparação", "Contato"] };
  assert.strictEqual((await api(p, { acao: "clip", id: resumo.id, clip: JSON.stringify({ ...clip, fotos: ["javascript:x", px, px] }) })).status, 400, "trecho com imagem inválida");
  assert.strictEqual((await api(p, { acao: "clip", id: "mvnaoexiste1", clip: JSON.stringify(clip) })).status, 404, "trecho sem análise salva");
  assert.strictEqual((await api(p, { acao: "clip", id: resumo.id, clip: JSON.stringify(clip) })).status, 200, "trecho guardado");
  assert(store["jogadores/ua/movimentoClips/" + resumo.id], "trecho fora do documento da análise");

  /* reabrir: histórico e relatório completo vindos do servidor */
  await p.reload(); await p.waitForSelector("#movArea .qm-card", { timeout: 15000 });
  assert.strictEqual(await p.locator("[data-ver]").count(), 1, "análise salva no histórico");
  const [pop] = await Promise.all([p.waitForEvent("popup"), p.click("[data-ver]")]);
  await pop.waitForFunction(() => /Checklist por fase/.test(document.body.innerText), null, { timeout: 10000 });
  assert(await pop.locator("img").count() >= 3, "relatório reaberto com as fotos");
  assert(/Vídeo e boneco juntos/.test(await pop.evaluate(() => document.body.innerText)), "relatório reaberto com o vídeo e o boneco juntos");
  await pop.close();

  /* remover não devolve o uso no plano gratuito */
  p.once("dialog", (d) => d.accept());
  await p.click("[data-rm]");
  await p.waitForFunction(() => !document.querySelector("[data-ver]"), null, { timeout: 5000 });
  await new Promise((r) => setTimeout(r, 300));
  assert.strictEqual(Object.keys(store).filter((k) => k.startsWith("jogadores/ua/movimentos/")).length, 0, "análise removida");
  assert(!store["jogadores/ua/movimentoClips/" + resumo.id], "trecho removido junto");
  await p.reload(); await p.waitForSelector("#movArea .qm-card", { timeout: 15000 });
  assert(/já usou a análise gratuita de forehand/.test(await cotaTxt(p)), "remover não devolve a análise gratuita");

  /* planos: linha da análise de movimento */
  await p.goto(base + "/player/#/assinaturas");
  await p.waitForFunction(() => /1 análise de movimento de cada golpe/.test(document.body.innerText), null, { timeout: 15000 });
  t = await p.evaluate(() => document.body.innerText);
  assert(/Análise de movimento sem limite/.test(t), "planos pagos: análise de movimento sem limite");
  await p.context().close();

  /* ── plano pago: sem limite ── */
  store["jogadores/ua"].planoPago = "p1";
  p = await pagina(1100);
  await p.goto(base + "/player/#/movimento");
  await p.waitForSelector("#movArea .qm-card", { timeout: 15000 });
  t = await p.evaluate(() => document.body.innerText);
  assert(!/Plano gratuito:/.test(t) && (await cotaTxt(p)) === "", "plano pago: sem aviso de limite");
  await analisar(p, "forehand");
  await p.waitForFunction(() => /Relatório guardado/.test(document.querySelector('[data-r="salvoMsg"]').textContent), null, { timeout: 15000 });
  await p.evaluate(() => { document.querySelector('[data-r="tabs"] [data-g="backhand"]').click(); });
  await analisar(p, "forehand");
  await p.waitForFunction(() => document.querySelectorAll("[data-ver]").length === 2, null, { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 500));
  assert.strictEqual(Object.keys(store).filter((k) => k.startsWith("jogadores/ua/movimentos/")).length, 2, "plano pago: duas análises de forehand");
  if (capturas) await p.screenshot({ path: path.join(capturas, "player-movimento-pago.png"), fullPage: true });

  assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
  console.log("smoke-player-movimento: ok");
  await browser.close(); servidor.close();
})().catch((e) => { console.error(e); servidor.close(); process.exit(1); });
