/* Painel de gestão do Team Yoda (teamyoda.com.br/gestao, 18/11/2026): o app inteiro (mty/index.html) num servidor local, com
   React/Babel locais e um Firebase em memória.
   · app dos professores (/treinador): sem o grupo "Gestão da academia" nem "Equipe da organização"; Agenda continua;
     abrir uma tela de gestão no app manda para /gestao?aba=…;
   · painel (/gestao): só as telas de gestão da conta (coordenação: aulas da equipe, relatório, equipe; dono: + financeiro e
     padrão de atendimento), com a tela inicial de atalhos; professor vê que o painel é da coordenação.
   Rode: node tests/check-painel-gestao.js [pasta-das-capturas] */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
const { chromium } = require("playwright");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("check-painel-gestao: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
const capturas = process.argv[2] || "";
const raiz = path.join(__dirname, "../../mty");
const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const dono = (/const DONOS_FINANCEIRO = \["([^"]+)"/.exec(html) || [])[1];
/* netlify.toml: /gestao abre o app sem redirecionar (a Netlify trata /gestao e /gestao/ como o mesmo endereço; uma regra
   "/gestao/ → /gestao" virou laço de redirecionamento em 18/11/2026) */
{
  const toml = fs.readFileSync(path.join(__dirname, "../../netlify.toml"), "utf8");
  const regras = toml.split("[[redirects]]").slice(1).map((r) => ({ from: (/from\s*=\s*"([^"]+)"/.exec(r) || [])[1], to: (/to\s*=\s*"([^"]+)"/.exec(r) || [])[1], status: Number((/status\s*=\s*(\d+)/.exec(r) || [])[1]) }));
  const daGestao = regras.filter((r) => /^\/gestao/.test(r.from || ""));
  assert(daGestao.length && daGestao.every((r) => r.status === 200), "regras de /gestao só reescrevem (200): " + JSON.stringify(daGestao));
  assert(!regras.some((r) => /^\/gestao/.test(r.to || "")), "nenhuma regra manda para /gestao (laço)");
  assert.deepStrictEqual(daGestao.find((r) => r.from === "/gestao"), { from: "/gestao", to: "/index.html", status: 200 });
}
assert(dono, "lista de donos do Financeiro");
const FAKE = `window.firebase = (function () {
  var store = {}, ouv = [], F = window.__FAKE || {};
  var J = function (v) { return JSON.parse(JSON.stringify(v)); };
  function notificar() { ouv.slice().forEach(function (o) { o(); }); }
  function snapDoc(p) { var v = store[p]; return { id: p.split("/").pop(), exists: v !== undefined, data: function () { return v === undefined ? undefined : J(v); }, metadata: { hasPendingWrites: false }, ref: docRef(p) }; }
  function docRef(p) { return { id: p.split("/").pop(), path: p, collection: function (n) { return colRef(p + "/" + n); },
    get: function () { return Promise.resolve(snapDoc(p)); },
    set: function (v, o) { store[p] = o && o.merge ? Object.assign({}, store[p] || {}, J(v)) : J(v); setTimeout(notificar, 0); return Promise.resolve(); },
    update: function (v) { store[p] = Object.assign({}, store[p] || {}, J(v)); setTimeout(notificar, 0); return Promise.resolve(); },
    delete: function () { delete store[p]; setTimeout(notificar, 0); return Promise.resolve(); },
    onSnapshot: function (cb) { var f = function () { cb(snapDoc(p)); }; ouv.push(f); setTimeout(f, 0); return function () { var i = ouv.indexOf(f); if (i >= 0) ouv.splice(i, 1); }; } }; }
  function colRef(p, filtros, lim) { filtros = filtros || [];
    var docs = function () { var ks = Object.keys(store).filter(function (k) { return k.indexOf(p + "/") === 0 && k.slice(p.length + 1).indexOf("/") < 0; })
      .filter(function (k) { return filtros.every(function (f) { return f[1] === "==" ? store[k][f[0]] === f[2] : f[1] === "array-contains" ? (store[k][f[0]] || []).indexOf(f[2]) >= 0 : true; }); });
      if (lim) ks = ks.slice(0, lim); return ks.map(snapDoc); };
    var res = function () { var d = docs(); return { docs: d, size: d.length, empty: !d.length, forEach: function (g) { d.forEach(g); }, docChanges: function () { return []; } }; };
    return { doc: function (id) { return docRef(p + "/" + (id || "id" + Math.random().toString(36).slice(2))); },
      add: function (v) { var r = docRef(p + "/id" + Math.random().toString(36).slice(2)); return r.set(v).then(function () { return r; }); },
      where: function (c, o, v) { return colRef(p, filtros.concat([[c, o, v]]), lim); }, orderBy: function () { return colRef(p, filtros, lim); }, limit: function (n) { return colRef(p, filtros, n); },
      get: function () { return Promise.resolve(res()); },
      onSnapshot: function (cb) { var f = function () { cb(res()); }; ouv.push(f); setTimeout(f, 0); return function () { var i = ouv.indexOf(f); if (i >= 0) ouv.splice(i, 1); }; } }; }
  var db = { collection: function (n) { return colRef(n); }, settings: function () {}, enablePersistence: function () { return Promise.resolve(); },
    runTransaction: function (fn) { return fn({ get: function (r) { return r.get(); }, set: function (r, v, o) { r.set(v, o); }, update: function (r, v) { r.update(v); } }); } };
  var user = { uid: "u-" + (F.papel || "x"), email: F.email, displayName: "Conta teste", getIdToken: function () { return Promise.resolve("tk"); },
    getIdTokenResult: function () { return Promise.resolve({ claims: { orgId: "team-yoda", role: F.papel } }); } };
  var auth = { currentUser: user, onAuthStateChanged: function (cb) { setTimeout(function () { cb(user); }, 0); return function () {}; },
    signInWithEmailAndPassword: function () { return Promise.resolve({ user: user }); }, signOut: function () { return Promise.resolve(); }, sendPasswordResetEmail: function () { return Promise.resolve(); } };
  var fs = function () { return db; }; fs.FieldValue = {};
  return { apps: [], initializeApp: function () { this.apps.push({}); }, firestore: fs, auth: function () { return auth; } };
})();`;
const LIB = { "react.production.min.js": CDN + "/react-18.3.1/package/umd/react.production.min.js", "react-dom.production.min.js": CDN + "/react-dom-18.3.1/package/umd/react-dom.production.min.js",
  "prop-types.min.js": CDN + "/prop-types-15.8.1/package/prop-types.min.js", "Recharts.js": CDN + "/recharts-2.15.4/package/umd/Recharts.js", "babel.min.js": CDN + "/babel-standalone-7.29.9/package/babel.min.js" };
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
const srv = http.createServer((q, r) => {
  const u = new URL(q.url, "http://x");
  if (u.pathname.startsWith("/.netlify/functions/")) { r.writeHead(200, { "content-type": "application/json" }); return r.end(u.pathname.endsWith("/financeiro") ? '{"papel":null}' : "{}"); }
  let rel = u.pathname === "/gestao" || u.pathname === "/treinador" ? "/index.html" : decodeURIComponent(u.pathname);
  if (rel.endsWith("/")) rel += "index.html";
  const f = path.join(raiz, rel);
  if (f.startsWith(raiz) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); return r.end(fs.readFileSync(f)); }
  r.writeHead(404); r.end();
}).listen(0);
const base = "http://localhost:" + srv.address().port;
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox"] });
  const erros = [];
  const abrir = async (papel, email, caminho) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
    await ctx.addInitScript((f) => { window.__FAKE = f; try { localStorage.setItem("ql-onboarding-dispensado", "1"); } catch (e) { /* ok */ } }, { papel, email });
    await ctx.route(/^https?:\/\/(?!localhost)/, (rota) => {
      const url = rota.request().url(), nome = url.split("?")[0].split("/").pop();
      if (/firebase-app-compat/.test(url)) return rota.fulfill({ contentType: "text/javascript", body: FAKE });
      if (/unpkg\.com/.test(url)) { const k = Object.keys(LIB).find((x) => nome === x); if (k) return rota.fulfill({ contentType: "text/javascript", body: fs.readFileSync(LIB[k]) }); }
      rota.fulfill({ contentType: /fonts/.test(url) ? "text/css" : "text/javascript", body: "" });
    });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => erros.push(papel + " " + caminho + ": " + e.message)); p.on("dialog", (d) => d.accept());
    await p.goto(base + caminho);
    return p;
  };
  const menu = (p) => p.innerText("[data-menu-lateral]");
  const fechaNovidades = async (p) => { const bt = p.getByRole("button", { name: /Entendi/ }); if (await bt.count()) await bt.first().click().catch(() => {}); };

  /* 1. coordenação no app dos professores */
  let p = await abrir("coordenador", "coord@teste.com", "/treinador");
  await p.waitForSelector("[data-menu-lateral]", { timeout: 120000 }); await p.waitForTimeout(800); await fechaNovidades(p);
  let m = await menu(p);
  assert(/Agenda/.test(m) && /Grupos/i.test(m) && /Treino e análise/i.test(m), "app segue com Agenda e os grupos dos professores:\n" + m);
  assert(!/Gestão da academia/i.test(m) && !/Equipe da organização/i.test(m) && !/Aulas da equipe/i.test(m) && !/Relatório de aulas/i.test(m), "gestão fora do app:\n" + m);
  if (capturas) await p.screenshot({ path: path.join(capturas, "app-sem-gestao.png") });
  /* tela de gestão guardada da navegação antiga não abre mais no app */
  await p.evaluate(() => { sessionStorage.setItem("mty:nav:aba", "aulas-equipe"); location.reload(); });
  await p.waitForSelector("[data-menu-lateral]", { timeout: 60000 }); await p.waitForTimeout(600);
  assert(/\/treinador$/.test(p.url()) && !/Aulas da equipe/.test(await p.innerText("main")), "app volta para Hoje");
  await p.close();

  /* 2. coordenação no painel */
  p = await abrir("coordenador", "coord@teste.com", "/gestao");
  await p.waitForSelector("[data-gestao-inicio]", { timeout: 120000 }); await fechaNovidades(p);
  m = await menu(p);
  assert(/Gestão da academia/i.test(m) && /Aulas da equipe/.test(m) && /Relatório de aulas/.test(m) && /Equipe da organização/.test(m), "itens da coordenação no painel:\n" + m);
  assert(!/Jogadores/.test(m) && !/Grupos/i.test(m) && !/Agenda/.test(m) && !/Financeiro/.test(m), "painel sem o app dos professores e sem Financeiro para a coordenação:\n" + m);
  assert(/Gestão/.test(await p.title()), "título do painel: " + (await p.title()));
  const atalhos = await p.locator("[data-atalho-gestao]").evaluateAll((l) => l.map((x) => x.getAttribute("data-atalho-gestao")));
  assert(atalhos.includes("equipe") && atalhos.includes("relatorio") && atalhos.includes("aulas-equipe") && !atalhos.includes("financeiro"), "atalhos: " + atalhos.join(","));
  if (capturas) await p.screenshot({ path: path.join(capturas, "painel-gestao.png") });
  await p.locator('[data-atalho-gestao="equipe"]').evaluate((e) => e.click());
  await p.waitForFunction(() => !document.querySelector("[data-gestao-inicio]"));
  /* tela que não é de gestão pedida no painel volta para o início */
  await p.evaluate(() => sessionStorage.clear());
  await p.goto(base + "/gestao?aba=dashboard"); await p.waitForSelector("[data-gestao-inicio]", { timeout: 60000 });
  /* atalho vindo do app: /gestao?aba=… abre direto na tela */
  await p.goto(base + "/gestao?aba=relatorio"); await p.waitForSelector("[data-menu-lateral]", { timeout: 60000 }); await p.waitForTimeout(800);
  assert(!(await p.$("[data-gestao-inicio]")), "abriu direto no relatório de aulas");
  await p.close();

  /* 3. dono: financeiro e padrão de atendimento no painel, e fora do app */
  p = await abrir("coordenador", dono, "/gestao");
  await p.waitForSelector("[data-gestao-inicio]", { timeout: 120000 }); await fechaNovidades(p);
  m = await menu(p);
  assert(/Financeiro/.test(m) && /Padrão de atendimento/.test(m), "dono vê Financeiro e Padrão de atendimento:\n" + m);
  await p.close();
  p = await abrir("coordenador", dono, "/treinador");
  await p.waitForSelector("[data-menu-lateral]", { timeout: 120000 }); await p.waitForTimeout(800);
  m = await menu(p);
  assert(!/Financeiro/.test(m) && !/Padrão de atendimento/.test(m), "Financeiro fora do app:\n" + m);
  await p.close();

  /* 4. professor no painel */
  p = await abrir("treinador", "prof@teste.com", "/gestao");
  await p.waitForSelector("[data-gestao-sem-acesso]", { timeout: 120000 });
  assert(/é da coordenação e do administrativo/.test(await p.innerText("[data-gestao-sem-acesso]")));
  await p.close();

  const reais = erros.filter((e) => !/tailwind|ResizeObserver/i.test(e));
  assert.deepStrictEqual(reais, [], "erros de JS: " + reais.join(" | "));
  console.log("check-painel-gestao: ok");
  await b.close(); srv.close();
})().catch((e) => { console.error(e.message || e); process.exit(1); });
