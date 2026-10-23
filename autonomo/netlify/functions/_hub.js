/* QuadraLab Hub — regras puras do encontro entre profissionais (QuadraLab Treinador) e jogadores (Player e Competição).
   Sem Firebase: os handlers hub-profissional, hub-busca, hub-atendimentos e admin-hub leem/gravam e chamam estas funções.

   Regras comerciais (não mudam preço nem cobrança):
   · publicar o perfil é benefício do plano de entrada (essencial) e superiores; o estado vem do que o webhook da Eduzz já grava em
     orgs/{orgId}/meta/info (plano + planoAtivoAte). Quem cancela a renovação mantém o benefício até planoAtivoAte; estorno/chargeback
     já derrubam o plano no webhook (comportamento existente, não alterado aqui);
   · publicar exige assinatura ativa E a escolha explícita do profissional — nunca acontece sozinho depois de um pagamento;
   · buscar e pedir é gratuito para o jogador; não há comissão nem pagamento pela plataforma;
   · a ordem da busca nunca considera plano pago, patrocínio ou preço mais baixo.

   Coleções (só o servidor lê e grava; sem regra no firestore.rules, o navegador não alcança):
   hubProfissionais/{uid}            perfil, serviços, estado escolhido pelo profissional, moderação, métricas do profissional
   hubFotos/{uid}                    foto (data URL JPEG pequena), servida só enquanto o perfil está visível
   hubPedidos/{id}                   pedido, propostas versionadas, aceite, conclusão, não lidas
   hubPedidos/{id}/mensagens/{id}    conversa privada do pedido
   hubAvaliacoes/{pedidoId}          uma avaliação por atendimento concluído
   hubNotificacoes/{uid}/itens/{id}  avisos dentro do app
   hubDenuncias/{id}, hubBloqueios/{prof__pessoa}, hubMetricas/{AAAA-MM-DD} */

const ID = /^[A-Za-z0-9_-]{10,60}$/;
const ID_SERVICO = /^[a-z0-9]{6,16}$/;

const CATEGORIAS = [
  { id: "aula_individual", nome: "Aula individual", foco: "player" },
  { id: "aula_dupla", nome: "Aula em dupla", foco: "player" },
  { id: "aula_grupo", nome: "Aula em grupo", foco: "player" },
  { id: "iniciacao", nome: "Iniciação ao tênis", foco: "player" },
  { id: "aperfeicoamento", nome: "Aperfeiçoamento técnico e tático", foco: "player" },
  { id: "torneios", nome: "Preparação para torneios", foco: "competicao" },
  { id: "temporada", nome: "Planejamento da temporada", foco: "competicao" },
  { id: "remoto", nome: "Acompanhamento remoto", foco: "ambos" },
  { id: "estrategia", nome: "Orientação de estratégia", foco: "competicao" },
];
const NOME_CATEGORIA = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c.nome]));
const PUBLICOS = { criancas: "Crianças", juvenis: "Juvenis", adultos: "Adultos" };
const NIVEIS = { iniciante: "Iniciante", intermediario: "Intermediário", avancado: "Avançado", competicao: "Competição" };
const MODALIDADES = { presencial: "Presencial", remoto: "Remoto", ambos: "Presencial e remoto" };
const FORMATOS = { individual: "Individual", dupla: "Dupla", grupo: "Grupo" };
const UNIDADES = { aula: "por aula", pessoa: "por pessoa", pacote: "por pacote", mes: "por mês" };
const TIPOS_PRECO = { fixo: "Valor fixo", a_partir_de: "A partir de", sob_consulta: "Sob consulta" };
const EXIBICAO = { player: "QuadraLab Player", competicao: "QuadraLab Competição", ambos: "Player e Competição" };
const DIAS = { seg: "Seg", ter: "Ter", qua: "Qua", qui: "Qui", sex: "Sex", sab: "Sáb", dom: "Dom" };
const TURNOS = { manha: "Manhã", tarde: "Tarde", noite: "Noite" };
const SLOTS = Object.keys(DIAS).flatMap((d) => Object.keys(TURNOS).map((t) => d + "-" + t));
const OBJETIVOS = {
  comecar: { nome: "Começar a jogar", categorias: ["iniciacao", "aula_individual", "aula_grupo"] },
  tecnica: { nome: "Melhorar a técnica", categorias: ["aperfeicoamento", "aula_individual", "aula_dupla", "remoto"] },
  tatica: { nome: "Melhorar tática e estratégia", categorias: ["estrategia", "aperfeicoamento", "remoto"] },
  regularidade: { nome: "Jogar com regularidade", categorias: ["aula_grupo", "aula_dupla", "aula_individual"] },
  torneios: { nome: "Preparar para torneios", categorias: ["torneios", "estrategia", "aula_individual"] },
  temporada: { nome: "Planejar a temporada", categorias: ["temporada", "remoto", "torneios"] },
};
const MAX_SERVICOS = 12;

