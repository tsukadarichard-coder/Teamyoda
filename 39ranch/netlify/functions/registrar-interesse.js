/* Recebe o formulário de interesse do site público do 39 Ranch Tennis
   Club (sem login) e grava em orgs/39-ranch/leads-site/{id} no mesmo
   projeto Firebase das academias. Não existe leitura pública: só quem
   loga como coordenador da 39 Ranch no painel interno (mty/index.html)
   enxergaria esses dados, e hoje nem há tela lá pra isso — os registros
   ficam só no Firestore até uma tela de leads ser construída.

   Mesmo padrão de resposta das outras functions públicas (ver
   inscricao-torneio-evento.js): ErroPublico pra erro de validação,
   resposta() pra sempre devolver JSON. */
const { admin, app } = require("./_firebase-admin");

class ErroPublico extends Error {
  constructor(status, mensagem) { super(mensagem); this.status = status; }
}

const LIMITE_NOME = 80;
const LIMITE_WHATSAPP = 30;
const INTERESSES_VALIDOS = ["comecar", "evoluir", "conhecer"];

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return resposta(405, { erro: "Método não permitido." });
  }
  try {
    app();
    let body;
    try { body = JSON.parse(event.body || "{}"); }
    catch (e) { throw new ErroPublico(400, "Corpo da requisição inválido."); }

    const nome = String(body.nome || "").trim().slice(0, LIMITE_NOME);
    const whatsapp = String(body.whatsapp || "").trim().slice(0, LIMITE_WHATSAPP);
    const interesse = String(body.interesse || "").trim();
    const consentimento = body.consentimento === true;

    if (!nome) throw new ErroPublico(400, "Preencha seu nome.");
    if (whatsapp.replace(/\D/g, "").length < 10) throw new ErroPublico(400, "Preencha um WhatsApp válido, com DDD.");
    if (!INTERESSES_VALIDOS.includes(interesse)) throw new ErroPublico(400, "Escolha uma opção de interesse.");
    if (!consentimento) throw new ErroPublico(400, "É preciso concordar em ser contatado(a) para enviar.");

    const lead = {
      nome, whatsapp, interesse,
      origem: String(body.origem || "site").slice(0, 40),
      criadoEm: new Date().toISOString(),
      contatado: false,
    };
    const ref = await admin.firestore().collection("orgs").doc("39-ranch").collection("leads-site").add(lead);

    return resposta(200, { ok: true, id: ref.id });
  } catch (e) {
    if (e instanceof ErroPublico) return resposta(e.status, { erro: e.message });
    return resposta(500, { erro: String(e.message || e) });
  }
};

function resposta(statusCode, corpo) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corpo),
  };
}
