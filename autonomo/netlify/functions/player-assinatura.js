/* QuadraLab Player — "Minha assinatura": situação, consumo, assinaturas disponíveis, consultorias e links.

   Só leitura. Mostra o que está configurado em _player-assinaturas.js e o que o servidor gravou a partir
   do webhook da Eduzz — nada vem do navegador. A contratação em si acontece no checkout da Eduzz; o acesso
   só é liberado quando o webhook confirmar o pagamento. */
const { admin, ErroPublico, resposta, usuarioDoPedido, refJogador, resumoAssinatura, nivelDoJogador, planoFull } = require("./_player");
const COTAS = require("./_player-cotas");
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
    /* uso do plano (gerações do ciclo, adversários, programas ativos): só leitura; o app só mostra com a chave ligada */
    let usoPlanos = null;
    try {
      const hoje = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
      const todos = await ref.collection("planejamentos").get();
      const lista = []; todos.forEach((d) => lista.push(d.data()));
      const planoId = COTAS.planoIdDoNivel(nivelDoJogador(dados, usuario.email, hoje), planoFull(usuario.email));
      usoPlanos = COTAS.resumoUso(dados, { planoId, hoje, programasAtivos: COTAS.contarProgramasAtivos(lista, hoje) });
    } catch (e) { console.error("player-assinatura: falha ao resumir o uso", e); }
    return resposta(200, {
      usoPlanos,
      assinatura: resumoAssinatura(dados, usuario.email),
      catalogo: ASS.catalogoPublico(),
      consultorias: ASS.consultoriasPublicas(),
      planos: ASS.planosPlayerPublicos(),
      linhasComparacao: ASS.linhasComparacaoPublicas(),
      politicas: ASS.politicasPublicas(),
      contatoWhatsapp: ASS.WHATSAPP,
      links: ASS.linksPublicos(),
      periodicidades: ASS.PERIODICIDADES,
    });
  } catch (e) {
    if (e instanceof ErroPublico) return resposta(e.status, { erro: e.message });
    console.error("player-assinatura:", e);
    return resposta(500, { erro: "Não foi possível carregar a sua assinatura agora. Tente de novo em instantes." });
  }
};
