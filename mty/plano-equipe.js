/* Planejamento da equipe de competição (Team Yoda): montado pelo coordenador, sem IA.
   Ciclo de N semanas (4, 8, 12 ou personalizado) com dias de treino e duração da sessão; o planejamento se divide em mensal (grande
   grupo e observação do mês), semanal e diário (grande grupo, itens da classificação e observação). Grandes grupos: técnico, tático
   ou misto (técnico + tático). Classificação: capacidades (movimentação, mudança de direção, precisão), golpes (saque, forehand,
   backhand, approach, voleio, smash, devolução, drop shot) e situações de jogo (ataque, defesa, construção).
   Usado no app do treinador (editor), na aba Equipe da ficha, no relatório do atleta e na página do aluno. Navegador:
   window.QLPlanoEquipe; Node (testes): module.exports. */
(function (raiz) {
  const GRUPOS = [["tecnico", "Técnico"], ["tatico", "Tático"], ["misto", "Misto (técnico + tático)"]];
  const ROTULO_GRUPO = { tecnico: "Técnico", tatico: "Tático", misto: "Misto" };
  const CLASSIFICACAO = [
    { id: "capacidades", r: "Capacidades", itens: [["movimentacao", "Movimentação"], ["mudanca_direcao", "Mudança de direção"], ["precisao", "Precisão"]] },
    { id: "golpes", r: "Golpes", itens: [["saque", "Saque"], ["forehand", "Forehand"], ["backhand", "Backhand"], ["approach", "Approach"], ["voleio", "Voleio"], ["smash", "Smash"], ["devolucao", "Devolução"], ["drop_shot", "Drop shot"]] },
    { id: "situacoes", r: "Situações de jogo", itens: [["ataque", "Ataque"], ["defesa", "Defesa"], ["construcao", "Construção"]] },
  ];
  const ROTULO_ITEM = {};
  CLASSIFICACAO.forEach((g) => g.itens.forEach(([v, r]) => { ROTULO_ITEM[v] = r; }));
  const ORDEM_ITEM = Object.keys(ROTULO_ITEM);
  const CICLOS = [
    { semanas: 4, r: "4 semanas", d: "Ciclo curto: um tema principal. Três semanas de trabalho e a última para ajustar e testar em jogo. Bom entre torneios próximos ou para corrigir um ponto específico." },
    { semanas: 8, r: "8 semanas", d: "Dois blocos de 4 semanas: o primeiro constrói (em geral mais técnico) e o segundo leva para o jogo (mais tático ou misto). Dá para avaliar na metade e ajustar o segundo bloco." },
    { semanas: 12, r: "12 semanas", d: "Um trimestre em três blocos de 4: base, desenvolvimento e competição. Indicado para preparar um torneio-alvo, com o trabalho mais específico perto da data." },
    { semanas: 0, r: "Personalizado", d: "Você escolhe o número de semanas (1 a 24). Sempre que puder, pense em blocos de 4 semanas para facilitar as avaliações." },
  ];
  const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const somar = (iso, n) => new Date(Date.parse(iso + "T12:00:00Z") + n * 86400000).toISOString().slice(0, 10);
  const diaSemana = (iso) => new Date(iso + "T12:00:00Z").getUTCDay();
  const dataBR = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || "")); return m ? m[3] + "/" + m[2] : ""; };
  const valida = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) && !isNaN(Date.parse(s + "T12:00:00Z"));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const txt = (s, n) => String(s == null ? "" : s).slice(0, n);
  const itensValidos = (l) => ORDEM_ITEM.filter((v) => (Array.isArray(l) ? l : []).includes(v));
  const grupoValido = (g) => (ROTULO_GRUPO[g] ? g : "");
  const rotulosItens = (l) => itensValidos(l).map((v) => ROTULO_ITEM[v]);
  const mesDe = (iso) => String(iso).slice(0, 7);
  const rotuloMes = (m) => { const [a, mm] = m.split("-").map(Number); return MESES[mm - 1].replace(/^./, (c) => c.toUpperCase()) + " de " + a; };

  /* monta (ou remonta) as semanas e os dias do ciclo; o que já foi escrito é mantido pela semana (número) e pelo dia (data) */
  function montarCiclo(cfg, anterior) {
    const semanas = Math.max(1, Math.min(24, parseInt(cfg.semanas, 10) || 4));
    const inicio = valida(cfg.inicio) ? cfg.inicio : new Date().toISOString().slice(0, 10);
    const dias = [...new Set((cfg.dias || []).map(Number).filter((d) => d >= 0 && d <= 6))].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
    const ant = anterior || {}, semAnt = {}, diaAnt = {};
    (ant.semanas || []).forEach((s) => { semAnt[s.n] = s; (s.dias || []).forEach((d) => { diaAnt[d.data] = d; }); });
    const lista = [];
    for (let i = 0; i < semanas; i++) {
      const ini = somar(inicio, i * 7), fim = somar(ini, 6), a = semAnt[i + 1] || {};
      const ds = [];
      for (let k = 0; k < 7; k++) { const dt = somar(ini, k); if (dias.includes(diaSemana(dt))) { const x = diaAnt[dt] || {}; ds.push({ data: dt, grupo: grupoValido(x.grupo), itens: itensValidos(x.itens), obs: txt(x.obs, 1500) }); } }
      lista.push({ n: i + 1, inicio: ini, fim, grupo: grupoValido(a.grupo), itens: itensValidos(a.itens), obs: txt(a.obs, 2000), dias: ds });
    }
    const meses = {};
    [...new Set(lista.flatMap((s) => [mesDe(s.inicio), mesDe(s.fim)]))].forEach((m) => { const x = (ant.meses || {})[m] || {}; meses[m] = { grupo: grupoValido(x.grupo), obs: txt(x.obs, 2000) }; });
    return {
      ...ant,
      ciclo: { semanas, inicio, fim: somar(inicio, semanas * 7 - 1), dias, duracaoMin: Math.max(0, Math.min(600, parseInt(cfg.duracaoMin, 10) || 0)) || null, grupo: grupoValido(cfg.grupo), objetivo: txt(cfg.objetivo, 1500) },
      meses, semanas: lista,
    };
  }
  /* o que pode ir para fora (link do aluno): só os campos conhecidos, com tamanho limitado */
  function limpar(p) {
    if (!p || !p.ciclo || !Array.isArray(p.semanas)) return null;
    const c = p.ciclo;
    return {
      id: txt(p.id, 60), atualizadoEm: txt(p.atualizadoEm, 30), autorNome: txt(p.autorNome, 80),
      ciclo: { semanas: Math.max(1, Math.min(24, +c.semanas || 1)), inicio: valida(c.inicio) ? c.inicio : "", fim: valida(c.fim) ? c.fim : "", dias: (c.dias || []).map(Number).filter((d) => d >= 0 && d <= 6), duracaoMin: +c.duracaoMin || null, grupo: grupoValido(c.grupo), objetivo: txt(c.objetivo, 1500) },
      meses: Object.fromEntries(Object.entries(p.meses || {}).filter(([m]) => /^\d{4}-\d{2}$/.test(m)).slice(0, 8).map(([m, x]) => [m, { grupo: grupoValido(x && x.grupo), obs: txt(x && x.obs, 2000) }])),
      semanas: p.semanas.slice(0, 24).map((s) => ({ n: +s.n || 0, inicio: valida(s.inicio) ? s.inicio : "", fim: valida(s.fim) ? s.fim : "", grupo: grupoValido(s.grupo), itens: itensValidos(s.itens), obs: txt(s.obs, 2000),
        dias: (s.dias || []).slice(0, 7).filter((d) => valida(d.data)).map((d) => ({ data: d.data, grupo: grupoValido(d.grupo), itens: itensValidos(d.itens), obs: txt(d.obs, 1500) })) })),
    };
  }
  const semanaDe = (p, hoje) => (p && p.semanas || []).find((s) => s.inicio <= hoje && hoje <= s.fim) || null;
  function situacao(p, hoje) {
    if (!p || !p.ciclo) return "sem";
    if (hoje < p.ciclo.inicio) return "antes";
    if (hoje > p.ciclo.fim) return "encerrado";
    return "andamento";
  }
  /* semanas (com os dias) que tocam o intervalo [de, ate] — para o relatório do período */
  function noPeriodo(p, de, ate) {
    if (!p || !Array.isArray(p.semanas)) return [];
    return p.semanas.filter((s) => (!ate || s.inicio <= ate) && (!de || s.fim >= de)).map((s) => ({
      n: s.n, inicio: s.inicio, fim: s.fim, grupo: ROTULO_GRUPO[s.grupo] || "", itens: rotulosItens(s.itens), obs: s.obs || "",
      dias: (s.dias || []).filter((d) => (!de || d.data >= de) && (!ate || d.data <= ate)).map((d) => ({ data: d.data, grupo: ROTULO_GRUPO[d.grupo] || "", itens: rotulosItens(d.itens), obs: d.obs || "" })),
    }));
  }
  const rotuloCiclo = (c) => !c ? "" : c.semanas + (c.semanas === 1 ? " semana" : " semanas") + " · " + dataBR(c.inicio) + " a " + dataBR(c.fim) + (c.dias && c.dias.length ? " · " + c.dias.map((d) => DIAS[d]).join(", ") : "") + (c.duracaoMin ? " · " + c.duracaoMin + " min" : "");
  const explicacaoCiclo = (n) => (CICLOS.find((c) => c.semanas === n) || CICLOS[CICLOS.length - 1]).d;

  /* página do aluno: o ciclo, a semana atual com os dias (hoje em destaque) e, aberto, o ciclo inteiro com o mensal */
  function htmlAluno(info, hoje, aberto) {
    const p = info && info.plano;
    if (!p) return "";
    const st = situacao(p, hoje), atual = semanaDe(p, hoje) || (st === "antes" ? p.semanas[0] : null);
    const linha = (g, itens) => [g ? ROTULO_GRUPO[g] : "", rotulosItens(itens).join(", ")].filter(Boolean).join(" · ");
    const sem = (s, destaque) => '<div style="border-top:1px solid #E2E8E5;padding:8px 0"><div style="font-weight:700">Semana ' + s.n + " · " + dataBR(s.inicio) + " a " + dataBR(s.fim) + "</div>" +
      (linha(s.grupo, s.itens) ? '<div style="font-size:13.5px">' + esc(linha(s.grupo, s.itens)) + "</div>" : "") + (s.obs ? '<div style="font-size:13px;color:#5B6B63;white-space:pre-line">' + esc(s.obs) + "</div>" : "") +
      (destaque && (s.dias || []).length ? (s.dias || []).map((d) => '<div style="margin-top:6px;padding:6px 8px;border-radius:8px;' + (d.data === hoje ? "background:#F1F8EA;border:1px solid #69B32A" : "background:#F6F8F7") + '"><b>' + DIAS[diaSemana(d.data)] + " " + dataBR(d.data) + (d.data === hoje ? " · hoje" : "") + "</b>" +
        (linha(d.grupo, d.itens) ? '<div style="font-size:13px">' + esc(linha(d.grupo, d.itens)) + "</div>" : "") + (d.obs ? '<div style="font-size:12.5px;color:#5B6B63;white-space:pre-line">' + esc(d.obs) + "</div>" : "") + "</div>").join("") : "") + "</div>";
    let h = '<div style="margin-top:8px"><div style="font-weight:700;font-size:15px">' + esc(info.equipe || "Equipe") + "</div>" +
      '<div style="font-size:12.5px;color:#5B6B63">Ciclo de ' + esc(rotuloCiclo(p.ciclo)) + (info.coordenador ? " · coord. " + esc(info.coordenador) : "") + "</div>" +
      (p.ciclo.grupo || p.ciclo.objetivo ? '<div style="font-size:13.5px;margin-top:4px">' + esc([p.ciclo.grupo ? ROTULO_GRUPO[p.ciclo.grupo] : "", p.ciclo.objetivo].filter(Boolean).join(" · ")) + "</div>" : "");
    if (st === "encerrado") h += '<p style="font-size:13px;color:#5B6B63">Este ciclo terminou em ' + dataBR(p.ciclo.fim) + ".</p>";
    if (atual) h += '<div style="font-size:12px;font-weight:700;color:#103B32;margin-top:8px;text-transform:uppercase;letter-spacing:.06em">' + (st === "antes" ? "Primeira semana" : "Esta semana") + "</div>" + sem(atual, true);
    if (aberto) {
      h += '<div style="font-size:12px;font-weight:700;color:#103B32;margin-top:10px;text-transform:uppercase;letter-spacing:.06em">Mês a mês</div>' +
        Object.entries(p.meses || {}).map(([m, x]) => '<div style="border-top:1px solid #E2E8E5;padding:6px 0"><b>' + esc(rotuloMes(m)) + "</b>" + (x.grupo ? " · " + esc(ROTULO_GRUPO[x.grupo]) : "") + (x.obs ? '<div style="font-size:13px;color:#5B6B63;white-space:pre-line">' + esc(x.obs) + "</div>" : "") + "</div>").join("") +
        '<div style="font-size:12px;font-weight:700;color:#103B32;margin-top:10px;text-transform:uppercase;letter-spacing:.06em">Todas as semanas</div>' + p.semanas.map((s) => sem(s, false)).join("");
    }
    return h + "</div>";
  }

  const api = { GRUPOS, ROTULO_GRUPO, CLASSIFICACAO, ROTULO_ITEM, CICLOS, DIAS, montarCiclo, limpar, semanaDe, situacao, noPeriodo, rotuloCiclo, explicacaoCiclo, rotuloMes, rotulosItens, htmlAluno, somar, diaSemana };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.QLPlanoEquipe = api;
})(typeof window !== "undefined" ? window : this);
