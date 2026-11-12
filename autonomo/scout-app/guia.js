/* QuadraLab Scout: guia do primeiro acesso, como num jogo guiado. Escurece a tela, ilumina um ponto, explica num balão e só deixa
   seguir tocando no lugar indicado (ou no botão do balão, nos passos de leitura). O resto da tela não responde enquanto o guia está aberto.
   Passos: { rota: RegExp do hash, alvo: seletor, acao: "toque" | "ok" | "digitar", texto, titulo?, botao?, validar?(), opcional? }
   · toque: o passo termina quando a pessoa toca no alvo (o app reage normalmente ao toque);
   · ok: leitura; segue pelo botão do balão;
   · digitar: o alvo é um campo; segue pelo botão do balão quando validar() aceita;
   · opcional: se o alvo não existir na tela (ex.: modo rápido), o passo é pulado;
   · demo: demonstração. O balão explica e oferece o botão (botao); ao tocar, o guia ilumina cada item do roteiro
     ([{ alvo, texto, toque?, ms? }]), espera, e quando toque é true toca no alvo sozinho (o app reage como se fosse a pessoa).
     No fim do roteiro segue para o próximo passo. Durante a demonstração só "Pular o guia" responde.
   O app chama QLScoutGuia.atualizar() depois de cada troca de tela. */
