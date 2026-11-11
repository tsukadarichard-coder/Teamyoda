/* Alto rendimento (mty/alto-rendimento.js, cópia idêntica em netlify/functions/_alto-rendimento.js):
   periodização pelo calendário com prioridade, plano individual, marcador (a semana segue a data; quem volta recupera só os
   essenciais), registros e carga (CT + viagem), teto do dia, sessão do dia montada a partir de quem está presente,
   fechamento, avaliações e metas, migração das equipes. Rode: node tests/check-alto-rendimento.js */
const assert = require("assert"), fs = require("fs"), path = require("path");
const mty = path.join(__dirname, "../../mty/alto-rendimento.js"), srv = path.join(__dirname, "../../netlify/functions/_alto-rendimento.js");
assert.strictEqual(fs.readFileSync(mty, "utf8"), fs.readFileSync(srv, "utf8"), "a cópia do servidor é idêntica");
const A = require(mty);

/* catálogo mínimo, no formato do app */
const cat = [
  { c: "IP001", n: "Saque e devolução com a bola seguinte", f: "IP", e: ["G", "A", "C"], m: "saque devolução" },
  { c: "IP021", n: "Iniciar o ponto com intenção", f: "IP", e: ["A", "C"], m: "saque", tl: "ler" },
  { c: "PDS001", n: "Saque aberto", f: "PDS", e: ["A", "C"], m: "saque" },
  { c: "DT031", n: "Manter a bola disponível", f: "DT", e: ["A", "C"], m: "troca", tl: "ler" },
  { c: "DC001", n: "Cruzado profundo", f: "DC", e: ["A", "C"], m: "cruzado profundidade" },
  { c: "CF001", n: "Força com elástico", f: "CF", e: ["A", "C"], m: "força elástico" },
  { c: "CF002", n: "Sprints de reação", f: "CF", e: ["A", "C"], m: "velocidade sprint" },
  { c: "MV001", n: "Split e recuperação", f: "MV", e: ["A", "C"], m: "split agilidade" },
  { c: "DM001", n: "Rotina dos 20 segundos", f: "DM", e: ["A", "C"], m: "rotina respiração" },
  { c: "JA001", n: "Sets com regra", f: "JA", e: ["A", "C"], m: "placar" },
  { c: "PT001", n: "Puxa e inverte", f: "PT", e: ["A", "C"], m: "padrão" },
];
const cal = [
  { id: "t1", nome: "Copa Preparatória", inicio: "2026-11-23", fim: "2026-11-29", prioridade: "preparatorio" },
  { id: "t2", nome: "Estadual", inicio: "2026-12-14", fim: "2026-12-20", prioridade: "secundario" },
  { id: "t3", nome: "Brasileiro", inicio: "2027-01-11", fim: "2027-01-17", prioridade: "principal" },
];

/* 1. fases */
const L = A.fasesDoCalendario(cal, "2026-11-11", 12);
assert.strictEqual(L[0].inicio, "2026-11-09", "começa na segunda");
assert.deepStrictEqual(L.map((s) => s.fase), ["base", "especifica", "preparatoria", "ponte", "precompetitiva", "competicao", "especifica", "precompetitiva", "precompetitiva", "competicao", "transicao", "base"]);

/* 2. plano */
const plano = A.gerarPlano({ calendario: cal, inicio: "2026-11-11", semanas: 12, minutosSemana: 600, prioridades: ["fundo", "saque"], estagio: "C", catalogo: cat });
const sems = A.semanasDoPlano(plano);
assert.strictEqual(sems.length, 12);
assert(plano.blocos.length >= 8 && plano.fases.length >= 8, "blocos e fases");
assert.strictEqual(sems[0].semana.cargaAlvo.ua, 3000, "base: 600 min × PSE 5");
assert.strictEqual(sems[9].semana.cargaAlvo.minutos, 300, "competição: metade do volume");
assert(sems[0].semana.conteudos.some((c) => c.tema === "tec:fundo" && c.essencial), "a 1ª prioridade da ficha vira conteúdo essencial da base");
assert(sems[9].semana.conteudos.some((c) => c.tipo === "fora_do_ct" && c.tema === "jogo:torneio"), "semana de torneio tem os jogos (fora do CT)");
assert(sems.every((x) => x.semana.conteudos.every((c) => c.id && c.pilar && c.titulo)));
assert(sems[1].semana.conteudos.find((c) => c.tema === "ip:inicio").codigoExercicio, "exercício do catálogo escolhido");

