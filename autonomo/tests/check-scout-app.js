/* QuadraLab Scout (scout-app/): dados no aparelho, placar pelo motor do scout, histórico, comparação, texto para compartilhar,
   cópia de segurança e a contagem anônima de uso (servidor). Rode: node tests/check-scout-app.js */
const path = require("path"), assert = require("assert");
const M = require("../player/scout-motor.js");
const D = require("../scout-app/dados.js");
const USO = require("../netlify/functions/_scout-app-uso.js");

/* ── estado ── */
let st = D.normalizar(null);
assert.ok(/^[a-f0-9]{24}$/.test(st.aparelho), "aparelho sorteado");
assert.deepStrictEqual(D.normalizar({ atletas: "x", jogos: 3 }).jogos, [], "lixo vira estado vazio");
assert.ok(D.addAtleta(st, "  ").erro, "nome vazio");
const lucas = D.addAtleta(st, "Lucas Andrade").atleta;
assert.strictEqual(D.addAtleta(st, "lucas andrade").atleta.id, lucas.id, "mesmo nome é o mesmo atleta");
const marina = D.addAtleta(st, "Marina").atleta;
assert.strictEqual(st.atletas.length, 2);

/* ── jogo: ganha 6-0 6-0 marcando só pontos ganhos ── */
function ponto(nos) { return { fim: nos ? "winner_nos" : "erro_nos", nos, bola: "5-9", causa: nos ? null : "execucao" }; }
function marcarJogo(j, padrao) { let i = 0, r; do { r = D.marcarPonto(M, j, ponto(padrao(i++))); assert.ok(!r.erro, r.erro); } while (!r.fim && i < 1000); return i; }
assert.ok(D.novoJogo(st, { atletaId: "x" }).erro, "atleta inexistente");
const j1 = D.novoJogo(st, { atletaId: lucas.id, torneio: "Copa Sul", adversario: "Fulano Secreto", cfg: { formato: "3sets", saca: "nos" } }).jogo;
assert.strictEqual(st.atual, j1.id);
const n1 = marcarJogo(j1, () => true);
assert.strictEqual(n1, 48, "6-0 6-0 = 48 pontos");
assert.strictEqual(D.textoSets(D.placar(M, j1)), "6-0 6-0");
assert.ok(D.marcarPonto(M, j1, ponto(true)).erro, "não marca depois do fim");
assert.strictEqual(j1.pontos[0].placarAntes, "0-0"); assert.strictEqual(j1.pontos[1].placarAntes, "15-0");
assert.strictEqual(j1.pontos[47].set, 2, "último ponto no 2º set"); assert.strictEqual(j1.pontos[0].set, 1);

/* desfazer reabre a partida */
assert.ok(D.desfazer(j1)); assert.ok(!D.encerrado(M, j1)); D.marcarPonto(M, j1, ponto(true)); assert.ok(D.encerrado(M, j1));

/* resumo no formato da família: só o primeiro nome, sem adversário */
const r1 = D.resumo(M, st, j1);
assert.strictEqual(r1.atleta, "Lucas"); assert.strictEqual(r1.n, 48); assert.strictEqual(r1.pctGanhos, 100); assert.strictEqual(r1.concluida, true);
assert.strictEqual(r1.torneio, "Copa Sul");
assert.ok(!JSON.stringify(r1).includes("Fulano"), "adversário fora do resumo");
assert.ok(!JSON.stringify(r1).includes("Andrade"), "sobrenome fora do resumo");

/* segundo jogo: perde 0-6 0-6; terceiro em andamento */
const j2 = D.novoJogo(st, { atletaId: lucas.id, cfg: { formato: "3sets", saca: "ele" } }).jogo;
j2.criadoEm = new Date(Date.parse(j1.criadoEm) + 1000).toISOString();
marcarJogo(j2, () => false);
assert.strictEqual(D.textoSets(D.placar(M, j2)), "0-6 0-6");
const lin2 = D.linhaJogo(M, st, j2);
assert.strictEqual(lin2.venceu, false); assert.strictEqual(lin2.pct, 0); assert.strictEqual(lin2.fim, true);
const j3 = D.novoJogo(st, { atletaId: lucas.id, cfg: { formato: "1set" } }).jogo;
j3.criadoEm = new Date(Date.parse(j1.criadoEm) + 2000).toISOString();
for (let i = 0; i < 6; i++) D.marcarPonto(M, j3, ponto(i % 2 === 0));
assert.strictEqual(D.linhaJogo(M, st, j3).fim, false);

