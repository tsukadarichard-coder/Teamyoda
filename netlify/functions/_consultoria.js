/* Consultoria com Richard Tsukada (teamyoda.com.br/richard), Etapa 1: o cliente envia vídeo, o Richard responde.
   Regras sem acesso ao Firestore nem ao Storage (o handler está em consultoria.js), para os testes rodarem sem servidor.

   Firestore (só pelas functions; o navegador nunca lê direto):
   · consultoriaClientes/{uid} → { uid, nome, email, nascimento, menor, responsavel?: { nome, email, aceiteEm }, objetivo,
                                   estado: "pendente" | "ativo" | "pausado", criadoEm, liberadoEm?, atualizadoEm }
   · consultoriaNotas/{uid}    → { texto, atualizadoEm }  (anotação privada do Richard; o cliente nunca recebe)
   · consultoriaEnvios/{id}    → { uid, tipo: "video" | "pergunta", tema, duvida, refEnvio?, estado: "enviando" | "recebido" | "respondido",
                                   criadoEm, recebidoEm?, video?: { caminho, contentType, tamanho, duracaoSeg, md5?, geracao? }, sessao?,
                                   devolutiva?: { texto, viu, treinar: [], midia?: { caminho, tipo, contentType, tamanho }, respondidoEm },
                                   entendidoEm?, videoApagadoEm? }
   Storage (privado, o mesmo bucket do Team Yoda): consultoria/<uid>/<envioId>/<arquivo>. Abre só por link assinado de 10 min.

   Decisões do Richard (12/11/2026, aprovando o plano): começa com clientes de fora; só ele responde; sem cobrança no app (ele combina
   por fora e libera o cliente à mão); vídeo de até 3 minutos, apagado 90 dias depois da devolutiva (a devolutiva fica). */

const TEMAS = [["saque", "Saque"], ["forehand", "Forehand"], ["backhand", "Backhand"], ["rede", "Rede e voleio"], ["devolucao", "Devolução"], ["jogo", "Jogo"], ["outro", "Outro"]];
const TIPOS_VIDEO = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "video/x-m4v": "m4v" };
const TIPOS_RESPOSTA = { "audio/mpeg": ["mp3", "audio"], "audio/mp4": ["m4a", "audio"], "audio/x-m4a": ["m4a", "audio"], "audio/aac": ["aac", "audio"], "audio/webm": ["webm", "audio"], "audio/ogg": ["ogg", "audio"],
  "video/mp4": ["mp4", "video"], "video/quicktime": ["mov", "video"], "video/webm": ["webm", "video"], "video/x-m4v": ["m4v", "video"] };
const LIMITES = {
  duracaoSeg: 180,              // até 3 minutos por vídeo (com 5 s de folga na conferência)
  videoBytes: 600 * 1024 * 1024, // 3 min em 1080p cabem; 4K pode passar e o app avisa para gravar em 1080p
  audioBytes: 40 * 1024 * 1024,
  aguardandoMax: 3,             // vídeos esperando resposta ao mesmo tempo, por cliente (o tempo do Richard é o limite)
  prazoDias: 3,                 // prazo de resposta mostrado na fila
  guardarDias: 90,              // o vídeo do cliente é apagado 90 dias depois da devolutiva
  abandonoDias: 7,              // envio que nunca terminou de subir
  duvidaMax: 1500, textoMax: 5000, treinarMax: 8, itemMax: 160, objetivoMax: 600, notaMax: 8000,
};
const ID = /^[A-Za-z0-9]{12,40}$/, UID = /^[A-Za-z0-9_-]{6,128}$/, DATA = /^\d{4}-\d{2}-\d{2}$/, EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CAMINHO = /^consultoria\/[A-Za-z0-9_-]{6,128}\/[A-Za-z0-9]{12,40}\/(v|r)-[0-9]{10,16}-[a-z0-9]{6}\.(mp4|mov|webm|m4v|mp3|m4a|aac|ogg)$/;
/* endereços que podem enviar direto ao Storage (sessão de envio presa à origem) */
const ORIGENS = [/^https:\/\/(www\.)?teamyoda\.com\.br$/, /^https:\/\/([a-z0-9-]+--)?teamyoda\.netlify\.app$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];

class Erro extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const txt = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ").trim().slice(0, n);
const linha = (v, n) => txt(v, n).replace(/\s+/g, " ");
const tipoBase = (ct) => String(ct || "").toLowerCase().split(";")[0].trim();

