/* Padrão de Atendimento MTY (Team Yoda): o mesmo cuidado com o aluno em toda aula, e o Head Trainer acompanhando.
   · preparação da aula: foco do plano, conquista da última aula e a nota pessoal (algo que o aluno contou)
   · checklist da aula (6 itens): 3 marcam sozinhos — "Li a ficha" (abriu a preparação), "Devolutiva com conquista" (conquista
     preenchida) e "Registrei a aula" (o próprio registro); os outros 3 o professor marca. Opcional: não impede fechar a aula.
   · registro pós-aula: conquista do dia (com "é marco"), observação por pilar e nota pessoal — campos novos e opcionais no mesmo
     registro de sessão do caderno (aluno.registros). Registro antigo, sem `atendimento`, fica fora das contas.
   · painel do Head Trainer: % de checklist completo por professor, aulas sem registro há mais de 24 h, alunos com 3 faltas em
     30 dias, alunos sem marco há 60 dias e a lista de fichas para a conversa semanal com cada professor.
   · relatório do ciclo para o cliente: dados filtrados (nada das anotações internas do professor), prompt da IA, leitura da
     resposta, rascunho sem IA de reserva e o HTML que aparece no app e na página do aluno.
   Só calcula e monta texto: não grava nada. Navegador: window.MTYAtendimento; Node (testes): module.exports. */
