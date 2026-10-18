/* Link da família para o scout de UMA partida — leitura pública e limitada, sem login.

   GET ?org=…&id=…&j=…&t=…  →  o resumo que o treinador publicou para esta partida.

   Como a segurança funciona (mesmo desenho de ver-aluno.js):
   · o treinador gera o link no app: nasce um token aleatório guardado na própria partida (reg.compartilhado) com validade;
   · o que a família vê é um RESUMO montado pelo treinador no momento de gerar (reg.compartilhado.publico): primeiro nome do atleta,
     data, resultado, números, mapa, momento do jogo e leituras. Nunca o nome do adversário, anotações ou o caderno;
   · sem o token batendo, vencido ou revogado (o treinador apaga reg.compartilhado), a function devolve só "link inválido";
   · a resposta nunca é guardada em cache e os textos são limitados em tamanho antes de sair. */
const { lerResumoPublico } = require("./_scout-publico");

function resposta(statusCode, corpo) {
  return { statusCode, headers: { "content-type": "application/json", "cache-control": "no-store", "x-robots-tag": "noindex", "referrer-policy": "no-referrer" }, body: JSON.stringify(corpo) };
}

exports.handler = async function (event) {
  if (event.httpMethod !== "GET") return resposta(405, { erro: "Método não permitido." });
  const q = event.queryStringParameters || {};
  const { org, id, j, t } = q;
  const invalido = () => resposta(404, { erro: "Link inválido ou vencido. Peça um novo ao seu treinador." });
  if (!org || !id || !j || !t || String(t).length < 16) return invalido();
  try {
    const r = await lerResumoPublico({ org: String(org), id: String(id), j: String(j), t: String(t) });
    return r ? resposta(200, r) : invalido();
  } catch (e) {
    console.error("scout-publico:", e && e.message);
    return resposta(500, { erro: "Não foi possível abrir agora. Tente de novo em instantes." });
  }
};
