/* Jogo ao vivo dentro do app: o app aceita o link do treinador (ou só o código) e extrai o token; qualquer outra coisa é recusada.
   Extrai tokenDoLink() do player.js. Rode: node tests/check-ao-vivo-app.js */
const fs = require("fs"), assert = require("assert"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "../player/player.js"), "utf8");
const a = src.indexOf("  function tokenDoLink(txt) {"), b = src.indexOf("\n", a);
assert.ok(a > 0, "função encontrada");
const tokenDoLink = new Function(src.slice(a, b) + "; return tokenDoLink;")();
const T = "0123456789abcdef0123456789abcdef";
assert.strictEqual(tokenDoLink("https://quadralab.com.br/scout/?l=" + T), T);
assert.strictEqual(tokenDoLink("  https://app.39tennis.com.br/scout/?l=" + T.toUpperCase() + "&x=1  "), T, "maiúsculas viram minúsculas; parâmetros extras não atrapalham");
assert.strictEqual(tokenDoLink(T), T, "só o código também vale");
for (const ruim of ["", null, "https://quadralab.com.br/scout/?org=a&id=b&j=c&t=" + T, "https://x.com/scout/?l=curto", "https://x.com/scout/?l=" + T + "0", "texto qualquer", "javascript:alert(1)"]) assert.strictEqual(tokenDoLink(ruim), null, "recusa: " + String(ruim).slice(0, 40));
console.log("check-ao-vivo-app: ok");
