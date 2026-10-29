/* Análise de movimento: vídeo real e boneco lado a lado, sincronizados, e a comparação opcional com um modelo (padrão QuadraLab,
   modelo da academia salvo de uma análise ou análise anterior do atleta). Roda scout/movimento.js de verdade no navegador.
   Rode: node tests/smoke-video-boneco.js (VIDEO_TESTE = um .webm curto em pé; sem ele, só a parte da demonstração) */
const fs = require("fs"), path = require("path"), http = require("http");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const assert = require("assert");
const raiz = path.join(__dirname, "..");
const VIDEO = process.env.VIDEO_TESTE || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/teste-golpe.webm";
const CAP = process.env.CAP_DIR;
const pagina = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><link rel=stylesheet href="/scout/movimento.css"><div id=m style="max-width:900px;margin:auto"></div>
<script src=/scout/movimento-motor.js></script><script src=/scout/movimento-arquivo.js></script><script src=/scout/movimento.js></script>
<script>
  window.__salvos = [];
  window.__ctl = QLMovimento.montar(document.getElementById("m"), { atleta: "Ana Souza", alunoId: "a1", historico: [], arquivo: QLMovArquivo.criar({}),
    aoSalvar: function (r) { window.__salvos.push(r); return Promise.resolve(); }, logo: "x.png" });
</script>`;
const srv = http.createServer((q, r) => {
  const u = q.url.split("?")[0];
  if (u === "/") { r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return r.end(pagina); }
  const f = path.join(raiz, decodeURIComponent(u));
  if (!f.startsWith(raiz) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "content-type": f.endsWith(".css") ? "text/css" : "text/javascript" }); r.end(fs.readFileSync(f));
}).listen(0);
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"] });
  const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  const erros = []; p.on("pageerror", (e) => erros.push(e.message)); p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) erros.push(m.text()); });
  p.on("dialog", (d) => d.accept("Forehand de referência"));
  await p.goto("http://localhost:" + srv.address().port + "/");
  const Q = (n) => p.locator('.qlm [data-r="' + n + '"]');
  const tempo = () => p.evaluate(() => window.__ctl.tempoVideoBoneco());

  /* 1. demonstração: sem vídeo, o boneco anda sozinho; modelo padrão com tabela por fase */
  await Q("demo").click();
  await p.waitForSelector('.qlm [data-r="saida"]:not([hidden])');
  assert(await Q("v2msg").isVisible(), "demonstração avisa que não há vídeo");
  assert.strictEqual(await Q("faseBt").locator("button").count(), 6, "6 botões de fase");
  await Q("mod").selectOption("padrao"); await p.waitForTimeout(150);
  assert(/Modelo padrão/.test(await Q("bonRot").textContent()), "rótulo do modelo no boneco");
  await Q("faseBt").locator("button").nth(3).click(); await p.waitForTimeout(150);
  let t = await p.evaluate(() => document.querySelector('.qlm [data-r="cmpMod"]').innerText);
  assert(/Contato/.test(t) && /Cotovelo do braço do golpe/.test(t) && /Diferença/i.test(t), "tabela atleta × modelo da fase Contato: " + t.slice(0, 200));
  assert(/não é um atleta real/.test(t), "modelo padrão explicado");
  const t0 = await tempo();
  await Q("play").click(); await p.waitForTimeout(700); await Q("play").click();
  assert((await tempo()) !== t0, "reproduzir anda o boneco");
  if (CAP) await p.screenshot({ path: CAP + "/vb-demo.png", fullPage: true });

  /* 2. vídeo real (em pé): o vídeo e o boneco no mesmo instante, quadro a quadro e ir para a fase */
  if (fs.existsSync(VIDEO)) {
    await p.setInputFiles('.qlm [data-r="arq"]', VIDEO);
    await p.evaluate(() => new Promise((r) => { const v = document.querySelector('.qlm [data-r="v"]'); if (v.readyState >= 1) r(); else v.onloadedmetadata = r; }));
    /* pose de um golpe com os tempos do vídeo (2,2 s), como se viesse do MediaPipe */
    await p.evaluate(() => { const q = QLBiomec.sintetico(66, "D"); window.__ctl.injetar(q, {}); });
    await p.waitForFunction(() => document.querySelector('.qlm [data-r="v2"]').getAttribute("src"));
    assert(!(await Q("v2msg").isVisible()) && (await Q("v2").isVisible()), "vídeo real ao lado do boneco");
    const dims = await p.evaluate(() => { const c = document.querySelector('.qlm [data-r="bon"]'); return [c.width, c.height]; });
    assert(dims[1] > dims[0], "boneco na proporção do vídeo em pé " + dims);
    await Q("faseBt").locator("button").nth(3).click(); await p.waitForTimeout(300);
    const fases = await p.evaluate(() => window.__ctl.estado.resultado.fases.map((f) => f.t));
    assert(Math.abs((await p.evaluate(() => document.querySelector('.qlm [data-r="v2"]').currentTime)) - fases[3]) < 0.05, "ir para a fase leva o vídeo ao contato");
    const antes = await tempo(); await Q("qProx").click(); await p.waitForTimeout(250);
    assert(Math.abs((await tempo()) - antes - 1 / 30) < 0.02, "quadro a quadro avança 1/30 s no vídeo e no boneco");
    await Q("vel").selectOption("0.25");
    await Q("play").click(); await p.waitForTimeout(500);
    assert.strictEqual(await p.evaluate(() => document.querySelector('.qlm [data-r="v2"]').playbackRate), 0.25, "velocidade 0,25×");
    await Q("play").click();
    /* salvar como modelo da academia: aparece em "Comparar com" */
    assert(await Q("salvarMod").isVisible(), "botão de salvar como modelo na análise real");
    await p.waitForFunction(() => !document.querySelector('.qlm [data-r="salvarMod"]').disabled);
    await Q("salvarMod").click();
    await p.waitForFunction(() => [...document.querySelectorAll('.qlm [data-r="mod"] option')].some((o) => o.value.startsWith("mod:")), null, { timeout: 5000 });
    const val = await p.evaluate(() => [...document.querySelectorAll('.qlm [data-r="mod"] option')].find((o) => o.value.startsWith("mod:")).value);
    await Q("mod").selectOption(val); await p.waitForTimeout(300);
    assert(/Forehand de referência/.test(await Q("bonRot").textContent()), "modelo da academia escolhido");
    t = await p.evaluate(() => document.querySelector('.qlm [data-r="cmpMod"]').innerText);
    assert(/tirado de uma análise de vídeo/.test(t), "modelo da academia explicado");
    if (CAP) await p.screenshot({ path: CAP + "/vb-video.png", fullPage: true });
  } else console.log("smoke-video-boneco: sem vídeo de teste, parte do vídeo real pulada");
  assert.deepStrictEqual(erros, [], "erros de JS " + erros.join(" | "));
  console.log("smoke-video-boneco: ok");
  await b.close(); srv.close();
})().catch((e) => { console.error(e.message || e); process.exit(1); });
