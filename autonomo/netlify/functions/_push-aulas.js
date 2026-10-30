/* Aulas de um dia para os lembretes no celular (push-lembretes.js) — QuadraLab Treinador: horários fixos e encontros avulsos de cada
   jogador e turma; o que aconteceu vem da Agenda (agendaExcecoes por "AAAA-MM-DD|HH:MM"), e uma aula do plano marcada como feita
   ou uma sessão registrada no caderno nesse dia contam como realizada (como no app). O Team Yoda tem a própria versão deste arquivo.
   aulasDoDia({ alunos, turmas }, iso) → [{ hora, horaFim, titulo, turma, status, professorUid, alunoIds }] */
const DUR = { "30min": 30, "1h": 60, "1h30": 90, "2h": 120 };
function maisMinutos(hora, min) { const [h, m] = String(hora).split(":").map(Number); const t = h * 60 + m + min; return String(Math.floor(t / 60) % 24).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0"); }
function aulasDoDia(dados, iso) {
  const dow = new Date(iso + "T12:00:00Z").getUTCDay(), lista = [];
  function add(e, turma) {
    const feitaNoCaderno = !turma && (Object.values(e.regPlano || {}).some((r) => r && r.data === iso && (r.status === "feita" || r.feita)) || (e.registros || []).some((r) => r && r.tipo === "sessao" && r.data === iso));
    const status = (hora) => { const x = ((e.agendaExcecoes || {})[iso + "|" + hora] || {}).status; return x || (feitaNoCaderno ? "realizada" : "agendada"); };
    const base = { turma: !!turma, titulo: e.nome || (turma ? "Turma" : "Aluno"), professorUid: e.professorUid || "", alunoIds: turma ? (e.membros || []).map(String) : [String(e.id)] };
    (e.horarios || []).filter((h) => h && h.dia === dow && /^\d\d:\d\d$/.test(h.hora)).forEach((h) => lista.push({ ...base, hora: h.hora, horaFim: maisMinutos(h.hora, DUR[e.duracaoPadrao] || 90), status: status(h.hora) }));
    (e.agendaAvulsos || []).filter((av) => av && av.data === iso && /^\d\d:\d\d$/.test(av.hora)).forEach((av) => lista.push({ ...base, hora: av.hora, horaFim: av.horaFim || maisMinutos(av.hora, 60), status: status(av.hora) }));
  }
  (dados.alunos || []).filter((a) => a && a.id != null && a.nome).forEach((a) => add(a, false));
  (dados.turmas || []).filter((t) => t && t.id != null).forEach((t) => add(t, true));
  return lista.sort((x, y) => x.hora.localeCompare(y.hora));
}
module.exports = { aulasDoDia, CHAVES: ["mty:alunos:v2", "mty:turmas:v1"] };
