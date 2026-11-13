/* Financeiro (só controle) do Team Yoda e do 39 Ranch — só o dono vê.

   Cada conta do app pertence a uma academia só (claim orgId), mas o dono acompanha as duas e a soma. Por isso tudo passa
   por aqui: a function confere o login (e-mail na lista FINANCEIRO_DONOS, padrão tsukada.richard@gmail.com), lê os dados
   das duas academias com o Admin SDK e calcula o mês (_financeiro-calc.js). A tabela de preços e o controle do que foi
   recebido/pago ficam em financeiro/{org}, uma coleção que as regras do Firestore não liberam para o app — nem
   coordenador nem professor alcançam.

   Nada aqui cobra, gera link de pagamento ou fala com Eduzz/banco: só lê e soma.

   Papéis: "dono" (FINANCEIRO_DONOS) vê e edita tudo. "admin" (e-mails que o dono cadastra em financeiro/_acesso) é a pessoa da
   parte administrativa: vê só o que cobrar (mensalidades, pacotes, vencimento, forma, contato, pendências) e o que pagar aos
   professores, e só marca recebido/pago, vencimento e forma. Não vê entradas totais, despesas, imposto, resultado nem margem.

   GET  ?quem=1      → { papel: "dono" | "admin" | null }   (qualquer login; serve para o app mostrar o menu certo)
   GET  ?mes=AAAA-MM → dono: { mes, academias: [{ org, nome, config, catalogo, mes: resumo, historico }], geral, historicoGeral, acesso }
                       admin: { mes, papel: "admin", academias: [{ org, nome, cobrar, pendencias, professores, totais }] }
   POST { org, config }                                → (dono) grava a tabela de preços/controle daquela academia
   POST { acao: "marcar", org, mes, recebidos, pagos, pendencias, cobranca } → (dono ou admin) só as marcações
   POST { acao: "acesso", admins: [e-mails] }           → (dono) quem é da parte administrativa
   POST { acao: "importar", planilha, simular }         → (dono) migração da planilha (Let's Play/Airtable); simular só mostra o relatório */
const { admin, app } = require("./_firebase-admin");
const F = require("./_financeiro-calc");
const IMP = require("./_financeiro-importar");

const ACADEMIAS = [{ org: "team-yoda", nome: "Team Yoda" }, { org: "39-ranch", nome: "39 Ranch Tennis Club" }];
const CHAVES = { alunos: "mty:alunos:v2", turmas: "mty:turmas:v1", ocorrencias: "mty:ocorrencias:v1", quadras: "mty:quadras:v1", reservas: "mty:reservas:v1", torneios: "mty:torneios:v1", eventos: "mty:eventos:v1" };

class ErroPublico extends Error { constructor(status, mensagem) { super(mensagem); this.status = status; } }
function resposta(statusCode, corpo) { return { statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(corpo) }; }
function donos() { return String(process.env.FINANCEIRO_DONOS || "tsukada.richard@gmail.com").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean); }

