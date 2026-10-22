/* Scout automático (scout/video-scout.js), sem navegador:
   1) o placar do motor é idêntico ao do scout do app (aplicaPonto/quemSaca/ladoDoSaque/rotuloPontos tirados do index.html), em todos
      os formatos, com e sem vantagem e super tie-break; a troca de lado segue a regra (games ímpares, a cada 6 pontos do tie-break);
   2) partidas simuladas com ruído (pose tremida, 40% da bola perdida, detecções falsas, sons que não são batidas): acurácia mínima
      por campo e placar final reconstruído;
   3) os pontos saem no formato do scout do app. Rode: node tests/check-video-scout.js */
const fs = require("fs"), path = require("path"), assert = require("assert");
const V = require("../scout/video-scout.js"), { simularPartida } = require("./sim-partida.js");
const P = V.Placar;

/* 1) placar igual ao do app */
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const pega = (nome) => { const i = html.indexOf(nome); assert(i >= 0, "não achei " + nome + " no index.html"); let d = 0, j = html.indexOf("{", i); for (let k = j; k < html.length; k++) { if (html[k] === "{") d++; else if (html[k] === "}" && --d === 0) return html.slice(i, k + 1); } };
const app = new Function(["const PONTOS_TENIS = [\"0\", \"15\", \"30\", \"40\"];", pega("function placarInicial("), pega("function rotuloPontos("), pega("function gamesParaSet("), pega("function aplicaPonto("), pega("function quemSaca("), pega("function ladoDoSaque(")].join("\n") +
  "\nreturn { placarInicial, rotuloPontos, aplicaPonto, quemSaca, ladoDoSaque };")();
