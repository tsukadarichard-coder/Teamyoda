/* Consultoria com Richard Tsukada (teamyoda.com.br/richard), Etapa 1: enviar e responder. Regras em _consultoria.js.

   Conta: a mesma do Team Yoda (Firebase Auth do projeto). Sem cobrança no app: o cliente cria a conta e o cadastro, e o Richard libera.

   GET (login) → cliente: { papel: "cliente", cliente, envios, temas, limites, motivoSemEnvio }
               → Richard: { papel: "richard", fila, clientes, respondidos, temas, limites }
   POST:
     { acao: "criarConta", nome, email, senha }                       (sem login) → { ok }
   cliente:
     { acao: "cadastro", nome, nascimento, objetivo, responsavel? }    → { cliente }   (entra como "pendente")
     { acao: "envioIniciar", tema, duvida, contentType, tamanho, duracaoSeg } → { envioId, sessao }
     { acao: "envioRetomar", envioId }                                 → { sessao, tamanho }
     { acao: "envioConcluir", envioId }                                → { envio }
     { acao: "envioCancelar", envioId }                                → { ok }
     { acao: "pergunta", envioId, texto }                              → { envio }   (dúvida em texto sobre uma devolutiva)
     { acao: "entendi", envioId }                                      → { envio }
   cliente (o próprio) ou Richard:
     { acao: "verVideo", envioId } · { acao: "verResposta", envioId }  → { url, contentType }
   Richard:
     { acao: "cliente", uid }                                          → { cliente, nota, envios }
     { acao: "liberar" | "pausar", uid }                               → { cliente }
     { acao: "nota", uid, texto }                                      → { ok }
     { acao: "respostaIniciar", envioId, contentType, tamanho }        → { sessao, caminho, tipo }
     { acao: "responder", envioId, texto, viu, treinar, midia?: { caminho } } → { envio }
     { acao: "prepararArmazenamento" }                                 → { bucket } */
const { admin, app } = require("./_firebase-admin");
const C = require("./_consultoria");
const ARQ = require("./_consultoria-armazenamento");
const P = require("./_push");

const { Erro } = C;
const resposta = (statusCode, corpo) => ({ statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(corpo) });
const agora = () => new Date().toISOString();
const hojeBR = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
const db = () => admin.firestore();
const clientes = () => db().collection("consultoriaClientes");
const envios = () => db().collection("consultoriaEnvios");
const SITE = ["https://teamyoda.com.br", "https://www.teamyoda.com.br"];

async function quem(event) {
  const cab = (event.headers && (event.headers.authorization || event.headers.Authorization)) || "";
  const tk = cab.startsWith("Bearer ") ? cab.slice(7) : "";
  if (!tk) return null;
  try { return await admin.auth().verifyIdToken(tk); } catch (e) { throw new Erro(401, "Sua sessão expirou. Entre de novo."); }
}
async function lerCliente(uid) { const s = await clientes().doc(uid).get(); return s.exists ? s.data() : null; }
async function lerEnvio(id) {
  if (!C.ID.test(String(id || ""))) throw new Erro(400, "Envio inválido.");
  const s = await envios().doc(id).get();
  if (!s.exists) throw new Erro(404, "Envio não encontrado.");
  return s.data();
}
async function enviosDe(uid) {
  const s = await envios().where("uid", "==", uid).get(), out = [];
  s.docs.forEach((d) => out.push({ id: d.id, e: d.data() }));
  return out.sort((a, b) => String(b.e.criadoEm).localeCompare(String(a.e.criadoEm)));
}
const aguardando = (lista) => lista.filter((x) => x.e.estado === "recebido").length;
function origemDo(event) {
  const o = (event.headers && (event.headers.origin || event.headers.Origin)) || "";
  if (!C.origemPermitida(o)) throw new Erro(400, "Abra a consultoria pelo endereço teamyoda.com.br/richard para enviar arquivos.");
  return o;
}
function avisarRichard(titulo, corpo, url) { return P.avisar(admin, { app: "consultoria", papel: "richard" }, { titulo, corpo, url: url || "/richard/#/fila", tag: "consultoria-fila" }); }
function avisarCliente(uid, titulo, corpo, url) { return P.avisar(admin, { app: "consultoria", uid }, { titulo, corpo, url: url || "/richard/", tag: "consultoria" }); }
const primeiro = (n) => String(n || "").split(" ")[0];

