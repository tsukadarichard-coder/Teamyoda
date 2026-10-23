/* Tela do scout automático a partir do vídeo · Tecnologia QuadraLab.
   1) Calibração: um quadro do vídeo; o treinador toca nos 4 cantos da quadra, no atleta e no adversário, e informa mão, formato
      e (se souber) quem sacou primeiro e o placar final. 2) A visão (scout/video-visao.js) lê os pontos; o motor
      (scout/video-scout.js) monta o scout com o placar. 3) Revisão: cada campo automático vem marcado (● confiável, ● confira,
      ? em dúvida); o treinador corrige ou completa (situação, decisão, causa, devolução) e salva como scout normal da partida.
   QLVideoScoutUI.montar(el, api) — api: { arquivo(), video, batidas(), duracao(), nomes(), tocar(ini, fim), clipes(), aoSalvarScout(dados), aoSalvarVideo(reg), cotaLiberada() } */
(function (raiz) {
  var VS = raiz.QLVideoScout;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fmt(t) { var h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = Math.floor(t % 60); return (h ? h + ":" + (m < 10 ? "0" : "") : "") + m + ":" + (s < 10 ? "0" : "") + s; }
  var FIM = [["winner_nos", "Winner do atleta", true], ["erro_dele", "Erro do adversário", true], ["erro_nos", "Erro do atleta", false], ["winner_dele", "Winner do adversário", false]];
  var SAQUE = [["1", "1º saque"], ["2", "2º saque"], ["ace", "Ace"], ["df", "Dupla falta"]];
  var DIR_SAQUE = [["aberto", "Aberto"], ["fechado", "Fechado (T)"], ["corpo", "Corpo"]];
  var GOLPES = [["forehand", "Forehand"], ["backhand", "Backhand"], ["voleio", "Voleio"], ["smash", "Smash"], ["drop", "Drop shot"], ["lob", "Lob"], ["devolucao", "Devolução"]];
  var DIRECOES = [["cruzado", "Cruzado"], ["paralelo", "Paralelo"]];
  var EFEITOS = [["top", "Top spin"], ["slice", "Slice"], ["flat", "Chapado"]];
  var SITUACOES = [["ataque", "Ataque"], ["contra", "Contra-ataque"], ["defesa", "Defesa"], ["neutra", "Neutra"], ["construcao", "Construção"]];
  var DECISOES = [["boa", "Boa"], ["disc", "Discutível"], ["ruim", "Ruim"]];
  var QUAL_DEV = [["boa", "Boa"], ["regular", "Regular"], ["fraca", "Fraca"]];
  var BOLAS = [["1-2", "1–2 bolas"], ["3-4", "3–4 bolas"], ["5+", "5 ou mais"]];
  var CURTO = { saque: "Saque", forehand: "FH", backhand: "BH", voleio: "Voleio", smash: "Smash", devolucao: "Devolução", drop: "Drop", lob: "Lob" };
  var ROT = function (lista, v) { var x = lista.filter(function (o) { return o[0] === v; })[0]; return x ? x[1] : ""; };
  var CSS = ".qlm .vs-cal{position:relative;touch-action:none;user-select:none;border-radius:10px;overflow:hidden;background:#111}.qlm .vs-cal canvas{display:block;width:100%}" +
    ".qlm .vs-passo{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.qlm .vs-passo span{font-size:12px;padding:3px 10px;border-radius:99px;background:#EEF2F5;color:var(--qmut)}.qlm .vs-passo span.on{background:var(--qa);color:#fff}.qlm .vs-passo span.ok{background:#E3F1E8;color:var(--qok)}" +
    ".qlm .vs-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;margin-top:10px}.qlm .vs-form label{display:flex;flex-direction:column;gap:4px;font-size:12.5px;color:var(--qmut)}" +
    ".qlm .vs-pt{border:1px solid var(--qbd);border-radius:12px;padding:10px 12px;margin-top:8px;background:#fff}.qlm .vs-pt.conf{border-left:4px solid var(--qat)}.qlm .vs-pt h4{margin:0;font-size:13.5px;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}" +
    ".qlm .vs-ch{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}.qlm .vs-ch span{font-size:12.5px;border:1px solid var(--qbd);border-radius:99px;padding:3px 10px;background:#FBFAF7}" +
    ".qlm .vs-ch i{font-style:normal;font-weight:800;margin-left:5px}.qlm .vs-ch i.alta{color:var(--qok)}.qlm .vs-ch i.media{color:#C99A2E}.qlm .vs-ch i.baixa{color:var(--qat)}.qlm .vs-ch i.treinador{color:var(--qa)}" +
    ".qlm .vs-seq{font-size:12.5px;color:var(--qmut);margin-top:6px;line-height:1.6}.qlm .vs-seq b{color:var(--qink);font-weight:600}" +
    ".qlm .vs-ed{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;margin-top:10px;padding-top:10px;border-top:1px dashed var(--qbd)}.qlm .vs-ed label{display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--qmut)}" +
    ".qlm .vs-res{display:flex;gap:10px;flex-wrap:wrap}.qlm .vs-res div{background:#F4F1EA;border-radius:10px;padding:8px 12px;font-size:12.5px;color:var(--qmut)}.qlm .vs-res b{display:block;font-size:18px;color:var(--qink)}";

  function montar(el, api) {
    if (!document.getElementById("vs-css")) { var st0 = document.createElement("style"); st0.id = "vs-css"; st0.textContent = CSS; document.head.appendChild(st0); }
    var S = { fase: "convite", toque: null, cantos: [], atleta: null, adv: null, cores: {}, img: null, asp: 16 / 9, an: null, dados: null, dec: null, pontos: null, filtro: "todos", aberto: -1, sinal: null, cfg: null, ctx: null };
    function nomes() { var n = api.nomes(); return { A: n.A || "Atleta", B: n.B || "Adversário" }; }
    function render() { ({ convite: convite, calibrar: calibrar, processando: processando, revisar: revisar, semQuadra: semQuadra, erro: erroScout })[S.fase](); }
    function erroScout() {
      el.innerHTML = '<div class="qm-card"><p class="qm-msg">' + esc(S.erro || "") + '</p><div class="qm-row"><button class="qm-pri" data-a="denovo">Gerar o scout de novo</button></div></div>';
      el.querySelector('[data-a="denovo"]').onclick = function () { if (S.cantos && S.cantos.length === 4) gerar(true); else iniciarAuto(); };
    }
    function semQuadra() {
      el.innerHTML = '<div class="qm-card"><h3 class="qm-h">Não achei a quadra neste vídeo</h3>' +
        (S.semImagem
          ? '<p class="qm-msg">O navegador não entregou as imagens deste vídeo (só o som). Tente pelo Chrome ou pelo Safari atualizado, ou exporte o vídeo de novo em MP4 (H.264) e envie outra vez.</p>'
          : '<p class="qm-msg">O app procura as linhas da quadra sozinho em vários momentos da partida e não encontrou linhas suficientes. Para o scout automático funcionar:</p>' +
            '<ul class="qm-ul"><li>filme de trás da linha de fundo, um pouco do alto, com a quadra inteira no quadro (as quatro linhas de fora);</li><li>evite cortar o fundo de cá ou as laterais;</li><li>deixe o celular parado ou acompanhe a jogada devagar.</li></ul>') +
        '<p class="qm-msg">Os pontos achados pelo som continuam acima, com os clipes de cada um.</p>' +
        '<div class="qm-row"><button class="qm-pri" data-a="denovo">Procurar de novo</button></div></div>';
      el.querySelector('[data-a="denovo"]').onclick = function () { iniciarAuto(); };
    }

    /* ── convite ── */
    function convite() {
      el.innerHTML = '<div class="qm-card"><h3 class="qm-h">Scout completo da partida (automático)</h3>' +
        '<p class="qm-msg">O app lê o vídeo e preenche, ponto a ponto: quem sacou, 1º ou 2º saque, ace, dupla falta e direção do saque; quem bateu cada bola, forehand, backhand, voleio ou smash, efeito, direção, se bateu na corrida e se subiu à rede; e quem ganhou o ponto (winner ou erro), com o placar reconstruído. ' +
        'Cada campo vem marcado como confiável ou "confira"; o que o vídeo não mostra (situação do ponto, decisão, causa do erro) você completa. No fim vira um scout normal no caderno do jogador.</p>' +
        '<p class="qm-msg">Vale câmera parada ou celular na mão acompanhando a jogada (o app segue as linhas da quadra a cada quadro). Fica melhor com a quadra inteira no quadro e as linhas visíveis. Tudo roda aqui no aparelho.</p>' +
        '<div class="qm-row"><button class="qm-pri" data-a="ir">Montar o scout completo</button></div></div>';
      el.querySelector('[data-a="ir"]').onclick = function () { iniciarAuto(); };
    }

    /* ── calibração ── */
    async function pegarQuadro(tq) {
      var bat = api.batidas(), t = tq != null ? tq : bat.length ? bat[0] : 5;
      try {
        /* quadro de verdade (no iPhone, desenhar o vídeo parado dá imagem preta): ver QLVisao.quadroEm */
        var r = raiz.QLVisao && raiz.QLVisao.quadroEm ? await raiz.QLVisao.quadroEm(api.arquivo(), api.clipes() ? null : api.video, t) : null;
        if (r) { S.img = r.img; S.asp = r.asp; } else S.img = null;
        msgCal(""); if (S.fase === "calibrar") desenhar();
      } catch (e) { S.img = null; msgCal("Não consegui ler um quadro do vídeo: " + (e.message || e)); }
    }
    function msgCal(t) { var m = el.querySelector('[data-r="calmsg"]'); if (m) m.textContent = t; }
    function passoAtual() { return S.cantos.length < 4 ? "cantos" : !S.atleta ? "atleta" : !S.adv ? "adv" : "pronto"; }
    function calibrar() {
      var n = nomes(), c = S.cfg || {};
      el.innerHTML = '<div class="qm-card"><h3 class="qm-h">Preparar o scout · 1 minuto</h3>' +
        '<div class="vs-passo" data-r="passos"></div><p class="qm-msg" data-r="instr"></p>' +
        '<div class="vs-cal"><canvas data-r="cv"></canvas></div><p class="qm-msg" data-r="calmsg">Carregando um quadro do vídeo…</p>' +
        '<div class="qm-row"><button data-a="refazer">Refazer a marcação</button><label class="qm-msg" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-r="simples"' + (c.simples ? " checked" : "") + '> marquei os cantos da quadra de simples</label></div>' +
        '<div class="vs-form">' +
        '<label>Mão de ' + esc(n.A) + '<select data-r="maoA"><option value="">Automático (pelo saque)</option><option value="D"' + (c.maoA === "D" ? " selected" : "") + '>Destro</option><option value="E"' + (c.maoA === "E" ? " selected" : "") + '>Canhoto</option></select></label>' +
        '<label>Mão de ' + esc(n.B) + '<select data-r="maoB"><option value="">Automático (pelo saque)</option><option value="D"' + (c.maoB === "D" ? " selected" : "") + '>Destro</option><option value="E"' + (c.maoB === "E" ? " selected" : "") + '>Canhoto</option></select></label>' +
        '<label>Formato<select data-r="formato"><option value="">Automático</option><option value="3sets"' + (c.formato === "3sets" ? " selected" : "") + '>Melhor de 3 sets</option><option value="1set"' + (c.formato === "1set" ? " selected" : "") + '>Set único</option><option value="4games"' + (c.formato === "4games" ? " selected" : "") + '>Set a 4 games</option><option value="tb7"' + (c.formato === "tb7" ? " selected" : "") + '>Só tie-break (7)</option><option value="tb10"' + (c.formato === "tb10" ? " selected" : "") + '>Match tie-break (10)</option></select></label>' +
        '<label>Quem sacou o 1º ponto<select data-r="saca"><option value="">Não sei (o app descobre)</option><option value="nos"' + (c.saca === "nos" ? " selected" : "") + '>' + esc(n.A) + '</option><option value="ele"' + (c.saca === "ele" ? " selected" : "") + '>' + esc(n.B) + '</option></select></label>' +
        '<label>Placar final (opcional, ajuda muito)<input type="text" data-r="final" placeholder="ex.: 6-4 3-6 10-8" value="' + esc(c.placarFinal || "") + '"></label>' +
        '<label>Regras<span style="display:flex;flex-direction:column;gap:3px;color:var(--qink)"><span><input type="checkbox" data-r="semVant"' + (c.semVantagem ? " checked" : "") + '> sem vantagem (ponto decisivo)</span><span><input type="checkbox" data-r="stb"' + (c.superTiebreakDecisivo ? " checked" : "") + '> 3º set em super tie-break</span></span></label>' +
        '</div><div class="qm-row" style="margin-top:12px"><button class="qm-pri" data-a="gerar" disabled>Gerar o scout</button><button data-a="voltar">Cancelar</button></div>' +
        '<p class="qm-msg">Leva alguns minutos (mais rápido no computador). Deixe esta tela aberta; o vídeo não sai do aparelho.</p></div>';
      el.querySelector('[data-a="refazer"]').onclick = function () { S.cantos = []; S.atleta = S.adv = null; desenhar(); };
      el.querySelector('[data-a="voltar"]').onclick = function () { S.fase = "convite"; render(); };
      el.querySelector('[data-a="gerar"]').onclick = function () { gerar(false); };
      /* o ponto é fixado ao soltar o dedo, com uma lupa mostrando onde ele vai cair (no celular a quadra fica pequena);
         começar perto de um canto e arrastar ajusta aquele canto. No celular o adversário fica junto dos cantos do fundo:
         um toque parado ali marca o jogador, só o movimento arrasta o canto */
      var cv = el.querySelector('[data-r="cv"]'), ini = null;
      function ponto(e) { var r = cv.getBoundingClientRect(); return [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))]; }
      function marcar(p) { var ps = passoAtual(); if (ps === "cantos") S.cantos.push(p); else if (ps === "atleta") S.atleta = p; else if (ps === "adv") S.adv = p; }
      cv.onpointerdown = function (e) {
        if (!S.img) return; var p = ponto(e), r = cv.getBoundingClientRect(), perto = -1;
        for (var i = 0; i < S.cantos.length; i++) if (Math.hypot((S.cantos[i][0] - p[0]) * r.width, (S.cantos[i][1] - p[1]) * r.height) < 22) { perto = i; break; }
        ini = [e.clientX, e.clientY]; S.toque = { p: p, canto: perto, arrastou: false };
        try { cv.setPointerCapture(e.pointerId); } catch (x) {}
        desenhar();
      };
      cv.onpointermove = function (e) {
        if (!S.toque) return; S.toque.p = ponto(e);
        if (S.toque.canto >= 0 && (S.toque.arrastou || Math.hypot(e.clientX - ini[0], e.clientY - ini[1]) >= 6)) { S.toque.arrastou = true; S.cantos[S.toque.canto] = S.toque.p; }
        desenhar();
      };
      cv.onpointerup = function (e) {
        var t = S.toque; S.toque = null; if (!t) return;
        if (!(t.canto >= 0 && t.arrastou) && passoAtual() !== "pronto") marcar(ponto(e));
        desenhar();
      };
      cv.onpointercancel = function () { S.toque = null; desenhar(); };
      if (S.img) desenhar(); else pegarQuadro();
    }
    function desenhar() {
      var cv = el.querySelector('[data-r="cv"]'); if (!cv || !S.img) return;
      var w = Math.min(1280, S.img.width), h = Math.round(w / S.asp); cv.width = w; cv.height = h;
      var x = cv.getContext("2d"); x.drawImage(S.img, 0, 0, w, h);
      var ps = passoAtual(), n = nomes();
      if (S.cantos.length === 4) {
        var cal = VS.calibrar(S.cantos, { simples: el.querySelector('[data-r="simples"]').checked, aspecto: S.asp });
        if (cal) { x.strokeStyle = "rgba(102,170,51,.95)"; x.lineWidth = Math.max(2, w / 500); VS.linhasQuadra().forEach(function (sg) { var a = VS.aplicarH(cal.Hi, sg[0]), b = VS.aplicarH(cal.Hi, sg[1]); x.beginPath(); x.moveTo(a[0] * w, a[1] * h); x.lineTo(b[0] * w, b[1] * h); x.stroke(); }); }
      }
      S.cantos.forEach(function (c, i) { x.fillStyle = "#0B3B2E"; x.strokeStyle = "#fff"; x.lineWidth = 2; x.beginPath(); x.arc(c[0] * w, c[1] * h, Math.max(9, w / 90), 0, 7); x.fill(); x.stroke(); x.fillStyle = "#fff"; x.font = "bold " + Math.max(11, w / 80) + "px system-ui"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(i + 1, c[0] * w, c[1] * h); });
      [[S.atleta, n.A, "#C65825"], [S.adv, n.B, "#1F5FBF"]].forEach(function (m) { if (!m[0]) return; x.fillStyle = m[2]; x.beginPath(); x.arc(m[0][0] * w, m[0][1] * h, Math.max(7, w / 120), 0, 7); x.fill(); x.font = "bold " + Math.max(12, w / 70) + "px system-ui"; x.fillText(m[1], m[0][0] * w, m[0][1] * h - Math.max(14, w / 60)); });
      if (S.toque) { /* lupa: 3× em volta do dedo, desenhada acima dele */
        var r0 = cv.getBoundingClientRect(), ke = w / r0.width, R = Math.min(58, r0.height * 0.3) * ke, zx = S.toque.p[0] * w, zy = S.toque.p[1] * h, z = 3;
        var lugares = [[zx, zy - R * 1.6], [zx, zy + R * 1.6], [zx - R * 1.8, zy], [zx + R * 1.8, zy]].filter(function (c) { return c[0] - R >= 0 && c[0] + R <= w && c[1] - R >= 0 && c[1] + R <= h; });
        var cxL = (lugares[0] || [Math.min(w - R, Math.max(R, zx + R * 1.8)), Math.min(h - R, Math.max(R, zy))])[0], cyL = (lugares[0] || [0, Math.min(h - R, Math.max(R, zy))])[1];
        x.save(); x.beginPath(); x.arc(cxL, cyL, R, 0, 7); x.clip();
        x.drawImage(cv, zx - R / z, zy - R / z, 2 * R / z, 2 * R / z, cxL - R, cyL - R, 2 * R, 2 * R);
        x.strokeStyle = "#fff"; x.lineWidth = 1.5 * ke; x.beginPath(); x.moveTo(cxL - R, cyL); x.lineTo(cxL + R, cyL); x.moveTo(cxL, cyL - R); x.lineTo(cxL, cyL + R); x.stroke(); x.restore();
        x.strokeStyle = "#0B3B2E"; x.lineWidth = 3 * ke; x.beginPath(); x.arc(cxL, cyL, R, 0, 7); x.stroke();
      }
      var nomesC = ["fundo de cá, à esquerda", "fundo de cá, à direita", "fundo de lá, à direita", "fundo de lá, à esquerda"];
      var instr = ps === "cantos" ? "Toque no canto " + (S.cantos.length + 1) + " da quadra (linhas de fora): " + nomesC[S.cantos.length] + ". Dá para arrastar os pontos depois."
        : ps === "atleta" ? "As linhas verdes devem cair sobre as linhas da quadra (arraste os cantos se precisar). Agora toque na camiseta de " + n.A + "."
        : ps === "adv" ? "Toque na camiseta de " + n.B + "." : "Pronto. Confira as linhas e as opções abaixo e gere o scout.";
      el.querySelector('[data-r="instr"]').textContent = instr;
      el.querySelector('[data-r="passos"]').innerHTML = [["cantos", "4 cantos"], ["atleta", n.A], ["adv", n.B]].map(function (p, i) { var feito = i < ["cantos", "atleta", "adv", "pronto"].indexOf(ps); return '<span class="' + (feito ? "ok" : p[0] === ps ? "on" : "") + '">' + (feito ? "✓ " : "") + esc(p[1]) + "</span>"; }).join("");
      el.querySelector('[data-a="gerar"]').disabled = ps !== "pronto" || !api.cotaLiberada();
    }
    function corEm(p) {
      var c = document.createElement("canvas"), w = S.img.width, h = S.img.height; c.width = 9; c.height = 9;
      c.getContext("2d").drawImage(S.img, Math.max(0, p[0] * w - 4), Math.max(0, p[1] * h - 4), 9, 9, 0, 0, 9, 9);
      var d = c.getContext("2d").getImageData(0, 0, 9, 9).data, r = 0, g = 0, b = 0;
      for (var i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
      return [r / 81, g / 81, b / 81];
    }
    function lerCfg() {
      var g = function (n) { return el.querySelector('[data-r="' + n + '"]'); };
      return { simples: g("simples").checked, maoA: g("maoA").value || null, maoB: g("maoB").value || null, formato: g("formato").value || null, saca: g("saca").value || null,
        placarFinal: g("final").value.trim(), semVantagem: g("semVant").checked, superTiebreakDecisivo: g("stb").checked };
    }

    /* ── processamento ── */
    function dividir(bat, dur) { // trechos separados por mais de 3,2 s sem batida (a falta de saque vira um trecho próprio)
      var l = [], cur = null;
      bat.forEach(function (t) { if (cur && t - cur[cur.length - 1] <= 3.2) cur.push(t); else { cur = [t]; l.push(cur); } });
      return l.map(function (h) { return { ini: Math.max(0, h[0] - 1.8), fim: Math.min(dur || 1e9, h[h.length - 1] + 2.4), hits: h }; });
    }
    function progresso(fr, t) { var b = el.querySelector('[data-r="barra"]'), m = el.querySelector('[data-r="pmsg"]'); if (b && fr != null) b.value = fr; if (m && t) m.textContent = t; }
    /* automático: acha a quadra sozinho no primeiro quadro; o atleta é quem está perto da câmera no começo (dá para trocar depois);
       mão e formato saem da própria partida. Se a quadra não for achada, cai na marcação manual. */
    async function iniciarAuto() {
      S.fase = "processando"; render(); progresso(0, "Procurando a quadra no vídeo…");
      /* alguns quadros espalhados pelo começo do jogo (o jogador pode tapar uma linha num deles); fica o que confirma mais
         linhas da quadra. Aceita com 4 ou mais linhas inteiras confirmadas */
      var bat = api.batidas(), dur = api.duracao() || 60, tempos = [];
      [0, 1, 2, 4, 7, 11].forEach(function (k) { if (bat[k] != null) tempos.push(bat[k] + 0.3); });
      [0.2, 0.35, 0.5, 0.65, 0.8].forEach(function (f) { // e espalhados pela partida, perto de uma batida (bola em jogo, câmera no jogo)
        var alvo = dur * f, perto = bat.length ? bat.reduce(function (m, b) { return Math.abs(b - alvo) < Math.abs(m - alvo) ? b : m; }, bat[0]) : alvo;
        if (tempos.every(function (x) { return Math.abs(x - perto) > 3; })) tempos.push(perto + 0.3);
      });
      if (!tempos.length) tempos = [Math.min(5, dur / 3), dur / 2];
      var r = null, img = null, asp = null; S.viuImagem = false;
      var bom = function () { return r && r.confirmadas >= 4 && r.visiveis >= 0.3; };
      async function procurar(lista, total0, total) {
        for (var k = 0; k < lista.length && raiz.QLQuadraAuto; k++) {
          if (S.sinal && S.sinal.cancelado) return;
          await pegarQuadro(lista[k]); if (!S.img) continue; S.viuImagem = true;
          var w = 640, h = Math.round(w / S.asp), c = document.createElement("canvas"); c.width = w; c.height = h;
          var x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(S.img, 0, 0, w, h);
          await new Promise(function (ok) { setTimeout(ok, 30); });
          var rk = null; try { rk = raiz.QLQuadraAuto.detectar(x.getImageData(0, 0, w, h).data, w, h); } catch (e) { rk = null; }
          if (rk && (!r || rk.confirmadas > r.confirmadas || (rk.confirmadas === r.confirmadas && rk.nota > r.nota))) { r = rk; img = S.img; asp = S.asp; S.tQuadra = lista[k]; }
          if (r && r.confirmadas >= 7) break;
          progresso((total0 + k + 1) / total * 0.1, "Procurando a quadra no vídeo… (" + (total0 + k + 1) + "/" + total + ")");
        }
      }
      /* 1º os momentos de sempre; só se a quadra não aparecer, o resto da partida (câmera que mudou de lugar, linhas tapadas) */
      var extras = [];
      [0.1, 0.3, 0.45, 0.6, 0.7, 0.9].forEach(function (f) {
        var alvo = dur * f, perto = bat.length ? bat.reduce(function (m, b) { return Math.abs(b - alvo) < Math.abs(m - alvo) ? b : m; }, bat[0]) : alvo;
        if (tempos.concat(extras).every(function (x) { return Math.abs(x - (perto + 0.3)) > 3; })) extras.push(perto + 0.3);
      });
      await procurar(tempos, 0, tempos.length + extras.length);
      if (!bom()) await procurar(extras, tempos.length, tempos.length + extras.length);
      if (img) { S.img = img; S.asp = asp; }
      if (!r || r.confirmadas < 3 || r.visiveis < 0.25) {
        /* tudo automático: sem marcação manual. Diz o que fazer para o próximo vídeo dar certo */
        S.fase = "semQuadra"; S.semImagem = !S.viuImagem; render();
        return;
      }
      S.cantos = r.cantos; S.quadraAuto = true;
      S.cfg = S.cfg || { simples: false, maoA: null, maoB: null, formato: null, saca: null, placarFinal: "", semVantagem: false, superTiebreakDecisivo: false };
      gerar(true);
    }
    async function gerar(auto) {
      if (!auto) S.cfg = lerCfg();
      var cal = VS.calibrar(S.cantos, { simples: S.cfg.simples, aspecto: S.asp, corA: S.atleta ? corEm(S.atleta) : null, corB: S.adv ? corEm(S.adv) : null });
      if (!cal) { msgCal("Os cantos não formam uma quadra. Refaça a marcação."); return; }
      cal.atletaComecaPerto = S.atleta ? VS.aplicarH(cal.H, S.atleta)[1] < 0 : S.atletaPerto !== false; S.ctx = cal;
      S.fase = "processando"; render(); progresso(0, S.quadraAuto ? "Quadra encontrada ✓ · lendo os pontos…" : "Lendo os pontos…");
      var trechos = dividir(api.batidas(), api.duracao());
      S.sinal = { cancelado: false };
      try {
        var r = await raiz.QLVisao.processar(api.arquivo(), api.video, trechos, cal, { sinal: S.sinal, aoProgresso: progresso });
        S.dados = r.dados; S.semPose = !r.pose;
        /* cor da roupa de cada um: do tronco (pose) nos primeiros pontos, antes da primeira troca de lado — mais firme que o toque */
        var cores = { perto: [], longe: [] };
        S.dados.slice(0, 3).forEach(function (d) { d.quadros.forEach(function (q) { q.jog.forEach(function (j) { if (j.cor && j.pe) cores[VS.aplicarH(cal.H, j.pe)[1] < 0 ? "perto" : "longe"].push(j.cor); }); }); });
        var mediana = function (l) { if (l.length < 5) return null; return [0, 1, 2].map(function (c) { var v = l.map(function (x) { return x[c]; }).sort(function (a, b) { return a - b; }); return v[Math.floor(v.length / 2)]; }); };
        S.cores = { perto: mediana(cores.perto), longe: mediana(cores.longe) };
        remontar();
        S.fase = "revisar"; S.salvo = false; render(); salvar(true);
      } catch (e) {
        S.erro = /cancelado/.test(e.message) ? "Scout cancelado." : "Não consegui gerar o scout: " + (e.message || e); S.fase = "erro"; render();
      }
    }
    /* refaz o scout a partir do que já foi lido do vídeo (sem ler de novo): troca de atleta, formato, mãos, placar final */
    function remontar() {
      var cal = S.ctx, cP = S.cores && S.cores.perto, cL = S.cores && S.cores.longe;
      cal.corA = cP && cL ? (cal.atletaComecaPerto ? cP : cL) : cal.corA; cal.corB = cP && cL ? (cal.atletaComecaPerto ? cL : cP) : cal.corB;
      if (cal.corA && cal.corB && Math.hypot(cal.corA[0] - cal.corB[0], cal.corA[1] - cal.corB[1], cal.corA[2] - cal.corB[2]) < 45) cal.corA = cal.corB = null; // roupas parecidas: vale só a regra de troca de lado
      var maos = { A: S.cfg.maoA || (S.maosAuto && S.maosAuto.A) || "D", B: S.cfg.maoB || (S.maosAuto && S.maosAuto.B) || "D" };
      var base = { saca: S.cfg.saca, atletaComecaPerto: cal.atletaComecaPerto, placarFinal: S.cfg.placarFinal };
      if (S.cfg.formato) { base.formato = S.cfg.formato; base.semVantagem = S.cfg.semVantagem; base.superTiebreakDecisivo = S.cfg.superTiebreakDecisivo; }
      var rodar = function () { cal.mao = maos; S.an = S.dados.map(function (d) { return VS.analisarPonto(d, cal); }); S.dec = VS.decodificarAuto(S.an, base); };
      rodar();
      if (!S.cfg.maoA || !S.cfg.maoB) {
        var m = VS.maosAuto(S.dados, S.an, S.dec, cal); S.maosAuto = m;
        var novas = { A: S.cfg.maoA || m.A, B: S.cfg.maoB || m.B };
        if (novas.A !== maos.A || novas.B !== maos.B) { maos = novas; rodar(); }
      }
      S.maos = maos;
      S.regras = { formato: S.dec.cfg.formato || "3sets", semVantagem: !!S.dec.cfg.semVantagem, superTiebreakDecisivo: !!S.dec.cfg.superTiebreakDecisivo };
      S.pontos = VS.montarScout(S.an, S.dec, function (k, op) { return VS.analisarPonto(S.dados[k], cal, op); });
      S.sacaInicial = S.pontos.length ? S.pontos[0].sacador : (S.cfg.saca || "nos");
      recalcular();
    }
    function processando() {
      el.innerHTML = '<div class="qm-card"><h3 class="qm-h">Gerando o scout…</h3><div class="qm-row"><progress data-r="barra" max="1" value="0" style="flex:1;min-width:160px;height:10px;accent-color:#0B3B2E"></progress><button data-a="parar">Cancelar</button></div>' +
        '<p class="qm-msg" data-r="pmsg">Preparando a leitura do vídeo e o modelo de pose (na primeira vez baixa ~10 MB)…</p></div>';
      el.querySelector('[data-a="parar"]').onclick = function () { if (S.sinal) S.sinal.cancelado = true; };
    }

    /* ── placar e campos derivados depois de uma edição ── */
    function recalcular() {
      var e = VS.Placar.inicial(S.regras, S.sacaInicial);
      S.pontos.forEach(function (p, i) {
        p.n = i + 1; p.placarAntes = VS.Placar.rotulo(e); p.jogo = VS.Placar.jogo(e); p.set = VS.Placar.set(e); p.lado = VS.Placar.lado(e); p.adverso = VS.Placar.adverso(e);
        var sac = VS.Placar.quemSaca(e); if (sac !== p.sacador) { p.sacador = sac; }
        e = VS.Placar.aplicar(e, p.nos); p.placarDepois = textoPlacar(e);
      });
      S.placar = e;
    }
    function textoPlacar(e) { var g = VS.Placar.texto(e); return e.fim ? g : (g ? g + " · " : "games 0-0 · ") + VS.Placar.rotulo(e); }
    function precisaConferir(p) { return ["nos", "fim", "saque"].some(function (k) { return p.auto[k] === "baixa"; }); }

    /* ── revisão ── */
    function chip(rot, val, conf) { return val ? "<span>" + esc(rot) + ": <b>" + esc(val) + "</b>" + (conf ? '<i class="' + conf + '" title="' + ({ alta: "confiável", media: "confira", baixa: "em dúvida", treinador: "marcado por você" }[conf] || "") + '">' + (conf === "baixa" ? "?" : "●") + "</i>" : "") + "</span>" : ""; }
    function seqHTML(p, n) {
      return (p.batidas || []).map(function (b) {
        return "<b>" + esc(b.quem === "nos" ? n.A : n.B) + "</b> " + esc(CURTO[b.golpe] || "?") + (b.direcao ? " " + ({ cruzado: "cruzado", paralelo: "paralelo", centro: "no meio" }[b.direcao]) : "") + (b.efeito ? " · " + ROT(EFEITOS, b.efeito).toLowerCase() : "");
      }).join(" → ");
    }
    function revisar() {
      var n = nomes(), conf = S.pontos.filter(precisaConferir).length, alvo = S.cfg.placarFinal;
      var lista = S.pontos.map(function (p, i) { return [p, i]; }).filter(function (x) { return S.filtro === "todos" || precisaConferir(x[0]); });
      var regrasTxt = { "3sets": "Melhor de 3 sets", "1set": "Set único", "4games": "Set a 4 games", tb7: "Só tie-break (7 pontos)", tb10: "Match tie-break (10 pontos)" }[S.regras.formato] + (S.regras.semVantagem ? " · sem vantagem" : "") + (S.regras.superTiebreakDecisivo ? " · super tie-break" : "");
      var opF = function (v, r) { return '<option value="' + v + '"' + ((S.cfg.formato || "") === v ? " selected" : "") + ">" + r + "</option>"; };
      var opM = function (k, v, r) { return '<option value="' + v + '"' + ((S.cfg[k] || "") === v ? " selected" : "") + ">" + r + "</option>"; };
      var maoTxt = function (m) { return m === "E" ? "canhoto" : "destro"; };
      el.innerHTML = '<div class="qm-card"><h3 class="qm-h">Scout da partida · gerado e salvo automaticamente</h3>' +
        '<p class="qm-msg">' + (S.quadraAuto ? "Quadra achada sozinha ✓" : "Quadra marcada à mão") + " · " + esc(n.A) + " começa " + (S.ctx.atletaComecaPerto ? "perto" : "longe") + " da câmera · " + esc(n.A) + " " + maoTxt(S.maos.A) + ", " + esc(n.B) + " " + maoTxt(S.maos.B) + (S.cfg.maoA && S.cfg.maoB ? "" : " (pelo saque)") + " · " + esc(regrasTxt) + (S.cfg.formato ? "" : " (detectado)") + "</p>" +
        '<details class="vs-aj"><summary class="qm-msg" style="cursor:pointer">Ajustar (se algo acima não estiver certo)</summary><div class="vs-form">' +
        '<label>Quem é ' + esc(n.A) + '<button data-a="trocar" type="button">É o outro jogador (trocar)</button></label>' +
        '<label>Formato<select data-aj="formato">' + opF("", "Automático") + opF("3sets", "Melhor de 3 sets") + opF("1set", "Set único") + opF("4games", "Set a 4 games") + opF("tb7", "Só tie-break (7)") + opF("tb10", "Match tie-break (10)") + "</select></label>" +
        '<label>Mão de ' + esc(n.A) + '<select data-aj="maoA">' + opM("maoA", "", "Automático") + opM("maoA", "D", "Destro") + opM("maoA", "E", "Canhoto") + "</select></label>" +
        '<label>Mão de ' + esc(n.B) + '<select data-aj="maoB">' + opM("maoB", "", "Automático") + opM("maoB", "D", "Destro") + opM("maoB", "E", "Canhoto") + "</select></label>" +
        '<label>Placar final (ajuda a acertar quem ganhou cada ponto)<span style="display:flex;gap:6px"><input type="text" data-aj="placarFinal" placeholder="ex.: 6-4 3-6 10-8" value="' + esc(S.cfg.placarFinal || "") + '" style="flex:1"><button type="button" data-a="aplicarPlacar">Aplicar</button></span></label>' +
        '</div></details>' +
        '<div class="vs-res"><div><b>' + esc(textoPlacar(S.placar)) + "</b>placar reconstruído" + (S.placar.fim ? " · fim de jogo" : "") + "</div><div><b>" + S.pontos.length + "</b>pontos</div><div><b>" + conf + "</b>para conferir</div></div>" +
        (alvo ? '<p class="qm-msg">' + (S.dec.confere ? "✓ Bate com o placar final informado (" + esc(alvo) + ")." : "⚠ Não bateu com o placar informado (" + esc(alvo) + "): confira os pontos marcados.") + "</p>" : "") +
        (S.semPose ? '<p class="qm-msg">⚠ O modelo de pose não carregou (sem internet?): golpes e efeito ficaram em branco para você marcar.</p>' : "") +
        '<p class="qm-msg">Legenda: <span style="color:var(--qok);font-weight:800">●</span> confiável · <span style="color:#C99A2E;font-weight:800">●</span> confira · <span style="color:var(--qat);font-weight:800">?</span> em dúvida · <span style="color:var(--qa);font-weight:800">●</span> marcado por você. Toque em ▶ para ver o ponto.</p>' +
        '<div data-r="slotVideo"></div>' +
        '<div class="qm-row" style="margin-top:8px"><button data-f="todos"' + (S.filtro === "todos" ? ' class="qm-pri"' : "") + '>Todos</button><button data-f="conf"' + (S.filtro === "conf" ? ' class="qm-pri"' : "") + ">Para conferir (" + conf + ")</button></div>" +
        '<div data-r="pts">' + lista.map(function (x) { return cartao(x[0], x[1], n); }).join("") + (lista.length ? "" : '<p class="qm-msg">Nada para conferir. 👍</p>') + "</div>" +
        '<div class="qm-row" style="margin-top:12px"><button class="qm-pri" data-a="salvar">' + (S.salvo ? "Salvar de novo" : "Salvar scout no caderno do jogador") + '</button><button data-a="csv">Baixar CSV</button></div><p class="qm-msg" data-r="smsg">' + (S.salvo ? "Salvo no caderno do jogador ✓ (as correções também são salvas sozinhas)." : "") + "</p></div>" +
        (raiz.QLPadroes ? '<div class="qm-card"><h3 class="qm-h">Padrões da partida</h3><p class="qm-msg">Como cada ponto foi construído: as sequências exatas que deram ponto e as que deram erro, dos dois lados. Somando vários jogos, os padrões aparecem na aba Evolução.</p>' + raiz.QLPadroes.html(raiz.QLPadroes.analisar(S.pontos), n) + "</div>" : "");
      var slot = el.querySelector('[data-r="slotVideo"]'); if (api.video && api.moverVideo) api.moverVideo(slot);
      [].forEach.call(el.querySelectorAll("[data-f]"), function (b) { b.onclick = function () { S.filtro = b.getAttribute("data-f"); S.aberto = -1; render(); }; });
      el.querySelector('[data-a="salvar"]').onclick = function () { salvar(); };
      el.querySelector('[data-a="csv"]').onclick = csv;
      var refazerTudo = function () { remontar(); S.aberto = -1; render(); salvar(true); };
      el.querySelector('[data-a="trocar"]').onclick = function () {
        S.ctx.atletaComecaPerto = !S.ctx.atletaComecaPerto; S.atletaPerto = S.ctx.atletaComecaPerto; S.atleta = S.adv = null;
        var a = S.cfg.maoA; S.cfg.maoA = S.cfg.maoB; S.cfg.maoB = a; if (S.cfg.saca) S.cfg.saca = S.cfg.saca === "nos" ? "ele" : "nos";
        if (S.maosAuto) S.maosAuto = { A: S.maosAuto.B, B: S.maosAuto.A };
        refazerTudo();
      };
      [].forEach.call(el.querySelectorAll("select[data-aj]"), function (sl) { sl.onchange = function () { S.cfg[sl.getAttribute("data-aj")] = sl.value || null; if (sl.getAttribute("data-aj") === "formato") { S.cfg.semVantagem = false; S.cfg.superTiebreakDecisivo = false; } refazerTudo(); }; });
      el.querySelector('[data-a="aplicarPlacar"]').onclick = function () { S.cfg.placarFinal = el.querySelector('[data-aj="placarFinal"]').value.trim(); refazerTudo(); };
      el.querySelector('[data-r="pts"]').onclick = function (e) {
        var b = e.target.closest("[data-i]"); if (!b) return; var i = +b.getAttribute("data-i"), ac = b.getAttribute("data-acao"), p = S.pontos[i];
        if (ac === "ver") { pararRastro(); api.tocar(p.video.falta != null ? p.video.falta : p.video.ini, p.video.fim); }
        if (ac === "rastro") verRastreamento(i);
        if (ac === "editar") { S.aberto = S.aberto === i ? -1 : i; render(); var c = el.querySelector('[data-cart="' + i + '"]'); if (c && c.scrollIntoView) c.scrollIntoView({ block: "nearest" }); }
        if (ac === "remover" && window.confirm("Tirar este trecho do scout (não era ponto)?")) { S.pontos.splice(i, 1); S.aberto = -1; recalcular(); render(); salvar(true); }
      };
      el.querySelector('[data-r="pts"]').onchange = function (e) {
        var c = e.target.closest("[data-ed]"); if (!c) return; var i = +c.getAttribute("data-ed"), k = e.target.getAttribute("data-k"), p = S.pontos[i], v = e.target.type === "checkbox" ? e.target.checked : (e.target.value || null);
        aplicarEdicao(p, k, v); recalcular(); render(); salvar(true);
      };
    }
    /* ── rastreamento: o que a visão leu do vídeo, desenhado por cima do ponto, para conferir o tracking:
       linhas da quadra (acompanhando a câmera), os dois jogadores (pés e pose), a bola que o motor seguiu (e os outros
       candidatos, em cinza), os quiques e cada batida com quem bateu e o golpe ── */
    var LIG = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];
    var CURTO_G = { saque: "Saque", forehand: "Forehand", backhand: "Backhand", voleio: "Voleio", smash: "Smash", devolucao: "Devolução", drop: "Drop", lob: "Lob" };
    function pararRastro() {
      S.rastro = null;
      var c = el.querySelector("canvas.vs-rastro"), l = el.querySelector('[data-r="rastroLeg"]');
      if (c) c.remove(); if (l) l.remove();
    }
    function verRastreamento(i) {
      var p = S.pontos[i], v = api.video, slot = el.querySelector('[data-r="slotVideo"]');
      if (!p || p.k == null || !S.dados || !S.dados[p.k] || !v || !slot) return;
      pararRastro();
      var id = { i: i }; S.rastro = id;
      slot.style.position = "relative";
      var cv = document.createElement("canvas"); cv.className = "vs-rastro";
      cv.style.cssText = "position:absolute;left:0;top:0;pointer-events:none;z-index:2";
      slot.appendChild(cv);
      var n = nomes(), leg = document.createElement("div"); leg.setAttribute("data-r", "rastroLeg"); leg.className = "qm-msg";
      leg.innerHTML = '<b>Rastreamento do ponto ' + p.n + '</b> · <span style="color:#6c3">━ quadra</span> · <span style="color:#F08A3C">● ' + esc(n.A) + '</span> · <span style="color:#4F8EF7">● ' + esc(n.B) + '</span> · <span style="color:#FFE14D">● bola seguida</span> · <span style="color:#999">● outros candidatos</span> · <span style="color:#FF4FD8">✕ quique</span> <button type="button" data-a="fecharRastro">Fechar rastreamento</button>';
      slot.appendChild(leg);
      leg.querySelector('[data-a="fecharRastro"]').onclick = pararRastro;
      if (slot.scrollIntoView) slot.scrollIntoView({ block: "start", behavior: "smooth" });
      api.tocar(p.video.falta != null ? p.video.falta : p.video.ini, p.video.fim);
      var laco = function () {
        if (S.rastro !== id || !cv.isConnected) return;
        desenharRastro(cv, v, p, api.tempo ? api.tempo() : v.currentTime);
        requestAnimationFrame(laco);
      };
      requestAnimationFrame(laco);
    }
    function desenharRastro(cv, v, p, t) {
      /* o trecho lido que contém este instante (o ponto pode começar num 1º saque que foi falta, que é outro trecho) */
      var kk = p.k; S.dados.forEach(function (dd, j) { if (t >= dd.ini - 0.05 && t <= dd.fim + 0.05 && (kk === p.k ? !(t >= S.dados[p.k].ini && t <= S.dados[p.k].fim) : false)) kk = j; });
      var QA = raiz.QLQuadraAuto, d = S.dados[kk], an = S.an && S.an[kk], cal = S.ctx;
      var vw = v.clientWidth, vh = v.clientHeight; if (!vw || !vh) return;
      cv.style.left = v.offsetLeft + "px"; cv.style.top = v.offsetTop + "px";
      if (cv.width !== vw || cv.height !== vh) { cv.width = vw; cv.height = vh; }
      var x = cv.getContext("2d"); x.clearRect(0, 0, vw, vh);
      /* área da imagem dentro do <video> (o vídeo fica inteiro, com faixas se a proporção não bate) */
      var ar = v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : S.asp, cw = vw, ch = vw / ar;
      if (ch > vh) { ch = vh; cw = vh * ar; }
      var ox = (vw - cw) / 2, oy = (vh - ch) / 2;
      var perto = function (lista, t, lim) { var m = null; (lista || []).forEach(function (q) { if (Math.abs(q.t - t) <= lim && (!m || Math.abs(q.t - t) < Math.abs(m.t - t))) m = q; }); return m; };
      var q = perto(d.quadros, t, 0.2), comJog = perto(d.quadros.filter(function (z) { return z.jog && z.jog.length; }), t, 0.3);
      var G = (q && q.G) || (comJog && comJog.G) || null, inv = G && QA && QA.inverter ? QA.inverter(G) : null;
      var px = function (pt) { var r = inv ? VS.aplicarH(inv, pt) : pt; return [ox + r[0] * cw, oy + r[1] * ch]; };
      var linha = function (a, b) { x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); };
      var lw = Math.max(1.5, cw / 420);
      /* quadra */
      x.strokeStyle = "rgba(102,204,51,.9)"; x.lineWidth = lw;
      VS.linhasQuadra().forEach(function (sg) { linha(px(VS.aplicarH(cal.Hi, sg[0])), px(VS.aplicarH(cal.Hi, sg[1]))); });
      /* jogadores */
      var n = nomes(), ladoA = p.atletaPerto ? "perto" : "longe";
      if (comJog) comJog.jog.forEach(function (j) {
        if (!j.pe) return;
        var lado = VS.aplicarH(cal.H, j.pe)[1] < 0 ? "perto" : "longe", ehA = lado === ladoA, cor = ehA ? "#F08A3C" : "#4F8EF7";
        x.strokeStyle = cor; x.fillStyle = cor; x.lineWidth = lw * 1.4;
        if (j.lm) LIG.forEach(function (l) { var a = j.lm[l[0]], b = j.lm[l[1]]; if (a && b && (a.v == null || a.v > 0.3) && (b.v == null || b.v > 0.3)) linha(px([a.x, a.y]), px([b.x, b.y])); });
        var pe = px(j.pe); x.beginPath(); x.arc(pe[0], pe[1], lw * 3, 0, 7); x.fill();
        x.font = "bold " + Math.round(Math.max(11, cw / 70)) + "px system-ui,sans-serif"; x.fillText(ehA ? n.A : n.B, pe[0] + lw * 4, pe[1] + lw * 2);
      });
      /* bola: outros candidatos do quadro (cinza) e a trilha que o motor seguiu (amarelo) */
      if (q && q.bolas) { x.fillStyle = "rgba(170,170,170,.75)"; q.bolas.forEach(function (b) { var c = px(b); x.beginPath(); x.arc(c[0], c[1], lw * 1.6, 0, 7); x.fill(); }); }
      var bats = (an && an.batidas) || [];
      bats.forEach(function (b) {
        (b.trilha || []).forEach(function (pt) {
          var dt = t - pt.t; if (dt < -0.02 || dt > 0.5) return;
          var c = px([pt.x, pt.y]); x.fillStyle = "rgba(255,225,77," + (1 - dt / 0.55).toFixed(2) + ")";
          x.beginPath(); x.arc(c[0], c[1], lw * (dt < 0.05 ? 3.4 : 2.2), 0, 7); x.fill();
        });
        if (b.quique && b.quique.img && Math.abs(t - b.quique.t) < 0.9) {
          var c = px(b.quique.img), r = lw * 5; x.strokeStyle = "#FF4FD8"; x.lineWidth = lw * 1.6;
          linha([c[0] - r, c[1] - r], [c[0] + r, c[1] + r]); linha([c[0] - r, c[1] + r], [c[0] + r, c[1] - r]);
        }
      });
      /* batida da hora: quem bateu e o golpe, como o scout registrou */
      (kk === p.k ? p.batidas || [] : []).forEach(function (b, k) {
        if (Math.abs(t - b.t) > 0.45) return;
        var ab = bats[k], onde = ab && ab.P ? px(VS.aplicarH(cal.Hi, ab.P)) : [ox + 12, oy + 24];
        var txt = (b.quem === "nos" ? n.A : n.B) + " · " + (CURTO_G[b.golpe] || "batida") + (b.direcao ? " " + b.direcao : "");
        x.font = "bold " + Math.round(Math.max(12, cw / 55)) + "px system-ui,sans-serif";
        var w = x.measureText(txt).width + 12, X = Math.min(Math.max(ox + 4, onde[0] - w / 2), ox + cw - w - 4), Y = Math.max(oy + 4, onde[1] - lw * 26);
        x.fillStyle = "rgba(0,0,0,.72)"; x.fillRect(X, Y, w, Math.max(18, cw / 40)); x.fillStyle = "#fff"; x.fillText(txt, X + 6, Y + Math.max(13, cw / 55));
      });
      x.fillStyle = "rgba(0,0,0,.6)"; x.fillRect(ox + 4, oy + ch - 22, 128, 18); x.fillStyle = "#fff"; x.font = "12px system-ui,sans-serif";
      x.fillText("t = " + t.toFixed(2) + " s" + (inv ? " · câmera móvel" : ""), ox + 10, oy + ch - 9);
    }
    function aplicarEdicao(p, k, v) {
      p.auto = p.auto || {};
      if (k === "fim") { p.fim = v; p.nos = FIM.filter(function (f) { return f[0] === v; })[0][2]; p.auto.fim = p.auto.nos = "treinador"; if (p.saque === "ace" || p.saque === "df") p.saque = "1"; }
      else if (k === "saque") {
        p.saque = v; p.auto.saque = "treinador";
        if (v === "ace" || v === "df") { var meu = p.sacador === "nos"; p.nos = v === "ace" ? meu : !meu; p.fim = v === "ace" ? (meu ? "winner_nos" : "winner_dele") : (meu ? "erro_nos" : "erro_dele"); p.bola = "1-2"; p.auto.nos = p.auto.fim = "treinador"; }
      } else { p[k] = v; p.auto[k] = "treinador"; }
    }
    function sel(k, lista, v, vazio) { return '<select data-k="' + k + '">' + (vazio ? '<option value="">' + vazio + "</option>" : "") + lista.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === v ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select>"; }
    function cartao(p, i, n) {
      var a = p.auto || {}, quemSaca = p.sacador === "nos" ? n.A : n.B, fimR = ROT(FIM, p.fim).replace("do atleta", "de " + n.A).replace("do adversário", "de " + n.B);
      var h = '<div class="vs-pt' + (precisaConferir(p) ? " conf" : "") + '" data-cart="' + i + '"><h4><span>Ponto ' + p.n + " · " + p.set + "º set · game " + p.jogo + " · " + esc(p.placarAntes) + '</span><span style="font-weight:500;color:var(--qmut)">saque ' + esc(quemSaca) + " (" + (p.lado === "D" ? "iguais" : "vantagem") + ")" + (p.video ? " · " + fmt(p.video.ini) : "") + "</span></h4>" +
        '<div class="vs-ch">' + chip("Ponto", p.nos ? n.A : n.B, a.nos) + chip("Fim", fimR, a.fim) + chip("Saque", ROT(SAQUE, p.saque), a.saque) + chip("Direção do saque", ROT(DIR_SAQUE, p.dirSaque), a.dirSaque) + chip("Bolas", ROT(BOLAS, p.bola), a.bola) + "</div>" +
        '<div class="vs-ch">' + chip("Último golpe de " + n.A, ROT(GOLPES, p.golpe), a.golpe) + chip("Direção", ROT(DIRECOES, p.direcao), a.direcao) + chip("Efeito", ROT(EFEITOS, p.efeito), a.efeito) +
        (p.corrida ? chip("", "na corrida", a.corrida) : "") + (p.rede ? chip("", "subiu à rede", a.rede) : "") + chip("Situação", ROT(SITUACOES, p.situacao), a.situacao) + chip("Decisão", ROT(DECISOES, p.dec), a.dec) + "</div>" +
        (p.batidas && p.batidas.length ? '<div class="vs-seq">' + seqHTML(p, n) + "</div>" : "") +
        '<div class="qm-row" style="margin-top:8px"><button data-i="' + i + '" data-acao="ver">▶ Ver</button>' + (p.k != null && S.dados && S.dados[p.k] ? '<button data-i="' + i + '" data-acao="rastro">👁 Ver rastreamento</button>' : "") + '<button data-i="' + i + '" data-acao="editar">' + (S.aberto === i ? "Fechar" : "Editar / completar") + '</button><button class="qm-x" data-i="' + i + '" data-acao="remover">Não era ponto</button><span class="qm-msg">depois: ' + esc(p.placarDepois || "") + "</span></div>";
      if (S.aberto === i) {
        h += '<div class="vs-ed" data-ed="' + i + '">' +
          "<label>Como terminou" + sel("fim", FIM.map(function (f) { return [f[0], f[1].replace("do atleta", "de " + n.A).replace("do adversário", "de " + n.B)]; }), p.fim) + "</label>" +
          "<label>Saque" + sel("saque", SAQUE, p.saque) + "</label><label>Direção do saque" + sel("dirSaque", DIR_SAQUE, p.dirSaque, "—") + "</label>" +
          "<label>Em que bola terminou" + sel("bola", BOLAS, p.bola) + "</label>" +
          "<label>Último golpe de " + esc(n.A) + sel("golpe", GOLPES, p.golpe, "—") + "</label><label>Direção" + sel("direcao", DIRECOES, p.direcao, "—") + "</label>" +
          "<label>Efeito" + sel("efeito", EFEITOS, p.efeito, "—") + "</label>" +
          '<label>Na corrida / rede<span style="display:flex;gap:10px;color:var(--qink)"><span><input type="checkbox" data-k="corrida"' + (p.corrida ? " checked" : "") + '> na corrida</span><span><input type="checkbox" data-k="rede"' + (p.rede ? " checked" : "") + "> subiu à rede</span></span></label>" +
          "<label>Situação do ponto" + sel("situacao", SITUACOES, p.situacao, "—") + "</label><label>Decisão de " + esc(n.A) + sel("dec", DECISOES, p.dec, "—") + "</label>" +
          (p.fim === "erro_nos" ? "<label>Causa do erro" + sel("causa", [["decisao", "Decisão"], ["execucao", "Execução"]], p.causa, "—") + "</label>" : "") +
          (p.sacador === "ele" && p.saque !== "ace" && p.saque !== "df" ? "<label>Qualidade da devolução" + sel("qualDev", QUAL_DEV, p.qualDev, "—") + "</label>" : "") + "</div>";
      }
      return h + "</div>";
    }
    function pontosParaSalvar() { return compactar(S.pontos); }
    function salvar(silencioso) {
      var n = nomes(), pts = pontosParaSalvar(), m = el.querySelector('[data-r="smsg"]');
      if (!pts.length) return;
      S.idScout = S.idScout || "pv" + Date.now().toString(36);
      var arq = api.arquivo(), quando = arq && arq.lastModified ? new Date(arq.lastModified) : null;
      var dados = { id: S.idScout, data: quando && !isNaN(quando) ? quando.toISOString().slice(0, 10) : null, pontos: pts, placar: S.placar, cfg: { formato: S.regras.formato, saca: S.sacaInicial, semVantagem: S.regras.semVantagem, superTiebreakDecisivo: S.regras.superTiebreakDecisivo, adversario: n.B === "Adversário" ? "" : n.B, torneio: "" } };
      try {
        var r = api.aoSalvarScout ? api.aoSalvarScout(dados) : null;
        if (api.aoSalvarVideo) api.aoSalvarVideo(S.pontos);
        S.salvo = true; Promise.resolve(r).then(function () { if (m) m.textContent = api.aoSalvarScout ? "Scout salvo no caderno do jogador, junto com os scouts dos outros jogos." : "Scout pronto (baixe o CSV)."; });
        var bt = el.querySelector('[data-a="salvar"]'); if (bt) bt.textContent = "Salvar de novo";
      } catch (e) { if (m) m.textContent = "Não foi possível salvar agora: " + (e.message || e); }
    }
    function csv() {
      var n = nomes(), linhas = ["ponto;set;game;placar;sacador;lado;saque;dir_saque;vencedor;fim;bolas;ultimo_golpe;direcao;efeito;na_corrida;rede;situacao;decisao;batidas;video_inicio"];
      S.pontos.forEach(function (p) { linhas.push([p.n, p.set, p.jogo, p.placarAntes, p.sacador === "nos" ? n.A : n.B, p.lado, p.saque, p.dirSaque || "", p.nos ? n.A : n.B, p.fim, p.bola, p.golpe || "", p.direcao || "", p.efeito || "", p.corrida ? "sim" : "", p.rede ? "sim" : "", p.situacao || "", p.dec || "", compactar([p])[0].seq, p.video ? fmt(p.video.ini) : ""].join(";")); });
      var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + linhas.join("\n")], { type: "text/csv" })); a.download = "scout-video.csv"; a.click();
    }
    if (api.autoIniciar) iniciarAuto(); else render();
    return { estado: S, recalcular: recalcular, _definir: function (pontos, cfg, dec) { S.pontos = pontos; S.cfg = cfg; S.dec = dec || { confere: null }; S.sacaInicial = pontos.length ? pontos[0].sacador : "nos"; recalcular(); S.fase = "revisar"; render(); } };
  }
  /* pontos no formato gravado no caderno (sem os detalhes só da tela), com as batidas compactas em "seq" */
  var CAMPOS = ["fim", "nos", "saque", "bola", "causa", "rede", "situacao", "golpe", "corrida", "direcao", "efeito", "qualDev", "dec", "dirSaque", "adverso", "sacador", "lado", "n", "placarAntes", "jogo", "set"];
  function compactar(pontos) {
    return pontos.map(function (p) {
      var q = {}; CAMPOS.forEach(function (k) { q[k] = p[k] == null ? null : p[k]; });
      q.seq = (p.batidas || []).map(function (b) { return (b.quem === "nos" ? "n" : "e") + ({ saque: "S", forehand: "FH", backhand: "BH", voleio: "V", smash: "SM", devolucao: "D" }[b.golpe] || "?") + ({ cruzado: "c", paralelo: "p", centro: "m" }[b.direcao] || "") + ({ top: "t", slice: "s", flat: "f" }[b.efeito] || "") + ({ funda: "F", media: "M", curta: "C" }[b.profundidade] || "") + (b.vel ? ":" + b.vel : ""); }).join(" ");
      q.origem = "video"; return q;
    });
  }
  raiz.QLVideoScoutUI = { montar: montar, compactar: compactar };
})(typeof window !== "undefined" ? window : this);
