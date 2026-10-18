/* QuadraLab Competição — Acompanhamento MTY (regras puras e textos publicados).

   Programa de 3 meses, 100% on-line: avaliação inicial (60 min) + 3 encontros mensais (50 min), planejamento individualizado,
   uma revisão por semana dos registros do atleta, canal de dúvidas e encerramento do ciclo. Valor: 3 pagamentos de R$ 790
   (R$ 2.370 no total). Sem renovação automática.

   Fluxo do contrato:
     atleta solicita (aceita as condições)
       → menor de idade: aguardando_responsavel (um responsável com vínculo ativo confirma e passa a ser o pagador)
       → adulto:        aguardando_pagamento
     aguardando_pagamento → aguardando_inicio quando o 1º pagamento é confirmado (SÓ pelo painel do consultor; o app nunca marca pago)
     aguardando_inicio → ativo quando o consultor define o profissional (com vínculo ativo e a área "planejamento") e a data de início
     ativo → encerrado (o profissional registra a síntese do ciclo)  ·  cancelado antes do início.
   Nada é cobrado automaticamente: enquanto não houver produto de 3 parcelas na Eduzz, o pagamento é combinado no WhatsApp. */
const ASS = require("./_player-assinaturas");

const PRODUTO = {
  id: "acompanhamento-mty",
  nome: "Acompanhamento MTY",
  subtitulo: "Planejamento e acompanhamento remoto para jogadores de competição.",
  meses: 3, parcelas: 3, parcelaCentavos: 79000, totalCentavos: 237000,
  formato: "Programa inicial de 3 meses, em 3 pagamentos de R$ 790 (investimento total de R$ 2.370). A renovação por um novo ciclo depende de avaliação e do seu aceite: não há renovação automática.",
  pagamentoNota: "Hoje o pagamento é combinado direto com o consultor, pelo WhatsApp; cada pagamento só aparece como pago depois que o consultor confirma. Nenhuma cobrança é feita pelo aplicativo.",
  inclui: [
    { titulo: "Avaliação inicial", itens: ["Uma videochamada de até 60 minutos.", "Participação do atleta e do responsável.", "Levantamento de objetivos, rotina, histórico e calendário.", "Definição das prioridades do ciclo."] },
    { titulo: "Encontros mensais", itens: ["Três videochamadas individuais de 50 minutos, uma em cada mês do programa.", "São adicionais à avaliação inicial: no total, quatro encontros remotos durante o ciclo."] },
    { titulo: "Planejamento", itens: ["Planejamento técnico e tático individualizado.", "Organização do ciclo conforme calendário e rotina.", "Atualizações ao longo do acompanhamento.", "Articulação com o treinador presencial, quando houver, mediante autorização."] },
    { titulo: "Acompanhamento semanal", itens: ["Uma revisão por semana dos registros enviados pelo atleta.", "Devolutiva por texto ou áudio.", "Ajustes de prioridades quando necessários.", "A revisão se baseia nas informações efetivamente disponíveis."] },
    { titulo: "Suporte", itens: ["Canal de dúvidas na plataforma.", "Resposta em até dois dias úteis.", "Sem promessa de atendimento instantâneo ou disponibilidade ilimitada."] },
    { titulo: "Encerramento do ciclo", itens: ["Síntese do trabalho realizado e das prioridades seguintes.", "Avaliação do ciclo no terceiro encontro mensal.", "Proposta de continuidade, quando pertinente."] },
  ],
  naoInclui: [
    "Treinador presencial ou acompanhamento em viagens.", "Orientação ao vivo durante partidas.", "Disponibilidade permanente em torneios.", "Análise integral de partidas em vídeo.",
    "Prescrição física ou atendimento clínico por profissionais não incluídos no serviço.",
  ],
  remoto: "Todos os encontros são remotos. Os treinos são realizados pelo atleta em seu local habitual.",
  plataforma: "O acesso às funcionalidades da plataforma necessárias ao acompanhamento está incluído durante o ciclo. Não há assinatura adicional obrigatória para executar as entregas contratadas.",
  analise: "A análise completa de partidas continua disponível como contratação adicional, nas consultorias avulsas.",
  continuidade: "Ao final do ciclo, você recebe a síntese do trabalho e a proposta de continuidade, quando pertinente. Seus registros (partidas, diário, planejamentos, devolutivas) continuam na sua conta e podem ser baixados ou excluídos quando quiser. A renovação por um novo ciclo só começa com a sua avaliação e o seu aceite.",
  prazoDuvidas: "Resposta em até dois dias úteis.",
};

