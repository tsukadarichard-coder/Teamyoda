/* Salvar como PDF / Imprimir nos relatórios abertos pelo app (scout, movimento, mês, atleta, equipe, aluno…).
   No iPhone e no iPad, o "Imprimir" de uma página aberta pelo app não faz nada quando o app está na tela inicial (limitação do iOS).
   Lá o botão do relatório passa a gerar o PDF no próprio aparelho e abrir o Compartilhar (Imprimir, Salvar em Arquivos, WhatsApp…);
   nos outros aparelhos continua o imprimir do navegador.
   Carregado na página do app: toda janela de relatório aberta com window.open("") recebe isso sozinha (nenhum relatório precisa mudar).

   Diagramação do PDF no aparelho: o relatório é copiado para uma folha à parte, na largura de uma página A4 (733 px úteis), com as regras
   @media print do próprio relatório aplicadas. Assim ele sai como na impressão do computador, e não no layout de celular (antes: uma coluna,
   gráficos do tamanho da página, fonte gigante). Gráficos em canvas são copiados pixel a pixel. Nada que caiba numa página é cortado ao
   meio, e todo título fica junto do bloco que vem depois dele. Na impressão do navegador entram as mesmas regras de quebra (CSS_QUEBRA). */
(function (raiz) {
  "use strict";
  var LIB = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
  var Q = raiz.QLImprimir = raiz.QLImprimir || {};
  Q.LIB = Q.LIB || LIB;
  var LARG = 733;                       /* A4 (210 mm) menos as margens laterais de 8 mm: 194 mm a 96 dpi */
  var ALT_PAG = Math.round(LARG * 279 / 194); /* altura útil da página (297 mm − 18 mm de margens) na mesma escala */
  var EVITAR = ["tr", "img", "svg", "canvas", "figure", "li", "h1", "h2", "h3", "h4", "blockquote", "pre", "table", ".f", ".pr", ".kpi", ".kpis > *", ".card", ".cartao",
    ".bloco", ".medida", ".fase", ".evita-quebra", "[class*='card']", "[class*='kpi']", "[class*='bloco']", "[class*='grafico']", "[class*='graf']", "[class*='cartao']",
    "[class*='item']", "[class*='linha']", "[class*='prio']", ".grid > *", ".grade > *", "section > div", "article"];
  /* impressão do navegador: não cortar blocos nem deixar título sozinho no pé da página; cores de fundo preservadas */
  var CSS_QUEBRA = "@media print{h1,h2,h3,h4,h5{break-after:avoid;page-break-after:avoid}" +
    "tr,img,svg,canvas,figure,li,blockquote,pre,.kpi,.card,.cartao,.bloco,.medida,.fase,.evita-quebra,[class*='card'],[class*='kpi'],[class*='bloco'],[class*='grafico'],[class*='cartao'],[class*='prio']{break-inside:avoid;page-break-inside:avoid}" +
    "thead{display:table-header-group}.no-print,.nop,#ql-pdf-aviso{display:none !important}p{orphans:3;widows:3}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}";

  function ehIOS() {
    var n = raiz.navigator || {}, ua = n.userAgent || "";
    return /iPad|iPhone|iPod/.test(ua) || (n.platform === "MacIntel" && n.maxTouchPoints > 1);
  }
  function aviso(j, html) {
    var d = j.document, a = d.getElementById("ql-pdf-aviso");
    if (!a) {
      a = d.createElement("div"); a.id = "ql-pdf-aviso"; a.setAttribute("role", "status"); a.setAttribute("data-sem-pdf", "1");
      a.style.cssText = "position:fixed;left:12px;right:12px;bottom:12px;z-index:99999;background:#0B3B2E;color:#fff;border-radius:12px;padding:14px 16px;font:15px system-ui,-apple-system,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.25)";
      d.body.appendChild(a);
    }
    a.innerHTML = html;
    return a;
  }
  function nomeArquivo(d) { return String(d.title || "Relatório").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 90) || "Relatório"; }
  function injetarQuebras(j) {
    try { var d = j.document; if (!d || !d.head || d.getElementById("ql-quebras")) return; var s = d.createElement("style"); s.id = "ql-quebras"; s.textContent = CSS_QUEBRA; d.head.appendChild(s); } catch (e) { /* janela de outro endereço */ }
  }

  /* a regra @media print do relatório passa a valer na folha do PDF (que é uma tela) */
  function aplicarPrint(fd) {
    var extra = [];
    function varrer(regras) {
      for (var i = 0; i < regras.length; i++) {
        var r = regras[i];
        if (r.type === 4 && r.media) { var m = String(r.media.mediaText || ""); if (/print/.test(m) && !/screen/.test(m)) { for (var k = 0; k < r.cssRules.length; k++) extra.push(r.cssRules[k].cssText); } else varrer(r.cssRules); }
      }
    }
    for (var s = 0; s < fd.styleSheets.length; s++) { try { varrer(fd.styleSheets[s].cssRules || []); } catch (e) { /* folha de outro endereço (fontes) */ } }
    if (extra.length) { var st = fd.createElement("style"); st.id = "ql-pdf-print"; st.textContent = extra.join("\n"); fd.head.appendChild(st); }
  }
  /* título sozinho no pé da página: prende o título ao bloco seguinte quando os dois cabem juntos numa página */
  function prenderTitulos(fd, fw) {
    var hs = fd.body.querySelectorAll("h1,h2,h3,h4,h5");
    for (var i = 0; i < hs.length; i++) {
      var h = hs[i], prox = h.nextElementSibling, pai = h.parentNode;
      if (!prox || !pai || /^(H1|H2|H3|H4|H5|SCRIPT|STYLE)$/.test(prox.tagName)) continue;
      var disp = fw.getComputedStyle(pai).display;
      if (disp !== "block" && disp !== "flow-root" && disp !== "list-item") continue;
      if (h.getBoundingClientRect().height + prox.getBoundingClientRect().height > ALT_PAG * 0.85) continue;
      var w = fd.createElement("div"); w.className = "evita-quebra"; w.style.cssText = "display:flow-root";
      pai.insertBefore(w, h); w.appendChild(h); w.appendChild(prox);
    }
  }
  /* paginação feita aqui: o "evitar quebra" da biblioteca põe um bloco vazio antes do elemento, o que vira uma célula nova
     nas grades de gráficos e desmonta a página. Aqui cada bloco que cruzaria o fim da página desce para a próxima com
     margem (linhas de tabela ganham uma linha vazia e o cabeçalho da tabela de novo) */
  function paginar(fd, fw) {
    var corpo = fd.body, lista;
    try { lista = [].slice.call(corpo.querySelectorAll(EVITAR.concat([".quebra", "h5"]).join(","))); } catch (e) { return; }
    function y(v) { return v - corpo.getBoundingClientRect().top; }
    /* quanto do que vem depois de um título (ou do cabeçalho de uma tabela) precisa caber com ele: o primeiro bloco */
    function precisa(el) {
      var prox = el.tagName === "TR" ? (el.closest("table").tBodies[0] || {}).rows : null;
      if (prox) return prox.length ? Math.min(140, prox[0].getBoundingClientRect().height * 3) : 0;
      var alvo = el.nextElementSibling, n = 0;
      while (alvo && alvo.getBoundingClientRect().height > ALT_PAG * 0.4 && alvo.firstElementChild && n++ < 6) alvo = alvo.firstElementChild;
      if (!alvo) return 0;
      var h = alvo.getBoundingClientRect().height, seg = alvo.nextElementSibling;
      /* uma linha de explicação logo abaixo do título: conta também o bloco que vem depois dela */
      if (h < 80 && seg && el.nextElementSibling === alvo) h += Math.min(seg.getBoundingClientRect().height, 120);
      return Math.max(60, Math.min(h, ALT_PAG * 0.4));
    }
    function ehTitulo(e) { return !!e && (/^H[1-5]$/.test(e.tagName) || (e.classList.contains("evita-quebra") && !!e.firstElementChild && /^H[1-5]$/.test(e.firstElementChild.tagName))); }
    /* o título (com a linha de explicação) que vem logo antes de um bloco: se o bloco desce de página, o título desce junto */
    function tituloAntes(e) {
      var n = 0;
      while (e && e !== corpo && !e.previousElementSibling && n++ < 4) e = e.parentNode;
      if (!e || e === corpo) return null;
      var ant = e.previousElementSibling;
      if (ehTitulo(ant)) return ant;
      if (ant && ant.getBoundingClientRect().height < 80 && ehTitulo(ant.previousElementSibling)) return ant.previousElementSibling;
      return null;
    }
    function empurrar(e, quanto) {
      var m = parseFloat(fw.getComputedStyle(e).marginTop) || 0;
      e.style.setProperty("margin-top", (m + quanto) + "px", "important");
    }
    for (var i = 0; i < lista.length && i < 4000; i++) {
      var el = lista[i], titulo = /^H[1-5]$/.test(el.tagName), quebra = el.classList.contains("quebra");
      var cabecalho = el.tagName === "TR" && el.parentNode && el.parentNode.tagName === "THEAD";
      var cs = fw.getComputedStyle(el);
      if (el.tagName !== "TR" && (/^(inline|contents|none|table-cell|table-row-group|table-header-group)$/.test(cs.display) || /^(absolute|fixed)$/.test(cs.position))) continue;
      for (var t = 0; t < 4; t++) {
        var r = el.getBoundingClientRect(); if (!r.height) break;
        var topo = y(r.top), base = y(r.bottom), fim = (Math.floor(topo / ALT_PAG) + 1) * ALT_PAG, falta = fim - topo;
        if (falta < 1 || falta >= ALT_PAG - 1) break; /* já começa no topo de uma página */
        /* título sem pelo menos ~60 px de conteúdo embaixo vai junto para a próxima página */
        var desce = quebra || (base > fim + 0.5 && r.height <= ALT_PAG * 0.92 && (r.height <= ALT_PAG * 0.45 || falta <= ALT_PAG * 0.3)) || ((titulo || cabecalho) && base + precisa(el) > fim);
        if (!desce) break;
        if (!titulo && !quebra && el.tagName !== "TR") {
          var tit = tituloAntes(el), tt = tit ? y(tit.getBoundingClientRect().top) : -1;
          if (tit && tt > fim - ALT_PAG + 1 && tt < fim - 1) { empurrar(tit, fim - tt); continue; }
        }
        if (el.tagName === "TR") {
          var tab = el.closest("table"), cab = tab && tab.tHead, cols = 0;
          [].forEach.call(el.cells, function (c) { cols += c.colSpan || 1; });
          var esp = fd.createElement("tr"), td = fd.createElement("td");
          esp.className = "ql-esp"; td.colSpan = Math.max(1, cols);
          td.style.cssText = "height:" + falta + "px !important;padding:0 !important;border:0 !important;background:#fff !important;line-height:0 !important;font-size:0 !important";
          esp.appendChild(td); el.parentNode.insertBefore(esp, el);
          if (cab && cab.rows.length && el.parentNode !== cab) [].forEach.call(cab.rows, function (cr) { el.parentNode.insertBefore(cr.cloneNode(true), el); });
          var sobra = y(esp.getBoundingClientRect().bottom) - fim; /* acerta se a linha vazia saiu maior ou menor */
          if (Math.abs(sobra) > 1) td.style.setProperty("height", Math.max(0, falta - sobra) + "px", "important");
          break;
        }
        empurrar(el, falta);
      }
    }
  }
  /* foto com "object-fit" (quadros do vídeo no caderno, fases do golpe) saía esticada no PDF do iPhone: a biblioteca não
     entende object-fit, então cada foto recebe o tamanho que de fato aparece (contain) ou vira o recorte já feito (cover) */
  function fixarFotos(fd, fw) {
    [].slice.call(fd.querySelectorAll("img")).forEach(function (im) {
      var cs = fw.getComputedStyle(im), modo = cs.objectFit;
      if (!/^(contain|cover|scale-down)$/.test(modo) || !im.naturalWidth || !im.naturalHeight) return;
      var r = im.getBoundingClientRect(); if (!r.width || !r.height) return;
      var nw = im.naturalWidth, nh = im.naturalHeight, bw = r.width, bh = r.height;
      if (modo === "cover") {
        try {
          var k = Math.max(bw / nw, bh / nh), sw = bw / k, sh = bh / k, cv = fd.createElement("canvas");
          cv.width = Math.round(bw * 2); cv.height = Math.round(bh * 2);
          cv.getContext("2d").drawImage(im, (nw - sw) / 2, (nh - sh) / 2, sw, sh, 0, 0, cv.width, cv.height);
          im.src = cv.toDataURL("image/jpeg", 0.9);
          im.style.setProperty("width", bw + "px", "important"); im.style.setProperty("height", bh + "px", "important");
          im.style.setProperty("object-fit", "fill", "important");
        } catch (e) { /* foto de outro site: fica como está */ }
        return;
      }
      var e = Math.min(bw / nw, bh / nh); if (modo === "scale-down") e = Math.min(e, 1);
      var w = nw * e, h = nh * e, padV = (bh - h) / 2, padH = (bw - w) / 2;
      im.style.setProperty("width", bw + "px", "important"); im.style.setProperty("height", bh + "px", "important");
      im.style.setProperty("box-sizing", "border-box", "important");
      im.style.setProperty("padding", padV + "px " + padH + "px", "important");
      im.style.setProperty("object-fit", "fill", "important"); im.style.setProperty("max-height", "none", "important");
    });
  }
  /* gráfico SVG com "width:100%;height:auto" e sem largura/altura no próprio SVG saía ampliado e cortado no PDF do iPhone:
     cada SVG recebe o tamanho em pixels que ocupa na folha */
  function fixarSVGs(fd) {
    [].slice.call(fd.querySelectorAll("svg")).forEach(function (s) {
      if (s.parentNode && s.parentNode.closest && s.parentNode.closest("svg")) return;
      var r = s.getBoundingClientRect(); if (!r.width || !r.height) return;
      var w = Math.round(r.width * 100) / 100, h = Math.round(r.height * 100) / 100;
      s.setAttribute("width", w); s.setAttribute("height", h);
      s.style.setProperty("width", w + "px", "important"); s.style.setProperty("height", h + "px", "important");
    });
  }
  function esperarImagens(fd, ms) {
    var imgs = [].slice.call(fd.images || []).filter(function (im) { return !im.complete; });
    var fontes = fd.fonts && fd.fonts.ready ? fd.fonts.ready : Promise.resolve();
    /* folhas de estilo em arquivo (telas do app impressas direto): as regras de impressão só podem ser lidas depois que elas chegam */
    var folhas = [].slice.call(fd.querySelectorAll("link[rel~='stylesheet']")).filter(function (l) { try { return !l.sheet || !l.sheet.cssRules; } catch (e) { return false; } });
    var esperas = imgs.map(function (im) { return new Promise(function (ok) { im.onload = im.onerror = ok; }); })
      .concat(folhas.map(function (l) { return new Promise(function (ok) { l.addEventListener("load", ok); l.addEventListener("error", ok); }); }));
    return Promise.race([Promise.all(esperas.concat([fontes])), new Promise(function (ok) { setTimeout(ok, ms); })]);
  }

  function gerar(j) {
    var d = j.document;
    if (j.__qlGerandoPDF) return;
    j.__qlGerandoPDF = true;
    aviso(j, "Gerando o PDF…");
    var folha = null;
    function limpar() { if (folha && folha.parentNode) folha.parentNode.removeChild(folha); folha = null; }
    function falha(msg) {
      limpar(); j.__qlGerandoPDF = false;
      aviso(j, esc(msg) + ' <button type="button" id="ql-pdf-fechar" style="margin-left:8px;font:inherit;padding:6px 10px;border-radius:8px;border:0">OK</button>');
      var b = d.getElementById("ql-pdf-fechar"); if (b) b.onclick = function () { var a = d.getElementById("ql-pdf-aviso"); if (a) a.remove(); };
    }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

    /* a folha do PDF: uma cópia do relatório, sem os botões e sem scripts, na largura de uma página A4 */
    try {
      folha = d.createElement("iframe"); folha.setAttribute("aria-hidden", "true"); folha.setAttribute("data-sem-pdf", "1"); folha.tabIndex = -1;
      folha.style.cssText = "position:fixed;left:-12000px;top:0;width:" + LARG + "px;height:" + ALT_PAG + "px;border:0;opacity:0;pointer-events:none";
      d.body.appendChild(folha);
      var copia = d.documentElement.cloneNode(true);
      [].slice.call(copia.querySelectorAll("script, #ql-pdf-aviso, iframe, .no-print, .nop, .vbr, [data-sem-pdf]")).forEach(function (e) { e.parentNode.removeChild(e); });
      var fd = folha.contentDocument, fw = folha.contentWindow;
      fd.open(); fd.write("<!doctype html>" + copia.outerHTML); fd.close();
      /* gráficos desenhados em canvas: o clone vem em branco, então os pixels são copiados */
      var origem = [].slice.call(d.querySelectorAll("canvas")).filter(function (c) { return !c.closest || !c.closest(".no-print, .nop, .vbr, [data-sem-pdf]"); }), destino = fd.querySelectorAll("canvas");
      for (var i = 0; i < Math.min(origem.length, destino.length); i++) { try { destino[i].width = origem[i].width; destino[i].height = origem[i].height; destino[i].getContext("2d").drawImage(origem[i], 0, 0); } catch (e) { /* canvas protegido */ } }
      /* valores digitados (observação do treinador, por exemplo) */
      var campos = d.querySelectorAll("textarea, input"), camposC = fd.querySelectorAll("textarea, input");
      for (var c = 0; c < Math.min(campos.length, camposC.length); c++) { try { camposC[c].value = campos[c].value; if (camposC[c].tagName === "TEXTAREA") camposC[c].textContent = campos[c].value; } catch (e) { /* */ } }
    } catch (e) { return falha("Não foi possível preparar o PDF (" + (e.message || "erro") + "). Tente de novo."); }

    function pronto() {
      var fd = folha.contentDocument, fw = folha.contentWindow;
      var base = fd.createElement("style"); base.id = "ql-pdf-base";
      /* fonte com nome de verdade: o desenho do PDF no iPhone não entende "system-ui"/"-apple-system" e trocava a letra no meio da linha */
      base.textContent = "html,body{width:" + LARG + "px !important;max-width:" + LARG + "px !important;margin:0 !important;padding:0 !important;min-height:0 !important;background:#fff !important;box-sizing:border-box}" +
        '*{font-family:"Helvetica Neue",Helvetica,Arial,sans-serif !important;letter-spacing:0 !important;text-wrap:wrap !important;font-feature-settings:normal !important;animation:none !important;transition:none !important}' +
        "body *{max-width:100%}img,svg,canvas{max-width:100% !important;height:auto}svg[height]{height:auto}";
      fd.head.appendChild(base);
      esperarImagens(fd, 4000).then(function () {
        aplicarPrint(fd);
        prenderTitulos(fd, fw);
        fixarSVGs(fd);
        fixarFotos(fd, fw);
        paginar(fd, fw);
        /* as opções nascem na janela da folha (listas criadas aqui não passam no "é lista?" da biblioteca de lá) */
        var opcoes = fw.JSON.parse(JSON.stringify({
          margin: [8, 8, 10, 8], filename: nomeArquivo(d) + ".pdf",
          image: { type: "jpeg", quality: 0.92 },
          html2canvas: { scale: 2, useCORS: true, windowWidth: LARG, width: LARG, scrollX: 0, scrollY: 0, backgroundColor: "#ffffff" },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: [] }, /* a paginação já foi feita em paginar() */
        }));
        var tela = null;
        var w = fw.html2pdf().set(opcoes).from(fd.body).toPdf().get("canvas").then(function (cv) { tela = cv; }).get("pdf").then(function (pdf) {
          /* a última página saía em branco quando só sobravam alguns pixels do documento para ela: tira essa sobra */
          try {
            var n = pdf.internal.getNumberOfPages(), pg = pdf.internal.pageSize;
            var utilW = pg.getWidth() - 16, utilH = pg.getHeight() - 18; /* margens [8, 8, 10, 8] em mm */
            if (n > 1 && tela && tela.width) {
              var pxPorPagina = tela.width * utilH / utilW, y0 = Math.floor((n - 1) * pxPorPagina), alt = tela.height - y0;
              var vazia = alt <= 2;
              if (!vazia) {
                var px = tela.getContext("2d").getImageData(0, y0, tela.width, alt).data;
                vazia = true;
                for (var k = 0; k < px.length; k += 16) { if (px[k] < 245 || px[k + 1] < 245 || px[k + 2] < 245) { vazia = false; break; } }
              }
              if (vazia) pdf.deletePage(n);
            }
          } catch (e) { /* segue com o PDF como saiu */ }
        });
        w.outputPdf("blob").then(function (blobFolha) {
          /* o PDF nasce na folha temporária: vira um arquivo da janela do relatório antes de a folha ser removida */
          var blob = new j.Blob([blobFolha], { type: "application/pdf" });
          limpar(); j.__qlGerandoPDF = false;
          j.__qlUltimoPDF = blob;
          var arquivo = null;
          try { arquivo = new j.File([blob], nomeArquivo(d) + ".pdf", { type: "application/pdf" }); } catch (e) { arquivo = null; }
          var podeCompartilhar = !!(arquivo && j.navigator.canShare && j.navigator.canShare({ files: [arquivo] }));
          /* o Compartilhar precisa de um toque na hora: o PDF fica pronto e o toque abre (Imprimir, Arquivos, WhatsApp…) */
          aviso(j, '<b>PDF pronto.</b><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">' +
            (podeCompartilhar ? '<button type="button" id="ql-pdf-share" style="font:inherit;font-weight:700;padding:10px 14px;border-radius:10px;border:0;background:#7BC043;color:#0B3B2E">Compartilhar ou imprimir</button>' : "") +
            '<button type="button" id="ql-pdf-abrir" style="font:inherit;padding:10px 14px;border-radius:10px;border:1px solid #fff;background:transparent;color:#fff">Abrir o PDF</button>' +
            '<button type="button" id="ql-pdf-fechar" style="font:inherit;padding:10px 14px;border-radius:10px;border:0;background:transparent;color:#fff;text-decoration:underline">Fechar</button></div>');
          var bs = d.getElementById("ql-pdf-share"), ba = d.getElementById("ql-pdf-abrir"), bf = d.getElementById("ql-pdf-fechar");
          if (bs) bs.onclick = function () { j.navigator.share({ files: [arquivo], title: nomeArquivo(d) }).catch(function () { /* cancelou */ }); };
          if (ba) ba.onclick = function () { j.location.href = j.URL.createObjectURL(blob); };
          if (bf) bf.onclick = function () { var a = d.getElementById("ql-pdf-aviso"); if (a) a.remove(); };
        }).catch(function (e) { falha("Não foi possível gerar o PDF agora (" + ((e && e.message) || "erro") + "). Tente de novo."); });
      });
    }
    var fw0 = folha.contentWindow;
    if (fw0.html2pdf) return pronto();
    var s = folha.contentDocument.createElement("script");
    s.src = Q.LIB; s.onload = pronto;
    s.onerror = function () { falha("Sem internet para gerar o PDF. Conecte e tente de novo."); };
    (folha.contentDocument.head || folha.contentDocument.body).appendChild(s);
  }

  /* o botão "Salvar como PDF / Imprimir" chama window.print() da janela do relatório: no iPhone/iPad ele passa a gerar o PDF;
     nos outros aparelhos continua o imprimir do navegador, com as regras de quebra de página */
  function preparar(j) {
    if (!j) return;
    injetarQuebras(j);
    try {
      if (Q.forcar || ehIOS()) { j.print = function () { gerar(j); }; return; }
      if (!j.__qlPrintOriginal && typeof j.print === "function") {
        var orig = j.print; j.__qlPrintOriginal = orig;
        j.print = function () { injetarQuebras(j); return orig.apply(j, arguments); };
      }
    } catch (e) { /* janela de outro endereço */ }
  }
  /* telas do app que imprimem a própria página (ficha, certificado, relatório da consultoria): no iPhone/iPad o PDF sai no aparelho
     com as regras de impressão da página; nos outros aparelhos, o imprimir do navegador com as regras de quebra */
  function imprimirPagina(j) {
    j = j || raiz;
    if (Q.forcar || ehIOS()) return gerar(j);
    injetarQuebras(j);
    return (j.__qlPrintOriginal || j.print).call(j);
  }
  Q.preparar = preparar; Q.gerar = gerar; Q.imprimirPagina = imprimirPagina; Q.ehIOS = ehIOS; Q.CSS_QUEBRA = CSS_QUEBRA;

  /* toda janela de relatório (window.open sem endereço, preenchida pelo app) recebe o botão que funciona no iPhone. O relatório pode ser
     escrito depois (quando os dados chegam): a troca do imprimir é refeita algumas vezes. */
  if (!Q.instalado && typeof raiz.open === "function") {
    Q.instalado = true;
    var abrir = raiz.open;
    raiz.open = function (url) {
      var j = abrir.apply(raiz, arguments);
      if (j && (!url || url === "about:blank")) {
        preparar(j);
        [0, 300, 1500, 5000, 15000].forEach(function (ms) { setTimeout(function () { try { if (!j.closed) preparar(j); } catch (e) { /* fechada */ } }, ms); });
      }
      return j;
    };
  }
})(typeof window !== "undefined" ? window : this);
