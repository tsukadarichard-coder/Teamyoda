/* Área do aluno do Team Yoda (/minha-area/) no navegador (390 px), com as functions reais digital.js e ver-aluno.js sobre um
   Firestore e um login em memória:
   · portal: "Acessar minha área" leva à área do aluno;
   · Meu plano (link do aluno): "Criar minha área" leva à área já com o aluno; a pessoa cria a conta e cai no aluno ligado;
   · "Meu plano e aulas" abre o plano sem guardar o link (de=area: o plano mostra "← Minha área" e não oferece criar de novo);
   · o professor troca o link: a área pede o link novo e volta a abrir com ele;
   · conta ligada antes desta versão (sem marca do link): a área pede para confirmar o link uma vez, sem dizer que mudou;
   · servidor: conta não ligada não recebe o link de outro aluno (403); conta da equipe vê o caminho do professor.
   Rode: node tests/smoke-minha-area.js [pasta-das-capturas] */
process.env.DIGITAL_SEM_CURSOS_MTY = "1"; /* os cursos MTY automáticos têm teste próprio (check-digital) */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const capturas = process.argv[2] || "";
const raiz = path.join(__dirname, "../../mty"), fx = path.join(__dirname, "../../netlify/functions/");

const store = {}; const J = (v) => JSON.parse(JSON.stringify(v));
function docRef(p) { return { id: p.split("/").pop(), collection: (n) => colRef(p + "/" + n), async get() { const v = store[p]; return { exists: v !== undefined, id: p.split("/").pop(), data: () => J(v) }; }, async set(v, o) { store[p] = o && o.merge ? { ...(store[p] || {}), ...J(v) } : J(v); } }; }
function colRef(p, f = [], lim = 0) {
  return {
    doc: (id) => docRef(p + "/" + id), where: (c, o, v) => colRef(p, f.concat([[c, o, v]]), lim), limit: (n) => colRef(p, f, n),
    async get() {
      let ks = Object.keys(store).filter((k) => k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/"))
        .filter((k) => f.every(([c, o, v]) => (o === "array-contains" ? (store[k][c] || []).includes(v) : store[k][c] === v)));
      if (lim) ks = ks.slice(0, lim);
      const d = ks.map((k) => ({ id: k.split("/").pop(), ref: docRef(k), data: () => J(store[k]) }));
      return { docs: d, size: d.length, empty: !d.length, forEach: (g) => d.forEach(g) };
    },
  };
}
/* contas: e-mail → { uid, senha, claims } */
const contas = { "coord@ty.com": { uid: "c1", senha: "senha-coord", claims: { uid: "c1", orgId: "team-yoda", role: "coordenador", email: "coord@ty.com" } }, "prof@39.com": { uid: "p1", senha: "senha-prof", claims: { uid: "p1", orgId: "39-ranch", role: "treinador", email: "prof@39.com" } } };
let uidSeq = 0;
const admin = {
  firestore: () => ({ collection: (n) => colRef(n) }),
  auth: () => ({
    verifyIdToken: async (t) => { const c = Object.values(contas).find((x) => "tk-" + x.uid === t); if (!c) throw new Error("x"); return c.claims; },
    createUser: async ({ email, password, displayName }) => { if (contas[email]) { const e = new Error("exists"); e.code = "auth/email-already-exists"; throw e; } const uid = "u" + (++uidSeq); contas[email] = { uid, senha: password, claims: { uid, email, name: displayName } }; return { uid }; },
  }),
};
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin, app: () => {} } };
const digital = require(fx + "digital.js").handler, verAluno = require(fx + "ver-aluno.js").handler;
store["orgs/team-yoda/dados/mty:alunos:v2"] = { value: JSON.stringify([{ id: "a1", nome: "Ana Souza", linkToken: "tA", registros: [], horarios: [{ dia: 4, hora: "17:00" }],
  plano: { aprovado: true, tipo: "Ciclo de 8 semanas", blocos: [{ titulo: "Base", semanasLista: [{ n: 1, foco: "Consistência", aulas: [{ t: "Forehand cruzado" }, { t: "Backhand paralelo" }, { t: "Saque e devolução" }] }] }] },
  regPlano: { A01: { status: "feita" } } }]) };
store["orgs/39-ranch/dados/mty:alunos:v2"] = { value: JSON.stringify([{ id: "r1", nome: "Rui Costa", linkToken: "tR", registros: [], horarios: [] }]) };

