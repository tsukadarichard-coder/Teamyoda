/* Central Tsukada — Etapa 3 (pedido do Richard em 13/11/2026: "Faça a etapa 3"): Rotina do Administrativo. Regras puras.
   Meio período, 4 horas por dia de segunda a sexta, início configurável (sugestão 14h às 18h; as aulas vão até as 22h).
   Agenda do dia com checklist em três partes: Início (1h), Meio (2h) e Fim (1h). Semanal: segunda (resumo da semana anterior
   para o Richard, preparado pela Central), quarta (faltas → avisar o professor), sexta (agenda da semana seguinte e reservas).
   Mensal: primeiro dia útil (cobranças recorrentes geradas?), até o dia 10 (relatório financeiro do mês anterior), fim do mês
   (preparar o envio dos relatórios de ciclo, depois da mensagem pessoal do Richard). Viagens de alto rendimento: inscrição,
   hospedagem, transporte e aviso aos professores na saída e na volta. O administrativo edita; o Richard só vê.
   Guardado em central/rotinaAdm: { inicio, dias: { data: { feitos, pendencias } }, meses: { "AAAA-MM": { feitos } },
   viagens: [ … ], fotoAlunos: { semana, ids: { id: nome } }, fotoAnterior } */
const A = require("./_central-avisos");

const PARTES = [
  { id: "inicio", titulo: "Início", min: 60, itens: [
    ["d-whats", "Responder o WhatsApp"],
    ["d-agenda", "Conferir a agenda do dia: aulas, reposições, quadras e professores"],
    ["d-mudancas", "Avisar os professores sobre mudanças"],
  ] },
  { id: "meio", titulo: "Meio", min: 120, itens: [
    ["d-pagamentos", "Conferir os pagamentos no sistema de cobrança"],
    ["d-lembretes", "Enviar os lembretes de pagamento do dia"],
    ["d-interessados", "Atender interessados e marcar aula experimental"],
    ["d-cadastro", "Cadastrar alunos novos"],
  ] },
  { id: "fim", titulo: "Fim", min: 60, itens: [
    ["d-sem-registro", "Conferir aulas não registradas e avisar os professores"],
    ["d-amanha", "Confirmar as aulas e reposições de amanhã"],
    ["d-pendencias", "Anotar as pendências"],
  ] },
];
const SEMANAIS = {
  1: [["s-resumo", "Revisar e enviar ao Richard o resumo da semana anterior (a Central prepara em Agentes)", "resumoAdm"]],
  3: [["s-faltas", "Alunos com muitas faltas: avisar o professor responsável (a Central prepara em Agentes)", "faltasAdm"]],
  5: [["s-proxima", "Montar a agenda da semana seguinte e as reservas de quadra"]],
};
const MENSAIS = {
  cobrancas: "Conferir se as cobranças recorrentes foram geradas no sistema de cobrança",
  relatorio: "Relatório financeiro do mês anterior para o Richard (até o dia 10)",
  ciclo: "Preparar o envio dos relatórios de ciclo (depois da mensagem pessoal do Richard)",
};
const APOS = "Depois do expediente, até as 22h, os professores em quadra resolvem o que for do dia; o Richard fica de apoio pelo WhatsApp.";

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/, DATA = /^\d{4}-\d{2}-\d{2}$/, MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const linha = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
const texto = (v, n) => String(v == null ? "" : v).slice(0, n);
const idsDia = PARTES.flatMap((p) => p.itens.map((i) => i[0])).concat(Object.values(SEMANAIS).flat().map((i) => i[0]));
const idsMes = Object.keys(MENSAIS);

