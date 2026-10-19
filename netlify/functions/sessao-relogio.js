/* Sessão da aula no relógio (Apple Watch pelo app Atalhos, ou qualquer leitor de texto).

   POST (treinador, com login da academia)
     { acao: "publicar", alunoId, nome, titulo, secoes: [{ t, itens: [{ n, min, d }] }] } → guarda a lista da aula e devolve { token }
     { acao: "revogar", alunoId }                                                       → apaga o link na hora
   GET ?t=<token>            → texto simples, uma linha por exercício (cabe na tela do relógio)
   GET ?t=<token>&f=lista    → só os nomes, um por linha (para "Escolher da lista" no Atalhos)
   GET ?t=<token>&f=json     → o mesmo conteúdo em JSON

   Segurança: só uma conta de academia (claim orgId) publica ou revoga, e só os links da própria academia. O link leva só o primeiro nome do jogador,
   os nomes e tempos dos exercícios e um resumo curto de cada um: nunca ficha, observações ou histórico. Token aleatório de 128 bits,
   validade de 45 dias, revogação imediata, sem cache. */
const crypto = require("crypto");
const { admin, app } = require("./_firebase-admin");

const TOKEN = /^[a-f0-9]{32}$/;
const VALIDADE_MS = 45 * 24 * 3600 * 1000;
const MAX_SECOES = 6, MAX_ITENS = 14;

function resposta(statusCode, corpo, tipo) {
  return { statusCode, headers: { "content-type": tipo || "application/json; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex", "referrer-policy": "no-referrer" }, body: typeof corpo === "string" ? corpo : JSON.stringify(corpo) };
}
const txt = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);

function limpar(b) {
  const secoes = (Array.isArray(b.secoes) ? b.secoes : []).slice(0, MAX_SECOES).map((s) => ({
    t: txt(s && s.t, 40),
    itens: (Array.isArray(s && s.itens) ? s.itens : []).slice(0, MAX_ITENS).map((i) => ({ n: txt(i && i.n, 80), min: Math.max(0, Math.min(240, parseInt(i && i.min, 10) || 0)), d: txt(i && i.d, 160) })).filter((i) => i.n),
  })).filter((s) => s.itens.length);
  return { primeiroNome: txt(String(b.nome || "").split(" ")[0], 30), titulo: txt(b.titulo, 60) || "Aula de hoje", secoes };
}
function emTexto(d) {
  const L = [d.titulo + (d.primeiroNome ? " · " + d.primeiroNome : "")];
  let n = 0;
  d.secoes.forEach((s) => {
    L.push("", s.t.toUpperCase());
    s.itens.forEach((i) => { n++; L.push(n + ". " + i.n + (i.min ? " (" + i.min + " min)" : "")); if (i.d) L.push("   " + i.d); });
  });
  return L.join("\n");
}
function emLista(d) {
  let n = 0; const L = [];
  d.secoes.forEach((s) => s.itens.forEach((i) => { n++; L.push(n + ". " + i.n + (i.min ? " · " + i.min + " min" : "")); }));
  return L.join("\n");
}

exports.handler = async function (event) {
  try {
    app();
    const col = admin.firestore().collection("sessoesRelogio");
    if (event.httpMethod === "GET") {
      const q = event.queryStringParameters || {};
      const invalido = () => resposta(404, "Este link foi encerrado ou venceu. Gere um novo no app.", "text/plain; charset=utf-8");
      if (!TOKEN.test(String(q.t || ""))) return invalido();
      const snap = await col.doc(q.t).get();
      if (!snap.exists) return invalido();
      const d = snap.data();
      if (!(Date.parse(d.expiraEm) > Date.now())) return invalido();
      const dados = { primeiroNome: d.primeiroNome, titulo: d.titulo, secoes: JSON.parse(d.secoes || "[]"), atualizadoEm: d.atualizadoEm };
      if (q.f === "json") return resposta(200, dados);
      return resposta(200, q.f === "lista" ? emLista(dados) : emTexto(dados), "text/plain; charset=utf-8");
    }
    if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });

    const cab = event.headers.authorization || event.headers.Authorization || "";
    const idToken = cab.startsWith("Bearer ") ? cab.slice(7) : null;
    if (!idToken) return resposta(401, { erro: "Entre na sua conta para enviar a aula ao relógio." });
    let claims;
    try { claims = await admin.auth().verifyIdToken(idToken); } catch (e) { return resposta(401, { erro: "Sua sessão expirou. Entre de novo." }); }
    if (!claims.orgId) return resposta(403, { erro: "Esta conta ainda não está ligada a uma academia." });
    if (String(event.body || "").length > 60000) return resposta(413, { erro: "Aula grande demais." });
    let body;
    try { body = JSON.parse(event.body || "{}"); } catch (e) { return resposta(400, { erro: "Pedido inválido." }); }
    const alunoId = txt(body.alunoId, 80);
    if (!alunoId) return resposta(400, { erro: "Jogador não informado." });
    const existente = (await col.where("orgId", "==", claims.orgId).where("alunoId", "==", alunoId).get()).docs[0];

    if (body.acao === "revogar") {
      if (existente) await col.doc(existente.id).delete();
      return resposta(200, { ok: true });
    }
    if (body.acao === "publicar") {
      const d = limpar(body);
      if (!d.secoes.length) return resposta(400, { erro: "A aula não tem exercícios para enviar." });
      const token = existente ? existente.id : crypto.randomBytes(16).toString("hex");
      const agora = new Date();
      await col.doc(token).set({ orgId: claims.orgId, alunoId, primeiroNome: d.primeiroNome, titulo: d.titulo, secoes: JSON.stringify(d.secoes), atualizadoEm: agora.toISOString(), expiraEm: new Date(agora.getTime() + VALIDADE_MS).toISOString() });
      return resposta(200, { ok: true, token, expiraEm: new Date(agora.getTime() + VALIDADE_MS).toISOString() });
    }
    return resposta(400, { erro: "Ação desconhecida." });
  } catch (e) {
    console.error("sessao-relogio", e && e.message);
    return resposta(500, { erro: "Não foi possível agora. Tente de novo." });
  }
};
