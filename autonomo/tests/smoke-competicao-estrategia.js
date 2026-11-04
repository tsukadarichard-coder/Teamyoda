/* QuadraLab Competição — a estratégia contra adversários do Player e o simulador de decisões dentro do Competição, ponta a ponta
   no navegador com as functions reais (player-dados, player-competicao, player-torneios) sobre um Firestore em memória:
   · Início do atleta com o simulador e o cartão "Estratégia contra adversários" (estratégias prontas e Montar);
   · a estratégia abre no Competição, sem levar aos treinos do Player; Montar contra um adversário abre a etapa do adversário;
   · Preparar partida: atalho com o nome do adversário já preenchido e a estratégia como apoio; simulador embutido.
   Rode: node tests/smoke-competicao-estrategia.js [pasta-das-capturas] */
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
/* a IA não é chamada neste teste: um substituto para o pacote, que não fica instalado aqui */
const Modulo = require("module"), carregar = Modulo._load;
Modulo._load = function (pedido, ...resto) { if (pedido === "@anthropic-ai/sdk") return class { constructor() { this.messages = { create: async () => { throw new Error("sem IA no teste"); } }; } }; return carregar.call(this, pedido, ...resto); };
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
  store["jogadores/ua"] = { nome: "Ana Souza", email: "ana@exemplo.com", criadoEm: "2026-09-01T10:00:00Z", planosGratisUsados: 0,
    competicao: { papel: "atleta", ativadoEm: "2026-09-01T10:00:00Z", nascimento: "2000-05-10" },
    ficha: { nivel: "intermediario", mao: "destro", backhand: "duas", piso: "saibro", armaPrincipal: "forehand", pontoFraco: "backhand", padraoPonto: "fundo", rede: "raro", devolucao: "neutra", pressao: "oscila", adversario: {} } };
  store["jogadores/ua/planos/plano00001"] = { status: "pronto", criadoEm: "2026-10-01T10:00:00Z", adversarioNome: "Bruno",
    plano: { titulo: "Contra o Bruno: tirar o tempo dele", resumo: "Bolas fundas no backhand e subir na curta.", diretrizes: [{ titulo: "Fundo no backhand", acao: "Cruzado fundo", porque: "Ele erra no backhand alto" }], jogadas: [] } };
  store["jogadores/ua/torneios/t1"] = { nome: "Aberto de Verão", inicio: "2026-12-10", fim: "2026-12-14", local: "São Paulo", criadoEm: "2026-10-01T10:00:00Z" };
  await new Promise((r) => servidor.listen(0, r));
  const base = "http://localhost:" + servidor.address().port;
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const erros = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route("https://www.gstatic.com/firebasejs/**", (r) => r.fulfill({ contentType: "text/javascript", body: r.request().url().includes("app-compat") ? FIREBASE_STUB : "" }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ contentType: "text/css", body: "" }));
  await ctx.addInitScript(() => { try { localStorage.setItem("ql-comp-papel", "atleta"); } catch (e) {} });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => erros.push(e.message)); p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) erros.push(m.text()); });
  const cap = async (n) => { if (capturas) { fs.mkdirSync(capturas, { recursive: true }); await p.screenshot({ path: path.join(capturas, n + ".png"), fullPage: true }); } };

  /* Início do atleta: simulador e estratégia contra adversários */
  await p.goto(base + "/competicao/#/inicio");
  await p.waitForSelector("[data-cartao-estrategia]", { timeout: 20000 });
  let t = await p.locator("[data-cartao-estrategia]").innerText();
  assert(/Estratégia contra adversários/.test(t) && /Contra o Bruno/.test(t) && /Montar estratégia contra um adversário/.test(t), "cartão no Início: " + t);
  assert(await p.locator(".simulador-ini").count(), "simulador no Início");
  await cap("comp-inicio-estrategia");
  /* abrir a estratégia pronta */
  await p.click("[data-cartao-estrategia] a.item-estrategia");
  await p.waitForFunction(() => /#\/estrategia\/plano00001/.test(location.hash));
  await p.waitForSelector("text=Contra o Bruno: tirar o tempo dele");
  t = await p.locator("main").innerText();
  assert(/Fundo no backhand/.test(t), "a estratégia abre no Competição: " + t.slice(0, 300));
  assert(!/href="#\/treinos"/.test(await p.locator("main").innerHTML()), "sem link para os treinos do Player");
  await cap("comp-estrategia");
  /* lista e menu */
  await p.goto(base + "/competicao/#/estrategia");
  await p.waitForSelector("main h1:has-text(\"Estratégia contra adversários\")");
  assert(await p.locator("main [data-montar-estrategia]").count(), "botão de montar na lista");
  /* montar contra um adversário: abre a etapa do adversário do perfil */
  await p.click("main [data-montar-estrategia]");
  await p.waitForFunction(() => /#\/ficha\/4/.test(location.hash));
  await p.waitForSelector("#advNome");
  await cap("comp-ficha-adversario");
  /* preparar partida: atalho com o nome do adversário */
  await p.goto(base + "/competicao/#/preparo/t1/novo");
  await p.waitForSelector("[data-estrategia-adv]");
  await p.click("#btEstrAdv");
  assert(/#\/preparo/.test(p.url()), "sem nome do adversário não sai da tela");
  await p.fill("#pAdv", "Carla");
  await p.click("#btEstrAdv");
  await p.waitForFunction(() => /#\/ficha\/4/.test(location.hash));
  await p.waitForSelector("#advNome");
  assert.strictEqual(await p.inputValue("#advNome"), "Carla", "o adversário vem preenchido");
  /* estratégia de apoio na preparação */
  await p.goto(base + "/competicao/#/preparo/t1/novo");
  await p.waitForSelector("#pPlano");
  assert(/Contra o Bruno/.test(await p.locator("#pPlano").innerText()), "a estratégia aparece como apoio na preparação");
  await p.fill("#pAdv", "Bruno"); 
  await cap("comp-preparo-estrategia");
  /* simulador abre dentro do Competição */
  await p.goto(base + "/competicao/#/simulador");
  await p.waitForSelector("#simQuadro");
  assert(/decisoes\/\?embed=1/.test(await p.getAttribute("#simQuadro", "src")), "simulador embutido");
  assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
  console.log("smoke-competicao-estrategia: ok");
  await browser.close(); servidor.close();
})().catch((e) => { console.error(e); process.exit(1); });
