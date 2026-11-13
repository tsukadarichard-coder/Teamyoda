/* Central Tsukada — Etapa 1 (13/11/2026): avisos no celular e lista "Implantação". Regras puras (sem Firebase), usadas por
   central.js (telas) e central-avisos.js (envio agendado). Tudo no horário de São Paulo (UTC−3, sem horário de verão).

   Perfis: "richard" (dono, FINANCEIRO_DONOS) e "administrativo" (lista de Financeiro › Acessos). Professores não entram.
   Cada perfil só pode ligar os tipos de aviso que são dele; os das próximas etapas ficam previstos e desligados até a etapa entrar. */

const TZ_MS = 3 * 3600000;

/* tipos de aviso: quem pode receber e em que etapa começam a funcionar */
const TIPOS = {
  tarefas: { rot: "Tarefas da Implantação com data", papeis: ["richard"], etapa: 1 },
  resumo: { rot: "Resumo da semana (segunda, 8h)", papeis: ["richard"], etapa: 1 },
  blocos: { rot: "Blocos da rotina do Head Trainer (15 min antes)", papeis: ["richard"], etapa: 2 },
  pagamentosAlerta: { rot: "Pagamentos com 10 e 30 dias de atraso", papeis: ["richard"], etapa: 4 },
  rotinaAdm: { rot: "Rotina do administrativo", papeis: ["administrativo"], etapa: 3 },
  lembretesPagamento: { rot: "Lembretes de pagamento do dia", papeis: ["administrativo"], etapa: 4 },
};
const ETAPA_ATUAL = 1;
const PAPEIS = ["richard", "administrativo"];

function tiposDoPapel(papel) { return Object.keys(TIPOS).filter((t) => TIPOS[t].papeis.indexOf(papel) >= 0); }
function ativo(tipo) { return !!TIPOS[tipo] && TIPOS[tipo].etapa <= ETAPA_ATUAL; }

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function prefsPadrao(papel) {
  const tipos = {}; tiposDoPapel(papel).forEach((t) => { tipos[t] = true; });
  return { papel, tipos, silencio: { ativo: true, de: "22:00", ate: "07:00" } };
}
/* o que vem da tela: só os tipos do perfil; horário válido ou o padrão */
function limparPrefs(b, papel) {
  const p = prefsPadrao(papel), x = b && typeof b === "object" ? b : {}, t = x.tipos && typeof x.tipos === "object" ? x.tipos : {};
  Object.keys(p.tipos).forEach((k) => { if (typeof t[k] === "boolean") p.tipos[k] = t[k]; });
  const s = x.silencio && typeof x.silencio === "object" ? x.silencio : {};
  if (typeof s.ativo === "boolean") p.silencio.ativo = s.ativo;
  if (HORA.test(String(s.de || ""))) p.silencio.de = s.de;
  if (HORA.test(String(s.ate || ""))) p.silencio.ate = s.ate;
  return p;
}
/* preferências gravadas antes podem ter tipos de outro perfil (se a pessoa mudou de papel): vale sempre o perfil de agora */
function prefsDe(gravado, papel) { return limparPrefs(gravado || {}, papel); }