/* estados do perfil (o que o profissional escolhe) e o estado efetivo (o que vale para a busca) */
const ESTADOS_ESCOLHA = ["rascunho", "publicado", "pausado"];
const ROTULO_PERFIL = {
  rascunho: "Rascunho", publicado: "Publicado", pausado: "Pausado",
  indisponivel_assinatura: "Indisponível: assinatura inativa", suspenso: "Suspenso pela moderação",
};

/* pedidos de atendimento */
const ESTADOS_PEDIDO = {
  aguardando_responsavel: "Aguardando o responsável",
  aguardando_resposta: "Aguardando resposta",
  em_conversa: "Em conversa",
  proposta_enviada: "Proposta enviada",
  combinado: "Combinado",
  concluido: "Concluído",
  recusado: "Recusado",
  cancelado: "Cancelado",
  encerrado_sem_acordo: "Encerrado sem acordo",
};
const ABERTOS = ["aguardando_responsavel", "aguardando_resposta", "em_conversa", "proposta_enviada", "combinado"];
const FINAIS = ["concluido", "recusado", "cancelado", "encerrado_sem_acordo"];
const MAX_ABERTOS_POR_PESSOA = 10;

const TEXTO_ENVIO = "Seu pedido será enviado a este profissional. Disponibilidade, valor e condições serão combinados diretamente.";
const TEXTO_ENVIADO = "Pedido enviado. Você poderá acompanhar a resposta em Meus atendimentos.";
const TEXTO_ACEITE = "Você está confirmando as condições combinadas com o profissional. O pagamento será realizado diretamente com ele.";

const MOTIVOS_DENUNCIA = {
  informacao_falsa: "Informação falsa ou enganosa", conduta: "Conduta inadequada", assedio: "Assédio ou ofensa",
  spam: "Spam ou propaganda", menor: "Risco a menor de idade", outro: "Outro motivo",
};

/* ── utilitários ── */
const hojeBR = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const agora = () => new Date().toISOString();
const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
function idAleatorio(n) { const a = "abcdefghijkmnpqrstuvwxyz23456789", b = require("crypto").randomBytes(n || 10); let s = ""; for (const x of b) s += a[x % a.length]; return s; }

/* texto limpo: sem caracteres de controle (mantém quebras de linha), espaços aparados; null se passar do limite */
function txt(v, max, multilinha) {
  if (v === undefined || v === null) return "";
  let s = String(v).replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "");
  s = multilinha ? s.replace(/\n{3,}/g, "\n\n").trim() : s.replace(/\s+/g, " ").trim();
  return s.length > max ? null : s;
}
const lista = (v) => (Array.isArray(v) ? v : []);
const subconjunto = (v, permitido) => [...new Set(lista(v).map(String))].filter((x) => Object.prototype.hasOwnProperty.call(permitido, x));

/* dado de contato ou documento em texto público: e-mail, telefone (8+ dígitos seguidos ou com separadores), link, CPF */
function temContatoPrivado(s) {
  const t = String(s || "");
  if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(t)) return "e-mail";
  if (/(https?:\/\/|www\.|wa\.me|instagram\.com|\.com\.br\b)/i.test(t)) return "link";
  if (/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/.test(t)) return "documento";
  if (/(\d[\s().-]*){8,}/.test(t)) return "telefone";
  return null;
}