/* quem responde: a mesma lista do financeiro (FINANCEIRO_DONOS, padrão o e-mail do Richard), ou CONSULTORIA_RESPONDEM se existir */
function donos() {
  return String(process.env.CONSULTORIA_RESPONDEM || process.env.FINANCEIRO_DONOS || "tsukada.richard@gmail.com").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}
/* mesma regra do financeiro: o e-mail da conta (o Firebase não deixa outra conta usar o mesmo e-mail). Não exige e-mail verificado:
   a conta do Richard foi criada pelo administrador e pode não ter a verificação, e aí ele caía na tela de cliente. */
const ehDono = (claims) => !!(claims && claims.email && donos().includes(String(claims.email).trim().toLowerCase()));

function idade(nascimento, hoje) {
  if (!DATA.test(String(nascimento || "")) || !DATA.test(String(hoje || ""))) return null;
  const [a, m, d] = nascimento.split("-").map(Number), [ha, hm, hd] = hoje.split("-").map(Number);
  return ha - a - (hm < m || (hm === m && hd < d) ? 1 : 0);
}

/* cadastro do cliente (depois de criar a conta): menor de idade precisa do aceite do responsável antes do primeiro envio */
function limparCadastro(b, hoje) {
  const nome = linha(b.nome, 80), nascimento = String(b.nascimento || ""), objetivo = txt(b.objetivo, LIMITES.objetivoMax);
  if (nome.length < 2) throw new Erro(400, "Escreva o nome do atleta.");
  const anos = idade(nascimento, hoje);
  if (anos == null || anos < 5 || anos > 100) throw new Erro(400, "Confira a data de nascimento do atleta.");
  const menor = anos < 18, out = { nome, nascimento, objetivo, menor };
  if (menor) {
    const r = b.responsavel || {}, rn = linha(r.nome, 80), re = String(r.email || "").trim().toLowerCase();
    if (rn.length < 2) throw new Erro(400, "Atleta menor de idade: escreva o nome do responsável.");
    if (!EMAIL.test(re)) throw new Erro(400, "Atleta menor de idade: confira o e-mail do responsável.");
    if (r.aceite !== true) throw new Erro(400, "Atleta menor de idade: o responsável precisa autorizar o envio dos vídeos.");
    out.responsavel = { nome: rn, email: re };
  }
  return out;
}

function temaValido(t) { return TEMAS.some((x) => x[0] === t); }
function rotuloTema(t) { const x = TEMAS.filter((y) => y[0] === t)[0]; return x ? x[1] : "Vídeo"; }

/* pode mandar mais um vídeo? (devolve o motivo quando não pode) */
function motivoSemEnvio(cliente, aguardando) {
  if (!cliente || cliente.cadastroPendente) return "Complete o cadastro antes de enviar.";
  if (cliente.estado === "pendente") return "O Richard ainda vai liberar a sua consultoria. Você recebe um aviso quando estiver pronta.";
  if (cliente.estado !== "ativo") return "A sua consultoria está pausada. Fale com o Richard para retomar.";
  if (cliente.menor && !(cliente.responsavel && cliente.responsavel.aceiteEm)) return "Falta a autorização do responsável.";
  if (aguardando >= LIMITES.aguardandoMax) return "Você já tem " + LIMITES.aguardandoMax + " envios esperando a devolutiva. Assim que o Richard responder, você manda o próximo.";
  return "";
}

