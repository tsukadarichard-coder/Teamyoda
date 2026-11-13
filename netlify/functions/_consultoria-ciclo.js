/* Consultoria com Richard Tsukada, Etapas 2 a 5 ("Pode fazer tudo", 13/11/2026): o acompanhamento online em ciclos.
   Regras puras (sem Firestore), para os testes rodarem sem servidor. Quem grava e lê é _consultoria-acomp.js.

   O centro é o CICLO de cada cliente (12 semanas por padrão): diagnóstico → plano (objetivo, 3 prioridades, metas medidas) →
   rotina da semana (tarefas + check-in) → encontros online (anotações e combinados que viram tarefas) → feedbacks (recados e
   devolutivas) → análises → relatório do ciclo e renovação. Alto rendimento é uma aba que o Richard liga por cliente (torneios
   com prioridade, fase do momento e carga = minutos × esforço). Formatos (pacotes) só organizam o que foi combinado: sem cobrança.

   Firestore (só pelas functions):
   · consultoriaCiclos/{id}     → { uid, numero, inicio (segunda-feira), semanas, objetivo, prioridades[], metas[], diagnostico,
                                    formato?, estado: "ativo" | "encerrado", relatorio?, criadoEm, encerradoEm? }
   · consultoriaTarefas/{id}    → { uid, cicloId, semana, titulo, tipo, detalhe, estado: "aberta" | "feita", comentario?, feitaEm?, origem?, criadoEm }
   · consultoriaEncontros/{id}  → { uid, cicloId, quando, duracaoMin, link, pauta, estado: "marcado" | "feito" | "cancelado",
                                    notas, combinados[], notaPrivada (só o Richard), avisos{}, criadoEm }
   · consultoriaCheckins/{uid_semana} → { uid, cicloId, semana, nota 1–5, texto, duvida, resposta?, criadoEm }
   · consultoriaAnalises/{id}   → { uid, cicloId, tipo, titulo, resumo, link?, numeros[], criadoEm }
   · consultoriaAR/{uid}        → { ligado, torneios[], registros[] }
   · consultoriaConfig/geral    → { linkEncontro, modelos[], formatos[] } */

const TIPOS_TAREFA = [["treino", "Treino"], ["mental", "Mental"], ["video", "Mandar vídeo"], ["jogo", "Marcar jogo no Scout"], ["conteudo", "Assistir ou ler"], ["outro", "Outro"]];
const TIPOS_ANALISE = [["scout", "Scout de jogo"], ["video", "Análise de vídeo"], ["movimento", "Análise de movimento"], ["torneio", "Torneio"], ["outro", "Outra"]];
const PRIORIDADES_TORNEIO = [["A", "Principal"], ["B", "Importante"], ["C", "Preparação"]];
const FASES = { base: "Base", especifica: "Específica", pre: "Pré-competitiva", competicao: "Competição", transicao: "Transição" };
const L = { semanasPadrao: 12, semanasMin: 4, semanasMax: 52, prioridades: 3, metasMax: 6, tituloMax: 120, textoMax: 4000, curtoMax: 300,
  tarefasSemanaMax: 15, combinadosMax: 10, numerosMax: 8, torneiosMax: 40, registrosMax: 400, modelosMax: 60, formatosMax: 10 };
const DATA = /^\d{4}-\d{2}-\d{2}$/, ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

