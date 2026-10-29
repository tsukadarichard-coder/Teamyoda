/* Fases da análise biomecânica em vídeo "de verdade": o atleta entra andando, espera na posição de preparação e só então golpeia;
   a pose tem trocas esquerda/direita e saltos isolados (como o MediaPipe faz de lado). A preparação tem de cair na posição de espera
   (não no primeiro quadro do vídeo) e o contato não pode ser enganado pelos saltos. Rode: node tests/check-fases-biomec.js */
const a = require("assert");
const B = require("../scout/movimento-motor.js");
const P = B.P;

function comPrefixo(golpe, dom) {
  const swing = B.sintetico(golpe === "saque" ? 70 : 60, dom, golpe);
  const ready = swing[0].lm;
  const q = [];
  /* 25 quadros andando para o lugar (corpo e braços se mexendo), 15 parado na espera */
  for (let i = 0; i < 25; i++) {
    const dx = -0.25 + 0.25 * (i / 24), osc = 0.06 * Math.sin(i / 2.2);
    q.push({ t: 0, lm: ready.map((p, k) => ({ ...p, x: p.x + dx + ([15, 16, 13, 14].includes(k) ? osc : 0), y: p.y + ([27, 28].includes(k) ? 0.02 * Math.abs(Math.sin(i / 2)) : 0) })) });
  }
  for (let i = 0; i < 15; i++) q.push({ t: 0, lm: ready.map((p) => ({ ...p, x: p.x + 0.002 * Math.sin(i) })) });
  swing.forEach((f) => q.push({ t: 0, lm: f.lm.map((p) => ({ ...p })) }));
  q.forEach((f, i) => { f.t = i / 30; });
  return { q, inicioEspera: 25, inicioGolpe: 40 };
}
function trocar(lm) { const o = lm.slice(); [[11, 12], [13, 14], [15, 16], [23, 24], [25, 26], [27, 28], [31, 32]].forEach(([x, y]) => { o[x] = lm[y]; o[y] = lm[x]; }); return o; }

/* forehand e backhand, destro e canhoto */
[["forehand", "D"], ["forehand", "E"], ["backhand", "D"]].forEach(([g, dom]) => {
  const { q, inicioEspera, inicioGolpe } = comPrefixo(g, dom);
  const r = B.checklist(q, dom, null, g, "2");
  a.ok(!r.erro, g + dom);
  const prep = r.fases[0].quadro, giro = r.fases[1].quadro, cont = r.fases[3].quadro;
  a.ok(prep >= inicioEspera && prep <= inicioGolpe + 3, g + dom + ": preparação na posição de espera (quadro " + prep + ")");
  a.ok(prep < giro && giro < cont, g + dom + ": fases em ordem " + r.fases.map((f) => f.quadro));
  a.ok(giro >= inicioGolpe, g + dom + ": giro dentro do golpe, não no andar (" + giro + ")");
});

/* saque com o atleta andando antes: lançamento dentro do saque, fases em ordem */
{
  const { q, inicioGolpe } = comPrefixo("saque", "D");
  const r = B.checklist(q, "D", null, "saque");
  a.ok(r.fases[0].quadro >= inicioGolpe, "saque: lançamento dentro do saque (quadro " + r.fases[0].quadro + ")");
  a.ok(r.fases.every((f, i) => i === 0 || f.quadro >= r.fases[i - 1].quadro), "saque: fases em ordem");
  a.strictEqual(r.nomes[1], "Preparação (posição de troféu)");
}

