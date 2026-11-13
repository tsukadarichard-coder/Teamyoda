/* Central Tsukada — Etapa 2 (aprovada em 13/11/2026): Rotina do Head Trainer. Regras puras, sem Firebase.
   Regra principal: no máximo 6 horas por semana de gestão (teto, não meta). Dois modelos de semana: CT (6h) e Viagem (3h20,
   tudo à distância, com descanso protegido que não conta nas horas). O Richard marca a semana como CT ou Viagem; sem marcar,
   vale CT. Horários editáveis (no modelo: valem para as próximas semanas). Bloco pulado não acumula, exceto a observação de
   aula: o rodízio só anda quando ela é feita, então a semana seguinte no CT observa o mesmo professor. "Mínimo da semana":
   só a gestão pelo painel e a presença à distância. Ritmos mensal e trimestral como checklists.
   Guardado em central/rotina: { modelos: { ct, viagem }, professores: [4 nomes], rodizio: { proximo },
   semanas: { "AAAA-MM-DD"(segunda): { modo, feitos: { blocoId: { em, prof? } }, minimo } }, ritmos: { mensal, trimestral } } */
const A = require("./_central-avisos");

const TETO_MIN = 360;
const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const TIPOS = {
  gestao: "Gestão pelo painel", conversa: "Conversa com professor", quadra: "Presença em quadra", observacao: "Observação de aula",
  distancia: "Presença à distância", vitrine: "Vitrine do método", descanso: "Descanso protegido", outro: "Outro",
};
const MINIMO = ["gestao", "distancia"];
const NOTAS = {
  gestao: "Só exceções: fichas atrasadas, checklist incompleto, faltas, alunos sem marco.",
  quadra: "Circular, cumprimentar alunos e pais, sem dar aula.",
  observacao: "Rodízio: um professor por semana.",
  distancia: "Áudios e vídeos para alunos com marcos ou que precisam de incentivo.",
  vitrine: "Compartilhar o que acontece nos torneios.",
  descanso: "Protegido: não marque nada aqui.",
};
const b = (id, dia, inicio, duracaoMin, tipo, extra) => ({ id, dia, inicio, duracaoMin, tipo, titulo: TIPOS[tipo], ...(extra || {}) });
const MODELOS_PADRAO = {
  ct: [
    b("g", 0, "09:00", 60, "gestao"),
    b("c1", 1, "09:00", 20, "conversa", { prof: 0 }), b("c2", 1, "09:20", 20, "conversa", { prof: 1 }),
    b("c3", 1, "09:40", 20, "conversa", { prof: 2 }), b("c4", 1, "10:00", 20, "conversa", { prof: 3 }),
    b("q", 2, "17:00", 90, "quadra"),
    b("o", 3, "18:00", 60, "observacao"),
    b("d", 4, "10:00", 70, "distancia"),
  ],
  viagem: [
    b("g", 0, "08:00", 45, "gestao"),
    b("c1", 1, "08:00", 20, "conversa", { prof: 0, titulo: "Conversa por vídeo ou áudio" }), b("c2", 1, "08:20", 20, "conversa", { prof: 1, titulo: "Conversa por vídeo ou áudio" }),
    b("c3", 1, "08:40", 20, "conversa", { prof: 2, titulo: "Conversa por vídeo ou áudio" }), b("c4", 1, "09:00", 20, "conversa", { prof: 3, titulo: "Conversa por vídeo ou áudio" }),
    b("d", 2, "08:00", 45, "distancia"),
    b("v", 3, "20:00", 30, "vitrine"),
    b("r", 5, "14:00", 180, "descanso"),
  ],
};
const MENSAL = ["Mensagem pessoal nos relatórios de ciclo", "Revisar retenção", "Revisar checklist por professor", "Revisar fichas em dia", "Revisar inadimplência", "Escolher o tema de formação do mês"];
const TRIMESTRAL = ["Reunião com os 4 professores sobre o padrão de atendimento", "Revisar o calendário de viagens"];

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/, DATA = /^\d{4}-\d{2}-\d{2}$/, MES = /^\d{4}-(0[1-9]|1[0-2])$/, TRI = /^\d{4}-T[1-4]$/;
const linha = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
const clone = (x) => JSON.parse(JSON.stringify(x));

