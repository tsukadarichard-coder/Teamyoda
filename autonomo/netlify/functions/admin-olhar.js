/* Painel do Richard — fila e entrega do "Olhar do treinador".

   Protegido pelo mesmo segredo/sessão do Painel (x-admin-secret ou cookie de sessão). Só o administrador alcança esta function.

   GET [?estado=…]            → fila (pedidos com pagamento confirmado, mais pagamentos da Eduzz sem pedido e pendências de configuração)
   GET ?id={pedido}           → pedido completo: ficha e estratégia copiadas na contratação, dúvida, contexto, rascunho da devolutiva
   POST { acao: "iniciar", id }                              → recebido → em_analise
   POST { acao: "urlEnvio", id, contentType, tamanho }       → URL assinada para o navegador enviar o áudio/vídeo direto ao armazenamento privado
   POST { acao: "registrarArquivo", id, caminho, duracaoSeg } → confere o arquivo no armazenamento e o guarda no rascunho
   POST { acao: "salvarRascunho", id, resumo }               → resumo escrito (opcional)
   POST { acao: "removerArquivo", id }                        → descarta o arquivo do rascunho
   POST { acao: "publicar", id, confirmo: true, confirmoForaDoPadrao? } → libera a devolutiva ao jogador (nunca automático)
   POST { acao: "vincularPagamento", faturaId, pedidoId }     → casa à mão um pagamento da Eduzz que não achou o pedido
   POST { acao: "prepararArmazenamento" }                     → libera o CORS do bucket para o envio pelo Painel

   Regras: a devolutiva só vai ao jogador com pagamento aprovado, arquivo conferido (e igual ao conferido no envio) e confirmação de quem publica.
   Nada é gerado nem publicado automaticamente em nome do Richard. */
const { admin, app } = require("./_firebase-admin");
const O = require("./_player-olhar");
const ARQ = require("./_olhar-armazenamento");
const A = require("./_admin-auth");

function resposta(statusCode, corpo) {
  return { statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(corpo) };
}
const agora = () => new Date().toISOString();
const hist = (p, acao) => [...(p.historico || []).slice(-40), { em: agora(), por: "richard", acao }];
const PAGOS = ["recebido", "em_analise", "devolutiva_disponivel", "reembolsado"];
const pago = (p) => !!(p.pagamento && p.pagamento.estado === "aprovado");

function linhaDaFila(id, p, hoje) {
  const aberto = p.estado === "recebido" || p.estado === "em_analise";
  return {
    id, numero: p.numero, nome: p.nome, email: p.email, estado: p.estado, rotulo: O.ROTULO_ESTADO[p.estado] || p.estado,
    pagamento: (p.pagamento && p.pagamento.estado) || "pendente", pagamentoRotulo: O.ROTULO_PAGAMENTO[(p.pagamento && p.pagamento.estado) || "pendente"],
    confirmadoEm: p.confirmadoEm || null, prazoEm: p.prazoEm || null, atrasado: aberto && !!p.prazoEm && p.prazoEm < hoje,
    diasParaPrazo: aberto && p.prazoEm ? Math.round((Date.parse(p.prazoEm + "T12:00:00Z") - Date.parse(hoje + "T12:00:00Z")) / 86400000) : null,
    estrategia: p.estrategia ? p.estrategia.titulo : "", duvida: String(p.duvida || "").slice(0, 140), temRascunho: !!(p.rascunhoDevolutiva && p.rascunhoDevolutiva.arquivo),
  };
}

