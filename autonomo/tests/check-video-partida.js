/* Jogo em vídeo com a partida inteira e em qualquer formato (scout/video-audio.js + video-jogo.js).
   1) Node: a tabela de áudio lida do MP4/MOV/3GP (moov) bate amostra por amostra com o ffprobe (AAC, Opus, PCM).
   2) Navegador: partida longa em MP4 (moov no fim) lida em partes via WebCodecs, MOV com PCM > 300 MB lido direto,
      AVI pelo leitor universal (ffmpeg.wasm) com clipe convertido para rever o ponto; os pontos batem com o gabarito.
   Precisa do ffmpeg/ffprobe na máquina (gera os vídeos de teste). O núcleo do ffmpeg.wasm vem de FFMPEG_CORE_DIR
   (pasta com ffmpeg-core.js e ffmpeg-core.wasm do @ffmpeg/core@0.12.10); sem ela, a parte do AVI é pulada.
   Rode: node tests/check-video-partida.js [minutos-da-partida-longa, padrão 90] */
const fs = require("fs"), path = require("path"), http = require("http"), os = require("os"), cp = require("child_process"), assert = require("assert");
try { cp.execSync("ffmpeg -version && ffprobe -version", { stdio: "ignore" }); } catch (e) { console.log("check-video-partida: pulado (sem ffmpeg/ffprobe)"); process.exit(0); }
const A = require("../scout/video-audio.js");
const raiz = path.join(__dirname, "..");
const CORE = process.env.FFMPEG_CORE_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/npmv/x/ffmpeg-core-0.12.10/package/dist/umd";
const temCore = fs.existsSync(path.join(CORE, "ffmpeg-core.wasm"));
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "qlvideo-"));
const minLongo = +(process.argv[2] || 90);

/* partida sintética: pontos de 3 a 8 batidas (cliques de 2,3 kHz) separados por 14–26 s de ruído; PCM s16le mono 16 kHz */
function partida(seg) {
  let x = seg; const rnd = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648);
  const saques = [], hits = []; let t = 8;
  while (t < seg - 30) { const n = 3 + Math.floor(rnd() * 6), h = [t]; for (let k = 1; k < n; k++) h.push(h[k - 1] + 0.9 + rnd() * 0.5); saques.push(t); hits.push(...h); t = h[h.length - 1] + 14 + rnd() * 12; }
  return { saques, hits };
}
function gerar(nome, seg, args) {
  const sr = 16000, { saques: pts, hits } = partida(seg);
  const raw = path.join(pasta, nome + ".raw"), fd = fs.openSync(raw, "w"), clk = 400;
  let ruido = 1;
  for (let b0 = 0; b0 < seg * sr; b0 += sr * 60) {
    const n = Math.min(sr * 60, seg * sr - b0), buf = Buffer.alloc(n * 2);
    for (let i = 0; i < n; i++) { ruido = (ruido * 16807) % 2147483647; const v = (ruido / 2147483647 - 0.5) * 0.03 + 0.02 * Math.sin(2 * Math.PI * 120 * (b0 + i) / sr); buf.writeInt16LE(Math.round(v * 32767), i * 2); }
    hits.filter((h) => h * sr >= b0 - clk && h * sr < b0 + n).forEach((h) => { const i0 = Math.round(h * sr) - b0; for (let k = 0; k < clk; k++) { const i = i0 + k; if (i < 0 || i >= n) continue; const v = buf.readInt16LE(i * 2) / 32767 + 0.6 * Math.exp(-k / 64) * Math.sin(2 * Math.PI * 2300 * k / sr); buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2); } });
    fs.writeSync(fd, buf);
  }
  fs.closeSync(fd);
  const saida = path.join(pasta, nome);
  cp.execSync(`ffmpeg -v error -y -f s16le -ar ${sr} -ac 1 -i "${raw}" -f lavfi -i color=c=green:s=64x36:r=2 -shortest -map 1:v -map 0:a ${args} "${saida}"`);
  fs.unlinkSync(raw);
  return { arq: saida, pontos: pts };
}
function moovDe(arq) {
  const fd = fs.openSync(arq, "r"), sz = fs.fstatSync(fd).size, h = Buffer.alloc(16); let o = 0;
  while (o + 8 <= sz) { fs.readSync(fd, h, 0, 16, o); let t = h.readUInt32BE(0); const tp = h.toString("latin1", 4, 8); if (t === 1) t = Number(h.readBigUInt64BE(8)); else if (t === 0) t = sz - o; if (tp === "moov") { const b = Buffer.alloc(t); fs.readSync(fd, b, 0, t, o); fs.closeSync(fd); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); } o += t; }
  fs.closeSync(fd); return null;
}

