/* Canal de conversa da turma e do aluno (Team Yoda e QuadraLab).
   · Canal da turma ("turma:<turmaId>"): grupo aberto. O professor e cada aluno da turma (ou o responsável, pelo link do aluno)
     leem e escrevem; todos veem as mensagens uns dos outros, só com o primeiro nome de quem escreveu.
   · Canal do aluno ("aluno:<alunoId>"): conversa só entre o professor e aquele aluno (e o responsável dele).
   Quem pede:
   · professor: conta do app do treinador (token com orgId) → qualquer turma ou aluno da própria academia;
   · aluno ou responsável: link do aluno ({ org, id, t }, conferido como em ver-aluno) ou conta da Área do aluno (contasAluno com
     vínculo ativo) → o próprio canal e o canal das turmas em que o aluno está.
   Moderação (só o professor): apagar qualquer mensagem, silenciar um aluno no canal, deixar o canal "só o professor escreve".
   O aluno apaga as próprias mensagens. Tudo fica em orgs/{org}/canais/{tipo_id}/mensagens, que as regras do Firestore não abrem
   para o navegador: só esta function (Admin SDK) lê e grava. Avisos no celular: mensagem nova avisa os outros participantes.
   POST { acao, canal?, ... } — acoes: "meus" (canais do aluno), "listar", "enviar", "apagar", "silenciar", "modo", "resumo".
   Este arquivo é igual em netlify/functions e autonomo/netlify/functions. */
const { admin, app } = require("./_firebase-admin");
const P = require("./_push");
const VA = require("./ver-aluno").interno;

class Erro extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const resposta = (statusCode, corpo) => ({ statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(corpo) });
const ID = /^[A-Za-z0-9_.:@-]{1,120}$/;
const LIMITE_TEXTO = 1000, LIMITE_LISTA = 200, RAJADA = { n: 20, ms: 10 * 60 * 1000 };

const db = () => admin.firestore();
function lerJSON(snap) { try { return snap.exists ? JSON.parse(snap.data().value || "[]") : []; } catch (e) { return []; } }
async function dadosDaOrg(org) {
  const [sa, st] = await Promise.all([db().collection("orgs").doc(org).collection("dados").doc("mty:alunos:v2").get(),
    db().collection("orgs").doc(org).collection("dados").doc("mty:turmas:v1").get()]);
  return { alunos: lerJSON(sa), turmas: lerJSON(st) };
}
const primeiroNome = (n) => String(n || "").trim().split(/\s+/)[0] || "Aluno";
function chaveDoc(canal) { return canal.replace(":", "_"); }
function partes(canal) {
  const m = /^(turma|aluno):([A-Za-z0-9_.:@-]{1,110})$/.exec(String(canal || ""));
  if (!m) throw new Erro(400, "Canal inválido.");
  return { tipo: m[1], id: m[2] };
}

/* quem está pedindo: { papel: "professor", org, uid, nome } ou { papel: "aluno", org, alunoId } */
async function quem(event, b) {
  const cab = (event.headers && (event.headers.authorization || event.headers.Authorization)) || "";
  const tk = cab.startsWith("Bearer ") ? cab.slice(7) : "";
  if (b.link && b.link.org && b.link.id && b.link.t) {
    const l = b.link;
    if (!ID.test(String(l.org)) || !ID.test(String(l.id))) throw new Erro(400, "Link inválido.");
    await VA.carregarContexto(String(l.org), String(l.id), String(l.t)).catch(() => { throw new Erro(404, "Link inválido — peça um novo ao seu treinador."); });
    return { papel: "aluno", org: String(l.org), alunoId: String(l.id) };
  }
  if (!tk) throw new Erro(401, "Entre com a sua conta.");
  let claims; try { claims = await admin.auth().verifyIdToken(tk); } catch (e) { throw new Erro(401, "Sua sessão expirou. Entre de novo."); }
  if (claims.orgId) return { papel: "professor", org: String(claims.orgId), uid: claims.uid, nome: claims.name || "Professor" };
  const c = await db().collection("contasAluno").doc(claims.uid).get();
  const v = c.exists ? c.data().vinculo : null;
  if (!v || v.status !== "ativo" || !v.alunoId) throw new Erro(409, "Sua conta ainda não está ligada a um professor.");
  return { papel: "aluno", org: String(v.orgId), alunoId: String(v.alunoId), uid: claims.uid };
}

