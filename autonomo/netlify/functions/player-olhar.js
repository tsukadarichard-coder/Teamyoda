/* QuadraLab Player — "Olhar do treinador": pedido, pagamento e entrega da devolutiva (lado do jogador).

   GET                         → produto (preço e limites), meus pedidos e as estratégias prontas que podem ser comentadas
   GET ?id={pedido}            → um pedido meu
   GET ?id={pedido}&arquivo=1  → URL assinada e curta da devolutiva (áudio ou vídeo), só para o dono do pedido já publicado
   POST { acao: "criar", estrategiaId, duvida, contexto?, aceite }  → cria (ou reaproveita) o pedido pendente; o valor NUNCA vem do navegador
   POST { acao: "pagar", id }  → devolve o link de pagamento (Eduzz); NUNCA marca como pago
   POST { acao: "cancelar", id } → cancela antes do pagamento

   Segurança:
   · só o dono do pedido o vê; pedido de outra pessoa responde "não encontrado";
   · só estratégias do próprio jogador podem ser escolhidas (lidas em jogadores/{uid}/planos);
   · "pago/recebido" só vem da Eduzz (webhook-eduzz.js → _player-olhar.js); nada aqui altera o pagamento;
   · a devolutiva só é liberada com pagamento aprovado e depois de publicada pelo Richard; não exige assinatura paga ativa. */
const { admin, ErroPublico, resposta, usuarioDoPedido, refJogador } = require("./_player");
const O = require("./_player-olhar");
const ARQ = require("./_olhar-armazenamento");

const db = () => admin.firestore();
const agora = () => new Date().toISOString();
const hist = (p, por, acao) => [...(p.historico || []).slice(-40), { em: agora(), por, acao }];

async function estrategiasProntas(uid) {
  const out = [];
  (await refJogador(uid).collection("planos").get()).forEach((d) => { const p = d.data(); if (p.status === "pronto" && p.plano) out.push(O.previaEstrategia(d.id, p)); });
  return out.sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm))).slice(0, 20);
}

async function pedidoDoDono(id, uid) {
  if (!O.ID.test(String(id || ""))) throw new ErroPublico(400, "Pedido inválido.");
  const ref = db().collection("olharPedidos").doc(id), s = await ref.get();
  if (!s.exists || s.data().uid !== uid) throw new ErroPublico(404, "Pedido não encontrado.");
  return { ref, p: s.data() };
}