function padrao() { return { inicio: "14:00", dias: {}, meses: {}, viagens: [], fotoAlunos: null, fotoAnterior: null }; }
function limparViagem(v, i) {
  if (!v || typeof v !== "object") return null;
  const atleta = linha(v.atleta, 80), torneio = linha(v.torneio, 100); if (!atleta || !torneio) return null;
  const d = (x) => (DATA.test(String(x || "")) ? x : "");
  const out = { id: /^[A-Za-z0-9_-]{2,30}$/.test(String(v.id || "")) ? v.id : "v" + Date.now().toString(36) + i, atleta, torneio, saida: d(v.saida), volta: d(v.volta), nota: linha(v.nota, 300) };
  ["inscricao", "hospedagem", "transporte", "avisouSaida", "avisouVolta"].forEach((k) => { out[k] = !!v[k]; });
  if (out.volta && out.saida && out.volta < out.saida) out.volta = out.saida;
  return out;
}
function limpar(r) {
  const p = padrao(), x = r && typeof r === "object" ? r : {};
  if (HORA.test(String(x.inicio || ""))) p.inicio = x.inicio;
  Object.keys(x.dias || {}).filter((d) => DATA.test(d)).sort().slice(-120).forEach((d) => {
    const v = x.dias[d] || {}, f = {}; idsDia.forEach((id) => { if (v.feitos && v.feitos[id]) f[id] = true; });
    p.dias[d] = { feitos: f, pendencias: texto(v.pendencias, 3000) };
  });
  Object.keys(x.meses || {}).filter((m) => MES.test(m)).sort().slice(-24).forEach((m) => {
    const v = x.meses[m] || {}, f = {}; idsMes.forEach((id) => { if (v.feitos && v.feitos[id]) f[id] = true; }); p.meses[m] = { feitos: f };
  });
  const vistos = {};
  p.viagens = (Array.isArray(x.viagens) ? x.viagens : []).slice(0, 100).map(limparViagem).filter((v) => v && !vistos[v.id] && (vistos[v.id] = 1));
  const foto = (f) => (f && DATA.test(String(f.semana || "")) && f.ids && typeof f.ids === "object" ? { semana: f.semana, ids: Object.fromEntries(Object.entries(f.ids).slice(0, 3000).map(([k, v]) => [String(k).slice(0, 60), linha(v, 80)])) } : null);
  p.fotoAlunos = foto(x.fotoAlunos); p.fotoAnterior = foto(x.fotoAnterior);
  return p;
}

const minutos = (h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
const hhmm = (m) => String(Math.floor(m / 60) % 24).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
function horario(rot) { const ini = minutos(rot.inicio); return { inicio: rot.inicio, fim: hhmm(ini + 240) }; }
function partesDoDia(rot) { let t = minutos(rot.inicio); return PARTES.map((p) => { const o = { id: p.id, titulo: p.titulo, inicio: hhmm(t), fim: hhmm(t + p.min) }; t += p.min; return o; }); }
const dowDe = (data) => new Date(data + "T12:00:00Z").getUTCDay();
const util = (data) => { const d = dowDe(data); return d >= 1 && d <= 5; };
function primeiroDiaUtil(mes) { for (let d = 1; d <= 7; d++) { const x = mes + "-" + String(d).padStart(2, "0"); if (util(x)) return x; } return mes + "-01"; }
function ultimoDia(mes) { const [a, m] = mes.split("-").map(Number); return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10); }

