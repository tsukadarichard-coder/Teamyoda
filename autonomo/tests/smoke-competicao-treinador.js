/* Atletas do QuadraLab Competição no app do treinador (etapa 1), no navegador (390 px), com a function real scout-ao-vivo sobre um
   Firestore em memória:
   · plano grátis: o cartão aparece com cadeado e oferece o Essencial; o jogo ao vivo diz que ligar ao app do atleta é do Essencial;
   · Essencial: o atleta vinculado aparece "para ligar à ficha"; ligar grava aluno.competicao; o jogo ao vivo da ficha ligada já vem
     com o atleta escolhido. Rode: node tests/smoke-competicao-treinador.js [pasta-das-capturas] */
const http = require("http"), fs = require("fs"), path = require("path"), assert = require("assert");
const AULAS_MES_JS=require("fs").readFileSync(require("path").join(__dirname,"../../mty/aulas-mes.js"),"utf8");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const raiz = path.join(__dirname, ".."), fx = path.join(raiz, "netlify/functions/");
const capturas = process.argv[2] || "";
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("smoke-competicao-treinador: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }

const store = {}; const J = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const campo = (o, c) => c.split(".").reduce((x, k) => (x == null ? undefined : x[k]), o);
function docRef(p) { return { id: p.split("/").pop(), async get() { const v = store[p]; return { exists: v !== undefined, id: p.split("/").pop(), data: () => J(v) }; }, async set(v) { store[p] = J(v); }, async update(v) { Object.assign(store[p], J(v)); }, async delete() { delete store[p]; }, collection: (n) => colRef(p + "/" + n) }; }
let seq = 0;
function colRef(p, f = [], lim = 0) {
  return {
    doc: (id) => docRef(p + "/" + id), where: (c, o, v) => colRef(p, f.concat([[c, v]]), lim), limit: (n) => colRef(p, f, n),
    async add(v) { const id = "d" + (++seq); store[p + "/" + id] = J(v); return docRef(p + "/" + id); },
    async get() {
      let ks = Object.keys(store).filter((k) => k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/")).filter((k) => f.every(([c, v]) => campo(store[k], c) === v));
      if (lim) ks = ks.slice(0, lim);
      const d = ks.map((k) => ({ id: k.split("/").pop(), ref: docRef(k), data: () => J(store[k]) }));
      return { docs: d, empty: !d.length, size: d.length, forEach: (g) => d.forEach(g) };
    },
  };
}
const auth = { async verifyIdToken(t) { if (t !== "prof1") throw new Error("token"); return { uid: "prof1", email: "paulo@x.com", name: "Paulo Lima", orgId: "org1" }; } };
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin: { firestore: () => ({ collection: (n) => colRef(n) }), auth: () => auth }, app: () => {} } };
const handler = (n) => require(fx + n + ".js").handler;
store["vinculos/v1"] = { atletaUid: "at1", atletaNome: "Lia Souza", tipo: "treinador", origem: "academia", orgId: "org1", status: "ativo", areas: ["perfil", "temporada", "partidas"], pessoaUid: "prof1" };