let semente = 3; const rnd = () => ((semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648);
let pontosComparados = 0;
for (const formato of ["3sets", "1set", "4games"]) for (const semVantagem of [false, true]) for (const superTiebreakDecisivo of [false, true]) for (let rep = 0; rep < 6; rep++) {
  const cfg = { formato, semVantagem, superTiebreakDecisivo }, saca = rnd() < 0.5 ? "nos" : "ele";
  let a = app.placarInicial(formato, saca, semVantagem, superTiebreakDecisivo), m = P.inicial(cfg, saca), pNos = 0.3 + rnd() * 0.4, ends = 0;
  while (!a.fim && pontosComparados < 1e6) {
    assert.strictEqual(P.quemSaca(m), app.quemSaca(a), "quem saca");
    assert.strictEqual(P.lado(m), app.ladoDoSaque(a), "lado do saque");
    assert.strictEqual(P.rotulo(m), app.rotuloPontos(a), "placar do game");
    const nos = rnd() < pNos, m2 = P.aplicar(m, nos);
    if (P.trocaLado(m, m2)) ends++;
    a = app.aplicaPonto(a, nos); m = m2; pontosComparados++;
    assert.deepStrictEqual([m.p, m.g, m.sets, m.saque, m.tiebreak, m.fim, m.vencedor], [a.p, a.g, a.sets, a.saque, a.tiebreak, a.fim, a.vencedor], "estado do placar (" + formato + ")");
  }
}
/* troca de lado: depois do 1º, 3º, 5º game; no tie-break a cada 6 pontos */
(function () {
  let e = P.inicial({ formato: "1set" }, "nos"), trocas = [];
  for (let g = 0; g < 12; g++) for (let k = 0; k < 4; k++) { const n = P.aplicar(e, g % 2 === 0); if (P.trocaLado(e, n)) trocas.push(P.texto(n)); e = n; }
  assert.deepStrictEqual(trocas.slice(0, 3), ["1-0", "2-1", "3-2"], "troca nos games ímpares: " + trocas.join(" "));
  assert(e.tiebreak, "6-6 vai para o tie-break");
  let tb = 0; for (let k = 0; k < 6; k++) { const n = P.aplicar(e, k % 2 === 0); if (P.trocaLado(e, n)) tb++; e = n; }
  assert.strictEqual(tb, 1, "tie-break troca de lado aos 6 pontos");
})();
console.log("  placar: " + pontosComparados + " pontos idênticos ao scout do app");

/* 2) acurácia no simulador */
function avaliar(o) {
  const sim = simularPartida(o), ctx = V.calibrar(sim.cantos, { aspecto: sim.aspecto, corA: sim.cores.nos, corB: sim.cores.ele, maoA: o.maoA || "D", maoB: o.maoB || "D" });
  const t0 = Date.now(), an = sim.segmentos.map((s) => V.analisarPonto(s, ctx));
  const dec = V.decodificar(an, { formato: sim.cfg.formato, atletaComecaPerto: true, placarFinal: o.final ? P.texto(sim.placar) : null });
  const pts = V.montarScout(an, dec, (k, op) => V.analisarPonto(sim.segmentos[k], ctx, op)), ms = Date.now() - t0;
  const idx = pts.map((p) => sim.segmentos.findIndex((sg) => Math.abs(Math.round(sg.ini * 10) / 10 - p.video.ini) < 0.01));
  const ac = (f) => { let ok = 0, n = 0; pts.forEach((p, i) => { const v = sim.verdade[idx[i]]; if (!v) return; const r = f(p, v); if (r == null) return; n++; ok += r ? 1 : 0; }); return n ? ok / n : 1; };
  const quem = ac((p, v) => p.nos === v.nos), saque = ac((p, v) => p.saque === v.saque), sacador = ac((p, v) => p.sacador === v.sacador);
  let g = [0, 0], ef = [0, 0], di = [0, 0];
  an.forEach((a, k) => { const v = sim.verdade[k]; if (a.nHits !== v.nHits) return; a.batidas.forEach((b, i) => { const bv = v.batidas[i]; if (!i) return;
    if (b.golpe && bv.golpe !== "smash") { g[1]++; g[0] += b.golpe === bv.golpe; }
    if (b.efeito && bv.efeito && b.golpe !== "voleio") { ef[1]++; ef[0] += b.efeito === bv.efeito; }
    if (b.direcao && bv.direcao && i < v.batidas.length - 1) { di[1]++; di[0] += b.direcao === bv.direcao; } }); });
  const papel = dec.decisoes.filter((d, k) => d.papel === sim.verdade[k].papel).length / dec.decisoes.length;
  return { sim, dec, pts, ms, quem, saque, sacador, golpe: g[0] / g[1], efeito: ef[0] / ef[1], direcao: di[0] / di[1], papel, pontos: pts.length, verdade: sim.pontos.length };
}
const pct = (x) => Math.round(x * 100) + "%";
const ruido = { formato: "3sets", semente: 11, maoB: "E", ruidoPose: 0.012, falhaBola: 0.4, falsos: 4, batidaExtra: 0.06 };
for (const [nome, o, lim] of [["limpa", { formato: "1set", semente: 5 }, 0.95], ["com ruído", ruido, 0.88], ["com ruído + placar final", { ...ruido, final: true }, 0.88]]) {
  const r = avaliar(o);
  console.log("  " + nome + ": " + r.pontos + "/" + r.verdade + " pontos · quem ganhou " + pct(r.quem) + " · saque " + pct(r.saque) + " · sacador " + pct(r.sacador) + " · golpe " + pct(r.golpe) + " · efeito " + pct(r.efeito) + " · direção " + pct(r.direcao) + " · placar " + P.texto(r.dec.final) + " (verdade " + P.texto(r.sim.placar) + ") · " + r.ms + " ms");
  assert(r.pontos >= r.verdade * 0.985 && r.pontos <= r.verdade, nome + ": um ponto do scout por ponto jogado (" + r.pontos + " de " + r.verdade + ")");
  assert(r.quem >= lim && r.saque >= 0.95 && r.sacador >= 0.98 && r.papel >= 0.97, nome + ": quem ganhou/saque/sacador/papel");
  assert(r.golpe >= 0.95 && r.efeito >= 0.9 && r.direcao >= 0.9, nome + ": golpe/efeito/direção");
  assert(r.ms < 20000, nome + ": rápido (" + r.ms + " ms)");
  if (o.final) assert(r.dec.confere, nome + ": placar final informado é respeitado");
  /* 3) formato do scout do app */
  r.pts.forEach((p) => {
    assert(["winner_nos", "erro_dele", "erro_nos", "winner_dele"].includes(p.fim) && typeof p.nos === "boolean" && ["1", "2", "ace", "df"].includes(p.saque) && ["1-2", "3-4", "5+"].includes(p.bola));
    assert(["nos", "ele"].includes(p.sacador) && ["D", "E"].includes(p.lado) && p.placarAntes && p.jogo >= 1 && p.set >= 1);
    assert((p.fim === "winner_nos" || p.fim === "erro_dele") === p.nos, "fim coerente com quem ganhou");
  });
}
/* 4) câmera em 3D, velocidade, efeito pela trajetória e mão de cada jogador */
(function () {
  const sim = simularPartida({ formato: "3sets", semente: 11, maoB: "E", ruidoPose: 0.012, falhaBola: 0.4, falsos: 4 });
  const ctx = V.calibrar(sim.cantos, { aspecto: sim.aspecto, corA: sim.cores.nos, corB: sim.cores.ele });
  assert(Math.hypot(ctx.cam.C[0] - 0.4, ctx.cam.C[1] + 20.5, ctx.cam.C[2] - 6.2) < 0.05, "posição da câmera recuperada da quadra: " + ctx.cam.C.map((v) => v.toFixed(2)));
  const an = sim.segmentos.map((s) => V.analisarPonto(s, ctx)), errV = [], ef = [0, 0];
  an.forEach((a, k) => { const v = sim.verdade[k]; if (a.nHits !== v.nHits) return; a.batidas.forEach((b, i) => { const bv = v.batidas[i];
    if (b.vel && !bv.fim) errV.push(Math.abs(b.vel - bv.vel));
    if (i && b.voo && b.voo.efeito && bv.efeito && b.golpe !== "voleio" && !bv.fim) { ef[1]++; ef[0] += b.voo.efeito === bv.efeito; } }); });
  const mErr = errV.reduce((s, v) => s + v, 0) / errV.length;
  console.log("  velocidade: erro médio " + mErr.toFixed(1) + " km/h em " + errV.length + " bolas · efeito pela trajetória " + pct(ef[0] / ef[1]) + " de " + ef[1]);
  assert(errV.length > 200 && mErr < 5, "velocidade da bola");
  assert(ef[1] > 100 && ef[0] / ef[1] > 0.8, "efeito pela física da trajetória");
  const dec = V.decodificarAuto(an, { atletaComecaPerto: true }), m = V.maosAuto(sim.segmentos, an, dec, ctx);
  assert.deepStrictEqual([m.A, m.B], ["D", "E"], "mão de cada jogador pelo saque");
  assert.strictEqual(dec.cfg.formato, "3sets", "formato descoberto");
})();
/* 5) padrões: contagem em pontos montados à mão (forma compacta gravada no caderno) */
(function () {
  const Pd = require("../scout/padroes.js");
  const pt = (n, nos, fim, seq) => ({ n, nos, fim, seq });
  const pts = [
    pt(1, true, "winner_nos", "nS:150 eBHcF:95 nFHpF:120"), pt(2, true, "winner_nos", "eS:140 nBHcM:90 eFHcF:100 nFHpF:118"),
    pt(3, true, "erro_dele", "nS:160 eFHcM nFHctF:110 eBHc"), pt(4, true, "erro_dele", "eS nBHc eFHmM nFHctF:105 eBH"),
    pt(5, false, "erro_nos", "eS:150 nBHcC"), pt(6, false, "erro_nos", "nS eFHcF nBHp"), pt(7, false, "erro_nos", "eS nBHcC"),
    pt(8, false, "winner_dele", "nS:145 eFHcF nBHcC eFHpF"),
  ];
  const r = Pd.analisar(pts);
  assert.strictEqual(r.comBatidas, 8);
  const g = r.ganhos.find((x) => /A:FH paralelo fundo ⇒|A:FH paralelo fundo$/.test(x.k) || /B:BH cruzado → A:FH paralelo/.test(x.k) || /A:FH paralelo fundo/.test(x.k));
  assert(g && g.n === 2, "o FH paralelo fundo que fechou 2 pontos: " + JSON.stringify(r.ganhos.map((x) => x.n + " " + x.k)));
  assert(r.provocam.some((x) => x.n === 2 && /A:FH cruzado fundo \(top\) → B:BH \(erro\)/.test(x.k)), "o FH cruzado fundo com top que provocou 2 erros de BH do adversário: " + JSON.stringify(r.provocam.map((x) => x.n + " " + x.k)));
  assert(r.erros.some((x) => x.n === 2 && /B:Saque → A:BH \(erro\)/.test(x.k)), "o erro de devolução de BH cruzado curto repetido: " + JSON.stringify(r.erros.map((x) => x.n + " " + x.k)));
  const fh = r.golpes.find((x) => x.golpe === "forehand");
  assert(fh && fh.vel === Math.round((120 + 118 + 110 + 105) / 4) && fh.velMax === 120 && fh.pctFundas === 100, "velocidade e profundidade do FH: " + JSON.stringify(fh));
  assert(r.leituras.length >= 2 && Pd.html(r, { A: "Ana", B: "Bia" }).includes("Ana"), "leituras e HTML");
  console.log("  padrões: " + r.leituras.length + " leituras · " + r.ganhos.length + " sequências de ponto ganho · " + r.erros.length + " de erro");
})();
console.log("check-video-scout: ok");
