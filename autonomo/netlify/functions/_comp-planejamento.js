/* QuadraLab Competição — "Meu planejamento" (regras puras, sem Firebase).

   Três níveis: temporada (blocos de preparação, competição e recuperação), próximas 4 semanas e esta semana.
   A sugestão inicial é montada por REGRAS (não por IA) a partir do que o atleta cadastrou: torneios e prioridade, compromissos,
   rotina, objetivos, registros recentes e orientações de profissionais. O calendário sozinho nunca decide a carga: a sugestão
   mostra o que usou, o que faltou e o que precisa de revisão. Não prescreve treino físico nem conduta clínica.

   Cada versão tem autoria, data, histórico e um status:
     sugestao     — sugerida pela plataforma (ou ajuste do próprio atleta), sem revisão profissional
     em_revisao   — enviada ao treinador (ou rascunho do treinador) e ainda não aprovada
     aprovado     — aprovada por um treinador com vínculo ativo
     substituido  — trocada por uma versão mais nova (continua no histórico)
   Um plano aprovado só é substituído quando o treinador aprova outra versão: mudanças no calendário geram apenas uma PROPOSTA. */
const crypto = require("crypto");

const STATUS = ["sugestao", "em_revisao", "aprovado", "substituido"];
const ORIGENS = ["plataforma", "atleta", "treinador"];
const PRIORIDADES = ["A", "B", "C"];
const ROTULO_PRIORIDADE = { A: "Principal", B: "Importante", C: "Preparatório" };
const TIPOS_COMPROMISSO = { viagem: "Viagem", escola: "Escola", indisponivel: "Período indisponível", outro: "Outro compromisso" };
const DIAS = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];
const MINUTOS = [30, 45, 60, 90, 120];
const PARCEIROS = { sempre: "Tenho parceiros de treino", as_vezes: "Às vezes", raramente: "Raramente" };
const QUADRAS = { propria: "Quadra própria ou do clube", clube: "Clube com horários fixos", variavel: "Varia durante a semana" };
const MAX_VERSOES = 60, MAX_COMPROMISSOS = 200, MAX_EXECUCOES = 1500;
const ID = /^[A-Za-z0-9_-]{8,60}$/;

const txt = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
const DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
function dataValida(s) {
  const m = DATA.exec(String(s || ""));
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}
const addDias = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const diasEntre = (a, b) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000);
const segundaDe = (iso) => { const d = new Date(iso + "T12:00:00Z"); return addDias(iso, -((d.getUTCDay() + 6) % 7)); };
const diaDaSemana = (iso) => DIAS[(new Date(iso + "T12:00:00Z").getUTCDay() + 6) % 7];
const cruza = (a1, a2, b1, b2) => a1 <= b2 && b1 <= a2;

