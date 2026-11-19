/* Inscrição pública em torneio ou evento — sem login, pelo link que o
   treinador copia nas abas Torneios/Eventos (inscricao.html?org=ORGID).
   Mesmo padrão de reservar-quadra.js: só funciona pra academia com
   orgs/{org}/meta/info.mostrarTorneiosEventos === true (Team Yoda e 39
   Ranch têm liberação própria aqui embaixo, sem precisar desse campo).

   GET não expõe nome nem telefone de quem já se inscreveu — só o que é
   preciso pra montar a lista (torneios com inscrições abertas, eventos
   ativos, e quantas vagas de evento já foram preenchidas). Quem vê os
   detalhes completos é só o treinador logado, dentro do app.

   POST usa uma transação do Firestore na própria gravação — evita que
   duas pessoas inscrevendo no mesmo instante para a última vaga de um
   evento resultem nas duas "confirmadas" ao mesmo tempo.

   Eventos no site do Team Yoda (pedido do Richard em 19/11/2026, evento de fim de ano para crianças de 8 a 12 anos):
   · o evento marcado "Mostrar no site" (site: true) aparece na página principal (mty/portal/) com o cartaz;
   · a inscrição guarda também e-mail, nome e nascimento da criança, se já é aluno, observações e a autorização do
     responsável (com data); evento com faixa de idade confere a idade na data do evento; "inscrições até" fecha sozinho;
   · cada inscrição nova avisa no celular a coordenação (app do treinador) e aparece no sino do app;
   · o cartaz é uma imagem enviada pela gestão (POST acao "imagem", com a conta da academia) e servida por GET ?img=.
   Pagamento: o app não cobra nada; a gestão marca à mão (pendente, pago, isento) dentro do app.
   Opções de inscrição com valor (pedido do Richard em 19/11/2026, "1 semana ou 2 semanas... valor que deve aparecer para quem se
   inscreve"): `opcoes` [{id, nome, valor}] no evento; quem se inscreve escolhe uma (obrigatório quando há opções) e vê o valor no
   formulário; sem opções, vale o `valor` do evento. A inscrição guarda `opcaoId`, `opcaoNome` e `valor`.
   Diária avulsa (mesmo dia, "Pode colocar tb diária avulsa"): opção com `porDia: true`; a pessoa escolhe os dias (dias úteis entre
   `data` e `dataFim`) e o valor é o da diária × dias; a inscrição guarda `dias` [aaaa-mm-dd]. */
const P = require("./_push");
const { admin, app } = require("./_firebase-admin");

class ErroPublico extends Error {
  constructor(status, mensagem) { super(mensagem); this.status = status; }
}

const CHAVE_TORNEIOS = "mty:torneios:v1";
const CHAVE_EVENTOS = "mty:eventos:v1";
const LIMITE_NOME = 80;
const LIMITE_TELEFONE = 30;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const IMG_ID = /^[a-z0-9]{24}$/;
const hojeSP = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
/* idade completa numa data (aaaa-mm-dd) */
function idadeEm(nascimento, data) {
  const [an, mn, dn] = nascimento.split("-").map(Number), [a, m, d] = data.split("-").map(Number);
  return a - an - (m < mn || (m === mn && d < dn) ? 1 : 0);
}
const txt = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);

exports.handler = async function (event) {
  try {
    app();
    if (event.httpMethod === "GET" && (event.queryStringParameters || {}).img) return await servirImagem(event.queryStringParameters.img);
    if (event.httpMethod === "GET") return await handleGet(event);
    if (event.httpMethod === "POST") return await handlePost(event);
    return resposta(405, { erro: "Método não permitido." });
  } catch (e) {
    if (e instanceof ErroPublico) return resposta(e.status, { erro: e.message });
    return resposta(500, { erro: String(e.message || e) });
  }
};

async function confereAcademiaHabilitada(org) {
  if (!org) throw new ErroPublico(400, "Link incompleto.");
  const info = await admin.firestore().collection("orgs").doc(org).collection("meta").doc("info").get();
  const dados = info.exists ? info.data() : {};
  if (org === "team-yoda" || org === "39-ranch") return dados;
  if (!info.exists || dados.mostrarTorneiosEventos !== true) {
    throw new ErroPublico(404, "Esta academia não usa inscrição por este link.");
  }
  return dados;
}

