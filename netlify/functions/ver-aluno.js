/* Leitura pública e limitada do progresso de UM jogador, e agora também
   um punhado de ações que ELE pode disparar (mandar feedback pro
   coordenador, descrever um jogo, dizer o que quer trabalhar; cancelar
   ou remarcar aula saiu do link: quem mexe na agenda é o treinador)
   — tudo pelo mesmo link, sem login. A segurança aqui não é a regra do
   Firestore (o Admin SDK ignora regras) — é o "linkToken" gerado por
   jogador: sem ele batendo exatamente, a function nem devolve o nome,
   nem aceita gravar nada. */
const LA = require("./_lista-alunos"); // lista de jogadores em partes (26/11/2026)
const QA = require("./_aulas-mes"); // mensalidade de N aulas: saldo do aluno (26/11/2026)
const { admin, app } = require("./_firebase-admin");
const { limpar: limparResumoJogo } = require("./_scout-publico");

class ErroPublico extends Error {
  constructor(status, mensagem) { super(mensagem); this.status = status; }
}

const CHAVE_ALUNOS = "mty:alunos:v2";
const CHAVE_TURMAS = "mty:turmas:v1";
/* Documento À PARTE do resto dos dados da academia (ver firestore.rules):
   só essa separação física faz a regra "role == coordenador" barrar o
   treinador de verdade — enquanto o feedback vivesse dentro do mesmo
   blob que o treinador já lê (CHAVE_ALUNOS), nenhuma regra por campo
   seria possível, porque o Firestore protege documentos inteiros, não
   chaves soltas dentro de um JSON serializado num campo "value". */
const CHAVE_FEEDBACKS_COORD = "mty:feedbacks-coordenador:v1";
/* Documentos à parte, gravados pelo app do treinador (ver scout/movimento-arquivo.js e resumosParaAluno no index.html):
   relatório completo de cada análise de movimento, índice das análises do jogador e os resumos dos jogos com scout. */
const PREF_MOV_REL = "mty:movrel:v1:", PREF_MOV_IDX = "mty:movidx:v1:", PREF_PARA_ALUNO = "mty:paraAluno:v1:";
const ID_DOC = /^[A-Za-z0-9_.:-]{1,120}$/;
const LIMITE_TEXTO = 2000;
const LIMITE_LISTA = 100;

exports.handler = async function (event) {
  try {
    if (event.httpMethod === "GET") return await handleGet(event);
    if (event.httpMethod === "POST") return await handlePost(event);
    return resposta(405, { erro: "Método não permitido." });
  } catch (e) {
    if (e instanceof ErroPublico) return resposta(e.status, { erro: e.message });
    return resposta(500, { erro: String(e.message || e) });
  }
};

/* ── mapa de calor de conceitos (versão simplificada pro aluno) ──
   O mapeamento família→conceito e o cálculo em si moram no app do
   treinador (index.html), que é quem GRAVA reg.temas já com `.conceito`
   resolvido — esta function só agrega o que já está pronto, por isso só
   precisa da lista fixa de conceitos (pra ordem das linhas) e do
   "pior status" (mesmo critério do app do treinador: um conceito que
   falhou numa parte da aula aparece como pendência, não fica escondido
   por ter ido bem em outra parte). */
const CONCEITOS = ["Saque e devolução", "Construção de ponto", "Rede e finalização", "Movimentação e base", "Tático e jogo", "Físico e mental"];
const ORDEM_GRAVIDADE_STATUS_CONCEITO = { nao_atingiu: 0, parcial: 1, atingiu: 2 };
function piorStatusConceito(statuses) {
  return statuses.reduce((pior, s) => (ORDEM_GRAVIDADE_STATUS_CONCEITO[s] < ORDEM_GRAVIDADE_STATUS_CONCEITO[pior] ? s : pior));
}
/* Só as últimas 6 aulas com `.temas` — a versão do aluno é sempre um
   recorte recente, nunca o histórico inteiro (isso fica só no painel do
   treinador). A "leitura da aula" (texto livre do treinador) NUNCA é
   enviada aqui: só o status por conceito e a frase de insight, calculada
   aqui mesmo, como corrigi/ignorei/mudaria também não são enviados — são
   notas do treinador, não um dado pro jogador ler bruto.

   Jogador de TURMA não precisa de um caminho separado aqui: ao fechar uma
   sessão de grupo, o app do treinador (SessaoTurma.salvarSessao) já copia
   o MESMO registro (com `.temas`/`.blocoNome` incluídos) pro `.registros`
   de CADA membro atual, exatamente no mesmo formato de uma aula avulsa
   individual — é a mesma duplicação que já alimenta `historico`/`regPlano`
   de cada jogador do grupo. Como esta function só lê `aluno.registros`
   (abaixo, em handleGet), o mapa de calor de um membro de turma já vem
   populado sem nenhuma mudança aqui; não existe hoje um "mapa da turma"
   agregado — cada membro só vê a própria cópia, que é idêntica entre os
   membros presentes naquele dia. */
function mapaConceitosDoAluno(registros) {
  const comTemas = (registros || [])
    .filter((r) => Array.isArray(r.temas) && r.temas.length > 0)
    .sort((a, b) => String(a.data || "").localeCompare(String(b.data || "")) || String(a.id || "").localeCompare(String(b.id || "")));
  const ultimas = comTemas.slice(-6);
  const colunas = ultimas.map((r, i) => {
    const celulas = {};
    CONCEITOS.forEach((c) => {
      const statusDoConceito = r.temas.filter((t) => t.conceito === c).map((t) => t.status).filter(Boolean);
      if (statusDoConceito.length) celulas[c] = piorStatusConceito(statusDoConceito);
    });
    return { indice: i + 1, celulas };
  });
  // insight: o conceito com mais células "atingiu" nestas últimas aulas
  const contagem = {};
  colunas.forEach((col) => CONCEITOS.forEach((c) => { if (col.celulas[c] === "atingiu") contagem[c] = (contagem[c] || 0) + 1; }));
  let melhor = null, melhorN = 0;
  CONCEITOS.forEach((c) => { if ((contagem[c] || 0) > melhorN) { melhor = c; melhorN = contagem[c]; } });
  const insight = melhor ? ("Nas últimas aulas, ele vem atingindo bem os objetivos de " + melhor.toLowerCase() + ".") : null;
  return { colunas, insight };
}

