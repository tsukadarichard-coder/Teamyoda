/* Intercâmbio de scouts entre o app do treinador (Team Yoda / QuadraLab autônomo) e o QuadraLab Competição do atleta.

   POST (treinador com login da academia; sempre com vinculoId de um atleta que o vinculou com a área "partidas")
     { acao: "enviar", vinculoId, jogos: [{ id, resumo }] }  → guarda uma cópia de cada jogo na conta do atleta (mesmo jogo = mesma cópia, sem duplicar)
     { acao: "retirar", vinculoId, ids: [id] }               → apaga da conta do atleta as cópias que este treinador enviou
     { acao: "jogos", vinculoId }                            → jogos que este treinador marcou ao vivo no Competição para o atleta (resumos públicos), para trazer ao app

   Segurança:
   · só conta de academia (claim orgId) e só atleta com vínculo ativo de treinador com a área "partidas" (pelo uid ou e-mail verificado);
   · o que vai para o atleta é sempre o resumo público (limpar): primeiro nome, números, mapa, momento, decisões e mental; nunca adversário, anotações ou caderno;
   · o atleta vê as cópias na aba "Scouts do treinador" e pode excluí-las; o treinador só retira as que enviou. */
const { admin, app } = require("./_firebase-admin");
const { limpar } = require("./_scout-publico");
const { colDoAtleta, idEnviado, vinculosDoTreinador, gravarCopia } = require("./_scout-copias");

const MAX_JOGOS = 100;
function resposta(statusCode, corpo) {
  return { statusCode, headers: { "content-type": "application/json", "cache-control": "no-store", "x-robots-tag": "noindex", "referrer-policy": "no-referrer" }, body: JSON.stringify(corpo) };
}

exports.handler = async function (event) {
  try {
    app();
    if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });
    const cab = event.headers.authorization || event.headers.Authorization || "";
    const idToken = cab.startsWith("Bearer ") ? cab.slice(7) : null;
    if (!idToken) return resposta(401, { erro: "Entre na sua conta." });
    let claims;
    try { claims = await admin.auth().verifyIdToken(idToken); } catch (e) { return resposta(401, { erro: "Sua sessão expirou. Entre de novo." }); }
    if (!claims.orgId) return resposta(403, { erro: "Esta conta ainda não está ligada a uma academia." });
    if (String(event.body || "").length > 900000) return resposta(413, { erro: "Pedido grande demais. Envie menos jogos por vez." });
    let body;
    try { body = JSON.parse(event.body || "{}"); } catch (e) { return resposta(400, { erro: "Pedido inválido." }); }
    const v = (await vinculosDoTreinador(admin.firestore(), claims, "treinador")).get(String(body.vinculoId || ""));
    if (!v) return resposta(403, { erro: "Este atleta não está vinculado a você com acesso às partidas." });

    if (body.acao === "enviar") {
      const jogos = Array.isArray(body.jogos) ? body.jogos.slice(0, MAX_JOGOS) : [];
      if (!jogos.length) return resposta(400, { erro: "Nenhum jogo para enviar." });
      let enviados = 0, cheio = false;
      for (const j of jogos) {
        const id = String((j && j.id) || "");
        if (!id || id.length > 80 || !j.resumo || typeof j.resumo !== "object") continue;
        const ok = await gravarCopia(v.atletaUid, idEnviado(claims.orgId, id), { origem: "treinador", orgId: claims.orgId, marcadoPor: claims.uid, resumo: j.resumo });
        if (ok) enviados++; else { cheio = true; break; }
      }
      return resposta(200, { ok: true, enviados, limite: cheio });
    }
    if (body.acao === "retirar") {
      const ids = (Array.isArray(body.ids) ? body.ids : []).slice(0, MAX_JOGOS).map((i) => idEnviado(claims.orgId, String(i)));
      let retirados = 0;
      for (const id of ids) {
        const ref = colDoAtleta(v.atletaUid).doc(id), s = await ref.get();
        if (s.exists && s.data().origem === "treinador" && s.data().orgId === claims.orgId) { await ref.delete(); retirados++; }
      }
      return resposta(200, { ok: true, retirados });
    }
    if (body.acao === "jogos") {
      const snap = await colDoAtleta(v.atletaUid).get(), saida = [];
      snap.docs.forEach((d) => {
        const x = d.data();
        if (x.origem !== "ao-vivo" || x.marcadoPor !== claims.uid || !x.copia) return;
        let pub = null; try { pub = limpar(JSON.parse(x.copia)); } catch (e) { pub = null; }
        if (pub && pub.n > 0) saida.push({ id: d.id, data: pub.data || x.dataJogo || "", resumo: pub });
      });
      saida.sort((a, b) => String(a.data).localeCompare(String(b.data)));
      return resposta(200, { ok: true, jogos: saida.slice(-MAX_JOGOS) });
    }
    return resposta(400, { erro: "Ação desconhecida." });
  } catch (e) {
    console.error("scout-intercambio:", e && e.message);
    return resposta(500, { erro: "Não foi possível concluir agora. Tente de novo em instantes." });
  }
};
