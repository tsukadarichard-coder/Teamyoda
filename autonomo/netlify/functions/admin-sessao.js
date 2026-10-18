/* Sessão do painel do administrador: entra uma vez com o segredo e fica conectado por 30 dias neste aparelho.

   GET                       → confere a sessão (cookie) e a renova se já passou de 3 dias; 401 sem sessão
   POST { acao: "entrar" }   → cabeçalho x-admin-secret correto → grava o cookie de sessão (HttpOnly, Secure, SameSite=Strict)
   POST { acao: "sair" }     → apaga o cookie deste aparelho
   POST { acao: "sairTodos" }→ (já autenticado) invalida todas as sessões emitidas até agora
   O segredo nunca é guardado no aparelho. Detalhes em _admin-auth.js. */
const A = require("./_admin-auth");

function resposta(statusCode, corpo, cookie) { return { statusCode, headers: Object.assign({ "content-type": "application/json", "cache-control": "no-store" }, cookie ? { "set-cookie": cookie } : {}), body: JSON.stringify(corpo) }; }
const expiraEm = (p) => new Date(p.exp).toISOString();

exports.handler = async function (event) {
  try {
    if (event.httpMethod === "GET") {
      const p = await A.sessaoValida(event);
      if (!p) return resposta(401, { erro: "Sem sessão." });
      const idadeDias = (Date.now() - p.iat) / 86400000;
      if (idadeDias >= A.RENOVAR_APOS_DIAS) { const t = A.emitirToken(), n = A.lerToken(t); return resposta(200, { ok: true, expiraEm: expiraEm(n), renovada: true }, A.setCookie(t)); }
      return resposta(200, { ok: true, expiraEm: expiraEm(p), renovada: false });
    }
    if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });
    let b; try { b = JSON.parse(event.body || "{}"); } catch (e) { return resposta(400, { erro: "Pedido inválido." }); }
    if (b.acao === "sair") return resposta(200, { ok: true }, A.limparCookie());
    if (b.acao === "entrar") {
      if (!A.segredoConfere(event)) {
        if (A.enviouCredencial(event) && (await A.tentativaErrada(event))) return resposta(429, { erro: "Muitas tentativas. Aguarde uma hora." });
        return resposta(401, { erro: "Segredo de administrador ausente ou incorreto." });
      }
      const t = A.emitirToken(), p = A.lerToken(t);
      return resposta(200, { ok: true, expiraEm: expiraEm(p) }, A.setCookie(t));
    }
    if (b.acao === "sairTodos") {
      if (!(await A.autorizar(event))) return resposta(401, { erro: "Sem sessão." });
      await A.sairDeTodos();
      return resposta(200, { ok: true }, A.limparCookie());
    }
    return resposta(400, { erro: "Pedido inválido." });
  } catch (e) {
    console.error("admin-sessao:", e && e.message);
    return resposta(500, { erro: "Não foi possível concluir agora." });
  }
};
