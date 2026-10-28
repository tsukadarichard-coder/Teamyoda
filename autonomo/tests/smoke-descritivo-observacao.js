/* Descritivo por IA das observações e o que o aluno vê, no navegador (390 px):
   · treinador (componentes reais do index.html, IA simulada): "Gerar com IA" manda só as anotações e preenche o descritivo, que fica
     editável; "Compartilhar com o aluno" grava no registro; no plano grátis, gerar tem cadeado e escrever continua livre;
   · aluno (aluno.html pelo link, function ver-aluno real): painel "Observações do seu treinador" com o descritivo e as anotações; o áudio
     abre por link temporário. Rode: node tests/smoke-descritivo-observacao.js [pasta-das-capturas] */
const http = require("http"), fs = require("fs"), path = require("path"), assert = require("assert");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const raiz = path.join(__dirname, ".."), fx = path.join(raiz, "netlify/functions/"), capturas = process.argv[2] || "";
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("smoke-descritivo-observacao: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
const DESC = "Resumo: Você competiu bem.\nO que funcionou:\n- Fundo de quadra consistente\nO que ajustar:\n- Segundo saque mais profundo";

/* ── treinador ── */
const REG = { id: "o1", tipo: "observacao", contexto: "partida", data: "2026-10-20", torneio: "Copa Verão", adversario: "Carla", placar: "6/4 3/6",
  obs: [{ id: "a", em: "2026-10-20T10:00:00Z", cat: "fundo", tipo: "bom" }, { id: "b", em: "2026-10-20T10:05:00Z", cat: "saque", tipo: "ajustar", texto: "Segundo saque curto no 30-30" }] };
const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const ms = [...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
const corte = ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
const corpo = ms.slice(0, corte) + `chamarIA = async (prompt, max, etapa) => { window.__prompt = prompt; etapa && etapa("A IA está montando"); await new Promise((r) => setTimeout(r, 200)); return ${JSON.stringify(DESC)}; };
function Host() {
  const [alunos, setAlunos] = useState([{ id: "j1", nome: "Lia Souza", registros: [${JSON.stringify(REG)}] }]); window.__lista = alunos;
  return <div style={{ padding: 16 }}><TelaRegistro aluno={alunos[0]} alunos={alunos} setAlunos={setAlunos} identidade={{}} planoAtual={window.__plano} /></div>;
}
ReactDOM.createRoot(document.getElementById("root")).render(<Host />);`;
const pagina = (plano) => `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><div id=root></div>
<script src=/__cdn/r.js></script><script src=/__cdn/d.js></script><script src=/__cdn/p.js></script><script src=/__cdn/c.js></script><script src=/__cdn/b.js></script>
<script>window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return ""}};window.__plano=${JSON.stringify(plano)};</script>
<script src=/scout/graficos.js></script><script src=/scout/ao-vivo.js></script><script src=/scout/relatorio-jogos.js></script><script src=/scout/movimento-motor.js></script><script src=/scout/evidencias.js></script><script src=/scout/movimento.js></script>
<script type="text/babel">${corpo}</script>`;
const CDNS = { "/__cdn/r.js": "/react-18.3.1/package/umd/react.development.js", "/__cdn/d.js": "/react-dom-18.3.1/package/umd/react-dom.development.js", "/__cdn/p.js": "/prop-types-15.8.1/package/prop-types.min.js", "/__cdn/c.js": "/recharts-2.15.4/package/umd/Recharts.js", "/__cdn/b.js": "/babel-standalone-7.29.9/package/babel.min.js" };

/* ── aluno: ver-aluno real ── */
const dados = {};
const docRef = (k) => ({ get: async () => ({ exists: k in dados, data: () => dados[k] }), set: async (v) => { dados[k] = v; } });
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin: { firestore: () => ({ collection: () => ({ doc: () => ({ collection: () => ({ doc: docRef }) }) }) }) }, app: () => {} } };
let base = "";
require.cache[require.resolve(fx + "_olhar-armazenamento.js")] = { id: "z", filename: "z", loaded: true, exports: { bucket: async () => ({ file: (c) => ({ async getSignedUrl() { return [base + "/__audio/" + encodeURIComponent(c)]; } }) }) } };
const verAluno = require(fx + "ver-aluno.js").handler;

