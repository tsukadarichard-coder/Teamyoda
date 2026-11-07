/* Importação da planilha de migração (Let's Play / Airtable → app Team Yoda) para o Financeiro.

   Funções puras: recebem a planilha já lida (linhas por aba, com as colunas da planilha-modelo Migracao-Team-Yoda.xlsx) e o estado
   atual das duas academias, e devolvem o estado novo (alunos, turmas e config do financeiro) mais um relatório do que muda.
   Nada é apagado: aluno e turma que já existem só ganham o que estiver vazio (contato, professor, horários) e a matrícula na
   turma; preço, desconto, pacote, vencimento e forma de pagamento vêm da planilha. Quem "saiu" não é criado.

   planilha = { alunos: [], turmas: [], cobranca: [], abertos: [], professores: [], despesas: [] }   (chaves das linhas: COLUNAS)
   estado   = { "team-yoda": { alunos, turmas, professores: [{ uid, nome, email }], config }, "39-ranch": { … } }
   planejar(planilha, estado, { inicio: "AAAA-MM", id: () => "…" }) → { estado, relatorio, avisos, aproximados } */

const ORGS = ["team-yoda", "39-ranch"];
const NOMES_ORG = { "team-yoda": "Team Yoda", "39-ranch": "39 Ranch" };

/* cabeçalhos da planilha-modelo → chave da linha (o começo do cabeçalho, sem acento e sem maiúscula, basta) */
const COLUNAS = {
  alunos: { nome: ["nome completo", "nome do aluno", "aluno", "nome"], nascimento: ["data de nascimento", "nascimento"], responsavel: ["responsavel"],
    telResponsavel: ["whatsapp do responsavel", "telefone do responsavel"], telAluno: ["whatsapp do aluno", "telefone do aluno"],
    email: ["e mail", "email"], unidade: ["unidade"], professor: ["professor"], turmas: ["turma"], individual: ["faz aula individual", "individual"],
    situacao: ["situacao", "status"], entrada: ["data de entrada", "entrada"], obs: ["observ"] },
  turmas: { nome: ["nome da turma", "turma", "nome"], unidade: ["unidade"], professor: ["professor"], horarios: ["dias e horarios", "horario", "dias"],
    duracao: ["duracao"], preco: ["mensalidade", "preco", "valor"], vagas: ["vagas"], obs: ["observ"] },
  cobranca: { aluno: ["nome do aluno", "aluno", "nome"], tipo: ["o que paga", "tipo"], turma: ["turma"], cheio: ["valor cheio"],
    descontoValor: ["desconto r", "desconto em r", "desconto (r"], descontoPct: ["desconto %", "desconto (%", "desconto pct", "desconto em %"],
    valor: ["valor que paga", "valor pago", "valor mensal", "valor"], venc: ["dia do vencimento", "vencimento"], forma: ["forma de pagamento", "forma"],
    pagador: ["quem paga", "pagador", "responsavel financeiro"], obs: ["observ"] },
  abertos: { aluno: ["nome do aluno", "aluno", "nome"], mes: ["mes de referencia", "mes", "referencia", "competencia"], valor: ["valor"],
    venc: ["vencimento"], situacao: ["situacao", "status"], pagoEm: ["data do pagamento", "pago em"], obs: ["observ"] },
  professores: { nome: ["nome do professor", "professor", "nome"], email: ["e mail", "email"], unidade: ["unidade"], forma: ["forma de pagamento", "forma"],
    individual: ["valor por aula individual", "aula individual"], turma: ["valor por aula de turma", "aula de turma"], fixo: ["valor fixo", "fixo"],
    pct: ["percentual", "%"], dia: ["dia do pagamento", "dia"], obs: ["observ"] },
  despesas: { nome: ["despesa", "nome"], unidade: ["unidade"], categoria: ["categoria"], valor: ["valor"], dia: ["dia"], obs: ["observ"] },
};
/* nome das abas da planilha-modelo → chave da planilha */
const ABAS = { alunos: ["alunos"], turmas: ["turmas"], cobranca: ["cobranca"], abertos: ["em aberto", "abertos", "inadimpl"], professores: ["professores"], despesas: ["despesas"] };
/* a linha 2 de cada aba da planilha-modelo é um exemplo: se ficou lá, não entra */
const EXEMPLOS = { alunos: "ana souza lima|carla souza", turmas: "juvenil a|paulo", cobranca: "ana souza lima|carla souza", abertos: "ana souza lima|combinou pagar dia 15",
  professores: "paulo|paulo@email.com", despesas: "aluguel das quadras|contrato com o clube" };

