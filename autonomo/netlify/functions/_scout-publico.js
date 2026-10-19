/* Núcleo do link do scout (usado por scout-publico.js e por player-scouts.js): confere o token da partida, a validade e a revogação, e devolve
   só o resumo que o treinador publicou, com tipos e tamanhos conferidos. Quem chama nunca recebe o token de volta. */
const crypto = require("crypto");
const { admin, app } = require("./_firebase-admin");

const CHAVE_ALUNOS = "mty:alunos:v2";
const ZONAS = ["D-REDE", "D-APR", "D-FUNDO", "E-REDE", "E-APR", "E-FUNDO"];
const ID_CURTO = /^[A-Za-z0-9_.:@-]{1,120}$/;

function iguais(a, b) {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}
const hojeISO = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const txt = (v, n) => String(v == null ? "" : v).slice(0, n);
const FINS = ["winner_nos", "erro_dele", "erro_nos", "winner_dele"];
const num = (v) => (Number.isFinite(+v) ? Math.round(+v * 10) / 10 : 0);

const GOLPES = ["forehand", "backhand", "voleio", "smash", "drop", "lob", "devolucao"], DIRECOES = ["cruzado", "paralelo"], DIRECOES_SAQUE = ["aberto", "fechado", "corpo"], SITUACOES = ["ataque", "contra", "defesa", "neutra", "construcao"];
/* detalhe do scout (golpes, direção, direção do saque, situação, devolução): só números, só as chaves conhecidas */
const QUALIDADES_DEVOLUCAO = ["boa", "regular", "fraca"];
const ESCALAS_MENTAIS = ["conf", "foco", "energia", "calma"];
const DECISOES = ["boa", "disc", "ruim"];
const NIVEIS_ADVERSARIO = ["iniciante", "intermediario", "avancado", "competitivo", "elite"];

function limparDetalhe(d) {
  d = d || {};
  const ob = (src, chaves) => { const r = {}; for (const k of chaves) r[k] = num(src && src[k]); return r; };
  const mapa = (src, lista, campos) => { const r = {}; for (const k of lista) r[k] = ob(src && src[k], campos); return r; };
  const sq = d.saqueDir || {}, dv = d.devolucao || {};
  return {
    fins: ob(d.fins, ["winner_nos", "erro_dele", "erro_nos", "winner_dele"]),
    golpes: mapa(d.golpes, GOLPES, ["n", "w", "e", "g", "c"]),
    direcao: mapa(d.direcao, DIRECOES, ["n", "g", "c"]),
    saqueDir: { nos: mapa(sq.nos, DIRECOES_SAQUE, ["n", "a", "g"]), ele: mapa(sq.ele, DIRECOES_SAQUE, ["n", "a", "g"]) },
    situacoes: mapa(d.situacoes, SITUACOES, ["n", "g"]),
    devolucao: { nos: { ...ob(dv.nos, ["n", "e"]), q: mapa(dv.nos && dv.nos.q, QUALIDADES_DEVOLUCAO, ["n", "g"]) }, ele: ob(dv.ele, ["n", "e"]) },
    corrida: ob(d.corrida, ["n", "g"]),
    decisoes: mapa(d.decisoes, DECISOES, ["n", "g"]),
    games: (Array.isArray(d.games) ? d.games : []).slice(0, 60).map((x) => ob(x, ["j", "n", "g", "boa", "disc", "ruim", "s", "w"])),
  };
}

function limparMental(m) {
  m = m || {};
  const v = (x) => { x = Math.round(+x); return x >= 1 && x <= 5 ? x : 0; };
  const bloco = (o) => { const r = {}; for (const k of ESCALAS_MENTAIS) r[k] = v(o && o[k]); return r; };
  const jogo = {};
  Object.keys(m.jogo || {}).slice(0, 60).forEach((g) => { const n = Math.round(+g); if (n >= 1 && n <= 60 && v(m.jogo[g])) jogo[n] = v(m.jogo[g]); });
  return { antes: bloco(m.antes), depois: bloco(m.depois), jogo };
}

