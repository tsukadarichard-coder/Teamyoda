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
const CATEGORIAS = ["tecnica", "tatica", "mental", "geral"];
/* quiz de uma aula: até 5 perguntas de 2 a 5 opções; c = índice da certa (fica só no servidor) */
function limparQuiz(q, titulo) {
  return (Array.isArray(q) ? q : []).slice(0, 5).map((x) => {
    const op = (Array.isArray(x && x.op) ? x.op : []).map((o) => txt(o, 220)).filter(Boolean).slice(0, 5);
    const c = x && Number.isInteger(x.c) ? x.c : -1;
    if (!txt(x && x.p, 300) || op.length < 2) throw new Erro(400, "Pergunta incompleta no quiz da aula “" + txt(titulo, 60) + "” (precisa do texto e de pelo menos 2 opções).");
    if (!(c >= 0 && c < op.length)) throw new Erro(400, "Marque a resposta certa em todas as perguntas do quiz da aula “" + txt(titulo, 60) + "”.");
    return { p: txt(x.p, 300), op, c: Math.floor(c) };
  });
}
/* ilustrações das aulas: só os arquivos do próprio site (mty/assets/cursos) */
const IMAGEM = /^assets\/cursos\/[a-z0-9-]+\.svg$/;
function limparConteudo(b) {
  const trilhas = (Array.isArray(b.trilhas) ? b.trilhas : []).slice(0, MAX_TRILHAS).map((t, i) => {
    const id = ID.test(String(t.id || "")) ? String(t.id) : "tr" + Date.now().toString(36) + i;
    const aulas = (Array.isArray(t.aulas) ? t.aulas : []).slice(0, MAX_AULAS).map((a, j) => {
      const yt = idDoYoutube(a.youtube);
      if (a.youtube && !yt) throw new Erro(400, "Link do YouTube inválido na aula “" + txt(a.titulo, 60) + "”.");
      return {
        id: ID.test(String(a.id || "")) ? String(a.id) : id + "-a" + Date.now().toString(36) + j,
        titulo: txt(a.titulo, 120) || "Aula " + (j + 1), descricao: txtLongo(a.descricao, 6000), youtube: yt, quiz: limparQuiz(a.quiz, a.titulo),
        exercicios: (Array.isArray(a.exercicios) ? a.exercicios : []).map((c) => String(c).toUpperCase()).filter((c) => /^[A-Z]{2,4}\d{3}$/.test(c)).slice(0, 12),
        duracao: txt(a.duracao, 20),
        imagens: (Array.isArray(a.imagens) ? a.imagens : []).map(String).filter((x) => IMAGEM.test(x)).slice(0, 3),
      };
    });
    return { id, titulo: txt(t.titulo, 120) || "Curso " + (i + 1), descricao: txtLongo(t.descricao, 1500), nivel: NIVEIS.includes(t.nivel) ? t.nivel : "todos", categoria: CATEGORIAS.includes(t.categoria) ? t.categoria : "geral", publicada: !!t.publicada, aulas };
  });
  const v = b.venda || {};
  const checkoutUrl = txt(v.checkoutUrl, 400);
  if (checkoutUrl && !/^https:\/\/[^\s]+$/.test(checkoutUrl)) throw new Erro(400, "O link de pagamento precisa começar com https://");
  return { trilhas, venda: { preco: txt(v.preco, 40), checkoutUrl, observacao: txtLongo(v.observacao, 600) } };
}
/* Os cursos da Metodologia MTY (_cursos-mty.js) entram uma vez, já publicados, e a marca cursosMty impede que voltem
   depois de a coordenação apagar um deles; trocar a VERSAO insere só os cursos novos (pelo id) e completa as ilustrações
   das aulas MTY que ainda não têm nenhuma. */