/* ── mesma lógica de "aula em vigor" do app do treinador, duplicada aqui
   porque esta function roda isolada (sem acesso ao script do app). ── */
function listaAulas(plano) {
  if (!plano) return [];
  const lista = [];
  let n = 0;
  (plano.blocos || []).forEach((b) => (b.semanasLista || []).forEach((sem) =>
    (sem.aulas || []).forEach((au) => {
      n++;
      lista.push({ id: "A" + String(n).padStart(2, "0"), bloco: b.titulo || b.nome || "", semana: sem.n, foco: sem.foco || "", ...au });
    })));
  return lista;
}
function statusAula(reg, id) {
  const d = (reg || {})[id] || {};
  if (d.status) return d.status;
  return d.feita ? "feita" : "";
}
function aulaEmVigor(aluno) {
  const aulas = listaAulas(aluno.plano);
  return aulas.find((a) => statusAula(aluno.regPlano, a.id) !== "feita") || null;
}

/* Próxima data/hora em que algum dos horários fixos do jogador ocorre,
   a partir de agora — é contra essa data que o prazo de 24h é medido. */
function proximaOcorrencia(horarios, agora) {
  if (!horarios || !horarios.length) return null;
  let melhor = null;
  horarios.forEach(({ dia, hora }) => {
    const partes = String(hora || "").split(":");
    const h = Number(partes[0]), m = Number(partes[1] || 0);
    if (Number.isNaN(h)) return;
    for (let add = 0; add < 8; add++) {
      const d = new Date(agora);
      d.setDate(d.getDate() + add);
      if (d.getDay() !== dia) continue;
      d.setHours(h, m, 0, 0);
      if (d.getTime() <= agora.getTime()) continue;
      if (!melhor || d.getTime() < melhor.getTime()) melhor = d;
      break;
    }
  });
  return melhor;
}

/* Grade de ocupação da academia inteira (alunos + turmas), sem nomes —
   só "tem gente treinando" por dia da semana e horário, pra o jogador
   escolher um horário livre sem ver a agenda alheia. */
function agendaOcupada(alunos, turmas) {
  const porDia = {};
  const marca = (dia, hora) => {
    if (dia === undefined || dia === null || !hora) return;
    porDia[dia] = porDia[dia] || new Set();
    porDia[dia].add(hora);
  };
  (alunos || []).forEach((a) => (a.horarios || []).forEach((h) => marca(h.dia, h.hora)));
  (turmas || []).forEach((t) => (t.horarios || []).forEach((h) => marca(h.dia, h.hora)));
  const saida = {};
  Object.keys(porDia).forEach((dia) => { saida[dia] = [...porDia[dia]].sort(); });
  return saida;
}

async function lerFeedbacksCoord(org) {
  const ref = admin.firestore().collection("orgs").doc(org).collection("dados").doc(CHAVE_FEEDBACKS_COORD);
  const snap = await ref.get();
  if (!snap.exists) return { ref, mapa: {} };
  try { return { ref, mapa: JSON.parse(snap.data().value || "{}") }; }
  catch (e) { return { ref, mapa: {} }; }
}
async function salvarFeedbacksCoord(ref, mapa) {
  await ref.set({ value: JSON.stringify(mapa), atualizado: Date.now() });
}

/* semToken: a Área do aluno (aluno-conta.js) já conferiu no servidor que a conta logada está vinculada a este jogador,
   então não usa o linkToken do link público. */
async function carregarContexto(org, id, t, semToken) {
  app();
  /* lista de jogadores em partes (26/11/2026, _lista-alunos.js); refAlunos agora é a pasta "dados" da academia */
  const refAlunos = admin.firestore().collection("orgs").doc(org).collection("dados");
  let lido;
  try { lido = await LA.lerTexto(refAlunos); } catch (e) { throw new ErroPublico(503, "A academia está salvando dados agora; tente de novo em instantes."); }
  if (lido.texto == null) throw new ErroPublico(404, "Não encontrei essa academia.");
  const alunos = LA.lerJSON(lido.texto);
  if (!alunos) throw new ErroPublico(500, "Dados da academia corrompidos.");

  const idx = alunos.findIndex((a) => a.id === id);
  if (idx < 0 || (!semToken && (!alunos[idx].linkToken || alunos[idx].linkToken !== t))) {
    throw new ErroPublico(404, "Link inválido — peça um novo ao seu treinador.");
  }
  return { refAlunos, alunos, idx };
}

async function handleGet(event) {
  const q = event.queryStringParameters || {};
  const { org, id, t } = q;
  if (!org || !id || !t) throw new ErroPublico(400, "Link incompleto.");

  return await responderGet(org, id, q, await carregarContexto(org, id, t));
}