/* o canal existe na academia e quem pede pode entrar nele */
function conferirAcesso(eu, canal, dados) {
  const { tipo, id } = partes(canal);
  if (tipo === "turma") {
    const t = dados.turmas.find((x) => x && x.id === id);
    if (!t) throw new Erro(404, "Turma não encontrada.");
    if (eu.papel === "aluno" && !(t.membros || []).includes(eu.alunoId)) throw new Erro(403, "Você não está nesta turma.");
    return { tipo, id, nome: t.nome || "Turma", membros: (t.membros || []).slice(), professorUid: t.professorUid || "" };
  }
  const a = dados.alunos.find((x) => x && x.id === id);
  if (!a) throw new Erro(404, "Aluno não encontrado.");
  if (eu.papel === "aluno" && eu.alunoId !== id) throw new Erro(403, "Esta conversa é de outro aluno.");
  return { tipo, id, nome: a.nome || "Aluno", membros: [id], professorUid: a.professorUid || "" };
}
const refCanal = (org, canal) => db().collection("orgs").doc(org).collection("canais").doc(chaveDoc(canal));

function publica(id, m, eu) {
  return {
    id, em: m.em, apagada: !!m.apagada, texto: m.apagada ? "" : m.texto,
    autor: { tipo: m.autor.tipo, nome: m.autor.nome, alunoId: m.autor.alunoId || null },
    minha: eu.papel === "professor" ? m.autor.tipo === "professor" && m.autor.uid === eu.uid : m.autor.tipo === "aluno" && m.autor.alunoId === eu.alunoId,
  };
}
async function lerCanal(org, canal) {
  const s = await refCanal(org, canal).get();
  return s.exists ? s.data() : { soProfessor: false, silenciados: [], total: 0 };
}

async function listar(eu, canal, dados) {
  const info = conferirAcesso(eu, canal, dados);
  const c = await lerCanal(eu.org, canal);
  const snap = await refCanal(eu.org, canal).collection("mensagens").orderBy("em", "desc").limit(LIMITE_LISTA).get();
  const msgs = []; snap.forEach((d) => msgs.push(publica(d.id, d.data(), eu)));
  msgs.reverse();
  const nomes = {}; dados.alunos.forEach((a) => { if (info.membros.includes(a.id)) nomes[a.id] = primeiroNome(a.nome); });
  return {
    canal, tipo: info.tipo, nome: info.tipo === "turma" ? info.nome : (eu.papel === "aluno" ? "Conversa com o professor" : info.nome),
    soProfessor: !!c.soProfessor, silenciado: eu.papel === "aluno" && (c.silenciados || []).includes(eu.alunoId),
    participantes: info.tipo === "turma" ? info.membros.map((id) => ({ id, nome: nomes[id] || "Aluno", silenciado: (c.silenciados || []).includes(id) })) : undefined,
    mensagens: msgs, ultimaEm: c.ultima ? c.ultima.em : null,
  };
}

async function enviar(eu, canal, b, dados) {
  const info = conferirAcesso(eu, canal, dados);
  const texto = String(b.texto || "").replace(/\s+$/g, "").trim();
  if (!texto) throw new Erro(400, "Escreva a mensagem.");
  if (texto.length > LIMITE_TEXTO) throw new Erro(400, "Mensagem longa demais (até " + LIMITE_TEXTO + " caracteres).");
  const ref = refCanal(eu.org, canal), c = await lerCanal(eu.org, canal);
  let autor;
  if (eu.papel === "professor") autor = { tipo: "professor", nome: primeiroNome(b.nomeProfessor || eu.nome), uid: eu.uid };
  else {
    if (c.soProfessor) throw new Erro(403, "Neste canal só o professor escreve.");
    if ((c.silenciados || []).includes(eu.alunoId)) throw new Erro(403, "O professor pausou as suas mensagens neste canal.");
    const recentes = (c.rajada && c.rajada[eu.alunoId] || []).filter((t) => Date.now() - t < RAJADA.ms);
    if (recentes.length >= RAJADA.n) throw new Erro(429, "Muitas mensagens seguidas. Espere alguns minutos.");
    const al = dados.alunos.find((a) => a.id === eu.alunoId);
    const nome = primeiroNome(al && al.nome);
    autor = { tipo: "aluno", alunoId: eu.alunoId, nome: b.comoResponsavel ? "Responsável de " + nome : nome, ...(eu.uid ? { uid: eu.uid } : {}) };
    c.rajada = { ...(c.rajada || {}), [eu.alunoId]: recentes.concat([Date.now()]) };
  }
  const em = new Date().toISOString();
  const msg = { texto, autor, em };
  const nova = await ref.collection("mensagens").add(msg);
  await ref.set({ tipo: info.tipo, refId: info.id, ultima: { texto: texto.slice(0, 120), autorNome: autor.nome, em }, total: (c.total || 0) + 1, atualizadoEm: em, ...(c.rajada ? { rajada: c.rajada } : {}) }, { merge: true });
  /* aviso no celular para os outros participantes (o aviso é extra: falhar não desfaz a mensagem) */
  const titulo = info.tipo === "turma" ? info.nome : eu.papel === "professor" ? "Mensagem do professor" : info.nome;
  const corpo = autor.nome + ": " + texto.slice(0, 140);
  const destinos = info.membros.filter((id) => !(autor.tipo === "aluno" && id === autor.alunoId));
  await Promise.all(destinos.map((alunoId) => P.avisar(admin, { app: "aluno", orgId: eu.org, alunoId }, { titulo, corpo, url: "@app", tag: "canal-" + chaveDoc(canal) })));
  if (autor.tipo === "aluno") await P.avisar(admin, { app: "treinador", orgId: eu.org, ...(info.professorUid ? { uid: info.professorUid } : {}) }, { titulo: "Canal · " + info.nome, corpo, url: "@app", tag: "canal-" + chaveDoc(canal) });
  return { ok: true, mensagem: publica(nova.id, msg, eu) };
}

