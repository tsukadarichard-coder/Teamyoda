/* Scout ao vivo: a família acompanha a partida enquanto o treinador marca os pontos.

   POST (treinador, com login da academia; ou responsável vinculado com a área "partidas", sempre com vinculoId)
     { acao: "atletas" }                       → atletas que me vincularam como treinador (vínculo ativo com a área "partidas")
     { acao: "meuCodigo" }                     → código fixo do treinador (8 caracteres): o atleta da academia o digita no Player e o vínculo nasce ativo
     { acao: "pedirVinculo", email }           → pede o vínculo a um atleta da academia que já tem conta no Player; ele aprova no app (menor também, sem responsável)
     { acao: "iniciar", resumo, vinculoId? }   → cria o link ao vivo e devolve { token, expiraEm }; com vinculoId (de "atletas") o jogo aparece sozinho no app do atleta, dos responsáveis e do treinador
     { acao: "atualizar", token, resumo, fim? } → troca o resumo publicado pelo mais recente (fim: true marca a partida como encerrada)
     { acao: "revogar", token }                 → apaga o link na hora
   GET ?t=<token>&v=<versão>  (família, sem login) → { versao, publico, aoVivo, expiraEm }, ou { semMudanca: true } se já está na versão v

   Segurança:
   · só uma conta de academia (claim orgId) cria, atualiza ou revoga, e só os links da própria academia;
   · o que a família recebe passa por limpar() (_scout-publico): primeiro nome, números, mapa e momento; nunca adversário, anotações ou caderno;
   · token aleatório de 128 bits, validade de 12 horas (2 horas depois do fim da partida), no máximo 3 links ao vivo por academia, e revogação imediata;
   · a leitura pública nunca é guardada em cache. O resumo é montado no app do treinador a partir dos pontos já marcados. */
const crypto = require("crypto");
const { admin, app } = require("./_firebase-admin");
const { limpar } = require("./_scout-publico");
const { vinculosDoTreinador, gravarCopia, idAoVivo } = require("./_scout-copias");

const VALIDADE_MS = 12 * 3600 * 1000;
const RETOMAR_ATE_MS = 7 * 24 * 3600 * 1000; // um link vencido há até 7 dias pode ser reativado por quem retoma a mesma partida
const APOS_FIM_MS = 2 * 3600 * 1000; // depois do fim da partida o link ainda vale por 2 horas, para a família ver o resultado final
const MAX_ATIVOS = 3;
const TOKEN = /^[a-f0-9]{32}$/;

function resposta(statusCode, corpo, publico) {
  return { statusCode, headers: { "content-type": "application/json", "cache-control": "no-store", "x-robots-tag": "noindex", "referrer-policy": "no-referrer" }, body: JSON.stringify(corpo) };
}
const agora = () => new Date().toISOString();
/* O Firestore não aceita arrays dentro de arrays (a série de pontos é uma lista de listas), então o resumo é guardado como texto JSON. */
const guardar = (resumo, aoVivo) => JSON.stringify({ ...limpar(resumo), aoVivo, atualizadoEm: agora() });
const ler = (d) => { try { return JSON.parse(d.publico); } catch (e) { return limpar({}); } };

