/* Versão em segundo plano do gerador de IA.
   Gerar um plano de várias semanas facilmente passa dos ~10s que uma
   function comum tem para responder — o sufixo "-background" no nome do
   arquivo é o que diz ao Netlify para deixar essa function rodar até 15
   minutos, sem prender quem chamou esperando a resposta.

   O resultado não volta na resposta HTTP (o Netlify já respondeu 202
   antes disso) — ele é escrito em orgs/{orgId}/iaJobs/{jobId}, e é de lá
   que o app lê quando o job termina. */
const { admin, app } = require("./_firebase-admin");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Método não permitido." };

  const cabecalho = event.headers.authorization || event.headers.Authorization || "";
  const idToken = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : null;
  if (!idToken) return { statusCode: 401, body: "Faltou o login." };

  let claims;
  try {
    app();
    claims = await admin.auth().verifyIdToken(idToken);
  } catch (e) {
    return { statusCode: 401, body: "Login inválido ou expirado." };
  }
  if (!claims.orgId) return { statusCode: 403, body: "Esta conta ainda não está ligada a uma academia." };

  let corpo;
  try {
    corpo = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, body: "Corpo da requisição inválido." };
  }

  const { prompt, maxTokens, jobId } = corpo;
  if (!prompt || typeof prompt !== "string" || !jobId) {
    return { statusCode: 400, body: "Faltou prompt ou jobId." };
  }

  const ref = admin.firestore().collection("orgs").doc(claims.orgId).collection("iaJobs").doc(jobId);

  const chaveAnthropic = process.env.ANTHROPIC_API_KEY;
  if (!chaveAnthropic) {
    await ref.set({ status: "erro", erro: "O servidor ainda não tem a chave da Anthropic configurada.", criadoEm: new Date().toISOString() });
    return { statusCode: 202, body: "" };
  }

  const tokensMax = Math.min(Math.max(Number(maxTokens) || 4000, 1), 8000);

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
        max_tokens: tokensMax,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const dados = await r.json().catch(() => ({}));
    if (!r.ok) {
      await ref.set({
        status: "erro",
        erro: (dados && dados.error && dados.error.message) || ("Erro " + r.status),
        criadoEm: new Date().toISOString(),
      });
      return { statusCode: 202, body: "" };
    }
    const texto = (dados.content || []).filter((x) => x.type === "text").map((x) => x.text).join("\n");
    await ref.set({ status: "pronto", texto, criadoEm: new Date().toISOString() });
  } catch (e) {
    await ref.set({ status: "erro", erro: "Falha ao falar com a Anthropic: " + String(e.message || e), criadoEm: new Date().toISOString() });
  }

  return { statusCode: 202, body: "" };
};
