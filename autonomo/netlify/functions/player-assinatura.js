/* QuadraLab Player — "Minha assinatura": situação, consumo, assinaturas disponíveis, consultorias e links.

   Só leitura. Mostra o que está configurado em _player-assinaturas.js e o que o servidor gravou a partir
   do webhook da Eduzz — nada vem do navegador. A contratação em si acontece no checkout da Eduzz; o acesso
   só é liberado quando o webhook confirmar o pagamento. */
const { admin, ErroPublico, resposta, usuarioDoPedido, refJogador, resumoAssinatura } = require("./_player");
const ASS = require("./_player-assinaturas");
const { aplicarPendentes } = require("./_player-faturas");

exports.handler = async function (event) {
  if (event.httpMethod !== "GET") return resposta(405, { erro: "Método não permitido." });
  try {
    const usuario = await usuarioDoPedido(event);
    const ref = refJogador(usuario.uid);
    let snap = await ref.get();
    let dados = snap.exists ? snap.data() : {};
    if (!dados.assinatura && usuario.email) {
      try { await aplicarPendentes(admin.firestore(), usuario.uid, usuario.email); dados = (await ref.get()).data() || dados; }
      catch (e) { console.error("player-assinatura: falha ao aplicar assinatura pendente", e); }
    }
    return resposta(200, {
      assinatura: resumoAssinatura(dados, usuario.email),
      catalogo: ASS.catalogoPublico(),
      consultorias: ASS.consultoriasPublicas(),
      links: ASS.linksPublicos(),
      periodicidades: ASS.PERIODICIDADES,
    });
  } catch (e) {
    if (e instanceof ErroPublico) return resposta(e.status, { erro: e.message });
    console.error("player-assinatura:", e);
    return resposta(500, { erro: "Não foi possível carregar a sua assinatura agora. Tente de novo em instantes." });
  }
};
