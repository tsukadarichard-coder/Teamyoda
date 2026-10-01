/* Service worker mínimo — não faz cache nem intercepta nada de verdade.
   Existe só porque instalar como app (ícone na tela de início, sem barra
   de navegador) no Chrome/Android pede um service worker registrado com
   um handler de fetch. NUNCA chama event.respondWith(): sem isso, toda
   requisição (Firestore, Netlify functions, tudo) continua exatamente
   como seria sem service worker nenhum — só existe pra passar no
   critério de instalabilidade, não pra interceptar nada de verdade. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
