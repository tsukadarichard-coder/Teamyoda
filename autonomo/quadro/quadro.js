/* QuadraLab · Quadro tático.
   Tudo é guardado em METROS da quadra (x: largura, de 0 a 10,97; y: comprimento, de 0 a 23,77), não em pixels: virar o iPad, trocar
   inteira/meia quadra ou exportar a imagem redesenha o mesmo quadro sem distorcer. Desenhos: caneta (traço livre), seta (traço livre com
   ponta), reta (com ponta) e tracejado para o deslocamento do jogador. Peças: jogadores azuis/vermelhos e bola, arrastáveis.
   Apple Pencil: quando a caneta é usada, o toque do dedo deixa de desenhar (a palma não risca), mas continua arrastando peças.
   Fica no aparelho (localStorage): o quadro em andamento e os quadros salvos. ?embed=1 = dentro do app do treinador. */
(function () {
  "use strict";
  var LARG = 10.97, COMP = 23.77, SIMPLES = 8.23, SAQUE = 6.40, REDE = COMP / 2;
  var MARGEM_LADO = 3.2, MARGEM_FUNDO = 5.5;
  var PISOS = { saibro: { fora: "#B5533A", dentro: "#C8613F" }, rapida: { fora: "#2E6B4E", dentro: "#2D5F9E" }, grama: { fora: "#3F7D3A", dentro: "#4E9145" } };
  var CH_ATUAL = "ql-quadro:atual:v1", CH_SALVOS = "ql-quadro:salvos:v1", MAX_SALVOS = 30, MAX_HIST = 80;
  var EMBUTIDO = /[?&]embed=1(&|$)/.test(location.search) && window.parent !== window;
  if (EMBUTIDO) document.documentElement.classList.add("embutido");

  var tela = document.getElementById("qtTela"), palco = document.getElementById("qtPalco"), ctx = tela.getContext("2d");
  var estado = carregar(CH_ATUAL) || novoEstado();
  var hist = [JSON.stringify(estado)], refazer = [];
  var ferramenta = "caneta", cor = "#E53935", tracejado = false, usouCaneta = false;
  var desenhando = null, arrastando = null, ptrAtivo = null;

  function novoEstado() { return { area: "inteira", piso: "saibro", tracos: [], pecas: [] }; }
  function ler(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function gravar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function carregar(k) { var e = ler(k); return e && Array.isArray(e.tracos) && Array.isArray(e.pecas) ? e : null; }
  function aviso(t) { var a = document.getElementById("qtAviso"); a.textContent = t; a.hidden = false; clearTimeout(aviso.t); aviso.t = setTimeout(function () { a.hidden = true; }, 2600); }

  /* ── geometria: metros da quadra ↔ pixels da tela (deitada quando a tela é mais larga que alta) ── */
  var vista = null;
  function regiao() {
    return estado.area === "meia" ? { x0: -MARGEM_LADO, x1: LARG + MARGEM_LADO, y0: REDE - 1.2, y1: COMP + MARGEM_FUNDO }
      : { x0: -MARGEM_LADO, x1: LARG + MARGEM_LADO, y0: -MARGEM_FUNDO, y1: COMP + MARGEM_FUNDO };
  }
  function calcularVista(w, h) {
    var r = regiao(), rw = r.x1 - r.x0, rh = r.y1 - r.y0;
    var deitada = w > h * 1.05;
    var ew = deitada ? rh : rw, eh = deitada ? rw : rh;
    var esc = Math.min(w / ew, h / eh), ox = (w - ew * esc) / 2, oy = (h - eh * esc) / 2;
    return { r: r, deitada: deitada, esc: esc, ox: ox, oy: oy, w: w, h: h };
  }
  function paraTela(x, y, v) {
    v = v || vista;
    if (v.deitada) return [v.ox + (y - v.r.y0) * v.esc, v.oy + (v.r.x1 - x) * v.esc];
    return [v.ox + (x - v.r.x0) * v.esc, v.oy + (y - v.r.y0) * v.esc];
  }
  function paraQuadra(px, py) {
    var v = vista;
    if (v.deitada) return [v.r.x1 - (py - v.oy) / v.esc, v.r.y0 + (px - v.ox) / v.esc];
    return [v.r.x0 + (px - v.ox) / v.esc, v.r.y0 + (py - v.oy) / v.esc];
  }

  /* ── desenho ── */
  function redimensionar() {
    var dpr = Math.min(window.devicePixelRatio || 1, 3), b = palco.getBoundingClientRect();
    tela.width = Math.round(b.width * dpr); tela.height = Math.round(b.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    vista = calcularVista(b.width, b.height);
    desenhar();
  }
  function desenhar(c, v) {
    c = c || ctx; v = v || vista;
    var p = PISOS[estado.piso] || PISOS.saibro;
    c.save();
    c.fillStyle = "#2B2B2B"; c.fillRect(0, 0, v.w, v.h);
    retangulo(c, v, v.r.x0, v.r.y0, v.r.x1, v.r.y1, p.fora);
    retangulo(c, v, 0, Math.max(0, v.r.y0), LARG, COMP, p.dentro);
    linhasQuadra(c, v);
    estado.tracos.forEach(function (t) { traco(c, v, t); });
    if (desenhando) traco(c, v, desenhando);
    estado.pecas.forEach(function (pc) { peca(c, v, pc); });
    c.restore();
  }
  function retangulo(c, v, x0, y0, x1, y1, cor) {
    var a = paraTela(x0, y0, v), b = paraTela(x1, y1, v);
    c.fillStyle = cor; c.fillRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
  }
  function linha(c, v, x0, y0, x1, y1) { var a = paraTela(x0, y0, v), b = paraTela(x1, y1, v); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); }
  function linhasQuadra(c, v) {
    var ds = (LARG - SIMPLES) / 2, meio = LARG / 2, ini = estado.area === "meia" ? REDE : 0;
    c.strokeStyle = "#FFFFFF"; c.lineWidth = Math.max(1.5, 0.06 * v.esc); c.lineCap = "butt";
    c.beginPath();
    linha(c, v, 0, ini, 0, COMP); linha(c, v, LARG, ini, LARG, COMP);
    linha(c, v, ds, ini, ds, COMP); linha(c, v, LARG - ds, ini, LARG - ds, COMP);
    if (ini === 0) linha(c, v, 0, 0, LARG, 0);
    linha(c, v, 0, COMP, LARG, COMP);
    if (ini === 0) linha(c, v, ds, REDE - SAQUE, LARG - ds, REDE - SAQUE);
    linha(c, v, ds, REDE + SAQUE, LARG - ds, REDE + SAQUE);
    linha(c, v, meio, ini === 0 ? REDE - SAQUE : REDE, meio, REDE + SAQUE);
    if (ini === 0) linha(c, v, meio, 0, meio, 0.25);
    linha(c, v, meio, COMP, meio, COMP - 0.25);
    c.stroke();
    /* rede */
    c.strokeStyle = "#F2F2F2"; c.lineWidth = Math.max(2.5, 0.12 * v.esc); c.beginPath(); linha(c, v, -0.9, REDE, LARG + 0.9, REDE); c.stroke();
  }
  function traco(c, v, t) {
    if (!t.pts.length) return;
    var pts = t.pts.map(function (q) { return paraTela(q[0], q[1], v); });
    c.save();
    c.strokeStyle = t.cor; c.fillStyle = t.cor; c.lineCap = "round"; c.lineJoin = "round";
    c.lineWidth = Math.max(2.5, (t.esp || 0.14) * v.esc);
    if (t.tracejado) c.setLineDash([c.lineWidth * 2.6, c.lineWidth * 2]);
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
    if (t.tipo === "reta") c.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    else for (var i = 1; i < pts.length - 1; i++) { var mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; c.quadraticCurveTo(pts[i][0], pts[i][1], mx, my); }
    if (t.tipo !== "reta" && pts.length > 1) c.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    c.stroke(); c.setLineDash([]);
    if ((t.tipo === "seta" || t.tipo === "reta") && pts.length > 1) ponta(c, pts, c.lineWidth);
    c.restore();
  }
  function ponta(c, pts, lw) {
    var fim = pts[pts.length - 1], k = pts.length - 2;
    while (k > 0 && Math.hypot(fim[0] - pts[k][0], fim[1] - pts[k][1]) < lw * 4) k--;
    var ini = pts[k], ang = Math.atan2(fim[1] - ini[1], fim[0] - ini[0]), L = Math.max(12, lw * 4.2);
    c.beginPath(); c.moveTo(fim[0], fim[1]);
    c.lineTo(fim[0] - L * Math.cos(ang - 0.42), fim[1] - L * Math.sin(ang - 0.42));
    c.lineTo(fim[0] - L * Math.cos(ang + 0.42), fim[1] - L * Math.sin(ang + 0.42));
    c.closePath(); c.fill();
  }
  function raioPeca(pc, v) { return pc.tipo === "bola" ? Math.max(9, 0.22 * v.esc) : Math.max(15, 0.55 * v.esc); }
  function peca(c, v, pc) {
    var p = paraTela(pc.x, pc.y, v), r = raioPeca(pc, v);
    c.save();
    c.shadowColor = "rgba(0,0,0,.35)"; c.shadowBlur = 6; c.shadowOffsetY = 2;
    c.beginPath(); c.arc(p[0], p[1], r, 0, Math.PI * 2);
    c.fillStyle = pc.tipo === "bola" ? "#E4F53B" : pc.tipo === "A" ? "#1E63E9" : "#E53935"; c.fill();
    c.shadowColor = "transparent"; c.lineWidth = 2; c.strokeStyle = "#FFFFFF"; c.stroke();
    if (pc.tipo !== "bola") { c.fillStyle = "#FFFFFF"; c.font = "700 " + Math.round(r * 0.9) + "px Inter, system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(pc.rotulo || "", p[0], p[1] + 1); }
    c.restore();
  }

  /* ── histórico ── */
  function mudou() {
    hist.push(JSON.stringify(estado)); if (hist.length > MAX_HIST) hist.shift();
    refazer = []; gravar(CH_ATUAL, estado); botoes(); desenhar();
  }
  function botoes() {
    document.querySelector('[data-acao="desfazer"]').disabled = hist.length < 2;
    document.querySelector('[data-acao="refazer"]').disabled = !refazer.length;
    document.querySelectorAll(".qt-seg").forEach(function (g) { g.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(estado[g.getAttribute("data-grupo")] === b.getAttribute("data-val"))); }); });
  }
  function desfazer() { if (hist.length < 2) return; refazer.push(hist.pop()); estado = JSON.parse(hist[hist.length - 1]); gravar(CH_ATUAL, estado); botoes(); redimensionar(); }
  function refazerUm() { if (!refazer.length) return; var s = refazer.pop(); hist.push(s); estado = JSON.parse(s); gravar(CH_ATUAL, estado); botoes(); redimensionar(); }

  /* ── toque, mouse e Apple Pencil ── */
  function ponto(ev) { var b = tela.getBoundingClientRect(); return [ev.clientX - b.left, ev.clientY - b.top]; }
  function pecaEm(px, py) {
    for (var i = estado.pecas.length - 1; i >= 0; i--) { var pc = estado.pecas[i], p = paraTela(pc.x, pc.y); if (Math.hypot(px - p[0], py - p[1]) <= raioPeca(pc, vista) + 8) return pc; }
    return null;
  }
  function apagarEm(px, py) {
    var antes = estado.tracos.length + estado.pecas.length, lim = 14;
    var pc = pecaEm(px, py);
    if (pc) estado.pecas = estado.pecas.filter(function (x) { return x !== pc; });
    else estado.tracos = estado.tracos.filter(function (t) { return !t.pts.some(function (q) { var p = paraTela(q[0], q[1]); return Math.hypot(px - p[0], py - p[1]) < lim; }); });
    return estado.tracos.length + estado.pecas.length !== antes;
  }
  tela.addEventListener("pointerdown", function (ev) {
    if (ptrAtivo !== null) return;
    if (ev.pointerType === "pen") usouCaneta = true;
    var p = ponto(ev), pc = pecaEm(p[0], p[1]);
    if (ferramenta !== "borracha" && pc) { arrastando = { pc: pc, moveu: false }; }
    else if (usouCaneta && ev.pointerType === "touch") return; /* palma da mão com a Apple Pencil em uso */
    else if (ferramenta === "borracha") { arrastando = null; desenhando = null; if (apagarEm(p[0], p[1])) { desenhar(); arrastando = { apagou: true }; } else arrastando = { apagou: false }; }
    else { var q = paraQuadra(p[0], p[1]); desenhando = { tipo: ferramenta, cor: cor, tracejado: tracejado, esp: 0.14, pts: [q] }; }
    ptrAtivo = ev.pointerId; try { tela.setPointerCapture(ev.pointerId); } catch (e) { /* sem captura: segue pelos eventos da tela */ } ev.preventDefault();
  });
  tela.addEventListener("pointermove", function (ev) {
    if (ev.pointerId !== ptrAtivo) return;
    var p = ponto(ev);
    if (arrastando && arrastando.pc) { var q = paraQuadra(p[0], p[1]); arrastando.pc.x = q[0]; arrastando.pc.y = q[1]; arrastando.moveu = true; desenhar(); }
    else if (arrastando && "apagou" in arrastando) { if (apagarEm(p[0], p[1])) { arrastando.apagou = true; desenhar(); } }
    else if (desenhando) {
      var q2 = paraQuadra(p[0], p[1]), u = desenhando.pts[desenhando.pts.length - 1];
      if (desenhando.tipo === "reta") { desenhando.pts = [desenhando.pts[0], q2]; desenhar(); }
      else if (Math.hypot(q2[0] - u[0], q2[1] - u[1]) * vista.esc > 2.5) { desenhando.pts.push(q2); desenhar(); }
    }
  });
  function soltar(ev) {
    if (ev.pointerId !== ptrAtivo) return;
    ptrAtivo = null;
    if (arrastando && arrastando.pc) { if (arrastando.moveu) mudou(); }
    else if (arrastando && arrastando.apagou) mudou();
    else if (desenhando) { var t = desenhando; desenhando = null; if (t.pts.length > 1 || t.tipo === "caneta") { t.pts = t.pts.map(function (q) { return [Math.round(q[0] * 100) / 100, Math.round(q[1] * 100) / 100]; }); estado.tracos.push(t); mudou(); } else desenhar(); }
    arrastando = null;
  }
  tela.addEventListener("pointerup", soltar);
  tela.addEventListener("pointercancel", soltar);

  /* ── peças ── */
  function addPeca(tipo) {
    var n = estado.pecas.filter(function (p) { return p.tipo === tipo; }).length + 1;
    var lado = tipo === "A" ? 1 : -1, base = estado.area === "meia" ? REDE + SAQUE + 2 : REDE + lado * (SAQUE + 3);
    var pc = { tipo: tipo, rotulo: tipo === "bola" ? "" : (tipo === "A" ? "A" : "B") + n, x: tipo === "bola" ? LARG / 2 : LARG / 2 + (n - 1.5) * 2.2, y: tipo === "bola" ? REDE + 1.5 : base };
    estado.pecas.push(pc); mudou();
  }

  /* ── imagem, salvar e abrir ── */
  function imagem(larg, alt) {
    var c = document.createElement("canvas"); c.width = larg; c.height = alt;
    var x = c.getContext("2d"); desenhar(x, calcularVista(larg, alt)); return c;
  }
  function blobPng(cb) { var v = vista, k = 2; imagem(Math.round(v.w * k), Math.round(v.h * k)).toBlob(cb, "image/png"); }
  function nomeArquivo() { return "quadro-tatico-" + new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-") + ".png"; }
  function baixar() {
    blobPng(function (b) { var a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = nomeArquivo(); document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500); aviso("Imagem salva."); });
  }
  function compartilhar() {
    blobPng(function (b) {
      var f = new File([b], nomeArquivo(), { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f], title: "Quadro tático" }).catch(function () {});
      else baixar();
    });
  }
  function miniatura() { return imagem(160, 160).toDataURL("image/jpeg", 0.7); }
  function dialogo(html, ligar) {
    var d = document.getElementById("qtDialogo"); d.innerHTML = '<div class="qt-caixa">' + html + "</div>"; d.hidden = false;
    d.onclick = function (e) { if (e.target === d) fechar(); };
    function fechar() { d.hidden = true; d.innerHTML = ""; }
    ligar(d, fechar);
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function salvar() {
    dialogo('<h2 id="qtDialogoTit">Salvar este quadro</h2><label for="qtNome" style="font-size:13px;font-weight:600">Nome</label><input id="qtNome" maxlength="60" placeholder="Ex.: saque aberto + ataque na paralela">' +
      '<div class="qt-linha-bts"><button type="button" data-x="nao">Cancelar</button><button type="button" class="pri" data-x="sim">Salvar</button></div>', function (d, fechar) {
      var inp = d.querySelector("#qtNome"); inp.focus();
      d.querySelector('[data-x="nao"]').onclick = fechar;
      d.querySelector('[data-x="sim"]').onclick = function () {
        var nome = inp.value.trim() || "Quadro de " + new Date().toLocaleDateString("pt-BR");
        var lista = (ler(CH_SALVOS) || []).filter(function (q) { return q && q.id; });
        lista.unshift({ id: Date.now().toString(36), nome: nome, em: new Date().toISOString(), estado: estado, mini: miniatura() });
        if (!gravar(CH_SALVOS, lista.slice(0, MAX_SALVOS))) { aviso("Sem espaço no aparelho. Apague quadros antigos."); return; }
        fechar(); aviso("Quadro salvo neste aparelho.");
      };
    });
  }
  function abrir() {
    var lista = ler(CH_SALVOS) || [];
    dialogo('<h2 id="qtDialogoTit">Quadros salvos</h2>' + (lista.length ? lista.map(function (q) {
      return '<div class="qt-salvo"><img alt="" src="' + esc(q.mini || "") + '"><div><strong>' + esc(q.nome) + "</strong><br><small>" + esc(new Date(q.em).toLocaleDateString("pt-BR")) + '</small></div><button type="button" data-abrir="' + esc(q.id) + '">Abrir</button><button type="button" data-apagar="' + esc(q.id) + '" aria-label="Apagar ' + esc(q.nome) + '">✕</button></div>';
    }).join("") : '<p style="color:#5B6B63">Nenhum quadro salvo neste aparelho ainda.</p>') + '<div class="qt-linha-bts"><button type="button" data-x="nao">Fechar</button></div>', function (d, fechar) {
      d.querySelector('[data-x="nao"]').onclick = fechar;
      d.querySelectorAll("[data-abrir]").forEach(function (b) { b.onclick = function () { var q = lista.filter(function (x) { return x.id === b.getAttribute("data-abrir"); })[0]; if (!q) return; estado = JSON.parse(JSON.stringify(q.estado)); mudou(); redimensionar(); fechar(); aviso("Quadro aberto."); }; });
      d.querySelectorAll("[data-apagar]").forEach(function (b) { b.onclick = function () { if (!confirm("Apagar este quadro salvo?")) return; gravar(CH_SALVOS, lista.filter(function (x) { return x.id !== b.getAttribute("data-apagar"); })); fechar(); abrir(); }; });
    });
  }

  /* ── barra e menu ── */
  document.querySelectorAll(".qt-fer").forEach(function (b) { b.addEventListener("click", function () { ferramenta = b.getAttribute("data-fer"); document.querySelectorAll(".qt-fer").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); }); });
  document.getElementById("btTraco").addEventListener("click", function () { tracejado = !tracejado; this.setAttribute("aria-pressed", String(tracejado)); });
  document.querySelectorAll(".qt-cor").forEach(function (b) { b.style.background = b.getAttribute("data-cor"); b.addEventListener("click", function () { cor = b.getAttribute("data-cor"); document.querySelectorAll(".qt-cor").forEach(function (x) { x.setAttribute("aria-checked", String(x === b)); }); if (ferramenta === "borracha") document.querySelector('[data-fer="caneta"]').click(); }); });
  document.querySelectorAll(".qt-peca").forEach(function (b) { b.addEventListener("click", function () { addPeca(b.getAttribute("data-peca")); }); });
  var menu = document.getElementById("qtMenu"), btMenu = document.getElementById("btMenu");
  function menuAberto(v) { menu.hidden = !v; btMenu.setAttribute("aria-expanded", String(v)); }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-acao]");
    if (!b) { if (!menu.hidden && !e.target.closest("#qtMenu")) menuAberto(false); return; }
    var a = b.getAttribute("data-acao");
    if (a === "menu") { menuAberto(menu.hidden); return; }
    if (a === "desfazer") desfazer();
    else if (a === "refazer") refazerUm();
    else { menuAberto(false);
      if (a === "salvar") salvar();
      else if (a === "abrir") abrir();
      else if (a === "imagem") baixar();
      else if (a === "compartilhar") compartilhar();
      else if (a === "tirarPecas") { if (estado.pecas.length) { estado.pecas = []; mudou(); } }
      else if (a === "limpar") { if (confirm("Limpar todos os desenhos e peças?")) { estado.tracos = []; estado.pecas = []; mudou(); } }
    }
  });
  document.querySelectorAll(".qt-seg button").forEach(function (b) { b.addEventListener("click", function () { var g = b.parentNode.getAttribute("data-grupo"); estado[g] = b.getAttribute("data-val"); mudou(); redimensionar(); }); });
  document.addEventListener("keydown", function (e) { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) refazerUm(); else desfazer(); } if (e.key === "Escape") menuAberto(false); });
  if (!(navigator.canShare)) document.getElementById("btCompartilhar").textContent = "Compartilhar imagem (baixa o arquivo)";
  if (EMBUTIDO) document.getElementById("qtVoltar").hidden = true;

  window.addEventListener("resize", redimensionar);
  if (window.ResizeObserver) new ResizeObserver(redimensionar).observe(palco);
  botoes(); redimensionar();
  window.QL_QUADRO = { estado: function () { return estado; }, paraTela: function (x, y) { return paraTela(x, y); }, paraQuadra: paraQuadra };
})();
