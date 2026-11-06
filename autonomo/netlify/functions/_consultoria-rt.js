/* QuadraLab Competição — Consultoria com Richard Tsukada (regras puras, sem Firebase).

   Desenvolvimento de tenistas juvenis (a partir de 15 anos, torneios CBT ou acima, objetivo universitário nos EUA, profissional ou ambos).
   Fluxo: cadastro de entrada → equipe autorizada → três partidas completas → diagnóstico → plano de 90 dias publicado → registros
   (pós-jogo do atleta, trabalho do treinador) → revisão e relatório. Conduzido por Richard; a plataforma organiza e dá continuidade.
   Não promete bolsa, recrutamento, ranking nem carreira: nenhum índice de potencial ou probabilidade é calculado aqui.

   Reaproveita o que o Competição já tem: a conta do atleta (jogadores/{uid}: nome, competicao.nascimento, competicao.rotina), os vínculos
   (vinculos/{id}: responsável e treinador, convite por código, aprovação e revogação), as partidas (jogadores/{uid}/partidas), os torneios
   (jogadores/{uid}/torneios) e os compromissos (jogadores/{uid}/compCompromissos). A consultoria guarda só o que é dela e aponta para eles.

   Papéis: consultor (o e-mail da conta, conferido no servidor) · atleta (dono) · treinador e responsável (vínculo ATIVO do atleta incluído na
   equipe da consultoria). Visibilidade: o que o consultor publica tem destinatários (atleta, treinador, responsável); rascunhos e notas privadas
   só o consultor vê; o registro do atleta ou do treinador tem "quem vê" escolhido por quem escreve. */
const crypto = require("crypto");

/* ── quem é o consultor ── */
const CONSULTORES_SHA256 = ["e1126d15075fac96f732a472a63da5782ad3ba8d3f727da3bec8902fa37f679f"]; // Richard Tsukada
function ehConsultor(email) {
  const e = String(email || "").trim().toLowerCase();
  if (!e) return false;
  const extra = String(process.env.CONSULTORES_EMAILS || "").toLowerCase().split(",").map((x) => x.trim()).filter(Boolean);
  return extra.includes(e) || CONSULTORES_SHA256.includes(crypto.createHash("sha256").update(e).digest("hex"));
}
const NOME_SERVICO = "Consultoria com Richard Tsukada";
const NOME_CONSULTOR = "Richard Tsukada";
const IDADE_MINIMA = 15, DIAS_CICLO = 90;

/* ── utilidades ── */
const txt = (v, n) => String(v == null ? "" : v).replace(/[ \t]+/g, " ").replace(/\r/g, "").trim().slice(0, n);
const DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
function dataValida(s) {
  const m = DATA.exec(String(s || "")); if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}
const addDias = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const diasEntre = (a, b) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000);
function linkHttps(u) {
  const s = String(u || "").trim(); if (!s) return "";
  try { const x = new URL(s); return x.protocol === "https:" && !x.username && !x.password && s.length <= 300 ? x.toString() : null; } catch (e) { return null; }
}
const TEMPO = /^(\d{1,2}:)?\d{1,2}:\d{2}$/; // 12:34 ou 1:02:03
function tempoValido(t) { const s = String(t || "").trim(); return TEMPO.test(s) ? s : ""; }
function novoId() { return crypto.randomBytes(9).toString("base64url").replace(/[^A-Za-z0-9]/g, "x"); }
function de(lista, v, padrao) { return Object.prototype.hasOwnProperty.call(lista, v) ? v : padrao; }

