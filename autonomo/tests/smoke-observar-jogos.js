/* Observar jogos por voz, no navegador (390 px), com os componentes reais do index.html, o obs-voz.js, a function audio-treinador real
   (bucket de mentira), microfone de teste do Chromium e um reconhecimento de fala controlado pelo teste (o do aparelho não roda aqui):
   · vários jogos (3), jogador ativo junto do microfone, ditar por toque (toca, fala, toca de novo), classificação sugerida;
   · nome no começo da fala manda para o outro jogo ("Registrado para Pedro", "1 nova"); nome parecido vai para "Confirmar jogador";
   · escuta ativa: cada trecho vira um registro; para (com aviso) quando o app sai da tela;
   · ditado falhou sem internet: o áudio fica no aparelho, "Áudio salvo neste aparelho · sem conexão"; conexão volta → enviado e
     "Sincronizado" (a nuvem de mentira segura a gravação enquanto está "sem internet");
   · microfone interrompido; toques com desfazer e fundamento opcional; prioridade, corrigir jogador, excluir com desfazer;
   · recarregar não perde nada; outro aparelho recupera da conta; concluir um jogo (resumo, histórico, prioridades no Plano) sem
     encerrar os outros; plano grátis avisa antes de gravar e guarda só o texto.
   Rode: node tests/smoke-observar-jogos.js [pasta-das-capturas] */
const http = require("http"), fs = require("fs"), path = require("path"), assert = require("assert");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
/* APP=mty roda o mesmo teste no app do Team Yoda (mty/, functions na raiz do repositório) */
const MTY = process.env.APP === "mty";
const raiz = MTY ? path.join(__dirname, "../../mty") : path.join(__dirname, ".."), fx = MTY ? path.join(__dirname, "../../netlify/functions/") : path.join(raiz, "netlify/functions/"), capturas = process.argv[2] || "";
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("smoke-observar-jogos: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }

/* function de áudio real, com Firebase e bucket em memória */
const store = { "orgs/org1/meta/info": { plano: "essencial" } }, arquivos = {};
const docRef = (p) => ({ async get() { return { exists: store[p] !== undefined, data: () => store[p] }; }, collection: (n) => colRef(p + "/" + n) });
const colRef = (p) => ({ doc: (id) => docRef(p + "/" + id) });
const auth = { async verifyIdToken(t) { if (t !== "prof1") throw new Error("x"); return { uid: "prof1", orgId: "org1" }; } };
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin: { firestore: () => ({ collection: (n) => colRef(n) }), auth: () => auth }, app: () => {} } };
let base = "";
const bucket = { file: (c) => ({ caminho: c, async getSignedUrl(o) { return [base + "/__bucket/" + o.action + "/" + encodeURIComponent(c)]; }, async delete() { delete arquivos[c]; }, async copy(d) { arquivos[d.caminho] = arquivos[c]; } }) };
require.cache[require.resolve(fx + "_olhar-armazenamento.js")] = { id: "z", filename: "z", loaded: true, exports: { bucket: async () => bucket } };
const audioFn = require(fx + "audio-treinador.js").handler;

