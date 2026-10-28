/* Área do aluno do QuadraLab Treinador: o aluno tem conta própria, se vincula ao professor pelo código dele e vê só o que é seu.

   Duas pontas, a mesma function (login obrigatório, conferido aqui com verifyIdToken):
   · conta de ALUNO (sem orgId nos claims):
       GET                       → { conta, vinculo, dados? }  (dados = o mesmo conteúdo do link do aluno, só com vínculo ativo; ?rel=, ?jogo= e ?audio= também)
       POST { acao: "vincular", codigo }   → pede o vínculo ao professor dono do código (fica "aguardando" até ele aprovar)
       POST { acao: "cancelarPedido" }     → desiste do pedido ainda não aprovado
       POST { acao: "duvida" | "jogo" | "feedback", texto } → as mesmas ações do link (só com vínculo ativo)
   · conta de TREINADOR (orgId nos claims):
       GET ?treinador=1          → { codigo, pedidos, vinculados }
       POST { acao: "aprovar", uid, alunoId }  → liga a conta a um jogador que já existe na lista do treinador
       POST { acao: "recusar" | "desvincular", uid }

   Segurança: o aluno NUNCA ganha orgId nos claims (com ele, as regras do Firestore dariam acesso à lista inteira de jogadores da
   academia). A ligação conta → jogador mora só em contasAluno/{uid}, que nenhuma regra do Firestore libera ao navegador; quem lê e
   grava é esta function, com o Admin SDK, e ela só devolve o jogador da própria conta. O código do professor é o mesmo código fixo
   do treinador (codigosAcademia), gerado uma vez por treinador. */
const crypto = require("crypto");
const { admin, app } = require("./_firebase-admin");
const VA = require("./ver-aluno").interno;

const ALF = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const MAX_HIST = 30;
const agora = () => new Date().toISOString();
const db = () => admin.firestore();

class Erro extends Error { constructor(status, msg) { super(msg); this.status = status; } }

exports.handler = async function (event) {
  try {
    app();
    if (event.httpMethod !== "GET" && event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });
    const cab = (event.headers && (event.headers.authorization || event.headers.Authorization)) || "";
    const idToken = cab.startsWith("Bearer ") ? cab.slice(7) : "";
    if (!idToken) return resposta(401, { erro: "Entre com a sua conta." });
    let claims;
    try { claims = await admin.auth().verifyIdToken(idToken); } catch (e) { return resposta(401, { erro: "Sua sessão expirou. Entre de novo." }); }
    let body = {};
    if (event.httpMethod === "POST") {
      if (String(event.body || "").length > 20000) return resposta(413, { erro: "Pedido grande demais." });
      try { body = JSON.parse(event.body || "{}"); } catch (e) { return resposta(400, { erro: "Pedido inválido." }); }
    }
    const q = event.queryStringParameters || {};
    if (claims.orgId) return await ladoTreinador(claims, event.httpMethod, q, body);
    return await ladoAluno(claims, event.httpMethod, q, body);
  } catch (e) {
    if (e instanceof Erro || e instanceof VA.ErroPublico) return resposta(e.status, { erro: e.message });
    return resposta(500, { erro: "Não foi possível concluir agora. Tente de novo em instantes." });
  }
};