/* 3. marcador: semana segue a data; atrasados só os essenciais */
const ar = { ativo: true, calendario: cal, plano, progresso: { cumpridos: {} }, cargaSemanas: {} };
let m = A.marcador(ar, "2026-11-11");
assert.strictEqual(m.semanaN, 1); assert.strictEqual(m.fase, "base"); assert.strictEqual(m.pct, 0);
m = A.marcador(ar, "2026-11-18");
assert.strictEqual(m.semanaN, 2, "atleta que ficou fora: a semana segue a data");
const essS1 = sems[0].semana.conteudos.filter((c) => c.essencial && c.tipo !== "fora_do_ct").map((c) => c.id);
const naoEssS1 = sems[0].semana.conteudos.filter((c) => !c.essencial).map((c) => c.id);
assert.deepStrictEqual(m.atrasados.map((c) => c.id).sort(), essS1.sort(), "voltam só os essenciais da semana perdida");
assert(!A.pendentes(ar, "2026-11-18").some((p) => naoEssS1.includes(p.id)), "os não essenciais expiram");

/* 4. registros e carga */
const r1 = A.normalizarRegistro({ data: "2026-11-11", origem: "viagem", tipo: "treino", minutos: 90, pse: 6, conteudosFeitos: [essS1[0]], autor: "atleta" });
assert.strictEqual(r1.ua, 540); assert.strictEqual(r1.confirmado, false, "registro do atleta chega a confirmar");
let x = A.aplicarRegistro(ar, r1, "2026-11-11");
assert.strictEqual(x.progresso.cumpridos[essS1[0]].vezes, 1); assert.strictEqual(x.progresso.cumpridos[essS1[0]].onde, "viagem");
assert.deepStrictEqual(x.cargaSemanas["2026-11-09"], { minutos: 90, ua: 540, sessoes: 1, jogos: 0, viagem: 540 });
const ar2 = { ...ar, ...x };
const r2 = A.normalizarRegistro({ data: "2026-11-12", origem: "ct", tipo: "jogo", minutos: 100, pse: 8, jogo: { adversario: "João", placar: "6/4 6/3", resultado: "vitoria" } });
x = A.aplicarRegistro(ar2, r2, "2026-11-12");
assert.strictEqual(x.cargaSemanas["2026-11-09"].ua, 1340); assert.strictEqual(x.cargaSemanas["2026-11-09"].jogos, 1);
const rec = A.recalcular(ar, [r2, r1], "2026-11-12");
assert.deepStrictEqual(rec.cargaSemanas, x.cargaSemanas, "recalcular a partir dos registros dá o mesmo");
assert.strictEqual(A.cargaSemanaAtual({ ...ar, ...x }, "2026-11-12").pct, 45, "1340 de 3000 UA");
assert(A.normalizarRegistro({ minutos: 9999, pse: 50 }).minutos === 600 && A.normalizarRegistro({ pse: 50 }).pse === 10, "limites");

/* 5. teto do dia */
const jogos = [{ tipo: "jogo", data: "2026-11-29" }, { tipo: "jogo", data: "2026-11-30" }];
assert.strictEqual(A.tetoDoDia(ar, jogos, "2026-12-01").v, "regenerativo");
assert.strictEqual(A.tetoDoDia(ar, [], "2027-01-09").v, "reduzido", "afinação para o principal");
assert.strictEqual(A.tetoDoDia(ar, [], "2026-11-11").v, "normal");
assert.strictEqual(A.tetoDoDia({ ...ar, cargaSemanas: { "2026-11-09": { ua: 4000 } } }, [], "2026-11-12").v, "reduzido", "carga acima de 120%");

/* 6. status pelo calendário */
assert.strictEqual(A.statusAtleta(ar, "2026-11-25").v, "torneio");
assert.strictEqual(A.statusAtleta(ar, "2026-11-22").v, "torneio", "véspera conta como viagem");
assert.strictEqual(A.statusAtleta(ar, "2026-12-01").v, "voltou");
assert.strictEqual(A.statusAtleta(ar, "2026-12-05").v, "ct");

