/* QuadraLab Player — aplica um evento de fatura (paga/revogada) à assinatura do jogador.

   Usado pelo webhook da Eduzz e, para quem pagou antes de criar a conta, ao entrar com o e-mail da compra.
   Cada fatura tem um estado e o instante do último evento aplicado: evento repetido não soma de novo,
   evento mais antigo que o já aplicado é ignorado, e no empate a revogação vence — por isso eventos
   atrasados ou fora de ordem deixam o mesmo resultado final. */
const ASS = require("./_player-assinaturas");

async function aplicarEventoFatura(db, ev, produto, instante) {
  const refFatura = db.collection("jogadoresFaturas").doc(ev.faturaId);
  const refJ = db.collection("jogadores").doc(ev.uid);
  await db.runTransaction(async (t) => {
    const [sF, sJ] = await Promise.all([t.get(refFatura), t.get(refJ)]);
    const fat = sF.exists ? sF.data() : null;
    if (fat && fat.instante > instante) return;                                    // evento atrasado: já há um mais novo
    if (fat && fat.instante === instante && fat.estado === "revogada" && ev.aprovado) return; // empate: revogação vence
    const jog = sJ.exists ? sJ.data() : {};
    const ass = { ...(jog.assinatura || {}) };
    const hoje = ASS.hojeISO();
    const prod = produto || ASS.produtoPorId(fat && fat.produtoId);
    const dias = (prod && prod.duracaoDias) || (fat && fat.dias) || 0;
    const antes = fat ? fat.estado : null;
    const novoEstado = ev.aprovado ? "paga" : ev.revogar ? "revogada" : (fat ? fat.estado : "pendente");
    let mudouAssinatura = false;

    if (ev.aprovado && antes !== "paga" && prod) {
      const base = ass.ativoAte && ass.ativoAte > hoje ? ass.ativoAte : hoje;
      Object.assign(ass, {
        produtoId: prod.id, nome: prod.nome, nivel: prod.nivel, periodicidade: prod.periodicidade, precoCentavos: prod.precoCentavos,
        cobrancaAutomatica: !!prod.cobrancaAutomatica, limites: prod.limites || null, status: "ativa",
        ativoAte: ASS.somarDias(base, dias), periodoInicio: hoje, uso: { estrategias: 0, programas: 0 }, ultimaFatura: ev.faturaId,
      });
      mudouAssinatura = true;
    } else if (ev.revogar && antes === "paga") {
      if (ass.ativoAte) ass.ativoAte = ASS.somarDias(ass.ativoAte, -dias);
      if (!ass.ativoAte || ass.ativoAte <= hoje) { ass.status = "encerrada"; ass.encerradaEm = new Date().toISOString(); }
      mudouAssinatura = true;
    } else if (ev.statusExtra && ass.status && ass.status !== "encerrada") {
      ass.status = ev.statusExtra;
      mudouAssinatura = true;
    }
    t.set(refFatura, { estado: novoEstado, instante, uid: ev.uid, email: ev.email, produtoId: prod ? prod.id : (fat && fat.produtoId) || null, dias, evento: ev.eventoBruto, atualizadoEm: new Date().toISOString() });
    if (mudouAssinatura) t.set(refJ, { assinatura: { ...ass, atualizadoEm: new Date().toISOString() } }, { merge: true });
  });
}

/* Quem pagou antes de ter conta: aplica as faturas guardadas para o e-mail (uma vez cada). */
async function aplicarPendentes(db, uid, email) {
  const snap = await db.collection("jogadoresAssinaturasPendentes").where("email", "==", String(email || "").toLowerCase()).get();
  const docs = [];
  snap.forEach((d) => docs.push(d));
  for (const d of docs) {
    const p = d.data();
    if (p.estado !== "paga") continue;
    const produto = ASS.produtoPorId(p.produtoId);
    if (!produto || !ASS.produtoCompleto(produto)) continue;
    await aplicarEventoFatura(db, { uid, email: p.email, faturaId: p.faturaId, aprovado: true, revogar: false, statusExtra: null, eventoBruto: "myeduzz.invoice_paid" }, produto, p.instante);
    await d.ref.delete();
  }
}

module.exports = { aplicarEventoFatura, aplicarPendentes };