function rotinaPadrao(professores) {
  const nomes = (professores || []).map((p) => linha(p, 40)).filter(Boolean).slice(0, 4);
  while (nomes.length < 4) nomes.push("Professor " + (nomes.length + 1));
  return { modelos: clone(MODELOS_PADRAO), professores: nomes, rodizio: { proximo: 0 }, semanas: {}, ritmos: { mensal: {}, trimestral: {} } };
}
function limparBloco(x, i) {
  if (!x || typeof x !== "object") return null;
  const tipo = TIPOS[x.tipo] ? x.tipo : "outro";
  const dia = Math.round(Number(x.dia)), dur = Math.round(Number(x.duracaoMin));
  return {
    id: /^[A-Za-z0-9_-]{1,20}$/.test(String(x.id || "")) ? String(x.id) : "b" + i,
    dia: dia >= 0 && dia <= 6 ? dia : 0, inicio: HORA.test(String(x.inicio || "")) ? x.inicio : "09:00",
    duracaoMin: dur >= 5 && dur <= 480 ? dur : 30, tipo, titulo: linha(x.titulo, 80) || TIPOS[tipo],
    ...(tipo === "conversa" ? { prof: Math.max(0, Math.min(3, Math.round(Number(x.prof)) || 0)) } : {}),
  };
}
/* tudo que vem gravado ou da tela passa por aqui */
function limparRotina(r) {
  const p = rotinaPadrao(r && r.professores), x = r && typeof r === "object" ? r : {};
  ["ct", "viagem"].forEach((m) => {
    const l = x.modelos && Array.isArray(x.modelos[m]) ? x.modelos[m].slice(0, 20).map(limparBloco).filter(Boolean) : null;
    if (l && l.length) { const vistos = {}; p.modelos[m] = l.filter((y) => (vistos[y.id] ? false : (vistos[y.id] = 1))); }
  });
  const n = Math.round(Number(x.rodizio && x.rodizio.proximo)); p.rodizio.proximo = n >= 0 && n <= 3 ? n : 0;
  Object.keys(x.semanas || {}).filter((s) => DATA.test(s)).sort().slice(-60).forEach((s) => {
    const w = x.semanas[s] || {}, feitos = {};
    Object.keys(w.feitos || {}).slice(0, 30).forEach((id) => {
      const f = w.feitos[id] || {}; if (!/^[A-Za-z0-9_-]{1,20}$/.test(id) || !DATA.test(String(f.em || ""))) return;
      feitos[id] = { em: f.em, ...(f.prof != null && f.prof >= 0 && f.prof <= 3 ? { prof: Math.round(f.prof) } : {}) };
    });
    p.semanas[s] = { modo: w.modo === "viagem" ? "viagem" : w.modo === "ct" ? "ct" : null, feitos, minimo: !!w.minimo };
  });
  const rit = x.ritmos || {};
  Object.keys(rit.mensal || {}).filter((m) => MES.test(m)).sort().slice(-24).forEach((m) => {
    const v = rit.mensal[m] || {}, f = {}; MENSAL.forEach((_, i) => { if (v.feitos && v.feitos[i]) f[i] = true; });
    p.ritmos.mensal[m] = { feitos: f, tema: linha(v.tema, 120) };
  });
  Object.keys(rit.trimestral || {}).filter((t) => TRI.test(t)).sort().slice(-12).forEach((t) => {
    const v = rit.trimestral[t] || {}, f = {}; TRIMESTRAL.forEach((_, i) => { if (v.feitos && v.feitos[i]) f[i] = true; });
    p.ritmos.trimestral[t] = { feitos: f };
  });
  return p;
}

const minutosDe = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
function somaMin(blocos) { return blocos.filter((x) => x.tipo !== "descanso").reduce((s, x) => s + x.duracaoMin, 0); }
function textoHoras(min) { const h = Math.floor(min / 60), m = min % 60; return h ? h + "h" + (m ? String(m).padStart(2, "0") : "") : m + " min"; }
function trimestreDe(data) { return data.slice(0, 4) + "-T" + (Math.floor((Number(data.slice(5, 7)) - 1) / 3) + 1); }