const ESTADOS = ["aguardando_responsavel", "aguardando_pagamento", "aguardando_inicio", "ativo", "encerrado", "cancelado"];
const ROTULO_ESTADO = {
  aguardando_responsavel: "Aguardando o responsável", aguardando_pagamento: "Aguardando o primeiro pagamento", aguardando_inicio: "Aguardando o início do ciclo",
  ativo: "Em andamento", encerrado: "Ciclo encerrado", cancelado: "Cancelado",
};
const ABERTOS = ["aguardando_responsavel", "aguardando_pagamento", "aguardando_inicio", "ativo"];
const ID = /^[A-Za-z0-9_-]{8,40}$/;
const TEXTO_ACEITE_VERSAO = "2026-10";

const txt = (v, n) => String(v == null ? "" : v).replace(/[ \t]+/g, " ").trim().slice(0, n);
const DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
function dataValida(s) {
  const m = DATA.exec(String(s || ""));
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}
const addDias = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
function addMeses(iso, n) {
  const d = new Date(iso + "T12:00:00Z"), dia = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n);
  const ult = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dia, ult));
  return d.toISOString().slice(0, 10);
}
/* "em até dois dias úteis" a partir de um instante ISO: pula sábado e domingo */
function prazoDiasUteis(emISO, dias) {
  let d = String(emISO).slice(0, 10), n = 0;
  while (n < dias) { d = addDias(d, 1); const w = new Date(d + "T12:00:00Z").getUTCDay(); if (w !== 0 && w !== 6) n++; }
  return d;
}
const diasEntre = (a, b) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000);

/* o ciclo a partir da data de início: fim, janelas dos encontros e as semanas (13) */
function cicloDe(inicio) {
  const fim = addDias(addMeses(inicio, PRODUTO.meses), -1);
  const janelas = [{ n: 1, de: inicio, ate: addDias(inicio, 13) }];
  for (let m = 1; m <= PRODUTO.meses; m++) janelas.push({ n: m + 1, de: addMeses(inicio, m - 1), ate: addDias(addMeses(inicio, m), -1) });
  const semanas = [];
  for (let s = 0; addDias(inicio, s * 7) <= fim; s++) semanas.push({ n: s + 1, de: addDias(inicio, s * 7), ate: addDias(inicio, s * 7 + 6) > fim ? fim : addDias(inicio, s * 7 + 6) });
  return { fim, janelas, semanas };
}
function encontrosIniciais(inicio) {
  const { janelas } = cicloDe(inicio);
  return [
    { n: 1, tipo: "avaliacao", rotulo: "Avaliação inicial", duracaoMin: 60, participantes: "Atleta e responsável", janelaDe: janelas[0].de, janelaAte: janelas[0].ate, estado: "a_agendar" },
    { n: 2, tipo: "mensal", rotulo: "Encontro do mês 1", duracaoMin: 50, janelaDe: janelas[1].de, janelaAte: janelas[1].ate, estado: "a_agendar" },
    { n: 3, tipo: "mensal", rotulo: "Encontro do mês 2", duracaoMin: 50, janelaDe: janelas[2].de, janelaAte: janelas[2].ate, estado: "a_agendar" },
    { n: 4, tipo: "mensal", rotulo: "Encontro do mês 3 · avaliação do ciclo", duracaoMin: 50, janelaDe: janelas[3].de, janelaAte: janelas[3].ate, estado: "a_agendar" },
  ];
}
function parcelasIniciais() {
  return Array.from({ length: PRODUTO.parcelas }, (_, i) => ({ n: i + 1, valorCentavos: PRODUTO.parcelaCentavos, estado: "pendente", pagoEm: null }));
}

