/* Lixeira de jogos: jogo com pontos que some do caderno vai para a lixeira e volta inteiro; e a limpeza de jogos repetidos não apaga
   um jogo antigo só porque um jogo novo começou com os mesmos pontos (pontos não têm hora). Rode: node tests/check-lixeira-jogos.js */
const assert = require("assert"), fs = require("fs"), path = require("path");
const L = require("../scout/lixeira-jogos.js");
assert.strictEqual(fs.readFileSync(path.join(__dirname, "../scout/lixeira-jogos.js"), "utf8"), fs.readFileSync(path.join(__dirname, "../../mty/scout/lixeira-jogos.js"), "utf8"), "cópias iguais");
const P = (n, adv) => Array.from({ length: n }, (_, k) => ({ n: k + 1, fim: k % 3 ? "erro_nos" : "winner_nos", nos: !(k % 3), bola: "1-2" }));
const jogo = (id, n, extra) => ({ id, tipo: "jogo", data: "2026-10-20", adversario: "Simon Escudeiro", torneio: "ITF Foz do Iguaçu", resultado: "4-6 7-6", concluida: false, scout: { pontos: P(n) }, ...extra });

/* 1. removidos: só jogos com pontos que sumiram; cópia trocada pela versão salva não conta; jogador removido não conta */
const antes = [{ id: "a1", nome: "Nicolas", registros: [jogo("p1", 195), { id: "s1", tipo: "sessao" }, jogo("p2", 10, { parcialAuto: true })] }, { id: "a2", nome: "Ana", registros: [jogo("p9", 20)] }];
const depois = [{ id: "a1", nome: "Nicolas", registros: [{ id: "s1", tipo: "sessao" }, jogo("p3", 12)] }];
const r = L.removidos(antes, depois);
assert.deepStrictEqual(r.map((x) => x.registro.id), ["p1"], "o jogo de 195 pontos foi para a lixeira; a cópia de 10 pontos coberta pelo jogo salvo, não " + JSON.stringify(r.map((x) => x.registro.id)));
assert.strictEqual(r[0].alunoNome, "Nicolas");
assert.deepStrictEqual(L.removidos(antes, antes), [], "nada mudou, nada na lixeira");

/* 2. guardar, índice, ler, recuperar (tirar) */
(async () => {
  const mapa = new Map();
  const st = { get: async (k) => (mapa.has(k) ? { value: mapa.get(k) } : null), set: async (k, v) => { mapa.set(k, v); }, delete: async (k) => { mapa.delete(k); } };
  const X = L.criar(st);
  assert.strictEqual(await X.guardar(r), 1);
  const ind = await X.indice("a1");
  assert.strictEqual(ind.length, 1); assert.strictEqual(ind[0].pontos, 195); assert.strictEqual(ind[0].adversario, "Simon Escudeiro"); assert.strictEqual(ind[0].interrompida, true);
  const reg = await X.ler("a1", "p1");
  assert.strictEqual(reg.scout.pontos.length, 195, "o jogo volta com todos os pontos");
  await X.guardar(r); assert.strictEqual((await X.indice("a1")).length, 1, "o mesmo jogo não duplica no índice");
  await X.tirar("a1", "p1");
  assert.strictEqual((await X.indice("a1")).length, 0); assert.strictEqual(await X.ler("a1", "p1"), null, "recuperado sai da lixeira");
  /* depois de 90 dias some do índice */
  mapa.set(L.IDX + "a1", JSON.stringify([{ regId: "velho", removidoEm: new Date(Date.now() - 91 * 86400000).toISOString() }, { regId: "novo", removidoEm: new Date().toISOString() }]));
  assert.deepStrictEqual((await X.indice("a1")).map((x) => x.regId), ["novo"], "90 dias");
  assert.deepStrictEqual(await X.indice("../x"), [], "id estranho não vira caminho");

  /* 3. app real: jogo novo que começa com os mesmos pontos de um jogo antigo de outro adversário não apaga o antigo */
  for (const app of ["../../mty/index.html", "../index.html"]) {
    const t = fs.readFileSync(path.join(__dirname, app), "utf8");
    const i = t.indexOf("const reabrivel ="), j = t.indexOf("/* Rascunho de partida que já foi salvo de verdade");
    const { semJogosRepetidos, mesmaPartida } = new Function(t.slice(i, j) + ";return { semJogosRepetidos, mesmaPartida };")();
    const antigo = jogo("p1", 195, { parcialAuto: true });
    const novo = jogo("p5", 4, { parcialAuto: true, adversario: "Outro Jogador", torneio: "jogo-treino", data: "2026-10-28" });
    novo.scout.pontos = antigo.scout.pontos.slice(0, 4).map((p) => ({ ...p }));
    assert.strictEqual(mesmaPartida(antigo, novo), false, app + ": outro adversário, outro jogo");
    assert.deepStrictEqual(semJogosRepetidos([antigo, novo], "p5").map((g) => g.id), ["p1", "p5"], app + ": o jogo antigo continua no caderno");
    /* cópias automáticas do MESMO jogo continuam sendo juntadas */
    const copia = jogo("p0", 120, { parcialAuto: true }); copia.scout.pontos = antigo.scout.pontos.slice(0, 120);
    assert.deepStrictEqual(semJogosRepetidos([copia, antigo]).map((g) => g.id), ["p1"], app + ": cópia automática do mesmo jogo sai");
    assert(t.includes('<script src="scout/lixeira-jogos.js"></script>'), app + ": lixeira carregada");
    assert(!/registros: \(x\.registros \|\| \[\]\)\.filter\(\(g\) => !\(g\.id === idAuto && g\.parcialAuto\)\)/.test(t), app + ": Descartar não apaga mais o jogo do caderno");
  }
  console.log("check-lixeira-jogos: ok");
})().catch((e) => { console.error(e); process.exit(1); });
