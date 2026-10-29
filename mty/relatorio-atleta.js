/* Relatório do atleta (Team Yoda): junta, de um período (um torneio, um mês ou datas livres), o que já foi registrado do jogador —
   jogos com scout, observações de partida (resumos), análises de movimento (biomecânica) e jogos em vídeo — e a observação do
   treinador. O mesmo desenho aparece na prévia do treinador, na página do aluno (link dos pais) e no PDF.

   Só organiza o que foi registrado: não tira conclusões nem transforma contagem em avaliação. "Perguntas para conversar" (anotação
   interna do treinador) nunca entra. Rodando no navegador: window.QLRelatorioAtleta; no Node (testes): module.exports.

   · coletar(aluno, movimentos, periodo)  → dados do relatório no app do treinador (registros do caderno + análises de movimento)
   · coletarDoLink(d, periodo)            → o mesmo formato a partir do que a página do aluno recebe (botão "Gerar relatório")
   · html(relatorio, opcoes)              → o relatório em HTML (texto sempre escapado); css → estilos; documento() → página para imprimir/PDF
   periodo: { tipo: "torneio", torneio } | { tipo: "mes", mes: "AAAA-MM" } | { tipo: "datas", de, ate } (datas AAAA-MM-DD). */
(function (raiz) {
  const PE = typeof module !== "undefined" && module.exports ? require("./plano-equipe.js") : raiz.QLPlanoEquipe;
  /* avaliações de rendimento das sessões da equipe (só no app do treinador; a página do aluno não as recebe) */
  const RE = () => (typeof module !== "undefined" && module.exports ? require("./equipe-rendimento.js") : raiz.QLRendimentoEquipe);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
  const dia = (s) => String(s || "").slice(0, 10);
  const dataBR = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || "")); return m ? m[3] + "/" + m[2] + "/" + m[1] : ""; };
  const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const NOME_GOLPE = { forehand: "Forehand", backhand: "Backhand", saque: "Saque" };
  const nomeGolpe = (m) => (NOME_GOLPE[m.golpe] || "Golpe") + (m.golpe === "backhand" ? (String(m.emp) === "1" ? " (uma mão)" : " (duas mãos)") : "");
  const linhas = (t) => String(t || "").split("\n").map((l) => l.replace(/^\s*[-•*]\s*/, "").trim()).filter(Boolean);
  const media = (l) => (l.length ? Math.round(l.reduce((s, x) => s + x, 0) / l.length) : null);
  const unicos = (l) => { const v = new Set(); return l.filter((x) => { const k = norm(x); if (!k || v.has(k)) return false; v.add(k); return true; }); };
  const torneioDe = (t) => (norm(t) === "jogo-treino" || norm(t) === "jogo treino" ? "" : String(t || "").trim());

  /* período → intervalo de datas e rótulo (o de torneio usa as datas do que foi registrado nele) */
  function intervalo(p, datasTorneio) {
    if (!p) return { de: "", ate: "" };
    if (p.tipo === "mes" && /^\d{4}-\d{2}$/.test(p.mes || "")) {
      const [a, m] = p.mes.split("-").map(Number), fim = new Date(Date.UTC(a, m, 0)).getUTCDate();
      return { de: p.mes + "-01", ate: p.mes + "-" + String(fim).padStart(2, "0") };
    }
    if (p.tipo === "datas") return { de: dia(p.de), ate: dia(p.ate) };
    if (p.tipo === "torneio") { const d = (datasTorneio || []).filter(Boolean).sort(); return { de: d[0] || "", ate: d[d.length - 1] || "" }; }
    return { de: "", ate: "" };
  }
  function rotuloPeriodo(p, iv) {
    if (!p) return "";
    if (p.tipo === "torneio") return (p.torneio || "Torneio") + (iv && iv.de ? " · " + dataBR(iv.de) + (iv.ate && iv.ate !== iv.de ? " a " + dataBR(iv.ate) : "") : "");
    if (p.tipo === "mes" && /^\d{4}-\d{2}$/.test(p.mes || "")) { const [a, m] = p.mes.split("-").map(Number); return MESES[m - 1].replace(/^./, (c) => c.toUpperCase()) + " de " + a; }
    if (p.tipo === "datas") return (p.de ? dataBR(p.de) : "início") + " a " + (p.ate ? dataBR(p.ate) : "hoje");
    if (p.tipo === "tudo") return "Todos os registros";
    return "";
  }
  const dentro = (data, iv) => { const d = dia(data); return !!d && (!iv.de || d >= iv.de) && (!iv.ate || d <= iv.ate); };

  /* torneios que aparecem nos registros (para escolher o período "torneio") */
  function torneiosDoAluno(aluno) {
    const l = [];
    (aluno && aluno.registros || []).forEach((r) => { if (r && (r.tipo === "jogo" || r.tipo === "observacao")) { const t = torneioDe(r.torneio); if (t) l.push({ nome: t, data: dia(r.data) }); } });
    const mapa = new Map();
    l.forEach((x) => { const k = norm(x.nome), a = mapa.get(k); if (!a || x.data > a.data) mapa.set(k, x); });
    return [...mapa.values()].sort((a, b) => b.data.localeCompare(a.data)).map((x) => x.nome);
  }

  function resumoObservacao(r) {
    const res = r.resumo, obs = r.obs || [];
    /* com o resumo revisado ao concluir o jogo, ele manda; sem ele (registros antigos), os textos pelo tipo */
    if (res) return { positivos: linhas(res.positivos), atencao: linhas(res.atencao), insights: linhas(res.insights), prioridades: linhas(res.prioridades) };
    const t = (f) => obs.filter(f).map((o) => String(o.texto || "").trim()).filter(Boolean);
    return { positivos: t((o) => o.natureza === "positivo"), atencao: t((o) => o.natureza === "atencao"), insights: t((o) => o.natureza === "insight"), prioridades: t((o) => o.prioridade) };
  }
  function montar(base) {
    const j = base.jogos, sc = j.filter((x) => x.n > 0), obs = base.obsBlocos;
    const juntar = (k) => unicos([].concat(...obs.map((o) => o[k])));
    return {
      versao: 1, nome: base.nome, periodo: base.periodo, rotulo: base.rotulo, de: base.iv.de, ate: base.iv.ate, geradoEm: new Date().toISOString(),
      numeros: { jogos: j.length, jogosComScout: sc.length, pontos: sc.reduce((s, x) => s + x.n, 0), pctGanhosMedio: media(sc.map((x) => x.pctGanhos).filter((v) => typeof v === "number")),
        pctPrimeiroMedio: media(sc.map((x) => x.pctPrimeiro).filter((v) => typeof v === "number" && v > 0)), observacoes: obs.length, movimentos: base.movimentos.length, videos: base.videos.length },
      torneios: unicos(j.map((x) => x.torneio).concat(obs.map((o) => o.torneio))),
      jogos: j, positivos: juntar("positivos"), atencao: juntar("atencao"), foco: unicos(juntar("prioridades").concat(juntar("insights"))),
      movimentos: base.movimentos, videos: base.videos,
      /* planejamento da equipe no período (semanas e dias que tocam as datas do relatório) */
      planejamento: (base.planos || []).map((x) => ({ equipe: String(x.equipe || "Equipe"), ciclo: PE ? PE.rotuloCiclo(x.plano.ciclo) : "", semanas: PE ? PE.noPeriodo(x.plano, base.iv.de, base.iv.ate) : [] })).filter((x) => x.semanas.length),
      /* rendimento nos treinos da equipe no período (presença, média, itens, evolução e observações da comissão) */
      rendimento: base.alunoId && RE() ? (base.planos || []).map((x) => { const r = RE().rendimentoAtleta(x.plano, base.alunoId, base.iv.de, base.iv.ate); return r && { equipe: String(x.equipe || "Equipe"), ...r }; }).filter(Boolean) : [],
    };
  }

  const chaveMov = (m) => m.id || m.data + "|" + m.golpe;
  /* app do treinador: registros do caderno + análises de movimento do jogador */
  /* planos: [{ equipe, plano }] — o planejamento das equipes de competição do atleta (opcional) */
  function coletar(aluno, movimentos, periodo, planos) {
    const regs = (aluno && aluno.registros) || [];
    const doTorneio = periodo && periodo.tipo === "torneio";
    const noTorneio = (r) => norm(torneioDe(r.torneio)) === norm(periodo.torneio);
    const candidatos = regs.filter((r) => r && (r.tipo === "jogo" || (r.tipo === "observacao" && r.contexto !== "conversa")));
    const iv = intervalo(periodo, doTorneio ? candidatos.filter(noTorneio).map((r) => dia(r.data)) : null);
    const vale = (r) => (doTorneio ? noTorneio(r) : dentro(r.data, iv));
    const jogos = candidatos.filter((r) => r.tipo === "jogo" && vale(r)).sort((a, b) => dia(a.data).localeCompare(dia(b.data))).map((r) => {
      const s = r.scout || {};
      return { data: dia(r.data), torneio: torneioDe(r.torneio), adversario: r.adversario && r.adversario !== "—" ? String(r.adversario) : "", resultado: String(r.resultado || ""),
        n: +s.n || 0, pctGanhos: typeof s.pctGanhos === "number" ? s.pctGanhos : null, pctPrimeiro: s.saquesMarcados ? s.pctPrimeiro : null, df: +s.df || 0, observacaoFinal: String(r.observacaoFinal || "").slice(0, 600) };
    });
    const obsBlocos = candidatos.filter((r) => r.tipo === "observacao" && vale(r)).map((r) => ({ torneio: torneioDe(r.torneio), ...resumoObservacao(r) }));
    const movs = (movimentos || []).filter((m) => m && iv.de && dentro(m.criadoEm, iv)).sort((a, b) => String(a.criadoEm).localeCompare(String(b.criadoEm)))
      .map((m) => ({ id: String(m.id || ""), data: dia(m.criadoEm), golpe: nomeGolpe(m), ok: +((m.res || {}).ok) || 0, atencao: +((m.res || {}).atencao) || 0, prio: (m.prio || []).slice(0, 4).map(String) }));
    const videos = ((aluno && aluno.jogosVideo) || []).filter((h) => h && h.res && iv.de && dentro(h.criadoEm, iv))
      .map((h) => ({ data: dia(h.criadoEm), pontos: +h.res.total || 0, pctGanhos: typeof h.res.pctGanhos === "number" ? h.res.pctGanhos : null }));
    return montar({ nome: (aluno && aluno.nome) || "Jogador", periodo, rotulo: rotuloPeriodo(periodo, iv), iv, jogos, obsBlocos, movimentos: movs, videos, planos: (planos || []).filter((x) => x && x.plano), alunoId: aluno && aluno.id });
  }

  /* página do aluno: o que o link já recebe (jogos, análises de movimento, observações compartilhadas) */
  function coletarDoLink(d, periodo) {
    d = d || {};
    const iv = periodo && periodo.tipo === "tudo" ? { de: "", ate: "" } : intervalo(periodo);
    const vale = (data) => (!iv.de && !iv.ate) || dentro(data, iv);
    const jogos = (d.jogos || []).filter((j) => vale(j.data)).sort((a, b) => dia(a.data).localeCompare(dia(b.data)))
      .map((j) => ({ data: dia(j.data), torneio: torneioDe(j.torneio), adversario: "", resultado: String(j.resultado || ""), n: +j.n || 0, pctGanhos: j.n ? +j.pctGanhos : null, pctPrimeiro: null, df: 0, observacaoFinal: "" }));
    const obsBlocos = (d.observacoes || []).filter((o) => o.contexto !== "conversa" && vale(o.data)).map((o) => (o.resumo
      ? { torneio: torneioDe(o.torneio), positivos: linhas(o.resumo.positivos), atencao: linhas(o.resumo.atencao), insights: linhas(o.resumo.insights), prioridades: linhas(o.resumo.prioridades) }
      : { torneio: torneioDe(o.torneio), positivos: (o.itens || []).filter((i) => i.natureza === "positivo" && i.texto).map((i) => i.texto), atencao: (o.itens || []).filter((i) => i.natureza === "atencao" && i.texto).map((i) => i.texto), insights: (o.itens || []).filter((i) => i.natureza === "insight" && i.texto).map((i) => i.texto), prioridades: [] }));
    const movs = (d.movimentos || []).filter((m) => vale(m.criadoEm)).sort((a, b) => String(a.criadoEm).localeCompare(String(b.criadoEm)))
      .map((m) => ({ id: String(m.id || ""), data: dia(m.criadoEm), golpe: nomeGolpe(m), ok: +((m.res || {}).ok) || 0, atencao: +((m.res || {}).atencao) || 0, prio: (m.prio || []).slice(0, 4).map(String) }));
    const videos = (d.jogosVideo || []).filter((h) => vale(h.criadoEm)).map((h) => ({ data: dia(h.criadoEm), pontos: +h.total || 0, pctGanhos: typeof h.pctGanhos === "number" ? h.pctGanhos : null }));
    return montar({ nome: d.nome || "Jogador", periodo, rotulo: rotuloPeriodo(periodo, iv), iv, jogos, obsBlocos, movimentos: movs, videos, planos: (d.planosEquipe || []).filter((x) => x && x.plano) });
  }

  const css = [
    ".rel-fases{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;margin:7px 0 2px}.rel-fases figure{margin:0;break-inside:avoid}.rel-fases img{display:block;width:100%;height:auto;max-height:78mm;object-fit:contain;border-radius:4px;background:#fff}.rel-fases figcaption{font-size:10.5px;color:#5B6B63;margin-top:2px}",
    ".rel-a{font-family:Inter,system-ui,sans-serif;color:#17251F;line-height:1.5}",
    ".rel-a h3{font-size:15px;margin:16px 0 6px;font-weight:700}",
    ".rel-cab{border-bottom:2px solid #103B32;padding-bottom:8px;margin-bottom:10px}",
    ".rel-cab .t{font-size:20px;font-weight:700;margin:0}.rel-cab .s{font-size:13px;color:#5B6B63;margin:2px 0 0}",
    ".rel-auto{background:#FFF7ED;border:1px solid #FDBA74;border-radius:8px;padding:6px 10px;font-size:12.5px;margin:8px 0}",
    ".rel-num{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin:8px 0}",
    ".rel-num div{border:1px solid #E2E8E5;border-radius:10px;padding:8px 10px}.rel-num b{display:block;font-size:20px}.rel-num span{font-size:11.5px;color:#5B6B63}",
    ".rel-lista{margin:0;padding-left:18px}.rel-lista li{margin:2px 0;font-size:14px}",
    ".rel-jogo{border-top:1px solid #E2E8E5;padding:6px 0;font-size:13.5px}.rel-jogo small{color:#5B6B63;display:block}",
    ".rel-obs{background:#F6F8F7;border-left:3px solid #103B32;border-radius:8px;padding:10px 12px;white-space:pre-line;font-size:14.5px}",
    ".rel-nota{font-size:11.5px;color:#5B6B63;margin-top:14px}",
  ].join("");

  /* opcoes: { automatico: true } (gerado pelo aluno, sem o treinador), observacao, treinador, academia, publicadoEm */
  function html(rel, opcoes) {
    opcoes = opcoes || {};
    const n = rel.numeros || {}, h = [];
    h.push('<div class="rel-a"><div class="rel-cab"><p class="t">' + esc(rel.nome) + "</p><p class=\"s\">" + esc(opcoes.automatico ? "Resumo dos registros" : "Relatório do treinador") + (rel.rotulo ? " · " + esc(rel.rotulo) : "") +
      (opcoes.academia ? " · " + esc(opcoes.academia) : "") + "</p>" + (opcoes.publicadoEm ? '<p class="s">Publicado em ' + esc(dataBR(opcoes.publicadoEm)) + (opcoes.treinador ? " por " + esc(opcoes.treinador) : "") + "</p>" : "") + "</div>");
    if (opcoes.automatico) h.push('<p class="rel-auto">Gerado automaticamente com os registros disponíveis, sem a observação do treinador.</p>');
    const cartoes = [[n.jogos, n.jogos === 1 ? "jogo registrado" : "jogos registrados"], [n.pontos, "pontos analisados no scout"], [n.pctGanhosMedio == null ? null : n.pctGanhosMedio + "%", "dos pontos ganhos (média dos scouts)"],
      [n.observacoes, n.observacoes === 1 ? "jogo observado" : "jogos observados"], [n.movimentos, n.movimentos === 1 ? "análise de movimento" : "análises de movimento"]].filter(([v]) => v !== null && v !== 0 && v !== undefined);
    if (cartoes.length) h.push('<div class="rel-num">' + cartoes.map(([v, r]) => "<div><b>" + esc(v) + "</b><span>" + esc(r) + "</span></div>").join("") + "</div>");
    if ((rel.torneios || []).length) h.push("<h3>Torneios</h3><p style=\"font-size:14px;margin:0\">" + rel.torneios.map(esc).join(" · ") + "</p>");
    if ((rel.jogos || []).length) {
      h.push("<h3>Jogos</h3>" + rel.jogos.map((j) => '<div class="rel-jogo"><b>' + esc(dataBR(j.data)) + "</b>" + (j.adversario ? " · contra " + esc(j.adversario) : "") + (j.resultado ? " · " + esc(j.resultado) : "") +
        (j.torneio ? "<small>" + esc(j.torneio) + "</small>" : "") +
        (j.n ? "<small>Scout: " + j.n + " pontos" + (j.pctGanhos != null ? " · " + j.pctGanhos + "% ganhos" : "") + (j.pctPrimeiro != null ? " · " + j.pctPrimeiro + "% de primeiro saque" : "") + (j.df ? " · " + j.df + " dupla(s) falta(s)" : "") + "</small>" : "") +
        (j.observacaoFinal ? "<small>" + esc(j.observacaoFinal) + "</small>" : "") + "</div>").join(""));
    }
    const lista = (t, l) => (l && l.length ? "<h3>" + t + '</h3><ul class="rel-lista">' + l.map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul>" : "");
    h.push(lista("Pontos positivos observados", rel.positivos), lista("Pontos de atenção", rel.atencao), lista("Foco para os próximos treinos", rel.foco));
    if ((rel.movimentos || []).length) {
      const imgs = opcoes.imagensMov || {};
      h.push("<h3>Análise de movimento (biomecânica)</h3>" + rel.movimentos.map((m) => '<div class="rel-jogo"><b>' + esc(m.golpe) + "</b> · " + esc(dataBR(m.data)) + "<small>" + m.ok + " ponto(s) do movimento OK · " + m.atencao + " em atenção</small>" +
        (m.prio && m.prio.length ? "<small>Prioridades: " + m.prio.map(esc).join(" · ") + "</small>" : "") +
        ((imgs[chaveMov(m)] || []).some((x) => x.src) ? '<div class="rel-fases">' + imgs[chaveMov(m)].map((x, i) => (x.src ? '<figure><img src="' + esc(x.src) + '" alt="' + esc(x.nome) + '"><figcaption>' + (i + 1) + ". " + esc(x.nome) + "</figcaption></figure>" : "")).join("") + "</div>" : "") +
        "</div>").join(""));
    }
    (rel.planejamento || []).forEach((pl) => {
      h.push("<h3>Planejamento da equipe · " + esc(pl.equipe) + "</h3>" + (pl.ciclo ? '<p style="font-size:12.5px;color:#5B6B63;margin:0 0 4px">Ciclo de ' + esc(pl.ciclo) + "</p>" : "") + pl.semanas.map((s) => '<div class="rel-jogo"><b>Semana ' + s.n + "</b> · " + esc(dataBR(s.inicio).slice(0, 5)) + " a " + esc(dataBR(s.fim).slice(0, 5)) +
        ([s.grupo, s.itens.join(", ")].filter(Boolean).length ? "<small>" + esc([s.grupo, s.itens.join(", ")].filter(Boolean).join(" · ")) + "</small>" : "") + (s.obs ? "<small>" + esc(s.obs) + "</small>" : "") +
        s.dias.filter((d) => d.grupo || d.itens.length || d.obs).map((d) => "<small>" + esc(dataBR(d.data).slice(0, 5)) + ": " + esc([d.grupo, d.itens.join(", "), d.obs].filter(Boolean).join(" · ")) + "</small>").join("") + "</div>").join(""));
    });
    (rel.rendimento || []).forEach((r) => {
      const d = (v) => (v == null ? "—" : v.toFixed(1).replace(".", ","));
      h.push("<h3>Rendimento nos treinos · " + esc(r.equipe) + "</h3>" + '<div class="rel-num"><div><b>' + r.presencas + "/" + r.sessoes + "</b><span>presença nas sessões avaliadas</span></div>" +
        (r.media != null ? "<div><b>" + d(r.media) + "</b><span>rendimento médio (1 a 5)</span></div>" : "") + "</div>" +
        (r.tendencia ? '<p style="font-size:13.5px;margin:0">' + esc(RE() ? RE().textoTendencia(r.tendencia) : "") + "</p>" : "") +
        (r.porItem.length ? '<p style="font-size:13.5px;margin:4px 0 0">' + r.porItem.map((x) => esc(x.rotulo) + " " + d(x.media)).join(" · ") + "</p>" : "") +
        (r.destaques.length ? '<p style="font-size:13.5px;margin:4px 0 0"><b>Destaques:</b> ' + r.destaques.map(esc).join(", ") + "</p>" : "") +
        (r.desenvolver.length ? '<p style="font-size:13.5px;margin:4px 0 0"><b>A desenvolver:</b> ' + r.desenvolver.map(esc).join(", ") + "</p>" : "") +
        (r.obs.length ? '<ul class="rel-lista">' + r.obs.map((o) => "<li>" + esc(dataBR(o.data)) + ": " + esc(o.texto) + "</li>").join("") + "</ul>" : ""));
    });
    if ((rel.videos || []).length) h.push("<h3>Jogos analisados em vídeo</h3>" + rel.videos.map((v) => '<div class="rel-jogo"><b>' + esc(dataBR(v.data)) + "</b><small>" + v.pontos + " pontos" + (v.pctGanhos != null ? " · " + v.pctGanhos + "% ganhos" : "") + "</small></div>").join(""));
    if (!cartoes.length && !(rel.planejamento || []).length && !(rel.rendimento || []).length && !(rel.positivos || []).length && !(rel.atencao || []).length && !(rel.foco || []).length) h.push('<p style="font-size:14px;color:#5B6B63">Nenhum registro neste período.</p>');
    if (opcoes.observacao) h.push("<h3>Observação do treinador</h3><div class=\"rel-obs\">" + esc(opcoes.observacao) + "</div>");
    h.push('<p class="rel-nota">Relatório baseado nos registros do período (scouts, observações e análises); não é uma avaliação completa do jogador.</p></div>');
    return h.join("");
  }
  /* Imagens das fases de cada análise de movimento do relatório (a foto do vídeo ou a pose detectada), lidas do arquivo dos
     relatórios: ler(id) → Promise do relatório completo (ou null). Devolve { [chave]: [{ src, nome }] } para opcoes.imagensMov. `lista`
     (as análises do jogador, opcional) acha a análise dos relatórios publicados antes de eles guardarem o id (mesma data e golpe). Só no navegador. */
  async function imagensMovimentos(rel, ler, lista) {
    const M = raiz && raiz.QLMovimento, saida = {};
    if (!M || typeof ler !== "function") return saida;
    await Promise.all(((rel && rel.movimentos) || []).map(async (m) => {
      const achada = !m.id && (lista || []).find((x) => x && dia(x.criadoEm) === m.data && nomeGolpe(x) === m.golpe);
      const id = m.id || (achada && achada.id);
      if (!id) return;
      let arq = null; try { arq = await ler(id); } catch (e) { arq = null; }
      const r = arq && arq.resultado;
      if (r) saida[chaveMov(m)] = M.imagensFases(r, arq.fotos).map((x, i) => ({ src: x.src, nome: (r.nomes || [])[i] || "Fase " + (i + 1) }));
    }));
    return saida;
  }

  function documento(rel, opcoes) {
    return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório · ' + esc(rel.nome) + "</title><style>body{margin:24px;max-width:720px}" + css +
      "@media print{body{margin:12mm}}</style></head><body>" + html(rel, opcoes) + "<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>";
  }

  const api = { coletar, coletarDoLink, html, documento, css, intervalo, rotuloPeriodo, torneiosDoAluno, dataBR, imagensMovimentos };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.QLRelatorioAtleta = api;
})(typeof window !== "undefined" ? window : this);
