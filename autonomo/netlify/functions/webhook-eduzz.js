/* Integração com a Eduzz: libera (ou revoga) acesso à QuadraLab
   automaticamente quando alguém compra, é reembolsado ou tem a
   assinatura cancelada — sem precisar rodar provisionar-org na mão.

   ⚠️ ATENÇÃO — PENDÊNCIA CONHECIDA: os nomes de campo usados abaixo
   (cus_email, cus_name, trans_cod, trans_status, product_cod) são um
   ponto de partida baseado no formato clássico do webhook da Eduzz,
   NÃO foram confirmados contra um payload real desta conta. Antes de
   usar em produção: dispare uma notificação de teste pelo painel da
   Eduzz (Configurações → Integrações/Webhook), compare o corpo
   recebido com a função interpretarEvento() logo abaixo, e ajuste os
   nomes de campo e os códigos de status se precisar. Essa é a ÚNICA
   função que deveria precisar de ajuste — o resto (parsing do corpo,
   verificação do segredo, criar/ajustar conta) já segue o mesmo
   padrão comprovado de cadastro-individual.js e provisionar-org.js.

   ── Como configurar na Eduzz ──
   Cadastre como URL de webhook (não dá pra mandar cabeçalho customizado
   no webhook clássico da Eduzz, por isso o segredo vai na própria URL):
     https://quadralab.com.br/.netlify/functions/webhook-eduzz?chave=SEU_WEBHOOK_SECRET
   SEU_WEBHOOK_SECRET é um valor que você escolhe e configura também
   na variável de ambiente WEBHOOK_EDUZZ_SECRET no Netlify (Site
   configuration → Environment variables) — sem isso configurado a
   function recusa qualquer chamada.

   ── Qual produto vira qual plano ──
   Preencha MAPA_PRODUTO com o código de cada produto da Eduzz (o
   payload de teste vai mostrar o campo certo — provavelmente
   product_cod). duracaoDias é quantos dias o acesso dura a partir da
   aprovação (renovação de assinatura estende a partir da data atual
   de validade, nunca a partir de hoje, pra não perder dias já pagos);
   use null pra um produto que não expira (acesso vitalício). */
const MAPA_PRODUTO = {
  // "123456": { plano: "essencial", duracaoDias: 32 },
  // "654321": { plano: "premium", duracaoDias: null },
};

/* Status que contam como "aprovado, liberar acesso" e "revogar acesso"
   — confirme os códigos reais contra o payload de teste antes de usar.
   O webhook clássico da Eduzz historicamente usa números (ex.: 3 para
   venda completa) — ajuste a lista abaixo quando confirmar. */
const STATUS_APROVADO = ["3", "paid", "completa"];
const STATUS_REVOGAR = ["5", "6", "7", "8", "cancelled", "refunded", "chargeback"];

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

/* Eduzz pode mandar o corpo como JSON ou como formulário
   (application/x-www-form-urlencoded) — trata os dois. */
function parseCorpo(event) {
  const tipo = (event.headers["content-type"] || event.headers["Content-Type"] || "").toLowerCase();
  const corpo = event.body || "";
  if (tipo.includes("application/json")) {
    try { return JSON.parse(corpo); } catch (e) { return {}; }
  }
  const params = new URLSearchParams(corpo);
  const obj = {};
  for (const [k, v] of params) obj[k] = v;
  return obj;
}

/* ÚNICA função que deve precisar de ajuste depois de ver um payload
   real da Eduzz — isola toda a interpretação dos nomes de campo. */
function interpretarEvento(dados) {
  const transacaoId = String(dados.trans_cod || dados.cod || dados.id || "").trim();
  const email = String(dados.cus_email || dados.email || "").trim().toLowerCase();
  const nome = String(dados.cus_name || dados.nome || "").trim();
  const produtoCod = String(dados.product_cod || dados.cod_produto || "").trim();
  const statusBruto = String(dados.trans_status || dados.status || "").trim().toLowerCase();
  return {
    transacaoId, email, nome, produtoCod, statusBruto,
    aprovado: STATUS_APROVADO.includes(statusBruto),
    revogar: STATUS_REVOGAR.includes(statusBruto),
  };
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });

  const segredoEsperado = process.env.WEBHOOK_EDUZZ_SECRET;
  const segredoRecebido = (event.queryStringParameters || {}).chave;
  if (!segredoEsperado) return resposta(500, { erro: "WEBHOOK_EDUZZ_SECRET não configurado no Netlify." });
  if (segredoRecebido !== segredoEsperado) return resposta(401, { erro: "Chave de webhook ausente ou incorreta." });

  const dados = parseCorpo(event);
  const ev = interpretarEvento(dados);
  if (!ev.transacaoId || !ev.email) {
    return resposta(200, { ok: false, ignorado: "corpo sem transacaoId/email reconhecíveis — payload: " + JSON.stringify(dados).slice(0, 500) });
  }

  try {
    app();
    const db = admin.firestore();

    // idempotência: Eduzz reenvia o mesmo evento se não receber 200 —
    // nunca processa a mesma transação duas vezes.
    const refEvento = db.collection("webhooksEduzzProcessados").doc(ev.transacaoId);
    if ((await refEvento.get()).exists) {
      return resposta(200, { ok: true, jaProcessado: true });
    }

    if (ev.aprovado) {
      await liberarAcesso(db, ev);
    } else if (ev.revogar) {
      await revogarAcesso(db, ev);
    }
    // qualquer outro status (ex.: "aguardando pagamento") é ignorado de
    // propósito — só reage a aprovação e revogação — mas confirma 200
    // mesmo assim, pra Eduzz não ficar reenviando.

    await refEvento.set({
      status: ev.statusBruto, email: ev.email, processadoEm: new Date().toISOString(),
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
    eduzzUltimaTransacao: ev.transacaoId, eduzzAtualizadoEm: new Date().toISOString(),
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
    eduzzUltimaTransacao: ev.transacaoId, eduzzRevogadoEm: new Date().toISOString(),
  }, { merge: true });
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function resposta(statusCode, corpo) {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) };
}
