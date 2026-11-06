/* Sequência das fases para os cursos da Academia Digital, montada de uma análise de movimento salva (app do treinador).
   Usa as fotos reais de cada fase guardadas no arquivo da análise (orgs/{org}/dados/mty:movrel:v1:{id}) e a pose de cada fase
   (pontos do corpo, 0–1 no quadro) para recortar o atleta do mesmo tamanho nas 6 fases; o esqueleto é opcional.
   QLIlustracaoFases.montar(arq, { esqueleto, titulo, kicker, nomeGolpe }) -> Promise<"data:image/jpeg;base64,..."> (até ~650 KB) */
(function (raiz) {
  var COR = { fundo: "#0C1D16", fundo2: "#12291F", texto: "#F3F7F4", suave: "#A9BBB1", lima: "#E4F542", borda: "rgba(255,255,255,.10)" };
  var FONTE = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, system-ui, sans-serif";
  var LIG = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32]];
  var NOME_GOLPE = { forehand: "forehand", backhand: "backhand", saque: "saque" };

  function ponto(lm, i) { var p = lm && lm[i]; if (!p) return null; var x = Array.isArray(p) ? p[0] : p.x, y = Array.isArray(p) ? p[1] : p.y; return isFinite(x) && isFinite(y) ? { x: x, y: y } : null; }
  function carregar(src) {
    return new Promise(function (ok) { if (!src) return ok(null); var im = new Image(); im.onload = function () { ok(im); }; im.onerror = function () { ok(null); }; im.src = src; });
  }
  /* caixa do corpo na fase (0–1), com a cabeça e uma folga para a raquete */
  function caixa(lm) {
    var xs = [], ys = [];
    for (var i = 0; i < 33; i++) { var p = ponto(lm, i); if (p) { xs.push(p.x); ys.push(p.y); } }
    if (xs.length < 6) return null;
    return { x0: Math.min.apply(null, xs), x1: Math.max.apply(null, xs), y0: Math.min.apply(null, ys), y1: Math.max.apply(null, ys) };
  }
  function nomeFase(arq, i) { var r = arq.resultado || {}; return (r.nomes && r.nomes[i]) || ((r.fases || [])[i] || {}).nome || "Fase " + (i + 1); }
  function golpeTxt(arq) { var g = NOME_GOLPE[arq.golpe] || arq.golpe || "golpe"; return arq.golpe === "backhand" ? "backhand de " + (String(arq.emp) === "1" ? "uma mão" : "duas mãos") : g; }

  function montar(arq, o) {
    o = o || {};
    var fases = ((arq && arq.resultado) || {}).fases || [], fotos = (arq && arq.fotos) || [];
    if (!fases.length || !fotos.filter(Boolean).length) return Promise.reject(new Error("Esta análise foi guardada sem as fotos das fases."));
    return Promise.all(fotos.slice(0, 6).map(carregar)).then(function (ims) {
      var n = Math.min(6, fases.length), col = 3, lin = Math.ceil(n / col);
      var W = 1200, M = 48, G = 22, cw = Math.floor((W - 2 * M - (col - 1) * G) / col), ch = Math.round(cw * 4 / 3), topo = 176, legenda = 58;
      var H = topo + lin * (ch + legenda) + (lin - 1) * 12 + 70;
      var c = document.createElement("canvas"); c.width = W; c.height = H; var x = c.getContext("2d");
      var gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, COR.fundo2); gr.addColorStop(1, COR.fundo); x.fillStyle = gr; x.fillRect(0, 0, W, H);
      /* cabeçalho */
      x.fillStyle = COR.lima; x.fillRect(M, 48, 34, 4);
      x.font = "800 19px " + FONTE; x.fillText(String(o.kicker || "Técnica · " + golpeTxt(arq)).toUpperCase(), M + 48, 57);
      x.fillStyle = COR.texto; x.font = "800 44px " + FONTE; x.fillText(o.titulo || "As seis fases do " + golpeTxt(arq), M, 112);
      x.fillStyle = COR.suave; x.font = "500 21px " + FONTE; x.fillText("Quadros reais de uma análise de movimento · Metodologia MTY", M, 148);
      /* mesmo tamanho de recorte nas 6 fases: o maior corpo, com folga (raquete e pés) */
      var cxs = [], alt = 0;
      for (var i = 0; i < n; i++) {
        var im = ims[i], b = caixa(fases[i].pose);
        if (!im || !b) { cxs.push(null); continue; }
        var prop = im.naturalHeight / im.naturalWidth;
        cxs.push({ cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2 });
        alt = Math.max(alt, (b.y1 - b.y0) * 1.35, (b.x1 - b.x0) * 1.35 * 4 / 3 / prop); /* altura do recorte (fração da foto) que cabe o corpo em 3:4 */
      }
      alt = Math.min(1, Math.max(alt, 0.35));
      for (var k = 0; k < n; k++) {
        var cx0 = M + (k % col) * (cw + G), cy0 = topo + Math.floor(k / col) * (ch + legenda + 12), img = ims[k], cen = cxs[k];
        x.save(); x.beginPath(); if (x.roundRect) x.roundRect(cx0, cy0, cw, ch, 18); else x.rect(cx0, cy0, cw, ch); x.clip();
        x.fillStyle = "#0A1510"; x.fillRect(cx0, cy0, cw, ch);
        if (img && cen) {
          var iw = img.naturalWidth, ih = img.naturalHeight, sh = alt * ih, sw = sh * 3 / 4;
          if (sw > iw) { sw = iw; sh = sw * 4 / 3; }
          /* recorte sempre dentro da foto (sem faixa vazia na borda) */
          var sx = Math.max(0, Math.min(iw - sw, cen.cx * iw - sw / 2)), sy = Math.max(0, Math.min(ih - sh, cen.cy * ih - sh / 2));
          /* a foto guardada tem o nome da fase escrito no canto: cobre com a faixa de baixo dele antes de recortar */
          var tmp = document.createElement("canvas"); tmp.width = iw; tmp.height = ih; var tx = tmp.getContext("2d");
          tx.drawImage(img, 0, 0); var kk = iw / 480, lw = Math.ceil(152 * kk), lh = Math.ceil(27 * kk);
          tx.drawImage(img, 0, Math.min(ih - 1, lh + 1), lw, 1, 0, 0, lw, lh);
          x.drawImage(tmp, sx, sy, sw, sh, cx0, cy0, cw, ch);
          if (o.esqueleto) {
            var lm = fases[k].pose, P = function (j) { var p = ponto(lm, j); return p ? [cx0 + (p.x * iw - sx) / sw * cw, cy0 + (p.y * ih - sy) / sh * ch] : null; };
            x.lineCap = "round"; x.lineJoin = "round";
            LIG.forEach(function (l) { var a = P(l[0]), b2 = P(l[1]); if (!a || !b2) return;
              x.strokeStyle = "rgba(0,0,0,.45)"; x.lineWidth = 7; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b2[0], b2[1]); x.stroke();
              x.strokeStyle = COR.lima; x.lineWidth = 3.5; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b2[0], b2[1]); x.stroke(); });
            [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].forEach(function (j) { var p = P(j); if (!p) return; x.fillStyle = "#fff"; x.beginPath(); x.arc(p[0], p[1], 4.5, 0, 7); x.fill(); });
          }
        }
        var vg = x.createLinearGradient(0, cy0 + ch * 0.62, 0, cy0 + ch); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.45)"); x.fillStyle = vg; x.fillRect(cx0, cy0, cw, ch);
        x.restore();
        x.strokeStyle = COR.borda; x.lineWidth = 1.5; x.beginPath(); if (x.roundRect) x.roundRect(cx0 + .75, cy0 + .75, cw - 1.5, ch - 1.5, 18); else x.rect(cx0, cy0, cw, ch); x.stroke();
        /* número e nome da fase */
        var ly = cy0 + ch + 36;
        x.fillStyle = COR.lima; x.beginPath(); x.arc(cx0 + 17, ly - 8, 17, 0, 7); x.fill();
        x.fillStyle = COR.fundo; x.font = "800 18px " + FONTE; x.textAlign = "center"; x.fillText(String(k + 1), cx0 + 17, ly - 2); x.textAlign = "left";
        x.fillStyle = COR.texto; x.font = "800 24px " + FONTE; x.fillText(nomeFase(arq, k), cx0 + 46, ly);
      }
      x.fillStyle = COR.suave; x.font = "600 17px " + FONTE; x.fillText("Análise de movimento · Tecnologia QuadraLab", M, H - 30);
      /* cabe num documento: baixa a qualidade até ficar abaixo de ~650 KB */
      var q = 0.86, url = c.toDataURL("image/jpeg", q);
      while (url.length > 650000 && q > 0.45) { q -= 0.08; url = c.toDataURL("image/jpeg", q); }
      return url;
    });
  }
  raiz.QLIlustracaoFases = { montar: montar, golpeTxt: golpeTxt };
})(typeof self !== "undefined" ? self : this);
