/* Pernas e golpes · Tecnologia QuadraLab. Funções puras (Node e navegador).
   A partir dos pontos do scout montado do vídeo (scout/video-scout.js: p.batidas com t, quem, golpe, vel, profundidade, e p.mov
   com o rastro dos pés de cada jogador na quadra, em metros, ~10 por segundo) mede, para o jogador e para o adversário:
   · pernas: distância percorrida (no jogo e por ponto), velocidade máxima e média em deslocamento, arrancadas, primeiro passo
     depois do golpe do adversário (reação), se estava parado e pronto quando o adversário bateu, quanto ficou longe do centro
     na hora do golpe dele (recuperação), velocidade de chegada na bola e mapa de onde ficou na quadra;
   · golpes: quantos de cada (saque, forehand, backhand, voleio, smash), a velocidade da bola por golpe, a profundidade e a
     duração dos ralis.
   Quadra: x lateral, y longitudinal (0 na rede); cada jogador é virado para o próprio lado (y < 0) antes de medir.
   QLPernasGolpes.analisar(pontos) → resultado · .html(resultado, { A, B }) → HTML · .resumo(resultado) → números do jogo (histórico)
   .movimento(rastro) → { pts: [{ t, x, y, v }], dist, vmax } */
(function (raiz, fab) {
  var api = fab();
  if (typeof module === "object" && module.exports) module.exports = api; else raiz.QLPernasGolpes = api;
})(typeof window !== "undefined" ? window : this, function () {
  var MEIO = 23.77 / 2, VMAX = 9; // m/s: acima disso é salto da detecção, não corrida
  var V_PARADO = 1.2, V_PASSO = 1.8, V_ARRANCADA = 4.5;
  var CURTO = { saque: "Saque", forehand: "Forehand", backhand: "Backhand", voleio: "Voleio", smash: "Smash", devolucao: "Devolução" };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function media(l) { return l.length ? l.reduce(function (s, v) { return s + v; }, 0) / l.length : null; }
  function r1(v) { return v == null || !isFinite(v) ? null : Math.round(v * 10) / 10; }
  function num(v, d) { if (v == null || !isFinite(v)) return "—"; return (d ? v.toFixed(d) : String(Math.round(v))).replace(".", ","); }

  /* ── rastro → posições suavizadas com velocidade ── */
  function movimento(rastro) {
    var l = (rastro || []).filter(function (p) { return p && isFinite(p[0]) && isFinite(p[1]) && isFinite(p[2]); }).map(function (p) { return { t: p[0], x: p[1], y: p[2] }; });
    if (!l.length) return { pts: [], dist: 0, vmax: null };
    /* lado do jogador: vira para y < 0 */
    var my = media(l.map(function (p) { return p.y; }));
    if (my > 0) l.forEach(function (p) { p.x = -p.x; p.y = -p.y; });
    /* trechos contínuos (buraco > 0,45 s quebra) */
    var trechos = [[l[0]]];
    for (var i = 1; i < l.length; i++) { if (l[i].t - l[i - 1].t > 0.45) trechos.push([]); trechos[trechos.length - 1].push(l[i]); }
    var pts = [], dist = 0, vmax = 0;
    trechos.forEach(function (tr) {
      /* mediana de 3 (tira pulos isolados) e média de 3 */
      var m = tr.map(function (p, k) { var a = tr[Math.max(0, k - 1)], b = tr[Math.min(tr.length - 1, k + 1)]; return { t: p.t, x: med3(a.x, p.x, b.x), y: med3(a.y, p.y, b.y) }; });
      var s = m.map(function (p, k) { var a = m[Math.max(0, k - 1)], b = m[Math.min(m.length - 1, k + 1)]; return { t: p.t, x: (a.x + p.x + b.x) / 3, y: (a.y + p.y + b.y) / 3 }; });
      s.forEach(function (p, k) {
        var a = s[Math.max(0, k - 2)], b = s[Math.min(s.length - 1, k + 2)], dt = b.t - a.t;
        p.v = dt > 0.05 ? Math.hypot(b.x - a.x, b.y - a.y) / dt : 0;
        if (p.v > VMAX) p.v = null; // detecção pulou
        if (k) { var d = Math.hypot(p.x - s[k - 1].x, p.y - s[k - 1].y), dd = p.t - s[k - 1].t; if (dd > 0 && d / dd <= VMAX && d / dd >= 0.35) dist += d; }
        if (p.v != null && p.v > vmax) vmax = p.v;
        pts.push(p);
      });
    });
    return { pts: pts, dist: dist, vmax: pts.length > 3 ? vmax : null };
  }
  function med3(a, b, c) { return Math.max(Math.min(a, b), Math.min(Math.max(a, b), c)); }
  function noTempo(pts, t, tol) { var m = null, d = tol == null ? 0.16 : tol; pts.forEach(function (p) { var x = Math.abs(p.t - t); if (x <= d) { d = x; m = p; } }); return m; }

  /* ── análise do jogo ── */
  function lado() { return { pontos: 0, comRastro: 0, dist: 0, distPts: [], vmax: null, vMov: [], arrancadas: 0, reacoes: [], prontos: 0, golpesAdv: 0, centro: [], chegada: [], naCorrida: 0, batidas: 0,
    golpes: {}, vel: {}, prof: {}, calor: [] }; }
  function analisar(pontos) {
    var R = { nos: lado(), ele: lado(), ralis: [], comMov: 0, comBatidas: 0, pontos: (pontos || []).length };
    (pontos || []).forEach(function (p, ip) {
      var bats = (p.batidas || []).filter(function (b) { return b && (b.quem === "nos" || b.quem === "ele"); });
      if (bats.length) { R.comBatidas++; R.ralis.push({ n: p.n || ip + 1, bolas: bats.length, nos: !!p.nos }); }
      var movs = { nos: movimento(p.mov && p.mov.nos), ele: movimento(p.mov && p.mov.ele) };
      if (movs.nos.pts.length || movs.ele.pts.length) R.comMov++;
      ["nos", "ele"].forEach(function (q) {
        var L = R[q], M = movs[q], outro = q === "nos" ? "ele" : "nos";
        L.pontos++;
        /* golpes */
        bats.forEach(function (b) {
          if (b.quem !== q) return;
          var g = b.golpe || "?"; L.batidas++;
          L.golpes[g] = (L.golpes[g] || 0) + 1;
          if (b.vel && b.vel > 20 && b.vel < 260) (L.vel[g] = L.vel[g] || []).push(b.vel);
          if (b.profundidade) { var pr = L.prof[g] = L.prof[g] || { funda: 0, media: 0, curta: 0 }; pr[b.profundidade] = (pr[b.profundidade] || 0) + 1; }
          if (b.corrida) L.naCorrida++;
        });
        if (M.pts.length < 6) return;
        L.comRastro++;
        L.dist += M.dist; L.distPts.push({ n: p.n || ip + 1, d: M.dist });
        if (M.vmax != null && (L.vmax == null || M.vmax > L.vmax)) L.vmax = M.vmax;
        var emMov = false;
        M.pts.forEach(function (pt) {
          if (pt.v != null && pt.v >= V_PASSO) L.vMov.push(pt.v);
          if (pt.v != null && pt.v >= V_ARRANCADA && !emMov) { L.arrancadas++; emMov = true; } else if (pt.v != null && pt.v < V_PASSO) emMov = false;
          L.calor.push([pt.x, pt.y]);
        });
        /* golpes do adversário: estava pronto? quando deu o primeiro passo? onde estava em relação ao centro? */
        bats.forEach(function (b, k) {
          if (b.quem !== outro) return;
          var a = noTempo(M.pts, b.t); if (!a || a.v == null) return;
          L.golpesAdv++;
          var pronto = a.v < V_PARADO; if (pronto) L.prontos++;
          if (pronto) {
            var lim = b.t + 1.2, prox = bats[k + 1] ? Math.min(lim, bats[k + 1].t) : lim;
            for (var j = 0; j < M.pts.length; j++) { var pp = M.pts[j]; if (pp.t > b.t + 0.05 && pp.t <= prox && pp.v != null && pp.v >= V_PASSO) { L.reacoes.push(pp.t - b.t); break; } }
          }
          if (a.y < -8 && k > 0) L.centro.push(Math.abs(a.x)); // no fundo: distância lateral do centro quando o adversário bate
        });
        /* chegada na bola: velocidade média no meio segundo antes de bater */
        bats.forEach(function (b, k) {
          if (b.quem !== q || k === 0) return;
          var vs = M.pts.filter(function (pt) { return pt.t >= b.t - 0.5 && pt.t <= b.t - 0.05 && pt.v != null; }).map(function (pt) { return pt.v; });
          if (vs.length >= 2) L.chegada.push(media(vs));
        });
      });
    });
    ["nos", "ele"].forEach(function (q) {
      var L = R[q];
      L.distPonto = L.comRastro ? L.dist / L.comRastro : null;
      L.vMedia = media(L.vMov);
      L.reacao = L.reacoes.length >= 3 ? media(L.reacoes) : null;
      L.pctPronto = L.golpesAdv >= 5 ? Math.round(L.prontos / L.golpesAdv * 100) : null;
      L.distCentro = L.centro.length >= 3 ? media(L.centro) : null;
      L.vChegada = L.chegada.length >= 3 ? media(L.chegada) : null;
      L.velMedia = {}; L.velMax = {};
      /* velocidade da bola: tira os voos mal reconstruídos (longe da mediana do golpe) antes da média e da máxima */
      Object.keys(L.vel).forEach(function (g) {
        var v = L.vel[g].slice().sort(function (a, b) { return a - b; }), md = v[Math.floor(v.length / 2)];
        if (v.length >= 3) v = v.filter(function (x) { return x >= md * 0.6 && x <= md * 1.45; });
        L.velMedia[g] = Math.round(media(v)); L.velMax[g] = Math.max.apply(null, v);
      });
      L.mapa = mapa(L.calor); delete L.calor;
    });
    R.bolasMedia = R.ralis.length ? media(R.ralis.map(function (x) { return x.bolas; })) : null;
    R.maisLongo = R.ralis.reduce(function (m, x) { return !m || x.bolas > m.bolas ? x : m; }, null);
    R.faixas = [["1–2", 1, 2], ["3–4", 3, 4], ["5–6", 5, 6], ["7–9", 7, 9], ["10+", 10, 999]].map(function (f) {
      var l = R.ralis.filter(function (x) { return x.bolas >= f[1] && x.bolas <= f[2]; });
      return { faixa: f[0], n: l.length, ganhos: l.filter(function (x) { return x.nos; }).length };
    });
    return R;
  }
  /* mapa de calor do próprio lado: 7 colunas (2 m) × 6 faixas (de 4 m atrás da linha de base até a rede) */
  var MX = [-7, 7], MY = [-MEIO - 4.5, 0], NC = 7, NL = 6;
  function mapa(pos) {
    var c = []; for (var i = 0; i < NL * NC; i++) c.push(0);
    var n = 0;
    pos.forEach(function (p) {
      var cx = Math.floor((p[0] - MX[0]) / (MX[1] - MX[0]) * NC), cy = Math.floor((p[1] - MY[0]) / (MY[1] - MY[0]) * NL);
      if (cx < 0 || cx >= NC || cy < 0 || cy >= NL) return;
      c[cy * NC + cx]++; n++;
    });
    return n ? { n: n, c: c.map(function (v) { return Math.round(v / n * 1000) / 1000; }) } : null;
  }

  /* números do jogo para o histórico (comparação entre jogos) */
  function resumo(R) {
    var A = R.nos, v = function (g) { return A.velMedia[g] || null; };
    return { distPonto: r1(A.distPonto), vmaxKmh: A.vmax == null ? null : Math.round(A.vmax * 3.6), reacao: A.reacao == null ? null : Math.round(A.reacao * 100) / 100,
      pctPronto: A.pctPronto, distCentro: r1(A.distCentro), velSaque: v("saque"), velFH: v("forehand"), velBH: v("backhand"),
      fh: A.golpes.forehand || 0, bh: A.golpes.backhand || 0 };
  }

  /* ── HTML ── */
  var COR = { nos: "#0B3B2E", ele: "#C65825" };
  function html(R, nomes) {
    nomes = nomes || {}; var A = nomes.A || "Jogador", B = nomes.B || "Adversário", nm = { nos: A, ele: B };
    if (!R || (!R.comMov && !R.comBatidas)) return '<p class="pg-msg">Os números de pernas e golpes aparecem quando o scout é montado a partir do vídeo, com os jogadores seguidos na quadra.</p>';
    var css = '<style>.pg{font-size:13.5px}.pg h4{margin:16px 0 6px;font-size:14px}.pg .pg-msg{font-size:12.5px;color:#5C6B78;margin:2px 0 8px}' +
      '.pg-leg{display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:#5C6B78;margin:4px 0 2px}.pg-leg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}' +
      '.pg-kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}.pg-k{border:1px solid #E2DED5;border-radius:12px;padding:10px 12px;background:#FBFAF7}.pg-k small{display:block;font-size:11.5px;color:#5C6B78;font-weight:600;line-height:1.3;min-height:30px}.pg-k .pg-a{display:block;font-size:22px;font-weight:800;color:#14202B;white-space:nowrap;margin-top:2px}.pg-k .pg-a u{text-decoration:none;font-size:13px;font-weight:700;color:#5C6B78;margin-left:3px}.pg-k .pg-o{display:block;font-size:12px;color:#5C6B78;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pg-k .pg-o i{font-style:normal;display:inline-block;width:8px;height:8px;border-radius:2px;background:#C65825;margin-right:5px}' +
      '.pg-barras{display:grid;gap:7px}.pg-linha{display:grid;grid-template-columns:96px 1fr;gap:10px;align-items:center}.pg-linha>span{font-size:12.5px;color:#14202B;font-weight:600}.pg-par{display:grid;gap:3px}.pg-bar{position:relative;height:16px;border-radius:0 4px 4px 0;min-width:2px}.pg-bar em{position:absolute;left:calc(100% + 6px);top:0;font-style:normal;font-size:11.5px;line-height:16px;color:#14202B;white-space:nowrap}' +
      '.pg-split{display:flex;height:22px;border-radius:6px;overflow:hidden;gap:2px;background:#fff}.pg-split div{display:flex;align-items:center;justify-content:center;color:#fff;font-size:11.5px;font-weight:700;min-width:0;overflow:hidden;white-space:nowrap}' +
      '.pg-mapas{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.pg-mapa figcaption{font-size:12.5px;font-weight:700;margin-top:4px}.pg-mapa svg{width:100%;max-width:220px;display:block}' +
      '.pg-cols{display:flex;gap:4px;align-items:flex-end;height:110px;border-bottom:1px solid #E2DED5;padding-top:14px}.pg-cols div{flex:1;position:relative;border-radius:4px 4px 0 0;min-height:2px;background:#0B3B2E}.pg-cols div em{position:absolute;bottom:calc(100% + 2px);left:0;right:0;text-align:center;font-style:normal;font-size:11px}.pg-cx{display:flex;gap:4px}.pg-cx span{flex:1;text-align:center;font-size:11px;color:#5C6B78}' +
      '.pg-nota{font-size:11.5px;color:#8A96A0;margin-top:12px}</style>';
    var leg = '<div class="pg-leg"><span><i style="background:' + COR.nos + '"></i>' + esc(A) + '</span><span><i style="background:' + COR.ele + '"></i>' + esc(B) + "</span></div>";
    var kpi = function (rot, f, dica) {
      var a = f(R.nos), b = f(R.ele);
      return '<div class="pg-k"' + (dica ? ' title="' + esc(dica) + '"' : "") + "><small>" + esc(rot) + '</small><span class="pg-a">' + a.v + (a.u ? "<u>" + a.u + "</u>" : "") + '</span><span class="pg-o"><i></i>' + esc(B) + " " + b.v + (b.u ? " " + b.u : "") + "</span></div>";
    };
    var val = function (v, d, suf) { return v == null ? { v: "—", u: "" } : { v: num(v, d), u: suf || "" }; };
    /* pernas */
    var pernas = R.comMov ? (
      "<h4>Pernas</h4>" + '<p class="pg-msg">Medido pelo rastro dos pés de cada jogador na quadra, em ' + R.nos.comRastro + " de " + R.pontos + " pontos. Em destaque, " + esc(A) + "; embaixo, " + esc(B) + ".</p>" +
      '<div class="pg-kpis">' +
      kpi("Distância no jogo", function (L) { return val(L.comRastro ? L.dist : null, 0, "m"); }) +
      kpi("Distância por ponto", function (L) { return val(L.distPonto, 1, "m"); }) +
      kpi("Velocidade máxima", function (L) { return val(L.vmax == null ? null : L.vmax * 3.6, 1, "km/h"); }) +
      kpi("Velocidade média correndo", function (L) { return val(L.vMedia == null ? null : L.vMedia * 3.6, 1, "km/h"); }) +
      kpi("Arrancadas (acima de 16 km/h)", function (L) { return val(L.comRastro ? L.arrancadas : null); }) +
      kpi("Primeiro passo depois do golpe do outro", function (L) { return val(L.reacao, 2, "s"); }, "Tempo entre o golpe do adversário e o primeiro passo rápido, quando o jogador estava parado. Menor é melhor.") +
      kpi("Parado e pronto no golpe do outro", function (L) { return val(L.pctPronto, 0, "%"); }, "Vezes em que o jogador já tinha parado (split) quando o adversário bateu.") +
      kpi("Longe do centro no golpe do outro", function (L) { return val(L.distCentro, 1, "m"); }, "No fundo de quadra: distância lateral do centro quando o adversário bateu. Menor = recuperou melhor.") +
      kpi("Chegada na bola", function (L) { return val(L.vChegada == null ? null : L.vChegada * 3.6, 1, "km/h"); }, "Velocidade média no meio segundo antes de bater.") +
      "</div>" + mapas(R, nm) + distanciaPontos(R)) : "";
    /* golpes */
    var golpes = R.comBatidas ? ("<h4>Golpes</h4>" + leg + divisao(R, nm) + velocidades(R, nm) + profundidade(R, nm) + ralis(R)) : "";
    return css + '<div class="pg">' + pernas + golpes +
      '<p class="pg-nota">Estimativas a partir de uma câmera só: valem para comparar jogos filmados do mesmo jeito. A velocidade da bola depende da quadra bem marcada; a dos jogadores, de os pés aparecerem no vídeo.</p></div>';
  }
  function mapas(R, nm) {
    var cel = function (L) {
      if (!L.mapa) return "";
      var W = 140, H = 170, x0 = 10, x1 = 130, y0 = 6, y1 = 164, sx = function (x) { return x0 + (x - MX[0]) / (MX[1] - MX[0]) * (x1 - x0); }, sy = function (y) { return y1 - (y - MY[0]) / (MY[1] - MY[0]) * (y1 - y0); };
      var mx = Math.max.apply(null, L.mapa.c) || 1, cw = (x1 - x0) / NC, ch = (y1 - y0) / NL, g = "";
      L.mapa.c.forEach(function (v, i) { if (!v) return; var cx = i % NC, cy = Math.floor(i / NC); g += '<rect x="' + (x0 + cx * cw + 1).toFixed(1) + '" y="' + (y1 - (cy + 1) * ch + 1).toFixed(1) + '" width="' + (cw - 2).toFixed(1) + '" height="' + (ch - 2).toFixed(1) + '" rx="3" fill="#66AA33" fill-opacity="' + (0.12 + 0.83 * v / mx).toFixed(2) + '"><title>' + Math.round(v * 100) + "% do tempo</title></rect>"; });
      var ln = function (xa, ya, xb, yb, w) { return '<line x1="' + sx(xa).toFixed(1) + '" y1="' + sy(ya).toFixed(1) + '" x2="' + sx(xb).toFixed(1) + '" y2="' + sy(yb).toFixed(1) + '" stroke="#fff" stroke-width="' + (w || 1.2) + '"/>'; };
      var q = ln(-5.485, -MEIO, 5.485, -MEIO) + ln(-5.485, -MEIO, -5.485, 0) + ln(5.485, -MEIO, 5.485, 0) + ln(-4.115, -MEIO, -4.115, 0) + ln(4.115, -MEIO, 4.115, 0) + ln(-4.115, -6.4, 4.115, -6.4) + ln(0, -6.4, 0, 0) + ln(0, -MEIO, 0, -MEIO + 0.4) + ln(-6.2, 0, 6.2, 0, 2.4);
      return '<figure class="pg-mapa" style="margin:0"><svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Onde ' + esc(L.nome) + ' ficou na quadra"><rect x="0" y="0" width="' + W + '" height="' + H + '" rx="10" fill="#2F5D47"/>' + g + q + '<text x="' + (x0 + 2) + '" y="' + (sy(0) + 10) + '" fill="#fff" font-size="8" opacity=".85">rede</text></svg><figcaption>' + esc(L.nome) + "</figcaption></figure>";
    };
    R.nos.nome = nm.nos; R.ele.nome = nm.ele;
    var h = cel(R.nos) + cel(R.ele);
    return h ? '<h4>Onde cada um ficou</h4><p class="pg-msg">O próprio lado de cada jogador, com a rede em cima. Quanto mais forte o verde, mais tempo naquela região.</p><div class="pg-mapas">' + h + "</div>" : "";
  }
  function distanciaPontos(R) {
    var l = R.nos.distPts; if (l.length < 3) return "";
    var ult = l.slice(-30), mx = Math.max.apply(null, ult.map(function (x) { return x.d; })) || 1;
    return "<h4>Distância de " + esc(R.nos.nome) + ' em cada ponto</h4><p class="pg-msg">Metros percorridos por ponto' + (l.length > 30 ? " (últimos 30)" : "") + ".</p>" +
      '<div class="pg-cols">' + ult.map(function (x) { return '<div style="height:' + Math.max(2, x.d / mx * 100).toFixed(0) + '%" title="Ponto ' + x.n + ": " + num(x.d, 1) + ' m"></div>'; }).join("") + "</div>" +
      '<div class="pg-cx">' + ult.map(function (x, i) { return "<span>" + (i % 5 === 0 ? x.n : "") + "</span>"; }).join("") + "</div>";
  }
  function divisao(R, nm) {
    var linha = function (q) {
      var L = R[q], ordem = ["forehand", "backhand", "voleio", "smash"], tot = ordem.reduce(function (s, g) { return s + (L.golpes[g] || 0); }, 0);
      if (!tot) return "";
      var cores = { forehand: q === "nos" ? "#0B3B2E" : "#C65825", backhand: q === "nos" ? "#4F8A6E" : "#E39B70", voleio: "#8A96A0", smash: "#B9C2C9" };
      return '<div class="pg-linha"><span>' + esc(nm[q]) + '</span><div><div class="pg-split" role="img" aria-label="' + esc(nm[q]) + ": " + ordem.filter(function (g) { return L.golpes[g]; }).map(function (g) { return CURTO[g] + " " + L.golpes[g]; }).join(", ") + '">' +
        ordem.filter(function (g) { return L.golpes[g]; }).map(function (g) { var p = L.golpes[g] / tot; return '<div style="flex:' + p.toFixed(3) + ";background:" + cores[g] + (g === "smash" ? ";color:#14202B" : "") + '" title="' + CURTO[g] + ": " + L.golpes[g] + " (" + Math.round(p * 100) + '%)">' + (p > 0.12 ? (g === "forehand" ? "FH" : g === "backhand" ? "BH" : g === "voleio" ? "V" : "SM") + " " + L.golpes[g] : "") + "</div>"; }).join("") + "</div></div></div>";
    };
    var sq = function (q) { return R[q].golpes.saque || 0; };
    return '<p class="pg-msg">Golpes de fundo e de rede de cada um (sem contar o saque: ' + esc(nm.nos) + " " + sq("nos") + ", " + esc(nm.ele) + " " + sq("ele") + ").</p>" + '<div class="pg-barras">' + linha("nos") + linha("ele") + "</div>";
  }
  function velocidades(R, nm) {
    var gs = ["saque", "forehand", "backhand", "voleio", "smash"].filter(function (g) { return R.nos.velMedia[g] || R.ele.velMedia[g]; });
    if (!gs.length) return "";
    var mx = Math.max.apply(null, gs.map(function (g) { return Math.max(R.nos.velMax[g] || 0, R.ele.velMax[g] || 0); })) || 1;
    var barra = function (q, g) { var v = R[q].velMedia[g]; if (!v) return '<div class="pg-bar" style="width:0"><em>—</em></div>'; return '<div class="pg-bar" style="width:' + (v / mx * 78).toFixed(1) + "%;background:" + COR[q] + '" title="' + esc(nm[q]) + " · " + CURTO[g] + ": média " + v + " km/h, máxima " + R[q].velMax[g] + ' km/h"><em>' + v + " km/h · máx. " + R[q].velMax[g] + "</em></div>"; };
    return "<h4>Velocidade da bola</h4>" + '<p class="pg-msg">Média por golpe, com a máxima ao lado.</p><div class="pg-barras">' + gs.map(function (g) { return '<div class="pg-linha"><span>' + CURTO[g] + '</span><div class="pg-par">' + barra("nos", g) + barra("ele", g) + "</div></div>"; }).join("") + "</div>";
  }
  function profundidade(R, nm) {
    var pc = function (q) { var t = { funda: 0, media: 0, curta: 0 }; Object.keys(R[q].prof).forEach(function (g) { if (g === "saque") return; var p = R[q].prof[g]; t.funda += p.funda || 0; t.media += p.media || 0; t.curta += p.curta || 0; }); return t; };
    var a = pc("nos"), b = pc("ele"), na = a.funda + a.media + a.curta, nb = b.funda + b.media + b.curta;
    if (na + nb < 5) return "";
    var lin = function (q, t, n) {
      if (!n) return "";
      var f = function (k, cor, txtCor, rot) { var p = t[k] / n; return p ? '<div style="flex:' + p.toFixed(3) + ";background:" + cor + ";color:" + txtCor + '" title="' + rot + ": " + Math.round(p * 100) + '%">' + (p > 0.14 ? rot + " " + Math.round(p * 100) + "%" : "") + "</div>" : ""; };
      return '<div class="pg-linha"><span>' + esc(nm[q]) + '</span><div class="pg-split">' + f("funda", "#0B3B2E", "#fff", "Funda") + f("media", "#66AA33", "#fff", "Meia") + f("curta", "#E8E3D6", "#14202B", "Curta") + "</div></div>";
    };
    return "<h4>Profundidade</h4>" + '<p class="pg-msg">Onde quicaram as bolas de fundo: funda (até 3 m da linha de base), meia quadra ou curta (antes da linha de saque).</p><div class="pg-barras">' + lin("nos", a, na) + lin("ele", b, nb) + "</div>";
  }
  function ralis(R) {
    if (R.ralis.length < 3) return "";
    var mx = Math.max.apply(null, R.faixas.map(function (f) { return f.n; })) || 1;
    return "<h4>Duração dos ralis</h4>" + '<p class="pg-msg">Bolas por ponto: média ' + num(R.bolasMedia, 1) + (R.maisLongo ? " · o mais longo, " + R.maisLongo.bolas + " bolas (ponto " + R.maisLongo.n + ")" : "") + ". Em cima de cada coluna, os pontos e, entre parênteses, os ganhos por " + esc(R.nos.nome) + ".</p>" +
      '<div class="pg-cols">' + R.faixas.map(function (f) { return '<div style="height:' + Math.max(2, f.n / mx * 100).toFixed(0) + '%" title="' + f.faixa + " bolas: " + f.n + " pontos, " + f.ganhos + ' ganhos"><em>' + f.n + (f.n ? " (" + f.ganhos + (f.ganhos === 1 ? " ganho" : " ganhos") + ")" : "") + "</em></div>"; }).join("") + "</div>" +
      '<div class="pg-cx">' + R.faixas.map(function (f) { return "<span>" + f.faixa + "</span>"; }).join("") + "</div>";
  }

  /* ── placar ao vivo (assistindo o vídeo): o que aconteceu até o instante t do ponto i, do ponto de vista de "quem" ── */
  var cacheMov = typeof WeakMap === "function" ? new WeakMap() : null;
  function movDe(p, q) {
    var r = p.mov && p.mov[q]; if (!r) return null;
    if (cacheMov && cacheMov.has(r)) return cacheMov.get(r);
    var m = movimento(r); if (cacheMov) cacheMov.set(r, m); return m;
  }
  /* mediana da velocidade por jogador e golpe no jogo todo: o placar ao vivo descarta o voo mal reconstruído, como o painel */
  var cacheMed = typeof WeakMap === "function" ? new WeakMap() : null;
  function medianas(pontos) {
    if (cacheMed && cacheMed.has(pontos)) { var c = cacheMed.get(pontos); if (c.n === pontos.length) return c.m; }
    var l = {}; pontos.forEach(function (p) { (p.batidas || []).forEach(function (b) { if (b.vel && b.vel > 20 && b.vel < 260) (l[b.quem + b.golpe] = l[b.quem + b.golpe] || []).push(b.vel); }); });
    var m = {}; Object.keys(l).forEach(function (k) { var v = l[k].sort(function (a, b) { return a - b; }); if (v.length >= 3) m[k] = v[Math.floor(v.length / 2)]; });
    if (cacheMed) cacheMed.set(pontos, { n: pontos.length, m: m }); return m;
  }
  function velBoa(b, md) { if (!b.vel || b.vel <= 20 || b.vel >= 260) return null; var m = md[b.quem + b.golpe]; return !m || (b.vel >= m * 0.6 && b.vel <= m * 1.45) ? b.vel : null; }
  function aoVivo(pontos, i, t, quem) {
    quem = quem || "nos"; var md = medianas(pontos);
    var vels = [], fh = 0, bh = 0, golpes = 0, porG = { forehand: [], backhand: [], saque: [] };
    for (var k = 0; k <= i && k < pontos.length; k++) {
      (pontos[k].batidas || []).forEach(function (b) {
        if (b.quem !== quem || (k === i && b.t > t + 0.02)) return;
        golpes++; if (b.golpe === "forehand") fh++; else if (b.golpe === "backhand") bh++;
        var vb = velBoa(b, md); if (vb) { vels.push({ v: vb, g: b.golpe }); if (porG[b.golpe]) porG[b.golpe].push(vb); }
      });
    }
    var p = pontos[i] || {}, seq = [], n = 0;
    (p.batidas || []).forEach(function (b) {
      if (b.quem !== quem) return; n++;
      seq.push({ n: n, golpe: b.golpe, vel: velBoa(b, md), feito: b.t <= t + 0.02, agora: Math.abs(b.t - t) < 0.45 });
    });
    var M = movDe(p, quem), velAgora = null, dist = 0;
    if (M && M.pts.length) {
      var perto = null; M.pts.forEach(function (pt) { if (Math.abs(pt.t - t) < 0.2 && (!perto || Math.abs(pt.t - t) < Math.abs(perto.t - t))) perto = pt; });
      velAgora = perto && perto.v != null ? perto.v * 3.6 : null;
      for (var j = 1; j < M.pts.length && M.pts[j].t <= t; j++) { var a = M.pts[j - 1], c = M.pts[j], dd = Math.hypot(c.x - a.x, c.y - a.y), dt = c.t - a.t; if (dt > 0 && dt < 0.45 && dd / dt <= VMAX && dd / dt >= 0.35) dist += dd; }
    }
    var med = function (l) { return l.length ? Math.round(media(l)) : null; }, ult = vels[vels.length - 1];
    return { golpes: golpes, fh: fh, bh: bh, ultima: ult ? ult.v : null, ultimaG: ult ? ult.g : null, pico: vels.length ? Math.max.apply(null, vels.map(function (x) { return x.v; })) : null,
      mediaFH: med(porG.forehand), mediaBH: med(porG.backhand), mediaSaque: med(porG.saque), historico: vels.slice(-14), seq: seq, velAgora: velAgora, distPonto: M ? dist : null, ponto: p.n || i + 1 };
  }
  var SIG = { forehand: "FH", backhand: "BH", saque: "S", voleio: "V", smash: "SM", devolucao: "D" };
  function hudHTML(e, nome) {
    var kmh = function (v) { return v == null ? "—" : String(Math.round(v)); };
    var mx = Math.max.apply(null, e.historico.map(function (x) { return x.v; }).concat([1]));
    return '<div class="pg-hud" role="status" aria-label="Placar ao vivo de ' + esc(nome) + '">' +
      '<div class="pg-hc"><small>golpes</small><b>' + e.golpes + "</b></div>" +
      '<div class="pg-hc"><small>forehand / backhand</small><b>' + e.fh + " / " + e.bh + "</b></div>" +
      '<div class="pg-hc pg-hv"><small>velocidade do golpe</small><b>' + kmh(e.ultima) + "<u>km/h</u></b><span>estimativa" + (e.ultimaG ? " · " + esc((CURTO[e.ultimaG] || "").toLowerCase()) : "") + "</span><span>pico " + kmh(e.pico) + " · FH " + kmh(e.mediaFH) + " · BH " + kmh(e.mediaBH) + "</span></div>" +
      '<div class="pg-hc pg-hp"><small>pernas agora</small><b>' + (e.velAgora == null ? "—" : num(e.velAgora, 1)) + "<u>km/h</u></b><span>" + (e.distPonto == null ? "" : num(e.distPonto, 1) + " m neste ponto") + "</span></div>" +
      '<div class="pg-hc pg-hh"><small>histórico</small><div class="pg-hbar">' + e.historico.map(function (x, k) { return '<i style="height:' + Math.max(8, x.v / mx * 100).toFixed(0) + '%"' + (k === e.historico.length - 1 ? ' class="u"' : "") + ' title="' + x.v + ' km/h"></i>'; }).join("") + "</div></div>" +
      '<div class="pg-hc pg-hs"><small>sequência do ponto ' + e.ponto + '</small><div class="pg-hseq">' + (e.seq.length ? e.seq.map(function (x) { return '<span class="' + (x.agora ? "ag" : x.feito ? "ok" : "") + '"><b>' + x.n + "</b><em>" + (x.feito ? SIG[x.golpe] || "?" : "") + "</em></span>"; }).join("") : '<em class="pg-hvaz">sem batidas</em>') + "</div></div></div>";
  }
  var HUD_CSS = ".pg-hud{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#D9D5CA;border:1px solid #D9D5CA;border-radius:12px;overflow:hidden;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;margin-top:8px}" +
    ".pg-hc{background:#F4F2EC;padding:8px 10px;min-width:0}.pg-hc small{display:block;font-size:10.5px;color:#5C6B78;letter-spacing:.02em}.pg-hc b{display:block;font-size:26px;line-height:1.1;color:#14202B;font-weight:700}.pg-hc b u{text-decoration:none;font-size:11px;color:#5C6B78;margin-left:3px}.pg-hc span{display:block;font-size:10px;color:#5C6B78;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    ".pg-hh,.pg-hs{grid-column:span 2}.pg-hbar{display:flex;gap:3px;align-items:flex-end;height:34px;margin-top:4px}.pg-hbar i{flex:1;max-width:12px;background:#2E8B57;border-radius:2px 2px 0 0;opacity:.75}.pg-hbar i.u{background:#0B3B2E;opacity:1}" +
    ".pg-hseq{display:flex;gap:5px;flex-wrap:wrap;margin-top:4px}.pg-hseq span{display:flex;flex-direction:column;align-items:center;width:24px}.pg-hseq b{width:22px;height:22px;border-radius:50%;border:1.5px solid #B9C2C9;color:#8A96A0;font-size:11px;display:grid;place-items:center;line-height:1}.pg-hseq span.ok b{border-color:#0B3B2E;color:#0B3B2E}.pg-hseq span.ag b{background:#0B3B2E;border-color:#0B3B2E;color:#fff}.pg-hseq em{font-style:normal;font-size:9.5px;color:#5C6B78;height:12px}.pg-hvaz{font-size:11px;color:#8A96A0;font-style:normal}" +
    "@media (max-width:520px){.pg-hud{grid-template-columns:repeat(2,1fr)}.pg-hc b{font-size:22px}}";
  return { analisar: analisar, html: html, resumo: resumo, movimento: movimento, aoVivo: aoVivo, hudHTML: hudHTML, HUD_CSS: HUD_CSS };
});