/* 7. sessão do dia: três presentes, um voltou de torneio, outro com prioridades diferentes */
const planoB = A.gerarPlano({ calendario: [], inicio: "2026-11-11", semanas: 8, minutosSemana: 600, prioridades: ["fundo", "rede"], estagio: "C", catalogo: cat });
const planoC = A.gerarPlano({ calendario: [], inicio: "2026-11-11", semanas: 8, minutosSemana: 600, prioridades: ["rede", "saque"], estagio: "C", catalogo: cat });
const atletas = [
  { id: "a", nome: "Ana", ar, registros: [] },
  { id: "b", nome: "Bia", ar: { ativo: true, plano: planoB, progresso: { cumpridos: {} } }, registros: [] },
  { id: "c", nome: "Caio", ar: { ativo: true, plano: planoC, progresso: { cumpridos: {} } }, registros: [{ tipo: "jogo", data: "2026-11-10" }, { tipo: "jogo", data: "2026-11-11" }] },
];
const s = A.montarSessao({ atletas, hoje: "2026-11-12", duracaoMin: 120, catalogo: cat, estagio: "C" });
assert.deepStrictEqual(s.presentes, ["a", "b", "c"]);
assert.strictEqual(s.blocos.reduce((t, b) => t + b.minutos, 0), 120, "os blocos somam a duração");
assert.strictEqual(s.blocos[0].tema, "entrada"); assert.strictEqual(s.blocos[1].tema, "ip:inicio");
assert.strictEqual(s.blocos[s.blocos.length - 1].tema, "jogo");
const fundo = s.blocos.find((b) => b.tema === "tec:fundo");
assert(fundo && fundo.tipo === "coletivo" && fundo.atletas.sort().join() === "a,b", "Ana e Bia têm fundo pendente: bloco coletivo das duas");
assert.strictEqual(s.atletas.find((a) => a.id === "c").teto.v, "regenerativo");
assert.strictEqual(s.blocos[1].dose.c, "leve", "dose por atleta no bloco coletivo");
assert(!s.blocos[s.blocos.length - 1].atletas.includes("c"), "regenerativo fica fora do jogo aplicado");
const ind = s.blocos.find((b) => b.tipo === "individual");
assert(ind && Object.keys(ind.tarefas).length >= 2, "tarefas individuais com o que sobrou do plano de cada um");
const prev = A.conteudosDaSessao(s, "a");
assert(prev.length >= 2 && prev.every((c) => c.id && c.titulo), "conteúdos previstos para Ana");
/* sozinho no CT: a sessão ainda sai, sem bloco de tema em comum */
const solo = A.montarSessao({ atletas: [atletas[1]], hoje: "2026-11-12", duracaoMin: 90, catalogo: cat, estagio: "C" });
assert(!solo.blocos.some((b) => b.tipo === "coletivo" && !["entrada", "ip:inicio", "jogo"].includes(b.tema)) && solo.blocos.some((b) => b.tipo === "individual"));

/* 8. fechamento */
s.id = "ses1";
const regs = A.registrosDoFechamento(s, { a: { pse: 7 }, b: { pse: 6, minutos: 90, feitos: [prev[0].id] }, c: { presente: false } });
assert.strictEqual(regs.length, 2, "quem não treinou não gera registro");
const ra = regs.find((r) => r.conteudosFeitos.length === prev.length);
assert(ra && ra.minutos === 120 && ra.ua === 840 && ra.origem === "ct" && ra.sessaoId === "ses1");

/* 9. avaliações e metas */
const avs = [{ testeId: "t-agil", data: "2026-09-01", valor: 5.2 }, { testeId: "t-agil", data: "2026-11-01", valor: 4.9 }, { testeId: "t-salto", data: "2026-11-01", valor: 40 }];
const ev = A.evolucaoTestes(avs);
const agil = ev.find((e) => e.teste.id === "t-agil");
assert.strictEqual(agil.diferenca, -0.3); assert.strictEqual(agil.melhorou, true, "menos tempo é melhor");
assert.strictEqual(ev.find((e) => e.teste.id === "t-salto").melhorou, null, "uma medida só: ainda sem comparação");
assert.deepStrictEqual(A.situacaoMeta({ testeId: "t-agil", alvo: 4.8 }, avs), { atual: 4.9, atingida: false });
assert.deepStrictEqual(A.situacaoMeta({ testeId: "t-agil", alvo: 5 }, avs), { atual: 4.9, atingida: true });

