/* Team Yoda · Mais › Academia Digital (TelaAcademiaDigital do index.html de verdade), no celular, com a function real digital.js
   sobre um Firestore em memória: cria trilha e aula, recusa link do YouTube e código de treino inválidos, salva (o link vira o ID do
   vídeo), publica, salva a venda (link de pagamento só https), lista os membros e dá cortesia.
   Rode: node tests/smoke-digital-coord.js [pasta-das-capturas] (defina CDN_DIR) */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("smoke-digital-coord: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
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
const admin = { firestore: () => ({ collection: (n) => colRef(n) }), auth: () => ({ verifyIdToken: async (t) => { if (t !== "coord") throw new Error("x"); return { uid: "c1", orgId: "team-yoda", role: "coordenador", email: "coord@ty.com" }; } }) };
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin, app: () => {} } };
const digital = require(fx + "digital.js").handler;
store["digitalContas/u1"] = { nome: "Carlos Fora", email: "carlos@x.com", criadoEm: "2026-11-01T10:00:00Z", vinculos: [], vinculoChaves: [], progresso: {} };
store["orgs/team-yoda/dados/mty:alunos:v2"] = { value: "[]" };

const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const ms = [...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
const corpo = ms.slice(0, ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);')) + `
window.mtyAuth={tokenId:()=>Promise.resolve("coord"),usuario:()=>({uid:"c1",email:"coord@ty.com"})};
ReactDOM.createRoot(document.getElementById("root")).render(<div style={{padding:12}}><AvisoEnderecoNovo orgAtual="team-yoda" /><AvisoEnderecoNovo orgAtual="39-ranch" /><TelaAcademiaDigital /></div>);`;
const pagina = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><div id=root></div><script src=/r.js></script><script src=/d.js></script><script src=/p.js></script><script src=/c.js></script><script src=/b.js></script>
<script>window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return ""}};</script>
<script src=/scout/graficos.js></script><script src=/scout/ao-vivo.js></script><script src=/scout/relatorio-jogos.js></script><script src=/scout/movimento-motor.js></script><script src=/scout/evidencias.js></script><script src=/scout/movimento.js></script><script src=/scout/video-segmentador.js></script><script src=/scout/video-jogo.js></script>
<script src=/plano-equipe.js></script><script src=/equipe-rendimento.js></script><script src=/aulas-mes.js></script>
<script type="text/babel">${corpo}</script>`;
const CDNS = { "/r.js": CDN + "/react-18.3.1/package/umd/react.development.js", "/d.js": CDN + "/react-dom-18.3.1/package/umd/react-dom.development.js", "/p.js": CDN + "/prop-types-15.8.1/package/prop-types.min.js", "/c.js": CDN + "/recharts-2.15.4/package/umd/Recharts.js", "/b.js": CDN + "/babel-standalone-7.29.9/package/babel.min.js" };
const srv = http.createServer((q, r) => {
  const u = new URL(q.url, "http://x");
  let b = ""; q.on("data", (d) => (b += d));
  q.on("end", async () => {
    if (u.pathname === "/.netlify/functions/digital") { const x = await digital({ httpMethod: q.method, headers: q.headers, body: b || null, queryStringParameters: Object.fromEntries(u.searchParams) }); r.writeHead(x.statusCode, x.headers); return r.end(x.body); }
    if (u.pathname === "/coord") { r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return r.end(pagina); }
    if (CDNS[u.pathname]) { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(fs.readFileSync(CDNS[u.pathname])); }
    const f = path.join(raiz, decodeURIComponent(u.pathname));
    if (f.startsWith(raiz) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(fs.readFileSync(f)); }
    r.writeHead(404); r.end();
  });
}).listen(0);
const base = "http://localhost:" + srv.address().port;

(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const PNG = fs.readFileSync(path.join(raiz, "assets/favicon-32.png"));
  await ctx.route(/^https?:\/\/(?!localhost)/, (rota) => /teamyoda\.com\.br\/assets\/favicon-32\.png/.test(rota.request().url()) ? rota.fulfill({ contentType: "image/png", body: PNG }) : rota.fulfill({ contentType: "text/plain", body: "" }));
  const p = await ctx.newPage(), erros = [];
  p.on("pageerror", (e) => erros.push(e.message)); p.on("dialog", (d) => d.accept());
  await p.goto(base + "/coord");
  await p.waitForSelector("text=Nenhum curso ainda", { timeout: 60000 });
  /* aviso do endereço novo: só para o Team Yoda (não para o 39 Ranch), quando teamyoda.com.br responde; "Já mudei" esconde de vez */
  await p.waitForSelector("[data-aviso-endereco] >> text=teamyoda.com.br/treinador");
  assert.strictEqual(await p.locator("[data-aviso-endereco]").count(), 1, "só um aviso (o do 39 Ranch não aparece)");
  assert.strictEqual(await p.getAttribute("[data-aviso-endereco] a", "href"), "https://teamyoda.com.br/treinador");
  await p.click("[data-aviso-endereco] button:has-text('Já mudei')");
  assert.strictEqual(await p.locator("[data-aviso-endereco]").count(), 0);
  const campo = (rot) => p.locator("div.mb-4", { has: p.locator("text=" + rot) }).locator("input, textarea, select").first();

  await p.click("button:has-text('+ Novo curso')");
  await campo("Título do curso").fill("Forehand do zero");
  await campo("Nível").selectOption("iniciante");
  await p.click("button:has-text('+ Aula')");
  await campo("Título da aula").fill("Empunhadura");
  await campo("Link do vídeo no YouTube").fill("https://vimeo.com/123");
  await p.waitForSelector("text=Link não reconhecido");
  await p.click("button:has-text('Salvar')");
  await p.waitForSelector("text=não foi reconhecido");
  await campo("Link do vídeo no YouTube").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3");
  await p.waitForSelector("text=Vídeo reconhecido.");
  await campo("Treinos da aula").fill("fb001, zz999");
  await p.waitForSelector("text=ZZ999 · não está no catálogo");
  await p.waitForSelector("text=FB001 · FH Cruzado Profundo");
  await p.click("button:has-text('Salvar')");
  await p.waitForSelector("text=estes códigos não estão no catálogo: ZZ999");
  await campo("Treinos da aula").fill("FB001, FB003");
  await p.click("button:has-text('Salvar')");
  await p.waitForSelector("text=Salvo. Os cursos publicados");
  let c = store["digitalContas/u1"] && store["digitalConteudo/academia"];
  assert.deepStrictEqual([c.trilhas[0].titulo, c.trilhas[0].nivel, c.trilhas[0].publicada, c.trilhas[0].aulas[0].youtube, c.trilhas[0].aulas[0].exercicios], ["Forehand do zero", "iniciante", false, "dQw4w9WgXcQ", ["FB001", "FB003"]]);
  await p.check("[data-trilha] input[type=checkbox]");
  await p.click("button:has-text('Salvar')");
  await p.waitForSelector("text=Salvo. Os cursos publicados");
  assert.strictEqual(store["digitalConteudo/academia"].trilhas[0].publicada, true);
  await p.waitForSelector("text=· 1 aula · publicada");
  await (capturas && p.screenshot({ path: path.join(capturas, "digital-coord-trilhas.png"), fullPage: true }));

  /* quiz feito à mão: incompleto é recusado; completo é salvo */
  await p.click("[data-quiz-editor] button:has-text('+ Pergunta')");
  await p.fill("[data-pergunta='0'] input", "Onde fica o contato?");
  await p.click("button:has-text('Salvar')");
  await p.waitForSelector("text=Pergunta incompleta no quiz");
  await p.fill("[data-pergunta='0'] input", "Onde fica o contato?");
  await p.fill("[data-pergunta='0'] textarea", "À frente do corpo\nAtrás do corpo");
  await p.click("button:has-text('Salvar')");
  await p.waitForSelector("text=Marque a resposta certa");
  await p.selectOption("[data-pergunta='0'] select", "0");
  await p.click("button:has-text('Salvar')");
  await p.waitForSelector("text=Salvo. Os cursos publicados");
  assert.deepStrictEqual(store["digitalConteudo/academia"].trilhas[0].aulas[0].quiz, [{ p: "Onde fica o contato?", op: ["À frente do corpo", "Atrás do corpo"], c: 0 }]);
  /* cursos-modelo: técnica, tática e mental em rascunho, com quiz em todas as aulas e treinos ligados */
  for (const b of ["+ Curso de Técnica", "+ Curso de Tática", "+ Curso Mental"]) await p.click("[data-modelos] button:has-text('" + b + "')");
  await p.click("button:has-text('Salvar')");
  await p.waitForSelector("text=Salvo. Os cursos publicados");
  const ts = store["digitalConteudo/academia"].trilhas;
  assert.deepStrictEqual(ts.slice(1).map((t) => [t.categoria, t.publicada]), [["tecnica", false], ["tatica", false], ["mental", false]]);
  assert.strictEqual(ts[1].aulas.length, 12, "12 aulas da série de técnica");
  assert(ts[1].aulas.every((a) => a.quiz.length === 1 && a.descricao.length > 80), "técnica: texto e quiz em todas");
  assert(ts[2].aulas.filter((a) => a.quiz.length).length >= 14 && ts[2].aulas.some((a) => a.exercicios.length), "tática: quiz e trilhos ligados");
  assert(ts[3].aulas.length === 7 && ts[3].aulas.every((a) => a.exercicios.length === 1 && /^DM/.test(a.exercicios[0])), "mental: um treino DM por aula");
  assert(ts.slice(1).every((t) => t.aulas.every((a) => a.quiz.every((q) => q.c >= 0 && q.c < q.op.length && new Set(q.op).size === q.op.length))), "quizzes válidos e sem opção repetida");
  await (capturas && p.screenshot({ path: path.join(capturas, "digital-coord-cursos.png"), fullPage: true }));

  /* venda */
  await p.click("button[role=tab]:has-text('Venda')");
  await campo("Preço").fill("R$ 59,90/mês");
  await campo("Link de pagamento").fill("http://inseguro");
  await p.click("button:has-text('Salvar')");
  await p.waitForSelector("text=precisa começar com https://");
  await campo("Link de pagamento").fill("");
  await p.click("button:has-text('Salvar')");
  await p.waitForSelector("text=Salvo. Os cursos publicados");
  assert.deepStrictEqual([store["digitalConteudo/academia"].venda.preco, store["digitalConteudo/academia"].venda.checkoutUrl], ["R$ 59,90/mês", ""]);
  assert.strictEqual(store["digitalConteudo/academia"].trilhas.length, 4, "salvar a venda mantém os cursos");

  /* membros e cortesia */
  await p.click("button[role=tab]:has-text('Membros')");
  await p.waitForSelector("[data-membro='carlos@x.com'] >> text=Sem acesso");
  await p.click("[data-membro='carlos@x.com'] button:has-text('Dar cortesia')");
  await p.waitForSelector("text=Cortesia liberada para carlos@x.com.");
  await p.waitForSelector("[data-membro='carlos@x.com'] >> text=Cortesia");
  assert(store["digitalContas/u1"].cortesia && store["digitalContas/u1"].cortesia.por === "coord@ty.com");
  await p.click("[data-membro='carlos@x.com'] button:has-text('Tirar cortesia')");
  await p.waitForSelector("text=Cortesia retirada de carlos@x.com.");
  assert.strictEqual(store["digitalContas/u1"].cortesia, null);
  await (capturas && p.screenshot({ path: path.join(capturas, "digital-coord-membros.png"), fullPage: true }));
  assert(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "sem rolagem lateral");
  assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
  console.log("smoke-digital-coord: ok");
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