async function login(event) {
  const cab = (event.headers || {}).authorization || (event.headers || {}).Authorization || "";
  const token = cab.startsWith("Bearer ") ? cab.slice(7) : null;
  if (!token) throw new ErroPublico(401, "Faltou o login.");
  try { return await admin.auth().verifyIdToken(token); } catch (e) { throw new ErroPublico(401, "Login inválido ou expirado."); }
}
async function exigirDono(event) {
  const claims = await login(event);
  if (!claims.email || donos().indexOf(String(claims.email).toLowerCase()) < 0) throw new ErroPublico(403, "O financeiro é só do dono.");
  return claims;
}
async function lerAcesso() {
  const d = await admin.firestore().collection("financeiro").doc("_acesso").get();
  const l = d.exists ? (d.data().admins || []) : [];
  return (Array.isArray(l) ? l : []).map((e) => String(e).trim().toLowerCase()).filter(Boolean);
}
async function papelDe(claims) {
  const email = String(claims.email || "").toLowerCase();
  if (!email) return null;
  if (donos().indexOf(email) >= 0) return "dono";
  return (await lerAcesso()).indexOf(email) >= 0 ? "admin" : null;
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
  if (sols) sols.forEach((d) => { const x = d.data(); dados.professores.push({ uid: d.id, nome: x.nome || x.email || "Sem nome", email: x.email || "" }); });
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

/* o que a parte administrativa vê: cobrar e pagar professor, sem resultado, margem, despesas e imposto */
function visaoAdmin(org, nome, dados, resumo, config) {
  const alunoPor = new Map(dados.alunos.map((a) => [a.id, a])), cob = config.cobranca || {};
  const linha = (l, onde) => {
    const a = alunoPor.get(l.alunoId) || {}, c = cob[l.alunoId] || {};
    return { chave: l.chave, alunoId: l.alunoId, nome: l.nome, onde, valor: l.valor, desconto: l.desconto || 0, recebido: !!l.recebido, venc: l.venc || null, forma: l.forma || "",
      pagador: c.pagador || a.nomeResponsavel || "", contato: a.telefoneResponsavel || a.telefone || "", obs: c.obs || "" };
  };
  const cobrar = resumo.receitas.mensalidades.turmas.flatMap((t) => t.alunos.map((l) => linha(l, t.nome)))
    .concat(resumo.receitas.pacotes.alunos.map((l) => linha(l, "Pacote individual")))
    .sort((a, b) => (a.recebido - b.recebido) || ((a.venc || 99) - (b.venc || 99)) || a.nome.localeCompare(b.nome));
  const professores = resumo.despesas.professores.lista.filter((p) => p.valor > 0 || p.aulasIndividuais + p.aulasTurma > 0)
    .map((p) => ({ chave: p.chave, nome: p.nome, forma: p.forma, aulasIndividuais: p.aulasIndividuais, aulasTurma: p.aulasTurma, valor: p.valor, pago: p.pago, configurado: p.configurado }));
  const pend = resumo.pendencias.abertas.map((p) => { const a = alunoPor.get(p.alunoId) || {}; return Object.assign({}, p, { contato: a.telefoneResponsavel || a.telefone || "" }); });
  return { org, nome, cobrar, pendencias: pend, professores,
    totais: { aReceber: resumo.controle.aReceber, recebido: resumo.controle.recebido, emAberto: resumo.controle.emAberto.length, atrasados: resumo.controle.atrasados,
      valorAtrasado: resumo.controle.valorAtrasado, pendencias: resumo.pendencias.total,
      aPagarProfessores: resumo.despesas.professores.total, pagoProfessores: Math.round(professores.filter((p) => p.pago).reduce((s, p) => s + p.valor, 0) * 100) / 100 } };
}

async function handleGetAdmin(event) {
  const q = event.queryStringParameters || {}, mes = mesValido(q.mes) ? q.mes : mesAtual();
  const academias = await Promise.all(ACADEMIAS.map(async (a) => {
    const { dados, config } = await lerAcademia(a.org);
    return visaoAdmin(a.org, a.nome, dados, F.calcularMes(dados, config, mes), config);
  }));
  return resposta(200, { mes, papel: "admin", academias });
}

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
    mes, academias, papel: "dono", acesso: { admins: await lerAcesso() },
    geral: F.somarMeses(academias.map((a) => a.mes)),
    historicoGeral: meses.map((m, i) => { const l = academias.map((a) => a.historico[i]); const e = l.reduce((s, x) => s + x.entradas, 0), sd = l.reduce((s, x) => s + x.saidas, 0); return { mes: m, entradas: Math.round(e * 100) / 100, saidas: Math.round(sd * 100) / 100, resultado: Math.round((e - sd) * 100) / 100 }; }),
  });
}