/* histórico do mais novo ao mais antigo; anteriores só com jogos terminados antes deste */
assert.deepStrictEqual(D.historico(st, lucas.id).map((j) => j.id), [j3.id, j2.id, j1.id]);
const ant = D.anteriores(M, st, j3);
assert.strictEqual(ant.length, 2, "dois jogos terminados antes");
assert.ok(ant.every((a) => typeof a.pctGanhos === "number" && "errosNos" in a), "formato achatado para a análise ao vivo");
assert.strictEqual(D.anteriores(M, st, j1).length, 0, "primeiro jogo sem anteriores");

/* comparação: mais antigo à esquerda, só terminados */
const cmp = D.comparacao(M, st, lucas.id);
assert.deepStrictEqual(cmp.jogos.map((j) => j.id), [j1.id, j2.id]);
assert.deepStrictEqual(cmp.linhas.filter((l) => l.chave === "pctGanhos")[0].valores, [100, 0]);
assert.deepStrictEqual(cmp.linhas.filter((l) => l.chave === "pctPrimeiro")[0].valores, [null, null], "saque não marcado vira —");

/* texto do WhatsApp: placar e números, nunca o adversário */
const tx = D.textoCompartilhar(M, st, j1);
assert.ok(tx.startsWith("Lucas venceu · Copa Sul"), tx);
assert.ok(tx.includes("Placar: 6-0 6-0") && tx.includes("48 pontos"), tx);
assert.ok(!tx.includes("Fulano") && !tx.includes("Andrade"), "texto sem adversário nem sobrenome");
assert.ok(D.textoCompartilhar(M, st, j3).startsWith("Jogo de Lucas em andamento"));

/* cópia de segurança: exportar, importar em outro aparelho, importar de novo não duplica */
const arquivo = D.exportar(st);
const outro = D.normalizar(null); D.addAtleta(outro, "Lucas Andrade");
const imp = D.importar(outro, arquivo);
assert.deepStrictEqual(imp, { atletas: 1, novos: 3, atualizados: 0 }, JSON.stringify(imp));
assert.strictEqual(outro.atletas.length, 2, "Lucas casou pelo nome, Marina entrou");
assert.strictEqual(D.historico(outro, outro.atletas[0].id).length, 3, "jogos do Lucas no Lucas que já existia");
assert.deepStrictEqual(D.importar(outro, arquivo), { atletas: 0, novos: 0, atualizados: 0 }, "segunda importação não duplica");
assert.ok(D.importar(outro, "{}").erro && D.importar(outro, "não é json").erro, "arquivo estranho recusado");
/* normalizar a cópia guardada mantém tudo */
const relido = D.normalizar(JSON.parse(JSON.stringify(st)));
assert.strictEqual(relido.jogos.length, 3); assert.strictEqual(relido.aparelho, st.aparelho); assert.strictEqual(relido.atual, j3.id);

/* apagar atleta apaga os jogos dele */
assert.deepStrictEqual(D.removerAtleta(outro, outro.atletas[0].id), { jogosApagados: 3 });

/* evento de uso: nada pessoal */
const ev = D.eventoUso(st, "jogo-encerrado", j1);
assert.deepStrictEqual(Object.keys(ev).sort(), ["a", "e", "n"]); assert.strictEqual(ev.n, 48);
assert.deepStrictEqual(Object.keys(D.eventoUso(st, "abriu")).sort(), ["a", "e"]);

/* ── servidor: validação e contagem ── */
assert.deepStrictEqual(USO.validar(ev), { a: st.aparelho, e: "jogo-encerrado", n: 48 });
assert.ok(USO.validar({ a: st.aparelho, e: "abriu", nome: "Lucas" }).erro, "campo extra recusado");
assert.ok(USO.validar({ a: "Lucas", e: "abriu" }).erro, "aparelho fora do formato");
assert.ok(USO.validar({ a: st.aparelho, e: "outro" }).erro, "evento desconhecido");
assert.ok(USO.validar({ a: st.aparelho, e: "jogo-encerrado", n: 1.5 }).erro, "pontos inválidos");
assert.ok(USO.validar([1]).erro);