/* 10. ajuste semanal */
const ajs = A.ajusteSemanal({ ...ar, cargaSemanas: { "2026-11-09": { ua: 1000 } } }, "2026-11-18");
assert(ajs.some((a) => a.tipo === "carga_baixa"), "semana anterior com 33% do alvo");

/* 11. migração das equipes */
const alunos = [{ id: "a1" }, { id: "a2", altoRendimento: { ativo: true } }, { id: "a3" }];
assert.deepStrictEqual(A.atletasDasEquipes([{ membros: ["a1", "a2"] }], alunos).map((a) => a.id), ["a1"]);

/* 12. plano pela IA: o calendário decide fases e carga; a IA escolhe conteúdos e exercícios */
const esq = A.esqueleto(plano);
assert.strictEqual(esq.length, 12); assert.strictEqual(esq[9].faseNome, "Competição"); assert(esq[0].modelo.length && esq[0].cargaAlvo.ua === 3000);
const resp = { prioridade: "Devolução agressiva antes do Brasileiro", observacao: [{ t: "a · scout", d: "devolução abaixo de 55%" }], semanas: [
  { n: 1, foco: "Construção", conteudos: [{ tema: "tec:fundo", ex: "DC001", vezes: 2, essencial: true, criterio: "75% além da linha de saque" }, { tema: "tat:situacao", ex: "dt031", vezes: 1 }, { tema: "fis:forca", ex: "CF001", vezes: 2, tipo: "individual" }] },
  { n: 10, foco: "Torneio", conteudos: [{ tema: "men:rotina", ex: "DM001", vezes: 1 }] },
] };
const pIA = A.aplicarIA(plano, resp, cat);
const s1 = A.semanasDoPlano(pIA)[0].semana, s10 = A.semanasDoPlano(pIA)[9].semana;
assert.strictEqual(pIA.origem, "ia"); assert.strictEqual(pIA.semanasIA, 2); assert.strictEqual(pIA.prioridade, "Devolução agressiva antes do Brasileiro");
assert.deepStrictEqual(s1.conteudos.map((c) => c.codigoExercicio), ["DC001", "DT031", "CF001"], "códigos normalizados");
assert.strictEqual(s1.conteudos[0].nomeExercicio, "Cruzado profundo"); assert.strictEqual(s1.conteudos[2].tipo, "individual"); assert.strictEqual(s1.foco, "Construção");
assert.deepStrictEqual(s1.cargaAlvo, sems[0].semana.cargaAlvo, "a carga continua a do calendário");
assert(s10.conteudos.some((c) => c.tema === "jogo:torneio" && c.tipo === "fora_do_ct"), "semana de torneio sempre com os jogos");
assert.deepStrictEqual(A.semanasDoPlano(pIA)[1].semana.conteudos, sems[1].semana.conteudos, "semana que a IA não mandou fica com o modelo");
assert.throws(() => A.aplicarIA(plano, { semanas: [{ n: 1, conteudos: [{ tema: "tec:fundo", ex: "XX999" }] }] }, cat), /XX999/, "código inventado derruba");
assert.throws(() => A.aplicarIA(plano, { semanas: [] }, cat), /semanas/);
/* sessão com plano da IA: o bloco coletivo usa o exercício mais comum */
const pA = A.aplicarIA(planoB, { semanas: [{ n: 1, conteudos: [{ tema: "tec:fundo", ex: "DC001", vezes: 1, essencial: true }] }] }, cat);
const pB = A.aplicarIA(planoC, { semanas: [{ n: 1, conteudos: [{ tema: "tec:fundo", ex: "DC001", vezes: 1, essencial: true }] }] }, cat);
const pC = A.aplicarIA(planoC, { semanas: [{ n: 1, conteudos: [{ tema: "tec:fundo", ex: "DT031", vezes: 1, essencial: true }] }] }, cat);
const sIA = A.montarSessao({ atletas: [{ id: "x", ar: { plano: pA } }, { id: "y", ar: { plano: pB } }, { id: "z", ar: { plano: pC } }], hoje: "2026-11-12", duracaoMin: 120, catalogo: cat, estagio: "C" });
assert.strictEqual(sIA.blocos.find((b) => b.tema === "tec:fundo").codigoExercicio, "DC001");