/* ── o que o atleta cadastra ── */
function normalizarCompromisso(b, hoje) {
  b = b || {};
  const tipo = Object.prototype.hasOwnProperty.call(TIPOS_COMPROMISSO, b.tipo) ? b.tipo : null;
  if (!tipo) return { ok: false, erro: "Escolha o tipo do compromisso." };
  const titulo = txt(b.titulo, 80) || TIPOS_COMPROMISSO[tipo];
  if (!dataValida(b.inicio)) return { ok: false, erro: "Informe a data de início." };
  const fim = b.fim ? String(b.fim) : b.inicio;
  if (!dataValida(fim) || fim < b.inicio) return { ok: false, erro: "A data de término não pode ser antes do início." };
  if (diasEntre(b.inicio, fim) > 120) return { ok: false, erro: "O período é longo demais. Divida em partes de até 120 dias." };
  if (hoje && b.inicio < addDias(hoje, -400)) return { ok: false, erro: "A data de início está muito no passado." };
  return { ok: true, dados: { tipo, titulo, inicio: b.inicio, fim, obs: txt(b.obs, 200) } };
}
function normalizarRotina(b) {
  b = b || {};
  const dias = DIAS.filter((d) => Array.isArray(b.dias) && b.dias.includes(d));
  if (dias.length > 6) return { ok: false, erro: "Deixe pelo menos um dia da semana sem treino." };
  const minutos = MINUTOS.includes(Number(b.minutos)) ? Number(b.minutos) : null;
  if (dias.length && !minutos) return { ok: false, erro: "Escolha a duração habitual do treino." };
  const objetivos = (Array.isArray(b.objetivos) ? b.objetivos : []).map((x) => txt(x, 120)).filter(Boolean).slice(0, 5);
  return { ok: true, dados: {
    dias, minutos, quadra: Object.prototype.hasOwnProperty.call(QUADRAS, b.quadra) ? b.quadra : "", parceiros: Object.prototype.hasOwnProperty.call(PARCEIROS, b.parceiros) ? b.parceiros : "",
    objetivos, observacao: txt(b.observacao, 300),
  } };
}
function normalizarExecucao(b, hoje) {
  b = b || {};
  if (!dataValida(b.data) || b.data > hoje) return { ok: false, erro: "Informe a data (não pode ser futura)." };
  const feito = ["sim", "parcial", "nao"].includes(b.feito) ? b.feito : null;
  if (!feito) return { ok: false, erro: "Diga se você fez a atividade: sim, em parte ou não." };
  const escala = (v) => (Number.isInteger(v) && v >= 1 && v <= 5 ? v : null);
  const atividadeId = ID.test(String(b.atividadeId || "")) ? String(b.atividadeId) : null;
  const titulo = txt(b.titulo, 100);
  if (!atividadeId && !titulo) return { ok: false, erro: "Escreva o que você fez." };
  return { ok: true, dados: { data: b.data, atividadeId, versaoId: ID.test(String(b.versaoId || "")) ? String(b.versaoId) : null, titulo, feito, esforco: escala(b.esforco), recuperacao: escala(b.recuperacao), obs: txt(b.obs, 400) } };
}

/* ── geração da sugestão ── */
const TIPO_ATIV = ["treino", "jogo_treino", "competicao", "recuperacao", "preparo", "outro"];
const PREP_DIAS = { A: 21, B: 14, C: 0 }, REC_DIAS = { A: 5, B: 3, C: 2 };
const ROTULO_ORIGEM_FOCO = { foco: "Foco de treino", devolutiva: "Devolutiva do treinador", partida: "Partidas registradas", atleta: "Seu objetivo" };

function torneiosAtivos(torneios, hoje) {
  return (torneios || []).filter((t) => t && t.inicio && t.fim && t.fim >= hoje && !["desistiu", "encerrado"].includes(t.estado)).sort((a, b) => a.inicio.localeCompare(b.inicio));
}
function snapshotBase(torneios, compromissos, rotina, hoje) {
  return {
    torneios: torneiosAtivos(torneios, hoje).map((t) => ({ id: t.id, nome: txt(t.nome, 100), inicio: t.inicio, fim: t.fim, prioridade: t.prioridade || "", cidade: txt(t.cidade, 80) })),
    compromissos: (compromissos || []).filter((c) => c.fim >= hoje).sort((a, b) => a.inicio.localeCompare(b.inicio) || String(a.id).localeCompare(String(b.id))).map((c) => ({ id: c.id, tipo: c.tipo, titulo: c.titulo, inicio: c.inicio, fim: c.fim })),
    rotina: { dias: (rotina && rotina.dias) || [], minutos: (rotina && rotina.minutos) || null },
  };
}
function hashBase(snap) { return crypto.createHash("sha1").update(JSON.stringify(snap)).digest("hex").slice(0, 16); }

/* o que mudou no calendário entre duas fotos (para explicar a proposta de ajuste) */
function mudancasCalendario(antes, depois) {
  const out = [], mapa = (l) => Object.fromEntries((l || []).map((x) => [x.id, x]));
  const ta = mapa(antes.torneios), tb = mapa(depois.torneios);
  for (const id of Object.keys(tb)) {
    if (!ta[id]) out.push("Torneio incluído: " + tb[id].nome);
    else if (ta[id].inicio !== tb[id].inicio || ta[id].fim !== tb[id].fim) out.push("Datas alteradas: " + tb[id].nome);
    else if (ta[id].prioridade !== tb[id].prioridade) out.push("Prioridade alterada: " + tb[id].nome);
  }
  for (const id of Object.keys(ta)) if (!tb[id]) out.push("Torneio removido ou encerrado: " + ta[id].nome);
  const ca = mapa(antes.compromissos), cb = mapa(depois.compromissos);
  for (const id of Object.keys(cb)) if (!ca[id]) out.push("Compromisso incluído: " + cb[id].titulo); else if (ca[id].inicio !== cb[id].inicio || ca[id].fim !== cb[id].fim) out.push("Compromisso alterado: " + cb[id].titulo);
  for (const id of Object.keys(ca)) if (!cb[id]) out.push("Compromisso removido: " + ca[id].titulo);
  if (JSON.stringify(antes.rotina) !== JSON.stringify(depois.rotina)) out.push("Rotina de treino alterada");
  return out;
}

