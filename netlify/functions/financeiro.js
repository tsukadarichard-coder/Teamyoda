/* Financeiro (só controle) do Team Yoda e do 39 Ranch — só o dono vê.

   Cada conta do app pertence a uma academia só (claim orgId), mas o dono acompanha as duas e a soma. Por isso tudo passa
   por aqui: a function confere o login (e-mail na lista FINANCEIRO_DONOS, padrão tsukada.richard@gmail.com), lê os dados
   das duas academias com o Admin SDK e calcula o mês (_financeiro-calc.js). A tabela de preços e o controle do que foi
   recebido/pago ficam em financeiro/{org}, uma coleção que as regras do Firestore não liberam para o app — nem
   coordenador nem professor alcançam.

   Nada aqui cobra, gera link de pagamento ou fala com Eduzz/banco: só lê e soma.

   GET  ?mes=AAAA-MM → { mes, academias: [{ org, nome, config, catalogo, mes: resumo, historico }], geral, historicoGeral }
   POST { org, config } → grava a tabela de preços/controle daquela academia */
const { admin, app } = require("./_firebase-admin");
const F = require("./_financeiro-calc");

const ACADEMIAS = [{ org: "team-yoda", nome: "Team Yoda" }, { org: "39-ranch", nome: "39 Ranch Tennis Club" }];
const CHAVES = { alunos: "mty:alunos:v2", turmas: "mty:turmas:v1", quadras: "mty:quadras:v1", reservas: "mty:reservas:v1", torneios: "mty:torneios:v1", eventos: "mty:eventos:v1" };

class ErroPublico extends Error { constructor(status, mensagem) { super(mensagem); this.status = status; } }
function resposta(statusCode, corpo) { return { statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(corpo) }; }
function donos() { return String(process.env.FINANCEIRO_DONOS || "tsukada.richard@gmail.com").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean); }

async function exigirDono(event) {
  const cab = event.headers.authorization || event.headers.Authorization || "";
  const token = cab.startsWith("Bearer ") ? cab.slice(7) : null;
  if (!token) throw new ErroPublico(401, "Faltou o login.");
  let claims;
  try { claims = await admin.auth().verifyIdToken(token); } catch (e) { throw new ErroPublico(401, "Login inválido ou expirado."); }
  if (!claims.email || donos().indexOf(String(claims.email).toLowerCase()) < 0) throw new ErroPublico(403, "O financeiro é só do dono.");
  return claims;
}

function mesValido(m) { return typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m); }
function mesAtual() { return new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 7); } // horário de Brasília

async function lerAcademia(org) {
  const fs = admin.firestore(), base = fs.collection("orgs").doc(org).collection("dados");
  const nomes = Object.keys(CHAVES);
  const [snaps, sols, cfg] = await Promise.all([
    Promise.all(nomes.map((k) => base.doc(CHAVES[k]).get())),
    fs.collection("orgs").doc(org).collection("solicitacoes").where("status", "==", "aprovada").get().catch(() => null),
    fs.collection("financeiro").doc(org).get(),
  ]);
  const dados = {};
  nomes.forEach((k, i) => { let v = []; if (snaps[i].exists) { try { v = JSON.parse(snaps[i].data().value || "[]"); } catch (e) { v = []; } } dados[k] = Array.isArray(v) ? v : []; });
  dados.professores = [];
  if (sols) sols.forEach((d) => { const x = d.data(); dados.professores.push({ uid: d.id, nome: x.nome || x.email || "Sem nome" }); });
  return { dados, config: cfg.exists ? (cfg.data().config || {}) : {} };
}