/* Firebase de mentira (app + auth) no lugar do gstatic */
const FIREBASE = `window.firebase=(function(){var cbs=[],user=null;
function chamar(u){cbs.forEach(function(f){f(u)})}
try{var s=JSON.parse(sessionStorage.getItem("fakeUser")||"null");if(s)user={uid:s.uid,email:s.email,getIdToken:function(){return Promise.resolve(s.tk)}}}catch(e){}
var a={signInWithEmailAndPassword:function(e,p){return fetch("/__login",{method:"POST",body:JSON.stringify({e:e,p:p})}).then(function(r){if(!r.ok)return Promise.reject({code:"auth/invalid-credential"});return r.json()}).then(function(j){sessionStorage.setItem("fakeUser",JSON.stringify({uid:j.uid,email:e,tk:j.tk}));user={uid:j.uid,email:e,getIdToken:function(){return Promise.resolve(j.tk)}};chamar(user);return {user:user}})},
onAuthStateChanged:function(f){cbs.push(f);setTimeout(function(){f(user)},0)},signOut:function(){user=null;sessionStorage.removeItem("fakeUser");chamar(null);return Promise.resolve()},sendPasswordResetEmail:function(){return Promise.resolve()}};
return {apps:[],initializeApp:function(){this.apps.push({})},auth:function(){return a}}})();`;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };
const srv = http.createServer((q, r) => {
  const u = new URL(q.url, "http://x");
  let b = ""; q.on("data", (d) => (b += d));
  q.on("end", async () => {
    if (u.pathname === "/__login") { const { e, p } = JSON.parse(b); const c = contas[e]; if (!c || c.senha !== p) { r.writeHead(400); return r.end("{}"); } r.writeHead(200); return r.end(JSON.stringify({ uid: c.uid, tk: "tk-" + c.uid })); }
    if (u.pathname === "/.netlify/functions/digital" || u.pathname === "/.netlify/functions/ver-aluno") {
      const x = await (u.pathname.endsWith("/digital") ? digital : verAluno)({ httpMethod: q.method, headers: q.headers, body: b || null, queryStringParameters: Object.fromEntries(u.searchParams) });
      r.writeHead(x.statusCode, x.headers); return r.end(x.body);
    }
    let rel = decodeURIComponent(u.pathname); if (rel.endsWith("/")) rel += "index.html";
    const f = path.join(raiz, rel);
    if (f.startsWith(raiz) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); return r.end(fs.readFileSync(f)); }
    r.writeHead(404); r.end();
  });
}).listen(0);
const base = "http://localhost:" + srv.address().port;