/* O que o jogador vê (link público ou Área do aluno): plano aprovado, aulas, análises, jogos, relatórios. */
async function responderGet(org, id, q, ctx) {
  const { alunos, idx } = ctx;
  const aluno = alunos[idx];
  if (q.rel) return await relatorioMovimento(org, id, aluno, String(q.rel));
  if (q.jogo) return await resumoJogo(org, id, String(q.jogo));
  if (q.audio) return await audioCompartilhado(org, id, aluno, String(q.audio));

  let turmas = [];
  try {
    const snapT = await admin.firestore().collection("orgs").doc(org).collection("dados").doc(CHAVE_TURMAS).get();
    if (snapT.exists) turmas = JSON.parse(snapT.data().value || "[]");
  } catch (e) { turmas = []; }

  /* Numa turma o planejamento mora na TURMA (turma.plano / turma.regPlano
     / turma.horarios), não em cada jogador — o app do treinador já
     funciona assim (TelaPlano usa entidade=turma pra tudo isso). Sem
     este fallback, o link individual de um jogador de turma nunca via
     plano nenhum, porque aluno.plano simplesmente não existe pra quem
     treina em grupo — o link ficava preso em "ainda não há um plano",
     mesmo com a turma toda tendo um ciclo em andamento. Um aluno com
     plano individual próprio (fora de turma) não é afetado: só cai no
     fallback quando aluno.plano está vazio. */
  const turmasDoAluno = turmas.filter((tu) => Array.isArray(tu.membros) && tu.membros.includes(id));
  const planoIndividualAprovado = !!(aluno.plano && aluno.plano.aprovado);
  const turmaDoAluno = !planoIndividualAprovado
    ? (turmasDoAluno.find((tu) => tu.plano && tu.plano.aprovado) || (!aluno.plano ? turmasDoAluno.find((tu) => tu.plano) : null) || null)
    : null;
  const fontePlano = planoIndividualAprovado ? aluno : (turmaDoAluno || aluno);
  const horariosEfetivos = turmaDoAluno ? (turmaDoAluno.horarios || []) : (aluno.horarios || []);

  /* Nunca expõe rascunho pelo link do aluno — só o que o treinador já
     revisou e aprovou. Sem isto, qualquer edição em andamento (inclusive
     um plano recém-colado, ainda por revisar) ficaria visível assim que
     salva, antes de qualquer revisão humana — o oposto do que o link é
     pra mostrar. Uma ficha mudada depois da aprovação (aguardando_revisao
     no app do treinador) ainda aparece aqui como "aprovado": o conteúdo
     já revisado continua sendo o mais correto a mostrar até uma nova
     aprovação substituir — não há dado novo pra esconder, só uma
     bandeira de revisão pendente que só faz sentido do lado do treinador. */
  const planoAprovado = !!(fontePlano.plano && fontePlano.plano.aprovado);
  const plano = planoAprovado ? fontePlano.plano : null;
  const planoRascunho = !!(fontePlano.plano && !fontePlano.plano.aprovado);
  const reg = planoAprovado ? (fontePlano.regPlano || {}) : {};
  const aulas = listaAulas(plano).map((a) => {
    const r = reg[a.id] || {};
    return { bloco: a.bloco, semana: a.semana, foco: a.foco, titulo: a.t || "", status: r.status || (r.feita ? "feita" : ""), data: r.data || null };
  });
  const emVigor = aulaEmVigor({ plano, regPlano: reg });
  const agora = new Date();
  const proxima = proximaOcorrencia(horariosEfetivos, agora);

  let academiaNome = "";
  try {
    const info = await admin.firestore().collection("orgs").doc(org).collection("meta").doc("info").get();
    if (info.exists) academiaNome = info.data().nome || "";
  } catch (e) { academiaNome = ""; }

  /* análises de movimento, jogos com scout e o que mais o treinador registrou: tudo o que é do jogador vai no link */
  const extras = await conteudoDoAluno(org, id, aluno);
  /* próximas aulas (14 dias) e professores: Agenda + horários fixos + alto rendimento; sem os dados, o resto da página segue */
  let proximasAulas = [], professores = [], saldoAulas = null, historicoAulas = null;
  try {
    const [docOc, docAr, docQ] = await Promise.all([lerDado(org, "mty:ocorrencias:v1"), lerDado(org, "mty:arTurmas:v1"), lerDado(org, "mty:quadras:v1")]);
    const ocorrencias = docOc ? lerJSON(docOc.value, []) : [], arTurmas = docAr ? lerJSON(docAr.value, []) : [], quadras = docQ ? lerJSON(docQ.value, []) : [];
    const hojeSP = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
    proximasAulas = proximasAulasDoAluno({ aluno, turmasDoAluno, ocorrencias: Array.isArray(ocorrencias) ? ocorrencias : [], arTurmas: Array.isArray(arTurmas) ? arTurmas : [], quadras: Array.isArray(quadras) ? quadras : [], hoje: hojeSP, dias: 14 });
    professores = professoresDoAluno(aluno, turmasDoAluno, Array.isArray(arTurmas) ? arTurmas : []);
    saldoAulas = saldoAulasDoAluno({ org, aluno, turmasDoAluno, ocorrencias: Array.isArray(ocorrencias) ? ocorrencias : [], hoje: hojeSP });
    historicoAulas = historicoAulasDoAluno({ org, aluno, turmasDoAluno, ocorrencias: Array.isArray(ocorrencias) ? ocorrencias : [], hoje: hojeSP });
  } catch (e) { proximasAulas = []; professores = professoresDoAluno(aluno, turmasDoAluno, []); }
  const planosEquipe = await planosEquipeDoAluno(org, id).catch(() => []);

  let feedbacksEnviados = [];
  try {
    const { mapa } = await lerFeedbacksCoord(org);
    feedbacksEnviados = mapa[id] || [];
  } catch (e) { feedbacksEnviados = []; }

  return resposta(200, {
    nome: aluno.nome || "Jogador",
    academiaNome,
    professores,
    proximasAulas,
    saldoAulas,
    historicoAulas,
    nivel: aluno.nivel || null,
    /* false só quando o nível veio de um atalho que pula o checklist de
       critérios observados em quadra (sugestão por IA aplicada direto —
       ver SugestaoClassificacao.aplicar em index.html); ausente/true
       nos demais casos. Sem isto, o link do aluno mostraria a escada
       Y1–Y6 inteira como "alcançada" por posição na lista, mesmo quando
       ninguém nunca confirmou nenhum critério — é exatamente o cenário
       que não pode virar certeza visual pro jogador. */
    nivelAvaliado: aluno.nivelAvaliado !== false,
    temPlano: !!plano,
    planoRascunho,
    /* jogador de turma: o plano mostrado é o da turma (ele não tem plano individual) */
    planoDaTurma: turmaDoAluno ? { nome: turmaDoAluno.nome || "Turma" } : null,
    tipoPlano: plano ? plano.tipo || "" : null,
    prioridade: plano ? plano.prioridade || "" : null,
    totalAulas: aulas.length,
    aulasFeitas: aulas.filter((a) => a.status === "feita").length,
    aulas,
    horarios: horariosEfetivos,
    aulaEmVigor: emVigor ? { titulo: emVigor.t || "", bloco: emVigor.bloco, semana: emVigor.semana } : null,
    proximaAula: proxima ? proxima.toISOString() : null,
    agendaOcupada: agendaOcupada(alunos, turmas),
    pedidosReposicao: aluno.pedidosReposicao || [],
    feedbacksEnviados,
    jogosRelatados: aluno.jogosRelatados || [],
    pedidosConteudo: aluno.pedidosConteudo || [],
    /* fechamentos de ciclo: só os números (aulas e critérios). O texto é do treinador (corrigi, deixei passar, leitura da
       aula) e não sai mais para o cliente — ele recebe o Relatório do ciclo publicado (relatoriosCiclo, abaixo). */
    historicoRelatorios: (Array.isArray(aluno.historicoRelatorios) ? aluno.historicoRelatorios : []).filter(Boolean)
      .map((h) => ({ id: h.id, data: h.data, tipo: h.tipo, feitas: h.feitas, total: h.total, criterios: Array.isArray(h.criterios) ? h.criterios : [] })),
    mapaConceitos: mapaConceitosDoAluno(aluno.registros),
    /* planejamento de cada turma em que o jogador treina (além do individual, quando ele tiver os dois) */
    turmas: turmasDoAluno.filter((tu) => tu !== turmaDoAluno).map(resumoPlanoTurma),
    movimentos: extras.movimentos,
    jogos: extras.jogos,
    jogosVideo: extras.jogosVideo,
    observacoes: observacoesCompartilhadas(aluno),
    relatoriosAtleta: relatoriosPublicados(aluno),
    relatoriosCiclo: relatoriosCicloPublicados(aluno),
    planosEquipe,
  });
}

