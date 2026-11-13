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

/* Etapa 1 da Central Tsukada (13/11/2026): avisos no celular e lista "Implantação" (regras em _central-avisos.js; envio
   agendado em central-avisos.js). Perfis: Richard (FINANCEIRO_DONOS) vê tudo como antes; o administrativo (lista de
   Financeiro › Acessos) entra só para os avisos dele; professores e qualquer outra conta recebem 403. O navegador nunca lê
   o Firestore: estas coleções só passam por aqui (as regras do Firestore as fecham para o navegador).
   GET (Richard)        → o de sempre + { papel: "richard", implantacao, avisos, tipos, chavePush }
   GET (administrativo) → { papel: "administrativo", hoje, avisos, tipos, chavePush }   (nada da agenda, tarefas ou negócios)
   POST { acao: "implantacaoSalvar", tarefas }            → só Richard; central/implantacao
   POST { acao: "avisosSalvar", prefs }                   → cada um as suas; centralAvisos/{uid} (só os tipos do perfil)
   POST { acao: "avisosInscrever", inscricao }            → este aparelho passa a receber (pushInscricoes, app "central", uid, papel)
   POST { acao: "avisosCancelar" | "avisosEstado", endpoint }
   POST { acao: "avisosTeste" }                           → um aviso só para os aparelhos de quem tocou */

/* Etapa 2 (13/11/2026): Rotina do Head Trainer (_central-rotina.js, central/rotina) e agentes (_central-agentes.js, motor em
   _central-agentes-motor.js, rascunhos em centralAgentes, teto e gasto em central/agentesConfig). Tudo só do Richard.
   GET (Richard) também traz { rotina: semana atual, ritmos, proximoBloco, agentes: rascunhos, agentesConfig, agentesDef }
   POST { acao: "rotinaVer" | "rotinaModo" | "rotinaMinimo" | "rotinaFeito" | "rotinaBloco" | "rotinaRestaurar" | "rotinaProfessores" | "rotinaRitmo", semana, … }
        → { rotina, ritmos, professores } da semana pedida
   Etapa 3 (13/11/2026): Rotina do Administrativo (_central-adm.js, central/rotinaAdm) — o administrativo edita, o Richard só vê.
   POST { acao: "admVer", data } (os dois) | "admMarcar" { data, id, feito } | "admPendencias" { data, texto } | "admHorario" { inicio }
        | "admViagemSalvar" { viagem } | "admViagemApagar" { id }  (só o administrativo) → { rotinaAdm, torneios }
   Agentes do administrativo (Resumo, Faltas, Viagens): ele gera, edita, aprova e descarta os dele; "enviar" (só o Resumo)
   manda para o Richard, que vê os enviados (só leitura). O Richard não mexe nos rascunhos do administrativo e vice-versa.
   POST { acao: "agentesConfig", ligados, tetoUSD } | { acao: "agenteGerar", agente } | { acao: "caixaEntrada", texto }
   POST { acao: "agenteItem", id, op: "aprovar" | "descartar" | "editar", texto? } → aprovar a Caixa de entrada põe as
        tarefas e os compromissos na agenda (central/dono, pelo mesmo limpar de sempre) */
const { admin, app } = require("./_firebase-admin");
const FIN = require("./financeiro");
const F = require("./_financeiro-calc");
const A = require("./_central-avisos");
const P = require("./_push");
const { endpointValido } = require("./push-inscricao");
const R = require("./_central-rotina");
const AG = require("./_central-agentes");
const M = require("./_central-agentes-motor");
const ADM = require("./_central-adm");

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
    dias: seriesDias(ocorrencias, dados.reservas, hoje),
  };
}
/* aulas dia a dia (14 dias para trás e 7 para frente) para os gráficos da Central: dadas, canceladas, sem fechar
   (passaram e ficaram "agendada") e marcadas (de hoje em diante); reservas de quadra no mesmo período */
