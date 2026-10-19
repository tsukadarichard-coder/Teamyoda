/* Relatório dos jogos coletados: um documento HTML completo (gráficos em SVG, sem bibliotecas) pronto para "Salvar como PDF".
   Recebe os jogos salvos do atleta (registros com scout) e as funções do próprio app (métricas, tendência, leitura), e devolve o HTML.
   Cores: azul = pontos do atleta, laranja = pontos do adversário (mesma convenção do resumo da família); decisões em verde-azulado/cinza/magenta;
   o verde da marca só no cabeçalho. Todo valor aparece escrito ao lado da marca (nunca só a cor) e todo texto passa por esc(). */
(function (raiz) {
  "use strict";
  var AZUL = "#0F5E8C", AZUL_CL = "#6FA8CB", LARANJA = "#C65825", LARANJA_CL = "#E3A27E", CINZA = "#B9C3BE", TINTA = "#17251F", GRAFITE = "#5B6B63", LINHA = "#E2E8E5", MARCA = "#103B32";
  var DEC = { boa: "#1F7A66", disc: "#B9C3BE", ruim: "#A23B72" };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function n0(v) { v = Number(v); return isFinite(v) ? v : 0; }
  function pct(a, b) { return n0(b) > 0 ? Math.round(n0(a) * 100 / n0(b)) : 0; }
  function media(l) { l = l.filter(function (x) { return x !== null && isFinite(x); }); return l.length ? l.reduce(function (s, v) { return s + v; }, 0) / l.length : null; }
  function r1(v) { return v === null ? "—" : (Math.round(v * 10) / 10).toString().replace(".", ","); }
  function dataBR(d) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || "")); return m ? m[3] + "/" + m[2] + "/" + m[1] : esc(d || ""); }
  function curta(d) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || "")); return m ? m[3] + "/" + m[2] : ""; }
  var NIVEL = { iniciante: "Iniciante", intermediario: "Intermediário", avancado: "Avançado", competitivo: "Competitivo", elite: "Elite / profissional" };

  /* ───────── gráficos em SVG ───────── */
  function linhas(titulo, nota, rotulos, series, opc) {
    opc = opc || {};
    var W = 340, H = 170, L = 34, Rr = 14, T = 12, B = 26, n = rotulos.length, suf = opc.suf || "";
    var todos = []; series.forEach(function (s) { s.valores.forEach(function (v) { if (v !== null) todos.push(v); }); });
    if (!todos.length) return "";
    var mn = opc.min != null ? opc.min : 0, mx = opc.max != null ? opc.max : Math.max.apply(null, todos) * 1.15 || 1;
    if (mx <= mn) mx = mn + 1;
    function x(i) { return n === 1 ? L + (W - L - Rr) / 2 : L + (W - L - Rr) * i / (n - 1); }
    function y(v) { return T + (H - T - B) * (1 - (v - mn) / (mx - mn)); }
    var g = "";
    [0, 0.5, 1].forEach(function (f) { var v = mn + (mx - mn) * f, yy = y(v); g += '<line x1="' + L + '" x2="' + (W - Rr) + '" y1="' + yy + '" y2="' + yy + '" stroke="' + LINHA + '"/><text x="' + (L - 5) + '" y="' + (yy + 3) + '" text-anchor="end" font-size="9" fill="' + GRAFITE + '">' + Math.round(v) + suf + "</text>"; });
    if (opc.ref != null) g += '<line x1="' + L + '" x2="' + (W - Rr) + '" y1="' + y(opc.ref) + '" y2="' + y(opc.ref) + '" stroke="' + GRAFITE + '" stroke-dasharray="4 3"/><text x="' + (W - Rr) + '" y="' + (y(opc.ref) - 3) + '" text-anchor="end" font-size="8.5" fill="' + GRAFITE + '">' + esc(opc.refRot || "") + "</text>";
    rotulos.forEach(function (r, i) { if (n <= 12 || i % Math.ceil(n / 12) === 0) g += '<text x="' + x(i) + '" y="' + (H - 9) + '" text-anchor="middle" font-size="9" fill="' + GRAFITE + '">' + esc(r) + "</text>"; });
    series.forEach(function (s) {
      var pts = []; s.valores.forEach(function (v, i) { if (v !== null) pts.push([x(i), y(v), v]); });
      if (pts.length > 1) g += '<polyline fill="none" stroke="' + s.cor + '" stroke-width="2.2" stroke-linejoin="round" points="' + pts.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" ") + '"/>';
      pts.forEach(function (p, k) {
        g += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3.2" fill="' + s.cor + '" stroke="#fff" stroke-width="1.5"/>';
        if (n <= 10 || k === pts.length - 1) g += '<text x="' + p[0].toFixed(1) + '" y="' + (p[1] - 7).toFixed(1) + '" text-anchor="middle" font-size="9" font-weight="700" fill="' + TINTA + '">' + r1(p[2]) + suf + "</text>";
      });
    });
    var leg = series.length > 1 ? '<p class="leg">' + series.map(function (s) { return '<span><i style="background:' + s.cor + '"></i>' + esc(s.nome) + "</span>"; }).join("") + "</p>" : "";
    return '<figure class="graf"><figcaption><b>' + esc(titulo) + "</b>" + (nota ? "<small>" + esc(nota) + "</small>" : "") + '</figcaption><svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(titulo) + '">' + g + "</svg>" + leg + "</figure>";
  }
  /* barras empilhadas por jogo (valores absolutos ou 100%) */
  function empilhadas(titulo, nota, rotulos, camadas, opc) {
    opc = opc || {};
    var W = 340, H = 170, L = 34, Rr = 10, T = 14, B = 26, n = rotulos.length, tot = [];
    for (var i = 0; i < n; i++) tot.push(camadas.reduce(function (s, c) { return s + n0(c.valores[i]); }, 0));
    var mx = opc.cem ? 100 : Math.max.apply(null, tot) || 1; if (!Math.max.apply(null, tot)) return "";
    var bw = Math.min(34, (W - L - Rr) / n * 0.62), g = "";
    [0, 0.5, 1].forEach(function (f) { var v = mx * f, yy = T + (H - T - B) * (1 - f); g += '<line x1="' + L + '" x2="' + (W - Rr) + '" y1="' + yy + '" y2="' + yy + '" stroke="' + LINHA + '"/><text x="' + (L - 5) + '" y="' + (yy + 3) + '" text-anchor="end" font-size="9" fill="' + GRAFITE + '">' + Math.round(v) + (opc.cem ? "%" : "") + "</text>"; });
    for (var j = 0; j < n; j++) {
      var cx = L + (W - L - Rr) * (j + 0.5) / n, acc = 0, t = tot[j] || 1;
      camadas.forEach(function (c) {
        var v = n0(c.valores[j]); if (!v) return;
        var val = opc.cem ? v * 100 / t : v, h = (H - T - B) * val / mx, yy = T + (H - T - B) - (H - T - B) * (acc + val) / mx;
        g += '<rect x="' + (cx - bw / 2).toFixed(1) + '" y="' + yy.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(h - 1, 0.5).toFixed(1) + '" fill="' + c.cor + '" rx="2"/>';
        if (h > 12 && n <= 10) g += '<text x="' + cx.toFixed(1) + '" y="' + (yy + h / 2 + 3).toFixed(1) + '" text-anchor="middle" font-size="8.5" font-weight="700" fill="#fff">' + v + "</text>";
        acc += val;
      });
      if (n <= 12 || j % Math.ceil(n / 12) === 0) g += '<text x="' + cx.toFixed(1) + '" y="' + (H - 9) + '" text-anchor="middle" font-size="9" fill="' + GRAFITE + '">' + esc(rotulos[j]) + "</text>";
    }
    return '<figure class="graf"><figcaption><b>' + esc(titulo) + "</b>" + (nota ? "<small>" + esc(nota) + "</small>" : "") + '</figcaption><svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(titulo) + '">' + g + '</svg><p class="leg">' + camadas.map(function (c) { return '<span><i style="background:' + c.cor + '"></i>' + esc(c.nome) + "</span>"; }).join("") + "</p></figure>";
  }
  function donut(p, cor, rot) {
    var r = 36, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, p));
    return '<svg class="donut" viewBox="0 0 96 96" role="img" aria-label="' + esc(rot || v + "%") + '"><circle cx="48" cy="48" r="' + r + '" fill="none" stroke="' + LINHA + '" stroke-width="11"/><circle cx="48" cy="48" r="' + r + '" fill="none" stroke="' + cor + '" stroke-width="11" stroke-linecap="round" stroke-dasharray="' + (c * v / 100).toFixed(1) + " " + c.toFixed(1) + '" transform="rotate(-90 48 48)"/><text x="48" y="54" text-anchor="middle" font-size="19" font-weight="800" fill="' + TINTA + '">' + v + "%</text></svg>";
  }
  function barraH(rot, det, v, max, cor, texto) {
    return '<div class="bh"><div class="bh-r">' + esc(rot) + (det ? "<small>" + esc(det) + "</small>" : "") + '</div><div class="bh-t"><div style="width:' + (max > 0 ? Math.max(v / max * 100, v > 0 ? 2 : 0) : 0).toFixed(1) + "%;background:" + cor + '"></div></div><div class="bh-v">' + esc(texto) + "</div></div>";
  }
  function pilha100(partes) {
    var t = partes.reduce(function (s, p) { return s + n0(p.v); }, 0); if (!t) return "";
    return '<div class="pilha">' + partes.filter(function (p) { return n0(p.v) > 0; }).map(function (p) { return '<b style="flex:' + p.v + ";background:" + p.cor + '" title="' + esc(p.nome + ": " + p.v) + '">' + (p.v / t >= 0.12 ? Math.round(p.v * 100 / t) + "%" : "") + "</b>"; }).join("") + "</div>";
  }
  function leg(itens) { return '<p class="leg">' + itens.map(function (i) { return '<span><i style="background:' + i[1] + '"></i>' + esc(i[0]) + "</span>"; }).join("") + "</p>"; }

  /* ───────── conteúdo ───────── */
  function gerar(o) {
    var atleta = String(o.atleta || "Atleta"), jogos = (o.jogos || []).filter(function (r) { return r && r.scout; }).slice().sort(function (a, b) { return String(a.data).localeCompare(String(b.data)); });
    var M = o.metricas || [], tend = o.tendencia || function () { return null; }, leitura = o.leitura || function () { return []; }, detalheDe = o.detalheDe || function (r) { return r.scout.detalhe || null; };
    var N = jogos.length, rot = jogos.map(function (r, i) { return "J" + (i + 1); });
    var det = jogos.map(detalheDe);
    function val(k, r) { var m = M.filter(function (x) { return x.k === k; })[0]; if (!m) return null; var v = m.get(r.scout); return typeof v === "number" && isFinite(v) ? v : null; }
    function ser(k) { return jogos.map(function (r) { return val(k, r); }); }
    var pg = ser("pctGanhos"), pontos = jogos.reduce(function (s, r) { return s + n0(r.scout.n); }, 0), ganhos = jogos.reduce(function (s, r) { return s + n0(r.scout.ganhos); }, 0);
    var h = "";

    /* resumo em números */
    var mPg = media(pg), mPrim = media(ser("pctPrimeiro")), mErr = media(ser("errosNos")), mDf = media(ser("df")), mCurt = media(ser("pctErrosCurtos")), mAdv = media(ser("pctAdversos"));
    function kpi(n, t, s) { return '<div class="kpi"><b>' + esc(n) + "</b><span>" + esc(t) + "</span>" + (s ? "<small>" + esc(s) + "</small>" : "") + "</div>"; }
    h += '<section class="kpis">' + kpi(N, N === 1 ? "jogo analisado" : "jogos analisados", dataBR(jogos[0].data) + (N > 1 ? " a " + dataBR(jogos[N - 1].data) : "")) + kpi(pontos, "pontos coletados", ganhos + " ganhos por " + atleta) + kpi(r1(mPg) + "%", "pontos ganhos (média)", "melhor jogo " + r1(Math.max.apply(null, pg.filter(function (v) { return v !== null; }).concat([0]))) + "%") +
      kpi(mPrim === null ? "—" : r1(mPrim) + "%", "1º saque dentro (média)") + kpi(r1(mErr), "erros por jogo (média)", mDf === null ? "" : r1(mDf) + " duplas faltas por jogo") + kpi(mAdv === null ? "—" : r1(mAdv) + "%", "ganhos em placar adverso (média)", "pontos sob pressão") + "</section>";

    /* leitura inteligente */
    var forte = [], atencao = [], mudancas = [];
    function cada(k, f) { var v = media(ser(k)); if (v !== null) f(v); }
    cada("pctPrimeiro", function (v) { if (v >= 62) forte.push("1º saque consistente: " + r1(v) + "% dentro em média."); else if (v < 55) atencao.push("1º saque dentro em apenas " + r1(v) + "% em média: dá margem para o adversário atacar o segundo."); });
    cada("pctErrosCurtos", function (v) { if (v >= 45) atencao.push(r1(v) + "% dos erros acontecem nas duas primeiras bolas: o jogo se perde cedo, na entrada do ponto."); else if (v <= 30) forte.push("Poucos erros nas duas primeiras bolas (" + r1(v) + "% dos erros): entra bem no ponto."); });
    cada("df", function (v) { if (v >= 3) atencao.push("Média de " + r1(v) + " duplas faltas por jogo."); else if (v <= 1) forte.push("Controle do segundo saque: " + r1(v) + " duplas faltas por jogo."); });
    cada("pctAdversos", function (v) { if (v < 45) atencao.push("Cai sob pressão: ganha " + r1(v) + "% dos pontos em placar adverso."); else if (v >= 55) forte.push("Resiste à pressão: " + r1(v) + "% dos pontos em placar adverso."); });
    var pa = media(ser("pctAtaque")), pd = media(ser("pctDefesa")), pc = media(ser("pctContra"));
    if (pa !== null && pa >= 60) forte.push("Converte bem quando ataca (" + r1(pa) + "% dos pontos de ataque).");
    if (pd !== null && pd < 30) atencao.push("Defesa rende pouco: " + r1(pd) + "% dos pontos defendidos.");
    if (pc !== null && pc >= 50) forte.push("Contra-ataca com eficiência (" + r1(pc) + "%).");
    var errDec = jogos.reduce(function (s, r) { return s + n0(r.scout.errosDecisao); }, 0), errEx = jogos.reduce(function (s, r) { return s + n0(r.scout.errosExec); }, 0);
    if (errDec + errEx >= 8) { if (errDec > errEx * 1.3) atencao.push("Os erros são mais de decisão (" + pct(errDec, errDec + errEx) + "%) do que de execução: o trabalho é de escolha de jogada."); else if (errEx > errDec * 1.3) atencao.push("Os erros são mais de execução (" + pct(errEx, errDec + errEx) + "%) do que de decisão: o trabalho é técnico."); }
    var dvN = 0, dvE = 0; det.forEach(function (d) { if (d && d.devolucao) { dvN += n0(d.devolucao.nos.n); dvE += n0(d.devolucao.nos.e); } });
    if (dvN >= 10 && pct(dvE, dvN) >= 25) atencao.push("Erra " + pct(dvE, dvN) + "% das devoluções (" + dvE + " em " + dvN + " pontos no saque do adversário).");
    M.forEach(function (m) {
      if (m.melhor === null || !m.suf || m.suf !== "%" || m.k === "pctCurtos" || m.k === "pctMedios" || m.k === "pctLongos" || m.k === "pctAte4") return;
      var v = ser(m.k).filter(function (x) { return x !== null; }); if (v.length < 3) return;
      var t = tend(v, m.melhor); if (t && !t.estavel && Math.abs(t.variacaoTotal) >= 5) mudancas.push({ rot: m.rot, t: t, v: Math.abs(t.variacaoTotal) });
    });
    mudancas.sort(function (a, b) { return b.v - a.v; });
    var sin = {}; jogos.forEach(function (r) { (leitura(r.scout) || []).forEach(function (s) { var tx = s[1]; sin[tx] = (sin[tx] || 0) + 1; }); });
    var recorrentes = Object.keys(sin).filter(function (k) { return N >= 2 && sin[k] >= Math.max(2, Math.ceil(N / 2)); }).sort(function (a, b) { return sin[b] - sin[a]; }).slice(0, 5);
    function lista(tit, cor, itens, vazio) { return '<div class="lei" style="border-top:3px solid ' + cor + '"><h3>' + esc(tit) + "</h3>" + (itens.length ? "<ul>" + itens.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>" : '<p class="mudo">' + esc(vazio) + "</p>") + "</div>"; }
    h += '<h2>Leitura do período</h2><section class="duas">' + lista("Pontos fortes", AZUL, forte, "Sem destaque claro nos jogos coletados.") + lista("Pontos de atenção", LARANJA, atencao, "Nada fora do esperado nos indicadores coletados.") + "</section>";
    if (mudancas.length) h += '<div class="lei" style="border-top:3px solid ' + MARCA + '"><h3>O que mudou ao longo dos jogos</h3><ul>' + mudancas.slice(0, 6).map(function (c) { return '<li><b style="color:' + c.t.cor + '">' + c.t.seta + " " + (c.t.variacaoTotal > 0 ? "+" : "") + r1(c.t.variacaoTotal) + " p.p.</b> " + esc(c.rot) + " (" + (c.t.melhorou ? "melhorou" : "piorou") + ")</li>"; }).join("") + "</ul></div>";
    if (recorrentes.length) h += '<div class="lei" style="border-top:3px solid ' + GRAFITE + '"><h3>Sinais que se repetem</h3><ul>' + recorrentes.map(function (k) { return "<li>" + esc(k) + ' <span class="mudo">(' + sin[k] + " de " + N + " jogos)</span></li>"; }).join("") + "</ul></div>";

    /* evolução */
    h += "<h2>Evolução jogo a jogo</h2>";
    if (N < 2) h += '<p class="mudo">Com um único jogo não há evolução para mostrar: os gráficos de evolução aparecem a partir do segundo jogo com scout salvo.</p>';
    h += '<section class="grade">' + [
      linhas("Pontos ganhos", "% dos pontos do jogo", rot, [{ nome: atleta, cor: AZUL, valores: pg }], { min: 0, max: 100, suf: "%", ref: 50, refRot: "50%" }),
      linhas("Primeiro saque dentro", "% dos primeiros saques", rot, [{ nome: "1º saque", cor: AZUL, valores: ser("pctPrimeiro") }], { min: 0, max: 100, suf: "%" }),
      linhas("Erros nas duas primeiras bolas", "% dos erros do jogo (quanto menor, melhor)", rot, [{ nome: "Erros na bola 1–2", cor: LARANJA, valores: ser("pctErrosCurtos") }], { min: 0, max: 100, suf: "%" }),
      empilhadas("Erros por decisão e execução", "número de erros de " + atleta, rot, [{ nome: "Decisão", cor: LARANJA, valores: jogos.map(function (r) { return r.scout.errosDecisao; }) }, { nome: "Execução", cor: LARANJA_CL, valores: jogos.map(function (r) { return r.scout.errosExec; }) }]),
      linhas("Ganhos por tipo de ponto", "% dos pontos de cada tipo", rot, [{ nome: "Ataque", cor: AZUL, valores: ser("pctAtaque") }, { nome: "Contra-ataque", cor: AZUL_CL, valores: ser("pctContra") }, { nome: "Defesa", cor: LARANJA, valores: ser("pctDefesa") }], { min: 0, max: 100, suf: "%" }),
      linhas("Aces e duplas faltas", "por jogo", rot, [{ nome: "Aces", cor: AZUL, valores: ser("aces") }, { nome: "Duplas faltas", cor: LARANJA, valores: ser("df") }]),
      linhas("Lado da quadra no meu saque", "% ganhos", rot, [{ nome: "Igualdade", cor: AZUL, valores: ser("pctSacD") }, { nome: "Vantagem", cor: AZUL_CL, valores: ser("pctSacE") }], { min: 0, max: 100, suf: "%" }),
      linhas("Lado da quadra no saque dele", "% ganhos", rot, [{ nome: "Igualdade", cor: AZUL, valores: ser("pctDevD") }, { nome: "Vantagem", cor: AZUL_CL, valores: ser("pctDevE") }], { min: 0, max: 100, suf: "%" }),
      linhas("Sob pressão", "% ganhos em placar adverso", rot, [{ nome: "Placar adverso", cor: LARANJA, valores: ser("pctAdversos") }], { min: 0, max: 100, suf: "%", ref: 50, refRot: "50%" }),
      empilhadas("Onde o ponto se decidiu", "% dos pontos por número de bolas", rot, [{ nome: "1–2 bolas", cor: AZUL, valores: ser("pctCurtos") }, { nome: "3–4 bolas", cor: AZUL_CL, valores: ser("pctMedios") }, { nome: "5+ bolas", cor: CINZA, valores: ser("pctLongos") }], { cem: true })
    ].join("") + "</section>";
    var temDec = det.some(function (d) { return d && d.decisoes && (n0(d.decisoes.boa.n) + n0(d.decisoes.disc.n) + n0(d.decisoes.ruim.n)) > 0; });
    var temMental = jogos.some(function (r) { var m = r.mental; return m && ["conf", "foco", "energia", "calma"].some(function (k) { return n0(m.antes && m.antes[k]) || n0(m.depois && m.depois[k]); }); });
    if (temDec || temMental) {
      h += "<h2>Decisões e estado mental</h2>";
      h += '<section class="grade">';
      if (temDec) h += empilhadas("Decisões de " + atleta, "% das decisões avaliadas pelo treinador", rot, [{ nome: "Boa", cor: DEC.boa, valores: det.map(function (d) { return d && d.decisoes ? d.decisoes.boa.n : 0; }) }, { nome: "Discutível", cor: DEC.disc, valores: det.map(function (d) { return d && d.decisoes ? d.decisoes.disc.n : 0; }) }, { nome: "Ruim", cor: DEC.ruim, valores: det.map(function (d) { return d && d.decisoes ? d.decisoes.ruim.n : 0; }) }], { cem: true });
      if (temMental) {
        function mm(bl) { return jogos.map(function (r) { var m = r.mental && r.mental[bl]; if (!m) return null; var v = ["conf", "foco", "energia", "calma"].map(function (k) { return n0(m[k]); }).filter(function (x) { return x > 0; }); return v.length ? media(v) : null; }); }
        h += linhas("Mental antes e depois do jogo", "média de confiança, foco, energia e controle emocional (1 a 5)", rot, [{ nome: "Antes", cor: AZUL_CL, valores: mm("antes") }, { nome: "Depois", cor: AZUL, valores: mm("depois") }], { min: 0, max: 5 });
        ["conf:Confiança", "calma:Controle emocional"].forEach(function (p) { var k = p.split(":")[0]; h += linhas(p.split(":")[1], "antes e depois (1 a 5)", rot, [{ nome: "Antes", cor: AZUL_CL, valores: jogos.map(function (r) { var v = n0(r.mental && r.mental.antes && r.mental.antes[k]); return v || null; }) }, { nome: "Depois", cor: AZUL, valores: jogos.map(function (r) { var v = n0(r.mental && r.mental.depois && r.mental.depois[k]); return v || null; }) }], { min: 0, max: 5 }); });
      }
      h += "</section>";
    }

    /* comparação completa */
    var linhasM = M.map(function (m) { return { m: m, v: jogos.map(function (r) { return val(m.k, r); }) }; }).filter(function (l) { return l.v.some(function (x) { return x !== null; }); });
    if (N >= 2) {
      h += '<h2>Comparação de todos os dados</h2><p class="mudo">Cada coluna é um jogo (J1 é o mais antigo). Em azul o melhor jogo da linha, em laranja o pior, quando “melhor” tem sentido. “—” é medida que o jogo não registrou.</p><div class="rolar"><table class="comp"><thead><tr><th>Medida</th>' + jogos.map(function (r, i) { return "<th>J" + (i + 1) + "<small>" + curta(r.data) + "</small></th>"; }).join("") + "<th>Média</th><th>Tendência</th></tr></thead><tbody>";
      linhasM.forEach(function (l) {
        var ok = l.v.filter(function (x) { return x !== null; }), mx = Math.max.apply(null, ok), mn = Math.min.apply(null, ok), dif = ok.length >= 2 && mx !== mn, m = l.m, f = function (v) { return r1(v) + (m.suf || ""); };
        var t = ok.length >= 2 && m.melhor !== null ? tend(ok, m.melhor) : null;
        if (m.grupo) h += '<tr class="gr"><td colspan="' + (N + 3) + '">' + esc(m.grupo) + "</td></tr>";
        h += "<tr><td>" + esc(m.rot) + "</td>" + l.v.map(function (v) { var bom = dif && v !== null && m.melhor !== null && v === (m.melhor ? mx : mn), ruim = dif && v !== null && m.melhor !== null && v === (m.melhor ? mn : mx); return '<td class="' + (bom ? "bom" : ruim ? "ruim" : "") + '">' + (v === null ? "—" : f(v)) + "</td>"; }).join("") +
          "<td>" + (ok.length ? f(media(ok)) : "—") + '</td><td style="color:' + (t ? t.cor : GRAFITE) + ';font-weight:700">' + (t ? t.seta + " " + (t.estavel ? "estável" : (t.variacaoTotal > 0 ? "+" : "") + r1(t.variacaoTotal)) : "—") + "</td></tr>";
      });
      h += "</tbody></table></div>";
    }

    /* acumulado de todos os jogos */
    var soma = function (f) { return det.reduce(function (s, d) { try { return s + (d ? n0(f(d)) : 0); } catch (e) { return s; } }, 0); };
    var fins = [["Winner de " + atleta, soma(function (d) { return d.fins.winner_nos; }), AZUL], ["Erro do adversário", soma(function (d) { return d.fins.erro_dele; }), AZUL_CL], ["Erro de " + atleta, soma(function (d) { return d.fins.erro_nos; }), LARANJA], ["Winner do adversário", soma(function (d) { return d.fins.winner_dele; }), LARANJA_CL]];
    var totFins = fins.reduce(function (s, f) { return s + f[1]; }, 0), blocos = "";
    if (totFins) blocos += '<div class="cx"><h3>Como os pontos terminaram</h3>' + fins.map(function (f) { return barraH(f[0], "", f[1], Math.max.apply(null, fins.map(function (x) { return x[1]; })), f[2], f[1] + " · " + pct(f[1], totFins) + "%"); }).join("") + leg([["Ponto de " + atleta, AZUL], ["Ponto do adversário", LARANJA]]) + "</div>";
    var ROT_G = { forehand: "Forehand", backhand: "Backhand", voleio: "Voleio", smash: "Smash", drop: "Drop shot", lob: "Lob", devolucao: "Devolução" }, gk = Object.keys(ROT_G).map(function (k) { return { k: k, n: soma(function (d) { return d.golpes[k].n; }), w: soma(function (d) { return d.golpes[k].w; }), e: soma(function (d) { return d.golpes[k].e; }), c: soma(function (d) { return d.golpes[k].c; }) }; }).filter(function (x) { return x.n > 0; });
    if (gk.length) { var mg = Math.max.apply(null, gk.map(function (x) { return x.n; })); blocos += '<div class="cx"><h3>Último golpe do ponto</h3>' + gk.map(function (x) { return '<div class="bh"><div class="bh-r">' + ROT_G[x.k] + "<small>" + (x.c ? x.c + " na corrida" : "") + '</small></div><div class="bh-t" style="background:#fff"><div style="width:' + (x.n / mg * 100).toFixed(1) + '%;display:flex;gap:2px;height:100%;background:transparent"><b style="flex:' + (x.w || 0.0001) + ";background:" + AZUL + '"></b><b style="flex:' + Math.max(x.n - x.w - x.e, 0.0001) + ";background:" + CINZA + '"></b><b style="flex:' + (x.e || 0.0001) + ";background:" + LARANJA + '"></b></div></div><div class="bh-v">' + x.n + "</div></div>"; }).join("") + leg([["Winners", AZUL], ["Outros", CINZA], ["Erros", LARANJA]]) + "</div>"; }
    var SIT = { ataque: "Ataque", contra: "Contra-ataque", defesa: "Defesa", neutra: "Neutra", construcao: "Construção" }, sk = Object.keys(SIT).map(function (k) { return { k: k, n: soma(function (d) { return d.situacoes[k].n; }), g: soma(function (d) { return d.situacoes[k].g; }) }; }).filter(function (x) { return x.n > 0; });
    if (sk.length) blocos += '<div class="cx"><h3>Situação do ponto</h3><p class="mudo">% ganhos em cada situação</p>' + sk.map(function (x) { return barraH(SIT[x.k], x.n + " pontos", pct(x.g, x.n), 100, AZUL, pct(x.g, x.n) + "%"); }).join("") + "</div>";
    var sd = [["Aberto", "aberto"], ["Fechado", "fechado"], ["Corpo", "corpo"]].map(function (p) { return { r: p[0], n: soma(function (d) { return d.saqueDir.nos[p[1]].n; }), g: soma(function (d) { return d.saqueDir.nos[p[1]].g; }), a: soma(function (d) { return d.saqueDir.nos[p[1]].a; }) }; }).filter(function (x) { return x.n > 0; });
    if (sd.length) blocos += '<div class="cx"><h3>Direção do meu saque</h3><p class="mudo">% de pontos ganhos por direção</p>' + sd.map(function (x) { return barraH(x.r, x.n + " saques" + (x.a ? " · " + x.a + " aces" : ""), pct(x.g, x.n), 100, AZUL, pct(x.g, x.n) + "%"); }).join("") + "</div>";
    var dir = [["Cruzado", "cruzado"], ["Paralelo", "paralelo"]].map(function (p) { return { r: p[0], n: soma(function (d) { return d.direcao[p[1]].n; }), g: soma(function (d) { return d.direcao[p[1]].g; }) }; }).filter(function (x) { return x.n > 0; });
    var corr = { n: soma(function (d) { return d.corrida.n; }), g: soma(function (d) { return d.corrida.g; }) };
    if (dir.length || corr.n) blocos += '<div class="cx"><h3>Direção e bolas na corrida</h3><p class="mudo">% de pontos ganhos</p>' + dir.map(function (x) { return barraH(x.r, x.n + " pontos", pct(x.g, x.n), 100, AZUL, pct(x.g, x.n) + "%"); }).join("") + (corr.n ? barraH("Bolas na corrida", corr.n + " pontos", pct(corr.g, corr.n), 100, AZUL, pct(corr.g, corr.n) + "%") : "") + "</div>";
    var ROT_Z = { "D-REDE": "Direita · rede", "D-APR": "Direita · aproximação", "D-FUNDO": "Direita · fundo", "E-REDE": "Esquerda · rede", "E-APR": "Esquerda · aproximação", "E-FUNDO": "Esquerda · fundo" };
    var zonas = {}; jogos.forEach(function (r) { var z = (o.zonasDe ? o.zonasDe(r.scout.pontos || []) : {}) || {}; Object.keys(z).forEach(function (k) { zonas[k] = zonas[k] || { n: 0, g: 0 }; zonas[k].n += n0(z[k].n); zonas[k].g += n0(z[k].ganhos); }); });
    var zk = Object.keys(ROT_Z).filter(function (k) { return zonas[k] && zonas[k].n > 0; });
    if (zk.length) { var mz = Math.max.apply(null, zk.map(function (k) { return Math.abs(zonas[k].g - (zonas[k].n - zonas[k].g)); })) || 1; blocos += '<div class="cx"><h3>Mapa da quadra</h3><p class="mudo">saldo de pontos (ganhos menos perdidos) por zona do último golpe</p>' + zk.map(function (k) { var s = zonas[k].g - (zonas[k].n - zonas[k].g); return barraH(ROT_Z[k], zonas[k].n + " pontos", Math.abs(s), mz, s >= 0 ? AZUL : LARANJA, (s > 0 ? "+" : "") + s); }).join("") + "</div>"; }
    if (blocos) h += '<h2>Acumulado de todos os jogos</h2><section class="grade">' + blocos + "</section>";

    /* jogo a jogo */
    h += '<h2>Cada jogo</h2>';
    jogos.forEach(function (r, i) {
      var s = r.scout, d = det[i], sinais = (leitura(s) || []).map(function (x) { return x[1]; }).slice(0, 4), nv = NIVEL[r.nivelAdversario];
      h += '<article class="jogo"><header><div><b>J' + (i + 1) + " · " + dataBR(r.data) + "</b><span>" + esc([r.torneio && r.torneio !== "jogo-treino" ? r.torneio : "Jogo-treino", r.adversario && r.adversario !== "—" ? "contra " + r.adversario : "", nv ? "adversário " + nv.toLowerCase() : "", r.resultado && r.resultado !== "—" ? r.resultado : "", r.concluida === false ? "interrompido" : ""].filter(Boolean).join(" · ")) + "</span></div></header>";
      h += '<div class="jg">' + donut(n0(s.pctGanhos), AZUL, n0(s.pctGanhos) + "% dos pontos ganhos") + '<div class="jn"><p><strong>' + n0(s.ganhos) + " de " + n0(s.n) + "</strong> pontos ganhos</p><p>" + n0(s.errosNos) + " erros (" + n0(s.errosDecisao) + " decisão · " + n0(s.errosExec) + " execução)</p><p>" + (s.pctPrimeiro ? n0(s.pctPrimeiro) + "% de 1º saque · " : "") + n0(s.aces || 0) + " aces · " + n0(s.df) + " duplas faltas</p></div></div>";
      if (d && d.fins) h += pilha100([{ nome: "Winner", v: d.fins.winner_nos, cor: AZUL }, { nome: "Erro do adversário", v: d.fins.erro_dele, cor: AZUL_CL }, { nome: "Erro do atleta", v: d.fins.erro_nos, cor: LARANJA }, { nome: "Winner do adversário", v: d.fins.winner_dele, cor: LARANJA_CL }]) + leg([["Winner", AZUL], ["Erro do adversário", AZUL_CL], ["Erro de " + atleta, LARANJA], ["Winner do adversário", LARANJA_CL]]);
      if (d && d.games && d.games.length > 1) h += '<p class="mudo" style="margin:8px 0 3px">Pontos ganhos game a game</p>' + pilhaGames(d.games);
      if (sinais.length) h += "<ul class=\"sin\">" + sinais.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>";
      if (r.observacaoFinal) h += "<blockquote>" + esc(r.observacaoFinal) + "</blockquote>";
      h += "</article>";
    });
    function pilhaGames(gs) { return '<div class="gms">' + gs.map(function (x) { var p = pct(x.g, x.n); return '<div class="gm" title="Game ' + x.j + ": " + x.g + " de " + x.n + '"><div class="gm-b"><i style="height:' + p + "%;background:" + (p >= 50 ? AZUL : LARANJA) + '"></i></div><span>' + x.j + "</span><small>" + p + "%</small></div>"; }).join("") + "</div>"; }

    var CSS = "@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:-apple-system,system-ui,'Segoe UI',Roboto,sans-serif;color:" + TINTA + ";max-width:920px;margin:0 auto;padding:22px 20px 40px;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
      "h1{font-size:26px;margin:0 0 2px;letter-spacing:-.02em}h2{font-size:17px;margin:30px 0 10px;padding-bottom:6px;border-bottom:2px solid " + MARCA + ";break-after:avoid}h3{font-size:13.5px;margin:0 0 8px}.sub{color:" + GRAFITE + ";font-size:13px;margin-bottom:18px}.mudo{color:" + GRAFITE + ";font-size:12.5px;margin:2px 0 8px}" +
      ".kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.kpi{border:1px solid " + LINHA + ";border-radius:12px;padding:11px 13px;background:#F6F8F7;break-inside:avoid}.kpi b{display:block;font-size:24px;line-height:1.1;color:" + MARCA + "}.kpi span{font-size:12.5px}.kpi small{display:block;font-size:11px;color:" + GRAFITE + "}" +
      ".duas{display:grid;grid-template-columns:1fr 1fr;gap:12px}.lei{border:1px solid " + LINHA + ";border-radius:12px;padding:12px 14px;margin-bottom:12px;break-inside:avoid}.lei ul{margin:0;padding-left:18px;font-size:13px}.lei li{margin:3px 0}" +
      ".grade{display:grid;grid-template-columns:1fr 1fr;gap:14px}.graf,.cx{margin:0;border:1px solid " + LINHA + ";border-radius:12px;padding:10px 12px;break-inside:avoid}.graf figcaption{margin-bottom:2px}.graf figcaption b{font-size:13px;display:block}.graf figcaption small{color:" + GRAFITE + ";font-size:11px}.graf svg{width:100%;height:auto;display:block}" +
      ".leg{display:flex;flex-wrap:wrap;gap:3px 12px;margin:6px 0 0;font-size:11px;color:" + GRAFITE + "}.leg i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:4px}" +
      ".bh{display:grid;grid-template-columns:38% 1fr auto;gap:8px;align-items:center;margin:7px 0;font-size:12px}.bh-r small{display:block;color:" + GRAFITE + ";font-size:10.5px}.bh-t{height:12px;background:#EDF1EF;border-radius:6px;overflow:hidden}.bh-t>div{height:100%;border-radius:0 6px 6px 0}.bh-v{font-weight:700;font-variant-numeric:tabular-nums;font-size:12px}" +
      ".rolar{overflow-x:auto}table.comp{border-collapse:collapse;width:100%;font-size:11.5px;font-variant-numeric:tabular-nums}.comp th,.comp td{border-bottom:1px solid " + LINHA + ";padding:5px 6px;text-align:center;white-space:nowrap}.comp th small{display:block;font-weight:400;color:" + GRAFITE + "}.comp td:first-child,.comp th:first-child{text-align:left;white-space:normal;min-width:150px}.comp tr.gr td{background:#F6F8F7;color:" + LARANJA + ";font-weight:700;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;text-align:left}.comp td.bom{background:#E4EFF6;color:" + AZUL + ";font-weight:700}.comp td.ruim{background:#F8E8DF;color:" + LARANJA + ";font-weight:700}.comp tr{break-inside:avoid}" +
      ".jogo{border:1px solid " + LINHA + ";border-radius:14px;padding:12px 14px;margin:0 0 12px;break-inside:avoid}.jogo header b{font-size:14px;display:block}.jogo header span{font-size:12px;color:" + GRAFITE + "}.jg{display:flex;align-items:center;gap:14px;margin:8px 0}.donut{width:92px;height:92px;flex:none}.jn p{margin:2px 0;font-size:12.5px}.pilha{display:flex;gap:2px;height:20px;border-radius:6px;overflow:hidden;margin-top:4px}.pilha b{display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px}" +
      ".gms{display:flex;gap:4px;align-items:flex-end}.gm{flex:1;text-align:center;font-size:10px;color:" + GRAFITE + "}.gm-b{height:46px;background:#EDF1EF;border-radius:4px;display:flex;align-items:flex-end;overflow:hidden}.gm-b i{display:block;width:100%}.gm small{display:block;color:" + TINTA + ";font-weight:700;font-size:9.5px}.sin{margin:8px 0 0;padding-left:18px;font-size:12px;color:" + GRAFITE + "}blockquote{margin:8px 0 0;padding:8px 12px;border-left:4px solid " + AZUL + ";background:#F1F7FB;font-size:12.5px;white-space:pre-wrap}" +
      ".topo{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid " + MARCA + ";padding-bottom:10px;margin-bottom:16px}.rodape{margin-top:28px;padding-top:10px;border-top:1px solid " + LINHA + ";font-size:11.5px;color:" + GRAFITE + "}.no-print{margin-bottom:18px;display:flex;gap:10px}.no-print button{padding:11px 16px;font-weight:700;cursor:pointer;border-radius:8px;border:1px solid " + MARCA + ";background:" + MARCA + ";color:#fff}.no-print button+button{background:#fff;color:" + MARCA + "}" +
      "@media(max-width:700px){.kpis{grid-template-columns:1fr 1fr}.duas,.grade{grid-template-columns:1fr}}@media print{.no-print{display:none}.kpis{grid-template-columns:repeat(3,1fr)}.duas,.grade{grid-template-columns:1fr 1fr}h2{margin-top:22px}}";

    return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório dos jogos · ' + esc(atleta) + "</title><style>" + CSS + "</style></head><body>" +
      '<div class="no-print"><button onclick="window.print()">Salvar como PDF / Imprimir</button><button onclick="window.close()">Fechar</button></div>' +
      (o.cabecalhoHtml || "") + "<h1>Relatório dos jogos</h1>" + '<div class="sub">' + esc(atleta) + " · " + N + (N === 1 ? " jogo com scout salvo" : " jogos com scout salvo") + " · gerado em " + esc(o.geradoEm || "") + "</div>" + h +
      '<p class="rodape">Um jogo é uma amostra: três jogos na mesma direção são um sinal, um jogo isolado é ruído. Este relatório serve para orientar o trabalho, não para julgar o jogador. Os números vêm dos pontos marcados pelo treinador; medidas que um jogo não registrou ficam de fora das médias e tendências.</p></body></html>';
  }
  var api = { gerar: gerar, esc: esc };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else raiz.QLRelatorioJogos = api;
})(typeof window !== "undefined" ? window : this);
