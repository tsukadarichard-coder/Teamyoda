/* Áudio do treinador no navegador (microfone de teste do Chromium), com a function real audio-treinador e um bucket de mentira:
   · caderno → "Conversa ou comentário em áudio": grava, o ditado (simulado) vira texto, o arquivo sobe pela URL assinada, ouvir funciona;
   · salvar cria o registro "observacao" de contexto "conversa" com a gravação; apagar a gravação apaga o arquivo;
   · plano grátis: o gravador mostra o cadeado (o texto continua possível). Rode: node tests/smoke-audio-treinador.js [pasta-das-capturas] */
const http = require("http"), fs = require("fs"), path = require("path"), assert = require("assert");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
/* APP=mty roda o mesmo teste no app do Team Yoda (mty/, functions na raiz do repositório) */
const MTY = process.env.APP === "mty";
const raiz = MTY ? path.join(__dirname, "../../mty") : path.join(__dirname, ".."), fx = MTY ? path.join(__dirname, "../../netlify/functions/") : path.join(raiz, "netlify/functions/"), capturas = process.argv[2] || "";
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("smoke-audio-treinador: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }

const store = {}, arquivos = {}, apagados = [];
const docRef = (p) => ({ async get() { return { exists: store[p] !== undefined, data: () => store[p] }; }, collection: (n) => colRef(p + "/" + n) });
const colRef = (p) => ({ doc: (id) => docRef(p + "/" + id) });
const auth = { async verifyIdToken(t) { if (t !== "prof1") throw new Error("x"); return { uid: "prof1", orgId: "org1" }; } };
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin: { firestore: () => ({ collection: (n) => colRef(n) }), auth: () => auth }, app: () => {} } };
let base = "";
const bucket = { file: (c) => ({ async getSignedUrl(o) { return [base + "/__bucket/" + o.action + "/" + encodeURIComponent(c)]; }, async delete() { apagados.push(c); delete arquivos[c]; } }) };
require.cache[require.resolve(fx + "_olhar-armazenamento.js")] = { id: "z", filename: "z", loaded: true, exports: { bucket: async () => bucket } };
const { handler } = require(fx + "audio-treinador.js");

