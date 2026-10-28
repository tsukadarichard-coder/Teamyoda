/* Rendimento da equipe (mty/equipe-rendimento.js): avaliação por sessão, resumo do ciclo, rendimento do atleta, gráficos, relatório do ciclo
   e o rendimento no relatório do atleta. Rode: node tests/check-rendimento-equipe.js */
const assert = require("assert");
const P = require("../../mty/plano-equipe.js"), RE = require("../../mty/equipe-rendimento.js"), R = require("../../mty/relatorio-atleta.js");

/* plano de 2 semanas, seg e qua; semana 1 técnica com saque e movimentação; o dia 04/11 é tático com ataque */
let p = P.montarCiclo({ semanas: 2, inicio: "2026-11-02", dias: [1, 3], duracaoMin: 90 });
p.semanas[0].grupo = "tecnico"; p.semanas[0].itens = ["saque", "movimentacao"];
p.semanas[0].dias[1] = { ...p.semanas[0].dias[1], grupo: "tatico", itens: ["ataque"] };
p.semanas[1].grupo = "misto";

/* fechado: sem status (planos antigos) conta como fechado; "rascunho" não */
assert(P.fechado(p) && !P.fechado({ ...p, status: "rascunho" }) && P.fechado({ ...p, status: "fechado" }) && !P.fechado(null));

