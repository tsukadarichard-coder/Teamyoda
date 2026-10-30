/* Inscrição nas notificações do celular (_push.js). Quem recebe o quê é decidido aqui, a partir de quem está logado — nunca do
   que o navegador diz:
   · treinador (app do treinador, conta com orgId):   { app: "treinador", uid, orgId, papel }
   · aluno com conta (Área do aluno, contasAluno ativo): { app: "aluno", uid, orgId, alunoId }
   · aluno/pais pelo link do aluno ({ org, id, t }):     { app: "aluno", orgId, alunoId }
   · atleta do QuadraLab Player:                        { app: "player", uid, atletaUid }

   GET                                   → { chave }  (chave pública VAPID, para o navegador se inscrever)
   POST { acao: "inscrever", app, inscricao: { endpoint, keys: { p256dh, auth } }, link?, url? } → { ok }  (url: a tela que o toque abre)
   POST { acao: "cancelar", endpoint }   → { ok }
   POST { acao: "estado", endpoint }     → { inscrito }
   O endereço de entrega precisa ser de um serviço de push conhecido (Google, Apple, Mozilla, Microsoft): o servidor faz POST nele. */
const { admin, app } = require("./_firebase-admin");
const P = require("./_push");
const VA = require("./ver-aluno").interno;

class Erro extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const resposta = (statusCode, corpo) => ({ statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(corpo) });
const HOSTS = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /^web\.push\.apple\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)notify\.windows\.com$/, /(^|\.)push\.apple\.com$/];
const ID = /^[A-Za-z0-9_.:@-]{1,120}$/;

function endpointValido(e) {
  try { const u = new URL(String(e || "")); return u.protocol === "https:" && String(e).length <= 1000 && HOSTS.some((h) => h.test(u.hostname)); } catch (x) { return false; }
}
async function quem(event) {
  const cab = (event.headers && (event.headers.authorization || event.headers.Authorization)) || "";
  const tk = cab.startsWith("Bearer ") ? cab.slice(7) : "";
  if (!tk) return null;
  try { return await admin.auth().verifyIdToken(tk); } catch (e) { throw new Erro(401, "Sua sessão expirou. Entre de novo."); }
}

async function destinatario(appPedido, claims, link) {
  if (appPedido === "treinador") {
    if (!claims || !claims.orgId) throw new Erro(403, "Entre com a sua conta de treinador.");
    return { app: "treinador", uid: claims.uid, orgId: String(claims.orgId), papel: String(claims.role || "treinador") };
  }
  if (appPedido === "player") {
    if (!claims || claims.orgId) throw new Erro(403, "Entre com a sua conta de atleta.");
    return { app: "player", uid: claims.uid, atletaUid: claims.uid };
  }
  if (appPedido === "aluno") {
    if (link && link.org && link.id && link.t) {
      if (!ID.test(String(link.org)) || !ID.test(String(link.id))) throw new Erro(400, "Link inválido.");
      await VA.carregarContexto(String(link.org), String(link.id), String(link.t)).catch(() => { throw new Erro(404, "Link inválido — peça um novo ao seu treinador."); });
      return { app: "aluno", orgId: String(link.org), alunoId: String(link.id) };
    }
    if (!claims || claims.orgId) throw new Erro(403, "Entre com a sua conta de aluno.");
    const c = await admin.firestore().collection("contasAluno").doc(claims.uid).get();
    const v = c.exists ? c.data().vinculo : null;
    if (!v || v.status !== "ativo" || !v.alunoId) throw new Erro(409, "Sua conta ainda não está ligada a um professor.");
    return { app: "aluno", uid: claims.uid, orgId: String(v.orgId), alunoId: String(v.alunoId) };
  }
  throw new Erro(400, "App desconhecido.");
}

exports.handler = async function (event) {
  try {
    app();
    if (event.httpMethod === "GET") return resposta(200, { chave: await P.chavePublica(admin) });
    if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });
    if (String(event.body || "").length > 5000) return resposta(413, { erro: "Pedido grande demais." });
    let b; try { b = JSON.parse(event.body || "{}"); } catch (e) { return resposta(400, { erro: "Pedido inválido." }); }
    const col = admin.firestore().collection(P.COLECAO);
    if (b.acao === "cancelar" || b.acao === "estado") {
      if (!endpointValido(b.endpoint)) return resposta(400, { erro: "Endereço inválido." });
      const ref = col.doc(P.idDaInscricao(b.endpoint));
      if (b.acao === "estado") return resposta(200, { inscrito: (await ref.get()).exists });
      await ref.delete();
      return resposta(200, { ok: true });
    }
    if (b.acao !== "inscrever") return resposta(400, { erro: "Ação desconhecida." });
    const i = b.inscricao || {}, k = i.keys || {};
    if (!endpointValido(i.endpoint) || !/^[A-Za-z0-9_-]{80,100}$/.test(String(k.p256dh || "")) || !/^[A-Za-z0-9_-]{16,30}$/.test(String(k.auth || ""))) return resposta(400, { erro: "Inscrição inválida." });
    const d = await destinatario(String(b.app || ""), await quem(event), b.link);
    const ref = col.doc(P.idDaInscricao(i.endpoint)), agora = new Date().toISOString();
    const antes = await ref.get();
    const url = typeof b.url === "string" && /^\/(?!\/)[^\s]{0,300}$/.test(b.url) ? b.url : "/";
    await ref.set({ ...d, url, endpoint: i.endpoint, keys: { p256dh: k.p256dh, auth: k.auth }, criadoEm: antes.exists ? antes.data().criadoEm || agora : agora, atualizadoEm: agora });
    return resposta(200, { ok: true });
  } catch (e) {
    if (e instanceof Erro) return resposta(e.status, { erro: e.message });
    console.error("push-inscricao:", e);
    return resposta(500, { erro: "Não foi possível ativar as notificações agora." });
  }
};
module.exports.endpointValido = endpointValido;
module.exports.destinatario = destinatario;