const t0 = Date.now();
const V = {
  aacMov: gerar("celular.mov", 300, "-c:v libx264 -preset ultrafast -c:a aac -ar 48000 -ac 2"),
  aac3gp: gerar("celular.3gp", 240, "-c:v libx264 -preset ultrafast -c:a aac -ar 44100 -ac 1"),
  opusLongo: gerar("partida-longa.mp4", minLongo * 60, "-c:v libx264 -preset ultrafast -g 60 -c:a libopus -b:a 24k -ar 48000"),
  pcmMov: gerar("camera.mov", 1800, "-c:v libx264 -preset ultrafast -c:a pcm_s16le -ar 48000 -ac 2"),
  avi: gerar("antigo.avi", 300, "-c:v mpeg4 -c:a libmp3lame -ar 44100"),
};
console.log("  vídeos de teste gerados em", ((Date.now() - t0) / 1000).toFixed(0) + "s");

/* 1) tabela de áudio × ffprobe */
[V.aacMov, V.aac3gp, V.opusLongo, V.pcmMov].forEach((v) => {
  const tab = A.lerTabelaAudio(moovDe(v.arq)), nome = path.basename(v.arq);
  assert(tab && tab.cfg.codec, nome + ": sem trilha de áudio reconhecida");
  const pk = cp.execSync(`ffprobe -v error -select_streams a:0 -show_entries packet=pos,size -of csv=p=0 "${v.arq}"`, { maxBuffer: 1 << 28 }).toString().trim().split("\n").map((l) => l.split(",").map(Number));
  if (tab.pedacos[0].amostras) {
    const am = []; tab.pedacos.forEach((p) => p.amostras.forEach((s) => am.push([p.off + s.rel, s.tam])));
    assert.strictEqual(am.length, pk.length, nome + ": número de amostras");
    am.forEach((a, i) => assert(a[0] === pk[i][1] && a[1] === pk[i][0], nome + ": amostra " + i + " fora do lugar"));
  } else {
    assert.strictEqual(tab.pedacos.reduce((s, p) => s + p.tam, 0), pk.reduce((s, p) => s + p[0], 0), nome + ": bytes de PCM");
  }
  console.log("  tabela ok:", nome, tab.cfg.codec, tab.cfg.taxa + " Hz", (tab.cfg.dur / 60).toFixed(0) + " min");
});

