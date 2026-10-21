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
    document.addEventListener("click", function (e) { if (!menu.hidden && !menu.contains(e.target) && e.target !== botao) fechar(false); });
    menu.addEventListener("keydown", function (e) {
      var links = Array.prototype.slice.call(menu.querySelectorAll("a")), i = links.indexOf(document.activeElement);
      if (e.key === "ArrowDown") { e.preventDefault(); links[(i + 1) % links.length].focus(); }
      if (e.key === "ArrowUp") { e.preventDefault(); links[(i - 1 + links.length) % links.length].focus(); }
    });
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