/* ── assinatura (lida do que já existe; nunca grava cobrança) ── */
const PLANOS_COM_PUBLICACAO = ["essencial", "premium"];
function assinaturaAtiva(info, hoje) {
  const i = info || {};
  if (!PLANOS_COM_PUBLICACAO.includes(i.plano)) return false;
  return !i.planoAtivoAte || String(i.planoAtivoAte) >= (hoje || hojeBR());
}

function estadoEfetivo(p, elegivel) {
  if (!p) return "rascunho";
  if (p.moderacao && p.moderacao.suspenso) return "suspenso";
  const e = ESTADOS_ESCOLHA.includes(p.estado) ? p.estado : "rascunho";
  if (e === "publicado" && !elegivel) return "indisponivel_assinatura";
  return e;
}
const visivelNaBusca = (p, elegivel) => estadoEfetivo(p, elegivel) === "publicado";
/* recebe pedido novo só se visível e aceitando novos alunos */
const recebePedidos = (p, elegivel) => visivelNaBusca(p, elegivel) && p.aceitandoNovos !== false;

/* ── perfil ── */
function validarServico(s, idsUsados) {
  const e = [];
  const o = {};
  o.id = s && typeof s.id === "string" && ID_SERVICO.test(s.id) && !idsUsados.has(s.id) ? s.id : idAleatorio(10);
  idsUsados.add(o.id);
  o.nome = txt(s.nome, 80);
  if (!o.nome || o.nome.length < 3) e.push("Dê um nome ao serviço (3 a 80 letras).");
  o.categoria = NOME_CATEGORIA[s.categoria] ? s.categoria : null;
  if (!o.categoria) e.push("Escolha a categoria do serviço “" + (o.nome || "sem nome") + "”.");
  o.descricao = txt(s.descricao, 500, true);
  if (o.descricao === null) e.push("A descrição do serviço tem até 500 letras.");
  o.publicos = subconjunto(s.publicos, PUBLICOS);
  o.niveis = subconjunto(s.niveis, NIVEIS);
  o.modalidade = MODALIDADES[s.modalidade] ? s.modalidade : "presencial";
  o.formato = FORMATOS[s.formato] ? s.formato : "individual";
  const d = s.duracaoMin === "" || s.duracaoMin == null ? null : Number(s.duracaoMin);
  if (d !== null && !(Number.isInteger(d) && d >= 15 && d <= 480)) e.push("Duração entre 15 e 480 minutos.");
  o.duracaoMin = d;
  o.frequencia = txt(s.frequencia, 60);
  o.local = txt(s.local, 80);
  if (o.frequencia === null || o.local === null) e.push("Frequência e local têm até 60 e 80 letras.");
  o.precoTipo = TIPOS_PRECO[s.precoTipo] ? s.precoTipo : "sob_consulta";
  o.unidade = UNIDADES[s.unidade] ? s.unidade : null;
  if (o.precoTipo === "sob_consulta") { o.precoCentavos = null; }
  else {
    const c = Number(s.precoCentavos);
    if (!Number.isInteger(c) || c < 100 || c > 10000000) e.push("Informe o valor do serviço “" + (o.nome || "") + "”.");
    if (!o.unidade) e.push("Informe a unidade do valor (aula, pessoa, pacote ou mês).");
    o.precoCentavos = Number.isInteger(c) ? c : null;
  }
  o.incluiQuadra = s.incluiQuadra === true;
  o.incluiMateriais = s.incluiMateriais === true;
  o.abertoNovos = s.abertoNovos !== false;
  for (const k of ["nome", "descricao", "local", "frequencia"]) { const c = temContatoPrivado(o[k]); if (c) e.push("Tire o " + c + " do serviço: contatos são combinados na conversa."); }
  return { o, e };
}

