/* Bola por IA (scout/bola-ia.js, rede WASB em ONNX) no navegador, num trecho do vídeo sintético com a posição verdadeira da
   bola: acerto quadro a quadro, conversão de coordenadas com a imagem em outro formato (4:3, com faixas pretas) e o caminho
   completo pelo QLVisao.processar (os candidatos da IA no lugar do detector por pixels). Sem placa de vídeo no teste:
   roda em WebAssembly (lento, ~3 s por trio de quadros), por isso só meio segundo de vídeo.
   O onnxruntime-web vem de uma cópia local (ORT_DIR). Precisa de ffmpeg e Pillow (gerador do vídeo).
   Rode: node tests/check-bola-ia.js */
const fs = require("fs"), path = require("path"), http = require("http"), os = require("os"), cp = require("child_process"), assert = require("assert");
const ORT_DIR = process.env.ORT_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/ortweb/package/dist";
try { cp.execSync("ffmpeg -version && python3 -c 'import PIL'", { stdio: "ignore" }); } catch (e) { console.log("check-bola-ia: pulado (sem ffmpeg ou Pillow)"); process.exit(0); }
if (!fs.existsSync(path.join(ORT_DIR, "ort.min.js"))) { console.log("check-bola-ia: pulado (defina ORT_DIR com o dist do onnxruntime-web 1.20.1)"); process.exit(0); }
const raiz = path.join(__dirname, ".."), pasta = fs.mkdtempSync(path.join(os.tmpdir(), "qlbola-")), video = path.join(pasta, "partida.mp4");
cp.execFileSync("node", [path.join(__dirname, "gerar-video-sintetico.js"), video, JSON.stringify({ maxPontos: 2, semente: 5 })], { stdio: "ignore" });
const D = JSON.parse(fs.readFileSync(video.replace(/\.mp4$/, ".json"), "utf8"));
/* meio segundo com a bola em todos os quadros, logo depois do saque (em voo, longe dos jogadores) */
let ini = -1;
for (let i = Math.round((D.hits[0] + 0.1) * D.fps); i < D.quadros.length - 15 && ini < 0; i++) if (D.quadros.slice(i, i + 15).every((q) => q && q.b && q.b.length)) ini = i;
assert(ini > 0, "trecho com bola no vídeo sintético");
const T0 = (ini + 0.2) / D.fps, T1 = (ini + 14.6) / D.fps;

const pagina = `<!doctype html><meta charset=utf-8>
<script src=/scout/video-audio.js></script><script src=/scout/video-scout.js></script><script src=/scout/quadra-auto.js></script><script src=/scout/video-visao.js></script><script src=/scout/bola-ia.js></script>`;
const srv = http.createServer((q, r) => {
  const u = q.url.split("?")[0];
  if (u === "/") { r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return r.end(pagina); }
  if (u === "/partida.mp4") { r.writeHead(200, { "content-type": "video/mp4" }); return r.end(fs.readFileSync(video)); }
  const f = path.join(raiz, u); if (f.startsWith(raiz) && fs.existsSync(f)) { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(fs.readFileSync(f)); }
  r.writeHead(404); r.end();
}).listen(0);

