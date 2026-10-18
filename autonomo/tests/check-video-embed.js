/* Player de vídeo dentro da plataforma: só YouTube, Vimeo e Google Drive viram player; qualquer outro endereço (ou imitação de domínio) abre em nova aba.
   Extrai embedDeVideo() do player.js e testa sem navegador. Rode: node tests/check-video-embed.js */
const fs = require("fs"), assert = require("assert"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "../player/player.js"), "utf8");
const a = src.indexOf("  function embedDeVideo(url) {"), b = src.indexOf("  function videoHtml(");
assert.ok(a > 0 && b > a, "função encontrada");
const embedDeVideo = new Function("URL", src.slice(a, b) + "; return embedDeVideo;")(URL);
const e = (u) => embedDeVideo(u);

assert.strictEqual(e("https://youtu.be/dQw4w9WgXcQ").src, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&playsinline=1");
assert.strictEqual(e("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL1").src, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&playsinline=1");
assert.strictEqual(e("https://m.youtube.com/watch?v=dQw4w9WgXcQ").provedor, "YouTube");
assert.ok(e("https://www.youtube.com/shorts/dQw4w9WgXcQ").src.includes("/embed/dQw4w9WgXcQ"));
assert.ok(e("https://www.youtube.com/live/dQw4w9WgXcQ?feature=share").src.includes("/embed/dQw4w9WgXcQ"));
assert.ok(e("https://www.youtube.com/embed/dQw4w9WgXcQ").src.includes("/embed/dQw4w9WgXcQ"));
assert.ok(e("https://youtu.be/dQw4w9WgXcQ?t=90").src.endsWith("&start=90"), "início em segundos");
assert.ok(e("https://youtu.be/dQw4w9WgXcQ?t=1m30s").src.endsWith("&start=90"), "início em 1m30s");
assert.ok(e("https://youtu.be/dQw4w9WgXcQ?t=1h2m3s").src.endsWith("&start=3723"));
assert.strictEqual(e("https://vimeo.com/123456789").src, "https://player.vimeo.com/video/123456789");
assert.strictEqual(e("https://vimeo.com/123456789/abcdef1234").src, "https://player.vimeo.com/video/123456789?h=abcdef1234", "vimeo não listado");
assert.strictEqual(e("https://drive.google.com/file/d/1AbC-dEf_GhIjKlMnOp/view?usp=sharing").src, "https://drive.google.com/file/d/1AbC-dEf_GhIjKlMnOp/preview");
for (const nao of [
  "https://example.com/video.mp4", "http://youtu.be/dQw4w9WgXcQ", "https://youtu.be/curto", "https://www.youtube.com/watch?v=", "https://www.youtube.com/watch?v=" + "a".repeat(30),
  "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ", "https://evilyoutube.com/watch?v=dQw4w9WgXcQ", "https://notvimeo.com/123456789", "https://vimeo.com/abc", "https://drive.google.com/drive/folders/abc", "https://docs.google.com/file/d/1AbC-dEf_GhIjKlMnOp/view",
  "javascript:alert(1)", "", null, "texto",
]) assert.strictEqual(e(nao), null, "sem player: " + nao);
/* o endereço do iframe nunca carrega nada além dos três provedores */
for (const u of ["https://youtu.be/dQw4w9WgXcQ", "https://vimeo.com/123456789", "https://drive.google.com/file/d/1AbC-dEf_GhIjKlMnOp/view"]) assert.ok(/^https:\/\/(www\.youtube-nocookie\.com|player\.vimeo\.com|drive\.google\.com)\//.test(e(u).src));
console.log("check-video-embed: ok");