const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const ms = [...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
const corte = ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
const corpo = ms.slice(0, corte) + `function Host() {
  const [alunos, setAlunos] = useState([{ id: "j1", nome: "Lia Souza", registros: [] }]); window.__lista = alunos;
  return <div style={{ padding: 16 }}><TelaRegistro aluno={alunos[0]} alunos={alunos} setAlunos={setAlunos} identidade={{}} planoAtual={window.__plano} /></div>;
}
ReactDOM.createRoot(document.getElementById("root")).render(<Host />);`;
/* ditado simulado: devolve uma frase ~300 ms depois de começar */
const SR_STUB = `window.SpeechRecognition = function () { var s = this; s.start = function () { setTimeout(function () { if (s.onresult) s.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: "Conversamos sobre o segundo saque no saibro" }], { isFinal: true })] }); }, 300); }; s.stop = function () { s.onend = null; }; };`;
const pagina = (plano) => `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><div id=root></div>
<script src=/__cdn/r.js></script><script src=/__cdn/d.js></script><script src=/__cdn/p.js></script><script src=/__cdn/c.js></script><script src=/__cdn/b.js></script>
<script>${SR_STUB}window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return ""}};window.mtyAuth={usuario:()=>({uid:"prof1"}),tokenId:async()=>"prof1"};window.__plano=${JSON.stringify(plano)};</script>
<script src=/scout/graficos.js></script><script src=/scout/ao-vivo.js></script><script src=/scout/relatorio-jogos.js></script><script src=/scout/movimento-motor.js></script><script src=/scout/evidencias.js></script><script src=/scout/movimento.js></script>
<script type="text/babel">${corpo}</script>`;
const CDNS = { "/__cdn/r.js": "/react-18.3.1/package/umd/react.development.js", "/__cdn/d.js": "/react-dom-18.3.1/package/umd/react-dom.development.js", "/__cdn/p.js": "/prop-types-15.8.1/package/prop-types.min.js", "/__cdn/c.js": "/recharts-2.15.4/package/umd/Recharts.js", "/__cdn/b.js": "/babel-standalone-7.29.9/package/babel.min.js" };
let plano = "essencial";
const servidor = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x"); const pedacos = []; req.on("data", (d) => pedacos.push(d)); await new Promise((r) => req.on("end", r)); const corpoReq = Buffer.concat(pedacos);
  if (u.pathname === "/__t") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return res.end(pagina(plano)); }
  if (CDNS[u.pathname]) { res.writeHead(200, { "content-type": "text/javascript" }); return res.end(fs.readFileSync(CDN + CDNS[u.pathname])); }
  if (u.pathname.startsWith("/__bucket/write/")) { arquivos[decodeURIComponent(u.pathname.slice(16))] = { tipo: req.headers["content-type"], tam: corpoReq.length }; res.writeHead(200); return res.end(""); }
  if (u.pathname.startsWith("/__bucket/read/")) { res.writeHead(200, { "content-type": "audio/webm" }); return res.end(""); }
  if (u.pathname === "/.netlify/functions/audio-treinador") { const r = await handler({ httpMethod: req.method, headers: req.headers, body: corpoReq.toString() }); res.writeHead(r.statusCode, r.headers); return res.end(r.body); }
  const f = path.join(raiz, decodeURIComponent(u.pathname));
  if (!f.startsWith(raiz) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(""); }
  res.writeHead(200, { "content-type": "text/javascript" }); res.end(fs.readFileSync(f));
});
(async () => {
  await new Promise((r) => servidor.listen(0, r)); base = "http://localhost:" + servidor.address().port;
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["microphone"] });
  const p = await ctx.newPage(); const erros = []; p.on("pageerror", (e) => erros.push(e.message));
  const cap = async (n) => { if (capturas) await p.screenshot({ path: path.join(capturas, n + ".png"), fullPage: true }); };
  const novaConversa = async () => { await p.goto(base + "/__t"); await p.waitForSelector("text=+ Novo registro", { timeout: 120000 }); await p.click("text=+ Novo registro"); await p.click("text=Conversa ou comentário em áudio"); await p.waitForSelector("[data-form-voz]"); };

  store["orgs/org1/meta/info"] = { plano: "essencial" };
  await novaConversa();
  await p.fill('[data-form-voz] input', "Conversa no almoço do torneio");
  await p.click("[data-gravador] >> text=Gravar");
  await p.waitForFunction(() => /Conversamos sobre o segundo saque/.test(document.body.innerText), null, { timeout: 10000 });
  await cap("audio-01-gravando");
  await p.waitForTimeout(1500); await p.click("text=Parar e guardar");
  await p.waitForSelector("[data-form-voz] [data-ouvir]", { timeout: 15000 });
  const caminho = Object.keys(arquivos)[0];
  assert(caminho && /^audios\/org1\/j1\//.test(caminho) && arquivos[caminho].tam > 0 && /^audio\//.test(arquivos[caminho].tipo), "arquivo enviado pela URL assinada: " + JSON.stringify(arquivos));
  await p.click("[data-form-voz] [data-ouvir]"); await p.waitForSelector("[data-form-voz] audio");
  await cap("audio-02-gravado");
  await p.click("text=Salvar no caderno"); await p.waitForSelector("[data-caderno-observacao]");
  const reg = (await p.evaluate(() => window.__lista))[0].registros[0];
  assert(reg.tipo === "observacao" && reg.contexto === "conversa" && reg.titulo === "Conversa no almoço do torneio" && reg.obs[0].audio.caminho === caminho && /segundo saque/.test(reg.obs[0].texto), "registro de conversa com a gravação");
  let t = await p.evaluate(() => document.body.innerText);
  assert(/Conversa ou comentário/.test(t) && /1 gravação/.test(t), "caderno mostra a conversa");
  await p.click("[data-caderno-observacao] >> text=Ver detalhes"); await p.waitForSelector("[data-caderno-observacao] [data-ouvir]");
  await cap("audio-03-caderno");
  p.once("dialog", (d) => d.accept());
  await p.click("[data-caderno-observacao] >> text=Apagar");
  await p.waitForFunction(() => !document.querySelector("[data-caderno-observacao]"));
  assert.deepStrictEqual(apagados, [caminho], "apagar o registro apaga o arquivo");

  if (!MTY) { /* o Team Yoda não tem planos */
  /* plano grátis: cadeado no gravador, texto continua */
  plano = "gratis"; store["orgs/org1/meta/info"] = { plano: "gratis" };
  await novaConversa();
  assert.strictEqual(await p.locator("[data-form-voz] [data-cadeado=essencial]").count(), 1, "cadeado no gravador");
  await p.fill("[data-form-voz] textarea", "Combinamos treinar a devolução"); await p.click("text=Salvar no caderno");
  await p.waitForSelector("[data-caderno-observacao]");
  }
  assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
  console.log("smoke-audio-treinador: ok");
  await browser.close(); servidor.close();
})().catch((e) => { console.error(e); servidor.close(); process.exit(1); });
