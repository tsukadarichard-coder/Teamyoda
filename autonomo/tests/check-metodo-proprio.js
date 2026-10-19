const assert = require("assert");
const M = require("../metodo/metodo-proprio.js");
let n = 0; const ok = (c, m) => { assert(c, m); n++; };
// limpar: limites e tipos
const sujo = M.limpar({ nome: "  Método Ana  ", estrutura: { semanasCiclo: "99", aulasSemana: "x", blocosCiclo: 0 }, principios: ["a", "", "b", { t: "c" }, ...Array(30).fill("z")], areas: [{ nome: "Saque", criterio: "60%" }, { nome: "" }, null], exemplos: [{ titulo: "t", texto: "x".repeat(9000) }, { texto: "" }] });
ok(sujo.nome === "Método Ana" && sujo.estrutura.semanasCiclo === 16 && sujo.estrutura.aulasSemana === 2 && sujo.estrutura.blocosCiclo === 1, "estrutura limitada");
ok(sujo.principios.length === 12 && sujo.principios.slice(0, 3).join() === "a,b,c", "princípios limpos e limitados");
ok(sujo.areas.length === 1 && sujo.exemplos.length === 1 && sujo.exemplos[0].texto.length === 6000, "áreas e exemplos limpos");
ok(M.limpar(null).ativo === false && M.vazio().ativo === false, "vazio");
// prontidão
let p = M.prontidao(M.vazio(), 0); ok(!p.ok && p.faltas.length === 3, "tudo falta");
p = M.prontidao({ principios: ["a", "b", "c"], areas: [{ nome: "x" }, { nome: "y" }] }, 6); ok(p.ok, "pronto");
// prompt: só o método dele, nada de MTY
const m = M.limpar({ nome: "Linha Verde", principios: ["Sempre bola viva", "Pernas primeiro", "Decisão antes da técnica"], naoFazer: ["Parado no cesto por mais de 10 min"], areas: [{ nome: "Saque", criterio: "1º saque ≥ 65%" }, { nome: "Rede", criterio: "8 de 10 voleios" }], niveis: [{ nome: "Base", criterio: "rali de 6 bolas" }], exemplos: [{ titulo: "Ciclo março", texto: "Semana 1: saque" }] });
const pr = M.montarPrompt(m, { indice: "MEU001 Saque alvo", ficha: "Nome: Ana", extras: ["EVIDÊNCIAS RECENTES: x"], semanas: 4, nBlocos: 2, porBloco: 2, aulasSemana: 3, enfase: ["ÊNFASE: técnico"] });
ok(/Linha Verde/.test(pr) && /Sempre bola viva/.test(pr) && /1º saque ≥ 65%/.test(pr) && /Parado no cesto/.test(pr) && /MEU001 Saque alvo/.test(pr) && /EVIDÊNCIAS RECENTES/.test(pr), "conteúdo do método no prompt");
ok(!/MTY|Richard|Y1|saque e devolução/i.test(pr.replace(/Saque alvo|1º saque|Saque/g, "")), "sem regras do MTY");
ok(/areaFoco deve ficar sempre vazio/.test(pr) && /4 semanas, 2 blocos/.test(pr), "formato");
// extração da IA
const ex = M.lerExtracao('```json\n{"nome":"X","principios":["p1","p2"],"areas":[{"nome":"Saque","criterio":"60%"}],"exercicios":[{"nome":"Saque alvo","objetivo":"direção"},{"nome":""}],"ativo":true}\n```');
ok(ex.metodo.nome === "X" && ex.metodo.ativo === false && ex.exercicios.length === 1 && ex.exercicios[0].nome === "Saque alvo", "leitura da extração (nunca ativa sozinho)");
let falhou = false; try { M.lerExtracao("não é json"); } catch (e) { falhou = true; } ok(falhou, "texto inválido erra");
// CSV
const csv = 'Nome;Objetivo;Montagem;Carga;Progressão\nSaque alvo;Direção;"3 alvos; 20 saques";4x10;Alvos menores\nVoleio duplo;Rede;2 contra 1;5 min;\n;sem nome;;;';
const it = M.exerciciosDeCSV(csv);
ok(it.length === 2 && it[0].montagem === "3 alvos; 20 saques" && it[0].progressao === "Alvos menores" && it[1].nome === "Voleio duplo", "CSV com cabeçalho e aspas");
ok(M.exerciciosDeCSV("Rali longo\nPasse e vá").length === 2, "lista simples, 1 coluna");
ok(M.exerciciosDeCSV("nome,objetivo\nA,b").length === 1, "separador vírgula");
const bib = M.paraBiblioteca(it, [{ c: "MEU001", n: "Outro" }, { c: "FB001", n: "saque alvo" }]);
ok(bib.length === 1 && bib[0].c === "MEU002" && bib[0].n === "Voleio duplo" && bib[0].e.length === 5 && bib[0].meu, "biblioteca: sem repetir nome nem código");
ok(M.indice(bib).startsWith("MEU002 Voleio duplo"), "índice");
console.log("check-metodo-proprio OK (" + n + " verificações)");