/* ── listas fechadas ── */
const ESTADOS = { ativa: "Em andamento", pausada: "Pausada", encerrada: "Encerrada" };
const OBJETIVOS = { universitario: "Tênis universitário nos EUA", profissional: "Transição para o profissional", ambos: "Universitário e profissional", indefinido: "Ainda em definição" };
const PAPEIS_EQUIPE = { treinador: "Treinador", responsavel: "Responsável" };
const DESTINOS = ["atleta", "treinador", "responsavel"];
const ROT_DESTINO = { atleta: "Atleta", treinador: "Treinador", responsavel: "Responsáveis", consultor: "Richard" };
const RESPONSAVEIS_ACAO = { atleta: "Atleta", treinador: "Treinador", responsavel: "Responsável", consultor: "Richard" };
const STATUS_PARTIDA = { aguardando_material: "Aguardando material", recebido: "Material recebido", em_analise: "Em análise", concluido: "Análise concluída" };
const SUPERFICIES = { saibro: "Saibro", rapida: "Quadra rápida", grama: "Grama", indoor: "Coberta" };
const NATUREZAS = { observacao: "Observação", interpretacao: "Interpretação", recomendacao: "Recomendação", hipotese: "A verificar" };
const SECOES_DIAG = {
  fortes: { rotulo: "Pontos fortes", natureza: "observacao" },
  padroes: { rotulo: "Padrões recorrentes", natureza: "observacao" },
  dificuldades: { rotulo: "Dificuldades observadas", natureza: "observacao" },
  prioridades: { rotulo: "Prioridades de desenvolvimento", natureza: "recomendacao" },
  questoes: { rotulo: "Questões a verificar", natureza: "hipotese" },
};
const ETAPAS = { cadastro: "Cadastro", diagnostico: "Diagnóstico", plano: "Plano em preparo", acompanhamento: "Acompanhamento", revisao: "Revisão", encerrada: "Encerrada" };
const MAX_PRIORIDADES = 3, MAX_ACOES = 6, MAX_ITENS_SECAO = 8, MAX_EVID = 6, MAX_MARCACOES = 40;

/* ── cadastro de entrada (salvar e continuar depois: nada é obrigatório para salvar) ── */
function normalizarEntrada(b, anterior) {
  b = b || {}; const a = anterior || {};
  const rankings = (Array.isArray(b.rankings) ? b.rankings : a.rankings || []).slice(0, 8).map((r) => ({ nome: txt(r && r.nome, 60), posicao: txt(r && r.posicao, 30), fonte: txt(r && r.fonte, 80), data: dataValida(r && r.data) ? r.data : "" })).filter((r) => r.nome || r.posicao);
  const o = {
    treinadorNome: txt(b.treinadorNome, 80), localTreino: txt(b.localTreino, 120), historico: txt(b.historico, 1500), rankings,
    objetivo: de(OBJETIVOS, b.objetivo, ""), objetivoObs: txt(b.objetivoObs, 400),
    etapaEscolar: txt(b.etapaEscolar, 80), conclusaoPrevista: txt(b.conclusaoPrevista, 20),
    viagens: txt(b.viagens, 600), restricoes: txt(b.restricoes, 600), expectativaAtleta: txt(b.expectativaAtleta, 800), expectativaFamilia: txt(b.expectativaFamilia, 800),
  };
  return o;
}
/* o mínimo útil para começar o diagnóstico: objetivo e histórico competitivo (o resto pode vir depois) */
function entradaPronta(e) { return !!(e && e.objetivo && e.historico); }
const CAMPOS_FAMILIA = ["expectativaFamilia", "viagens", "restricoes", "etapaEscolar", "conclusaoPrevista"];

