/* Jogo em vídeo com link do YouTube: o vídeo abre no player oficial (aqui um player falso no lugar da API do YouTube),
   os pontos são marcados à mão no tempo do vídeo, clicar num ponto leva o vídeo até ele e o jogo é salvo com o id do vídeo.
   Rode: node tests/check-video-youtube.js */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
const raiz = path.join(__dirname, "..");
const pagina = `<!doctype html><meta charset=utf-8><link rel=stylesheet href=/scout/movimento.css><div id=a></div>
<script src=/scout/video-segmentador.js></script><script src=/scout/video-audio.js></script><script src=/scout/video-jogo.js></script>
<script>window.__salvos=[];window.vj=QLVideoJogo.montar(document.getElementById("a"),{atleta:"Ana",aoSalvar:(r)=>window.__salvos.push(r)});</script>`;
/* API falsa: o mesmo contrato do YT.Player que o app usa */
const apiFalsa = `window.__yt={buscas:[],t:0,criado:null};window.YT={Player:function(el,o){window.__yt.criado=o.videoId;var self=this;
  this.getCurrentTime=function(){return window.__yt.t};this.seekTo=function(t){window.__yt.buscas.push(t);window.__yt.t=t};this.playVideo=function(){};this.pauseVideo=function(){};
  this.getDuration=function(){return 3600};this.destroy=function(){};el.innerHTML='<div class="yt-falso">player</div>';setTimeout(function(){o.events&&o.events.onReady&&o.events.onReady()},10);}};
  setTimeout(function(){window.onYouTubeIframeAPIReady&&window.onYouTubeIframeAPIReady()},10);`;
const srv = http.createServer((q, r) => {
  const u = q.url.split("?")[0];
  if (u === "/") { r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return r.end(pagina); }
  const f = path.join(raiz, u); if (f.startsWith(raiz) && fs.existsSync(f)) { r.writeHead(200, { "content-type": u.endsWith(".css") ? "text/css" : "text/javascript" }); return r.end(fs.readFileSync(f)); }
  r.writeHead(404); r.end();
}).listen(0);
(async () => {
  const { chromium } = require("/opt/node22/lib/node_modules/playwright");
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const p = await b.newPage(), erros = [];
  p.on("pageerror", (e) => erros.push(e.message));
  await p.route(/youtube\.com\/iframe_api/, (rt) => rt.fulfill({ status: 200, contentType: "text/javascript", body: apiFalsa }));
  await p.goto("http://localhost:" + srv.address().port + "/");
  /* link inválido: aviso, nada abre */
  await p.fill('[data-r="yt"]', "https://exemplo.com/video"); await p.click('[data-r="ytgo"]');
  assert(/não parece de um vídeo do YouTube/.test(await p.textContent('[data-r="st"]')), "link inválido avisa");
  for (const [link, id] of [["https://youtu.be/dQw4w9WgXcQ?t=10", "dQw4w9WgXcQ"], ["https://www.youtube.com/watch?v=aBcDeFgHiJk&list=x", "aBcDeFgHiJk"], ["https://youtube.com/shorts/ZZZZZZZZZZ1", "ZZZZZZZZZZ1"]]) {
    await p.fill('[data-r="yt"]', link); await p.click('[data-r="ytgo"]');
    await p.waitForFunction((i) => window.__yt && window.__yt.criado === i, id, { timeout: 5000 });
  }
  assert(/YouTube Studio/.test(await p.textContent('[data-r="st"]')), "explica como baixar para a análise automática");
  /* marca três pontos no tempo do vídeo e o vencedor de cada um */
  for (const t of [30, 75, 140]) { await p.evaluate((x) => { window.__yt.t = x; }, t); await p.click('[data-r="add"]'); }
  const pts = await p.evaluate(() => vj.estado.pts.map((x) => ({ saque: x.saque, fim: x.fim })));
  assert.deepStrictEqual(pts.map((x) => x.saque), [30, 75, 140], "pontos no tempo do vídeo");
  assert(pts[0].fim <= 75 && pts[1].fim <= 140, "cada ponto vai até o próximo");
  for (const [i, k] of [[1, "A"], [2, "B"], [3, "A"]]) await p.click(`.vj-pt:nth-child(${i}) button[data-k="${k}"]`); // a lista é redesenhada a cada clique
  /* clicar no 2º ponto leva o vídeo até ele */
  await p.click(".vj-pt:nth-child(2) h4");
  assert.strictEqual(await p.evaluate(() => window.__yt.buscas[window.__yt.buscas.length - 1]), 74, "o player vai para o ponto clicado");
  await p.click('[data-r="salvar"]');
  const s = await p.evaluate(() => window.__salvos[0]);
  assert(s && s.youtube === "ZZZZZZZZZZ1" && s.pontos.length === 3 && s.pontos.map((x) => x.venc).join("") === "ABA", "jogo salvo com o vídeo do YouTube e os vencedores");
  assert.strictEqual(s.res.pctGanhos, 67, "resumo do jogo");
  assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
  await b.close(); srv.close();
  console.log("check-video-youtube: ok");
})().catch((e) => { console.error(e.message || e); process.exit(1); });
