/* Os arquivos compartilhados de scout/ precisam ser idênticos nos dois apps (autonomo = QuadraLab, mty = Team Yoda). Rode: node tests/check-sync-scout.js */
const fs = require("fs"), path = require("path"), assert = require("assert");
const A = path.join(__dirname, "../scout"), M = path.join(__dirname, "../../mty/scout");
const arquivos = ["ao-vivo.js", "ao-vivo.css", "graficos.js", "graficos.css", "relatorio-jogos.js", "movimento-motor.js", "evidencias.js", "movimento.js", "movimento.css", "video-segmentador.js", "video-jogo.js"];
arquivos.forEach((f) => assert(fs.existsSync(path.join(M, f)) && fs.readFileSync(path.join(A, f), "utf8") === fs.readFileSync(path.join(M, f), "utf8"), "mty/scout/" + f + " fora de sincronia com autonomo/scout/" + f + " (copie o arquivo)"));
["autonomo/index.html", "mty/index.html"].forEach((h) => { const t = fs.readFileSync(path.join(__dirname, "../..", h), "utf8"); ["movimento-motor.js", "evidencias.js", "movimento.js", "video-segmentador.js", "video-jogo.js"].forEach((f) => assert(t.includes('scout/' + f), h + " não carrega scout/" + f)); assert(t.includes("scout/movimento.css"), h + " não carrega movimento.css"); });
assert(fs.existsSync(path.join(__dirname, "../../mty/assets/logo-quadralab.png")), "mty/assets/logo-quadralab.png ausente (selo Tecnologia QuadraLab)");
console.log("check-sync-scout: ok (" + arquivos.length + " arquivos)");