async function handleGet(event) {
  const q = event.queryStringParameters || {};
  const { org } = q;
  const info = await confereAcademiaHabilitada(org);

  const db = admin.firestore();
  const snapTorneios = await db.collection("orgs").doc(org).collection("dados").doc(CHAVE_TORNEIOS).get();
  const torneios = snapTorneios.exists ? JSON.parse(snapTorneios.data().value || "[]") : [];
  const torneiosAbertos = torneios
    .filter((t) => t.status === "inscricoes")
    .map((t) => ({
      id: t.id, nome: t.nome, dataInicio: t.dataInicio, dataFim: t.dataFim, local: t.local,
      categorias: (t.categorias || []).map((c) => ({ id: c.id, nome: c.nome })),
    }));

  const snapEventos = await db.collection("orgs").doc(org).collection("dados").doc(CHAVE_EVENTOS).get();
  const eventos = snapEventos.exists ? JSON.parse(snapEventos.data().value || "[]") : [];
  const hoje = hojeSP();
  const eventosAtivos = eventos
    .filter((e) => e.ativo !== false && !(e.inscricoesAte && e.inscricoesAte < hoje))
    .map((e) => ({
      id: e.id, nome: e.nome, data: e.data, horaInicio: e.horaInicio, horaFim: e.horaFim,
      local: e.local, tipo: e.tipo, descricao: e.descricao, vagas: e.vagas ?? null,
      confirmados: (e.convidados || []).filter((c) => c.status === "confirmado").length,
      /* site do Team Yoda: só o que é público (nunca nomes nem telefones); o valor e as opções aparecem no formulário de inscrição */
      opcoes: (Array.isArray(e.opcoes) ? e.opcoes : []).filter((o) => o && o.id && o.nome).map((o) => ({ id: o.id, nome: o.nome, valor: o.valor ?? null, ...(o.porDia ? { porDia: true } : {}) })),
      dias: diasUteis(e.data, e.dataFim),
      valor: e.valor ?? null,
      site: e.site === true, publico: e.publico || "", idadeMin: e.idadeMin ?? null, idadeMax: e.idadeMax ?? null,
      inscricoesAte: e.inscricoesAte || "", cartaz: e.cartaz || "", dataFim: e.dataFim || "",
    }));

  return resposta(200, { academia: info.nome || org, torneios: torneiosAbertos, eventos: eventosAtivos });
}

async function handlePost(event) {
  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch (e) { throw new ErroPublico(400, "Corpo da requisição inválido."); }

  if (body.acao === "imagem") return await salvarImagem(event, body);
  const { org, tipo } = body;
  const nomeContato = String(body.nomeContato || "").trim().slice(0, LIMITE_NOME);
  const telefoneContato = String(body.telefoneContato || "").trim().slice(0, LIMITE_TELEFONE);
  if (!nomeContato || !telefoneContato) throw new ErroPublico(400, "Preencha nome e telefone.");

  await confereAcademiaHabilitada(org);
  const db = admin.firestore();

  if (tipo === "torneio") return await inscreverTorneio(db, org, body, nomeContato, telefoneContato);
  if (tipo === "evento") return await inscreverEvento(db, org, body, nomeContato, telefoneContato);
  throw new ErroPublico(400, 'tipo precisa ser "torneio" ou "evento".');
}

async function inscreverTorneio(db, org, body, nomeContato, telefoneContato) {
  const { torneioId, categoriaId } = body;
  if (!torneioId || !categoriaId) throw new ErroPublico(400, "Faltou o torneio ou a categoria.");

  const ref = db.collection("orgs").doc(org).collection("dados").doc(CHAVE_TORNEIOS);
  const resultado = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const torneios = snap.exists ? JSON.parse(snap.data().value || "[]") : [];
    const torneio = torneios.find((t) => t.id === torneioId);
    if (!torneio || torneio.status !== "inscricoes") {
      throw new ErroPublico(404, "Esse torneio não está com inscrições abertas — atualize a página.");
    }
    const categoria = (torneio.categorias || []).find((c) => c.id === categoriaId);
    if (!categoria) throw new ErroPublico(404, "Essa categoria não existe mais — atualize a página.");

    const inscricao = {
      id: "inscricao-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7),
      nomeContato, telefoneContato, origem: "cliente", vistoPeloStaff: false, criadoEm: new Date().toISOString(),
    };
    categoria.inscritos = [...(categoria.inscritos || []), inscricao];
    tx.set(ref, { value: JSON.stringify(torneios), atualizado: Date.now() });
    return { torneioNome: torneio.nome, categoriaNome: categoria.nome };
  });

  return resposta(200, { ok: true, ...resultado });
}