/* ── partidas do diagnóstico (três completas) ── */
function partidasIniciais() { return [1, 2, 3].map((n) => ({ n, status: "aguardando_material", partidaId: null, data: "", torneio: "", categoria: "", superficie: "", adversario: "", placar: "", video: "", contexto: "", marcacoes: [], obs: "" })); }
function normalizarPartidaDiag(b, anterior, quem) {
  b = b || {}; const a = anterior || {};
  const video = linkHttps(b.video);
  if (video === null) return { ok: false, erro: "O link do vídeo precisa começar com https://." };
  if (b.data && !dataValida(b.data)) return { ok: false, erro: "Data da partida inválida." };
  const o = { ...a,
    data: b.data !== undefined ? (b.data || "") : a.data || "", torneio: b.torneio !== undefined ? txt(b.torneio, 100) : a.torneio || "", categoria: b.categoria !== undefined ? txt(b.categoria, 40) : a.categoria || "",
    superficie: b.superficie !== undefined ? de(SUPERFICIES, b.superficie, "") : a.superficie || "", adversario: b.adversario !== undefined ? txt(b.adversario, 80) : a.adversario || "",
    placar: b.placar !== undefined ? txt(b.placar, 40) : a.placar || "", video: b.video !== undefined ? video : a.video || "", contexto: b.contexto !== undefined ? txt(b.contexto, 800) : a.contexto || "",
  };
  if (quem === "consultor") {
    if (b.marcacoes !== undefined) o.marcacoes = (Array.isArray(b.marcacoes) ? b.marcacoes : []).slice(0, MAX_MARCACOES).map((m) => ({ tempo: tempoValido(m && m.tempo), nota: txt(m && m.nota, 300) })).filter((m) => m.nota);
    if (b.obs !== undefined) o.obs = txt(b.obs, 3000);
    if (b.status !== undefined) { if (!STATUS_PARTIDA[b.status]) return { ok: false, erro: "Situação inválida." }; o.status = b.status; }
  }
  /* a situação acompanha o material: sem vídeo não há como estar recebido; o consultor avança para análise e conclusão */
  if (!o.video && (o.status === "recebido" || o.status === "em_analise" || o.status === "concluido")) o.status = "aguardando_material";
  else if (o.video && o.status === "aguardando_material") o.status = "recebido";
  return { ok: true, dados: o };
}
function partidasConcluidas(lista) { return (lista || []).filter((p) => p.status === "concluido").length; }
/* o que atleta, treinador e responsável veem de cada partida do diagnóstico: sem as marcações e observações de trabalho do consultor */
function partidaDiagPublica(p) { const { obs, marcacoes, ...r } = p; return r; }

/* ── diagnóstico: observação, interpretação e recomendação separadas; publicar só com as três partidas concluídas ── */
function normalizarDiagnostico(b) {
  b = b || {}; const secoes = {};
  for (const k of Object.keys(SECOES_DIAG)) {
    secoes[k] = (Array.isArray(b.secoes && b.secoes[k]) ? b.secoes[k] : []).slice(0, MAX_ITENS_SECAO).map((it) => {
      it = it || {};
      return { texto: txt(it.texto, 600), natureza: de(NATUREZAS, it.natureza, SECOES_DIAG[k].natureza),
        evidencias: (Array.isArray(it.evidencias) ? it.evidencias : []).slice(0, MAX_EVID).map((e) => ({ partida: [1, 2, 3].includes(Number(e && e.partida)) ? Number(e.partida) : null, tempo: tempoValido(e && e.tempo), nota: txt(e && e.nota, 200) })).filter((e) => e.partida) };
    }).filter((it) => it.texto);
  }
  return { secoes, sintese: txt(b.sintese, 1500) };
}
function errosPublicarDiagnostico(d, partidas) {
  const erros = [], n = partidasConcluidas(partidas);
  if (n < 3) erros.push("Faltam " + (3 - n) + (3 - n === 1 ? " partida" : " partidas") + " com a análise concluída. O diagnóstico só é publicado com as três.");
  const itens = Object.keys(SECOES_DIAG).reduce((s, k) => s + d.secoes[k].length, 0);
  if (!itens) erros.push("O diagnóstico está vazio.");
  if (!d.secoes.prioridades.length) erros.push("Defina ao menos uma prioridade de desenvolvimento.");
  ["fortes", "padroes", "dificuldades"].forEach((k) => d.secoes[k].forEach((it) => { if (it.natureza === "observacao" && !it.evidencias.length) erros.push("“" + it.texto.slice(0, 50) + "”: uma observação precisa citar ao menos uma partida como evidência (ou marque como interpretação ou “a verificar”)."); }));
  return erros;
}

