/* Central do dono — agenda, tarefas, metas e indicadores, revisão semanal e notas dos quatro negócios (Team Yoda, 39 Ranch,
   QuadraLab, Alvor), num lugar só e só para o dono (mesma regra do financeiro: e-mail na lista FINANCEIRO_DONOS).

   A tela é um site à parte (pasta central/, endereço próprio), que chega aqui por /api/central (proxy no netlify.toml de lá).
   Os dados ficam em central/dono, fora do alcance do app. Os números automáticos vêm de onde já existem:
   · Team Yoda e 39 Ranch: o mesmo cálculo do financeiro (entradas, saídas, resultado, em aberto), mais jogadores, turmas e
     aulas (de hoje e em aberto), lidos com o Admin SDK;
   · QuadraLab: o resumo do painel do administrador (admin-painel?secao=resumo), só quando QUADRALAB_ADMIN_SECRET estiver
     configurada aqui (o mesmo ADMIN_SECRET do site do QuadraLab); sem ela, o dono digita os indicadores do mês;
   · Alvor: indicadores digitados pelo dono.
   Nada aqui cobra, envia mensagem ou muda dados dos negócios: só lê e guarda o que é do dono.

   GET  → { dados, auto: { "team-yoda", "39-ranch", quadralab } }
   POST { dados } → grava (só campos conhecidos, textos curtos, listas com limite) */
const { admin, app } = require("./_firebase-admin");
const FIN = require("./financeiro");
const F = require("./_financeiro-calc");

const NEGOCIOS = ["team-yoda", "39-ranch", "quadralab", "alvor", "geral"];
function resposta(statusCode, corpo) { return { statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(corpo) }; }
function agoraBR() { return new Date(Date.now() - 3 * 3600000); }
function hojeBR() { return agoraBR().toISOString().slice(0, 10); }

async function numerosAcademia(org) {
  const { dados, config } = await FIN._lerAcademia(org);
  let ocorrencias = [];
  try { const s = await admin.firestore().collection("orgs").doc(org).collection("dados").doc("mty:ocorrencias:v1").get(); if (s.exists) ocorrencias = JSON.parse(s.data().value || "[]"); } catch (e) { ocorrencias = []; }
  const hoje = hojeBR(), mes = hoje.slice(0, 7), r = F.calcularMes(dados, config, mes);
  const pedidos = dados.alunos.reduce((n, a) => n + (a.pedidosReposicao || []).filter((p) => p.status === "pendente").length, 0);
  const reservasNovas = dados.reservas.filter((x) => x.origem === "cliente" && !x.vistoPeloStaff).length;
  return {
    mes, entradas: r.entradas, saidas: r.saidas, resultado: r.resultado, recebido: r.controle.recebido, aReceber: r.controle.aReceber,
    emAbertoMensalidades: r.controle.emAberto.length, jogadores: dados.alunos.length, turmas: dados.turmas.length,
    aulasHoje: (Array.isArray(ocorrencias) ? ocorrencias : []).filter((o) => o.data === hoje && o.status !== "cancelada").length,
    aulasEmAberto: (Array.isArray(ocorrencias) ? ocorrencias : []).filter((o) => o.status === "agendada" && o.data < hoje).length,
    pedidosReposicao: pedidos, reservasNovas, semPreco: r.receitas.mensalidades.semPreco.length > 0,
  };
}

async function numerosQuadraLab() {
  const segredo = process.env.QUADRALAB_ADMIN_SECRET;
  if (!segredo) return { configurado: false };
  const url = (process.env.QUADRALAB_URL || "https://quadralab.com.br") + "/.netlify/functions/admin-painel?secao=resumo";
  try {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 9000);
    const r = await fetch(url, { headers: { "x-admin-secret": segredo }, signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) return { configurado: true, erro: "O painel do QuadraLab respondeu " + r.status + "." };
    const d = await r.json(), pl = d.player || {}, fin = d.financeiro || {};
    return {
      configurado: true, contas: pl.contas || 0, novas30: pl.novas30 || 0, assinaturasAtivas: pl.assinaturasAtivas || 0, venceEm7: pl.venceEm7 || 0,
      confirmado: Math.round((fin.confirmadoCentavos || 0)) / 100, aReceber: Math.round((fin.aReceberCentavos || 0)) / 100,
      precisaDeVoce: (Array.isArray(d.precisaDeVoce) ? d.precisaDeVoce : []).slice(0, 12).map((p) => ({ nivel: p.nivel === "alto" ? "alto" : "medio", titulo: String(p.titulo || "").slice(0, 140), n: Number(p.n) || 0 })),
    };
  } catch (e) { return { configurado: true, erro: "Não consegui ler o painel do QuadraLab agora." }; }
}

async function handleGet() {
  const [doc, ty, rc, ql] = await Promise.all([
    admin.firestore().collection("central").doc("dono").get(),
    numerosAcademia("team-yoda").catch((e) => ({ erro: String(e.message || e) })),
    numerosAcademia("39-ranch").catch((e) => ({ erro: String(e.message || e) })),
    numerosQuadraLab(),
  ]);
  return resposta(200, { hoje: hojeBR(), dados: doc.exists ? (doc.data().dados || vazio()) : vazio(), auto: { "team-yoda": ty, "39-ranch": rc, quadralab: ql } });
}

