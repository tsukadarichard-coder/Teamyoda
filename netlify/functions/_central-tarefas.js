/* Central › Tarefas do administrativo (pedido do Richard em 25/11/2026: "preciso que eu consiga enviar tarefas na central para o
   administrativo e que eu possa ver o que está em andamento e concluído"). Regras puras (testáveis); os dados ficam em
   central/tarefasAdm ({ tarefas }) e só passam pela function central.js.
   · o Richard cria, edita e apaga; o administrativo muda o status (nova → em andamento → concluída, e pode reabrir) e comenta;
   · cada mudança fica no histórico da tarefa (quem, quando, o quê);
   · a lista guarda até 300 tarefas; concluídas há mais de 120 dias saem primeiro. */
const STATUS = ["nova", "andamento", "concluida"];
const ROTULO = { nova: "Nova", andamento: "Em andamento", concluida: "Concluída" };
const PRIORIDADES = ["normal", "alta"];
const DATA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MAX = 300;

const txt = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
const txtLongo = (v, n) => String(v == null ? "" : v).replace(/\r\n?/g, "\n").trim().slice(0, n);
const hist = (t, por, acao, agora, comentario) => [...(t.historico || []).slice(-40), { em: agora, por, acao, ...(comentario ? { comentario } : {}) }];

function nova(b, por, agora) {
  const x = b && typeof b === "object" ? b : {};
  const titulo = txt(x.titulo, 140);
  if (titulo.length < 3) throw new Error("Escreva a tarefa (pelo menos 3 letras).");
  const prazo = DATA.test(String(x.prazo || "")) ? x.prazo : "";
  return {
    id: "tf" + Date.parse(agora).toString(36) + Math.random().toString(36).slice(2, 6),
    titulo, detalhe: txtLongo(x.detalhe, 1000), prazo, prioridade: PRIORIDADES.indexOf(x.prioridade) >= 0 ? x.prioridade : "normal",
    status: "nova", criadaEm: agora, criadaPor: por, atualizadaEm: agora, concluidaEm: "", historico: [{ em: agora, por, acao: "criou" }],
  };
}
function achar(lista, id) {
  const t = (lista || []).find((x) => x && x.id === id);
  if (!t) throw new Error("Tarefa não encontrada.");
  return t;
}
/* status e/ou comentário (o comentário pode vir sem mudar o status) */
function mudarStatus(lista, id, status, comentario, por, agora) {
  const t = achar(lista, id), c = txtLongo(comentario, 500);
  if (status && STATUS.indexOf(status) < 0) throw new Error("Status inválido.");
  if (!status && !c) throw new Error("Nada para mudar.");
  return lista.map((x) => {
    if (x !== t) return x;
    const novo = status || x.status;
    const acao = novo !== x.status ? (novo === "concluida" ? "concluiu" : novo === "andamento" ? (x.status === "concluida" ? "reabriu" : "começou") : "voltou para nova") : "comentou";
    return { ...x, status: novo, atualizadaEm: agora, concluidaEm: novo === "concluida" ? (x.status === "concluida" ? x.concluidaEm : agora) : "",
      historico: hist(x, por, acao, agora, c) };
  });
}
function editar(lista, id, b, por, agora) {
  const t = achar(lista, id), x = b && typeof b === "object" ? b : {};
  const titulo = x.titulo != null ? txt(x.titulo, 140) : t.titulo;
  if (titulo.length < 3) throw new Error("Escreva a tarefa (pelo menos 3 letras).");
  return lista.map((y) => (y !== t ? y : { ...y, titulo, detalhe: x.detalhe != null ? txtLongo(x.detalhe, 1000) : y.detalhe,
    prazo: x.prazo != null ? (DATA.test(String(x.prazo)) ? x.prazo : "") : y.prazo,
    prioridade: PRIORIDADES.indexOf(x.prioridade) >= 0 ? x.prioridade : y.prioridade, atualizadaEm: agora, historico: hist(y, por, "editou", agora) }));
}
function apagar(lista, id) { achar(lista, id); return lista.filter((x) => x.id !== id); }
/* guarda: até MAX, tirando primeiro as concluídas mais antigas */
function limpar(lista, agora) {
  let l = (Array.isArray(lista) ? lista : []).filter((x) => x && x.id && STATUS.indexOf(x.status) >= 0);
  const corte = new Date(Date.parse(agora) - 120 * 86400000).toISOString();
  if (l.length > MAX) l = l.filter((x) => !(x.status === "concluida" && (x.concluidaEm || "") < corte));
  if (l.length > MAX) {
    const conc = l.filter((x) => x.status === "concluida").sort((a, b) => String(a.concluidaEm).localeCompare(String(b.concluidaEm)));
    const sai = new Set(conc.slice(0, l.length - MAX).map((x) => x.id));
    l = l.filter((x) => !sai.has(x.id));
  }
  return l.slice(-MAX);
}
/* o que a tela mostra: abertas por prioridade e prazo; concluídas das mais recentes; atrasadas = prazo antes de hoje e não concluída */
function vista(lista, hoje) {
  const l = Array.isArray(lista) ? lista : [];
  const ordem = (a, b) => (a.prioridade === "alta" ? 0 : 1) - (b.prioridade === "alta" ? 0 : 1) || (a.prazo || "9999").localeCompare(b.prazo || "9999") || String(a.criadaEm).localeCompare(String(b.criadaEm));
  const atrasada = (t) => t.status !== "concluida" && t.prazo && t.prazo < hoje;
  const marca = (t) => ({ ...t, atrasada: !!atrasada(t), rotulo: ROTULO[t.status] });
  return {
    novas: l.filter((t) => t.status === "nova").sort(ordem).map(marca),
    andamento: l.filter((t) => t.status === "andamento").sort(ordem).map(marca),
    concluidas: l.filter((t) => t.status === "concluida").sort((a, b) => String(b.concluidaEm).localeCompare(String(a.concluidaEm))).slice(0, 50).map(marca),
    contagem: { novas: l.filter((t) => t.status === "nova").length, andamento: l.filter((t) => t.status === "andamento").length,
      concluidas: l.filter((t) => t.status === "concluida").length, atrasadas: l.filter(atrasada).length },
  };
}

module.exports = { STATUS, ROTULO, nova, mudarStatus, editar, apagar, limpar, vista };
