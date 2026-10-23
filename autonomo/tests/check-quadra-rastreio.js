/* Câmera na mão: a quadra acompanhada quadro a quadro (QLQuadraAuto.Acompanhador) num vídeo sintético em que a câmera gira
   (guinada ±6°, arfagem ±1,5°). Compara a imagem de referência que o acompanhamento dá a cada quadro com a verdadeira, em
   pontos da quadra. Precisa de ffmpeg e Python com Pillow. Rode: node tests/check-quadra-rastreio.js */
const fs = require("fs"), path = require("path"), os = require("os"), cp = require("child_process"), assert = require("assert");
try { cp.execSync("ffmpeg -version && python3 -c 'import PIL'", { stdio: "ignore" }); } catch (e) { console.log("check-quadra-rastreio: pulado (sem ffmpeg ou Pillow)"); process.exit(0); }
const Q = require("../scout/quadra-auto.js"), V = require("../scout/video-scout.js");
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "qlrastreio-")), video = path.join(pasta, "pan.mp4");
cp.execFileSync("node", [path.join(__dirname, "gerar-video-sintetico.js"), video, JSON.stringify({ maxPontos: 3, semente: 5, panoramica: true })], { stdio: "ignore" });
const D = JSON.parse(fs.readFileSync(video.replace(/\.mp4$/, ".json"), "utf8")), W = 640, H = 360, F = W * H * 4;
const cal = V.calibrar(D.cantos, { aspecto: D.W / D.H }), ac = Q.Acompanhador(cal.Hi);
const pts = [[-5.5, -11.9], [5.5, -11.9], [5.5, 11.9], [-5.5, 11.9], [0, 0]].map((p) => V.aplicarH(cal.Hi, p));
const erros = [], movs = [];
let buf = Buffer.alloc(0), k = 0, perdidos = 0;
const ff = cp.spawn("ffmpeg", ["-v", "error", "-i", video, "-vf", `scale=${W}:${H}`, "-f", "rawvideo", "-pix_fmt", "rgba", "-"]);
ff.stdout.on("data", (d) => {
  buf = Buffer.concat([buf, d]);
  while (buf.length >= F) {
    const fr = new Uint8Array(buf.subarray(0, F)); buf = buf.subarray(F);
    if (k % 150 === 0) ac.novoTrecho(); // como no começo de cada ponto
    const r = ac.quadro(fr, W, H); if (!r.ok) perdidos++;
    /* quadro → referência: pelo acompanhamento e pela verdade (inversa da rotação da câmera) */
    const G = Q.multiplicar(cal.Hi, Q.inverter(r.Hn)), Gv = Q.inverter(D.mov[k]);
    const noQuadro = pts.map((p) => V.aplicarH(D.mov[k], p));
    erros.push(Math.max(...noQuadro.map((p) => { const a = V.aplicarH(G, p), b = V.aplicarH(Gv, p); return Math.hypot((a[0] - b[0]) * W, (a[1] - b[1]) * H); })));
    movs.push(Math.max(...pts.map((p, i) => Math.hypot((noQuadro[i][0] - p[0]) * W, (noQuadro[i][1] - p[1]) * H))));
    k++;
  }
});
ff.on("close", () => {
  const o = erros.slice().sort((a, b) => a - b), q = (f) => o[Math.floor((o.length - 1) * f)];
  console.log("  " + k + " quadros · câmera deslocou até " + Math.max(...movs).toFixed(0) + " px · erro mediano " + q(0.5).toFixed(1) + " px, 95% abaixo de " + q(0.95).toFixed(1) + " px · perdidos " + perdidos);
  assert(Math.max(...movs) > 40, "a câmera de fato se mexe no vídeo de teste");
  assert(q(0.5) < 2.5 && q(0.95) < 5, "a quadra acompanha a câmera");
  assert(perdidos < k * 0.05, "quase nenhum quadro perdido");
  fs.rmSync(pasta, { recursive: true, force: true });
  console.log("check-quadra-rastreio: ok");
});
