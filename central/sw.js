/* Central Tsukada — service worker só para os avisos no celular (Etapa 1). Não guarda páginas em cache: a Central sempre
   abre a versão do servidor. O aviso chega como { titulo, corpo, url, tag } (o mesmo formato de _push.js dos apps). */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { titulo: "Central", corpo: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.titulo || "Central", {
    body: d.corpo || "", tag: d.tag || undefined, icon: "/assets/icone-192.png", badge: "/assets/icone-192.png", data: { url: d.url || "/" },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const alvo = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((abertas) => {
    for (const c of abertas) if (c.url.startsWith(self.location.origin)) { if ("navigate" in c) c.navigate(alvo).catch(() => {}); return c.focus(); }
    return self.clients.openWindow(alvo);
  }));
});
