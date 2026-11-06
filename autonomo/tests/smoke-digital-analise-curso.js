/* Team Yoda · análise de movimento › "Usar nos cursos" (UsarNosCursosDigital do index.html de verdade + digital-ilustracao.js), com a
   function real digital.js sobre um Firestore em memória: lista as análises, monta a sequência das 6 fases com as fotos guardadas
   (com e sem esqueleto), escolhe sozinha a aula do golpe, exige a autorização de imagem e coloca a imagem na aula (GET ?img serve).
   Rode: node tests/smoke-digital-analise-curso.js [pasta-das-capturas] (defina CDN_DIR) */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("smoke-digital-analise-curso: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const capturas = process.argv[2] || "";
const raiz = path.join(__dirname, "../../mty"), fx = path.join(__dirname, "../../netlify/functions/");
/* poses de referência do backhand (unidades do corpo) levadas para o quadro da foto (0–1), em cima do atleta */
const B = require(path.join(raiz, "scout/movimento-motor.js"));
const POSES = B.modeloPadrao("backhand", "2").map((p) => { const o = []; for (let i = 0; i < 33; i++) o.push(p[i] ? [Math.round((0.47 + p[i].x * 0.15) * 1000) / 1000, Math.round((0.61 + (p[i].y - 0.16) * 0.22) * 1000) / 1000] : null); return o; });

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
const admin = { firestore: () => ({ collection: (n) => colRef(n) }), auth: () => ({ verifyIdToken: async (t) => { if (t !== "coord") throw new Error("x"); return { uid: "c1", orgId: "team-yoda", role: "coordenador", email: "coord@ty.com" }; } }) };
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin, app: () => {} } };
const digital = require(fx + "digital.js").handler;
store["digitalContas/u1"] = { nome: "Carlos Fora", email: "carlos@x.com", criadoEm: "2026-11-01T10:00:00Z", vinculos: [], vinculoChaves: [], progresso: {} };
store["orgs/team-yoda/dados/mty:alunos:v2"] = { value: "[]" };

const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const ms = [...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
const corpo = ms.slice(0, ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);')) + `
window.mtyAuth={tokenId:()=>Promise.resolve("coord"),usuario:()=>({uid:"c1",email:"coord@ty.com"})};
window.QLMovArquivo = window.QLMovArquivo || {};
window.__arquivoMov = { ler: (id) => id === "mv-sem-fotos" ? Promise.resolve({ id, fotos: [], resultado: { fases: [] } }) : window.__fazArq(id) };
ReactDOM.createRoot(document.getElementById("root")).render(<div style={{padding:12}}><UsarNosCursosDigital aluno={{ id: "a1", nome: "Pedro Lima" }} movimentos={window.__MOVS} /></div>);`;
const pagina = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><div id=root></div><script src=/r.js></script><script src=/d.js></script><script src=/p.js></script><script src=/c.js></script><script src=/b.js></script>
<script>window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return ""}};</script>
<script src=/scout/graficos.js></script><script src=/scout/ao-vivo.js></script><script src=/scout/relatorio-jogos.js></script><script src=/scout/movimento-motor.js></script><script src=/scout/evidencias.js></script><script src=/scout/movimento.js></script><script src=/scout/video-segmentador.js></script><script src=/scout/video-jogo.js></script>
<script src=/digital-ilustracao.js></script><script src=/plano-equipe.js></script><script src=/equipe-rendimento.js></script><script src=/aulas-mes.js></script>
<script>
window.__MOVS = [{ id: "mv1", golpe: "backhand", emp: "2", criadoEm: "2026-11-02T10:00:00Z", res: { ok: 9, atencao: 2 } }, { id: "mv-sem-fotos", golpe: "forehand", criadoEm: "2026-10-20T10:00:00Z", res: { ok: 6, atencao: 5 } }];
window.__POSES = ${JSON.stringify(POSES)};
window.__fazArq = (id) => new Promise((ok) => { const im = new Image(); im.onload = () => {
  const fotos = window.__POSES.map((p, i) => { const c = document.createElement("canvas"); c.width = 560; c.height = Math.round(560 * im.naturalHeight / im.naturalWidth); const x = c.getContext("2d");
    x.drawImage(im, 0, 0, c.width, c.height); x.fillStyle = "rgba(0,0,0,.55)"; x.fillRect(0, 0, 150 * 560 / 480, 26 * 560 / 480); x.fillStyle = "#fff"; x.font = "bold 17px sans-serif"; x.fillText((i + 1) + ". Fase", 9, 21); return c.toDataURL("image/jpeg", 0.8); });
  ok({ id, golpe: "backhand", emp: "2", fotos, resultado: { nomes: ["Preparação", "Giro", "Descida", "Contato", "Terminação", "Recuperação"], fases: window.__POSES.map((pose, i) => ({ nome: "F" + i, pose })) } }); }; im.src = "/assets/foto-forehand.jpg"; });
</script>
<script type="text/babel">${corpo}</script>`;
const CDNS = { "/r.js": CDN + "/react-18.3.1/package/umd/react.development.js", "/d.js": CDN + "/react-dom-18.3.1/package/umd/react-dom.development.js", "/p.js": CDN + "/prop-types-15.8.1/package/prop-types.min.js", "/c.js": CDN + "/recharts-2.15.4/package/umd/Recharts.js", "/b.js": CDN + "/babel-standalone-7.29.9/package/babel.min.js" };
const srv = http.createServer((q, r) => {
  const u = new URL(q.url, "http://x");
  let b = ""; q.on("data", (d) => (b += d));
  q.on("end", async () => {
    if (u.pathname === "/.netlify/functions/digital") { const x = await digital({ httpMethod: q.method, headers: q.headers, body: b || null, queryStringParameters: Object.fromEntries(u.searchParams) }); r.writeHead(x.statusCode, x.headers); return r.end(x.isBase64Encoded ? Buffer.from(x.body, "base64") : x.body); }
    if (u.pathname === "/analise") { r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return r.end(pagina); }
    if (CDNS[u.pathname]) { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(fs.readFileSync(CDNS[u.pathname])); }
    const f = path.join(raiz, decodeURIComponent(u.pathname));
    if (f.startsWith(raiz) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { "content-type": /\.svg$/.test(f) ? "image/svg+xml" : /\.png$/.test(f) ? "image/png" : /\.jpe?g$/.test(f) ? "image/jpeg" : "text/javascript" }); return r.end(fs.readFileSync(f)); }
    r.writeHead(404); r.end();
  });
}).listen(0);
const base = "http://localhost:" + srv.address().port;