/* ── plano de 90 dias: versões (rascunho → em comentário do treinador → publicado → substituído) ── */
const ESTADOS_PLANO = { rascunho: "Rascunho", em_comentario: "Com o treinador para comentar", publicado: "Publicado", substituido: "Substituído" };
function normalizarPlano(b, hoje) {
  b = b || {};
  const inicio = dataValida(b.inicio) ? b.inicio : hoje, fim = dataValida(b.fim) && b.fim >= inicio ? b.fim : addDias(inicio, DIAS_CICLO - 1);
  const revisaoEm = dataValida(b.revisaoEm) ? b.revisaoEm : addDias(inicio, 44);
  const prioridades = (Array.isArray(b.prioridades) ? b.prioridades : []).slice(0, MAX_PRIORIDADES).map((p, i) => {
    p = p || {};
    return { id: /^[A-Za-z0-9_-]{4,30}$/.test(String(p.id || "")) ? String(p.id) : "pr" + (i + 1) + novoId().slice(0, 6),
      titulo: txt(p.titulo, 120), situacaoInicial: txt(p.situacaoInicial, 600), indicador: txt(p.indicador, 300),
      acoes: (Array.isArray(p.acoes) ? p.acoes : []).slice(0, MAX_ACOES).map((a, j) => {
        a = a || {};
        return { id: /^[A-Za-z0-9_-]{4,30}$/.test(String(a.id || "")) ? String(a.id) : "ac" + (i + 1) + (j + 1) + novoId().slice(0, 6), texto: txt(a.texto, 300), responsavel: de(RESPONSAVEIS_ACAO, a.responsavel, "atleta"), prazo: dataValida(a.prazo) ? a.prazo : "" };
      }).filter((a) => a.texto) };
  }).filter((p) => p.titulo);
  return { objetivo: txt(b.objetivo, 400), inicio, fim, revisaoEm, prioridades, calendario: txt(b.calendario, 1200), torneioIds: (Array.isArray(b.torneioIds) ? b.torneioIds : []).filter((x) => /^[A-Za-z0-9_-]{8,40}$/.test(String(x))).slice(0, 20) };
}
function errosPublicarPlano(p) {
  const e = [];
  if (!p.objetivo) e.push("Escreva o objetivo principal do ciclo.");
  if (!p.prioridades.length) e.push("Inclua ao menos uma prioridade (até três).");
  p.prioridades.forEach((x) => {
    if (!x.situacaoInicial) e.push("“" + x.titulo + "”: descreva a situação inicial.");
    if (!x.indicador) e.push("“" + x.titulo + "”: diga o indicador ou a evidência que vai mostrar a mudança.");
    if (!x.acoes.length) e.push("“" + x.titulo + "”: inclua ao menos uma ação, com responsável.");
    x.acoes.forEach((a) => { if (!a.prazo) e.push("“" + a.texto.slice(0, 40) + "”: defina o prazo."); });
  });
  if (p.revisaoEm < p.inicio || p.revisaoEm > p.fim) e.push("A data de revisão precisa estar dentro do ciclo.");
  return e;
}
function planoVigente(versoes) { return (versoes || []).filter((v) => v.estado === "publicado").sort((a, b) => b.versao - a.versao)[0] || null; }

