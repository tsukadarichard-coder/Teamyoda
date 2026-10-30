/* Avisos que nascem no app do treinador (quem grava é o próprio app, direto no Firestore): o app chama esta function logo depois.
   POST (treinador logado, com orgId) { tipo: "plano" | "observacao" | "relatorio", alunoId } → avisa o aluno/pais inscritos daquele
   jogador (Área do aluno ou link do aluno). O jogador precisa existir na lista da academia de quem chama.
   POST (só o dono) { tipo: "novidades", titulo?, corpo? } → avisa todo mundo inscrito neste site. */
const { admin, app } = require("./_firebase-admin");
const P = require("./_push");

class Erro extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const resposta = (statusCode, corpo) => ({ statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(corpo) });
const donos = () => String(process.env.FINANCEIRO_DONOS || "tsukada.richard@gmail.com").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
const ID = /^[A-Za-z0-9_.:@-]{1,120}$/;
const TEXTOS = {
  plano: (n) => ({ titulo: "Planejamento novo", corpo: "O professor liberou o planejamento de " + n + ". Toque para ver as próximas aulas.", tag: "plano" }),
  observacao: (n) => ({ titulo: "Recado do professor", corpo: "Tem um retorno novo do professor sobre " + n + ".", tag: "observacao" }),
  relatorio: (n) => ({ titulo: "Relatório publicado", corpo: "Saiu um relatório novo de " + n + ". Toque para ver.", tag: "relatorio" }),
};

async function nomeDoJogador(orgId, alunoId) {
  const d = await admin.firestore().collection("orgs").doc(orgId).collection("dados").doc("mty:alunos:v2").get();
  let lista = []; try { lista = d.exists ? JSON.parse(d.data().value || "[]") : []; } catch (e) { lista = []; }
  const a = lista.find((x) => x && String(x.id) === alunoId);
  return a ? String(a.nome || "o jogador").trim().split(/\s+/)[0] : null;
}

exports.handler = async function (event) {
  try {
    app();
    if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });
    const cab = (event.headers && (event.headers.authorization || event.headers.Authorization)) || "";
    const tk = cab.startsWith("Bearer ") ? cab.slice(7) : "";
    if (!tk) throw new Erro(401, "Entre com a sua conta.");
    let claims; try { claims = await admin.auth().verifyIdToken(tk); } catch (e) { throw new Erro(401, "Sua sessão expirou. Entre de novo."); }
    let b; try { b = JSON.parse(event.body || "{}"); } catch (e) { throw new Erro(400, "Pedido inválido."); }
    if (b.tipo === "novidades") {
      if (!claims.email || donos().indexOf(String(claims.email).toLowerCase()) < 0) throw new Erro(403, "Só o dono avisa as novidades.");
      const r = await P.enviarPara(admin, {}, { titulo: String(b.titulo || "Novidades no app").slice(0, 80), corpo: String(b.corpo || "Recursos novos prontos para usar. Toque para ver.").slice(0, 240), url: "@app", tag: "novidades" });
      return resposta(200, { ok: true, ...r });
    }
    if (!TEXTOS[b.tipo]) throw new Erro(400, "Aviso desconhecido.");
    if (!claims.orgId) throw new Erro(403, "Entre com a sua conta de treinador.");
    const alunoId = String(b.alunoId || "");
    if (!ID.test(alunoId)) throw new Erro(400, "Jogador inválido.");
    const nome = await nomeDoJogador(String(claims.orgId), alunoId);
    if (!nome) throw new Erro(404, "Jogador não encontrado nesta academia.");
    const r = await P.avisar(admin, { app: "aluno", orgId: String(claims.orgId), alunoId }, { ...TEXTOS[b.tipo](nome), url: "@app" });
    return resposta(200, { ok: true, ...(r || {}) });
  } catch (e) {
    if (e instanceof Erro) return resposta(e.status, { erro: e.message });
    console.error("push-avisar:", e);
    return resposta(500, { erro: "Não foi possível avisar agora." });
  }
};