/* Observações de partida e conversas que o treinador marcou "compartilhar com o aluno": o descritivo, o que foi anotado e se há
   áudio (o arquivo só abre por ?audio=<registro>:<observação>, com link temporário). */
const CAT_OBS = { saque: "Saque", devolucao: "Devolução", fundo: "Fundo de quadra", transicao: "Rede e transição", tatico: "Tático", mental: "Mental", fisico: "Físico", geral: "Geral" };
/* Relatórios do atleta publicados pelo treinador (Team Yoda): os dados do período já organizados no app do treinador e a observação dele.
   Rascunhos nunca saem daqui. */
/* Planejamento das equipes de competição do jogador (Team Yoda, mty:equipes:v1), montado pelo coordenador: só os campos conhecidos. */
const GRUPOS_EQ = ["tecnico", "tatico", "misto"];
const ITENS_EQ = ["movimentacao", "mudanca_direcao", "precisao", "saque", "forehand", "backhand", "approach", "voleio", "smash", "devolucao", "drop_shot", "ataque", "defesa", "construcao"];
const DATA_EQ = /^\d{4}-\d{2}-\d{2}$/;
function limparPlanoEquipe(p) {
  if (!p || !p.ciclo || !Array.isArray(p.semanas)) return null;
  const g = (x) => (GRUPOS_EQ.includes(x) ? x : ""), it = (l) => ITENS_EQ.filter((v) => Array.isArray(l) && l.includes(v)), t = (x, n) => String(x == null ? "" : x).slice(0, n), d = (x) => (DATA_EQ.test(String(x || "")) ? x : "");
  const c = p.ciclo;
  return {
    id: t(p.id, 60), atualizadoEm: t(p.atualizadoEm, 30), autorNome: t(p.autorNome, 80),
    ciclo: { semanas: Math.max(1, Math.min(24, +c.semanas || 1)), inicio: d(c.inicio), fim: d(c.fim), dias: (Array.isArray(c.dias) ? c.dias : []).map(Number).filter((x) => x >= 0 && x <= 6), duracaoMin: +c.duracaoMin || null, grupo: g(c.grupo), objetivo: t(c.objetivo, 1500) },
    meses: Object.fromEntries(Object.entries(p.meses || {}).filter(([m]) => /^\d{4}-\d{2}$/.test(m)).slice(0, 8).map(([m, x]) => [m, { grupo: g(x && x.grupo), obs: t(x && x.obs, 2000) }])),
    semanas: p.semanas.slice(0, 24).map((s) => ({ n: +s.n || 0, inicio: d(s.inicio), fim: d(s.fim), grupo: g(s.grupo), itens: it(s.itens), obs: t(s.obs, 2000),
      dias: (Array.isArray(s.dias) ? s.dias : []).slice(0, 7).filter((x) => DATA_EQ.test(String(x.data || ""))).map((x) => ({ data: x.data, grupo: g(x.grupo), itens: it(x.itens), obs: t(x.obs, 1500) })) })),
  };
}
async function planosEquipeDoAluno(org, id) {
  const doc = await lerDado(org, "mty:equipes:v1");
  const equipes = doc ? lerJSON(doc.value, []) : [];
  return (Array.isArray(equipes) ? equipes : []).filter((e) => e && Array.isArray(e.membros) && e.membros.includes(id) && e.plano && e.plano.status !== "rascunho") /* rascunho: o coordenador ainda não fechou */
    .map((e) => ({ equipe: String(e.nome || "Equipe").slice(0, 60), coordenador: String(e.coordenadorNome || "").slice(0, 80), plano: limparPlanoEquipe(e.plano) })).filter((x) => x.plano).slice(0, 4);
}
/* Relatórios do ciclo para o cliente (Padrão de Atendimento, mty/atendimento.js): só os publicados e só os campos do relatório
   pronto — o texto revisado pelo professor, os marcos, o período e as mensagens do Richard. Rascunho nunca sai daqui. */