const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const ms = [...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
const corte = ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
const corpo = ms.slice(0, corte) + `function Host() {
  const [alunos, setAlunos] = useState(() => { try { return JSON.parse(localStorage.getItem("__alunos")) || window.__ini; } catch (e) { return window.__ini; } });
  useEffect(() => { localStorage.setItem("__alunos", JSON.stringify(alunos)); window.__lista = alunos; }, [alunos]);
  const [caderno, setCaderno] = useState(null);
  const a = caderno && alunos.find((x) => x.id === caderno);
  return <div style={{ padding: 16 }}>{a ? <TelaRegistro aluno={a} alunos={alunos} setAlunos={setAlunos} identidade={{}} planoAtual={window.__plano} />
    : <TelaObservar alunos={alunos} setAlunos={setAlunos} planoAtual={window.__plano} aoVerCaderno={setCaderno} />}</div>;
}
ReactDOM.createRoot(document.getElementById("root")).render(<Host />);`;
const ALUNOS = [{ id: "j1", nome: "Nicolas Prado", registros: [] }, { id: "j2", nome: "Pedro Lima", registros: [] }, { id: "j3", nome: "Nicolau Reis", registros: [] }, { id: "j4", nome: "Lia Souza", registros: [] }];
/* reconhecimento de fala controlado pelo teste; nuvem de mentira (pode "travar" como sem internet); getUserMedia guardando as faixas */
const STUBS = `
window.SpeechRecognition = function () { var s = this; s.start = function () { s.ativo = true; window.__srAtual = s; window.__srInicios = (window.__srInicios || 0) + 1; }; s.stop = function () { if (!s.ativo) return; s.ativo = false; setTimeout(function () { s.onend && s.onend(); }, 30); }; };
window.__falar = function (t, final) { var s = window.__srAtual; s.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: t }], { isFinal: final !== false })] }); };
window.__erroSR = function (e) { var s = window.__srAtual; s.onerror && s.onerror({ error: e }); s.ativo = false; s.onend && s.onend(); };
window.__nuvem = JSON.parse(localStorage.getItem("__nuvem") || "{}"); window.__travas = [];
window.storage = { nuvem: true,
  get: async function (k) { return window.__nuvem[k] ? { key: k, value: window.__nuvem[k] } : null; },
  set: function (k, v) { var fazer = function () { window.__nuvem[k] = v; localStorage.setItem("__nuvem", JSON.stringify(window.__nuvem)); return { key: k }; };
    if (window.__nuvemTravada) return new Promise(function (ok) { window.__travas.push(function () { ok(fazer()); }); }); return Promise.resolve(fazer()); } };
window.__liberarNuvem = function () { window.__nuvemTravada = false; var t = window.__travas; window.__travas = []; t.forEach(function (f) { f(); }); };
var gum = navigator.mediaDevices && navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
if (gum) navigator.mediaDevices.getUserMedia = async function (c) { var st = await gum(c); window.__faixas = st.getAudioTracks(); return st; };
window.MTY = { evento() {}, id: () => "x", map() {}, tokenSeguro() { return ""; } };
window.mtyAuth = { usuario: () => ({ uid: "prof1" }), tokenId: async () => "prof1" };`;
const pagina = (plano) => `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><div id=root></div>
<style>.ql-pulso{}</style>
<script src=/__cdn/r.js></script><script src=/__cdn/d.js></script><script src=/__cdn/p.js></script><script src=/__cdn/c.js></script><script src=/__cdn/b.js></script>
<script>${STUBS};window.__plano=${JSON.stringify(plano)};window.__ini=${JSON.stringify(ALUNOS)};</script>
<script src=/scout/graficos.js></script><script src=/scout/ao-vivo.js></script><script src=/scout/relatorio-jogos.js></script><script src=/scout/movimento-motor.js></script><script src=/scout/evidencias.js></script><script src=/scout/movimento.js></script><script src=/obs-voz.js></script>
<script type="text/babel">${corpo}</script>`;
const CDNS = { "/__cdn/r.js": "/react-18.3.1/package/umd/react.development.js", "/__cdn/d.js": "/react-dom-18.3.1/package/umd/react-dom.development.js", "/__cdn/p.js": "/prop-types-15.8.1/package/prop-types.min.js", "/__cdn/c.js": "/recharts-2.15.4/package/umd/Recharts.js", "/__cdn/b.js": "/babel-standalone-7.29.9/package/babel.min.js" };
let plano = "essencial";
const servidor = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x"); const pedacos = []; req.on("data", (d) => pedacos.push(d)); await new Promise((r) => req.on("end", r)); const cr = Buffer.concat(pedacos);
  if (u.pathname === "/__t") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return res.end(pagina(plano)); }
  if (CDNS[u.pathname]) { res.writeHead(200, { "content-type": "text/javascript" }); return res.end(fs.readFileSync(CDN + CDNS[u.pathname])); }
  if (u.pathname.startsWith("/__bucket/write/")) { arquivos[decodeURIComponent(u.pathname.slice(16))] = { tipo: req.headers["content-type"], tam: cr.length }; res.writeHead(200); return res.end(""); }
  if (u.pathname.startsWith("/__bucket/read/")) { res.writeHead(200, { "content-type": "audio/webm" }); return res.end(""); }
  if (u.pathname === "/.netlify/functions/audio-treinador") { const r = await audioFn({ httpMethod: req.method, headers: req.headers, body: cr.toString() }); res.writeHead(r.statusCode, r.headers); return res.end(r.body); }
  const f = path.join(raiz, decodeURIComponent(u.pathname));
  if (!f.startsWith(raiz) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(""); }
  res.writeHead(200, { "content-type": "text/javascript" }); res.end(fs.readFileSync(f));
});