/* ── horário de São Paulo ── */
function sp(ms) {
  const d = new Date(ms - TZ_MS), iso = d.toISOString();
  return { data: iso.slice(0, 10), hhmm: iso.slice(11, 16), dow: d.getUTCDay() };
}
/* momento (ms) de uma data e hora de São Paulo */
function momentoSP(data, hhmm) { return Date.parse(data + "T" + (hhmm || "00:00") + ":00.000Z") + TZ_MS; }
const minutos = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
/* silêncio de "22:00" a "07:00" atravessa a meia-noite; de "13:00" a "14:00" não */
function emSilencio(prefs, ms) {
  const s = prefs && prefs.silencio; if (!s || !s.ativo || s.de === s.ate) return false;
  const m = minutos(sp(ms).hhmm), de = minutos(s.de), ate = minutos(s.ate);
  return de < ate ? m >= de && m < ate : m >= de || m < ate;
}
function segundaDe(data) { const d = new Date(data + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); }
function somaDias(data, n) { const d = new Date(data + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

/* ── lista "Implantação" ── */
const GRUPOS = [["viagem", "Durante a viagem"], ["code", "No Code"], ["time", "Com o time"], ["pessoal", "Pessoal"]];
const IMPLANTACAO_PADRAO = [
  ["viagem", "Gravar o áudio de presença para o time."],
  ["viagem", "Pedir aos professores vídeo ou frase sobre dois alunos que evoluíram."],
  ["viagem", "Postar algo do torneio com os atletas."],
  ["code", "Revisar e aprovar a proposta de alto rendimento."],
  ["code", "Implantar o padrão de atendimento (checklist e relatório do ciclo) na plataforma das turmas."],
  ["code", "Concluir as etapas 2, 3 e 4 da Central."],
  ["time", "Enviar o Padrão de Atendimento MTY aos professores."],
  ["time", "Ligação de vídeo com os 4 professores para apresentar o padrão."],
  ["time", "Decidir a contratação do administrativo."],
  ["time", "Entregar a Rotina do Administrativo."],
  ["pessoal", "Começar a Rotina do Head Trainer pela versão de viagem."],
].map(([grupo, titulo], i) => ({ id: "im" + String(i + 1).padStart(2, "0"), grupo, titulo, status: "a_fazer", data: "", hora: "", feitoEm: "" }));
const MAX_TAREFAS = 80;
const ID = /^[A-Za-z0-9_-]{2,40}$/;
const linha = (v, max) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);

function implantacaoPadrao() { return IMPLANTACAO_PADRAO.map((t) => ({ ...t })); }
/* a lista inteira vem da tela (ordem = a ordem do vetor); título vazio sai; grupo desconhecido vira "pessoal" */
function limparImplantacao(l) {
  const vistos = {}, out = [];
  (Array.isArray(l) ? l : []).slice(0, MAX_TAREFAS).forEach((x, i) => {
    if (!x || typeof x !== "object") return;
    const titulo = linha(x.titulo, 200); if (!titulo) return;
    let id = ID.test(String(x.id || "")) ? String(x.id) : "imx" + Date.now().toString(36) + i;
    if (vistos[id]) id = id + "b" + i; vistos[id] = 1;
    const data = DATA.test(String(x.data || "")) ? x.data : "", hora = data && HORA.test(String(x.hora || "")) ? x.hora : "";
    const feito = x.status === "feito";
    out.push({ id, grupo: GRUPOS.some((g) => g[0] === x.grupo) ? x.grupo : "pessoal", titulo, status: feito ? "feito" : "a_fazer", data, hora,
      feitoEm: feito ? (DATA.test(String(x.feitoEm || "")) ? x.feitoEm : "") : "" });
  });
  return out;
}
function progresso(l) { const n = (l || []).length, f = (l || []).filter((t) => t.status === "feito").length; return { feitas: f, total: n }; }
function proxima(l) { return (l || []).find((t) => t.status !== "feito") || null; }

/* ── o que está para sair agora ──
   Tarefa com data e hora: na hora. Com data e sem hora: às 9h. Janela de 30 min para trás (o agendador roda a cada 5 min;
   se uma rodada falhar, a próxima ainda pega). Fora da janela não sai mais (inclusive o que caiu no horário de silêncio). */
const JANELA_MS = 30 * 60000;
function tarefasDevidas(lista, agoraMs) {
  return (lista || []).filter((t) => t.status !== "feito" && t.data).map((t) => {
    const hora = t.hora || "09:00", quando = momentoSP(t.data, hora);
    return { t, quando, chave: "tarefa:" + t.id + ":" + t.data + "T" + hora };
  }).filter((x) => x.quando <= agoraMs && x.quando > agoraMs - JANELA_MS)
    .map((x) => ({ chave: x.chave, tipo: "tarefas", aviso: { titulo: "Implantação", corpo: x.t.titulo + (x.t.hora ? " (" + x.t.hora + ")" : ""), url: "/#implantacao", tag: "central-tarefa-" + x.t.id } }));
}
/* resumo de segunda às 8h: tarefas da Implantação e agenda da semana (as etapas 2 a 4 acrescentam rotina e pagamentos) */
function resumoDevido(implantacao, agenda, agoraMs) {
  const agora = sp(agoraMs); if (agora.dow !== 1) return null;
  const inicio = momentoSP(agora.data, "08:00"); if (agoraMs < inicio || agoraMs > inicio + JANELA_MS) return null;
  const seg = agora.data, dom = somaDias(seg, 6), p = progresso(implantacao), prox = proxima(implantacao);
  const compromissos = (agenda || []).filter((c) => c && c.data && (c.semanal ? c.data <= dom : c.data >= seg && c.data <= dom)).length;
  const partes = [];
  if (p.total) partes.push("Implantação: " + p.feitas + " de " + p.total + " feitas" + (prox ? "; próxima: " + prox.titulo : "."));
  partes.push(compromissos ? compromissos + (compromissos === 1 ? " compromisso na agenda da semana." : " compromissos na agenda da semana.") : "Agenda da semana livre.");
  return { chave: "resumo:" + seg, tipo: "resumo", aviso: { titulo: "Resumo da semana", corpo: partes.join(" ").slice(0, 240), url: "/", tag: "central-resumo" } };
}

module.exports = { TIPOS, ETAPA_ATUAL, PAPEIS, GRUPOS, tiposDoPapel, ativo, prefsPadrao, limparPrefs, prefsDe, sp, momentoSP, emSilencio, segundaDe, somaDias,
  implantacaoPadrao, limparImplantacao, progresso, proxima, tarefasDevidas, resumoDevido, JANELA_MS, MAX_TAREFAS };
