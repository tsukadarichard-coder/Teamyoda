/* Relatório do aluno · Tecnologia QuadraLab.
   Um documento só por aluno, pronto para "Salvar como PDF", juntando o que já está registrado: perfil, planejamento (blocos,
   critérios de saída e andamento), aulas do período, scout dos jogos (jogo a jogo, médias e evolução) e análises biomecânicas
   (fotos das fases, itens em atenção, conclusão e prioridades), mais a observação do treinador.
   Só organiza o que foi registrado: não inventa avaliação. Todo texto é escapado.

   QLRelatorioAluno.periodo(tipo, hoje, de, ate) → { de, ate, rotulo }   (tipo: "tudo" | "30d" | "90d" | "ano" | "datas")
   QLRelatorioAluno.noPeriodo(data, periodo)     → a data (AAAA-MM-DD…) está dentro do período
   QLRelatorioAluno.html(o) → documento HTML completo. o = {
     atleta, perfil: [[rótulo, valor]], periodo, secoes: { perfil, plano, aulas, scout, movimento } (true/false),
     plano: { nome, geradoEm, prioridade, observacao, feitas, total, blocos: [{ titulo, semanas, foco: [..], saida, feitas, total, liberado, atual }] } | null,
     aulas: { feitas, faltas, canceladas, sessoes: [{ data, titulo, exercicios: [..], obs }] },
     jogos: [registro do caderno com scout], metricas: METRICAS_SCOUT do app, leitura(scout) → [[tipo, texto]], vencedor(r) → "vitoria" | "derrota" | outro,
     movimentos: [{ data, golpe, ok, atencao, nao, fotos: [{ src, nome }], itens: [{ nome, valor, unidade, ref, status }], texto, prio: [..] }],
     observacao, cabecalhoHtml, geradoEm } */