const PILARES_RC = ["tecnico", "tatico", "fisico", "mental"];
function relatoriosCicloPublicados(aluno) {
  const t = (x, n) => String(x == null ? "" : x).slice(0, n);
  const d = (x) => (/^\d{4}-\d{2}-\d{2}$/.test(String(x || "")) ? String(x) : "");
  return (Array.isArray(aluno.relatoriosCiclo) ? aluno.relatoriosCiclo : []).filter((r) => r && r.status === "publicado" && r.texto && typeof r.texto === "object")
    .map((r) => {
      const x = r.texto, p = (r.periodo && typeof r.periodo === "object") ? r.periodo : {};
      return {
        id: t(r.id, 80), publicadoEm: t(r.publicadoEm, 30), publicadoPor: t(r.publicadoPor, 80), publico: r.publico === "pais" ? "pais" : "adulto",
        periodo: { de: d(p.de), ate: d(p.ate) }, aulas: Math.max(0, Math.min(999, +r.aulas || 0)),
        texto: {
          abertura: t(x.abertura, 1200), proximoCiclo: t(x.proximoCiclo, 1200), fechamento: t(x.fechamento, 600),
          pilares: Object.fromEntries(PILARES_RC.map((k) => [k, t(x.pilares && x.pilares[k], 1200)])),
          conquistas: (Array.isArray(x.conquistas) ? x.conquistas : []).slice(0, 8).map((c) => t(c, 300)).filter(Boolean),
        },
        marcos: (Array.isArray(r.marcos) ? r.marcos : []).slice(0, 20).map((m) => ({ data: d(m && m.data), texto: t(m && m.texto, 300) })).filter((m) => m.texto),
        mensagemCiclo: r.mensagemCiclo && r.mensagemCiclo.texto ? { texto: t(r.mensagemCiclo.texto, 3000), autor: t(r.mensagemCiclo.autor, 80) } : null,
        mensagemIndividual: t(r.mensagemIndividual, 3000),
      };
    })
    .sort((a, b) => b.publicadoEm.localeCompare(a.publicadoEm)).slice(0, 24);
}
function relatoriosPublicados(aluno) {
  return (Array.isArray(aluno.relatoriosAtleta) ? aluno.relatoriosAtleta : []).filter((r) => r && r.status === "publicado" && r.dados && typeof r.dados === "object")
    .filter((r) => JSON.stringify(r.dados).length <= 120000)
    .map((r) => ({ id: String(r.id || "").slice(0, 80), publicadoEm: String(r.publicadoEm || "").slice(0, 30), treinador: String(r.publicadoPor || "").slice(0, 80), observacao: String(r.observacao || "").slice(0, 8000), dados: r.dados }))
    .sort((a, b) => b.publicadoEm.localeCompare(a.publicadoEm)).slice(0, 40);
}
function observacoesCompartilhadas(aluno) {
  return (aluno.registros || []).filter((r) => r && r.tipo === "observacao" && r.compartilhado).map((r) => ({
    id: String(r.id).slice(0, 80), data: String(r.data || "").slice(0, 10), contexto: r.contexto === "conversa" ? "conversa" : "partida",
    titulo: String(r.titulo || "").slice(0, 80), torneio: String(r.torneio || "").slice(0, 60), adversario: String(r.adversario || "").slice(0, 60), placar: String(r.placar || "").slice(0, 30),
    descritivo: String(r.descritivo || "").slice(0, 6000),
    itens: (r.obs || []).slice(0, 200).map((o) => ({ id: String(o.id || "").slice(0, 40), em: String(o.em || "").slice(0, 30), cat: CAT_OBS[o.cat] ? o.cat : "geral",
      tipo: o.tipo === "bom" || o.tipo === "ajustar" ? o.tipo : null, natureza: ["observacao", "positivo", "atencao", "insight"].includes(o.natureza) ? o.natureza : null,
      texto: o.natureza === "pergunta" ? "" : String(o.texto || "").slice(0, 8000), audio: !!(o.audio && o.audio.caminho), duracaoSeg: (o.audio && +o.audio.duracaoSeg) || 0 })),
    /* resumo revisado ao concluir o jogo (Observar jogos), sem as perguntas internas do treinador */
    resumo: r.resumo ? { positivos: String(r.resumo.positivos || "").slice(0, 4000), atencao: String(r.resumo.atencao || "").slice(0, 4000), insights: String(r.resumo.insights || "").slice(0, 4000), prioridades: String(r.resumo.prioridades || "").slice(0, 4000) } : null,
  })).sort((a, b) => b.data.localeCompare(a.data)).slice(0, 60);
}
async function audioCompartilhado(org, id, aluno, ref) {
  const [regId, obsId] = ref.split(":");
  const r = (aluno.registros || []).find((x) => x && x.tipo === "observacao" && x.compartilhado && x.id === regId);
  const o = r && (r.obs || []).find((x) => x && x.id === obsId);
  const caminho = o && o.audio && String(o.audio.caminho || "");
  if (!caminho || !/^audios\/[A-Za-z0-9_-]{1,80}\/[A-Za-z0-9_-]{1,80}\/[0-9]{10,16}-[a-z0-9]{6}\.(webm|m4a|aac|mp3|ogg)$/.test(caminho) || caminho.split("/")[1] !== org || caminho.split("/")[2] !== id) {
    throw new ErroPublico(404, "Áudio não encontrado.");
  }
  let A;
  try { A = require("./_olhar-armazenamento"); } catch (e) { throw new ErroPublico(404, "Áudio indisponível."); }
  const [url] = await (await A.bucket()).file(caminho).getSignedUrl({ version: "v4", action: "read", expires: Date.now() + 10 * 60 * 1000, responseDisposition: "inline" });
  return resposta(200, { url });
}

/* Plano de uma turma para o link do jogador: só o que está aprovado (rascunho nunca aparece), aula a aula. */
function resumoPlanoTurma(tu) {
  const aprovado = !!(tu.plano && tu.plano.aprovado);
  const plano = aprovado ? tu.plano : null, reg = aprovado ? (tu.regPlano || {}) : {};
  const aulas = listaAulas(plano).map((a) => {
    const r = reg[a.id] || {};
    return { bloco: a.bloco, semana: a.semana, foco: a.foco, titulo: a.t || "", status: r.status || (r.feita ? "feita" : ""), data: r.data || null };
  });
  const emVigor = aulaEmVigor({ plano, regPlano: reg });
  return {
    nome: tu.nome || "Turma", horarios: tu.horarios || [], temPlano: aprovado, planoRascunho: !!(tu.plano && !aprovado),
    tipoPlano: plano ? plano.tipo || "" : null, prioridade: plano ? plano.prioridade || "" : null,
    totalAulas: aulas.length, aulasFeitas: aulas.filter((a) => a.status === "feita").length, aulas,
    aulaEmVigor: emVigor ? { titulo: emVigor.t || "", bloco: emVigor.bloco, semana: emVigor.semana } : null,
  };
}

function lerJSON(v, padrao) { try { const x = JSON.parse(v); return x == null ? padrao : x; } catch (e) { return padrao; } }

/* ── Próximas aulas e professor do aluno (pedido do Richard em 19/11/2026: "para o aluno, qdo ele entrar no sistema... o sistema
   automaticamente localize o professor respectivo e as aulas, quaisquer que sejam") ──
   Junta, nos próximos `dias` (horário de São Paulo): as aulas já marcadas na Agenda (mty:ocorrencias:v1: individual dele, das
   turmas dele, reposição, experimental; com cancelamento, substituto e quadra), os horários fixos dele e das turmas que a Agenda
   ainda não gerou, e as turmas de alto rendimento (mty:arTurmas:v1). Locação e bloqueio nunca entram. Função pura (testável). */