function montarBlocos(torneios, hoje, conflitos) {
  const blocos = []; let cursor = hoje;
  const lista = torneiosAtivos(torneios, hoje);
  lista.forEach((t, i) => {
    const prio = PRIORIDADES.includes(t.prioridade) ? t.prioridade : "B";
    const prepDias = PREP_DIAS[prio], proximo = lista[i + 1];
    if (!t.prioridade) conflitos.push({ tipo: "prioridade", texto: "Defina a prioridade de " + t.nome + ". Enquanto isso a sugestão trata como importante.", torneioIds: [t.id] });
    if (prepDias > 0) {
      const ini = [addDias(t.inicio, -prepDias), cursor, hoje].reduce((a, b) => (a > b ? a : b));
      if (diasEntre(ini, t.inicio) >= 3) blocos.push({ id: "preparacao-" + t.id, tipo: "preparacao", inicio: ini, fim: addDias(t.inicio, -1), torneioId: t.id, rotulo: "Preparação para " + t.nome, prioridade: prio });
      else if (t.inicio > hoje) conflitos.push({ tipo: "prazo", texto: "Há pouco tempo para preparar " + t.nome + " (menos de 3 dias livres antes do início).", torneioIds: [t.id] });
    }
    blocos.push({ id: "competicao-" + t.id, tipo: "competicao", inicio: t.inicio < hoje ? hoje : t.inicio, fim: t.fim, torneioId: t.id, rotulo: t.nome, prioridade: prio });
    let recFim = addDias(t.fim, REC_DIAS[prio]);
    if (proximo && recFim >= proximo.inicio) recFim = addDias(proximo.inicio, -1);
    if (recFim > t.fim) blocos.push({ id: "recuperacao-" + t.id, tipo: "recuperacao", inicio: addDias(t.fim, 1), fim: recFim, torneioId: t.id, rotulo: "Recuperação e revisão de " + t.nome, prioridade: prio });
    cursor = recFim > t.fim ? addDias(recFim, 1) : addDias(t.fim, 1);
  });
  return blocos;
}

function detectarConflitos(torneios, compromissos, blocos, hoje, conflitos) {
  const lista = torneiosAtivos(torneios, hoje);
  for (let i = 0; i < lista.length; i++) {
    for (let j = i + 1; j < lista.length; j++) {
      const a = lista[i], b = lista[j];
      if (cruza(a.inicio, a.fim, b.inicio, b.fim)) conflitos.push({ tipo: "torneios", texto: a.nome + " e " + b.nome + " acontecem em datas que se cruzam.", torneioIds: [a.id, b.id] });
      else if (j === i + 1 && diasEntre(a.fim, b.inicio) < 3) conflitos.push({ tipo: "intervalo", texto: "Menos de 3 dias entre " + a.nome + " e " + b.nome + ": pouco tempo para recuperar e revisar.", torneioIds: [a.id, b.id] });
    }
    for (const c of compromissos || []) {
      if (c.tipo !== "viagem" && cruza(c.inicio, c.fim, lista[i].inicio, lista[i].fim)) conflitos.push({ tipo: "rotina", texto: lista[i].nome + " coincide com “" + c.titulo + "” (" + TIPOS_COMPROMISSO[c.tipo].toLowerCase() + ").", torneioIds: [lista[i].id] });
    }
  }
  for (const b of blocos.filter((x) => x.tipo === "preparacao")) {
    let indisp = 0;
    for (let d = b.inicio; d <= b.fim; d = addDias(d, 1)) if ((compromissos || []).some((c) => c.inicio <= d && d <= c.fim)) indisp++;
    const total = diasEntre(b.inicio, b.fim) + 1;
    if (indisp >= 4 || indisp * 2 >= total) conflitos.push({ tipo: "rotina", texto: b.rotulo + " tem " + indisp + " de " + total + " dias com compromissos ou períodos indisponíveis.", torneioIds: [b.torneioId] });
  }
}

