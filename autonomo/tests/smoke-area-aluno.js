/* Área do aluno no navegador (390 px), com as functions reais (cadastro-aluno, aluno-conta, ver-aluno) sobre um Firestore em memória:
   · cadastro: a pessoa escolhe "Sou aluno", cria a conta com o código do professor e cai em "Pedido enviado";
   · o professor (cartão "Área do aluno" no Início do app do treinador) vê o pedido, com o jogador certo já sugerido, e aprova;
   · o aluno passa a ver a área dele (só o próprio plano), com a barra da conta; sair e entrar de novo;
   · "Sou treinador" continua levando ao cadastro do treinador; quem entra no app do treinador com conta de aluno vai para a área dele.
   Rode: node tests/smoke-area-aluno.js [pasta-das-capturas] */
const http = require("http"), fs = require("fs"), path = require("path"), assert = require("assert");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const raiz = path.join(__dirname, ".."), fx = path.join(raiz, "netlify/functions/");
const capturas = process.argv[2] || "";
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("smoke-area-aluno: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }

/* ── Firestore e Auth em memória ── */
const store = {}; const J = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const campo = (o, c) => c.split(".").reduce((x, k) => (x == null ? undefined : x[k]), o);
function docRef(p) { return { id: p.split("/").pop(), async get() { const v = store[p]; return { exists: v !== undefined, id: p.split("/").pop(), data: () => J(v) }; }, async set(v) { store[p] = J(v); }, collection: (n) => colRef(p + "/" + n) }; }
function colRef(p, f = [], lim = 0) {
  return {
    doc: (id) => docRef(p + "/" + id), where: (c, o, v) => colRef(p, f.concat([[c, v]]), lim), limit: (n) => colRef(p, f, n),
    async get() {
      let ks = Object.keys(store).filter((k) => k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/")).filter((k) => f.every(([c, v]) => campo(store[k], c) === v));
      if (lim) ks = ks.slice(0, lim);
      const d = ks.map((k) => ({ id: k.split("/").pop(), ref: docRef(k), data: () => J(store[k]) }));
      return { docs: d, empty: !d.length, size: d.length };
    },
  };
}
const usuarios = { prof1: { uid: "prof1", email: "paulo@x.com", name: "Paulo Lima", senha: "x", claims: { orgId: "org1", role: "coordenador" } } }; let nUid = 0;
const auth = {
  async createUser(d) { if (Object.values(usuarios).some((u) => u.email === d.email)) { const e = new Error("x"); e.code = "auth/email-already-exists"; throw e; } const uid = "aluno" + (++nUid) + "xyz"; usuarios[uid] = { uid, email: d.email, name: d.displayName, senha: d.password, claims: {} }; return usuarios[uid]; },
  async setCustomUserClaims(uid, c) { usuarios[uid].claims = c; },
  async verifyIdToken(t) { const u = usuarios[t]; if (!u) throw new Error("token"); return { uid: u.uid, email: u.email, name: u.name, ...u.claims }; },
};
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin: { firestore: () => ({ collection: (n) => colRef(n) }), auth: () => auth }, app: () => {} } };
const handler = (n) => require(fx + n + ".js").handler;

const plano = { aprovado: true, tipo: "ciclo", prioridade: "Saque e devolução", blocos: [{ nome: "Bloco 1", semanasLista: [{ n: 1, foco: "Saque", aulas: [{ t: "Saque com alvo" }, { t: "Devolução profunda" }] }] }] };
const ALUNOS = [{ id: "j1", nome: "Lia Souza", horarios: [{ dia: 2, hora: "18:00" }], plano, regPlano: {} }, { id: "j2", nome: "Beto Alves", horarios: [], plano, regPlano: {} }];
store["orgs/org1/dados/mty:alunos:v2"] = { value: JSON.stringify(ALUNOS) };
store["orgs/org1/meta/info"] = { nome: "Academia Paulo Lima", plano: "gratis" };