(async () => {
  const { chromium } = require("/opt/node22/lib/node_modules/playwright");
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const p = await b.newPage(), erros = [];
  p.on("pageerror", (e) => erros.push(e.message));
  let baixou = 0;
  await p.route(/onnxruntime-web@1\.20\.1\/dist\/(.*)$/, async (rt) => { const n = /dist\/(.*)$/.exec(rt.request().url())[1]; baixou++; await rt.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-type": n.endsWith(".wasm") ? "application/wasm" : "text/javascript" }, body: fs.readFileSync(path.join(ORT_DIR, n)) }); });
  await p.goto("http://localhost:" + srv.address().port + "/");

  /* sem placa de vídeo e sem pedir WebAssembly: não baixa nada e o app fica no detector por pixels */
  assert.strictEqual(await p.evaluate(() => QLBolaIA.carregar({ gpu: false })), null, "sem placa de vídeo: sem IA");
  assert.strictEqual(baixou, 0, "sem placa de vídeo: nada baixado");

  const r = await p.evaluate(async ([T0, T1, cantos, W, H]) => {
    const ia = await QLBolaIA.carregar({ wasm: true, gpu: false });
    const file = new File([await (await fetch("/partida.mp4")).blob()], "partida.mp4", { type: "video/mp4" });
    const fonte = await QLVisao.fonteWebCodecs(file);
    /* o mesmo quadro direto (16:9) e dentro de uma imagem 4:3 com faixas pretas em cima e embaixo */
    const tr = ia.trecho(), tr43 = ia.trecho(), H43 = W * 3 / 4, off = (H43 - H) / 2;
    const c43 = document.createElement("canvas"); c43.width = W; c43.height = H43; const x43 = c43.getContext("2d");
    const direto = [], em43 = [];
    await fonte.trecho(T0, T1, async (t, img, wi, he) => {
      const a = { t }, a43 = { t };
      await tr.quadro(img, wi, he, null, a); direto.push(a);
      x43.fillStyle = "#000"; x43.fillRect(0, 0, W, H43); x43.drawImage(img, 0, off, W, H);
      await tr43.quadro(c43, W, H43, null, a43); em43.push(a43);
    });
    await tr.fim(); await tr43.fim();
    /* caminho completo: processar com um trecho só */
    const cal = QLVideoScout.calibrar(cantos, { aspecto: W / H });
    const pr = await QLVisao.processar(file, null, [{ ini: T0, fim: T1, hits: [] }], cal, { pose: null, acompanhar: false, bolaIA: { wasm: true, limiteMs: 1e9 } });
    const tira = (l) => l.map((q) => ({ t: q.t, b: q.ia || [] }));
    return { via: ia.via, direto: tira(direto), em43: tira(em43), off: off / H43, f43: H / H43, pr: { bola: pr.bola, quadros: pr.dados[0].quadros.map((q) => ({ t: q.t, b: q.bolas })) }, medida: tr.medida() };
  }, [T0, T1, D.cantos, D.W, D.H]);

  const verdade = (t) => { const q = D.quadros[Math.round(t * D.fps)]; return q && q.b && q.b[0]; };
  const dist = (a, v) => Math.hypot((a[0] - v[0]) * D.W, (a[1] - v[1]) * D.H);
  const conta = (l, conv) => { let certo = 0; l.forEach((q) => { const v = verdade(q.t); if (v && q.b[0] && dist(conv(q.b[0]), v) < 12) certo++; }); return certo; };
  const nd = conta(r.direto, (p) => p), n43 = conta(r.em43, (p) => [p[0], (p[1] - r.off) / r.f43]), npr = conta(r.pr.quadros, (p) => p);
  if (process.env.DEPURA) r.direto.forEach((q) => console.log(q.t, JSON.stringify(q.b), JSON.stringify(verdade(q.t))));
  console.log("  " + r.direto.length + " quadros · IA (" + r.via + ", " + Math.round(r.medida.msMediana) + " ms por trio) acertou a bola em " + nd + " · imagem 4:3 " + n43 + " · pelo processar " + npr + " (" + r.pr.bola + ")");
  assert.strictEqual(r.via, "wasm");
  assert(r.direto.length >= 12, "quadros do trecho lidos (" + r.direto.length + ")");
  assert(nd >= r.direto.length * 0.6, "a IA acha a bola na maior parte dos quadros (" + nd + "/" + r.direto.length + ")");
  assert(n43 >= nd - 2, "a mesma bola, no lugar certo, com a imagem em 4:3 (" + n43 + " de " + nd + ")");
  assert.strictEqual(r.pr.bola, "ia-wasm", "processar usa a IA");
  assert(npr >= nd - 2, "processar entrega os candidatos da IA em cada quadro (" + npr + " de " + nd + ")");
  assert(r.pr.quadros.every((q) => q.b.length <= 4), "no máximo 4 candidatos por quadro");
  assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
  console.log("check-bola-ia: ok");
  await b.close(); srv.close(); fs.rmSync(pasta, { recursive: true, force: true });
})().catch((e) => { console.error(e.message || e); srv.close(); process.exit(1); });
