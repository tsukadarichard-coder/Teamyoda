/* Observar jogos por voz: identificar o jogador pela fala e sugerir a classificação (obs-voz.js). Rode: node tests/check-obs-voz.js */
const assert = require("assert");
const V = require("../obs-voz.js");
const jogos = [{ id: "j1", apelido: "Nicolas", nome: "Nicolas Prado" }, { id: "j2", apelido: "Pedro", nome: "Pedro Lima" }, { id: "j3", apelido: "Lia", nome: "Lia Souza" }];
const id = (t, js) => V.identificarJogador(t, js || jogos);

/* nome no começo da fala */
assert.deepStrictEqual(id("Nicolas: está devolvendo muito atrás."), { modo: "nome", jogoId: "j1" });
assert.deepStrictEqual(id("nicolas está devolvendo muito atrás"), { modo: "nome", jogoId: "j1" });
assert.deepStrictEqual(id("Pedro: melhorou a primeira bola depois do saque."), { modo: "nome", jogoId: "j2" });
assert.deepStrictEqual(id("Insight para o Nicolas: trabalhar a devolução na paralela."), { modo: "nome", jogoId: "j1" });
assert.deepStrictEqual(id("Pro Pedro, lembrar de conversar sobre a escolha de direção"), { modo: "nome", jogoId: "j2" });
assert.deepStrictEqual(id("Lia Souza segundo saque curto"), { modo: "nome", jogoId: "j3" });
assert.deepStrictEqual(id("Nícolas, boa devolução"), { modo: "nome", jogoId: "j1" }, "acento não atrapalha");
/* sem nome: vai para o jogo ativo */
assert.deepStrictEqual(id("Segundo saque curto de novo. Trabalhar profundidade e confiança no próximo treino."), { modo: "ativo" });
assert.deepStrictEqual(id("Boa construção, mas precipitou a finalização"), { modo: "ativo" });
assert.deepStrictEqual(id("Lembrar de conversar sobre a escolha de direção."), { modo: "ativo" });
assert.deepStrictEqual(id("A bola está pesada hoje"), { modo: "ativo" }, "artigo não vira nome");
assert.deepStrictEqual(id(""), { modo: "ativo" });
/* nome só no meio da frase não muda o jogo (só o começo é lido) */
assert.deepStrictEqual(id("Boa devolução do Pedro"), { modo: "ativo" });
/* parecido ou repetido: confirmar, nunca atribuir em silêncio */
assert.deepStrictEqual(id("Nicolau está devolvendo atrás"), { modo: "confirmar", candidatos: ["j1"] });
const dois = [{ id: "a", apelido: "Pedro" }, { id: "b", apelido: "Pedro" }];
assert.deepStrictEqual(id("Pedro melhorou o saque", dois), { modo: "confirmar", candidatos: ["a", "b"] });
const parecidos = [{ id: "a", apelido: "Nicolas" }, { id: "b", apelido: "Nicolau" }];
assert.deepStrictEqual(id("Nicolas boa bola", parecidos), { modo: "confirmar", candidatos: ["a", "b"] }, "um igual e outro parecido");
assert.deepStrictEqual(id("Lia boa bola", [{ id: "a", apelido: "Lia" }, { id: "b", apelido: "Lis" }]), { modo: "nome", jogoId: "a" }, "nome curto não entra no parecido");
assert.deepStrictEqual(id("Segundo saque", [{ id: "a", apelido: "Segundo" }]).modo, "nome", "apelido igual a palavra comum só pelo nome exato");

/* classificação: sugestão, nunca certeza inventada */
const c = (t) => V.classificar(t);
assert.deepStrictEqual([c("Segundo saque curto de novo.").natureza, c("Segundo saque curto de novo.").cat], ["atencao", "saque"]);
let r = c("Segundo saque curto de novo. Trabalhar profundidade e confiança no próximo treino.");
assert.strictEqual(r.natureza, "insight"); assert.strictEqual(r.cat, "geral", "vários fundamentos: Geral"); assert.deepStrictEqual(r.opcoesCat, ["saque", "fundo", "mental"]);
assert.strictEqual(c("Lembrar de conversar sobre a escolha de direção.").natureza, "pergunta");
assert.strictEqual(c("Lembrar de conversar sobre a escolha de direção.").cat, "tatico");
r = c("Boa construção, mas precipitou a finalização");
assert.strictEqual(r.natureza, "observacao", "frase mista não vira positivo nem atenção"); assert.deepStrictEqual(r.opcoesNatureza, ["positivo", "atencao"]); assert.strictEqual(r.cat, "tatico");
assert.strictEqual(c("Rever esse padrão no próximo treino.").natureza, "insight");
assert.strictEqual(c("Observar se isso acontece também no lado da vantagem.").natureza, "insight");
assert.strictEqual(c("Pedro melhorou a primeira bola depois do saque").natureza, "positivo");
assert.strictEqual(c("Nicolas está devolvendo muito atrás").natureza, "atencao");
assert.strictEqual(c("Nicolas está devolvendo muito atrás").cat, "devolucao");
r = c("Ele olhou para o pai depois do ponto");
assert.deepStrictEqual([r.natureza, r.cat], ["observacao", "geral"], "sem pista: observação e Geral");
assert.strictEqual(c("Está cansado, perna pesada no terceiro set").cat, "fisico");
assert.strictEqual(c("Subiu à rede e errou o voleio").cat, "transicao");
console.log("check-obs-voz: ok");