/* app do treinador: só o cartão "Área do aluno", do próprio index.html, em React local */
const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const ms = [...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
const corte = ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
const corpo = ms.slice(0, corte) + 'ReactDOM.createRoot(document.getElementById("root")).render(<div style={{ padding: 16, maxWidth: 420 }}><CartaoAreaAluno alunos={window.__alunos} /></div>);';
const paginaTreinador = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><div id=root></div>
<script src=/__cdn/r.js></script><script src=/__cdn/d.js></script><script src=/__cdn/p.js></script><script src=/__cdn/c.js></script><script src=/__cdn/b.js></script>
<script>window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return ""}};window.mtyAuth={usuario:()=>({uid:"prof1"}),tokenId:async()=>"prof1"};window.__alunos=${JSON.stringify(ALUNOS)};</script>
<script src=/scout/graficos.js></script><script src=/scout/ao-vivo.js></script><script src=/scout/relatorio-jogos.js></script><script src=/scout/movimento-motor.js></script><script src=/scout/evidencias.js></script><script src=/scout/movimento.js></script>
<script type="text/babel">${corpo}</script>`;
const CDNS = { "/__cdn/r.js": "/react-18.3.1/package/umd/react.development.js", "/__cdn/d.js": "/react-dom-18.3.1/package/umd/react-dom.development.js", "/__cdn/p.js": "/prop-types-15.8.1/package/prop-types.min.js", "/__cdn/c.js": "/recharts-2.15.4/package/umd/Recharts.js", "/__cdn/b.js": "/babel-standalone-7.29.9/package/babel.min.js" };

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp" };
const servidor = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  let corpoReq = ""; req.on("data", (d) => (corpoReq += d));
  await new Promise((r) => req.on("end", r));
  if (u.pathname === "/__treinador") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return res.end(paginaTreinador); }
  if (CDNS[u.pathname]) { res.writeHead(200, { "content-type": "text/javascript" }); return res.end(fs.readFileSync(CDN + CDNS[u.pathname])); }
  if (u.pathname === "/__login") { const b = JSON.parse(corpoReq || "{}"); const x = Object.values(usuarios).find((v) => v.email === b.email && v.senha === b.senha); res.writeHead(x ? 200 : 401, { "content-type": "application/json" }); return res.end(JSON.stringify(x ? { uid: x.uid, email: x.email, name: x.name } : { erro: "x" })); }
  if (u.pathname.startsWith("/.netlify/functions/")) {
    try {
      const r = await handler(u.pathname.split("/").pop())({ httpMethod: req.method, headers: req.headers, body: corpoReq || null, queryStringParameters: Object.fromEntries(u.searchParams) });
      res.writeHead(r.statusCode, r.headers || { "content-type": "application/json" }); return res.end(r.body);
    } catch (e) { res.writeHead(500); return res.end(JSON.stringify({ erro: String(e.message) })); }
  }
  let f = path.join(raiz, decodeURIComponent(u.pathname === "/aluno" ? "/aluno.html" : u.pathname)); if (u.pathname.endsWith("/")) f = path.join(f, "index.html");
  if (!f.startsWith(raiz) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end("não encontrado"); }
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); res.end(fs.readFileSync(f));
});
/* Firebase de mentira no navegador: a sessão fica no localStorage (sobrevive a recarregar e trocar de página), o token é o uid */
const FIREBASE_STUB = `(function(){var cbs=[];function ler(){try{return JSON.parse(localStorage.getItem("__usr")||"null")}catch(e){return null}}
function usr(x){return x?{uid:x.uid,email:x.email,displayName:x.name,getIdToken:function(){return Promise.resolve(x.uid)},getIdTokenResult:function(){return Promise.resolve({claims:x.claims||{}})}}:null}
var a={get currentUser(){return usr(ler())},onAuthStateChanged:function(cb){cbs.push(cb);setTimeout(function(){cb(a.currentUser)},0);return function(){cbs=cbs.filter(function(c){return c!==cb})}},
signInWithEmailAndPassword:function(e,s){return fetch("/__login",{method:"POST",body:JSON.stringify({email:e,senha:s})}).then(function(r){if(!r.ok){var er=new Error("x");er.code="auth/wrong-password";throw er}return r.json()}).then(function(x){localStorage.setItem("__usr",JSON.stringify(x));cbs.forEach(function(c){c(a.currentUser)})})},
signOut:function(){localStorage.removeItem("__usr");cbs.forEach(function(c){c(null)});return Promise.resolve()},sendPasswordResetEmail:function(){return Promise.resolve()}};
window.firebase={apps:[],initializeApp:function(){this.apps.push({})},auth:function(){return a},firestore:function(){return {}}};})();`;

(async () => {
  await new Promise((r) => servidor.listen(0, r));
  const base = "http://localhost:" + servidor.address().port;
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const erros = [];
  const novo = async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    await ctx.route("https://www.gstatic.com/firebasejs/**", (r) => r.fulfill({ contentType: "text/javascript", body: r.request().url().includes("app-compat") ? FIREBASE_STUB : "" }));
    const p = await ctx.newPage();
    p.on("pageerror", (e) => erros.push(e.message)); p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|status of 40\d/.test(m.text())) erros.push(m.text()); });
    return p;
  };
  const cap = async (p, nome) => { if (capturas) await p.screenshot({ path: path.join(capturas, nome + ".png"), fullPage: true }); };
  const txt = (p) => p.evaluate(() => document.body.innerText);

  /* professor: código no cartão do Início */
  const pt = await novo();
  await pt.goto(base + "/__treinador");
  await pt.waitForSelector("[data-area-aluno]", { timeout: 120000 });
  await pt.click("[data-area-aluno] > button");
  await pt.waitForFunction(() => /^[A-Z0-9]{8}$/.test((document.querySelector("[data-codigo-professor]") || {}).textContent || ""));
  const codigo = (await pt.textContent("[data-codigo-professor]")).trim();
  assert(/quadralab\.com\.br\/aluno/.test(decodeURIComponent(await pt.getAttribute("[data-area-aluno] a[href*='wa.me']", "href"))) && (await txt(pt)).includes(codigo), "instruções com o endereço e o código");

  /* aluno: cadastro escolhendo "Sou aluno" */
  const pa = await novo();
  await pa.goto(base + "/cadastro-individual.html");
  await pa.waitForSelector("[data-papel=aluno]");
  assert(/Você é treinador ou aluno\?/.test(await txt(pa)), "cadastro pergunta o papel");
  await cap(pa, "aluno-01-escolha");
  await pa.click("[data-papel=treinador]"); assert(/Grátis para até 5 jogadores/.test(await txt(pa)), "Sou treinador: cadastro do treinador");
  await pa.click("#btTrocar"); await pa.waitForSelector("#codigo");
  await pa.fill("#nome", "Lia Souza"); await pa.fill("#email", "lia@x.com"); await pa.fill("#senha", "segredo123"); await pa.fill("#codigo", codigo);
  await cap(pa, "aluno-02-cadastro");
  await pa.click("#btEnviar");
  await pa.waitForURL(/aluno\.html/); await pa.waitForFunction(() => /Pedido enviado/.test(document.body.innerText), null, { timeout: 15000 });
  assert(/Paulo Lima/.test(await txt(pa)) && !/Saque com alvo/.test(await txt(pa)), "aguardando: nada da academia ainda");
  await cap(pa, "aluno-03-pedido-enviado");

  /* professor aprova (o jogador certo já vem sugerido) */
  await pt.reload(); await pt.waitForSelector("[data-pedido-aluno]", { timeout: 20000 });
  assert.strictEqual(await pt.$eval("[data-pedido-aluno] select", (s) => s.value), "j1", "Lia sugerida pelo nome");
  await cap(pt, "treinador-01-pedido");
  await pt.click("[data-pedido-aluno] button:has-text('Aprovar')");
  await pt.waitForFunction(() => /já vê a área dele/.test(document.body.innerText));
  assert(/Lia Souza · lia@x.com/.test(await txt(pt)), "aluno com conta na lista");
  await cap(pt, "treinador-02-aprovado");

  /* aluno: a área abre com o plano dele, sem nada de outro jogador */
  await pa.reload(); await pa.waitForFunction(() => /Saque com alvo/.test(document.body.innerText), null, { timeout: 15000 });
  let t = await txt(pa);
  assert(/Lia Souza/.test(t) && /lia@x\.com/.test(t) && !/Beto/.test(t), "área do aluno só com os dados dele");
  await cap(pa, "aluno-04-area");

  /* sair e entrar de novo */
  await pa.click("[data-conta=sair]"); await pa.waitForSelector("#fEntrar");
  await pa.fill("#aEmail", "lia@x.com"); await pa.fill("#aSenha", "errada"); await pa.click("#aEntrar");
  await pa.waitForFunction(() => /não conferem/.test(document.body.innerText));
  await pa.fill("#aSenha", "segredo123"); await pa.click("#aEntrar");
  await pa.waitForFunction(() => /Saque com alvo/.test(document.body.innerText), null, { timeout: 15000 });
  await cap(pa, "aluno-05-entrar-de-novo");

  /* /aluno também abre a área; conta de treinador ali é mandada para o app do treinador */
  await pa.goto(base + "/aluno"); await pa.waitForFunction(() => /Saque com alvo/.test(document.body.innerText), null, { timeout: 15000 });
  await pa.evaluate(() => localStorage.setItem("__usr", JSON.stringify({ uid: "prof1", email: "paulo@x.com", name: "Paulo Lima", claims: { orgId: "org1" } })));
  await pa.reload(); await pa.waitForFunction(() => /Esta é uma conta de treinador/.test(document.body.innerText), null, { timeout: 15000 });

  /* professor desvincula: a área do aluno volta para o código */
  pt.once("dialog", (d) => d.accept());
  await pt.click("[data-area-aluno] button:has-text('Desvincular')");
  await pt.waitForFunction(() => /Conta desvinculada/.test(document.body.innerText));
  const uidLia = Object.values(usuarios).find((x) => x.email === "lia@x.com").uid;
  await pa.evaluate((u) => localStorage.setItem("__usr", JSON.stringify({ uid: u, email: "lia@x.com", name: "Lia Souza", claims: { tipo: "aluno" } })), uidLia);
  await pa.reload(); await pa.waitForFunction(() => /foi encerrado/.test(document.body.innerText) && !!document.getElementById("aCodigo"), null, { timeout: 15000 });

  const larg = await pa.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  assert(larg, "sem rolagem lateral no celular");
  assert.deepStrictEqual(erros.filter((e) => !/Download the React DevTools|in-browser Babel transformer|\[BABEL\] Note/.test(e)), [], "erros de JS: " + erros.join(" | "));
  console.log("smoke-area-aluno: ok");
  await browser.close(); servidor.close();
})().catch((e) => { console.error(e); servidor.close(); process.exit(1); });
