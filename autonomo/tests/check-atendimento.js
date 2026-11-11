/* Padrão de Atendimento MTY (mty/atendimento.js): campos novos do registro da aula, checklist (3 itens marcam sozinhos),
   cartão de preparação, painel do Head Trainer (% de checklist por professor, aulas sem registro há mais de 24 h, 3 faltas em
   30 dias, 60 dias sem marco, fichas para a conversa semanal) e relatório do ciclo para o cliente (dados filtrados, prompt,
   leitura da resposta da IA, rascunho de reserva e HTML). Rode: node tests/check-atendimento.js */
const assert = require("assert"), path = require("path");
const A = require(path.join(__dirname, "../../mty/atendimento.js"));
const QL = require(path.join(__dirname, "../../mty/aulas-mes.js"));
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepStrictEqual(a, b, m); n++; };

/* ── registro da aula ── */
{
  const vazio = A.camposDoRegistro({});
  eq(Object.keys(vazio), ["atendimento"], "sem nada preenchido só entra o checklist");
  eq(vazio.atendimento, { v: 1, ficha: false, nome: false, objetivo: false, retorno: false, devolutiva: false, registro: true }, "registro marca sozinho");
  const cheio = A.camposDoRegistro({ fichaVista: true, marcados: { nome: true, objetivo: true, retorno: true }, conquista: { texto: "  Sacou 6 de 10 no alvo ", marco: true },
    pilares: { tecnico: "Empunhadura firme", mental: " ", outro: "x" }, notaPessoal: " Viaja no feriado " });
  eq(cheio.conquista, { texto: "Sacou 6 de 10 no alvo", marco: true }, "conquista limpa");
  eq(cheio.pilares, { tecnico: "Empunhadura firme" }, "só pilar preenchido e conhecido");
  eq(cheio.notaPessoal, "Viaja no feriado", "nota pessoal limpa");
  ok(cheio.atendimento.devolutiva && cheio.atendimento.ficha, "devolutiva vem da conquista; ficha vem da preparação aberta");
  const c = A.checklist(cheio);
  eq([c.feitos, c.total, c.completo], [6, 6, true], "checklist completo");
  eq(A.checklist(vazio).feitos, 1, "sem marcar nada, só o registro conta");
  eq(A.checklist({ tipo: "sessao", corrigi: "x" }), null, "registro antigo fica fora das contas");
  ok(!A.camposDoRegistro({ conquista: { texto: "   ", marco: true } }).conquista, "marco sem texto não vira conquista");
  eq(A.ITENS.filter((i) => i.auto).map((i) => i.id), ["ficha", "devolutiva", "registro"], "3 itens marcam sozinhos");
  eq(A.MANUAIS, ["nome", "objetivo", "retorno"], "3 itens o professor marca");
}

/* ── preparação ── */
{
  const aluno = { id: "a1", nome: "Ana Souza", registros: [
    { id: "r1", tipo: "sessao", data: "2026-10-01", proximoFoco: "Saque com alvo", conquista: { texto: "Manteve 10 bolas", marco: false }, notaPessoal: "Torneio dia 20" },
    { id: "r2", tipo: "sessao", data: "2026-10-08", conquista: { texto: "Primeiro ace", marco: true } },
    { id: "r3", tipo: "sessao", data: "2026-10-15", presenca: "ausente", conquista: { texto: "não conta" } },
    { id: "j1", tipo: "jogo", data: "2026-10-16" },
  ] };
  const p = A.preparacao(aluno, {});
  eq(p.ultimaConquista, { texto: "Primeiro ace", marco: true, data: "2026-10-08" }, "última conquista de aula com presença");
  eq(p.notaPessoal, { texto: "Torneio dia 20", data: "2026-10-01" }, "nota pessoal mais recente");
  eq(p.foco.titulo, "Saque com alvo", "sem plano, o foco vem do próximo foco da última aula");
  eq(p.ultimaAula, "2026-10-08", "falta não conta como última aula");
  eq(p.marcos, 1);
  eq(A.preparacao(aluno, { foco: { titulo: "Aula 3 · Devolução" } }).foco.titulo, "Aula 3 · Devolução", "com plano, o foco é a aula em vigor");
  const novo = A.preparacao({ id: "x", nome: "Novo" }, {});
  eq([novo.foco, novo.ultimaConquista, novo.notaPessoal], [null, null, null], "aluno sem histórico não quebra");
}