/* o que o dono precisa ver para precificar (nomes, não os cadastros inteiros) */
function catalogo(dados, resumo) {
  const nomeTurmas = new Map();
  dados.turmas.forEach((t) => (t.membros || []).forEach((id) => { const l = nomeTurmas.get(id) || []; l.push(t.nome || "Turma"); nomeTurmas.set(id, l); }));
  const comIndividual = new Set();
  dados.alunos.forEach((a) => { if ((a.registros || []).some((r) => r && r.tipo === "sessao" && !r.turma)) comIndividual.add(a.id); });
  return {
    turmas: dados.turmas.map((t) => ({ id: t.id, nome: t.nome || "Turma", alunos: (t.membros || []).length, professorNome: t.professorNome || "", membros: (t.membros || []).map((id) => { const a = dados.alunos.find((x) => x.id === id); return a ? { id, nome: a.nome || "Sem nome" } : null; }).filter(Boolean) })),
    alunos: dados.alunos.map((a) => ({ id: a.id, nome: a.nome || "Sem nome", turmas: nomeTurmas.get(a.id) || [], professorNome: a.professorNome || "", aulasIndividuais: comIndividual.has(a.id) }))
      .sort((x, y) => x.nome.localeCompare(y.nome)),
    torneios: dados.torneios.map((t) => ({ id: t.id, nome: t.nome || "Torneio", data: t.dataInicio || "" })),
    eventos: dados.eventos.map((e) => ({ id: e.id, nome: e.nome || "Evento", data: e.data || "" })),
    professores: resumo.despesas.professores.lista.map((p) => ({ chave: p.professor, nome: p.nome })),
    quadras: dados.quadras.map((q) => ({ id: q.id, nome: q.nome || "Quadra", temPreco: (q.faixasPreco || []).some((f) => f.preco !== "" && f.preco != null) })),
  };
}

function totais(r) { return { mes: r.mes, entradas: r.entradas, saidas: r.saidas, resultado: r.resultado, margem: r.margem }; }

async function handleGet(event) {
  const q = event.queryStringParameters || {}, mes = mesValido(q.mes) ? q.mes : mesAtual();
  /* o acompanhamento começa em FINANCEIRO_INICIO (novembro de 2026): antes disso não há o que comparar */
  const inicio = process.env.FINANCEIRO_INICIO || "2026-11";
  const meses = F.mesesAte(mes, 6).filter((m) => m >= inicio);
  if (!meses.length) meses.push(mes);
  const academias = await Promise.all(ACADEMIAS.map(async (a) => {
    const { dados, config } = await lerAcademia(a.org);
    const resumo = F.calcularMes(dados, config, mes);
    return { org: a.org, nome: a.nome, config, catalogo: catalogo(dados, resumo), mes: resumo, historico: meses.map((m) => totais(m === mes ? resumo : F.calcularMes(dados, config, m))) };
  }));
  return resposta(200, {
    mes, academias,
    geral: F.somarMeses(academias.map((a) => a.mes)),
    historicoGeral: meses.map((m, i) => { const l = academias.map((a) => a.historico[i]); const e = l.reduce((s, x) => s + x.entradas, 0), sd = l.reduce((s, x) => s + x.saidas, 0); return { mes: m, entradas: Math.round(e * 100) / 100, saidas: Math.round(sd * 100) / 100, resultado: Math.round((e - sd) * 100) / 100 }; }),
  });
}