/* ── cliente ── */
async function criarConta(b) {
  const nome = C.txt(b.nome, 80), email = String(b.email || "").trim().toLowerCase(), senha = String(b.senha || "");
  if (nome.length < 2) throw new Erro(400, "Escreva o seu nome.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Erro(400, "E-mail inválido.");
  if (senha.length < 8) throw new Erro(400, "A senha precisa ter pelo menos 8 caracteres.");
  try { await admin.auth().createUser({ email, password: senha, displayName: nome }); }
  catch (e) {
    if (e && (e.code === "auth/email-already-exists" || /already/i.test(String(e.message)))) throw new Erro(409, "Já existe uma conta com este e-mail (pode ser a da Área do aluno ou da Academia Digital). Entre com ela.");
    throw new Erro(400, "Não foi possível criar a conta com estes dados.");
  }
  return { ok: true };
}
async function cadastro(claims, b) {
  const atual = await lerCliente(claims.uid), c = C.limparCadastro(b, hojeBR()), t = agora();
  if (c.responsavel) c.responsavel.aceiteEm = (atual && atual.responsavel && atual.responsavel.email === c.responsavel.email && atual.responsavel.aceiteEm) || t;
  const novo = { ...(atual || {}), ...c, uid: claims.uid, email: String(claims.email || "").toLowerCase(), estado: atual ? atual.estado : "pendente", criadoEm: atual ? atual.criadoEm : t, atualizadoEm: t };
  if (!c.responsavel) delete novo.responsavel;
  await clientes().doc(claims.uid).set(novo);
  if (!atual) await avisarRichard("Novo cliente na consultoria", novo.nome + " pediu para entrar. Libere na tela de clientes.", "/richard/#/clientes");
  return { cliente: C.clientePublico(novo) };
}
async function envioIniciar(event, claims, b) {
  const cli = await lerCliente(claims.uid), lista = await enviosDe(claims.uid);
  const motivo = C.motivoSemEnvio(cli, aguardando(lista));
  if (motivo) throw new Erro(cli && cli.estado === "ativo" ? 409 : 403, motivo);
  const v = C.validarVideo(b), origem = origemDo(event), ref = envios().doc(), caminho = C.novoCaminho(claims.uid, ref.id, "v", v.ext);
  const sessao = await ARQ.sessaoDeEnvio(caminho, v.contentType, origem);
  await ref.set({ uid: claims.uid, tipo: "video", tema: v.tema, duvida: v.duvida, estado: "enviando", criadoEm: agora(), sessao,
    video: { caminho, contentType: v.contentType, tamanho: v.tamanho, duracaoSeg: v.duracaoSeg } });
  return { envioId: ref.id, sessao, tamanho: v.tamanho };
}
async function meuEnvio(claims, id, estado) {
  const e = await lerEnvio(id);
  if (e.uid !== claims.uid) throw new Erro(404, "Envio não encontrado.");
  if (estado && e.estado !== estado) throw new Erro(409, estado === "enviando" ? "Este envio já foi concluído." : "Este envio ainda não tem devolutiva.");
  return e;
}
async function envioConcluir(claims, b) {
  const e = await meuEnvio(claims, b.envioId, "enviando"), v = e.video, f = await ARQ.conferir(v.caminho);
  if (!f.existe) throw new Erro(409, "O vídeo ainda não chegou inteiro. Continue o envio.");
  if (f.tamanho !== v.tamanho || !C.TIPOS_VIDEO[f.contentType] || f.tamanho > C.LIMITES.videoBytes) {
    await ARQ.apagar(v.caminho);
    await envios().doc(b.envioId).delete();
    throw new Erro(400, "O vídeo chegou diferente do arquivo escolhido. Envie de novo.");
  }
  const t = agora(), novo = { ...e, estado: "recebido", recebidoEm: t, video: { ...v, md5: f.md5, geracao: f.geracao } };
  delete novo.sessao;
  await envios().doc(b.envioId).set(novo);
  const cli = await lerCliente(claims.uid);
  await avisarRichard("Vídeo novo: " + C.rotuloTema(e.tema), (cli ? cli.nome : "Cliente") + " mandou um vídeo para a consultoria.", "/richard/#/responder/" + b.envioId);
  return { envio: C.envioParaCliente(b.envioId, novo) };
}
async function envioCancelar(claims, b) {
  const e = await meuEnvio(claims, b.envioId, "enviando");
  if (e.video) await ARQ.apagar(e.video.caminho);
  await envios().doc(b.envioId).delete();
  return { ok: true };
}
async function pergunta(claims, b) {
  const ref0 = await meuEnvio(claims, b.envioId, "respondido"), texto = C.txt(b.texto, C.LIMITES.duvidaMax);
  if (texto.length < 3) throw new Erro(400, "Escreva a sua dúvida.");
  const cli = await lerCliente(claims.uid), lista = await enviosDe(claims.uid), motivo = C.motivoSemEnvio(cli, aguardando(lista));
  if (motivo) throw new Erro(409, motivo);
  const ref = envios().doc(), t = agora();
  const novo = { uid: claims.uid, tipo: "pergunta", tema: ref0.tema, duvida: texto, refEnvio: b.envioId, estado: "recebido", criadoEm: t, recebidoEm: t };
  await ref.set(novo);
  await avisarRichard("Dúvida sobre uma devolutiva", (cli ? cli.nome : "Cliente") + ": " + texto.slice(0, 90), "/richard/#/responder/" + ref.id);
  return { envio: C.envioParaCliente(ref.id, novo) };
}
async function entendi(claims, b) {
  const e = await meuEnvio(claims, b.envioId, "respondido");
  if (!e.entendidoEm) { e.entendidoEm = agora(); await envios().doc(b.envioId).set(e); }
  return { envio: C.envioParaCliente(b.envioId, e) };
}
async function verArquivo(claims, dono, b, qual) {
  const e = await lerEnvio(b.envioId);
  if (!dono && e.uid !== claims.uid) throw new Erro(404, "Envio não encontrado.");
  if (qual === "video") {
    if (!e.video || e.estado === "enviando") throw new Erro(404, "Este envio não tem vídeo.");
    if (e.videoApagadoEm) throw new Erro(410, "O vídeo foi apagado " + C.LIMITES.guardarDias + " dias depois da devolutiva. A devolutiva continua aqui.");
    return { ...(await ARQ.urlDeLeitura(e.video.caminho, e.video.contentType)), contentType: e.video.contentType };
  }
  const m = e.devolutiva && e.devolutiva.midia;
  if (!m) throw new Erro(404, "Esta devolutiva não tem gravação.");
  return { ...(await ARQ.urlDeLeitura(m.caminho, m.contentType)), contentType: m.contentType, tipo: m.tipo };
}

/* ── Richard ── */
async function painel() {
  const [sc, sr, se] = await Promise.all([clientes().get(), envios().where("estado", "==", "recebido").get(), envios().where("estado", "==", "respondido").get()]);
  const cli = {}; sc.docs.forEach((d) => { cli[d.id] = d.data(); });
  const t = agora();
  const fila = C.ordenarFila(sr.docs.map((d) => ({ id: d.id, ...d.data() }))).map((e) => ({
    id: e.id, uid: e.uid, cliente: cli[e.uid] ? cli[e.uid].nome : "Cliente", tipo: e.tipo, tema: e.tema, rotuloTema: C.rotuloTema(e.tema), duvida: e.duvida, recebidoEm: e.recebidoEm, prazo: C.prazo(e, t),
    duracaoSeg: e.video ? e.video.duracaoSeg : null }));
  const contagem = {}; se.docs.forEach((d) => { const u = d.data().uid; contagem[u] = (contagem[u] || 0) + 1; });
  const naFila = {}; fila.forEach((e) => { naFila[e.uid] = (naFila[e.uid] || 0) + 1; });
  const lista = Object.keys(cli).map((uid) => ({ uid, ...C.clientePublico(cli[uid]), respondidos: contagem[uid] || 0, naFila: naFila[uid] || 0 }))
    .sort((a, b) => (a.estado === "pendente" ? 0 : 1) - (b.estado === "pendente" ? 0 : 1) || String(a.nome).localeCompare(String(b.nome), "pt-BR"));
  return { fila, clientes: lista, respondidos: se.size };
}
async function fichaCliente(b) {
  if (!C.UID.test(String(b.uid || ""))) throw new Erro(400, "Cliente inválido.");
  const c = await lerCliente(b.uid); if (!c) throw new Erro(404, "Cliente não encontrado.");
  const n = await db().collection("consultoriaNotas").doc(b.uid).get(), lista = await enviosDe(b.uid), t = agora();
  return { cliente: { uid: b.uid, ...C.clientePublico(c) }, nota: n.exists ? n.data().texto || "" : "",
    envios: lista.filter((x) => x.e.estado !== "enviando").map((x) => ({ ...C.envioParaCliente(x.id, x.e), prazo: x.e.estado === "recebido" ? C.prazo(x.e, t) : null })) };
}
async function mudarEstado(b, estado) {
  if (!C.UID.test(String(b.uid || ""))) throw new Erro(400, "Cliente inválido.");
  const c = await lerCliente(b.uid); if (!c) throw new Erro(404, "Cliente não encontrado.");
  const t = agora(), novo = { ...c, estado, atualizadoEm: t };
  if (estado === "ativo" && !c.liberadoEm) novo.liberadoEm = t;
  await clientes().doc(b.uid).set(novo);
  if (estado === "ativo" && c.estado !== "ativo") await avisarCliente(b.uid, "Consultoria liberada", "Pronto, " + primeiro(c.nome) + ": já pode mandar o primeiro vídeo para o Richard.", "/richard/#/enviar");
  return { cliente: { uid: b.uid, ...C.clientePublico(novo) } };
}
async function nota(b) {
  if (!C.UID.test(String(b.uid || ""))) throw new Erro(400, "Cliente inválido.");
  if (!(await lerCliente(b.uid))) throw new Erro(404, "Cliente não encontrado.");
  await db().collection("consultoriaNotas").doc(b.uid).set({ texto: C.txt(b.texto, C.LIMITES.notaMax), atualizadoEm: agora() });
  return { ok: true };
}
async function respostaIniciar(event, b) {
  const e = await lerEnvio(b.envioId);
  if (e.estado !== "recebido") throw new Erro(409, "Este envio não está na fila.");
  const m = C.validarMidiaResposta(b), caminho = C.novoCaminho(e.uid, b.envioId, "r", m.ext);
  const sessao = await ARQ.sessaoDeEnvio(caminho, m.contentType, origemDo(event));
  return { sessao, caminho, tipo: m.tipo, tamanho: m.tamanho };
}
async function responder(claims, b) {
  const e = await lerEnvio(b.envioId);
  if (e.estado !== "recebido") throw new Erro(409, "Este envio já foi respondido.");
  let midia = null;
  if (b.midia && b.midia.caminho) {
    if (!C.caminhoDoEnvio(b.midia.caminho, e.uid, b.envioId, "r-")) throw new Erro(400, "Gravação inválida.");
    const f = await ARQ.conferir(b.midia.caminho), t = C.TIPOS_RESPOSTA[f.contentType];
    if (!f.existe) throw new Erro(409, "A gravação ainda não chegou inteira. Espere terminar de enviar.");
    if (!t || f.tamanho > (t[1] === "audio" ? C.LIMITES.audioBytes : C.LIMITES.videoBytes)) { await ARQ.apagar(b.midia.caminho); throw new Erro(400, "Gravação em formato ou tamanho não aceito."); }
    midia = { caminho: b.midia.caminho, tipo: t[1], contentType: f.contentType, tamanho: f.tamanho };
  }
  const d = C.limparDevolutiva(b, !!midia), t = agora();
  const novo = { ...e, estado: "respondido", devolutiva: { ...d, ...(midia ? { midia } : {}), respondidoEm: t, por: String(claims.email || "").toLowerCase() } };
  await envios().doc(b.envioId).set(novo);
  const c = await lerCliente(e.uid);
  await avisarCliente(e.uid, "Devolutiva do Richard", (c ? primeiro(c.nome) + ", a" : "A") + " devolutiva " + (e.tipo === "pergunta" ? "da sua dúvida" : "do seu vídeo de " + C.rotuloTema(e.tema).toLowerCase()) + " chegou.", "/richard/#/envio/" + b.envioId);
  return { envio: C.envioParaCliente(b.envioId, novo) };
}

exports.handler = async function (event) {
  try {
    app();
    if (event.httpMethod !== "GET" && event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });
    if (String(event.body || "").length > 20000) return resposta(413, { erro: "Pedido grande demais." });
    let b = {};
    if (event.httpMethod === "POST") { try { b = JSON.parse(event.body || "{}"); } catch (e) { return resposta(400, { erro: "Pedido inválido." }); } }
    if (b.acao === "criarConta") return resposta(200, await criarConta(b));
    const claims = await quem(event);
    if (!claims) return resposta(401, { erro: "Entre com a sua conta." });
    const dono = C.ehDono(claims), base = { temas: C.TEMAS, limites: { duracaoSeg: C.LIMITES.duracaoSeg, videoMB: Math.round(C.LIMITES.videoBytes / 1048576), aguardandoMax: C.LIMITES.aguardandoMax, guardarDias: C.LIMITES.guardarDias, prazoDias: C.LIMITES.prazoDias } };

    if (event.httpMethod === "GET") {
      if (dono) return resposta(200, { papel: "richard", ...base, ...(await painel()) });
      const cli = await lerCliente(claims.uid), lista = await enviosDe(claims.uid);
      return resposta(200, { papel: "cliente", ...base, cliente: C.clientePublico(cli), envios: lista.filter((x) => x.e.estado !== "enviando").map((x) => C.envioParaCliente(x.id, x.e)),
        interrompidos: lista.filter((x) => x.e.estado === "enviando").map((x) => ({ id: x.id, tema: x.e.tema, rotuloTema: C.rotuloTema(x.e.tema), tamanho: x.e.video.tamanho, criadoEm: x.e.criadoEm })),
        motivoSemEnvio: C.motivoSemEnvio(cli, aguardando(lista)) });
    }

    const a = b.acao;
    if (a === "verVideo" || a === "verResposta") return resposta(200, await verArquivo(claims, dono, b, a === "verVideo" ? "video" : "resposta"));
    if (dono) {
      if (a === "cliente") return resposta(200, await fichaCliente(b));
      if (a === "liberar") return resposta(200, await mudarEstado(b, "ativo"));
      if (a === "pausar") return resposta(200, await mudarEstado(b, "pausado"));
      if (a === "nota") return resposta(200, await nota(b));
      if (a === "respostaIniciar") return resposta(200, await respostaIniciar(event, b));
      if (a === "responder") return resposta(200, await responder(claims, b));
      if (a === "prepararArmazenamento") return resposta(200, { bucket: await ARQ.prepararCors(SITE) });
    }
    if (a === "cadastro") return resposta(200, await cadastro(claims, b));
    if (a === "envioIniciar") return resposta(200, await envioIniciar(event, claims, b));
    if (a === "envioRetomar") { const e = await meuEnvio(claims, b.envioId, "enviando"); return resposta(200, { sessao: e.sessao, tamanho: e.video.tamanho }); }
    if (a === "envioConcluir") return resposta(200, await envioConcluir(claims, b));
    if (a === "envioCancelar") return resposta(200, await envioCancelar(claims, b));
    if (a === "pergunta") return resposta(200, await pergunta(claims, b));
    if (a === "entendi") return resposta(200, await entendi(claims, b));
    return resposta(dono ? 400 : 403, { erro: dono ? "Ação desconhecida." : "Ação não permitida." });
  } catch (e) {
    if (e instanceof Erro) return resposta(e.status, { erro: e.message });
    console.error("consultoria:", e);
    return resposta(500, { erro: /Bucket|Armazenamento/.test(String(e && e.message)) ? String(e.message) : "Não foi possível agora. Tente de novo." });
  }
};