function normalizarSolicitacao(b) {
  b = b || {};
  if (b.aceito !== true) return { ok: false, erro: "Para solicitar, confirme que leu as condições: programa de 3 meses, 3 pagamentos de R$ 790 (R$ 2.370 no total) e sem renovação automática." };
  return { ok: true, dados: { articulacao: b.articulacao === true } };
}
function normalizarAgendamento(b, hoje) {
  b = b || {};
  if (!dataValida(b.data) || b.data < hoje) return { ok: false, erro: "Informe a data do encontro (de hoje em diante)." };
  const hora = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(b.hora || "")) ? b.hora : null;
  if (!hora) return { ok: false, erro: "Informe o horário do encontro (HH:MM)." };
  let link = "";
  if (b.link) { try { const u = new URL(String(b.link).trim()); if (u.protocol !== "https:" || String(b.link).length > 300) throw new Error("x"); link = u.toString(); } catch (e) { return { ok: false, erro: "O link da videochamada precisa começar com https://." }; } }
  return { ok: true, dados: { data: b.data, hora, link } };
}
function normalizarRegistroEncontro(b) {
  b = b || {};
  const resumo = txt(b.resumo, 1500), plano = txt(b.planoDeAcao, 1200);
  if (!resumo) return { ok: false, erro: "Escreva o resumo do encontro." };
  if (!plano) return { ok: false, erro: "Escreva o plano de ação combinado." };
  return { ok: true, dados: { resumo, planoDeAcao: plano } };
}
function linkHttps(u) {
  const s = String(u || "").trim();
  if (!s) return "";
  try { const x = new URL(s); return x.protocol === "https:" && s.length <= 300 ? x.toString() : null; } catch (e) { return null; }
}
function normalizarRevisao(b, ciclo) {
  b = b || {};
  const semana = Number(b.semana);
  if (!Number.isInteger(semana) || semana < 1 || semana > ciclo.semanas.length) return { ok: false, erro: "Escolha a semana do ciclo." };
  const destaques = txt(b.destaques, 600), melhorar = txt(b.melhorar, 600), foco = txt(b.foco, 200), audio = linkHttps(b.audioLink);
  if (audio === null) return { ok: false, erro: "O link do áudio precisa começar com https://." };
  if (!destaques && !melhorar && !foco && !audio) return { ok: false, erro: "Escreva a devolutiva da semana (texto) ou cole o link de um áudio." };
  return { ok: true, dados: { semana, destaques, melhorar, foco, audioLink: audio } };
}
function normalizarEncerramento(b) {
  b = b || {};
  const sintese = txt(b.sintese, 2000), prioridades = txt(b.prioridades, 1000), continuidade = txt(b.continuidade, 800);
  if (!sintese) return { ok: false, erro: "Escreva a síntese do trabalho realizado." };
  if (!prioridades) return { ok: false, erro: "Escreva as prioridades seguintes." };
  return { ok: true, dados: { sintese, prioridades, continuidade } };
}

/* semana do ciclo em que "hoje" está (1..13), ou null fora do ciclo */
function semanaAtualDoCiclo(a, hoje) {
  if (!a.inicio || !a.fim) return null;
  const { semanas } = cicloDe(a.inicio);
  const s = semanas.find((x) => x.de <= hoje && hoje <= x.ate);
  return s ? s.n : hoje > a.fim ? semanas.length : null;
}

function proximoEncontro(a, hoje) {
  const l = (a.encontros || []).filter((e) => e.estado === "agendado" && e.data >= hoje).sort((x, y) => (x.data + x.hora).localeCompare(y.data + y.hora));
  return l[0] || null;
}

/* o que o atleta/responsável recebem: sem anotações de preparo do profissional */
function publicoAcompanhamento(id, a, visao) {
  const prof = visao === "profissional";
  return {
    id, estado: a.estado, rotulo: ROTULO_ESTADO[a.estado] || a.estado, criadoEm: a.criadoEm, atletaNome: a.atletaNome, menor: !!a.menor, pagadorNome: a.pagadorNome || null,
    articulacao: !!a.articulacao, produto: { nome: a.produto.nome, meses: a.produto.meses, parcelas: a.produto.parcelas, parcelaCentavos: a.produto.parcelaCentavos, totalCentavos: a.produto.totalCentavos },
    parcelas: (a.parcelas || []).map((p) => ({ n: p.n, valorCentavos: p.valorCentavos, estado: p.estado, pagoEm: p.pagoEm || null })),
    profissional: a.profissional ? { nome: a.profissional.nome } : null, inicio: a.inicio || null, fim: a.fim || null,
    encontros: (a.encontros || []).map((e) => ({ n: e.n, tipo: e.tipo, rotulo: e.rotulo, duracaoMin: e.duracaoMin, participantes: e.participantes || null, janelaDe: e.janelaDe, janelaAte: e.janelaAte, estado: e.estado, data: e.data || null, hora: e.hora || null, link: e.link || "", registro: e.registro || null, ...(prof ? { preparo: e.preparo || "" } : {}) })),
    encerramento: a.encerramento || null, continuidade: a.continuidade || null,
  };
}

module.exports = {
  PRODUTO, ESTADOS, ROTULO_ESTADO, ABERTOS, ID, TEXTO_ACEITE_VERSAO, txt, dataValida, addDias, addMeses, diasEntre, prazoDiasUteis, cicloDe, encontrosIniciais, parcelasIniciais,
  normalizarSolicitacao, normalizarAgendamento, normalizarRegistroEncontro, normalizarRevisao, normalizarEncerramento, linkHttps, semanaAtualDoCiclo, proximoEncontro, publicoAcompanhamento,
  WHATSAPP: ASS.WHATSAPP,
};
