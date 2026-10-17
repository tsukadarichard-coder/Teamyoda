/* QuadraLab Player — dados públicos da página de apresentação (sem login).

   Devolve só o que já é público no produto: as consultorias (preço de lançamento, prazo, entregas e limites) e os
   links de termos e privacidade, quando existirem. É a mesma fonte do app (_player-assinaturas.js), então a página
   pública e o app nunca divergem. Nada de conta, sessão ou dado pessoal. */
const ASS = require("./_player-assinaturas");

exports.handler = async function (event) {
  if (event.httpMethod !== "GET") return { statusCode: 405, body: "" };
  const links = ASS.linksPublicos();
  return {
    statusCode: 200,
    headers: { "content-type": "application/json", "cache-control": "public, max-age=300" },
    body: JSON.stringify({
      consultorias: ASS.consultoriasPublicas(),
      planos: ASS.planosPlayerPublicos(),
      linhasComparacao: ASS.linhasComparacaoPublicas(),
      politicas: ASS.politicasPublicas(),
      links: { termos: links.termos || null, privacidade: links.privacidade || null },
    }),
  };
};
