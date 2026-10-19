/* Análise de movimento em vídeo · Tecnologia QuadraLab.
   Interface compartilhada: protótipo, app do treinador (QuadraLab) e Team Yoda usam este arquivo.
   Depende de scout/movimento-motor.js (QLBiomec) e de scout/movimento.css. A análise roda no aparelho; o vídeo não é enviado.
   QLMovimento.montar(el, { atleta, historico, cota, logo, aoSalvar, aoRemover }) -> controle { injetar(quadros, opts) }
   QLMovimento.evolucaoHTML(historico) -> HTML da evolução por golpe (gráfico + comparação com a análise anterior). */
(function (raiz) {
  var B = raiz.QLBiomec;
  var NOMES = { forehand: "Forehand", backhand: "Backhand", saque: "Saque" };
  var GUIA = {
    forehand: "Envie UM forehand (2 a 6 s). Câmera fixa na altura da cintura, vista lateral, corpo inteiro no quadro, 60 fps se possível.",
    backhand: "Envie UM backhand (2 a 6 s). Mesma filmagem do forehand: câmera fixa, vista lateral, corpo inteiro. Informe se é de uma ou duas mãos.",
    saque: "Envie UM saque (3 a 8 s), de lado ou levemente por trás, com corpo e raquete inteiros no quadro (sem cortar o topo do lançamento). As faixas do saque são provisórias."
  };
  var LIG = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32]];
  var ROT = { ok: "OK", atencao: "Atenção", nao_avaliavel: "Revisar" };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function data(iso) { try { return new Date(iso).toLocaleDateString("pt-BR"); } catch (e) { return ""; } }
  function nomeGolpe(g, emp) { return NOMES[g] + (g === "backhand" ? (String(emp) === "1" ? " (uma mão)" : " (duas mãos)") : ""); }
  function val(i) { return i.v == null ? "—" : (Math.round(i.v * 10) / 10) + (i.u || ""); }

  function badgeHTML(logo) {
    return '<span class="qm-marca"><img src="' + esc(logo || "assets/logo-quadralab.png") + '" alt="QuadraLab"><span>Tecnologia</span></span>';
  }

  /* ── comparação com a análise anterior ── */
  function comparacaoHTML(cmp) {
    if (!cmp) return "";
    var l = cmp.itens.map(function (i) {
      var seta = i.sentido > 0 ? '<span class="qm-up">▲ melhorou</span>' : i.sentido < 0 ? '<span class="qm-dn">▼ piorou</span>' : '<span class="qm-eq">= igual</span>';
      var d = i.delta == null ? "" : ' <span class="qm-eq">(' + (i.delta > 0 ? "+" : "") + i.delta + (i.atu.u || "") + ")</span>";
      return "<tr><td>" + esc(i.nome) + "</td><td>" + val(i.ant) + ' <span class="qm-tag ' + i.ant.s + '">' + ROT[i.ant.s] + "</span></td><td>" + val(i.atu) + ' <span class="qm-tag ' + i.atu.s + '">' + ROT[i.atu.s] + "</span>" + d + "</td><td>" + seta + "</td></tr>";
    }).join("");
    return '<p class="qm-cmp-s">' + esc(cmp.texto) + '</p><p class="qm-msg">Comparando ' + data(cmp.de) + " → " + data(cmp.para) + "</p>" +
      '<table><thead><tr><th>Item</th><th>Antes</th><th>Agora</th><th>Evolução</th></tr></thead><tbody>' + l + "</tbody></table>";
  }

  /* ── gráfico de evolução (itens OK e em Atenção por análise) ── */
  function graficoHTML(serie) {
    if (serie.length < 2) return '<p class="qm-msg">O gráfico de evolução aparece a partir da segunda análise deste golpe.</p>';
    var W = 320, H = 110, pl = 26, pr = 10, pt = 10, pb = 22, max = 1, i;
    serie.forEach(function (p) { max = Math.max(max, p.ok + p.atencao); });
    function X(k) { return pl + (W - pl - pr) * (serie.length === 1 ? 0.5 : k / (serie.length - 1)); }
    function Y(v) { return pt + (H - pt - pb) * (1 - v / max); }
    function linha(cor, campo) {
      return '<polyline fill="none" stroke="' + cor + '" stroke-width="2.2" points="' + serie.map(function (p, k) { return X(k).toFixed(1) + "," + Y(p[campo]).toFixed(1); }).join(" ") + '"/>' +
        serie.map(function (p, k) { return '<circle cx="' + X(k).toFixed(1) + '" cy="' + Y(p[campo]).toFixed(1) + '" r="3.6" fill="#fff" stroke="' + cor + '" stroke-width="2"/>'; }).join("");
    }
    var grade = "";
    for (i = 0; i <= max; i++) grade += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(i).toFixed(1) + '" y2="' + Y(i).toFixed(1) + '" stroke="#E7E3DA"/><text x="' + (pl - 6) + '" y="' + (Y(i) + 4).toFixed(1) + '" font-size="10" text-anchor="end" fill="#5C6B78">' + i + "</text>";
    var rot = serie.map(function (p, k) { return (k === 0 || k === serie.length - 1 || serie.length <= 6) ? '<text x="' + X(k).toFixed(1) + '" y="' + (H - 6) + '" font-size="9.5" text-anchor="middle" fill="#5C6B78">' + data(p.t).slice(0, 5) + "</text>" : ""; }).join("");
    return '<svg class="qm-graf" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Evolução dos itens dentro da referência e em atenção por análise">' + grade + linha("#2E8B57", "ok") + linha("#C65825", "atencao") + rot + "</svg>" +
      '<p class="qm-msg"><b style="color:#2E8B57">● Itens OK</b> · <b style="color:#C65825">● Itens em atenção</b> — cada ponto é uma análise.</p>';
  }

  /* ── evolução de todos os golpes do histórico ── */
  function evolucaoHTML(historico, o) {
    o = o || {};
    var lista = B.ordenar(historico || []);
    if (!lista.length) return '<p class="qm-msg">Ainda não há análises de movimento salvas para este jogador. A cada nova análise, a evolução aparece aqui.</p>';
    var grupos = {}, ordem = [];
    lista.forEach(function (h) { var k = h.golpe + (h.golpe === "backhand" ? "|" + h.emp : ""); if (!grupos[k]) { grupos[k] = []; ordem.push(k); } grupos[k].push(h); });
    return ordem.map(function (k) {
      var g = grupos[k], ult = g[g.length - 1], ant = g.length > 1 ? g[g.length - 2] : null, cmp = ant ? B.comparar(ant, ult) : null;
      var serie = B.serie(g, ult.golpe, ult.emp);
      return '<div class="qm-card"><h3 class="qm-h">' + esc(nomeGolpe(ult.golpe, ult.emp)) + ' · ' + g.length + (g.length === 1 ? " análise" : " análises") + "</h3>" +
        graficoHTML(serie) + (cmp ? "<h4>Última análise × anterior</h4>" + comparacaoHTML(cmp) : '<p class="qm-msg">Primeira análise de ' + esc(NOMES[ult.golpe]) + ": " + ult.res.ok + " itens OK, " + ult.res.atencao + " em atenção. Na próxima, o app compara automaticamente.</p>") +
        (ult.prio && ult.prio.length ? '<h4>Prioridades da última análise</h4><ul class="qm-ul">' + ult.prio.slice(0, 4).map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ul>" : "") + "</div>";
    }).join("");
  }

  /* ── relatório (janela própria, como o relatório dos jogos) ── */
  function relatorioHTML(d) {
    var r = d.resultado, co = B.conclusao(r), nm = nomeGolpe(d.golpe, d.emp), logo = d.logo || "assets/logo-quadralab.png";
    var fotos = r.fases.map(function (f, i) {
      return '<div class="f"><img src="' + (d.fotos[i] || "") + '" alt=""><b>' + (i + 1) + ". " + esc(r.nomes[i]) + "</b><span>" + f.t.toFixed(2) + " s</span></div>";
    }).join("");
    var tb = "", fa = -1;
    r.itens.forEach(function (it) {
      if (it.fase !== fa) { fa = it.fase; tb += '<tr class="fh"><td colspan="4">' + (fa + 1) + ". " + esc(r.nomes[fa]) + "</td></tr>"; }
      tb += "<tr><td>" + esc(it.nome) + "</td><td>" + (it.valor == null ? "—" : Math.round(it.valor * 100) / 100 + esc(it.unidade)) + "</td><td>" + esc(it.ref) + '</td><td><span class="t ' + it.status + '">' + ROT[it.status] + "</span><br><small>" + esc(it.comentario) + "</small></td></tr>";
    });
    var cb = "";
    if (co.prioridades.length) cb += "<h3>Prioridades de intervenção</h3>" + co.prioridades.map(function (p, k) {
      return '<div class="pr"><b>' + (k + 1) + ". " + esc(p.nome) + "</b> <small>(" + (p.valor == null ? "—" : Math.round(p.valor * 100) / 100 + esc(p.unidade)) + " · ref. " + esc(p.ref) + ")</small><p>" + esc(p.porque) + "</p>" +
        (p.exercicios.length ? "<ul>" + p.exercicios.map(function (e) { return "<li>" + esc(e) + "</li>"; }).join("") + "</ul>" : "") + "</div>";
    }).join("");
    if (co.fortes.length) cb += "<h3>Pontos fortes</h3><ul>" + co.fortes.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ul>";
    if (co.revisar.length) cb += "<h3>Para o treinador revisar (não medidos)</h3><ul>" + co.revisar.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ul>";
    var evo = "";
    if (d.comparacao) evo += '<div class="quebra"></div><h2>Evolução em relação à análise anterior</h2>' + comparacaoHTML(d.comparacao);
    if (d.historico && d.historico.length > 1) evo += "<h2>Evolução do jogador neste golpe</h2>" + graficoHTML(B.serie(d.historico, d.golpe, d.emp));
    var css = "@page{size:A4;margin:11mm 11mm 13mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font:12px system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#14202B;margin:0;padding:14px;max-width:900px;margin:auto}" +
      ".cab{display:flex;align-items:center;gap:14px;border-bottom:3px solid #0B3B2E;padding-bottom:8px;margin-bottom:10px}.cab img{height:34px}.cab .t{font-size:19px;font-weight:800;color:#0B3B2E}.cab small{display:block;color:#444;font-size:11px;margin-top:2px}" +
      "h2{font-size:15px;color:#0B3B2E;margin:12px 0 6px}h3{font-size:13px;margin:12px 0 4px;break-after:avoid}.kpi{display:flex;gap:8px}.kpi div{flex:1;text-align:center;border-radius:8px;padding:7px;color:#fff}.kpi b{display:block;font-size:19px}" +
      ".fotos{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:8px}.f{border:1px solid #E2DED5;border-radius:6px;padding:4px;break-inside:avoid}.f img{display:block;max-height:84mm;max-width:100%;width:auto;margin:0 auto;border-radius:4px;background:#111}.f b{display:block;font-size:11px;margin-top:3px}.f span{font-size:10px;color:#5C6B78}" +
      "table{width:100%;border-collapse:collapse;table-layout:fixed;overflow-wrap:anywhere;font-size:10.8px}td,th{text-align:left;padding:5px 4px;border-top:1px solid #E2DED5;vertical-align:top}th{font-size:10px;color:#5C6B78;border-top:0}thead{display:table-header-group}tr{break-inside:avoid}tr.fh td{background:#F3F1EA;font-weight:700}" +
      ".t{display:inline-block;padding:1px 8px;border-radius:99px;font-size:10px;font-weight:700;color:#fff}.t.ok{background:#2E8B57}.t.atencao{background:#C65825}.t.nao_avaliavel{background:#8A96A0}small{color:#5C6B78}" +
      ".pr{border:1px solid #E2DED5;border-left:4px solid #C65825;border-radius:8px;padding:6px 9px;margin:6px 0;break-inside:avoid}.pr p{margin:2px 0}.pr ul,ul{margin:3px 0 0 18px;padding:0}.quebra{break-before:page}.rod{margin-top:12px;border-top:1px solid #ccc;padding-top:6px;font-size:9.5px;color:#555}" +
      ".qm-up{color:#2E8B57;font-weight:700}.qm-dn{color:#C65825;font-weight:700}.qm-eq{color:#5C6B78}.qm-tag{display:inline-block;padding:1px 7px;border-radius:99px;font-size:10px;color:#fff}.qm-tag.ok{background:#2E8B57}.qm-tag.atencao{background:#C65825}.qm-tag.nao_avaliavel{background:#8A96A0}.qm-cmp-s{font-weight:700}.qm-msg{color:#5C6B78;font-size:10.5px}svg.qm-graf{width:100%;max-width:520px}" +
      ".nop{margin-bottom:10px}.nop button{font:inherit;padding:8px 14px;border-radius:8px;border:1px solid #0B3B2E;background:#0B3B2E;color:#fff;margin-right:6px;cursor:pointer}@media print{.nop{display:none}body{padding:0}}";
    return "<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Análise de movimento · " + esc(nm) + "</title><style>" + css + "</style></head><body>" +
      '<div class="nop"><button onclick="window.print()">Salvar como PDF / Imprimir</button><button onclick="window.close()">Fechar</button></div>' +
      '<div class="cab"><img src="' + esc(logo) + '" alt="QuadraLab"><div><div class="t">Análise de movimento · ' + esc(nm) + "</div><small>" + (d.atleta ? "Atleta: " + esc(d.atleta) + " · " : "") + "Mão dominante: " + (d.dom === "E" ? "esquerda" : "direita") + " · " + new Date().toLocaleDateString("pt-BR") + (d.demo ? " · dados de demonstração" : "") + (d.cabecalho ? " · " + esc(d.cabecalho) : "") + "</small></div></div>" +
      '<div class="kpi"><div style="background:#2E8B57"><b>' + r.resumo.ok + '</b>OK</div><div style="background:#C65825"><b>' + r.resumo.atencao + '</b>Atenção</div><div style="background:#8A96A0"><b>' + r.resumo.nao_avaliavel + "</b>Revisar com treinador</div></div>" +
      '<div class="fotos">' + fotos + '</div><div class="quebra"></div><h2>Checklist por fase</h2><table><thead><tr><th>Item</th><th>Medido</th><th>Referência</th><th>Parecer</th></tr></thead><tbody>' + tb + "</tbody></table>" +
      '<div class="quebra"></div><h2>Conclusão e intervenções sugeridas</h2><p>' + esc(co.texto) + "</p>" + cb + evo +
      '<div class="rod">Tecnologia QuadraLab · relatório automático de apoio ao treinador. As medidas vêm de estimativa de pose em vídeo e as faixas de referência são provisórias. Itens "Revisar" dependem de avaliação presencial. Metodologia de referência: TennisBiomec · DNA USP.</div></body></html>';
  }

  /* ── tela ── */
  function montar(el, opts) {
    opts = opts || {};
    var logo = opts.logo || "assets/logo-quadralab.png";
    var S = { golpe: "forehand", emp: "2", quadros: null, real: false, resultado: null, fotos: [], regId: null, historico: (opts.historico || []).slice(), cota: opts.cota || null, token: 0 };
    el.classList.add("qlm");
    el.innerHTML =
      '<div class="qm-row" style="justify-content:space-between"><div>' + badgeHTML(logo) + '</div></div>' +
      '<div class="qm-card" data-r="ctl">' +
      '<div id="qm-cota-slot"></div>' +
      '<div class="qm-row"><label class="qm-btn">Escolher vídeo<input data-r="arq" type="file" accept="video/*" hidden></label>' +
      '<div class="qm-tabs" data-r="tabs"><button data-g="forehand" class="on">Forehand</button><button data-g="backhand">Backhand</button><button data-g="saque">Saque</button></div>' +
      '<label data-r="empL" hidden>Backhand <select data-r="emp"><option value="2">Duas mãos</option><option value="1">Uma mão</option></select></label>' +
      '<label>Atleta <input type="text" data-r="atl" placeholder="Nome (opcional)" style="width:150px"></label>' +
      '<label>Mão dominante <select data-r="dom"><option value="D">Direita</option><option value="E">Esquerda</option></select></label>' +
      '<label>Quadros/s <select data-r="fps"><option>15</option><option selected>30</option></select></label>' +
      '<button class="qm-pri" data-r="go" disabled>Analisar</button><button data-r="demo">Ver demonstração</button></div>' +
      '<p class="qm-msg" data-r="guia"></p><p class="qm-msg" data-r="st">Escolha o golpe e envie o vídeo.</p>' +
      '<div class="qm-stage"><video data-r="v" controls playsinline muted preload="auto"></video><canvas data-r="cv"></canvas></div></div>' +
      '<div data-r="saida" hidden>' +
      '<div class="qm-card"><h3 class="qm-h">Resultado</h3><div class="qm-kpi" data-r="kpi"></div><div class="qm-tl" data-r="tl"></div><div class="qm-fases" data-r="fases"></div></div>' +
      '<div class="qm-card" data-r="cmpC" hidden><h3 class="qm-h">Comparação com a análise anterior</h3><div data-r="cmp"></div></div>' +
      '<div class="qm-card"><h3 class="qm-h">Checklist por fase</h3><table><thead><tr><th>Item</th><th>Medido</th><th>Referência</th><th>Parecer</th></tr></thead><tbody data-r="tb"></tbody></table>' +
      '<p class="qm-msg">Itens "Revisar" dependem de mão, face da raquete, vista de cima ou olhar: ficam para o treinador. Pareceres automáticos são apoio, não diagnóstico.</p></div>' +
      '<div class="qm-card"><h3 class="qm-h">Conclusão e intervenções sugeridas</h3><p data-r="ctx" style="margin:0 0 8px"></p><div data-r="cbody"></div><p class="qm-msg">Sugestões geradas por regras a partir das medidas deste vídeo; não substituem avaliação presencial.</p></div>' +
      '<div class="qm-card"><div class="qm-row"><button class="qm-pri" data-r="pdf">Relatório em PDF</button><button data-r="json">Baixar dados (JSON)</button></div><p class="qm-msg" data-r="salvoMsg"></p>' +
      '<details><summary>Faixas de referência (editáveis)</summary><p class="qm-msg">Valores iniciais do caso do material-base; precisam de validação de especialista.</p>' +
      '<div class="qm-row"><label>Joelhos° <input data-r="rJ" type="number" value="90" style="width:70px"></label><label>± <input data-r="rJt" type="number" value="10" style="width:60px"></label>' +
      '<label>Tronco° <input data-r="rT" type="number" value="90" style="width:70px"></label><label>± <input data-r="rTt" type="number" value="10" style="width:60px"></label>' +
      '<label>Antebraço ND máx° <input data-r="rA" type="number" value="20" style="width:70px"></label><label>Contato à frente mín <input data-r="rC" type="number" step="0.05" value="0.15" style="width:70px"></label>' +
      '<button data-r="re">Reaplicar</button></div></details></div></div>' +
      '<div class="qm-card qm-hist" data-r="histC"><h3 class="qm-h">Evolução e histórico</h3><div data-r="evo"></div><div data-r="lista"></div></div>';

    var q = function (n) { return el.querySelector('[data-r="' + n + '"]'); };
    var v = q("v"), cv = q("cv"), arqUrl = null;
    function golpe() { return S.golpe; }
    function msg(t) { q("st").textContent = t; }
    function regras() { return { joelhos: { alvo: +q("rJ").value, tol: +q("rJt").value }, tronco: { alvo: +q("rT").value, tol: +q("rTt").value }, antebracoNaoDominante: { max: +q("rA").value }, contatoFrente: { min: +q("rC").value }, splitStep: { min: B.REGRAS.splitStep.min } }; }
    function pegaGuia() { q("guia").textContent = GUIA[S.golpe]; q("empL").hidden = S.golpe !== "backhand"; }
    function atualizaCota() {
      var c = S.cota, slot = el.querySelector("#qm-cota-slot");
      if (!c || c.limite == null) { slot.innerHTML = ""; return; }
      var txt = c.bloqueado ? "A análise de movimento não está incluída no seu plano atual. Está disponível nos planos Essencial (quantidade mensal) e Premium (ilimitado)."
        : (c.liberado ? "Plano com limite: você usou " + c.usados + " de " + c.limite + " análises de movimento neste mês (" + c.restantes + " restantes). No Premium é ilimitado."
          : "Você usou as " + c.limite + " análises de movimento deste mês. Elas voltam no próximo mês, ou passe ao Premium para análises ilimitadas.");
      slot.innerHTML = '<div class="qm-cota' + (c.liberado ? "" : " bloq") + '">' + esc(txt) + "</div>";
      q("go").disabled = !c.liberado || !arqUrl;
    }
    function renderHistorico() {
      q("evo").innerHTML = evolucaoHTML(S.historico);
      var lista = B.ordenar(S.historico).slice().reverse();
      q("lista").innerHTML = lista.length ? '<h4>Análises salvas</h4><table><tbody>' + lista.map(function (h) {
        return "<tr><td>" + data(h.criadoEm) + "</td><td>" + esc(nomeGolpe(h.golpe, h.emp)) + "</td><td>" + h.res.ok + " OK · " + h.res.atencao + " atenção</td>" + (opts.aoRemover ? '<td><button class="qm-x" data-rm="' + esc(h.id) + '">Remover</button></td>' : "") + "</tr>";
      }).join("") + "</tbody></table>" : "";
    }
    q("lista").onclick = function (e) {
      var b = e.target.closest("[data-rm]"); if (!b || !opts.aoRemover) return;
      if (!window.confirm("Remover esta análise do histórico?")) return;
      var id = b.getAttribute("data-rm");
      S.historico = S.historico.filter(function (h) { return h.id !== id; });
      Promise.resolve(opts.aoRemover(id)).catch(function () {});
      if (opts.aoMudar) opts.aoMudar(S.historico);
      renderHistorico();
    };
    q("tabs").onclick = function (e) {
      var b = e.target.closest("button"); if (!b) return;
      S.golpe = b.getAttribute("data-g");
      [].forEach.call(this.children, function (x) { x.className = x === b ? "on" : ""; });
      pegaGuia(); S.quadros = null; S.real = false; q("saida").hidden = true; msg("Escolha o vídeo do golpe selecionado e toque em Analisar.");
    };
    q("arq").onchange = function (e) {
      var f = e.target.files[0]; if (!f) return;
      if (arqUrl) URL.revokeObjectURL(arqUrl);
      arqUrl = URL.createObjectURL(f); v.src = arqUrl;
      q("go").disabled = !!(S.cota && !S.cota.liberado);
      msg("Vídeo carregado. Toque em Analisar.");
    };
    function ajustaCanvas() { cv.width = v.videoWidth || 640; cv.height = v.videoHeight || 360; }
    v.addEventListener("loadedmetadata", ajustaCanvas);
    function desenhar(c, lm, w, h) {
      var x = c.getContext("2d"); x.lineWidth = Math.max(2, w / 200); x.strokeStyle = "#4FC3F7"; x.fillStyle = "#FFB74D";
      LIG.forEach(function (l) { var a = lm[l[0]], b = lm[l[1]]; if (!a || !b) return; x.beginPath(); x.moveTo(a.x * w, a.y * h); x.lineTo(b.x * w, b.y * h); x.stroke(); });
      [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].forEach(function (i) { var p = lm[i]; if (!p) return; x.beginPath(); x.arc(p.x * w, p.y * h, Math.max(3, w / 130), 0, 7); x.fill(); });
    }
    function pronto() { return new Promise(function (r) { if (v.readyState >= 2) return r(); var f = function () { v.removeEventListener("loadeddata", f); r(); }; v.addEventListener("loadeddata", f); v.load(); setTimeout(r, 8000); }); }
    function seek(t) {
      return new Promise(function (r) {
        var feito = false, tm = setTimeout(fim, 2500);
        function fim() { if (feito) return; feito = true; v.removeEventListener("seeked", fim); clearTimeout(tm); r(); }
        if (Math.abs(v.currentTime - t) < 0.001 && v.readyState >= 2) { feito = true; clearTimeout(tm); return r(); }
        v.addEventListener("seeked", fim); v.currentTime = t;
      });
    }
    function quadroPronto() { return new Promise(function (r) { var ok = false, f = function () { if (!ok) { ok = true; r(); } }; if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(f); setTimeout(f, 220); }); }
    async function carregaPose() {
      msg("Carregando modelo de pose (primeira vez pode levar alguns segundos)…");
      var mod = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs");
      var fs = await mod.FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
      return mod.PoseLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task" }, runningMode: "VIDEO", numPoses: 1 });
    }
    q("go").onclick = async function () {
      if (S.cota && !S.cota.liberado) { atualizaCota(); return; }
      q("go").disabled = true;
      try {
        msg("Preparando o vídeo…"); v.pause(); await pronto();
        var pose = await carregaPose(), fps = +q("fps").value, dur = v.duration, n = Math.floor(dur * fps), qs = [], ok = 0;
        ajustaCanvas();
        if (dur > 12) { msg("Vídeo longo (" + dur.toFixed(1) + " s). Recorte para apenas um golpe (até 12 s)."); q("go").disabled = false; return; }
        for (var i = 0; i < n; i++) {
          var t = i / fps; await seek(t);
          var r = pose.detectForVideo(v, Math.round(t * 1000) + 1 + i);
          if (r.landmarks && r.landmarks[0]) {
            ok++; qs.push({ t: t, lm: r.landmarks[0].map(function (p) { return { x: p.x, y: p.y, z: p.z, v: p.visibility }; }) });
            var c = cv.getContext("2d"); c.clearRect(0, 0, cv.width, cv.height); desenhar(cv, r.landmarks[0], cv.width, cv.height);
          }
          if (i % 5 === 0) msg("Analisando… " + Math.round(i / n * 100) + "%");
        }
        if (ok < n * 0.6) { msg("Pessoa detectada em poucos quadros (" + ok + "/" + n + "). Reenquadre o vídeo (corpo inteiro, boa luz)."); q("go").disabled = false; return; }
        S.quadros = qs; S.real = true; S.regId = null; mostrar(false, true);
        msg("Análise concluída (" + ok + " quadros).");
      } catch (e) { msg("Não foi possível carregar o modelo de pose: " + e.message + ". Verifique a conexão com a internet."); }
      q("go").disabled = !!(S.cota && !S.cota.liberado);
    };
    q("demo").onclick = function () { injetar(B.sintetico(golpe() === "saque" ? 70 : 60, q("dom").value, golpe()), { sintetico: true }); msg("Demonstração com dados sintéticos (não é um vídeo real; não é salvo no histórico)."); };
    q("re").onclick = function () { if (S.quadros) mostrar(!S.real, false); };

    function mostrar(sintetico, novo) {
      var emp = q("emp").value, dom = q("dom").value;
      S.emp = emp;
      var r = B.checklist(S.quadros, dom, regras(), golpe(), emp);
      if (r.erro) { msg(r.erro); return; }
      S.resultado = r; S.sintetico = !!sintetico;
      q("saida").hidden = false;
      var c = r.resumo;
      q("kpi").innerHTML = '<div style="background:var(--qok)"><b>' + c.ok + '</b>OK</div><div style="background:var(--qat)"><b>' + c.atencao + '</b>Atenção</div><div style="background:var(--qna)"><b>' + c.nao_avaliavel + "</b>Revisar com treinador</div>";
      var tot = S.quadros[S.quadros.length - 1].t || 1;
      q("tl").innerHTML = r.fases.map(function (f, i) { return '<i style="left:' + (f.t / tot * 100) + '%"></i><em style="left:' + (f.t / tot * 100) + "%;top:" + (i % 2 ? 22 : 0) + 'px">' + (i + 1) + "</em>"; }).join("");
      var fe = q("fases"); fe.innerHTML = ""; var cvs = [];
      var proporcao = (cv.height && cv.width) ? cv.height / cv.width : 0.75;
      r.fases.forEach(function (f, i) {
        var d = document.createElement("div"); d.className = "qm-fase"; var c2 = document.createElement("canvas"); c2.width = 480; c2.height = Math.round(480 * proporcao);
        var x = c2.getContext("2d"); x.fillStyle = "#111"; x.fillRect(0, 0, c2.width, c2.height); cvs.push(c2);
        d.appendChild(c2); d.insertAdjacentHTML("beforeend", "<b>" + (i + 1) + ". " + esc(r.nomes[i]) + "</b><span>" + f.t.toFixed(2) + " s</span>");
        d.onclick = function () { if (v.src && !sintetico) v.currentTime = f.t; if (c2.requestFullscreen) c2.requestFullscreen().catch(function () {}); };
        fe.appendChild(d);
      });
      var meu = ++S.token;
      (async function () {
        S.fotos = [];
        for (var i = 0; i < r.fases.length; i++) {
          if (meu !== S.token) return;
          var f = r.fases[i], c2 = cvs[i], x = c2.getContext("2d");
          if (!sintetico && v.src) { await seek(f.t); await quadroPronto(); x.drawImage(v, 0, 0, c2.width, c2.height); }
          desenhar(c2, S.quadros[f.quadro].lm, c2.width, c2.height);
          x.fillStyle = "rgba(0,0,0,.55)"; x.fillRect(0, 0, 150, 26); x.fillStyle = "#fff"; x.font = "bold 15px system-ui"; x.fillText((i + 1) + ". " + r.nomes[i], 8, 18);
          try { S.fotos[i] = c2.toDataURL("image/jpeg", 0.8); } catch (e) { S.fotos[i] = ""; }
        }
        if (meu === S.token && !sintetico && v.src) await seek(0);
      })();
      var tb = "", fa = -1;
      r.itens.forEach(function (it) {
        if (it.fase !== fa) { fa = it.fase; tb += '<tr class="qm-fh"><td colspan="4">' + (fa + 1) + ". " + esc(r.nomes[fa]) + "</td></tr>"; }
        tb += "<tr><td>" + esc(it.nome) + "</td><td>" + (it.valor == null ? "—" : Math.round(it.valor * 100) / 100 + esc(it.unidade)) + "</td><td>" + esc(it.ref) + '</td><td><span class="qm-tag ' + it.status + '">' + ROT[it.status] + '</span><br><span class="qm-msg">' + esc(it.comentario) + "</span></td></tr>";
      });
      q("tb").innerHTML = tb;
      var co = B.conclusao(r); q("ctx").textContent = co.texto;
      var ch = "";
      if (co.prioridades.length) { ch += "<h4>Prioridades de intervenção</h4>"; co.prioridades.forEach(function (p, k) { ch += '<div class="qm-pr"><b>' + (k + 1) + ". " + esc(p.nome) + '</b> <span class="qm-msg">(' + (p.valor == null ? "—" : Math.round(p.valor * 100) / 100 + esc(p.unidade)) + " · ref. " + esc(p.ref) + ')</span><p class="qm-msg">' + esc(p.porque) + "</p>" + (p.exercicios.length ? "<ul>" + p.exercicios.map(function (e) { return "<li>" + esc(e) + "</li>"; }).join("") + "</ul>" : "") + "</div>"; }); }
      if (co.fortes.length) ch += "<h4>Pontos fortes</h4><ul class=\"qm-ul\">" + co.fortes.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ul>";
      if (co.revisar.length) ch += "<h4>Para o treinador revisar (não medidos)</h4><ul class=\"qm-ul\">" + co.revisar.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ul>";
      q("cbody").innerHTML = ch;
      // comparação com a análise anterior do mesmo golpe + salvamento automático no histórico
      var reg = B.resumir(r, { emp: emp, dom: dom, id: S.regId || undefined });
      if (S.regId) reg.criadoEm = (S.historico.filter(function (h) { return h.id === S.regId; })[0] || reg).criadoEm;
      var ant = B.anteriorDe(S.historico, reg), cmp = ant ? B.comparar(ant, reg) : null;
      S.comparacao = cmp;
      q("cmpC").hidden = !cmp; q("cmp").innerHTML = comparacaoHTML(cmp);
      if (!sintetico && opts.aoSalvar) {
        S.regId = reg.id;
        S.historico = S.historico.filter(function (h) { return h.id !== reg.id; }).concat([reg]);
        q("salvoMsg").textContent = "Análise salva no histórico do jogador.";
        Promise.resolve(opts.aoSalvar(reg)).then(function () { if (novo && S.cota && S.cota.limite != null) { S.cota = opts.cotaDe ? opts.cotaDe(S.historico) : B.cota(opts.recurso || "movimento", opts.plano, S.historico); atualizaCota(); } }).catch(function () { q("salvoMsg").textContent = "Não foi possível salvar no histórico agora."; });
        if (opts.aoMudar) opts.aoMudar(S.historico);
      } else q("salvoMsg").textContent = sintetico ? "Demonstração: nada foi salvo." : "";
      renderHistorico();
    }
    function injetar(quadros, o) { o = o || {}; S.quadros = quadros; S.real = !o.sintetico; S.regId = null; mostrar(!!o.sintetico, true); }
    q("pdf").onclick = function () {
      if (!S.resultado) return;
      var w = window.open("", "_blank");
      if (!w) { alert("O navegador bloqueou a janela do relatório — permita pop-ups para este site e tente de novo."); return; }
      var hist = S.historico.filter(function (h) { return h.golpe === golpe(); });
      w.document.write(relatorioHTML({ resultado: S.resultado, golpe: golpe(), emp: S.emp, dom: q("dom").value, atleta: q("atl").value || opts.atleta || "", fotos: S.fotos, logo: opts.logoAbsoluto || logo, demo: S.sintetico, comparacao: S.comparacao, historico: hist, cabecalho: opts.cabecalho }));
      w.document.close();
    };
    q("json").onclick = function () {
      var b = new Blob([JSON.stringify({ gerado: new Date().toISOString(), golpe: golpe(), dominante: q("dom").value, resultado: S.resultado }, null, 1)], { type: "application/json" }), a = document.createElement("a");
      a.href = URL.createObjectURL(b); a.download = "analise-movimento.json"; a.click();
    };
    if (opts.atleta) q("atl").value = opts.atleta;
    pegaGuia(); atualizaCota(); renderHistorico();
    return { injetar: injetar, seek: seek, estado: S, atualizarHistorico: function (h, cota) { S.historico = h.slice(); if (cota) S.cota = cota; atualizaCota(); renderHistorico(); } };
  }

  raiz.QLMovimento = { montar: montar, evolucaoHTML: evolucaoHTML, comparacaoHTML: comparacaoHTML, relatorioHTML: relatorioHTML, badgeHTML: badgeHTML };
})(typeof window !== "undefined" ? window : this);
