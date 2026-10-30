/* QuadraLab Player — cadastro do jogador (perfil, etapa "Sobre você") com data de nascimento (idade), sexo e altura, ponta a ponta
   no navegador com a function real player-dados sobre um Firestore em memória:
   · sem nascimento/altura/sexo a etapa não avança (mensagens nos campos);
   · os dados vão para a ficha (servidor valida: data real, altura 80–230 cm) e aparecem no Meu perfil como idade, sexo e altura;
   · o pedido à IA leva a linha "Físico" (idade, sexo, altura); quem já tinha perfil sem esses dados continua com a ficha completa.
   Rode: node tests/smoke-player-cadastro.js [pasta-das-capturas] */
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
  store["jogadores/ua"] = { nome: "Ana Souza", email: "ana@exemplo.com", criadoEm: "2026-09-01T10:00:00Z", planosGratisUsados: 1 };
  await new Promise((r) => servidor.listen(0, r));
  const base = "http://localhost:" + servidor.address().port;
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const erros = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route("https://www.gstatic.com/firebasejs/**", (r) => r.fulfill({ contentType: "text/javascript", body: r.request().url().includes("app-compat") ? FIREBASE_STUB : "" }));
  const p = await ctx.newPage();
  p.on("pageerror", (e) => erros.push(e.message)); p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) erros.push(m.text()); });

  await p.goto(base + "/player/#/ficha/1");
  await p.waitForSelector("#fFicha #nascimento", { timeout: 15000 });
  const vis = (sel) => p.evaluate((s) => !document.querySelector(s).hidden, sel);

  /* sem os dados novos não avança */
  await p.locator('#fFicha input[name="nivel"][value="intermediario"]').check({ force: true });
  await p.locator('#fFicha input[name="mao"][value="destro"]').check({ force: true });
  await p.locator('#fFicha input[name="backhand"][value="duas"]').check({ force: true });
  await p.locator('#fFicha input[name="piso"][value="saibro"]').check({ force: true });
  await p.click("#btAvancar");
  assert(await vis("#g-nascimento .erro-campo"), "pede a data de nascimento");
  assert(await vis("#g-altura .erro-campo"), "pede a altura");
  assert(await vis("#g-sexo .erro-campo"), "pede o sexo");
  assert(/ficha\/1/.test(p.url()), "continua na etapa 1");

  await p.fill("#nascimento", "2010-03-15");
  await p.locator('#fFicha input[name="sexo"][value="feminino"]').check({ force: true });
  await p.fill("#altura", "500");
  await p.click("#btAvancar");
  assert(await vis("#g-altura .erro-campo"), "altura fora da faixa");
  await p.fill("#altura", "164");
  const idade = await p.textContent("#idadeTxt");
  assert(/^\d+ anos$/.test(idade.trim()), "mostra a idade: " + idade);
  if (capturas) { fs.mkdirSync(capturas, { recursive: true }); await p.screenshot({ path: path.join(capturas, "player-cadastro-sobre-voce.png"), fullPage: true }); }
  await p.click("#btAvancar");
  await p.waitForFunction(() => /ficha\/2/.test(location.hash), null, { timeout: 10000 });
  const f = store["jogadores/ua"].ficha;
  assert.strictEqual(f.nascimento, "2010-03-15"); assert.strictEqual(f.sexo, "feminino"); assert.strictEqual(f.altura, 164);

  /* servidor não aceita data impossível nem altura absurda */
  const P = require(fx + "_player.js");
  const ruim = P.normalizarFicha({ nascimento: "2010-02-31", sexo: "outro", altura: 20 });
  assert.deepStrictEqual([ruim.nascimento, ruim.sexo, ruim.altura], ["", "", null], "servidor limpa dados inválidos");
  assert.strictEqual(P.idadeEm("2010-03-15", "2026-03-14"), 15); assert.strictEqual(P.idadeEm("2010-03-15", "2026-03-15"), 16);

  /* perfil completo: Meu perfil mostra idade, sexo e altura; o pedido à IA leva a linha Físico */
  const resto = { armaPrincipal: Object.keys(P.AREAS)[0], pontoFraco: Object.keys(P.AREAS)[1], padraoPonto: Object.keys(P.OPCOES.padraoPonto)[0], rede: Object.keys(P.OPCOES.rede)[0], devolucao: Object.keys(P.OPCOES.devolucao)[0], pressao: Object.keys(P.OPCOES.pressao)[0] };
  store["jogadores/ua"].ficha = P.normalizarFicha({ ...store["jogadores/ua"].ficha, ...resto });
  assert(P.fichaCompleta(store["jogadores/ua"].ficha), "ficha completa");
  assert(/Físico .*idade: \d+ anos; sexo: feminino; altura: 164 cm/.test(P.linhasFicha(store["jogadores/ua"].ficha)), "pedido à IA com idade, sexo e altura");
  await p.goto(base + "/player/#/jogador"); await p.reload(); await p.waitForSelector(".rp-secao", { timeout: 15000 });
  const t = await p.evaluate(() => document.body.innerText);
  assert(/Idade\s*\n?\s*\d+ anos/.test(t) && /Feminino/.test(t) && /164 cm/.test(t), "Meu perfil mostra idade, sexo e altura");
  if (capturas) await p.screenshot({ path: path.join(capturas, "player-cadastro-perfil.png"), fullPage: true });

  /* quem já tinha perfil (sem os dados novos) continua com a ficha completa */
  const antiga = P.normalizarFicha({ nivel: "intermediario", mao: "destro", backhand: "duas", piso: "saibro", ...resto });
  assert.strictEqual(P.fichaCompleta(antiga), true, "perfil antigo segue completo");

  assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
  console.log("smoke-player-cadastro: ok");
  await browser.close(); servidor.close();
})().catch((e) => { console.error(e); process.exit(1); });
