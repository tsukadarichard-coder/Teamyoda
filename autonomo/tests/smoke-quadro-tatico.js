/* Quadro tático (quadro/) no navegador, em iPad (em pé e deitado) e celular:
   · desenha seta e reta tracejada; põe jogadores e bola e arrasta; desfazer/refazer; apagar um traço; meia quadra e piso;
   · salva no aparelho, limpa e abre de novo; o quadro em andamento volta depois de recarregar; virar o iPad não perde nada;
   · com a Apple Pencil em uso, o dedo não risca (palma), mas ainda arrasta peça. Rode: node tests/smoke-quadro-tatico.js [pasta-das-capturas] */
const http = require("http"), fs = require("fs"), path = require("path"), assert = require("assert");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
/* APP=mty roda o mesmo teste no app do Team Yoda (mty/) */
const MTY = process.env.APP === "mty";
const raiz = MTY ? path.join(__dirname, "../../mty") : path.join(__dirname, ".."), capturas = process.argv[2] || "";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png" };
const servidor = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x"); let f = path.join(raiz, decodeURIComponent(u.pathname)); if (u.pathname.endsWith("/")) f = path.join(f, "index.html");
  if (!f.startsWith(raiz) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(""); }
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); res.end(fs.readFileSync(f));
});
(async () => {
  await new Promise((r) => servidor.listen(0, r));
  const base = "http://localhost:" + servidor.address().port;
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const ctx = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); const erros = []; p.on("pageerror", (e) => erros.push(e.message));
  const cap = async (n) => { if (capturas) await p.screenshot({ path: path.join(capturas, n + ".png") }); };
  const est = () => p.evaluate(() => JSON.parse(JSON.stringify(window.QL_QUADRO.estado())));
  const tela = (x, y) => p.evaluate(([x, y]) => window.QL_QUADRO.paraTela(x, y), [x, y]);
  /* gesto com pointer events (mouse, toque ou caneta) em coordenadas da quadra (metros) */
  async function gesto(pontos, tipo = "mouse") {
    const box = await p.locator("#qtTela").boundingBox();
    const pts = []; for (const [x, y] of pontos) { const t = await tela(x, y); pts.push([box.x + t[0], box.y + t[1]]); }
    await p.evaluate(([pts, tipo]) => {
      const c = document.getElementById("qtTela"), id = 7;
      const ev = (n, [x, y]) => c.dispatchEvent(new PointerEvent(n, { pointerId: id, pointerType: tipo, clientX: x, clientY: y, bubbles: true, isPrimary: true }));
      ev("pointerdown", pts[0]); pts.slice(1).forEach((q) => ev("pointermove", q)); ev("pointerup", pts[pts.length - 1]);
    }, [pts, tipo]);
  }
  await p.goto(base + "/quadro/"); await p.waitForFunction(() => window.QL_QUADRO);

  /* seta (traço livre com ponta) e reta tracejada */
  await p.click('[data-fer="seta"]');
  await gesto([[2, 20], [3, 17], [5, 14], [7, 10], [8, 6]]);
  await p.click('[data-fer="reta"]'); await p.click("#btTraco"); await p.click('[data-cor="#1E63E9"]');
  await gesto([[5, 22], [5, 19], [4, 17]]);
  let e = await est();
  assert(e.tracos.length === 2 && e.tracos[0].tipo === "seta" && e.tracos[1].tipo === "reta" && e.tracos[1].tracejado && e.tracos[1].pts.length === 2 && e.tracos[1].cor === "#1E63E9", "seta + reta tracejada azul");

  /* peças: jogador azul, vermelho e bola; arrasta o azul */
  await p.click('[data-peca="A"]'); await p.click('[data-peca="B"]'); await p.click('[data-peca="bola"]');
  e = await est(); assert.deepStrictEqual(e.pecas.map((x) => x.rotulo || x.tipo), ["A1", "B1", "bola"]);
  const a1 = e.pecas[0];
  await p.click('[data-fer="caneta"]');
  await gesto([[a1.x, a1.y], [a1.x + 1, a1.y + 1], [2, 23]]);
  e = await est(); assert(Math.abs(e.pecas[0].x - 2) < 0.2 && Math.abs(e.pecas[0].y - 23) < 0.2 && e.tracos.length === 2, "arrastar a peça não risca");
  await cap("quadro-01-ipad");

  /* desfazer / refazer */
  await p.click('[data-acao="desfazer"]'); e = await est(); assert(Math.abs(e.pecas[0].x - a1.x) < 0.01, "desfazer volta a peça");
  await p.click('[data-acao="refazer"]'); e = await est(); assert(Math.abs(e.pecas[0].x - 2) < 0.2, "refazer");

  /* apagar o traço tocado */
  await p.click('[data-fer="borracha"]'); await gesto([[5, 14]]);
  e = await est(); assert(e.tracos.length === 1 && e.tracos[0].tipo === "reta", "apagou a seta");

  /* Apple Pencil: depois de usar a caneta, o dedo não risca */
  await p.click('[data-fer="caneta"]'); await gesto([[1, 2], [3, 4], [5, 3]], "pen");
  const n = (await est()).tracos.length; await gesto([[6, 2], [8, 3], [9, 5]], "touch");
  assert.strictEqual((await est()).tracos.length, n, "palma da mão não risca");

  /* meia quadra e piso rápido; salvar, limpar, abrir */
  await p.click('[data-acao="menu"]'); await p.click('.qt-seg[data-grupo="area"] [data-val="meia"]'); await p.click('.qt-seg[data-grupo="piso"] [data-val="rapida"]');
  e = await est(); assert(e.area === "meia" && e.piso === "rapida");
  await p.click('[data-acao="salvar"]'); /* o menu continua aberto depois de trocar quadra e piso */ await p.fill("#qtNome", "Saque aberto"); await p.click('[data-x="sim"]');
  p.once("dialog", (d) => d.accept());
  await p.click('[data-acao="menu"]'); await p.click('[data-acao="limpar"]');
  await p.waitForFunction(() => window.QL_QUADRO.estado().tracos.length === 0);
  await p.click('[data-acao="menu"]'); await p.click('[data-acao="abrir"]'); await p.click("[data-abrir]");
  e = await est(); assert(e.tracos.length === n && e.pecas.length === 3 && e.area === "meia", "quadro salvo reabre igual");
  await cap("quadro-02-meia-rapida");

  /* recarregar mantém o quadro; virar o iPad (deitado) redesenha sem perder nada */
  await p.reload(); await p.waitForFunction(() => window.QL_QUADRO);
  assert.strictEqual((await est()).tracos.length, n, "quadro em andamento volta");
  await p.click('[data-acao="menu"]'); await p.click('.qt-seg[data-grupo="area"] [data-val="inteira"]'); await p.click('[data-acao="menu"]');
  await p.setViewportSize({ width: 1180, height: 820 }); await p.waitForTimeout(300);
  const t1 = await tela(0, 0), t2 = await tela(10.97, 23.77);
  assert(Math.abs(t2[0] - t1[0]) > Math.abs(t2[1] - t1[1]), "iPad deitado: quadra deitada");
  await cap("quadro-03-ipad-deitado");

  /* celular: sem rolagem lateral, barra cabe */
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(200);
  assert(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "sem rolagem lateral no celular");
  await cap("quadro-04-celular");
  assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
  console.log("smoke-quadro-tatico: ok");
  await browser.close(); servidor.close();
})().catch((e) => { console.error(e); servidor.close(); process.exit(1); });
