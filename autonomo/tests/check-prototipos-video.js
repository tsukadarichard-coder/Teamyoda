var S = require("../../prototipos/video-scout/segmentador.js"), a = require("assert");
var taxa = 8000, dur = 60, x = new Float32Array(taxa * dur), i, seed = 1;
function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; }
for (i = 0; i < x.length; i++) x[i] = rnd() * 0.02;
function bate(t) { var s = Math.round(t * taxa); for (var k = 0; k < 400; k++) x[s + k] += 0.8 * Math.exp(-k / 80) * (k % 2 ? 1 : -1); }
var reais = [5, 6.4, 7.8, 9.1, 10.5,   25, 26.2,   40, 41, 42.3, 43.4, 44.6, 45.9];
reais.forEach(bate);
var en = S.energia(x, taxa, 10), h = S.batidas(en, 5), p = S.pontos(h, { gap: 6, dur: dur });
a.strictEqual(h.length, reais.length, "batidas " + h.length);
reais.forEach(function (t, k) { a.ok(Math.abs(h[k].t - t) < 0.05, "tempo " + t + " vs " + h[k].t); });
a.strictEqual(p.length, 3);
a.deepStrictEqual(p.map(function (q) { return q.golpes; }), [5, 2, 6]);
a.ok(p[0].ini === 3 && Math.abs(p[0].saque - 5) < 0.05);
var pl = S.placar(["A","A","A","A","B","B","B","B","A"]);
a.strictEqual(pl[3].games.join("-"), "1-0"); a.strictEqual(pl[7].games.join("-"), "1-1"); a.strictEqual(pl[8].pontos, "15-0");
var l = ["A","A","A","B","B","B","A","B","B","B"]; var q = S.placar(l); a.strictEqual(q[5].pontos, "40-40"); a.strictEqual(q[6].pontos, "Vant. A"); a.strictEqual(q[8].pontos, "Vant. B"); a.strictEqual(q[9].games.join("-"), "0-1");
console.log("video: ok", h.length, "batidas,", p.length, "pontos");
