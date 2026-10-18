/* Controle financeiro — lançamentos manuais (protegido pelo segredo de administrador).

   GET                                   → lançamentos, do mais novo ao mais antigo, e as listas de categorias/produtos
   POST { acao: "criar", tipo, data, valor, categoria, produto, descricao }
   POST { acao: "editar", id, ... }
   POST { acao: "excluir", id }

   Guarda só o que o administrador digita. Não cobra, não reembolsa e não altera nenhum pedido, fatura ou integração. */
const crypto = require("crypto");
const { admin, app } = require("./_firebase-admin");
const F = require("./_admin-financeiro");

function resposta(statusCode, corpo) { return { statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(corpo) }; }
function segredoOk(event) {
  const rec = String((event.headers && (event.headers["x-admin-secret"] || event.headers["X-Admin-Secret"])) || ""), esp = String(process.env.ADMIN_SECRET || "");
  const a = Buffer.from(rec), b = Buffer.from(esp);
  return esp.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}
const listas = () => ({ produtos: F.PRODUTOS, categoriasReceita: F.CATEGORIAS_RECEITA, categoriasDespesa: F.CATEGORIAS_DESPESA });

exports.handler = async function (event) {
  if (!segredoOk(event)) return resposta(401, { erro: "Segredo de administrador ausente ou incorreto." });
  try {
    app();
    const col = admin.firestore().collection("financeiroLancamentos");
    if (event.httpMethod === "GET") {
      const lista = []; (await col.get()).forEach((d) => lista.push({ id: d.id, ...d.data() }));
      lista.sort((a, b) => String(b.data).localeCompare(String(a.data)) || String(b.criadoEm).localeCompare(String(a.criadoEm)));
      return resposta(200, { lancamentos: lista, ...listas() });
    }
    if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });
    let b; try { b = JSON.parse(event.body || "{}"); } catch (e) { return resposta(400, { erro: "Pedido inválido." }); }
    const agora = new Date().toISOString();
    if (b.acao === "criar") {
      const v = F.validar(b); if (v.erro) return resposta(400, { erro: v.erro });
      const ref = col.doc("l" + Date.now().toString(36) + crypto.randomBytes(4).toString("hex"));
      await ref.set({ ...v.ok, criadoEm: agora, atualizadoEm: agora });
      return resposta(200, { ok: true, id: ref.id });
    }
    if (b.acao === "editar" || b.acao === "excluir") {
      const id = String(b.id || ""); if (!/^[A-Za-z0-9]{6,40}$/.test(id)) return resposta(400, { erro: "Pedido inválido." });
      const ref = col.doc(id), s = await ref.get();
      if (!s.exists) return resposta(404, { erro: "Lançamento não encontrado." });
      if (b.acao === "excluir") { await ref.delete(); return resposta(200, { ok: true }); }
      const v = F.validar(b); if (v.erro) return resposta(400, { erro: v.erro });
      await ref.set({ ...v.ok, criadoEm: s.data().criadoEm || agora, atualizadoEm: agora });
      return resposta(200, { ok: true });
    }
    return resposta(400, { erro: "Pedido inválido." });
  } catch (e) {
    console.error("admin-financeiro:", e && e.message);
    return resposta(500, { erro: "Não foi possível concluir agora." });
  }
};
