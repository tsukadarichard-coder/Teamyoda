/* Academia Digital Team Yoda (teamyoda.com.br/digital/): área restrita online com trilhas de aulas em vídeo (YouTube não
   listado), treinos do catálogo com a quadra animada e o simulador de decisões.
   Quem tem acesso:
   · equipe: conta do app do treinador das unidades (token com orgId "team-yoda" ou "39-ranch");
   · aluno da unidade (Team Yoda · Cooper Tênis ou 39 Ranch): não paga. A conta fica ligada ao aluno pelo link do aluno que o
     professor enviou (o token do link prova a matrícula); vale enquanto o aluno estiver na lista da unidade;
   · assinante: mensalidade recorrente (campo `assinatura`, gravado pelo webhook do pagamento quando ele for ligado — não há
     cobrança ativa aqui);
   · cortesia: acesso liberado à mão pela coordenação.
   Dados: digitalContas/{uid}, digitalConteudo/academia (trilhas e informações de venda), digitalInteresses (lista de espera).
   As regras do Firestore não abrem estas coleções para o navegador: só esta function (Admin SDK) lê e grava.
   GET  ?vitrine=1                           → vitrine pública (títulos das trilhas, sem os vídeos) e a informação de venda
   GET  (logado)                             → conta, acesso, conteúdo (completo só com acesso) e progresso
   GET  ?catalogo=1 (logado, com acesso)     → catálogo de exercícios MTY (_exercicios-digital.json, gerado de mty/index.html)
   POST { acao: "criar", nome, email, senha } (sem login) → cria a conta
   POST { acao: "interesse", nome, email }   (sem login) → entra na lista de espera da assinatura
   POST (logado) { acao: "vincular", link: { org, id, t } } | { acao: "desvincular", org, alunoId } | { acao: "progresso", aulaId, feito }
   POST (coordenação) { acao: "salvarConteudo", trilhas, venda } | { acao: "membros" } | { acao: "cortesia", email, sim } */
const { admin, app } = require("./_firebase-admin");
const VA = require("./ver-aluno").interno;

class Erro extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const resposta = (statusCode, corpo) => ({ statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(corpo) });
const ORGS = { "team-yoda": "Team Yoda · Cooper Tênis", "39-ranch": "39 Ranch Tennis Club" };
const ID = /^[A-Za-z0-9_.:@-]{1,120}$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
const MAX_CONTAS_POR_ALUNO = 3, MAX_TRILHAS = 40, MAX_AULAS = 60;
const db = () => admin.firestore();
const agora = () => new Date().toISOString();
const txt = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
const txtLongo = (v, n) => String(v == null ? "" : v).replace(/\r/g, "").trim().slice(0, n);