/* trocas esquerda/direita e salto isolado no meio da preparação não enganam o contato */
{
  const { q } = comPrefixo("forehand", "D");
  const limpo = B.checklist(q, "D").fases.map((f) => f.quadro);
  const sujo = q.map((f) => ({ t: f.t, lm: f.lm.map((p) => ({ ...p })) }));
  [45, 46, 52].forEach((i) => { sujo[i].lm = trocar(sujo[i].lm); });          // MediaPipe inverte os lados em 3 quadros
  sujo[48].lm[P.punhoD] = { ...sujo[48].lm[P.punhoD], x: 0.95, y: 0.1 };      // salto isolado do punho
  const r = B.checklist(sujo, "D");
  const f = r.fases.map((x) => x.quadro);
  a.strictEqual(f[3], limpo[3], "contato igual ao do vídeo limpo (" + f + " × " + limpo + ")");
  a.ok(Math.abs(f[0] - limpo[0]) <= 2 && Math.abs(f[1] - limpo[1]) <= 2, "preparação e giro estáveis com os saltos " + f + " × " + limpo);
  const L = B.limpar(sujo);
  a.strictEqual(L.length, sujo.length, "limpeza mantém o número de quadros");
  a.ok(Math.abs(L[45].lm[P.punhoD].x - q[45].lm[P.punhoD].x) < 1e-9, "troca de lados desfeita");
  a.strictEqual(L[48].lm[P.punhoD].v, 0, "salto isolado vira ponto não visto");
}
/* vídeo em pé (1080×1920): a pose vem em fração da largura e da altura; com a proporção, os ângulos são os de verdade */
{
  const q = B.sintetico(60, "D"), prop = 1920 / 1080;
  const empe = q.map((f) => ({ t: f.t, lm: f.lm.map((p) => ({ ...p, y: p.y / prop })) }));   // o mesmo corpo filmado em pé
  const ref = B.checklist(q, "D").fases.map((f) => f.medidas.joelhos);
  const certo = B.checklist(empe, "D", null, "forehand", "", prop).fases.map((f) => f.medidas.joelhos);
  const torto = B.checklist(empe, "D").fases.map((f) => f.medidas.joelhos);
  a.ok(certo.every((v, i) => Math.abs(v - ref[i]) < 0.5), "ângulos corretos no vídeo em pé " + certo.map(Math.round) + " × " + ref.map(Math.round));
  a.ok(torto.some((v, i) => Math.abs(v - ref[i]) > 5), "sem a proporção, os ângulos saíam distorcidos");
}
/* saque real (como no vídeo do Team Yoda): no lançamento o braço da raquete está pendurado e o punho bem baixo. A armada (racket
   drop) vem depois, com o cotovelo no alto e o punho caído atrás das costas, e nunca no mesmo quadro do lançamento. */