function validarPerfil(b) {
  const e = [], o = {};
  o.nomeProfissional = txt(b.nomeProfissional, 80);
  if (!o.nomeProfissional || o.nomeProfissional.length < 2) e.push("Informe o nome profissional.");
  o.apresentacao = txt(b.apresentacao, 300, true);
  if (o.apresentacao === null) e.push("A apresentação tem até 300 letras.");
  o.biografia = txt(b.biografia, 1500, true);
  if (o.biografia === null) e.push("A biografia tem até 1.500 letras.");
  o.cidade = txt(b.cidade, 60);
  o.uf = /^[A-Za-z]{2}$/.test(String(b.uf || "")) ? String(b.uf).toUpperCase() : "";
  o.regioes = lista(b.regioes).map((x) => txt(x, 60)).filter(Boolean).slice(0, 10);
  o.locais = lista(b.locais).map((x) => txt(x, 80)).filter(Boolean).slice(0, 6);
  o.modalidade = MODALIDADES[b.modalidade] ? b.modalidade : "presencial";
  o.publicos = subconjunto(b.publicos, PUBLICOS);
  o.niveis = subconjunto(b.niveis, NIVEIS);
  const anos = b.experienciaAnos === "" || b.experienciaAnos == null ? null : Number(b.experienciaAnos);
  if (anos !== null && !(Number.isInteger(anos) && anos >= 0 && anos <= 60)) e.push("Anos de experiência entre 0 e 60.");
  o.experienciaAnos = anos;
  o.experiencia = txt(b.experiencia, 500, true);
  o.formacao = txt(b.formacao, 500, true);
  if (o.experiencia === null || o.formacao === null || o.cidade === null) e.push("Experiência e formação têm até 500 letras; cidade, até 60.");
  o.idiomas = lista(b.idiomas).map((x) => txt(x, 30)).filter(Boolean).slice(0, 6);
  o.disponibilidade = [...new Set(lista(b.disponibilidade))].filter((x) => SLOTS.includes(x));
  o.aceitandoNovos = b.aceitandoNovos !== false;
  o.exibicao = EXIBICAO[b.exibicao] ? b.exibicao : "ambos";
  const servs = lista(b.servicos);
  if (servs.length > MAX_SERVICOS) e.push("Até " + MAX_SERVICOS + " serviços.");
  const usados = new Set();
  o.servicos = [];
  for (const s of servs.slice(0, MAX_SERVICOS)) { const r = validarServico(s || {}, usados); o.servicos.push(r.o); e.push(...r.e); }
  for (const k of ["nomeProfissional", "apresentacao", "biografia", "experiencia", "formacao", "cidade"]) {
    const c = temContatoPrivado(o[k]);
    if (c) e.push("Tire o " + c + " do perfil público: contatos ficam na conversa privada de cada pedido.");
  }
  for (const l of o.locais.concat(o.regioes)) { const c = temContatoPrivado(l); if (c) { e.push("Locais e regiões não podem ter " + c + "."); break; } }
  return { ok: !e.length, erros: [...new Set(e)], perfil: o };
}

/* o que falta para publicar (o rascunho pode ficar incompleto) */
function faltasParaPublicar(p) {
  const f = [];
  if (!p.nomeProfissional) f.push("nome profissional");
  if (!p.apresentacao) f.push("apresentação");
  if (p.modalidade !== "remoto" && !p.cidade) f.push("cidade");
  if (!(p.publicos || []).length) f.push("públicos atendidos");
  if (!(p.niveis || []).length) f.push("níveis atendidos");
  if (!(p.servicos || []).length) f.push("pelo menos um serviço");
  return f;
}

function completude(p, temFoto) {
  const itens = [!!p.nomeProfissional, !!temFoto, !!p.apresentacao, !!p.biografia, !!p.cidade || p.modalidade === "remoto", (p.locais || []).length > 0 || p.modalidade === "remoto",
    (p.publicos || []).length > 0, (p.niveis || []).length > 0, !!p.experiencia || p.experienciaAnos != null, !!p.formacao, (p.idiomas || []).length > 0,
    (p.disponibilidade || []).length > 0, (p.servicos || []).length > 0, (p.servicos || []).some((s) => !!s.descricao)];
  return Math.round((100 * itens.filter(Boolean).length) / itens.length);
}

const reais = (c) => "R$ " + (c / 100).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d),)/g, ".");
function precoTexto(s) {
  if (!s || s.precoTipo === "sob_consulta" || s.precoCentavos == null) return "Sob consulta";
  return (s.precoTipo === "a_partir_de" ? "A partir de " : "") + reais(s.precoCentavos) + " " + (UNIDADES[s.unidade] || "");
}

