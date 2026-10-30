/* Os arquivos compartilhados de scout/ precisam ser idênticos nos dois apps (autonomo = QuadraLab, mty = Team Yoda). Rode: node tests/check-sync-scout.js */
const fs = require("fs"), path = require("path"), assert = require("assert");
const A = path.join(__dirname, "../scout"), M = path.join(__dirname, "../../mty/scout");
const arquivos = ["ao-vivo.js", "ao-vivo.css", "graficos.js", "graficos.css", "relatorio-jogos.js", "relatorio-aluno.js", "movimento-motor.js", "evidencias.js", "movimento-arquivo.js", "movimento.js", "movimento.css", "video-segmentador.js", "video-audio.js", "video-scout.js", "video-visao.js", "video-scout-ui.js", "quadra-auto.js", "padroes.js", "video-jogo.js", "vendor/ffmpeg/ffmpeg.js", "vendor/ffmpeg/814.ffmpeg.js", "bola-ia.js", "vendor/wasb/LEIA-ME.txt"];
/* o modelo da IA da bola (binário) */
assert(fs.existsSync(path.join(M, "vendor/wasb/wasb-tenis.onnx")) && fs.readFileSync(path.join(A, "vendor/wasb/wasb-tenis.onnx")).equals(fs.readFileSync(path.join(M, "vendor/wasb/wasb-tenis.onnx"))), "mty/scout/vendor/wasb/wasb-tenis.onnx fora de sincronia");
arquivos.forEach((f) => assert(fs.existsSync(path.join(M, f)) && fs.readFileSync(path.join(A, f), "utf8") === fs.readFileSync(path.join(M, f), "utf8"), "mty/scout/" + f + " fora de sincronia com autonomo/scout/" + f + " (copie o arquivo)"));
/* o jogo em vídeo existe só no Team Yoda (foi retirado do QuadraLab treinador): os módulos de vídeo só carregam no mty */
const VIDEO = ["video-segmentador.js", "video-audio.js", "video-scout.js", "video-visao.js", "video-scout-ui.js", "quadra-auto.js", "video-jogo.js", "bola-ia.js"];
["autonomo/index.html", "mty/index.html"].forEach((h) => { const t = fs.readFileSync(path.join(__dirname, "../..", h), "utf8"); ["movimento-motor.js", "evidencias.js", "movimento-arquivo.js", "movimento.js", "padroes.js"].concat(h.startsWith("mty") ? VIDEO : []).forEach((f) => assert(t.includes('scout/' + f), h + " não carrega scout/" + f)); assert(t.includes("scout/movimento.css"), h + " não carrega movimento.css"); });
{ const t = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8"); VIDEO.forEach((f) => assert(!t.includes('scout/' + f), "autonomo/index.html ainda carrega scout/" + f + " (jogo em vídeo foi retirado do QuadraLab)")); }
assert(fs.existsSync(path.join(__dirname, "../../mty/assets/logo-quadralab.png")), "mty/assets/logo-quadralab.png ausente (selo Tecnologia QuadraLab)");
console.log("check-sync-scout: ok (" + arquivos.length + " arquivos)");