const ALUNOS = [{ id: "j1", nome: "Lia Souza", horarios: [] }, { id: "j2", nome: "Beto Alves", horarios: [] }];
const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const ms = [...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
const corte = ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
const corpo = ms.slice(0, corte) + `function Host() {
  const [alunos, setAlunos] = useState(window.__alunos); window.__lista = alunos;
  return <div style={{ padding: 16, maxWidth: 420 }}><CartaoVinculoAcademia alunos={alunos} setAlunos={setAlunos} planoAtual={window.__plano} />
    <CartaoAoVivo aluno={alunos[0]} cfg={{}} pontos={[]} placar={{}} mental={{}} aoVivo={null} setAoVivo={() => {}} estado="" setEstado={() => {}} /></div>;
}
ReactDOM.createRoot(document.getElementById("root")).render(<Host />);`;
const pagina = (plano, alunos) => `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><div id=root></div>
<script src=/__cdn/r.js></script><script src=/__cdn/d.js></script><script src=/__cdn/p.js></script><script src=/__cdn/c.js></script><script src=/__cdn/b.js></script><script>${AULAS_MES_JS}</script>
<script>window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return ""}};window.mtyAuth={usuario:()=>({uid:"prof1"}),tokenId:async()=>"prof1"};window.__plano=${JSON.stringify(plano)};window.__alunos=${JSON.stringify(alunos)};</script>
<script src=/scout/graficos.js></script><script src=/scout/ao-vivo.js></script><script src=/scout/relatorio-jogos.js></script><script src=/scout/movimento-motor.js></script><script src=/scout/evidencias.js></script><script src=/scout/movimento.js></script>
<script type="text/babel">${corpo}</script>`;
const CDNS = { "/__cdn/r.js": "/react-18.3.1/package/umd/react.development.js", "/__cdn/d.js": "/react-dom-18.3.1/package/umd/react-dom.development.js", "/__cdn/p.js": "/prop-types-15.8.1/package/prop-types.min.js", "/__cdn/c.js": "/recharts-2.15.4/package/umd/Recharts.js", "/__cdn/b.js": "/babel-standalone-7.29.9/package/babel.min.js" };
let paginaAtual = "";
const servidor = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  let corpoReq = ""; req.on("data", (d) => (corpoReq += d)); await new Promise((r) => req.on("end", r));
  if (u.pathname === "/__t") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return res.end(paginaAtual); }
  if (CDNS[u.pathname]) { res.writeHead(200, { "content-type": "text/javascript" }); return res.end(fs.readFileSync(CDN + CDNS[u.pathname])); }
  if (u.pathname.startsWith("/.netlify/functions/")) {
    try { const r = await handler(u.pathname.split("/").pop())({ httpMethod: req.method, headers: req.headers, body: corpoReq || null, queryStringParameters: Object.fromEntries(u.searchParams) }); res.writeHead(r.statusCode, r.headers || {}); return res.end(r.body); }
    catch (e) { res.writeHead(500); return res.end(JSON.stringify({ erro: String(e.message) })); }
  }
  const f = path.join(raiz, decodeURIComponent(u.pathname));
  if (!f.startsWith(raiz) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(""); }
  res.writeHead(200, { "content-type": f.endsWith(".js") ? "text/javascript" : "application/octet-stream" }); res.end(fs.readFileSync(f));
});

(async () => {
  await new Promise((r) => servidor.listen(0, r));
  const base = "http://localhost:" + servidor.address().port;
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const erros = []; p.on("pageerror", (e) => erros.push(e.message));
  const cap = async (n) => { if (capturas) await p.screenshot({ path: path.join(capturas, n + ".png"), fullPage: true }); };
  const abrir = async (plano, alunos) => { paginaAtual = pagina(plano, alunos); await p.goto(base + "/__t"); await p.waitForSelector("[data-vinculo-academia]", { timeout: 120000 }); };

  /* grátis: cadeado no cartão e no jogo ao vivo */
  store["orgs/org1/meta/info"] = { plano: "gratis" };
  await abrir("gratis", ALUNOS);
  assert.strictEqual(await p.locator("[data-vinculo-academia] [data-cadeado=essencial]").count(), 1, "cadeado Essencial no cartão");
  await p.click("[data-vinculo-academia] > button"); await p.waitForSelector("[data-competicao-bloqueado]");
  let t = await p.evaluate(() => document.body.innerText);
  assert(/Assinar Plano Essencial/.test(t) && !/data-codigo-academia/.test(t), "grátis: oferece o Essencial");
  await p.waitForSelector("[data-ao-vivo-cadeado]", { timeout: 15000 });
  await cap("competicao-01-gratis");

  /* Essencial: liga o atleta à ficha */
  store["orgs/org1/meta/info"] = { plano: "essencial" };
  await abrir("essencial", ALUNOS);
  await p.waitForSelector("[data-atletas-sem-ficha]", { timeout: 15000 });
  assert.strictEqual(await p.locator("[data-vinculo-academia] [data-cadeado]").count(), 0, "Essencial sem cadeado");
  await p.click("[data-vinculo-academia] > button"); await p.waitForSelector("[data-atleta-competicao]");
  await p.waitForFunction(() => /^[A-Z0-9]{8}$/.test((document.querySelector("[data-codigo-academia]") || {}).textContent || ""));
  await cap("competicao-02-essencial-ligar");
  await p.selectOption("[data-atleta-competicao] select", "j1");
  await p.waitForFunction(() => window.__lista[0].competicao && window.__lista[0].competicao.vinculoId === "v1");
  assert.strictEqual(await p.locator("[data-atletas-sem-ficha]").count(), 0, "ligado: some o aviso");
  await cap("competicao-03-ligado");

  /* a ficha ligada: o jogo ao vivo já vem com o atleta escolhido */
  await abrir("essencial", [{ ...ALUNOS[0], competicao: { vinculoId: "v1", nome: "Lia Souza" } }, ALUNOS[1]]);
  await p.waitForFunction(() => { const s = [...document.querySelectorAll("select")].find((x) => [...x.options].some((o) => /Só gerar o link/.test(o.textContent))); return s && s.value === "v1"; }, null, { timeout: 15000 });
  assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
  console.log("smoke-competicao-treinador: ok");
  await browser.close(); servidor.close();
})().catch((e) => { console.error(e); servidor.close(); process.exit(1); });
