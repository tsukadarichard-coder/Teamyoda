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

  const plano = aluno.plano;
  const reg = aluno.regPlano || {};
  const aulas = listaAulas(plano).map((a) => {
    const r = reg[a.id] || {};
    return { bloco: a.bloco, semana: a.semana, foco: a.foco, titulo: a.t || "", status: r.status || (r.feita ? "feita" : ""), data: r.data || null };
  });
  const emVigor = aulaEmVigor(aluno);
  const agora = new Date();
  const proxima = proximaOcorrencia(aluno.horarios, agora);

  let turmas = [];
  try {
    const snapT = await admin.firestore().collection("orgs").doc(org).collection("dados").doc(CHAVE_TURMAS).get();
    if (snapT.exists) turmas = JSON.parse(snapT.data().value || "[]");
  } catch (e) { turmas = []; }

  return resposta(200, {
    nome: aluno.nome || "Jogador",
    temPlano: !!plano,
    tipoPlano: plano ? plano.tipo || "" : null,
    prioridade: plano ? plano.prioridade || "" : null,
    totalAulas: aulas.length,
    aulasFeitas: aulas.filter((a) => a.status === "feita").length,
    aulas,
    horarios: aluno.horarios || [],
    aulaEmVigor: emVigor ? { titulo: emVigor.t || "", bloco: emVigor.bloco, semana: emVigor.semana } : null,
    proximaAula: proxima ? proxima.toISOString() : null,
    agendaOcupada: agendaOcupada(alunos, turmas),
    pedidosReposicao: aluno.pedidosReposicao || [],
    feedbacksEnviados: aluno.feedbacksAluno || [],
    jogosRelatados: aluno.jogosRelatados || [],
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
  if (acao === "feedback") return await acaoTexto(refAlunos, alunos, idx, aluno, body, "feedbacksAluno");
  if (acao === "jogo") return await acaoTexto(refAlunos, alunos, idx, aluno, body, "jogosRelatados");
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