/* ── gravação: só os campos conhecidos, números de verdade, textos curtos ── */
function n(v) { const x = Number(v); return isFinite(x) && x >= 0 ? Math.round(x * 100) / 100 : 0; }
function txt(v, max) { return String(v == null ? "" : v).slice(0, max || 120); }
function id(v) { return /^[\w:.\-]{1,120}$/.test(String(v)) ? String(v) : null; }
/* chave de professor: "u:<uid>" ou "n:<nome>" (o nome pode ter espaço e acento) */
function idProfessor(v) { const s = String(v); return /^(u|n):[^\u0000-\u001f]{1,110}$/.test(s) ? s : null; }
function mapa(obj, fn, max, validar) {
  const out = {}; let k = 0;
  Object.keys(obj && typeof obj === "object" ? obj : {}).forEach((chave) => { if (k >= (max || 2000)) return; const c = (validar || id)(chave); if (!c) return; const v = fn(obj[chave]); if (v) { out[c] = v; k++; } });
  return out;
}
const FORMAS_PAGAMENTO = ["pix", "cartao", "boleto", "dinheiro", "letsplay", "outro"];
function limparCobranca(v) {
  if (!v || typeof v !== "object") return null;
  const venc = Math.round(Number(v.venc)), o = {};
  if (venc >= 1 && venc <= 31) o.venc = venc;
  if (FORMAS_PAGAMENTO.indexOf(v.forma) >= 0) o.forma = v.forma;
  if (v.pagador) o.pagador = txt(v.pagador, 80);
  if (v.obs) o.obs = txt(v.obs, 160);
  return Object.keys(o).length ? o : null;
}
function limparPendencia(p) {
  if (!p || typeof p !== "object" || !id(p.id)) return null;
  return { id: id(p.id), alunoId: id(p.alunoId) || "", nome: txt(p.nome, 90), mes: mesValido(p.mes) ? p.mes : "", valor: n(p.valor),
    venc: /^\d{4}-\d{2}-\d{2}$/.test(String(p.venc || "")) ? p.venc : "", obs: txt(p.obs, 160), quitada: p.quitada === true, quitadaEm: p.quitada === true ? txt(p.quitadaEm, 30) : "" };
}
function limpar(c) {
  c = c && typeof c === "object" ? c : {};
  return {
    turmas: mapa(c.turmas, (v) => (n(v && v.preco) ? { preco: n(v.preco) } : null)),
    descontos: mapa(c.descontos, (v) => (v && n(v.valor) ? { tipo: v.tipo === "valor" ? "valor" : "pct", valor: v.tipo === "valor" ? n(v.valor) : Math.min(100, n(v.valor)) } : null)),
    pacotes: mapa(c.pacotes, (v) => (n(v && v.preco) ? { preco: n(v.preco) } : null)),
    torneios: mapa(c.torneios, (v) => (n(v && v.inscricao) ? { inscricao: n(v.inscricao) } : null)),
    eventos: mapa(c.eventos, (v) => (n(v && v.porPessoa) ? { porPessoa: n(v.porPessoa) } : null)),
    professores: mapa(c.professores, (v) => (v ? { forma: ["aula", "fixo", "pct"].indexOf(v.forma) >= 0 ? v.forma : "aula", individual: n(v.individual), turma: n(v.turma), fixo: n(v.fixo), pct: Math.min(100, n(v.pct)) } : null), 200, idProfessor),
    cobranca: mapa(c.cobranca, limparCobranca, 3000),
    pendencias: (Array.isArray(c.pendencias) ? c.pendencias : []).slice(0, 3000).map(limparPendencia).filter(Boolean),
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

function lerCorpo(event) { try { return JSON.parse(event.body || "{}"); } catch (e) { throw new ErroPublico(400, "Corpo inválido."); } }
async function gravarConfig(org, config, email) {
  const limpa = desembrulhar(limpar(config));
  Object.keys(limpa.meses).forEach((m) => { if (!mesValido(m)) delete limpa.meses[m]; });
  await admin.firestore().collection("financeiro").doc(org).set({ config: limpa, atualizado: Date.now(), por: email });
  return limpa;
}

/* marcações (dono ou administrativo): recebido/pago só de itens que existem no mês, pendências e vencimento/forma */
async function handleMarcar(corpo, claims) {
  if (!ACADEMIAS.some((a) => a.org === corpo.org)) throw new ErroPublico(400, "Academia desconhecida.");
  const mes = mesValido(corpo.mes) ? corpo.mes : null;
  if (!mes) throw new ErroPublico(400, "Mês inválido.");
  const { dados, config } = await lerAcademia(corpo.org);
  const resumo = F.calcularMes(dados, config, mes);
  const podeReceber = new Set(resumo.receitas.mensalidades.turmas.flatMap((t) => t.alunos.map((l) => l.chave)).concat(resumo.receitas.pacotes.alunos.map((l) => l.chave)));
  const podePagar = new Set(resumo.despesas.professores.lista.map((p) => p.chave));
  const alunos = new Set(dados.alunos.map((a) => a.id));
  const c = JSON.parse(JSON.stringify(config || {}));
  c.meses = c.meses || {}; const m = c.meses[mes] = c.meses[mes] || {}; m.recebidos = m.recebidos || {}; m.pagos = m.pagos || {};
  let mudou = 0;
  Object.keys(corpo.recebidos || {}).forEach((k) => { if (!podeReceber.has(k)) return; if (corpo.recebidos[k] === true) m.recebidos[k] = true; else delete m.recebidos[k]; mudou++; });
  Object.keys(corpo.pagos || {}).forEach((k) => { if (!podePagar.has(k)) return; if (corpo.pagos[k] === true) m.pagos[k] = true; else delete m.pagos[k]; mudou++; });
  c.pendencias = Array.isArray(c.pendencias) ? c.pendencias : [];
  Object.keys(corpo.pendencias || {}).forEach((pid) => { const p = c.pendencias.find((x) => x.id === pid); if (!p) return; p.quitada = corpo.pendencias[pid] === true; p.quitadaEm = p.quitada ? new Date().toISOString().slice(0, 10) : ""; mudou++; });
  c.cobranca = c.cobranca || {};
  Object.keys(corpo.cobranca || {}).forEach((aid) => { if (!alunos.has(aid)) return; const v = limparCobranca(Object.assign({}, c.cobranca[aid] || {}, corpo.cobranca[aid] || {})); if (v) c.cobranca[aid] = v; else delete c.cobranca[aid]; mudou++; });
  if (!mudou) return resposta(200, { ok: true, mudou: 0 });
  await gravarConfig(corpo.org, c, claims.email);
  return resposta(200, { ok: true, mudou });
}

async function handleAcesso(corpo, claims) {
  const lista = (Array.isArray(corpo.admins) ? corpo.admins : []).map((e) => String(e).trim().toLowerCase())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && donos().indexOf(e) < 0).slice(0, 10);
  const unicos = Array.from(new Set(lista));
  await admin.firestore().collection("financeiro").doc("_acesso").set({ admins: unicos, atualizado: Date.now(), por: claims.email });
  return resposta(200, { ok: true, admins: unicos });
}

/* migração: lê as duas academias, planeja e (sem simular) grava alunos, turmas e config numa transação */
const CHAVES_LISTA = { alunos: "mty:alunos:v2", turmas: "mty:turmas:v1" };
function listaDe(snap) { if (!snap.exists) return []; try { const v = JSON.parse(snap.data().value || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
async function handleImportar(corpo, claims) {
  if (JSON.stringify(corpo.planilha || {}).length > 2500000) throw new ErroPublico(413, "Planilha grande demais. Mande por partes.");
  const planilha = IMP.lerPlanilha(corpo.planilha && corpo.planilha.abas ? corpo.planilha.abas : {});
  Object.assign(planilha, ...["alunos", "turmas", "cobranca", "abertos", "professores", "despesas"].filter((k) => Array.isArray((corpo.planilha || {})[k])).map((k) => ({ [k]: planilha[k].concat(corpo.planilha[k]) })));
  const inicio = process.env.FINANCEIRO_INICIO || "2026-11";
  const fs = admin.firestore();
  const profs = {};
  await Promise.all(ACADEMIAS.map(async (a) => {
    const sols = await fs.collection("orgs").doc(a.org).collection("solicitacoes").where("status", "==", "aprovada").get().catch(() => null);
    profs[a.org] = []; if (sols) sols.forEach((d) => { const x = d.data(); profs[a.org].push({ uid: d.id, nome: x.nome || x.email || "Sem nome", email: x.email || "" }); });
  }));
  const refs = {};
  ACADEMIAS.forEach((a) => { const base = fs.collection("orgs").doc(a.org).collection("dados"); refs[a.org] = { alunos: base.doc(CHAVES_LISTA.alunos), turmas: base.doc(CHAVES_LISTA.turmas), config: fs.collection("financeiro").doc(a.org) }; });
  const montar = async (ler) => {
    const estado = {};
    for (const a of ACADEMIAS) {
      const [sa, st, sc] = await Promise.all([ler(refs[a.org].alunos), ler(refs[a.org].turmas), ler(refs[a.org].config)]);
      estado[a.org] = { alunos: listaDe(sa), turmas: listaDe(st), professores: profs[a.org], config: sc.exists ? (sc.data().config || {}) : {} };
    }
    return estado;
  };
  const resumoDe = (p) => ({ relatorio: p.relatorio, avisos: p.avisos, aproximados: p.aproximados, linhas: p.linhas });
  if (corpo.simular !== false) {
    const plano = IMP.planejar(planilha, await montar((r) => r.get()), { inicio });
    return resposta(200, Object.assign({ ok: true, simulado: true }, resumoDe(plano)));
  }
  let plano = null;
  await fs.runTransaction(async (tx) => {
    plano = IMP.planejar(planilha, await montar((r) => tx.get(r)), { inicio });
    for (const a of ACADEMIAS) {
      const e = plano.estado[a.org], agora = Date.now();
      if (e.mudou.alunos) tx.set(refs[a.org].alunos, { value: JSON.stringify(e.alunos), atualizado: agora });
      if (e.mudou.turmas) tx.set(refs[a.org].turmas, { value: JSON.stringify(e.turmas), atualizado: agora });
      if (e.mudou.config) { const limpa = desembrulhar(limpar(e.config)); Object.keys(limpa.meses).forEach((m) => { if (!mesValido(m)) delete limpa.meses[m]; }); tx.set(refs[a.org].config, { config: limpa, atualizado: agora, por: claims.email, importadoEm: agora }); }
    }
  });
  return resposta(200, Object.assign({ ok: true, simulado: false }, resumoDe(plano)));
}

async function handlePost(event, claims) {
  const corpo = lerCorpo(event);
  if (corpo.acao === "acesso") return handleAcesso(corpo, claims);
  if (corpo.acao === "importar") return handleImportar(corpo, claims);
  if (!ACADEMIAS.some((a) => a.org === corpo.org)) throw new ErroPublico(400, "Academia desconhecida.");
  if (JSON.stringify(corpo.config || {}).length > 600000) throw new ErroPublico(413, "Configuração grande demais.");
  const config = await gravarConfig(corpo.org, corpo.config, claims.email);
  return resposta(200, { ok: true, config });
}

exports.handler = async function (event) {
  try {
    app();
    const q = event.queryStringParameters || {};
    if (event.httpMethod === "GET" && q.quem) { const claims = await login(event); return resposta(200, { papel: await papelDe(claims) }); }
    if (event.httpMethod !== "GET" && event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });
    const claims = await login(event), papel = await papelDe(claims);
    if (!papel) throw new ErroPublico(403, "O financeiro é só do dono.");
    if (papel === "admin") {
      if (event.httpMethod === "GET") return await handleGetAdmin(event);
      const corpo = lerCorpo(event);
      if (corpo.acao !== "marcar") throw new ErroPublico(403, "A parte administrativa só marca recebido, pago, vencimento e forma de pagamento.");
      return await handleMarcar(corpo, claims);
    }
    if (event.httpMethod === "GET") return await handleGet(event);
    const corpo = lerCorpo(event);
    if (corpo.acao === "marcar") return await handleMarcar(corpo, claims);
    return await handlePost(event, claims);
  } catch (e) {
    if (e instanceof ErroPublico) return resposta(e.status, { erro: e.message });
    return resposta(500, { erro: String(e.message || e) });
  }
};
exports._limpar = (c) => desembrulhar(limpar(c));
/* usados pela Central do dono (central.js): mesma regra de acesso e mesma leitura das academias */
exports._exigirDono = exigirDono;
exports._login = login;
exports._papelDe = papelDe; // "dono" | "admin" | null (usado pela Central: Richard e administrativo)
exports._visaoAdmin = visaoAdmin;
exports._ErroPublico = ErroPublico;
exports._lerAcademia = lerAcademia;