/* ── aluno ── */
async function ladoAluno(claims, metodo, q, body) {
  const ref = db().collection("contasAluno").doc(claims.uid);
  const snap = await ref.get();
  const conta = snap.exists ? snap.data() : { nome: String(claims.name || "").slice(0, 80), email: claims.email || null, criadoEm: agora() };
  if (!snap.exists) await ref.set(conta);
  const v = conta.vinculo || null;

  if (metodo === "GET") {
    const base = { conta: { nome: conta.nome || "", email: conta.email || null }, vinculo: publicoVinculo(v) };
    if (!v || v.status !== "ativo") return resposta(200, base);
    const ctx = await contexto(v);
    if (!ctx) return resposta(200, { ...base, vinculo: { ...publicoVinculo(v), status: "encerrado" } });
    if (q.rel || q.jogo || q.audio) return await VA.responderGet(v.orgId, v.alunoId, { rel: q.rel, jogo: q.jogo, audio: q.audio }, ctx);
    const r = await VA.responderGet(v.orgId, v.alunoId, {}, ctx);
    return resposta(200, { ...base, dados: JSON.parse(r.body) });
  }

  const acao = body.acao;
  if (acao === "vincular") {
    const codigo = String(body.codigo || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (codigo.length !== 8) throw new Erro(400, "O código do professor tem 8 letras e números.");
    if (v && v.status === "ativo") throw new Erro(409, "Sua conta já está vinculada a " + (v.treinadorNome || "um professor") + ".");
    const c = await db().collection("codigosAcademia").doc(codigo).get();
    if (!c.exists || !c.data().orgId) throw new Erro(404, "Não encontrei esse código. Confira com o seu professor.");
    const cd = c.data(), quando = agora();
    const vinculo = { orgId: cd.orgId, treinadorUid: cd.treinadorUid || null, treinadorNome: String(cd.treinadorNome || "Professor").slice(0, 80), codigo, status: "aguardando",
      alunoId: null, pedidoEm: quando, historico: hist(v, { em: quando, acao: "pedido de vínculo pelo código" }) };
    await ref.set({ ...conta, vinculo });
    return resposta(200, { ok: true, vinculo: publicoVinculo(vinculo) });
  }
  if (acao === "cancelarPedido") {
    if (!v || v.status !== "aguardando") throw new Erro(409, "Não há pedido aguardando.");
    await ref.set({ ...conta, vinculo: { ...v, status: "cancelado", historico: hist(v, { em: agora(), acao: "pedido cancelado pelo aluno" }) } });
    return resposta(200, { ok: true });
  }
  if (["duvida", "jogo", "feedback"].includes(acao)) {
    if (!v || v.status !== "ativo") throw new Erro(403, "Sua conta ainda não está vinculada ao seu professor.");
    const ctx = await contexto(v);
    if (!ctx) throw new Erro(403, "O vínculo com o seu professor foi encerrado.");
    return await VA.executarAcao(v.orgId, v.alunoId, { acao, texto: body.texto }, ctx);
  }
  throw new Erro(400, "Ação desconhecida.");
}

/* jogador vinculado ainda existe na lista do professor? (o professor pode ter removido o jogador) */
async function contexto(v) {
  try { return await VA.carregarContexto(v.orgId, v.alunoId, null, true); } catch (e) { if (e instanceof VA.ErroPublico) return null; throw e; }
}
function publicoVinculo(v) {
  if (!v || !["aguardando", "ativo", "recusado", "encerrado"].includes(v.status)) return null;
  return { status: v.status, treinadorNome: v.treinadorNome || "Professor", pedidoEm: v.pedidoEm || null, aprovadoEm: v.aprovadoEm || null };
}
function hist(v, item) { return [...((v && v.historico) || []).slice(-(MAX_HIST - 1)), item]; }

/* ── treinador ── */
async function ladoTreinador(claims, metodo, q, body) {
  const org = claims.orgId;
  if (metodo === "GET") {
    const codigo = await codigoDoTreinador(claims);
    const contas = await contasDaAcademia(org);
    const nomes = await nomesDosJogadores(org);
    const item = (d) => { const c = d.data(), v = c.vinculo; return { uid: d.id, nome: String(c.nome || "").slice(0, 80), email: c.email || null, pedidoEm: v.pedidoEm || null,
      alunoId: v.alunoId || null, alunoNome: v.alunoId ? (nomes.get(v.alunoId) || null) : null }; };
    return resposta(200, {
      codigo,
      pedidos: contas.filter((d) => d.data().vinculo.status === "aguardando").map(item),
      vinculados: contas.filter((d) => d.data().vinculo.status === "ativo").map(item),
    });
  }
  const uid = String(body.uid || "");
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(uid)) throw new Erro(400, "Conta inválida.");
  const ref = db().collection("contasAluno").doc(uid);
  const snap = await ref.get();
  const c = snap.exists ? snap.data() : null, v = c && c.vinculo;
  if (!v || v.orgId !== org) throw new Erro(404, "Pedido não encontrado.");
  const quando = agora();
  if (body.acao === "aprovar") {
    if (v.status !== "aguardando" && v.status !== "ativo") throw new Erro(409, "Esse pedido não está mais aguardando.");
    const alunoId = String(body.alunoId || "");
    const nomes = await nomesDosJogadores(org);
    if (!nomes.has(alunoId)) throw new Erro(400, "Escolha um jogador da sua lista.");
    await ref.set({ ...c, vinculo: { ...v, status: "ativo", alunoId, aprovadoEm: quando, aprovadoPor: claims.uid,
      historico: hist(v, { em: quando, por: claims.uid, acao: "aprovado e ligado a " + nomes.get(alunoId) }) } });
    return resposta(200, { ok: true });
  }
  if (body.acao === "recusar" || body.acao === "desvincular") {
    const status = body.acao === "recusar" ? "recusado" : "encerrado";
    if (body.acao === "recusar" && v.status !== "aguardando") throw new Erro(409, "Esse pedido não está mais aguardando.");
    if (body.acao === "desvincular" && v.status !== "ativo") throw new Erro(409, "Essa conta não está vinculada.");
    await ref.set({ ...c, vinculo: { ...v, status, historico: hist(v, { em: quando, por: claims.uid, acao: status === "recusado" ? "pedido recusado pelo professor" : "vínculo encerrado pelo professor" }) } });
    return resposta(200, { ok: true });
  }
  throw new Erro(400, "Ação desconhecida.");
}

async function contasDaAcademia(org) {
  const s = await db().collection("contasAluno").where("vinculo.orgId", "==", org).get();
  return s.docs.filter((d) => d.data().vinculo);
}
async function nomesDosJogadores(org) {
  const snap = await db().collection("orgs").doc(org).collection("dados").doc(VA.CHAVE_ALUNOS).get();
  let lista = [];
  try { lista = snap.exists ? JSON.parse(snap.data().value || "[]") : []; } catch (e) { lista = []; }
  return new Map(lista.filter((a) => a && a.id).map((a) => [a.id, String(a.nome || "Jogador").slice(0, 80)]));
}
/* o mesmo código fixo do treinador usado em todo o QuadraLab (codigosAcademia): gera na primeira vez */
async function codigoDoTreinador(claims) {
  const cod = db().collection("codigosAcademia");
  const existente = (await cod.where("treinadorUid", "==", claims.uid).limit(1).get()).docs[0];
  if (existente) return existente.id;
  for (let i = 0; i < 5; i++) {
    const b = crypto.randomBytes(8); let c = ""; for (let k = 0; k < 8; k++) c += ALF[b[k] % ALF.length];
    if (!(await cod.doc(c).get()).exists) {
      await cod.doc(c).set({ treinadorUid: claims.uid, treinadorNome: String(claims.name || "").trim() || "Treinador", treinadorEmail: claims.email || null, orgId: claims.orgId, criadoEm: agora() });
      return c;
    }
  }
  throw new Erro(500, "Não foi possível gerar o código agora. Tente de novo.");
}

function resposta(statusCode, corpo) {
  return { statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(corpo) };
}
