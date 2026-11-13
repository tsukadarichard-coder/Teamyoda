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

/* relatório dos jogos (PDF): jogos terminados, do mais antigo ao mais novo, no gerador do scout do treinador */
/* ── tempo de partida: começa no primeiro ponto, fecha no fim do jogo, aceita ajuste à mão ── */
{
  const st = D.normalizar(null), a = D.addAtleta(st, "Tempo Teste").atleta;
  const j = D.novoJogo(st, { atletaId: a.id, cfg: { formato: "tb7", saca: "nos" } }).jogo;
  assert.strictEqual(D.duracaoSeg(j), null, "antes do primeiro ponto não há relógio");
  assert.strictEqual(j.inicioEm, undefined);
  D.marcarPonto(M, j, { nos: true });
  assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(j.inicioEm) && !j.fimEm, "o relógio começa no primeiro ponto");
  const inicio = j.inicioEm;
  j.inicioEm = new Date(Date.parse(inicio) - 50 * 60000).toISOString(); // como se o jogo tivesse começado há 50 minutos
  assert.strictEqual(D.duracaoMin(j), 50); assert.strictEqual(D.textoDuracao(D.duracaoSeg(j)), "50 min", "jogo em andamento: até agora");
  for (let i = 0; i < 6; i++) D.marcarPonto(M, j, { nos: true });
  assert.ok(D.encerrado(M, j) && j.fimEm >= j.inicioEm, "o fim do placar fecha o relógio");
  assert.strictEqual(D.linhaJogo(M, st, j).duracao, "50 min", "a lista de jogos mostra o tempo");
  assert.ok(D.textoCompartilhar(M, st, j).includes("Tempo de jogo: 50 min"), "o texto para compartilhar leva o tempo");
  assert.ok(D.desfazer(j) && !j.fimEm && j.inicioEm, "desfazer o último ponto reabre o relógio");
  D.encerrar(j); assert.ok(j.fim && j.fimEm, "encerrar antes do fim também fecha o relógio");
  D.reabrir(j); assert.ok(!j.fim && !j.fimEm, "voltar a marcar reabre");
  D.encerrar(j);
  D.definirDuracao(j, 95); assert.strictEqual(D.textoDuracao(D.duracaoSeg(j)), "1h35", "o ajuste à mão vale mais que o relógio");
  D.definirDuracao(j, ""); assert.strictEqual(j.duracaoMin, undefined); assert.strictEqual(D.duracaoMin(j), 50, "apagar o ajuste volta ao relógio");
  D.definirDuracao(j, 99999); assert.strictEqual(j.duracaoMin, undefined, "duração absurda não entra");
  /* sobrevive a salvar e ler; jogo antigo, sem relógio, continua valendo */
  D.definirDuracao(j, 70);
  const volta = D.normalizar(JSON.parse(JSON.stringify(st))).jogos[0];
  assert.deepStrictEqual([volta.inicioEm, volta.fimEm, volta.duracaoMin], [j.inicioEm, j.fimEm, 70]);
  const antigo = D.normalizar({ v: st.v, aparelho: st.aparelho, atletas: st.atletas, jogos: [{ id: "jantigo00001", atletaId: a.id, pontos: [{ nos: true }], fim: true }] }).jogos[0];
  assert.strictEqual(D.duracaoSeg(antigo), null); assert.strictEqual(D.linhaJogo(M, st, antigo).duracao, "");
  while (j.pontos.length) D.desfazer(j);
  assert.strictEqual(j.inicioEm, undefined, "sem pontos, o relógio zera");
  assert.strictEqual(D.textoDuracao(20), "menos de 1 min"); assert.strictEqual(D.textoDuracao(3600), "1h00");
}