async function inscreverEvento(db, org, body, nomeContato, telefoneContato) {
  const { eventoId } = body;
  if (!eventoId) throw new ErroPublico(400, "Faltou o evento.");

  const ref = db.collection("orgs").doc(org).collection("dados").doc(CHAVE_EVENTOS);
  const resultado = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const eventos = snap.exists ? JSON.parse(snap.data().value || "[]") : [];
    const evento = eventos.find((e) => e.id === eventoId);
    if (!evento || evento.ativo === false || (evento.inscricoesAte && evento.inscricoesAte < hojeSP())) {
      throw new ErroPublico(404, "Esse evento não está mais com inscrições abertas — atualize a página.");
    }
    const extra = { ...camposDaCrianca(evento, body), ...opcaoEscolhida(evento, body) };
    const confirmados = (evento.convidados || []).filter((c) => c.status === "confirmado").length;
    const status = evento.vagas != null && confirmados >= evento.vagas ? "espera" : "confirmado";

    const inscricao = {
      id: "inscricao-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7),
      nomeContato, telefoneContato, ...extra, status, origem: "cliente", vistoPeloStaff: false, criadoEm: new Date().toISOString(),
      pagamento: { status: "pendente" },
    };
    evento.convidados = [...(evento.convidados || []), inscricao];
    tx.set(ref, { value: JSON.stringify(eventos), atualizado: Date.now() });
    return { eventoNome: evento.nome, status, crianca: inscricao.criancaNome || "" };
  });

  /* aviso no celular da coordenação (o aviso é extra: se falhar, a inscrição continua valendo) */
  await P.avisar(admin, { app: "treinador", orgId: org, papel: "coordenador" }, {
    titulo: "Inscrição nova · " + resultado.eventoNome,
    corpo: (resultado.crianca ? resultado.crianca + " (responsável: " + nomeContato + ")" : nomeContato) + (resultado.status === "espera" ? " · lista de espera" : ""),
    url: "/gestao?aba=eventos", tag: "evento-" + eventoId,
  });
  return resposta(200, { ok: true, eventoNome: resultado.eventoNome, status: resultado.status });
}

/* opção de inscrição (1 semana, 2 semanas…): obrigatória quando o evento tem opções; guarda o nome e o valor dela */
function opcaoEscolhida(evento, body) {
  const opcoes = (Array.isArray(evento.opcoes) ? evento.opcoes : []).filter((o) => o && o.id);
  if (!opcoes.length) return evento.valor != null ? { valor: evento.valor } : {};
  const o = opcoes.find((x) => x.id === String(body.opcaoId || ""));
  if (!o) throw new ErroPublico(400, "Escolha uma das opções de inscrição.");
  if (!o.porDia) return { opcaoId: o.id, opcaoNome: String(o.nome || "").slice(0, 80), valor: o.valor ?? null };
  /* diária avulsa: os dias escolhidos precisam ser dias do evento */
  const possiveis = diasUteis(evento.data, evento.dataFim);
  const pedidos = [...new Set((Array.isArray(body.dias) ? body.dias : []).map(String))];
  const dias = pedidos.filter((d) => possiveis.includes(d)).sort();
  if (!pedidos.length) throw new ErroPublico(400, "Escolha pelo menos um dia da diária.");
  if (pedidos.length !== dias.length) throw new ErroPublico(400, "Algum dia escolhido não é dia do evento. Atualize a página.");
  return { opcaoId: o.id, opcaoNome: String(o.nome || "").slice(0, 80), dias, valor: o.valor != null ? Math.round(o.valor * dias.length * 100) / 100 : null };
}
/* dias úteis (segunda a sexta) do evento, de `data` até `dataFim` (no máximo 62 dias) */
function diasUteis(inicio, fim) {
  if (!DATA.test(String(inicio || ""))) return [];
  const out = [], ultimo = DATA.test(String(fim || "")) && fim >= inicio ? fim : inicio;
  for (let d = new Date(inicio + "T12:00:00Z"), n = 0; n < 62; n++, d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    if (iso > ultimo) break;
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) out.push(iso);
  }
  return out;
}

