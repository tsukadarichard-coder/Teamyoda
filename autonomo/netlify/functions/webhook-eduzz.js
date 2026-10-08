/* Integração com a Eduzz: libera (ou revoga) acesso à QuadraLab
   automaticamente quando alguém compra, é reembolsado ou tem a
   fatura cancelada/chargeback — sem precisar rodar provisionar-org
   na mão.

   Formato confirmado contra um payload REAL de teste disparado pelo
   Developer Hub da Eduzz (console.eduzz.com → Developer Hub →
   Receba eventos) em 08/10/2026 — não é mais o webhook clássico
   (cus_email/trans_status), é JSON puro:
     { id, event, data: { id, status, buyer: {...}, items: [...],
       transaction: {...}, producer: {...}, ... }, sentDate }

   ── Como configurar na Eduzz ──
   1. console.eduzz.com → ícone de grade (apps) → "developer hub"
      → card "Webhooks configurados" → "Criar configuração".
   2. URL: https://quadralab.com.br/.netlify/functions/webhook-eduzz?chave=SEU_WEBHOOK_SECRET
      SEU_WEBHOOK_SECRET é escolhido por você e configurado também na
      variável de ambiente WEBHOOK_EDUZZ_SECRET no Netlify (Site
      configuration → Environment variables) — sem isso configurado
      a function recusa qualquer chamada. A Eduzz também manda um
      cabeçalho x-signature próprio, mas não conseguimos confirmar o
      algoritmo de assinatura dela contra um payload de teste real
      (o campo "originSecret" que o payload de teste traz não bateu
      como chave HMAC-SHA256) — por isso a proteção real é a `chave`
      na URL, que está 100% sob nosso controle.
   3. Marque os eventos: "Fatura paga", "Fatura cancelada", "Fatura
      reembolsada" e "Chargeback de Faturas".

   ── Payloads de TESTE da Eduzz ──
   O botão de teste do Developer Hub manda um comprador fictício real
   (ex.: alice.johnson@example.com) — se processássemos isso à risca
   criaríamos uma conta de verdade pra esse e-mail fake em produção.
   Os payloads de teste trazem um campo a mais, `data.producer.
   originSecret`, que os de produção não têm — usamos a presença dele
   como sinal de "isto é só um teste" e ignoramos sem criar nada.

   ── Qual produto vira qual plano ──
   Preencha MAPA_PRODUTO com o productId de cada produto da Eduzz
   (aparece em data.items[0].productId no payload — o primeiro produto
   do checkout decide o plano). duracaoDias é quantos dias o acesso
   dura a partir da aprovação (renovação de assinatura estende a partir
   da data atual de validade, nunca a partir de hoje, pra não perder
   dias já pagos); use null pra um produto que não expira (acesso
   vitalício). Enquanto estiver vazio, qualquer fatura paga sem produto
   mapeado cai no plano "gratis" (nunca dá acesso indevido, só fica sem
   upgrade automático até você preencher aqui). */
const MAPA_PRODUTO = {
  "3124922": { plano: "essencial", duracaoDias: 32 }, // QuadraLab Essencial · R$29,90/mês · até 30 jogadores
  "3124932": { plano: "premium", duracaoDias: 32 }, // QuadraLab Premium · R$59,90/mês · jogadores ilimitados
};

/* event (data.event) que contam como "aprovado, liberar acesso" e
   "revogar acesso" — confirmados contra os 4 payloads de teste reais
   disparados no Developer Hub. */
const EVENTOS_APROVADO = ["myeduzz.invoice_paid"];
const EVENTOS_REVOGAR = ["myeduzz.invoice_canceled", "myeduzz.invoice_refunded", "myeduzz.invoice_chargeback"];

const { admin, app } = require("./_firebase-admin");

function apelido(nome) {
  return String(nome || "treinador")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30) || "treinador";
}
function sufixo() {
  return Math.random().toString(36).slice(2, 7);
}
function senhaAleatoria() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

/* ÚNICA função que deve precisar de ajuste se a Eduzz mudar o formato
   do payload — isola toda a interpretação do corpo. */
