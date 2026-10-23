/* Convites com passo a passo: o atleta gera o convite na Competição e a mensagem do WhatsApp leva link, conta, papel, código e atalho na tela;
   o treinador da academia envia o código com as mesmas instruções. Rode: node tests/smoke-convite-instrucoes.js */
const http = require("http"), fs = require("fs"), path = require("path"), assert = require("assert");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("smoke-convite-instrucoes: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
const raiz = path.join(__dirname, ".."), fx = path.join(raiz, "netlify/functions/");
const store = {}; let seq = 0; const J = (v) => JSON.parse(JSON.stringify(v));
function merge(a, b) { const o = { ...a }; for (const k of Object.keys(b)) o[k] = b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) ? merge(a[k] || {}, b[k]) : b[k]; return o; }
function docRef(p) { return { id: p.split("/").pop(), async get() { const v = store[p]; return { exists: v !== undefined, id: p.split("/").pop(), ref: docRef(p), data: () => J(v) }; }, async set(v, o) { store[p] = o && o.merge ? merge(store[p] || {}, J(v)) : J(v); }, async update(v) { Object.assign(store[p], J(v)); }, async delete() { delete store[p]; }, collection: (s) => colRef(p + "/" + s) }; }
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
const USUARIOS = {
  "t-carla": { uid: "carlaprof01", email: "carla@exemplo.com", name: "Carla", orgId: "carla-org" },
  "t-gil": { uid: "gilprof0001", email: "gil@exemplo.com", name: "Gil", orgId: "gil-org" },
  "t-ana": { uid: "anajogadora", email: "ana@exemplo.com", name: "Ana" },
  "t-mae": { uid: "maeresp0001", email: "marta@exemplo.com", name: "Marta" },
};
const admin = { firestore: () => ({ collection: (n) => colRef(n) }), auth: () => ({ verifyIdToken: async (t) => { if (!USUARIOS[t]) throw new Error("x"); return USUARIOS[t]; } }) };
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin, app: () => {} } };

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".webp": "image/webp", ".png": "image/png", ".json": "application/json", ".svg": "image/svg+xml", ".jpg": "image/jpeg" };
const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const ms = [...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
const corte = ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
const corpoTreinador = ms.slice(0, corte) + `
function Host2(){ return <div style={{padding:16,maxWidth:420}}><CartaoVinculoAcademia /></div>; }
window.__msg = mensagemCodigoAcademia;
function HostOrig(){ const [aba,setAba]=useState(location.hash==="#pedidos"?"hubPedidos":"hubPerfil"); window.__aba=setAba;
 return <div style={{padding:"16px",maxWidth:760}}>{aba==="hubPerfil"?<TelaPerfilProfissional planoAtual={window.__plano} planoVencido={false} emailAtual="carla@exemplo.com" aoAbrirPedidos={()=>setAba("hubPedidos")}/>:<TelaPedidosAtendimento aoAbrirPerfil={()=>setAba("hubPerfil")}/>}</div>; }
ReactDOM.createRoot(document.getElementById("root")).render(<Host2 />);`;
const paginaTreinador = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><div id=root></div><script src=/r.js></script><script src=/d.js></script><script src=/p.js></script><script src=/c.js></script><script src=/b.js></script>
<script>window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return ""}};window.mtyAuth={usuario:()=>({uid:"x",email:"carla@exemplo.com"}),tokenId:async()=>window.__TOKEN};</script>
<script src=/scout/graficos.js></script><script src=/scout/ao-vivo.js></script><script src=/scout/relatorio-jogos.js></script><script src=/scout/movimento-motor.js></script><script src=/metodo/metodo-proprio.js></script><script src=/scout/evidencias.js></script><script src=/scout/movimento.js></script><script src=/scout/video-segmentador.js></script><script src=/scout/video-jogo.js></script>
<script type="text/babel">${corpoTreinador}</script>`;
const CDNMAP = { "/r.js": CDN + "/react-18.3.1/package/umd/react.development.js", "/d.js": CDN + "/react-dom-18.3.1/package/umd/react-dom.development.js", "/p.js": CDN + "/prop-types-15.8.1/package/prop-types.min.js", "/c.js": CDN + "/recharts-2.15.4/package/umd/Recharts.js", "/b.js": CDN + "/babel-standalone-7.29.9/package/babel.min.js" };

const servidor = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/__treinador") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return res.end(paginaTreinador); }
  if (CDNMAP[u.pathname]) { res.writeHead(200, { "content-type": "text/javascript" }); return res.end(fs.readFileSync(CDNMAP[u.pathname])); }
  if (u.pathname.startsWith("/.netlify/functions/")) {
    const nome = u.pathname.split("/").pop(); let corpo = ""; req.on("data", (d) => (corpo += d));
    req.on("end", async () => {
      try {
        const r = await require(fx + nome + ".js").handler({ httpMethod: req.method, headers: req.headers, body: corpo || null, queryStringParameters: Object.fromEntries(u.searchParams) });
        res.writeHead(r.statusCode, r.headers || { "content-type": "application/json" }); res.end(r.isBase64Encoded ? Buffer.from(r.body, "base64") : r.body);
      } catch (e) { res.writeHead(500); res.end(JSON.stringify({ erro: String(e.message) })); }
    });
    return;
  }
  let f = path.join(raiz, decodeURIComponent(u.pathname)); if (u.pathname.endsWith("/")) f = path.join(f, "index.html");
  if (!f.startsWith(raiz) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end("não encontrado"); }
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); res.end(fs.readFileSync(f));
});
const stubFirebase = (tok, uid, email) => `(function(){var cbs=[],u={uid:"${uid}",email:"${email}",displayName:"",getIdToken:function(){return Promise.resolve("${tok}")}},a={currentUser:u,languageCode:"",onAuthStateChanged:function(cb){cbs.push(cb);setTimeout(function(){cb(a.currentUser)},0)},signOut:function(){a.currentUser=null;cbs.forEach(function(c){c(null)});return Promise.resolve()}};window.firebase={initializeApp:function(){},auth:function(){return a}};})();`;


(async () => {
  const ano = +new Date().toISOString().slice(0, 4);
  store["jogadores/anajogadora"] = { nome: "Ana Lima", email: "ana@exemplo.com", criadoEm: "2026-09-01T10:00:00Z", competicao: { ativo: true, papel: "atleta", nascimento: (ano - 15) + "-02-02" } };
  await new Promise((r) => servidor.listen(0, r));
  const base = "http://localhost:" + servidor.address().port;
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const erros = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["clipboard-read", "clipboard-write"] });
  await ctx.route("https://www.gstatic.com/firebasejs/**", (r) => r.fulfill({ contentType: "text/javascript", body: r.request().url().includes("app-compat") ? stubFirebase("t-ana", "anajogadora", "ana@exemplo.com") : "" }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const pg = await ctx.newPage(); pg.on("pageerror", (e) => erros.push(e.message));
  await pg.goto(base + "/competicao/#/inicio"); await pg.waitForSelector("#fConvite", { state: "attached", timeout: 15000 });
  await pg.click('[data-conv="mae"]'); await pg.click("#btGerarConvite");
  await pg.waitForSelector(".comp-codigo", { timeout: 10000 });
  const codigo = (await pg.textContent(".comp-codigo")).trim();
  const href = await pg.getAttribute('.convite-aberto a[href^="https://wa.me/"]', "href");
  const msg = decodeURIComponent(href.split("text=")[1]);
  for (const x of ["https://quadralab.com.br/competicao/#/criar", "Safari", "Chrome", "Criar minha conta grátis", "QuadraLab Player", "Qual é o seu papel?", "Responsável", "Entrar na equipe de um atleta", codigo, "Usar código", "Adicionar à Tela de Início", "Instalar app", "só pode ser usado uma vez"])
    assert.ok(msg.includes(x), "mensagem do convite traz: " + x + "\n" + msg);
  assert.ok(msg.includes("Aqui é Ana"), "assinada com o primeiro nome");
  await pg.click('button:has-text("Copiar mensagem com as instruções")');
  await pg.waitForFunction(() => /Mensagem com as instruções copiada/.test(document.body.innerText));
  assert.strictEqual(await pg.evaluate(() => navigator.clipboard.readText()), msg, "copiar leva a mesma mensagem");
  await pg.click('summary:has-text("O que a pessoa precisa fazer")');
  const lista = await pg.textContent(".convite-aberto details");
  assert.ok(lista.includes("Adicionar à Tela de Início") && lista.includes(codigo));
  await pg.locator(".convite-aberto").screenshot({ path: path.join(__dirname, "capturas-hub", "15-convite-instrucoes.png") });
  /* treinador da academia */
  const tr = await browser.newPage({ viewport: { width: 390, height: 900 } }); tr.on("pageerror", (e) => erros.push(e.message));
  await tr.addInitScript(() => { window.__TOKEN = "t-carla"; });
  store["orgs/carla-org/meta/info"] = { nome: "Academia", plano: "essencial" };
  await tr.goto(base + "/__treinador"); await tr.waitForSelector("[data-vinculo-academia]", { timeout: 120000 });
  await tr.click("[data-vinculo-academia] button"); await tr.waitForSelector("[data-enviar-instrucoes]", { timeout: 10000 });
  const cod = (await tr.textContent("[data-codigo-academia]")).trim();
  const m2 = decodeURIComponent((await tr.getAttribute("[data-enviar-instrucoes]", "href")).split("text=")[1]);
  for (const x of ["https://quadralab.com.br/competicao/#/criar", "Criar minha conta grátis", "Atleta", "Tenho o código do meu treinador", cod, "Vincular ao treinador", "Adicionar à Tela de Início", "Instalar app"])
    assert.ok(m2.includes(x), "mensagem da academia traz: " + x);
  await tr.locator("[data-vinculo-academia]").screenshot({ path: path.join(__dirname, "capturas-hub", "16-codigo-academia.png") });
  assert.deepStrictEqual(erros, [], "erros de JavaScript");
  console.log("smoke-convite-instrucoes: ok");
  await browser.close(); servidor.close();
})().catch((e) => { console.error(e); process.exit(1); });
