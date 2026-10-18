/* Link de vídeo da partida: só https, sem credenciais, guarda o endereço e nada mais; chega ao treinador pela área "partidas".
   Rode: node tests/check-partida-video.js */
const assert = require("assert"), path = require("path");
const fx = path.join(__dirname, "../netlify/functions/");
const P = require(fx + "_player-partidas.js"), T = require(fx + "_player-torneios.js");
const hoje = "2026-10-18", base = { data: "2026-10-10", resultado: "vitoria" };

assert.strictEqual(P.normalizarPartida(base, hoje).videoLink, "", "sem link: vazio");
assert.strictEqual(P.normalizarPartida({ ...base, videoLink: "   " }, hoje).videoLink, "");
assert.strictEqual(P.normalizarPartida({ ...base, videoLink: " https://youtu.be/abc123 " }, hoje).videoLink, "https://youtu.be/abc123");
assert.strictEqual(P.normalizarPartida({ ...base, videoLink: "https://drive.google.com/file/d/ID/view?usp=sharing" }, hoje).videoLink, "https://drive.google.com/file/d/ID/view?usp=sharing");
for (const ruim of ["http://youtu.be/abc", "javascript:alert(1)", "data:text/html,x", "ftp://x.com/a", "youtu.be/abc", "https://usuario:senha@youtu.be/a", "https://localhost/a", "https://" + "a".repeat(300) + ".com", "texto solto"]) {
  assert.throws(() => P.normalizarPartida({ ...base, videoLink: ruim }, hoje), /link do vídeo/, "recusa: " + ruim.slice(0, 40));
}
assert.ok(!("video" in P.normalizarPartida(base, hoje)), "o campo guardado é videoLink");
/* o treinador com a área "partidas" recebe só o endereço, ao lado dos campos de sempre; texto livre continua de fora */
const c = T.partidaCompartilhada("p1", { ...P.normalizarPartida({ ...base, videoLink: "https://youtu.be/abc", obs: "SEGREDO", adversario: "João" }, hoje) });
assert.strictEqual(c.video, "https://youtu.be/abc"); assert.ok(!JSON.stringify(c).includes("SEGREDO"), "observações não vão junto");
assert.strictEqual(T.partidaCompartilhada("p2", P.normalizarPartida(base, hoje)).video, "");
console.log("check-partida-video: ok");
