const assert = require("assert");
const E = require("../scout/evidencias.js");
let n = 0; const ok = (c, m) => { assert(c, m); n++; };
const mov = (id, dia, golpe, itens) => ({ id, criadoEm: "2026-09-" + dia + "T10:00:00Z", golpe, emp: "", dom: "d", itens: itens.map(([nm, s, v]) => ({ n: nm, s, v, u: "°", r: "≥ 30" })) });
const jogo = (dia, sc, mental) => ({ tipo: "jogo", data: "2026-09-" + dia, scout: Object.assign({ n: 60, pctPrimeiro: 65, df: 1, errosDecisao: 3, errosExec: 3, nSaqueDele: 20, pctErrosDevolucao: 10 }, sc), mental: mental ? { jogo: mental } : undefined });
const AGORA = "2026-10-01T12:00:00Z";
const ctx = { agora: AGORA, blocoAtual: "Bloco 1", exercicios: (a, n) => ["X1", "X2", "X3"].slice(0, n) };

// 1. biomecânica: problema recorrente
let a = { movimentos: [mov("m1", "01", "forehand", [["Flexão de joelhos", "atencao", 10]]), mov("m2", "10", "forehand", [["Flexão de joelhos", "atencao", 12]])] };
let ach = E.achados(a);
ok(ach.length === 1 && ach[0].sentido === "problema" && ach[0].fonte === "biomecanica", "achado biomecânico recorrente");
ok(ach[0].forca === "media", "força média com 2 análises");
// uma análise só não gera nada
ok(E.achados({ movimentos: [a.movimentos[0]] }).length === 0, "uma análise não basta");
// 3 análises -> alta
let a3 = { movimentos: a.movimentos.concat([mov("m3", "20", "forehand", [["Flexão de joelhos", "atencao", 9]])]) };
ok(E.achados(a3)[0].forca === "alta", "3 análises -> alta");

// 2. progresso
let ap = { movimentos: [a.movimentos[0], mov("m2", "10", "forehand", [["Flexão de joelhos", "ok", 40]])] };
ok(E.achados(ap)[0].sentido === "progresso", "progresso");
let pp = E.novasPropostas(ap, ctx); ok(pp.length === 1 && pp[0].tipo === "progresso", "proposta de progresso");

// 3. propostas + dedup/cooldown
let todas = E.novasPropostas(a, ctx);
ok(todas.some(p => p.tipo === "medicao"), "análise velha gera medição");
let props = todas.filter(p => p.tipo === "reforco");
ok(props.length === 1 && props[0].tipo === "reforco" && props[0].acao.ex.length === 3 && props[0].acao.bloco === "Bloco 1", "proposta reforço");
a.revisoesPlano = todas;
ok(E.novasPropostas(a, ctx).length === 0, "pendente não duplica");
a.revisoesPlano = E.decidir(todas, props[0].id, "recusada", AGORA);
ok(!E.novasPropostas(a, ctx).some(p => p.tipo === "reforco"), "recusada em cooldown");
ok(E.novasPropostas(a, Object.assign({}, ctx, { agora: "2026-11-15T12:00:00Z" })).some(p => p.tipo === "reforco"), "depois do cooldown volta");

// 4. efeitos
a.revisoesPlano = E.decidir(todas, props[0].id, "aceita", "2026-10-01T12:00:00Z");
ok(E.efeitos(a)[props[0].id].estado === "aguardando", "aguardando nova análise");
a.movimentos = a.movimentos.concat([mov("m3", "30", "forehand", [["Flexão de joelhos", "ok", 40]]).__proto__ && Object.assign(mov("m3", "30", "forehand", [["Flexão de joelhos", "ok", 40]]), { criadoEm: "2026-10-10T10:00:00Z" })]);
ok(E.efeitos(a)[props[0].id].estado === "funcionou", "funcionou");

// 5. scout
let s = { registros: [jogo("01", { pctPrimeiro: 50 }), jogo("08", { pctPrimeiro: 52, df: 5 }), jogo("15", { pctPrimeiro: 48, df: 4 })] };
ach = E.achados(s).map(x => x.id);
ok(ach.includes("sc:primeiro-saque") && ach.includes("sc:duplas-faltas"), "achados de saque");
ok(E.achados({ registros: [s.registros[0]] }).length === 0, "um jogo não basta");
ok(E.achados({ registros: [Object.assign({}, jogo("01", { pctPrimeiro: 40 }), { origemCompeticao: true }), Object.assign({}, jogo("02", { pctPrimeiro: 40 }), { origemCompeticao: true })] }).length === 0, "competição ignorada");
let sp = E.novasPropostas(s, ctx);
ok(sp.length >= 1 && sp.length <= 3 && sp.every(p => p.tipo === "reforco" && p.acao.area === "saque"), "propostas de saque");
// decisão
let d = { registros: [jogo("01", { errosDecisao: 8, errosExec: 2 }), jogo("08", { errosDecisao: 7, errosExec: 3 })] };
ok(E.achados(d)[0].id === "sc:decisao" && E.novasPropostas(d, ctx)[0].tipo === "foco", "decisão -> foco");
// mental
let m = { registros: [jogo("01", {}, { 1: 2, 2: 2, 3: 1 }), jogo("08", {}, { 1: 2, 2: 3, 3: 2 })] };
ok(E.achados(m).some(x => x.id === "sc:mental"), "mental baixo");

