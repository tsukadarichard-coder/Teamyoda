/* Leitura pública e limitada do progresso de UM jogador, e agora também
   um punhado de ações que ELE pode disparar (cancelar a aula em vigor,
   pedir reposição, mandar feedback pro coordenador, descrever um jogo)
   — tudo pelo mesmo link, sem login. A segurança aqui não é a regra do
   Firestore (o Admin SDK ignora regras) — é o "linkToken" gerado por
   jogador: sem ele batendo exatamente, a function nem devolve o nome,
   nem aceita gravar nada. */
const { admin, app } = require("./_firebase-admin");

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

async function carregarContexto(org, id, t) {
  app();
  const refAlunos = admin.firestore().collection("orgs").doc(org).collection("dados").doc(CHAVE_ALUNOS);
  const snap = await refAlunos.get();
  if (!snap.exists) throw new ErroPublico(404, "Não encontrei essa academia.");

  let alunos;
  try { alunos = JSON.parse(snap.data().value || "[]"); }
  catch (e) { throw new ErroPublico(500, "Dados da academia corrompidos."); }

  const idx = alunos.findIndex((a) => a.id === id);
  if (idx < 0 || !alunos[idx].linkToken || alunos[idx].linkToken !== t) {
    throw new ErroPublico(404, "Link inválido — peça um novo ao seu treinador.");
  }
  return { refAlunos, alunos, idx };
}

async function handleGet(event) {
  const q = event.queryStringParameters || {};
  const { org, id, t } = q;
  if (!org || !id || !t) throw new ErroPublico(400, "Link incompleto.");

  const { alunos, idx } = await carregarContexto(org, id, t);
  const aluno = alunos[idx];

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
  const turmaDoAluno = !aluno.plano
    ? turmas.find((tu) => Array.isArray(tu.membros) && tu.membros.includes(id) && tu.plano)
    : null;
  const fontePlano = aluno.plano ? aluno : (turmaDoAluno || aluno);
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

  let feedbacksEnviados = [];
  try {
    const { mapa } = await lerFeedbacksCoord(org);
    feedbacksEnviados = mapa[id] || [];
  } catch (e) { feedbacksEnviados = []; }

  return resposta(200, {
    nome: aluno.nome || "Jogador",
    academiaNome,
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
    historicoRelatorios: aluno.historicoRelatorios || [],
    mapaConceitos: mapaConceitosDoAluno(aluno.registros),
  });
}

async function handlePost(event) {
  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch (e) { throw new ErroPublico(400, "Corpo da requisição inválido."); }

  const { org, id, t, acao } = body;
  if (!org || !id || !t) throw new ErroPublico(400, "Link incompleto.");
  if (!acao) throw new ErroPublico(400, "Ação não informada.");

  const { refAlunos, alunos, idx } = await carregarContexto(org, id, t);
  const aluno = alunos[idx];

  if (acao === "cancelar") return await acaoCancelar(refAlunos, alunos, idx, aluno);
  if (acao === "reagendar") return await acaoReagendar(refAlunos, alunos, idx, aluno, body);
  if (acao === "feedback") return await acaoFeedbackCoord(org, id, body);
  if (acao === "jogo") return await acaoTexto(refAlunos, alunos, idx, aluno, body, "jogosRelatados");
  if (acao === "duvida") return await acaoDuvida(refAlunos, alunos, idx, aluno, body);
  throw new ErroPublico(400, "Ação desconhecida.");
}

async function salvar(refAlunos, alunos) {
  await refAlunos.set({ value: JSON.stringify(alunos), atualizado: Date.now() });
}

/* Cancelar com pelo menos 24h de aviso marca a aula como "cancelada"
   (repete, sem penalidade — mesmo mecanismo de uma aula perdida por
   chuva). Com menos de 24h, não existe cancelamento de verdade: a
   aula em vigor é marcada "feita" — o horário estava reservado e foi
   usado, avisado tarde ou não. */
async function acaoCancelar(refAlunos, alunos, idx, aluno) {
  if (!aluno.plano || !aluno.plano.aprovado) throw new ErroPublico(400, "Não há aula pendente para cancelar.");
  const aula = aulaEmVigor(aluno);
  if (!aula) throw new ErroPublico(400, "Não há aula pendente para cancelar.");
  if (!aluno.horarios || !aluno.horarios.length) {
    throw new ErroPublico(400, "Sem horário fixo cadastrado — fale com seu treinador para cancelar essa aula.");
  }
  const agora = new Date();
  const proxima = proximaOcorrencia(aluno.horarios, agora);
  const horasDeAviso = proxima ? (proxima.getTime() - agora.getTime()) / 3600000 : 0;
  const dentroDoPrazo = horasDeAviso >= 24;
  const hoje = agora.toISOString().slice(0, 10);

  const d = { status: dentroDoPrazo ? "cancelada" : "feita", data: hoje };
  if (dentroDoPrazo) d.motivo = "Cancelado pelo aluno, com aviso de 24h ou mais";
  else d.obs = "Cancelado pelo aluno com menos de 24h de aviso — contado como aula realizada.";
  aluno.regPlano = { ...(aluno.regPlano || {}), [aula.id]: d };
  alunos[idx] = aluno;
  await salvar(refAlunos, alunos);

  return resposta(200, {
    ok: true, dentroDoPrazo,
    mensagem: dentroDoPrazo
      ? "Aula cancelada com aviso — não conta como realizada, seu treinador vai repor."
      : "Cancelamento com menos de 24h de aviso: esta aula já entra como realizada.",
  });
}

async function acaoReagendar(refAlunos, alunos, idx, aluno, body) {
  const { diaPreferido, horaPreferido, nota } = body;
  if (diaPreferido === undefined || diaPreferido === null || !horaPreferido) {
    throw new ErroPublico(400, "Escolha um dia e um horário preferido.");
  }
  const jaTemPendente = (aluno.pedidosReposicao || []).some((p) => p.status === "pendente");
  if (jaTemPendente) {
    throw new ErroPublico(400, "Você já tem um pedido de reposição em aberto — aguarde seu treinador responder antes de enviar outro.");
  }
  const pedido = {
    id: "pedreag-" + Date.now().toString(36),
    criadoEm: new Date().toISOString(),
    diaPreferido: Number(diaPreferido),
    horaPreferido: String(horaPreferido).slice(0, 5),
    nota: String(nota || "").trim().slice(0, 500),
    status: "pendente",
  };
  aluno.pedidosReposicao = [pedido, ...(aluno.pedidosReposicao || [])].slice(0, LIMITE_LISTA);
  alunos[idx] = aluno;
  await salvar(refAlunos, alunos);
  return resposta(200, { ok: true, mensagem: "Pedido enviado — seu treinador vai confirmar o novo horário." });
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
  aluno.pedidosConteudo = [item, ...(aluno.pedidosConteudo || [])].slice(0, LIMITE_LISTA);
  alunos[idx] = aluno;
  await salvar(refAlunos, alunos);
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
  aluno[campo] = [item, ...(aluno[campo] || [])].slice(0, LIMITE_LISTA);
  alunos[idx] = aluno;
  await salvar(refAlunos, alunos);
  return resposta(200, { ok: true, mensagem: "Enviado." });
}

function resposta(statusCode, corpo) {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) };
}
