/* Recuperar jogo apagado (scout) — só o dono.

   Um jogo que saiu do caderno antes de existir a lixeira pode ainda estar em algum destes lugares:
     1. a lista de jogadores da academia (outro jogador, cadastro repetido, ou a partida em andamento que ficou guardada no jogador);
     2. o link ao vivo da família (scoutsAoVivo): o resumo publicado, com a série ponto a ponto, fica guardado depois que o link vence;
     3. a cópia enviada ao QuadraLab Competição (jogadores/<uid>/scouts).
   Esta function só LÊ: procura nesses lugares e devolve o que achou. Quem devolve o jogo ao caderno é o app (pelo caminho normal de
   gravação, com a junção das listas), depois que o dono escolhe.

   POST { acao: "buscar", termo?, data? }  → { achados: [{ fonte, id, alunoId?, alunoNome, atleta, data, torneio, adversario, resultado, pontos, n, registro? , rascunho?, resumo? }] }
     termo: parte do nome do jogador, do torneio ou do adversário (sem acento, sem maiúscula); data: AAAA-MM-DD (opcional). */
const { admin, app } = require("./_firebase-admin");
const { limpar } = require("./_scout-publico");

const CHAVE_ALUNOS = "mty:alunos:v2";
class ErroPublico extends Error { constructor(status, mensagem) { super(mensagem); this.status = status; } }
function resposta(statusCode, corpo) { return { statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(corpo) }; }
function donos() { return String(process.env.FINANCEIRO_DONOS || "tsukada.richard@gmail.com").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean); }
const norm = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

async function exigirDono(event) {
  const cab = event.headers.authorization || event.headers.Authorization || "";
  const token = cab.startsWith("Bearer ") ? cab.slice(7) : null;
  if (!token) throw new ErroPublico(401, "Faltou o login.");
  let claims;
  try { claims = await admin.auth().verifyIdToken(token); } catch (e) { throw new ErroPublico(401, "Login inválido ou expirado."); }
  if (!claims.email || donos().indexOf(String(claims.email).toLowerCase()) < 0) throw new ErroPublico(403, "Só o dono pode procurar jogos apagados.");
  if (!claims.orgId) throw new ErroPublico(403, "Entre com a conta da academia.");
  return claims;
}

function bate(termo, data, campos, dataJogo) {
  if (data && dataJogo && String(dataJogo).slice(0, 10) !== data) return false;
  if (!termo) return !!data;
  return campos.some((c) => norm(c).includes(termo));
}

async function buscar(org, termo, data) {
  const fs = admin.firestore(), achados = [];
  /* 1. lista de jogadores da academia: jogos e partidas em andamento guardadas */
  const snap = await fs.collection("orgs").doc(org).collection("dados").doc(CHAVE_ALUNOS).get();
  let alunos = [];
  try { alunos = snap.exists ? JSON.parse(snap.data().value || "[]") : []; } catch (e) { alunos = []; }
  (Array.isArray(alunos) ? alunos : []).forEach((a) => {
    (a.registros || []).forEach((r) => {
      if (!r || r.tipo !== "jogo") return;
      if (!bate(termo, data, [a.nome, r.torneio, r.adversario], r.data)) return;
      achados.push({ fonte: "caderno", id: String(r.id), alunoId: a.id, alunoNome: a.nome || "", atleta: a.nome || "", data: r.data || "", torneio: r.torneio || "", adversario: r.adversario || "",
        resultado: r.resultado || "", pontos: (r.scout && r.scout.pontos || []).length, registro: r });
    });
    const rs = a.scoutRascunho;
    if (rs && Array.isArray(rs.pontos) && rs.pontos.length) {
      const cfg = rs.cfg || {};
      if (termo ? bate(termo, "", [a.nome, cfg.torneio, cfg.adversario], "") : String(rs.salvoEm || "").slice(0, 10) === data)
        achados.push({ fonte: "rascunho", id: "rasc:" + a.id, alunoId: a.id, alunoNome: a.nome || "", atleta: a.nome || "", data: String(rs.salvoEm || "").slice(0, 10), torneio: cfg.torneio || "", adversario: cfg.adversario || "",
          resultado: "", pontos: rs.pontos.length, rascunho: rs });
    }
  });
  /* 2. links ao vivo da família desta academia (o resumo fica guardado depois que o link vence) */
  const vivos = await fs.collection("scoutsAoVivo").where("orgId", "==", org).get();
  vivos.forEach((d) => {
    const x = d.data();
    let pub = null; try { pub = limpar(JSON.parse(x.publico || "{}")); } catch (e) { pub = null; }
    if (!pub || !pub.n) return;
    if (!bate(termo, data, [pub.atleta, pub.torneio], pub.data)) return;
    achados.push({ fonte: "ao-vivo", id: d.id.slice(0, 8), atleta: pub.atleta, alunoNome: "", data: pub.data, torneio: pub.torneio, adversario: "", resultado: pub.resultado, n: pub.n, pontos: (pub.serie || []).length,
      criadoEm: x.criadoEm || "", resumo: pub });
  });
  /* 3. cópias no QuadraLab Competição enviadas por esta academia */
  const copias = await fs.collectionGroup("scouts").get();
  copias.forEach((d) => {
    const x = d.data();
    if (x.orgId !== org || !x.copia) return;
    let pub = null; try { pub = limpar(JSON.parse(x.copia)); } catch (e) { pub = null; }
    if (!pub || !pub.n) return;
    if (!bate(termo, data, [pub.atleta, pub.torneio, x.rotulo], pub.data || x.dataJogo)) return;
    achados.push({ fonte: "competicao", id: d.id.slice(0, 12), atleta: pub.atleta, alunoNome: "", data: pub.data || x.dataJogo || "", torneio: pub.torneio, adversario: "", resultado: pub.resultado, n: pub.n,
      pontos: (pub.serie || []).length, resumo: pub });
  });
  /* o mais completo primeiro */
  const peso = { caderno: 3, rascunho: 2, "ao-vivo": 1, competicao: 0 };
  achados.sort((a, b) => (b.pontos - a.pontos) || (peso[b.fonte] - peso[a.fonte]));
  return achados.slice(0, 30);
}

exports.handler = async function (event) {
  try {
    if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });
    app();
    const claims = await exigirDono(event);
    let body;
    try { body = JSON.parse(event.body || "{}"); } catch (e) { return resposta(400, { erro: "Pedido inválido." }); }
    if (body.acao !== "buscar") return resposta(400, { erro: "Ação desconhecida." });
    const termo = norm(body.termo).slice(0, 60), data = /^\d{4}-\d{2}-\d{2}$/.test(String(body.data || "")) ? body.data : "";
    if (!termo && !data) return resposta(400, { erro: "Informe o nome, o torneio, o adversário ou a data do jogo." });
    return resposta(200, { achados: await buscar(claims.orgId, termo, data) });
  } catch (e) {
    if (e instanceof ErroPublico) return resposta(e.status, { erro: e.message });
    console.error("recuperar-jogo:", e);
    return resposta(500, { erro: "Não foi possível procurar agora." });
  }
};

module.exports.buscar = buscar;
module.exports.bate = bate;
