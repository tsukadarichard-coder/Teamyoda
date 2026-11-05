/* Canal da turma e do aluno, as duas pontas no navegador, com a function real canal.js (e ver-aluno.js) sobre um Firestore em memória:
   · professor (Team Yoda, aba Canal da turma, CanalConversa do index.html de verdade): escreve no grupo e liga "só o professor escreve";
   · aluno pelo link (aluno.html): botão Conversas com a mensagem nova marcada, grupo da turma, envia como responsável, apaga a própria;
     conversa com o professor; no modo avisos o campo de escrever some;
   · professor vê as mensagens do grupo e pausa um aluno. Rode: node tests/smoke-canal.js [pasta-das-capturas] (defina CDN_DIR) */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("smoke-canal: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const capturas = process.argv[2] || "";
const raizTY = path.join(__dirname, "../../mty"), raizQL = path.join(__dirname, ".."), fx = path.join(__dirname, "../../netlify/functions/");

/* ── Firestore em memória ── */
const store = {}; const J = (v) => JSON.parse(JSON.stringify(v)); let seq = 0;
function docRef(p) { return { id: p.split("/").pop(), collection: (n) => colRef(p + "/" + n), async get() { const v = store[p]; return { exists: v !== undefined, id: p.split("/").pop(), data: () => J(v) }; }, async set(v, o) { store[p] = o && o.merge ? { ...(store[p] || {}), ...J(v) } : J(v); }, async update(v) { store[p] = { ...(store[p] || {}), ...J(v) }; }, async delete() { delete store[p]; } }; }
function colRef(p, f = [], ord = null, lim = 0) {
  return {
    doc: (id) => docRef(p + "/" + id), where: (c, o, v) => colRef(p, f.concat([[c, v]]), ord, lim), orderBy: (c, d) => colRef(p, f, [c, d || "asc"], lim), limit: (n) => colRef(p, f, ord, n),
    async add(v) { const id = "m" + String(++seq).padStart(6, "0"); store[p + "/" + id] = J(v); return docRef(p + "/" + id); },
    async get() {
      let ks = Object.keys(store).filter((k) => k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/")).filter((k) => f.every(([c, v]) => store[k][c] === v));
      if (ord) ks.sort((a, b) => (String(store[a][ord[0]]) < String(store[b][ord[0]]) ? -1 : String(store[a][ord[0]]) > String(store[b][ord[0]]) ? 1 : a < b ? -1 : 1) * (ord[1] === "desc" ? -1 : 1));
      if (lim) ks = ks.slice(0, lim);
      const d = ks.map((k) => ({ id: k.split("/").pop(), ref: docRef(k), data: () => J(store[k]) }));
      return { docs: d, empty: !d.length, size: d.length, forEach: (g) => d.forEach(g) };
    },
  };
}
const admin = { firestore: () => ({ collection: (n) => colRef(n), runTransaction: async (fn) => fn({ get: (r) => r.get(), set: (r, v, o) => r.set(v, o), update: (r, v) => r.update(v) }) }),
  auth: () => ({ verifyIdToken: async (t) => { if (t !== "prof") throw new Error("x"); return { uid: "p1", orgId: "org1", name: "Paula Lima" }; } }) };
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin, app: () => {} } };
require.cache[require.resolve(fx + "_push.js")] = { id: "z", filename: "z", loaded: true, exports: { avisar: async () => ({}) } };
const canal = require(fx + "canal.js").handler, verAluno = require(fx + "ver-aluno.js").handler;
store["orgs/org1/dados/mty:alunos:v2"] = { value: JSON.stringify([{ id: "a1", nome: "Ana Souza", linkToken: "tA", registros: [], horarios: [] }, { id: "a2", nome: "Beto Lima", linkToken: "tB", registros: [], horarios: [] }]) };
store["orgs/org1/dados/mty:turmas:v1"] = { value: JSON.stringify([{ id: "t1", nome: "Sub-12", membros: ["a1", "a2"], professorUid: "p1", horarios: [] }]) };