(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route(/^https?:\/\/(?!localhost)/, (rota) => rota.fulfill({ contentType: "text/plain", body: "" }));
  const p = await ctx.newPage(), erros = [];
  p.on("pageerror", (e) => erros.push(e.message));
  await p.goto(base + "/analise");
  await p.waitForSelector("[data-usar-cursos] >> text=Backhand de duas mãos · 02/11/2026", { timeout: 60000 });
  /* análise guardada sem fotos: avisa */
  await p.click("[data-usar-cursos] button:has-text('Usar nos cursos') >> nth=1");
  await p.waitForSelector("[data-usar-msg] >> text=sem as fotos das fases");
  await p.click("[data-usar-cursos] button:has-text('Fechar')");
  /* análise do backhand: prévia, aula do golpe escolhida sozinha, botão só com a autorização */
  await p.click("[data-usar-cursos] button:has-text('Usar nos cursos') >> nth=0");
  await p.waitForFunction(() => { const i = document.querySelector("img[data-previa]"); return i && i.complete && i.naturalWidth === 1200; }, null, { timeout: 30000 });
  assert.strictEqual(await p.inputValue("[data-destino]"), "cmty-tecnica|cmty-tec-03", "aula do backhand de duas mãos escolhida");
  assert(await p.isDisabled("button:has-text('Colocar na aula')"), "sem a autorização não envia");
  const semEsq = await p.getAttribute("img[data-previa]", "src");
  await p.check("[data-esqueleto]");
  await p.waitForFunction((a) => { const i = document.querySelector("img[data-previa]"); return i && i.src !== a && i.naturalWidth === 1200; }, semEsq);
  const comEsq = await p.getAttribute("img[data-previa]", "src");
  assert(comEsq.length < 650000 + 30, "imagem cabe no documento");
  if (capturas) { fs.writeFileSync(path.join(capturas, "fases-analise-sem-esqueleto.jpg"), Buffer.from(semEsq.split(",")[1], "base64")); fs.writeFileSync(path.join(capturas, "fases-analise-com-esqueleto.jpg"), Buffer.from(comEsq.split(",")[1], "base64")); }
  await p.check("[data-autorizado]");
  await p.click("button:has-text('Colocar na aula')");
  await p.waitForSelector("[data-usar-ok], [data-usar-msg]"); const fimMsg = await p.textContent("[data-usar-ok], [data-usar-msg]"); assert(/Backhand de duas mãos/.test(fimMsg), fimMsg);
  const aula = store["digitalConteudo/academia"].trilhas.find((t) => t.id === "cmty-tecnica").aulas.find((a) => a.id === "cmty-tec-03");
  assert(/^img:[a-z0-9]{24}$/.test(aula.imagens[0]), "a aula aponta para a imagem");
  const id = aula.imagens[0].slice(4), doc = store["digitalImagens/" + id];
  assert(doc && doc.dados.length > 20000 && doc.autorizadoPor === "coord@ty.com" && doc.origem.analiseId === "mv1" && doc.origem.alunoId === "a1");
  assert.strictEqual(Buffer.from(doc.dados, "base64").slice(0, 2).toString("hex"), "ffd8", "JPEG");
  /* a imagem é servida pela function */
  assert.strictEqual(await p.evaluate(async (u) => { const im = new Image(); im.src = u; await im.decode(); return im.naturalWidth; }, "/.netlify/functions/digital?img=" + id), 1200);
  if (capturas) await p.screenshot({ path: path.join(capturas, "usar-nos-cursos.png"), fullPage: true });
  assert.deepStrictEqual(erros, []);
  await b.close(); srv.close();
  console.log("smoke-digital-analise-curso: ok");
})().catch((e) => { console.error(e); process.exit(1); });