(async () => {
  await new Promise((r) => servidor.listen(0, r)); base = "http://localhost:" + servidor.address().port;
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["microphone"] });
  const p = await ctx.newPage(); const erros = []; p.on("pageerror", (e) => erros.push(e.message));
  const cap = async (n) => { if (capturas) await p.screenshot({ path: path.join(capturas, n + ".png"), fullPage: false }); };
  const texto = () => p.evaluate(() => document.body.innerText);
  const esperaTexto = (re, ms) => p.waitForFunction((r) => new RegExp(r).test(document.body.innerText), re.source, { timeout: ms || 10000 });
  const sessao = () => p.evaluate(() => JSON.parse(localStorage.getItem("ql-observar:v2")));
  const jogoDe = async (alunoId) => (await sessao()).jogos.find((j) => j.alunoId === alunoId);
  const ditar = async (fala, opc) => {
    await p.click("[data-ditar]"); await p.waitForSelector("[data-gravando]");
    await esperaTexto(/Ouvindo para/);
    if (fala) await p.evaluate((t) => window.__falar(t), fala);
    await p.waitForTimeout((opc && opc.espera) || 1200);
    await p.click("[data-parar]"); await p.waitForSelector("[data-ditar]", { timeout: 10000 });
  };

  /* abertura: selecionar jogador, + Adicionar jogo, começar */
  await p.goto(base + "/__t"); await p.waitForSelector("[data-observar]", { timeout: 120000 });
  let t = await texto();
  assert(/Selecionar jogador/.test(t) && /Começar a observar/.test(t) && /\+ Adicionar jogo/.test(t), "abertura");
  await p.selectOption('[data-observar-jogador="0"]', "j1");
  await p.click("text=+ Adicionar jogo"); await p.selectOption('[data-observar-jogador="1"]', "j2");
  await p.click("text=+ Adicionar jogo"); await p.selectOption('[data-observar-jogador="2"]', "j3");
  await p.click('[data-novo-jogo="2"] summary'); await p.fill('[data-novo-jogo="2"] [aria-label="Quadra"]', "5");
  await p.click("text=Começar a observar");
  await p.waitForSelector("[data-observando]");
  assert.strictEqual(await p.locator("[data-jogo-card]").count(), 3, "três jogos");
  assert(/Registrando para Nicolas/.test(await p.locator("[data-jogador-ativo]").innerText()), "jogador ativo perto do microfone");
  assert(/Quadra 5/.test(await p.locator('[data-jogo-card="Nicolau"]').innerText()), "quadra no cartão");
  assert(/O áudio fica guardado junto com o texto/.test(await texto()), "Essencial: aviso do áudio antes de gravar");

  /* ditar por toque: registra no jogo ativo, com classificação sugerida; áudio sobe e a sessão sincroniza */
  await ditar("Segundo saque curto de novo.");
  await esperaTexto(/Registrado para Nicolas/);
  let item = p.locator("[data-item-obs]").first();
  t = await item.innerText();
  assert(/Segundo saque curto de novo\./.test(t) && /Ponto de atenção · Saque \(sugerido\)/.test(t), "registro com sugestão: " + t);
  await p.waitForSelector('[data-item-obs] [data-estado-obs="sincronizado"]', { timeout: 15000 });
  let j1 = await jogoDe("j1");
  assert(j1.obs[0].audio && /^audios\/org1\/j1\//.test(j1.obs[0].audio.caminho) && arquivos[j1.obs[0].audio.caminho].tam > 0, "áudio enviado");
  assert(!JSON.stringify(j1).includes("audioPendente"), "nada pendente");
  await cap("observar-01-registro");

  /* nome no começo da fala: vai para o Pedro */
  await ditar("Pedro, melhorou a primeira bola depois do saque");
  await esperaTexto(/Registrado para Pedro/);
  assert(/1 nova/.test(await p.locator('[data-jogo-card="Pedro"]').innerText()), "indicador de novas");
  assert.strictEqual((await jogoDe("j2")).obs[0].natureza, "positivo");
  assert.strictEqual((await jogoDe("j1")).obs.length, 1, "não ficou no Nicolas");

  /* nome parecido com outro jogo (Nicolas × Nicolau): Confirmar jogador */
  await ditar("Nicolas boa devolução cruzada");
  await p.waitForSelector("[data-confirmar-jogador]");
  assert(/É de Nicolas/.test(await p.locator("[data-confirmar-jogador]").innerText()) && /É de Nicolau/.test(await p.locator("[data-confirmar-jogador]").innerText()), "candidatos");
  await cap("observar-02-confirmar");
  await p.click("[data-confirmar-jogador] >> text=É de Nicolas");
  await p.waitForFunction(() => !document.querySelector("[data-confirmar-jogador]"));
  assert.strictEqual((await jogoDe("j1")).obs.length, 2, "confirmado no Nicolas");

  /* escuta ativa: cada trecho vira um registro, com o nome mandando para outro jogo */
  await p.click("[data-escuta]"); await p.waitForSelector("[data-escuta-ativa]");
  assert(/Escuta ativa · ouvindo para Nicolas/.test(await texto()));
  await p.evaluate(() => window.__falar("Lembrar de conversar sobre a escolha de direção."));
  await p.evaluate(() => window.__falar("Pedro: boa construção, mas precipitou a finalização"));
  await p.waitForTimeout(300);
  /* o reconhecimento termina sozinho (pausa longa): reinicia sem o professor fazer nada */
  const inicios = await p.evaluate(() => window.__srInicios);
  await p.evaluate(() => { const s = window.__srAtual; s.ativo = false; s.onend(); });
  await p.waitForFunction((n) => window.__srInicios > n, inicios);
  await cap("observar-03-escuta");
  /* app sai da tela: a escuta para e avisa */
  await p.evaluate(() => { Object.defineProperty(document, "hidden", { value: true, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await p.waitForSelector("[data-ditar]");
  assert(/A escuta parou\. O app saiu da tela/.test(await texto()), "aviso de parada");
  await p.evaluate(() => { Object.defineProperty(document, "hidden", { value: false, configurable: true }); });
  j1 = await jogoDe("j1"); const j2 = await jogoDe("j2");
  assert(j1.obs.some((o) => o.natureza === "pergunta" && /escolha de direção/.test(o.texto)), "pergunta no Nicolas");
  assert(j2.obs.some((o) => o.natureza === "observacao" && (o.opcoesNat || []).join() === "positivo,atencao"), "frase mista no Pedro, sem certeza inventada");

  /* sem internet: o ditado falha, o áudio fica no aparelho e só sobe quando a conexão volta; a nuvem segura a gravação */
  await ctx.setOffline(true); await p.evaluate(() => { window.__nuvemTravada = true; });
  await p.waitForSelector("[data-sem-conexao]");
  await p.click("[data-ditar]"); await p.waitForSelector("[data-gravando]");
  await p.evaluate(() => window.__erroSR("network"));
  await esperaTexto(/Sem internet, o ditado do aparelho não funciona\. O áudio continua sendo gravado\./);
  await p.waitForTimeout(1500); await p.click("[data-parar]"); await p.waitForSelector("[data-ditar]");
  await esperaTexto(/Sem transcrição: o áudio ficou guardado para ouvir/);
  await p.waitForSelector('[data-estado-obs="audio-falha"]', { timeout: 10000 });
  assert(/Áudio salvo neste aparelho · sem conexão/.test(await p.locator("[data-item-obs]").first().innerText()));
  assert.strictEqual(await p.locator("[data-item-obs] [data-ouvir-local]").count(), 1, "ouvir o áudio guardado no aparelho");
  await cap("observar-04-sem-internet");
  const semNet = (await jogoDe("j1")).obs.find((o) => o.semTranscricao);
  assert(semNet && semNet.audioPendente && !semNet.audio, "pendente no aparelho");
  await ctx.setOffline(false); await p.evaluate(() => window.__liberarNuvem());
  await p.waitForFunction(() => { const s = JSON.parse(localStorage.getItem("ql-observar:v2")); return s.jogos[0].obs.some((o) => o.semTranscricao && o.audio && !o.audioPendente); }, null, { timeout: 15000 });
  await p.waitForFunction(() => [...document.querySelectorAll("[data-estado-obs]")].every((e) => e.dataset.estadoObs === "sincronizado"), null, { timeout: 15000 });
  const nuvem = JSON.parse(await p.evaluate(() => window.__nuvem["ql-observar:v2:prof1"]));
  assert.strictEqual(new Set(nuvem.jogos[0].obs.map((o) => o.id)).size, nuvem.jogos[0].obs.length, "sem duplicar ao tentar de novo");

  /* microfone interrompido no meio: para e guarda o que foi captado */
  await p.click("[data-ditar]"); await p.waitForSelector("[data-gravando]");
  await p.evaluate(() => window.__falar("Está cansado no terceiro set"));
  await p.waitForFunction(() => window.__faixas && window.__faixas.length);
  await p.waitForTimeout(800);
  await p.evaluate(() => window.__faixas[0].dispatchEvent(new Event("ended")));
  await p.waitForSelector("[data-ditar]");
  await esperaTexto(/O microfone foi interrompido/);
  assert((await jogoDe("j1")).obs.some((o) => /cansado/.test(o.texto) && o.cat === "fisico"), "captado antes da interrupção");

  /* toques: desfazer e fundamento opcional; contagem sem virar estatística */
  await p.click('[data-toque="bom"]'); await p.click("[data-aviso-obs] >> text=Desfazer");
  await p.click('[data-toque="ajustar"]'); await p.click("[data-detalhe-toque] >> text=Saque");
  t = await texto();
  assert(/Toques: 0 positivo\(s\) · 1 ajuste\(s\)\. Contagem dos toques, não é estatística da partida\./.test(t), "contagem");
  assert(/Toque: \+ Ajuste · Saque/.test(await p.locator("[data-item-obs]").first().innerText()));

  /* ações secundárias: prioridade, fundamento, corrigir jogador, excluir com desfazer */
  const alvo = p.locator("[data-item-obs]", { hasText: "Segundo saque curto" });
  await alvo.locator("[data-mais-obs]").click(); await alvo.locator("text=★ Marcar prioridade").click();
  await p.waitForSelector("[data-item-obs] [data-prioridade]");
  const conversa = p.locator("[data-item-obs]", { hasText: "escolha de direção" });
  await conversa.locator("[data-mais-obs]").click(); await conversa.locator('[aria-label="Corrigir jogador"]').selectOption({ label: "Nicolau" });
  await esperaTexto(/Registrado para Nicolau/);
  assert((await jogoDe("j3")).obs.some((o) => /escolha de direção/.test(o.texto) && o.atribuicao === "manual"), "corrigido para o Nicolau");
  const nItens = await p.locator("[data-item-obs]").count();
  const cansado = p.locator("[data-item-obs]", { hasText: "cansado" });
  await cansado.locator("[data-mais-obs]").click(); await cansado.locator("text=Excluir").click();
  await p.waitForFunction((n) => document.querySelectorAll("[data-item-obs]").length === n - 1, nItens);
  await p.click("[data-aviso-obs] >> text=Desfazer");
  await p.waitForFunction((n) => document.querySelectorAll("[data-item-obs]").length === n, nItens);

  /* recarregar: nada se perde */
  await p.reload(); await p.waitForSelector("[data-observando]", { timeout: 120000 });
  assert.strictEqual(await p.locator("[data-jogo-card]").count(), 3);
  assert((await texto()).includes("Segundo saque curto de novo."), "registros continuam");

  /* outro aparelho: recupera da conta */
  const nuvemTxt = await p.evaluate(() => localStorage.getItem("__nuvem"));
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["microphone"] });
  await ctx2.addInitScript((n) => { if (!localStorage.getItem("__nuvem")) localStorage.setItem("__nuvem", n); }, nuvemTxt);
  const p2 = await ctx2.newPage(); p2.on("pageerror", (e) => erros.push(e.message));
  await p2.goto(base + "/__t"); await p2.waitForSelector("[data-observando]", { timeout: 120000 });
  assert(/Recuperamos as observações em andamento/.test(await p2.evaluate(() => document.body.innerText)) && await p2.locator("[data-jogo-card]").count() === 3, "recuperado da conta");
  await ctx2.close();

  /* concluir o Nicolas: resumo editável, histórico, prioridades no Plano; Pedro e Nicolau continuam */
  await p.click("text=Concluir este jogo"); await p.waitForSelector("[data-resumo-jogo]");
  t = await p.locator("[data-resumo-jogo]").innerText();
  assert(/Resumo baseado nas observações registradas; não representa um scout completo\./.test(t), "aviso do resumo");
  assert.strictEqual(await p.inputValue('[data-resumo-campo="prioridades"]'), "- Segundo saque curto de novo.");
  assert(/Segundo saque curto de novo\./.test(await p.inputValue('[data-resumo-campo="atencao"]')), "pontos de atenção");
  assert(/1 toque\(s\) em \+ Ajuste/.test(t), "toques citados sem virar avaliação");
  await p.fill('[data-resumo-campo="insights"]', "- Trabalhar profundidade do segundo saque");
  await cap("observar-05-resumo");
  await p.click("text=Salvar no histórico"); await p.waitForSelector("[data-resumo-salvo]");
  await p.click("text=Levar prioridades para o planejamento"); await esperaTexto(/1 prioridade\(s\) no Plano de Nicolas/);
  const lista = await p.evaluate(() => window.__lista);
  const reg = lista[0].registros.find((r) => r.tipo === "observacao");
  assert(reg && reg.resumo.insights === "- Trabalhar profundidade do segundo saque" && reg.obs.length >= 4 && reg.obs.every((o) => !o.audioPendente && !o.capturando), "registro no caderno");
  assert(reg.obs.some((o) => o.audio && o.audio.caminho), "áudio no registro");
  assert.deepStrictEqual(lista[0].prioridadesObservadas.map((x) => x.texto), ["Segundo saque curto de novo."]);
  assert(/PRIORIDADES ANOTADAS PELO TREINADOR AO OBSERVAR JOGOS[\s\S]*Segundo saque curto de novo\./.test(await p.evaluate(() => prioridadesObservadasParaPrompt(window.__lista[0]))), "entra no prompt do plano");
  await p.click("text=Ver no caderno"); await p.waitForSelector("[data-caderno-observacao]");
  await p.click("[data-caderno-observacao] >> text=Ver detalhes"); await p.waitForSelector("[data-resumo-registro]");
  assert(/Trabalhar profundidade do segundo saque/.test(await p.locator("[data-resumo-registro]").innerText()), "resumo no caderno");
  await p.reload(); await p.waitForSelector("[data-observando]", { timeout: 120000 });
  assert(/Encerrado · salvo/.test(await p.locator('[data-jogo-card="Nicolas"]').innerText()), "Nicolas encerrado");
  assert(/Registrando para Pedro/.test(await p.locator("[data-jogador-ativo]").innerText()), "os outros continuam");
  assert.strictEqual((await sessao()).jogos.filter((j) => j.estado !== "encerrado").length, 2);

  if (!MTY) { /* o Team Yoda não tem planos */
  /* plano grátis: avisa antes de gravar e guarda só o texto */
  plano = "gratis"; store["orgs/org1/meta/info"] = { plano: "gratis" };
  const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["microphone"] });
  const p3 = await ctx3.newPage(); p3.on("pageerror", (e) => erros.push(e.message));
  await p3.goto(base + "/__t"); await p3.waitForSelector("[data-observar]", { timeout: 120000 });
  await p3.selectOption('[data-observar-jogador="0"]', "j4"); await p3.click("text=Começar a observar"); await p3.waitForSelector("[data-ditar]");
  assert(/Plano grátis: fica o texto ditado/.test(await p3.locator("[data-aviso-plano-audio]").innerText()) && await p3.locator("[data-aviso-plano-audio] [data-cadeado=essencial]").count() === 1, "aviso antes de gravar");
  await p3.click("[data-ditar]"); await p3.waitForSelector("[data-gravando]"); await p3.evaluate(() => window.__falar("Lia, ótima devolução"));
  await p3.waitForTimeout(600); await p3.click("[data-parar]"); await p3.waitForSelector("[data-ditar]");
  const s3 = await p3.evaluate(() => JSON.parse(localStorage.getItem("ql-observar:v2")));
  assert(s3.jogos[0].obs[0].texto === "Lia, ótima devolução" && !s3.jogos[0].obs[0].audioPendente && !s3.jogos[0].obs[0].audio && !(await p3.evaluate(() => window.__faixas)), "grátis: só texto, sem abrir gravação de áudio");
  await ctx3.close();
  }

  assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
  console.log("smoke-observar-jogos: ok");
  await browser.close(); servidor.close();
})().catch((e) => { console.error(e); servidor.close(); process.exit(1); });