/* a semana pronta para a tela e para os avisos */
function semana(rot, seg) {
  const w = rot.semanas[seg] || {}, modo = w.modo || "ct", feitos = w.feitos || {};
  const blocos = rot.modelos[modo].slice().sort((x, y) => x.dia - y.dia || minutosDe(x.inicio) - minutosDe(y.inicio)).map((x) => {
    const f = feitos[x.id], data = A.somaDias(seg, x.dia), out = { ...x, data, feito: !!f, nota: NOTAS[x.tipo] || "", minimo: MINIMO.indexOf(x.tipo) >= 0 };
    if (x.tipo === "conversa") out.professor = rot.professores[x.prof] || "";
    if (x.tipo === "observacao") out.professor = rot.professores[f && f.prof != null ? f.prof : rot.rodizio.proximo] || "";
    return out;
  });
  const total = somaMin(blocos), totalMinimo = somaMin(blocos.filter((x) => x.minimo)), feitosMin = somaMin(blocos.filter((x) => x.feito));
  return { semana: seg, modo, marcada: !!w.modo, minimo: !!w.minimo, blocos, totalMin: total, totalMinimo, feitosMin, passouDoTeto: total > TETO_MIN, teto: TETO_MIN,
    observacao: modo === "ct" ? rot.professores[rot.rodizio.proximo] : null };
}
function garantirSemana(rot, seg) { rot.semanas[seg] = rot.semanas[seg] || { modo: null, feitos: {}, minimo: false }; return rot.semanas[seg]; }
function marcarModo(rot, seg, modo) { const w = garantirSemana(rot, seg); w.modo = modo === "viagem" ? "viagem" : "ct"; return rot; }
function marcarMinimo(rot, seg, ligado) { garantirSemana(rot, seg).minimo = !!ligado; return rot; }
/* observação feita anda o rodízio; desfazer volta para o mesmo professor */
function marcarFeito(rot, seg, blocoId, feito, hoje) {
  const w = garantirSemana(rot, seg), modo = w.modo || "ct", bl = rot.modelos[modo].find((x) => x.id === blocoId);
  if (!bl) throw new Error("Bloco não encontrado.");
  const antes = w.feitos[blocoId];
  if (feito && !antes) {
    w.feitos[blocoId] = { em: hoje };
    if (bl.tipo === "observacao") { w.feitos[blocoId].prof = rot.rodizio.proximo; rot.rodizio.proximo = (rot.rodizio.proximo + 1) % 4; }
  } else if (!feito && antes) {
    if (bl.tipo === "observacao" && antes.prof != null) rot.rodizio.proximo = antes.prof;
    delete w.feitos[blocoId];
  }
  return rot;
}
/* editar horário, duração ou dia no modelo (vale da semana em diante; o que já foi feito continua feito) */
function editarBloco(rot, modo, blocoId, campos) {
  const l = rot.modelos[modo === "viagem" ? "viagem" : "ct"], i = l.findIndex((x) => x.id === blocoId);
  if (i < 0) throw new Error("Bloco não encontrado.");
  l[i] = limparBloco({ ...l[i], ...campos, id: l[i].id, tipo: l[i].tipo }, i);
  return rot;
}
function marcarRitmo(rot, tipo, periodo, idx, feito, tema) {
  if (tipo === "mensal") {
    if (!MES.test(periodo)) throw new Error("Mês inválido.");
    const v = rot.ritmos.mensal[periodo] = rot.ritmos.mensal[periodo] || { feitos: {}, tema: "" };
    if (idx != null && idx >= 0 && idx < MENSAL.length) { if (feito) v.feitos[idx] = true; else delete v.feitos[idx]; }
    if (typeof tema === "string") v.tema = linha(tema, 120);
  } else {
    if (!TRI.test(periodo)) throw new Error("Trimestre inválido.");
    const v = rot.ritmos.trimestral[periodo] = rot.ritmos.trimestral[periodo] || { feitos: {} };
    if (idx != null && idx >= 0 && idx < TRIMESTRAL.length) { if (feito) v.feitos[idx] = true; else delete v.feitos[idx]; }
  }
  return rot;
}
function ritmos(rot, hoje) {
  const mes = hoje.slice(0, 7), tri = trimestreDe(hoje), m = rot.ritmos.mensal[mes] || { feitos: {}, tema: "" }, t = rot.ritmos.trimestral[tri] || { feitos: {} };
  return { mes, trimestre: tri, mensal: MENSAL.map((r, i) => ({ i, r, feito: !!m.feitos[i] })), tema: m.tema, trimestral: TRIMESTRAL.map((r, i) => ({ i, r, feito: !!t.feitos[i] })) };
}

/* avisos: 15 min antes de cada bloco não feito da semana atual (no mínimo da semana, só os do mínimo); descanso não avisa */
const ANTES_MS = 15 * 60000;
function blocosDevidos(rot, agoraMs) {
  const agora = A.sp(agoraMs), seg = A.segundaDe(agora.data), s = semana(rot, seg);
  return s.blocos.filter((x) => !x.feito && x.tipo !== "descanso" && (!s.minimo || x.minimo)).map((x) => ({ x, quando: A.momentoSP(x.data, x.inicio) - ANTES_MS }))
    .filter((y) => y.quando <= agoraMs && y.quando > agoraMs - A.JANELA_MS)
    .map(({ x }) => ({ chave: "bloco:" + seg + ":" + x.id, tipo: "blocos",
      aviso: { titulo: x.titulo + " às " + x.inicio, corpo: (x.professor ? x.professor + ". " : "") + (x.nota || "Bloco da rotina do Head Trainer.") + " (" + textoHoras(x.duracaoMin) + ")", url: "/#rotina", tag: "central-bloco-" + x.id } }));
}
function proximoBloco(rot, agoraMs) {
  const agora = A.sp(agoraMs), seg = A.segundaDe(agora.data), s = semana(rot, seg);
  return s.blocos.find((x) => !x.feito && x.tipo !== "descanso" && (!s.minimo || x.minimo) && A.momentoSP(x.data, x.inicio) + x.duracaoMin * 60000 > agoraMs) || null;
}

module.exports = { TETO_MIN, DIAS, TIPOS, MINIMO, MODELOS_PADRAO, MENSAL, TRIMESTRAL, rotinaPadrao, limparRotina, semana, marcarModo, marcarMinimo, marcarFeito,
  editarBloco, marcarRitmo, ritmos, blocosDevidos, proximoBloco, somaMin, textoHoras, trimestreDe };