/* Firestore de mentira (só o que o módulo usa) */
function fakeDb() {
  const dados = {};
  const col = (nome) => {
    const c = dados[nome] = dados[nome] || {};
    const filtrar = (f) => ({ count: () => ({ get: async () => ({ data: () => ({ count: Object.values(c).filter(f).length }) }) }) });
    return {
      doc: (id) => ({ _c: c, _id: id, get: async () => ({ exists: id in c, data: () => c[id] }) }),
      count: () => filtrar(() => true).count(), where: (campo, op, v) => { assert.strictEqual(op, ">="); return filtrar((x) => (x[campo] || 0) >= v); },
    };
  };
  return { dados, collection: col, runTransaction: async (fn) => fn({ get: (ref) => ref.get(), set: (ref, v) => { ref._c[ref._id] = v; } }) };
}
(async () => {
  const db = fakeDb(), t0 = Date.parse("2026-11-10T15:00:00Z"), A = "a".repeat(24), B = "b".repeat(24);
  await USO.registrar(db, { a: A, e: "abriu", n: 0 }, t0);
  await USO.registrar(db, { a: A, e: "jogo-iniciado", n: 0 }, t0);
  await USO.registrar(db, { a: A, e: "jogo-encerrado", n: 80 }, t0);
  await USO.registrar(db, { a: B, e: "abriu", n: 0 }, t0);
  let d = db.dados.scoutAppUso["2026-11-10"];
  assert.deepStrictEqual(d, { abriu: 2, iniciados: 1, encerrados: 1, pontos: 80, aparelhos: 2, novos: 2, primeiroJogo: 1, tresJogos: 0 }, JSON.stringify(d));
  /* dia seguinte: o mesmo aparelho conta de novo em "aparelhos" mas não em "novos"; 3º jogo conta em tresJogos */
  const t1 = t0 + 86400000;
  await USO.registrar(db, { a: A, e: "jogo-encerrado", n: 60 }, t1);
  await USO.registrar(db, { a: A, e: "jogo-encerrado", n: 70 }, t1);
  d = db.dados.scoutAppUso["2026-11-11"];
  assert.strictEqual(d.aparelhos, 1); assert.strictEqual(d.novos, 0); assert.strictEqual(d.tresJogos, 1); assert.strictEqual(d.primeiroJogo, 0);
  assert.strictEqual(db.dados.scoutAppAparelhos[A].jogosEncerrados, 3); assert.strictEqual(db.dados.scoutAppAparelhos[A].primeiroDia, "2026-11-10");
  /* limite por aparelho por dia */
  for (let i = 0; i < USO.MAX_EVENTOS_DIA - 1; i++) await USO.registrar(db, { a: B, e: "abriu", n: 0 }, t0);
  assert.deepStrictEqual(await USO.registrar(db, { a: B, e: "abriu", n: 0 }, t0), { limite: true });
  /* horário de Brasília: 01h UTC ainda é o dia anterior */
  assert.strictEqual(USO.hojeBR(Date.parse("2026-11-11T01:00:00Z")), "2026-11-10");
  /* resumo do painel */
  const r = await USO.resumoUso(db, "2026-11-11");
  assert.strictEqual(r.serie.length, 30); assert.strictEqual(r.dias7.encerrados, 3); assert.strictEqual(r.dias7.pontos, 210);
  assert.deepStrictEqual(r.aparelhos, { total: 2, comUmJogo: 1, comTresJogos: 1 });

  /* handler: método, tamanho e campos */
  const fx = path.join(__dirname, "../netlify/functions/");
  require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "x", filename: "x", loaded: true, exports: { admin: { firestore: () => db }, app: () => {} } };
  const { handler } = require(fx + "scout-app-uso.js");
  const chama = async (m, corpo) => { const x = await handler({ httpMethod: m, body: typeof corpo === "string" ? corpo : JSON.stringify(corpo) }); return { s: x.statusCode, ...JSON.parse(x.body) }; };
  assert.strictEqual((await chama("GET", {})).s, 405);
  assert.strictEqual((await chama("POST", "x".repeat(400))).s, 413);
  assert.strictEqual((await chama("POST", "{oi")).s, 400);
  assert.strictEqual((await chama("POST", { a: A, e: "abriu", torneio: "Copa" })).s, 400, "torneio recusado");
  assert.strictEqual((await chama("POST", { a: "c".repeat(24), e: "abriu" })).s, 200);
  assert.strictEqual((await chama("POST", { a: B, e: "abriu" })).s, 429, "limite do dia");
  console.log("check-scout-app: ok");
})().catch((e) => { console.error(e); process.exit(1); });
