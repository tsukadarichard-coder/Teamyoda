/* Início da gestão em painel (26/11/2026, vídeo de referência "CRM dashboard" do Richard: "Use em tudo, pode fazer"): o app inteiro
   (mty/index.html) em /ty/gestao, com React/Babel locais, um Firebase em memória com jogadores, turma, Agenda e evento do mês e o
   Financeiro de mentira. Confere a saudação, os 4 cartões (jogadores, aulas dadas, a receber, presença), a faixa de atenção, o
   gráfico do mês, o anel do recebido, a agenda de hoje, as aulas por professor, o clique que leva à tela e o celular sem rolagem.
   Rode: node autonomo/tests/check-gestao-dashboard.js [pasta-das-capturas] */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
const { chromium } = require("playwright");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("check-gestao-dashboard: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
const capturas = process.argv[2] || "";
const raiz = path.join(__dirname, "../../mty");
const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const dono = (/const DONOS_FINANCEIRO = \["([^"]+)"/.exec(html) || [])[1];
assert(dono, "lista de donos do Financeiro");
const FAKE = `window.firebase = (function () {
  var F = window.__FAKE || {}, store = JSON.parse(JSON.stringify(F.store || {})), ouv = [];
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
    runTransaction: function (fn) { return fn({ get: function (r) { return r.get(); }, set: function (r, v, o) { r.set(v, o); }, update: function (r, v) { r.update(v); }, delete: function (r) { r.delete(); } }); } };
  var user = { uid: "u-" + (F.papel || "x"), email: F.email, displayName: "Conta teste", getIdToken: function () { return Promise.resolve("tk"); },
    getIdTokenResult: function () { return Promise.resolve({ claims: { orgId: F.org || "team-yoda", role: F.papel } }); } };
  var auth = { currentUser: user, onAuthStateChanged: function (cb) { setTimeout(function () { cb(user); }, 0); return function () {}; },
    signInWithEmailAndPassword: function () { return Promise.resolve({ user: user }); }, signOut: function () { return Promise.resolve(); }, sendPasswordResetEmail: function () { return Promise.resolve(); } };
  var fs = function () { return db; }; fs.FieldValue = {};
  return { apps: [], initializeApp: function () { this.apps.push({}); }, firestore: fs, auth: function () { return auth; } };
})();`;
const LIB = { "react.production.min.js": CDN + "/react-18.3.1/package/umd/react.production.min.js", "react-dom.production.min.js": CDN + "/react-dom-18.3.1/package/umd/react-dom.production.min.js",
  "prop-types.min.js": CDN + "/prop-types-15.8.1/package/prop-types.min.js", "Recharts.js": CDN + "/recharts-2.15.4/package/umd/Recharts.js", "babel.min.js": CDN + "/babel-standalone-7.29.9/package/babel.min.js" };
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
const viaCentral = [], pedidosFin = [];
const srv = http.createServer((q, r) => {
  const u = new URL(q.url, "http://x");
  /* a Central repassa /ty/* para este site (central/netlify.toml): aqui o servidor de teste faz o mesmo */
  if (u.pathname.startsWith("/ty/")) { if (u.pathname.startsWith("/ty/.netlify/")) viaCentral.push(u.pathname); u.pathname = u.pathname.slice(3); }
  if (u.pathname.startsWith("/.netlify/functions/")) { r.writeHead(200, { "content-type": "application/json" }); return r.end(u.pathname.endsWith("/financeiro") ? '{"papel":null}' : "{}"); }
  let rel = u.pathname === "/gestao" || u.pathname === "/treinador" ? "/index.html" : decodeURIComponent(u.pathname);
  if (rel.endsWith("/")) rel += "index.html";
  const f = path.join(raiz, rel);
  if (f.startsWith(raiz) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); return r.end(fs.readFileSync(f)); }
  r.writeHead(404); r.end();
}).listen(0);
const base = "http://localhost:" + srv.address().port;

