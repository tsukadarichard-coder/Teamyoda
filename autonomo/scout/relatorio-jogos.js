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
    cada("pctErrosCurtos", function (v) { if (v >= 45) atencao.push(r1(v) + "% dos erros acontecem nas 4 primeiras bolas: o jogo se perde cedo, na entrada do ponto."); else if (v <= 30) forte.push("Poucos erros nas duas primeiras bolas (" + r1(v) + "% dos erros): entra bem no ponto."); });
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
      linhas("Erros nas 4 primeiras bolas", "% dos erros do jogo (quanto menor, melhor)", rot, [{ nome: "Erros em até 4 bolas", cor: LARANJA, valores: ser("pctErrosCurtos") }], { min: 0, max: 100, suf: "%" }),
      empilhadas("Erros por decisão e execução", "número de erros de " + atleta, rot, [{ nome: "Decisão", cor: LARANJA, valores: jogos.map(function (r) { return r.scout.errosDecisao; }) }, { nome: "Execução", cor: LARANJA_CL, valores: jogos.map(function (r) { return r.scout.errosExec; }) }]),
      linhas("Ganhos por tipo de ponto", "% dos pontos de cada tipo", rot, [{ nome: "Ataque", cor: AZUL, valores: ser("pctAtaque") }, { nome: "Contra-ataque", cor: AZUL_CL, valores: ser("pctContra") }, { nome: "Defesa", cor: LARANJA, valores: ser("pctDefesa") }], { min: 0, max: 100, suf: "%" }),
      linhas("Aces e duplas faltas", "por jogo", rot, [{ nome: "Aces", cor: AZUL, valores: ser("aces") }, { nome: "Duplas faltas", cor: LARANJA, valores: ser("df") }]),
      linhas("Lado da quadra no meu saque", "% ganhos", rot, [{ nome: "Igualdade", cor: AZUL, valores: ser("pctSacD") }, { nome: "Vantagem", cor: AZUL_CL, valores: ser("pctSacE") }], { min: 0, max: 100, suf: "%" }),
      linhas("Lado da quadra no saque dele", "% ganhos", rot, [{ nome: "Igualdade", cor: AZUL, valores: ser("pctDevD") }, { nome: "Vantagem", cor: AZUL_CL, valores: ser("pctDevE") }], { min: 0, max: 100, suf: "%" }),
      linhas("Sob pressão", "% ganhos em placar adverso", rot, [{ nome: "Placar adverso", cor: LARANJA, valores: ser("pctAdversos") }], { min: 0, max: 100, suf: "%", ref: 50, refRot: "50%" }),
      empilhadas("Onde o ponto se decidiu", "% dos pontos por número de bolas", rot, [{ nome: "1–4 bolas", cor: AZUL, valores: ser("pctCurtos") }, { nome: "5–9 bolas", cor: AZUL_CL, valores: ser("pctMedios") }, { nome: "10+ bolas", cor: CINZA, valores: ser("pctLongos") }], { cem: true })
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
    var zonas = {}; jogos.forEach(function (r) { var z = (o.zonasDe ? o.zonasDe(r.scout.pontos || [], r.scout) : {}) || {}; Object.keys(z).forEach(function (k) { zonas[k] = zonas[k] || { n: 0, g: 0 }; zonas[k].n += n0(z[k].n); zonas[k].g += n0(z[k].ganhos); }); });
    var zk = Object.keys(ROT_Z).filter(function (k) { return zonas[k] && zonas[k].n > 0; });
    if (zk.length) { var mz = Math.max.apply(null, zk.map(function (k) { return Math.abs(zonas[k].g - (zonas[k].n - zonas[k].g)); })) || 1; blocos += '<div class="cx"><h3>Mapa da quadra</h3><p class="mudo">saldo de pontos (ganhos menos perdidos) por zona do último golpe</p>' + zk.map(function (k) { var s = zonas[k].g - (zonas[k].n - zonas[k].g); return barraH(ROT_Z[k], zonas[k].n + " pontos", Math.abs(s), mz, s >= 0 ? AZUL : LARANJA, (s > 0 ? "+" : "") + s); }).join("") + "</div>"; }
    if (blocos) h += '<h2>Acumulado de todos os jogos</h2><section class="grade">' + blocos + "</section>";

    /* jogo a jogo */
    h += '<h2>Cada jogo</h2>';
    jogos.forEach(function (r, i) {
      var s = r.scout, d = det[i], sinais = (leitura(s) || []).map(function (x) { return x[1]; }).slice(0, 4), nv = NIVEL[r.nivelAdversario];
      h += '<article class="jogo"><header><div><b>J' + (i + 1) + " · " + dataBR(r.data) + "</b><span>" + esc([r.torneio && r.torneio !== "jogo-treino" ? r.torneio : "Jogo-treino", r.adversario && r.adversario !== "—" ? "contra " + r.adversario : "", nv ? "adversário " + nv.toLowerCase() : "", r.resultado && r.resultado !== "—" ? r.resultado : "", r.concluida === false ? "interrompido" : ""].filter(Boolean).join(" · ")) + "</span></div></header>";
      h += '<div class="jg">' + donut(n0(s.pctGanhos), AZUL, n0(s.pctGanhos) + "% dos pontos ganhos") + '<div class="jn"><p><strong>' + n0(s.ganhos) + " de " + n0(s.n) + "</strong> pontos ganhos</p><p>" + n0(s.errosNos) + " erros (" + n0(s.errosDecisao) + " decisão · " + n0(s.errosExec) + " execução)</p><p>" + (s.pctPrimeiro ? n0(s.pctPrimeiro) + "% de 1º saque · " : "") + n0(s.aces || 0) + (n0(s.aces || 0) === 1 ? " ace · " : " aces · ") + n0(s.df) + (n0(s.df) === 1 ? " dupla falta" : " duplas faltas") + "</p></div></div>";
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
      (o.cabecalhoHtml || "") + "<h1>Relatório dos jogos</h1>" + '<div class="sub">' + esc(atleta) + " · " + N + (N === 1 ? " jogo com scout salvo" : " jogos com scout salvo") + " · gerado em " + esc(o.geradoEm || "") + " · Tecnologia QuadraLab</div>" + h +
      '<p class="rodape">Um jogo é uma amostra: três jogos na mesma direção são um sinal, um jogo isolado é ruído. Este relatório serve para orientar o trabalho, não para julgar o jogador. Os números vêm dos pontos marcados pelo treinador; medidas que um jogo não registrou ficam de fora das médias e tendências. Análise gerada com a Tecnologia QuadraLab.</p></body></html>';
  }

  /* ── Relatório da partida: um jogo, em página elegante (A4), para o treinador entregar ao atleta e à família.
        o: { atleta, reg (jogo salvo ou em curso), anteriores (jogos anteriores, opcional), metricas, leitura, detalheDe, cabecalhoHtml, geradoEm } ── */
  /* Momentum ponto a ponto: eixo X = número do ponto, eixo Y = saldo acumulado (pontos ganhos menos perdidos) do atleta. Linhas verticais marcam os sets. */
  function momentoXY(pts, atleta) {
    var n = pts.length, saldo = [0], W = 720, H = 280, L = 42, Rr = 16, T = 18, B = 34, i;
    for (i = 0; i < n; i++) saldo.push(saldo[i] + (pts[i].nos ? 1 : -1));
    var mx = Math.max.apply(null, saldo.concat([2])), mn = Math.min.apply(null, saldo.concat([-2]));
    var passo = Math.max(1, Math.ceil((mx - mn) / 6)); mx = Math.ceil(mx / passo) * passo; mn = Math.floor(mn / passo) * passo;
    function x(k) { return L + (W - L - Rr) * k / n; }
    function y(v) { return T + (H - T - B) * (1 - (v - mn) / (mx - mn)); }
    var y0 = y(0), d = "M" + x(0).toFixed(1) + "," + y0.toFixed(1);
    for (i = 1; i <= n; i++) d += "L" + x(i).toFixed(1) + "," + y(saldo[i]).toFixed(1);
    var area = d + "L" + x(n).toFixed(1) + "," + y0.toFixed(1) + "Z";
    var g = '<defs><clipPath id="mxa"><rect x="0" y="0" width="' + W + '" height="' + y0.toFixed(1) + '"/></clipPath><clipPath id="mxb"><rect x="0" y="' + y0.toFixed(1) + '" width="' + W + '" height="' + (H - y0).toFixed(1) + '"/></clipPath></defs>';
    for (var v = mn; v <= mx; v += passo) { var yy = y(v); g += '<line x1="' + L + '" x2="' + (W - Rr) + '" y1="' + yy.toFixed(1) + '" y2="' + yy.toFixed(1) + '" stroke="' + (v === 0 ? GRAFITE : LINHA) + '" stroke-width="' + (v === 0 ? 1.4 : 1) + '"/><text x="' + (L - 6) + '" y="' + (yy + 3.5).toFixed(1) + '" text-anchor="end" font-size="10" fill="' + GRAFITE + '">' + (v > 0 ? "+" : "") + v + "</text>"; }
    /* sequências: a melhor e a pior (pontos seguidos) */
    var melhor = { len: 0, ini: 0 }, pior = { len: 0, ini: 0 }, run = 0, ini = 0, sinal = null;
    for (i = 0; i < n; i++) { var ganhou = !!pts[i].nos; if (ganhou === sinal) run++; else { sinal = ganhou; run = 1; ini = i; } var alvo = ganhou ? melhor : pior; if (run > alvo.len) { alvo.len = run; alvo.ini = ini; } }
    [[melhor, AZUL], [pior, LARANJA]].forEach(function (b) { if (b[0].len >= 4) g += '<rect x="' + x(b[0].ini).toFixed(1) + '" y="' + T + '" width="' + (x(b[0].ini + b[0].len) - x(b[0].ini)).toFixed(1) + '" height="' + (H - T - B) + '" fill="' + b[1] + '" opacity=".10"/>'; });
    g += '<path d="' + area + '" fill="' + AZUL + '" opacity=".16" clip-path="url(#mxa)"/><path d="' + area + '" fill="' + LARANJA + '" opacity=".16" clip-path="url(#mxb)"/>';
    g += '<path d="' + d + '" fill="none" stroke="' + AZUL + '" stroke-width="2" stroke-linejoin="round" clip-path="url(#mxa)"/><path d="' + d + '" fill="none" stroke="' + LARANJA + '" stroke-width="2" stroke-linejoin="round" clip-path="url(#mxb)"/>';
    /* sets e games */
    g += '<text x="' + (x(0) + 4).toFixed(1) + '" y="' + (T + 10) + '" font-size="10" font-weight="700" fill="' + MARCA + '">Set ' + n0(pts[0].set || 1) + "</text>";
    for (i = 1; i < n; i++) {
      if (pts[i].set !== pts[i - 1].set && pts[i].set != null) g += '<line x1="' + x(i).toFixed(1) + '" x2="' + x(i).toFixed(1) + '" y1="' + T + '" y2="' + (H - B) + '" stroke="' + MARCA + '" stroke-width="1.2" stroke-dasharray="4 3"/><text x="' + (x(i) + 4).toFixed(1) + '" y="' + (T + 10) + '" font-size="10" font-weight="700" fill="' + MARCA + '">Set ' + pts[i].set + "</text>";
      else if (pts[i].jogo !== pts[i - 1].jogo && pts[i].jogo != null) g += '<line x1="' + x(i).toFixed(1) + '" x2="' + x(i).toFixed(1) + '" y1="' + (H - B) + '" y2="' + (H - B + 4) + '" stroke="' + CINZA + '"/>';
    }
    var passoX = n > 150 ? 25 : n > 80 ? 20 : 10;
    for (i = 0; i <= n; i += passoX) g += '<text x="' + x(i).toFixed(1) + '" y="' + (H - 14) + '" text-anchor="middle" font-size="10" fill="' + GRAFITE + '">' + i + "</text>";
    g += '<text x="' + ((L + W - Rr) / 2) + '" y="' + (H - 2) + '" text-anchor="middle" font-size="10" fill="' + GRAFITE + '">ponto da partida</text>';
    if (n <= 260) for (i = 1; i <= n; i++) g += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(saldo[i]).toFixed(1) + '" r="1.7" fill="' + (pts[i - 1].nos ? AZUL : LARANJA) + '"><title>Ponto ' + i + (pts[i - 1].nos ? ": ganho" : ": perdido") + " · saldo " + (saldo[i] > 0 ? "+" : "") + saldo[i] + "</title></circle>";
    var top = 0, bot = 0, itop = 0, ibot = 0; for (i = 1; i <= n; i++) { if (saldo[i] > top) { top = saldo[i]; itop = i; } if (saldo[i] < bot) { bot = saldo[i]; ibot = i; } }
    var notas = [];
    if (melhor.len >= 3) notas.push('<span><i style="background:' + AZUL + '"></i>Melhor sequência: <b>' + melhor.len + " pontos seguidos</b> (pontos " + (melhor.ini + 1) + " a " + (melhor.ini + melhor.len) + ")</span>");
    if (pior.len >= 3) notas.push('<span><i style="background:' + LARANJA + '"></i>Pior sequência: <b>' + pior.len + " pontos seguidos</b> (pontos " + (pior.ini + 1) + " a " + (pior.ini + pior.len) + ")</span>");
    if (top > 0) notas.push("<span>Maior vantagem: <b>+" + top + "</b> no ponto " + itop + "</span>");
    if (bot < 0) notas.push("<span>Maior desvantagem: <b>" + bot + "</b> no ponto " + ibot + "</span>");
    return '<p class="mudo">Saldo acumulado de pontos de ' + esc(atleta) + " (ganhos menos perdidos). Acima da linha do zero, o atleta lidera o jogo; as linhas tracejadas marcam o início de cada set.</p>" +
      '<svg class="xy" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Momentum do jogo ponto a ponto">' + g + '</svg><p class="leg">' + notas.join("") + "</p>";
  }
  function gerarPartida(o) {
    var atleta = String(o.atleta || "Atleta"), r = o.reg || {}, s = r.scout || {}, M = o.metricas || [], leitura = o.leitura || function () { return []; };
    var ant = (o.anteriores || []).filter(function (x) { return x && x.scout; });
    var d = (o.detalheDe || function (x) { return x.scout.detalhe || null; })(r);
    function val(k, reg) { var m = M.filter(function (x) { return x.k === k; })[0]; if (!m) return null; var v = m.get((reg || r).scout); return typeof v === "number" && isFinite(v) ? v : null; }
    function fmt(v, suf) { return v === null ? "—" : r1(v) + (suf || ""); }
    var ctx = [r.torneio && r.torneio !== "jogo-treino" ? r.torneio : "Jogo-treino", r.adversario && r.adversario !== "—" ? "contra " + r.adversario : "", NIVEL[r.nivelAdversario] ? "adversário " + NIVEL[r.nivelAdversario].toLowerCase() : "", dataBR(r.data)].filter(Boolean);
    var concl = r.concluida !== false && !!(r.concluida || /\d-\d/.test(String(r.resultado || "")) && r.resultado !== "não concluído");
    var res = r.resultado && r.resultado !== "—" && r.resultado !== "não concluído" ? r.resultado : "", parcialHtml = "";
    /* placar refeito a partir dos pontos (o app envia em o.placarFinal): sets concluídos, set em andamento e game em andamento */
    var pf = o.placarFinal;
    if (pf && pf.sets) {
      res = pf.sets.map(function (x) { return x[0] + "–" + x[1]; }).join(", ");
      if (!pf.fim) {
        var gA = pf.games ? n0(pf.games[0]) : 0, gB = pf.games ? n0(pf.games[1]) : 0, temSet = gA + gB > 0 || !!pf.pontos;
        parcialHtml = '<div class="parcial"><div><small>Sets concluídos</small><b>' + (pf.sets.length ? esc(res) : "nenhum") + "</b></div>" +
          (temSet ? "<div><small>" + (pf.sets.length + 1) + "º set (em andamento)</small><b>" + gA + "–" + gB + " em games</b></div>" : "") +
          (pf.pontos ? "<div><small>Game em andamento</small><b>" + esc(String(pf.pontos).replace("-", "–")) + "</b></div>" : "") + "</div>";
      }
    }
    var parcial = !concl, enc = r.encerramento, motivoTxt = "";
    if (enc && enc.motivo) {
      var ROT_MOTIVO = { adversario_desistiu: "Adversário desistiu", atleta_desistiu: "Jogador desistiu", medico: "Motivo médico", desclassificacao: "Desclassificação", outro: "Outro motivo", nao_informado: "Motivo não informado" };
      motivoTxt = (ROT_MOTIVO[enc.motivo] || "Motivo informado") + (enc.motivo !== "nao_informado" ? (enc.de === "atleta" ? " (do jogador)" : enc.de === "adversario" ? " (do adversário)" : "") + (enc.detalhe ? ": " + enc.detalhe : "") : "");
    }
    /* TODAS as contagens partem dos mesmos pontos registrados; sem os pontos, o relatório usa o resumo e marca o que não foi registrado */
    var pts = (s.pontos || []).filter(function (p) { return p && typeof p === "object"; }), temPts = pts.length > 0;
    var pg = n0(s.pctGanhos);
    function cnt(l, f) { return l.filter(f).length; }
    function razao(x, n) { if (!n) return { v: null, t: "sem pontos registrados" }; var p = x * 100 / n; return { v: p, t: x + " de " + n + (n < 5 ? " (base pequena)" : " · " + Math.round(p) + "%") }; }
    var meus = temPts ? pts.filter(function (p) { return p.sacador === "nos"; }) : [], marc = meus.filter(function (p) { return p.saque === "1" || p.saque === "2" || p.saque === "df"; });
    var nMarc = temPts ? marc.length : n0(s.saquesMarcados), nPrim = temPts ? cnt(marc, function (p) { return p.saque === "1"; }) : n0(s.primeirosDentro);
    var dfN = temPts ? cnt(meus, function (p) { return p.saque === "df"; }) : (s.df == null ? null : n0(s.df)), acesN = temPts ? cnt(meus, function (p) { return p.saque === "ace"; }) : (s.aces == null ? null : n0(s.aces));
    var adv = temPts ? pts.filter(function (p) { return p.adverso; }) : [], nAdv = temPts ? adv.length : null, gAdv = temPts ? cnt(adv, function (p) { return p.nos; }) : null;
    var eNos = n0(s.errosNos), eDec = n0(s.errosDecisao), eExe = n0(s.errosExec), eCls = eDec + eExe, eSem = Math.max(0, eNos - eCls);
    var prim = nMarc >= 5 ? nPrim * 100 / nMarc : null, df = dfN, aces = acesN, pa = nAdv >= 5 ? gAdv * 100 / nAdv : null;
    function card(t, corpo, cls) { return '<section class="sec ' + (cls || "") + '"><h2>' + esc(t) + "</h2>" + corpo + "</section>"; }
    function kpi(n, t, sub) { return '<div class="kp"><b>' + esc(n) + "</b><span>" + esc(t) + "</span>" + (sub ? "<small>" + esc(sub) + "</small>" : "") + "</div>"; }

    var h = '<header class="capa"><div class="capa-t"><span class="eyebrow">' + (parcial ? "Relatório parcial da partida" : "Relatório da partida") + '</span><span class="gera">gerado em ' + esc(o.geradoEm || "") + "</span></div>" +
      "<h1>" + esc(atleta) + '</h1><p class="ctx">' + esc(ctx.join(" · ")) + '</p>' +
      (parcial ? '<div class="pl"><span class="selo int">Acompanhamento interrompido. Resultado final não registrado.</span></div>' + (motivoTxt ? '<p class="motivo">Motivo informado: <b>' + esc(motivoTxt) + "</b></p>" : "") + (parcialHtml || (res ? '<div class="parcial"><div><small>Resultado registrado até a interrupção</small><b>' + esc(res) + "</b></div></div>" : "")) :
        '<div class="pl">' + (res ? '<span class="res">' + esc(res) + "</span>" : "") + '<span class="selo ok">Partida concluída</span></div>') + "</header>";
    var kSaq = nMarc > 0 ? kpi(Math.round(nPrim * 100 / nMarc) + "%", "1º saque dentro", nPrim + " de " + nMarc + " saques marcados" + (dfN ? " · " + dfN + (dfN === 1 ? " dupla falta" : " duplas faltas") : "") + (acesN ? " · " + acesN + (acesN === 1 ? " ace" : " aces") : ""))
      : (!temPts && n0(s.pctPrimeiro) > 0 ? kpi(Math.round(n0(s.pctPrimeiro)) + "%", "1º saque dentro", "contagem de saques não disponível neste registro") : kpi("não registrado", "1º saque dentro", "os saques não foram marcados neste jogo"));
    var kAdv = nAdv === null ? (val("pctAdversos") !== null ? kpi(Math.round(val("pctAdversos")) + "%", "ganhos sob pressão", "contagem não disponível neste registro") : kpi("não registrado", "ganhos sob pressão", "placar adverso não registrado"))
      : nAdv === 0 ? kpi("sem pontos", "ganhos sob pressão", "o atleta não esteve atrás no placar") : kpi(nAdv >= 5 ? Math.round(gAdv * 100 / nAdv) + "%" : gAdv + " de " + nAdv, "ganhos sob pressão", gAdv + " de " + nAdv + " pontos em placar adverso" + (nAdv < 5 ? " (base pequena)" : ""));
    h += '<div class="kps">' + kpi(Math.round(pg) + "%", "dos pontos ganhos", n0(s.ganhos) + " de " + n0(s.n) + " pontos") + kpi(eNos, "erros do atleta", eDec + " de decisão · " + eExe + " de execução" + (eSem > 0 ? " · " + eSem + " sem classificação" : "")) + kSaq + kAdv + "</div>";
    if (parcial) h += '<p class="escopo">Os indicadores consideram apenas os pontos registrados até a interrupção.</p>';

    /* leitura do jogo */
    var forte = [], atencao = [];
    /* as leituras automáticas do motor que repetem indicadores já calculados aqui, com a base explícita (1º saque, duplas faltas, decisão x execução), ficam de fora: evita números e bases diferentes no mesmo relatório */
    (leitura(s) || []).forEach(function (x) { if (!/decis|execu|primeiro saque|1º saque|dupla/i.test(String(x[1]))) atencao.push(x[1]); });
    if (prim !== null && prim >= 62) forte.push("1º saque consistente: " + nPrim + " de " + nMarc + " saques marcados dentro (" + r1(prim) + "%).");
    if (df !== null && nMarc >= 5 && df <= 1) forte.push("Controle do segundo saque: " + df + (df === 1 ? " dupla falta." : " duplas faltas."));
    if (pa !== null && pa >= 55) forte.push("Resiste à pressão: " + gAdv + " de " + nAdv + " pontos ganhos em placar adverso (" + r1(pa) + "%).");
    if (pg >= 60) forte.push("Domínio do placar: " + Math.round(pg) + "% dos pontos ganhos.");
    var pc = val("pctErrosCurtos"); if (pc !== null && pc <= 30 && eNos >= 4) forte.push("Poucos erros no início do ponto (" + r1(pc) + "% nas 4 primeiras bolas).");
    if (prim !== null && prim < 55) atencao.push("1º saque dentro em " + nPrim + " de " + nMarc + " saques marcados (" + r1(prim) + "%).");
    if (df !== null && df >= 3) atencao.push(df + " duplas faltas no jogo.");
    if (pa !== null && pa < 45) atencao.push("Cai sob pressão: " + gAdv + " de " + nAdv + " pontos ganhos em placar adverso (" + r1(pa) + "%).");
    if (eCls >= 6) { if (eDec > eExe * 1.3) atencao.push("Entre os " + eCls + " erros classificados, " + Math.round(eDec * 100 / eCls) + "% são de decisão (" + eDec + " de " + eCls + ")."); else if (eExe > eDec * 1.3) atencao.push("Entre os " + eCls + " erros classificados, " + Math.round(eExe * 100 / eCls) + "% são de execução (" + eExe + " de " + eCls + ")."); }
    if (eSem > 0) atencao.push(eSem + (eSem === 1 ? " erro ficou sem classificação (decisão ou execução)." : " erros ficaram sem classificação (decisão ou execução)."));
    function uniq(l) { var v = {}; return l.filter(function (t) { if (v[t]) return false; v[t] = 1; return true; }).slice(0, 5); }
    forte = uniq(forte); atencao = uniq(atencao);
    function lista(tit, cor, itens, vazio) { return '<div class="lei" style="border-top:3px solid ' + cor + '"><h3>' + esc(tit) + "</h3>" + (itens.length ? "<ul>" + itens.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>" : '<p class="mudo">' + esc(vazio) + "</p>") + "</div>"; }
    h += card("A leitura do jogo", '<div class="duas">' + lista("O que funcionou", AZUL, forte, "Sem destaque claro neste jogo.") + lista("O que pede atenção", LARANJA, atencao, "Nada fora do esperado nos indicadores coletados.") + "</div>");

    /* momentum ponto a ponto */
    var pontosJogo = (s.pontos || []).filter(function (p) { return p && typeof p === "object"; });
    if (pontosJogo.length >= 6) h += card("Momentum do jogo, ponto a ponto", momentoXY(pontosJogo, atleta));
    /* como o jogo se desenrolou */
    if (d && d.games && d.games.length > 1) h += card("Como o jogo se desenrolou", '<p class="mudo">Pontos ganhos em cada game (azul: o atleta ganhou mais da metade dos pontos do game).</p>' + pilhaGamesP(d.games));
    /* como os pontos terminaram */
    if (d && d.fins) {
      var fi = [{ nome: "Winner de " + atleta, v: d.fins.winner_nos, cor: AZUL }, { nome: "Erro do adversário", v: d.fins.erro_dele, cor: AZUL_CL }, { nome: "Erro de " + atleta, v: d.fins.erro_nos, cor: LARANJA }, { nome: "Winner do adversário", v: d.fins.winner_dele, cor: LARANJA_CL }], tf = fi.reduce(function (t, x) { return t + n0(x.v); }, 0);
      if (tf) {
        var somaArr = fi.reduce(function (t, x) { return t + Math.round(n0(x.v) * 100 / tf); }, 0), gan = n0(d.fins.winner_nos) + n0(d.fins.erro_dele), per = n0(d.fins.erro_nos) + n0(d.fins.winner_dele);
        h += card("Como os pontos terminaram", pilha100(fi) + '<div class="fins">' + fi.map(function (x) { return '<div><i style="background:' + x.cor + '"></i><b>' + n0(x.v) + "</b> " + esc(x.nome) + " <small>" + n0(x.v) + " de " + tf + " · " + Math.round(n0(x.v) * 100 / tf) + "%</small></div>"; }).join("") + "</div>" +
          '<p class="mudo">Pontos ganhos: ' + gan + " (" + n0(d.fins.winner_nos) + " winners + " + n0(d.fins.erro_dele) + " erros do adversário) · Pontos perdidos: " + per + " (" + n0(d.fins.erro_nos) + " erros + " + n0(d.fins.winner_dele) + " winners do adversário) · Total: " + tf + " pontos." +
          (n0(s.n) && tf !== n0(s.n) ? " Atenção: os encerramentos registrados somam " + tf + " de " + n0(s.n) + " pontos." : "") + (somaArr !== 100 ? " Percentuais arredondados: a soma pode não ser exatamente 100%." : "") + "</p>");
      }
    }
    /* saque e devolução */
    var sq = "", dv = "";
    function linha(rot, x, n, cor, det) { var q = razao(x, n); return barraH(rot, det || "", q.v === null ? 0 : q.v, 100, cor, q.t); }
    function lado(lista, l) { return lista.filter(function (p) { return p.lado === l; }); }
    if (temPts) {
      var dele = pts.filter(function (p) { return p.sacador === "ele"; });
      sq += nMarc > 0 ? linha("1º saque dentro", nPrim, nMarc, AZUL, "entre os saques marcados") : barraH("1º saque dentro", "", 0, 100, AZUL, "não registrado");
      [["D", "igualdade"], ["E", "vantagem"]].forEach(function (k) { var l = lado(meus, k[0]); sq += linha("Pontos ganhos no meu saque · " + k[1], cnt(l, function (p) { return p.nos; }), l.length, AZUL); dv += linha("Pontos ganhos no saque dele · " + k[1], cnt(lado(dele, k[0]), function (p) { return p.nos; }), lado(dele, k[0]).length, AZUL_CL); });
      sq += '<p class="mudo">' + (nMarc > 0 || dfN || acesN ? "Duplas faltas: <b>" + n0(dfN) + "</b> · Aces: <b>" + n0(acesN) + "</b>. Já estão contados nos pontos perdidos e ganhos, não são somados de novo." : "Duplas faltas e aces: não registrados neste jogo.") + "</p>";
      if (d && d.devolucao) dv += linha("Erros de devolução", n0(d.devolucao.nos.e), n0(d.devolucao.nos.n), LARANJA, "pontos no saque dele");
    } else {
      if (val("pctPrimeiro") !== null) sq += barraH("1º saque dentro", "", val("pctPrimeiro"), 100, AZUL, r1(val("pctPrimeiro")) + "% (contagem não disponível)");
      [["pctSacD", "Pontos ganhos no meu saque · igualdade"], ["pctSacE", "Pontos ganhos no meu saque · vantagem"]].forEach(function (p) { var v = val(p[0]); sq += v !== null ? barraH(p[1], "", v, 100, AZUL, r1(v) + "%") : barraH(p[1], "", 0, 100, AZUL, "não registrado"); });
      [["pctDevD", "Pontos ganhos no saque dele · igualdade"], ["pctDevE", "Pontos ganhos no saque dele · vantagem"]].forEach(function (p) { var v = val(p[0]); dv += v !== null ? barraH(p[1], "", v, 100, AZUL_CL, r1(v) + "%") : barraH(p[1], "", 0, 100, AZUL_CL, "não registrado"); });
    }
    if (sq || dv) h += card("Saque e devolução", '<div class="duas"><div class="cx"><h3>Meu saque</h3>' + (sq || '<p class="mudo">Sem dados de saque.</p>') + '</div><div class="cx"><h3>Devolução</h3>' + (dv || '<p class="mudo">Sem dados de devolução.</p>') + "</div></div>");
    /* onde o ponto se decide + decisão x execução */
    var nc = n0(s.curtos), nm = n0(s.medios), nl = n0(s.longos), nb = nc + nm + nl, meio = "";
    if (nb > 0) {
      var rb = [Math.round(nc * 100 / nb), Math.round(nm * 100 / nb), Math.round(nl * 100 / nb)];
      meio += '<div class="cx"><h3>Onde o ponto se decidiu</h3>' + pilha100([{ nome: "1–4 bolas", v: nc, cor: AZUL }, { nome: "5–9 bolas", v: nm, cor: AZUL_CL }, { nome: "10+ bolas", v: nl, cor: CINZA }]) +
        leg([["1–4 bolas · " + nc + " de " + nb + " · " + rb[0] + "%", AZUL], ["5–9 bolas · " + nm + " de " + nb + " · " + rb[1] + "%", AZUL_CL], ["10+ bolas · " + nl + " de " + nb + " · " + rb[2] + "%", CINZA]]) +
        '<p class="mudo">Cerca de 70% dos pontos do circuito terminam em até quatro bolas.' + (rb[0] + rb[1] + rb[2] !== 100 ? " Percentuais arredondados." : "") + (n0(s.n) && nb !== n0(s.n) ? " " + (n0(s.n) - nb) + " pontos sem número de bolas registrado." : "") + "</p></div>";
    }
    if (eNos > 0) {
      meio += '<div class="cx"><h3>Erros: decisão ou execução</h3>' + pilha100([{ nome: "Decisão", v: eDec, cor: LARANJA }, { nome: "Execução", v: eExe, cor: LARANJA_CL }, { nome: "Sem classificação", v: eSem, cor: CINZA }]) +
        leg([["Decisão " + eDec, LARANJA], ["Execução " + eExe, LARANJA_CL]].concat(eSem > 0 ? [["Sem classificação " + eSem, CINZA]] : [])) + '<p class="mudo" style="margin:2px 0">A barra mostra a parte de cada tipo entre os ' + eNos + " erros.</p>" +
        '<p class="mudo"><b>' + eNos + " erros:</b> " + eDec + " de decisão, " + eExe + " de execução" + (eSem > 0 ? " e " + eSem + " sem classificação" : "") + "." + (eCls > 0 ? " Entre os " + eCls + " erros classificados: " + Math.round(eDec * 100 / eCls) + "% de decisão e " + Math.round(eExe * 100 / eCls) + "% de execução." : " Nenhum erro foi classificado.") + (eCls > 0 && Math.round(eDec * 100 / eCls) + Math.round(eExe * 100 / eCls) !== 100 ? " Percentuais arredondados." : "") + "</p></div>";
    }
    if (meio) h += card("Padrões do jogo", '<div class="duas">' + meio + "</div>");


    /* comparação com os jogos anteriores */
    if (ant.length) {
      var linhasC = [["pctGanhos", "Pontos ganhos", "%", true], ["pctPrimeiro", "1º saque dentro", "%", true], ["errosNos", "Erros do atleta", "", false], ["df", "Duplas faltas", "", false], ["pctErrosCurtos", "Erros em até 4 bolas", "%", false], ["pctAdversos", "Ganhos sob pressão", "%", true]];
      var tr = linhasC.map(function (l) {
        var v = val(l[0]), outros = ant.map(function (x) { return val(l[0], x); }).filter(function (x) { return x !== null; }); if (v === null || !outros.length) return "";
        var m = media(outros), dif = v - m, bom = Math.abs(dif) < 0.5 ? null : (l[3] ? dif > 0 : dif < 0);
        return "<tr><td>" + esc(l[1]) + "</td><td><b>" + fmt(v, l[2]) + "</b></td><td>" + fmt(m, l[2]) + '</td><td class="' + (bom === null ? "" : bom ? "bom" : "ruim") + '">' + (bom === null ? "= estável" : (dif > 0 ? "▲ +" : "▼ ") + r1(dif) + (l[2] ? " p.p." : "")) + "</td></tr>";
      }).join("");
      if (tr) h += card("Em relação aos jogos anteriores", '<p class="mudo">Média dos ' + ant.length + (ant.length === 1 ? " jogo anterior" : " jogos anteriores") + ' com scout. Um jogo é uma amostra: três jogos na mesma direção são um sinal.</p><table class="cp"><thead><tr><th>Medida</th><th>Este jogo</th><th>Média anterior</th><th>Diferença</th></tr></thead><tbody>' + tr + "</tbody></table>");
    }
    /* mental */
    var mt = r.mental || {};
    function mm(bloco) { var m = mt[bloco]; if (!m) return null; var v = ["conf", "foco", "energia", "calma"].map(function (k) { return n0(m[k]); }).filter(function (x) { return x > 0; }); return v.length ? media(v) : null; }
    var ma = mm("antes"), md = mm("depois");
    if (ma !== null || md !== null) h += card("Estado mental", '<div class="kps k2">' + kpi(fmt(ma), "antes do jogo", "média de 1 a 5") + kpi(fmt(md), "depois do jogo", "média de 1 a 5") + "</div>");
    /* próximo treino + observação */
    var prox = atencao.slice(0, 3);
    if (prox.length || r.observacaoFinal) h += card("Para o próximo treino", (prox.length ? "<ul class=\"prox\">" + prox.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>" : "") + (r.observacaoFinal ? "<blockquote>" + esc(r.observacaoFinal) + '<footer>Observação do treinador</footer></blockquote>' : ""));

    var CSSP = "@page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:-apple-system,system-ui,'Segoe UI',Roboto,sans-serif;color:" + TINTA + ";max-width:860px;margin:0 auto;padding:20px 18px 36px;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#fff}" +
      ".capa{background:" + MARCA + ";color:#fff;border-radius:18px;padding:22px 26px 24px;margin-bottom:16px;border-bottom:5px solid #69B32A}.capa-t{display:flex;justify-content:space-between;align-items:center;font-size:11px;letter-spacing:.16em;text-transform:uppercase;opacity:.85}.eyebrow{font-weight:800;color:#9BD65B}.capa h1{font-size:34px;line-height:1.1;margin:14px 0 4px;letter-spacing:-.02em}.ctx{margin:0;font-size:14px;opacity:.88}.pl{display:flex;align-items:center;gap:14px;margin-top:16px;flex-wrap:wrap}.parcial{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}.parcial>div{background:rgba(255,255,255,.1);border-radius:12px;padding:9px 14px}.parcial small{display:block;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;opacity:.8}.parcial b{font-size:18px}.motivo{margin:10px 0 0;font-size:13.5px;color:#E6F3D6}.escopo{font-size:12px;color:#5B6B63;margin:6px 2px 0;font-style:italic}.res{font-size:30px;font-weight:800;letter-spacing:.02em;font-variant-numeric:tabular-nums}.selo{font-size:11.5px;font-weight:700;padding:5px 12px;border-radius:999px;background:rgba(255,255,255,.14)}.selo.ok{background:#69B32A;color:#0B2A24}" +
      ".kps{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:6px}.kps.k2{grid-template-columns:repeat(2,1fr)}.kp{border:1px solid " + LINHA + ";border-radius:14px;padding:13px 14px;background:#F6F8F7;break-inside:avoid}.kp b{display:block;font-size:28px;line-height:1.05;color:" + MARCA + ";letter-spacing:-.02em}.kp span{display:block;font-size:12.5px;font-weight:600;margin-top:3px}.kp small{display:block;font-size:11px;color:" + GRAFITE + ";margin-top:2px}" +
      ".xy{width:100%;height:auto;display:block}.sec{margin-top:22px;break-inside:avoid}.sec h2{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:" + MARCA + ";margin:0 0 10px;padding-bottom:6px;border-bottom:1px solid " + LINHA + ";display:flex;align-items:center;gap:8px}.sec h2:before{content:'';width:8px;height:8px;border-radius:2px;background:#69B32A}h3{font-size:13.5px;margin:0 0 8px}.mudo{color:" + GRAFITE + ";font-size:12px;margin:4px 0 8px}" +
      ".duas{display:grid;grid-template-columns:1fr 1fr;gap:12px}.lei,.cx{border:1px solid " + LINHA + ";border-radius:14px;padding:12px 14px;break-inside:avoid}.lei ul{margin:0;padding-left:18px;font-size:13px}.lei li{margin:4px 0}" +
      ".leg{display:flex;flex-wrap:wrap;gap:3px 12px;margin:6px 0 0;font-size:11px;color:" + GRAFITE + "}.leg i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:4px}.pilha{display:flex;height:22px;border-radius:7px;overflow:hidden;gap:2px;margin:6px 0}.pilha b{color:#fff;font-size:10.5px;display:flex;align-items:center;justify-content:center;min-width:0}" +
      ".fins{display:grid;grid-template-columns:1fr 1fr;gap:6px 14px;margin-top:8px;font-size:12.5px}.fins i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px}.fins small{color:" + GRAFITE + "}" +
      ".bh{display:grid;grid-template-columns:44% 1fr auto;gap:8px;align-items:center;margin:8px 0;font-size:12px}.bh-r small{display:block;color:" + GRAFITE + ";font-size:10.5px}.bh-t{height:11px;background:#EDF1EF;border-radius:6px;overflow:hidden}.bh-t>div{height:100%;border-radius:0 6px 6px 0}.bh-v{font-weight:700;font-variant-numeric:tabular-nums}" +
      ".gms{display:grid;grid-template-columns:repeat(auto-fill,minmax(30px,1fr));gap:6px 5px;align-items:end}.gm{text-align:center;font-size:10px;color:" + GRAFITE + "}.gms.mini .gm small{display:none}.gm-b{height:70px;background:#EDF1EF;border-radius:5px;display:flex;align-items:flex-end;overflow:hidden}.gm-b i{display:block;width:100%}.gm small{display:block;color:" + TINTA + ";font-weight:700;font-size:10px}" +
      "table.cp{width:100%;border-collapse:collapse;font-size:12.5px;font-variant-numeric:tabular-nums}.cp th{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:" + GRAFITE + ";text-align:center;padding:6px}.cp td{border-top:1px solid " + LINHA + ";padding:8px 6px;text-align:center}.cp td:first-child,.cp th:first-child{text-align:left}.cp .bom{color:" + AZUL + ";font-weight:700}.cp .ruim{color:" + LARANJA + ";font-weight:700}" +
      ".prox{margin:0;padding-left:18px;font-size:13.5px}.prox li{margin:5px 0}blockquote{margin:12px 0 0;padding:10px 16px;border-left:4px solid #69B32A;background:#F6F8F7;border-radius:0 10px 10px 0;font-size:13.5px}blockquote footer{font-size:11px;color:" + GRAFITE + ";margin-top:4px;letter-spacing:.06em;text-transform:uppercase}" +
      ".no-print{margin-bottom:14px;display:flex;gap:10px}.no-print button{padding:10px 16px;font-weight:700;cursor:pointer;border-radius:10px;border:1px solid " + MARCA + ";background:" + MARCA + ";color:#fff}.no-print button+button{background:#fff;color:" + MARCA + "}.rodape{margin-top:26px;padding-top:10px;border-top:1px solid " + LINHA + ";font-size:11px;color:" + GRAFITE + "}.marca{margin-bottom:10px}" +
      "@media(max-width:700px){.kps{grid-template-columns:1fr 1fr}.duas{grid-template-columns:1fr}.capa h1{font-size:28px}}@media print{.no-print{display:none}.kps{grid-template-columns:repeat(4,1fr)}.duas{grid-template-columns:1fr 1fr}}";
    function pilhaGamesP(gs) { return '<div class="gms' + (gs.length > 12 ? " mini" : "") + '">' + gs.map(function (x) { var p = pct(x.g, x.n); return '<div class="gm"><div class="gm-b" title="Game ' + x.j + ": " + x.g + " de " + x.n + ' pontos"><i style="height:' + p + "%;background:" + (p >= 50 ? AZUL : LARANJA) + '"></i></div><span>' + x.j + "</span><small>" + p + "%</small></div>"; }).join("") + "</div>" + (gs.length > 12 ? '<p class="mudo">Cada barra é um game (número abaixo); passe o dedo ou o mouse sobre a barra para ver os pontos.</p>' : ""); }
    return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + (parcial ? "Relatório parcial da partida" : "Relatório da partida") + ' · ' + esc(atleta) + "</title><style>" + CSSP + "</style></head><body>" +
      '<div class="no-print"><button onclick="window.print()">Salvar como PDF / Imprimir</button><button onclick="window.close()">Fechar</button></div>' + (o.cabecalhoHtml ? '<div class="marca">' + o.cabecalhoHtml + "</div>" : "") + h +
      '<p class="rodape">Um jogo é uma amostra: o resultado não muda a rota do plano, quem muda a rota é o padrão que se repete. Os números vêm dos pontos marcados pelo treinador; medidas que o jogo não registrou ficam de fora. Análise gerada com a Tecnologia QuadraLab.</p></body></html>';
  }
  var api = { gerar: gerar, gerarPartida: gerarPartida, esc: esc };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else raiz.QLRelatorioJogos = api;
})(typeof window !== "undefined" ? window : this);