/* ── painel ── */
{
  const hoje = "2026-11-11", agora = new Date(2026, 10, 11, 10, 0).getTime();
  const at = (o) => A.camposDoRegistro(o);
  const completo = { fichaVista: true, marcados: { nome: true, objetivo: true, retorno: true }, conquista: { texto: "Boa" } };
  const alunos = [
    { id: "a1", nome: "Ana", professorUid: "p1", professorNome: "Paulo", registros: [
      { id: "r1", tipo: "sessao", data: "2026-11-03", registradoPorUid: "p1", registradoPorNome: "Paulo", ...at(completo) },
      { id: "r2", tipo: "sessao", data: "2026-11-10", registradoPorUid: "p1", registradoPorNome: "Paulo", ...at({ ...completo, conquista: { texto: "Marco!", marco: true } }) },
      { id: "r0", tipo: "sessao", data: "2026-10-20", registradoPorUid: "p1", registradoPorNome: "Paulo", corrigi: "antigo" },
    ] },
    { id: "a2", nome: "Bia", professorUid: "p2", professorNome: "Rita", registros: [
      { id: "r3", tipo: "sessao", data: "2026-08-20", registradoPorUid: "p2", registradoPorNome: "Rita", ...at({ marcados: { nome: true } }) },
      { id: "r4", tipo: "sessao", data: "2026-11-04", registradoPorUid: "p2", registradoPorNome: "Rita", ...at({ marcados: { nome: true } }) },
      { id: "r5", tipo: "sessao", data: "2026-11-06", registradoPorUid: "p2", registradoPorNome: "Rita", ...at({}) },
      { id: "r6", tipo: "sessao", data: "2026-11-09", registradoPorUid: "p2", registradoPorNome: "Rita", ...at({}) },
    ] },
    { id: "a3", nome: "Caio", professorUid: "p2", professorNome: "Rita", registros: [] },
  ];
  const oc = (id, alunoId, data, extra) => ({ id, tipo: "regular", origemTipo: "individual", origemId: alunoId, data, horaInicio: "09:00", horaFim: "10:00",
    professorUid: alunoId === "a1" ? "p1" : "p2", professorNome: alunoId === "a1" ? "Paulo" : "Rita", status: "agendada", ...extra });
  const ocorrencias = [
    oc("o1", "a1", "2026-11-03"), oc("o2", "a1", "2026-11-10"),
    oc("o3", "a2", "2026-11-04"), oc("o4", "a2", "2026-11-06"), oc("o5", "a2", "2026-11-09"),
    oc("o6", "a3", "2026-11-02", { status: "realizada", presencas: { a3: "falta" } }),
    oc("o7", "a3", "2026-11-05", { status: "realizada", presencas: { a3: "falta" } }),
    oc("o8", "a3", "2026-11-07", { status: "realizada", presencas: { a3: "falta" } }),
    oc("o9", "a3", "2026-11-09"),                                   // sem registro há mais de 24 h
    oc("o10", "a3", "2026-11-10", { horaInicio: "18:00", horaFim: "19:00" }), // menos de 24 h: ainda não é atraso
    oc("o11", "a3", "2026-11-08", { status: "realizada", presencas: { a3: "presente" } }), // marcada na Agenda, sem ficha
    oc("o12", "a3", "2026-11-01", { status: "cancelada" }),
  ];
  const aulas = QL.aulasDoPeriodo({ ocorrencias, alunos, turmas: [], inicio: A.somaDias(hoje, -29), fim: hoje, hoje });
  const P = A.painel({ alunos, turmas: [], aulas, hoje, agora });
  const paulo = P.professores.find((p) => p.nome === "Paulo"), rita = P.professores.find((p) => p.nome === "Rita");
  eq([paulo.aulas, paulo.completas, paulo.pctCompleto], [2, 2, 100], "Paulo: 2 aulas com o padrão novo, as duas completas (a antiga não conta)");
  eq([rita.aulas, rita.completas, rita.pctCompleto], [3, 0, 0], "Rita: 3 aulas na janela, nenhuma completa");
  eq(rita.mediaItens, 1.3, "média de itens por aula");
  ok(rita.itemMaisEsquecido && rita.itemMaisEsquecido.vezes === 3, "item mais esquecido");
  eq(P.professores[0].nome, "Rita", "quem está pior aparece primeiro");
  eq(P.atrasadas.map((x) => x.data + ":" + x.tipo).sort(), ["2026-11-08:so-agenda", "2026-11-09:sem-registro"], "aula sem registro há mais de 24 h e aula só marcada na Agenda");
  ok(!P.atrasadas.some((x) => x.data === "2026-11-10"), "menos de 24 h não é atraso");
  eq(rita.atrasadas, 2, "atrasadas contam para o professor da aula");
  eq(P.alunosFaltas.map((x) => [x.nome, x.faltas]), [["Caio", 3]], "3 faltas em 30 dias");
  eq(P.alunosSemMarco.map((x) => [x.nome, x.dias, x.ultimoMarco]), [["Bia", 83, null]], "60 dias sem marco conta da primeira aula com o padrão; Ana tem marco recente");
  const motivos = rita.conversa.map((c) => c.nome + ": " + c.motivo);
  ok(motivos.includes("Caio: 2 aulas sem registro: 08/11 e 09/11"), "conversa: aulas sem registro do mesmo aluno num item só");
  ok(motivos.some((m) => /^Caio: 3 faltas em 30 dias/.test(m)), "conversa: faltas");
  ok(motivos.some((m) => /^Bia: Nenhum marco em 83 dias/.test(m)), "conversa: sem marco");
  ok(motivos.some((m) => /^Bia: Sem conquista registrada nas últimas 4 aulas/.test(m)), "conversa: sem conquista");
  ok(motivos.some((m) => /^Bia: Checklist incompleto em 3 aulas/.test(m)), "conversa: checklist incompleto");
  ok(rita.conversa.length <= 6 && rita.conversa[0].peso >= rita.conversa[rita.conversa.length - 1].peso, "até 6, da mais urgente para a menos");
  eq(paulo.conversa, [], "professor em dia não tem ficha sugerida");
  eq(P.totais, { aulas: 5, completas: 2, pctCompleto: 40, atrasadas: 2, faltas: 1, semMarco: 1 }, "totais");
  const vazio = A.painel({ alunos: [], turmas: [], aulas: [], hoje, agora });
  eq([vazio.professores, vazio.totais.pctCompleto], [[], null], "academia sem dados não quebra");
  /* limites configuráveis */
  eq(A.painel({ alunos, turmas: [], aulas, hoje, agora, limites: { faltas: 4 } }).alunosFaltas, [], "limite de faltas respeitado");
  /* aluno só de turma herda o professor da turma */
  eq(A.professorDoAluno({ id: "z" }, [{ id: "t1", membros: ["z"], professorUid: "p9", professorNome: "Leo" }]).nome, "Leo");
}