function norm(s) { return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9@%.]+/g, " ").replace(/\s+/g, " ").trim(); }
function nomeChave(s) { return norm(s).replace(/[@%.]/g, " ").replace(/\s+/g, " ").trim(); }
function txt(v, max) { return String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max || 120); }
function r2(v) { return Math.round(v * 100) / 100; }

function dinheiro(v) {
  if (typeof v === "number") return isFinite(v) && v >= 0 ? r2(v) : null;
  let s = String(v == null ? "" : v).replace(/r\$|\s/gi, "");
  if (!s) return null;
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  return isFinite(n) && n >= 0 ? r2(n) : null;
}
function percentual(v) { const n = dinheiro(String(v == null ? "" : v).replace("%", "")); return n == null ? null : Math.min(100, n); }
function ano4(a) { a = Number(a); return a < 100 ? 2000 + a : a; }
function dataISO(v) {
  const s = String(v == null ? "" : v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + "-" + m[2].padStart(2, "0") + "-" + m[3].padStart(2, "0");
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12 && Number(m[1]) >= 1 && Number(m[1]) <= 31) return ano4(m[3]) + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0");
  return "";
}
function mesISO(v) {
  const s = String(v == null ? "" : v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})/);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return m[1] + "-" + m[2].padStart(2, "0");
  m = s.match(/^(\d{1,2})[/.-](\d{4}|\d{2})$/);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) return ano4(m[2]) + "-" + m[1].padStart(2, "0");
  const d = dataISO(s);
  if (d) return d.slice(0, 7);
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  m = norm(s).match(/^([a-z]{3})[a-z]* (?:de )?(\d{4})$/);
  if (m && nomes.indexOf(m[1]) >= 0) return m[2] + "-" + String(nomes.indexOf(m[1]) + 1).padStart(2, "0");
  return "";
}
function diaVencimento(v) {
  const d = dataISO(v);
  if (d) return Number(d.slice(8, 10));
  const n = parseInt(String(v == null ? "" : v).replace(/\D+/g, " ").trim().split(" ")[0], 10);
  return n >= 1 && n <= 31 ? n : null;
}
const FORMAS = { pix: "pix", cartao: "cartao", credito: "cartao", recorrente: "cartao", boleto: "boleto", dinheiro: "dinheiro", especie: "dinheiro", transferencia: "pix", ted: "pix", "let s play": "letsplay", letsplay: "letsplay" };
function formaPagamento(v) {
  const s = norm(v).replace(/'/g, " ");
  if (!s) return "";
  if (/let.?s ?play/.test(s)) return "letsplay";
  for (const k of Object.keys(FORMAS)) if (s.indexOf(k) >= 0) return FORMAS[k];
  return "outro";
}
const DIAS = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };
/* "Seg e Qua 18:00" · "ter/qui 19h" · "Seg 18:00, Qua 19:30" → [{ dia, hora }] (dia como no app: 0 = domingo) */
function horarios(v) {
  const s = String(v == null ? "" : v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/(\d{1,2})h(\d{2})?/g, (x, h, m) => h + ":" + (m || "00"));
  const dias = [], horas = [];
  s.split(/[^a-z0-9:]+/).forEach((t) => {
    const k = t.slice(0, 3);
    if (k in DIAS && (t.length === 3 || /^(segunda|terca|quarta|quinta|sexta|sabado|domingo)$/.test(t))) dias.push(DIAS[k]);
    const h = t.match(/^(\d{1,2}):(\d{2})$/);
    if (h && Number(h[1]) < 24 && Number(h[2]) < 60) horas.push(h[1].padStart(2, "0") + ":" + h[2]);
  });
  if (!dias.length || !horas.length) return [];
  if (horas.length === dias.length) return dias.map((d, i) => ({ dia: d, hora: horas[i] }));
  return dias.map((d) => ({ dia: d, hora: horas[0] }));
}
function orgsDaUnidade(v) {
  const s = norm(v);
  if (/duas|ambas|todas/.test(s)) return ORGS.slice();
  if (/39|ranch/.test(s)) return ["39-ranch"];
  return ["team-yoda"];
}