/* ── gravação: só os campos conhecidos, números de verdade, textos curtos ── */
function n(v) { const x = Number(v); return isFinite(x) && x >= 0 ? Math.round(x * 100) / 100 : 0; }
function txt(v, max) { return String(v == null ? "" : v).slice(0, max || 120); }
function id(v) { return /^[\w:.\-]{1,120}$/.test(String(v)) ? String(v) : null; }
function mapa(obj, fn, max) {
  const out = {}; let k = 0;
  Object.keys(obj && typeof obj === "object" ? obj : {}).forEach((chave) => { if (k >= (max || 2000)) return; const c = id(chave); if (!c) return; const v = fn(obj[chave]); if (v) { out[c] = v; k++; } });
  return out;
}
function limpar(c) {
  c = c && typeof c === "object" ? c : {};
  return {
    turmas: mapa(c.turmas, (v) => (n(v && v.preco) ? { preco: n(v.preco) } : null)),
    descontos: mapa(c.descontos, (v) => (v && n(v.valor) ? { tipo: v.tipo === "valor" ? "valor" : "pct", valor: v.tipo === "valor" ? n(v.valor) : Math.min(100, n(v.valor)) } : null)),
    pacotes: mapa(c.pacotes, (v) => (n(v && v.preco) ? { preco: n(v.preco) } : null)),
    torneios: mapa(c.torneios, (v) => (n(v && v.inscricao) ? { inscricao: n(v.inscricao) } : null)),
    eventos: mapa(c.eventos, (v) => (n(v && v.porPessoa) ? { porPessoa: n(v.porPessoa) } : null)),
    professores: mapa(c.professores, (v) => (v ? { forma: ["aula", "fixo", "pct"].indexOf(v.forma) >= 0 ? v.forma : "aula", individual: n(v.individual), turma: n(v.turma), fixo: n(v.fixo), pct: Math.min(100, n(v.pct)) } : null), 200),
    despesas: (Array.isArray(c.despesas) ? c.despesas : []).slice(0, 100).map((d) => ({ id: id(d && d.id) || "d" + Math.random().toString(36).slice(2, 9), nome: txt(d && d.nome, 80), categoria: ["aluguel", "manutencao", "materiais", "outros"].indexOf(d && d.categoria) >= 0 ? d.categoria : "outros", valor: n(d && d.valor) })),
    impostoPct: Math.min(100, n(c.impostoPct)),
    inicio: mesValido(c.inicio) ? c.inicio : "",
    meses: mapa(c.meses, (m) => (m && typeof m === "object" ? {
      recebidos: mapa(m.recebidos, (v) => (v === true ? true : null)),
      pagos: mapa(m.pagos, (v) => (v === true ? true : null)),
      valores: mapa(m.valores, (v) => (v === "" || v == null ? null : { v: n(v) }), 100),
      manuais: (Array.isArray(m.manuais) ? m.manuais : []).slice(0, 200).map((x) => ({ id: id(x && x.id) || "x" + Math.random().toString(36).slice(2, 9), tipo: x && x.tipo === "saida" ? "saida" : "entrada", descricao: txt(x && x.descricao, 120), valor: n(x && x.valor) })),
    } : null), 120),
  };
}
/* "valores" passa por um objeto só para o filtro do mapa aceitar o zero; volta a número aqui */
function desembrulhar(c) { Object.keys(c.meses).forEach((m) => { const v = c.meses[m].valores; Object.keys(v).forEach((k) => { v[k] = v[k].v; }); }); return c; }

async function handlePost(event, claims) {
  let corpo; try { corpo = JSON.parse(event.body || "{}"); } catch (e) { throw new ErroPublico(400, "Corpo inválido."); }
  if (!ACADEMIAS.some((a) => a.org === corpo.org)) throw new ErroPublico(400, "Academia desconhecida.");
  if (JSON.stringify(corpo.config || {}).length > 600000) throw new ErroPublico(413, "Configuração grande demais.");
  const config = desembrulhar(limpar(corpo.config));
  Object.keys(config.meses).forEach((m) => { if (!mesValido(m)) delete config.meses[m]; });
  await admin.firestore().collection("financeiro").doc(corpo.org).set({ config, atualizado: Date.now(), por: claims.email });
  return resposta(200, { ok: true, config });
}

exports.handler = async function (event) {
  try {
    app();
    const claims = await exigirDono(event);
    if (event.httpMethod === "GET") return await handleGet(event);
    if (event.httpMethod === "POST") return await handlePost(event, claims);
    return resposta(405, { erro: "Método não permitido." });
  } catch (e) {
    if (e instanceof ErroPublico) return resposta(e.status, { erro: e.message });
    return resposta(500, { erro: String(e.message || e) });
  }
};
exports._limpar = (c) => desembrulhar(limpar(c));
/* usados pela Central do dono (central.js): mesma regra de acesso e mesma leitura das academias */
exports._exigirDono = exigirDono;
exports._ErroPublico = ErroPublico;
exports._lerAcademia = lerAcademia;
