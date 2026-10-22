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
const json = { W, H, fps, linhas: segLinhas, quadros, cantos: sim.cantos, verdade: sim.verdade, pontos: sim.pontos, cores: sim.cores, cfg: sim.cfg, hits: [].concat(...sim.segmentos.map((s) => s.hits)), placar: require("../scout/video-scout.js").Placar.texto(sim.placar) };
fs.writeFileSync(saida.replace(/\.mp4$/, ".json"), JSON.stringify(json));
/* áudio: estalos nas batidas + ruído */
const sr = 48000, n = Math.round(fim * sr), a = Buffer.alloc(n * 2);
let r = 1; for (let i = 0; i < n; i++) { r = (r * 16807) % 2147483647; a.writeInt16LE(Math.round(((r / 2147483647) - 0.5) * 0.02 * 32767), i * 2); }
json.hits.forEach((h) => { const i0 = Math.round(h * sr); for (let k = 0; k < 1200 && i0 + k < n; k++) { const v = a.readInt16LE((i0 + k) * 2) / 32767 + 0.6 * Math.exp(-k / 190) * Math.sin(2 * Math.PI * 2300 * k / sr); a.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), (i0 + k) * 2); } });
const wav = saida.replace(/\.mp4$/, ".pcm"); fs.writeFileSync(wav, a);
cp.execFileSync("python3", ["-I", path.join(__dirname, "desenhar-partida.py"), saida.replace(/\.mp4$/, ".json"), saida, wav], { stdio: "inherit" });
fs.unlinkSync(wav);
console.log(JSON.stringify({ saida, duracao: fim, pontos: sim.pontos.length, trechos: sim.segmentos.length, placar: json.placar }));