function interpretarEvento(corpo) {
  const dados = (corpo && corpo.data) || {};
  const eventoBruto = String(corpo.event || "").trim();
  const email = String((dados.buyer || {}).email || "").trim().toLowerCase();
  const nome = String((dados.buyer || {}).name || "").trim();
  const faturaId = String(dados.id || "").trim();
  const primeiroItem = (dados.items || [])[0] || {};
  const produtoCod = String(primeiroItem.productId || "").trim();
  const ehTeste = !!((dados.producer || {}).originSecret);
  return {
    faturaId, email, nome, produtoCod, eventoBruto, ehTeste,
    aprovado: EVENTOS_APROVADO.includes(eventoBruto),
    revogar: EVENTOS_REVOGAR.includes(eventoBruto),
  };
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });

  const segredoEsperado = process.env.WEBHOOK_EDUZZ_SECRET;
  const segredoRecebido = (event.queryStringParameters || {}).chave;
  if (!segredoEsperado) return resposta(500, { erro: "WEBHOOK_EDUZZ_SECRET não configurado no Netlify." });
  if (segredoRecebido !== segredoEsperado) return resposta(401, { erro: "Chave de webhook ausente ou incorreta." });

  let corpo;
  try {
    corpo = JSON.parse(event.body || "{}");
  } catch (e) {
    return resposta(200, { ok: false, ignorado: "corpo não é um JSON válido." });
  }

  const ev = interpretarEvento(corpo);
  if (ev.ehTeste) {
    // disparo de teste do Developer Hub (comprador fictício) — nunca cria conta de verdade.
    return resposta(200, { ok: true, teste: true });
  }
  if (!ev.faturaId || !ev.email) {
    return resposta(200, { ok: false, ignorado: "corpo sem id de fatura/e-mail reconhecíveis — evento: " + ev.eventoBruto });
  }

  try {
    app();
    const db = admin.firestore();

    // idempotência: Eduzz pode reenviar o mesmo evento se não receber 200 —
    // nunca processa a mesma combinação fatura+evento duas vezes.
    const chaveEvento = ev.faturaId + "|" + ev.eventoBruto;
    const refEvento = db.collection("webhooksEduzzProcessados").doc(chaveEvento);
    if ((await refEvento.get()).exists) {
      return resposta(200, { ok: true, jaProcessado: true });
    }

    if (ev.aprovado) {
      await liberarAcesso(db, ev);
    } else if (ev.revogar) {
      await revogarAcesso(db, ev);
    }
    // qualquer outro evento (ex.: fatura criada, em negociação) é ignorado
    // de propósito — só reage a aprovação e revogação — mas confirma 200
    // mesmo assim, pra Eduzz não ficar reenviando.

    await refEvento.set({
      evento: ev.eventoBruto, email: ev.email, processadoEm: new Date().toISOString(),
    });
    return resposta(200, { ok: true });
  } catch (e) {
    return resposta(500, { erro: String(e.message || e) });
  }
};

async function liberarAcesso(db, ev) {
  const infoProduto = MAPA_PRODUTO[ev.produtoCod] || null;
  const plano = infoProduto ? infoProduto.plano : "gratis";
  const duracaoDias = infoProduto ? infoProduto.duracaoDias : null;

  let usuario;
  try {
    usuario = await admin.auth().getUserByEmail(ev.email);
  } catch (e) {
    if (e.code !== "auth/user-not-found") throw e;
  }

  let orgId;
  if (usuario) {
    // já existe conta com este e-mail (ex.: cadastro grátis anterior) —
    // só faz upgrade do plano dela, nunca cria uma segunda conta.
    orgId = (usuario.customClaims || {}).orgId;
    if (!orgId) throw new Error("Usuário " + ev.email + " existe mas não tem orgId — não dá pra decidir qual conta liberar.");
  } else {
    usuario = await admin.auth().createUser({ email: ev.email, password: senhaAleatoria(), displayName: ev.nome || undefined });
    const base = apelido(ev.nome || ev.email.split("@")[0]);
    const dbRoot = db.collection("orgs");
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const candidato = base + "-" + sufixo();
      const doc = await dbRoot.doc(candidato).collection("meta").doc("info").get();
      if (!doc.exists) { orgId = candidato; break; }
    }
    if (!orgId) throw new Error("Não consegui gerar um identificador único de organização.");
    await admin.auth().setCustomUserClaims(usuario.uid, { orgId, role: "coordenador" });
    await db.collection("orgs").doc(orgId).collection("solicitacoes").doc(usuario.uid).set({
      nome: ev.nome || "", email: ev.email, status: "aprovada", role: "coordenador", criadoEm: new Date().toISOString(),
    });
  }

  const refInfo = db.collection("orgs").doc(orgId).collection("meta").doc("info");
  const infoAtual = (await refInfo.get()).data() || {};
  let planoAtivoAte = null;
  if (duracaoDias != null) {
    // renovação estende a partir da validade atual (se ainda não venceu),
    // não a partir de hoje — nunca "perde" dias já pagos.
    const baseData = infoAtual.planoAtivoAte && infoAtual.planoAtivoAte > hojeISO() ? new Date(infoAtual.planoAtivoAte) : new Date();
    baseData.setDate(baseData.getDate() + duracaoDias);
    planoAtivoAte = baseData.toISOString().slice(0, 10);
  }

  await refInfo.set({
    nome: infoAtual.nome || ev.nome || ev.email, individual: true, plano,
    ...(planoAtivoAte ? { planoAtivoAte } : {}),
    eduzzUltimaFatura: ev.faturaId, eduzzAtualizadoEm: new Date().toISOString(),
    ...(infoAtual.criadoEm ? {} : { criadoEm: new Date().toISOString() }),
  }, { merge: true });
}

async function revogarAcesso(db, ev) {
  let usuario;
  try {
    usuario = await admin.auth().getUserByEmail(ev.email);
  } catch (e) {
    if (e.code === "auth/user-not-found") return; // nada pra revogar
    throw e;
  }
  const orgId = (usuario.customClaims || {}).orgId;
  if (!orgId) return;

  // nunca apaga a conta nem os dados — só derruba pro plano grátis.
  // Se o limite de jogadores do plano grátis for menor que o que a
  // academia já tem cadastrado, o app já bloqueia CRIAR jogador novo
  // sozinho (LIMITES_POR_PLANO) — não apaga quem já existe.
  await db.collection("orgs").doc(orgId).collection("meta").doc("info").set({
    plano: "gratis", planoAtivoAte: admin.firestore.FieldValue.delete(),
    eduzzUltimaFatura: ev.faturaId, eduzzRevogadoEm: new Date().toISOString(),
  }, { merge: true });
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function resposta(statusCode, corpo) {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) };
}
