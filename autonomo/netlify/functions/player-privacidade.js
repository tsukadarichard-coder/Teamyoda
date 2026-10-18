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

const SUBCOLECOES = ["planos", "planejamentos", "partidas", "torneios", "preparos", "diario", "focos", "devolutivas", "scouts", "compPlanejamentos", "compCompromissos", "compExecucoes"];

exports.handler = async function (event) {
  try {
    const usuario = await usuarioDoPedido(event);
    const ref = refJogador(usuario.uid);

    if (event.httpMethod === "GET") {
      const sJ = await ref.get();
      const saida = { exportadoEm: new Date().toISOString(), conta: { email: usuario.email || null }, jogador: sJ.exists ? sJ.data() : null };
      for (const c of SUBCOLECOES) {
        const snap = await ref.collection(c).get();
        /* a origem dos scouts importados (token do link do treinador) é segredo do servidor: nunca sai, nem no download dos dados */
        saida[c] = []; snap.forEach((d) => { const { fonte, hash, ...resto } = d.data(); saida[c].push({ id: d.id, ...(c === "scouts" ? resto : d.data()) }); });
      }
      saida.pedidosConsultoria = [];
      for (const campo of ["atletaUid", "pagadorUid"]) {
        const snap = await admin.firestore().collection("pedidosConsultoria").where(campo, "==", usuario.uid).get();
        snap.forEach((d) => { if (!saida.pedidosConsultoria.some((x) => x.id === d.id)) saida.pedidosConsultoria.push({ id: d.id, ...d.data() }); });
      }
      saida.acompanhamentos = [];
      for (const campo of ["atletaUid", "pagadorUid", "profissionalUid"]) {
        const snap = await admin.firestore().collection("acompanhamentos").where(campo, "==", usuario.uid).get();
        for (const d of snap.docs) {
          if (saida.acompanhamentos.some((x) => x.id === d.id)) continue;
          const duv = []; (await d.ref.collection("duvidas").get()).forEach((q) => duv.push({ id: q.id, ...q.data() }));
          saida.acompanhamentos.push({ id: d.id, ...d.data(), duvidas: duv });
        }
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
      /* pedidos de consultoria: o que nunca foi pago é apagado; o que já foi pago fica só como registro financeiro (valor, estado, fatura, datas),
         sem o que o atleta compartilhou, sem a entrega e sem nomes: obrigação de retenção, como as faturas */
      const ped = admin.firestore().collection("pedidosConsultoria"), vistos = new Set();
      for (const campo of ["atletaUid", "pagadorUid"]) {
        for (const d of (await ped.where(campo, "==", usuario.uid).get()).docs) {
          if (vistos.has(d.id)) continue; vistos.add(d.id);
          const x = d.data();
          if (["pago", "em_andamento", "entregue", "reembolsado"].includes(x.estado)) {
            await d.ref.set({ consultoriaId: x.consultoriaId, precoCentavos: x.precoCentavos, estado: x.estado, faturaId: x.faturaId || null, pagoEm: x.pagoEm || null, criadoEm: x.criadoEm, anonimizadoEm: new Date().toISOString() });
          } else await d.ref.delete();
        }
      }
      /* Acompanhamento MTY: o que nunca teve pagamento confirmado é apagado; o que teve fica só como registro financeiro (valores, estados e datas),
         sem a síntese, os encontros, as dúvidas e os nomes. Se quem sai é o profissional, o acompanhamento segue sem o nome dele. */
      const acs = admin.firestore().collection("acompanhamentos"), vistosA = new Set();
      for (const campo of ["atletaUid", "pagadorUid"]) {
        for (const d of (await acs.where(campo, "==", usuario.uid).get()).docs) {
          if (vistosA.has(d.id)) continue; vistosA.add(d.id);
          const x = d.data();
          for (const q of await d.ref.collection("duvidas").listDocuments()) await q.delete();
          if ((x.parcelas || []).some((p) => p.estado === "pago")) {
            await d.ref.set({ produto: x.produto, parcelas: (x.parcelas || []).map((p) => ({ n: p.n, valorCentavos: p.valorCentavos, estado: p.estado, pagoEm: p.pagoEm || null })), estado: x.estado, criadoEm: x.criadoEm, anonimizadoEm: new Date().toISOString() });
          } else await d.ref.delete();
        }
      }
      for (const d of (await acs.where("profissionalUid", "==", usuario.uid).get()).docs) {
        if (!vistosA.has(d.id)) await d.ref.update({ profissionalUid: null, profissional: { uid: null, nome: "Profissional removido", vinculoId: null } });
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
