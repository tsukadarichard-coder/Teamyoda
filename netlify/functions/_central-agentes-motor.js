/* Central Tsukada — motor dos agentes (usado por central.js, central-agentes.js e central-agentes-background.js).
   · lerFontes: lê o Team Yoda (alunos, turmas, aulas) e monta o painel do Padrão de Atendimento, faltas, marcos e conquistas.
   · gerar: transforma um rascunho "gerando" em "novo" (com IA dentro do teto do mês, ou sem IA), soma o gasto e avisa o Richard.
   · disparar: chama a function em segundo plano (que pode passar dos 30 s das functions agendadas) com o segredo interno
     guardado em central/agentesConfig (nunca vai para o navegador).
   Coleções (só pelas functions): centralAgentes/{id} e central/agentesConfig. */
const crypto = require("crypto");
const AV = require("./_central-avisos");
const AG = require("./_central-agentes");
const R = require("./_central-rotina");
const AT = require("./_atendimento");
const QA = require("./_aulas-mes");
const P = require("./_push");

const col = (db, c) => db.collection(c);
const agoraISO = (ms) => new Date(ms).toISOString();

async function lerConfig(db) {
  const ref = col(db, "central").doc("agentesConfig"), d = await ref.get(), c = AG.limparConfig(d.exists ? d.data() : null);
  if (!c.segredo) { c.segredo = crypto.randomBytes(24).toString("hex"); await ref.set(c); }
  return c;
}
async function lerRotina(db) { const d = await col(db, "central").doc("rotina").get(); return d.exists ? R.limparRotina(d.data()) : null; }

/* faltas como o painel do Padrão de Atendimento (3 em 30 dias), com a presença de _aulas-mes.js */
function faltasDe(aulas, alunos, turmas, hoje) {
  const desde = AT.somaDias(hoje, -(AT.LIMITES.diasFaltas - 1)), cont = new Map();
  (aulas || []).forEach((au) => { if (!au || au.data < desde || au.data > hoje) return; (au.membros || []).forEach((id) => { if (QA.presencaNaAula(au, id) === "falta") cont.set(id, (cont.get(id) || 0) + 1); }); });
  const out = [];
  cont.forEach((n, id) => { const a = alunos.find((x) => x.id === id); if (a && n >= AT.LIMITES.faltas) out.push({ nome: a.nome || "Sem nome", faltas: n, professor: AT.professorDoAluno(a, turmas).nome }); });
  return out.sort((x, y) => y.faltas - x.faltas);
}
async function lerFontes(ctx) {
  const hoje = AV.sp(ctx.agoraMs).data;
  const ler = ctx.lerAcademia || require("./financeiro")._lerAcademia;
  const { dados } = await ler("team-yoda");
  const alunos = dados.alunos || [], turmas = dados.turmas || [];
  const desde = AT.somaDias(hoje, -(AT.LIMITES.janelaDias - 1));
  let aulas = [];
  try { aulas = QA.aulasDoPeriodo({ ocorrencias: dados.ocorrencias || [], alunos, turmas, inicio: desde, fim: hoje, hoje, extras: [] }); } catch (e) { aulas = []; }
  const painel = AT.painel({ alunos, turmas, aulas, hoje, agora: ctx.agoraMs });
  const semanaAtras = AT.somaDias(hoje, -6), mes = hoje.slice(0, 7), marcosSemana = [], conquistasMes = [];
  alunos.forEach((a) => (a.registros || []).forEach((r) => {
    const d = String(r && r.data || "").slice(0, 10), c = r && r.conquista;
    if (!c || !c.texto || d > hoje) return;
    if (c.marco && d >= semanaAtras) marcosSemana.push({ nome: a.nome || "Sem nome", texto: String(c.texto).slice(0, 200), data: d, professor: AT.professorDoRegistro(r, a).nome });
    if (d.slice(0, 7) === mes) conquistasMes.push({ nome: a.nome || "Sem nome", texto: String(c.texto).slice(0, 200), marco: !!c.marco });
  }));
  const rot = await lerRotina(ctx.db);
  return { hoje, painel, faltas: faltasDe(aulas, alunos, turmas, hoje), marcosSemana, conquistasMes,
    rotina: rot ? R.semana(rot, AV.segundaDe(hoje)) : null, professores: rot ? rot.professores : [] };
}

/* IA de verdade: SDK oficial, claude-opus-5-5, fallback do servidor em caso de recusa */
async function iaClaude(sistema, msg) {
  const mod = require("@anthropic-ai/sdk"), Anthropic = mod.default || mod.Anthropic || mod;
  const client = new Anthropic();
  const r = await client.beta.messages.create({
    model: AG.MODELO, max_tokens: 16000, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
    output_config: { effort: "medium" }, system: sistema, messages: [{ role: "user", content: msg }],
  });
  if (r.stop_reason === "refusal") return { recusa: true, usage: r.usage };
  return { texto: r.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim(), usage: r.usage, cortado: r.stop_reason === "max_tokens" };
}
function iaPadrao() { return process.env.ANTHROPIC_API_KEY ? iaClaude : null; }