exports.handler = async function (event) {
  try {
    const usuario = await usuarioDoPedido(event), uid = usuario.uid;
    const email = String(usuario.email || "").trim().toLowerCase();

    if (event.httpMethod === "GET") {
      const q = event.queryStringParameters || {};
      if (q.id) {
        const { ref, p } = await pedidoDoDono(q.id, uid);
        if (!q.arquivo) return resposta(200, { pedido: O.publicoPedido(q.id, p) });
        const d = p.devolutiva || {};
        if (!(p.pagamento && p.pagamento.estado === "aprovado") || p.estado !== "devolutiva_disponivel" || !d.publicadaEm || !d.arquivo) throw new ErroPublico(404, "A devolutiva ainda não está disponível.");
        let r;
        try { r = await ARQ.urlParaLeitura(d.arquivo.caminho, d.arquivo.contentType); }
        catch (e) { console.error("player-olhar arquivo:", e && e.message); throw new ErroPublico(503, "Não foi possível abrir o arquivo agora. Tente de novo em instantes ou fale com o suporte."); }
        if (!p.acessadaEm) await ref.update({ acessadaEm: agora(), historico: hist(p, "jogador", "abriu a devolutiva") });
        return resposta(200, { url: r.url, tipo: d.tipo, expiraEm: r.expiraEm });
      }
      const pedidos = [];
      (await db().collection("olharPedidos").where("uid", "==", uid).get()).forEach((s) => pedidos.push(O.publicoPedido(s.id, s.data())));
      pedidos.sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));
      return resposta(200, { produto: O.produtoPublico(), pedidos, estrategias: await estrategiasProntas(uid), email });
    }
    if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });
    let body;
    try { body = JSON.parse(event.body || "{}"); } catch (e) { throw new ErroPublico(400, "Pedido inválido."); }

    if (body.acao === "criar") {
      const r = O.validarSolicitacao(body);
      if (!r.ok) throw new ErroPublico(400, r.erro);
      const sp = await refJogador(uid).collection("planos").doc(r.dados.estrategiaId).get();
      if (!sp.exists || sp.data().status !== "pronto" || !sp.data().plano) throw new ErroPublico(404, "Estratégia não encontrada.");
      const previa = O.previaEstrategia(sp.id, sp.data());
      const meus = (await db().collection("olharPedidos").where("uid", "==", uid).get()).docs;
      const pendentes = meus.filter((d) => d.data().estado === "aguardando_pagamento");
      /* mesmo jogador, mesma estratégia, ainda sem pagar: reaproveita o pedido (e atualiza o texto), sem duplicar */
      const igual = pendentes.find((d) => d.data().estrategia && d.data().estrategia.id === previa.id);
      if (igual) {
        const p = igual.data();
        await igual.ref.update({ duvida: r.dados.duvida, contexto: r.dados.contexto, estrategia: previa, aceite: { em: agora(), texto: ACEITE }, historico: hist(p, "jogador", "pedido atualizado antes do pagamento") });
        return resposta(200, { ok: true, id: igual.id, reutilizado: true });
      }
      if (pendentes.length >= O.PRODUTO.maxPendentes) throw new ErroPublico(409, "Você já tem " + O.PRODUTO.maxPendentes + " pedidos aguardando pagamento. Conclua ou cancele algum antes de criar outro.");
      const jog = (await refJogador(uid).get()).data() || {};
      const novo = {
        uid, email, pagadorEmail: email, nome: jog.nome || usuario.name || "Jogador", produtoId: O.PRODUTO.id, produtoNome: O.PRODUTO.nome,
        precoCentavos: O.PRODUTO.precoCentavos, moeda: O.PRODUTO.moeda, estado: "aguardando_pagamento", pagamento: { estado: "pendente" },
        estrategia: previa, duvida: r.dados.duvida, contexto: r.dados.contexto, aceite: { em: agora(), texto: ACEITE }, numero: O.novoNumero(), criadoEm: agora(),
      };
      novo.historico = hist(novo, "jogador", "pedido criado, aguardando pagamento");
      const ref = await db().collection("olharPedidos").add(novo);
      return resposta(200, { ok: true, id: ref.id });
    }

    const { ref, p } = await pedidoDoDono(body.id, uid);
    if (body.acao === "cancelar") {
      if (p.estado !== "aguardando_pagamento") throw new ErroPublico(409, "Depois do pagamento, o cancelamento passa pelo suporte.");
      await ref.update({ estado: "cancelado", canceladoEm: agora(), historico: hist(p, "jogador", "cancelado antes do pagamento") });
      return resposta(200, { ok: true });
    }
    if (body.acao === "pagar") {
      if (p.estado !== "aguardando_pagamento") throw new ErroPublico(409, "Este pedido não está aguardando pagamento.");
      const ck = O.checkoutOlhar();
      if (!ck) {
        /* sem checkout configurado: nada é simulado; o administrador vê a pendência no Painel */
        try { await db().collection("olharPendencias").doc("checkout-nao-configurado").set({ ultimaTentativaEm: agora(), ultimoPedido: body.id, motivo: "O produto Olhar do treinador ainda não tem productId e link de checkout da Eduzz em _player-olhar.js." }); } catch (e) { /* o aviso ao jogador segue */ }
        throw new ErroPublico(503, "O pagamento deste atendimento está indisponível no momento. Já avisamos o administrador. Seu pedido está salvo e você pode voltar depois.");
      }
      await ref.update({ pagamentoIniciadoEm: agora(), pagamento: { ...(p.pagamento || {}), estado: "pendente" }, historico: hist(p, "jogador", "abriu o pagamento") });
      return resposta(200, { ok: true, checkoutUrl: ck.checkoutUrl, aviso: "Use o mesmo e-mail da sua conta (" + (p.pagadorEmail || email) + ") na compra, para o pagamento ser reconhecido sozinho." });
    }
    throw new ErroPublico(400, "Ação desconhecida.");
  } catch (e) {
    if (e instanceof ErroPublico) return resposta(e.status, { erro: e.message });
    console.error("player-olhar:", e && e.message);
    return resposta(500, { erro: "Não foi possível concluir agora. Tente de novo em instantes." });
  }
};

const ACEITE = "Entendi que este atendimento contempla uma dúvida e uma devolutiva gravada, sem encontro ao vivo ou análise de partidas em vídeo.";