let plano = "essencial";
const servidor = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x"); let cr = ""; req.on("data", (d) => (cr += d)); await new Promise((r) => req.on("end", r));
  if (u.pathname === "/__t") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return res.end(pagina(plano)); }
  if (CDNS[u.pathname]) { res.writeHead(200, { "content-type": "text/javascript" }); return res.end(fs.readFileSync(CDN + CDNS[u.pathname])); }
  if (u.pathname.startsWith("/__audio/")) { res.writeHead(200, { "content-type": "audio/webm" }); return res.end(""); }
  if (u.pathname === "/.netlify/functions/ver-aluno") { const r = await verAluno({ httpMethod: req.method, headers: req.headers, body: cr || null, queryStringParameters: Object.fromEntries(u.searchParams) }); res.writeHead(r.statusCode, r.headers); return res.end(r.body); }
  const f = path.join(raiz, decodeURIComponent(u.pathname));
  if (!f.startsWith(raiz) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(""); }
  res.writeHead(200, { "content-type": f.endsWith(".html") ? "text/html; charset=utf-8" : f.endsWith(".png") ? "image/png" : "text/javascript" }); res.end(fs.readFileSync(f));
});
(async () => {
  await new Promise((r) => servidor.listen(0, r)); base = "http://localhost:" + servidor.address().port;
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route("https://www.gstatic.com/firebasejs/**", (r) => r.fulfill({ contentType: "text/javascript", body: "" }));
  const p = await ctx.newPage(); const erros = []; p.on("pageerror", (e) => erros.push(e.message));
  const cap = async (n) => { if (capturas) await p.screenshot({ path: path.join(capturas, n + ".png"), fullPage: true }); };

  /* treinador, Essencial: gera, edita, compartilha */
  await p.goto(base + "/__t"); await p.waitForSelector("[data-caderno-observacao]", { timeout: 120000 });
  await p.click("[data-caderno-observacao] >> text=Ver detalhes"); await p.waitForSelector("[data-descritivo]");
  await p.click("[data-descritivo] >> text=Gerar com IA");
  await p.waitForFunction((d) => document.querySelector('[aria-label="Descritivo para o aluno"]').value === d, DESC);
  const prompt = await p.evaluate(() => window.__prompt);
  assert(/Segundo saque curto no 30-30/.test(prompt) && /SOMENTE/.test(prompt) && /Copa Verão/.test(prompt) && /Lia/.test(prompt), "o pedido à IA leva só as anotações");
  let reg = (await p.evaluate(() => window.__lista))[0].registros[0];
  assert.strictEqual(reg.descritivo, DESC, "descritivo gravado");
  await p.fill('[aria-label="Descritivo para o aluno"]', DESC + "\nParabéns pela garra!"); await p.click("[data-compartilhar]");
  reg = (await p.evaluate(() => window.__lista))[0].registros[0];
  assert(reg.compartilhado === true && /Parabéns pela garra/.test(reg.descritivo), "editado e compartilhado");
  await cap("descritivo-01-treinador");

  /* grátis: gerar tem cadeado, escrever continua */
  plano = "gratis"; await p.goto(base + "/__t"); await p.waitForSelector("[data-caderno-observacao]", { timeout: 120000 });
  await p.click("[data-caderno-observacao] >> text=Ver detalhes");
  assert(await p.locator("[data-descritivo] [data-cadeado=essencial]").count() === 1 && await p.locator("[data-descritivo] button:has-text('Gerar com IA')").count() === 0, "grátis: cadeado no gerar");
  assert(await p.locator('[aria-label="Descritivo para o aluno"]').isEditable(), "grátis: escreve à mão");

  /* aluno pelo link */
  dados["mty:alunos:v2"] = { value: JSON.stringify([{ id: "j1", nome: "Lia Souza", linkToken: "tok", horarios: [], registros: [
    { ...reg, obs: reg.obs.concat([{ id: "c", em: "2026-10-20T11:00:00Z", cat: "geral", texto: "Respire entre os pontos", audio: { caminho: "audios/org1/j1/1730000000000-abc123.webm", duracaoSeg: 65 } }]) },
    { id: "o2", tipo: "observacao", contexto: "conversa", titulo: "Segredo", data: "2026-10-21", obs: [{ id: "x", texto: "não compartilhado" }] }] }]) };
  await p.goto(base + "/aluno.html?org=org1&id=j1&t=tok"); await p.waitForSelector('[data-painel="observacoes"]', { timeout: 20000 });
  let t = await p.evaluate(() => document.body.innerText);
  assert(/Observações do seu treinador/.test(t) && /Copa Verão · × Carla · 6\/4 3\/6/.test(t) && /Parabéns pela garra/.test(t) && !/não compartilhado/.test(t), "aluno vê só o compartilhado");
  await p.click('[data-painel="observacoes"] summary');
  await p.click("[data-ouvir-obs]"); await p.waitForSelector('[data-painel="observacoes"] audio');
  assert(/\/__audio\/audios%2Forg1%2Fj1%2F/.test(await p.getAttribute('[data-painel="observacoes"] audio', "src")), "áudio por link temporário");
  await cap("descritivo-02-aluno");
  assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
  console.log("smoke-descritivo-observacao: ok");
  await browser.close(); servidor.close();
})().catch((e) => { console.error(e); servidor.close(); process.exit(1); });
