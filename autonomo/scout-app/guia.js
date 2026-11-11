/* QuadraLab Scout: guia do primeiro acesso, como num jogo guiado. Escurece a tela, ilumina um ponto, explica num balão e só deixa
   seguir tocando no lugar indicado (ou no botão do balão, nos passos de leitura). O resto da tela não responde enquanto o guia está aberto.
   Passos: { rota: RegExp do hash, alvo: seletor, acao: "toque" | "ok" | "digitar", texto, titulo?, botao?, validar?(), opcional? }
   · toque: o passo termina quando a pessoa toca no alvo (o app reage normalmente ao toque);
   · ok: leitura; segue pelo botão do balão;
   · digitar: o alvo é um campo; segue pelo botão do balão quando validar() aceita;
   · opcional: se o alvo não existir na tela (ex.: modo rápido), o passo é pulado.
   O app chama QLScoutGuia.atualizar() depois de cada troca de tela. */
(function (raiz) {
  "use strict";
  var passos = [], i = 0, ativo = false, aoFim = null, el = null, avancando = false;

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
  function alvo() { var p = passo(); return p ? document.querySelector(p.alvo) : null; }
  function esconder() { if (!el) return; el.luz.hidden = true; el.balao.hidden = true; document.body.classList.remove("guia-ativo"); }

  function iniciar(o) { passos = o.passos || []; i = 0; ativo = true; aoFim = o.aoFim || null; montar(); setTimeout(atualizar, 60); }
  function terminar(concluiu) { ativo = false; esconder(); if (aoFim) aoFim(!!concluiu); }

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
  function sacudir() { if (!el) return; el.balao.classList.remove("guia-sacode"); void el.balao.offsetWidth; el.balao.classList.add("guia-sacode"); }
  function interceptar(ev) {
    if (!ativo || !el || el.luz.hidden) return;
    var p = passo(), t = ev.target;
    if (el.balao.contains(t)) {
      if (t.closest("[data-guia-pular]")) { ev.preventDefault(); terminar(false); return; }
      if (t.closest("[data-guia-ok]")) {
        ev.preventDefault();
        if (p.validar && !p.validar()) { var e = el.balao.querySelector(".guia-erro"); e.textContent = p.erro || "Complete este passo para seguir."; e.hidden = false; sacudir(); return; }
        avancar(); return;
      }
      return;
    }
    var a = alvo();
    if (a && a.contains(t) && (p.acao === "toque" || p.acao === "digitar")) {
      if (p.acao === "toque" && !avancando) { avancando = true; esconder(); setTimeout(avancar, 0); }
      return; /* o app trata o toque normalmente */
    }
    ev.preventDefault(); ev.stopPropagation(); sacudir();
  }

  var api = { iniciar: iniciar, atualizar: atualizar, terminar: terminar, ativo: function () { return ativo; }, indice: function () { return i; } };
  raiz.QLScoutGuia = api;
})(window);
