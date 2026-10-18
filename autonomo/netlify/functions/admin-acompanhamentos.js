/* Painel do consultor — Acompanhamento MTY (contratação, pagamentos e início do ciclo).

   Protegido pelo mesmo segredo de provisionar-org (cabeçalho x-admin-secret).

   GET                                       → acompanhamentos, com os treinadores vinculados ao atleta que podem conduzir o ciclo
   POST { acao: "pagamento", id, n, estado: "pago"|"pendente", confirmo: true }   → confirma (à mão) o recebimento de um dos 3 pagamentos
   POST { acao: "iniciar", id, vinculoId, inicio }  → define o profissional (vínculo ativo do atleta com a área "planejamento") e a data de início
   POST { acao: "cancelar", id, nota? }
   POST { acao: "nota", id, nota }

   O primeiro pagamento confirmado libera o início do ciclo. Nada é cobrado pelo aplicativo: aqui só se registra o que o consultor recebeu. */
const { admin, app } = require("./_firebase-admin");
const A = require("./_comp-acompanhamento");
const C = require("./_player-competicao");
const AUTH = require("./_admin-auth");

function resposta(statusCode, corpo) { return { statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(corpo) }; }
const agora = () => new Date().toISOString();
const hoje = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const limpo = (o) => JSON.parse(JSON.stringify(o));

exports.handler = async function (event) {
  if (!(await AUTH.autorizar(event))) return resposta(401, { erro: "Segredo de administrador ausente ou incorreto." });
  try {
    app();
    const db = admin.firestore(), col = db.collection("acompanhamentos");
    if (event.httpMethod === "GET") {
      const lista = [];
      for (const d of (await col.get()).docs) {
        const a = d.data();
        const item = { id: d.id, ...a, rotulo: A.ROTULO_ESTADO[a.estado] || a.estado };
        if (["aguardando_inicio", "aguardando_pagamento"].includes(a.estado)) {
          item.profissionaisPossiveis = (await db.collection("vinculos").where("atletaUid", "==", a.atletaUid).where("tipo", "==", "treinador").where("status", "==", "ativo").get()).docs
            .map((v) => ({ vinculoId: v.id, nome: v.data().pessoaNome || "Treinador", email: v.data().pessoaEmail || null, planejamento: C.areasValidas(v.data().areas).includes("planejamento") }));
        }
        lista.push(item);
      }
      lista.sort((x, y) => String(y.criadoEm).localeCompare(String(x.criadoEm)));
      return resposta(200, { acompanhamentos: lista });
    }
    if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });
    let body;
    try { body = JSON.parse(event.body || "{}"); } catch (e) { return resposta(400, { erro: "Pedido inválido." }); }
    if (!A.ID.test(String(body.id || ""))) return resposta(400, { erro: "Acompanhamento inválido." });
    const ref = col.doc(body.id), s = await ref.get();
    if (!s.exists) return resposta(404, { erro: "Acompanhamento não encontrado." });
    const a = s.data(), hist = (acao) => [...(a.historico || []).slice(-40), { em: agora(), por: "consultor", acao }];
    const nota = A.txt(body.nota, 500);

    if (body.acao === "pagamento") {
      const n = Number(body.n);
      if (!Number.isInteger(n) || n < 1 || n > A.PRODUTO.parcelas) return resposta(400, { erro: "Escolha o pagamento (1 a " + A.PRODUTO.parcelas + ")." });
      if (!["pago", "pendente"].includes(body.estado)) return resposta(400, { erro: "Estado inválido." });
      if (body.estado === "pago" && body.confirmo !== true) return resposta(400, { erro: "Confirme que recebeu o pagamento para marcá-lo como pago." });
      if (["cancelado", "aguardando_responsavel"].includes(a.estado)) return resposta(409, { erro: "Este pedido não está em fase de pagamento." });
      const parcelas = (a.parcelas || []).map((p) => (p.n === n ? { ...p, estado: body.estado, pagoEm: body.estado === "pago" ? agora() : null, confirmadoPor: body.estado === "pago" ? "consultor" : null } : p));
      let estado = a.estado;
      const primeira = parcelas.find((p) => p.n === 1);
      if (estado === "aguardando_pagamento" && primeira.estado === "pago") estado = "aguardando_inicio";
      else if (estado === "aguardando_inicio" && primeira.estado !== "pago") estado = "aguardando_pagamento";
      await ref.update(limpo({ parcelas, estado, historico: hist("pagamento " + n + ": " + body.estado + (nota ? " · " + nota : "")) }));
      return resposta(200, { ok: true });
    }
    if (body.acao === "iniciar") {
      if (a.estado !== "aguardando_inicio") return resposta(409, { erro: "O ciclo só começa depois do primeiro pagamento confirmado." });
      if (!A.dataValida(body.inicio) || body.inicio < A.addDias(hoje(), -7)) return resposta(400, { erro: "Informe a data de início (no máximo 7 dias no passado)." });
      const vs = await db.collection("vinculos").doc(String(body.vinculoId || "x")).get(), v = vs.exists ? vs.data() : null;
      if (!v || v.atletaUid !== a.atletaUid || v.tipo !== "treinador" || v.status !== "ativo" || !v.pessoaUid) return resposta(409, { erro: "Escolha um treinador com vínculo ativo com este atleta. Peça ao atleta para gerar um convite de treinador e ao profissional para usar o código." });
      if (!C.areasValidas(v.areas).includes("planejamento")) return resposta(409, { erro: "O atleta ainda não compartilhou a área “Meu planejamento” com este treinador. Peça para marcá-la no vínculo." });
      const ciclo = A.cicloDe(body.inicio);
      await ref.update(limpo({
        estado: "ativo", profissional: { uid: v.pessoaUid, nome: v.pessoaNome || "Profissional", vinculoId: body.vinculoId }, profissionalUid: v.pessoaUid,
        inicio: body.inicio, fim: ciclo.fim, encontros: A.encontrosIniciais(body.inicio), iniciadoEm: agora(), historico: hist("ciclo iniciado em " + body.inicio + " com " + (v.pessoaNome || "profissional")),
      }));
      return resposta(200, { ok: true, fim: ciclo.fim });
    }
    if (body.acao === "cancelar") {
      if (["encerrado", "cancelado"].includes(a.estado)) return resposta(409, { erro: "Este acompanhamento já foi encerrado." });
      await ref.update(limpo({ estado: "cancelado", canceladoEm: agora(), historico: hist("cancelado" + (nota ? " · " + nota : "")) }));
      return resposta(200, { ok: true });
    }
    if (body.acao === "nota") {
      if (!nota) return resposta(400, { erro: "Escreva a nota." });
      await ref.update(limpo({ historico: hist("nota · " + nota) }));
      return resposta(200, { ok: true });
    }
    return resposta(400, { erro: "Ação desconhecida." });
  } catch (e) {
    console.error("admin-acompanhamentos:", e && e.message);
    return resposta(500, { erro: "Não foi possível concluir agora." });
  }
};
