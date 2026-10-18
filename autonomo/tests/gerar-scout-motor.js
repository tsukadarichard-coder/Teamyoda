/* Gera player/scout-motor.js a partir do scout do treinador (index.html), para o responsável usar exatamente as mesmas regras.
   Rode: node tests/gerar-scout-motor.js   ·   check-scout-motor.js confere que os dois continuam iguais. */
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
function trecho(ini, fim, incluiFim) { const a = src.indexOf(ini); if (a < 0) throw new Error("não achei: " + ini); const b = src.indexOf(fim, a + ini.length); if (b < 0) throw new Error("não achei fim: " + fim); return src.slice(a, b + (incluiFim ? fim.length : 0)); }
const partes = [
  trecho('const PONTOS_TENIS', 'const FIM_PONTO'),
  trecho('function resume(pontos)', 'function leitura(r)'),
  trecho('function leitura(r)', '\n}\n', true),
  trecho('const JANELA_MOMENTO', 'function sequenciasMomento'),
  trecho('const ZONAS = [', 'function MapaDaQuadra'),
  trecho('function contagemDosPontos', 'function LinkFamilia'),
];
const corpo = partes.map((p) => p.trim()).join("\n\n");
const saida = `/* Motor do scout (placar, saque, lado da quadra, estatísticas e resumo público).
   GERADO de index.html (scout do treinador) por tests/gerar-scout-motor.js: não edite aqui. O teste check-scout-motor.js falha se os dois divergirem.
   Usado pelo responsável, para marcar o jogo com as mesmas regras e os mesmos números do treinador. */
(function (raiz) {
"use strict";
${corpo}

var motor = { placarInicial: placarInicial, aplicaPonto: aplicaPonto, rotuloPontos: rotuloPontos, ehAdverso: ehAdverso, quemSaca: quemSaca, ladoDoSaque: ladoDoSaque, ROTULO_LADO: ROTULO_LADO, SITUACOES: SITUACOES, ZONAS: ZONAS, resume: resume, leitura: leitura, montarResumoPublico: montarResumoPublico, serieMomento: serieMomento, contagemDosPontos: contagemDosPontos, zonasDe: zonasDe };
if (typeof module !== "undefined" && module.exports) module.exports = motor; else raiz.QLScoutMotor = motor;
})(typeof window !== "undefined" ? window : this);
`;
fs.writeFileSync(path.join(__dirname, "../player/scout-motor.js"), saida);
console.log("player/scout-motor.js gerado (" + saida.length + " bytes)");
