/* Erro de devolução do adversário: marcado no ponto vale mesmo fora da bola 1–2; desmarcado não conta; sem marcação segue a bola 1–2.
   Mesmas regras no scout do treinador e no do responsável (player/scout-motor.js é gerado do index.html). Rode: node tests/check-devolucao-adversario.js */
const assert = require("assert"), M = require("../player/scout-motor.js");
const base = { fim: "erro_dele", nos: true, sacador: "nos", saque: "1" };
assert.strictEqual(M.erroDeDevolucaoDele({ ...base, bola: "1-2" }), true, "sem marcação: erro dele na bola 1–2 do nosso saque");
assert.strictEqual(M.erroDeDevolucaoDele({ ...base, bola: "3-4", devAdv: true }), true, "marcado conta");
assert.strictEqual(M.erroDeDevolucaoDele({ ...base, bola: "1-2", devAdv: false }), false, "desmarcado não conta");
assert.strictEqual(M.erroDeDevolucaoDele({ ...base, bola: "1-2", sacador: "ele", devAdv: true }), false, "só no nosso saque");
assert.strictEqual(M.erroDeDevolucaoDele({ ...base, bola: "1-2", saque: "ace", devAdv: true }), false, "ace não é erro de devolução");
const r = M.resume([{ ...base, bola: "3-4", devAdv: true, n: 1, jogo: 1, set: 1, placarAntes: "0-0" }, { ...base, bola: "5+", n: 2, jogo: 1, set: 1, placarAntes: "15-0" }]);
assert.strictEqual(r.errosDevolucaoDele, 1, "o resumo conta o marcado");
console.log("check-devolucao-adversario: ok");
