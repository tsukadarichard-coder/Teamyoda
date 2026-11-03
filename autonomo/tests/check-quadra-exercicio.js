/* Quadra animada dos exercícios (scout/quadra-exercicio.js + scout/exercicios-quadra.js): todo roteiro vira uma linha do tempo sem
   buracos, as bolas quicam dentro da quadra e do outro lado da rede de quem bateu, os códigos existem no catálogo dos dois apps e o
   desenho parado traz uma marca numerada por quique. Rode: node tests/check-quadra-exercicio.js */
const assert = require("assert"), fs = require("fs"), path = require("path");
const raiz = path.join(__dirname, "..");
const Q = require(path.join(raiz, "scout/quadra-exercicio.js")), R = require(path.join(raiz, "scout/exercicios-quadra.js"));
Q.registrar(R);
const catalogo = (f) => { const s = fs.readFileSync(f, "utf8"), i = s.indexOf("const EXERCICIOS = ["), j = s.indexOf("];", i); return new Set(JSON.parse(s.slice(i + 19, j + 1)).map((e) => e.c)); };
const cQL = catalogo(path.join(raiz, "index.html")), cTY = catalogo(path.join(raiz, "../mty/index.html"));
const { L, W } = Q.LIMITES, W2 = 5.485;
let n = 0;
for (const [c, d] of Object.entries(R)) {
  n++;
  assert(cQL.has(c) && cTY.has(c), c + " existe no catálogo dos dois apps");
  assert(d.resumo && d.atores.A && d.lances.length >= 1, c + ": resumo, atleta e lances");
  const tl = Q.construir(d);
  assert(isFinite(tl.dur) && tl.dur > 1 && tl.dur < 60, c + ": duração " + tl.dur);
  let lado = {};
  for (const k in d.atores) lado[k] = Math.sign(d.atores[k][1]);
  tl.lances.forEach((l, i) => {
    if (l.semBola) { assert(d.lances[i].txt && d.lances[i].mover, c + " lance " + (i + 1) + ": deslocamento sem bola com texto"); return; }
    assert(l.quadros.length > 3 && l.quadros.every((q) => isFinite(q.x) && isFinite(q.y) && isFinite(q.h) && q.h >= -0.01), c + " lance " + (i + 1) + ": trajetória sem buraco");
    for (let k = 1; k < l.quadros.length; k++) assert(l.quadros[k].t >= l.quadros[k - 1].t, c + ": tempo crescente");
    const lance = d.lances[i];
    assert(lance.txt, c + " lance " + (i + 1) + ": texto");
    if (lance.quique) {
      const [x, y] = lance.quique;
      assert(Math.abs(x) <= (d.duplas ? W2 : W) && Math.abs(y) <= L, c + " lance " + (i + 1) + ": quica dentro da quadra " + lance.quique);
      const quemBate = lado[lance.de] || Math.sign(d.atores[lance.de][1]);
      assert(Math.sign(y) === -quemBate, c + " lance " + (i + 1) + ": a bola passa a rede (" + lance.de + ")");
    }
  });
  const svg = Q.svgEstatico(c, "t");
  assert.strictEqual((svg.match(/font-size="0.6"/g) || []).length, d.lances.filter((l) => l.quique).length, c + ": uma marca numerada por quique");
  assert(/^<svg/.test(svg) && !/NaN|undefined/.test(svg), c + ": desenho parado válido");
}
assert(n >= 230, "todos os exercícios de quadra: " + n);
/* posições de todo mundo ficam perto da quadra (nada some da tela) */
for (const [c, d] of Object.entries(R)) {
  const tl = Q.construir(d);
  for (const k in tl.trilhas) tl.trilhas[k].forEach((p) => assert(Math.abs(p.x) <= 6.4 && Math.abs(p.y) <= 15, c + ": " + k + " fora da tela " + p.x + "," + p.y));
}
assert.strictEqual(fs.readFileSync(path.join(raiz, "scout/quadra-exercicio.js"), "utf8"), fs.readFileSync(path.join(raiz, "../mty/scout/quadra-exercicio.js"), "utf8"));
assert.strictEqual(fs.readFileSync(path.join(raiz, "scout/exercicios-quadra.js"), "utf8"), fs.readFileSync(path.join(raiz, "../mty/scout/exercicios-quadra.js"), "utf8"));
console.log("check-quadra-exercicio: ok (" + n + " exercícios)");