/* "https://youtu.be/ID", "youtube.com/watch?v=ID", "/shorts/ID", "/embed/ID" ou o próprio ID → ID do vídeo (11 caracteres) */
function idDoYoutube(v) {
  const s = String(v || "").trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const m = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/.exec(s);
  return m ? m[1] : "";
}
const NIVEIS = ["iniciante", "intermediario", "avancado", "todos"];
function limparConteudo(b) {
  const trilhas = (Array.isArray(b.trilhas) ? b.trilhas : []).slice(0, MAX_TRILHAS).map((t, i) => {
    const id = ID.test(String(t.id || "")) ? String(t.id) : "tr" + Date.now().toString(36) + i;
    const aulas = (Array.isArray(t.aulas) ? t.aulas : []).slice(0, MAX_AULAS).map((a, j) => {
      const yt = idDoYoutube(a.youtube);
      if (a.youtube && !yt) throw new Erro(400, "Link do YouTube inválido na aula “" + txt(a.titulo, 60) + "”.");
      return {
        id: ID.test(String(a.id || "")) ? String(a.id) : id + "-a" + Date.now().toString(36) + j,
        titulo: txt(a.titulo, 120) || "Aula " + (j + 1), descricao: txtLongo(a.descricao, 2000), youtube: yt,
        exercicios: (Array.isArray(a.exercicios) ? a.exercicios : []).map((c) => String(c).toUpperCase()).filter((c) => /^[A-Z]{2,4}\d{3}$/.test(c)).slice(0, 12),
        duracao: txt(a.duracao, 20),
      };
    });
    return { id, titulo: txt(t.titulo, 120) || "Trilha " + (i + 1), descricao: txtLongo(t.descricao, 1500), nivel: NIVEIS.includes(t.nivel) ? t.nivel : "todos", publicada: !!t.publicada, aulas };
  });
  const v = b.venda || {};
  const checkoutUrl = txt(v.checkoutUrl, 400);
  if (checkoutUrl && !/^https:\/\/[^\s]+$/.test(checkoutUrl)) throw new Erro(400, "O link de pagamento precisa começar com https://");
  return { trilhas, venda: { preco: txt(v.preco, 40), checkoutUrl, observacao: txtLongo(v.observacao, 600) } };
}
async function lerConteudo() {
  const s = await db().collection("digitalConteudo").doc("academia").get();
  const d = s.exists ? s.data() : {};
  return { trilhas: d.trilhas || [], venda: d.venda || { preco: "", checkoutUrl: "", observacao: "" } };
}
/* o que um visitante vê: nome e tamanho das trilhas publicadas, nunca o vídeo nem os treinos */
function vitrine(c) {
  return { trilhas: c.trilhas.filter((t) => t.publicada).map((t) => ({ id: t.id, titulo: t.titulo, descricao: t.descricao, nivel: t.nivel, aulas: t.aulas.length, comVideo: t.aulas.filter((a) => a.youtube).length })), venda: c.venda };
}
const publicadas = (c) => c.trilhas.filter((t) => t.publicada);

async function quem(event) {
  const cab = (event.headers && (event.headers.authorization || event.headers.Authorization)) || "";
  const tk = cab.startsWith("Bearer ") ? cab.slice(7) : "";
  if (!tk) return null;
  try { return await admin.auth().verifyIdToken(tk); } catch (e) { throw new Erro(401, "Sua sessão expirou. Entre de novo."); }
}
const ehCoordenacao = (c) => !!(c && ORGS[c.orgId] && c.role === "coordenador");

async function alunosDaOrg(org) {
  const s = await db().collection("orgs").doc(org).collection("dados").doc("mty:alunos:v2").get();
  try { return s.exists ? JSON.parse(s.data().value || "[]") : []; } catch (e) { return []; }
}
/* acesso de quem está logado: equipe › aluno da unidade (ainda na lista) › assinante em dia › cortesia */
async function acessoDe(claims, conta) {
  if (claims.orgId && ORGS[claims.orgId]) return { tipo: "equipe", unidade: ORGS[claims.orgId] };
  for (const v of (conta && conta.vinculos) || []) {
    const lista = await alunosDaOrg(v.org);
    const al = lista.find((a) => a && a.id === v.alunoId);
    if (al) return { tipo: "unidade", unidade: ORGS[v.org] || v.org, aluno: String(al.nome || "").split(/\s+/)[0] };
  }
  const hoje = agora().slice(0, 10), a = conta && conta.assinatura;
  if (a && a.status === "ativa" && (!a.ate || a.ate >= hoje)) return { tipo: "assinante", ate: a.ate || null };
  const c = conta && conta.cortesia;
  if (c && (!c.ate || c.ate >= hoje)) return { tipo: "cortesia", ate: c.ate || null };
  return { tipo: "nenhum" };
}
const refConta = (uid) => db().collection("digitalContas").doc(uid);
async function lerConta(claims) {
  const r = refConta(claims.uid), s = await r.get();
  if (s.exists) return s.data();
  const nova = { nome: txt(claims.name, 80) || String(claims.email || "").split("@")[0], email: String(claims.email || "").toLowerCase(), criadoEm: agora(), vinculos: [], vinculoChaves: [], progresso: {} };
  if (!claims.orgId) await r.set(nova);
  return nova;
}