const CMTY = require("./_cursos-mty.js");
async function lerConteudo() {
  const ref = db().collection("digitalConteudo").doc("academia");
  const s = await ref.get();
  const d = s.exists ? s.data() : {};
  let trilhas = d.trilhas || [], cursosMty = d.cursosMty || null, inseridos = d.cursosMtyInseridos || [];
  const venda = d.venda || { preco: "", checkoutUrl: "", observacao: "" };
  if (cursosMty !== CMTY.VERSAO && process.env.DIGITAL_SEM_CURSOS_MTY !== "1") {
    const ids = new Set(trilhas.map((t) => t.id)), feitos = new Set(inseridos);
    const novos = CMTY.CURSOS.filter((c) => !ids.has(c.id) && !feitos.has(c.id));
    /* aulas MTY já inseridas e ainda sem ilustração ganham as da versão nova; o que a coordenação editou fica */
    const comImagens = trilhas.map((t) => ({ ...t, aulas: (t.aulas || []).map((a) => (CMTY.IMAGENS[a.id] && !(a.imagens || []).length ? { ...a, imagens: CMTY.IMAGENS[a.id] } : a)) }));
    trilhas = limparConteudo({ trilhas: comImagens.concat(novos), venda }).trilhas;
    cursosMty = CMTY.VERSAO; inseridos = inseridos.concat(novos.map((c) => c.id));
    await ref.set({ ...d, trilhas, venda, cursosMty, cursosMtyInseridos: inseridos, atualizadoEm: agora() });
  }
  return { trilhas, venda, cursosMty, cursosMtyInseridos: inseridos };
}
/* o que um visitante vê: nome e tamanho das trilhas publicadas, nunca o vídeo nem os treinos */
function vitrine(c) {
  return { trilhas: c.trilhas.filter((t) => t.publicada).map((t) => ({ id: t.id, titulo: t.titulo, descricao: t.descricao, nivel: t.nivel, categoria: t.categoria || "geral", aulas: t.aulas.length, comVideo: t.aulas.filter((a) => a.youtube).length })), venda: c.venda };
}
/* para o aluno: só os cursos publicados, e o quiz sem a resposta certa (ela é conferida aqui no servidor) */
const publicadas = (c) => c.trilhas.filter((t) => t.publicada).map((t) => ({ ...t, aulas: t.aulas.map((a) => ({ ...a, quiz: (a.quiz || []).map((q) => ({ p: q.p, op: q.op })) })) }));
function aulaPublicada(c, aulaId) { for (const t of c.trilhas) if (t.publicada) for (const a of t.aulas) if (a.id === aulaId) return a; return null; }

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
    if (al) return { tipo: "unidade", unidade: ORGS[v.org] || v.org, aluno: String(al.nome || "").split(/\s+/)[0], org: v.org, alunoId: v.alunoId };
  }
  const hoje = agora().slice(0, 10), a = conta && conta.assinatura;
  if (a && a.status === "ativa" && (!a.ate || a.ate >= hoje)) return { tipo: "assinante", ate: a.ate || null };
  const c = conta && conta.cortesia;
  if (c && (!c.ate || c.ate >= hoje)) return { tipo: "cortesia", ate: c.ate || null };
  return { tipo: "nenhum" };
}
/* aluno da unidade: o resumo do plano presencial (o mesmo do link do aluno, só os números) para o painel da Academia Digital */
async function resumoPresencial(ac) {
  try {
    const ctx = await VA.carregarContexto(ac.org, ac.alunoId, null, true);
    const r = await VA.responderGet(ac.org, ac.alunoId, {}, ctx);
    const d = JSON.parse(r.body || "{}");
    return {
      temPlano: !!d.temPlano, tipoPlano: d.tipoPlano || "", totalAulas: d.totalAulas || 0, aulasFeitas: d.aulasFeitas || 0,
      proximaAula: d.proximaAula || null, agora: d.aulaEmVigor ? d.aulaEmVigor.titulo || "" : "", turma: d.planoDaTurma ? d.planoDaTurma.nome : null,
    };
  } catch (e) { return null; }
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
      const qsp = event.queryStringParameters || {};
      if (qsp.movRel || qsp.movClip) {
        if (!liberado) throw new Erro(403, "Sem acesso à Academia Digital.");
        const id = String(qsp.movRel || qsp.movClip);
        if (!ID.test(id)) throw new Erro(400, "Análise inválida.");
        const d = await db().collection(qsp.movRel ? "digitalMovRel" : "digitalMovClip").doc(claims.uid + "_" + id).get();
        if (!d.exists) throw new Erro(404, "Não encontrei esta análise.");
        return resposta(200, qsp.movRel ? { relatorio: d.data().v } : { clip: d.data().v });
      }
      if ((event.queryStringParameters || {}).catalogo) {
        if (!liberado) throw new Erro(403, "Sem acesso à Academia Digital.");
        return resposta(200, { exercicios: require("./_exercicios-digital.json") });
      }
      return resposta(200, {
        conta: { nome: conta.nome, email: conta.email }, acesso, coordenacao: ehCoordenacao(claims),
        unidades: (conta.vinculos || []).map((v) => ({ org: v.org, alunoId: v.alunoId, unidade: ORGS[v.org] || v.org })),
        conteudo: liberado ? { trilhas: publicadas(c) } : null, vitrine: liberado ? null : vitrine(c), venda: c.venda, progresso: conta.progresso || {},
        quiz: conta.quiz || {},
        sessoes: (conta.sessoes || []).slice(-60),
        movimentos: conta.movimentos || [],
        presencial: acesso.tipo === "unidade" ? await resumoPresencial(acesso) : null,
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
      if (b.acao === "conteudoCompleto") { const c = await lerConteudo(); return resposta(200, { trilhas: c.trilhas, venda: c.venda }); }
      if (b.acao === "membros") return resposta(200, await membros());
      if (b.acao === "cortesia") return resposta(200, await cortesia(claims, b));
      const limpo = limparConteudo(b), atual = await lerConteudo();
      await db().collection("digitalConteudo").doc("academia").set({ ...limpo, cursosMty: atual.cursosMty, cursosMtyInseridos: atual.cursosMtyInseridos, atualizadoEm: agora(), atualizadoPor: claims.email || claims.uid });
      return resposta(200, { ok: true, ...limpo });
    }
    const conta = await lerConta(claims);
    if (b.acao === "vincular") return resposta(200, await vincular(claims, conta, b));
    if (b.acao === "desvincular") {
      const chave = String(b.org) + ":" + String(b.alunoId);
      await refConta(claims.uid).set({ vinculos: (conta.vinculos || []).filter((v) => v.org + ":" + v.alunoId !== chave), vinculoChaves: (conta.vinculoChaves || []).filter((k) => k !== chave) }, { merge: true });
      return resposta(200, { ok: true });
    }
    if (/^mov(Salvar|Relatorio|Clip|Remover)$/.test(String(b.acao))) {
      /* análise de movimento (a mesma do QuadraLab Player): roda no aparelho; aqui ficam só o resumo (histórico e evolução),
         o relatório completo e o trecho do golpe, na conta de quem analisou. A equipe pode testar, mas nada é guardado. */
      if ((await acessoDe(claims, conta)).tipo === "nenhum") throw new Erro(403, "Sem acesso à Academia Digital.");
      if (b.acao === "movSalvar") {
        const r = b.resumo || {}, tam = JSON.stringify(r).length;
        if (!ID.test(String(r.id || "")) || tam > 40000) throw new Erro(400, "Análise inválida.");
        const movimentos = (conta.movimentos || []).filter((m) => m.id !== r.id).concat([r]).slice(-40);
        if (!claims.orgId) await refConta(claims.uid).set({ movimentos }, { merge: true });
        return resposta(200, { ok: true, movimentos });
      }
      const id = String(b.id || "");
      if (!ID.test(id)) throw new Erro(400, "Análise inválida.");
      if (b.acao === "movRemover") {
        const movimentos = (conta.movimentos || []).filter((m) => m.id !== id);
        if (!claims.orgId) {
          await refConta(claims.uid).set({ movimentos }, { merge: true });
          for (const col of ["digitalMovRel", "digitalMovClip"]) { const ref = db().collection(col).doc(claims.uid + "_" + id); if (ref.delete) await ref.delete(); }
        }
        return resposta(200, { ok: true, movimentos });
      }
      const v = String(b.acao === "movRelatorio" ? b.relatorio || "" : b.clip || "");
      if (!v || v.length > 900000) throw new Erro(400, "Relatório grande demais para guardar.");
      if (!(conta.movimentos || []).some((m) => m.id === id)) throw new Erro(404, "Salve a análise antes do relatório.");
      if (!claims.orgId) await db().collection(b.acao === "movRelatorio" ? "digitalMovRel" : "digitalMovClip").doc(claims.uid + "_" + id).set({ v, em: agora() });
      return resposta(200, { ok: true });
    }
    if (b.acao === "sessao") {
      /* treino guiado feito pelo aluno: minutos, exercícios e acertos (para o painel; nada além disso) */
      if (!ID.test(String(b.sessaoId || ""))) throw new Erro(400, "Sessão inválida.");
      if ((await acessoDe(claims, conta)).tipo === "nenhum") throw new Erro(403, "Sem acesso à Academia Digital.");
      const minutos = Math.round(Number(b.minutos));
      if (!(minutos >= 1 && minutos <= 240)) throw new Erro(400, "Duração inválida.");
      const itens = (Array.isArray(b.itens) ? b.itens : []).slice(0, 8).map((x) => {
        const c = String((x && x.c) || "").toUpperCase(), t = txt(x && x.t, 80), ac = Number(x && x.acertos), te = Number(x && x.tentativas);
        if (c ? !/^[A-Z]{2,4}\d{3}$/.test(c) : !t) throw new Erro(400, "Exercício inválido.");
        const it = c ? { c, feito: !!(x && x.feito) } : { t, feito: !!(x && x.feito) };
        if (te >= 1 && te <= 200 && ac >= 0 && ac <= te) { it.acertos = Math.round(ac); it.tentativas = Math.round(te); }
        return it;
      });
      const reg = { id: String(b.sessaoId), titulo: txt(b.titulo, 80), minutos, itens, em: agora() };
      if (ID.test(String(b.analiseId || ""))) reg.analiseId = String(b.analiseId);
      const sessoes = ((conta.sessoes || []).concat([reg])).slice(-100);
      if (!claims.orgId) await refConta(claims.uid).set({ sessoes }, { merge: true });
      return resposta(200, { ok: true, sessoes });
    }
    if (b.acao === "quiz") {
      if (!ID.test(String(b.aulaId || ""))) throw new Erro(400, "Aula inválida.");
      if ((await acessoDe(claims, conta)).tipo === "nenhum") throw new Erro(403, "Sem acesso à Academia Digital.");
      const aula = aulaPublicada(await lerConteudo(), String(b.aulaId));
      if (!aula || !(aula.quiz || []).length) throw new Erro(404, "Esta aula não tem quiz.");
      const resp = Array.isArray(b.respostas) ? b.respostas : [];
      const certas = aula.quiz.map((q, i) => Number(resp[i]) === q.c);
      const r = { acertos: certas.filter(Boolean).length, total: aula.quiz.length, em: agora() };
      const quiz = { ...(conta.quiz || {}) };
      if (!quiz[aula.id] || r.acertos >= quiz[aula.id].acertos) quiz[aula.id] = r;
      if (!claims.orgId) await refConta(claims.uid).set({ quiz }, { merge: true });
      return resposta(200, { ok: true, certas, ...r, quiz });
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