function maisDiasISO(iso, n) { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function seriesDias(ocorrencias, reservas, hoje) {
  const ocs = (Array.isArray(ocorrencias) ? ocorrencias : []).filter((o) => o && o.tipo !== "bloqueio");
  const res = Array.isArray(reservas) ? reservas : [];
  const l = [];
  for (let k = -13; k <= 7; k++) {
    const d = maisDiasISO(hoje, k), doDia = ocs.filter((o) => o.data === d);
    l.push({ data: d, dadas: doDia.filter((o) => o.status === "realizada").length, canceladas: doDia.filter((o) => o.status === "cancelada").length,
      semFechar: d < hoje ? doDia.filter((o) => o.status === "agendada").length : 0, marcadas: d >= hoje ? doDia.filter((o) => o.status === "agendada").length : 0,
      reservas: res.filter((x) => x && x.data === d).length });
  }
  return l;
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

/* ── Etapa 1: perfis, Implantação e avisos ── */
const db = () => admin.firestore();
function tiposPara(papel) { return A.tiposDoPapel(papel).map((id) => ({ id, rot: A.TIPOS[id].rot, etapa: A.TIPOS[id].etapa, ativo: A.ativo(id) })); }
async function chavePush() { try { return await P.chavePublica(admin); } catch (e) { return null; } }
async function lerPrefs(uid, papel) { if (!uid) return A.prefsPadrao(papel); const d = await db().collection("centralAvisos").doc(uid).get(); return A.prefsDe(d.exists ? d.data() : null, papel); }
async function lerImplantacao() { const d = await db().collection("central").doc("implantacao").get(); return d.exists ? A.limparImplantacao(d.data().tarefas) : A.implantacaoPadrao(); }
async function extrasEtapa1(claims, papel) {
  const [avisos, chave] = await Promise.all([lerPrefs(claims.uid, papel), chavePush()]);
  return { papel, avisos, tipos: tiposPara(papel), chavePush: chave };
}
async function lerRotinaOuPadrao() {
  const r = await M.lerRotina(db());
  if (r) return r;
  let nomes = [];
  try { nomes = ((await FIN._lerAcademia("team-yoda")).dados.professores || []).map((p) => p.nome); } catch (e) { nomes = []; }
  return R.rotinaPadrao(nomes);
}
const segundaPedida = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) ? A.segundaDe(s) : A.segundaDe(hojeBR()));
function vistaRotina(rot, seg) { return { rotina: R.semana(rot, seg), ritmos: R.ritmos(rot, hojeBR()), professores: rot.professores }; }
async function acaoEtapa2(b, claims) {
  const a = b.acao;
  if (/^rotina/.test(a)) {
    const rot = await lerRotinaOuPadrao(), seg = segundaPedida(b.semana);
    try {
      if (a === "rotinaModo") R.marcarModo(rot, seg, b.modo);
      else if (a === "rotinaMinimo") R.marcarMinimo(rot, seg, b.ligado);
      else if (a === "rotinaFeito") R.marcarFeito(rot, seg, String(b.blocoId || ""), !!b.feito, hojeBR());
      else if (a === "rotinaBloco") R.editarBloco(rot, b.modo, String(b.blocoId || ""), { inicio: b.inicio, duracaoMin: b.duracaoMin, dia: b.dia, titulo: b.titulo });
      else if (a === "rotinaRestaurar") rot.modelos[b.modo === "viagem" ? "viagem" : "ct"] = R.rotinaPadrao(rot.professores).modelos[b.modo === "viagem" ? "viagem" : "ct"];
      else if (a === "rotinaProfessores") rot.professores = R.limparRotina({ professores: b.professores }).professores;
      else if (a === "rotinaRitmo") R.marcarRitmo(rot, b.tipo === "trimestral" ? "trimestral" : "mensal", String(b.periodo || ""), b.idx == null ? null : Number(b.idx), !!b.feito, b.tema);
      else if (a !== "rotinaVer") throw new Error("Ação desconhecida.");
    } catch (e) { throw new FIN._ErroPublico(400, e.message); }
    const limpa = R.limparRotina(rot);
    if (a !== "rotinaVer") await db().collection("central").doc("rotina").set({ ...limpa, atualizado: Date.now() });
    return vistaRotina(limpa, seg);
  }
  const ctx = { db: db(), agoraMs: Date.now() };
  if (a === "agentesConfig") {
    const cfg = await M.lerConfig(db()), novo = AG.limparConfig({ ...cfg, ligados: { ...cfg.ligados, ...(b.ligados || {}) }, tetoUSD: b.tetoUSD == null ? cfg.tetoUSD : b.tetoUSD });
    await db().collection("central").doc("agentesConfig").set(novo);
    return { agentesConfig: AG.publicoConfig(novo, hojeBR()) };
  }
  if (a === "caixaEntrada") {
    const texto = String(b.texto || "").trim().slice(0, 4000);
    if (texto.length < 3) throw new FIN._ErroPublico(400, "Escreva o que quer organizar.");
    const id = "caixaEntrada-" + Date.now().toString(36);
    await M.criar(ctx, id, "caixaEntrada", { periodo: hojeBR(), entrada: texto });
    return { id, agentes: await M.listar(db(), 40, "richard") };
  }
  return null;
}
async function extrasEtapa2() {
  const hoje = hojeBR(), [rot, cfg, agentes, adm] = await Promise.all([lerRotinaOuPadrao(), M.lerConfig(db()), M.listar(db(), 40, "richard").catch(() => []), vistaAdm(hoje)]);
  return { ...vistaRotina(rot, A.segundaDe(hoje)), proximoBloco: R.proximoBloco(rot, Date.now()), agentes, agentesConfig: AG.publicoConfig(cfg, hoje),
    agentesDef: defsAgentes(), ...adm };
}
function defsAgentes() {
  return Object.keys(AG.AGENTES).map((id) => ({ id, rot: AG.AGENTES[id].rot, desc: AG.AGENTES[id].desc, etapa: AG.AGENTES[id].etapa, ativo: AG.ativo(id), manual: !AG.AGENTES[id].quando, quando: AG.AGENTES[id].quando, para: AG.paraDe(id) }));
}
async function extrasAdm() {
  const hoje = hojeBR(), [cfg, agentes, adm] = await Promise.all([M.lerConfig(db()), M.listar(db(), 40, "administrativo").catch(() => []), vistaAdm(hoje)]);
  return { agentes, agentesConfig: AG.publicoConfig(cfg, hoje), agentesDef: defsAgentes().filter((d) => d.para === "administrativo"), ...adm };
}