/* o que aparece num dia (só segunda a sexta: sábado e domingo mostram só as viagens) */
function mensaisDoDia(rot, data) {
  const mes = data.slice(0, 7), f = (rot.meses[mes] || {}).feitos || {}, dia = Number(data.slice(8, 10)), out = [];
  if (data === primeiroDiaUtil(mes) || (data > primeiroDiaUtil(mes) && dia <= 10 && !f.cobrancas)) out.push({ id: "cobrancas", r: MENSAIS.cobrancas, feito: !!f.cobrancas });
  if (dia <= 10) out.push({ id: "relatorio", r: MENSAIS.relatorio, feito: !!f.relatorio, atrasado: false });
  if (data >= A.somaDias(ultimoDia(mes), -4)) out.push({ id: "ciclo", r: MENSAIS.ciclo, feito: !!f.ciclo });
  return out;
}
function viagensDaSemana(rot, data) {
  const seg = A.segundaDe(data), dom = A.somaDias(seg, 6);
  return rot.viagens.filter((v) => (v.saida && v.saida <= dom && (v.volta || v.saida) >= seg) || (!v.saida && !v.volta))
    .map((v) => ({ ...v, pendente: !(v.inscricao && v.hospedagem && v.transporte) || (v.saida && v.saida <= data && !v.avisouSaida) || (v.volta && v.volta <= data && !v.avisouVolta) }));
}
function dia(rot, data) {
  const v = rot.dias[data] || { feitos: {}, pendencias: "" }, f = v.feitos || {}, ehUtil = util(data);
  const partes = ehUtil ? partesDoDia(rot).map((p) => ({ ...p, itens: PARTES.find((x) => x.id === p.id).itens.map(([id, r]) => ({ id, r, feito: !!f[id] })) })) : [];
  const semanais = ehUtil ? (SEMANAIS[dowDe(data)] || []).map(([id, r, agente]) => ({ id, r, agente: agente || null, feito: !!f[id] })) : [];
  const mensais = ehUtil ? mensaisDoDia(rot, data) : [];
  const todos = partes.flatMap((p) => p.itens).concat(semanais, mensais), feitos = todos.filter((i) => i.feito).length;
  return { data, util: ehUtil, horario: horario(rot), partes, semanais, mensais, pendencias: v.pendencias || "", feitos, total: todos.length, viagens: viagensDaSemana(rot, data), apos: APOS, mes: data.slice(0, 7) };
}
function marcar(rot, data, id, feito) {
  if (!DATA.test(String(data || ""))) throw new Error("Dia inválido.");
  if (idsMes.indexOf(id) >= 0) { const m = rot.meses[data.slice(0, 7)] = rot.meses[data.slice(0, 7)] || { feitos: {} }; if (feito) m.feitos[id] = true; else delete m.feitos[id]; return rot; }
  if (idsDia.indexOf(id) < 0) throw new Error("Item desconhecido.");
  const d = rot.dias[data] = rot.dias[data] || { feitos: {}, pendencias: "" }; if (feito) d.feitos[id] = true; else delete d.feitos[id];
  return rot;
}
function salvarPendencias(rot, data, txt) { if (!DATA.test(String(data || ""))) throw new Error("Dia inválido."); const d = rot.dias[data] = rot.dias[data] || { feitos: {}, pendencias: "" }; d.pendencias = texto(txt, 3000); return rot; }
function salvarViagem(rot, v) { const x = limparViagem(v, rot.viagens.length); if (!x) throw new Error("Informe o atleta e o torneio."); rot.viagens = rot.viagens.filter((y) => y.id !== x.id).concat([x]).sort((a, b) => (a.saida || "9").localeCompare(b.saida || "9")); return rot; }
function apagarViagem(rot, id) { rot.viagens = rot.viagens.filter((v) => v.id !== id); return rot; }

/* foto semanal dos alunos para o resumo contar quem entrou e quem saiu */
function atualizarFoto(rot, alunos, seg) {
  if (rot.fotoAlunos && rot.fotoAlunos.semana === seg) return false;
  rot.fotoAnterior = rot.fotoAlunos; rot.fotoAlunos = { semana: seg, ids: Object.fromEntries((alunos || []).filter((a) => a && a.id).map((a) => [a.id, linha(a.nome, 80) || "Sem nome"])) };
  return true;
}
function saidas(rot) {
  if (!rot.fotoAnterior || !rot.fotoAlunos) return null;
  return Object.keys(rot.fotoAnterior.ids).filter((id) => !rot.fotoAlunos.ids[id]).map((id) => rot.fotoAnterior.ids[id]);
}

/* avisos do administrativo (tipo rotinaAdm): no começo de cada parte, com o que falta nela; dias úteis */
function avisosDevidos(rot, agoraMs) {
  const a = A.sp(agoraMs), d = dia(rot, a.data); if (!d.util) return [];
  return d.partes.map((p) => ({ p, quando: A.momentoSP(a.data, p.inicio) })).filter((y) => y.quando <= agoraMs && y.quando > agoraMs - A.JANELA_MS).map(({ p }) => {
    const falta = p.itens.filter((i) => !i.feito).map((i) => i.r), extra = p.id === "inicio" ? d.semanais.concat(d.mensais).filter((i) => !i.feito).map((i) => i.r) : [];
    return { chave: "adm:" + a.data + ":" + p.id, tipo: "rotinaAdm",
      aviso: { titulo: p.titulo + " do expediente (" + p.inicio + " às " + p.fim + ")", corpo: (falta.concat(extra).slice(0, 4).join(" · ") || "Tudo feito nesta parte.").slice(0, 230), url: "/#rotina-adm", tag: "central-adm-" + p.id } };
  });
}

module.exports = { PARTES, SEMANAIS, MENSAIS, APOS, padrao, limpar, horario, partesDoDia, dia, marcar, salvarPendencias, salvarViagem, apagarViagem, atualizarFoto, saidas, avisosDevidos, primeiroDiaUtil };