(function (raiz) {
  "use strict";
  var passos = [], i = 0, ativo = false, aoFim = null, el = null, avancando = false;
  var demo = null, simulando = false; // demonstração em andamento: { itens, k }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function montar() {
    if (el) return;
    el = { luz: document.createElement("div"), balao: document.createElement("div") };
    el.luz.className = "guia-luz"; el.luz.hidden = true;
    el.balao.className = "guia-balao"; el.balao.hidden = true; el.balao.setAttribute("role", "dialog"); el.balao.setAttribute("aria-live", "polite");
    document.body.appendChild(el.luz); document.body.appendChild(el.balao);
    document.addEventListener("click", interceptar, true);
    window.addEventListener("resize", posicionar);
    window.addEventListener("scroll", posicionar, { passive: true });
  }
  function passo() { return passos[i]; }
  function alvo() { var p = passo(); if (!p) return null; return document.querySelector(demo ? demo.itens[demo.k].alvo : p.alvo); }
  function esconder() { if (!el) return; el.luz.hidden = true; el.balao.hidden = true; document.body.classList.remove("guia-ativo"); }

  function iniciar(o) { passos = o.passos || []; i = 0; ativo = true; aoFim = o.aoFim || null; montar(); setTimeout(atualizar, 60); }
  function terminar(concluiu) { ativo = false; demo = null; esconder(); if (aoFim) aoFim(!!concluiu); }

  function atualizar() {
    if (!ativo) return;
    var p = passo();
    if (!p) { terminar(true); return; }
    if (p.rota && !p.rota.test(location.hash || "#/")) { esconder(); return; }
    var a = alvo();
    if (!a) {
      if (p.opcional) { i++; atualizar(); return; }
      esconder(); setTimeout(function () { if (ativo && passo() === p && alvo()) atualizar(); }, 250); return;
    }
    document.body.classList.add("guia-ativo");
    a.scrollIntoView({ block: a.getBoundingClientRect().height > window.innerHeight * 0.55 ? "start" : "center" });
    if (demo) {
      var it = demo.itens[demo.k];
      el.balao.innerHTML = '<p class="guia-conta">Demonstração · ' + (demo.k + 1) + " de " + demo.itens.length + "</p><p>" + esc(it.texto) + "</p>" +
        '<div class="guia-acoes"><span class="guia-assista">' + (it.toque ? "O app toca para você" : "Olhe aqui") + '</span><button type="button" class="guia-pular" data-guia-pular>Pular o guia</button></div>';
      el.luz.hidden = false; el.balao.hidden = false;
      posicionar(); requestAnimationFrame(posicionar); setTimeout(posicionar, 250);
      return;
    }
    if (p.acao === "demo") {
      el.balao.innerHTML = '<p class="guia-conta">' + (i + 1) + " de " + passos.length + "</p>" + (p.titulo ? "<h3>" + esc(p.titulo) + "</h3>" : "") + "<p>" + esc(p.texto) + "</p>" +
        '<div class="guia-acoes"><button type="button" class="guia-ok" data-guia-demo>' + esc(p.botao || "Ver a demonstração") + '</button><button type="button" class="guia-pular" data-guia-pular>Pular o guia</button></div>';
      el.luz.hidden = false; el.balao.hidden = false;
      posicionar(); requestAnimationFrame(posicionar); setTimeout(posicionar, 250);
      return;
    }
    el.balao.innerHTML = '<p class="guia-conta">' + (i + 1) + " de " + passos.length + "</p>" + (p.titulo ? "<h3>" + esc(p.titulo) + "</h3>" : "") + "<p>" + esc(p.texto) + "</p>" +
      '<p class="guia-erro" hidden></p><div class="guia-acoes">' + (p.acao !== "toque" ? '<button type="button" class="guia-ok" data-guia-ok>' + esc(p.botao || "Entendi") + "</button>" : '<span class="guia-dica">Toque na área iluminada</span>') +
      '<button type="button" class="guia-pular" data-guia-pular>Pular o guia</button></div>';
    el.luz.hidden = false; el.balao.hidden = false;
    if (p.acao === "digitar" && a.focus) try { a.focus({ preventScroll: true }); } catch (e) { /* sem foco */ }
    posicionar(); requestAnimationFrame(posicionar); setTimeout(posicionar, 250);
  }
  function posicionar() {
    if (!ativo || !el || el.luz.hidden) return;
    var a = alvo(); if (!a) return;
    var r = a.getBoundingClientRect(), m = 6, W = window.innerWidth, H = window.innerHeight;
    el.luz.style.top = (r.top - m) + "px"; el.luz.style.left = (r.left - m) + "px"; el.luz.style.width = (r.width + 2 * m) + "px"; el.luz.style.height = (r.height + 2 * m) + "px";
    var b = el.balao, bw = Math.min(340, W - 24), bh = b.offsetHeight || 160;
    b.style.width = bw + "px";
    var embaixo = r.bottom + m + 12, emCima = r.top - m - 12 - bh, top;
    if (embaixo + bh <= H - 12) top = embaixo; else if (emCima >= 12) top = emCima; else top = Math.max(12, H - bh - 12);
    var left = Math.min(Math.max(12, r.left + r.width / 2 - bw / 2), W - bw - 12);
    b.style.top = top + "px"; b.style.left = left + "px";
  }
  function avancar() { i++; avancando = false; setTimeout(atualizar, 80); }
  /* demonstração: espera o alvo aparecer, mostra, toca (se for o caso) e segue */
  function esperarAlvo(sel, ms) {
    return new Promise(function (ok) {
      var t0 = Date.now();
      (function olhar() { var a = document.querySelector(sel); if (a || Date.now() - t0 > ms) return ok(a); setTimeout(olhar, 100); })();
    });
  }
  function iniciarDemo() { var p = passo(); demo = { itens: p.roteiro || [], k: 0, passo: i }; mostrarDemo(); }
  function mostrarDemo() {
    if (!ativo || !demo) return;
    var it = demo.itens[demo.k], meu = demo;
    if (!it) { demo = null; avancar(); return; }
    esperarAlvo(it.alvo, 2500).then(function (a) {
      if (!ativo || demo !== meu) return;
      if (!a) { proximoDemo(); return; }
      atualizar();
      setTimeout(function () {
        if (!ativo || demo !== meu) return;
        if (!it.toque) { proximoDemo(); return; }
        el.luz.classList.add("guia-tocando");
        setTimeout(function () {
          el.luz.classList.remove("guia-tocando");
          if (!ativo || demo !== meu) return;
          var x = document.querySelector(it.alvo);
          if (x) { simulando = true; try { x.click(); } finally { simulando = false; } }
          setTimeout(proximoDemo, 500);
        }, 450);
      }, raiz.QL_GUIA_DEMO_MS || it.ms || 2200); // QL_GUIA_DEMO_MS: só nos testes
    });
  }
  function proximoDemo() { if (!demo) return; demo.k++; if (demo.k >= demo.itens.length) { demo = null; avancar(); return; } mostrarDemo(); }
  function sacudir() { if (!el) return; el.balao.classList.remove("guia-sacode"); void el.balao.offsetWidth; el.balao.classList.add("guia-sacode"); }
  function interceptar(ev) {
    if (simulando) return; /* toque da demonstração: o app reage normalmente */
    if (!ativo || !el || el.luz.hidden) return;
    var p = passo(), t = ev.target;
    if (el.balao.contains(t)) {
      if (t.closest("[data-guia-pular]")) { ev.preventDefault(); terminar(false); return; }
      if (t.closest("[data-guia-demo]") && !demo) { ev.preventDefault(); iniciarDemo(); return; }
      if (t.closest("[data-guia-ok]")) {
        ev.preventDefault();
        if (p.validar && !p.validar()) { var e = el.balao.querySelector(".guia-erro"); e.textContent = p.erro || "Complete este passo para seguir."; e.hidden = false; sacudir(); return; }
        avancar(); return;
      }
      return;
    }
    var a = alvo();
    if (!demo && a && a.contains(t) && (p.acao === "toque" || p.acao === "digitar")) {
      if (p.acao === "toque" && !avancando) { avancando = true; esconder(); setTimeout(avancar, 0); }
      return; /* o app trata o toque normalmente */
    }
    ev.preventDefault(); ev.stopPropagation(); sacudir();
  }

  var api = { iniciar: iniciar, atualizar: atualizar, terminar: terminar, ativo: function () { return ativo; }, indice: function () { return i; } };
  raiz.QLScoutGuia = api;
})(window);
