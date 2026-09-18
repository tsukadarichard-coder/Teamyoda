/* Proxy do lado do servidor para a API da Anthropic.
   Antes, cada treinador colava sua própria chave no navegador. Agora a
   chave mora só aqui (variável de ambiente ANTHROPIC_API_KEY no Netlify)
   e só responde a quem chega com um login válido e uma organização
   atribuída — sem isso, ninguém gera nada, pago ou não. */
const { admin, app } = require("./_firebase-admin");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return resposta(405, { erro: "Método não permitido." });
  }

  const cabecalho = event.headers.authorization || event.headers.Authorization || "";
  const idToken = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : null;
  if (!idToken) {
    return resposta(401, { erro: "Faltou o login." });
  }

  let claims;
  try {
    app();
    claims = await admin.auth().verifyIdToken(idToken);
  } catch (e) {
    return resposta(401, { erro: "Login inválido ou expirado." });
  }

  if (!claims.orgId) {
    return resposta(403, { erro: "Esta conta ainda não está ligada a uma academia." });
  }

  const chaveAnthropic = process.env.ANTHROPIC_API_KEY;
  if (!chaveAnthropic) {
    return resposta(500, { erro: "O servidor ainda não tem a chave da Anthropic configurada." });
  }

  let corpo;
  try {
    corpo = JSON.parse(event.body || "{}");
  } catch (e) {
    return resposta(400, { erro: "Corpo da requisição inválido." });
  }

  const prompt = corpo.prompt;
  if (!prompt || typeof prompt !== "string") {
    return resposta(400, { erro: "Faltou o prompt." });
  }
  const maxTokens = Math.min(Math.max(Number(corpo.maxTokens) || 4000, 1), 8000);

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": chaveAnthropic,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const dados = await r.json();
    if (!r.ok) {
      return resposta(r.status, { erro: (dados && dados.error && dados.error.message) || ("Erro " + r.status) });
    }
    const texto = (dados.content || [])
      .filter((x) => x.type === "text")
      .map((x) => x.text)
      .join("\n");
    return resposta(200, { texto });
  } catch (e) {
    return resposta(502, { erro: "Falha ao falar com a Anthropic: " + String(e.message || e) });
  }
};

function resposta(statusCode, corpo) {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) };
}
