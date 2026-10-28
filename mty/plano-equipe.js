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

  /* ── visão do planejamento fechado: números do ciclo e gráficos (HTML com estilo próprio, igual no app, no link do aluno e nos relatórios) ──
     Cores dos grandes grupos (validadas com o validador de paleta do dataviz, ordem fixa, nunca pelo tamanho): técnico azul, tático laranja,
     misto verde-água; "sem grupo" em cinza. O valor vem sempre escrito ao lado da barra e cada gráfico tem a versão em tabela. */
  const COR_GRUPO = { tecnico: "#2a78d6", tatico: "#eb6834", misto: "#1baf7a", "": "#B9C3BE" };
  const V = { tinta: "#17251F", sec: "#5B6B63", linha: "#E2E8E5", trilho: "#EEF2F0", barra: "#103B32", fonte: "Inter,system-ui,-apple-system,'Segoe UI',sans-serif" };
  const fechado = (p) => !!(p && p.ciclo) && p.status !== "rascunho"; /* planejamentos de antes do "Fechar" contam como fechados */
  const catDoItem = (v) => (CLASSIFICACAO.find((g) => g.itens.some((x) => x[0] === v)) || {}).r || "";
  /* cada dia de treino é uma sessão; sem grupo ou itens próprios, o dia segue a semana */
  function sessoes(p) {
    return ((p && p.semanas) || []).flatMap((s) => (s.dias || []).map((d) => ({ n: s.n, data: d.data, grupo: grupoValido(d.grupo) || grupoValido(s.grupo), itens: itensValidos(d.itens && d.itens.length ? d.itens : s.itens), obs: d.obs || "" })));
  }
  function estatisticas(p) {
    const ss = sessoes(p), zero = () => ({ tecnico: 0, tatico: 0, misto: 0, "": 0 });
    const porGrupo = zero(); ss.forEach((x) => { porGrupo[x.grupo]++; });
    const porSemana = ((p && p.semanas) || []).map((s) => { const c = zero(); ss.filter((x) => x.n === s.n).forEach((x) => { c[x.grupo]++; }); return { n: s.n, inicio: s.inicio, fim: s.fim, grupos: c, total: ss.filter((x) => x.n === s.n).length }; });
    const porItem = ORDEM_ITEM.map((v) => ({ item: v, rotulo: ROTULO_ITEM[v], cat: catDoItem(v), sessoes: ss.filter((x) => x.itens.includes(v)).length })).filter((x) => x.sessoes);
    const min = (p && p.ciclo && p.ciclo.duracaoMin) || 0;
    return { sessoes: ss.length, minutos: ss.length * min, porGrupo, porSemana, porItem };
  }
  const horas = (min) => { const h = Math.floor(min / 60), m = min % 60; return h ? h + " h" + (m ? " " + m + " min" : "") : m + " min"; };
  const plural = (n, um, varios) => n + " " + (n === 1 ? um : varios);
  /* peças dos gráficos */
  function vizSecao(titulo, nota, corpo) {
    return '<div data-grafico style="margin-top:14px;font-family:' + V.fonte + '"><div style="font-weight:700;font-size:14.5px;color:' + V.tinta + '">' + esc(titulo) + "</div>" + (nota ? '<div style="font-size:12.5px;color:' + V.sec + ';margin:1px 0 6px">' + esc(nota) + "</div>" : "") + corpo + "</div>";
  }
  function vizLegenda(itens) {
    return '<div style="display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12.5px;color:' + V.sec + ';margin:4px 0 6px">' + itens.map(([nome, cor]) => '<span style="display:inline-flex;align-items:center;gap:5px"><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:' + cor + '"></i>' + esc(nome) + "</span>").join("") + "</div>";
  }
  function vizLinha(rot, pct, cor, valor, titulo) {
    const w = pct > 0 ? Math.max(pct, 2) : 0;
    return '<div style="display:flex;align-items:center;gap:8px;margin:4px 0" title="' + esc(titulo || rot + ": " + valor) + '"><div style="width:104px;flex:none;font-size:12.5px;color:' + V.tinta + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(rot) + "</div>" +
      '<div role="img" aria-label="' + esc(titulo || rot + ": " + valor) + '" style="flex:1;min-width:0;height:12px;border-radius:4px;background:' + V.trilho + '"><div style="height:12px;border-radius:4px;width:' + w.toFixed(1) + "%;background:" + cor + '"></div></div>' +
      '<div style="width:62px;flex:none;text-align:right;font-size:12.5px;font-variant-numeric:tabular-nums;color:' + V.tinta + '">' + esc(valor) + "</div></div>";
  }
  function vizPilha(rot, partes, total, maxTotal, valor, titulo) {
    const larg = maxTotal > 0 && total > 0 ? Math.max((total / maxTotal) * 100, 4) : 0;
    return '<div style="display:flex;align-items:center;gap:8px;margin:4px 0"><div style="width:104px;flex:none;font-size:12.5px;color:' + V.tinta + '">' + esc(rot) + "</div>" +
      '<div role="img" aria-label="' + esc(titulo) + '" style="flex:1;min-width:0;height:12px"><div style="display:flex;gap:2px;height:12px;width:' + larg.toFixed(1) + '%">' +
      partes.filter((x) => x.v > 0).map((x) => '<b title="' + esc(x.titulo) + '" style="flex:' + x.v + ";background:" + x.cor + ';border-radius:3px"></b>').join("") + "</div></div>" +
      '<div style="width:62px;flex:none;text-align:right;font-size:12.5px;font-variant-numeric:tabular-nums;color:' + V.tinta + '">' + esc(valor) + "</div></div>";
  }
  function vizTabela(cab, linhas) {
    return '<details style="margin-top:4px"><summary style="cursor:pointer;font-size:12.5px;color:' + V.sec + '">Ver como tabela</summary><div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:12.5px;margin-top:4px;min-width:100%"><thead><tr>' +
      cab.map((c) => '<th style="text-align:left;padding:3px 8px 3px 0;border-bottom:1px solid ' + V.linha + '">' + esc(c) + "</th>").join("") + "</tr></thead><tbody>" +
      linhas.map((l) => "<tr>" + l.map((c) => '<td style="padding:3px 8px 3px 0;border-bottom:1px solid ' + V.linha + ';font-variant-numeric:tabular-nums">' + esc(c) + "</td>").join("") + "</tr>").join("") + "</tbody></table></div></details>";
  }
  function vizNumeros(l) {
    return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:8px;margin-top:8px;font-family:' + V.fonte + '">' + l.map(([v, r]) => '<div style="border:1px solid ' + V.linha + ';border-radius:10px;padding:7px 9px;background:#fff"><b style="display:block;font-size:19px;color:' + V.tinta + '">' + esc(v) + '</b><span style="font-size:11.5px;color:' + V.sec + '">' + esc(r) + "</span></div>").join("") + "</div>";
  }
  const ROT_GRUPO_GRAF = [["tecnico", "Técnico"], ["tatico", "Tático"], ["misto", "Misto"], ["", "Sem grupo"]];
  function graficoGruposSemana(p) {
    const e = estatisticas(p), max = Math.max(0, ...e.porSemana.map((s) => s.total));
    if (!e.sessoes) return "";
    const usados = ROT_GRUPO_GRAF.filter(([g]) => e.porGrupo[g] > 0);
    return vizSecao("Sessões por grupo em cada semana", "Cada barra é uma semana; o tamanho é o número de sessões.",
      vizLegenda(usados.map(([g, r]) => [r + " · " + e.porGrupo[g], COR_GRUPO[g]])) +
      e.porSemana.map((s) => {
        const desc = usados.filter(([g]) => s.grupos[g]).map(([g, r]) => r + " " + s.grupos[g]).join(", ");
        return vizPilha("Semana " + s.n, usados.map(([g, r]) => ({ v: s.grupos[g], cor: COR_GRUPO[g], titulo: "Semana " + s.n + " · " + r + ": " + plural(s.grupos[g], "sessão", "sessões") })), s.total, max, plural(s.total, "sessão", "sessões"), "Semana " + s.n + ": " + (desc || "sem sessões"));
      }).join("") +
      vizTabela(["Semana", ...usados.map(([, r]) => r), "Total"], e.porSemana.map((s) => ["Semana " + s.n + " (" + dataBR(s.inicio) + ")", ...usados.map(([g]) => s.grupos[g]), s.total])));
  }
  function graficoItens(p) {
    const e = estatisticas(p), max = Math.max(0, ...e.porItem.map((x) => x.sessoes));
    if (!e.porItem.length) return "";
    return vizSecao("O que o ciclo trabalha", "Em quantas sessões cada item aparece.",
      CLASSIFICACAO.map((g) => { const l = e.porItem.filter((x) => x.cat === g.r); return l.length ? '<div style="font-size:11px;font-weight:700;color:' + V.sec + ';text-transform:uppercase;letter-spacing:.06em;margin-top:8px">' + esc(g.r) + "</div>" + l.map((x) => vizLinha(x.rotulo, (x.sessoes / max) * 100, V.barra, plural(x.sessoes, "sessão", "sessões"))).join("") : ""; }).join("") +
      vizTabela(["Item", "Grupo", "Sessões"], e.porItem.map((x) => [x.rotulo, x.cat, x.sessoes])));
  }
  /* visão geral: números do ciclo e os dois gráficos */
  function htmlVisaoGeral(p) {
    if (!p || !p.ciclo) return "";
    const e = estatisticas(p);
    const nums = [[p.ciclo.semanas, p.ciclo.semanas === 1 ? "semana" : "semanas"], [e.sessoes, e.sessoes === 1 ? "sessão de treino" : "sessões de treino"]];
    if (e.minutos) nums.push([horas(e.minutos), "de treino planejado"]);
    ROT_GRUPO_GRAF.slice(0, 3).forEach(([g, r]) => { if (e.porGrupo[g]) nums.push([e.porGrupo[g], "sessões · " + r.toLowerCase()]); });
    return '<div data-visao-geral>' + vizNumeros(nums) + graficoGruposSemana(p) + graficoItens(p) + "</div>";
  }

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
    let h = '<div style="margin-top:8px;font-family:' + V.fonte + '"><div style="font-weight:700;font-size:15px">' + esc(info.equipe || "Equipe") + "</div>" +
      '<div style="font-size:12.5px;color:#5B6B63">Ciclo de ' + esc(rotuloCiclo(p.ciclo)) + (info.coordenador ? " · coord. " + esc(info.coordenador) : "") + "</div>" +
      (p.ciclo.grupo || p.ciclo.objetivo ? '<div style="font-size:13.5px;margin-top:4px">' + esc([p.ciclo.grupo ? ROTULO_GRUPO[p.ciclo.grupo] : "", p.ciclo.objetivo].filter(Boolean).join(" · ")) + "</div>" : "");
    if (st === "encerrado") h += '<p style="font-size:13px;color:#5B6B63">Este ciclo terminou em ' + dataBR(p.ciclo.fim) + ".</p>";
    if (atual) h += '<div style="font-size:12px;font-weight:700;color:#103B32;margin-top:8px;text-transform:uppercase;letter-spacing:.06em">' + (st === "antes" ? "Primeira semana" : "Esta semana") + "</div>" + sem(atual, true);
    if (aberto) {
      h += '<div style="font-size:12px;font-weight:700;color:#103B32;margin-top:10px;text-transform:uppercase;letter-spacing:.06em">Visão geral do ciclo</div>' + htmlVisaoGeral(p);
      h += '<div style="font-size:12px;font-weight:700;color:#103B32;margin-top:10px;text-transform:uppercase;letter-spacing:.06em">Mês a mês</div>' +
        Object.entries(p.meses || {}).map(([m, x]) => '<div style="border-top:1px solid #E2E8E5;padding:6px 0"><b>' + esc(rotuloMes(m)) + "</b>" + (x.grupo ? " · " + esc(ROTULO_GRUPO[x.grupo]) : "") + (x.obs ? '<div style="font-size:13px;color:#5B6B63;white-space:pre-line">' + esc(x.obs) + "</div>" : "") + "</div>").join("") +
        '<div style="font-size:12px;font-weight:700;color:#103B32;margin-top:10px;text-transform:uppercase;letter-spacing:.06em">Todas as semanas</div>' + p.semanas.map((s) => sem(s, false)).join("");
    }
    return h + "</div>";
  }

  const api = { GRUPOS, ROTULO_GRUPO, CLASSIFICACAO, ROTULO_ITEM, CICLOS, DIAS, montarCiclo, limpar, semanaDe, situacao, noPeriodo, rotuloCiclo, explicacaoCiclo, rotuloMes, rotulosItens, htmlAluno, somar, diaSemana,
    COR_GRUPO, V, fechado, sessoes, estatisticas, horas, plural, vizSecao, vizLegenda, vizLinha, vizPilha, vizTabela, vizNumeros, graficoGruposSemana, graficoItens, htmlVisaoGeral, dataBR, esc };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.QLPlanoEquipe = api;
})(typeof window !== "undefined" ? window : this);
