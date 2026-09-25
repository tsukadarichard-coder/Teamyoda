/* Inscrição pública em torneio ou evento — sem login, pelo link que o
   treinador copia nas abas Torneios/Eventos (inscricao.html?org=ORGID).
   Mesmo padrão de reservar-quadra.js: só funciona pra academia com
   orgs/{org}/meta/info.mostrarTorneiosEventos === true (Team Yoda e 39
   Ranch têm liberação própria aqui embaixo, sem precisar desse campo).

   GET não expõe nome nem telefone de quem já se inscreveu — só o que é
   preciso pra montar a lista (torneios com inscrições abertas, eventos
   ativos, e quantas vagas de evento já foram preenchidas). Quem vê os
   detalhes completos é só o treinador logado, dentro do app.

   POST usa uma transação do Firestore na própria gravação — evita que
   duas pessoas inscrevendo no mesmo instante para a última vaga de um
   evento resultem nas duas "confirmadas" ao mesmo tempo. */
const { admin, app } = require("./_firebase-admin");

class ErroPublico extends Error {
  constructor(status, mensagem) { super(mensagem); this.status = status; }
}

const CHAVE_TORNEIOS = "mty:torneios:v1";
const CHAVE_EVENTOS = "mty:eventos:v1";
const LIMITE_NOME = 80;
const LIMITE_TELEFONE = 30;

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
  if (org === "team-yoda" || org === "39-ranch") return dados;
  if (!info.exists || dados.mostrarTorneiosEventos !== true) {
    throw new ErroPublico(404, "Esta academia não usa inscrição por este link.");
  }
  return dados;
}

async function handleGet(event) {
  const q = event.queryStringParameters || {};
  const { org } = q;
  const info = await confereAcademiaHabilitada(org);

  const db = admin.firestore();
  const snapTorneios = await db.collection("orgs").doc(org).collection("dados").doc(CHAVE_TORNEIOS).get();
  const torneios = snapTorneios.exists ? JSON.parse(snapTorneios.data().value || "[]") : [];
  const torneiosAbertos = torneios
    .filter((t) => t.status === "inscricoes")
    .map((t) => ({
      id: t.id, nome: t.nome, dataInicio: t.dataInicio, dataFim: t.dataFim, local: t.local,
      categorias: (t.categorias || []).map((c) => ({ id: c.id, nome: c.nome })),
    }));

  const snapEventos = await db.collection("orgs").doc(org).collection("dados").doc(CHAVE_EVENTOS).get();
  const eventos = snapEventos.exists ? JSON.parse(snapEventos.data().value || "[]") : [];
  const eventosAtivos = eventos
    .filter((e) => e.ativo !== false)
    .map((e) => ({
      id: e.id, nome: e.nome, data: e.data, horaInicio: e.horaInicio, horaFim: e.horaFim,
      local: e.local, tipo: e.tipo, descricao: e.descricao, vagas: e.vagas ?? null,
      confirmados: (e.convidados || []).filter((c) => c.status === "confirmado").length,
    }));

  return resposta(200, { academia: info.nome || org, torneios: torneiosAbertos, eventos: eventosAtivos });
}

async function handlePost(event) {
  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch (e) { throw new ErroPublico(400, "Corpo da requisição inválido."); }

  const { org, tipo } = body;
  const nomeContato = String(body.nomeContato || "").trim().slice(0, LIMITE_NOME);
  const telefoneContato = String(body.telefoneContato || "").trim().slice(0, LIMITE_TELEFONE);
  if (!nomeContato || !telefoneContato) throw new ErroPublico(400, "Preencha nome e telefone.");

  await confereAcademiaHabilitada(org);
  const db = admin.firestore();

  if (tipo === "torneio") return await inscreverTorneio(db, org, body, nomeContato, telefoneContato);
  if (tipo === "evento") return await inscreverEvento(db, org, body, nomeContato, telefoneContato);
  throw new ErroPublico(400, 'tipo precisa ser "torneio" ou "evento".');
}

async function inscreverTorneio(db, org, body, nomeContato, telefoneContato) {
  const { torneioId, categoriaId } = body;
  if (!torneioId || !categoriaId) throw new ErroPublico(400, "Faltou o torneio ou a categoria.");

  const ref = db.collection("orgs").doc(org).collection("dados").doc(CHAVE_TORNEIOS);
  const resultado = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const torneios = snap.exists ? JSON.parse(snap.data().value || "[]") : [];
    const torneio = torneios.find((t) => t.id === torneioId);
    if (!torneio || torneio.status !== "inscricoes") {
      throw new ErroPublico(404, "Esse torneio não está com inscrições abertas — atualize a página.");
    }
    const categoria = (torneio.categorias || []).find((c) => c.id === categoriaId);
    if (!categoria) throw new ErroPublico(404, "Essa categoria não existe mais — atualize a página.");

    const inscricao = {
      id: "inscricao-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7),
      nomeContato, telefoneContato, origem: "cliente", vistoPeloStaff: false, criadoEm: new Date().toISOString(),
    };
    categoria.inscritos = [...(categoria.inscritos || []), inscricao];
    tx.set(ref, { value: JSON.stringify(torneios), atualizado: Date.now() });
    return { torneioNome: torneio.nome, categoriaNome: categoria.nome };
  });

  return resposta(200, { ok: true, ...resultado });
}

async function inscreverEvento(db, org, body, nomeContato, telefoneContato) {
  const { eventoId } = body;
  if (!eventoId) throw new ErroPublico(400, "Faltou o evento.");

  const ref = db.collection("orgs").doc(org).collection("dados").doc(CHAVE_EVENTOS);
  const resultado = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const eventos = snap.exists ? JSON.parse(snap.data().value || "[]") : [];
    const evento = eventos.find((e) => e.id === eventoId);
    if (!evento || evento.ativo === false) {
      throw new ErroPublico(404, "Esse evento não está mais com inscrições abertas — atualize a página.");
    }
    const confirmados = (evento.convidados || []).filter((c) => c.status === "confirmado").length;
    const status = evento.vagas != null && confirmados >= evento.vagas ? "espera" : "confirmado";

    const inscricao = {
      id: "inscricao-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7),
      nomeContato, telefoneContato, status, origem: "cliente", vistoPeloStaff: false, criadoEm: new Date().toISOString(),
    };
    evento.convidados = [...(evento.convidados || []), inscricao];
    tx.set(ref, { value: JSON.stringify(eventos), atualizado: Date.now() });
    return { eventoNome: evento.nome, status };
  });

  return resposta(200, { ok: true, ...resultado });
}

function resposta(statusCode, corpo) {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) };
}