// 6. cruzamento
let c = { movimentos: a3.movimentos, registros: [jogo("01", { errosDecisao: 2, errosExec: 8 }), jogo("08", { errosDecisao: 3, errosExec: 7 })] };
ok(E.achados(c).some(x => x.cruzado && x.forca === "alta"), "cruzamento eleva força");
let c2 = { movimentos: [mov("a", "01", "forehand", [["X", "ok", 1]]), mov("b", "02", "forehand", [["X", "ok", 1]])], registros: c.registros };
ok(E.achados(c2).some(x => x.id === "hip:fisico-mental"), "hipótese físico/mental");

// 7. prompt
let tp = E.textoParaPrompt(Object.assign({}, s, { revisoesPlano: [{ id: "r", status: "recusada", titulo: "Sugestão recusada X", decididoEm: AGORA, chave: "k" }] }), AGORA);
ok(/EVIDÊNCIAS RECENTES/.test(tp) && /RECUSOU/.test(tp), "texto do prompt");
ok(E.textoParaPrompt({}) === null, "sem dados -> null");
// 8. limite de pendentes
ok(E.novasPropostas({ revisoesPlano: Array.from({ length: 5 }, (_, i) => ({ id: i, status: "pendente", chave: "z" + i })), registros: s.registros }, ctx).length === 0, "teto de pendentes");
console.log("check-evidencias OK (" + n + " verificações)");
// metas de saída medidas
{
  const E2 = require("../scout/evidencias.js");
  const j = (d, p) => ({ tipo: "jogo", data: "2026-09-" + d, scout: { n: 50, pctPrimeiro: p, df: 1, errosDecisao: 1, errosExec: 1 } });
  let r = E2.metaDaArea({ registros: [j("01", 64), j("08", 66)] }, "saque");
  assert(r.temDados && r.sugereLiberar && r.indicadores[0].atingido, "saque atingido");
  r = E2.metaDaArea({ registros: [j("01", 50), j("08", 66)] }, "saque");
  assert(r.temDados && !r.sugereLiberar, "saque abaixo");
  r = E2.metaDaArea({ registros: [j("01", 64)] }, "saque");
  assert(!r.temDados && !r.sugereLiberar, "um jogo não basta");
  r = E2.metaDaArea({ movimentos: [mov("a", "01", "forehand", [["X", "ok", 1]])] }, "fundo");
  assert(r.sugereLiberar, "fundo pelo vídeo");
  assert(!E2.metaDaArea({}, "rede").temDados, "área sem medição automática");
  console.log("metas ok");
}
{
  const E3 = require("../scout/evidencias.js");
  const base = { registros: [{ tipo: "jogo", data: "2026-09-01", scout: { n: 40, pctPrimeiro: 40 } }, { tipo: "jogo", data: "2026-09-08", scout: { n: 40, pctPrimeiro: 42 } }] };
  assert(E3.novasPropostas(base, { agora: "2026-09-20T00:00:00Z", aulasRestantes: 2 }).some(p => p.tipo === "horizonte"), "horizonte perto do fim");
  assert(!E3.novasPropostas(base, { agora: "2026-09-20T00:00:00Z", aulasRestantes: 9 }).some(p => p.tipo === "horizonte"), "sem horizonte no meio do plano");
  assert(!E3.novasPropostas(base, { agora: "2026-09-20T00:00:00Z" }).some(p => p.tipo === "horizonte"), "sem plano, sem horizonte");
  console.log("horizonte ok");
}
{
  const E4 = require("../scout/evidencias.js");
  const bio = (id, dia, s) => mov(id, dia, "forehand", [["Flexão de joelhos no giro", s, 10]]);
  // jogador A: reforço com X2 funcionou; jogador B: X3 não funcionou
  const mk = (ex, status, fim) => ({
    movimentos: [bio("1", "01", "atencao"), bio("2", "05", "atencao")].concat(fim ? [Object.assign(bio("3", "10", fim), { criadoEm: "2026-10-10T10:00:00Z" })] : []),
    revisoesPlano: [{ id: "r1", status: "aceita", aplicada: true, decididoEm: "2026-10-01T00:00:00Z", chave: "k", titulo: "t", tipo: "reforco", acao: { tipo: "reforco", ex }, esperado: { fonte: "biomecanica", golpe: "forehand", emp: "", item: "Flexão de joelhos no giro" } }]
  });
  const ap = E4.aprendizado([mk(["X2", "X9"], "aceita", "ok"), mk(["X3"], "aceita", "atencao")]);
  // um só "sem melhora" exige 2 análises novas: aqui há 1, então segue aguardando e não conta
  assert(ap["Flexão de joelhos no giro"].X2 === 1 && ap["Flexão de joelhos no giro"].X9 === 1 && !ap["Flexão de joelhos no giro"].X3, "aprendizado só conta resultados conclusivos");
  const novo = { movimentos: [bio("1", "01", "atencao"), bio("2", "10", "atencao")] };
  const props2 = E4.novasPropostas(novo, { agora: "2026-09-12T00:00:00Z", aprendizado: ap, exercicios: () => ["X1", "X3", "X2", "X9"] }).filter(p => p.tipo === "reforco");
  assert(props2[0].acao.ex[0] === "X2" || props2[0].acao.ex[0] === "X9", "exercício que funcionou vem primeiro: " + props2[0].acao.ex);
  assert(E4.buscaDoItem("Split step antes do golpe").test("Treino de split step"), "busca do item");
  assert(E4.buscaDoItem("Item desconhecido") === null, "item sem mapa");
  console.log("aprendizado ok");
}