const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
function minutosDe(d) { if (typeof d === "number") return d; return { "30min": 30, "45min": 45, "1h": 60, "1h30": 90, "2h": 120 }[d] || 60; }
function somaHora(h, min) { const [a, b] = String(h || "00:00").split(":").map(Number), t = a * 60 + b + (min || 0); return String(Math.floor(t / 60) % 24).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0"); }
/* Mensalidade de N aulas (26/11/2026, pedido do Richard: "que isso apareça para o aluno, para ele saber quantas aulas ele fez,
   quantas aulas ele tem para repor, quantas aulas nós temos de crédito"): só para quem tem aluno.aulasPagasMes. Conta só as aulas
   deste aluno (QLAulasMes.saldoDeAulas, desde o marco zero da academia). Nada de nome de outro aluno sai daqui. */
function saldoAulasDoAluno({ org, aluno, turmasDoAluno, ocorrencias, hoje }) {
  if (!QA.aulasPagas(aluno)) return null;
  QA.definirMarco(QA.marcoVigente(org, hoje));
  const s = QA.saldoDeAulas({ ocorrencias, alunos: [aluno], turmas: turmasDoAluno || [], hoje, alunoId: aluno.id });
  if (!s) return null;
  return { pagasMes: s.pagasMes, desde: s.desde, feitas: s.feitas, feitasNoMes: s.feitasNoMes, aFazerNoMes: s.aFazerNoMes, credito: s.credito, aRepor: s.aRepor,
    meses: s.meses.map((m) => ({ mes: m.mes, rotulo: m.rotulo, feitas: m.feitas, reposicoes: m.reposicoes, faltas: m.faltas, canceladas: m.canceladas, saldo: m.saldo })) };
}

/* Painel do aluno (26/11/2026, pedido do Richard: "preciso de um Dashboard mais funcional"): aulas deste aluno no mês (feitas,
   faltas, canceladas) e as últimas aulas com a presença dele, para o resumo do Início e a aba Aulas. Mesma conta do Relatório de
   aulas (QLAulasMes.aulasDoPeriodo, desde o marco zero). Só as aulas dele: individual, turma, reposição (experimental não). */
function historicoAulasDoAluno({ org, aluno, turmasDoAluno, ocorrencias, hoje, dias }) {
  QA.definirMarco(QA.marcoVigente(org, hoje));
  const ini = QA.somaDias(hoje, -(dias || 60)), mes = hoje.slice(0, 7);
  const ROT = { presente: "Presente", falta: "Faltou", cancelada: "Cancelada", pendente: "Sem registro" };
  const aulas = QA.aulasDoPeriodo({ ocorrencias, alunos: [aluno], turmas: turmasDoAluno || [], inicio: ini < mes + "-01" ? ini : mes + "-01", fim: hoje, hoje })
    .filter((a) => a.status !== "ignorada" && a.tipo !== "experimental" && a.membros.includes(aluno.id) && a.data <= hoje);
  const doMes = { feitas: 0, faltas: 0, canceladas: 0, semRegistro: 0 };
  const lista = [];
  aulas.forEach((a) => {
    const p = QA.presencaNaAula(a, aluno.id);
    if (p === "agendada" || p === "ignorada") return;
    if (a.data.slice(0, 7) === mes) { if (p === "presente") doMes.feitas++; else if (p === "falta") doMes.faltas++; else if (p === "cancelada") doMes.canceladas++; else if (p === "pendente") doMes.semRegistro++; }
    if (a.data >= ini) lista.push({ data: a.data, horaInicio: a.horaInicio || "", presenca: p, rotulo: ROT[p] || "",
      titulo: a.tipo === "reposicao" ? "Reposição" : a.origemTipo === "turma" ? String(a.nome || "Turma").slice(0, 80) : "Aula individual", motivo: p === "cancelada" ? String(a.motivo || "").slice(0, 80) : "" });
  });
  lista.sort((x, y) => (y.data + y.horaInicio).localeCompare(x.data + x.horaInicio));
  return { mes, doMes, ultimas: lista.slice(0, 10) };
}

function proximasAulasDoAluno({ aluno, turmasDoAluno, ocorrencias, arTurmas, quadras, hoje, dias }) {
  const id = aluno.id, n = dias || 14, fim = new Date(hoje + "T12:00:00Z"); fim.setUTCDate(fim.getUTCDate() + n - 1);
  const fimISO = fim.toISOString().slice(0, 10);
  const nomeQuadra = (qid) => ((quadras || []).find((q) => q && q.id === qid) || {}).nome || "";
  const idsTurmas = new Set((turmasDoAluno || []).map((t) => t.id));
  const nomeTurma = (tid) => ((turmasDoAluno || []).find((t) => t.id === tid) || {}).nome || "Turma";
  const out = [], ocupado = new Set();
  const chave = (origem, data, hora) => origem + "|" + data + "|" + hora;
  (ocorrencias || []).forEach((o) => {
    if (!o || !o.data || o.data < hoje || o.data > fimISO || o.tipo === "locacao" || o.tipo === "bloqueio" || o.status === "ignorada") return;
    const minha = (o.origemTipo === "individual" && o.origemId === id) || (o.origemTipo === "turma" && idsTurmas.has(o.origemId)) || (o.alunoId === id);
    if (!minha) return;
    const org0 = o.origemTipo === "turma" ? "t:" + o.origemId : "a";
    ocupado.add(chave(org0, o.data, o.horaInicio));
    /* aula fixa remarcada para outra hora: o horário original do dia não volta como projeção */
    const rc = String(o.recorrenciaChave || "").split(":"); if (rc.length >= 4) ocupado.add(chave(org0, o.data, rc.slice(3).join(":")));
    const prof = o.substitutoNome || o.professorNome || "";
    out.push({ data: o.data, horaInicio: o.horaInicio || "", horaFim: o.horaFim || "",
      tipo: o.tipo === "reposicao" ? "reposicao" : o.tipo === "experimental" ? "experimental" : o.origemTipo === "turma" ? "turma" : "individual",
      titulo: o.origemTipo === "turma" ? nomeTurma(o.origemId) : o.tipo === "reposicao" ? "Reposição" : o.tipo === "experimental" ? "Aula experimental" : "Aula individual",
      professor: prof, substituindo: o.substitutoNome && o.professorNome && o.substitutoNome !== o.professorNome ? o.professorNome : "",
      quadra: nomeQuadra(o.quadraId), status: o.status === "cancelada" ? "cancelada" : o.status === "realizada" ? "realizada" : o.status === "falta" ? "falta" : "agendada",
      motivo: o.status === "cancelada" ? String(o.motivoCancelamento || "").slice(0, 80) : "" });
  });
  /* horários fixos ainda não gerados na Agenda (aluno, turmas, alto rendimento) */
  const fixos = [];
  (aluno.horarios || []).forEach((h) => fixos.push({ origem: "a", h, titulo: "Aula individual", tipo: "individual", prof: aluno.professorNome || "", dur: minutosDe(aluno.duracaoPadrao) }));
  (turmasDoAluno || []).forEach((t) => (t.horarios || []).forEach((h) => fixos.push({ origem: "t:" + t.id, h, titulo: t.nome || "Turma", tipo: "turma", prof: t.professorNome || "", dur: minutosDe(t.duracaoPadrao) })));
  (arTurmas || []).filter((t) => t && Array.isArray(t.membros) && t.membros.includes(id)).forEach((t) => (t.horarios || []).forEach((h) => fixos.push({ origem: "ar:" + t.id, h, titulo: (t.nome || "Turma") + " · alto rendimento", tipo: "alto", prof: t.professorNome || "", dur: Number(t.duracaoMin) || 120 })));
  for (let d = new Date(hoje + "T12:00:00Z"), k = 0; k < n; k++, d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10), dia = d.getUTCDay();
    fixos.forEach((f) => {
      if (Number(f.h.dia) !== dia || !f.h.hora || ocupado.has(chave(f.origem, iso, f.h.hora))) return;
      ocupado.add(chave(f.origem, iso, f.h.hora));
      out.push({ data: iso, horaInicio: f.h.hora, horaFim: somaHora(f.h.hora, f.dur), tipo: f.tipo, titulo: f.titulo, professor: f.prof, substituindo: "", quadra: nomeQuadra(f.h.quadraId), status: "agendada", motivo: "" });
    });
  }
  return out.sort((x, y) => (x.data + x.horaInicio).localeCompare(y.data + y.horaInicio)).slice(0, 40)
    .map((a) => ({ ...a, diaSemana: DIAS_SEMANA[new Date(a.data + "T12:00:00Z").getUTCDay()] }));
}
/* professores do aluno: o dele e o de cada turma (nomes, sem repetir) */
function professoresDoAluno(aluno, turmasDoAluno, arTurmas) {
  const lista = [];
  const add = (nome, onde) => { nome = String(nome || "").trim(); if (!nome) return; const j = lista.find((x) => x.nome === nome); if (j) { if (!j.onde.includes(onde)) j.onde.push(onde); } else lista.push({ nome, onde: [onde] }); };
  add(aluno.professorNome, "aulas individuais");
  (turmasDoAluno || []).forEach((t) => { add(t.professorNome, t.nome || "turma"); add(t.professorAuxiliarNome, t.nome || "turma"); });
  (arTurmas || []).filter((t) => t && Array.isArray(t.membros) && t.membros.includes(aluno.id)).forEach((t) => add(t.professorNome, (t.nome || "turma") + " (alto rendimento)"));
  return lista.slice(0, 6);
}
async function lerDado(org, chave) {
  const snap = await admin.firestore().collection("orgs").doc(org).collection("dados").doc(chave).get();
  return snap.exists ? snap.data() : null;
}