async function criarConta(b) {
  const nome = txt(b.nome, 80), email = String(b.email || "").trim().toLowerCase(), senha = String(b.senha || "");
  if (nome.length < 2) throw new Erro(400, "Escreva o seu nome.");
  if (!EMAIL.test(email)) throw new Erro(400, "E-mail inválido.");
  if (senha.length < 8) throw new Erro(400, "A senha precisa ter pelo menos 8 caracteres.");
  let u;
  try { u = await admin.auth().createUser({ email, password: senha, displayName: nome }); }
  catch (e) {
    if (e && (e.code === "auth/email-already-exists" || /already/i.test(String(e.message)))) throw new Erro(409, "Já existe uma conta com este e-mail. Entre com ela.");
    throw new Erro(400, "Não foi possível criar a conta com estes dados.");
  }
  await refConta(u.uid).set({ nome, email, criadoEm: agora(), vinculos: [], vinculoChaves: [], progresso: {} });
  return { ok: true };
}

async function vincular(claims, conta, b) {
  if (claims.orgId) throw new Erro(400, "Conta da equipe já tem acesso: não precisa ligar a um aluno.");
  const l = b.link || {};
  if (!ORGS[l.org] || !ID.test(String(l.id || "")) || !l.t) throw new Erro(400, "Link do aluno inválido.");
  await VA.carregarContexto(String(l.org), String(l.id), String(l.t)).catch(() => { throw new Erro(404, "Este link do aluno não vale mais. Peça um novo ao seu professor."); });
  const chave = l.org + ":" + l.id;
  if (!(conta.vinculoChaves || []).includes(chave)) {
    const outras = await db().collection("digitalContas").where("vinculoChaves", "array-contains", chave).get();
    if (outras.size >= MAX_CONTAS_POR_ALUNO) throw new Erro(409, "Este aluno já tem " + MAX_CONTAS_POR_ALUNO + " contas ligadas na Academia Digital. Fale com o professor.");
    conta.vinculos = (conta.vinculos || []).concat([{ org: l.org, alunoId: String(l.id), desde: agora() }]);
    conta.vinculoChaves = (conta.vinculoChaves || []).concat([chave]);
    await refConta(claims.uid).set({ vinculos: conta.vinculos, vinculoChaves: conta.vinculoChaves }, { merge: true });
  }
  return { ok: true, acesso: await acessoDe(claims, conta) };
}

async function membros() {
  const s = await db().collection("digitalContas").limit(1000).get();
  const lista = [];
  for (const d of s.docs) {
    const c = d.data(), ac = await acessoDe({ uid: d.id }, c);
    lista.push({ uid: d.id, nome: c.nome || "", email: c.email || "", criadoEm: c.criadoEm || "", acesso: ac, aulasFeitas: Object.keys(c.progresso || {}).filter((k) => c.progresso[k]).length });
  }
  lista.sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));
  return { membros: lista };
}
async function cortesia(claims, b) {
  const email = String(b.email || "").trim().toLowerCase();
  if (!EMAIL.test(email)) throw new Erro(400, "E-mail inválido.");
  const s = await db().collection("digitalContas").where("email", "==", email).limit(1).get();
  if (!s.size) throw new Erro(404, "Ninguém com este e-mail criou conta na Academia Digital ainda.");
  const ref = s.docs[0].ref;
  await ref.set({ cortesia: b.sim ? { por: claims.email || claims.uid, em: agora(), ate: /^\d{4}-\d{2}-\d{2}$/.test(String(b.ate || "")) ? b.ate : null } : null }, { merge: true });
  return { ok: true };
}