/* focos: só o que veio de registros reais, com a origem preservada */
function reunirFocos(reg, rotina) {
  const out = [], vistos = new Set();
  const add = (texto, origem, refId) => { const t = txt(texto, 120), k = t.toLowerCase(); if (t && !vistos.has(k)) { vistos.add(k); out.push({ texto: t, origem, refId: refId || null }); } };
  (reg.focosAbertos || []).slice(0, 4).forEach((f) => add(f.texto, "foco", f.id));
  (reg.devolutivas || []).filter((d) => d.foco).slice(0, 2).forEach((d) => add(d.foco, "devolutiva", d.id));
  const cont = {};
  (reg.partidasRecentes || []).slice(0, 5).forEach((p) => (p.dificuldades || []).forEach((a) => { cont[a] = (cont[a] || 0) + 1; }));
  Object.keys(cont).filter((a) => cont[a] >= 2).forEach((a) => add("Dificuldade repetida nas partidas: " + (reg.aspectos && reg.aspectos[a] ? reg.aspectos[a] : a), "partida", null));
  ((rotina && rotina.objetivos) || []).forEach((o) => add(o, "atleta", null));
  return out.slice(0, 5);
}

function gerarConteudo(e) {
  const hoje = e.hoje, rotina = e.rotina || null, compromissos = e.compromissos || [], reg = e.registros || {};
  const conflitos = [];
  const blocos = montarBlocos(e.torneios, hoje, conflitos);
  detectarConflitos(e.torneios, compromissos, blocos, hoje, conflitos);
  const focos = reunirFocos(reg, rotina);
  const idade = e.idade || null, maxDias = idade && idade < 14 ? 5 : 6;
  const dias = rotina && rotina.minutos ? (rotina.dias || []) : [];
  const ini = segundaDe(hoje), semanas = [];
  const lista = torneiosAtivos(e.torneios, hoje);
  const blocoDe = (d) => blocos.find((b) => b.inicio <= d && d <= b.fim) || null;
  for (let n = 1; n <= 4; n++) {
    const sIni = addDias(ini, (n - 1) * 7), sFim = addDias(sIni, 6);
    const doBloco = blocos.filter((b) => cruza(b.inicio, b.fim, sIni, sFim));
    const comp = doBloco.find((b) => b.tipo === "competicao"), rec = doBloco.find((b) => b.tipo === "recuperacao"), prep = doBloco.find((b) => b.tipo === "preparacao");
    const nomeT = (b) => (b ? (lista.find((t) => t.id === b.torneioId) || {}).nome || b.rotulo : "");
    let objetivo, focosSemana;
    if (comp) { objetivo = "Competir em " + nomeT(comp) + " e registrar cada partida."; focosSemana = focos.slice(0, 1); }
    else if (rec) { objetivo = "Recuperar e revisar " + nomeT(rec) + ": o que funcionou e o que ajustar."; focosSemana = []; }
    else if (prep) { objetivo = "Preparar " + nomeT(prep) + (focos[0] ? ": " + focos[0].texto : ": consolidar o que já foi treinado") + "."; focosSemana = focos.slice(0, 3); }
    else { objetivo = "Desenvolvimento: " + (focos[0] ? focos[0].texto : "defina seus objetivos de desenvolvimento para dar direção às semanas"); focosSemana = focos.slice(0, 3); }
    const eventos = [];
    lista.filter((t) => cruza(t.inicio, t.fim, sIni, sFim)).forEach((t) => eventos.push({ tipo: "torneio", titulo: t.nome, inicio: t.inicio, fim: t.fim, torneioId: t.id }));
    compromissos.filter((c) => cruza(c.inicio, c.fim, sIni, sFim)).forEach((c) => eventos.push({ tipo: c.tipo, titulo: c.titulo, inicio: c.inicio, fim: c.fim }));
    const atividades = []; let k = 0, treinos = 0;
    for (let d = sIni; d <= sFim; d = addDias(d, 1)) {
      if (d < hoje) continue;
      const torneioNoDia = lista.find((t) => t.inicio <= d && d <= t.fim);
      const indisp = compromissos.some((c) => c.inicio <= d && d <= c.fim);
      const b = blocoDe(d), ehDia = dias.includes(diaDaSemana(d));
      const mk = (titulo, tipo, minutos, foco) => atividades.push({ id: "a" + d.replace(/-/g, "") + String(k++), data: d, titulo, tipo, minutos: minutos || null, foco: foco || "" });
      if (torneioNoDia) { mk("Competição · " + torneioNoDia.nome, "competicao", null); continue; }
      if (indisp) continue;
      const amanha = lista.find((t) => t.inicio === addDias(d, 1));
      if (amanha) { mk("Preparar a partida e revisar a estratégia", "preparo", 30); if (ehDia) mk("Treino leve de ajuste", "treino", Math.min(rotina.minutos, 45)); continue; }
      if (b && b.tipo === "recuperacao") { if (d === b.inicio) mk("Revisar o torneio e registrar no diário", "recuperacao", 20); continue; }
      if (!ehDia || treinos >= maxDias - 1) continue;
      treinos++;
      const foco = focosSemana[(treinos - 1) % Math.max(1, focosSemana.length)];
      const tipoJogo = treinos % 3 === 0 && rotina.parceiros !== "raramente";
      mk(tipoJogo ? "Jogo-treino ou pontos" : "Treino técnico-tático", tipoJogo ? "jogo_treino" : "treino", rotina.minutos, foco ? foco.texto : "");
    }
    const aposTorneio = lista.some((t) => t.fim >= addDias(sIni, -7) && t.fim < sIni);
    semanas.push({ n, inicio: sIni, fim: sFim, objetivo, focos: focosSemana, eventos, atividades, revisao: n === 4 || aposTorneio });
  }

  const exec = (reg.execucoes || []).filter((x) => x.esforco || x.recuperacao);
  const media = (campo) => { const v = exec.map((x) => x[campo]).filter(Boolean); return v.length >= 3 ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const esforco = media("esforco"), recuperacao = media("recuperacao");
  const observacoes = [];
  if ((esforco !== null && esforco >= 4) || (recuperacao !== null && recuperacao <= 2)) observacoes.push("Seus registros recentes indicam esforço alto ou recuperação baixa. A carga precisa ser revista com o seu treinador ou com o profissional de saúde ou preparação física que acompanha você. Esta sugestão não prescreve carga física.");
  if (!e.temTreinador) observacoes.push("Sem treinador vinculado: esta é uma sugestão para revisão, não um planejamento profissional aprovado.");
  const usado = [], faltando = [];
  (lista.length ? usado : faltando).push(lista.length ? lista.length + " torneio(s) e a prioridade de cada um" : "Torneios da temporada");
  (compromissos.length ? usado : faltando).push(compromissos.length ? compromissos.length + " compromisso(s) e período(s) indisponível(is)" : "Compromissos escolares, viagens e períodos indisponíveis");
  (dias.length ? usado : faltando).push(dias.length ? "Rotina de treino: " + dias.length + " dia(s) por semana" : "Rotina de treino (dias e duração)");
  (rotina && rotina.objetivos && rotina.objetivos.length ? usado : faltando).push(rotina && rotina.objetivos && rotina.objetivos.length ? "Seus objetivos de desenvolvimento" : "Objetivos de desenvolvimento");
  const nPart = (reg.partidasRecentes || []).length, nDev = (reg.devolutivas || []).length, nFoco = (reg.focosAbertos || []).length;
  (nPart || nFoco || nDev ? usado : faltando).push(nPart || nFoco || nDev ? "Registros recentes: " + nPart + " partida(s), " + nFoco + " foco(s) de treino, " + nDev + " devolutiva(s)" : "Registros de partidas e treinos");
  (exec.length >= 3 ? usado : faltando).push(exec.length >= 3 ? "Percepção de esforço e recuperação (" + exec.length + " registros)" : "Percepção de esforço e recuperação (poucos registros)");
  if (idade) usado.push("Idade (" + idade + " anos)" + (e.nivel ? " e nível informado" : ""));

  return {
    temporada: { blocos, objetivos: ((rotina && rotina.objetivos) || []).slice(0, 5), conflitos },
    semanas, orientacoes: "",
    fatores: { usado, faltando, observacoes },
  };
}

/* ── comparação entre duas versões (proposta de ajuste) ── */
function compararVersoes(a, b) {
  const m = [];
  const chave = (x) => x.tipo + "|" + (x.torneioId || x.rotulo);
  const ba = Object.fromEntries(((a.temporada || {}).blocos || []).map((x) => [chave(x), x])), bb = Object.fromEntries(((b.temporada || {}).blocos || []).map((x) => [chave(x), x]));
  const per = (x) => x.inicio.slice(8) + "/" + x.inicio.slice(5, 7) + " a " + x.fim.slice(8) + "/" + x.fim.slice(5, 7);
  const rot = { preparacao: "Preparação", competicao: "Competição", recuperacao: "Recuperação" };
  for (const k of Object.keys(bb)) {
    if (!ba[k]) m.push({ tipo: "adicionado", area: "temporada", texto: (rot[bb[k].tipo] || "Bloco") + " incluída: " + bb[k].rotulo + " (" + per(bb[k]) + ")" });
    else if (ba[k].inicio !== bb[k].inicio || ba[k].fim !== bb[k].fim) m.push({ tipo: "alterado", area: "temporada", texto: (rot[bb[k].tipo] || "Bloco") + " de " + bb[k].rotulo + ": de " + per(ba[k]) + " para " + per(bb[k]) });
  }
  for (const k of Object.keys(ba)) if (!bb[k]) m.push({ tipo: "removido", area: "temporada", texto: (rot[ba[k].tipo] || "Bloco") + " removida: " + ba[k].rotulo + " (" + per(ba[k]) + ")" });
  const sa = Object.fromEntries((a.semanas || []).map((s) => [s.inicio, s])), sb = Object.fromEntries((b.semanas || []).map((s) => [s.inicio, s]));
  for (const k of Object.keys(sb)) {
    if (!sa[k]) continue; // semanas que a versão anterior não cobria não são "mudança": só se compara o que existe nas duas
    if (sa[k].objetivo !== sb[k].objetivo) m.push({ tipo: "alterado", area: "semana", texto: "Semana de " + k.slice(8) + "/" + k.slice(5, 7) + ": objetivo era “" + sa[k].objetivo + "” e passa a ser “" + sb[k].objetivo + "”" });
    else if ((sa[k].atividades || []).length !== (sb[k].atividades || []).length) m.push({ tipo: "alterado", area: "semana", texto: "Semana de " + k.slice(8) + "/" + k.slice(5, 7) + ": " + (sa[k].atividades || []).length + " atividade(s) antes, " + (sb[k].atividades || []).length + " agora" });
  }
  const ca = ((a.temporada || {}).conflitos || []).length, cb = ((b.temporada || {}).conflitos || []).length;
  if (ca !== cb) m.push({ tipo: "alterado", area: "conflitos", texto: "Conflitos de calendário: " + ca + " antes, " + cb + " agora" });
  return m;
}

/* ── edição por atleta ou treinador: só o que é editável, tudo limitado ── */
function normalizarConteudo(c, anterior) {
  c = c || {};
  const ant = anterior || {};
  const objetivos = (Array.isArray(c.temporada && c.temporada.objetivos) ? c.temporada.objetivos : []).map((x) => txt(x, 120)).filter(Boolean).slice(0, 6);
  const blocos = (Array.isArray(c.temporada && c.temporada.blocos) ? c.temporada.blocos : []).slice(0, 80).map((b, i) => {
    if (!b || !["preparacao", "competicao", "recuperacao"].includes(b.tipo) || !dataValida(b.inicio) || !dataValida(b.fim) || b.fim < b.inicio) return null;
    return { id: txt(b.id, 80) || "bloco" + i, tipo: b.tipo, inicio: b.inicio, fim: b.fim, torneioId: ID.test(String(b.torneioId || "")) ? String(b.torneioId) : null, rotulo: txt(b.rotulo, 120), prioridade: PRIORIDADES.includes(b.prioridade) ? b.prioridade : "" };
  }).filter(Boolean);
  const semAnt = Object.fromEntries(((ant.semanas) || []).map((s) => [s.inicio, s]));
  const semanas = (Array.isArray(c.semanas) ? c.semanas : []).slice(0, 4).map((s, i) => {
    if (!s || !dataValida(s.inicio)) return null;
    const fim = addDias(s.inicio, 6), base = semAnt[s.inicio] || {};
    const focos = (Array.isArray(s.focos) ? s.focos : []).slice(0, 5).map((f) => ({ texto: txt(f && f.texto, 120), origem: ["foco", "devolutiva", "partida", "atleta", "treinador"].includes(f && f.origem) ? f.origem : "atleta", refId: ID.test(String((f && f.refId) || "")) ? String(f.refId) : null })).filter((f) => f.texto);
    const atividades = (Array.isArray(s.atividades) ? s.atividades : []).slice(0, 21).map((a, j) => {
      if (!a || !dataValida(a.data) || a.data < s.inicio || a.data > fim) return null;
      const titulo = txt(a.titulo, 100); if (!titulo) return null;
      const minutos = Number.isInteger(a.minutos) && a.minutos >= 5 && a.minutos <= 300 ? a.minutos : null;
      return { id: ID.test(String(a.id || "")) ? String(a.id) : "a" + a.data.replace(/-/g, "") + "x" + j, data: a.data, titulo, tipo: TIPO_ATIV.includes(a.tipo) ? a.tipo : "treino", minutos, foco: txt(a.foco, 120), obs: txt(a.obs, 200) };
    }).filter(Boolean);
    return { n: i + 1, inicio: s.inicio, fim, objetivo: txt(s.objetivo, 200), focos, eventos: base.eventos || [], atividades, revisao: s.revisao === true };
  }).filter(Boolean);
  if (!semanas.length) return { ok: false, erro: "O planejamento precisa ter pelo menos uma semana." };
  return { ok: true, conteudo: {
    temporada: { blocos, objetivos, conflitos: ((ant.temporada || {}).conflitos) || [] },
    semanas, orientacoes: txt(c.orientacoes, 1200), fatores: ant.fatores || { usado: [], faltando: [], observacoes: [] },
  } };
}

/* ── situação da versão ── */
function rotuloStatus(v) {
  if (v.status === "aprovado") return "Aprovado pelo treinador";
  if (v.status === "substituido") return "Substituído por uma nova versão";
  if (v.status === "em_revisao") return v.origem === "treinador" ? "Em revisão (rascunho do treinador)" : "Em revisão pelo treinador";
  return v.origem === "atleta" ? "Ajuste seu, sem revisão profissional" : "Sugestão da plataforma";
}
function publicoVersao(id, v) {
  return {
    id, versao: v.versao, status: v.status, rotulo: rotuloStatus(v), origem: v.origem, autorNome: v.autorNome || "", criadoEm: v.criadoEm,
    aprovadoPorNome: v.aprovadoPorNome || null, aprovadoEm: v.aprovadoEm || null, substituiId: v.substituiId || null, substituidoPor: v.substituidoPor || null, baseId: v.baseId || null,
    conteudo: v.conteudo, comparacao: v.comparacao || null, mudancas: v.mudancas || null, historico: (v.historico || []).slice(-20),
  };
}
/* a versão vigente: a aprovada mais recente; sem aprovada, a mais recente em andamento */
function vigente(versoes) {
  const ord = versoes.slice().sort((a, b) => b.versao - a.versao);
  return ord.find((v) => v.status === "aprovado") || ord.find((v) => v.status === "em_revisao") || ord.find((v) => v.status === "sugestao") || null;
}
function propostasAbertas(versoes, vig) {
  return versoes.filter((v) => ["sugestao", "em_revisao"].includes(v.status) && (!vig || v.id !== vig.id) && v.versao > (vig ? vig.versao : 0)).sort((a, b) => b.versao - a.versao);
}

module.exports = {
  STATUS, ORIGENS, PRIORIDADES, ROTULO_PRIORIDADE, TIPOS_COMPROMISSO, DIAS, MINUTOS, PARCEIROS, QUADRAS, MAX_VERSOES, MAX_COMPROMISSOS, MAX_EXECUCOES, ID, TIPO_ATIV, ROTULO_ORIGEM_FOCO,
  txt, dataValida, addDias, diasEntre, segundaDe, diaDaSemana,
  normalizarCompromisso, normalizarRotina, normalizarExecucao,
  torneiosAtivos, snapshotBase, hashBase, mudancasCalendario, gerarConteudo, compararVersoes, normalizarConteudo,
  rotuloStatus, publicoVersao, vigente, propostasAbertas,
};