const { Erro } = require("./_consultoria"); // a mesma classe de erro do resto da consultoria (o handler reconhece)
const txt = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ").trim().slice(0, n);
const linha = (v, n) => txt(v, n).replace(/\s+/g, " ");
const temTipo = (lista, v) => lista.some((x) => x[0] === v);
const rotulo = (lista, v) => { const x = lista.filter((y) => y[0] === v)[0]; return x ? x[1] : ""; };
const idCurto = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/* ── datas: semanas começam na segunda-feira, no horário de Brasília ── */
const hojeBR = (ms) => new Date((ms == null ? Date.now() : ms) - 3 * 3600000).toISOString().slice(0, 10);
function somaDias(data, n) { const d = new Date(data + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function segunda(data) { const d = new Date(data + "T12:00:00Z"), dow = (d.getUTCDay() + 6) % 7; return somaDias(data, -dow); }
const semanaDe = (ms) => segunda(hojeBR(ms));
function diasEntre(a, b) { return Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000); }
/* número da semana do ciclo (1 = primeira) para uma segunda-feira */
function numeroDaSemana(ciclo, semana) { return Math.floor(diasEntre(ciclo.inicio, semana) / 7) + 1; }
function fimDoCiclo(ciclo) { return somaDias(ciclo.inicio, ciclo.semanas * 7 - 1); }

/* ── ciclo ── */
function limparMetas(lista) {
  return (Array.isArray(lista) ? lista : []).slice(0, L.metasMax).map((m) => {
    const texto = linha(m && m.texto, L.curtoMax); if (texto.length < 3) return null;
    const num = (v) => (v === "" || v == null || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 100) / 100);
    return { id: /^[a-z0-9]{6,20}$/.test(String(m.id || "")) ? m.id : idCurto(), texto, inicial: num(m.inicial), alvo: num(m.alvo), atual: num(m.atual), unidade: linha(m.unidade, 12) };
  }).filter(Boolean);
}
function limparCiclo(b, atual, hoje) {
  const inicio = DATA.test(String(b.inicio || "")) ? segunda(b.inicio) : atual ? atual.inicio : semanaDe();
  const sem = Math.round(Number(b.semanas || (atual && atual.semanas) || L.semanasPadrao));
  if (!(sem >= L.semanasMin && sem <= L.semanasMax)) throw new Erro(400, "O ciclo tem de " + L.semanasMin + " a " + L.semanasMax + " semanas.");
  const prioridades = (Array.isArray(b.prioridades) ? b.prioridades : []).map((x) => linha(x, L.curtoMax)).filter((x) => x.length >= 2).slice(0, L.prioridades);
  const objetivo = txt(b.objetivo, L.textoMax);
  return { inicio, semanas: sem, objetivo, prioridades, metas: limparMetas(b.metas), diagnostico: txt(b.diagnostico, L.textoMax),
    formato: b.formato && typeof b.formato === "object" ? limparFormato(b.formato) : (atual && atual.formato) || null };
}
function cicloPublico(id, c, hoje) {
  if (!c) return null;
  const sem = semanaDe(hoje ? Date.parse(hoje + "T15:00:00Z") : undefined), n = numeroDaSemana(c, sem);
  return { id, numero: c.numero || 1, inicio: c.inicio, fim: fimDoCiclo(c), semanas: c.semanas, semanaAtual: Math.max(1, Math.min(c.semanas, n)), passou: n > c.semanas,
    objetivo: c.objetivo || "", prioridades: c.prioridades || [], metas: c.metas || [], diagnostico: c.diagnostico || "", formato: c.formato || null,
    estado: c.estado, relatorio: c.relatorio && c.relatorio.publicadoEm ? c.relatorio : null, criadoEm: c.criadoEm, encerradoEm: c.encerradoEm || null };
}
/* progresso de uma meta: 0–100, sabendo se maior ou menor é melhor (pelo alvo em relação ao inicial) */
function progressoMeta(m) {
  if (m.inicial == null || m.alvo == null || m.atual == null || m.alvo === m.inicial) return null;
  return Math.max(0, Math.min(100, Math.round(((m.atual - m.inicial) / (m.alvo - m.inicial)) * 100)));
}

/* ── tarefas ── */
function limparTarefa(b) {
  const titulo = linha(b.titulo, L.tituloMax), tipo = temTipo(TIPOS_TAREFA, b.tipo) ? b.tipo : "treino";
  if (titulo.length < 2) throw new Erro(400, "Escreva a tarefa.");
  const semana = DATA.test(String(b.semana || "")) ? segunda(b.semana) : semanaDe();
  return { titulo, tipo, detalhe: txt(b.detalhe, L.textoMax), semana };
}
function tarefaPublica(id, t) {
  return { id, semana: t.semana, titulo: t.titulo, tipo: t.tipo, rotuloTipo: rotulo(TIPOS_TAREFA, t.tipo), detalhe: t.detalhe || "", estado: t.estado,
    comentario: t.comentario || "", feitaEm: t.feitaEm || null, origem: t.origem || null, criadoEm: t.criadoEm };
}
/* adesão: % de tarefas feitas entre as que já venceram (semanas anteriores à atual) e as da semana atual que já foram feitas */
function adesao(tarefas, semanaAtual) {
  const contam = tarefas.filter((t) => t.semana < semanaAtual || t.estado === "feita");
  if (!contam.length) return null;
  return Math.round((contam.filter((t) => t.estado === "feita").length / contam.length) * 100);
}

