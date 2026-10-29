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

/* saque: preparação antes de o braço do lançamento subir */
{
  const { q, inicioEspera, inicioGolpe } = comPrefixo("saque", "D");
  const r = B.checklist(q, "D", null, "saque");
  const prep = r.fases[0].quadro;
  a.ok(prep >= inicioEspera && prep <= inicioGolpe + 3, "saque: preparação na espera (quadro " + prep + ")");
  a.ok(r.fases.every((f, i) => i === 0 || f.quadro >= r.fases[i - 1].quadro), "saque: fases em ordem");
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
console.log("check-fases-biomec: ok");