async function torneiosProximos() {
  try {
    const { dados } = await FIN._lerAcademia("team-yoda"), hoje = hojeBR(), ate = A.somaDias(hoje, 30), out = [];
    (dados.alunos || []).forEach((a) => (a.competicoes || []).forEach((c) => { if (c && c.data && c.data >= hoje && c.data <= ate) out.push({ atleta: a.nome || "Sem nome", torneio: c.nome || "Torneio", data: c.data, fim: c.fim || "" }); }));
    return out.sort((x, y) => x.data.localeCompare(y.data)).slice(0, 30);
  } catch (e) { return []; }
}
async function vistaAdm(data) {
  const [rot, torneios] = await Promise.all([M.lerRotinaAdm(db()), torneiosProximos()]);
  return { rotinaAdm: ADM.dia(rot, /^\d{4}-\d{2}-\d{2}$/.test(String(data || "")) ? data : hojeBR()), viagens: rot.viagens, torneios };
}
async function acaoAdm(b, papel) {
  if (b.acao === "admVer") return vistaAdm(b.data);
  if (papel !== "administrativo") throw new FIN._ErroPublico(403, "A rotina do administrativo é editada só pelo administrativo.");
  const rot = await M.lerRotinaAdm(db());
  try {
    if (b.acao === "admMarcar") ADM.marcar(rot, String(b.data || ""), String(b.id || ""), !!b.feito);
    else if (b.acao === "admPendencias") ADM.salvarPendencias(rot, String(b.data || ""), b.texto);
    else if (b.acao === "admHorario") { if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(b.inicio || ""))) throw new Error("Horário inválido."); rot.inicio = b.inicio; }
    else if (b.acao === "admViagemSalvar") ADM.salvarViagem(rot, b.viagem || {});
    else if (b.acao === "admViagemApagar") ADM.apagarViagem(rot, String(b.id || ""));
    else throw new Error("Ação desconhecida.");
  } catch (e) { throw new FIN._ErroPublico(400, e.message); }
  await db().collection("central").doc("rotinaAdm").set({ ...ADM.limpar(rot), atualizado: Date.now() });
  return vistaAdm(b.data);
}
/* rascunhos dos agentes: cada perfil gera e mexe só nos seus */
async function acaoAgentes(b, claims, papel) {
  const ctx = { db: db(), agoraMs: Date.now(), enviar: (filtro, aviso) => P.avisar(admin, filtro, aviso) };
  if (b.acao === "agentesListar") { const cfg = await M.lerConfig(db()); return { agentes: await M.listar(db(), 40, papel), agentesConfig: AG.publicoConfig(cfg, hojeBR()) }; }
  if (b.acao === "agenteGerar") {
    const ag = String(b.agente || "");
    if (!AG.ativo(ag) || !AG.AGENTES[ag].quando || AG.paraDe(ag) !== papel) throw new FIN._ErroPublico(400, "Agente desconhecido.");
    const id = ag + "-manual-" + Date.now().toString(36);
    await M.criar(ctx, id, ag, { periodo: AG.periodoDe(ag, ctx.agoraMs) });
    return { id, agentes: await M.listar(db(), 40, papel) };
  }
  const id = String(b.id || ""); if (!/^[A-Za-z0-9_-]{3,80}$/.test(id)) throw new FIN._ErroPublico(400, "Rascunho inválido.");
  const ref = db().collection("centralAgentes").doc(id), d = await ref.get();
  if (!d.exists) throw new FIN._ErroPublico(404, "Rascunho não encontrado.");
  const item = d.data(), agora = new Date().toISOString();
  if (AG.paraDe(item.agente) !== papel) throw new FIN._ErroPublico(403, "Este rascunho é de outro perfil.");
  if (item.estado === "gerando") throw new FIN._ErroPublico(409, "O agente ainda está preparando este rascunho.");
  if (item.estado === "enviado") throw new FIN._ErroPublico(409, "Este resumo já foi enviado ao Richard.");
  if (b.op === "editar") { item.texto = String(b.texto || "").slice(0, 20000); item.editado = true; }
  else if (b.op === "descartar") item.estado = "descartado";
  else if (b.op === "enviar") {
    if (item.agente !== "resumoAdm") throw new FIN._ErroPublico(400, "Só o resumo da semana vai para o Richard.");
    item.estado = "enviado"; item.enviadoEm = agora;
    await M.avisarPapel(ctx, "richard", { titulo: "Resumo da semana do administrativo", corpo: "O administrativo enviou o resumo da semana anterior.", url: "/#agentes", tag: "central-resumo-adm" }).catch(() => {});
  } else if (b.op === "aprovar") {
    if (item.agente === "caixaEntrada" && item.propostas && !item.aplicadoEm) {
      const dono = await db().collection("central").doc("dono").get(), dados = dono.exists ? (dono.data().dados || vazio()) : vazio(), hoje = hojeBR();
      const p = item.propostas, n = Date.now().toString(36);
      p.tarefas.forEach((t, i) => dados.tarefas.unshift({ id: "ta" + n + i, titulo: t.titulo, negocio: t.negocio, prazo: t.prazo, prioridade: t.prioridade, feita: false, nota: "", criadaEm: hoje }));
      p.compromissos.forEach((c, i) => dados.agenda.push({ id: "ag" + n + i, titulo: c.titulo, data: c.data, inicio: c.inicio, fim: "", negocio: c.negocio, local: "", nota: "", semanal: false }));
      await db().collection("central").doc("dono").set({ dados: limpar(dados), atualizado: Date.now(), por: claims.email });
      item.aplicadoEm = agora;
    }
    item.estado = "aprovado";
  } else throw new FIN._ErroPublico(400, "Ação desconhecida.");
  item.atualizadoEm = agora;
  await ref.set(item);
  return { item: AG.itemPublico(id, item) };
}

