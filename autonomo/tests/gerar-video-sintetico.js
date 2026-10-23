/* Gera um vídeo sintético de partida (quadra, jogadores, bola e o som das batidas) a partir do simulador, para o teste de
   ponta a ponta do scout automático no navegador. Saída: VP9 + Opus em MP4 (o Chromium dos testes não tem H.264/AAC).
   node tests/gerar-video-sintetico.js saida.mp4 '{"maxPontos":8}'  → grava também saida.json (verdade, cantos, poses por quadro) */
const fs = require("fs"), path = require("path"), cp = require("child_process");
const { simularPartida } = require("./sim-partida.js");
const saida = process.argv[2], o = Object.assign({ maxPontos: 8, formato: "1set", falsos: 0, falhaBola: 0, inicio: 4, pausaFalta: 4.5, pausaPonto: 4, fps: 30 }, JSON.parse(process.argv[3] || "{}"));
const sim = simularPartida(o), W = 960, H = 540, fps = o.fps;
const fim = sim.segmentos[sim.segmentos.length - 1].fim + 2;
/* quadros por tempo: poses e bola de cada trecho (fora dos trechos, quadra vazia) */
const porQuadro = new Map();
sim.segmentos.forEach((s) => s.quadros.forEach((q) => porQuadro.set(Math.round(q.t * fps), q)));
const linhas = require("../scout/video-scout.js").linhasQuadra();
const cal = require("../scout/video-scout.js").calibrar(sim.cantos, { aspecto: W / H });
const segLinhas = linhas.map((l) => [require("../scout/video-scout.js").aplicarH(cal.Hi, l[0]), require("../scout/video-scout.js").aplicarH(cal.Hi, l[1])]);
const quadros = [];
for (let f = 0; f <= Math.round(fim * fps); f++) {
  const q = porQuadro.get(f);
  quadros.push(q ? { j: q.jog.map((j) => ({ lm: j.lm ? j.lm.map((p) => [+(p.x.toFixed(4)), +(p.y.toFixed(4))]) : null, pe: j.pe, cor: j.cor })), b: q.bolas.slice(0, 1) } : null);
}
/* panoramica: a câmera gira na mão (guinada ±6°, arfagem ±1,5°) — cada quadro é a imagem da câmera parada levada por
   M = K·R·K⁻¹. mov[f]: imagem normalizada parada → do quadro; inv[f]: coeficientes do PIL (pixel do quadro → pixel parado) */
let mov = null, inv = null;
if (o.panoramica) {
  const f = 0.9 * W, mul = (A, B) => { const C = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C.push(A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]); return C; };
  const K = [f, 0, W / 2, 0, f, H / 2, 0, 0, 1], Ki = [1 / f, 0, -W / (2 * f), 0, 1 / f, -H / (2 * f), 0, 0, 1];
  const S = [W, 0, 0, 0, H, 0, 0, 0, 1], Si = [1 / W, 0, 0, 0, 1 / H, 0, 0, 0, 1];
  mov = []; inv = [];
  for (let k = 0; k < quadros.length; k++) {
    const t = k / fps, g = 6 * Math.PI / 180 * Math.sin(2 * Math.PI * t / 7), a = 1.5 * Math.PI / 180 * Math.sin(2 * Math.PI * t / 4.3);
    const Ry = [Math.cos(g), 0, Math.sin(g), 0, 1, 0, -Math.sin(g), 0, Math.cos(g)], Rx = [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
    const Rt = mul(Rx, Ry), RtT = [Rt[0], Rt[3], Rt[6], Rt[1], Rt[4], Rt[7], Rt[2], Rt[5], Rt[8]];
    const M = mul(K, mul(Rt, Ki)), Mi = mul(K, mul(RtT, Ki));
    mov.push(mul(Si, mul(M, S)).map((v, i, A) => +(v / A[8]).toPrecision(9)));
    inv.push(Mi.map((v) => v / Mi[8]).slice(0, 8));
  }
}
const json = { W, H, fps, linhas: segLinhas, quadros, mov, inv, cantos: sim.cantos, verdade: sim.verdade, pontos: sim.pontos, cores: sim.cores, cfg: sim.cfg, hits: [].concat(...sim.segmentos.map((s) => s.hits)), placar: require("../scout/video-scout.js").Placar.texto(sim.placar) };
fs.writeFileSync(saida.replace(/\.mp4$/, ".json"), JSON.stringify(json));
/* áudio: estalos nas batidas + ruído */
const sr = 48000, n = Math.round(fim * sr), a = Buffer.alloc(n * 2);
let r = 1; for (let i = 0; i < n; i++) { r = (r * 16807) % 2147483647; a.writeInt16LE(Math.round(((r / 2147483647) - 0.5) * 0.02 * 32767), i * 2); }
json.hits.forEach((h) => { const i0 = Math.round(h * sr); for (let k = 0; k < 1200 && i0 + k < n; k++) { const v = a.readInt16LE((i0 + k) * 2) / 32767 + 0.6 * Math.exp(-k / 190) * Math.sin(2 * Math.PI * 2300 * k / sr); a.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), (i0 + k) * 2); } });
const wav = saida.replace(/\.mp4$/, ".pcm"); fs.writeFileSync(wav, a);
cp.execFileSync("python3", ["-I", path.join(__dirname, "desenhar-partida.py"), saida.replace(/\.mp4$/, ".json"), saida, wav], { stdio: "inherit" });
fs.unlinkSync(wav);
console.log(JSON.stringify({ saida, duracao: fim, pontos: sim.pontos.length, trechos: sim.segmentos.length, placar: json.placar }));