/* ── relatório do ciclo ── */
{
  const aluno = { id: "a1", nome: "Ana Souza", nascimento: "2015-03-10", registros: [
    { id: "r1", tipo: "sessao", data: "2026-09-02", corrigi: "SEGREDO-CORRIGI", ignorei: "SEGREDO-IGNOREI", mudaria: "SEGREDO-MUDARIA", leituraDaAula: "SEGREDO-LEITURA",
      notaIndividual: "SEGREDO-NOTA", notaPessoal: "SEGREDO-PESSOAL", proximoFoco: "Devolução de segundo saque",
      conquista: { texto: "Trocou 12 bolas cruzadas", marco: false }, pilares: { tecnico: "Terminação mais alta", mental: "Respirou entre os pontos" },
      temas: [{ nome: "Cruzado profundo", conceito: "Direção", status: "atingiu" }] },
    { id: "r2", tipo: "sessao", data: "2026-09-09", conquista: { texto: "Primeiro jogo completo", marco: true }, pilares: { tatico: "Abriu a quadra antes de atacar" },
      temas: [{ nome: "Cruzado profundo", conceito: "Direção", status: "parcial" }] },
    { id: "r3", tipo: "sessao", data: "2026-09-16", presenca: "ausente", conquista: { texto: "não conta" } },
    { id: "r4", tipo: "sessao", data: "2026-12-01", conquista: { texto: "fora do período" } },
  ] };
  eq(A.publicoPadrao(aluno, "2026-11-11"), "pais", "menor de 18: versão para os pais");
  eq(A.publicoPadrao({ nascimento: "1990-01-01" }, "2026-11-11"), "adulto");
  eq(A.publicoPadrao({}, "2026-11-11"), "adulto", "sem nascimento: adulto");
  eq(A.periodoPadrao(aluno, "2026-11-11"), { de: "2026-08-14", ate: "2026-11-11" }, "sem relatório anterior: 90 dias");
  eq(A.periodoPadrao({ relatoriosCiclo: [{ status: "publicado", periodo: { de: "2026-07-01", ate: "2026-09-30" } }, { status: "rascunho", periodo: { ate: "2026-10-30" } }] }, "2026-11-11"),
    { de: "2026-10-01", ate: "2026-11-11" }, "continua do último publicado");
  const d = A.dadosRelatorio(aluno, { de: "2026-09-01", ate: "2026-09-30" });
  eq([d.aulas, d.conquistas.length, d.marcos.length], [2, 2, 1], "só aulas com presença, dentro do período");
  eq(d.pilares.tecnico.length + d.pilares.tatico.length + d.pilares.mental.length + d.pilares.fisico.length, 3, "observações por pilar");
  eq(d.temas[0], { nome: "Cruzado profundo", conceito: "Direção", atingiu: 1, parcial: 1, nao_atingiu: 0 }, "temas somados");
  eq(d.focoProximo, "Devolução de segundo saque");
  ok(A.temDados(d) && !A.temDados(A.dadosRelatorio(aluno, { de: "2025-01-01", ate: "2025-01-31" })), "período vazio é reconhecido");
  const semSegredo = (s) => !/SEGREDO/.test(s);
  ok(semSegredo(JSON.stringify(d)), "anotações internas não entram nos dados do relatório");
  const pPais = A.promptRelatorio(d, { publico: "pais", academia: "Team Yoda", treinador: "Paulo" });
  ok(semSegredo(pPais), "anotações internas não chegam à IA");
  ok(/PAIS/.test(pPais) && /Ana/.test(pPais) && !/Souza/.test(pPais), "versão dos pais, só o primeiro nome");
  ok(/SOMENTE os fatos/.test(pPais) && /\[MARCO\]/.test(pPais) && /Primeiro jogo completo/.test(pPais), "regras e conquistas no prompt");
  ok(pPais.indexOf("Primeiro jogo completo") < pPais.indexOf("Trocou 12 bolas"), "marco vem primeiro");
  ok(/Observações do pilar Físico: nenhuma/.test(pPais), "pilar sem registro é dito à IA");
  ok(/PRÓPRIO ALUNO/.test(A.promptRelatorio(d, { publico: "adulto" })), "versão do adulto");

  const resp = 'Aqui está:\n```json\n{"abertura":"Foi um bom ciclo.","pilares":{"tecnico":"Terminou mais alto.","tatico":"","fisico":"","mental":"Respirou."},"conquistas":["Primeiro jogo completo","Trocou 12 bolas"],"proximoCiclo":"Devolução.","fechamento":"Parabéns!","extra":"x"}\n```';
  const t = A.lerResposta(resp);
  eq(Object.keys(t), ["abertura", "pilares", "conquistas", "proximoCiclo", "fechamento"], "só os campos conhecidos");
  eq([t.pilares.tatico, t.conquistas.length], ["", 2]);
  assert.throws(() => A.lerResposta("não sei"), /formato esperado/); n++;
  assert.throws(() => A.lerResposta('{"abertura":"","pilares":{},"conquistas":[]}'), /vazia/); n++;
  const r = A.rascunhoSemIA(d, "pais");
  ok(/Ana fez 2 aulas/.test(r.abertura) && r.conquistas[0] === "Primeiro jogo completo" && r.pilares.tecnico === "Terminação mais alta", "rascunho de reserva sem IA");
  ok(/você fez 2 aulas/.test(A.rascunhoSemIA(d, "adulto").abertura));

  const rel = { periodo: { de: d.de, ate: d.ate }, aulas: d.aulas, texto: { ...t, abertura: "Foi <b>bom</b>.\nSegunda linha." }, marcos: d.marcos,
    mensagemCiclo: { texto: "Orgulho de vocês.", autor: "Richard Tsukada" }, mensagemIndividual: "Ana, continue assim.", publicadoPor: "Paulo", publicadoEm: "2026-10-01T10:00:00Z" };
  const h = A.html(rel, { nome: "Ana", academia: "Team Yoda" });
  ok(/Relatório do ciclo · Ana/.test(h) && /01\/09\/2026 a 30\/09\/2026 · 2 aulas · Team Yoda/.test(h), "cabeçalho");
  ok(/Foi &lt;b&gt;bom&lt;\/b&gt;\./.test(h) && !/<b>bom/.test(h), "texto sempre escapado");
  ok(/Marcos do ciclo/.test(h) && /Conquistas/.test(h) && /Evolução nos pilares/.test(h) && /Foco do próximo ciclo/.test(h), "seções");
  ok(/<b>Técnico<\/b>/.test(h) && /<b>Mental<\/b>/.test(h) && !/<b>Tático<\/b>/.test(h) && !/<b>Físico<\/b>/.test(h), "pilar vazio não aparece");
  ok(/Mensagem de Richard Tsukada/.test(h) && /Orgulho de vocês\./.test(h) && /Ana, continue assim\./.test(h), "mensagem do ciclo e individual");
  ok(/Professor: Paulo · 01\/10\/2026/.test(h), "assinatura");
  ok(!/Mensagem de/.test(A.html({ ...rel, mensagemCiclo: null, mensagemIndividual: "" }, {})), "sem mensagem, sem o bloco");
  ok(/^<!doctype html>/.test(A.documento(rel, { nome: "Ana" })), "documento para PDF");
  ok(A.html(null, {}).includes("Relatório do ciclo"), "relatório vazio não quebra");
}

console.log("check-atendimento: " + n + " verificações ok");