/* dados de exemplo do mês corrente: 3 jogadores, 1 turma, aulas realizadas, uma falta, uma sem registro e as de hoje */
const hojeD = new Date(), iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const hoje = iso(hojeD), mes = hoje.slice(0, 7), dia = (n) => mes + "-" + String(n).padStart(2, "0");
const diaHoje = Number(hoje.slice(8, 10));
const ALUNOS = [{ id: "a1", nome: "Nicolas Prado", criadoEm: dia(1) + "T10:00:00Z", horarios: [], registros: [] }, { id: "a2", nome: "Ana Souza", criadoEm: "2026-01-10T10:00:00Z", horarios: [], registros: [] },
  { id: "a3", nome: "Pedro Lima", criadoEm: "2026-05-10T10:00:00Z", horarios: [], registros: [] }];
const TURMAS = [{ id: "t1", nome: "Turma Laranja", membros: ["a2", "a3"], horarios: [], professorUid: "p2", professorNome: "Prof. Lia" }];
const oc = (id, d, extra) => ({ id, origemTipo: "individual", origemId: "a1", data: d, horaInicio: "17:00", horaFim: "18:00", tipo: "regular", status: "realizada", presencas: { a1: "presente" }, professorUid: "p1", professorNome: "Prof. João", ...extra });
const OCS = [];
for (let n = 1; n < diaHoje; n += 2) OCS.push(oc("i" + n, dia(n)));
if (diaHoje > 2) { OCS.push(oc("falta", dia(diaHoje - 1), { presencas: { a1: "falta" } })); OCS.push(oc("semreg", dia(diaHoje - 1), { status: "agendada", presencas: {}, horaInicio: "08:00" })); }
OCS.push(oc("hoje1", hoje, { status: "agendada", presencas: {}, horaInicio: "23:00" }));
OCS.push({ id: "hojeT", origemTipo: "turma", origemId: "t1", data: hoje, horaInicio: "23:30", horaFim: "23:59", tipo: "regular", status: "agendada", presencas: {}, professorUid: "p2", professorNome: "Prof. Lia" });
const D = (k, v) => ["orgs/team-yoda/dados/" + k, { value: JSON.stringify(v) }];
const STORE = Object.fromEntries([D("mty:alunos:v2", ALUNOS), D("mty:turmas:v1", TURMAS), D("mty:ocorrencias:v1", OCS),
  D("mty:eventos:v1", [{ id: "e1", nome: "Colônia de férias", ativo: true, data: "2099-12-10", convidados: [{ id: "c1", status: "confirmado", pagamento: { status: "pendente" } }, { id: "c2", status: "confirmado", pagamento: { status: "pago", valor: 100 } }] }])]);
const FIN = { mes, academias: [{ org: "team-yoda", nome: "Team Yoda", mes: { controle: { recebido: 6900, aReceber: 10000, emAberto: [{}, {}, {}], atrasados: 2 } } }] };

