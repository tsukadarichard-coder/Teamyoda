/* Alto rendimento · o atleta em viagem (link do aluno ou Área do aluno), sem conta de professor:
   GET  ?org&id&t                 → a semana atual do plano dele (conteúdos e o que já fez), o próximo torneio, a carga da
                                     semana e os últimos registros. Atleta fora do alto rendimento: { ativo: false }.
   POST { org, id, t, registro }  → registra um treino ou jogo feito fora do CT (origem "viagem", autor "atleta", a confirmar
                                     pelo treinador), que entra na hora no marcador e na carga da semana.
   O link do aluno é a credencial (o mesmo de ver-aluno.js): trocar o link corta o acesso. Máximo de 8 registros por dia. */
const { admin } = require("./_firebase-admin");
const VA = require("./ver-aluno").interno;
const AR = require("./_alto-rendimento.js");

const ORGS = { "team-yoda": 1, "39-ranch": 1 };
const ID = /^[A-Za-z0-9_.:@-]{1,120}$/;
const MAX_POR_DIA = 8;
class Erro extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const resposta = (statusCode, corpo) => ({ statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(corpo) });
const hojeBR = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const refAR = (org, id) => admin.firestore().collection("orgs").doc(org).collection("ar").doc(id);

async function validar(org, id, t) {
  if (!ORGS[org] || !ID.test(String(id || "")) || !t) throw new Erro(400, "Link do aluno incompleto.");
  try { await VA.carregarContexto(String(org), String(id), String(t)); }
  catch (e) { throw new Erro(e.status || 404, e.message || "Link inválido — peça um novo ao seu treinador."); }
}
function resumo(ar, hoje, registros) {
  const m = AR.marcador(ar, hoje), prox = AR.proximoTorneio(ar, hoje), c = AR.cargaSemanaAtual(ar, hoje);
  return {
    ativo: true, hoje, status: AR.statusAtleta(ar, hoje),
    semana: m ? { n: m.semanaN, total: m.totalSemanas, fase: m.faseNome, bloco: m.blocoTitulo, inicio: m.inicioSemana, pct: m.pct,
      conteudos: m.conteudos.map((x) => ({ id: x.id, titulo: x.titulo, pilar: x.pilar, tipo: x.tipo, vezesAlvo: x.vezesAlvo, feitas: x.feitas, essencial: x.essencial })),
      atrasados: m.atrasados.map((x) => ({ id: x.id, titulo: x.titulo, pilar: x.pilar })) } : null,
    proximoTorneio: prox ? { id: prox.id, nome: prox.nome, inicio: prox.inicio, fim: prox.fim, prioridade: prox.prioridade } : null,
    torneios: (ar.calendario || []).filter((t) => (t.fim || t.inicio) >= AR.somaDias(hoje, -14)).slice(0, 8).map((t) => ({ id: t.id, nome: t.nome, inicio: t.inicio, fim: t.fim })),
    carga: { minutos: c.minutos, ua: c.ua, alvo: c.alvo, pct: c.pct },
    registros: registros.slice(0, 6).map((r) => ({ data: r.data, tipo: r.tipo, origem: r.origem, minutos: r.minutos, pse: r.pse, confirmado: r.confirmado !== false })),
  };
}
async function ultimos(org, id) {
  const s = await refAR(org, id).collection("registros").orderBy("data", "desc").limit(20).get();
  return s.docs.map((d) => d.data());
}

exports.handler = async function (event) {
  try {
    if (event.httpMethod === "GET") {
      const q = event.queryStringParameters || {};
      await validar(q.org, q.id, q.t);
      const snap = await refAR(q.org, q.id).get();
      const ar = snap.exists ? snap.data() : null;
      if (!ar || !ar.ativo || !ar.plano) return resposta(200, { ativo: false });
      return resposta(200, resumo(ar, hojeBR(), await ultimos(q.org, q.id)));
    }
    if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });
    if ((event.body || "").length > 6000) return resposta(413, { erro: "Registro grande demais." });
    let b; try { b = JSON.parse(event.body || "{}"); } catch (e) { return resposta(400, { erro: "Pedido inválido." }); }
    await validar(b.org, b.id, b.t);
    const ref = refAR(b.org, b.id), snap = await ref.get();
    const ar = snap.exists ? snap.data() : null;
    if (!ar || !ar.ativo || !ar.plano) throw new Erro(403, "Este atleta não está no alto rendimento.");
    const hoje = hojeBR(), r = b.registro || {};
    const data = /^\d{4}-\d{2}-\d{2}$/.test(String(r.data || "")) ? String(r.data) : hoje;
    if (data > hoje || AR.dias(data, hoje) > 30) throw new Erro(400, "A data precisa ser de hoje ou dos últimos 30 dias.");
    if (!(Number(r.minutos) > 0)) throw new Erro(400, "Informe quantos minutos durou.");
    const validos = new Set(AR.semanasDoPlano(ar.plano).flatMap((x) => x.semana.conteudos.map((c) => c.id)));
    const reg = AR.normalizarRegistro({ ...r, data, origem: "viagem", autor: "atleta", confirmado: false,
      conteudosFeitos: (Array.isArray(r.conteudosFeitos) ? r.conteudosFeitos : []).filter((id) => validos.has(String(id))),
      torneioId: (ar.calendario || []).some((t) => t.id === r.torneioId) ? r.torneioId : null, sessaoId: null, id: null });
    const doDia = await ref.collection("registros").where("data", "==", data).get();
    if (doDia.size >= MAX_POR_DIA) throw new Erro(429, "Muitos registros neste dia. Fale com o treinador.");
    await ref.collection("registros").doc(reg.id).set(reg);
    const novo = AR.aplicarRegistro(ar, reg, hoje);
    await ref.set({ progresso: novo.progresso, cargaSemanas: novo.cargaSemanas, atualizadoEm: new Date().toISOString() }, { merge: true });
    return resposta(200, { ok: true, registro: { id: reg.id, data: reg.data, ua: reg.ua }, ...resumo({ ...ar, ...novo }, hoje, [reg, ...(await ultimos(b.org, b.id)).filter((x) => x.id !== reg.id)]) });
  } catch (e) {
    if (e.status) return resposta(e.status, { erro: e.message });
    console.error("ar-atleta:", e);
    return resposta(500, { erro: "Não foi possível agora. Tente de novo." });
  }
};