/* ── turmas do alto rendimento: grupo salvo e controle de presença pelas sessões fechadas ── */
{
  const turma = A.limparTurma({ id: "tu1", nome: "  Juvenil A  ", membros: ["a", "b", "b", "x", "c"], professorUid: "p1", professorNome: "Carlos", horario: "seg, qua e sex às 14h" }, ["a", "b", "c"]);
  assert.deepStrictEqual([turma.nome, turma.membros, turma.horario], ["Juvenil A", ["a", "b", "c"], "seg, qua e sex às 14h"], "nome limpo, sem repetido e sem quem não é do alto rendimento");
  const ses = [
    { id: "s1", turmaId: "tu1", status: "fechada", data: "2026-11-02", convocados: ["a", "b", "c"], presentes: ["a", "b"], realizado: { a: { presente: true }, b: { presente: true } } },
    { id: "s2", turmaId: "tu1", status: "fechada", data: "2026-11-04", convocados: ["a", "b", "c"], presentes: ["a", "b", "c", "z"], realizado: { a: { presente: true }, b: { presente: false }, c: { presente: true }, z: { presente: true } } },
    { id: "s3", turmaId: "tu1", status: "fechada", data: "2026-11-06", convocados: ["a", "b"], presentes: ["a"], realizado: { a: { presente: true } } },
    { id: "s4", turmaId: "tu1", status: "rascunho", data: "2026-11-09", convocados: ["a", "b", "c"], presentes: ["a"] },
    { id: "s5", turmaId: "outra", status: "fechada", data: "2026-11-05", convocados: ["a"], presentes: ["a"] },
    { id: "s6", status: "fechada", data: "2026-11-05", presentes: ["a", "b", "c"] },
  ];
  /* horários fixos (para a Agenda): só os válidos, sem repetir, de segunda a domingo; duração com padrão de 120 min */
  assert.deepStrictEqual([turma.horarios, turma.duracaoMin], [[], 120], "turma antiga, sem horário fixo, continua valendo");
  const comHorario = A.limparTurma({ id: "tu2", nome: "B", membros: ["a"], duracaoMin: 90, horarios: [{ dia: 0, hora: "09:00" }, { dia: 3, hora: "14:00", quadraId: "q1" }, { dia: 1, hora: "14:00" }, { dia: 1, hora: "14:00" }, { dia: 9, hora: "10:00" }, { dia: 2, hora: "25:00" }, null] });
  assert.deepStrictEqual(comHorario.horarios, [{ dia: 1, hora: "14:00", quadraId: "" }, { dia: 3, hora: "14:00", quadraId: "q1" }, { dia: 0, hora: "09:00", quadraId: "" }]);
  assert.strictEqual(comHorario.duracaoMin, 90);
  assert.strictEqual(A.limparTurma({ duracaoMin: 5 }).duracaoMin, 120);
  const P = A.presencaDaTurma(turma, ses);
  assert.deepStrictEqual(P.sessoes.map((x) => x.id), ["s3", "s2", "s1"], "só as fechadas desta turma, da mais recente para a mais antiga");
  assert.deepStrictEqual([P.sessoes[1].presentes, P.sessoes[1].ausentes, P.sessoes[1].convidados], [["a", "c"], ["b"], ["z"]], "quem saiu no fechamento conta como ausente; atleta de fora é convidado");
  assert.deepStrictEqual(P.porAtleta.a, { sessoes: 3, presencas: 3, faltas: 0, pct: 100, ultimaFalta: null });
  assert.deepStrictEqual(P.porAtleta.b, { sessoes: 3, presencas: 1, faltas: 2, pct: 33, ultimaFalta: "2026-11-06" });
  assert.deepStrictEqual(P.porAtleta.c, { sessoes: 2, presencas: 1, faltas: 1, pct: 50, ultimaFalta: "2026-11-02" }, "quem não era da turma no dia não leva falta");
  assert.deepStrictEqual(A.presencaDaTurma(turma, []).porAtleta.a, { sessoes: 0, presencas: 0, faltas: 0, pct: null, ultimaFalta: null }, "turma sem sessão");
}

console.log("check-alto-rendimento: ok");