/* ── registros (pós-jogo do atleta, trabalho do treinador) e quem vê ── */
const VER_PADRAO = { atleta: ["consultor"], treinador: ["consultor", "atleta"], responsavel: ["consultor"] };
function normalizarVisivel(lista, autorPapel) {
  const ok = ["consultor", "atleta", "treinador", "responsavel"].filter((x) => Array.isArray(lista) && lista.includes(x) && x !== autorPapel);
  return [...new Set(["consultor"].concat(ok))];
}
function normalizarPosJogo(b) {
  b = b || {};
  const o = { aplicou: txt(b.aplicou, 600), dificuldade: txt(b.dificuldade, 600), obs: txt(b.obs, 1200) };
  if (!o.aplicou && !o.dificuldade && !o.obs) return { ok: false, erro: "Escreva ao menos uma linha sobre o jogo." };
  return { ok: true, dados: o };
}
function normalizarTreino(b, hoje) {
  b = b || {};
  const data = dataValida(b.data) && b.data <= hoje ? b.data : hoje;
  const o = { data, trabalhado: txt(b.trabalhado, 800), resposta: txt(b.resposta, 600), dificuldades: txt(b.dificuldades, 600), ajustes: txt(b.ajustes, 600), prioridadeId: /^[A-Za-z0-9_-]{4,30}$/.test(String(b.prioridadeId || "")) ? String(b.prioridadeId) : null };
  if (!o.trabalhado) return { ok: false, erro: "Escreva o que foi trabalhado." };
  return { ok: true, dados: o };
}
function podeVerRegistro(r, papel, uid) { return papel === "consultor" || r.autorUid === uid || (Array.isArray(r.visivelPara) && r.visivelPara.includes(papel)); }

/* ── análises de jogo e relatórios do consultor: rascunho até publicar, com destinatários ── */
function normalizarDestinos(lista) { return DESTINOS.filter((d) => Array.isArray(lista) && lista.includes(d)); }
function normalizarAnalise(b) {
  b = b || {};
  return { partidaId: /^[A-Za-z0-9_-]{8,40}$/.test(String(b.partidaId || "")) ? String(b.partidaId) : null, titulo: txt(b.titulo, 120), resumo: txt(b.resumo, 3000),
    marcacoes: (Array.isArray(b.marcacoes) ? b.marcacoes : []).slice(0, MAX_MARCACOES).map((m) => ({ tempo: tempoValido(m && m.tempo), texto: txt(m && m.texto, 300) })).filter((m) => m.texto),
    destinatarios: normalizarDestinos(b.destinatarios || ["atleta"]) };
}
function normalizarRelatorio(b) {
  b = b || {};
  return {
    tipo: b.tipo === "final" ? "final" : "revisao", titulo: txt(b.titulo, 120), periodoDe: dataValida(b.periodoDe) ? b.periodoDe : "", periodoAte: dataValida(b.periodoAte) ? b.periodoAte : "",
    objetivo: txt(b.objetivo, 400),
    prioridades: (Array.isArray(b.prioridades) ? b.prioridades : []).slice(0, MAX_PRIORIDADES).map((p) => ({ titulo: txt(p && p.titulo, 120), evidencias: txt(p && p.evidencias, 1200), evolucao: txt(p && p.evolucao, 1000), dificuldades: txt(p && p.dificuldades, 800) })).filter((p) => p.titulo),
    indicadores: (Array.isArray(b.indicadores) ? b.indicadores : []).slice(0, 10).map((i) => ({ nome: txt(i && i.nome, 80), valor: txt(i && i.valor, 80), fonte: txt(i && i.fonte, 120) })).filter((i) => i.nome && i.valor),
    proximasAcoes: txt(b.proximasAcoes, 1200), decisoes: txt(b.decisoes, 1200),
    destinatarios: normalizarDestinos(b.destinatarios || ["atleta", "responsavel"]),
  };
}
function errosPublicarRelatorio(r) {
  const e = [];
  if (!r.titulo) e.push("Dê um título ao relatório.");
  if (!r.prioridades.length) e.push("Inclua ao menos uma prioridade trabalhada.");
  r.prioridades.forEach((p) => { if (!p.evidencias) e.push("“" + p.titulo + "”: descreva as evidências observadas."); });
  if (!r.destinatarios.length) e.push("Escolha para quem publicar.");
  return e;
}
function visivelPublicado(x, papel) { return papel === "consultor" || (x.estado === "publicado" && Array.isArray(x.destinatarios) && x.destinatarios.includes(papel)); }