const REL = require("../scout-app/relatorio.js"), RJ = require("../scout/relatorio-jogos.js");
assert.deepStrictEqual(REL.jogosDoRelatorio(M, D, st, lucas.id).map((j) => j.id), [j1.id, j2.id], "só os terminados, mais antigo primeiro");
const op = REL.opcoes(M, D, st, lucas.id, { geradoEm: "10/11/2026" });
assert.strictEqual(op.atleta, "Lucas"); assert.strictEqual(op.jogos.length, 2); assert.strictEqual(op.jogos[0].adversario, "");
assert.ok(op.metricas.some((m) => m.k === "zona-" + M.ZONAS[0][0]) && op.metricas.some((m) => m.k === "seqFavor"));
assert.deepStrictEqual(REL.sequencias([[1], [1], [0], [1], [1], [1], [0], [0]]), { melhor: 3, pior: 2 });
const html = RJ.gerar(op);
assert.ok(html.includes("Lucas") && html.includes("QUADRALAB") && html.includes("Copa Sul"), "relatório montado");
assert.ok(!html.includes("Fulano") && !html.includes("Andrade"), "relatório sem adversário nem sobrenome");
assert.deepStrictEqual(REL.opcoes(M, D, st, marina.id).jogos, [], "atleta sem jogos terminados");
/* cores: o relatório do Scout sai no roxo do app; nos outros apps (sem tema) continua no verde de sempre */
{
  const VERDES = /#103B32|#69B32A|#9BD65B|#E6F3D6/i;
  assert.strictEqual(op.tema, "scout");
  assert.ok(html.includes("#260A3E") && !VERDES.test(html), "relatório dos jogos sem o verde antigo");
  const semTema = RJ.gerar(Object.assign({}, op, { tema: undefined }));
  assert.ok(semTema.includes("#103B32") && !semTema.includes("#C9A7F5"), "sem tema, o verde dos outros apps não muda");
  const opCor = REL.opcoesPartida(M, D, st, j1), htmlCor = RJ.gerarPartida(opCor);
  assert.strictEqual(opCor.tema, "scout");
  assert.ok(htmlCor.includes("#260A3E") && htmlCor.includes(".selo.ok{background:#C9A7F5") && !VERDES.test(htmlCor), "relatório do jogo sem o verde antigo");
  assert.ok(VERDES.test(RJ.gerarPartida(Object.assign({}, opCor, { tema: undefined }))), "relatório do jogo sem tema continua verde");
  assert.ok(htmlCor.includes("#0F5E8C") && htmlCor.includes("#C65825"), "azul e laranja dos dados continuam");
}