/* ── página do professor: o CanalConversa do index.html do Team Yoda ── */
const html = fs.readFileSync(path.join(raizTY, "index.html"), "utf8");
const ms = [...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
const corpo = ms.slice(0, ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);')) + `
async function listaProfessores(){return [{uid:"p1",nome:"Paula Lima"}];}
window.mtyAuth={tokenId:()=>Promise.resolve("prof"),usuario:()=>({uid:"p1",displayName:"Paula"})};
ReactDOM.createRoot(document.getElementById("root")).render(<div style={{padding:12}}><CanalConversa canal="turma:t1" /></div>);`;
const paginaProf = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><div id=root></div><script src=/r.js></script><script src=/d.js></script><script src=/p.js></script><script src=/c.js></script><script src=/b.js></script>
<script>window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return ""}};</script>
<script src=/scout/graficos.js></script><script src=/scout/ao-vivo.js></script><script src=/scout/relatorio-jogos.js></script><script src=/scout/movimento-motor.js></script><script src=/scout/evidencias.js></script><script src=/scout/movimento.js></script><script src=/scout/video-segmentador.js></script><script src=/scout/video-jogo.js></script>
<script src=/plano-equipe.js></script><script src=/equipe-rendimento.js></script><script src=/aulas-mes.js></script>
<script type="text/babel">${corpo}</script>`;
const CDNS = { "/r.js": CDN + "/react-18.3.1/package/umd/react.development.js", "/d.js": CDN + "/react-dom-18.3.1/package/umd/react-dom.development.js", "/p.js": CDN + "/prop-types-15.8.1/package/prop-types.min.js", "/c.js": CDN + "/recharts-2.15.4/package/umd/Recharts.js", "/b.js": CDN + "/babel-standalone-7.29.9/package/babel.min.js" };
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
const srv = http.createServer(async (q, r) => {
  const u = new URL(q.url, "http://x");
  if (u.pathname.startsWith("/.netlify/functions/")) {
    let b = ""; q.on("data", (d) => (b += d));
    q.on("end", async () => {
      const h = u.pathname.endsWith("/canal") ? canal : verAluno;
      try { const x = await h({ httpMethod: q.method, headers: q.headers, body: b || null, queryStringParameters: Object.fromEntries(u.searchParams) }); r.writeHead(x.statusCode, x.headers || { "content-type": "application/json" }); r.end(x.body); }
      catch (e) { r.writeHead(500); r.end(JSON.stringify({ erro: e.message })); }
    });
    return;
  }
  if (u.pathname === "/prof") { r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return r.end(paginaProf); }
  if (CDNS[u.pathname]) { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(fs.readFileSync(CDNS[u.pathname])); }
  const base = u.pathname.startsWith("/ql/") ? raizQL : raizTY, rel = u.pathname.replace(/^\/ql\//, "/");
  const f = path.join(base, decodeURIComponent(rel));
  if (f.startsWith(base) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); return r.end(fs.readFileSync(f)); }
  r.writeHead(404); r.end();
}).listen(0);
const base = "http://localhost:" + srv.address().port;

(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const erros = [];
  async function pagina(largura) {
    const ctx = await b.newContext({ viewport: { width: largura, height: 844 } });
    await ctx.route(/^https?:\/\/(?!localhost)/, (rota) => rota.fulfill({ contentType: /fonts/.test(rota.request().url()) ? "text/css" : "text/javascript", body: "" }));
    const p = await ctx.newPage();
    p.on("pageerror", (e) => erros.push(e.message)); p.on("dialog", (d) => d.accept());
    return p;
  }
  const cap = async (p, n) => { if (capturas) { fs.mkdirSync(capturas, { recursive: true }); await p.screenshot({ path: path.join(capturas, n + ".png") }); } };

  /* professor escreve no grupo */
  const prof = await pagina(1000);
  await prof.goto(base + "/prof");
  await prof.waitForSelector("[data-canal] textarea", { timeout: 120000 });
  assert(/Grupo da turma/.test(await prof.locator("[data-canal]").innerText()));
  await prof.fill("[data-canal] textarea", "Treino de sábado às 9h. Tragam água!");
  await prof.click('[data-canal] button:has-text("Enviar")');
  await prof.waitForSelector("text=Treino de sábado às 9h. Tragam água!");
  assert(/Paula · professor/.test(await prof.locator("[data-mensagens]").innerText()), "nome do professor");

  /* aluno pelo link (Team Yoda) */
  const ana = await pagina(390);
  await ana.goto(base + "/aluno.html?org=org1&id=a1&t=tA");
  await ana.waitForSelector("[data-qc-abrir]", { timeout: 30000 });
  assert(/Conversas1/.test((await ana.locator("[data-qc-abrir]").innerText()).replace(/\s/g, "")), "mensagem nova marcada no botão");
  await ana.click("[data-qc-abrir]");
  await ana.waitForSelector('[data-qc-canal="turma:t1"]');
  assert(/Grupo da turma Sub-12/.test(await ana.locator('[data-qc-canal="turma:t1"]').innerText()) && /Paula: Treino/.test(await ana.locator('[data-qc-canal="turma:t1"]').innerText()));
  assert(await ana.locator('[data-qc-canal="aluno:a1"]').count(), "conversa com o professor na lista");
  await ana.click('[data-qc-canal="turma:t1"]');
  await ana.waitForSelector("text=Treino de sábado às 9h. Tragam água!");
  await ana.fill("#qcTexto", "Combinado! Vou levar a raquete nova.");
  await ana.click("#qcEnviar");
  await ana.waitForSelector(".qc-msg.minha >> text=Combinado! Vou levar a raquete nova.");
  await ana.locator("label.qc-resp").click();
  assert(await ana.isChecked("#qcResp"), "marca: sou o responsável");
  await ana.fill("#qcTexto", "Ela chega 8h50.");
  await ana.click("#qcEnviar");
  await ana.waitForSelector("text=Responsável de Ana");
  await cap(ana, "canal-aluno-grupo");
  /* apaga a própria */
  await ana.locator(".qc-msg.minha", { hasText: "Ela chega 8h50." }).locator("[data-qc-apagar]").click();
  await ana.waitForSelector("text=Mensagem apagada");
  /* conversa individual */
  await ana.click("[data-qc-voltar]");
  await ana.click('[data-qc-canal="aluno:a1"]');
  await ana.waitForSelector("text=Só você (e o seu responsável) e o professor leem esta conversa.");
  await ana.fill("#qcTexto", "Professor, posso repor a aula de terça?");
  await ana.click("#qcEnviar");
  await ana.waitForSelector(".qc-msg.minha >> text=Professor, posso repor a aula de terça?");

  /* professor vê as mensagens, liga o modo avisos e pausa o Beto */
  await prof.reload(); await prof.waitForSelector("text=Combinado! Vou levar a raquete nova.", { timeout: 60000 });
  assert(/Mensagem apagada/.test(await prof.locator("[data-mensagens]").innerText()));
  await prof.click("[data-moderacao] summary");
  await prof.locator("[data-moderacao] div", { hasText: "Beto" }).last().locator('button:has-text("Pausar mensagens")').click();
  await prof.waitForSelector("text=Beto · pausado");
  await prof.check("[data-moderacao] input[type=checkbox]");
  await prof.waitForSelector("text=Modo avisos: só você escreve neste canal.");
  await cap(prof, "canal-professor");
  const canalDoc = store["orgs/org1/canais/turma_t1"];
  assert(canalDoc.soProfessor === true && canalDoc.silenciados.includes("a2"), "moderação gravada");

  /* aluno no modo avisos: sem campo de escrever */
  await ana.click("[data-qc-voltar]");
  await ana.click('[data-qc-canal="turma:t1"]');
  await ana.waitForSelector("text=Neste canal só o professor escreve.");
  assert.strictEqual(await ana.locator("#qcTexto").count(), 0);
  await cap(ana, "canal-aluno-avisos");
  /* a página do QuadraLab também tem o botão */
  const anaQL = await pagina(390);
  await anaQL.goto(base + "/ql/aluno.html?org=org1&id=a1&t=tA");
  await anaQL.waitForSelector("[data-qc-abrir]", { timeout: 30000 });
  assert.deepStrictEqual(erros.filter((e) => !/firebase|MTY_CONFIG/i.test(e)), [], "erros de JS: " + erros.join(" | "));
  console.log("smoke-canal: ok");
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