/* evento com faixa de idade (ex.: crianças de 8 a 12 anos): dados da criança e autorização do responsável */
function camposDaCrianca(evento, body) {
  const email = txt(body.email, 120).toLowerCase();
  if (email && !EMAIL.test(email)) throw new ErroPublico(400, "Confira o e-mail.");
  const out = { email, observacoes: txt(body.observacoes, 600), jaAluno: body.jaAluno === "sim" ? "sim" : body.jaAluno === "nao" ? "nao" : "" };
  const paraCriancas = evento.idadeMin != null || evento.idadeMax != null;
  const criancaNome = txt(body.criancaNome, LIMITE_NOME), nasc = String(body.criancaNascimento || "");
  if (!paraCriancas && !criancaNome) return out;
  if (!criancaNome) throw new ErroPublico(400, "Escreva o nome da criança.");
  if (!DATA.test(nasc)) throw new ErroPublico(400, "Informe a data de nascimento da criança.");
  if (body.autorizacao !== true) throw new ErroPublico(400, "Falta a autorização do responsável.");
  const idade = idadeEm(nasc, DATA.test(String(evento.data || "")) ? evento.data : hojeSP());
  if ((evento.idadeMin != null && idade < evento.idadeMin) || (evento.idadeMax != null && idade > evento.idadeMax)) {
    throw new ErroPublico(400, "Este evento é para crianças de " + (evento.idadeMin ?? 0) + " a " + (evento.idadeMax ?? 99) + " anos (na data do evento a criança terá " + idade + ").");
  }
  return { ...out, criancaNome, criancaNascimento: nasc, criancaIdade: idade, autorizacaoEm: new Date().toISOString() };
}

/* cartaz do evento: só a conta da academia envia (JPEG ou PNG em base64, até ~700 KB); fica fora do documento dos eventos */
async function salvarImagem(event, body) {
  const cab = (event.headers && (event.headers.authorization || event.headers.Authorization)) || "";
  let claims = null;
  try { claims = cab.startsWith("Bearer ") ? await admin.auth().verifyIdToken(cab.slice(7)) : null; } catch (e) { claims = null; }
  if (!claims || !claims.orgId) throw new ErroPublico(403, "Entre com a conta da academia para enviar o cartaz.");
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(body.dados || ""));
  if (!m) throw new ErroPublico(400, "Mande uma imagem JPEG, PNG ou WebP.");
  if (m[2].length > 950000) throw new ErroPublico(413, "Imagem grande demais: use uma de até 700 KB.");
  const id = require("crypto").randomBytes(18).toString("hex").slice(0, 24);
  await admin.firestore().collection("eventoImagens").doc(id).set({ org: String(claims.orgId), tipo: m[1], dados: m[2], em: new Date().toISOString(), por: claims.uid });
  return resposta(200, { ok: true, url: "/.netlify/functions/inscricao-torneio-evento?img=" + id });
}
async function servirImagem(id) {
  if (!IMG_ID.test(String(id))) return { statusCode: 400, headers: { "content-type": "text/plain" }, body: "imagem inválida" };
  const d = await admin.firestore().collection("eventoImagens").doc(String(id)).get();
  if (!d.exists) return { statusCode: 404, headers: { "content-type": "text/plain", "cache-control": "no-store" }, body: "não encontrada" };
  return { statusCode: 200, headers: { "content-type": d.data().tipo || "image/jpeg", "cache-control": "public, max-age=31536000, immutable" }, body: d.data().dados, isBase64Encoded: true };
}

function resposta(statusCode, corpo) {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) };
}