async function acao(b, claims, papel) {
  const uid = String(claims.uid || "");
  if (/^adm/.test(b.acao)) return acaoAdm(b, papel);
  if (b.acao === "agenteGerar" || b.acao === "agenteItem" || b.acao === "agentesListar") return acaoAgentes(b, claims, papel);
  if (/^(rotina|agente|caixaEntrada)/.test(b.acao)) {
    if (papel !== "richard") throw new FIN._ErroPublico(403, "A rotina do Head Trainer e os agentes são só do Richard.");
    const r = await acaoEtapa2(b, claims); if (r) return r;
  }
  if (b.acao === "implantacaoSalvar") {
    if (papel !== "richard") throw new FIN._ErroPublico(403, "A lista Implantação é só do Richard.");
    const tarefas = A.limparImplantacao(b.tarefas);
    await db().collection("central").doc("implantacao").set({ tarefas, atualizado: Date.now(), por: claims.email });
    return { implantacao: tarefas };
  }
  if (!uid) throw new FIN._ErroPublico(401, "Entre de novo para mexer nos avisos.");
  if (b.acao === "avisosSalvar") {
    const prefs = A.limparPrefs(b.prefs, papel);
    await db().collection("centralAvisos").doc(uid).set({ ...prefs, atualizado: Date.now() });
    return { avisos: prefs };
  }
  if (b.acao === "avisosInscrever") {
    const i = b.inscricao || {}, k = i.keys || {};
    if (!endpointValido(i.endpoint) || !/^[A-Za-z0-9_-]{80,100}$/.test(String(k.p256dh || "")) || !/^[A-Za-z0-9_-]{16,30}$/.test(String(k.auth || ""))) throw new FIN._ErroPublico(400, "Inscrição inválida.");
    const ref = db().collection(P.COLECAO).doc(P.idDaInscricao(i.endpoint)), antes = await ref.get(), agora = new Date().toISOString();
    await ref.set({ app: "central", uid, papel, url: "/", endpoint: i.endpoint, keys: { p256dh: k.p256dh, auth: k.auth }, criadoEm: antes.exists ? antes.data().criadoEm || agora : agora, atualizadoEm: agora });
    return { ok: true };
  }
  if (b.acao === "avisosCancelar" || b.acao === "avisosEstado") {
    if (!endpointValido(b.endpoint)) return b.acao === "avisosEstado" ? { inscrito: false } : { ok: true };
    const ref = db().collection(P.COLECAO).doc(P.idDaInscricao(b.endpoint)), d = await ref.get();
    const meu = d.exists && d.data().app === "central" && d.data().uid === uid;
    if (b.acao === "avisosEstado") return { inscrito: meu };
    if (meu) await ref.delete();
    return { ok: true };
  }
  if (b.acao === "avisosTeste") {
    const r = await P.enviarPara(admin, { app: "central", uid }, { titulo: "Central", corpo: "Notificação de teste: os avisos estão chegando neste aparelho.", url: "/#avisos", tag: "central-teste" });
    if (!r.enviados) throw new FIN._ErroPublico(409, r.removidos ? "O aparelho tinha desativado os avisos. Ative de novo e teste." : "Nenhum aparelho com avisos ativos nesta conta. Toque em Ativar neste aparelho primeiro.");
    return { ok: true, enviados: r.enviados };
  }
  throw new FIN._ErroPublico(400, "Ação desconhecida.");
}

