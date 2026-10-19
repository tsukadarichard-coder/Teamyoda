/* Jogo em vídeo → rascunho de scout · Tecnologia QuadraLab.
   O som das batidas separa a partida em pontos; o treinador revisa cada clipe e classifica. O vídeo não sai do aparelho.
   Depende de scout/video-segmentador.js (QLSegmentador), movimento-motor.js (QLBiomec.cota) e movimento.css.
   QLVideoJogo.montar(el, { atleta, historico, cota, cotaDe, aoSalvar, aoRemover, aoMudar, logo }) · QLVideoJogo.evolucaoHTML(historico) */
(function (raiz) {
  var S = raiz.QLSegmentador, TIPOS = ["", "Ace", "Dupla falta", "Winner", "Erro forçado", "Erro não forçado"];
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fmt(t) { var m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ":" + (s < 10 ? "0" : "") + s; }
  function data(iso) { try { return new Date(iso).toLocaleDateString("pt-BR"); } catch (e) { return ""; } }
  function ordenar(l) { return (l || []).slice().sort(function (a, b) { return a.criadoEm < b.criadoEm ? -1 : 1; }); }

  function tabelaCmp(c) {
    if (!c || !c.linhas.length) return "";
    return '<p class="qm-cmp-s">' + c.melhoraram + (c.melhoraram === 1 ? " medida melhorou" : " medidas melhoraram") + " e " + c.pioraram + (c.pioraram === 1 ? " piorou" : " pioraram") + " em relação à média dos " + c.n + (c.n === 1 ? " jogo anterior" : " jogos anteriores") + " em vídeo.</p>" +
      "<table><thead><tr><th>Medida</th><th>Este jogo</th><th>Média anteriores</th><th>Último</th><th>Evolução</th></tr></thead><tbody>" + c.linhas.map(function (l) {
        return "<tr><td>" + esc(l.rot) + "</td><td>" + esc(l.atual) + "</td><td>" + esc(l.media) + "</td><td>" + esc(l.ultimo) + "</td><td>" + (l.sentido > 0 ? '<span class="qm-up">▲ melhor</span>' : l.sentido < 0 ? '<span class="qm-dn">▼ pior</span>' : '<span class="qm-eq">' + (l.neutro ? "—" : "= igual") + "</span>") + "</td></tr>";
      }).join("") + "</tbody></table>";
  }

  function grafico(lista) {
    var v = lista.filter(function (h) { return typeof h.res.pctGanhos === "number"; });
    if (v.length < 2) return '<p class="qm-msg">O gráfico aparece a partir do segundo jogo em vídeo.</p>';
    var W = 320, H = 110, pl = 30, pr = 10, pt = 10, pb = 22;
    function X(k) { return pl + (W - pl - pr) * (k / (v.length - 1)); } function Y(x) { return pt + (H - pt - pb) * (1 - x / 100); }
    var g = [0, 50, 100].map(function (n) { return '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(n) + '" y2="' + Y(n) + '" stroke="#E7E3DA"/><text x="' + (pl - 5) + '" y="' + (Y(n) + 4) + '" font-size="10" text-anchor="end" fill="#5C6B78">' + n + "%</text>"; }).join("");
    var pts = v.map(function (h, k) { return X(k).toFixed(1) + "," + Y(h.res.pctGanhos).toFixed(1); }).join(" ");
    return '<svg class="qm-graf" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Pontos ganhos por jogo em vídeo">' + g + '<polyline fill="none" stroke="#0B3B2E" stroke-width="2.2" points="' + pts + '"/>' +
      v.map(function (h, k) { return '<circle cx="' + X(k).toFixed(1) + '" cy="' + Y(h.res.pctGanhos).toFixed(1) + '" r="3.6" fill="#fff" stroke="#0B3B2E" stroke-width="2"/><text x="' + X(k).toFixed(1) + '" y="' + (H - 6) + '" font-size="9.5" text-anchor="middle" fill="#5C6B78">' + data(h.criadoEm).slice(0, 5) + "</text>"; }).join("") + '</svg><p class="qm-msg">Pontos ganhos pelo jogador em cada jogo em vídeo.</p>';
  }

  function evolucaoHTML(historico) {
    var l = ordenar(historico);
    if (!l.length) return '<p class="qm-msg">Ainda não há jogos em vídeo salvos para este jogador. A cada novo jogo, a evolução aparece aqui.</p>';
    var ult = l[l.length - 1], ant = l.slice(0, -1), cmp = ant.length ? S.compararVideo(ult.res, ant) : null;
    return '<div class="qm-card"><h3 class="qm-h">Jogos em vídeo · ' + l.length + (l.length === 1 ? " jogo" : " jogos") + "</h3>" + grafico(l) +
      (cmp ? "<h4>Último jogo × anteriores</h4>" + tabelaCmp(cmp) : '<p class="qm-msg">Primeiro jogo em vídeo: ' + (ult.res.pctGanhos == null ? "" : ult.res.pctGanhos + "% dos pontos ganhos, ") + ult.res.total + " pontos. No próximo, o app compara automaticamente.</p>") + "</div>";
  }

  function montar(el, o) {
    o = o || {};
    var st = { pts: [], sel: 0, en: null, dur: 0, url: null, fim: null, arq: null, historico: (o.historico || []).slice(), cota: o.cota || null, regId: null, salvo: false };
    el.classList.add("qlm");
    el.innerHTML = '<div class="qm-card"><div id="vj-cota"></div><div class="qm-row"><label class="qm-btn">Escolher vídeo da partida<input data-r="arq" type="file" accept="video/*" hidden></label>' +
      '<label>Atleta <input type="text" data-r="nA" style="width:130px"></label><label>Adversário <input type="text" data-r="nB" value="Adversário" style="width:130px"></label>' +
      '<button class="qm-pri" data-r="go" disabled>Detectar pontos</button></div>' +
      '<div class="qm-row" style="margin-top:8px"><label>Sensibilidade <input data-r="sens" type="range" min="1" max="10" value="5"></label><label>Pausa que separa pontos (s) <input data-r="gap" type="number" value="6" min="2" max="30" style="width:70px"></label><button data-r="re" disabled>Reprocessar</button></div>' +
      '<p class="qm-msg" data-r="st">Câmera fixa e perto da quadra captam melhor o som da bola. Vídeos de até cerca de 1 hora funcionam; acima disso o navegador pode ficar sem memória.</p></div>' +
      '<div data-r="rev" hidden><div class="qm-card"><div class="qm-kp" data-r="kp"></div>' +
      '<div class="vj-grid" style="margin-top:12px"><div><video class="vj-video" data-r="v" controls playsinline></video>' +
      '<div class="qm-row" style="margin-top:8px"><button data-r="ant">◀ Anterior</button><button data-r="rep">↻ Rever</button><button data-r="prox">Próximo ▶</button><button data-r="add">+ Ponto aqui</button></div>' +
      '<p class="qm-msg">Atalhos: ← → trocam de ponto · espaço revê · A / B marcam o vencedor.</p></div><div><div class="vj-lista" data-r="lista"></div></div></div></div>' +
      '<div class="qm-card" data-r="cmpC" hidden><h3 class="qm-h">Comparação com os jogos em vídeo anteriores</h3><div data-r="cmp"></div></div>' +
      '<div class="qm-card"><div class="qm-row"><button class="qm-pri" data-r="salvar">Salvar jogo no histórico</button><button data-r="csv">Baixar CSV</button><button data-r="json">Baixar JSON</button></div><p class="qm-msg" data-r="salvoMsg"></p></div></div>' +
      '<div class="qm-card" data-r="evoC"><h3 class="qm-h">Evolução dos jogos em vídeo</h3><div data-r="evo"></div><div data-r="hl"></div></div>';
    var q = function (n) { return el.querySelector('[data-r="' + n + '"]'); }, v = q("v");
    function msg(t) { q("st").textContent = t; }
    function cota() {
      var c = st.cota, slot = el.querySelector("#vj-cota");
      if (!c || c.limite == null) { slot.innerHTML = ""; return; }
      var t = c.bloqueado ? "O jogo em vídeo não está incluído no seu plano atual. Está disponível no Essencial (quantidade mensal) e no Premium (ilimitado)."
        : (c.liberado ? "Plano com limite: " + c.usados + " de " + c.limite + " jogos em vídeo salvos neste mês (" + c.restantes + " restantes). No Premium é ilimitado."
          : "Você salvou os " + c.limite + " jogos em vídeo deste mês. Eles voltam no próximo mês, ou passe ao Premium para jogos ilimitados.");
      slot.innerHTML = '<div class="qm-cota' + (c.liberado ? "" : " bloq") + '">' + esc(t) + "</div>";
      q("go").disabled = !c.liberado || !st.arq; q("salvar").disabled = !c.liberado && !st.salvo;
    }
    function renderHist() {
      q("evo").innerHTML = evolucaoHTML(st.historico);
      var l = ordenar(st.historico).reverse();
      q("hl").innerHTML = l.length ? '<h4>Jogos salvos</h4><table><tbody>' + l.map(function (h) {
        return "<tr><td>" + data(h.criadoEm) + "</td><td>vs " + esc(h.adversario || "adversário") + "</td><td>" + (h.res.pctGanhos == null ? "—" : h.res.pctGanhos + "% dos pontos") + " · " + h.res.total + " pts</td>" + (o.aoRemover ? '<td><button class="qm-x" data-rm="' + esc(h.id) + '">Remover</button></td>' : "") + "</tr>";
      }).join("") + "</tbody></table>" : "";
    }
    q("hl").onclick = function (e) {
      var b = e.target.closest("[data-rm]"); if (!b || !o.aoRemover) return; if (!window.confirm("Remover este jogo do histórico?")) return;
      var id = b.getAttribute("data-rm"); st.historico = st.historico.filter(function (h) { return h.id !== id; });
      Promise.resolve(o.aoRemover(id)).catch(function () {}); if (o.aoMudar) o.aoMudar(st.historico); if (o.cotaDe) { st.cota = o.cotaDe(st.historico); cota(); } renderHist();
    };
    q("arq").onchange = function (e) {
      var f = e.target.files[0]; if (!f) return; if (st.url) URL.revokeObjectURL(st.url);
      st.url = URL.createObjectURL(f); v.src = st.url; st.arq = f; st.en = null; q("go").disabled = !!(st.cota && !st.cota.liberado); msg("Vídeo carregado: " + f.name);
    };
    async function decodifica() {
      var buf = await st.arq.arrayBuffer(), ac = new (window.AudioContext || window.webkitAudioContext)(), ab;
      try { ab = await ac.decodeAudioData(buf); } catch (e) { throw new Error("não consegui ler o áudio deste vídeo (formato ou tamanho). Tente exportar em MP4/H.264."); }
      st.dur = ab.duration; var x = ab.getChannelData(0), y = new Float32Array(x.length), a = 0.95;
      for (var i = 1; i < x.length; i++) y[i] = a * y[i - 1] + a * (x[i] - x[i - 1]);
      st.en = S.energia(y, ab.sampleRate, 10); ac.close();
    }
    async function processa() {
      if (st.cota && !st.cota.liberado) { cota(); return; }
      q("go").disabled = true;
      try {
        if (!st.en) { msg("Lendo o áudio…"); await decodifica(); }
        msg("Detectando batidas…"); var h = S.batidas(st.en, +q("sens").value), antigos = st.pts;
        st.pts = S.pontos(h, { gap: +q("gap").value, dur: st.dur }).map(function (p) {
          var ex = antigos.filter(function (x) { return Math.abs(x.saque - p.saque) < 1; })[0]; p.venc = ex ? ex.venc : ""; p.tipo = ex ? ex.tipo : ""; p.sacador = ex ? ex.sacador : ""; return p;
        });
        st.sel = 0; st.salvo = false; st.regId = null; render(); q("rev").hidden = false; q("re").disabled = false; msg(h.length + " batidas · " + st.pts.length + " pontos detectados. Revise os clipes.");
      } catch (e) { msg("Erro: " + e.message); }
      q("go").disabled = !!(st.cota && !st.cota.liberado);
    }
    q("go").onclick = processa; q("re").onclick = processa;
    function tocar(i) { if (i < 0 || i >= st.pts.length) return; st.sel = i; var p = st.pts[i]; v.currentTime = p.ini; st.fim = p.fim; v.play(); render(true); }
    v.addEventListener("timeupdate", function () { if (st.fim != null && v.currentTime >= st.fim) { v.pause(); st.fim = null; } });
    function render(manter) {
      var nA = q("nA").value || "Atleta", nB = q("nB").value || "Adversário", pl = S.placar(st.pts.map(function (p) { return p.venc; })), r = S.resumirJogo(st.pts);
      q("kp").innerHTML = '<div><b>' + r.total + '</b>pontos</div><div><b>' + r.classificados + "/" + r.total + '</b>classificados</div><div><b>' + (r.pctGanhos == null ? "—" : r.pctGanhos + "%") + '</b>pontos ganhos</div><div><b>' + (r.batidasMedia == null ? "—" : r.batidasMedia) + '</b>batidas/ponto</div>';
      var L = q("lista"); L.innerHTML = "";
      st.pts.forEach(function (p, i) {
        var d = document.createElement("div"); d.className = "vj-pt" + (i === st.sel ? " sel" : ""); var s = pl[i];
        d.innerHTML = '<h4><span>Ponto ' + p.n + " · " + fmt(p.ini) + "–" + fmt(p.fim) + '</span><span class="vj-plc">' + (s ? s.games[0] + "-" + s.games[1] + " · " + s.pontos : "") + "</span></h4>" +
          '<div class="qm-msg">' + p.golpes + " batidas · " + p.duracao.toFixed(1) + " s" + (p.suspeito ? ' · <span class="vj-sus">' + esc(p.suspeito) + "</span>" : "") + "</div>" +
          '<div class="qm-row" style="margin-top:6px"><button class="a' + (p.venc === "A" ? " on" : "") + '" data-k="A">' + esc(nA) + '</button><button class="b' + (p.venc === "B" ? " on" : "") + '" data-k="B">' + esc(nB) + "</button>" +
          '<select data-k="t">' + TIPOS.map(function (t) { return "<option" + (t === p.tipo ? " selected" : "") + ">" + t + "</option>"; }).join("") + "</select>" +
          '<select data-k="s"><option value="">Saque</option><option value="A"' + (p.sacador === "A" ? " selected" : "") + ">" + esc(nA) + '</option><option value="B"' + (p.sacador === "B" ? " selected" : "") + ">" + esc(nB) + "</option></select>" +
          '<input type="number" data-k="g" value="' + p.golpes + '" min="0" style="width:62px" title="golpes"><button data-k="x" title="remover">✕</button></div>';
        d.onclick = function (e) { if (e.target.closest("button,select,input")) return; tocar(i); };
        d.onchange = function (e) { var k = e.target.getAttribute("data-k"); if (k === "t") p.tipo = e.target.value; if (k === "s") p.sacador = e.target.value; if (k === "g") p.golpes = +e.target.value || 0; st.salvo = false; render(true); };
        [].forEach.call(d.querySelectorAll("button"), function (bt) { bt.onclick = function (e) { e.stopPropagation(); var k = bt.getAttribute("data-k");
          if (k === "x") { st.pts.splice(i, 1); st.pts.forEach(function (x, j) { x.n = j + 1; }); st.sel = Math.max(0, Math.min(st.sel, st.pts.length - 1)); } else { p.venc = p.venc === k ? "" : k; if (p.venc && i < st.pts.length - 1) st.sel = i + 1; }
          st.salvo = false; render(true); }; });
        L.appendChild(d);
      });
      var cur = L.children[st.sel]; if (cur && cur.scrollIntoView && manter) cur.scrollIntoView({ block: "nearest" });
      var ant = S.compararVideo(r, st.historico.filter(function (h) { return h.id !== st.regId; }));
      q("cmpC").hidden = !(ant.n && ant.linhas.length); q("cmp").innerHTML = tabelaCmp(ant);
    }
    q("ant").onclick = function () { tocar(st.sel - 1); }; q("prox").onclick = function () { tocar(st.sel + 1); }; q("rep").onclick = function () { tocar(st.sel); };
    q("add").onclick = function () { var t = v.currentTime; st.pts.push({ n: 0, ini: Math.max(0, t - 2), fim: t + 3, saque: t, golpes: 0, duracao: 0, suspeito: "adicionado manualmente", venc: "", tipo: "", sacador: "" }); st.pts.sort(function (a, b) { return a.saque - b.saque; }); st.pts.forEach(function (x, j) { x.n = j + 1; }); st.salvo = false; render(true); };
    el.addEventListener("keydown", function (e) {
      if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || q("rev").hidden) return;
      if (e.key === "ArrowRight") tocar(st.sel + 1); else if (e.key === "ArrowLeft") tocar(st.sel - 1); else if (e.key === " ") { e.preventDefault(); tocar(st.sel); }
      else if (e.key.toLowerCase() === "a" || e.key.toLowerCase() === "b") { var p = st.pts[st.sel]; if (p) { p.venc = e.key.toUpperCase(); st.salvo = false; render(true); if (st.sel < st.pts.length - 1) tocar(st.sel + 1); } }
    });
    el.setAttribute("tabindex", "-1");
    function registro() {
      return { id: st.regId || ("vj" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)), criadoEm: new Date().toISOString(), atleta: q("nA").value, adversario: q("nB").value,
        pontos: st.pts.map(function (p) { return { n: p.n, ini: +p.ini.toFixed(1), fim: +p.fim.toFixed(1), saque: +p.saque.toFixed(1), sacador: p.sacador, venc: p.venc, tipo: p.tipo, golpes: p.golpes, duracao: +p.duracao.toFixed(1) }; }), res: S.resumirJogo(st.pts), origem: "video" };
    }
    q("salvar").onclick = function () {
      if (!st.pts.length) return; if (st.cota && !st.cota.liberado && !st.salvo) { cota(); return; }
      var reg = registro(); if (st.salvo) reg.criadoEm = (st.historico.filter(function (h) { return h.id === reg.id; })[0] || reg).criadoEm;
      st.regId = reg.id; st.salvo = true; st.historico = st.historico.filter(function (h) { return h.id !== reg.id; }).concat([reg]);
      q("salvoMsg").textContent = "Jogo salvo no histórico do jogador.";
      Promise.resolve(o.aoSalvar ? o.aoSalvar(reg) : null).then(function () { if (st.cota && st.cota.limite != null && o.cotaDe) { st.cota = o.cotaDe(st.historico); cota(); } }).catch(function () { q("salvoMsg").textContent = "Não foi possível salvar agora."; });
      if (o.aoMudar) o.aoMudar(st.historico); renderHist(); render(true);
    };
    function baixa(nome, tipo, txt) { var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: tipo })); a.download = nome; a.click(); }
    q("json").onclick = function () { baixa("jogo-video.json", "application/json", JSON.stringify(registro(), null, 1)); };
    q("csv").onclick = function () { var pl = S.placar(st.pts.map(function (p) { return p.venc; })); baixa("jogo-video.csv", "text/csv", "n;inicio;fim;sacador;vencedor;tipo;golpes;games;pontos\n" + st.pts.map(function (p, i) { var s = pl[i] || { games: ["", ""], pontos: "" }; return [p.n, p.ini.toFixed(1), p.fim.toFixed(1), p.sacador, p.venc, p.tipo, p.golpes, s.games.join("-"), s.pontos].join(";"); }).join("\n")); };
    if (o.atleta) q("nA").value = o.atleta;
    cota(); renderHist();
    return { estado: st, definirPontos: function (pts) { st.pts = pts; st.sel = 0; q("rev").hidden = false; render(); }, atualizar: function (h, c) { st.historico = h.slice(); if (c) st.cota = c; cota(); renderHist(); } };
  }
  raiz.QLVideoJogo = { montar: montar, evolucaoHTML: evolucaoHTML };
})(typeof window !== "undefined" ? window : this);