/* ── UTR e WTN: saíram das telas e dos relatórios (13/11/2026); os números já digitados continuam guardados no atleta ── */
{
  assert.strictEqual(D.textoNotas(lucas), "", "sem nota, nada aparece");
  assert.ok(!RJ.gerar(op).includes("UTR"), "relatório sem nota não fala de UTR");
  assert.ok(D.definirNota(st, "x", "utr", "7").erro, "atleta inexistente");
  assert.ok(/UTR deve ficar entre 1 e 16,5/.test(D.definirNota(st, lucas.id, "utr", "17").erro), "UTR acima da escala");
  assert.ok(/WTN deve ficar entre 1 e 40/.test(D.definirNota(st, lucas.id, "wtn", "0,5").erro), "WTN abaixo da escala");
  assert.ok(D.definirNota(st, lucas.id, "utr", "sete").erro, "texto não é nota");
  assert.strictEqual(lucas.notas, undefined, "erro não grava nada");
  D.definirNota(st, lucas.id, "utr", "7,416", "2026-10-01");
  assert.deepStrictEqual(lucas.notas.utr, { v: 7.42, em: "2026-10-01" }, "vírgula aceita, UTR com 2 casas");
  D.definirNota(st, lucas.id, "wtn", "18.34", "2026-10-01");
  assert.deepStrictEqual(lucas.notas.wtn, { v: 18.3, em: "2026-10-01" }, "WTN com 1 casa");
  assert.strictEqual(D.textoNotas(lucas), "UTR 7,42 · WTN 18,3");
  assert.strictEqual(D.notaAnterior(lucas, "utr"), null, "primeira nota não tem anterior");
  D.definirNota(st, lucas.id, "utr", "7,5", "2026-11-12"); D.definirNota(st, lucas.id, "utr", "7,6", "2026-11-12");
  assert.deepStrictEqual(lucas.notas.hist.filter((h) => h.t === "utr").map((h) => h.v), [7.42, 7.6], "o mesmo dia substitui, não duplica");
  assert.deepStrictEqual(D.notaAnterior(lucas, "utr"), { t: "utr", v: 7.42, em: "2026-10-01" });
  assert.strictEqual(D.textoNotas(lucas), "UTR 7,60 · WTN 18,3");
  /* sobrevive a salvar e ler, e à cópia de segurança; lixo guardado é descartado */
  assert.deepStrictEqual(D.normalizar(JSON.parse(JSON.stringify(st))).atletas[0].notas, lucas.notas);
  assert.deepStrictEqual(D.atletaLimpo({ id: "a1", nome: "Zé", notas: { utr: { v: 99, em: "2026-11-12" }, wtn: { v: 20, em: "ontem" }, hist: [{ t: "xyz", v: 3, em: "2026-11-12" }] } }).notas, undefined);
  const copia = D.normalizar(null); D.importar(copia, D.exportar(st));
  assert.deepStrictEqual(copia.atletas[0].notas, lucas.notas, "a cópia de segurança leva as notas");
  copia.atletas[0].notas.utr = { v: 8, em: "2026-12-01" }; D.importar(copia, D.exportar(st));
  assert.strictEqual(copia.atletas[0].notas.utr.v, 8, "importar não troca uma nota mais nova por uma mais antiga");
  /* relatório de todos os jogos e relatório de um jogo só */
  const opN = REL.opcoes(M, D, st, lucas.id, { geradoEm: "12/11/2026" });
  assert.ok(!opN.notaAtleta && !RJ.gerar(opN).includes("UTR") && !RJ.gerar(opN).includes("WTN"), "UTR e WTN fora do relatório dos jogos");
  const opP = REL.opcoesPartida(M, D, st, j2, { geradoEm: "12/11/2026" });
  assert.strictEqual(opP.reg.id, j2.id); assert.strictEqual(opP.reg.adversario, ""); assert.strictEqual(opP.placarFinal.fim, true);
  assert.deepStrictEqual(opP.anteriores.map((x) => x.id), [j1.id], "compara com os jogos anteriores, não com os de depois");
  assert.deepStrictEqual(REL.opcoesPartida(M, D, st, j1).anteriores, [], "o primeiro jogo não tem anterior");
  const htmlP = RJ.gerarPartida(opP);
  assert.ok(htmlP.includes("Lucas") && !htmlP.includes("UTR") && !htmlP.includes("WTN"), "relatório do jogo com o atleta, sem UTR e WTN");
  assert.ok(!htmlP.includes("Fulano") && !htmlP.includes("Andrade"), "relatório do jogo sem adversário nem sobrenome");
  /* jogo ainda em andamento também exporta, com o tempo de jogo */
  const jr = D.novoJogo(st, { atletaId: marina.id, torneio: "Treino", adversario: "Beltrana Oculta", cfg: { formato: "3sets", saca: "nos" } }).jogo;
  for (let i = 0; i < 12; i++) D.marcarPonto(M, jr, ponto(i % 3 !== 0));
  D.definirDuracao(jr, 75);
  const opA = REL.opcoesPartida(M, D, st, jr), htmlA = RJ.gerarPartida(opA);
  assert.strictEqual(opA.placarFinal.fim, false); assert.strictEqual(opA.reg.duracaoMin, 75);
  assert.ok(htmlA.includes("tempo de jogo 1h15") && !htmlA.includes("Beltrana") && !htmlA.includes("UTR"), "jogo em andamento: tempo sim, adversário e nota que não existe não");
  D.definirNota(st, lucas.id, "wtn", "", "2026-11-12");
  assert.strictEqual(D.textoNotas(lucas), "UTR 7,60", "campo vazio apaga a nota atual");
  D.definirNota(st, lucas.id, "wtn", "18,3", "2026-11-12");
  st.jogos = st.jogos.filter((x) => x.id !== jr.id); if (st.atual === jr.id) st.atual = j3 ? j3.id : null;
}

