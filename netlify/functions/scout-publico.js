/* Link da família para o scout de UMA partida — leitura pública e limitada, sem login.

   GET ?org=…&id=…&j=…&t=…  →  o resumo que o treinador publicou para esta partida.

   Como a segurança funciona (mesmo desenho de ver-aluno.js):
   · o treinador gera o link no app: nasce um token aleatório guardado na própria partida (reg.compartilhado) com validade;
   · o que a família vê é um RESUMO montado pelo treinador no momento de gerar (reg.compartilhado.publico): primeiro nome do atleta,
     data, resultado, números, mapa, momento do jogo e leituras. Nunca o nome do adversário, anotações ou o caderno;
   · sem o token batendo, vencido ou revogado (o treinador apaga reg.compartilhado), a function devolve só "link inválido";
   · a resposta nunca é guardada em cache e os textos são limitados em tamanho antes de sair. */
const crypto = require("crypto");
const { admin, app } = require("./_firebase-admin");

const CHAVE_ALUNOS = "mty:alunos:v2";

function resposta(statusCode, corpo) {
  return { statusCode, headers: { "content-type": "application/json", "cache-control": "no-store", "x-robots-tag": "noindex", "referrer-policy": "no-referrer" }, body: JSON.stringify(corpo) };
}
function iguais(a, b) {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}
const hojeISO = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const txt = (v, n) => String(v == null ? "" : v).slice(0, n);
const num = (v) => (Number.isFinite(+v) ? Math.round(+v * 10) / 10 : 0);

/* só o que a página sabe mostrar, com tipos e tamanhos conferidos: o resumo vem do app do treinador, mas passa por aqui antes de sair */
function limpar(p) {
  p = p || {};
  const ob = (o, chaves) => { const r = {}; for (const k of chaves) r[k] = num(o && o[k]); return r; };
  const zonas = {};
  for (const z of ["D-REDE", "D-APR", "D-FUNDO", "E-REDE", "E-APR", "E-FUNDO"]) if (p.zonas && p.zonas[z]) zonas[z] = ob(p.zonas[z], ["n", "ganhos"]);
  return {
    atleta: txt(p.atleta, 40), data: txt(p.data, 10), torneio: txt(p.torneio, 80), resultado: txt(p.resultado, 40), concluida: !!p.concluida,
    n: num(p.n), ganhos: num(p.ganhos), pctGanhos: num(p.pctGanhos),
    bolas: ob(p.bolas, ["pctCurtos", "pctMedios", "pctLongos", "pctAte4"]),
    numeros: ob(p.numeros, ["errosNos", "errosDecisao", "errosExec", "df", "pctProtocolo", "rede", "redeGanha", "ataquePerdido", "pctAdversos"]),
    zonas,
    serie: (Array.isArray(p.serie) ? p.serie : []).slice(0, 600).map((x) => [x && x[0] ? 1 : 0, Math.max(0, Math.min(4, Math.floor(+(x && x[1]) || 0)))]),
    sinais: (Array.isArray(p.sinais) ? p.sinais : []).slice(0, 12).map((s) => txt(s, 500)),
  };
}

exports.handler = async function (event) {
  if (event.httpMethod !== "GET") return resposta(405, { erro: "Método não permitido." });
  const q = event.queryStringParameters || {};
  const { org, id, j, t } = q;
  const invalido = () => resposta(404, { erro: "Link inválido ou vencido. Peça um novo ao seu treinador." });
  if (!org || !id || !j || !t || String(t).length < 16) return invalido();
  try {
    app();
    const snap = await admin.firestore().collection("orgs").doc(String(org)).collection("dados").doc(CHAVE_ALUNOS).get();
    if (!snap.exists) return invalido();
    let alunos;
    try { alunos = JSON.parse(snap.data().value || "[]"); } catch (e) { return invalido(); }
    const aluno = alunos.find((a) => a.id === id);
    const reg = aluno && (aluno.registros || []).find((r) => r.id === j && r.tipo === "jogo");
    const c = reg && reg.compartilhado;
    if (!c || !c.publico || !iguais(c.token, t) || !(c.ate >= hojeISO())) return invalido();
    return resposta(200, { ate: txt(c.ate, 10), publico: limpar(c.publico) });
  } catch (e) {
    console.error("scout-publico:", e && e.message);
    return resposta(500, { erro: "Não foi possível abrir agora. Tente de novo em instantes." });
  }
};
module.exports.limpar = limpar;
