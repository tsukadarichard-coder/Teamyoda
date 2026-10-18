/* QuadraLab Competição — formulário de interesse da página de vendas (público, sem login).

   POST { nome, email, telefone, faixa, categoria, objetivo, servico, consentimento: true, site? }
     → grava o pedido de contato em interessesCompeticao (o consultor vê no painel pedidos.html) e confirma.

   É uma SOLICITAÇÃO DE CONTATO: não contrata nada, não cobra e não reserva vaga. O envio só é confirmado depois de gravado de verdade; se o
   servidor não estiver configurado (FIREBASE_SERVICE_ACCOUNT), responde 503 e a página mostra o WhatsApp em vez de um sucesso falso.
   Opcional: INTERESSE_WEBHOOK_URL (https) recebe um aviso com nome, serviço e telefone/e-mail a cada novo contato.

   Cuidados: só os dados necessários, sem dados de saúde ou documentos; campo-isca contra robôs; no máximo 5 envios por hora por conexão
   (guardada só como hash) e um aviso de "já recebemos" para o mesmo e-mail e serviço no mesmo dia. */
const crypto = require("crypto");
const { admin, app } = require("./_firebase-admin");

const FAIXAS = { ate10: "Até 10 anos", "11-12": "11 e 12 anos", "13-14": "13 e 14 anos", "15-16": "15 e 16 anos", "17-18": "17 e 18 anos", adulto: "Acima de 18 anos" };
const CATEGORIAS = { iniciando: "Começando em torneios", regional: "Torneios regionais", estadual: "Torneios estaduais", nacional: "Torneios nacionais ou de ranking", outro: "Outra" };
const SERVICOS = { acompanhamento: "Acompanhamento MTY", revisao: "Revisão de estratégia", ao_vivo: "Consultoria ao vivo", analise: "Análise completa do jogador", analise_consultoria: "Análise completa + consultoria", nao_sei: "Ainda não sei" };
const MAX_POR_HORA = 5;

function resposta(statusCode, corpo) { return { statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(corpo) }; }
const txt = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

function validar(b) {
  b = b || {};
  const nome = txt(b.nome, 80);
  if (nome.length < 2) return { erro: "Informe o nome do responsável ou de quem está contratando." };
  const email = txt(b.email, 120).toLowerCase();
  if (!EMAIL.test(email)) return { erro: "Informe um e-mail válido." };
  const tel = String(b.telefone || "").replace(/\D/g, "");
  if (tel.length < 10 || tel.length > 13) return { erro: "Informe um telefone com DDD, para o contato." };
  if (!Object.prototype.hasOwnProperty.call(FAIXAS, b.faixa)) return { erro: "Escolha a faixa etária do atleta." };
  if (!Object.prototype.hasOwnProperty.call(CATEGORIAS, b.categoria)) return { erro: "Escolha a categoria ou a experiência competitiva." };
  if (!Object.prototype.hasOwnProperty.call(SERVICOS, b.servico)) return { erro: "Escolha o serviço de interesse." };
  const objetivo = txt(b.objetivo, 400);
  if (objetivo.length < 3) return { erro: "Conte, em poucas palavras, o objetivo principal." };
  if (b.consentimento !== true) return { erro: "Marque a autorização para entrarmos em contato." };
  return { dados: { nome, email, telefone: tel, faixa: b.faixa, categoria: b.categoria, servico: b.servico, objetivo } };
}

exports.validar = validar;
exports.FAIXAS = FAIXAS; exports.CATEGORIAS = CATEGORIAS; exports.SERVICOS = SERVICOS;
exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });
  if (String(event.body || "").length > 6000) return resposta(413, { erro: "Mensagem grande demais." });
  let b;
  try { b = JSON.parse(event.body || "{}"); } catch (e) { return resposta(400, { erro: "Pedido inválido." }); }
  if (b && b.site) return resposta(200, { ok: true }); // campo-isca preenchido: robô; nada é gravado
  const v = validar(b);
  if (v.erro) return resposta(400, { erro: v.erro });
  try {
    app();
    const db = admin.firestore(), agora = new Date(), iso = agora.toISOString();
    const ip = String((event.headers && (event.headers["x-nf-client-connection-ip"] || event.headers["x-forwarded-for"] || event.headers["client-ip"])) || "sem-ip").split(",")[0].trim();
    const ipHash = crypto.createHash("sha256").update(ip + "|qlc").digest("hex").slice(0, 24), janela = iso.slice(0, 13);
    const lim = db.collection("interessesLimite").doc(ipHash), sl = await lim.get();
    const n = sl.exists && sl.data().janela === janela ? sl.data().n || 0 : 0;
    if (n >= MAX_POR_HORA) return resposta(429, { erro: "Muitos envios em pouco tempo. Tente de novo daqui a uma hora ou fale pelo WhatsApp." });
    const dia = iso.slice(0, 10);
    const antes = (await db.collection("interessesCompeticao").where("email", "==", v.dados.email).get()).docs.some((d) => d.data().servico === v.dados.servico && String(d.data().criadoEm).slice(0, 10) === dia);
    if (antes) return resposta(200, { ok: true, repetido: true });
    await lim.set({ janela, n: n + 1 });
    await db.collection("interessesCompeticao").add({ ...v.dados, criadoEm: iso, origem: "pagina-de-vendas", status: "novo", ipHash });
    const url = String(process.env.INTERESSE_WEBHOOK_URL || "");
    if (/^https:\/\//.test(url)) {
      try {
        const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 4000);
        await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "Novo contato QuadraLab Competição: " + v.dados.nome + " · " + SERVICOS[v.dados.servico] + " · " + v.dados.telefone + " · " + v.dados.email }), signal: ctrl.signal });
        clearTimeout(t);
      } catch (e) { /* o aviso é um extra: o contato já está gravado e aparece no painel */ }
    }
    return resposta(200, { ok: true });
  } catch (e) {
    console.error("comp-interesse:", e && e.message);
    return resposta(503, { erro: "O envio não está disponível agora. Fale com a gente pelo WhatsApp." });
  }
};