function servicoPublico(s) {
  return {
    id: s.id, nome: s.nome, categoria: s.categoria, categoriaNome: NOME_CATEGORIA[s.categoria], descricao: s.descricao || "", publicos: s.publicos || [], niveis: s.niveis || [],
    modalidade: s.modalidade, formato: s.formato, duracaoMin: s.duracaoMin, frequencia: s.frequencia || "", local: s.local || "",
    precoTipo: s.precoTipo, precoCentavos: s.precoCentavos, unidade: s.unidade, preco: precoTexto(s), incluiQuadra: !!s.incluiQuadra, incluiMateriais: !!s.incluiMateriais, abertoNovos: s.abertoNovos !== false,
  };
}

/* perfil como os jogadores veem: sem orgId, e-mail, métricas, moderação ou comprovantes */
function perfilPublico(uid, p, extra) {
  const x = extra || {};
  return {
    uid, nomeProfissional: p.nomeProfissional, foto: x.temFoto ? "/.netlify/functions/hub-busca?foto=" + uid + "&v=" + encodeURIComponent(p.fotoVersao || "1") : null,
    apresentacao: p.apresentacao || "", biografia: p.biografia || "", cidade: p.cidade || "", uf: p.uf || "", regioes: p.regioes || [], locais: p.locais || [],
    modalidade: p.modalidade, publicos: p.publicos || [], niveis: p.niveis || [], experienciaAnos: p.experienciaAnos, experiencia: p.experiencia || "", formacao: p.formacao || "",
    idiomas: p.idiomas || [], disponibilidade: p.disponibilidade || [], aceitandoNovos: p.aceitandoNovos !== false, exibicao: p.exibicao,
    servicos: (p.servicos || []).map(servicoPublico),
    verificado: p.verificacao && p.verificacao.verificado ? { em: p.verificacao.em, itens: p.verificacao.itens || [] } : null,
    declarado: "Experiência e formação informadas pelo profissional.",
    avaliacoes: x.avaliacoes || [], mediaAvaliacoes: x.media || null,
  };
}

/* ── busca ── */
function normFiltros(q, modo) {
  const f = {};
  f.modo = modo === "competicao" ? "competicao" : "player";
  f.cidade = semAcento(txt(q.cidade, 60) || "");
  f.modalidade = ["presencial", "remoto"].includes(q.modalidade) ? q.modalidade : "";
  f.objetivo = OBJETIVOS[q.objetivo] ? q.objetivo : "";
  f.nivel = NIVEIS[q.nivel] ? q.nivel : "";
  f.publico = PUBLICOS[q.publico] ? q.publico : "";
  f.categoria = NOME_CATEGORIA[q.categoria] ? q.categoria : "";
  f.dias = String(q.disponibilidade || "").split(",").filter((x) => SLOTS.includes(x));
  f.unidade = UNIDADES[q.unidade] ? q.unidade : "";
  const mx = q.precoMax === "" || q.precoMax == null ? null : Number(q.precoMax);
  f.precoMaxCentavos = f.unidade && Number.isFinite(mx) && mx > 0 ? Math.round(mx * 100) : null;
  f.somenteRemoto = q.somenteRemoto === "1" || q.somenteRemoto === true;
  return f;
}
const atendeRemoto = (m) => m === "remoto" || m === "ambos";
const atendePresencial = (m) => m === "presencial" || m === "ambos";

/* serviços que passam nos filtros; [] = profissional fora do resultado */
function servicosCompativeis(p, f) {
  const local = !f.cidade || semAcento(p.cidade) === f.cidade || (p.regioes || []).some((r) => semAcento(r) === f.cidade);
  return (p.servicos || []).filter((s) => {
    if (s.abertoNovos === false) return false;
    const mod = s.modalidade || p.modalidade;
    if (f.somenteRemoto || f.modalidade === "remoto") { if (!atendeRemoto(mod)) return false; }
    else if (f.modalidade === "presencial") { if (!atendePresencial(mod) || !local) return false; }
    else if (!local && !atendeRemoto(mod)) return false; // fora da cidade: só o remoto aparece
    if (f.categoria && s.categoria !== f.categoria) return false;
    if (f.nivel && !(s.niveis && s.niveis.length ? s.niveis : p.niveis || []).includes(f.nivel)) return false;
    if (f.publico && !(s.publicos && s.publicos.length ? s.publicos : p.publicos || []).includes(f.publico)) return false;
    if (f.precoMaxCentavos != null) {
      if (s.precoTipo === "sob_consulta" || s.unidade !== f.unidade || s.precoCentavos == null || s.precoCentavos > f.precoMaxCentavos) return false;
    }
    return true;
  });
}