function saqueReal(dom) {
  const q = [], lerp = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));
  for (let i = 0; i < 60; i++) {
    const lm = []; for (let k = 0; k < 33; k++) lm.push({ x: 0.5, y: 0.5, z: 0, v: 1 });
    const set = (k, x, y) => { lm[k] = { x, y, z: 0, v: 1 }; };
    let pw, cw, nw, d;
    if (i < 15) { pw = [0.45, 0.52]; cw = [0.43, 0.42]; nw = [0.52, 0.52]; d = 0.02; }
    else if (i <= 30) { const t = (i - 15) / 15; pw = [lerp(0.45, 0.36, t), lerp(0.52, 0.62, t)]; cw = [0.40, 0.44]; nw = [0.60, lerp(0.52, 0.10, t)]; d = lerp(0.02, 0.06, t); }
    else if (i <= 40) { const t = (i - 30) / 10; pw = [lerp(0.36, 0.40, t), lerp(0.62, 0.22, t)]; cw = [0.40, lerp(0.44, 0.30, t)]; nw = [0.60, lerp(0.10, 0.15, t)]; d = lerp(0.06, 0.09, t); }
    else if (i <= 45) { const t = (i - 40) / 5; pw = [lerp(0.40, 0.47, t), lerp(0.22, 0.36, t)]; cw = [0.42, lerp(0.30, 0.24, t)]; nw = [0.60, lerp(0.15, 0.30, t)]; d = lerp(0.09, 0.05, t); }
    else if (i <= 50) { const t = (i - 45) / 5; pw = [lerp(0.47, 0.58, t), lerp(0.36, 0.05, t)]; cw = [lerp(0.42, 0.55, t), lerp(0.24, 0.16, t)]; nw = [0.58, lerp(0.30, 0.45, t)]; d = lerp(0.05, 0.0, t); }
    else { const t = (i - 50) / 9; pw = [lerp(0.58, 0.40, t), lerp(0.05, 0.62, t)]; cw = [lerp(0.55, 0.45, t), lerp(0.16, 0.45, t)]; nw = [0.55, 0.50]; d = 0.02; }
    set(P.ombroE, 0.47, 0.30); set(P.ombroD, 0.53, 0.30); set(P.quadrilE, 0.47, 0.52); set(P.quadrilD, 0.53, 0.52); set(P.nariz, 0.5, 0.22);
    set(P.joelhoE, 0.47 + d, 0.70); set(P.joelhoD, 0.53 + d, 0.70); set(P.tornE, 0.47, 0.88); set(P.tornD, 0.53, 0.88);
    const D = dom === "E" ? { p: P.punhoE, c: P.cotE, np: P.punhoD, nc: P.cotD } : { p: P.punhoD, c: P.cotD, np: P.punhoE, nc: P.cotE };
    set(D.p, pw[0], pw[1]); set(D.c, cw[0], cw[1]); set(D.np, nw[0], nw[1]); set(D.nc, (nw[0] + 0.5) / 2, (nw[1] + 0.30) / 2);
    q.push({ t: i / 30, lm });
  }
  return q;
}
["D", "E"].forEach((dom) => {
  const r = B.checklist(saqueReal(dom), dom, null, "saque");
  const f = r.fases.map((x) => x.quadro);
  a.ok(Math.abs(f[0] - 30) <= 2, "saque" + dom + ": lançamento no braço mais alto (" + f + ")");
  a.ok(f[1] >= 37 && f[1] <= 41, "saque" + dom + ": preparação na posição de troféu, raquete de pé (" + f + ")");
  a.ok(f[2] > f[0] + 5 && f[2] > f[1], "saque" + dom + ": armada depois do troféu, não no quadro do lançamento (" + f + ")");
  a.ok(f[2] >= 42 && f[2] <= 47, "saque" + dom + ": armada no racket drop (" + f + ")");
  a.ok(Math.abs(f[3] - 50) <= 2, "saque" + dom + ": contato no punho mais alto (" + f + ")");
  const jArm = r.itens.find((x) => x.nome === "Flexão de joelhos no troféu").valor, jMin = Math.min(...r.fases.map((x) => x.medidas.joelhos));
  a.ok(jArm <= jMin + 0.5, "saque" + dom + ": flexão dos joelhos medida na carga mais funda (" + Math.round(jArm) + ")");
});

/* o vídeo continua depois do golpe (o atleta volta e se prepara de novo): seguimento e recuperação ficam logo após o contato,
   não no fim do vídeo */
{
  const sq = saqueReal("D"), espera = sq[0].lm;
  for (let i = 0; i < 120; i++) sq.push({ t: (60 + i) / 30, lm: espera.map((p) => ({ ...p, x: p.x + 0.002 * Math.sin(i) })) });
  const f = B.checklist(sq, "D", null, "saque").fases.map((x) => x.quadro);
  a.ok(Math.abs(f[3] - 50) <= 2, "saque longo: contato " + f);
  a.ok(f[4] > f[3] && f[4] <= f[3] + 25 && f[5] <= f[3] + 37, "saque longo: seguimento e recuperação logo após o contato " + f);
  const { q } = comPrefixo("forehand", "D"), fim = q[q.length - 1].lm;
  for (let i = 0; i < 150; i++) q.push({ t: 0, lm: q[40].lm.map((p) => ({ ...p })) });
  q.forEach((x, i) => { x.t = i / 30; });
  const g = B.checklist(q, "D").fases.map((x) => x.quadro);
  a.ok(g[4] <= g[3] + 25 && g[5] <= g[4] + 19, "forehand longo: seguimento e recuperação logo após o contato " + g);
}

console.log("check-fases-biomec: ok");