function validarVideo(b) {
  const tema = String(b.tema || ""), duvida = txt(b.duvida, LIMITES.duvidaMax), ct = tipoBase(b.contentType), tamanho = Number(b.tamanho), dur = Number(b.duracaoSeg);
  if (!temaValido(tema)) throw new Erro(400, "Escolha sobre o que é o vídeo.");
  if (duvida.length < 3) throw new Erro(400, "Escreva a sua dúvida: o que você quer que o Richard olhe.");
  if (!TIPOS_VIDEO[ct]) throw new Erro(400, "Formato de vídeo não aceito. Use o vídeo da câmera do celular (MP4 ou MOV).");
  if (!Number.isFinite(tamanho) || tamanho <= 0) throw new Erro(400, "O arquivo está vazio.");
  if (tamanho > LIMITES.videoBytes) throw new Erro(400, "O vídeo passa de " + Math.round(LIMITES.videoBytes / 1048576) + " MB. Grave em 1080p (não em 4K) ou corte um trecho menor.");
  /* alguns navegadores não leem a duração de certos vídeos (ex.: MOV em HEVC no Chrome): aí vale só o limite de tamanho */
  const desconhecida = b.duracaoDesconhecida === true && !(dur > 0);
  if (!desconhecida && (!Number.isFinite(dur) || dur <= 0)) throw new Erro(400, "Não foi possível ler a duração do vídeo.");
  if (!desconhecida && dur > LIMITES.duracaoSeg + 5) throw new Erro(400, "O vídeo passa de 3 minutos. Corte o trecho que você quer mostrar e envie de novo.");
  return { tema, duvida, contentType: ct, ext: TIPOS_VIDEO[ct], tamanho: Math.round(tamanho), duracaoSeg: desconhecida ? null : Math.round(dur) };
}
function validarMidiaResposta(b) {
  const ct = tipoBase(b.contentType), t = TIPOS_RESPOSTA[ct], tamanho = Number(b.tamanho);
  if (!t) throw new Erro(400, "Formato não aceito. Use áudio (MP3, M4A, AAC, WebM) ou vídeo (MP4, MOV, WebM).");
  if (!Number.isFinite(tamanho) || tamanho <= 0) throw new Erro(400, "O arquivo está vazio.");
  const lim = t[1] === "audio" ? LIMITES.audioBytes : LIMITES.videoBytes;
  if (tamanho > lim) throw new Erro(400, "O arquivo passa de " + Math.round(lim / 1048576) + " MB.");
  return { contentType: ct, ext: t[0], tipo: t[1], tamanho: Math.round(tamanho), limite: lim };
}
function novoCaminho(uid, envioId, marca, ext) {
  if (!UID.test(String(uid)) || !ID.test(String(envioId))) throw new Erro(400, "Envio inválido.");
  return "consultoria/" + uid + "/" + envioId + "/" + marca + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8).padEnd(6, "0") + "." + ext;
}
const caminhoDoEnvio = (caminho, uid, envioId, marca) => CAMINHO.test(String(caminho || "")) && String(caminho).startsWith("consultoria/" + uid + "/" + envioId + "/" + (marca || ""));
const origemPermitida = (o) => ORIGENS.some((r) => r.test(String(o || "")));

/* link do YouTube (pedido do Richard em 12/11/2026, para testar sem o armazenamento): o vídeo fica no YouTube do cliente, de preferência
   como "Não listado"; aqui só guardamos o código de 11 caracteres e mostramos pelo player do YouTube (sem cookies) */
