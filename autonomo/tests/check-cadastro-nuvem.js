/* Cadastro de aluno novo no app do Team Yoda (26/11/2026, "o cadastro de novos alunos não está funcionando"): o app inteiro com
   um Firebase falso. 1) O Team Yoda (academia da casa) não é barrado por limite de plano nem por licença vencida; 2) quando a
   gravação da lista de jogadores falha na nuvem (ex.: documento acima de 1 MiB), a tela avisa com o motivo e o botão Tentar de
   novo; quando volta a salvar, o aviso some. Rode: node tests/check-cadastro-nuvem.js [capturas] */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
const { chromium } = require("playwright");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("check-cadastro-nuvem: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
const capturas = process.argv[2] || "";
const raiz = path.join(__dirname, "../../mty");
const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const dono = (/const DONOS_FINANCEIRO = \["([^"]+)"/.exec(html) || [])[1];
assert(dono, "lista de donos do Financeiro");
const FAKE = `window.firebase = (function () {
  var store = {}, ouv = [], F = window.__FAKE || {}; if (F.store) Object.keys(F.store).forEach(function (k) { store[k] = F.store[k]; });
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
    runTransaction: function (fn) { return fn({ get: function (r) { return r.get(); }, set: function (r, v, o) { if (F.falhar && r.path.indexOf(F.falhar) >= 0) throw new Error("Document cannot be written because its size (1.100.000 bytes) exceeds the maximum allowed size of 1.048.576 bytes"); r.set(v, o); }, update: function (r, v) { r.update(v); }, delete: function (r) { r.delete(); } }); } };
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
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox"] });
  const erros = [];
  const abrir = async (papel, email, caminho, papelFin, org, extra) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
    if (extra && extra.relogio) await ctx.clock.setFixedTime(new Date(extra.relogio));
    if (papelFin) await ctx.route(/\/\.netlify\/functions\/financeiro/, (rota) => pedidosFin.push(rota.request().url()) && rota.fulfill({ contentType: "application/json", body: JSON.stringify({ papel: papelFin }) }));
    await ctx.addInitScript((f) => { window.__FAKE = f; try { localStorage.setItem("ql-onboarding-dispensado", "1"); } catch (e) { /* ok */ } }, { papel, email, org, ...(extra || {}) });
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


  const vd = async (p) => { const b = p.getByRole("button", { name: "Ver depois" }); if (await b.count()) await b.first().click().catch(() => {}); };
  const novo = async (p, nome) => {
    await p.getByRole("button", { name: "Jogadores" }).first().click(); await p.waitForTimeout(600);
    await p.getByRole("button", { name: /^Novo jogador$/ }).first().click(); await p.waitForSelector("[data-ficha-rapida]", { timeout: 20000 });
    await p.fill("[data-ficha-rapida] input >> nth=0", nome);
    await p.click("[data-rapida-estagio] button >> nth=0"); await p.click("[data-rapida-nivel] button >> nth=0");
    await p.click('button:text-is("Salvar e gerar plano")'); await p.waitForTimeout(1500);
  };
  const info = { "orgs/team-yoda/meta/info": { nome: "Team Yoda", plano: "essencial", planoAtivoAte: "2020-01-01" },
    "orgs/team-yoda/dados/mty:alunos:v2": { value: JSON.stringify([...Array(30).keys()].map((i) => ({ id: "x" + i, nome: "Aluno " + i, cadastroConcluido: true }))) } };
  /* 1. Team Yoda com plano Essencial (30) vencido e 30 jogadores: cadastra mesmo assim */
  let p = await abrir("coordenador", "coord@teste.com", "/treinador", null, null, { store: info });
  await p.waitForSelector("[data-menu-lateral]", { timeout: 120000 }); await p.waitForTimeout(800); await fechaNovidades(p); await vd(p);
  await novo(p, "Lia Nova");
  assert(!/licença desta academia venceu|vai até 30 jogadores/.test(await p.innerText("body")), "academia da casa sem limite nem licença");
  assert(/Lia Nova/.test(await p.innerText("main")), "jogador novo aberto");
  assert(!(await p.$("[data-aviso-nuvem]")), "salvou sem aviso");
  await p.close();
  /* 1b. outra academia com a licença vencida continua barrada (nada muda para quem paga) */
  p = await abrir("coordenador", "coord@teste.com", "/treinador", null, "academia-x", { store: { "orgs/academia-x/meta/info": { nome: "X", plano: "essencial", planoAtivoAte: "2020-01-01" } } });
  await p.waitForSelector("[data-menu-lateral]", { timeout: 120000 }); await p.waitForTimeout(800); await fechaNovidades(p); await vd(p);
  await novo(p, "Bia Barrada");
  assert(/licença desta academia venceu/.test(await p.innerText("body")), "outra academia segue com a licença");
  await p.close();
  /* 1c. lista de jogadores acima de 1 MiB (26/11/2026, o caso do Team Yoda): o app lê a v2, grava em partes (v3) e o cadastro salva */
  const muitos = [...Array(420).keys()].map((i) => ({ id: "g" + i, nome: "Aluno " + i, cadastroConcluido: true, registros: [...Array(10).keys()].map((k) => ({ id: "r" + k, tipo: "sessao", corrigi: "x".repeat(250) })) }));
  p = await abrir("coordenador", "coord@teste.com", "/treinador", null, null, { store: { "orgs/team-yoda/dados/mty:alunos:v2": { value: JSON.stringify(muitos) } } });
  await p.waitForSelector("[data-menu-lateral]", { timeout: 120000 }); await p.waitForTimeout(800); await fechaNovidades(p); await vd(p);
  await novo(p, "Gil Grande"); await p.waitForTimeout(1500);
  const nuvem = await p.evaluate(async () => {
    const d = window.firebase.firestore().collection("orgs").doc("team-yoda").collection("dados");
    const pr = (await d.doc("mty:alunos:v3").get()).data();
    let texto = ""; for (let i = 1; i <= pr.partes; i++) { const x = (await d.doc("mty:alunos:v3~" + i).get()).data(); if (x.versao !== pr.versao) return { erro: "versão" }; texto += x.texto; }
    const v2 = JSON.parse((await d.doc("mty:alunos:v2").get()).data().value);
    return { partes: pr.partes, bytes: pr.bytes, n: JSON.parse(texto).length, tem: JSON.parse(texto).some((a) => a.nome === "Gil Grande"), v2: v2.length };
  });
  assert(nuvem.partes >= 2 && nuvem.bytes > 1048576 && nuvem.n === 421 && nuvem.tem && nuvem.v2 === 420, "lista em partes: " + JSON.stringify(nuvem));
  assert(!(await p.$("[data-aviso-nuvem]")), "salvou sem aviso");
  await p.close();
  /* 1d. marco zero (26/11/2026): no dia 2/12, reposições de novembro zeradas nos dados e aula de novembro sem registro não cobra */
  const marco = {
    "orgs/team-yoda/dados/mty:alunos:v2": { value: JSON.stringify([{ id: "m1", nome: "Marta Marco", cadastroConcluido: true, professorUid: "u-coordenador",
      creditosReposicao: [{ id: "c1", status: "disponivel", criadoEm: "2026-11-20T10:00:00Z" }, { id: "c2", status: "disponivel", criadoEm: "2026-12-01T13:00:00Z" }],
      pedidosReposicao: [{ id: "p1", status: "pendente", em: "2026-11-25T10:00:00Z" }] }]) },
    "orgs/team-yoda/dados/mty:ocorrencias:v1": { value: JSON.stringify([
      { id: "o1", origemTipo: "individual", origemId: "m1", data: "2026-11-27", horaInicio: "09:00", horaFim: "10:00", tipo: "regular", status: "agendada", professorUid: "u-coordenador" },
      { id: "o2", origemTipo: "individual", origemId: "m1", data: "2026-12-01", horaInicio: "09:00", horaFim: "10:00", tipo: "regular", status: "agendada", professorUid: "u-coordenador" }]) },
  };
  p = await abrir("coordenador", "coord@teste.com", "/treinador", null, null, { store: marco, relogio: "2026-12-02T12:00:00-03:00" });
  await p.waitForSelector("[data-menu-lateral]", { timeout: 120000 }); await p.waitForTimeout(2500);
  const dm = await p.evaluate(async () => {
    const d = window.firebase.firestore().collection("orgs").doc("team-yoda").collection("dados");
    const pr = (await d.doc("mty:alunos:v3").get()).data(); let t = ""; for (let i = 1; i <= pr.partes; i++) t += (await d.doc("mty:alunos:v3~" + i).get()).data().texto;
    const a = JSON.parse(t)[0];
    return { cred: a.creditosReposicao.map((c) => c.status), ped: a.pedidosReposicao.map((x) => x.status), marco: window.QLAulasMes.marco() };
  });
  assert.deepStrictEqual(dm, { cred: ["cancelado", "disponivel"], ped: ["arquivado"], marco: "2026-12-01" }, "marco zero nos dados: " + JSON.stringify(dm));
  const avisosTxt = await p.evaluate(() => document.body.innerText);
  assert(!/27\/11/.test(avisosTxt) || !/sem registro/i.test(avisosTxt.split("27/11")[1] || ""), "aula de novembro sem registro não cobra");
  await p.close();
  /* antes do dia (30/11), nada muda */
  p = await abrir("coordenador", "coord@teste.com", "/treinador", null, null, { store: marco, relogio: "2026-11-30T12:00:00-03:00" });
  await p.waitForSelector("[data-menu-lateral]", { timeout: 120000 }); await p.waitForTimeout(2500);
  assert.strictEqual(await p.evaluate(() => window.QLAulasMes.marco()), "", "antes de 1/12 o marco não vale");
  const antes = await p.evaluate(async () => { const d = window.firebase.firestore().collection("orgs").doc("team-yoda").collection("dados"); const v3 = (await d.doc("mty:alunos:v3").get()); if (!v3.exists) return JSON.parse((await d.doc("mty:alunos:v2").get()).data().value)[0].creditosReposicao.map((c) => c.status); let t = ""; for (let i = 1; i <= v3.data().partes; i++) t += (await d.doc("mty:alunos:v3~" + i).get()).data().texto; return JSON.parse(t)[0].creditosReposicao.map((c) => c.status); });
  assert.deepStrictEqual(antes, ["disponivel", "disponivel"], "antes do dia os créditos continuam");
  await p.close();
  /* 2. a nuvem recusa a lista de jogadores: aviso com o motivo */
  p = await abrir("coordenador", "coord@teste.com", "/treinador", null, null, { falhar: "mty:alunos:v3" });
  await p.waitForSelector("[data-menu-lateral]", { timeout: 120000 }); await p.waitForTimeout(800); await fechaNovidades(p); await vd(p);
  await novo(p, "Rui Novo");
  await p.waitForSelector("[data-aviso-nuvem]", { timeout: 20000 });
  const t = await p.innerText("[data-aviso-nuvem]");
  assert(/não foi salva na nuvem/.test(t) && /jogadores/.test(t) && /9\.216 KB/.test(t) && /dividir a lista/.test(t), "aviso: " + t);
  if (capturas) await p.screenshot({ path: path.join(capturas, "aviso-nuvem.png") });
  /* volta a salvar: o aviso some */
  await p.evaluate(() => { window.__FAKE.falhar = ""; });
  await p.click('[data-aviso-nuvem] button:text-is("Tentar de novo")');
  await p.waitForFunction(() => !document.querySelector("[data-aviso-nuvem]"), null, { timeout: 20000 });
  await p.close();
  const reais = erros.filter((e) => !/tailwind|ResizeObserver/i.test(e));
  assert.deepStrictEqual(reais, [], "erros de JS: " + reais.join(" | "));
  console.log("check-cadastro-nuvem: ok");
  await b.close(); srv.close();
})().catch((e) => { console.error(e.message || e); process.exit(1); });