/* ── reuniões (vivem na consultoria; aparecem no Calendário junto com torneios e compromissos do atleta) ── */
function normalizarReuniao(b, hoje) {
  b = b || {};
  if (!dataValida(b.data)) return { ok: false, erro: "Informe a data da reunião." };
  const hora = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(b.hora || "")) ? b.hora : "";
  const link = linkHttps(b.link); if (link === null) return { ok: false, erro: "O link da videochamada precisa começar com https://." };
  return { ok: true, dados: { data: b.data, hora, titulo: txt(b.titulo, 100) || "Reunião", link, participantes: normalizarDestinos(b.participantes || ["atleta"]), pauta: txt(b.pauta, 600) } };
}

/* ── ciclo, etapa e pendências (do que existe de fato) ── */
function cicloAtual(c) { const l = c.ciclos || []; return l[l.length - 1] || null; }
function etapaDe(c, x) {
  if (c.estado === "encerrada") return "encerrada";
  if (!entradaPronta(c.entrada)) return "cadastro";
  if (!x.diagPublicado) return "diagnostico";
  if (!x.planoVigente) return "plano";
  if (x.hoje >= addDias(x.planoVigente.conteudo.revisaoEm, -7)) return "revisao";
  return "acompanhamento";
}
function acoesDoPlano(plano, status) {
  if (!plano) return [];
  const out = [];
  plano.conteudo.prioridades.forEach((p) => p.acoes.forEach((a) => out.push({ ...a, prioridade: p.titulo, prioridadeId: p.id, feita: !!(status && status[a.id] && status[a.id].feita), feitaEm: status && status[a.id] ? status[a.id].em || null : null })));
  return out;
}
function pendencias(c, x) {
  const hoje = x.hoje, p = [];
  const parts = c.diagPartidas || [];
  const aguardando = parts.filter((m) => m.status === "aguardando_material").length;
  if (c.estado === "ativa" && !x.diagPublicado && aguardando) p.push({ tipo: "material", texto: aguardando + (aguardando === 1 ? " partida do diagnóstico aguardando material" : " partidas do diagnóstico aguardando material") });
  const analisar = parts.filter((m) => m.status === "recebido" || m.status === "em_analise").length;
  if (analisar) p.push({ tipo: "analise", texto: analisar + (analisar === 1 ? " partida do diagnóstico para analisar" : " partidas do diagnóstico para analisar") });
  if (x.diagRascunho && partidasConcluidas(parts) === 3 && !x.diagPublicado) p.push({ tipo: "analise", texto: "Diagnóstico pronto para revisar e publicar" });
  if (x.jogosSemAnalise) p.push({ tipo: "analise", texto: x.jogosSemAnalise + (x.jogosSemAnalise === 1 ? " jogo com vídeo enviado sem análise" : " jogos com vídeo enviado sem análise") });
  if (x.sugestoesAbertas) p.push({ tipo: "sugestao", texto: x.sugestoesAbertas + (x.sugestoesAbertas === 1 ? " sugestão do treinador para responder" : " sugestões do treinador para responder") });
  const atrasadas = acoesDoPlano(x.planoVigente, c.acoesStatus).filter((a) => !a.feita && a.prazo && a.prazo < hoje);
  if (atrasadas.length) p.push({ tipo: "atraso", texto: atrasadas.length + (atrasadas.length === 1 ? " ação atrasada" : " ações atrasadas") });
  if (x.planoVigente) { const r = x.planoVigente.conteudo.revisaoEm, d = diasEntre(hoje, r); if (d <= 14) p.push({ tipo: "revisao", texto: d < 0 ? "Revisão do plano atrasada (" + r + ")" : "Revisão do plano em " + d + (d === 1 ? " dia" : " dias") }); }
  const cic = cicloAtual(c); if (c.estado === "ativa" && cic && diasEntre(hoje, cic.fim) <= 14) p.push({ tipo: "ciclo", texto: diasEntre(hoje, cic.fim) < 0 ? "Ciclo terminou: renovar ou encerrar" : "Ciclo termina em " + diasEntre(hoje, cic.fim) + " dias" });
  return p;
}

