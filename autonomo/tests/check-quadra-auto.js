/* Quadra achada sozinha (scout/quadra-auto.js): quadros desenhados com câmeras diferentes (atrás e alta, de lado, baixa,
   perto com a linha de fundo de cá cortada), pisos diferentes (saibro, rápida azul, grama), rede, alambrado, jogadores e ruído.
   Os 4 cantos achados têm de cair perto dos verdadeiros. Rode: node tests/check-quadra-auto.js */
const assert = require("assert"), Q = require("../scout/quadra-auto.js"), { camera } = require("./sim-partida.js");
const W = 640, H = 360;
function gerador(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function quadro(c, rnd) {
  const cam = camera({ pos: c.pos, alvo: c.alvo, foco: c.foco }), px = (p) => { const q = cam.proj(p); return [q[0] * W, q[1] * H]; };
  const img = new Uint8ClampedArray(W * H * 4);
  const pinta = (x, y, cor) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; img[i] = cor[0]; img[i + 1] = cor[1]; img[i + 2] = cor[2]; img[i + 3] = 255; };
  /* fundo: céu/alambrado em cima, piso em volta, quadra */
  const horizonte = px([0, 60, 0])[1];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const n = (rnd() - 0.5) * 18, cor = y < horizonte ? c.ceu : c.entorno; pinta(x, y, cor.map((v) => v + n)); }
  const poli = (pts, cor) => { const ys = pts.map((p) => p[1]); for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(H - 1, Math.ceil(Math.max(...ys))); y++) { const xs = []; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1])); } xs.sort((a, b) => a - b); for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.ceil(xs[k])); x <= Math.min(W - 1, xs[k + 1]); x++) pinta(x, y, c.quadra.map((v) => v + (rnd() - 0.5) * 14)); } };
  poli([[-7.5, -15], [7.5, -15], [7.5, 15], [-7.5, 15]].map((p) => px([p[0], p[1], 0])), c.quadra);
  const linha = (a, b, esp, cor) => { const p = px(a), q = px(b), n = Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) * 2); for (let i = 0; i <= n; i++) { const x = p[0] + (q[0] - p[0]) * i / n, y = p[1] + (q[1] - p[1]) * i / n; const e = typeof esp === "function" ? esp(y) : esp; for (let dx = -e; dx <= e; dx++) for (let dy = -e; dy <= e; dy++) if (dx * dx + dy * dy <= e * e + 0.5) pinta(x + dx, y + dy, cor); } };
  const larg = (y) => (y > H * 0.65 ? 1.6 : y > H * 0.45 ? 1 : 0.6);
  const L = 11.885, S = 6.4, D = 5.485, SI = 4.115, branco = [238, 238, 232];
  [[[-D, -L], [D, -L]], [[-D, L], [D, L]], [[-D, -L], [-D, L]], [[D, -L], [D, L]], [[-SI, -L], [-SI, L]], [[SI, -L], [SI, L]], [[-SI, -S], [SI, -S]], [[-SI, S], [SI, S]], [[0, -S], [0, S]], [[0, -L], [0, -L + 0.15]], [[0, L], [0, L - 0.15]]]
    .forEach((s) => linha([s[0][0], s[0][1], 0], [s[1][0], s[1][1], 0], larg, branco));
  /* rede (faixa branca no alto) e postes; alambrado */
  linha([-6.4, 0, 1.07], [6.4, 0, 0.914], 1.2, branco); linha([-6.4, 0, 0], [-6.4, 0, 1.07], 1, [60, 60, 60]); linha([6.4, 0, 0], [6.4, 0, 1.07], 1, [60, 60, 60]);
  for (let k = 0; k < c.distr; k++) { const x0 = rnd() * W, y0 = rnd() * H, w = 6 + rnd() * 30, h2 = 12 + rnd() * 40, cor = rnd() < 0.3 ? [230, 230, 230] : [rnd() * 255, rnd() * 255, rnd() * 255]; for (let y = y0; y < y0 + h2; y++) for (let x = x0; x < x0 + w; x++) pinta(x, y, cor); }
  const cantos = [[-D, -L], [D, -L], [D, L], [-D, L]].map((p) => { const q = cam.proj([p[0], p[1], 0]); return q; });
  return { img: new Uint8Array(img.buffer), cantos };
}
const PISOS = { saibro: { quadra: [178, 92, 58], entorno: [165, 85, 52], ceu: [90, 110, 90] }, rapida: { quadra: [40, 85, 150], entorno: [45, 120, 80], ceu: [120, 130, 140] }, grama: { quadra: [70, 140, 60], entorno: [60, 120, 55], ceu: [150, 170, 190] } };
const CAMERAS = [
  ["atrás e alta", { pos: [0.4, -20.5, 6.2], alvo: [0, 1.5, 0], foco: 1.55 }],
  ["de lado", { pos: [3.2, -19, 5], alvo: [0.5, 2, 0], foco: 1.6 }],
  ["baixa", { pos: [-0.8, -18.5, 2.6], alvo: [0, 3, 0], foco: 1.8 }],
  ["perto, fundo de cá cortado", { pos: [0.2, -16.5, 4], alvo: [0, 5, 0], foco: 1.25 }],
];
const rnd = gerador(4); let pior = 0, n = 0;
for (const [nome, c] of CAMERAS) for (const piso of Object.keys(PISOS)) {
  const f = quadro({ ...c, ...PISOS[piso], distr: 6 }, rnd), r = Q.detectar(f.img, W, H);
  assert(r, nome + " / " + piso + ": não achou a quadra");
  /* os cantos fora do quadro não dá para medir pela imagem: compara a projeção de pontos visíveis (meio das linhas de saque) */
  const err = r.cantos.map((p, i) => Math.hypot((p[0] - f.cantos[i][0]) * W, (p[1] - f.cantos[i][1]) * H));
  const visiveis = f.cantos.map((p) => p[0] >= 0 && p[0] <= 1 && p[1] >= 0 && p[1] <= 1);
  const e = Math.max(...err.filter((_, i) => visiveis[i]).concat(visiveis.some(Boolean) ? [] : [0]));
  pior = Math.max(pior, e); n++;
  console.log("  " + nome + " · " + piso + ": erro máximo " + e.toFixed(1) + " px (cantos visíveis " + visiveis.filter(Boolean).length + "/4) · nota " + r.nota.toFixed(2));
  assert(e < 6, nome + " / " + piso + ": cantos longe demais (" + e.toFixed(1) + " px)");
}
console.log("check-quadra-auto: ok (" + n + " quadros, pior " + pior.toFixed(1) + " px)");
