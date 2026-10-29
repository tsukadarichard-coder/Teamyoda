/* Aulas do mês (Team Yoda): junta as duas fontes que registram uma aula — a ocorrência da Agenda (realizada, cancelada,
   presença) e o registro de sessão do caderno (aluno.registros, tipo "sessao") — numa lista única por aula, e dela tira o
   fechamento do mês: por aluno (presenças, faltas, canceladas, reposições, o que falta remarcar) e por professor (aulas
   dadas, minutos, substituições, faltas de aluno). Só conta: nada aqui grava dado nem calcula valor em dinheiro.
   Uma aula com registro no caderno vale como realizada mesmo que ninguém tenha marcado a ocorrência na Agenda.
   Navegador: window.QLAulasMes; Node (testes): module.exports. */
(function (raiz) {
  const TIPOS_AULA = { regular: 1, experimental: 1, reposicao: 1 };
  const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const ROTULO = {
    realizada: "Realizada", falta: "Aluno faltou", cancelada: "Cancelada", pendente: "Sem registro",
    hoje: "Hoje", agendada: "Agendada", ignorada: "Não era aula",
  };
  /* motivos de um toque ao cancelar; `reposicao` = sugestão inicial de dar crédito aos alunos (a regra da unidade manda) */
  const MOTIVOS = [
    { v: "Chuva", reposicao: true }, { v: "Professor não pôde", reposicao: true }, { v: "Feriado", reposicao: true },
    { v: "Aluno avisou", reposicao: true }, { v: "Aluno faltou sem avisar", reposicao: false }, { v: "Outro", reposicao: false },
  ];
  const MOTIVO_IGNORAR = "Não era aula";

  const dataBR = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || "")); return m ? m[3] + "/" + m[2] : ""; };
  const diaSemanaCurto = (iso) => ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][new Date(iso + "T12:00:00Z").getUTCDay()];
  function minutos(h1, h2) {
    if (!h1 || !h2) return 0;
    const [a, b] = h1.split(":").map(Number), [c, d] = h2.split(":").map(Number);
    return Math.max(0, c * 60 + d - (a * 60 + b));
  }
  function duracaoTexto(d) {
    if (typeof d === "number") return d;
    const m = { "1h": 60, "1h30": 90, "2h": 120, "30min": 30 }[d];
    return m || 0;
  }
  function periodoDoMes(mes) {
    const [a, m] = mes.split("-").map(Number);
    const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
    return { inicio: mes + "-01", fim: mes + "-" + String(ultimo).padStart(2, "0") };
  }
  function nomeDoMes(mes) { const [a, m] = mes.split("-").map(Number); return MESES[m - 1] + " de " + a; }
  function somarMes(mes, n) {
    const [a, m] = mes.split("-").map(Number);
    const d = new Date(Date.UTC(a, m - 1 + n, 1));
    return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0");
  }
  /* quando o aluno/turma passou a existir: ids nascem com Date.now() ("a1730…", "turma-1730…"); sem isso, nada se presume */
  function criadoEmISO(ent) {
    if (!ent) return "";
    if (ent.criadoEm) return String(ent.criadoEm).slice(0, 10);
    const m = /(\d{13})/.exec(String(ent.id || ""));
    return m ? new Date(Number(m[1])).toISOString().slice(0, 10) : "";
  }

  /* registros de sessão indexados por "turma:<id>|data" ou "individual:<alunoId>|data" (a sessão de turma guarda o NOME) */
  function indiceRegistros(alunos, turmas) {
    const porNome = new Map((turmas || []).map((t) => [t.nome, t]));
    const idx = new Map();
    (alunos || []).forEach((a) => (a.registros || []).forEach((r) => {
      if (!r || r.tipo !== "sessao" || !r.data) return;
      const data = String(r.data).slice(0, 10);
      let chave;
      if (r.turma) { const t = porNome.get(r.turma); chave = (t ? "turma:" + t.id : "turmanome:" + r.turma) + "|" + data; }
      else chave = "individual:" + a.id + "|" + data;
      let g = idx.get(chave);
      if (!g) { g = { chave, data, turmaNome: r.turma || "", alunoId: r.turma ? null : a.id, regs: [] }; idx.set(chave, g); }
      g.regs.push({ alunoId: a.id, r });
    }));
    return idx;
  }
  function chaveDaOcorrencia(oc) { return oc.origemTipo + ":" + oc.origemId + "|" + oc.data; }

  function membrosAtuais(oc, turmas) {
    if (oc.origemTipo === "individual") return oc.origemId ? [oc.origemId] : [];
    if (oc.origemTipo === "turma") { const t = (turmas || []).find((x) => x.id === oc.origemId); return t ? (t.membros || []).slice() : []; }
    return [];
  }
  /* quem estava na aula: a foto tirada ao marcar (membrosNaAula) vale mais que a turma de hoje; presença marcada também entra */
  function membrosDaAula(oc, turmas) {
    const base = Array.isArray(oc.membrosNaAula) && oc.membrosNaAula.length ? oc.membrosNaAula.slice() : membrosAtuais(oc, turmas);
    Object.keys(oc.presencas || {}).forEach((id) => { if (oc.presencas[id] && !base.includes(id)) base.push(id); });
    return base;
  }

  function statusDaAula(oc, reg, hoje) {
    if (oc.excluirDoRelatorio) return "ignorada";
    if (oc.status === "cancelada") return "cancelada";
    const individualFaltou = (pres) => oc.origemTipo === "individual" && pres === "falta";
    if (oc.status === "realizada") return individualFaltou((oc.presencas || {})[oc.origemId]) ? "falta" : "realizada";
    if (reg) {
      if (oc.origemTipo === "individual" && reg.regs.every((x) => x.r.presenca === "ausente")) return "falta";
      return "realizada";
    }
    if (oc.data < hoje) return "pendente";
    if (oc.data === hoje) return "hoje";
    return "agendada";
  }

  /* presença de um aluno numa aula: "presente" | "falta" | "cancelada" | "pendente" | "agendada" */
  function presencaNaAula(aula, alunoId) {
    if (aula.status === "cancelada") return "cancelada";
    if (aula.status === "pendente" || aula.status === "hoje" || aula.status === "agendada") return aula.status === "pendente" ? "pendente" : "agendada";
    if (aula.status === "ignorada") return "ignorada";
    const p = (aula.presencas || {})[alunoId];
    if (p === "falta" || p === "ausente") return "falta";
    if (p === "presente") return "presente";
    if (aula.registro) {
      const r = aula.registro.regs.find((x) => x.alunoId === alunoId);
      if (r) return r.r.presenca === "ausente" ? "falta" : "presente";
    }
    return aula.status === "falta" ? "falta" : "presente";
  }

  function nomeDe(lista, id, padrao) { const x = (lista || []).find((y) => y.id === id); return x ? x.nome || padrao : padrao; }

  /* Lista única de aulas do período. `extras` são ocorrências ainda não gravadas (as que a grade de horários já previa e
     ninguém abriu na Agenda) — entram como qualquer outra, com `virtual: true`. Locação e bloqueio não são aula. */
  function aulasDoPeriodo({ ocorrencias, alunos, turmas, inicio, fim, hoje, extras }) {
    const idx = indiceRegistros(alunos, turmas);
    const usados = new Set();
    const aulas = [];
    const todas = (ocorrencias || []).concat((extras || []).map((o) => ({ ...o, virtual: true })));
    todas.filter((o) => o && TIPOS_AULA[o.tipo || "regular"] && o.data >= inicio && o.data <= fim)
      .sort((a, b) => (a.data + a.horaInicio).localeCompare(b.data + b.horaInicio))
      .forEach((oc) => {
        const chave = chaveDaOcorrencia(oc);
        const reg = !usados.has(chave) && oc.status !== "cancelada" ? idx.get(chave) || null : null;
        if (reg) usados.add(chave);
        const status = statusDaAula(oc, reg, hoje);
        /* quem deu: o substituto marcado (na Agenda ou ao registrar a sessão), senão o titular; sem titular, quem registrou */
        const regSub = reg ? reg.regs.map((x) => x.r).find((r) => r.substitutoUid || r.substitutoNome) : null;
        const regAutor = reg ? reg.regs.map((x) => x.r).find((r) => r.registradoPorUid || r.registradoPorNome) : null;
        const deuUid = oc.substitutoUid || (regSub && regSub.substitutoUid) || oc.professorUid || (regAutor && regAutor.registradoPorUid) || "";
        const deuNome = (oc.substitutoUid || oc.substitutoNome ? oc.substitutoNome : regSub ? regSub.substitutoNome : "") || oc.professorNome || (regAutor && regAutor.registradoPorNome) || "";
        aulas.push({
          id: oc.id, ocorrenciaId: oc.virtual ? null : oc.id, virtual: !!oc.virtual, ocorrencia: oc,
          data: oc.data, horaInicio: oc.horaInicio || "", horaFim: oc.horaFim || "",
          tipo: oc.tipo || "regular", origemTipo: oc.origemTipo, origemId: oc.origemId,
          nome: oc.origemTipo === "turma" ? nomeDe(turmas, oc.origemId, "Turma removida") : nomeDe(alunos, oc.origemId, "Jogador removido"),
          status, motivo: oc.status === "cancelada" ? oc.motivoCancelamento || "" : "",
          fonte: oc.status === "realizada" || oc.status === "cancelada" ? "agenda" : reg ? "caderno" : "agenda",
          registro: reg, presencas: oc.presencas || {}, membros: membrosDaAula(oc, turmas),
          titular: { uid: oc.professorUid || "", nome: oc.professorNome || "" },
          auxiliar: { uid: oc.professorAuxiliarUid || "", nome: oc.professorAuxiliarNome || "" },
          deu: { uid: deuUid, nome: deuNome || "Professor não definido" },
          substituicao: !!(oc.substitutoUid || oc.substitutoNome || regSub),
          minutos: oc.status === "realizada" && oc.duracaoEfetivaMin ? oc.duracaoEfetivaMin : minutos(oc.horaInicio, oc.horaFim),
        });
      });
    /* aula registrada no caderno sem ocorrência na Agenda (jogador sem horário fixo, aula avulsa) */
    idx.forEach((g) => {
      if (usados.has(g.chave) || g.data < inicio || g.data > fim) return;
      const turma = g.turmaNome ? (turmas || []).find((t) => t.nome === g.turmaNome) : null;
      const r0 = g.regs[0].r;
      const individual = !g.turmaNome;
      const dono = individual ? (alunos || []).find((a) => a.id === g.alunoId) : null;
      const titular = individual ? { uid: (dono && dono.professorUid) || "", nome: (dono && dono.professorNome) || "" }
        : { uid: (turma && turma.professorUid) || "", nome: (turma && turma.professorNome) || "" };
      const deuUid = r0.substitutoUid || titular.uid || r0.registradoPorUid || "";
      const deuNome = (r0.substitutoUid || r0.substitutoNome ? r0.substitutoNome : "") || titular.nome || r0.registradoPorNome || "";
      const presencas = {};
      g.regs.forEach((x) => { presencas[x.alunoId] = x.r.presenca === "ausente" ? "falta" : "presente"; });
      aulas.push({
        id: "reg:" + g.chave, ocorrenciaId: null, virtual: false, ocorrencia: null, data: g.data, horaInicio: "", horaFim: "",
        tipo: "regular", origemTipo: individual ? "individual" : "turma", origemId: individual ? g.alunoId : turma ? turma.id : null,
        nome: individual ? (dono ? dono.nome || "Sem nome" : "Jogador removido") : g.turmaNome,
        status: individual && r0.presenca === "ausente" ? "falta" : "realizada", motivo: "", fonte: "caderno",
        registro: g, presencas, membros: g.regs.map((x) => x.alunoId), titular, auxiliar: { uid: "", nome: "" },
        deu: { uid: deuUid, nome: deuNome || "Professor não definido" },
        substituicao: !!(r0.substitutoUid || r0.substitutoNome),
        minutos: duracaoTexto(r0.duracao) || 60,
      });
    });
    return aulas.sort((a, b) => (a.data + (a.horaInicio || "99")).localeCompare(b.data + (b.horaInicio || "99")));
  }

  function creditoVivo(c) { return c && c.status !== "cancelado" && c.status !== "vencido"; }

  /* Fechamento do mês. `soProfessor` (uid) restringe ao que é dele: aulas em que foi titular, auxiliar ou quem deu. */
  function fechamento({ ocorrencias, alunos, turmas, mes, hoje, extras, soProfessor }) {
    const { inicio, fim } = periodoDoMes(mes);
    let aulas = aulasDoPeriodo({ ocorrencias, alunos, turmas, inicio, fim, hoje, extras }).filter((a) => a.status !== "ignorada");
    if (soProfessor) aulas = aulas.filter((a) => [a.titular.uid, a.auxiliar.uid, a.deu.uid].includes(soProfessor));
    const passadas = aulas.filter((a) => a.status !== "agendada" && a.status !== "hoje");
    const totais = {
      aulas: passadas.length,
      realizadas: passadas.filter((a) => a.status === "realizada").length,
      faltasIndividuais: passadas.filter((a) => a.status === "falta").length,
      canceladas: passadas.filter((a) => a.status === "cancelada").length,
      pendentes: passadas.filter((a) => a.status === "pendente").length,
      reposicoes: passadas.filter((a) => a.tipo === "reposicao" && (a.status === "realizada" || a.status === "falta")).length,
      futuras: aulas.length - passadas.length,
      faltasAlunos: 0, aRemarcar: 0,
    };
    const motivos = {};
    passadas.filter((a) => a.status === "cancelada").forEach((a) => { const m = a.motivo || "Sem motivo"; motivos[m] = (motivos[m] || 0) + 1; });

    /* ── por aluno ── */
    const porAlunoMap = new Map();
    function linhaAluno(id) {
      if (!porAlunoMap.has(id)) {
        const al = (alunos || []).find((a) => a.id === id);
        const creditos = ((al && al.creditosReposicao) || []);
        porAlunoMap.set(id, {
          id, nome: al ? al.nome || "Sem nome" : "Jogador removido", existe: !!al,
          presencas: 0, faltas: 0, canceladas: 0, pendentes: 0, futuras: 0, reposicoesFeitas: 0,
          aulas: [], perdidas: [],
          creditos: {
            aguardando: creditos.filter((c) => c.status === "pendente_aprovacao").length,
            disponiveis: creditos.filter((c) => c.status === "disponivel" && !(c.validoAte && c.validoAte < hoje)).length,
            reservados: creditos.filter((c) => c.status === "reservado").length,
          },
        });
      }
      return porAlunoMap.get(id);
    }
    aulas.forEach((a) => a.membros.forEach((id) => {
      const l = linhaAluno(id);
      const p = presencaNaAula(a, id);
      l.aulas.push({ aula: a, presenca: p });
      if (p === "presente") { l.presencas++; if (a.tipo === "reposicao") l.reposicoesFeitas++; }
      else if (p === "falta") l.faltas++;
      else if (p === "cancelada") l.canceladas++;
      else if (p === "pendente") l.pendentes++;
      else if (p === "agendada") l.futuras++;
      /* perdeu a aula (falta ou cancelamento de aula normal) e ainda não tem crédito/reposição ligado a ela */
      if ((p === "falta" || p === "cancelada") && a.tipo !== "reposicao") {
        const al = (alunos || []).find((x) => x.id === id);
        const temCredito = ((al && al.creditosReposicao) || []).some((c) => creditoVivo(c) && (c.origemOcorrenciaId === a.id || (a.ocorrenciaId && c.origemOcorrenciaId === a.ocorrenciaId)));
        /* sugerida: cancelamento por motivo que costuma dar reposição; falta fica a critério de quem fecha o mês */
        const sugerida = p === "cancelada" && a.motivo !== "Aluno faltou sem avisar";
        l.perdidas.push({ aula: a, presenca: p, temCredito, sugerida });
      }
    }));
    const porAluno = [...porAlunoMap.values()].sort((x, y) => x.nome.localeCompare(y.nome));
    porAluno.forEach((l) => {
      l.aRemarcar = l.perdidas.filter((p) => p.sugerida && !p.temCredito).length + l.creditos.aguardando + l.creditos.disponiveis;
      l.faltasSemReposicao = l.perdidas.filter((p) => !p.sugerida && !p.temCredito).length;
      totais.faltasAlunos += l.faltas;
      totais.aRemarcar += l.aRemarcar;
    });

    /* ── por professor: quem DEU a aula (substituto ou quem registrou, senão o titular) ── */
    const porProfMap = new Map();
    function linhaProf(uid, nome) {
      const chave = uid ? "u:" + uid : "n:" + (nome || "");
      if (!porProfMap.has(chave)) porProfMap.set(chave, {
        chave, uid, nome: nome || "Professor não definido", dadas: 0, minutos: 0, individuais: 0, turma: 0, reposicoes: 0,
        experimentais: 0, substituicoes: 0, comFaltaDoAluno: 0, comoAuxiliar: 0, canceladas: 0, pendentes: 0, aulas: [],
      });
      return porProfMap.get(chave);
    }
    passadas.forEach((a) => {
      if (a.status === "realizada" || a.status === "falta") {
        const l = linhaProf(a.deu.uid, a.deu.nome);
        l.aulas.push(a);
        if (a.status === "falta") { l.comFaltaDoAluno++; return; }
        l.dadas++; l.minutos += a.minutos || 0;
        if (a.tipo === "reposicao") l.reposicoes++; else if (a.tipo === "experimental") l.experimentais++;
        if (a.origemTipo === "turma") l.turma++; else l.individuais++;
        if (a.substituicao) l.substituicoes++;
        if (a.auxiliar.uid && a.auxiliar.uid !== a.deu.uid) { const x = linhaProf(a.auxiliar.uid, a.auxiliar.nome); x.comoAuxiliar++; x.aulas.push(a); }
      } else if (a.status === "cancelada" || a.status === "pendente") {
        const l = linhaProf(a.titular.uid, a.titular.nome);
        l.aulas.push(a);
        if (a.status === "cancelada") l.canceladas++; else l.pendentes++;
      }
    });
    let porProfessor = [...porProfMap.values()].sort((x, y) => y.dadas - x.dadas || x.nome.localeCompare(y.nome));
    if (soProfessor) porProfessor = porProfessor.filter((p) => p.uid === soProfessor);

    return {
      mes, inicio, fim, aulas, totais, motivos, porAluno, porProfessor,
      pendentes: aulas.filter((a) => a.status === "pendente"),
    };
  }

  /* ── exportação ── */
  function csv(linhas) {
    const esc = (v) => { const s = String(v == null ? "" : v); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return linhas.map((l) => l.map(esc).join(",")).join("\n");
  }
  function csvAlunos(f) {
    return csv([["Aluno", "Presenças", "Faltas", "Canceladas", "Reposições feitas", "Sem registro", "A remarcar"]]
      .concat(f.porAluno.map((l) => [l.nome, l.presencas, l.faltas, l.canceladas, l.reposicoesFeitas, l.pendentes, l.aRemarcar])));
  }
  function csvProfessores(f) {
    return csv([["Professor", "Aulas dadas", "Horas", "Individuais", "Turma", "Reposições", "Experimentais", "Substituições", "Aluno faltou (professor presente)", "Como auxiliar", "Canceladas", "Sem registro"]]
      .concat(f.porProfessor.map((p) => [p.nome, p.dadas, (p.minutos / 60).toFixed(1).replace(".", ","), p.individuais, p.turma, p.reposicoes, p.experimentais, p.substituicoes, p.comFaltaDoAluno, p.comoAuxiliar, p.canceladas, p.pendentes])));
  }
  function csvAulas(f) {
    return csv([["Data", "Horário", "Aula", "Tipo", "Situação", "Motivo", "Professor", "Minutos", "Presentes", "Faltaram", "Fonte"]]
      .concat(f.aulas.map((a) => {
        const pres = a.membros.filter((id) => presencaNaAula(a, id) === "presente").length;
        const falt = a.membros.filter((id) => presencaNaAula(a, id) === "falta").length;
        return [a.data, a.horaInicio ? a.horaInicio + "–" + a.horaFim : "", a.nome, a.tipo === "reposicao" ? "Reposição" : a.tipo === "experimental" ? "Experimental" : "Regular",
          ROTULO[a.status], a.motivo, a.deu.nome, a.status === "realizada" ? a.minutos : "", pres, falt, a.fonte === "caderno" ? "Caderno" : "Agenda"];
      })));
  }

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const COR = { presente: "#2E7D32", falta: "#B23A2E", cancelada: "#8A8580", pendente: "#B8860B", agendada: "#B9C3BE", reposicao: "#6A3FA0" };
  const SIMBOLO = { presente: "✓", falta: "✕", cancelada: "⊘", pendente: "?", agendada: "·", ignorada: "" };
  const ROTULO_PRESENCA = { presente: "Presente", falta: "Faltou", cancelada: "Cancelada", pendente: "Sem registro", agendada: "Agendada", ignorada: "" };
  const estiloBase = 'body{font-family:-apple-system,system-ui,"Segoe UI",sans-serif;color:#141210;max-width:720px;margin:28px auto;padding:0 18px}' +
    'h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:24px 0 8px}.sub{color:#6B6461;font-size:13px;margin-bottom:16px}' +
    'table{width:100%;border-collapse:collapse;font-size:12.5px}th,td{text-align:left;padding:6px 6px;border-bottom:1px solid #E4DED9}th{font-size:11px;color:#6B6461;text-transform:uppercase;letter-spacing:.03em}' +
    'td.n,th.n{text-align:right}.tiles{display:flex;flex-wrap:wrap;gap:8px}.tile{border:1px solid #E4DED9;border-radius:8px;padding:8px 12px;min-width:96px}.tile b{display:block;font-size:18px}.tile span{font-size:11px;color:#6B6461}' +
    '.no-print{margin-top:20px;display:flex;gap:10px}@media print{.no-print{display:none}}';
  function tile(r, v) { return '<div class="tile"><span>' + esc(r) + '</span><b>' + esc(v) + '</b></div>'; }
  function rodapeBotoes() {
    return '<div class="no-print"><button onclick="window.print()" style="padding:10px 16px;font-weight:700;cursor:pointer">Salvar como PDF / Imprimir</button>' +
      '<button onclick="window.close()" style="padding:10px 16px;font-weight:700;cursor:pointer;background:transparent;border:1px solid #14121055">← Voltar ao app</button></div>';
  }
  function htmlAluno(f, alunoId, academia) {
    const l = f.porAluno.find((x) => x.id === alunoId);
    if (!l) return "";
    const linhas = l.aulas.map(({ aula: a, presenca: p }) =>
      '<tr><td>' + dataBR(a.data) + ' ' + diaSemanaCurto(a.data) + '</td><td>' + esc(a.horaInicio || "") + '</td><td>' + esc(a.nome) +
      (a.tipo === "reposicao" ? ' <i>(reposição)</i>' : '') + '</td><td style="color:' + (COR[p] || "#141210") + ';font-weight:700">' + SIMBOLO[p] + ' ' + ROTULO_PRESENCA[p] +
      '</td><td>' + esc(a.motivo || "") + '</td></tr>').join("");
    const perdidas = l.perdidas.filter((x) => x.sugerida && !x.temCredito);
    const faltas = l.perdidas.filter((x) => !x.sugerida && !x.temCredito);
    return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Aulas de ' + esc(l.nome) + ' · ' + esc(nomeDoMes(f.mes)) + '</title><style>' + estiloBase + '</style></head><body>' +
      (academia ? '<div class="sub" style="margin-bottom:4px">' + esc(academia) + '</div>' : '') +
      '<h1>' + esc(l.nome) + '</h1><div class="sub">Aulas de ' + esc(nomeDoMes(f.mes)) + '</div>' +
      '<div class="tiles">' + tile("Presenças", l.presencas) + tile("Faltas", l.faltas) + tile("Canceladas", l.canceladas) + tile("Reposições feitas", l.reposicoesFeitas) + tile("A remarcar", l.aRemarcar) + '</div>' +
      '<h2>Aula a aula</h2><table><thead><tr><th>Data</th><th>Hora</th><th>Aula</th><th>Situação</th><th>Motivo</th></tr></thead><tbody>' + (linhas || '<tr><td colspan="5">Nenhuma aula no mês.</td></tr>') + '</tbody></table>' +
      (perdidas.length ? '<h2>Aulas a remarcar</h2><ul>' + perdidas.map((x) => '<li>' + dataBR(x.aula.data) + ' · ' + esc(x.aula.nome) + ' · ' + (x.presenca === "falta" ? "falta" : "cancelada" + (x.aula.motivo ? " (" + esc(x.aula.motivo) + ")" : "")) + '</li>').join("") + '</ul>' : '') +
      (faltas.length ? '<h2>Faltas sem reposição</h2><ul>' + faltas.map((x) => '<li>' + dataBR(x.aula.data) + ' · ' + esc(x.aula.nome) + (x.aula.motivo ? ' · ' + esc(x.aula.motivo) : '') + '</li>').join("") + '</ul>' : '') +
      (l.creditos.disponiveis + l.creditos.aguardando ? '<p class="sub">Créditos de reposição em aberto: ' + (l.creditos.disponiveis + l.creditos.aguardando) + '.</p>' : '') +
      rodapeBotoes() + '</body></html>';
  }
  function htmlGeral(f, academia) {
    const t = f.totais;
    const motivos = Object.keys(f.motivos).map((m) => '<li>' + esc(m) + ': ' + f.motivos[m] + '</li>').join("");
    const profs = f.porProfessor.map((p) => '<tr><td>' + esc(p.nome) + '</td><td class="n">' + p.dadas + '</td><td class="n">' + (p.minutos / 60).toFixed(1).replace(".", ",") + 'h</td><td class="n">' + p.individuais + '</td><td class="n">' + p.turma + '</td><td class="n">' + p.reposicoes + '</td><td class="n">' + p.substituicoes + '</td><td class="n">' + p.comFaltaDoAluno + '</td><td class="n">' + p.canceladas + '</td></tr>').join("");
    const alunosH = f.porAluno.map((l) => '<tr><td>' + esc(l.nome) + '</td><td class="n">' + l.presencas + '</td><td class="n">' + l.faltas + '</td><td class="n">' + l.canceladas + '</td><td class="n">' + l.reposicoesFeitas + '</td><td class="n">' + l.pendentes + '</td><td class="n">' + l.aRemarcar + '</td></tr>').join("");
    return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Fechamento de aulas · ' + esc(nomeDoMes(f.mes)) + '</title><style>' + estiloBase + '</style></head><body>' +
      (academia ? '<div class="sub" style="margin-bottom:4px">' + esc(academia) + '</div>' : '') +
      '<h1>Fechamento de aulas</h1><div class="sub">' + esc(nomeDoMes(f.mes)) + '</div>' +
      '<div class="tiles">' + tile("Aulas no mês", t.aulas) + tile("Realizadas", t.realizadas) + tile("Canceladas", t.canceladas) + tile("Faltas de alunos", t.faltasAlunos) + tile("Reposições feitas", t.reposicoes) + tile("A remarcar", t.aRemarcar) + tile("Sem registro", t.pendentes) + '</div>' +
      (motivos ? '<h2>Cancelamentos por motivo</h2><ul>' + motivos + '</ul>' : '') +
      '<h2>Professores</h2><table><thead><tr><th>Professor</th><th class="n">Dadas</th><th class="n">Horas</th><th class="n">Indiv.</th><th class="n">Turma</th><th class="n">Repos.</th><th class="n">Substit.</th><th class="n">Aluno faltou</th><th class="n">Cancel.</th></tr></thead><tbody>' + (profs || '<tr><td colspan="9">Nenhuma aula.</td></tr>') + '</tbody></table>' +
      '<h2>Alunos</h2><table><thead><tr><th>Aluno</th><th class="n">Presenças</th><th class="n">Faltas</th><th class="n">Cancel.</th><th class="n">Repos.</th><th class="n">Sem reg.</th><th class="n">A remarcar</th></tr></thead><tbody>' + (alunosH || '<tr><td colspan="7">Nenhum aluno.</td></tr>') + '</tbody></table>' +
      rodapeBotoes() + '</body></html>';
  }

  const api = {
    TIPOS_AULA, ROTULO, MOTIVOS, MOTIVO_IGNORAR, COR, SIMBOLO, ROTULO_PRESENCA,
    periodoDoMes, nomeDoMes, somarMes, criadoEmISO, indiceRegistros, chaveDaOcorrencia, membrosDaAula, statusDaAula,
    presencaNaAula, aulasDoPeriodo, fechamento, csvAlunos, csvProfessores, csvAulas, htmlAluno, htmlGeral, dataBR, diaSemanaCurto,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.QLAulasMes = api;
})(typeof window !== "undefined" ? window : this);