/* ── IA: só rascunho, só com o que foi fornecido ── */
function promptIA(tipo, base) {
  const regras = [
    "Você ajuda Richard Tsukada, consultor de desenvolvimento de tenistas juvenis, a organizar o próprio material. Escreva em português do Brasil, frases curtas.",
    "Use APENAS as informações fornecidas abaixo. Não invente estatísticas, resultados, rankings, fatos sobre o atleta nem conclusões sobre vídeos.",
    "Não prometa bolsa, recrutamento universitário, ranking ou carreira profissional. Não avalie evolução só por vitórias, derrotas ou ranking.",
    "Separe o que foi observado (com a partida citada, quando houver) do que é interpretação e do que é recomendação. O que não tiver base suficiente vai como questão a verificar.",
    "O resultado é um RASCUNHO que Richard vai revisar antes de qualquer publicação.",
  ].join("\n");
  const formato = {
    diagnostico: 'Responda só com JSON: {"secoes":{"fortes":[{"texto":"","natureza":"observacao|interpretacao","evidencias":[{"partida":1,"tempo":"mm:ss","nota":""}]}],"padroes":[...],"dificuldades":[...],"prioridades":[{"texto":"","natureza":"recomendacao"}],"questoes":[{"texto":"","natureza":"hipotese"}]},"sintese":""}. Use só tempos e partidas que aparecem no material.',
    plano: 'Responda só com JSON: {"objetivo":"","prioridades":[{"titulo":"","situacaoInicial":"","indicador":"","acoes":[{"texto":"","responsavel":"atleta|treinador|responsavel|consultor"}]}]} com no máximo 3 prioridades, tiradas do diagnóstico fornecido. Não defina prazos.',
    relatorio: 'Responda só com JSON: {"titulo":"","objetivo":"","prioridades":[{"titulo":"","evidencias":"","evolucao":"","dificuldades":""}],"proximasAcoes":"","decisoes":""}. Evidências só a partir dos registros fornecidos; onde não houver registro, escreva "sem registros no período".',
    organizar: 'Responda só com JSON: {"observacoes":[""],"interpretacoes":[""],"recomendacoes":[""],"aVerificar":[""]} reorganizando as anotações, sem acrescentar conteúdo.',
  }[tipo];
  return regras + "\n\n" + formato + "\n\nMATERIAL FORNECIDO:\n" + JSON.stringify(base).slice(0, 14000);
}
function extrairJSON(texto) { const i = String(texto || "").indexOf("{"), j = String(texto || "").lastIndexOf("}"); if (i < 0 || j <= i) return null; try { return JSON.parse(texto.slice(i, j + 1)); } catch (e) { return null; } }

module.exports = {
  ehConsultor, NOME_SERVICO, NOME_CONSULTOR, IDADE_MINIMA, DIAS_CICLO, txt, dataValida, addDias, diasEntre, linkHttps, tempoValido, novoId,
  ESTADOS, OBJETIVOS, PAPEIS_EQUIPE, DESTINOS, ROT_DESTINO, RESPONSAVEIS_ACAO, STATUS_PARTIDA, SUPERFICIES, NATUREZAS, SECOES_DIAG, ETAPAS, ESTADOS_PLANO, VER_PADRAO,
  normalizarEntrada, entradaPronta, CAMPOS_FAMILIA, partidasIniciais, normalizarPartidaDiag, partidasConcluidas, partidaDiagPublica,
  normalizarDiagnostico, errosPublicarDiagnostico, normalizarPlano, errosPublicarPlano, planoVigente, normalizarVisivel, normalizarPosJogo, normalizarTreino, podeVerRegistro,
  normalizarDestinos, normalizarAnalise, normalizarRelatorio, errosPublicarRelatorio, visivelPublicado, normalizarReuniao, cicloAtual, etapaDe, acoesDoPlano, pendencias, promptIA, extrairJSON,
};