/* ── encontros ── */
function limparEncontro(b, linkPadrao) {
  const quando = String(b.quando || "");
  if (!ISO.test(quando) || !Number.isFinite(Date.parse(quando))) throw new Erro(400, "Escolha a data e a hora do encontro.");
  const dur = Math.round(Number(b.duracaoMin || 45));
  let link = txt(b.link, 300) || linkPadrao || "";
  if (link && !/^https:\/\/[^\s]+$/.test(link)) throw new Erro(400, "O link do encontro precisa começar com https://");
  const estado = ["marcado", "feito", "cancelado"].includes(b.estado) ? b.estado : "marcado";
  const combinados = (Array.isArray(b.combinados) ? b.combinados : []).map((x) => linha(x, L.tituloMax)).filter((x) => x.length >= 2).slice(0, L.combinadosMax);
  return { quando: new Date(Date.parse(quando)).toISOString(), duracaoMin: dur >= 10 && dur <= 240 ? dur : 45, link, pauta: txt(b.pauta, L.textoMax), estado,
    notas: txt(b.notas, L.textoMax), combinados, notaPrivada: txt(b.notaPrivada, L.textoMax) };
}
function encontroPublico(id, e, paraRichard) {
  const o = { id, quando: e.quando, duracaoMin: e.duracaoMin, link: e.estado === "marcado" ? e.link || "" : "", pauta: e.pauta || "", estado: e.estado,
    notas: e.notas || "", combinados: e.combinados || [], combinadosViraramTarefas: !!e.combinadosViraramTarefas };
  if (paraRichard) { o.link = e.link || ""; o.notaPrivada = e.notaPrivada || ""; }
  return o;
}
/* avisos: véspera (entre 23 e 25 h antes) e 1 hora antes (entre 40 e 80 min) — cada um uma vez */
function avisosDevidos(e, agoraMs) {
  if (e.estado !== "marcado") return [];
  const falta = Date.parse(e.quando) - agoraMs, feitos = e.avisos || {}, out = [];
  if (!feitos.vespera && falta <= 25 * 3600000 && falta > 23 * 3600000) out.push("vespera");
  if (!feitos.hora && falta <= 80 * 60000 && falta > 40 * 60000) out.push("hora");
  return out;
}

/* ── check-in semanal ── */
function limparCheckin(b) {
  const nota = Math.round(Number(b.nota));
  if (!(nota >= 1 && nota <= 5)) throw new Erro(400, "Dê uma nota de 1 a 5 para a semana.");
  return { nota, texto: txt(b.texto, L.textoMax), duvida: txt(b.duvida, L.textoMax) };
}
const idCheckin = (uid, semana) => uid + "_" + semana;

/* ── análises ── */
function limparAnalise(b) {
  const titulo = linha(b.titulo, L.tituloMax), tipo = temTipo(TIPOS_ANALISE, b.tipo) ? b.tipo : "outro";
  if (titulo.length < 2) throw new Erro(400, "Dê um título para a análise.");
  const link = txt(b.link, 400);
  if (link && !/^https:\/\/[^\s]+$/.test(link)) throw new Erro(400, "O link precisa começar com https://");
  const numeros = (Array.isArray(b.numeros) ? b.numeros : []).map((n) => ({ rotulo: linha(n && n.rotulo, 60), valor: linha(n && n.valor, 30) })).filter((n) => n.rotulo && n.valor).slice(0, L.numerosMax);
  return { titulo, tipo, resumo: txt(b.resumo, L.textoMax), link, numeros, data: DATA.test(String(b.data || "")) ? b.data : hojeBR() };
}
function analisePublica(id, a) { return { id, titulo: a.titulo, tipo: a.tipo, rotuloTipo: rotulo(TIPOS_ANALISE, a.tipo), resumo: a.resumo || "", link: a.link || "", numeros: a.numeros || [], data: a.data, criadoEm: a.criadoEm }; }