exports.handler = async function (event) {
  try {
    app();
    const claims = await quem(event);
    if (event.httpMethod === "GET") {
      const c = await lerConteudo();
      if (!claims || (event.queryStringParameters || {}).vitrine) return resposta(200, vitrine(c));
      const conta = await lerConta(claims), acesso = await acessoDe(claims, conta);
      const liberado = acesso.tipo !== "nenhum";
      if ((event.queryStringParameters || {}).catalogo) {
        if (!liberado) throw new Erro(403, "Sem acesso à Academia Digital.");
        return resposta(200, { exercicios: require("./_exercicios-digital.json") });
      }
      return resposta(200, {
        conta: { nome: conta.nome, email: conta.email }, acesso, coordenacao: ehCoordenacao(claims),
        unidades: (conta.vinculos || []).map((v) => ({ org: v.org, alunoId: v.alunoId, unidade: ORGS[v.org] || v.org })),
        conteudo: liberado ? { trilhas: publicadas(c) } : null, vitrine: liberado ? null : vitrine(c), venda: c.venda, progresso: conta.progresso || {},
      });
    }
    if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });
    let b; try { b = JSON.parse(event.body || "{}"); } catch (e) { throw new Erro(400, "Pedido inválido."); }
    if (b.acao === "criar") return resposta(200, await criarConta(b));
    if (b.acao === "interesse") {
      const email = String(b.email || "").trim().toLowerCase();
      if (!EMAIL.test(email)) throw new Erro(400, "E-mail inválido.");
      await db().collection("digitalInteresses").doc(email.replace(/[^a-z0-9@._-]/g, "_")).set({ email, nome: txt(b.nome, 80), em: agora() }, { merge: true });
      return resposta(200, { ok: true });
    }
    if (!claims) throw new Erro(401, "Entre com a sua conta.");
    if (b.acao === "salvarConteudo" || b.acao === "membros" || b.acao === "cortesia" || b.acao === "conteudoCompleto") {
      if (!ehCoordenacao(claims)) throw new Erro(403, "Só a coordenação mexe na Academia Digital.");
      if (b.acao === "conteudoCompleto") return resposta(200, await lerConteudo());
      if (b.acao === "membros") return resposta(200, await membros());
      if (b.acao === "cortesia") return resposta(200, await cortesia(claims, b));
      const limpo = limparConteudo(b);
      await db().collection("digitalConteudo").doc("academia").set({ ...limpo, atualizadoEm: agora(), atualizadoPor: claims.email || claims.uid });
      return resposta(200, { ok: true, ...limpo });
    }
    const conta = await lerConta(claims);
    if (b.acao === "vincular") return resposta(200, await vincular(claims, conta, b));
    if (b.acao === "desvincular") {
      const chave = String(b.org) + ":" + String(b.alunoId);
      await refConta(claims.uid).set({ vinculos: (conta.vinculos || []).filter((v) => v.org + ":" + v.alunoId !== chave), vinculoChaves: (conta.vinculoChaves || []).filter((k) => k !== chave) }, { merge: true });
      return resposta(200, { ok: true });
    }
    if (b.acao === "progresso") {
      if (!ID.test(String(b.aulaId || ""))) throw new Erro(400, "Aula inválida.");
      if ((await acessoDe(claims, conta)).tipo === "nenhum") throw new Erro(403, "Sem acesso à Academia Digital.");
      const p = { ...(conta.progresso || {}) }; if (b.feito) p[b.aulaId] = agora(); else delete p[b.aulaId];
      if (!claims.orgId) await refConta(claims.uid).set({ progresso: p }, { merge: true });
      return resposta(200, { ok: true, progresso: p });
    }
    throw new Erro(400, "Ação desconhecida.");
  } catch (e) {
    if (e instanceof Erro) return resposta(e.status, { erro: e.message });
    console.error("digital:", e);
    return resposta(500, { erro: "Não foi possível agora. Tente de novo." });
  }
};
module.exports.interno = { idDoYoutube, limparConteudo, ORGS };
