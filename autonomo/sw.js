/* Service worker mínimo — não faz cache nem intercepta nada de verdade; também recebe as notificações (fim do arquivo).
   Existe só porque instalar como app (ícone na tela de início, sem barra
   de navegador) no Chrome/Android pede um service worker registrado com
   um handler de fetch. NUNCA chama event.respondWith(): sem isso, toda
   requisição (Firestore, Netlify functions, tudo) continua exatamente
   como seria sem service worker nenhum — só existe pra passar no
   critério de instalabilidade, não pra interceptar nada de verdade. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

/* Notificações (avisos enviados pelo servidor, netlify/functions/_push.js): mostra o aviso e, ao tocar, abre ou traz para a frente
   a tela do app indicada pelo aviso. */
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { corpo: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.titulo || "QuadraLab", {
    body: d.corpo || "", tag: d.tag || undefined, renotify: !!d.tag, icon: d.icone || "/assets/icon-192.png", badge: "/assets/favicon-32.png",
    data: { url: d.url || "/" }, lang: "pt-BR",
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const alvo = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
    const mesma = janelas.find((j) => j.url.split("#")[0] === alvo.split("#")[0]);
    if (mesma) { mesma.focus(); return mesma.navigate ? mesma.navigate(alvo).catch(() => {}) : null; }
    return self.clients.openWindow(alvo);
  }));
});