/* 2) no navegador */
const pagina = `<!doctype html><meta charset=utf-8><link rel=stylesheet href=/scout/movimento.css><div id=a></div>
<script src=/scout/video-segmentador.js></script><script src=/scout/video-audio.js></script><script src=/scout/video-scout.js></script><script src=/scout/video-visao.js></script><script src=/scout/video-scout-ui.js></script><script src=/scout/video-jogo.js></script>
<script>window.vj=QLVideoJogo.montar(document.getElementById("a"),{atleta:"Ana"});</script>`;
const srv = http.createServer((q, r) => { const u = q.url.split("?")[0]; if (u === "/") { r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return r.end(pagina); } const f = path.join(raiz, u); if (f.startsWith(raiz) && fs.existsSync(f)) { r.writeHead(200, { "content-type": u.endsWith(".css") ? "text/css" : "text/javascript" }); return r.end(fs.readFileSync(f)); } r.writeHead(404); r.end(); }).listen(0);
(async () => {
  const { chromium } = require("/opt/node22/lib/node_modules/playwright");
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const erros = [];
  async function analisar(v, comClipe) {
    const p = await b.newPage({ viewport: { width: 1000, height: 900 } });
    p.on("pageerror", (e) => erros.push(e.message));
    await p.route(/@ffmpeg\/core@0\.12\.10\/dist\/umd\/(.*)$/, async (r) => { const n = /umd\/(.*)$/.exec(r.request().url())[1]; if (!temCore) return r.abort(); await r.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-type": n.endsWith(".wasm") ? "application/wasm" : "text/javascript" }, body: fs.readFileSync(path.join(CORE, n)) }); });
    await p.goto("http://localhost:" + srv.address().port + "/");
    const t = Date.now(); await p.setInputFiles("input[type=file]", v.arq); await p.waitForTimeout(500); await p.click('[data-r="go"]');
    await p.waitForFunction(() => /pontos detectados|Erro/.test(document.querySelector('[data-r="st"]').textContent), null, { timeout: 600000 });
    const r = await p.evaluate(() => ({ msg: document.querySelector('[data-r="st"]').textContent, pts: vj.estado.pts.map((x) => x.saque), via: vj.estado.via, dur: vj.estado.dur, clipes: vj.estado.clipes,
      barra: getComputedStyle(document.querySelector('[data-r="prog"]')).display }));
    const nome = path.basename(v.arq), acertos = v.pontos.filter((s) => r.pts.some((x) => Math.abs(x - s) < 1)).length;
    assert(!/Erro/.test(r.msg), nome + ": " + r.msg);
    assert(acertos >= v.pontos.length * 0.97 && r.pts.length <= v.pontos.length * 1.03, nome + ": " + acertos + "/" + v.pontos.length + " pontos (detectados " + r.pts.length + ")");
    assert.strictEqual(r.barra, "none", nome + ": a barra de progresso some no fim");
    console.log("  " + nome + ": " + acertos + "/" + v.pontos.length + " pontos · via " + r.via + " · " + ((Date.now() - t) / 1000).toFixed(0) + " s");
    if (comClipe) {
      assert(r.clipes, nome + ": o navegador não exibe AVI; deveria entrar no modo de clipes");
      await p.click(".vj-pt >> nth=2 >> h4");
      await p.waitForFunction(() => { const v = document.querySelector("video"); return v.src.startsWith("blob:") && v.videoWidth > 0 && /Ponto 3/.test(document.querySelector('[data-r="st"]').textContent); }, null, { timeout: 120000 });
      await p.waitForTimeout(800);
      const ag = await p.evaluate(() => { document.querySelector('[data-r="add"]').click(); return vj.estado.pts.filter((x) => x.suspeito === "adicionado manualmente")[0].saque; });
      const ini = r.pts[2] - 2; assert(ag >= ini && ag < ini + 15, nome + ": '+ Ponto aqui' no clipe usa o tempo da partida (" + ag + ")");
      console.log("  " + nome + ": clipe do ponto 3 convertido e exibido; '+ Ponto aqui' em " + ag.toFixed(1) + " s");
    }
    await p.close();
  }
  await analisar(V.opusLongo);
  await analisar(V.pcmMov);
  if (temCore) await analisar(V.avi, true); else console.log("  AVI pulado (defina FFMPEG_CORE_DIR)");
  assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
  await b.close(); srv.close(); fs.rmSync(pasta, { recursive: true, force: true });
  console.log("check-video-partida: ok");
})().catch((e) => { console.error(e.message || e); try { fs.rmSync(pasta, { recursive: true, force: true }); } catch (x) {} process.exit(1); });
