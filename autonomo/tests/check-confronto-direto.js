/* Confronto direto: jogos contra o mesmo adversário (nome sem acento/maiúscula; só o primeiro nome não junta com o nome completo)
   e o placar do confronto a partir do resultado. Extrai as funções do app real. Rode: node tests/check-confronto-direto.js */
const assert = require("assert"), fs = require("fs"), path = require("path");
for (const app of ["../../mty/index.html", "../index.html"]) {
  const t = fs.readFileSync(path.join(__dirname, app), "utf8");
  const i = t.indexOf("function normNomeAdv"), j = t.indexOf("/* tabela dos confrontos");
  assert(i > 0 && j > i, app + ": funções não encontradas");
  const F = new Function(t.slice(i, j) + ";return { mesmoAdversario, vencedorDoRegistro, jogosContra, placarConfronto, textoPlacarConfronto };")();
  assert(F.mesmoAdversario("Simon Escudeiro", "simon  escudeiro"), "maiúscula e espaço");
  assert(F.mesmoAdversario("João Pedro Silva", "Joao Silva"), "acento e nome do meio");
  assert(!F.mesmoAdversario("Simon", "Simon Escudeiro"), "só o primeiro nome não junta");
  assert(!F.mesmoAdversario("Pedro Silva", "Pedro Souza"), "sobrenome diferente");
  assert(!F.mesmoAdversario("—", "—"), "sem adversário");
  assert.strictEqual(F.vencedorDoRegistro({ resultado: "6-4 3-6 7-6", concluida: true }), "vitoria");
  assert.strictEqual(F.vencedorDoRegistro({ resultado: "4-6 2-6", concluida: true }), "derrota");
  assert.strictEqual(F.vencedorDoRegistro({ resultado: "4-6 7-6 2-4 (set em andamento)", concluida: false }), "interrompido");
  const aluno = { registros: [
    { id: "a", tipo: "jogo", data: "2026-10-20", adversario: "Simon Escudeiro", resultado: "4-6 7-6", concluida: false },
    { id: "b", tipo: "jogo", data: "2026-03-02", adversario: "simon escudeiro", resultado: "6-3 6-4", concluida: true },
    { id: "c", tipo: "jogo", data: "2026-06-11", adversario: "Simon Escudero", resultado: "1-6 2-6", concluida: true },
    { id: "d", tipo: "jogo", data: "2026-07-01", adversario: "Leo", resultado: "6-0 6-0", concluida: true },
    { id: "e", tipo: "sessao", data: "2026-07-01" },
  ] };
  const js = F.jogosContra(aluno, "Simon Escudeiro");
  assert.deepStrictEqual(js.map((r) => r.id), ["b", "a"], app + ": em ordem de data, só o mesmo adversário");
  assert.strictEqual(F.textoPlacarConfronto(F.placarConfronto(js)), "1 vitória · 0 derrotas · 1 interrompido");
  assert.deepStrictEqual(F.jogosContra(aluno, "Simon Escudeiro", (r) => r.id === "a").map((r) => r.id), ["b"], app + ": exclui o jogo atual");
  assert(t.includes("<ConfrontosFrequentes aluno={aluno} />") && t.includes("<AvisoConfronto aluno={aluno}"), app + ": confrontos na tela");
}
console.log("check-confronto-direto: ok");