function idYoutube(url) {
  let u; try { u = new URL(String(url || "").trim()); } catch (e) { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const h = u.hostname.replace(/^(www\.|m\.|music\.)/, ""); let id = null;
  if (h === "youtu.be") id = u.pathname.split("/")[1];
  else if (h === "youtube.com" || h === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else { const m = /^\/(shorts|embed|live|v)\/([^/?#]+)/.exec(u.pathname); if (m) id = m[2]; }
  }
  return /^[A-Za-z0-9_-]{11}$/.test(String(id || "")) ? id : null;
}
function validarLink(b) {
  const tema = String(b.tema || ""), duvida = txt(b.duvida, LIMITES.duvidaMax), id = idYoutube(b.url);
  if (!temaValido(tema)) throw new Erro(400, "Escolha sobre o que é o vídeo.");
  if (duvida.length < 3) throw new Erro(400, "Escreva a sua dúvida: o que você quer que o Richard olhe.");
  if (!id) throw new Erro(400, "Cole o link de um vídeo do YouTube (youtube.com/watch?v=… ou youtu.be/…).");
  return { tema, duvida, youtube: { id } };
}

/* devolutiva: o que o Richard viu, o que treinar e o texto (ao menos o texto ou uma gravação) */
function limparDevolutiva(b, temMidia) {
  const texto = txt(b.texto, LIMITES.textoMax), viu = txt(b.viu, LIMITES.textoMax);
  const treinar = (Array.isArray(b.treinar) ? b.treinar : []).map((x) => linha(x, LIMITES.itemMax)).filter((x) => x.length >= 2).slice(0, LIMITES.treinarMax);
  let youtube = null;
  if (b.linkVideo && String(b.linkVideo).trim()) { const id = idYoutube(b.linkVideo); if (!id) throw new Erro(400, "O link do vídeo da devolutiva não é um link do YouTube."); youtube = { id }; }
  if (!texto && !viu && !temMidia && !youtube) throw new Erro(400, "Escreva a devolutiva, grave um áudio ou cole o link de um vídeo.");
  return youtube ? { texto, viu, treinar, youtube } : { texto, viu, treinar };
}

/* prazo da fila: conta do recebimento */
function prazo(envio, agora) {
  const base = Date.parse(envio.recebidoEm || envio.criadoEm || 0), fim = base + LIMITES.prazoDias * 86400000, t = Date.parse(agora);
  const dia = (ms) => new Date(ms - 3 * 3600000).toISOString().slice(0, 10), hoje = dia(t), venc = dia(fim), amanha = dia(t + 86400000);
  const estado = t > fim ? "atrasado" : venc === hoje ? "vence-hoje" : venc === amanha ? "vence-amanha" : "no-prazo";
  return { venceEm: new Date(fim).toISOString(), estado, rotulo: { atrasado: "Passou do prazo", "vence-hoje": "Vence hoje", "vence-amanha": "Vence amanhã", "no-prazo": "No prazo" }[estado] };
}
function ordenarFila(lista) { return lista.slice().sort((a, b) => String(a.recebidoEm || a.criadoEm).localeCompare(String(b.recebidoEm || b.criadoEm))); }

/* o que vai para o navegador do cliente (sem a sessão de envio de outro aparelho, sem caminhos de arquivo) */
function envioParaCliente(id, e) {
  const d = e.devolutiva;
  return {
    id, tipo: e.tipo, tema: e.tema, rotuloTema: rotuloTema(e.tema), duvida: e.duvida || "", refEnvio: e.refEnvio || null, estado: e.estado, criadoEm: e.criadoEm, recebidoEm: e.recebidoEm || null,
    video: e.video ? { duracaoSeg: e.video.duracaoSeg || null, tamanho: e.video.tamanho || null, apagado: !!e.videoApagadoEm } : null,
    youtube: e.youtube ? { id: e.youtube.id } : null,
    devolutiva: d ? { texto: d.texto || "", viu: d.viu || "", treinar: d.treinar || [], midia: d.midia ? { tipo: d.midia.tipo } : null, youtube: d.youtube ? { id: d.youtube.id } : null, respondidoEm: d.respondidoEm } : null,
    entendidoEm: e.entendidoEm || null, videoApagadoEm: e.videoApagadoEm || null,
    apagarVideoEm: d && !e.videoApagadoEm && e.video ? new Date(Date.parse(d.respondidoEm) + LIMITES.guardarDias * 86400000).toISOString() : null,
  };
}
function clientePublico(c) {
  if (!c) return null;
  return { nome: c.nome, email: c.email || "", nascimento: c.nascimento || "", menor: !!c.menor, responsavel: c.responsavel ? { nome: c.responsavel.nome, email: c.responsavel.email, aceiteEm: c.responsavel.aceiteEm || null } : null,
    objetivo: c.objetivo || "", estado: c.estado, criadoEm: c.criadoEm, liberadoEm: c.liberadoEm || null, cadastroPendente: !!c.cadastroPendente, convidadoEm: c.convidadoEm || null };
}

/* limpeza diária: vídeos com devolutiva há mais de 90 dias; envios que nunca terminaram de subir */
function paraLimpar(envios, agora) {
  const t = Date.parse(agora), apagarVideo = [], abandonados = [];
  for (const { id, e } of envios) {
    if (e.estado === "respondido" && e.video && !e.videoApagadoEm && e.devolutiva && Date.parse(e.devolutiva.respondidoEm) + LIMITES.guardarDias * 86400000 < t) apagarVideo.push({ id, e });
    if (e.estado === "enviando" && Date.parse(e.criadoEm) + LIMITES.abandonoDias * 86400000 < t) abandonados.push({ id, e });
  }
  return { apagarVideo, abandonados };
}

module.exports = { idYoutube, validarLink, TEMAS, TIPOS_VIDEO, TIPOS_RESPOSTA, LIMITES, ID, UID, CAMINHO, Erro, txt, donos, ehDono, idade, limparCadastro, temaValido, rotuloTema, motivoSemEnvio,
  validarVideo, validarMidiaResposta, novoCaminho, caminhoDoEnvio, origemPermitida, limparDevolutiva, prazo, ordenarFila, envioParaCliente, clientePublico, paraLimpar, tipoBase };