/* ── alto rendimento ── */
function limparTorneio(b) {
  const nome = linha(b.nome, 100);
  if (nome.length < 2) throw new Erro(400, "Escreva o nome do torneio.");
  if (!DATA.test(String(b.inicio || ""))) throw new Erro(400, "Escolha a data de início do torneio.");
  const fim = DATA.test(String(b.fim || "")) && b.fim >= b.inicio ? b.fim : b.inicio;
  return { id: /^[a-z0-9]{6,20}$/.test(String(b.id || "")) ? b.id : idCurto(), nome, inicio: b.inicio, fim, prioridade: temTipo(PRIORIDADES_TORNEIO, b.prioridade) ? b.prioridade : "B",
    resultado: linha(b.resultado, 120) };
}
function limparRegistro(b) {
  const tipo = b.tipo === "jogo" ? "jogo" : "treino", min = Math.round(Number(b.minutos)), pse = Math.round(Number(b.pse));
  if (!DATA.test(String(b.data || ""))) throw new Erro(400, "Escolha a data.");
  if (!(min >= 5 && min <= 600)) throw new Erro(400, "Minutos entre 5 e 600.");
  if (!(pse >= 1 && pse <= 10)) throw new Erro(400, "Esforço de 1 a 10.");
  return { id: idCurto(), data: b.data, tipo, minutos: min, pse, carga: min * pse, nota: linha(b.nota, 200) };
}
/* fase do momento pelo calendário: o próximo torneio principal (A) manda; sem A, o próximo B */
function faseAtual(torneios, hoje) {
  const lista = (torneios || []).slice().sort((a, b) => a.inicio.localeCompare(b.inicio));
  const emCurso = lista.filter((t) => t.inicio <= hoje && t.fim >= hoje)[0];
  if (emCurso) return { fase: "competicao", rotulo: FASES.competicao, torneio: emCurso, dias: 0 };
  const recente = lista.filter((t) => t.fim < hoje && diasEntre(t.fim, hoje) <= 7 && t.prioridade === "A")[0];
  const prox = lista.filter((t) => t.inicio > hoje && t.prioridade === "A")[0] || lista.filter((t) => t.inicio > hoje && t.prioridade === "B")[0];
  if (recente && (!prox || diasEntre(hoje, prox.inicio) > 14)) return { fase: "transicao", rotulo: FASES.transicao, torneio: recente, dias: diasEntre(recente.fim, hoje) };
  if (!prox) return { fase: "base", rotulo: FASES.base, torneio: null, dias: null };
  const d = diasEntre(hoje, prox.inicio), fase = d <= 7 ? "pre" : d <= 28 ? "especifica" : "base";
  return { fase, rotulo: FASES[fase], torneio: prox, dias: d };
}
/* carga por semana (minutos × esforço), das últimas n semanas, mais antiga primeiro */
function cargaSemanal(registros, hoje, n) {
  const sem0 = segunda(hoje), out = [];
  for (let i = (n || 6) - 1; i >= 0; i--) {
    const s = somaDias(sem0, -7 * i), f = somaDias(s, 6), rs = (registros || []).filter((r) => r.data >= s && r.data <= f);
    out.push({ semana: s, carga: rs.reduce((a, r) => a + r.carga, 0), sessoes: rs.length, jogos: rs.filter((r) => r.tipo === "jogo").length });
  }
  return out;
}