exports.handler = async function (event) {
  if (!(await A.autorizar(event))) return resposta(401, { erro: "Segredo de administrador ausente ou incorreto." });
  try {
    app();
    const db = admin.firestore(), hoje = O.hojeSP();
    if (event.httpMethod === "GET") {
      const q = event.queryStringParameters || {};
      if (q.id) {
        if (!O.ID.test(q.id)) return resposta(400, { erro: "Pedido inválido." });
        const s = await db.collection("olharPedidos").doc(q.id).get();
        if (!s.exists) return resposta(404, { erro: "Pedido não encontrado." });
        const p = s.data(), out = { id: s.id, ...linhaDaFila(s.id, p, hoje), duvida: p.duvida, contexto: p.contexto || "", snapshot: p.snapshot || null, estrategiaPrevia: p.estrategia || null,
          rascunho: null, devolutiva: null, historico: (p.historico || []).slice(-12).reverse(), limites: ARQ.limites(), padrao: { minSeg: O.PRODUTO.duracaoMinSeg, maxSeg: O.PRODUTO.duracaoMaxSeg } };
        const meta = (d) => (d.arquivo ? { tipo: d.arquivo.tipo, tamanho: d.arquivo.tamanho, duracaoSeg: d.duracaoSeg || null } : {});
        const comUrl = async (d, extra) => {
          const base = { ...meta(d), resumo: d.resumo || "", ...extra };
          if (!d.arquivo) return base;
          try { const u = await ARQ.urlParaLeitura(d.arquivo.caminho, d.arquivo.contentType); return { ...base, url: u.url }; }
          catch (e) { return { ...base, erroArquivo: "Não foi possível abrir o arquivo no armazenamento." }; }
        };
        out.rascunho = p.rascunhoDevolutiva ? await comUrl(p.rascunhoDevolutiva, {}) : null;
        out.devolutiva = p.devolutiva ? await comUrl(p.devolutiva, { publicadaEm: p.devolutiva.publicadaEm, vista: !!p.acessadaEm }) : null;
        return resposta(200, out);
      }
      const filtro = q.estado || "";
      const fila = [];
      (await db.collection("olharPedidos").get()).forEach((d) => {
        const p = d.data();
        if (!PAGOS.includes(p.estado)) return;
        if (!filtro || p.estado === filtro) fila.push(linhaDaFila(d.id, p, hoje));
      });
      /* abertos primeiro (atrasados, depois prazo mais próximo); entregues e reembolsados no fim */
      const peso = (x) => (x.estado === "recebido" || x.estado === "em_analise" ? 0 : 1);
      fila.sort((a, b) => peso(a) - peso(b) || (b.atrasado - a.atrasado) || String(a.prazoEm || "9999").localeCompare(String(b.prazoEm || "9999")));
      const sem = []; (await db.collection("olharPagamentosSemPedido").get()).forEach((d) => sem.push({ id: d.id, ...d.data() }));
      const pend = []; (await db.collection("olharPendencias").get()).forEach((d) => pend.push({ id: d.id, ...d.data() }));
      const aguardando = []; (await db.collection("olharPedidos").where("estado", "==", "aguardando_pagamento").get()).forEach((d) => aguardando.push({ id: d.id, numero: d.data().numero, email: d.data().email }));
      return resposta(200, { fila, pagamentosSemPedido: sem, pendencias: pend, aguardandoPagamento: aguardando, produto: O.produtoPublico(), limites: ARQ.limites(), hoje });
    }
    if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });
    let body;
    try { body = JSON.parse(event.body || "{}"); } catch (e) { return resposta(400, { erro: "Pedido inválido." }); }

    if (body.acao === "prepararArmazenamento") {
      const orig = String((event.headers || {}).origin || (event.headers || {}).Origin || "");
      const origens = [...new Set([/^https:\/\/[a-z0-9.-]+$/i.test(orig) ? orig : null, "https://quadralab.com.br", "https://app.39tennis.com.br"].filter(Boolean))];
      try { const nome = await ARQ.prepararCors(origens); return resposta(200, { ok: true, bucket: nome, origens }); }
      catch (e) { return resposta(503, { erro: "Não foi possível preparar o armazenamento: " + String(e.message || e).slice(0, 200) }); }
    }
    if (body.acao === "vincularPagamento") {
      const refPg = db.collection("olharPagamentosSemPedido").doc(String(body.faturaId || "")), pg = await refPg.get();
      if (!pg.exists || !O.ID.test(String(body.pedidoId || ""))) return resposta(404, { erro: "Pagamento ou pedido não encontrado." });
      const rp = db.collection("olharPedidos").doc(body.pedidoId), ped = await rp.get();
      if (!ped.exists || ped.data().estado !== "aguardando_pagamento") return resposta(409, { erro: "O pedido precisa estar aguardando pagamento." });
      await O.confirmarPagamento(db, rp, ped.data(), pg.data().faturaId, agora(), "eduzz-manual");
      await refPg.delete();
      return resposta(200, { ok: true });
    }

    if (!O.ID.test(String(body.id || ""))) return resposta(400, { erro: "Pedido inválido." });
    const ref = db.collection("olharPedidos").doc(body.id), s = await ref.get();
    if (!s.exists) return resposta(404, { erro: "Pedido não encontrado." });
    const p = s.data();
    if (!pago(p)) return resposta(409, { erro: "Este pedido não tem pagamento confirmado." });
    if (!["recebido", "em_analise"].includes(p.estado)) return resposta(409, { erro: "Este pedido não está em atendimento (" + (O.ROTULO_ESTADO[p.estado] || p.estado) + ")." });

    if (body.acao === "iniciar") {
      if (p.estado === "recebido") await ref.update({ estado: "em_analise", analiseIniciadaEm: agora(), historico: hist(p, "análise iniciada") });
      return resposta(200, { ok: true });
    }
    if (body.acao === "urlEnvio") {
      let r;
      try { r = await ARQ.urlParaEnvio(body.id, body.contentType, body.tamanho); }
      catch (e) { return resposta(503, { erro: "Armazenamento indisponível: " + String(e.message || e).slice(0, 200) }); }
      if (!r.ok) return resposta(400, { erro: r.erro });
      return resposta(200, r);
    }
    if (body.acao === "registrarArquivo") {
      const duracao = Math.round(Number(body.duracaoSeg));
      if (!Number.isFinite(duracao) || duracao < 1 || duracao > 3600) return resposta(400, { erro: "Duração do arquivo inválida." });
      let c;
      try { c = await ARQ.conferirArquivo(String(body.caminho || ""), body.id); }
      catch (e) { return resposta(503, { erro: "Armazenamento indisponível: " + String(e.message || e).slice(0, 200) }); }
      if (!c.ok) return resposta(400, { erro: c.erro });
      const ant = p.rascunhoDevolutiva && p.rascunhoDevolutiva.arquivo;
      if (ant && ant.caminho !== body.caminho) await ARQ.removerArquivo(ant.caminho);
      const rasc = { arquivo: { caminho: body.caminho, pedidoId: body.id, tipo: c.tipo, contentType: c.contentType, tamanho: c.tamanho, md5: c.md5, geracao: c.geracao },
        duracaoSeg: duracao, resumo: (p.rascunhoDevolutiva && p.rascunhoDevolutiva.resumo) || "", atualizadoEm: agora() };
      await ref.update({ rascunhoDevolutiva: rasc, ...(p.estado === "recebido" ? { estado: "em_analise", analiseIniciadaEm: agora() } : {}), historico: hist(p, "arquivo anexado ao rascunho") });
      return resposta(200, { ok: true, tipo: c.tipo, tamanho: c.tamanho, foraDoPadrao: duracao < O.PRODUTO.duracaoMinSeg || duracao > O.PRODUTO.duracaoMaxSeg });
    }
    if (body.acao === "removerArquivo") {
      const ant = p.rascunhoDevolutiva && p.rascunhoDevolutiva.arquivo;
      if (ant) await ARQ.removerArquivo(ant.caminho);
      await ref.update({ rascunhoDevolutiva: { resumo: (p.rascunhoDevolutiva && p.rascunhoDevolutiva.resumo) || "", atualizadoEm: agora() }, historico: hist(p, "arquivo removido do rascunho") });
      return resposta(200, { ok: true });
    }
    if (body.acao === "salvarRascunho") {
      const resumo = O.txt(body.resumo, 1200);
      await ref.update({ rascunhoDevolutiva: { ...(p.rascunhoDevolutiva || {}), resumo, atualizadoEm: agora() }, ...(p.estado === "recebido" ? { estado: "em_analise", analiseIniciadaEm: agora() } : {}), historico: hist(p, "rascunho salvo") });
      return resposta(200, { ok: true });
    }
    if (body.acao === "publicar") {
      if (body.confirmo !== true) return resposta(400, { erro: "Confirme a publicação para liberar a devolutiva ao jogador." });
      const r = p.rascunhoDevolutiva;
      if (!r || !r.arquivo) return resposta(400, { erro: "Anexe o áudio ou o vídeo antes de publicar." });
      const fora = r.duracaoSeg < O.PRODUTO.duracaoMinSeg || r.duracaoSeg > O.PRODUTO.duracaoMaxSeg;
      if (fora && body.confirmoForaDoPadrao !== true) return resposta(409, { erro: "O arquivo tem " + Math.floor(r.duracaoSeg / 60) + " min " + (r.duracaoSeg % 60) + " s, fora da proposta de 3 a 5 minutos. Confirme para publicar assim mesmo.", foraDoPadrao: true });
      let igual = false;
      try { igual = await ARQ.mesmoArquivo(r.arquivo); } catch (e) { return resposta(503, { erro: "Armazenamento indisponível para conferir o arquivo: " + String(e.message || e).slice(0, 200) }); }
      if (!igual) return resposta(409, { erro: "O arquivo no armazenamento não confere com o que foi enviado. Envie de novo." });
      const publicadaEm = agora();
      await ref.update({
        estado: "devolutiva_disponivel", entregueEm: publicadaEm, rascunhoDevolutiva: null,
        devolutiva: { tipo: r.arquivo.tipo, arquivo: r.arquivo, duracaoSeg: r.duracaoSeg, resumo: r.resumo || "", publicadaEm },
        notificacoes: [...(p.notificacoes || []), { tipo: "devolutiva_publicada", em: publicadaEm, app: true, email: "indisponivel" }],
        historico: hist(p, "devolutiva publicada" + (fora ? " (fora de 3 a 5 min, confirmado)" : "")),
      });
      return resposta(200, { ok: true });
    }
    return resposta(400, { erro: "Ação desconhecida." });
  } catch (e) {
    console.error("admin-olhar:", e && e.message);
    return resposta(500, { erro: "Não foi possível concluir agora." });
  }
};