/* Placar completo (sets, games, pontos do game, quem saca): só números e rótulos fixos. O nome do adversário nunca vai. */
function limparPlacar(x) {
  if (!x || typeof x !== "object") return null;
  const n = (v) => { v = Math.round(+v); return v >= 0 && v <= 99 ? v : 0; };
  const par = (a) => [n(a && a[0]), n(a && a[1])];
  const lado = (v) => (v === "atleta" || v === "adversario" ? v : "");
  return { sets: (Array.isArray(x.sets) ? x.sets : []).slice(0, 5).map(par), games: par(x.games), pontos: txt(x.pontos, 8), tiebreak: !!x.tiebreak, sacador: lado(x.sacador), fim: !!x.fim, vencedor: lado(x.vencedor) };
}

function limpar(p) {
  p = p || {};
  const ob = (o, chaves) => { const r = {}; for (const k of chaves) r[k] = num(o && o[k]); return r; };
  const zonas = {};
  for (const z of ZONAS) if (p.zonas && p.zonas[z]) zonas[z] = ob(p.zonas[z], ["n", "ganhos"]);
  return {
    aoVivo: !!p.aoVivo, atualizadoEm: txt(p.atualizadoEm, 30),
    atleta: txt(p.atleta, 40), data: txt(p.data, 10), torneio: txt(p.torneio, 80), resultado: txt(p.resultado, 40), concluida: !!p.concluida, placar: limparPlacar(p.placar),
    n: num(p.n), ganhos: num(p.ganhos), pctGanhos: num(p.pctGanhos),
    bolas: ob(p.bolas, ["pctCurtos", "pctMedios", "pctLongos", "pctAte4"]),
    numeros: ob(p.numeros, ["errosNos", "errosDecisao", "errosExec", "df", "pctProtocolo", "rede", "redeGanha", "ataquePerdido", "pctAdversos", "pctPrimeiro", "aces", "acesAdv", "dfAdv", "pctPrimeiroAdv", "pctSacD", "nSacD", "pctSacE", "nSacE", "pctDevD", "nDevD", "pctDevE", "nDevE", "nAtaque", "pctAtaque", "nContra", "pctContra", "nDefesa", "pctDefesa"]),
    zonas, detalhe: limparDetalhe(p.detalhe), observacaoFinal: txt(p.observacaoFinal, 1200), nivelAdversario: NIVEIS_ADVERSARIO.indexOf(p.nivelAdversario) >= 0 ? p.nivelAdversario : "", mental: limparMental(p.mental),
    /* cada ponto: [ganhou o atleta (0/1), set, contagem depois do ponto ("30-15", "Game 3-2", "Set 6-4"), como terminou]; os dois últimos são opcionais (links antigos não têm) */
    serie: (Array.isArray(p.serie) ? p.serie : []).slice(0, 600).map((x) => {
      const r = [x && x[0] ? 1 : 0, Math.max(0, Math.min(4, Math.floor(+(x && x[1]) || 0)))];
      if (x && (x[2] != null || x[3] != null)) r.push(txt(x[2], 14), FINS.indexOf(x[3]) >= 0 ? x[3] : "");
      return r;
    }),
    sinais: (Array.isArray(p.sinais) ? p.sinais : []).slice(0, 12).map((s) => txt(s, 500)),
  };
}

/* ref = { org, id, j, t }. cache (opcional) evita reler o mesmo documento da academia várias vezes numa chamada.
   Devolve { ate, publico } quando o link vale; null em qualquer outro caso (não existe, token errado, vencido, revogado). */
async function lerResumoPublico(ref, cache) {
  const { org, id, j, t } = ref || {};
  if (![org, id, j].every((v) => typeof v === "string" && ID_CURTO.test(v)) || typeof t !== "string" || t.length < 16 || t.length > 200) return null;
  app();
  let alunos = cache && cache.get(org);
  if (alunos === undefined) {
    const snap = await admin.firestore().collection("orgs").doc(org).collection("dados").doc(CHAVE_ALUNOS).get();
    try { alunos = snap.exists ? JSON.parse(snap.data().value || "[]") : null; } catch (e) { alunos = null; }
    if (cache) cache.set(org, alunos);
  }
  if (!Array.isArray(alunos)) return null;
  const aluno = alunos.find((a) => a.id === id);
  const reg = aluno && (aluno.registros || []).find((r) => r.id === j && r.tipo === "jogo");
  const c = reg && reg.compartilhado;
  if (!c || !c.publico || !iguais(c.token, t) || !(c.ate >= hojeISO())) return null;
  return { ate: txt(c.ate, 10), publico: limpar(c.publico) };
}

module.exports = { lerResumoPublico, limpar, hojeISO, ID_CURTO };