exports.handler = async function (event) {
  try {
    app();
    const claims = await FIN._login(event), p = await FIN._papelDe(claims);
    const papel = p === "dono" ? "richard" : p === "admin" ? "administrativo" : null;
    if (!papel) throw new FIN._ErroPublico(403, "A Central é só do Richard e do administrativo.");
    if (event.httpMethod === "GET") {
      if (papel === "administrativo") return resposta(200, { hoje: hojeBR(), ...(await extrasEtapa1(claims, papel)), ...(await extrasAdm()) });
      const r = await handleGet(), corpo = JSON.parse(r.body);
      const [extras, implantacao, e2] = await Promise.all([extrasEtapa1(claims, papel), lerImplantacao(), extrasEtapa2()]);
      return resposta(200, { ...corpo, ...extras, implantacao, ...e2 });
    }
    if (event.httpMethod === "POST") {
      let b = null; try { b = JSON.parse(event.body || "{}"); } catch (e) { b = null; }
      if (b && typeof b.acao === "string") return resposta(200, await acao(b, claims, papel));
      if (papel !== "richard") throw new FIN._ErroPublico(403, "Só o Richard mexe na agenda e nos negócios.");
      return await handlePost(event, claims);
    }
    return resposta(405, { erro: "Método não permitido." });
  } catch (e) {
    if (e instanceof FIN._ErroPublico) return resposta(e.status, { erro: e.message });
    return resposta(500, { erro: String(e.message || e) });
  }
};
exports._limpar = limpar;