/* ── gravação: só a estrutura conhecida ── */
function vazio() { return { agenda: [], tarefas: [], negocios: {}, revisoes: {}, notas: [] }; }
const txt = (v, max) => String(v == null ? "" : v).slice(0, max || 200);
const num = (v) => { if (v === "" || v == null) return null; const x = Number(v); return isFinite(x) ? Math.round(x * 100) / 100 : null; };
const idOk = (v, pref) => (/^[\w.\-]{1,60}$/.test(String(v || "")) ? String(v) : pref + Math.random().toString(36).slice(2, 10));
const data = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : "");
const hora = (v) => (/^\d{2}:\d{2}$/.test(String(v || "")) ? String(v) : "");
const neg = (v) => (NEGOCIOS.indexOf(v) >= 0 ? v : "geral");
const mesOk = (m) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
const semanaOk = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
function limpar(d) {
  d = d && typeof d === "object" ? d : {};
  const lista = (l, max) => (Array.isArray(l) ? l.slice(0, max) : []);
  const out = vazio();
  out.agenda = lista(d.agenda, 1500).map((x) => ({ id: idOk(x && x.id, "ag"), titulo: txt(x && x.titulo, 120), data: data(x && x.data), inicio: hora(x && x.inicio), fim: hora(x && x.fim),
    negocio: neg(x && x.negocio), local: txt(x && x.local, 120), nota: txt(x && x.nota, 500), semanal: !!(x && x.semanal) })).filter((x) => x.titulo && x.data);
  out.tarefas = lista(d.tarefas, 2000).map((x) => ({ id: idOk(x && x.id, "ta"), titulo: txt(x && x.titulo, 160), negocio: neg(x && x.negocio), prazo: data(x && x.prazo),
    prioridade: ["alta", "media", "baixa"].indexOf(x && x.prioridade) >= 0 ? x.prioridade : "media", feita: !!(x && x.feita), feitaEm: data(x && x.feitaEm), nota: txt(x && x.nota, 500), criadaEm: data(x && x.criadaEm) })).filter((x) => x.titulo);
  NEGOCIOS.forEach((n) => {
    const v = (d.negocios || {})[n]; if (!v || typeof v !== "object") return;
    const metas = {}, indicadores = {};
    Object.keys(v.metas || {}).slice(0, 36).forEach((m) => { if (!mesOk(m)) return; const x = v.metas[m] || {}; metas[m] = { receita: num(x.receita), clientes: num(x.clientes), novos: num(x.novos) }; });
    Object.keys(v.indicadores || {}).slice(0, 36).forEach((m) => { if (!mesOk(m)) return; const x = v.indicadores[m] || {}; indicadores[m] = { receita: num(x.receita), clientes: num(x.clientes), novos: num(x.novos), nota: txt(x.nota, 300) }; });
    out.negocios[n] = { metas, indicadores, links: lista(v.links, 12).map((l) => ({ rotulo: txt(l && l.rotulo, 60), url: /^https:\/\/[^\s"<>]{3,300}$/.test(String(l && l.url || "")) ? String(l.url) : "" })).filter((l) => l.rotulo && l.url), notas: txt(v.notas, 3000) };
  });
  Object.keys(d.revisoes || {}).slice(-104).forEach((s) => {
    if (!semanaOk(s)) return; const x = d.revisoes[s] || {};
    out.revisoes[s] = { bem: txt(x.bem, 1500), travou: txt(x.travou, 1500), decisoes: txt(x.decisoes, 1500), prioridades: lista(x.prioridades, 5).map((p) => txt(p, 160)), feitaEm: data(x.feitaEm) };
  });
  out.notas = lista(d.notas, 1000).map((x) => ({ id: idOk(x && x.id, "no"), data: data(x && x.data), negocio: neg(x && x.negocio), texto: txt(x && x.texto, 2000), decisao: !!(x && x.decisao) })).filter((x) => x.texto);
  return out;
}

async function handlePost(event, claims) {
  let corpo; try { corpo = JSON.parse(event.body || "{}"); } catch (e) { throw new FIN._ErroPublico(400, "Corpo inválido."); }
  if (JSON.stringify(corpo.dados || {}).length > 800000) throw new FIN._ErroPublico(413, "Dados grandes demais.");
  const dados = limpar(corpo.dados);
  await admin.firestore().collection("central").doc("dono").set({ dados, atualizado: Date.now(), por: claims.email });
  return resposta(200, { ok: true, dados });
}

exports.handler = async function (event) {
  try {
    app();
    const claims = await FIN._exigirDono(event);
    if (event.httpMethod === "GET") return await handleGet();
    if (event.httpMethod === "POST") return await handlePost(event, claims);
    return resposta(405, { erro: "Método não permitido." });
  } catch (e) {
    if (e instanceof FIN._ErroPublico) return resposta(e.status, { erro: e.message });
    return resposta(500, { erro: String(e.message || e) });
  }
};
exports._limpar = limpar;
