/* Painel do administrador — Consultoria com Richard Tsukada: ativação manual (sem preço, checkout nem cobrança).

   Protegido como as outras functions admin-* (x-admin-secret ou sessão do painel).
   GET                                                  → todas as consultorias, com estado, ciclo atual e histórico de ciclos
   POST { acao: "ativar", email, inicio, fim? }         → abre a consultoria de um atleta do Competição (a partir de 15 anos); ciclo de 90 dias por padrão
   POST { acao: "renovar", id, inicio, fim? }           → novo ciclo, guardando os anteriores (o histórico do atleta não muda)
   POST { acao: "estado", id, estado, nota? }           → ativa · pausada · encerrada (encerrada: a equipe continua lendo o histórico; não entram registros novos)

   Nada aqui altera planos, assinaturas ou pagamentos existentes. */
const { admin, app } = require("./_firebase-admin");
const R = require("./_consultoria-rt");
const C = require("./_player-competicao");
const AUTH = require("./_admin-auth");

function resposta(statusCode, corpo) { return { statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(corpo) }; }
const agora = () => new Date().toISOString();
const hoje = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const limpo = (o) => JSON.parse(JSON.stringify(o));

function periodo(b) {
  if (!R.dataValida(b.inicio)) return { erro: "Informe a data de início." };
  const fim = b.fim ? b.fim : R.addDias(b.inicio, R.DIAS_CICLO - 1);
  if (!R.dataValida(fim) || fim < b.inicio) return { erro: "A data de término não pode ser antes do início." };
  if (R.diasEntre(b.inicio, fim) > 400) return { erro: "Ciclo longo demais." };
  return { inicio: b.inicio, fim };
}

exports.handler = async function (event) {
  if (!(await AUTH.autorizar(event))) return resposta(401, { erro: "Segredo de administrador ausente ou incorreto." });
  try {
    app();
    const db = admin.firestore(), col = db.collection("consultoriasRT");
    if (event.httpMethod === "GET") {
      const lista = (await col.get()).docs.map((d) => { const c = d.data(); return { id: d.id, atleta: c.atletaNome, email: c.atletaEmail || null, estado: c.estado, rotuloEstado: R.ESTADOS[c.estado], ciclo: R.cicloAtual(c), ciclos: c.ciclos || [], criadoEm: c.criadoEm, atualizadoEm: c.atualizadoEm || c.criadoEm, historico: (c.historico || []).slice(-10).reverse() }; });
      lista.sort((a, b) => (a.estado === "ativa" ? 0 : 1) - (b.estado === "ativa" ? 0 : 1) || String(b.atualizadoEm).localeCompare(String(a.atualizadoEm)));
      return resposta(200, { consultorias: lista, servico: R.NOME_SERVICO, diasCiclo: R.DIAS_CICLO, idadeMinima: R.IDADE_MINIMA });
    }
    if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });
    let b; try { b = JSON.parse(event.body || "{}"); } catch (e) { return resposta(400, { erro: "Pedido inválido." }); }

    if (b.acao === "ativar") {
      const email = String(b.email || "").trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return resposta(400, { erro: "Informe o e-mail da conta do atleta." });
      let u; try { u = await admin.auth().getUserByEmail(email); } catch (e) { return resposta(404, { erro: "Não há conta com este e-mail. O atleta precisa criar a conta no QuadraLab Competição." }); }
      const js = await db.collection("jogadores").doc(u.uid).get(), j = js.exists ? js.data() : {}, comp = j.competicao || {};
      if (comp.papel !== "atleta") return resposta(409, { erro: "Esta conta não está ativa como atleta no Competição. Peça para o atleta escolher o papel “atleta” no app." });
      const idade = C.idadeEm(comp.nascimento, hoje());
      if (idade === null || idade < R.IDADE_MINIMA) return resposta(409, { erro: "A consultoria é para atletas a partir de " + R.IDADE_MINIMA + " anos (pela data de nascimento cadastrada)." });
      if (!(await col.where("atletaUid", "==", u.uid).get()).docs.every((d) => d.data().estado === "encerrada")) return resposta(409, { erro: "Este atleta já tem uma consultoria em aberto. Renove o ciclo nela." });
      const p = periodo(b); if (p.erro) return resposta(400, { erro: p.erro });
      const c = { atletaUid: u.uid, atletaNome: j.nome || u.displayName || "Atleta", atletaEmail: email, estado: "ativa", ciclos: [{ n: 1, inicio: p.inicio, fim: p.fim, criadoEm: agora() }],
        entrada: {}, diagPartidas: R.partidasIniciais(), equipe: [], equipeRemovidos: [], reunioes: [], acoesStatus: {}, criadoEm: agora(), atualizadoEm: agora(),
        historico: [{ em: agora(), por: "administrador", acao: "consultoria ativada · ciclo " + p.inicio + " a " + p.fim }] };
      const ref = await col.add(limpo(c));
      return resposta(200, { ok: true, id: ref.id, ciclo: c.ciclos[0] });
    }

    if (!/^[A-Za-z0-9_-]{8,40}$/.test(String(b.id || ""))) return resposta(400, { erro: "Consultoria inválida." });
    const ref = col.doc(b.id), s = await ref.get(); if (!s.exists) return resposta(404, { erro: "Consultoria não encontrada." });
    const c = s.data(), hist = (acao) => [...(c.historico || []).slice(-80), { em: agora(), por: "administrador", acao }];

    if (b.acao === "renovar") {
      const p = periodo(b); if (p.erro) return resposta(400, { erro: p.erro });
      const ult = R.cicloAtual(c); if (ult && p.inicio <= ult.inicio) return resposta(400, { erro: "O novo ciclo precisa começar depois do início do ciclo atual." });
      const ciclos = (c.ciclos || []).concat([{ n: (c.ciclos || []).length + 1, inicio: p.inicio, fim: p.fim, criadoEm: agora(), renovacao: true }]);
      await ref.set(limpo({ ciclos, estado: "ativa", atualizadoEm: agora(), historico: hist("ciclo " + ciclos.length + " (renovação) · " + p.inicio + " a " + p.fim) }), { merge: true });
      return resposta(200, { ok: true });
    }
    if (b.acao === "estado") {
      if (!R.ESTADOS[b.estado]) return resposta(400, { erro: "Estado inválido." });
      await ref.set(limpo({ estado: b.estado, atualizadoEm: agora(), ...(b.estado === "encerrada" ? { encerradaEm: agora() } : {}), historico: hist(R.ESTADOS[b.estado] + (b.nota ? " · " + R.txt(b.nota, 300) : "")) }), { merge: true });
      return resposta(200, { ok: true });
    }
    return resposta(400, { erro: "Ação desconhecida." });
  } catch (e) {
    console.error("admin-consultoria-rt", e);
    return resposta(500, { erro: "Algo deu errado." });
  }
};
