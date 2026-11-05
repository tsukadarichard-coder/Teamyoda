/* O Simulador de Decisões (autonomo/decisoes) também roda na Academia Digital do Team Yoda (mty/decisoes, aberto em
   /digital/ com ?embed=1): os arquivos precisam ser idênticos. Rode: node tests/check-sync-decisoes.js */
const fs = require("fs"), path = require("path"), assert = require("assert");
const A = path.join(__dirname, "../decisoes"), M = path.join(__dirname, "../../mty/decisoes");
const arquivos = fs.readdirSync(A);
arquivos.forEach((f) => assert(fs.existsSync(path.join(M, f)) && fs.readFileSync(path.join(A, f)).equals(fs.readFileSync(path.join(M, f))), "mty/decisoes/" + f + " fora de sincronia com autonomo/decisoes/" + f + " (copie o arquivo)"));
["logo-quadralab-player-v2-240.png", "player-favicon-32.png", "player-apple-touch-icon.png"].forEach((f) => assert(fs.existsSync(path.join(__dirname, "../../mty/assets", f)), "mty/assets/" + f + " ausente"));
console.log("check-sync-decisoes: ok (" + arquivos.length + " arquivos)");
