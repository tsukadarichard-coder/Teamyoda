/* Aulas de um dia para os lembretes no celular (push-lembretes.js) — Team Yoda: as ocorrências da Agenda (mty:ocorrencias:v1) com o
   status do Relatório do mês (_aulas-mes.js: uma sessão registrada no caderno conta como realizada). O QuadraLab tem a própria versão.
   aulasDoDia({ alunos, turmas, ocorrencias }, iso) → [{ hora, horaFim, titulo, turma, status, professorUid, alunoIds }] */
const QA = require("./_aulas-mes");
function aulasDoDia(dados, iso) {
  return QA.aulasDoPeriodo({ ocorrencias: dados.ocorrencias || [], alunos: dados.alunos || [], turmas: dados.turmas || [], inicio: iso, fim: iso, hoje: iso })
    .filter((a) => a.horaInicio && a.status !== "ignorada")
    .map((a) => ({ hora: a.horaInicio, horaFim: a.horaFim || a.horaInicio, titulo: a.nome, turma: a.origemTipo === "turma", professorUid: (a.deu && a.deu.uid) || (a.titular && a.titular.uid) || "",
      alunoIds: (a.membros || []).map(String), status: a.status === "hoje" || a.status === "pendente" ? "agendada" : a.status }));
}
module.exports = { aulasDoDia, CHAVES: ["mty:alunos:v2", "mty:turmas:v1", "mty:ocorrencias:v1"] };
