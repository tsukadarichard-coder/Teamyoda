/* Reserva pública de quadra/espaço — sem login, pelo link que o
   treinador copia na aba Quadras (reservar.html?org=ORGID). Só funciona
   pra academia com orgs/{org}/meta/info.mostrarQuadras === true (a Team
   Yoda tem uma liberação própria aqui embaixo, sem precisar desse campo);
   pra qualquer outra, a function recusa antes de expor qualquer dado.

   GET não expõe nome nem telefone de quem já reservou — só o horário
   ocupado, pra não vazar dado de um cliente pro outro. Quem vê os
   detalhes completos é só o treinador logado, dentro do app.

   POST usa uma transação do Firestore na própria gravação, pra dois
   clientes clicando no mesmo horário quase ao mesmo tempo não
   conseguirem os dois reservar a mesma vaga. */
const { admin, app } = require("./_firebase-admin");

class ErroPublico extends Error {
  constructor(status, mensagem) { super(mensagem); this.status = status; }
}

const CHAVE_QUADRAS = "mty:quadras:v1";
const CHAVE_RESERVAS = "mty:reservas:v1";
const LIMITE_NOME = 80;
const LIMITE_TELEFONE = 30;
const LIMITE_OBS = 300;

exports.handler = async function (event) {
  try {
    app();
    if (event.httpMethod === "GET") return await handleGet(event);
    if (event.httpMethod === "POST") return await handlePost(event);
    return resposta(405, { erro: "Método não permitido." });
  } catch (e) {
    if (e instanceof ErroPublico) return resposta(e.status, { erro: e.message });
    return resposta(500, { erro: String(e.message || e) });
  }
};

async function confereAcademiaHabilitada(org) {
  if (!org) throw new ErroPublico(400, "Link incompleto.");
  const info = await admin.firestore().collection("orgs").doc(org).collection("meta").doc("info").get();
  const dados = info.exists ? info.data() : {};
  // Team Yoda passou a usar Quadras — liberada direto aqui, sem depender
  // do campo mostrarQuadras (evita precisar de outra chamada ao
  // provisionar-org só pra isso).
  if (org === "team-yoda") return dados;
  if (!info.exists || dados.mostrarQuadras !== true) {
    throw new ErroPublico(404, "Esta academia não usa reserva de quadra por este link.");
  }
  return dados;
}

function reservasSeSobrepoem(a, b) {
  return a.quadraId === b.quadraId && a.data === b.data && a.horaInicio < b.horaFim && a.horaFim > b.horaInicio;
}

async function handleGet(event) {
  const q = event.queryStringParameters || {};
  const { org, data } = q;
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new ErroPublico(400, "Informe uma data válida (AAAA-MM-DD).");
  const info = await confereAcademiaHabilitada(org);

  const db = admin.firestore();
  const snapQuadras = await db.collection("orgs").doc(org).collection("dados").doc(CHAVE_QUADRAS).get();
  const quadras = (snapQuadras.exists ? JSON.parse(snapQuadras.data().value || "[]") : []).filter((qd) => qd.ativa !== false);

  const snapReservas = await db.collection("orgs").doc(org).collection("dados").doc(CHAVE_RESERVAS).get();
  const reservas = snapReservas.exists ? JSON.parse(snapReservas.data().value || "[]") : [];
  const ocupados = reservas.filter((r) => r.data === data).map((r) => ({ quadraId: r.quadraId, horaInicio: r.horaInicio, horaFim: r.horaFim }));

  return resposta(200, {
    academia: info.nome || org,
    quadras: quadras.map((qd) => ({ id: qd.id, nome: qd.nome })),
    ocupados,
  });
}

async function handlePost(event) {
  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch (e) { throw new ErroPublico(400, "Corpo da requisição inválido."); }

  const { org, quadraId, data, horaInicio, horaFim } = body;
  const nomeContato = String(body.nomeContato || "").trim().slice(0, LIMITE_NOME);
  const telefoneContato = String(body.telefoneContato || "").trim().slice(0, LIMITE_TELEFONE);
  const observacao = String(body.observacao || "").trim().slice(0, LIMITE_OBS);

  await confereAcademiaHabilitada(org);

  if (!quadraId || !data || !horaInicio || !horaFim || !nomeContato || !telefoneContato) {
    throw new ErroPublico(400, "Preencha quadra, data, horário, nome e telefone.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new ErroPublico(400, "Data inválida.");
  if (!/^\d{2}:\d{2}$/.test(horaInicio) || !/^\d{2}:\d{2}$/.test(horaFim)) throw new ErroPublico(400, "Horário inválido.");
  if (horaFim <= horaInicio) throw new ErroPublico(400, "O horário de fim precisa ser depois do início.");

  const db = admin.firestore();

  const snapQuadras = await db.collection("orgs").doc(org).collection("dados").doc(CHAVE_QUADRAS).get();
  const quadras = snapQuadras.exists ? JSON.parse(snapQuadras.data().value || "[]") : [];
  const quadra = quadras.find((qd) => qd.id === quadraId && qd.ativa !== false);
  if (!quadra) throw new ErroPublico(404, "Essa quadra não existe mais — atualize a página.");

  const novaReserva = {
    id: "reserva-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7),
    quadraId, data, horaInicio, horaFim, nomeContato, telefoneContato, observacao,
    origem: "cliente", vistoPeloStaff: false, criadoEm: new Date().toISOString(),
  };

  const refReservas = db.collection("orgs").doc(org).collection("dados").doc(CHAVE_RESERVAS);
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(refReservas);
      const reservas = snap.exists ? JSON.parse(snap.data().value || "[]") : [];
      if (reservas.some((r) => reservasSeSobrepoem(r, novaReserva))) {
        throw new ErroPublico(409, "Esse horário acabou de ser reservado por outra pessoa — escolha outro.");
      }
      tx.set(refReservas, { value: JSON.stringify([...reservas, novaReserva]), atualizado: Date.now() });
    });
  } catch (e) {
    if (e instanceof ErroPublico) throw e;
    throw new ErroPublico(500, "Falha ao gravar a reserva: " + String(e.message || e));
  }

  return resposta(200, { ok: true, reserva: { quadraNome: quadra.nome, data, horaInicio, horaFim } });
}

function resposta(statusCode, corpo) {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) };
}