const chamar = async (metodo, corpo, tk) => { const x = await digital({ httpMethod: metodo, headers: tk ? { authorization: "Bearer " + tk } : {}, body: corpo ? JSON.stringify(corpo) : null, queryStringParameters: {} }); return JSON.parse(x.body); };
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const erros = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route(/^https?:\/\/(?!localhost)/, (rota) => {
    const url = rota.request().url();
    if (/firebase-app-compat/.test(url)) return rota.fulfill({ contentType: "text/javascript", body: FIREBASE });
    rota.fulfill({ contentType: /fonts/.test(url) ? "text/css" : "text/javascript", body: "" });
  });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => erros.push(e.message)); p.on("dialog", (d) => d.accept());
  const cap = async (nome) => { if (capturas) { fs.mkdirSync(capturas, { recursive: true }); await p.screenshot({ path: path.join(capturas, nome + ".png"), fullPage: true }); } };
  const texto = () => p.evaluate(() => document.body.innerText);
  const esperaTexto = async (re, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (re.test(await texto())) return; await p.waitForTimeout(150); } throw new Error("não apareceu " + re + "\n" + (await texto()).slice(0, 800)); };

  /* 1. portal */
  await p.goto(base + "/portal/");
  const href = await p.locator('#acesso a.btn-verm').first().getAttribute("href");
  assert.strictEqual(href, "../minha-area/", "Acessar minha área leva à área do aluno");

  /* 2. Meu plano → Criar minha área */
  await p.goto(base + "/aluno.html?org=team-yoda&id=a1&t=tA");
  await p.waitForSelector("[data-minha-area]", { timeout: 20000 });
  assert(/Guarde este plano na sua área/.test(await texto()));
  await p.click("[data-minha-area] a");
  await esperaTexto(/Aluno de Team Yoda · Cooper Tênis: crie a sua conta/);
  assert(!/org=/.test(p.url()), "o link sai do endereço");
  await cap("area-01-criar");
  await p.fill('input[name="nome"]', "Ana Souza"); await p.fill('input[name="email"]', "ana@ex.com"); await p.fill('input[name="senha"]', "senha-ana-1");
  await p.click("#btEnt");
  await esperaTexto(/Pronto: a sua conta está ligada ao aluno de Team Yoda/);
  assert(/Olá, Ana/.test(await texto()) && /Meu plano e aulas/.test(await texto()));
  await cap("area-02-aluno");

  /* 3. abrir o plano pela área */
  await p.click('[data-plano="0"]');
  await p.waitForURL(/aluno\.html\?.*de=area/, { timeout: 15000 });
  await p.waitForSelector("[data-minha-area]", { timeout: 20000 });
  assert(/← Minha área/.test(await texto()) && !/Guarde este plano na sua área/.test(await texto()), "pela área, o plano mostra o caminho de volta");
  assert(/[?&]t=tA(&|$)/.test(p.url()), "abre com o link atual do aluno");

  /* 4. o professor troca o link */
  const lista = JSON.parse(store["orgs/team-yoda/dados/mty:alunos:v2"].value); lista[0].linkToken = "tA2";
  store["orgs/team-yoda/dados/mty:alunos:v2"] = { value: JSON.stringify(lista) };
  await p.goto(base + "/minha-area/");
  await esperaTexto(/O link do aluno mudou/);
  await p.fill('form[id^="fRel"] input[name="link"]', "https://teamyoda.com.br/aluno.html?org=team-yoda&id=a1&t=tA");
  await p.click('form[id^="fRel"] button[type="submit"]');
  await esperaTexto(/não vale mais|Peça um novo/);
  await p.fill('form[id^="fRel"] input[name="link"]', "https://teamyoda.com.br/aluno.html?org=team-yoda&id=a1&t=tA2");
  await p.click('form[id^="fRel"] button[type="submit"]');
  await esperaTexto(/Pronto: a sua conta está ligada/);
  await p.click('[data-plano="0"]');
  await p.waitForURL(/[?&]t=tA2&de=area/, { timeout: 15000 });

  /* 5. conta ligada antes desta versão (sem marca do link) */
  await p.goto(base + "/minha-area/"); await p.click("#btSair"); await esperaTexto(/Sua área no Team Yoda/);
  const criado = await chamar("POST", { acao: "criar", nome: "Paulo Souza", email: "pai@ex.com", senha: "senha-pai-1" });
  assert(criado.ok !== false, JSON.stringify(criado));
  const uidPai = contas["pai@ex.com"].uid;
  store["digitalContas/" + uidPai] = { ...(store["digitalContas/" + uidPai] || { nome: "Paulo Souza", email: "pai@ex.com", progresso: {} }),
    vinculos: [{ org: "team-yoda", alunoId: "a1", desde: "2026-11-01T00:00:00.000Z" }], vinculoChaves: ["team-yoda:a1"] };
  await p.fill('input[name="email"]', "pai@ex.com"); await p.fill('input[name="senha"]', "senha-pai-1"); await p.click("#btEnt");
  await esperaTexto(/confirme o link do aluno uma vez/);
  assert(!/O link do aluno mudou/.test(await texto()), "conta antiga não lê que o link mudou");
  await cap("area-03-confirmar");
  const negado = await digital({ httpMethod: "POST", headers: { authorization: "Bearer tk-" + uidPai }, body: JSON.stringify({ acao: "meuLink", org: "team-yoda", alunoId: "a1" }), queryStringParameters: {} });
  assert.strictEqual(negado.statusCode, 409, "sem confirmar, não abre");
  await p.fill('form[id^="fRel"] input[name="link"]', "https://teamyoda.com.br/aluno.html?org=team-yoda&id=a1&t=tA2");
  await p.click('form[id^="fRel"] button[type="submit"]');
  await esperaTexto(/Pronto: a sua conta está ligada/);
  assert(/Meu plano e aulas/.test(await texto()));

  /* 6. servidor: aluno de outra conta e conta da equipe */
  const outro = await digital({ httpMethod: "POST", headers: { authorization: "Bearer tk-" + uidPai }, body: JSON.stringify({ acao: "meuLink", org: "39-ranch", alunoId: "r1" }), queryStringParameters: {} });
  assert.strictEqual(outro.statusCode, 403, "conta não ligada ao aluno não recebe o link");
  await p.click("#btSair"); await esperaTexto(/Sua área no Team Yoda/);
  await p.fill('input[name="email"]', "prof@39.com"); await p.fill('input[name="senha"]', "senha-prof"); await p.click("#btEnt");
  await esperaTexto(/Esta é uma conta de professor/);

  assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
  console.log("smoke-minha-area: ok");
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