/* ── dupla (12/11/2026): rodízio do saque, quem fez o quê, resumo da "Dupla de", e simples e dupla não se misturam ── */
{
  const sd = D.normalizar(null), at = D.addAtleta(sd, "Lucas Andrade").atleta;
  const jd = D.novoJogo(sd, { atletaId: at.id, parceiro: "Pedro Lima", adversario: "Fulano e Beltrano", cfg: { formato: "3sets", saca: "nos", dupla: true, sacaDupla: "parceiro", semVantagem: true } }).jogo;
  assert.strictEqual(jd.cfg.dupla, true); assert.strictEqual(jd.parceiro, "Pedro Lima");
  const ordem = [];
  for (let g = 0; g < 6; g++) { ordem.push(D.sacadorDaDupla(M, jd) || "adv"); for (let k = 0; k < 4; k++) D.marcarPonto(M, jd, { fim: k % 2 ? "winner_nos" : "erro_dele", nos: true, quem: "atleta" }); }
  assert.deepStrictEqual(ordem, ["parceiro", "adv", "atleta", "adv", "parceiro", "adv"], "a dupla alterna quem saca a cada vez que é a vez dela");
  assert.strictEqual(jd.pontos[0].sacadorNos, "parceiro"); assert.strictEqual(jd.pontos[4].sacadorNos, undefined, "saque do adversário não tem sacador da dupla");
  assert.strictEqual(jd.pontos[1].quem, "atleta"); assert.strictEqual(jd.pontos[0].quem, undefined, "erro do adversário não é de ninguém da dupla");
  /* ace e dupla falta ficam com quem saca; trocar quem saca vale daqui em diante */
  const g7 = D.sacadorDaDupla(M, jd); assert.strictEqual(g7, "atleta");
  assert.ok(D.trocarSacadorDupla(M, jd)); assert.strictEqual(D.sacadorDaDupla(M, jd), "parceiro");
  D.marcarPonto(M, jd, { fim: "winner_nos", nos: true, saque: "ace", quem: "atleta" });
  assert.strictEqual(jd.pontos[jd.pontos.length - 1].quem, "parceiro", "ace é de quem sacou, mesmo marcado errado");
  D.marcarPonto(M, jd, { fim: "erro_nos", nos: false, quem: "parceiro", bola: "5-9" });
  const nd = D.numerosDaDupla(jd);
  assert.strictEqual(nd.parceiro.aces, 1); assert.strictEqual(nd.parceiro.erros, 1); assert.strictEqual(nd.atleta.winners, 12);
  assert.ok(nd.parceiro.pontosSacando >= 4);
  /* resumo e texto: "Dupla de Lucas", sem o parceiro nem os adversários */
  const rd = D.resumo(M, sd, jd), tx = D.textoCompartilhar(M, sd, jd);
  assert.strictEqual(rd.atleta, "Dupla de Lucas"); assert.strictEqual(rd.dupla, true);
  assert.ok(!/Pedro|Fulano|Beltrano/.test(JSON.stringify(rd) + tx), "nem parceiro nem adversários no resumo público");
  /* sobrevive a salvar e ler */
  const vd = D.normalizar(JSON.parse(JSON.stringify(sd))).jogos[0];
  assert.deepStrictEqual([vd.cfg.dupla, vd.cfg.sacaDupla, vd.parceiro, vd.inversoes], [true, "parceiro", "Pedro Lima", jd.inversoes]);
  assert.strictEqual(D.linhaJogo(M, sd, jd).dupla, true);
  /* simples e dupla separados na evolução e nos relatórios */
  D.encerrar(jd);
  const js = D.novoJogo(sd, { atletaId: at.id, cfg: { formato: "4games", saca: "nos" } }).jogo; for (let i = 0; i < 16; i++) D.marcarPonto(M, js, { fim: "winner_nos", nos: true });
  assert.deepStrictEqual(D.comparacao(M, sd, at.id, 8).jogos.map((x) => x.id), [js.id], "evolução de simples sem a dupla");
  assert.deepStrictEqual(D.comparacao(M, sd, at.id, 8, true).jogos.map((x) => x.id), [jd.id], "evolução das duplas sem o simples");
  assert.deepStrictEqual(REL.jogosDoRelatorio(M, D, sd, at.id).map((x) => x.id), [js.id], "relatório de todos os jogos: só simples");
  assert.deepStrictEqual(REL.opcoesPartida(M, D, sd, js).anteriores, [], "o jogo de simples não compara com a dupla");
  assert.strictEqual(D.cfgLimpa({ formato: "1set" }).dupla, false, "jogo antigo continua simples");
}

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
  assert.strictEqual(r.contas, 0, "nenhuma conta no banco de mentira");

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
  /* o handler usa a data de hoje: o aparelho que bate no limite é preparado hoje, não na data fixa de cima */
  const D = "d".repeat(24);
  for (let i = 0; i < USO.MAX_EVENTOS_DIA; i++) await USO.registrar(db, { a: D, e: "abriu", n: 0 }, Date.now());
  assert.strictEqual((await chama("POST", { a: D, e: "abriu" })).s, 429, "limite do dia");
  console.log("check-scout-app: ok");
})().catch((e) => { console.error(e); process.exit(1); });
