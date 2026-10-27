/* QuadraLab Player — o Simulador de decisões em destaque no Início, no navegador (390 px e computador), com as functions reais
   do Player sobre um Firestore em memória:
   · sem ter jogado: cartão "Novo" convidando a começar; item logo abaixo de Início no menu lateral e no topo do "Mais" no celular;
   · depois de jogar um cenário no simulador (mesmo domínio), o Início mostra estrelas, dias seguidos e padrões, lidos do resumo;
   · revisões vencidas viram a chamada principal; resumo inválido não quebra o Início.
   Rode: node tests/smoke-player-simulador.js [pasta-das-capturas] */
const http = require("http"), fs = require("fs"), path = require("path"), assert = require("assert");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const raiz = path.join(__dirname, ".."), fx = path.join(raiz, "netlify/functions/");
const capturas = process.argv[2] || "";
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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await ctx.route("https://www.gstatic.com/firebasejs/**", (r) => r.fulfill({ contentType: "text/javascript", body: r.request().url().includes("app-compat") ? FIREBASE_STUB : "" }));
  const p = await ctx.newPage();
  p.on("pageerror", (e) => erros.push(e.message)); p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) erros.push(m.text()); });
  const txt = () => p.evaluate(() => document.body.innerText);
  const cap = async (nome, pg) => { if (capturas) { fs.mkdirSync(capturas, { recursive: true }); await (pg || p).screenshot({ path: path.join(capturas, nome + ".png"), fullPage: true }); } };
  const inicio = async () => { await p.goto(base + "/player/#/inicio"); await p.reload(); await p.waitForSelector(".simulador-ini", { timeout: 15000 }); };

  /* nunca jogou */
  await inicio();
  let t = await txt();
  assert(/Novo\s+Simulador de decisões/i.test(t) && /Treine a sua leitura de jogo/.test(t), "cartão de estreia");
  assert.strictEqual(await p.getAttribute(".simulador-ini .btn-sim", "href"), "../decisoes/");
  const ordem = await p.evaluate(() => Array.from(document.querySelectorAll(".lateral-nav .nav-item")).slice(0, 2).map((a) => a.textContent.trim()));
  assert(/^Início$/.test(ordem[0]) && /^Simulador de decisões/.test(ordem[1]), "menu lateral: logo abaixo de Início");
  await p.click("#btMais"); await p.waitForSelector("#painelMais:not([hidden])");
  assert(/Simulador de decisões/.test(await p.evaluate(() => document.querySelector("#painelMais .painel-item").textContent)), "celular: primeiro item do Mais");
  await cap("player-simulador-mais");
  await p.click("#btFecharMais");
  await cap("player-simulador-novo");

  /* joga um cenário no simulador e volta */
  await p.click(".simulador-ini .btn-sim"); await p.waitForURL(/\/decisoes\//);
  await p.goto(base + "/decisoes/#jogar-neutralize"); await p.waitForSelector("#quadra svg");
  for (let n = 0; n < 3; n++) {
    await p.locator('input[name="op"]').first().check({ force: true }); await p.click("#btJogar");
    await p.waitForSelector("#btSeguir", { timeout: 20000 }); await p.click("#btSeguir");
  }
  await p.waitForSelector(".missao");
  const resumo = await p.evaluate(() => JSON.parse(localStorage.getItem("qlDecisoes:resumo")));
  assert(resumo && resumo.v === 1 && resumo.iniciados === 1 && resumo.max === 408 && resumo.dias.length === 1, "o simulador grava o resumo");
  assert(!("cenarios" in resumo && typeof resumo.cenarios === "object"), "o resumo não leva as escolhas");
  await inicio(); t = await txt();
  assert(new RegExp("★\\s*" + resumo.estrelas + " de 408 estrelas").test(t) && /1 dia seguido/.test(t) && /1 de 34 padrões/.test(t), "números do simulador no Início");
  assert(/Continue treinando a sua leitura/.test(t) && /Modo relâmpago/.test(t) && !/Novo\s+Simulador/i.test(t));
  await cap("player-simulador-progresso");

  /* revisões vencidas: a chamada principal muda */
  await p.evaluate(() => { const r = JSON.parse(localStorage.getItem("qlDecisoes:resumo")); r.vencimentos = [Date.now() - 86400000, Date.now() - 1000, Date.now() + 86400000]; localStorage.setItem("qlDecisoes:resumo", JSON.stringify(r)); });
  await inicio(); t = await txt();
  assert(/2 padrões para revisar hoje/.test(t), "revisões vencidas");
  assert.strictEqual(await p.getAttribute(".simulador-ini .btn-sim", "href"), "../decisoes/#desafios");
  await cap("player-simulador-revisoes");

  /* resumo inválido: volta ao convite, sem erro */
  await p.evaluate(() => localStorage.setItem("qlDecisoes:resumo", "{lixo"));
  await inicio(); assert(/Treine a sua leitura de jogo/.test(await txt()));
  await p.evaluate(() => localStorage.setItem("qlDecisoes:resumo", JSON.stringify({ v: 1, estrelas: "x", dias: "y", vencimentos: [null, "z"], iniciados: 2, cenarios: 34 })));
  await inicio(); t = await txt(); assert(/★\s*0 estrelas/.test(t) && !/revisar hoje/.test(t), "campos inválidos viram zero");

  /* computador: item no menu lateral */
  const pc = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  await pc.context().route("https://www.gstatic.com/firebasejs/**", (r) => r.fulfill({ contentType: "text/javascript", body: r.request().url().includes("app-compat") ? FIREBASE_STUB : "" }));
  await pc.goto(base + "/player/#/inicio"); await pc.waitForSelector(".simulador-ini", { timeout: 15000 });
  assert(await pc.isVisible(".lateral-nav .nav-sim"), "item visível no menu lateral");
  await cap("player-simulador-pc", pc);

  assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
  console.log("smoke-player-simulador: ok");
  await browser.close(); servidor.close();
})().catch((e) => { console.error(e); servidor.close(); process.exit(1); });
