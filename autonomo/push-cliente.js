/* Notificações no celular — lado do navegador (o envio fica em netlify/functions/_push.js e push-inscricao.js).
   window.QLPush:
     suportado()  → o aparelho/navegador aceita notificações agora
     motivo()     → por que não aceita (ex.: iPhone fora da tela de início), em texto para a pessoa
     estado()     → Promise<"ativo" | "inativo" | "negado" | "indisponivel">
     ativar({ app, token?, link?, url? })  → pede a permissão (precisa vir de um toque), inscreve e registra no servidor
     desativar()  → cancela a inscrição neste aparelho
   app: "treinador" | "aluno" | "player"; token: o idToken do Firebase (quem está logado); link: { org, id, t } do link do aluno.
   Este arquivo é igual em autonomo/ e mty/. */
(function (raiz) {
  "use strict";
  var FN = "/.netlify/functions/push-inscricao";
  var nav = raiz.navigator || {};
  function ios() { var ua = nav.userAgent || ""; return /iPad|iPhone|iPod/.test(ua) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1); }
  function instalado() { return (raiz.matchMedia && raiz.matchMedia("(display-mode: standalone)").matches) || nav.standalone === true; }
  function suportado() { return "serviceWorker" in nav && "PushManager" in raiz && "Notification" in raiz && raiz.isSecureContext !== false; }
  function motivo() {
    if (ios() && !instalado()) return "No iPhone e no iPad, as notificações funcionam com o app na tela de início: toque em Compartilhar › Adicionar à Tela de Início, abra o app por lá e ative aqui.";
    if (!suportado()) return "Este navegador não recebe notificações. Use o Chrome, o Edge ou o Safari atualizado.";
    if (raiz.Notification && Notification.permission === "denied") return "As notificações estão bloqueadas para este site. Libere nas configurações do navegador (ou do app) e tente de novo.";
    return "";
  }
  function b64uParaBytes(s) {
    var pad = "=".repeat((4 - (s.length % 4)) % 4), b = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/")), u = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    return u;
  }
  function registro() { return nav.serviceWorker.register("/sw.js", { scope: "/" }).then(function () { return nav.serviceWorker.ready; }); }
  function postar(corpo, token) {
    var h = { "content-type": "application/json" }; if (token) h.authorization = "Bearer " + token;
    return fetch(FN, { method: "POST", headers: h, body: JSON.stringify(corpo) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (c) { if (!r.ok) throw new Error(c.erro || "Não foi possível ativar as notificações agora."); return c; });
    });
  }
  function estado() {
    if (!suportado()) return Promise.resolve("indisponivel");
    if (Notification.permission === "denied") return Promise.resolve("negado");
    return nav.serviceWorker.getRegistration("/").then(function (reg) {
      if (!reg || !reg.pushManager) return "inativo";
      return reg.pushManager.getSubscription().then(function (s) {
        if (!s || Notification.permission !== "granted") return "inativo";
        return postar({ acao: "estado", endpoint: s.endpoint }).then(function (c) { return c.inscrito ? "ativo" : "inativo"; }).catch(function () { return "ativo"; });
      });
    }).catch(function () { return "inativo"; });
  }
  function ativar(o) {
    o = o || {};
    if (!suportado()) return Promise.reject(new Error(motivo()));
    return Notification.requestPermission().then(function (p) {
      if (p !== "granted") throw new Error(p === "denied" ? motivo() || "Notificações bloqueadas." : "Para receber os avisos, toque em Permitir.");
      return Promise.all([registro(), fetch(FN).then(function (r) { return r.json(); })]);
    }).then(function (x) {
      var reg = x[0], chave = x[1] && x[1].chave;
      if (!chave) throw new Error("Não foi possível ativar as notificações agora.");
      return reg.pushManager.getSubscription().then(function (s) {
        return s || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uParaBytes(chave) });
      });
    }).then(function (s) {
      var j = s.toJSON();
      return postar({ acao: "inscrever", app: o.app, inscricao: { endpoint: j.endpoint, keys: j.keys }, link: o.link || undefined, url: o.url || (location.pathname + location.search) }, o.token);
    });
  }
  function desativar() {
    if (!suportado()) return Promise.resolve();
    return nav.serviceWorker.getRegistration("/").then(function (reg) {
      if (!reg) return;
      return reg.pushManager.getSubscription().then(function (s) {
        if (!s) return;
        return postar({ acao: "cancelar", endpoint: s.endpoint }).catch(function () {}).then(function () { return s.unsubscribe(); });
      });
    });
  }
  raiz.QLPush = { suportado: suportado, motivo: motivo, estado: estado, ativar: ativar, desativar: desativar, ios: ios, instalado: instalado };
})(typeof window !== "undefined" ? window : this);
