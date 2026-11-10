/* QuadraLab Scout: funciona sem internet (clube com sinal fraco).
   Rede primeiro, com 4 segundos de espera; sem resposta, usa a cópia guardada. Assim a versão nova chega sempre que há sinal,
   e sem sinal o app abre do mesmo jeito. As functions (contagem de uso) nunca passam pelo cache. */
const CACHE = "ql-scout-v1";
const ARQUIVOS = ["./", "index.html", "app.js", "app.css", "dados.js", "manifest.json", "../player/scout-motor.js", "../scout/ao-vivo.js", "../scout/ao-vivo.css", "../scout/graficos.js", "../scout/graficos.css",
  "../assets/favicon-32.png", "../assets/favicon-16.png", "../assets/apple-touch-icon.png", "../assets/icon-192.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("ql-scout-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/.netlify/")) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const rede = fetch(req).then((r) => { if (r && r.ok) cache.put(req, r.clone()); return r; });
    const espera = new Promise((ok) => setTimeout(ok, 4000, null));
    try {
      const r = await Promise.race([rede, espera]);
      if (r) return r;
    } catch (x) { /* sem rede: vai para o cache */ }
    const guardado = await cache.match(req, { ignoreSearch: true });
    if (guardado) return guardado;
    return rede;
  })());
});