/* lê as linhas de uma aba: { cabecalho → valor } vira { chave → valor }; linhas vazias e o exemplo saem */
function linhasDaAba(nome, linhas) {
  const mapa = COLUNAS[nome];
  if (!mapa || !Array.isArray(linhas)) return [];
  const out = [];
  linhas.slice(0, 3000).forEach((l) => {
    if (!l || typeof l !== "object") return;
    const r = {}, usadas = new Set();
    Object.keys(mapa).forEach((chave) => {
      if (Object.prototype.hasOwnProperty.call(l, chave)) { r[chave] = l[chave]; return; }
      for (const prefixo of mapa[chave]) {
        const cab = Object.keys(l).find((c) => !usadas.has(c) && norm(c).replace(/\*/g, "").trim().indexOf(prefixo) === 0);
        if (cab) { usadas.add(cab); r[chave] = l[cab]; break; }
      }
    });
    const valores = Object.values(r).map((x) => txt(x, 300)).filter(Boolean);
    if (!valores.length) return;
    const ex = EXEMPLOS[nome].split("|");
    if (valores.map(norm).includes(ex[0]) && valores.map(norm).includes(ex[1])) return;
    out.push(r);
  });
  return out;
}
/* planilha lida pelo navegador: { nomeDaAba: [linhas] } → { alunos, turmas, … } */
function lerPlanilha(abas) {
  const out = { alunos: [], turmas: [], cobranca: [], abertos: [], professores: [], despesas: [] };
  Object.keys(abas || {}).forEach((nomeAba) => {
    const n = norm(nomeAba);
    const chave = Object.keys(ABAS).find((k) => ABAS[k].some((p) => n.indexOf(p) === 0));
    if (chave) out[chave] = out[chave].concat(linhasDaAba(chave, abas[nomeAba]));
  });
  return out;
}

/* mesmo formato de novoAluno() do app (mty/index.html), para a ficha abrir normalmente */
function alunoNovo(id, nome) {
  return {
    id, nome, nascimento: "", lateralidade: "", backhand: "", alturaAtual: "", projecaoAltura: "", tipoFisico: "", baseMotora: "",
    contexto: "", estagio: "C", nivel: "Y5", perfilCorpo: "", perfilTemperamento: "", objetivosAdulto: [], disposicaoAdulto: "", comportamentoAdulto: "",
    tempoTreinando: "", dificuldadeConsistencia: null, entrada: {}, plano: null, regPlano: {}, avaliacaoTecnica: {},
    objetivoFinal: "", marcos: [{ ano: "", marco: "", precisa: "" }], camadas: { tecnico: "", fisico: "", tatico: "", mental: "" },
    prioridades: ["saque", "devolucao", "fundo", "rede"], armas: ["fundo"], inicio: "", semanas: 18, competicoes: [{ nome: "", data: "" }],
    diasQuadra: null, periodos: null, escola: "", musculacao: null, historico: [], registros: [], anotacoes: [], estiloTatico: null, adversarios: [],
    creditosReposicao: [], professorUid: "", professorNome: "", horarios: [], duracaoPadrao: "1h30", categoria: "", criteriosClassificacao: {},
    classificacaoSugeridaEm: null, cadastroConcluido: true, origem: "importacao",
  };
}