/* Histórico de análises de movimento do jogador: o que está na ficha + o índice do arquivo (que não se perde com a ficha), menos as removidas. */
async function movimentosDoAluno(org, id, aluno) {
  let ind = { itens: [], removidos: [] };
  try { const d = await lerDado(org, PREF_MOV_IDX + id); if (d) ind = Object.assign(ind, lerJSON(d.value, {})); } catch (e) { /* sem índice */ }
  const fora = new Set(Array.isArray(ind.removidos) ? ind.removidos : []), mapa = new Map();
  (aluno.movimentos || []).concat(Array.isArray(ind.itens) ? ind.itens : []).forEach((h) => { if (h && h.id && !fora.has(h.id)) mapa.set(h.id, h); });
  return [...mapa.values()].sort((a, b) => String(b.criadoEm || "").localeCompare(String(a.criadoEm || ""))).slice(0, 200).map((h) => ({
    id: String(h.id).slice(0, 120), criadoEm: String(h.criadoEm || "").slice(0, 30), golpe: ["forehand", "backhand", "saque"].includes(h.golpe) ? h.golpe : "forehand",
    emp: String(h.emp || "").slice(0, 2), dom: h.dom === "E" ? "E" : "D",
    itens: (Array.isArray(h.itens) ? h.itens : []).slice(0, 60).map((i) => ({ n: String(i.n || "").slice(0, 120), s: ["ok", "atencao", "nao_avaliavel"].includes(i.s) ? i.s : "nao_avaliavel", v: Number.isFinite(+i.v) && i.v !== null ? +i.v : null, u: String(i.u || "").slice(0, 20), r: String(i.r || "").slice(0, 80) })),
    res: { ok: +((h.res || {}).ok) || 0, atencao: +((h.res || {}).atencao) || 0, nao: +((h.res || {}).nao) || 0 },
    texto: String(h.texto || "").slice(0, 2000), prio: (Array.isArray(h.prio) ? h.prio : []).slice(0, 8).map((x) => String(x).slice(0, 120)),
  }));
}

async function conteudoDoAluno(org, id, aluno) {
  const movimentos = await movimentosDoAluno(org, id, aluno).catch(() => []);
  let jogos = [];
  try {
    const d = await lerDado(org, PREF_PARA_ALUNO + id);
    const lista = d ? (lerJSON(d.value, {}).jogos || []) : [];
    jogos = lista.filter((j) => j && j.id).map((j) => ({
      id: String(j.id).slice(0, 120), data: String(j.data || "").slice(0, 10), torneio: String(j.torneio || "").slice(0, 80), resultado: String(j.resultado || "").slice(0, 40),
      concluida: !!j.concluida, n: +j.n || 0, pctGanhos: +j.pctGanhos || 0, video: !!j.video,
    })).sort((a, b) => b.data.localeCompare(a.data));
  } catch (e) { jogos = []; }
  const jogosVideo = (aluno.jogosVideo || []).filter((h) => h && h.res).map((h) => ({
    id: String(h.id || "").slice(0, 120), criadoEm: String(h.criadoEm || "").slice(0, 30),
    total: +h.res.total || 0, pctGanhos: typeof h.res.pctGanhos === "number" ? h.res.pctGanhos : null, batidasMedia: typeof h.res.batidasMedia === "number" ? h.res.batidasMedia : null,
  })).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).slice(0, 100);
  return { movimentos, jogos, jogosVideo };
}

