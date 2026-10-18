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

function limpar(p) {
  p = p || {};
  const ob = (o, chaves) => { const r = {}; for (const k of chaves) r[k] = num(o && o[k]); return r; };
  const zonas = {};
  for (const z of ZONAS) if (p.zonas && p.zonas[z]) zonas[z] = ob(p.zonas[z], ["n", "ganhos"]);
  return {
    aoVivo: !!p.aoVivo, atualizadoEm: txt(p.atualizadoEm, 30),
    atleta: txt(p.atleta, 40), data: txt(p.data, 10), torneio: txt(p.torneio, 80), resultado: txt(p.resultado, 40), concluida: !!p.concluida,
    n: num(p.n), ganhos: num(p.ganhos), pctGanhos: num(p.pctGanhos),
    bolas: ob(p.bolas, ["pctCurtos", "pctMedios", "pctLongos", "pctAte4"]),
    numeros: ob(p.numeros, ["errosNos", "errosDecisao", "errosExec", "df", "pctProtocolo", "rede", "redeGanha", "ataquePerdido", "pctAdversos"]),
    zonas,
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
