/* Análise de movimento em vídeo · Tecnologia QuadraLab.
   Interface compartilhada: protótipo, app do treinador (QuadraLab) e Team Yoda usam este arquivo.
   Depende de scout/movimento-motor.js (QLBiomec) e de scout/movimento.css. A análise roda no aparelho; o vídeo não é enviado.
   QLMovimento.montar(el, { atleta, alunoId, historico, cota, logo, arquivo, aoSalvar, aoRemover, aoRecuperar }) -> controle { injetar(quadros, opts) }
     cotaGolpe(golpe) -> { limite, usados, liberado, texto }: limite por golpe, conferido ao trocar de golpe e depois de salvar (Player).
     arquivo (scout/movimento-arquivo.js): cada análise guarda o relatório completo e pode ser reaberta em "Análises salvas".
   QLMovimento.abrirRelatorio(resumo, { arquivo, historico, logo, atleta, cabecalho }) -> reabre o relatório de uma análise salva.
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

  /* ── boneco ──
     Figura humana (cabeça, tronco, braços e pernas com volume) a partir da pose: usada no vídeo × boneco lado a lado e na comparação
     com o modelo. lm: pontos normalizados ({x, y} ou [x, y]); o: { cor, contorno, alpha, largura (espessura relativa) }. */
  function pt(lm, i, w, h) { var p = lm[i]; if (!p) return null; var x = Array.isArray(p) ? p[0] : p.x, y = Array.isArray(p) ? p[1] : p.y; return isFinite(x) && isFinite(y) && !(p.v === 0) ? { x: x * w, y: y * h } : null; }
  function desenharBoneco(ctx, lm, w, h, o) {
    o = o || {};
    if (!lm) return;
    var P = function (i) { return pt(lm, i, w, h); };
    var oE = P(11), oD = P(12), qE = P(23), qD = P(24);
    if (!oE || !oD || !qE || !qD) return;
    var om = { x: (oE.x + oD.x) / 2, y: (oE.y + oD.y) / 2 }, qm = { x: (qE.x + qD.x) / 2, y: (qE.y + qD.y) / 2 };
    var T = Math.hypot(om.x - qm.x, om.y - qm.y) || 40, k = o.largura || 1;
    ctx.save(); ctx.globalAlpha = o.alpha == null ? 1 : o.alpha; ctx.lineCap = "round"; ctx.lineJoin = "round";
    var cor = o.cor || "#4FC3F7", borda = o.contorno || "rgba(0,0,0,.55)";
    function seg(a, b, esp, c) {
      a = P(a); b = P(b); if (!a || !b) return;
      ctx.strokeStyle = borda; ctx.lineWidth = esp + 3; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.strokeStyle = c || cor; ctx.lineWidth = esp; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    var braco = T * 0.15 * k, perna = T * 0.2 * k, escuro = o.corLonge || cor;
    /* lado de trás primeiro (esquerdo), depois o da frente */
    seg(23, 25, perna, escuro); seg(25, 27, perna * 0.85, escuro); seg(27, 31, perna * 0.6, escuro);
    seg(11, 13, braco, escuro); seg(13, 15, braco * 0.85, escuro);
    /* tronco */
    ctx.fillStyle = cor; ctx.strokeStyle = borda; ctx.lineWidth = T * 0.14 * k;
    ctx.beginPath(); ctx.moveTo(oE.x, oE.y); ctx.lineTo(oD.x, oD.y); ctx.lineTo(qD.x, qD.y); ctx.lineTo(qE.x, qE.y); ctx.closePath(); ctx.stroke(); ctx.fill();
    ctx.strokeStyle = cor; ctx.lineWidth = T * 0.11 * k; ctx.stroke();
    seg(24, 26, perna); seg(26, 28, perna * 0.85); seg(28, 32, perna * 0.6);
    seg(12, 14, braco); seg(14, 16, braco * 0.85);
    /* pescoço e cabeça */
    var nz = P(0);
    var cab = nz ? { x: nz.x + (om.x - nz.x) * 0.12, y: nz.y + (om.y - nz.y) * 0.12 } : { x: om.x, y: om.y - T * 0.42 };
    ctx.strokeStyle = cor; ctx.lineWidth = T * 0.12 * k; ctx.beginPath(); ctx.moveTo(om.x, om.y); ctx.lineTo(cab.x, cab.y); ctx.stroke();
    ctx.fillStyle = cor; ctx.strokeStyle = borda; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cab.x, cab.y, T * 0.22 * k, 0, 7); ctx.fill(); ctx.stroke();
    /* mãos */
    [15, 16].forEach(function (i) { var m = P(i); if (!m) return; ctx.fillStyle = o.corMao || "#FFB74D"; ctx.beginPath(); ctx.arc(m.x, m.y, T * 0.07 * k + 1, 0, 7); ctx.fill(); });
    ctx.restore();
  }

  /* ── imagem de cada fase ──
     Todo relatório mostra, por fase, a imagem real do vídeo e o boneco da análise lado a lado (uma imagem só, que funciona em todo
     lugar: tela, PDF, caderno, relatório do atleta). Sem a foto do vídeo, fica só o boneco; o resultado guarda a pose de cada fase.
     imagensFases(resultado, fotos) → [{ src, foto }] na ordem das fases; src vazio só em análises antigas, de antes da pose guardada. */
  function bonecoSVG(pose, W, H, o) {
    o = o || {};
    var P = function (i) { var a = pose && pose[i]; if (!a) return null; var x = Array.isArray(a) ? a[0] : a.x, y = Array.isArray(a) ? a[1] : a.y; return isFinite(x) && isFinite(y) && a.v !== 0 ? { x: x * W, y: y * H } : null; };
    var oE = P(11), oD = P(12), qE = P(23), qD = P(24);
    if (!oE || !oD || !qE || !qD) return "";
    var f = function (n) { return n.toFixed(1); };
    var om = { x: (oE.x + oD.x) / 2, y: (oE.y + oD.y) / 2 }, qm = { x: (qE.x + qD.x) / 2, y: (qE.y + qD.y) / 2 };
    var T = Math.hypot(om.x - qm.x, om.y - qm.y) || 40, cor = o.cor || "#1E88E5", longe = o.corLonge || "#64B5F6", borda = "rgba(0,0,0,.55)", out = "";
    function seg(a, b, esp, c) {
      a = P(a); b = P(b); if (!a || !b) return;
      var xy = ' x1="' + f(a.x) + '" y1="' + f(a.y) + '" x2="' + f(b.x) + '" y2="' + f(b.y) + '"';
      out += "<line" + xy + ' stroke="' + borda + '" stroke-width="' + f(esp + 3) + '"/><line' + xy + ' stroke="' + c + '" stroke-width="' + f(esp) + '"/>';
    }
    var braco = T * 0.15, perna = T * 0.2;
    /* lado de trás primeiro (esquerdo), depois o da frente, como no boneco do vídeo × boneco */
    seg(23, 25, perna, longe); seg(25, 27, perna * 0.85, longe); seg(27, 31, perna * 0.6, longe);
    seg(11, 13, braco, longe); seg(13, 15, braco * 0.85, longe);
    var pts = [oE, oD, qD, qE].map(function (p) { return f(p.x) + "," + f(p.y); }).join(" ");
    out += '<polygon points="' + pts + '" fill="' + cor + '" stroke="' + borda + '" stroke-width="' + f(T * 0.14) + '" stroke-linejoin="round"/>' +
      '<polygon points="' + pts + '" fill="none" stroke="' + cor + '" stroke-width="' + f(T * 0.11) + '" stroke-linejoin="round"/>';
    seg(24, 26, perna, cor); seg(26, 28, perna * 0.85, cor); seg(28, 32, perna * 0.6, cor);
    seg(12, 14, braco, cor); seg(14, 16, braco * 0.85, cor);
    var nz = P(0), cab = nz ? { x: nz.x + (om.x - nz.x) * 0.12, y: nz.y + (om.y - nz.y) * 0.12 } : { x: om.x, y: om.y - T * 0.42 };
    out += '<line x1="' + f(om.x) + '" y1="' + f(om.y) + '" x2="' + f(cab.x) + '" y2="' + f(cab.y) + '" stroke="' + cor + '" stroke-width="' + f(T * 0.12) + '"/>' +
      '<circle cx="' + f(cab.x) + '" cy="' + f(cab.y) + '" r="' + f(T * 0.22) + '" fill="' + cor + '" stroke="' + borda + '" stroke-width="2"/>';
    [15, 16].forEach(function (i) { var m = P(i); if (m) out += '<circle cx="' + f(m.x) + '" cy="' + f(m.y) + '" r="' + f(T * 0.07 + 1) + '" fill="#FFB74D"/>'; });
    return '<g stroke-linecap="round">' + out + "</g>";
  }
  function svgFase(foto, pose, prop) {
    var W = 480, H = Math.round(W * (prop > 0.2 && prop < 5 ? prop : 1.33)), G = foto ? 8 : 0, X = foto ? W + G : 0, TW = X + W;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ' + TW + " " + H + '" width="' + TW + '" height="' + H + '">' +
      '<rect width="100%" height="100%" fill="#fff"/>' +
      (foto ? '<image x="0" y="0" width="' + W + '" height="' + H + '" preserveAspectRatio="xMidYMid slice" xlink:href="' + foto + '"/>' : "") +
      '<g transform="translate(' + X + ',0)"><rect width="' + W + '" height="' + H + '" rx="6" fill="#EEF2F0"/>' + bonecoSVG(pose, W, H) +
      '<text x="10" y="' + (H - 12) + '" fill="#5C6B78" font-family="system-ui,sans-serif" font-size="17">' + (foto ? "boneco da análise" : "boneco da análise (pose detectada)") + "</text></g></svg>";
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }
  function svgPose(pose, prop) { return svgFase(null, pose, prop); }
  function imagensFases(resultado, fotos) {
    var r = resultado || {};
    return (r.fases || []).map(function (f, i) {
      var temPose = f && f.pose && f.pose.some(Boolean);
      if (fotos && fotos[i]) return { src: temPose ? svgFase(fotos[i], f.pose, r.proporcao) : fotos[i], foto: true };
      if (temPose) return { src: svgPose(f.pose, r.proporcao), foto: false };
      return { src: "", foto: false };
    });
  }

  /* ── vídeo e boneco juntos no relatório ──
     O trecho do golpe (quadros pequenos do vídeo + a pose de cada um) roda no próprio relatório: à esquerda o vídeo real, à direita
     o boneco da análise, no mesmo instante. tocadorClip roda DENTRO da janela do relatório (vai como texto, com desenharBoneco). */
  function tocadorClip() {
    var C = window.CLIP, cv = document.getElementById("vbc"), x = cv.getContext("2d"), W = cv.width / 2 - 4, H = cv.height;
    var ims = C.fotos.map(function (src) { var im = new Image(); im.src = src; im.onload = function () { desenhar(); }; return im; });
    var t0 = C.t[0], t1 = C.t[C.t.length - 1], T = t0, toca = false, ult = 0;
    var bt = document.getElementById("vbp"), vel = document.getElementById("vbv"), sl = document.getElementById("vbs"), rot = document.getElementById("vbr");
    function idx() { var k = 0; for (var i = 0; i < C.t.length; i++) if (C.t[i] <= T + 1e-6) k = i; return k; }
    function desenhar() {
      var i = idx();
      x.fillStyle = "#fff"; x.fillRect(0, 0, cv.width, H);
      x.fillStyle = "#111"; x.fillRect(0, 0, W, H);
      if (ims[i] && ims[i].complete && ims[i].naturalWidth) x.drawImage(ims[i], 0, 0, W, H);
      x.save(); x.translate(W + 8, 0); x.fillStyle = "#EEF2F0"; x.fillRect(0, 0, W, H);
      desenharBoneco(x, C.poses[i], W, H, { cor: "#1E88E5", corLonge: "#64B5F6" }); x.restore();
      var f = -1; (C.fases || []).forEach(function (ft, k) { if (ft <= T + 1e-6) f = k; });
      rot.textContent = (f >= 0 ? (f + 1) + ". " + C.nomes[f] + " · " : "") + T.toFixed(2) + " s";
      sl.value = Math.round((T - t0) / Math.max(1e-3, t1 - t0) * 1000);
    }
    function ciclo(agora) {
      if (toca) { T += (ult ? (agora - ult) / 1000 : 0) * (+vel.value || 0.5); if (T > t1) T = t0; desenhar(); }
      ult = agora; requestAnimationFrame(ciclo);
    }
    function parar() { toca = false; bt.textContent = "▶ Reproduzir"; }
    bt.onclick = function () { toca = !toca; ult = 0; bt.textContent = toca ? "❚❚ Pausar" : "▶ Reproduzir"; };
    sl.oninput = function () { parar(); T = t0 + (+sl.value / 1000) * (t1 - t0); desenhar(); };
    document.getElementById("vbant").onclick = function () { parar(); T = C.t[Math.max(0, idx() - 1)]; desenhar(); };
    document.getElementById("vbprox").onclick = function () { parar(); T = C.t[Math.min(C.t.length - 1, idx() + 1)]; desenhar(); };
    document.getElementById("vbf").onclick = function (e) { var b = e.target.closest("[data-f]"); if (!b) return; parar(); T = Math.max(t0, Math.min(t1, C.fases[+b.getAttribute("data-f")])); desenhar(); };
    desenhar(); requestAnimationFrame(ciclo);
  }
  function clipHTML(clip) {
    if (!clip || !clip.fotos || clip.fotos.length < 2 || !clip.t || !clip.poses) return "";
    var W = 360, H = Math.round(W * (clip.prop > 0.2 && clip.prop < 5 ? clip.prop : 1.33));
    var dados = JSON.stringify(clip).replace(/</g, "\\u003c");
    return '<div class="vbr"><h2>Vídeo e boneco juntos</h2><canvas id="vbc" width="' + (2 * W + 8) + '" height="' + H + '"></canvas>' +
      '<div class="vbctl"><button id="vbp">▶ Reproduzir</button><button id="vbant" aria-label="Quadro anterior">◀︎</button><button id="vbprox" aria-label="Próximo quadro">▶︎</button>' +
      '<select id="vbv" aria-label="Velocidade"><option value="0.25">0,25×</option><option value="0.5" selected>0,5×</option><option value="1">1×</option></select><span id="vbr"></span></div>' +
      '<input id="vbs" type="range" min="0" max="1000" value="0" aria-label="Posição no golpe">' +
      '<div id="vbf">' + (clip.fases || []).map(function (t, i) { return '<button data-f="' + i + '">' + (i + 1) + ". " + esc((clip.nomes || [])[i] || "") + "</button>"; }).join("") + "</div></div>" +
      "<script>window.CLIP=" + dados + ";" + pt.toString() + desenharBoneco.toString() + "(" + tocadorClip.toString() + ")();</" + "script>";
  }

  /* ── relatório (janela própria, como o relatório dos jogos) ── */
  function relatorioHTML(d) {
    var r = d.resultado, co = B.conclusao(r), nm = nomeGolpe(d.golpe, d.emp), logo = d.logo || "assets/logo-quadralab.png";
    var imgs = imagensFases(r, d.fotos), temImgs = imgs.some(function (x) { return !!x.src; }), algumaPose = imgs.some(function (x) { return x.src && !x.foto; });
    var fotos = temImgs ? '<div class="fotos">' + r.fases.map(function (f, i) {
      return '<div class="f">' + (imgs[i].src ? '<img src="' + esc(imgs[i].src) + '" alt="' + esc(r.nomes[i]) + '">' : "") + "<b>" + (i + 1) + ". " + esc(r.nomes[i]) + "</b><span>" + f.t.toFixed(2) + " s</span></div>";
    }).join("") + "</div>" + (algumaPose ? '<p class="qm-msg">Nas fases sem foto do vídeo, a imagem mostra só o boneco da pose detectada naquele momento.</p>' : "")
      : '<p class="qm-msg">Esta análise é de antes de o app guardar as imagens das fases. Fases: ' + r.fases.map(function (f, i) { return (i + 1) + ". " + esc(r.nomes[i]) + " (" + f.t.toFixed(2) + " s)"; }).join(" · ") + "</p>";
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
      ".fotos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:8px}@media(max-width:600px){.fotos{grid-template-columns:1fr}}.f{border:1px solid #E2DED5;border-radius:6px;padding:4px;break-inside:avoid}.f img{display:block;max-height:78mm;max-width:100%;width:auto;margin:0 auto;border-radius:4px;background:#fff}.f b{display:block;font-size:11px;margin-top:3px}.f span{font-size:10px;color:#5C6B78}" +
      "table{width:100%;border-collapse:collapse;table-layout:fixed;overflow-wrap:anywhere;font-size:10.8px}td,th{text-align:left;padding:5px 4px;border-top:1px solid #E2DED5;vertical-align:top}th{font-size:10px;color:#5C6B78;border-top:0}thead{display:table-header-group}tr{break-inside:avoid}tr.fh td{background:#F3F1EA;font-weight:700}" +
      ".t{display:inline-block;padding:1px 8px;border-radius:99px;font-size:10px;font-weight:700;color:#fff}.t.ok{background:#2E8B57}.t.atencao{background:#C65825}.t.nao_avaliavel{background:#8A96A0}small{color:#5C6B78}" +
      ".pr{border:1px solid #E2DED5;border-left:4px solid #C65825;border-radius:8px;padding:6px 9px;margin:6px 0;break-inside:avoid}.pr p{margin:2px 0}.pr ul,ul{margin:3px 0 0 18px;padding:0}.quebra{break-before:page}.rod{margin-top:12px;border-top:1px solid #ccc;padding-top:6px;font-size:9.5px;color:#555}" +
      ".qm-up{color:#2E8B57;font-weight:700}.qm-dn{color:#C65825;font-weight:700}.qm-eq{color:#5C6B78}.qm-tag{display:inline-block;padding:1px 7px;border-radius:99px;font-size:10px;color:#fff}.qm-tag.ok{background:#2E8B57}.qm-tag.atencao{background:#C65825}.qm-tag.nao_avaliavel{background:#8A96A0}.qm-cmp-s{font-weight:700}.qm-msg{color:#5C6B78;font-size:10.5px}svg.qm-graf{width:100%;max-width:520px}" +
      ".nop{margin-bottom:10px}.nop button{font:inherit;padding:8px 14px;border-radius:8px;border:1px solid #0B3B2E;background:#0B3B2E;color:#fff;margin-right:6px;cursor:pointer}@media print{.nop{display:none}body{padding:0}}" +
      ".vbr{margin-top:10px}.vbr canvas{display:block;width:100%;max-width:760px;height:auto;border-radius:8px;border:1px solid #E2DED5}.vbctl{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:6px 0}.vbr button,.vbr select{font:inherit;font-size:12px;padding:6px 10px;border-radius:8px;border:1px solid #0B3B2E;background:#fff;color:#0B3B2E;cursor:pointer}#vbp{background:#0B3B2E;color:#fff}#vbr{font-size:11px;color:#5C6B78}#vbs{width:100%;max-width:760px}#vbf{display:flex;flex-wrap:wrap;gap:5px;margin-top:4px}@media print{.vbr{display:none}}";
    return "<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Análise de movimento · " + esc(nm) + "</title><style>" + css + "</style></head><body>" +
      '<div class="nop"><button onclick="window.print()">Salvar como PDF / Imprimir</button><button onclick="window.close()">Fechar</button></div>' +
      '<div class="cab"><img src="' + esc(logo) + '" alt="QuadraLab"><div><div class="t">Análise de movimento · ' + esc(nm) + "</div><small>" + (d.atleta ? "Atleta: " + esc(d.atleta) + " · " : "") + "Mão dominante: " + (d.dom === "E" ? "esquerda" : "direita") + " · " + (d.data ? new Date(d.data) : new Date()).toLocaleDateString("pt-BR") + (d.demo ? " · dados de demonstração" : "") + (d.cabecalho ? " · " + esc(d.cabecalho) : "") + "</small></div></div>" +
      '<div class="kpi"><div style="background:#2E8B57"><b>' + r.resumo.ok + '</b>OK</div><div style="background:#C65825"><b>' + r.resumo.atencao + '</b>Atenção</div><div style="background:#8A96A0"><b>' + r.resumo.nao_avaliavel + "</b>Revisar com treinador</div></div>" +
      clipHTML(d.clip) + fotos + '<div class="quebra"></div><h2>Checklist por fase</h2><table><thead><tr><th>Item</th><th>Medido</th><th>Referência</th><th>Parecer</th></tr></thead><tbody>' + tb + "</tbody></table>" +
      '<div class="quebra"></div><h2>Conclusão e intervenções sugeridas</h2><p>' + esc(co.texto) + "</p>" + cb + evo +
      '<div class="rod">Tecnologia QuadraLab · relatório automático de apoio ao treinador. As medidas vêm de estimativa de pose em vídeo e as faixas de referência são provisórias. Itens "Revisar" dependem de avaliação presencial.</div></body></html>';
  }

  /* ── relatório de uma análise salva antes do arquivo completo: só o resumo (medidas, pareceres, conclusão) existe ── */
  function relatorioResumoHTML(h, d) {
    var nm = nomeGolpe(h.golpe, h.emp), logo = d.logo || "assets/logo-quadralab.png";
    var tb = (h.itens || []).map(function (i) { return "<tr><td>" + esc(i.n) + "</td><td>" + val(i) + "</td><td>" + esc(i.r) + '</td><td><span class="t ' + esc(i.s) + '">' + (ROT[i.s] || "") + "</span></td></tr>"; }).join("");
    var evo = d.historico && d.historico.length > 1 ? "<h2>Evolução do jogador neste golpe</h2>" + graficoHTML(B.serie(d.historico, h.golpe, h.emp)) : "";
    var css = "body{font:12px system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#14202B;margin:0;padding:14px;max-width:900px;margin:auto}.cab{display:flex;align-items:center;gap:14px;border-bottom:3px solid #0B3B2E;padding-bottom:8px;margin-bottom:10px}.cab img{height:34px}.cab .t{font-size:19px;font-weight:800;color:#0B3B2E}.cab small{display:block;color:#444;font-size:11px;margin-top:2px}" +
      "h2{font-size:15px;color:#0B3B2E;margin:12px 0 6px}.kpi{display:flex;gap:8px}.kpi div{flex:1;text-align:center;border-radius:8px;padding:7px;color:#fff}.kpi b{display:block;font-size:19px}table{width:100%;border-collapse:collapse;table-layout:fixed;overflow-wrap:anywhere;font-size:10.8px}td,th{text-align:left;padding:5px 4px;border-top:1px solid #E2DED5;vertical-align:top}th{font-size:10px;color:#5C6B78;border-top:0}" +
      ".t{display:inline-block;padding:1px 8px;border-radius:99px;font-size:10px;font-weight:700;color:#fff}.t.ok{background:#2E8B57}.t.atencao{background:#C65825}.t.nao_avaliavel{background:#8A96A0}.av{background:#F3F1EA;border-radius:8px;padding:8px 10px;color:#444}.qm-msg{color:#5C6B78;font-size:10.5px}svg.qm-graf{width:100%;max-width:520px}" +
      ".nop{margin-bottom:10px}.nop button{font:inherit;padding:8px 14px;border-radius:8px;border:1px solid #0B3B2E;background:#0B3B2E;color:#fff;margin-right:6px;cursor:pointer}@media print{.nop{display:none}body{padding:0}}.rod{margin-top:12px;border-top:1px solid #ccc;padding-top:6px;font-size:9.5px;color:#555}";
    return "<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Análise de movimento · " + esc(nm) + "</title><style>" + css + "</style></head><body>" +
      '<div class="nop"><button onclick="window.print()">Salvar como PDF / Imprimir</button><button onclick="window.close()">Fechar</button></div>' +
      '<div class="cab"><img src="' + esc(logo) + '" alt="QuadraLab"><div><div class="t">Análise de movimento · ' + esc(nm) + "</div><small>" + (d.atleta ? "Atleta: " + esc(d.atleta) + " · " : "") + "Mão dominante: " + (h.dom === "E" ? "esquerda" : "direita") + " · " + data(h.criadoEm) + (d.cabecalho ? " · " + esc(d.cabecalho) : "") + "</small></div></div>" +
      '<p class="av">Esta análise foi feita antes de o app guardar o relatório completo. Ficaram guardados as medidas, os pareceres e a conclusão; as fotos das fases e os comentários de cada item não foram guardados na época.</p>' +
      '<div class="kpi"><div style="background:#2E8B57"><b>' + h.res.ok + '</b>OK</div><div style="background:#C65825"><b>' + h.res.atencao + '</b>Atenção</div><div style="background:#8A96A0"><b>' + h.res.nao + "</b>Revisar com treinador</div></div>" +
      '<h2>Checklist</h2><table><thead><tr><th>Item</th><th>Medido</th><th>Referência</th><th>Parecer</th></tr></thead><tbody>' + tb + "</tbody></table>" +
      "<h2>Conclusão</h2><p>" + esc(h.texto) + "</p>" + (h.prio && h.prio.length ? "<h2>Prioridades</h2><ul>" + h.prio.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ul>" : "") + evo +
      '<div class="rod">Tecnologia QuadraLab · relatório automático de apoio ao treinador. As medidas vêm de estimativa de pose em vídeo e as faixas de referência são provisórias.</div></body></html>';
  }

  function mesmoGolpe(a, b) { return a.golpe === b.golpe && (a.golpe !== "backhand" || String(a.emp) === String(b.emp)); }

  /* Reabre o relatório de uma análise salva: o completo (arquivo da academia) ou, para análises antigas, o resumo guardado no jogador.
     A janela abre na hora do toque (senão o navegador bloqueia) e é preenchida quando o arquivo chega. */
  function abrirRelatorio(h, o) {
    o = o || {};
    var w = window.open("", "_blank");
    if (!w) { alert("O navegador bloqueou a janela do relatório — permita pop-ups para este site e tente de novo."); return; }
    w.document.write('<!doctype html><meta charset="utf-8"><title>Carregando relatório…</title><p style="font:14px system-ui,sans-serif;padding:20px;color:#14202B">Carregando o relatório…</p>');
    var hist = B.ordenar(o.historico || []).filter(function (x) { return mesmoGolpe(x, h) && x.criadoEm <= h.criadoEm; });
    var p = o.arquivo ? Promise.resolve().then(function () { return o.arquivo.ler(h.id); }).catch(function () { return null; }) : Promise.resolve(null);
    var pc = o.arquivo && o.arquivo.lerClip ? Promise.resolve().then(function () { return o.arquivo.lerClip(h.id); }).catch(function () { return null; }) : Promise.resolve(null);
    return Promise.all([p, pc]).then(function (x) {
      var arq = x[0], clip = x[1];
      var html = arq && arq.resultado
        ? relatorioHTML({ resultado: arq.resultado, golpe: arq.golpe, emp: arq.emp, dom: arq.dom, atleta: arq.atleta || o.atleta || "", fotos: arq.fotos || [], semFotos: arq.semFotos, logo: o.logo, comparacao: arq.comparacao, historico: hist, cabecalho: arq.cabecalho || o.cabecalho, data: arq.criadoEm, clip: clip })
        : relatorioResumoHTML(h, { atleta: o.atleta || "", logo: o.logo, cabecalho: o.cabecalho, historico: hist });
      w.document.open(); w.document.write(html); w.document.close();
    });
  }

  /* lista das análises salvas (mais recente primeiro), com o botão de reabrir cada relatório */
  function listaHTML(historico, o) {
    o = o || {};
    var lista = B.ordenar(historico || []).slice().reverse();
    if (!lista.length) return "";
    return '<h4>Análises salvas</h4><table class="qm-salvas"><tbody>' + lista.map(function (h) {
      return "<tr><td>" + data(h.criadoEm) + "</td><td>" + esc(nomeGolpe(h.golpe, h.emp)) + "</td><td>" + h.res.ok + " OK · " + h.res.atencao + ' atenção</td><td><div class="qm-acoes"><button class="qm-x qm-ver" data-ver="' + esc(h.id) + '">Ver relatório</button>' + (o.remover ? '<button class="qm-x" data-rm="' + esc(h.id) + '">Remover</button>' : "") + "</div></td></tr>";
    }).join("") + "</tbody></table>";
  }

  /* ── tela ── */
  function montar(el, opts) {
    opts = opts || {};
    var logo = opts.logo || "assets/logo-quadralab.png";
    var S = { golpe: "forehand", emp: "2", quadros: null, real: false, resultado: null, fotos: [], regId: null, regAtual: null, historico: (opts.historico || []).slice(), cota: opts.cota || null, token: 0 };
    var arquivo = opts.arquivo || null, alunoId = opts.alunoId || null;
    if (opts.cotaGolpe) S.cota = opts.cotaGolpe(S.golpe);
    el.classList.add("qlm");
    el.innerHTML =
      (opts.semMarca ? "" : '<div class="qm-row" style="justify-content:space-between"><div>' + badgeHTML(logo) + '</div></div>') +
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
      '<div class="qm-card" data-r="vbC"><h3 class="qm-h">Vídeo e boneco lado a lado</h3>' +
      '<div class="qm-row"><label>Comparar com <select data-r="mod"><option value="">Nada (só o atleta)</option><option value="padrao">Modelo padrão QuadraLab</option></select></label>' +
      '<button data-r="salvarMod" hidden>Salvar esta análise como modelo da academia</button></div>' +
      '<div class="qm-vb"><div class="qm-vb-col"><video data-r="v2" playsinline muted preload="auto"></video><p class="qm-msg qm-vb-sem" data-r="v2msg" hidden>Demonstração: sem vídeo, o boneco mostra o movimento sintético.</p><span class="qm-vb-rot">Vídeo</span></div>' +
      '<div class="qm-vb-col"><canvas data-r="bon" width="480" height="640"></canvas><span class="qm-vb-rot" data-r="bonRot">Boneco</span></div></div>' +
      '<div class="qm-row qm-vb-ctl"><button data-r="qAnt" aria-label="Quadro anterior">◀ Quadro</button><button class="qm-pri" data-r="play">▶ Reproduzir</button><button data-r="qProx" aria-label="Próximo quadro">Quadro ▶</button>' +
      '<label>Velocidade <select data-r="vel"><option value="0.25">0,25×</option><option value="0.5" selected>0,5×</option><option value="1">1×</option></select></label></div>' +
      '<div class="qm-row qm-vb-fases" data-r="faseBt"></div><div data-r="cmpMod"></div></div>' +
      '<div class="qm-card" data-r="cmpC" hidden><h3 class="qm-h">Comparação com a análise anterior</h3><div data-r="cmp"></div></div>' +
      '<div class="qm-card"><h3 class="qm-h">Checklist por fase</h3><table><thead><tr><th>Item</th><th>Medido</th><th>Referência</th><th>Parecer</th></tr></thead><tbody data-r="tb"></tbody></table>' +
      '<p class="qm-msg">Itens "Revisar" dependem de mão, face da raquete, vista de cima ou olhar: ficam para o treinador. Pareceres automáticos são apoio, não diagnóstico.</p></div>' +
      '<div class="qm-card"><h3 class="qm-h">Conclusão e intervenções sugeridas</h3><p data-r="ctx" style="margin:0 0 8px"></p><div data-r="cbody"></div><p class="qm-msg">Sugestões geradas por regras a partir das medidas deste vídeo; não substituem avaliação presencial.</p></div>' +
      '<div class="qm-card"><div class="qm-row"><button class="qm-pri" data-r="pdf">Relatório em PDF</button><button data-r="json">Baixar dados (JSON)</button></div><p class="qm-msg" data-r="salvoMsg"></p>' +
      '<details><summary>Faixas de referência (editáveis)</summary><p class="qm-msg">Valores iniciais de referência; ajuste conforme a avaliação do treinador.</p>' +
      '<div class="qm-row"><label>Joelhos° <input data-r="rJ" type="number" value="' + B.REGRAS.joelhos.alvo + '" style="width:70px"></label><label>± <input data-r="rJt" type="number" value="' + B.REGRAS.joelhos.tol + '" style="width:60px"></label>' +
      '<label>Tronco° <input data-r="rT" type="number" value="' + B.REGRAS.tronco.alvo + '" style="width:70px"></label><label>± <input data-r="rTt" type="number" value="' + B.REGRAS.tronco.tol + '" style="width:60px"></label>' +
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
      var txt = c.texto ? c.texto : c.bloqueado ? "A análise de movimento não está incluída no seu plano atual. Está disponível nos planos Essencial (quantidade mensal) e Premium (ilimitado)."
        : (c.liberado ? "Plano com limite: você usou " + c.usados + " de " + c.limite + " análises de movimento neste mês (" + c.restantes + " restantes). No Premium é ilimitado."
          : "Você usou as " + c.limite + " análises de movimento deste mês. Elas voltam no próximo mês, ou passe ao Premium para análises ilimitadas.");
      slot.innerHTML = '<div class="qm-cota' + (c.liberado ? "" : " bloq") + '">' + esc(txt) + "</div>";
      q("go").disabled = !c.liberado || !arqUrl;
    }
    function renderHistorico() {
      q("evo").innerHTML = evolucaoHTML(S.historico);
      q("lista").innerHTML = listaHTML(S.historico, { remover: !!opts.aoRemover });
    }
    function opcoesRelatorio() { return { arquivo: arquivo, historico: S.historico, logo: opts.logoAbsoluto || logo, atleta: opts.atleta || "", cabecalho: opts.cabecalho }; }
    q("lista").onclick = function (e) {
      var ver = e.target.closest("[data-ver]");
      if (ver) { var h = S.historico.filter(function (x) { return x.id === ver.getAttribute("data-ver"); })[0]; if (h) abrirRelatorio(h, opcoesRelatorio()); return; }
      var b = e.target.closest("[data-rm]"); if (!b || !opts.aoRemover) return;
      if (!window.confirm("Remover esta análise do histórico?")) return;
      var id = b.getAttribute("data-rm");
      S.historico = S.historico.filter(function (h) { return h.id !== id; });
      Promise.resolve(opts.aoRemover(id)).catch(function () {});
      if (arquivo && alunoId) arquivo.remover(alunoId, id).catch(function () {});
      if (opts.aoMudar) opts.aoMudar(S.historico);
      renderHistorico();
    };
    q("tabs").onclick = function (e) {
      var b = e.target.closest("button"); if (!b) return;
      S.golpe = b.getAttribute("data-g");
      [].forEach.call(this.children, function (x) { x.className = x === b ? "on" : ""; });
      pegaGuia(); S.quadros = null; S.real = false; q("saida").hidden = true; msg("Escolha o vídeo do golpe selecionado e toque em Analisar.");
      if (opts.cotaGolpe) { S.cota = opts.cotaGolpe(S.golpe); atualizaCota(); } // limite por golpe (QuadraLab Player gratuito)
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
          /* espera o quadro novo de fato aparecer depois do seek: em alguns celulares o vídeo muda de tempo antes de mudar a imagem,
             e a pose saía do quadro anterior (poses repetidas e fases erradas) */
          var t = i / fps; await seek(t); await quadroPronto();
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

    /* ── vídeo e boneco lado a lado ──
       O vídeo de verdade à esquerda e, à direita, o boneco do atleta no mesmo instante (a pose do quadro mais próximo do tempo do vídeo).
       Com um modelo escolhido, o modelo aparece atrás do atleta, encaixado no quadril e no tamanho do tronco dele, passando pelas mesmas
       fases nos mesmos tempos; a tabela compara as medidas da fase em que o vídeo está. */
    var VB = { t: 0, tocando: false, ultimo: 0, modeloLms: null, alinhados: null, faseAtual: -1, nomeModelo: "", tipoModelo: "", rodando: false };
    var v2 = q("v2"), bon = q("bon");
    function lerPref(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }
    function gravarPref(k, val) { try { localStorage.setItem(k, val); } catch (e) { /* sem armazenamento */ } }
    function tempoVB() { return v2.getAttribute("src") ? v2.currentTime : VB.t; }
    function fimVB() { var qs = S.quadros || []; return qs.length ? qs[qs.length - 1].t : 0; }
    function quadroEm(t) {
      var qs = S.quadros || [], a = 0, b = qs.length - 1;
      if (!qs.length) return null;
      while (b - a > 1) { var m = (a + b) >> 1; if (qs[m].t <= t) a = m; else b = m; }
      return Math.abs(qs[a].t - t) <= Math.abs(qs[b].t - t) ? qs[a] : qs[b];
    }
    function faseEm(t) { var fs = (S.resultado && S.resultado.fases) || [], k = 0; fs.forEach(function (f, i) { if (f.t <= t + 1e-6) k = i; }); return k; }
    function desenharVB() {
      var r = S.resultado; if (!r) return;
      var c = bon.getContext("2d"), W = bon.width, H = bon.height, t = tempoVB();
      c.fillStyle = "#111"; c.fillRect(0, 0, W, H);
      var qd = quadroEm(t);
      if (qd) {
        var pes = [27, 28, 31, 32].map(function (i) { return qd.lm[i] && qd.lm[i].y; }).filter(isFinite);
        if (pes.length) { var yc = Math.max.apply(null, pes) * H + 6; c.strokeStyle = "#2E3B44"; c.lineWidth = 2; c.beginPath(); c.moveTo(0, yc); c.lineTo(W, yc); c.stroke(); }
      }
      if (VB.alinhados) desenharBoneco(c, B.poseNoTempo(VB.alinhados, r.fases, t), W, H, { cor: "#A5D6A7", corLonge: "#7FB98A", alpha: 0.55, corMao: "#C8E6C9" });
      if (qd) desenharBoneco(c, qd.lm, W, H, { cor: "#4FC3F7", corLonge: "#2B8FBF" });
      var k = faseEm(t);
      c.fillStyle = "rgba(0,0,0,.55)"; c.fillRect(0, 0, W, 30); c.fillStyle = "#fff"; c.font = "bold 16px system-ui"; c.fillText((k + 1) + ". " + r.nomes[k] + " · " + t.toFixed(2) + " s", 10, 21);
      if (VB.alinhados) { c.font = "13px system-ui"; c.fillStyle = "#4FC3F7"; c.fillText("■ Atleta", 10, 50); c.fillStyle = "#A5D6A7"; c.fillText("■ " + (VB.nomeModelo || "Modelo"), 80, 50); }
      if (k !== VB.faseAtual) { VB.faseAtual = k; tabelaModelo(); [].forEach.call(q("faseBt").children, function (b, i) { b.className = i === k ? "on" : ""; }); }
    }
    function ciclo(agora) {
      if (!el.isConnected) { VB.rodando = false; return; }
      if (VB.tocando && !v2.getAttribute("src")) {
        var dt = VB.ultimo ? (agora - VB.ultimo) / 1000 : 0;
        VB.t += dt * (+q("vel").value || 0.5);
        if (VB.t > fimVB()) VB.t = 0;
      }
      VB.ultimo = agora;
      if (!q("saida").hidden) desenharVB();
      requestAnimationFrame(ciclo);
    }
    function irPara(t) {
      VB.tocando = false; q("play").textContent = "▶ Reproduzir";
      t = Math.max(0, Math.min(fimVB(), t));
      if (v2.getAttribute("src")) { v2.pause(); v2.currentTime = t; } else VB.t = t;
      desenharVB();
    }
    q("play").onclick = function () {
      if (v2.getAttribute("src")) { v2.playbackRate = +q("vel").value || 0.5; if (v2.paused) v2.play().catch(function () {}); else v2.pause(); }
      else { VB.tocando = !VB.tocando; VB.ultimo = 0; q("play").textContent = VB.tocando ? "❚❚ Pausar" : "▶ Reproduzir"; }
    };
    v2.addEventListener("play", function () { q("play").textContent = "❚❚ Pausar"; });
    v2.addEventListener("pause", function () { q("play").textContent = "▶ Reproduzir"; });
    v2.addEventListener("ended", function () { q("play").textContent = "▶ Reproduzir"; });
    q("vel").onchange = function () { v2.playbackRate = +q("vel").value || 0.5; };
    function passoQuadro(sentido) { var p = 1 / (+q("fps").value || 30); irPara(tempoVB() + sentido * p); }
    q("qAnt").onclick = function () { passoQuadro(-1); };
    q("qProx").onclick = function () { passoQuadro(1); };
    q("faseBt").onclick = function (e) { var b = e.target.closest("[data-fase]"); if (b && S.resultado) irPara(S.resultado.fases[+b.getAttribute("data-fase")].t); };

    /* modelos: o padrão QuadraLab, os modelos da academia (análises de referência salvas como modelo) e as análises anteriores deste atleta */
    var podeModelos = !!(arquivo && opts.modelos !== false);
    function mesmoGolpeAtual(h) { return h.golpe === golpe() && (golpe() !== "backhand" || String(h.emp) === String(S.emp)); }
    function opcoesModelo() {
      var sel = q("mod"), atual = sel.value || lerPref("qlmov:modelo");
      var html = '<option value="">Nada (só o atleta)</option><option value="padrao">Modelo padrão QuadraLab</option>';
      var anteriores = S.historico.filter(function (h) { return mesmoGolpeAtual(h) && h.id !== S.regId; });
      var montarSel = function (mods) {
        if (mods.length) html += '<optgroup label="Modelos da academia">' + mods.map(function (m) { return '<option value="mod:' + esc(m.id) + '">' + esc(m.nome || "Modelo") + "</option>"; }).join("") + "</optgroup>";
        if (anteriores.length) html += '<optgroup label="Análises anteriores deste atleta">' + anteriores.slice().reverse().map(function (h) { return '<option value="ana:' + esc(h.id) + '">' + esc(data(h.criadoEm)) + " · " + esc(nomeGolpe(h.golpe, h.emp)) + "</option>"; }).join("") + "</optgroup>";
        sel.innerHTML = html;
        sel.value = [].some.call(sel.options, function (o) { return o.value === atual; }) ? atual : "";
        escolherModelo(sel.value);
      };
      montarSel([]);
      if (podeModelos) arquivo.indice("modelos").then(function (ind) { montarSel(ind.itens.filter(mesmoGolpeAtual)); }).catch(function () {});
    }
    function escolherModelo(val) {
      VB.modeloLms = null; VB.alinhados = null; VB.nomeModelo = ""; VB.tipoModelo = val;
      var r = S.resultado, dom = q("dom").value;
      var aplicar = function (lms, nome) {
        if (VB.tipoModelo !== val || !r) return;
        VB.modeloLms = lms; VB.nomeModelo = nome;
        VB.alinhados = lms ? lms.map(function (lm, i) { return B.alinharModelo(lm, r.fases[i].pose, r.proporcao, r.direcao, dom); }) : null;
        if (VB.alinhados && VB.alinhados.some(function (x) { return !x; })) VB.alinhados = null;
        q("bonRot").textContent = VB.alinhados ? "Boneco · atleta × " + nome : "Boneco";
        VB.faseAtual = -1; desenharVB();
      };
      if (!val) { aplicar(null, ""); tabelaModelo(); return; }
      if (val === "padrao") { aplicar(B.modeloPadrao(golpe(), S.emp), "Modelo padrão"); return; }
      var id = val.slice(4);
      if (!arquivo) return;
      Promise.resolve(arquivo.ler(id)).then(function (arq) {
        if (!arq || !arq.resultado) { q("cmpMod").innerHTML = '<p class="qm-msg">Não foi possível abrir este modelo agora.</p>'; return; }
        var nome = val.indexOf("mod:") === 0 ? (arq.nome || "Modelo da academia") : "Análise de " + data(arq.criadoEm);
        aplicar(B.modeloDeResultado(arq.resultado, arq.dom), nome);
      }).catch(function () {});
    }
    q("mod").onchange = function () { gravarPref("qlmov:modelo", this.value.indexOf("ana:") === 0 ? "" : this.value); escolherModelo(this.value); };
    function fmtMedida(v, u) { return v == null || !isFinite(v) ? "—" : u === "°" ? Math.round(v) + "°" : (Math.round(v * 100) / 100).toString().replace(".", ",") + u; }
    function tabelaModelo() {
      var alvo = q("cmpMod"), r = S.resultado;
      if (!r || !VB.modeloLms) { alvo.innerHTML = ""; return; }
      var comp = B.compararModelo(r, q("dom").value, VB.modeloLms), k = Math.max(0, VB.faseAtual), f = comp[k];
      var nota = VB.tipoModelo === "padrao" ? "O modelo padrão é uma técnica de referência desenhada pelo QuadraLab (não é um atleta real): serve de guia visual. Para comparar com um jogador de verdade, analise o vídeo dele e salve como modelo da academia."
        : "Modelo tirado de uma análise de vídeo, encaixado no quadril e no tamanho do tronco do atleta.";
      alvo.innerHTML = "<h4>Atleta × " + esc(VB.nomeModelo) + " · " + esc(r.nomes[k]) + "</h4>" +
        (f && f.linhas.length ? '<table class="qm-cmpm"><thead><tr><th>Medida nesta fase</th><th>Atleta</th><th>Modelo</th><th>Diferença</th></tr></thead><tbody>' + f.linhas.map(function (l) {
          var dif = l.atleta - l.modelo;
          return "<tr><td>" + esc(l.nome) + "</td><td>" + fmtMedida(l.atleta, l.unidade) + "</td><td>" + fmtMedida(l.modelo, l.unidade) + "</td><td>" + (dif > 0 ? "+" : "") + fmtMedida(dif, l.unidade) + "</td></tr>";
        }).join("") + "</tbody></table>" : '<p class="qm-msg">Sem medidas comparáveis nesta fase (pontos do corpo não vistos).</p>') +
        '<p class="qm-msg">' + esc(nota) + "</p>";
    }
    q("salvarMod").onclick = function () {
      var r = S.resultado; if (!r || !arquivo || S.sintetico) return;
      var nome = window.prompt("Nome do modelo (ex.: Forehand do professor, Saque de referência):", (q("atl").value || opts.atleta || "Referência") + " · " + nomeGolpe(golpe(), S.emp));
      if (!nome) return;
      var id = "mod" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), agora = new Date().toISOString();
      var leve = { golpe: r.golpe, nomes: r.nomes, direcao: r.direcao, proporcao: r.proporcao, fases: r.fases.map(function (f) { return { nome: f.nome, t: f.t, quadro: f.quadro, pose: f.pose }; }), itens: [], resumo: r.resumo };
      var arq = { id: id, alunoId: "modelos", nome: nome.slice(0, 80), criadoEm: agora, golpe: golpe(), emp: S.emp, dom: q("dom").value, resultado: leve, fotos: [],
        resumo: { id: id, nome: nome.slice(0, 80), criadoEm: agora, golpe: golpe(), emp: S.emp, dom: q("dom").value, res: { ok: r.resumo.ok, atencao: r.resumo.atencao, nao: r.resumo.nao_avaliavel }, itens: [] } };
      q("salvarMod").disabled = true;
      arquivo.salvar("modelos", arq).then(function () { q("salvoMsg").textContent = "Modelo \"" + arq.nome + "\" salvo: ele aparece em \"Comparar com\" para os golpes iguais de qualquer atleta."; opcoesModelo(); })
        .catch(function (e) { q("salvoMsg").textContent = "Não foi possível salvar o modelo agora (" + ((e && e.message) || "sem conexão") + ")."; })
        .then(function () { q("salvarMod").disabled = false; });
    };
    function prepararVB(sintetico) {
      var r = S.resultado; if (!r) return;
      var prop = r.proporcao > 0.2 && r.proporcao < 5 ? r.proporcao : 0.75;
      bon.width = 480; bon.height = Math.round(480 * prop);
      if (!sintetico && arqUrl) { if (v2.getAttribute("src") !== arqUrl) v2.setAttribute("src", arqUrl); v2.hidden = false; q("v2msg").hidden = true; v2.pause(); v2.currentTime = r.fases[0].t; }
      else { v2.removeAttribute("src"); v2.load(); v2.hidden = true; q("v2msg").hidden = false; VB.t = r.fases[0].t; }
      VB.tocando = false; q("play").textContent = "▶ Reproduzir";
      q("faseBt").innerHTML = r.fases.map(function (f, i) { return '<button data-fase="' + i + '">' + (i + 1) + ". " + esc(r.nomes[i]) + "</button>"; }).join("");
      q("salvarMod").hidden = !(podeModelos && !sintetico);
      VB.faseAtual = -1;
      opcoesModelo();
      if (!VB.rodando) { VB.rodando = true; requestAnimationFrame(ciclo); }
    }

    function mostrar(sintetico, novo) {
      var emp = q("emp").value, dom = q("dom").value;
      S.emp = emp;
      S.quadros = B.limpar ? B.limpar(S.quadros) : S.quadros; /* trocas esquerda/direita e saltos da pose corrigidos (mesmos índices) */
      /* ângulos medidos na proporção real do vídeo (a demonstração sintética já está em unidades iguais) */
      var propVideo = !sintetico && cv.width && cv.height ? cv.height / cv.width : 1;
      var r = B.checklist(S.quadros, dom, regras(), golpe(), emp, propVideo);
      if (r.erro) { msg(r.erro); return; }
      S.resultado = r; S.sintetico = !!sintetico;
      q("saida").hidden = false;
      var c = r.resumo;
      q("kpi").innerHTML = '<div style="background:var(--qok)"><b>' + c.ok + '</b>OK</div><div style="background:var(--qat)"><b>' + c.atencao + '</b>Atenção</div><div style="background:var(--qna)"><b>' + c.nao_avaliavel + "</b>Revisar com treinador</div>";
      var tot = S.quadros[S.quadros.length - 1].t || 1;
      q("tl").innerHTML = r.fases.map(function (f, i) { return '<i style="left:' + (f.t / tot * 100) + '%"></i><em style="left:' + (f.t / tot * 100) + "%;top:" + (i % 2 ? 22 : 0) + 'px">' + (i + 1) + "</em>"; }).join("");
      var fe = q("fases"); fe.innerHTML = ""; var cvs = [];
      var proporcao = sintetico ? 0.75 : (cv.height && cv.width) ? cv.height / cv.width : 0.75;
      r.proporcao = Math.round(proporcao * 1000) / 1000; /* para desenhar a pose de cada fase na proporção do vídeo */
      r.fases.forEach(function (f, i) {
        /* imagem real (esquerda) e boneco da análise (direita) lado a lado */
        var d = document.createElement("div"); d.className = "qm-fase"; var c2 = document.createElement("canvas"); c2.width = 480 * 2 + 8; c2.height = Math.round(480 * proporcao);
        var x = c2.getContext("2d"); x.fillStyle = "#111"; x.fillRect(0, 0, c2.width, c2.height); cvs.push(c2);
        d.appendChild(c2); d.insertAdjacentHTML("beforeend", "<b>" + (i + 1) + ". " + esc(r.nomes[i]) + "</b><span>" + f.t.toFixed(2) + " s</span>");
        d.onclick = function () { if (v.src && !sintetico) v.currentTime = f.t; if (c2.requestFullscreen) c2.requestFullscreen().catch(function () {}); };
        fe.appendChild(d);
      });
      var meu = ++S.token;
      S.canvases = cvs; S.canvasFoto = [];
      S.fotosProntas = (async function () {
        S.fotos = [];
        for (var i = 0; i < r.fases.length; i++) {
          if (meu !== S.token) return;
          var f = r.fases[i], c2 = cvs[i], x = c2.getContext("2d"), W = 480, H = c2.height;
          /* foto da fase (é o que fica guardado): o quadro real do vídeo, sem desenho por cima; o boneco vai ao lado */
          var cf = document.createElement("canvas"); cf.width = W; cf.height = H; var xf = cf.getContext("2d");
          xf.fillStyle = "#111"; xf.fillRect(0, 0, W, H);
          if (!sintetico && v.src) { await seek(f.t); await quadroPronto(); xf.drawImage(v, 0, 0, W, H); }
          else desenhar(cf, S.quadros[f.quadro].lm, W, H);
          xf.fillStyle = "rgba(0,0,0,.55)"; xf.fillRect(0, 0, 150, 26); xf.fillStyle = "#fff"; xf.font = "bold 15px system-ui"; xf.fillText((i + 1) + ". " + r.nomes[i], 8, 18);
          S.canvasFoto[i] = cf;
          try { S.fotos[i] = cf.toDataURL("image/jpeg", 0.8); } catch (e) { S.fotos[i] = ""; }
          x.fillStyle = "#fff"; x.fillRect(0, 0, c2.width, H); x.drawImage(cf, 0, 0);
          x.save(); x.translate(W + 8, 0); x.fillStyle = "#EEF2F0"; x.fillRect(0, 0, W, H);
          desenharBoneco(x, f.pose, W, H, { cor: "#1E88E5", corLonge: "#64B5F6" });
          x.fillStyle = "#5C6B78"; x.font = "17px system-ui"; x.fillText("boneco da análise", 10, H - 12); x.restore();
        }
        await Promise.resolve(); /* mostrar() termina antes (o registro desta análise só existe no fim dele) */
        if (meu === S.token && !sintetico) arquivar();
        /* trecho do golpe para o vídeo e o boneco rodarem juntos no relatório (guardado à parte) */
        S.clip = null;
        if (meu === S.token && !sintetico && v.src) {
          var clip = await capturarClip(r, proporcao, meu);
          if (clip && meu === S.token) { S.clip = clip; if (arquivo && arquivo.salvarClip && S.regAtual) { var idc = S.regAtual.id; S.filaArq = S.filaArq.catch(function () {}).then(function () { return arquivo.salvarClip(idc, clip); }).catch(function () {}); } }
        }
        if (meu === S.token && !sintetico && v.src) await seek(0);
      })().catch(function () { /* a análise continua valendo sem as fotos */ });
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
        S.regId = reg.id; S.regAtual = reg;
        S.historico = S.historico.filter(function (h) { return h.id !== reg.id; }).concat([reg]);
        q("salvoMsg").textContent = "Análise salva no histórico do jogador.";
        /* o relatório completo já vai agora (com a pose de cada fase); as fotos entram quando ficarem prontas */
        if (novo) arquivar(true);
        Promise.resolve(opts.aoSalvar(reg)).then(function () { if (opts.cotaGolpe) { S.cota = opts.cotaGolpe(S.golpe); atualizaCota(); } else if (novo && S.cota && S.cota.limite != null) { S.cota = opts.cotaDe ? opts.cotaDe(S.historico) : B.cota(opts.recurso || "movimento", opts.plano, S.historico); atualizaCota(); } }).catch(function (e) { q("salvoMsg").textContent = e && e.publico ? e.message : "Não foi possível salvar no histórico agora."; });
        if (opts.aoMudar) opts.aoMudar(S.historico);
      } else q("salvoMsg").textContent = sintetico ? "Demonstração: nada foi salvo." : "";
      renderHistorico();
      prepararVB(sintetico);
    }
    /* Trecho do golpe: do começo da primeira fase ao fim da última (com folga), até 40 quadros pequenos do vídeo e a pose de cada um. */
    async function capturarClip(r, prop, meu) {
      var qs = S.quadros, f0 = r.fases[0].t, f1 = r.fases[r.fases.length - 1].t, ini = Math.max(0, f0 - 0.5), fim = f1 + 0.3;
      var sel = qs.filter(function (q2) { return q2.t >= ini && q2.t <= fim; });
      if (sel.length < 2) return null;
      var passo = Math.ceil(sel.length / 40); sel = sel.filter(function (q2, i) { return i % passo === 0; });
      var W = 216, H = Math.round(W * prop), c = document.createElement("canvas"); c.width = W; c.height = H; var x = c.getContext("2d");
      var clip = { prop: Math.round(prop * 1000) / 1000, t: [], fotos: [], poses: [], fases: r.fases.map(function (f) { return f.t; }), nomes: r.nomes.slice() };
      for (var i = 0; i < sel.length; i++) {
        if (meu !== S.token) return null;
        await seek(sel[i].t); await quadroPronto();
        x.drawImage(v, 0, 0, W, H);
        var src; try { src = c.toDataURL("image/jpeg", 0.6); } catch (e) { return null; }
        clip.t.push(Math.round(sel[i].t * 1000) / 1000); clip.fotos.push(src);
        clip.poses.push(sel[i].lm.map(function (p) { return p && isFinite(p.x) && isFinite(p.y) && (p.v == null || p.v >= 0.2) ? [Math.round(p.x * 1000) / 1000, Math.round(p.y * 1000) / 1000] : null; }));
      }
      /* sempre cabe num documento: tira um quadro sim, outro não, até caber */
      while (JSON.stringify(clip).length > 850000 && clip.t.length > 8) ["t", "fotos", "poses"].forEach(function (k) { clip[k] = clip[k].filter(function (z, i) { return i % 2 === 0; }); });
      return clip;
    }
    /* relatório completo (checklist com pareceres, fases, fotos, conclusão, comparação) no arquivo da academia */
    /* Fotos das fases para o arquivo: reduzidas para caber sempre no documento do relatório (vídeo de celular em pé gera
       fotos altas e pesadas; sem isto o relatório passava do limite e era guardado sem nenhuma foto). */
    function fotosParaArquivo(lado, qualidade) {
      return (S.fotos || []).map(function (src, i) {
        var c = (S.canvasFoto || [])[i];   /* só a foto real; o boneco ao lado é desenhado de novo a partir da pose guardada */
        if (!c || !c.width || !S.fotos[i]) return S.fotos[i] || "";
        var k = Math.min(1, lado / Math.max(c.width, c.height)), o = document.createElement("canvas");
        o.width = Math.max(1, Math.round(c.width * k)); o.height = Math.max(1, Math.round(c.height * k));
        o.getContext("2d").drawImage(c, 0, 0, o.width, o.height);
        try { return o.toDataURL("image/jpeg", qualidade); } catch (e) { return S.fotos[i] || ""; }
      });
    }
    /* Relatório guardado no aparelho enquanto não chega ao arquivo (sem conexão, tela fechada no meio): na próxima vez que a análise
       de movimento abrir para este jogador, ele é enviado de novo. */
    var PEND = "qlmov:pend:";
    function chavePend(id) { return PEND + alunoId + ":" + id; }
    function guardarPendente(arq) {
      try { localStorage.setItem(chavePend(arq.id), JSON.stringify(arq)); }
      catch (e) { try { var leve = {}; for (var k in arq) leve[k] = arq[k]; leve.fotos = []; localStorage.setItem(chavePend(arq.id), JSON.stringify(leve)); } catch (e2) { /* sem espaço no aparelho */ } }
    }
    function tirarPendente(id) { try { localStorage.removeItem(chavePend(id)); } catch (e) { /* sem armazenamento */ } }
    function reenviarPendentes() {
      var chaves = [];
      try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf(PEND + alunoId + ":") === 0) chaves.push(k); } } catch (e) { return; }
      chaves.forEach(function (k) {
        var arq = null; try { arq = JSON.parse(localStorage.getItem(k)); } catch (e) { arq = null; }
        if (!arq || !arq.id) { try { localStorage.removeItem(k); } catch (e) { /* nada */ } return; }
        S.filaArq = S.filaArq.then(function () { return arquivo.salvar(alunoId, arq); }).then(function () { tirarPendente(arq.id); }).catch(function () { /* fica para a próxima */ });
      });
    }
    S.filaArq = Promise.resolve();
    function arquivar(preliminar) {
      if (!arquivo || !alunoId || !S.regAtual || !opts.aoSalvar) return;
      var reg = S.regAtual, meu = S.token, el2 = q("salvoMsg");
      var arq = { id: reg.id, alunoId: alunoId, criadoEm: reg.criadoEm, golpe: reg.golpe, emp: reg.emp, dom: reg.dom, atleta: q("atl").value || opts.atleta || "", cabecalho: opts.cabecalho || "",
        resultado: S.resultado, fotos: [], comparacao: S.comparacao || null, resumo: reg };
      if (preliminar) arq.fotosPendentes = true;
      else {
        var tentativas = [[560, 0.78], [440, 0.66], [340, 0.55], [260, 0.45], [200, 0.4]];
        for (var k = 0; k < tentativas.length; k++) {
          arq.fotos = fotosParaArquivo(tentativas[k][0], tentativas[k][1]);
          if (JSON.stringify(arq).length < 850000) break;
        }
      }
      guardarPendente(arq);
      if (!preliminar) el2.textContent = "Guardando o relatório completo…";
      /* em fila: a versão com fotos nunca é sobrescrita pela preliminar que chegue depois */
      S.filaArq = S.filaArq.catch(function () {}).then(function () { return arquivo.salvar(alunoId, arq); }).then(function () {
        if (!preliminar) tirarPendente(arq.id);
        if (!preliminar && meu === S.token) el2.textContent = "Relatório guardado com as imagens de cada fase. Ele fica em \"Análises salvas\" e pode ser reaberto quando quiser.";
      }).catch(function (e) {
        if (preliminar || meu !== S.token) return;
        el2.innerHTML = esc("Não foi possível guardar o relatório completo agora (" + ((e && e.message) || "sem conexão") + "). Ele ficou guardado neste aparelho e será enviado na próxima vez. ") + '<button class="qm-x" data-r="resalvar">Tentar de novo</button>';
      });
      return S.filaArq;
    }
    q("salvoMsg").onclick = function (e) { if (e.target.closest("[data-r=resalvar]")) arquivar(); };
    if (arquivo && alunoId) reenviarPendentes();
    /* o histórico também vem do arquivo da academia: o que estiver lá e faltar no jogador volta; o que só existe no jogador entra no arquivo */
    if (arquivo && alunoId) arquivo.indice(alunoId).then(function (ind) {
      var antes = S.historico, junto = raiz.QLMovArquivo.juntar(antes, ind);
      var mudou = junto.length !== antes.length || junto.some(function (h) { return !antes.some(function (x) { return x.id === h.id; }); });
      var soNoJogador = antes.filter(function (h) { return ind.removidos.indexOf(h.id) < 0 && !ind.itens.some(function (x) { return x.id === h.id; }); });
      if (mudou) {
        S.historico = junto;
        if (S.cota && S.cota.limite != null && opts.cotaDe) S.cota = opts.cotaDe(S.historico);
        atualizaCota(); renderHistorico();
        if (opts.aoMudar) opts.aoMudar(S.historico);
        if (opts.aoRecuperar) opts.aoRecuperar(S.historico.slice());
      }
      if (soNoJogador.length) arquivo.registrar(alunoId, soNoJogador).catch(function () {});
    }).catch(function () { /* sem conexão: fica o que está no jogador */ });
    function injetar(quadros, o) { o = o || {}; S.quadros = quadros; S.real = !o.sintetico; S.regId = null; mostrar(!!o.sintetico, true); }
    q("pdf").onclick = function () {
      if (!S.resultado) return;
      var w = window.open("", "_blank");
      if (!w) { alert("O navegador bloqueou a janela do relatório — permita pop-ups para este site e tente de novo."); return; }
      w.document.write('<!doctype html><meta charset="utf-8"><title>Preparando o relatório…</title><p style="font:14px system-ui,sans-serif;padding:20px;color:#14202B">Preparando as imagens das fases…</p>');
      /* espera as fotos das fases ficarem prontas, para o PDF nunca sair sem elas */
      Promise.resolve(S.fotosProntas).catch(function () {}).then(function () {
        var hist = S.historico.filter(function (h) { return h.golpe === golpe(); });
        w.document.open();
        w.document.write(relatorioHTML({ resultado: S.resultado, golpe: golpe(), emp: S.emp, dom: q("dom").value, atleta: q("atl").value || opts.atleta || "", fotos: S.fotos, logo: opts.logoAbsoluto || logo, demo: S.sintetico, comparacao: S.comparacao, historico: hist, cabecalho: opts.cabecalho, clip: S.clip }));
        w.document.close();
      });
    };
    q("json").onclick = function () {
      var b = new Blob([JSON.stringify({ gerado: new Date().toISOString(), golpe: golpe(), dominante: q("dom").value, resultado: S.resultado }, null, 1)], { type: "application/json" }), a = document.createElement("a");
      a.href = URL.createObjectURL(b); a.download = "analise-movimento.json"; a.click();
    };
    if (opts.atleta) q("atl").value = opts.atleta;
    pegaGuia(); atualizaCota(); renderHistorico();
    return { injetar: injetar, seek: seek, estado: S, tempoVideoBoneco: function () { return tempoVB(); }, atualizarHistorico: function (h, cota) { S.historico = h.slice(); if (cota) S.cota = cota; atualizaCota(); renderHistorico(); } };
  }

  raiz.QLMovimento = { montar: montar, imagensFases: imagensFases, desenharBoneco: desenharBoneco, evolucaoHTML: evolucaoHTML, comparacaoHTML: comparacaoHTML, relatorioHTML: relatorioHTML, badgeHTML: badgeHTML, abrirRelatorio: abrirRelatorio, listaHTML: listaHTML };
})(typeof window !== "undefined" ? window : this);