/* Relatório completo de UMA análise de movimento do jogador (com as fotos das fases): só se a análise for dele. */
async function relatorioMovimento(org, id, aluno, rel) {
  if (!ID_DOC.test(rel)) throw new ErroPublico(400, "Relatório inválido.");
  const meus = await movimentosDoAluno(org, id, aluno);
  if (!meus.some((h) => h.id === rel)) throw new ErroPublico(404, "Relatório não encontrado.");
  const d = await lerDado(org, PREF_MOV_REL + rel);
  const arq = d ? lerJSON(d.value, null) : null;
  if (!arq || (arq.alunoId && arq.alunoId !== id)) return resposta(200, { arquivo: null });
  delete arq.cabecalho;
  return resposta(200, { arquivo: arq });
}

/* Resumo completo de UM jogo com scout do jogador (o mesmo formato da página do scout da família). */
async function resumoJogo(org, id, jogo) {
  if (!ID_DOC.test(jogo)) throw new ErroPublico(400, "Jogo inválido.");
  const d = await lerDado(org, PREF_PARA_ALUNO + id);
  const j = d ? (lerJSON(d.value, {}).jogos || []).find((x) => x && x.id === jogo) : null;
  if (!j) throw new ErroPublico(404, "Jogo não encontrado.");
  return resposta(200, { ate: "", publico: limparResumoJogo(j) });
}

async function handlePost(event) {
  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch (e) { throw new ErroPublico(400, "Corpo da requisição inválido."); }

  const { org, id, t, acao } = body;
  if (!org || !id || !t) throw new ErroPublico(400, "Link incompleto.");
  if (!acao) throw new ErroPublico(400, "Ação não informada.");

  return await executarAcao(org, id, body, await carregarContexto(org, id, t));
}

/* O que o jogador pode fazer (link público ou Área do aluno): dúvida/pedido de conteúdo, relatar jogo, feedback ao coordenador. */
async function executarAcao(org, id, body, ctx) {
  const acao = body.acao;
  const { refAlunos, alunos, idx } = ctx;
  const aluno = alunos[idx];

  /* cancelar ou remarcar aula não é mais pelo link do aluno: quem mexe na agenda é o treinador */
  if (acao === "cancelar" || acao === "reagendar") throw new ErroPublico(400, "Para faltar ou trocar de horário, fale direto com o seu treinador.");
  if (acao === "feedback") return await acaoFeedbackCoord(org, id, body);
  if (acao === "jogo") return await acaoTexto(refAlunos, alunos, idx, aluno, body, "jogosRelatados");
  if (acao === "duvida") return await acaoDuvida(refAlunos, alunos, idx, aluno, body);
  throw new ErroPublico(400, "Ação desconhecida.");
}

/* grava só a mudança deste jogador, numa transação sobre a lista atual (não sobrescreve o que os professores mudaram nos outros) */
async function salvar(refAlunos, id, mudar) {
  await LA.mudarAlunos(admin.firestore(), refAlunos, (lista) => {
    const i = lista.findIndex((a) => a && a.id === id);
    if (i < 0) return null;
    const l = lista.slice(); l[i] = mudar(l[i]); return l;
  });
}

/* O que o aluno gostaria de trabalhar / suas dúvidas — diferente do
   feedback (que é secreto, só pro coordenador), isto é dirigido ao
   treinador e carrega um status: só vira insumo de verdade pro
   planejamento se o treinador aprovar (ver CardPedidosConteudo no app). */
async function acaoDuvida(refAlunos, alunos, idx, aluno, body) {
  const texto = String(body.texto || "").trim();
  if (!texto) throw new ErroPublico(400, "Escreva o que você gostaria de trabalhar antes de enviar.");
  const item = {
    id: "duvida-" + Date.now().toString(36),
    criadoEm: new Date().toISOString(),
    texto: texto.slice(0, LIMITE_TEXTO),
    status: "pendente",
  };
  await salvar(refAlunos, aluno.id, (a) => ({ ...a, pedidosConteudo: [item, ...(a.pedidosConteudo || [])].slice(0, LIMITE_LISTA) }));
  return resposta(200, { ok: true, mensagem: "Enviado — seu treinador vai avaliar e pode incluir isso no seu planejamento." });
}

/* Grava no documento separado (CHAVE_FEEDBACKS_COORD), nunca no blob
   mty:alunos:v2 que o treinador lê inteiro — ver o comentário em
   firestore.rules sobre por que isto precisa ser um documento à parte
   pra promessa "seu treinador não vê este campo" valer de verdade. */
async function acaoFeedbackCoord(org, id, body) {
  const texto = String(body.texto || "").trim();
  if (!texto) throw new ErroPublico(400, "Escreva algo antes de enviar.");
  const { ref, mapa } = await lerFeedbacksCoord(org);
  const item = { id: "feedbacksAluno-" + Date.now().toString(36), data: new Date().toISOString(), texto: texto.slice(0, LIMITE_TEXTO) };
  mapa[id] = [item, ...(mapa[id] || [])].slice(0, LIMITE_LISTA);
  await salvarFeedbacksCoord(ref, mapa);
  return resposta(200, { ok: true, mensagem: "Enviado ao coordenador." });
}

async function acaoTexto(refAlunos, alunos, idx, aluno, body, campo) {
  const texto = String(body.texto || "").trim();
  if (!texto) throw new ErroPublico(400, "Escreva algo antes de enviar.");
  const item = { id: campo + "-" + Date.now().toString(36), data: new Date().toISOString(), texto: texto.slice(0, LIMITE_TEXTO) };
  await salvar(refAlunos, aluno.id, (a) => ({ ...a, [campo]: [item, ...(a[campo] || [])].slice(0, LIMITE_LISTA) }));
  return resposta(200, { ok: true, mensagem: "Enviado." });
}

function resposta(statusCode, corpo) {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) };
}

/* usado pela Área do aluno (aluno-conta.js): mesmos dados e as mesmas ações do link, com a conta logada no lugar do token */
module.exports.interno = { carregarContexto, responderGet, executarAcao, ErroPublico, CHAVE_ALUNOS, proximasAulasDoAluno, professoresDoAluno, saldoAulasDoAluno, historicoAulasDoAluno };