(function (raiz, fab) {
  if (typeof module === "object" && module.exports) module.exports = fab();
  else raiz.QLRelatorioAluno = fab();
})(typeof self !== "undefined" ? self : this, function () {
  var MARCA = "#1E4D3F", ACENTO = "#427528", TINTA = "#17251F", GRAFITE = "#5A5A5A", LINHA = "#E2E8E5", AZUL = "#0F5E8C", LARANJA = "#B54E1F";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function dataBR(d) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || "")); return m ? m[3] + "/" + m[2] + "/" + m[1] : ""; }
  function dia(d) { return String(d || "").slice(0, 10); }
  function num(v) { return typeof v === "number" && isFinite(v) ? v : null; }
  function r1(v) { return v === null ? "—" : (Math.round(v * 10) / 10).toString().replace(".", ","); }
  function media(l) { l = l.filter(function (x) { return x !== null; }); return l.length ? l.reduce(function (s, v) { return s + v; }, 0) / l.length : null; }
  function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

  function periodo(tipo, hoje, de, ate) {
    var h = hoje ? new Date(hoje + "T12:00:00") : new Date(), fim = iso(h);
    if (tipo === "30d" || tipo === "90d") { var d = new Date(h); d.setDate(d.getDate() - (tipo === "30d" ? 30 : 90)); return { de: iso(d), ate: fim, rotulo: tipo === "30d" ? "Últimos 30 dias" : "Últimos 3 meses" }; }
    if (tipo === "ano") return { de: h.getFullYear() + "-01-01", ate: fim, rotulo: "Ano de " + h.getFullYear() };
    if (tipo === "datas") { var a = dia(de), b = dia(ate); if (a && b && a > b) { var t = a; a = b; b = t; } return { de: a, ate: b, rotulo: (a ? "De " + dataBR(a) : "Desde o início") + (b ? " até " + dataBR(b) : " até hoje") }; }
    return { de: "", ate: "", rotulo: "Todo o histórico" };
  }
  function noPeriodo(data, p) { var d = dia(data); if (!p || (!p.de && !p.ate)) return true; if (!d) return false; return (!p.de || d >= p.de) && (!p.ate || d <= p.ate); }

  function card(t, corpo, extra) { return '<section class="sec"' + (extra || "") + "><h2>" + esc(t) + "</h2>" + corpo + "</section>"; }
  function kpi(n, t, s) { return '<div class="kp"><b>' + esc(n) + "</b><span>" + esc(t) + "</span>" + (s ? "<small>" + esc(s) + "</small>" : "") + "</div>"; }
  function vazio(t) { return '<p class="mudo">' + esc(t) + "</p>"; }

  function secPerfil(o) {
    var l = (o.perfil || []).filter(function (x) { return x && x[1] !== undefined && x[1] !== null && String(x[1]).trim() !== ""; });
    if (!l.length) return card("Perfil", vazio("Ficha sem dados preenchidos."));
    return card("Perfil", '<dl class="perfil">' + l.map(function (x) { return "<div><dt>" + esc(x[0]) + "</dt><dd>" + esc(x[1]) + "</dd></div>"; }).join("") + "</dl>");
  }

  function secPlano(p) {
    if (!p || !(p.blocos || []).length) return card("Planejamento", vazio("Ainda não há planejamento gerado para este aluno."));
    var pct = p.total ? Math.round((p.feitas * 100) / p.total) : 0;
    var topo = '<div class="kps k3">' + kpi(p.feitas + " de " + p.total, "aulas do plano feitas", pct + "% do planejamento") +
      kpi(String(p.blocos.length), p.blocos.length === 1 ? "bloco" : "blocos", (p.blocos.filter(function (b) { return b.liberado; }).length) + " com critério de saída confirmado") +
      kpi(p.geradoEm ? dataBR(p.geradoEm) : "—", "plano gerado em", p.nome || "") + "</div>";
    var barra = '<div class="barra" role="img" aria-label="' + pct + '% do planejamento feito"><i style="width:' + Math.max(pct, 2) + '%"></i></div>';
    var blocos = p.blocos.map(function (b, i) {
      var bp = b.total ? Math.round((b.feitas * 100) / b.total) : 0;
      var selo = b.liberado ? '<span class="selo ok">critério confirmado</span>' : b.atual ? '<span class="selo at">bloco atual</span>' : b.feitas >= b.total && b.total ? '<span class="selo">aulas concluídas</span>' : "";
      return '<div class="bloco"><div class="bl-t"><b>' + (i + 1) + ". " + esc(b.titulo) + "</b>" + selo + "</div>" +
        '<p class="mudo">' + (b.semanas ? esc(b.semanas) + (b.semanas === 1 ? " semana" : " semanas") + " · " : "") + b.feitas + " de " + b.total + " aulas feitas (" + bp + "%)</p>" +
        ((b.foco || []).length ? '<p class="foco"><b>Foco:</b> ' + esc(b.foco.join(" · ")) + "</p>" : "") +
        (b.saida ? '<p class="saida"><b>Critério de saída:</b> ' + esc(b.saida) + "</p>" : "") + "</div>";
    }).join("");
    return card("Planejamento", topo + barra + (p.prioridade ? '<p class="foco"><b>Prioridade do ciclo:</b> ' + esc(p.prioridade) + "</p>" : "") + blocos +
      (p.observacao ? "<blockquote>" + esc(p.observacao) + "<footer>Observação do planejamento</footer></blockquote>" : ""));
  }

  function secAulas(a) {
    a = a || {};
    var total = (a.feitas || 0) + (a.faltas || 0) + (a.canceladas || 0);
    var topo = '<div class="kps k3">' + kpi(String(a.feitas || 0), "aulas feitas") + kpi(String(a.faltas || 0), a.faltas === 1 ? "falta" : "faltas") + kpi(String(a.canceladas || 0), a.canceladas === 1 ? "aula cancelada" : "aulas canceladas") + "</div>";
    var ses = (a.sessoes || []).slice(-8).reverse();
    var lista = ses.length ? '<table class="t"><thead><tr><th>Data</th><th>Aula</th><th>O que foi trabalhado</th></tr></thead><tbody>' + ses.map(function (s) {
      return "<tr><td>" + dataBR(s.data) + "</td><td>" + esc(s.titulo || "Sessão") + "</td><td>" + esc((s.exercicios || []).slice(0, 6).join(" · ")) + (s.obs ? '<br><small>' + esc(s.obs) + "</small>" : "") + "</td></tr>";
    }).join("") + "</tbody></table>" : "";
    if (!total && !ses.length) return card("Aulas no período", vazio("Nenhuma aula marcada no período."));
    return card("Aulas no período", topo + (ses.length ? '<h3>Últimas sessões registradas</h3>' + lista : ""));
  }

  var CHAVES = [["pctGanhos", "Pontos ganhos", true], ["errosNos", "Erros", false], ["pctPrimeiro", "1º saque dentro", true], ["df", "Duplas faltas", false], ["pctAdversos", "Ganhos em placar adverso", true], ["pctErrosCurtos", "Erros em até 4 bolas", false]];
  function secScout(o) {
    var jogos = (o.jogos || []).filter(function (r) { return r && r.scout; }).slice().sort(function (a, b) { return String(a.data).localeCompare(String(b.data)); });
    if (!jogos.length) return card("Scout dos jogos", vazio("Nenhum jogo com scout no período."));
    var M = o.metricas || [];
    function val(k, r) { var m = M.filter(function (x) { return x.k === k; })[0]; if (!m) return null; try { return num(m.get(r.scout)); } catch (e) { return null; } }
    function suf(k) { var m = M.filter(function (x) { return x.k === k; })[0]; return m && m.suf ? m.suf : ""; }
    var chaves = CHAVES.filter(function (c) { return jogos.some(function (r) { return val(c[0], r) !== null; }); });
    /* vitórias/derrotas pelo resultado registrado (o app passa o.vencedor(r) → "vitoria" | "derrota" | outro) */
    var res = jogos.map(function (r) { try { return o.vencedor ? o.vencedor(r) : ""; } catch (e) { return ""; } });
    var vit = res.filter(function (x) { return x === "vitoria"; }).length, der = res.filter(function (x) { return x === "derrota"; }).length;
    var pg = media(jogos.map(function (r) { return val("pctGanhos", r); }));
    var topo = '<div class="kps k3">' + kpi(String(jogos.length), jogos.length === 1 ? "jogo com scout" : "jogos com scout", jogos.reduce(function (s, r) { return s + (Number(r.scout.n) || 0); }, 0) + " pontos marcados") +
      kpi(pg === null ? "—" : Math.round(pg) + "%", "pontos ganhos (média)") + kpi(vit + der ? vit + " × " + der : "—", "vitórias × derrotas", vit + der ? (vit + der) + (vit + der === 1 ? " jogo com resultado" : " jogos com resultado") : "resultado não registrado") + "</div>";
    var tab = '<div class="rol"><table class="t num"><thead><tr><th>Data</th><th>Jogo</th>' + chaves.map(function (c) { return "<th>" + esc(c[1]) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      jogos.map(function (r) {
        var ctx = [r.torneio && r.torneio !== "jogo-treino" ? r.torneio : "Jogo-treino", r.adversario && r.adversario !== "—" ? "contra " + r.adversario : "", r.resultado && r.resultado !== "—" ? r.resultado : ""].filter(Boolean).join(" · ");
        return "<tr><td>" + dataBR(r.data) + "</td><td class=\"tx\">" + esc(ctx) + "</td>" + chaves.map(function (c) { var v = val(c[0], r); return "<td>" + (v === null ? "—" : r1(v) + suf(c[0])) + "</td>"; }).join("") + "</tr>";
      }).join("") + "</tbody></table></div>";
    var evo = "";
    if (jogos.length >= 2) {
      var linhas = chaves.map(function (c) {
        var vs = jogos.map(function (r) { return val(c[0], r); }).filter(function (v) { return v !== null; });
        if (vs.length < 2) return "";
        var metade = Math.ceil(vs.length / 2), ini = media(vs.slice(0, metade)), fim = media(vs.slice(vs.length - metade)), dif = fim - ini;
        var bom = Math.abs(dif) < 0.5 ? null : (c[2] ? dif > 0 : dif < 0);
        return "<tr><td class=\"tx\">" + esc(c[1]) + "</td><td>" + r1(ini) + suf(c[0]) + "</td><td>" + r1(fim) + suf(c[0]) + '</td><td class="' + (bom === null ? "" : bom ? "bom" : "ruim") + '">' + (bom === null ? "= estável" : (dif > 0 ? "▲ +" : "▼ ") + r1(dif) + (suf(c[0]) === "%" ? " p.p." : "")) + "</td></tr>";
      }).join("");
      if (linhas) evo = "<h3>Evolução no período</h3><p class=\"mudo\">Média dos primeiros jogos do período comparada com a dos últimos (azul: melhorou; laranja: piorou). Três jogos na mesma direção são um sinal; um jogo isolado é ruído.</p><table class=\"t num\"><thead><tr><th>Medida</th><th>Primeiros jogos</th><th>Últimos jogos</th><th>Evolução</th></tr></thead><tbody>" + linhas + "</tbody></table>";
    }
    var ult = jogos[jogos.length - 1], leit = [];
    try { leit = (o.leitura ? o.leitura(ult.scout) : []) || []; } catch (e) { leit = []; }
    var ultHtml = leit.length ? "<h3>O que o último jogo apontou (" + dataBR(ult.data) + ")</h3><ul class=\"lst\">" + leit.slice(0, 5).map(function (x) { return "<li>" + esc(x[1] || x) + "</li>"; }).join("") + "</ul>" : "";
    var obsJogos = jogos.filter(function (r) { return r.observacaoFinal; }).slice(-3).map(function (r) { return "<blockquote>" + esc(r.observacaoFinal) + "<footer>" + dataBR(r.data) + (r.adversario && r.adversario !== "—" ? " · contra " + esc(r.adversario) : "") + "</footer></blockquote>"; }).join("");
    return card("Scout dos jogos", topo + tab + evo + ultHtml + obsJogos);
  }

  var PARECER = { ok: "OK", atencao: "Atenção", nao: "Revisar" };
  function secMov(movs) {
    movs = (movs || []).slice().sort(function (a, b) { return String(a.data).localeCompare(String(b.data)); });
    if (!movs.length) return card("Análise biomecânica", vazio("Nenhuma análise de movimento no período."));
    return card("Análise biomecânica", movs.map(function (m) {
      var fotos = (m.fotos || []).filter(function (f) { return f && f.src; });
      var foco = (m.itens || []).filter(function (it) { return it.status === "atencao" || it.status === "nao"; });
      return '<div class="mov"><div class="bl-t"><b>' + esc(m.golpe || "Golpe") + "</b><span class=\"mudo\">" + dataBR(m.data) + "</span></div>" +
        '<div class="pils"><span class="pil ok">' + (m.ok || 0) + " OK</span><span class=\"pil at\">" + (m.atencao || 0) + " em atenção</span><span class=\"pil nao\">" + (m.nao || 0) + " para revisar</span></div>" +
        (fotos.length ? '<div class="fotos">' + fotos.map(function (f, i) { return '<figure><img src="' + esc(f.src) + '" alt="' + esc(f.nome || "Fase " + (i + 1)) + '"><figcaption>' + (i + 1) + ". " + esc(f.nome || "") + "</figcaption></figure>"; }).join("") + "</div>" : "") +
        (foco.length ? '<table class="t"><thead><tr><th>Item que pede atenção</th><th>Medido</th><th>Referência</th><th>Parecer</th></tr></thead><tbody>' + foco.map(function (it) {
          return '<tr><td class="tx">' + esc(it.nome) + "</td><td>" + (it.valor == null ? "—" : esc(Math.round(it.valor * 10) / 10 + (it.unidade || ""))) + "</td><td>" + esc(it.ref || "") + '</td><td class="' + (it.status === "nao" ? "ruim" : "") + '">' + esc(PARECER[it.status] || it.status) + "</td></tr>";
        }).join("") + "</tbody></table>" : '<p class="mudo">Todos os itens medidos dentro da referência.</p>') +
        (m.texto ? '<p class="foco"><b>Conclusão:</b> ' + esc(m.texto) + "</p>" : "") +
        ((m.prio || []).length ? '<p class="foco"><b>Prioridades:</b> ' + esc(m.prio.join(" · ")) + "</p>" : "") + "</div>";
    }).join(""));
  }

  var CSS = "@page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:-apple-system,system-ui,'Segoe UI',Roboto,sans-serif;color:" + TINTA + ";max-width:860px;margin:0 auto;padding:20px 18px 36px;line-height:1.5;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
    ".marca{margin-bottom:12px}.capa{background:" + MARCA + ";color:#fff;border-radius:18px;padding:22px 26px 24px;margin-bottom:16px;border-bottom:5px solid " + ACENTO + "}.capa small{display:block;font-size:11px;letter-spacing:.16em;text-transform:uppercase;opacity:.9}.capa h1{font-size:32px;line-height:1.1;margin:8px 0 6px}.capa p{margin:0;font-size:14px;opacity:.95}" +
    ".indice{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 6px;padding:0;list-style:none}.indice li{font-size:12px;border:1px solid " + LINHA + ";border-radius:999px;padding:3px 10px;color:" + GRAFITE + "}" +
    ".sec{margin-top:22px}.sec h2{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:" + MARCA + ";margin:0 0 10px;padding-bottom:6px;border-bottom:2px solid " + ACENTO + "}.sec h3{font-size:14px;margin:16px 0 6px}" +
    ".mudo{color:" + GRAFITE + ";font-size:13px;margin:4px 0}.kps{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:8px}.kp{border:1px solid " + LINHA + ";border-radius:14px;padding:12px 14px;background:#F7F8F7;break-inside:avoid}.kp b{display:block;font-size:24px;line-height:1.1;color:" + MARCA + "}.kp span{display:block;font-size:12.5px;font-weight:600}.kp small{display:block;font-size:11.5px;color:" + GRAFITE + "}" +
    ".barra{height:10px;border-radius:999px;background:#E8ECEA;overflow:hidden;margin:4px 0 10px}.barra i{display:block;height:100%;background:" + ACENTO + "}" +
    ".bloco,.mov{border:1px solid " + LINHA + ";border-radius:14px;padding:12px 14px;margin:10px 0;break-inside:avoid}.bl-t{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}.foco,.saida{font-size:13px;margin:4px 0}.saida{color:" + MARCA + "}" +
    ".selo{font-size:11px;font-weight:700;border-radius:999px;padding:2px 9px;border:1px solid " + LINHA + ";color:" + GRAFITE + "}.selo.ok{background:" + MARCA + ";color:#fff;border-color:" + MARCA + "}.selo.at{background:" + ACENTO + ";color:#fff;border-color:" + ACENTO + "}" +
    ".perfil{display:grid;grid-template-columns:1fr 1fr;gap:4px 18px;margin:0}.perfil div{border-bottom:1px solid " + LINHA + ";padding:6px 0}.perfil dt{font-size:11.5px;color:" + GRAFITE + "}.perfil dd{margin:0;font-size:13.5px;font-weight:600}" +
    ".t{width:100%;border-collapse:collapse;font-size:12.5px;margin:6px 0}.t th{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:" + GRAFITE + ";text-align:left;padding:6px;border-bottom:1px solid " + LINHA + "}.t td{border-top:1px solid " + LINHA + ";padding:7px 6px;vertical-align:top}.t.num td,.t.num th{text-align:center}.t.num td.tx,.t.num th:nth-child(2),.t.num td:nth-child(2){text-align:left}.t small{color:" + GRAFITE + "}.rol{overflow-x:auto}" +
    ".bom{color:" + AZUL + ";font-weight:700}.ruim{color:" + LARANJA + ";font-weight:700}.lst{margin:4px 0;padding-left:18px;font-size:13px}" +
    ".pils{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}.pil{font-size:11.5px;font-weight:700;border-radius:999px;padding:2px 9px}.pil.ok{background:#E3EFE9;color:" + MARCA + "}.pil.at{background:#FBEFD9;color:#7A4B00}.pil.nao{background:#FBE3DA;color:#8A2E0C}" +
    ".fotos{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:8px 0}.fotos figure{margin:0;break-inside:avoid}.fotos img{width:100%;border-radius:10px;display:block;border:1px solid " + LINHA + "}.fotos figcaption{font-size:11px;color:" + GRAFITE + ";margin-top:3px}" +
    "blockquote{margin:10px 0;padding:10px 14px;border-left:4px solid " + ACENTO + ";background:#F7F8F7;border-radius:0 12px 12px 0;font-size:13.5px}blockquote footer{font-size:11.5px;color:" + GRAFITE + ";margin-top:4px}" +
    ".rodape{margin-top:26px;font-size:11px;color:" + GRAFITE + ";border-top:1px solid " + LINHA + ";padding-top:8px}.no-print{margin-top:18px;display:flex;gap:10px;flex-wrap:wrap}.no-print button{font:inherit;font-weight:700;padding:11px 16px;border-radius:12px;cursor:pointer;border:1.5px solid " + MARCA + "}.no-print .p{background:" + MARCA + ";color:#fff}.no-print .s{background:#fff;color:" + MARCA + "}" +
    ".quebra{break-before:page}@media(max-width:640px){.kps{grid-template-columns:1fr 1fr}.perfil{grid-template-columns:1fr}.fotos{grid-template-columns:1fr 1fr}.capa h1{font-size:26px}}@media print{.no-print{display:none}body{padding:0}}";

  function html(o) {
    o = o || {};
    var S = o.secoes || { perfil: true, plano: true, aulas: true, scout: true, movimento: true };
    var atleta = String(o.atleta || "Aluno"), p = o.periodo || periodo("tudo");
    var partes = [], indice = [];
    function add(chave, nome, h) { if (!S[chave]) return; indice.push(nome); partes.push(h); }
    add("perfil", "Perfil", secPerfil(o));
    add("plano", "Planejamento", secPlano(o.plano));
    add("aulas", "Aulas", secAulas(o.aulas));
    add("scout", "Scout", secScout(o));
    add("movimento", "Biomecânica", secMov(o.movimentos));
    if (o.observacao && String(o.observacao).trim()) { indice.push("Observação do treinador"); partes.push(card("Observação do treinador", "<blockquote>" + esc(o.observacao).replace(/\n/g, "<br>") + "<footer>Treinador</footer></blockquote>")); }
    return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório · ' + esc(atleta) + "</title><style>" + CSS + "</style></head><body>" +
      (o.cabecalhoHtml ? '<div class="marca">' + o.cabecalhoHtml + "</div>" : "") +
      '<header class="capa"><small>Relatório do aluno · Tecnologia QuadraLab</small><h1>' + esc(atleta) + "</h1><p>" + esc(p.rotulo || "") + (o.geradoEm ? " · gerado em " + esc(o.geradoEm) : "") + "</p></header>" +
      (indice.length ? '<ul class="indice">' + indice.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "") +
      (partes.length ? partes.join("") : card("Relatório", vazio("Nenhuma seção escolhida."))) +
      '<p class="rodape">Este relatório organiza o que foi registrado no app (planejamento, aulas, scouts e análises de movimento). Um jogo ou uma análise isolada é uma amostra; o que importa é o padrão que se repete.</p>' +
      '<div class="no-print"><button class="p" onclick="window.print()">Salvar como PDF / Imprimir</button><button class="s" onclick="window.close()">← Voltar ao app</button></div></body></html>';
  }

  return { html: html, periodo: periodo, noPeriodo: noPeriodo, CSS: CSS };
});