/* avisa os aparelhos do Richard (tipo "agentes"), respeitando o que ele ligou e o horário de silêncio */
async function avisarRichard(ctx, aviso) {
  const snap = await col(ctx.db, P.COLECAO).where("app", "==", "central").get(), uids = {};
  snap.forEach((d) => { const x = d.data(); if (x.uid && x.papel === "richard") uids[x.uid] = 1; });
  for (const uid of Object.keys(uids)) {
    const pd = await col(ctx.db, "centralAvisos").doc(uid).get(), prefs = AV.prefsDe(pd.exists ? pd.data() : null, "richard");
    if (!prefs.tipos.agentes || AV.emSilencio(prefs, ctx.agoraMs)) continue;
    await ctx.enviar({ app: "central", uid }, aviso);
  }
}

async function gerar(ctx, id) {
  const ref = col(ctx.db, "centralAgentes").doc(id), d = await ref.get();
  if (!d.exists) return { ok: false, motivo: "não existe" };
  const item = d.data(); if (item.estado !== "gerando") return { ok: false, motivo: "já gerado" };
  const cfg = await lerConfig(ctx.db), hoje = AV.sp(ctx.agoraMs).data, mes = hoje.slice(0, 7);
  let fontes;
  try { fontes = item.agente === "caixaEntrada" ? { hoje } : await lerFontes(ctx); }
  catch (e) { console.error("central-agentes: não leu o Team Yoda", e && e.message); fontes = { hoje, painel: null, faltas: [], marcosSemana: [], conquistasMes: [], rotina: null, professores: [] }; }
  const contexto = AG.contexto(item.agente, fontes, { texto: item.entrada });
  let texto = "", semIA = false, motivo = "", custo = 0;
  const ia = ctx.ia === undefined ? iaPadrao() : ctx.ia;
  if (!ia) { semIA = true; motivo = "A IA não está configurada no servidor."; }
  else if (!AG.dentroDoTeto(cfg, hoje)) { semIA = true; motivo = "O teto de US$ " + cfg.tetoUSD.toFixed(2).replace(".", ",") + " do mês foi atingido."; }
  else {
    try {
      const r = await ia(AG.SISTEMA, AG.mensagem(item.agente, contexto));
      custo = AG.custoUSD(r.usage);
      if (r.recusa || !r.texto) { semIA = true; motivo = "A IA não respondeu este pedido."; } else texto = r.texto;
    } catch (e) { semIA = true; motivo = "A IA falhou agora (" + String(e && e.message || e).slice(0, 80) + ")."; }
  }
  if (semIA) texto = AG.semIA(item.agente, contexto);
  const novo = { ...item, estado: "novo", texto, semIA, motivoSemIA: motivo, custoUSD: custo, atualizadoEm: agoraISO(ctx.agoraMs) };
  if (item.agente === "caixaEntrada") {
    const p = AG.lerPropostas(texto) || AG.lerPropostas(AG.semIA("caixaEntrada", contexto));
    novo.propostas = p; novo.texto = AG.textoDasPropostas(p);
  }
  await ref.set(novo);
  if (custo) { cfg.gasto[mes] = (cfg.gasto[mes] || 0) + custo; await col(ctx.db, "central").doc("agentesConfig").set(cfg); }
  if (item.agente !== "caixaEntrada" && ctx.enviar) await avisarRichard(ctx, { titulo: "Agente: " + (AG.AGENTES[item.agente] || {}).rot, corpo: "Rascunho pronto para você revisar.", url: "/#agentes", tag: "central-agente-" + item.agente }).catch(() => {});
  return { ok: true, custo, semIA };
}

/* cria o rascunho "gerando" (uma vez só por id) e chama a function em segundo plano */
async function criar(ctx, id, agente, extra) {
  try { await col(ctx.db, "centralAgentes").doc(id).create({ agente, periodo: (extra && extra.periodo) || "", estado: "gerando", criadoEm: agoraISO(ctx.agoraMs), tentativas: 1, ...(extra && extra.entrada ? { entrada: extra.entrada } : {}) }); }
  catch (e) { return false; }
  await disparar(ctx, id);
  return true;
}
async function disparar(ctx, id) {
  const cfg = await lerConfig(ctx.db), base = process.env.URL || "https://app.39tennis.com.br";
  try {
    await (ctx.fetch || fetch)(base + "/.netlify/functions/central-agentes-background", { method: "POST", headers: { "content-type": "application/json", "x-central-segredo": cfg.segredo }, body: JSON.stringify({ id }) });
  } catch (e) { console.error("central-agentes: não disparou", id, e && e.message); }
}
async function listar(db, n) {
  const s = await col(db, "centralAgentes").orderBy("criadoEm", "desc").limit(n || 40).get(), out = [];
  s.forEach((d) => out.push(AG.itemPublico(d.id, d.data())));
  return out;
}

module.exports = { lerConfig, lerRotina, lerFontes, faltasDe, gerar, criar, disparar, listar, iaClaude, avisarRichard };