async function apagar(eu, canal, b, dados) {
  conferirAcesso(eu, canal, dados);
  if (!ID.test(String(b.mensagemId || ""))) throw new Erro(400, "Mensagem inválida.");
  const r = refCanal(eu.org, canal).collection("mensagens").doc(String(b.mensagemId));
  const s = await r.get();
  if (!s.exists) throw new Erro(404, "Mensagem não encontrada.");
  const m = s.data();
  const dono = eu.papel === "professor" ? m.autor.tipo === "professor" && m.autor.uid === eu.uid : m.autor.tipo === "aluno" && m.autor.alunoId === eu.alunoId;
  if (eu.papel !== "professor" && !dono) throw new Erro(403, "Você só pode apagar as suas mensagens.");
  await r.set({ ...m, apagada: true, texto: "", apagadaPor: eu.papel, apagadaEm: new Date().toISOString() });
  return { ok: true };
}

async function moderar(eu, canal, b, dados) {
  if (eu.papel !== "professor") throw new Erro(403, "Só o professor modera o canal.");
  const info = conferirAcesso(eu, canal, dados);
  const ref = refCanal(eu.org, canal), c = await lerCanal(eu.org, canal);
  if (b.acao === "modo") { await ref.set({ tipo: info.tipo, refId: info.id, soProfessor: !!b.soProfessor }, { merge: true }); return { ok: true }; }
  const alunoId = String(b.alunoId || "");
  if (!info.membros.includes(alunoId)) throw new Erro(404, "Aluno fora deste canal.");
  const s = new Set(c.silenciados || []); if (b.sim) s.add(alunoId); else s.delete(alunoId);
  await ref.set({ tipo: info.tipo, refId: info.id, silenciados: [...s] }, { merge: true });
  return { ok: true };
}

/* canais do aluno: a conversa dele com o professor e o grupo de cada turma em que está */
async function meus(eu, dados) {
  if (eu.papel !== "aluno") throw new Erro(403, "Só para o aluno.");
  const canais = ["aluno:" + eu.alunoId].concat(dados.turmas.filter((t) => (t.membros || []).includes(eu.alunoId)).map((t) => "turma:" + t.id));
  const lista = await Promise.all(canais.map(async (k) => {
    const c = await lerCanal(eu.org, k), { tipo, id } = partes(k);
    const t = tipo === "turma" ? dados.turmas.find((x) => x.id === id) : null;
    return { canal: k, tipo, nome: tipo === "turma" ? (t && t.nome) || "Turma" : "Conversa com o professor", ultima: c.ultima || null, total: c.total || 0 };
  }));
  return { canais: lista };
}
/* professor: o último movimento de cada canal da academia (para marcar o que é novo) */
async function resumo(eu) {
  if (eu.papel !== "professor") throw new Erro(403, "Só para o professor.");
  const snap = await db().collection("orgs").doc(eu.org).collection("canais").get();
  const canais = {};
  snap.forEach((d) => { const x = d.data(); if (x.tipo && x.refId) canais[x.tipo + ":" + x.refId] = { ultima: x.ultima || null, total: x.total || 0 }; });
  return { canais };
}

exports.handler = async function (event) {
  try {
    app();
    if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });
    let b; try { b = JSON.parse(event.body || "{}"); } catch (e) { throw new Erro(400, "Pedido inválido."); }
    const eu = await quem(event, b);
    const dados = await dadosDaOrg(eu.org);
    if (b.acao === "meus") return resposta(200, await meus(eu, dados));
    if (b.acao === "resumo") return resposta(200, await resumo(eu));
    if (b.acao === "listar") return resposta(200, await listar(eu, String(b.canal || ""), dados));
    if (b.acao === "enviar") return resposta(200, await enviar(eu, String(b.canal || ""), b, dados));
    if (b.acao === "apagar") return resposta(200, await apagar(eu, String(b.canal || ""), b, dados));
    if (b.acao === "silenciar" || b.acao === "modo") return resposta(200, await moderar(eu, String(b.canal || ""), b, dados));
    throw new Erro(400, "Ação desconhecida.");
  } catch (e) {
    if (e instanceof Erro) return resposta(e.status, { erro: e.message });
    console.error("canal:", e);
    return resposta(500, { erro: "Não foi possível agora. Tente de novo." });
  }
};
