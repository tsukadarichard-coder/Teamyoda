/* Salvar como PDF / Imprimir nos relatórios abertos pelo app (scout, movimento, mês, atleta, equipe…).
   No iPhone e no iPad, o "Imprimir" de uma página aberta pelo app não faz nada quando o app está na tela inicial (limitação do iOS).
   Lá o botão do relatório passa a gerar o PDF no próprio aparelho e abrir o Compartilhar (Imprimir, Salvar em Arquivos, WhatsApp…);
   nos outros aparelhos continua o imprimir do navegador.
   Carregado na página do app: toda janela de relatório aberta com window.open("") recebe isso sozinha (nenhum relatório precisa mudar). */
(function (raiz) {
  "use strict";
  var LIB = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
  var Q = raiz.QLImprimir = raiz.QLImprimir || {};
  Q.LIB = Q.LIB || LIB;

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

  function gerar(j) {
    var d = j.document;
    if (j.__qlGerandoPDF) return;
    j.__qlGerandoPDF = true;
    aviso(j, "Gerando o PDF…");
    function falha(msg) {
      j.__qlGerandoPDF = false;
      aviso(j, esc(msg) + ' <button type="button" id="ql-pdf-fechar" style="margin-left:8px;font:inherit;padding:6px 10px;border-radius:8px;border:0">OK</button>');
      var b = d.getElementById("ql-pdf-fechar"); if (b) b.onclick = function () { var a = d.getElementById("ql-pdf-aviso"); if (a) a.remove(); };
    }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function pronto() {
      var esconder = [].slice.call(d.querySelectorAll(".no-print, .nop, .vbr, [data-sem-pdf]"));
      var antes = esconder.map(function (e) { var v = e.style.display; e.style.display = "none"; return v; });
      /* o PDF sai na largura de uma folha A4, não na do celular (senão a direita fica cortada) */
      var b = d.body.style, salvo = [b.width, b.maxWidth, b.margin, b.boxSizing, b.padding, b.minHeight];
      b.width = "733px"; b.maxWidth = "733px"; /* A4 menos as margens (194 mm) */ b.margin = "0"; b.boxSizing = "border-box"; b.padding = "0"; b.minHeight = "0";
      /* fonte com nome de verdade: o desenho do PDF no iPhone não entende "system-ui"/"-apple-system" e trocava a letra no meio da
         linha (texto torto e sobreposto); espaçamento entre letras também desalinhava */
      var estilo = d.createElement("style"); estilo.id = "ql-pdf-fonte";
      estilo.textContent = '*{font-family:"Helvetica Neue",Helvetica,Arial,sans-serif !important;letter-spacing:0 !important;text-wrap:wrap !important;font-feature-settings:normal !important}';
      (d.head || d.body).appendChild(estilo);
      var volta = function () { esconder.forEach(function (e, i) { e.style.display = antes[i]; }); b.width = salvo[0]; b.maxWidth = salvo[1]; b.margin = salvo[2]; b.boxSizing = salvo[3]; b.padding = salvo[4]; b.minHeight = salvo[5]; if (estilo.parentNode) estilo.parentNode.removeChild(estilo); };
      /* as opções nascem na janela do relatório (listas criadas aqui não passam no "é lista?" da biblioteca de lá) */
      var opcoes = j.JSON.parse(JSON.stringify({
        margin: [8, 8, 10, 8], filename: nomeArquivo(d) + ".pdf",
        image: { type: "jpeg", quality: 0.92 },
        html2canvas: { scale: 2, useCORS: true, windowWidth: 733, scrollX: 0, scrollY: 0, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        /* não corta foto, linha de tabela, cartão nem gráfico no meio (antes cortava e deixava páginas quase vazias) */
        pagebreak: { mode: ["css", "legacy"], before: ".quebra", avoid: ["tr", "img", "svg", "canvas", "li", "h2", "h3", ".f", ".pr", ".kpi", ".card", ".cartao", ".bloco", ".medida", ".fase", ".evita-quebra"] },
      }));
      var tela = null;
      var w = j.html2pdf().set(opcoes).from(d.body).toPdf().get("canvas").then(function (c) { tela = c; }).get("pdf").then(function (pdf) {
        /* a última página saía em branco quando só sobravam alguns pixels do documento para ela: tira essa sobra */
        try {
          var n = pdf.internal.getNumberOfPages(), pg = pdf.internal.pageSize;
          var utilW = pg.getWidth() - 16, utilH = pg.getHeight() - 18; /* margens [8, 8, 10, 8] em mm */
          if (n > 1 && tela && tela.width) {
            /* olha os pixels do pedaço do documento que foi para a última página: se não tiver nada desenhado, tira a página */
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
      w.outputPdf("blob").then(function (blob) {
        volta(); j.__qlGerandoPDF = false;
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
      }).catch(function (e) { volta(); falha("Não foi possível gerar o PDF agora (" + ((e && e.message) || "erro") + "). Tente de novo."); });
    }
    if (j.html2pdf) return pronto();
    var s = d.createElement("script");
    s.src = Q.LIB; s.onload = pronto;
    s.onerror = function () { falha("Sem internet para gerar o PDF. Conecte e tente de novo."); };
    (d.head || d.body).appendChild(s);
  }

  /* o botão "Salvar como PDF / Imprimir" chama window.print() da janela do relatório: no iPhone/iPad ele passa a gerar o PDF */
  function preparar(j) {
    if (!j || !(Q.forcar || ehIOS())) return;
    try { j.print = function () { gerar(j); }; } catch (e) { /* janela de outro endereço */ }
  }
  Q.preparar = preparar; Q.gerar = gerar; Q.ehIOS = ehIOS;

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