exports.handler = async function (event) {
  try {
    app();
    const col = admin.firestore().collection("scoutsAoVivo");

    if (event.httpMethod === "GET") {
      const q = event.queryStringParameters || {};
      const invalido = () => resposta(404, { erro: "Este link foi encerrado ou venceu. Peça um novo ao treinador." });
      if (!TOKEN.test(String(q.t || ""))) return invalido();
      const snap = await col.doc(q.t).get();
      if (!snap.exists) return invalido();
      const d = snap.data();
      if (!(Date.parse(d.expiraEm) > Date.now())) return invalido();
      if (String(q.v || "") === String(d.versao)) return resposta(200, { semMudanca: true, versao: d.versao, aoVivo: !!ler(d).aoVivo });
      return resposta(200, { versao: d.versao, publico: limpar(ler(d)), expiraEm: d.expiraEm });
    }
    if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });

    const cab = event.headers.authorization || event.headers.Authorization || "";
    const idToken = cab.startsWith("Bearer ") ? cab.slice(7) : null;
    if (!idToken) return resposta(401, { erro: "Entre na sua conta para compartilhar ao vivo." });
    let claims;
    try { claims = await admin.auth().verifyIdToken(idToken); } catch (e) { return resposta(401, { erro: "Sua sessão expirou. Entre de novo." }); }
    /* academia: dono é o orgId. Família (responsável vinculado com a área "partidas"): dono é "fam:<uid>", e só com vinculoId */
    const familia = !claims.orgId;
    const dono = claims.orgId || "fam:" + claims.uid;
    if (String(event.body || "").length > 120000) return resposta(413, { erro: "Resumo grande demais." });
    let body;
    try { body = JSON.parse(event.body || "{}"); } catch (e) { return resposta(400, { erro: "Pedido inválido." }); }

    if (familia && body.acao !== "iniciar" && body.acao !== "atualizar" && body.acao !== "revogar" && body.acao !== "retomar") return resposta(403, { erro: "Esta conta ainda não está ligada a uma academia." });
    if (body.acao === "atletas") {
      const lista = [...(await vinculosDoTreinador(admin.firestore(), claims))].map(([id, v]) => ({ vinculoId: id, nome: String(v.atletaNome || "Atleta").slice(0, 60) }));
      return resposta(200, { ok: true, atletas: lista });
    }
    if (body.acao === "meuCodigo" || body.acao === "pedirVinculo") {
      const db = admin.firestore(), cod = db.collection("codigosAcademia");
      let nome = String(claims.name || "").trim();
      if (body.acao === "meuCodigo") {
        let existente = (await cod.where("treinadorUid", "==", claims.uid).limit(1).get()).docs[0];
        if (!existente) {
          const ALF = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
          let codigo = "";
          for (let i = 0; i < 5 && !codigo; i++) {
            const b = crypto.randomBytes(8); let c = ""; for (let k = 0; k < 8; k++) c += ALF[b[k] % ALF.length];
            if (!(await cod.doc(c).get()).exists) codigo = c;
          }
          if (!codigo) return resposta(500, { erro: "Não foi possível gerar o código agora. Tente de novo." });
          await cod.doc(codigo).set({ treinadorUid: claims.uid, treinadorNome: nome || "Treinador", treinadorEmail: claims.email || null, orgId: claims.orgId, criadoEm: agora() });
          return resposta(200, { ok: true, codigo });
        }
        return resposta(200, { ok: true, codigo: existente.id });
      }
      const email = String(body.email || "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) return resposta(400, { erro: "Informe um e-mail válido." });
      let atleta;
      try { atleta = await admin.auth().getUserByEmail(email); } catch (e) { atleta = null; }
      const semConta = { erro: "Esse e-mail ainda não tem conta de atleta no QuadraLab Player. Peça para ele criar a conta e use o seu código (Meu código)." };
      if (!atleta) return resposta(404, semConta);
      const jog = await db.collection("jogadores").doc(atleta.uid).get();
      const comp = (jog.exists && jog.data().competicao) || {};
      if (comp.papel !== "atleta") return resposta(404, semConta);
      const vs = await db.collection("vinculos").where("atletaUid", "==", atleta.uid).where("pessoaUid", "==", claims.uid).get();
      if (vs.docs.some((d) => d.data().tipo === "treinador" && ["aguardando", "ativo"].includes(d.data().status))) return resposta(409, { erro: "Você já está vinculado a este atleta ou o pedido já foi enviado." });
      const quando = agora();
      const v = { atletaUid: atleta.uid, atletaNome: (jog.data().nome || atleta.displayName || "Atleta"), tipo: "treinador", origem: "academia", orgId: claims.orgId, status: "aguardando",
        areas: ["perfil", "temporada", "planejamento", "estrategias", "partidas", "treinos"], codigo: null, criadoEm: quando, expiraEm: null, pessoaUid: claims.uid, pessoaNome: nome || "Treinador", pessoaEmail: claims.email || null, aceitoEm: quando,
        historico: [{ em: quando, por: claims.uid, acao: "pedido do treinador da academia, aguardando o atleta" }] };
      await db.collection("vinculos").add(v);
      return resposta(200, { ok: true, atleta: v.atletaNome });
    }
    if (body.acao === "iniciar") {
      const ativos = (await col.where("orgId", "==", dono).get()).docs.filter((d) => Date.parse(d.data().expiraEm) > Date.now());
      if (ativos.length >= MAX_ATIVOS) return resposta(409, { erro: "Sua academia já tem " + MAX_ATIVOS + " links ao vivo abertos. Encerre um antes de abrir outro." });
      /* jogo ligado a um atleta: só com um vínculo de treinador ativo desta conta */
      let ligacao = {};
      if (familia && !body.vinculoId) return resposta(403, { erro: "Esta conta ainda não está ligada a uma academia." });
      if (body.vinculoId) {
        const v = (await vinculosDoTreinador(admin.firestore(), claims, familia ? ["responsavel", "treinador"] : "treinador")).get(String(body.vinculoId));
        if (!v) return resposta(403, { erro: "Este atleta não está vinculado a você com acesso às partidas." });
        ligacao = { atletaUid: v.atletaUid, vinculoId: String(body.vinculoId) };
      }
      const token = crypto.randomBytes(16).toString("hex"), expiraEm = new Date(Date.now() + VALIDADE_MS).toISOString();
      await col.doc(token).set({ orgId: dono, uid: claims.uid, criadoEm: agora(), expiraEm, versao: 1, publico: guardar(body.resumo, true), ...ligacao });
      return resposta(200, { ok: true, token, expiraEm });
    }

    const token = String(body.token || "");
    if (!TOKEN.test(token)) return resposta(400, { erro: "Link inválido." });
    const ref = col.doc(token), snap = await ref.get();
    /* link de outra academia responde como se não existisse */
    if (!snap.exists || snap.data().orgId !== dono) return resposta(404, { erro: "Link não encontrado." });
    const d = snap.data();

    if (body.acao === "revogar") {
      /* encerrar um jogo ligado a um atleta com pontos suficientes também guarda a cópia */
      if (d.vinculoId && d.atletaUid) { try { const pub = ler(d); if (pub.n >= 10) await gravarCopia(d.atletaUid, idAoVivo(token), { origem: "ao-vivo", orgId: d.orgId, marcadoPor: d.uid, resumo: pub }); } catch (e) { console.error("scout-ao-vivo copia:", e && e.message); } }
      await ref.delete(); return resposta(200, { ok: true });
    }
    /* retomar uma partida: o mesmo link volta a funcionar (a página dos pais é a mesma), se venceu há pouco tempo; depois disso, só um link novo */
    if (body.acao === "retomar") {
      if (familia && !(await vinculosDoTreinador(admin.firestore(), claims, ["responsavel", "treinador"])).has(d.vinculoId)) return resposta(403, { erro: "Seu vínculo com este atleta não está mais ativo." });
      const vence = Date.parse(d.expiraEm);
      if (vence > Date.now()) return resposta(200, { ok: true, token, expiraEm: d.expiraEm });
      if (Date.now() - vence > RETOMAR_ATE_MS) return resposta(410, { erro: "Este link venceu há muito tempo. Inicie outro." });
      const ativos = (await col.where("orgId", "==", dono).get()).docs.filter((x) => x.id !== token && Date.parse(x.data().expiraEm) > Date.now());
      if (ativos.length >= MAX_ATIVOS) return resposta(409, { erro: "Sua academia já tem " + MAX_ATIVOS + " links ao vivo abertos. Encerre um antes de retomar este." });
      const expiraEm = new Date(Date.now() + VALIDADE_MS).toISOString();
      await ref.update({ versao: d.versao + 1, expiraEm });
      return resposta(200, { ok: true, token, expiraEm });
    }
    if (body.acao === "atualizar") {
      if (familia && !(await vinculosDoTreinador(admin.firestore(), claims, ["responsavel", "treinador"])).has(d.vinculoId)) return resposta(403, { erro: "Seu vínculo com este atleta não está mais ativo." });
      if (!(Date.parse(d.expiraEm) > Date.now())) return resposta(410, { erro: "Este link ao vivo venceu. Inicie outro." });
      const fim = body.fim === true;
      const expiraEm = fim ? new Date(Math.min(Date.parse(d.expiraEm), Date.now() + APOS_FIM_MS)).toISOString() : d.expiraEm;
      await ref.update({ versao: d.versao + 1, expiraEm, publico: guardar(body.resumo, !fim) });
      /* jogo ligado a um atleta: ao terminar a partida, uma cópia fica na conta dele (o link vence, a cópia não) */
      if (fim && d.vinculoId && d.atletaUid) { try { await gravarCopia(d.atletaUid, idAoVivo(token), { origem: "ao-vivo", orgId: d.orgId, marcadoPor: d.uid, resumo: body.resumo }); } catch (e) { console.error("scout-ao-vivo copia:", e && e.message); } }
      return resposta(200, { ok: true, versao: d.versao + 1 });
    }
    return resposta(400, { erro: "Ação desconhecida." });
  } catch (e) {
    console.error("scout-ao-vivo:", e && e.message);
    return resposta(500, { erro: "Não foi possível concluir agora. Tente de novo em instantes." });
  }
};