(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox"] });
  const erros = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
  await ctx.route(/\/\.netlify\/functions\/financeiro/, (rota) => rota.fulfill({ contentType: "application/json", body: JSON.stringify(/quem=1/.test(rota.request().url()) ? { papel: "dono" } : FIN) }));
  await ctx.addInitScript((f) => { window.__FAKE = f; try { localStorage.setItem("ql-onboarding-dispensado", "1"); } catch (e) { /* ok */ } }, { papel: "coordenador", email: dono, org: "team-yoda", store: STORE });
  await ctx.route(/^https?:\/\/(?!localhost)/, (rota) => {
    const url = rota.request().url(), nome = url.split("?")[0].split("/").pop();
    if (/firebase-app-compat/.test(url)) return rota.fulfill({ contentType: "text/javascript", body: FAKE });
    if (/unpkg\.com/.test(url)) { const k = Object.keys(LIB).find((x) => nome === x); if (k) return rota.fulfill({ contentType: "text/javascript", body: fs.readFileSync(LIB[k]) }); }
    rota.fulfill({ contentType: /fonts/.test(url) ? "text/css" : "text/javascript", body: "" });
  });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => erros.push(e.message)); p.on("dialog", (d) => d.accept());
  await p.goto(base + "/ty/gestao");
  await p.waitForSelector("[data-gestao-inicio] [data-cartao-numero]", { timeout: 120000 }).catch(async (e) => { if (capturas) await p.screenshot({ path: path.join(capturas, "erro.png") }); console.error(erros); throw e; });
  const bt = p.getByRole("button", { name: /Entendi/ }); if (await bt.count()) await bt.first().click().catch(() => {});
  await p.waitForSelector('[data-cartao-numero="receber"]', { timeout: 20000 });
  await p.waitForTimeout(600);
  const t = await p.innerText("[data-gestao-inicio]");
  assert(/(Bom dia|Boa tarde|Boa noite)/.test(t), "saudação");
  assert(/Jogadores cadastrados\s*\n\s*3/.test(t), "3 jogadores: " + t.slice(0, 400));
  const realizadas = OCS.filter((o) => o.status === "realizada" && o.data < hoje && o.presencas.a1 === "presente").length;
  assert(new RegExp("Aulas dadas no mês\\s*\\n\\s*" + realizadas).test(t), "aulas dadas = " + realizadas);
  assert(/A receber no mês\s*\n\s*R\$\s*3\.100/.test(t) && /2 atrasadas/.test(t), "a receber (10.000 − 6.900) e atrasadas");
  assert(/Presença no mês/.test(t), "presença");
  const atencao = await p.locator("[data-atencao]").evaluateAll((l) => l.map((x) => x.getAttribute("data-atencao")));
  assert(atencao.includes("atrasadas") && atencao.includes("ev" + "e1") && (diaHoje <= 2 || atencao.includes("sem-registro")), "faixa de atenção: " + atencao.join(","));
  assert(/Agenda de hoje/.test(t) && /Turma Laranja/.test(await p.innerText("[data-agenda-hoje-gestao]")), "agenda de hoje");
  assert(/69%/.test(await p.innerText("[data-anel-painel]")), "anel do recebido");
  assert(/Prof\. João/.test(await p.innerText("[data-aulas-por-professor]")), "aulas por professor");
  assert(await p.locator("[data-grafico-mes] svg path").count() >= 2, "gráfico do mês");
  assert.strictEqual(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, "sem rolagem lateral");
  if (capturas) { fs.mkdirSync(capturas, { recursive: true }); await p.screenshot({ path: path.join(capturas, "gestao-dashboard.png"), fullPage: true }); }
  /* clique leva à tela */
  await p.locator('[data-atencao="eve1"]').click(); /* (o Financeiro daqui é de mentira: o clique vai para Eventos) */
  await p.waitForFunction(() => !document.querySelector("[data-gestao-inicio]"), null, { timeout: 15000 });
  /* celular */
  await p.setViewportSize({ width: 390, height: 844 });
  await p.evaluate(() => sessionStorage.clear());
  await p.goto(base + "/ty/gestao"); await p.waitForSelector("[data-gestao-inicio] [data-cartao-numero]", { timeout: 60000 }).catch(async (e) => { if (capturas) await p.screenshot({ path: path.join(capturas, "erro-celular.png") }); throw e; });
  const bt2 = p.getByRole("button", { name: /Entendi/ }); if (await bt2.count()) await bt2.first().click().catch(() => {});
  await p.waitForTimeout(800);
  assert(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 1, "celular sem rolagem lateral");
  if (capturas) await p.screenshot({ path: path.join(capturas, "gestao-dashboard-celular.png"), fullPage: true });
  assert.deepStrictEqual(erros, []);
  await b.close(); srv.close();
  console.log("check-gestao-dashboard: ok");
})().catch((e) => { console.error(e); process.exit(1); });
