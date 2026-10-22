/* QuadraLab Hub: menu "Já tenho conta", abas de "Como funciona" e o encaminhamento de quem já usa o Treinador. */
(function () {
  "use strict";

  /* Treinadores que já têm sessão abrem direto o app (o Hub não atrapalha o acesso de hoje).
     A sessão fica no navegador (IndexedDB do Firebase); só a presença da academia (orgId) no token
     identifica um treinador. Quem chegou pelo logotipo do Hub (?hub=1) continua aqui. */
  function sessaoDeTreinador(aoSaber) {
    try {
      if (/[?&]hub=1/.test(location.search) || sessionStorage.getItem("ql-hub-ficar")) { aoSaber(false); return; }
      if (!window.indexedDB) { aoSaber(false); return; }
      var req = indexedDB.open("firebaseLocalStorageDb");
      /* se o banco ainda não existe, não cria um vazio (o Firebase precisa criá-lo do jeito dele): cancela */
      req.onupgradeneeded = function () { try { req.transaction.abort(); } catch (e) { /* nada a fazer */ } };
      req.onerror = function (ev) { if (ev && ev.preventDefault) ev.preventDefault(); aoSaber(false); };
      req.onsuccess = function () {
        try {
          var db = req.result;
          if (!db.objectStoreNames.contains("firebaseLocalStorage")) { db.close(); aoSaber(false); return; }
          var todos = db.transaction("firebaseLocalStorage", "readonly").objectStore("firebaseLocalStorage").getAll();
          todos.onerror = function () { db.close(); aoSaber(false); };
          todos.onsuccess = function () {
            db.close();
            var achou = (todos.result || []).some(function (it) {
              var tok = it && it.value && it.value.stsTokenManager && it.value.stsTokenManager.accessToken;
              if (!tok) return false;
              try {
                var p = JSON.parse(decodeURIComponent(escape(atob(tok.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")))));
                return !!p.orgId;
              } catch (e) { return false; }
            });
            aoSaber(achou);
          };
        } catch (e) { aoSaber(false); }
      };
    } catch (e) { aoSaber(false); }
  }
  try { if (/[?&]hub=1/.test(location.search)) sessionStorage.setItem("ql-hub-ficar", "1"); } catch (e) { /* sem armazenamento */ }
  sessaoDeTreinador(function (treinador) { if (treinador) location.replace("/treinador"); });

  /* menu "Já tenho conta" */
  var botao = document.getElementById("btn-entrar"), menu = document.getElementById("menu-entrar");
  function fechar(devolverFoco) {
    if (menu.hidden) return;
    menu.hidden = true; botao.setAttribute("aria-expanded", "false");
    if (devolverFoco) botao.focus();
  }
  function abrir() {
    menu.hidden = false; botao.setAttribute("aria-expanded", "true");
    var primeiro = menu.querySelector("a"); if (primeiro) primeiro.focus();
  }
  if (botao && menu) {
    botao.addEventListener("click", function () { if (menu.hidden) abrir(); else fechar(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") fechar(true); });
    document.addEventListener("click", function (e) { if (!menu.hidden && !menu.contains(e.target) && !botao.contains(e.target)) fechar(false); });
    menu.addEventListener("keydown", function (e) {
      var links = Array.prototype.slice.call(menu.querySelectorAll("a")), i = links.indexOf(document.activeElement);
      if (e.key === "ArrowDown") { e.preventDefault(); links[(i + 1) % links.length].focus(); }
      if (e.key === "ArrowUp") { e.preventDefault(); links[(i - 1 + links.length) % links.length].focus(); }
    });
  }

  /* menu de seções no celular */
  var btnMenu = document.getElementById("btn-menu"), nav = document.getElementById("menu-nav");
  function fecharNav(devolverFoco) {
    if (!nav || nav.hidden) return;
    nav.hidden = true; btnMenu.setAttribute("aria-expanded", "false");
    if (devolverFoco) btnMenu.focus();
  }
  if (btnMenu && nav) {
    btnMenu.addEventListener("click", function () {
      if (nav.hidden) { fechar(false); nav.hidden = false; btnMenu.setAttribute("aria-expanded", "true"); var l = nav.querySelector("a"); if (l) l.focus(); }
      else fecharNav(false);
    });
    nav.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("a")) fecharNav(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") fecharNav(true); });
    document.addEventListener("click", function (e) { if (!nav.hidden && !nav.contains(e.target) && !btnMenu.contains(e.target)) fecharNav(false); });
    window.addEventListener("resize", function () { if (window.innerWidth >= 900) fecharNav(false); });
    botao.addEventListener("click", function () { if (!menu.hidden) fecharNav(false); });
  }

  /* benefícios: abertos no computador, recolhidos no celular (a página não fica longa demais) */
  var beneficios = Array.prototype.slice.call(document.querySelectorAll("details.beneficios"));
  if (window.matchMedia) {
    var larga = window.matchMedia("(min-width: 900px)");
    var ajustar = function () { beneficios.forEach(function (d) { d.open = larga.matches; }); };
    ajustar();
    if (larga.addEventListener) larga.addEventListener("change", ajustar); else if (larga.addListener) larga.addListener(ajustar);
  }

  /* abas de "Como funciona" */
  var abas = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
  function ativar(aba, foco) {
    abas.forEach(function (a) {
      var ativa = a === aba;
      a.setAttribute("aria-selected", ativa ? "true" : "false");
      a.tabIndex = ativa ? 0 : -1;
      var painel = document.getElementById(a.getAttribute("aria-controls"));
      if (painel) painel.hidden = !ativa;
    });
    if (foco) aba.focus();
  }
  abas.forEach(function (aba, i) {
    aba.addEventListener("click", function () { ativar(aba, false); });
    aba.addEventListener("keydown", function (e) {
      var alvo = null;
      if (e.key === "ArrowRight") alvo = abas[(i + 1) % abas.length];
      if (e.key === "ArrowLeft") alvo = abas[(i - 1 + abas.length) % abas.length];
      if (e.key === "Home") alvo = abas[0];
      if (e.key === "End") alvo = abas[abas.length - 1];
      if (alvo) { e.preventDefault(); ativar(alvo, true); }
    });
  });
})();

/* Movimento da página e o filme da família. Só liga com IntersectionObserver e sem "reduzir movimento";
   sem isso a página fica como sempre foi (tudo visível, vídeo com controles do navegador). */
(function () {
  "use strict";
  var reduz = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var temIO = "IntersectionObserver" in window;
  var topo = document.querySelector(".topo");
  function aoRolar() { if (topo) topo.classList.toggle("rolou", window.scrollY > 8); }
  window.addEventListener("scroll", aoRolar, { passive: true }); aoRolar();

  var video = document.getElementById("video-familia"), acoes = document.getElementById("filme-acoes");
  var btnSom = document.getElementById("btn-som"), btnPausa = document.getElementById("btn-pausa");
  if (video && (reduz || !temIO)) { video.controls = true; }

  if (reduz || !temIO) return;
  document.documentElement.classList.add("anima");

  /* título da abertura: cada palavra sobe por trás de uma máscara */
  var h1 = document.querySelector(".titulo-palavras");
  if (h1 && !h1.querySelector(".p")) {
    var palavras = h1.textContent.trim().split(/\s+/);
    h1.setAttribute("aria-label", h1.textContent.trim());
    h1.innerHTML = palavras.map(function (p, i) {
      return '<span class="pm" aria-hidden="true"><span class="p" style="--i:' + i + '">' + p.replace(/[<>&]/g, "") + "</span></span>";
    }).join(" ");
  }

  /* revelação ao rolar (uma vez) */
  var io = new IntersectionObserver(function (ents) {
    ents.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("visivel"); io.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
  Array.prototype.forEach.call(document.querySelectorAll(".revela"), function (el) { io.observe(el); });

  /* filme: só baixa e toca quando aparece na tela; pausa ao sair; som e pausa nos botões */
  if (!video) return;
  var pausadoPelaPessoa = false;
  video.muted = true;
  if (acoes) acoes.hidden = false;
  var ioVideo = new IntersectionObserver(function (ents) {
    ents.forEach(function (e) {
      if (e.isIntersecting && e.intersectionRatio >= 0.35) { if (!pausadoPelaPessoa) { var p = video.play(); if (p && p.catch) p.catch(function () {}); } }
      else video.pause();
    });
  }, { threshold: [0, 0.35, 0.7] });
  ioVideo.observe(video);
  function atualizar() {
    if (btnSom) { btnSom.textContent = video.muted ? "Ativar som" : "Silenciar"; btnSom.setAttribute("aria-pressed", video.muted ? "false" : "true"); }
    if (btnPausa) { btnPausa.textContent = pausadoPelaPessoa ? "Continuar" : "Pausar"; btnPausa.setAttribute("aria-pressed", pausadoPelaPessoa ? "true" : "false"); }
  }
  function alternarPausa() {
    pausadoPelaPessoa = !pausadoPelaPessoa;
    if (pausadoPelaPessoa) video.pause(); else { var p = video.play(); if (p && p.catch) p.catch(function () {}); }
    atualizar();
  }
  if (btnSom) btnSom.addEventListener("click", function () {
    video.muted = !video.muted;
    if (pausadoPelaPessoa) alternarPausa();
    atualizar();
  });
  if (btnPausa) btnPausa.addEventListener("click", alternarPausa);
  video.addEventListener("click", alternarPausa);
  atualizar();
})();
