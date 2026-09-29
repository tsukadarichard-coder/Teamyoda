/* Grade pública de ocupação de horários de aula — sem login, pelo link
   do próprio app do cliente (cliente.html?org=ORGID, aba "Aulas"). Só
   funciona pra academia com orgs/{org}/meta/info.mostrarQuadras === true
   (Team Yoda e 39 Ranch têm liberação própria aqui embaixo, sem precisar
   desse campo) — mesma regra de acesso do reservar-quadra.js.

   Só devolve "dia-hora" ocupado ou não — nunca o nome de aluno nem de
   turma, pra não vazar quem treina em qual horário. */
const { admin, app } = require("./_firebase-admin");

class ErroPublico extends Error {
  constructor(status, mensagem) { super(mensagem); this.status = status; }
}

const CHAVE_ALUNOS = "mty:alunos:v2";
const CHAVE_TURMAS = "mty:turmas:v1";
const CHAVE_BLOQUEIOS = "mty:bloqueiosAula:v1";

/* Mesma lógica de duração do painel (ver DURACOES_TREINO/minutosDaDuracao
   em index.html) — duplicada aqui porque esta function roda isolada, sem
   acesso ao bundle do React. Um treino de 2h precisa aparecer ocupado
   nas quatro meias horas que ele cobre, não só na que ele começa. */
function minutosDaDuracao(d) { return { "1h": 60, "1h30": 90, "2h": 120 }[d] || 90; }
function horaMaisMinutos(hora, minutos) {
  const [h, m] = hora.split(":").map(Number);
  const total = h * 60 + m + minutos;
  const hh = Math.floor(total / 60) % 24, mm = total % 60;
  return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
}
function faixasDeMeiaHora(horaInicio, horaFim) {
  const lista = [];
  let atual = horaInicio;
  while (atual < horaFim) {
    lista.push(atual);
    atual = horaMaisMinutos(atual, 30);
  }
  return lista;
}

exports.handler = async function (event) {
  try {
    app();
    if (event.httpMethod !== "GET") return resposta(405, { erro: "Método não permitido." });

    const { org } = event.queryStringParameters || {};
    const info = await confereAcademiaHabilitada(org);

    const db = admin.firestore();
    const [snapAlunos, snapTurmas, snapBloqueios] = await Promise.all([
      db.collection("orgs").doc(org).collection("dados").doc(CHAVE_ALUNOS).get(),
      db.collection("orgs").doc(org).collection("dados").doc(CHAVE_TURMAS).get(),
      db.collection("orgs").doc(org).collection("dados").doc(CHAVE_BLOQUEIOS).get(),
    ]);
    const alunos = snapAlunos.exists ? JSON.parse(snapAlunos.data().value || "[]") : [];
    const turmas = snapTurmas.exists ? JSON.parse(snapTurmas.data().value || "[]") : [];
    const bloqueios = snapBloqueios.exists ? JSON.parse(snapBloqueios.data().value || "[]") : [];

    const ocupados = new Set();
    turmas.forEach((t) => (t.horarios || []).forEach((h) => {
      const fim = horaMaisMinutos(h.hora, minutosDaDuracao(t.duracaoPadrao));
      faixasDeMeiaHora(h.hora, fim).forEach((hora) => ocupados.add(h.dia + "-" + hora));
    }));
    alunos.forEach((a) => (a.horarios || []).forEach((h) => {
      const fim = horaMaisMinutos(h.hora, minutosDaDuracao(a.duracaoPadrao));
      faixasDeMeiaHora(h.hora, fim).forEach((hora) => ocupados.add(h.dia + "-" + hora));
    }));
    bloqueios.forEach((b) => ocupados.add(b.dia + "-" + b.hora));

    return resposta(200, { academia: info.nome || org, ocupados: [...ocupados] });
  } catch (e) {
    if (e instanceof ErroPublico) return resposta(e.status, { erro: e.message });
    return resposta(500, { erro: String(e.message || e) });
  }
};

async function confereAcademiaHabilitada(org) {
  if (!org) throw new ErroPublico(400, "Link incompleto.");
  const info = await admin.firestore().collection("orgs").doc(org).collection("meta").doc("info").get();
  const dados = info.exists ? info.data() : {};
  if (org === "team-yoda" || org === "39-ranch") return dados;
  if (!info.exists || dados.mostrarQuadras !== true) {
    throw new ErroPublico(404, "Esta academia não usa esta agenda por este link.");
  }
  return dados;
}

function resposta(statusCode, corpo) {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) };
}
