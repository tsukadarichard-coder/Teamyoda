/* QuadraLab Player — privacidade (LGPD): baixar os próprios dados e excluir a conta.

   GET   → todos os dados do jogador logado, em JSON (perfil, ficha, estratégias, programas, partidas, adversários).
   POST { acao: "excluirConta", confirmar: "<e-mail da conta>" } → apaga os dados do jogador. Só mexe na conta logada.

   Salvaguardas:
   · a exclusão exige digitar o e-mail da conta e é recusada enquanto houver assinatura vigente (cancelar antes, na Eduzz),
     para ninguém perder um acesso pago por engano;
   · o login (Firebase Auth) só é apagado se a conta for exclusivamente de jogador (claim tipo "jogador", sem orgId). Uma
     conta que também é de treinador (mesmo e-mail) perde só os dados do Player e continua entrando no QuadraLab;
   · registros financeiros da Eduzz (faturas e eventos processados) ficam guardados: são obrigação de retenção, não dado de uso. */
const { admin, ErroPublico, resposta, usuarioDoPedido, refJogador } = require("./_player");
const ASS = require("./_player-assinaturas");

const SUBCOLECOES = ["planos", "planejamentos", "partidas", "torneios", "preparos", "diario", "focos", "devolutivas"];

exports.handler = async function (event) {
  try {
    const usuario = await usuarioDoPedido(event);
    const ref = refJogador(usuario.uid);

    if (event.httpMethod === "GET") {
      const sJ = await ref.get();
      const saida = { exportadoEm: new Date().toISOString(), conta: { email: usuario.email || null }, jogador: sJ.exists ? sJ.data() : null };
      for (const c of SUBCOLECOES) {
        const snap = await ref.collection(c).get();
        saida[c] = []; snap.forEach((d) => saida[c].push({ id: d.id, ...d.data() }));
      }
      saida.vinculos = [];
      for (const campo of ["atletaUid", "pessoaUid"]) {
        const snap = await admin.firestore().collection("vinculos").where(campo, "==", usuario.uid).get();
        snap.forEach((d) => { const { codigo, ...resto } = d.data(); saida.vinculos.push({ id: d.id, ...resto }); });
      }
      return {
        statusCode: 200,
        headers: { "content-type": "application/json; charset=utf-8", "content-disposition": 'attachment; filename="meus-dados-quadralab-player.json"', "cache-control": "no-store" },
        body: JSON.stringify(saida, null, 2),
      };
    }

    if (event.httpMethod === "POST") {
      let body;
      try { body = JSON.parse(event.body || "{}"); } catch (e) { throw new ErroPublico(400, "Pedido inválido."); }
      if (body.acao !== "excluirConta") throw new ErroPublico(400, "Ação desconhecida.");
      const email = String(usuario.email || "").trim().toLowerCase();
      if (!email || String(body.confirmar || "").trim().toLowerCase() !== email) throw new ErroPublico(400, "Digite o e-mail da conta para confirmar a exclusão.");
      const dados = (await ref.get()).data() || {};
      if (ASS.assinaturaVigente(dados.assinatura)) {
        throw new ErroPublico(409, "Você tem uma assinatura vigente. Cancele a assinatura na Eduzz antes de excluir a conta, para não perder o acesso pago.");
      }
      for (const c of SUBCOLECOES) {
        const docs = await ref.collection(c).listDocuments();
        for (const d of docs) await d.delete();
      }
      /* vínculos da Competição: os do atleta saem junto com ele; os de quem era a pessoa vinculada ficam encerrados */
      const vinc = admin.firestore().collection("vinculos");
      for (const d of (await vinc.where("atletaUid", "==", usuario.uid).get()).docs) await d.ref.delete();
      for (const d of (await vinc.where("pessoaUid", "==", usuario.uid).get()).docs) await d.ref.update({ status: "revogado", encerradoEm: new Date().toISOString(), encerradoPor: usuario.uid, pessoaEmail: null, pessoaNome: null });
      await ref.delete();
      const soJogador = usuario.tipo === "jogador" && !usuario.orgId;
      if (soJogador) await admin.auth().deleteUser(usuario.uid);
      return resposta(200, { ok: true, contaRemovida: soJogador });
    }

    return resposta(405, { erro: "Método não permitido." });
  } catch (e) {
    if (e instanceof ErroPublico) return resposta(e.status, { erro: e.message });
    console.error("player-privacidade:", e);
    return resposta(500, { erro: "Não foi possível concluir agora. Tente de novo em instantes." });
  }
};