(function (raiz) {
  const QL = (raiz && raiz.QLAulasMes) || (typeof require === "function" ? (() => { try { return require("./aulas-mes.js"); } catch (e) { return null; } })() : null);

  const ITENS = [
    { id: "ficha", r: "Li a ficha antes da aula", auto: "Marca sozinho quando você abre a preparação da aula." },
    { id: "nome", r: "Recebi pelo nome e perguntei algo pessoal" },
    { id: "objetivo", r: "Expliquei o objetivo do dia" },
    { id: "retorno", r: "Dei retorno específico durante a aula" },
    { id: "devolutiva", r: "Fiz a devolutiva final com uma conquista", auto: "Marca sozinho quando a conquista do dia está preenchida." },
    { id: "registro", r: "Registrei a aula", auto: "Marca sozinho ao registrar." },
  ];
  const MANUAIS = ["nome", "objetivo", "retorno"];
  const PILARES = [["tecnico", "Técnico"], ["tatico", "Tático"], ["fisico", "Físico"], ["mental", "Mental"]];
  const LIMITES = { faltas: 3, diasFaltas: 30, diasSemMarco: 60, horasRegistro: 24, janelaDias: 30 };

  const txt = (s, n) => String(s == null ? "" : s).trim().slice(0, n);
  const data10 = (s) => String(s || "").slice(0, 10);
  const dataBR = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || "")); return m ? m[3] + "/" + m[2] + "/" + m[1] : ""; };
  const dataCurta = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || "")); return m ? m[3] + "/" + m[2] : ""; };
  function somaDias(iso, n) { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function diasEntre(de, ate) { return Math.round((Date.parse(ate + "T12:00:00Z") - Date.parse(de + "T12:00:00Z")) / 86400000); }
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const primeiroNome = (n) => String(n || "").trim().split(/\s+/)[0] || "";

  /* ── registro da aula ── */
  function limparConquista(c) {
    const t = txt(c && c.texto, 300);
    return t ? { texto: t, marco: !!(c && c.marco) } : null;
  }
  function limparPilares(p) {
    const o = {};
    PILARES.forEach(([k]) => { const t = txt(p && p[k], 600); if (t) o[k] = t; });
    return Object.keys(o).length ? o : null;
  }
  /* campos novos que entram no registro da sessão (espalhados no objeto do registro); só o que tem conteúdo */
  function camposDoRegistro({ fichaVista, marcados, conquista, pilares, notaPessoal } = {}) {
    const c = limparConquista(conquista), m = marcados || {};
    const out = {
      atendimento: { v: 1, ficha: !!fichaVista, nome: !!m.nome, objetivo: !!m.objetivo, retorno: !!m.retorno, devolutiva: !!c, registro: true },
    };
    if (c) out.conquista = c;
    const p = limparPilares(pilares);
    if (p) out.pilares = p;
    const n = txt(notaPessoal, 400);
    if (n) out.notaPessoal = n;
    return out;
  }
  function checklist(reg) {
    const a = reg && reg.atendimento;
    if (!a || typeof a !== "object") return null;
    const itens = ITENS.map((i) => ({ id: i.id, r: i.r, auto: !!i.auto, feito: !!a[i.id] }));
    const feitos = itens.filter((i) => i.feito).length;
    return { itens, feitos, total: ITENS.length, completo: feitos === ITENS.length };
  }

  /* ── preparação da aula ── */
  const sessoes = (aluno) => (aluno && Array.isArray(aluno.registros) ? aluno.registros : []).filter((r) => r && r.tipo === "sessao" && r.data)
    .slice().sort((a, b) => String(a.data).localeCompare(String(b.data)) || String(a.id || "").localeCompare(String(b.id || "")));
  function ultimo(lista, pred) { for (let i = lista.length - 1; i >= 0; i--) if (pred(lista[i])) return lista[i]; return null; }
  /* foco: o título/descrição da aula do plano em vigor (vem de fora, calculado pelo app); sem plano, o "próximo foco" da última aula */
  function preparacao(aluno, { foco } = {}) {
    const regs = sessoes(aluno);
    const presentes = regs.filter((r) => r.presenca !== "ausente");
    const uc = ultimo(presentes, (r) => r.conquista && r.conquista.texto);
    const np = ultimo(regs, (r) => r.notaPessoal);
    const pf = ultimo(presentes, (r) => r.proximoFoco && String(r.proximoFoco).trim());
    const ua = presentes.length ? presentes[presentes.length - 1] : null;
    return {
      nome: (aluno && aluno.nome) || "",
      foco: foco || (pf ? { titulo: String(pf.proximoFoco).trim(), origem: "proximoFoco", data: data10(pf.data) } : null),
      ultimaConquista: uc ? { texto: uc.conquista.texto, marco: !!uc.conquista.marco, data: data10(uc.data) } : null,
      notaPessoal: np ? { texto: np.notaPessoal, data: data10(np.data) } : null,
      ultimaAula: ua ? data10(ua.data) : null,
      marcos: presentes.filter((r) => r.conquista && r.conquista.marco).length,
    };
  }

  /* ── painel do Head Trainer ── */
  function professorDoRegistro(r, aluno) {
    const uid = r.substitutoUid || r.registradoPorUid || (aluno && aluno.professorUid) || "";
    const nome = (r.substitutoUid || r.substitutoNome ? r.substitutoNome : "") || r.registradoPorNome || (aluno && aluno.professorNome) || "";
    return { chave: uid ? "u:" + uid : "n:" + (nome || "?"), uid, nome: nome || "Professor não definido" };
  }
  function professorDoAluno(aluno, turmas) {
    if (aluno && (aluno.professorUid || aluno.professorNome)) return { chave: aluno.professorUid ? "u:" + aluno.professorUid : "n:" + aluno.professorNome, uid: aluno.professorUid || "", nome: aluno.professorNome || "Professor não definido" };
    const t = (turmas || []).find((x) => (x.membros || []).includes(aluno.id) && (x.professorUid || x.professorNome));
    if (t) return { chave: t.professorUid ? "u:" + t.professorUid : "n:" + t.professorNome, uid: t.professorUid || "", nome: t.professorNome || "Professor não definido" };
    return { chave: "n:?", uid: "", nome: "Sem professor definido" };
  }
  /* fim da aula em hora local (data + horaFim ou horaInicio; sem hora, fim do dia) */
  function fimDaAula(a) {
    const h = /^\d{2}:\d{2}$/.test(a.horaFim || "") ? a.horaFim : /^\d{2}:\d{2}$/.test(a.horaInicio || "") ? a.horaInicio : "23:59";
    const [y, mo, d] = String(a.data).split("-").map(Number), [hh, mm] = h.split(":").map(Number);
    return new Date(y, mo - 1, d, hh, mm).getTime();
  }

  /* aulas: QLAulasMes.aulasDoPeriodo dos últimos `janelaDias` dias (com as previstas pela grade). agora: Date em ms. */
  function painel({ alunos, turmas, aulas, hoje, agora, limites } = {}) {
    const L = { ...LIMITES, ...(limites || {}) };
    const lista = Array.isArray(alunos) ? alunos : [];
    const porId = new Map(lista.map((a) => [a.id, a]));
    const desde = somaDias(hoje, -L.janelaDias + 1);
    const profs = new Map();
    const prof = (p) => { if (!profs.has(p.chave)) profs.set(p.chave, { chave: p.chave, uid: p.uid, nome: p.nome, aulas: 0, completas: 0, somaItens: 0, faltando: {}, atrasadas: 0, conversa: [] }); return profs.get(p.chave); };

    /* checklist: só registros de presença com o campo novo, dentro da janela */
    const incompletosPorAluno = new Map();
    lista.forEach((a) => sessoes(a).forEach((r) => {
      if (r.presenca === "ausente" || data10(r.data) < desde || data10(r.data) > hoje) return;
      const c = checklist(r);
      if (!c) return;
      const p = prof(professorDoRegistro(r, a));
      p.aulas++; p.somaItens += c.feitos; if (c.completo) p.completas++;
      c.itens.forEach((i) => { if (!i.feito) p.faltando[i.id] = (p.faltando[i.id] || 0) + 1; });
      if (!c.completo) {
        const k = p.chave + "|" + a.id;
        const x = incompletosPorAluno.get(k) || { prof: p.chave, alunoId: a.id, n: 0, ultima: "" };
        x.n++; if (data10(r.data) > x.ultima) x.ultima = data10(r.data);
        incompletosPorAluno.set(k, x);
      }
    }));

    /* aulas sem registro há mais de 24 h (nenhum registro, ou marcada na Agenda sem a ficha da aula no caderno) */
    const atrasadas = [];
    (aulas || []).forEach((au) => {
      if (!au || au.data < desde || au.data > hoje) return;
      const semNada = au.status === "pendente";
      const soAgenda = au.status === "realizada" && !au.registro;
      if (!semNada && !soAgenda) return;
      const horas = Math.floor((agora - fimDaAula(au)) / 3600000);
      if (horas < L.horasRegistro) return;
      const pr = au.deu && (au.deu.uid || au.deu.nome) ? { chave: au.deu.uid ? "u:" + au.deu.uid : "n:" + au.deu.nome, uid: au.deu.uid, nome: au.deu.nome } : { chave: "n:?", uid: "", nome: "Professor não definido" };
      const p = prof(pr);
      p.atrasadas++;
      atrasadas.push({ data: au.data, hora: au.horaInicio || "", nome: au.nome, origemTipo: au.origemTipo, origemId: au.origemId, professor: p.nome, profChave: p.chave, horas, tipo: semNada ? "sem-registro" : "so-agenda" });
    });
    atrasadas.sort((a, b) => b.horas - a.horas);

    /* faltas: presença por aula (Agenda + caderno), últimos `diasFaltas` dias */
    const desdeFaltas = somaDias(hoje, -L.diasFaltas + 1);
    const faltas = new Map();
    (aulas || []).forEach((au) => {
      if (!au || au.data < desdeFaltas || au.data > hoje) return;
      (au.membros || []).forEach((id) => {
        const st = QL ? QL.presencaNaAula(au, id) : null;
        if (st === "falta") { const x = faltas.get(id) || { n: 0, datas: [] }; x.n++; x.datas.push(au.data); faltas.set(id, x); }
      });
    });
    const alunosFaltas = [];
    faltas.forEach((x, id) => {
      const a = porId.get(id);
      if (!a || x.n < L.faltas) return;
      const p = prof(professorDoAluno(a, turmas));
      alunosFaltas.push({ alunoId: id, nome: a.nome || "Sem nome", faltas: x.n, ultima: x.datas.sort().pop(), professor: p.nome, profChave: p.chave });
    });
    alunosFaltas.sort((a, b) => b.faltas - a.faltas);

    /* sem marco: conta a partir do último marco ou, sem nenhum, da primeira aula registrada com o padrão novo */
    const alunosSemMarco = [], semConquista = [];
    lista.forEach((a) => {
      const regs = sessoes(a).filter((r) => r.presenca !== "ausente" && r.atendimento && data10(r.data) <= hoje);
      if (!regs.length) return;
      const um = ultimo(regs, (r) => r.conquista && r.conquista.marco);
      const ref = um ? data10(um.data) : data10(regs[0].data);
      const dias = diasEntre(ref, hoje);
      const p = prof(professorDoAluno(a, turmas));
      if (dias >= L.diasSemMarco) alunosSemMarco.push({ alunoId: a.id, nome: a.nome || "Sem nome", dias, ultimoMarco: um ? ref : null, professor: p.nome, profChave: p.chave });
      const ult4 = regs.slice(-4);
      if (ult4.length >= 3 && ult4.every((r) => !(r.conquista && r.conquista.texto))) semConquista.push({ alunoId: a.id, nome: a.nome || "Sem nome", aulas: ult4.length, profChave: p.chave });
    });
    alunosSemMarco.sort((a, b) => b.dias - a.dias);

    /* conversa semanal: até 6 fichas por professor, da mais urgente para a menos */
    const add = (chave, item) => { const p = profs.get(chave); if (p) p.conversa.push(item); };
    const atrasoPorFicha = new Map();
    atrasadas.forEach((x) => { const k = x.profChave + "|" + x.origemTipo + ":" + x.origemId; if (!atrasoPorFicha.has(k)) atrasoPorFicha.set(k, []); atrasoPorFicha.get(k).push(x); });
    atrasoPorFicha.forEach((l) => {
      const x = l[0], datas = l.map((y) => y.data).sort().map(dataCurta);
      const motivo = l.length > 1 ? l.length + " aulas sem registro: " + datas.slice(0, -1).join(", ") + " e " + datas[datas.length - 1]
        : (x.tipo === "so-agenda" ? "Aula de " + dataCurta(x.data) + " marcada na Agenda, sem a ficha da aula" : "Aula de " + dataCurta(x.data) + " sem registro") + " (" + (x.horas >= 48 ? Math.floor(x.horas / 24) + " dias" : x.horas + " h") + ")";
      add(x.profChave, { peso: 5, alunoId: x.origemTipo === "individual" ? x.origemId : null, turmaId: x.origemTipo === "turma" ? x.origemId : null, nome: x.nome, motivo });
    });
    alunosFaltas.forEach((x) => add(x.profChave, { peso: 4, alunoId: x.alunoId, nome: x.nome, motivo: x.faltas + " faltas em " + L.diasFaltas + " dias" }));
    alunosSemMarco.forEach((x) => add(x.profChave, { peso: 3, alunoId: x.alunoId, nome: x.nome, motivo: x.ultimoMarco ? x.dias + " dias sem marco (último em " + dataCurta(x.ultimoMarco) + ")" : "Nenhum marco em " + x.dias + " dias" }));
    semConquista.forEach((x) => add(x.profChave, { peso: 2, alunoId: x.alunoId, nome: x.nome, motivo: "Sem conquista registrada nas últimas " + x.aulas + " aulas" }));
    incompletosPorAluno.forEach((x) => { if (x.n >= 2) add(x.prof, { peso: 1, alunoId: x.alunoId, nome: (porId.get(x.alunoId) || {}).nome || "Sem nome", motivo: "Checklist incompleto em " + x.n + " aulas (última " + dataCurta(x.ultima) + ")" }); });

    const professores = [...profs.values()].map((p) => {
      const esquecido = Object.entries(p.faltando).sort((a, b) => b[1] - a[1])[0];
      const vistos = new Set();
      const conversa = p.conversa.sort((a, b) => b.peso - a.peso).filter((c) => { const k = (c.alunoId || c.turmaId || c.nome) + "|" + c.peso; if (vistos.has(k)) return false; vistos.add(k); return true; }).slice(0, 6);
      return {
        chave: p.chave, uid: p.uid, nome: p.nome, aulas: p.aulas, completas: p.completas,
        pctCompleto: p.aulas ? Math.round(100 * p.completas / p.aulas) : null,
        mediaItens: p.aulas ? Math.round(10 * p.somaItens / p.aulas) / 10 : null,
        itemMaisEsquecido: esquecido ? { id: esquecido[0], r: (ITENS.find((i) => i.id === esquecido[0]) || {}).r || esquecido[0], vezes: esquecido[1] } : null,
        atrasadas: p.atrasadas, conversa,
      };
    }).sort((a, b) => (a.pctCompleto == null) - (b.pctCompleto == null) || (a.pctCompleto || 0) - (b.pctCompleto || 0) || b.atrasadas - a.atrasadas);
    const totAulas = professores.reduce((s, p) => s + p.aulas, 0), totComp = professores.reduce((s, p) => s + p.completas, 0);
    return {
      desde, hoje, limites: L, professores, atrasadas, alunosFaltas, alunosSemMarco,
      totais: { aulas: totAulas, completas: totComp, pctCompleto: totAulas ? Math.round(100 * totComp / totAulas) : null, atrasadas: atrasadas.length, faltas: alunosFaltas.length, semMarco: alunosSemMarco.length },
    };
  }

  /* ── relatório do ciclo para o cliente ── */
  function idadeEm(nascimento, hoje) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(nascimento || ""));
    if (!m) return null;
    const [y, mo, d] = hoje.split("-").map(Number);
    let id = y - +m[1]; if (mo < +m[2] || (mo === +m[2] && d < +m[3])) id--;
    return id >= 0 && id < 120 ? id : null;
  }
  function publicoPadrao(aluno, hoje) { const i = idadeEm(aluno && aluno.nascimento, hoje); return i != null && i < 18 ? "pais" : "adulto"; }
  /* período sugerido: do dia seguinte ao último relatório publicado (ou 90 dias atrás) até hoje */
  function periodoPadrao(aluno, hoje) {
    const pub = (aluno && aluno.relatoriosCiclo || []).filter((r) => r && r.status === "publicado" && r.periodo && r.periodo.ate).map((r) => r.periodo.ate).sort().pop();
    const de = pub && pub < hoje ? somaDias(pub, 1) : somaDias(hoje, -89);
    return { de, ate: hoje };
  }
  /* SÓ o que pode virar texto para o cliente: conquistas, marcos, observação por pilar, temas e o foco indicado para o próximo
     ciclo. Ficam de fora: corrigi, deixei passar, adaptações, leitura da aula, notas, nota individual e nota pessoal. */
  function dadosRelatorio(aluno, periodo) {
    const de = periodo.de, ate = periodo.ate;
    const regs = sessoes(aluno).filter((r) => data10(r.data) >= de && data10(r.data) <= ate);
    const presentes = regs.filter((r) => r.presenca !== "ausente");
    const conquistas = presentes.filter((r) => r.conquista && r.conquista.texto).map((r) => ({ data: data10(r.data), texto: r.conquista.texto, marco: !!r.conquista.marco }));
    const pilares = {};
    PILARES.forEach(([k]) => { pilares[k] = presentes.filter((r) => r.pilares && r.pilares[k]).map((r) => ({ data: data10(r.data), texto: r.pilares[k] })); });
    const temas = new Map();
    presentes.forEach((r) => (r.temas || []).forEach((t) => {
      if (!t || !t.nome || !t.status || t.status === "nao_trabalhado") return;
      const k = t.nome + "|" + (t.conceito || "");
      const x = temas.get(k) || { nome: t.nome, conceito: t.conceito || "", atingiu: 0, parcial: 0, nao_atingiu: 0 };
      if (x[t.status] != null) x[t.status]++;
      temas.set(k, x);
    }));
    const pf = ultimo(presentes, (r) => r.proximoFoco && String(r.proximoFoco).trim());
    return {
      nome: (aluno && aluno.nome) || "", primeiroNome: primeiroNome(aluno && aluno.nome), de, ate,
      aulas: presentes.length, conquistas, marcos: conquistas.filter((c) => c.marco), pilares,
      temas: [...temas.values()].sort((a, b) => (b.atingiu + b.parcial + b.nao_atingiu) - (a.atingiu + a.parcial + a.nao_atingiu)).slice(0, 12),
      focoProximo: pf ? String(pf.proximoFoco).trim().slice(0, 600) : "",
    };
  }
  function temDados(d) { return !!(d.aulas || d.conquistas.length || PILARES.some(([k]) => d.pilares[k].length)); }
  function promptRelatorio(d, { publico, academia, treinador } = {}) {
    const pais = publico === "pais";
    const L = [];
    L.push("Você escreve o relatório de fim de ciclo de um aluno de tênis" + (academia ? " da academia " + academia : "") + ".");
    L.push(pais ? "Quem lê são os PAIS (o aluno é criança ou adolescente). Fale com os pais sobre o filho, chamando-o pelo primeiro nome (" + d.primeiroNome + ")."
      : "Quem lê é o PRÓPRIO ALUNO, adulto. Fale direto com ele, usando \"você\".");
    L.push("");
    L.push("REGRAS");
    L.push("- Use SOMENTE os fatos dos DADOS abaixo. Não invente resultado, torneio, número, comparação ou elogio que não esteja nos dados.");
    L.push("- Linguagem simples, sem jargão do método (nada de códigos, siglas ou nomes internos de exercício). Frases curtas, tom caloroso e honesto.");
    L.push("- Pilar sem observação no período: deixe o texto vazio (\"\"). Não preencha por preencher.");
    L.push("- O que ainda está em construção aparece como próximo passo, nunca como defeito ou cobrança. Não fale de faltas, notas nem checklist.");
    L.push("- Cada conquista vira uma frase curta; os marcos (marcados com [MARCO]) vêm primeiro.");
    L.push("- Português do Brasil.");
    L.push("");
    L.push("Responda SOMENTE com um JSON neste formato:");
    L.push('{"abertura": "2 a 3 frases sobre o ciclo", "pilares": {"tecnico": "", "tatico": "", "fisico": "", "mental": ""}, "conquistas": ["até 6 frases"], "proximoCiclo": "1 a 3 frases sobre o foco do próximo ciclo", "fechamento": "1 frase de encerramento"}');
    L.push("");
    L.push("DADOS");
    L.push("Aluno: " + d.primeiroNome);
    if (treinador) L.push("Professor: " + treinador);
    L.push("Período: " + dataBR(d.de) + " a " + dataBR(d.ate) + " · " + d.aulas + (d.aulas === 1 ? " aula" : " aulas"));
    L.push("Conquistas registradas:" + (d.conquistas.length ? "" : " nenhuma"));
    d.conquistas.slice().sort((a, b) => b.marco - a.marco).forEach((c) => L.push("- " + dataCurta(c.data) + ": " + c.texto + (c.marco ? " [MARCO]" : "")));
    PILARES.forEach(([k, r]) => {
      const l = d.pilares[k];
      L.push("Observações do pilar " + r + ":" + (l.length ? "" : " nenhuma"));
      l.slice(-8).forEach((o) => L.push("- " + dataCurta(o.data) + ": " + o.texto));
    });
    if (d.temas.length) {
      L.push("Temas trabalhados (vezes avaliados: atingiu / em construção / ainda não):");
      d.temas.forEach((t) => L.push("- " + t.nome + ": " + t.atingiu + " / " + t.parcial + " / " + t.nao_atingiu));
    }
    L.push("Foco indicado pelo professor para o próximo ciclo: " + (d.focoProximo || "não informado (escreva algo geral e curto, sem inventar detalhes)"));
    return L.join("\n");
  }
  function normalizarTexto(o) {
    const pil = {};
    PILARES.forEach(([k]) => { pil[k] = txt(o && o.pilares && o.pilares[k], 1200); });
    return {
      abertura: txt(o && o.abertura, 1200), pilares: pil,
      conquistas: (Array.isArray(o && o.conquistas) ? o.conquistas : []).map((c) => txt(c, 300)).filter(Boolean).slice(0, 8),
      proximoCiclo: txt(o && o.proximoCiclo, 1200), fechamento: txt(o && o.fechamento, 600),
    };
  }
  function lerResposta(texto) {
    const s = String(texto || "");
    const i = s.indexOf("{"), j = s.lastIndexOf("}");
    if (i < 0 || j <= i) throw new Error("A IA não devolveu o relatório no formato esperado. Tente de novo.");
    let o;
    try { o = JSON.parse(s.slice(i, j + 1)); } catch (e) { throw new Error("A IA não devolveu o relatório no formato esperado. Tente de novo."); }
    const t = normalizarTexto(o);
    if (!t.abertura && !t.conquistas.length && !PILARES.some(([k]) => t.pilares[k])) throw new Error("A resposta da IA veio vazia. Tente de novo.");
    return t;
  }
  /* reserva sem IA: o professor reescreve a partir disto */
  function rascunhoSemIA(d, publico) {
    const pais = publico === "pais", n = d.primeiroNome || "o aluno";
    const pil = {};
    PILARES.forEach(([k]) => { pil[k] = d.pilares[k].slice(-3).map((o) => o.texto).join(" "); });
    return normalizarTexto({
      abertura: (pais ? "Neste ciclo, " + n + " fez " : "Neste ciclo, você fez ") + d.aulas + (d.aulas === 1 ? " aula" : " aulas") + " entre " + dataBR(d.de) + " e " + dataBR(d.ate) + ".",
      pilares: pil,
      conquistas: d.conquistas.slice().sort((a, b) => b.marco - a.marco).map((c) => c.texto),
      proximoCiclo: d.focoProximo,
      fechamento: "",
    });
  }

  const CSS = ".rc{font-family:inherit;color:#1d2b26;line-height:1.55}.rc h3{font-size:17px;margin:0 0 2px}.rc .sub{font-size:12.5px;color:#5c6b65;margin-bottom:12px}" +
    ".rc h4{font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#2f6b4f;margin:16px 0 6px}.rc p{margin:0 0 8px;font-size:14.5px}" +
    ".rc ul{margin:0 0 8px;padding-left:20px}.rc li{font-size:14.5px;margin-bottom:4px}.rc .marco{display:inline-block;font-size:11px;font-weight:700;color:#fff;background:#b5653a;border-radius:8px;padding:1px 7px;margin-right:6px}" +
    ".rc .pilar{border-left:3px solid #2f6b4f;padding:2px 0 2px 10px;margin-bottom:8px}.rc .pilar b{display:block;font-size:13px}" +
    ".rc .msg{background:#f3efe6;border-radius:10px;padding:12px 14px;margin-top:14px}.rc .msg p{font-size:14.5px}.rc .ass{font-size:12.5px;color:#5c6b65;margin-top:12px}";
  /* rel: { periodo:{de,ate}, publico, texto, marcos:[{data,texto}], aulas, mensagemCiclo:{texto,autor}, mensagemIndividual, publicadoPor, publicadoEm } */
  function html(rel, { nome, academia } = {}) {
    const t = normalizarTexto(rel && rel.texto);
    const per = (rel && rel.periodo) || {};
    const marcos = (rel && Array.isArray(rel.marcos) ? rel.marcos : []).filter((m) => m && m.texto);
    const pilares = PILARES.filter(([k]) => t.pilares[k]);
    const msgs = [rel && rel.mensagemCiclo && rel.mensagemCiclo.texto, rel && rel.mensagemIndividual].map((x) => txt(x, 3000)).filter(Boolean);
    const autorMsg = (rel && rel.mensagemCiclo && rel.mensagemCiclo.autor) || "Richard Tsukada";
    const par = (s) => s.split(/\n+/).filter(Boolean).map((x) => "<p>" + esc(x) + "</p>").join("");
    return '<div class="rc"><h3>Relatório do ciclo' + (nome ? " · " + esc(nome) : "") + '</h3>' +
      '<div class="sub">' + (per.de ? dataBR(per.de) + " a " + dataBR(per.ate) : "") + (rel && rel.aulas ? " · " + rel.aulas + (rel.aulas === 1 ? " aula" : " aulas") : "") + (academia ? " · " + esc(academia) : "") + '</div>' +
      (t.abertura ? par(t.abertura) : "") +
      (marcos.length ? '<h4>Marcos do ciclo</h4><ul>' + marcos.map((m) => '<li><span class="marco">Marco</span>' + esc(m.texto) + (m.data ? ' <span style="color:#5c6b65;font-size:12px">(' + dataCurta(m.data) + ')</span>' : "") + '</li>').join("") + '</ul>' : "") +
      (t.conquistas.length ? '<h4>Conquistas</h4><ul>' + t.conquistas.map((c) => "<li>" + esc(c) + "</li>").join("") + '</ul>' : "") +
      (pilares.length ? '<h4>Evolução nos pilares</h4>' + pilares.map(([k, r]) => '<div class="pilar"><b>' + r + '</b>' + par(t.pilares[k]) + '</div>').join("") : "") +
      (t.proximoCiclo ? '<h4>Foco do próximo ciclo</h4>' + par(t.proximoCiclo) : "") +
      (t.fechamento ? par(t.fechamento) : "") +
      (msgs.length ? '<div class="msg"><h4 style="margin-top:0">Mensagem de ' + esc(autorMsg) + '</h4>' + msgs.map(par).join("") + '</div>' : "") +
      (rel && rel.publicadoPor ? '<div class="ass">Professor: ' + esc(rel.publicadoPor) + (rel.publicadoEm ? " · " + dataBR(rel.publicadoEm) : "") + '</div>' : "") +
      '</div>';
  }
  function documento(rel, opcoes) {
    return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório do ciclo</title>' +
      '<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:720px;margin:24px auto;padding:0 16px;background:#fff}' + CSS +
      '@media print{.nao-imprimir{display:none}}</style></head><body>' + html(rel, opcoes) +
      '<p class="nao-imprimir" style="margin-top:20px"><button onclick="window.print()" style="padding:10px 16px;border-radius:8px;border:1px solid #2f6b4f;background:#2f6b4f;color:#fff;font-size:14px">Salvar em PDF / imprimir</button></p></body></html>';
  }

  const api = {
    ITENS, MANUAIS, PILARES, LIMITES,
    camposDoRegistro, limparConquista, limparPilares, checklist, preparacao, painel, fimDaAula, professorDoRegistro, professorDoAluno,
    publicoPadrao, periodoPadrao, idadeEm, dadosRelatorio, temDados, promptRelatorio, lerResposta, rascunhoSemIA, normalizarTexto, html, documento, CSS,
    dataBR, dataCurta, somaDias, diasEntre,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.MTYAtendimento = api;
})(typeof window !== "undefined" ? window : this);
