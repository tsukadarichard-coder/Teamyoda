/* Pernas e golpes (scout/pernas-golpes.js), sem navegador: partida simulada (scout/video-scout.js + tests/sim-partida.js) com a
   verdade de onde cada jogador andou; a distância, a velocidade máxima, a contagem de golpes e a velocidade da bola saem perto da
   verdade, e o HTML sai com os blocos. Rode: node tests/check-pernas-golpes.js */
const assert = require("assert");
const V = require("../scout/video-scout.js"), PG = require("../scout/pernas-golpes.js"), { simularPartida } = require("./sim-partida.js");

/* 1) movimento: linha reta a 5 m/s com tremor e um pulo da detecção */
let semente = 9; const rnd = () => ((semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648);
const reta = []; for (let i = 0; i <= 30; i++) reta.push([i / 10, -2 + 0.5 * i + (rnd() - 0.5) * 0.12, -11 + (rnd() - 0.5) * 0.12]);
reta[15] = [1.5, 9, -2]; // pulo
const m = PG.movimento(reta);
assert(Math.abs(m.dist - 15) < 1.5, "distância da reta ≈ 15 m: " + m.dist.toFixed(2));
assert(m.vmax > 4.3 && m.vmax < 6, "velocidade máxima ≈ 5 m/s: " + m.vmax.toFixed(2));
const parado = []; for (let i = 0; i <= 40; i++) parado.push([i / 10, 1 + (rnd() - 0.5) * 0.1, 11.5 + (rnd() - 0.5) * 0.1]);
const mp = PG.movimento(parado);
assert(mp.dist < 1, "parado não soma distância (tremor): " + mp.dist.toFixed(2));
assert(mp.pts.every((p) => p.y < 0), "o lado de lá é virado para y < 0");

/* 2) partida simulada */
const sim = simularPartida({ formato: "1set", semente: 5 }), ctx = V.calibrar(sim.cantos, { aspecto: sim.aspecto, corA: sim.cores.nos, corB: sim.cores.ele, maoA: "D", maoB: "D" });
const an = sim.segmentos.map((s) => V.analisarPonto(s, ctx));
const dec = V.decodificar(an, { formato: sim.cfg.formato, atletaComecaPerto: true });
const pts = V.montarScout(an, dec, (k, op) => V.analisarPonto(sim.segmentos[k], ctx, op));
assert(pts.every((p) => p.mov && p.mov.nos && p.mov.nos.length > 10), "cada ponto traz o rastro do jogador");
const R = PG.analisar(pts);
/* verdade: distância percorrida no trecho filmado de cada ponto */
const comp = (l) => { let d = 0; for (let i = 1; i < l.length; i++) d += Math.hypot(l[i][1] - l[i - 1][1], l[i][2] - l[i - 1][2]); return d; };
let dv = 0, dn = 0;
pts.forEach((p) => { const k = sim.segmentos.findIndex((sg) => Math.abs(Math.round(sg.ini * 10) / 10 - p.video.ini) < 0.01); const v = sim.verdade[k]; if (!v || !v.traj) return; dv += comp(v.traj.nos); dn++; });
const dEst = R.nos.dist;
console.log("  distância do jogador: " + dEst.toFixed(0) + " m (verdade " + dv.toFixed(0) + " m em " + dn + " pontos) · máx. " + (R.nos.vmax * 3.6).toFixed(1) + " km/h · " + R.nos.comRastro + "/" + R.pontos + " pontos com rastro");
assert(Math.abs(dEst - dv) / dv < 0.15, "distância dentro de 15% da verdade");
/* golpes: contagem igual à das batidas do scout; velocidade da bola perto da verdade */
const cont = { forehand: 0, backhand: 0 }; pts.forEach((p) => p.batidas.forEach((b) => { if (b.quem === "nos" && cont[b.golpe] != null) cont[b.golpe]++; }));
assert.strictEqual(R.nos.golpes.forehand, cont.forehand); assert.strictEqual(R.nos.golpes.backhand, cont.backhand);
assert(R.nos.golpes.forehand > 5 && R.nos.golpes.backhand > 5, "forehands e backhands contados");
const velV = []; sim.verdade.forEach((v) => v.batidas.forEach((b) => { if (b.quem === "nos" && b.golpe === "forehand") velV.push(b.vel); }));
const mV = velV.reduce((s, x) => s + x, 0) / velV.length;
console.log("  forehand: " + R.nos.velMedia.forehand + " km/h (verdade ~" + Math.round(mV) + ") · FH/BH " + R.nos.golpes.forehand + "/" + R.nos.golpes.backhand + " · rali médio " + R.bolasMedia.toFixed(1));
assert(Math.abs(R.nos.velMedia.forehand - mV) / mV < 0.2, "velocidade do forehand perto da verdade");
assert.strictEqual(R.faixas.reduce((s, f) => s + f.n, 0), R.ralis.length, "faixas de rali somam os pontos");
assert(R.nos.mapa && Math.abs(R.nos.mapa.c.reduce((s, v) => s + v, 0) - 1) < 0.02, "mapa de calor soma 100%");
/* resumo para o histórico e HTML */
const rs = PG.resumo(R);
["distPonto", "vmaxKmh", "velFH", "velBH", "velSaque"].forEach((k) => assert(typeof rs[k] === "number", "resumo: " + k));
const h = PG.html(R, { A: "Ana", B: "Bia" });
["Pernas", "Distância por ponto", "Onde cada um ficou", "Golpes", "Velocidade da bola", "Duração dos ralis", "Ana", "Bia"].forEach((t) => assert(h.includes(t), "HTML tem " + t));
assert(!/NaN|undefined/.test(h), "sem NaN/undefined no HTML");
assert(/Os números de pernas/.test(PG.html(PG.analisar([]), {})), "sem dados: aviso");
/* pontos antigos (só seq, sem rastro) não quebram */
assert.doesNotThrow(() => PG.html(PG.analisar([{ seq: "nS eFH", nos: true }]), {}));
console.log("check-pernas-golpes: ok");