function planejar(planilha, estado, opcoes) {
  opcoes = opcoes || {};
  const inicio = opcoes.inicio || "2026-11";
  let seq = 0;
  const novoId = opcoes.id || ((p) => p + Date.now().toString(36) + (++seq).toString(36));
  const P = { alunos: [], turmas: [], cobranca: [], abertos: [], professores: [], despesas: [] };
  Object.keys(P).forEach((k) => { P[k] = linhasDaAba(k, (planilha || {})[k]); });

  const S = {}, R = {}, avisos = [], aproximados = [];
  ORGS.forEach((org) => {
    const e = (estado || {})[org] || {};
    const config = JSON.parse(JSON.stringify(e.config || {}));
    ["turmas", "descontos", "pacotes", "professores", "cobranca"].forEach((k) => { if (!config[k] || typeof config[k] !== "object") config[k] = {}; });
    if (!Array.isArray(config.despesas)) config.despesas = [];
    if (!Array.isArray(config.pendencias)) config.pendencias = [];
    if (!config.meses || typeof config.meses !== "object") config.meses = {};
    S[org] = { alunos: JSON.parse(JSON.stringify(e.alunos || [])), turmas: JSON.parse(JSON.stringify(e.turmas || [])), professores: e.professores || [], config };
    R[org] = { alunosNovos: 0, alunosAtualizados: 0, alunosSaiu: 0, turmasNovas: 0, turmasAtualizadas: 0, matriculas: 0, precosTurma: 0, descontos: 0,
      pacotes: 0, cobrancas: 0, pendencias: 0, valorPendencias: 0, recebidosMarcados: 0, professores: 0, despesas: 0, previstoMensal: 0 };
  });
  const tocados = { alunos: {}, turmas: {} };
  ORGS.forEach((o) => { tocados.alunos[o] = new Set(); tocados.turmas[o] = new Set(); });

  function acharAluno(org, nome) {
    const k = nomeChave(nome); if (!k) return null;
    const lista = S[org].alunos;
    const exato = lista.find((a) => nomeChave(a.nome) === k);
    if (exato) return exato;
    /* "Ana Souza" ↔ "Ana Souza Lima": mesmo primeiro nome e um nome contido no outro, sem ambiguidade */
    const t = k.split(" ");
    if (t.length < 2) return null;
    const cand = lista.filter((a) => {
      const u = nomeChave(a.nome).split(" ");
      if (u.length < 2 || u[0] !== t[0]) return false;
      const [menor, maior] = u.length <= t.length ? [u, t] : [t, u];
      return menor.every((x) => maior.includes(x));
    });
    if (cand.length === 1) { aproximados.push({ academia: NOMES_ORG[org], planilha: txt(nome, 80), app: cand[0].nome }); return cand[0]; }
    return null;
  }
  function acharAlunoEmQualquer(nome, preferida) {
    const ordem = preferida ? [preferida].concat(ORGS.filter((o) => o !== preferida)) : ORGS;
    for (const org of ordem) { const a = acharAluno(org, nome); if (a) return { org, a }; }
    return null;
  }
  function acharTurma(org, nome) { const k = nomeChave(nome); return k ? S[org].turmas.find((t) => nomeChave(t.nome) === k) || null : null; }
  function acharProfessor(org, nome, email) {
    const ps = S[org].professores, e = norm(email);
    if (e) { const p = ps.find((x) => norm(x.email) === e); if (p) return p; }
    const k = nomeChave(nome); if (!k) return null;
    const exato = ps.filter((x) => nomeChave(x.nome) === k);
    if (exato.length === 1) return exato[0];
    const primeiro = ps.filter((x) => nomeChave(x.nome).split(" ")[0] === k.split(" ")[0]);
    return k.split(" ").length === 1 && primeiro.length === 1 ? primeiro[0] : null;
  }
  function criarTurma(org, nome, origem) {
    const t = { id: novoId("turma-"), nome: txt(nome, 80), membros: [], duracaoPadrao: "1h30", professorUid: "", professorNome: "", professorAuxiliarUid: "", professorAuxiliarNome: "", horarios: [], origem: "importacao" };
    S[org].turmas.push(t); R[org].turmasNovas++; tocados.turmas[org].add(t.id);
    if (origem) avisos.push("Turma \"" + t.nome + "\" (" + NOMES_ORG[org] + ") não estava na aba Turmas nem no app; foi criada sem professor e sem horário. " + origem);
    return t;
  }
  function matricular(org, t, a) {
    t.membros = Array.isArray(t.membros) ? t.membros : [];
    if (!t.membros.includes(a.id)) { t.membros.push(a.id); R[org].matriculas++; tocados.turmas[org].add(t.id); }
  }
  function preencher(org, obj, campo, valor, tipo) {
    if (valor == null || valor === "" || (Array.isArray(valor) && !valor.length)) return false;
    const atual = obj[campo];
    if (atual != null && atual !== "" && !(Array.isArray(atual) && !atual.length)) return false;
    obj[campo] = valor; tocados[tipo][org].add(obj.id); return true;
  }

  /* 1. turmas */
  P.turmas.forEach((l) => {
    const nome = txt(l.nome, 80);
    if (!nome) return;
    orgsDaUnidade(l.unidade).forEach((org) => {
      let t = acharTurma(org, nome);
      const nova = !t;
      if (!t) t = criarTurma(org, nome);
      const prof = acharProfessor(org, l.professor);
      let mudou = false;
      if (prof) { mudou = preencher(org, t, "professorUid", prof.uid, "turmas") || mudou; if (!t.professorNome) t.professorNome = prof.nome; }
      else if (txt(l.professor) && !t.professorUid) { mudou = preencher(org, t, "professorNome", txt(l.professor, 60), "turmas") || mudou; }
      const hs = horarios(l.horarios);
      if (hs.length) mudou = preencher(org, t, "horarios", hs, "turmas") || mudou;
      else if (txt(l.horarios)) avisos.push("Turma \"" + nome + "\": não entendi os horários \"" + txt(l.horarios, 60) + "\"; ajuste na tela Turmas.");
      const dur = txt(l.duracao, 8).toLowerCase().replace(/\s/g, "");
      if (nova && /^\d{1,2}h(\d{2})?$/.test(dur)) t.duracaoPadrao = dur;
      if (!nova && mudou) R[org].turmasAtualizadas++;
      const preco = dinheiro(l.preco);
      if (preco) { if (!S[org].config.turmas[t.id] || S[org].config.turmas[t.id].preco !== preco) R[org].precosTurma++; S[org].config.turmas[t.id] = { preco }; }
    });
  });

  /* 2. professores: forma de pagamento */
  P.professores.forEach((l) => {
    const nome = txt(l.nome, 60);
    if (!nome) return;
    const f = norm(l.forma), forma = /fix/.test(f) ? "fixo" : /percent|%|pct/.test(f) ? "pct" : "aula";
    let achou = false;
    orgsDaUnidade(txt(l.unidade) ? l.unidade : "As duas").forEach((org) => {
      const prof = acharProfessor(org, nome, l.email);
      if (prof) achou = true;
      const chave = prof ? "u:" + prof.uid : "n:" + nome;
      S[org].config.professores[chave] = { forma, individual: dinheiro(l.individual) || 0, turma: dinheiro(l.turma) || 0, fixo: dinheiro(l.fixo) || 0, pct: percentual(l.pct) || 0 };
      R[org].professores++;
    });
    if (!achou) avisos.push("Professor \"" + nome + "\" ainda não tem conta aprovada no app. A forma de pagamento fica guardada pelo nome e passa a valer quando as aulas dele forem registradas com esse nome.");
  });

  /* 3. alunos */
  P.alunos.forEach((l) => {
    const nome = txt(l.nome, 90);
    if (!nome) return;
    const org = orgsDaUnidade(l.unidade)[0], sit = norm(l.situacao);
    let a = acharAluno(org, nome);
    if (/saiu|inativ|cancel/.test(sit)) { R[org].alunosSaiu++; if (a) avisos.push("\"" + nome + "\" aparece como \"saiu\" na planilha, mas continua no app. Se for o caso, arquive pela ficha."); return; }
    const novo = !a;
    if (!a) { a = alunoNovo(novoId("a"), nome); S[org].alunos.push(a); R[org].alunosNovos++; tocados.alunos[org].add(a.id); }
    let mudou = false;
    mudou = preencher(org, a, "nascimento", dataISO(l.nascimento), "alunos") || mudou;
    mudou = preencher(org, a, "telefoneResponsavel", txt(l.telResponsavel, 30), "alunos") || mudou;
    mudou = preencher(org, a, "telefone", txt(l.telAluno, 30), "alunos") || mudou;
    mudou = preencher(org, a, "nomeResponsavel", txt(l.responsavel, 80), "alunos") || mudou;
    mudou = preencher(org, a, "emailResponsavel", txt(l.email, 100), "alunos") || mudou;
    mudou = preencher(org, a, "dataEntrada", dataISO(l.entrada), "alunos") || mudou;
    if (/tranc/.test(sit)) mudou = preencher(org, a, "situacaoMatricula", "trancado", "alunos") || mudou;
    const prof = acharProfessor(org, l.professor);
    if (prof && !a.professorUid) { a.professorUid = prof.uid; a.professorNome = prof.nome; tocados.alunos[org].add(a.id); mudou = true; }
    String(l.turmas == null ? "" : l.turmas).split(/[;,/]|\s+e\s+/).map((x) => txt(x, 80)).filter(Boolean).forEach((nt) => {
      const t = acharTurma(org, nt) || criarTurma(org, nt, "Aparece na aba Alunos, em \"" + nome + "\".");
      matricular(org, t, a);
    });
    if (!novo && mudou) R[org].alunosAtualizados++;
  });

  /* 4. cobrança: quanto paga, desconto, vencimento e forma */
  P.cobranca.forEach((l) => {
    const nome = txt(l.aluno, 90);
    if (!nome) return;
    let achado = acharAlunoEmQualquer(nome);
    if (!achado) {
      const org = "team-yoda", a = alunoNovo(novoId("a"), nome);
      S[org].alunos.push(a); R[org].alunosNovos++; tocados.alunos[org].add(a.id); achado = { org, a };
      avisos.push("\"" + nome + "\" estava só na aba Cobrança; foi criado no Team Yoda. Confira a unidade e a turma dele.");
    }
    const { org, a } = achado, C = S[org].config;
    const tipo = norm(l.tipo), valor = dinheiro(l.valor), cheio = dinheiro(l.cheio), dp = percentual(l.descontoPct), dv = dinheiro(l.descontoValor);
    const ehPacote = /individual|pacote/.test(tipo) && !/turma/.test(tipo);
    if (/^outro/.test(tipo)) { avisos.push("\"" + nome + "\": cobrança do tipo \"outro\" não entra sozinha; lance em Recebido e pago se for o caso."); }
    else if (ehPacote) {
      const v = valor || cheio;
      if (v) { C.pacotes[a.id] = { preco: v }; R[org].pacotes++; R[org].previstoMensal += v; }
    } else {
      let t = txt(l.turma) ? acharTurma(org, l.turma) : null;
      if (!t && txt(l.turma)) { t = criarTurma(org, l.turma, "Aparece na aba Cobrança, em \"" + nome + "\"."); }
      if (!t) { const minhas = S[org].turmas.filter((x) => (x.membros || []).includes(a.id)); if (minhas.length === 1) t = minhas[0]; }
      if (!t) avisos.push("\"" + nome + "\": não sei de qual turma é a mensalidade; preencha a coluna Turma.");
      else {
        matricular(org, t, a);
        let preco = (C.turmas[t.id] || {}).preco || 0;
        if (!preco && (cheio || valor)) { preco = cheio || valor; C.turmas[t.id] = { preco }; R[org].precosTurma++; }
        const k = t.id + ":" + a.id;
        if (dp) { C.descontos[k] = { tipo: "pct", valor: dp }; R[org].descontos++; }
        else if (dv) { C.descontos[k] = { tipo: "valor", valor: Math.min(preco, dv) }; R[org].descontos++; }
        else if (valor != null && preco && valor < preco) { C.descontos[k] = { tipo: "valor", valor: r2(preco - valor) }; R[org].descontos++; }
        else if (valor != null && preco && valor > preco) avisos.push("\"" + nome + "\" paga " + valor + " e a turma \"" + t.nome + "\" custa " + preco + ". Valeu o preço da turma; ajuste em Preços se for o caso.");
        const d = C.descontos[k];
        R[org].previstoMensal += d ? r2(preco - (d.tipo === "pct" ? preco * d.valor / 100 : d.valor)) : preco;
      }
    }
    const cob = Object.assign({}, C.cobranca[a.id] || {});
    const venc = diaVencimento(l.venc), forma = formaPagamento(l.forma);
    if (venc) cob.venc = venc;
    if (forma) cob.forma = forma;
    if (txt(l.pagador)) cob.pagador = txt(l.pagador, 80);
    if (txt(l.obs)) cob.obs = txt(l.obs, 160);
    if (Object.keys(cob).length) { C.cobranca[a.id] = cob; R[org].cobrancas++; }
  });

  /* 5. em aberto: dívida de antes do controle no app vira pendência; pagamento de mês já controlado marca o recebido */
  P.abertos.forEach((l) => {
    const nome = txt(l.aluno, 90), mes = mesISO(l.mes);
    if (!nome) return;
    if (!mes) { avisos.push("\"" + nome + "\": mês de referência \"" + txt(l.mes, 20) + "\" não reconhecido (use 10/2026)."); return; }
    const achado = acharAlunoEmQualquer(nome);
    const org = achado ? achado.org : "team-yoda", C = S[org].config, pago = /^pag|quitad|recebid/.test(norm(l.situacao));
    if (mes < inicio) {
      if (pago) return;
      const valor = dinheiro(l.valor) || 0, id = "pd:" + (achado ? achado.a.id : nomeChave(nome).replace(/ /g, "_")) + ":" + mes;
      const ja = C.pendencias.find((p) => p.id === id);
      const item = { id, alunoId: achado ? achado.a.id : "", nome, mes, valor, venc: dataISO(l.venc), obs: txt(l.obs, 160), quitada: false };
      if (ja) Object.assign(ja, item, { quitada: ja.quitada }); else { C.pendencias.push(item); R[org].pendencias++; R[org].valorPendencias = r2(R[org].valorPendencias + valor); }
      if (!achado) avisos.push("Pendência de \"" + nome + "\" (" + mes + ") entrou pelo nome: o aluno não está no app.");
      return;
    }
    if (!pago || !achado) return;
    const a = achado.a, m = C.meses[mes] = C.meses[mes] || {};
    m.recebidos = m.recebidos || {};
    S[org].turmas.filter((t) => (t.membros || []).includes(a.id) && C.turmas[t.id]).forEach((t) => { const k = "m:" + t.id + ":" + a.id; if (!m.recebidos[k]) { m.recebidos[k] = true; R[org].recebidosMarcados++; } });
    if (C.pacotes[a.id] && !m.recebidos["p:" + a.id]) { m.recebidos["p:" + a.id] = true; R[org].recebidosMarcados++; }
  });

  /* 6. despesas fixas */
  P.despesas.forEach((l) => {
    const nome = txt(l.nome, 80), valor = dinheiro(l.valor);
    if (!nome || valor == null) return;
    const orgs = orgsDaUnidade(l.unidade), org = orgs[0];
    if (orgs.length > 1) avisos.push("Despesa \"" + nome + "\" é das duas unidades: ficou no Team Yoda para não contar duas vezes na visão geral.");
    const c = norm(l.categoria), categoria = /alug/.test(c) ? "aluguel" : /manut/.test(c) ? "manutencao" : /mater/.test(c) ? "materiais" : "outros";
    const ja = S[org].config.despesas.find((d) => nomeChave(d.nome) === nomeChave(nome));
    if (ja) { ja.valor = valor; ja.categoria = categoria; } else S[org].config.despesas.push({ id: novoId("d"), nome, categoria, valor });
    R[org].despesas++;
  });

  ORGS.forEach((o) => { R[o].previstoMensal = r2(R[o].previstoMensal); });
  const estadoNovo = {};
  ORGS.forEach((o) => {
    const antes = (estado || {})[o] || {};
    estadoNovo[o] = { alunos: S[o].alunos, turmas: S[o].turmas, config: S[o].config,
      mudou: { alunos: tocados.alunos[o].size > 0, turmas: tocados.turmas[o].size > 0, config: JSON.stringify(S[o].config) !== JSON.stringify(antes.config || {}) } };
  });
  const linhas = {}; Object.keys(P).forEach((k) => { linhas[k] = P[k].length; });
  return { estado: estadoNovo, relatorio: R, avisos: Array.from(new Set(avisos)).slice(0, 200), aproximados: aproximados.slice(0, 200), linhas };
}

module.exports = { planejar, lerPlanilha, linhasDaAba, norm, dinheiro, percentual, dataISO, mesISO, diaVencimento, formaPagamento, horarios, orgsDaUnidade, alunoNovo, COLUNAS, ORGS };