/* ── formatos e modelos (Ajustes do Richard) ── */
function limparFormato(f) {
  const nome = linha(f && f.nome, 60); if (nome.length < 2) return null;
  const n = (v, max) => { v = Math.round(Number(v)); return v >= 0 && v <= max ? v : 0; };
  return { id: /^[a-z0-9]{6,20}$/.test(String(f.id || "")) ? f.id : idCurto(), nome, semanas: n(f.semanas, L.semanasMax) || L.semanasPadrao, encontros: n(f.encontros, 60), analises: n(f.analises, 60), videosMes: n(f.videosMes, 60), descricao: txt(f.descricao, 400) };
}
function limparConfig(b) {
  const link = txt(b.linkEncontro, 300);
  if (link && !/^https:\/\/[^\s]+$/.test(link)) throw new Erro(400, "O link fixo precisa começar com https://");
  const modelos = (Array.isArray(b.modelos) ? b.modelos : []).map((m) => { try { const t = limparTarefa({ ...m, semana: "2026-01-05" }); return { titulo: t.titulo, tipo: t.tipo, detalhe: t.detalhe }; } catch (e) { return null; } }).filter(Boolean).slice(0, L.modelosMax);
  const formatos = (Array.isArray(b.formatos) ? b.formatos : []).map(limparFormato).filter(Boolean).slice(0, L.formatosMax);
  return { linkEncontro: link, modelos, formatos };
}
/* uso do formato no ciclo: encontros feitos/combinados e análises entregues */
function usoDoFormato(formato, encontros, analises) {
  if (!formato) return null;
  return { encontros: { feitos: encontros.filter((e) => e.estado === "feito").length, total: formato.encontros }, analises: { feitas: analises.length, total: formato.analises } };
}

/* ── relatório do ciclo: rascunho montado com os dados (o Richard revisa e publica) ── */
function rascunhoRelatorio(ciclo, d) {
  const metas = (ciclo.metas || []).map((m) => {
    const p = progressoMeta(m), v = (x) => (x == null ? "—" : String(x).replace(".", ",") + (m.unidade ? " " + m.unidade : ""));
    return "• " + m.texto + ": " + v(m.inicial) + " → " + v(m.atual) + (m.alvo != null ? " (meta " + v(m.alvo) + ")" : "") + (p != null ? " — " + p + "% do caminho" : "");
  });
  const partes = [];
  partes.push("Ciclo " + (ciclo.numero || 1) + " · " + ciclo.semanas + " semanas" + (ciclo.objetivo ? "\nObjetivo: " + ciclo.objetivo : ""));
  if (metas.length) partes.push("Metas\n" + metas.join("\n"));
  partes.push("O que fizemos\n• " + d.encontrosFeitos + (d.encontrosFeitos === 1 ? " encontro" : " encontros") + "\n• " + d.devolutivas + (d.devolutivas === 1 ? " devolutiva de vídeo" : " devolutivas de vídeo") +
    "\n• " + d.analises + (d.analises === 1 ? " análise" : " análises") + "\n• Tarefas: " + d.tarefasFeitas + " de " + d.tarefas + " feitas" + (d.adesao != null ? " (" + d.adesao + "%)" : "") +
    "\n• Check-ins: " + d.checkins + " de " + d.semanas + " semanas" + (d.notaMedia != null ? " · nota média da semana " + String(d.notaMedia).replace(".", ",") : ""));
  if (ciclo.prioridades && ciclo.prioridades.length) partes.push("Prioridades do ciclo\n" + ciclo.prioridades.map((p) => "• " + p).join("\n"));
  partes.push("Próximo passo\n(escreva aqui o foco do próximo ciclo)");
  return partes.join("\n\n");
}

module.exports = { TIPOS_TAREFA, TIPOS_ANALISE, PRIORIDADES_TORNEIO, FASES, L, Erro, txt, hojeBR, somaDias, segunda, semanaDe, diasEntre, numeroDaSemana, fimDoCiclo,
  limparMetas, limparCiclo, cicloPublico, progressoMeta, limparTarefa, tarefaPublica, adesao, limparEncontro, encontroPublico, avisosDevidos, limparCheckin, idCheckin,
  limparAnalise, analisePublica, limparTorneio, limparRegistro, faseAtual, cargaSemanal, limparFormato, limparConfig, usoDoFormato, rascunhoRelatorio };