/* pontuação: compatibilidade com os filtros e o foco do app, disponibilidade declarada e completude — nunca plano, patrocínio ou preço */
function pontuar(p, servs, f, comp) {
  let s = 0;
  const cats = new Set(servs.map((x) => x.categoria));
  /* o serviço principal do objetivo pesa mais que os complementares */
  if (f.objetivo) OBJETIVOS[f.objetivo].categorias.forEach((c, i) => { if (cats.has(c)) s += i === 0 ? 15 : 3; });
  const foco = CATEGORIAS.filter((c) => c.foco === f.modo).map((c) => c.id);
  s += Math.min(3, foco.filter((c) => cats.has(c)).length) * 3;
  if (p.exibicao === f.modo) s += 2;
  if (f.cidade && semAcento(p.cidade) === f.cidade) s += 4;
  if (f.dias.length) s += (p.disponibilidade || []).filter((d) => f.dias.includes(d)).length * 3;
  else s += Math.min(6, (p.disponibilidade || []).length) * 0.5;
  if (p.aceitandoNovos !== false) s += 5;
  s += comp / 10;
  return s;
}
/* desempate estável por dia: ninguém fica sempre na frente por acaso */
function desempate(uid, dia) { let h = 2166136261; for (const ch of uid + "|" + dia) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

function cartao(uid, p, servs, temFoto) {
  const comPreco = servs.filter((s) => s.precoTipo !== "sob_consulta" && s.precoCentavos != null);
  const base = comPreco.length ? comPreco.reduce((a, b) => (a.unidade === b.unidade ? (b.precoCentavos < a.precoCentavos ? b : a) : a)) : null;
  return {
    uid, nomeProfissional: p.nomeProfissional, foto: temFoto ? "/.netlify/functions/hub-busca?foto=" + uid + "&v=" + encodeURIComponent(p.fotoVersao || "1") : null,
    local: p.modalidade === "remoto" || !p.cidade ? "Atendimento remoto" : p.cidade + (p.uf ? " · " + p.uf : ""),
    remoto: atendeRemoto(p.modalidade) || servs.some((s) => atendeRemoto(s.modalidade)),
    especialidades: [...new Set(servs.map((s) => NOME_CATEGORIA[s.categoria]))].slice(0, 3),
    publicos: (p.publicos || []).map((x) => PUBLICOS[x]), niveis: (p.niveis || []).map((x) => NIVEIS[x]),
    preco: base ? precoTexto({ ...base, precoTipo: comPreco.length > 1 || base.precoTipo === "a_partir_de" ? "a_partir_de" : "fixo" }) : "Sob consulta",
    aceitandoNovos: p.aceitandoNovos !== false, verificado: !!(p.verificacao && p.verificacao.verificado),
  };
}

/* perfis: [{ uid, p, elegivel, temFoto }] */
function buscar(perfis, f, dia) {
  const out = [];
  for (const x of perfis) {
    if (!visivelNaBusca(x.p, x.elegivel)) continue;
    if (x.p.exibicao && x.p.exibicao !== "ambos" && x.p.exibicao !== f.modo) continue;
    if (f.publico && !(x.p.publicos || []).includes(f.publico) && !(x.p.servicos || []).some((s) => (s.publicos || []).includes(f.publico))) continue;
    if (f.dias.length && (x.p.disponibilidade || []).length && !(x.p.disponibilidade || []).some((d) => f.dias.includes(d))) continue;
    const servs = servicosCompativeis(x.p, f);
    if (!servs.length) continue;
    const comp = completude(x.p, x.temFoto);
    out.push({ c: cartao(x.uid, x.p, servs, x.temFoto), s: pontuar(x.p, servs, f, comp), d: desempate(x.uid, dia || hojeBR()) });
  }
  out.sort((a, b) => b.s - a.s || a.d - b.d);
  return out.map((x) => x.c);
}

/* ── pedidos ── */
function validarPedido(b) {
  const e = [], o = {};
  o.servicoId = b.servicoId ? String(b.servicoId) : "";
  o.objetivo = OBJETIVOS[b.objetivo] ? b.objetivo : "";
  if (!o.objetivo) e.push("Escolha o objetivo.");
  o.nivel = NIVEIS[b.nivel] ? b.nivel : "";
  if (!o.nivel) e.push("Escolha o nível.");
  o.modalidade = ["presencial", "remoto"].includes(b.modalidade) ? b.modalidade : "";
  if (!o.modalidade) e.push("Escolha presencial ou remoto.");
  o.cidade = txt(b.cidade, 60);
  if (o.modalidade === "presencial" && !o.cidade) e.push("Informe a cidade para o atendimento presencial.");
  if (o.modalidade === "remoto") o.cidade = "";
  o.disponibilidade = [...new Set(lista(b.disponibilidade))].filter((x) => SLOTS.includes(x));
  if (!o.disponibilidade.length) e.push("Marque pelo menos um dia e turno.");
  o.mensagem = txt(b.mensagem, 1000, true);
  if (o.mensagem === null) e.push("A mensagem tem até 1.000 letras.");
  o.orcamento = txt(b.orcamento, 80);
  if (o.orcamento === null) e.push("O orçamento tem até 80 letras.");
  return { ok: !e.length, erros: e, pedido: o };
}

/* proposta estruturada do profissional; cada envio vira uma versão nova e imutável */
function validarProposta(b, hoje) {
  const e = [], o = {};
  o.servico = txt(b.servico, 80); if (!o.servico) e.push("Informe o serviço.");
  o.modalidade = ["presencial", "remoto"].includes(b.modalidade) ? b.modalidade : ""; if (!o.modalidade) e.push("Escolha presencial ou remoto.");
  o.local = txt(b.local, 120); if (o.modalidade === "presencial" && !o.local) e.push("Informe o local.");
  o.dataHora = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(String(b.dataHora || "")) ? String(b.dataHora) : "";
  o.dataHoraTexto = txt(b.dataHoraTexto, 120);
  if (!o.dataHora && !o.dataHoraTexto) e.push("Informe a data e o horário (ou como serão combinados).");
  const d = b.duracaoMin === "" || b.duracaoMin == null ? null : Number(b.duracaoMin);
  if (d !== null && !(Number.isInteger(d) && d >= 15 && d <= 480)) e.push("Duração entre 15 e 480 minutos.");
  o.duracaoMin = d;
  o.quantidade = txt(b.quantidade, 80); if (!o.quantidade) e.push("Informe a quantidade ou o período (ex.: 4 aulas em 1 mês).");
  const v = Number(b.valorTotalCentavos);
  if (!Number.isInteger(v) || v < 0 || v > 100000000) e.push("Informe o valor total.");
  o.valorTotalCentavos = Number.isInteger(v) ? v : null;
  o.unidade = UNIDADES[b.unidade] ? b.unidade : ""; if (!o.unidade) e.push("Informe a unidade do valor.");
  o.incluidos = txt(b.incluidos, 300, true);
  o.custosAdicionais = txt(b.custosAdicionais, 300, true);
  o.formaPagamento = txt(b.formaPagamento, 120); if (!o.formaPagamento) e.push("Informe a forma de pagamento combinada diretamente.");
  o.cancelamento = txt(b.cancelamento, 300, true); if (!o.cancelamento) e.push("Informe as condições de cancelamento.");
  o.validade = /^\d{4}-\d{2}-\d{2}$/.test(String(b.validade || "")) ? String(b.validade) : "";
  if (!o.validade || o.validade < (hoje || hojeBR())) e.push("Informe até quando a proposta vale (hoje ou depois).");
  for (const k of Object.keys(o)) if (o[k] === null) { e.push("Um dos campos passou do tamanho permitido."); break; }
  return { ok: !e.length, erros: [...new Set(e)], proposta: o };
}
const propostaVigente = (ped) => (ped.propostas || []).slice().reverse().find((x) => x.estado === "vigente") || null;

/* próxima ação de cada lado, para a lista e para a conversa */
function proximaAcao(ped, lado, hoje) {
  const v = propostaVigente(ped);
  const vencida = v && v.validade < (hoje || hojeBR());
  switch (ped.estado) {
    case "aguardando_responsavel": return lado === "responsavel" ? "Confirme o envio do pedido" : lado === "profissional" ? null : "Aguardando a confirmação do responsável";
    case "aguardando_resposta": return lado === "profissional" ? "Responda ao pedido" : "Aguardando a resposta do profissional";
    case "em_conversa": return lado === "profissional" ? "Envie uma proposta quando estiver pronto" : "Converse com o profissional";
    case "proposta_enviada":
      if (vencida) return lado === "profissional" ? "A proposta venceu: envie uma nova versão" : "A proposta venceu: peça uma nova";
      return lado === "profissional" ? "Aguardando a decisão sobre a proposta" : lado === "atleta_menor" ? "Seu responsável decide a proposta" : "Aceite, recuse ou peça ajuste na proposta";
    case "combinado":
      if (v) return lado === "profissional" ? "Alteração enviada: aguardando aceite" : lado === "atleta_menor" ? null : "Há uma alteração da proposta para decidir";
      if (ped.conclusao && ped.conclusao.marcadoPor === "profissional") return lado === "profissional" ? "Aguardando a confirmação da conclusão" : lado === "atleta_menor" ? null : "Confirme se o atendimento foi concluído";
      return lado === "profissional" ? "Marque como concluído quando terminar" : "Atendimento combinado";
    case "concluido": return lado !== "profissional" && lado !== "atleta_menor" && !ped.avaliado ? "Avalie o atendimento" : null;
    default: return null;
  }
}

/* resumo do pedido para cada lado: o profissional nunca recebe e-mail, nascimento ou dados de acompanhamento */
function pedidoParaLado(id, ped, uid, lado, hoje) {
  return {
    id, estado: ped.estado, rotulo: ESTADOS_PEDIDO[ped.estado] || ped.estado, lado,
    profissional: { uid: ped.profissionalUid, nome: ped.profissionalNome },
    contratante: { nome: ped.contratanteNome, papel: ped.contratantePapel },
    atleta: { nome: ped.atletaNome, menor: !!ped.menor },
    pedido: ped.pedido, servicoNome: ped.servicoNome || "A combinar", origem: ped.origem,
    propostas: ped.propostas || [], aceite: ped.aceite || null, conclusao: ped.conclusao || null, avaliado: !!ped.avaliado,
    naoLidas: (ped.naoLidas || {})[uid] || 0, proximaAcao: proximaAcao(ped, lado, hoje),
    criadoEm: ped.criadoEm, atualizadoEm: ped.atualizadoEm, historico: (ped.historico || []).map((h) => ({ em: h.em, acao: h.acao })),
  };
}

module.exports = {
  ID, ID_SERVICO, CATEGORIAS, NOME_CATEGORIA, PUBLICOS, NIVEIS, MODALIDADES, FORMATOS, UNIDADES, TIPOS_PRECO, EXIBICAO, DIAS, TURNOS, SLOTS, OBJETIVOS,
  ESTADOS_ESCOLHA, ROTULO_PERFIL, ESTADOS_PEDIDO, ABERTOS, FINAIS, MAX_ABERTOS_POR_PESSOA, MAX_SERVICOS, MOTIVOS_DENUNCIA,
  TEXTO_ENVIO, TEXTO_ENVIADO, TEXTO_ACEITE, PLANOS_COM_PUBLICACAO,
  hojeBR, agora, txt, semAcento, idAleatorio, temContatoPrivado, assinaturaAtiva, estadoEfetivo, visivelNaBusca, recebePedidos,
  validarPerfil, faltasParaPublicar, completude, precoTexto, reais, servicoPublico, perfilPublico, normFiltros, servicosCompativeis, buscar, cartao,
  validarPedido, validarProposta, propostaVigente, proximaAcao, pedidoParaLado,
};
