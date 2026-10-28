/* Rendimento da equipe de competição (Team Yoda): a avaliação ao final de cada sessão de treino do planejamento e o relatório do ciclo.
   Avaliação de uma sessão (plano.avaliacoes[data]): nota da sessão (1 a 5) e observação; por atleta, presente ou não, nota de rendimento
   (1 a 5), nota por item trabalhado no dia (opcional) e observação. Escala: 1 muito abaixo · 2 abaixo · 3 dentro do esperado · 4 acima ·
   5 excelente. As avaliações ficam só no app do treinador: o link do aluno não as recebe (só o que o coordenador publicar no relatório).
   Usa mty/plano-equipe.js (sessões, gráficos). Navegador: window.QLRendimentoEquipe; Node (testes): module.exports. */
(function (raiz) {
  const PE = typeof module !== "undefined" && module.exports ? require("./plano-equipe.js") : raiz.QLPlanoEquipe;
  const ESCALA = [[1, "Muito abaixo"], [2, "Abaixo"], [3, "Dentro do esperado"], [4, "Acima"], [5, "Excelente"]];
  const ORDEM_ITEM = Object.keys(PE.ROTULO_ITEM);
  const esc = PE.esc, dataBR = PE.dataBR;
  const nota = (v) => { const n = Math.round(+v); return n >= 1 && n <= 5 ? n : null; };
  const media = (l) => (l.length ? Math.round((l.reduce((s, x) => s + x, 0) / l.length) * 10) / 10 : null);
  const dec = (v) => (v == null ? "—" : v.toFixed(1).replace(".", ","));
  const pct = (a, b) => (b ? Math.round((a * 100) / b) : null);

  /* o que vai para o armazenamento: só campos conhecidos, notas de 1 a 5 */
  function limparAvaliacao(a, idsAtletas) {
    a = a || {};
    const atletas = {};
    Object.entries(a.atletas || {}).forEach(([id, r]) => {
      if (idsAtletas && !idsAtletas.includes(id)) return;
      r = r || {};
      const itens = {};
      Object.entries(r.itens || {}).forEach(([k, v]) => { if (PE.ROTULO_ITEM[k] && nota(v)) itens[k] = nota(v); });
      atletas[id] = r.presente === false ? { presente: false, obs: String(r.obs || "").slice(0, 600) } : { presente: true, nota: nota(r.nota), itens, obs: String(r.obs || "").slice(0, 600) };
    });
    return { nota: nota(a.nota), obs: String(a.obs || "").slice(0, 1500), atletas, autorNome: String(a.autorNome || "").slice(0, 80), atualizadoEm: String(a.atualizadoEm || "").slice(0, 30) };
  }
  const avaliacaoDe = (p, data) => ((p && p.avaliacoes) || {})[data] || null;

  /* rendimento de um atleta no ciclo (ou entre as datas): presença, média, notas por item, evolução e observações */
  function rendimentoAtleta(p, id, de, ate, nome) {
    const av = (p && p.avaliacoes) || {};
    const regs = PE.sessoes(p).filter((s) => (!de || s.data >= de) && (!ate || s.data <= ate)).map((s) => ({ s, r: av[s.data] && av[s.data].atletas && av[s.data].atletas[id] })).filter((x) => x.r);
    if (!regs.length) return null;
    const pres = regs.filter((x) => x.r.presente !== false), notas = pres.map((x) => nota(x.r.nota)).filter(Boolean);
    const porItemL = {};
    pres.forEach((x) => Object.entries(x.r.itens || {}).forEach(([k, v]) => { if (PE.ROTULO_ITEM[k] && nota(v)) (porItemL[k] = porItemL[k] || []).push(nota(v)); }));
    const porItem = ORDEM_ITEM.filter((k) => porItemL[k]).map((k) => ({ item: k, rotulo: PE.ROTULO_ITEM[k], media: media(porItemL[k]), n: porItemL[k].length }));
    const porSemana = [...new Set(pres.map((x) => x.s.n))].map((n) => ({ n, media: media(pres.filter((x) => x.s.n === n).map((x) => nota(x.r.nota)).filter(Boolean)) })).filter((x) => x.media != null);
    let tendencia = null;
    if (notas.length >= 4) {
      const meio = Math.floor(notas.length / 2), a = media(notas.slice(0, meio)), b = media(notas.slice(notas.length - meio));
      tendencia = { de: a, para: b, direcao: b - a >= 0.3 ? "subiu" : a - b >= 0.3 ? "caiu" : "estavel" };
    }
    const ord = porItem.filter((x) => x.n >= 1);
    return {
      id, nome: nome || "", sessoes: regs.length, presencas: pres.length, faltas: regs.length - pres.length, presenca: pct(pres.length, regs.length), media: media(notas), notas: notas.length,
      porItem, porSemana, tendencia,
      destaques: ord.filter((x) => x.media >= 4).sort((a, b) => b.media - a.media).slice(0, 3).map((x) => x.rotulo),
      desenvolver: ord.filter((x) => x.media <= 2.5).sort((a, b) => a.media - b.media).slice(0, 3).map((x) => x.rotulo),
      obs: regs.filter((x) => x.r.obs).map((x) => ({ data: x.s.data, texto: x.r.obs })),
    };
  }

  /* o ciclo inteiro até hoje: sessões avaliadas, médias por semana e por item, cada atleta e as observações das sessões */
  function resumo(p, membros, hoje) {
    const ss = PE.sessoes(p), av = (p && p.avaliacoes) || {};
    const aval = ss.filter((s) => av[s.data]).map((s) => ({ ...s, a: av[s.data] }));
    const todos = [].concat(...aval.map((x) => Object.values(x.a.atletas || {})));
    const presentes = todos.filter((r) => r.presente !== false), notas = presentes.map((r) => nota(r.nota)).filter(Boolean);
    const porSemana = ((p && p.semanas) || []).map((s) => {
      const l = aval.filter((x) => x.n === s.n), rs = [].concat(...l.map((x) => Object.values(x.a.atletas || {}))), pr = rs.filter((r) => r.presente !== false);
      return { n: s.n, inicio: s.inicio, fim: s.fim, sessoes: ss.filter((x) => x.n === s.n).length, avaliadas: l.length, media: media(pr.map((r) => nota(r.nota)).filter(Boolean)), presenca: pct(pr.length, rs.length), notaSessao: media(l.map((x) => nota(x.a.nota)).filter(Boolean)) };
    });
    const itL = {};
    presentes.forEach((r) => Object.entries(r.itens || {}).forEach(([k, v]) => { if (PE.ROTULO_ITEM[k] && nota(v)) (itL[k] = itL[k] || []).push(nota(v)); }));
    return {
      sessoes: ss.length, passadas: ss.filter((s) => !hoje || s.data <= hoje).length, avaliadas: aval.length,
      media: media(notas), presenca: pct(presentes.length, todos.length), notaSessao: media(aval.map((x) => nota(x.a.nota)).filter(Boolean)),
      porSemana, porItem: ORDEM_ITEM.filter((k) => itL[k]).map((k) => ({ item: k, rotulo: PE.ROTULO_ITEM[k], media: media(itL[k]), n: itL[k].length })),
      atletas: (membros || []).map((m) => rendimentoAtleta(p, m.id, null, null, m.nome) || { id: m.id, nome: m.nome, sessoes: 0, presencas: 0, faltas: 0, presenca: null, media: null, notas: 0, porItem: [], porSemana: [], tendencia: null, destaques: [], desenvolver: [], obs: [] }),
      obsSessoes: aval.filter((x) => x.a.obs || nota(x.a.nota)).map((x) => ({ data: x.data, n: x.n, grupo: x.grupo, itens: x.itens, nota: nota(x.a.nota), obs: x.a.obs || "", autor: x.a.autorNome || "" })),
    };
  }

  /* ── gráficos (mesmas peças do planejamento) ── */
  const textoTendencia = (t) => (!t ? "" : t.direcao === "subiu" ? "↑ subiu de " + dec(t.de) + " para " + dec(t.para) : t.direcao === "caiu" ? "↓ caiu de " + dec(t.de) + " para " + dec(t.para) : "→ estável (" + dec(t.para) + ")");
  function graficoRendimentoSemana(res) {
    const l = res.porSemana.filter((s) => s.media != null);
    if (!l.length) return "";
    return PE.vizSecao("Rendimento médio por semana", "Média das notas dos atletas presentes, de 1 a 5.",
      l.map((s) => PE.vizLinha("Semana " + s.n, (s.media / 5) * 100, PE.V.barra, dec(s.media), "Semana " + s.n + ": média " + dec(s.media) + (s.presenca != null ? " · presença " + s.presenca + "%" : "") + " · " + s.avaliadas + " de " + s.sessoes + " sessões avaliadas")).join("") +
      PE.vizTabela(["Semana", "Média", "Presença", "Sessões avaliadas"], l.map((s) => ["Semana " + s.n, dec(s.media), s.presenca == null ? "—" : s.presenca + "%", s.avaliadas + " de " + s.sessoes])));
  }
  function graficoRendimentoItem(itens, titulo) {
    if (!itens.length) return "";
    return PE.vizSecao(titulo || "Rendimento por item", "Média das notas por item avaliado, de 1 a 5.",
      itens.map((x) => PE.vizLinha(x.rotulo, (x.media / 5) * 100, PE.V.barra, dec(x.media), x.rotulo + ": média " + dec(x.media) + " em " + PE.plural(x.n, "avaliação", "avaliações"))).join("") +
      PE.vizTabela(["Item", "Média", "Avaliações"], itens.map((x) => [x.rotulo, dec(x.media), x.n])));
  }
  function htmlAtletas(res) {
    if (!res.atletas.length) return "";
    return PE.vizSecao("Atletas", "Presença nas sessões avaliadas e rendimento médio (1 a 5).",
      res.atletas.map((a) => '<div data-atleta-rendimento="' + esc(a.nome) + '" style="border-top:1px solid ' + PE.V.linha + ';padding:7px 0">' +
        '<div style="font-weight:700;font-size:13.5px;color:' + PE.V.tinta + '">' + esc(a.nome) + "</div>" +
        (a.sessoes ? PE.vizLinha("Rendimento", a.media != null ? (a.media / 5) * 100 : 0, PE.V.barra, dec(a.media), a.nome + ": média " + dec(a.media)) +
          '<div style="font-size:12.5px;color:' + PE.V.sec + '">Presença ' + a.presencas + " de " + a.sessoes + (a.presenca != null ? " (" + a.presenca + "%)" : "") + (a.tendencia ? " · " + esc(textoTendencia(a.tendencia)) : "") + "</div>" +
          (a.destaques.length ? '<div style="font-size:12.5px;color:' + PE.V.tinta + '">Destaques: ' + a.destaques.map(esc).join(", ") + "</div>" : "") +
          (a.desenvolver.length ? '<div style="font-size:12.5px;color:' + PE.V.tinta + '">A desenvolver: ' + a.desenvolver.map(esc).join(", ") + "</div>" : "")
          : '<div style="font-size:12.5px;color:' + PE.V.sec + '">Ainda sem avaliação.</div>') + "</div>").join("") +
      PE.vizTabela(["Atleta", "Presença", "Média", "Evolução"], res.atletas.map((a) => [a.nome, a.sessoes ? a.presencas + "/" + a.sessoes : "—", dec(a.media), textoTendencia(a.tendencia) || "—"])));
  }
  function htmlRendimento(res) {
    const nums = [[res.avaliadas + " de " + res.passadas, "sessões já feitas avaliadas"]];
    if (res.presenca != null) nums.push([res.presenca + "%", "de presença"]);
    if (res.media != null) nums.push([dec(res.media), "rendimento médio (1 a 5)"]);
    if (res.notaSessao != null) nums.push([dec(res.notaSessao), "nota média das sessões"]);
    return '<div data-rendimento>' + PE.vizNumeros(nums) + graficoRendimentoSemana(res) + graficoRendimentoItem(res.porItem) + htmlAtletas(res) + "</div>";
  }

  /* relatório do ciclo (PDF): o planejamento com os gráficos, o rendimento da equipe e de cada atleta e as observações das sessões */
  function documento(info, p, membros, hoje) {
    info = info || {};
    const res = resumo(p, membros, hoje), st = PE.situacao(p, hoje);
    const h3 = (t) => '<h2 style="font-size:16px;margin:22px 0 4px;border-bottom:1px solid #E2E8E5;padding-bottom:4px">' + esc(t) + "</h2>";
    const corpo = [
      '<div style="border-bottom:2px solid #103B32;padding-bottom:8px"><p style="font-size:21px;font-weight:700;margin:0">Relatório do ciclo · ' + esc(info.equipe || "Equipe") + "</p>" +
        '<p style="font-size:13px;color:#5B6B63;margin:2px 0 0">Ciclo de ' + esc(PE.rotuloCiclo(p.ciclo)) + (info.coordenador ? " · coord. " + esc(info.coordenador) : "") + (info.academia ? " · " + esc(info.academia) : "") + "</p>" +
        '<p style="font-size:12.5px;color:#5B6B63;margin:2px 0 0">' + (st === "encerrado" ? "Ciclo encerrado" : "Relatório parcial (ciclo em andamento)") + " · gerado em " + esc(dataBR(hoje)) + "</p></div>",
      p.ciclo.objetivo || p.ciclo.grupo ? '<p style="font-size:14px;margin:10px 0 0">' + esc([p.ciclo.grupo ? PE.ROTULO_GRUPO[p.ciclo.grupo] : "", p.ciclo.objetivo].filter(Boolean).join(" · ")) + "</p>" : "",
      h3("O planejamento"), PE.htmlVisaoGeral(p),
      h3("Rendimento"), res.avaliadas ? htmlRendimento(res) : '<p style="font-size:14px;color:#5B6B63">Nenhuma sessão avaliada ainda.</p>',
      res.obsSessoes.length ? h3("Observações das sessões") + res.obsSessoes.map((o) => '<div style="border-top:1px solid #E2E8E5;padding:6px 0;font-size:13.5px"><b>' + esc(PE.DIAS[PE.diaSemana(o.data)] + " " + dataBR(o.data)) + "</b> · semana " + o.n +
        (o.grupo ? " · " + esc(PE.ROTULO_GRUPO[o.grupo]) : "") + (o.nota ? " · sessão " + o.nota + "/5" : "") + (o.obs ? '<div style="white-space:pre-line">' + esc(o.obs) + "</div>" : "") + "</div>").join("") : "",
      res.atletas.some((a) => a.obs.length) ? h3("Observações por atleta") + res.atletas.filter((a) => a.obs.length).map((a) => '<div style="border-top:1px solid #E2E8E5;padding:6px 0;font-size:13.5px"><b>' + esc(a.nome) + "</b>" + a.obs.map((o) => '<div><span style="color:#5B6B63">' + esc(dataBR(o.data)) + ":</span> " + esc(o.texto) + "</div>").join("") + "</div>").join("") : "",
      h3("Semana a semana") + p.semanas.map((s) => { const r = res.porSemana.find((x) => x.n === s.n) || {}; return '<div style="border-top:1px solid #E2E8E5;padding:6px 0;font-size:13.5px"><b>Semana ' + s.n + "</b> · " + esc(dataBR(s.inicio)) + " a " + esc(dataBR(s.fim)) +
        ([s.grupo ? PE.ROTULO_GRUPO[s.grupo] : "", PE.rotulosItens(s.itens).join(", ")].filter(Boolean).length ? '<div>' + esc([s.grupo ? PE.ROTULO_GRUPO[s.grupo] : "", PE.rotulosItens(s.itens).join(", ")].filter(Boolean).join(" · ")) + "</div>" : "") +
        (s.obs ? '<div style="color:#5B6B63;white-space:pre-line">' + esc(s.obs) + "</div>" : "") + (r.avaliadas ? '<div style="color:#5B6B63">' + r.avaliadas + " de " + r.sessoes + " sessões avaliadas" + (r.media != null ? " · rendimento " + dec(r.media) : "") + (r.presenca != null ? " · presença " + r.presenca + "%" : "") + "</div>" : "") + "</div>"; }).join(""),
      '<p style="font-size:11.5px;color:#5B6B63;margin-top:16px">Notas de 1 a 5 dadas pela comissão ao final de cada sessão (1 muito abaixo · 3 dentro do esperado · 5 excelente).</p>',
    ];
    return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório do ciclo · ' + esc(info.equipe || "Equipe") + "</title>" +
      '<style>body{margin:24px auto;max-width:720px;padding:0 16px;font-family:Inter,system-ui,sans-serif;color:#17251F;line-height:1.45;background:#fff}details{display:none}@media print{body{margin:10mm}}</style></head><body>' +
      corpo.join("") + "<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>";
  }

  const api = { ESCALA, limparAvaliacao, avaliacaoDe, rendimentoAtleta, resumo, textoTendencia, graficoRendimentoSemana, graficoRendimentoItem, htmlAtletas, htmlRendimento, documento, dec };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.QLRendimentoEquipe = api;
})(typeof window !== "undefined" ? window : this);
