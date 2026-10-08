/* Busca vídeos no YouTube pra anexar a um exercício do catálogo — a
   chave da API mora só aqui no servidor (nunca no navegador). Devolve
   só os dados do resultado de busca (id, título, canal, miniatura),
   nunca anexa nada sozinho: o treinador escolhe qual vídeo serve antes
   de salvar no exercício, porque um resultado de busca pode vir
   irrelevante ou de baixa qualidade — isso vai direto pra aula de um
   aluno, não pode ser automático.

   Exige login (como gerar-ia-background) pra não deixar a cota da
   chave (gratuita, limitada por dia) ser gasta por quem não é
   treinador de uma academia daqui. */
const { admin, app } = require("./_firebase-admin");

function resposta(statusCode, corpo) {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) };
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });

  const cabecalho = event.headers.authorization || event.headers.Authorization || "";
  const idToken = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : null;
  if (!idToken) return resposta(401, { erro: "Entre com sua conta da academia para buscar vídeos." });

  let claims;
  try {
    app();
    claims = await admin.auth().verifyIdToken(idToken);
  } catch (e) {
    return resposta(401, { erro: "Login inválido ou expirado." });
  }
  if (!claims.orgId) return resposta(403, { erro: "Esta conta ainda não está ligada a uma academia." });

  let corpo;
  try {
    corpo = JSON.parse(event.body || "{}");
  } catch (e) {
    return resposta(400, { erro: "Corpo da requisição inválido." });
  }
  const consulta = (corpo.query || "").toString().trim().slice(0, 150);
  if (!consulta) return resposta(400, { erro: "Faltou o nome do exercício pra buscar." });

  const chaveYouTube = process.env.YOUTUBE_API_KEY;
  if (!chaveYouTube) return resposta(503, { erro: "O servidor ainda não tem a chave do YouTube configurada." });

  /* "tênis" entra sempre na busca — sem isso, o nome curto de um
     exercício (ex.: "Approach cruzado") acha vídeo de qualquer coisa,
     não de tênis. safeSearch e relevanceLanguage reduzem lixo óbvio. */
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "6",
    safeSearch: "moderate",
    relevanceLanguage: "pt",
    q: consulta + " tênis treino",
    key: chaveYouTube,
  });

  try {
    const r = await fetch("https://www.googleapis.com/youtube/v3/search?" + params.toString());
    const dados = await r.json().catch(() => ({}));
    if (!r.ok) {
      return resposta(502, { erro: (dados && dados.error && dados.error.message) || ("Erro " + r.status + " ao consultar o YouTube.") });
    }
    const resultados = (dados.items || [])
      .filter((item) => item.id && item.id.videoId)
      .map((item) => ({
        videoId: item.id.videoId,
        titulo: (item.snippet && item.snippet.title) || "",
        canal: (item.snippet && item.snippet.channelTitle) || "",
        miniatura: (item.snippet && item.snippet.thumbnails && (item.snippet.thumbnails.medium || item.snippet.thumbnails.default) || {}).url || "",
      }));
    return resposta(200, { resultados });
  } catch (e) {
    return resposta(500, { erro: "Falha ao falar com o YouTube: " + String(e.message || e) });
  }
};