/* sessões herdam grupo e itens da semana */
const ss = P.sessoes(p);
assert.deepStrictEqual(ss.map((s) => [s.data, s.grupo, s.itens.join(",")]), [["2026-11-02", "tecnico", "movimentacao,saque"], ["2026-11-04", "tatico", "ataque"], ["2026-11-09", "misto", ""], ["2026-11-11", "misto", ""]]);
const e = P.estatisticas(p);
assert.deepStrictEqual([e.sessoes, e.minutos, e.porGrupo.tecnico, e.porGrupo.tatico, e.porGrupo.misto], [4, 360, 1, 1, 2]);
assert.deepStrictEqual(e.porItem.map((x) => [x.rotulo, x.sessoes]), [["Movimentação", 1], ["Saque", 1], ["Ataque", 1]]);
const vg = P.htmlVisaoGeral(p);
assert(/6 h/.test(vg) && /Sessões por grupo em cada semana/.test(vg) && /O que o ciclo trabalha/.test(vg) && /Ver como tabela/.test(vg) && /#2a78d6/.test(vg) && /#eb6834/.test(vg) && /#1baf7a/.test(vg), "visão geral com números, gráficos e tabela");
assert(/Visão geral do ciclo/.test(P.htmlAluno({ equipe: "J", plano: p }, "2026-11-02", true)) && !/Visão geral do ciclo/.test(P.htmlAluno({ equipe: "J", plano: p }, "2026-11-02", false)));

/* limpar a avaliação: notas de 1 a 5, itens conhecidos, só atletas da equipe; quem faltou não tem nota */
const l = RE.limparAvaliacao({ nota: 9, obs: "x", atletas: { a: { presente: true, nota: 4, itens: { saque: 5, inventado: 3, voleio: 0 }, obs: "boa" }, b: { presente: false, nota: 5 }, z: { nota: 3 } } }, ["a", "b"]);
assert.deepStrictEqual(l.atletas, { a: { presente: true, nota: 4, itens: { saque: 5 }, obs: "boa" }, b: { presente: false, obs: "" } });
assert.strictEqual(l.nota, null);

/* avaliações: a e b, 4 sessões */
p.avaliacoes = {
  "2026-11-02": { nota: 4, obs: "Boa intensidade", atletas: { a: { presente: true, nota: 3, itens: { saque: 2, movimentacao: 3 } }, b: { presente: true, nota: 4, itens: { saque: 4 } } } },
  "2026-11-04": { nota: 3, atletas: { a: { presente: true, nota: 3, itens: { ataque: 4 } }, b: { presente: false, obs: "doente" } } },
  "2026-11-09": { atletas: { a: { presente: true, nota: 4, obs: "Melhorou o deslocamento" }, b: { presente: true, nota: 4 } } },
  "2026-11-11": { atletas: { a: { presente: true, nota: 5 }, b: { presente: true, nota: 3 } } },
};
const ra = RE.rendimentoAtleta(p, "a", null, null, "Ana");
assert.deepStrictEqual([ra.sessoes, ra.presencas, ra.faltas, ra.presenca, ra.media], [4, 4, 0, 100, 3.8]);
assert.deepStrictEqual(ra.tendencia, { de: 3, para: 4.5, direcao: "subiu" });
assert.deepStrictEqual(ra.porItem.map((x) => [x.rotulo, x.media]), [["Movimentação", 3], ["Saque", 2], ["Ataque", 4]]);
assert.deepStrictEqual([ra.destaques, ra.desenvolver], [["Ataque"], ["Saque"]]);
assert.deepStrictEqual(ra.obs, [{ data: "2026-11-09", texto: "Melhorou o deslocamento" }]);
const rb = RE.rendimentoAtleta(p, "b", "2026-11-01", "2026-11-08");
assert.deepStrictEqual([rb.sessoes, rb.presencas, rb.faltas, rb.media, rb.tendencia], [2, 1, 1, 4, null], "período e falta");
assert.strictEqual(RE.rendimentoAtleta(p, "c"), null);

const res = RE.resumo(p, [{ id: "a", nome: "Ana" }, { id: "b", nome: "Beto" }, { id: "c", nome: "Caio" }], "2026-11-12");
assert.deepStrictEqual([res.sessoes, res.passadas, res.avaliadas, res.presenca, res.media, res.notaSessao], [4, 4, 4, 88, 3.7, 3.5]);
assert.deepStrictEqual(res.porSemana.map((s) => [s.n, s.avaliadas, s.media, s.presenca]), [[1, 2, 3.3, 75], [2, 2, 4, 100]]);
assert.deepStrictEqual(res.porItem.map((x) => [x.rotulo, x.media, x.n]), [["Movimentação", 3, 1], ["Saque", 3, 2], ["Ataque", 4, 1]]);
assert.strictEqual(res.atletas[2].sessoes, 0, "atleta sem avaliação aparece zerado");
assert.deepStrictEqual(res.obsSessoes.map((o) => [o.data, o.nota]), [["2026-11-02", 4], ["2026-11-04", 3]]);
const hr = RE.htmlRendimento(res);
assert(/4 de 4/.test(hr) && /88%/.test(hr) && /3,7/.test(hr) && /Rendimento médio por semana/.test(hr) && /Rendimento por item/.test(hr) && /↑ subiu de 3,0 para 4,5/.test(hr) && /Ainda sem avaliação/.test(hr), "rendimento em HTML");

/* relatório do ciclo */
const doc = RE.documento({ equipe: "Juvenil <A>", coordenador: "Richard", academia: "Team Yoda" }, p, [{ id: "a", nome: "Ana" }, { id: "b", nome: "Beto" }], "2026-11-20");
assert(/Relatório do ciclo · Juvenil &lt;A&gt;/.test(doc) && /Ciclo encerrado/.test(doc) && /O planejamento/.test(doc) && /Boa intensidade/.test(doc) && /Melhorou o deslocamento/.test(doc) && /doente/.test(doc) && /Semana a semana/.test(doc) && /window\.print/.test(doc));
assert(/Relatório parcial/.test(RE.documento({ equipe: "J" }, p, [], "2026-11-05")));

/* relatório do atleta: rendimento no período só para quem foi avaliado; o link (sem avaliações) não tem rendimento */
const rel = R.coletar({ id: "a", nome: "Ana", registros: [] }, [], { tipo: "mes", mes: "2026-11" }, [{ equipe: "Juvenil", plano: p }]);
assert.strictEqual(rel.rendimento.length, 1); assert.deepStrictEqual([rel.rendimento[0].equipe, rel.rendimento[0].media, rel.rendimento[0].presencas], ["Juvenil", 3.8, 4]);
const h = R.html(rel, {});
assert(/Rendimento nos treinos · Juvenil/.test(h) && /4\/4/.test(h) && /3,8/.test(h) && /Destaques:<\/b> Ataque/.test(h) && /Melhorou o deslocamento/.test(h));
assert.strictEqual(R.coletar({ id: "a", nome: "Ana", registros: [] }, [], { tipo: "mes", mes: "2027-02" }, [{ equipe: "Juvenil", plano: p }]).rendimento.length, 0);
assert.strictEqual(R.coletarDoLink({ nome: "Ana", planosEquipe: [{ equipe: "Juvenil", plano: P.limpar(p) }] }, { tipo: "tudo" }).rendimento.length, 0);
assert(!JSON.stringify(P.limpar(p)).includes("avaliacoes"), "o link não recebe as avaliações");
console.log("check-rendimento-equipe: ok");
