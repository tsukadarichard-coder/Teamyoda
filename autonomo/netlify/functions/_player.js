/* QuadraLab Player — peças compartilhadas pelas functions do app do
   jogador (player-conta, player-dados, player-gerar-plano-background).

   Tudo do jogador mora em jogadores/{uid} no Firestore do QuadraLab, e
   só é lido/escrito por estas functions (Admin SDK) — nunca direto do
   navegador. Por isso não existe regra nova no firestore.rules: sem
   regra que libere jogadores/**, o cliente não alcança esses dados, e
   uma conta de jogador (sem claim orgId) também não alcança orgs/**.

   As opções da ficha são validadas aqui contra listas fechadas: a IA só
   recebe valores conhecidos (mais os textos livres, com tamanho
   limitado), e o app não consegue gravar campo que não existe. */
const { admin, app } = require("./_firebase-admin");
const { FAMILIAS, PORCODIGO, drillsDoNivel } = require("./_player-catalogo");

class ErroPublico extends Error {
  constructor(status, mensagem) { super(mensagem); this.status = status; }
}

function resposta(statusCode, corpo) {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) };
}

/* Login obrigatório: devolve o token decodificado ou lança 401. */
async function usuarioDoPedido(event) {
  const cab = event.headers.authorization || event.headers.Authorization || "";
  const idToken = cab.startsWith("Bearer ") ? cab.slice(7) : null;
  if (!idToken) throw new ErroPublico(401, "Entre na sua conta para continuar.");
  app();
  try {
    return await admin.auth().verifyIdToken(idToken);
  } catch (e) {
    throw new ErroPublico(401, "Sua sessão expirou. Entre de novo.");
  }
}

function refJogador(uid) {
  return admin.firestore().collection("jogadores").doc(uid);
}

/* Contas com acesso completo (sem limite de planos), para teste. Duas fontes:
   · EMAILS_FULL_SHA256 abaixo — SHA-256 do e-mail em minúsculas, para o
     endereço não ficar legível no repositório (público). Para incluir
     alguém: printf '%s' 'email@exemplo.com' | sha256sum
   · PLAYER_EMAILS_FULL no Netlify — e-mails separados por vírgula, se a
     variável estiver configurada (só vale a partir do próximo deploy).
   Vale só para a conta que já existe com esse e-mail (o login do Firebase
   não deixa criar outra com o mesmo e-mail). */
const EMAILS_FULL_SHA256 = [
  "e1126d15075fac96f732a472a63da5782ad3ba8d3f727da3bec8902fa37f679f", // conta de teste do Richard
];
function planoFull(email) {
  const e = String(email || "").trim().toLowerCase();
  if (!e) return false;
  const lista = String(process.env.PLAYER_EMAILS_FULL || "").toLowerCase().split(",").map((x) => x.trim()).filter(Boolean);
  if (lista.includes(e)) return true;
  return EMAILS_FULL_SHA256.includes(require("crypto").createHash("sha256").update(e).digest("hex"));
}

/* ── planos pagos (degraus) ──
   gratis → p1 → p2 → p3, cada um incluindo o anterior:
     p1  planejamento por semanas, com periodicidade
     p2  + treino do dia, com marcação e observações
     p3  + ajuste do planejamento por IA e consultoria
   O nível de quem pagou fica em jogadores/{uid}.planoPago (gravado pelas
   functions de pagamento, fase 2). Contas com acesso completo de teste
   veem tudo. O app só esconde/mostra; quem barra de verdade é o servidor. */
const NIVEIS_PLANO = ["gratis", "p1", "p2", "p3"];
function nivelDoJogador(dados, email) {
  if (planoFull(email)) return "p3";
  const n = String((dados && dados.planoPago) || "gratis");
  return NIVEIS_PLANO.includes(n) ? n : "gratis";
}
function recursosDoNivel(nivel) {
  const i = NIVEIS_PLANO.indexOf(nivel);
  return { planejamento: i >= 1, treinoDia: i >= 2, ajusteIA: i >= 3 };
}

/* Quantos planos o jogador pode gerar de graça. Os seguintes dependem
   de crédito (creditosPlano), que só as functions de pagamento somam. */
const PLANOS_GRATIS = 1;

/* ── opções da ficha (valor gravado → texto mostrado/enviado à IA) ── */
const AREAS = {
  saque: "Saque",
  devolucao: "Devolução",
  direita: "Direita (forehand)",
  esquerda: "Esquerda (backhand)",
  rede: "Jogo de rede (voleio e smash)",
};
const OPCOES = {
  nivel: {
    iniciante: "Iniciante — joga há pouco tempo",
    intermediario: "Intermediário — sustenta trocas e joga partidas",
    avancado: "Avançado — tem golpes consistentes e variados",
    competidor: "Competidor — joga torneios com frequência",
  },
  mao: { destro: "Destro", canhoto: "Canhoto" },
  backhand: { uma: "Esquerda com uma mão", duas: "Esquerda com duas mãos" },
  piso: { saibro: "Saibro", rapida: "Quadra rápida (dura)", ambos: "Os dois" },
  armaPrincipal: AREAS,
  pontoFraco: AREAS,
  padraoPonto: {
    ofensivo: "Ofensivo — busca abreviar o ponto e ataca assim que tem ângulo",
    construtor: "Construtor — sustenta a troca até abrir espaço, sem forçar cedo",
    defensivo: "Defensivo — prioriza não errar e devolve a decisão para o adversário",
  },
  rede: {
    sempre: "Sobe à rede sempre que pode",
    convidado: "Só vai à rede quando é convidado (bola curta)",
    evita: "Evita a rede",
  },
  devolucao: {
    agressiva: "Devolução agressiva — ataca o segundo saque",
    segura: "Devolução segura — prioriza colocar a bola em jogo",
  },
  pressao: {
    mantem: "Sob pressão, mantém o padrão de jogo",
    acelera: "Sob pressão, acelera e arrisca mais",
    trava: "Sob pressão, trava e fica mais conservador",
  },
};
const OPCOES_ADVERSARIO = {
  estilo: {
    ofensivo: "Ofensivo — ataca cedo",
    construtor: "Construtor — sustenta a troca",
    defensivo: "Defensivo — devolve tudo e espera o erro",
    naoSei: "Não sei",
  },
  mao: { destro: "Destro", canhoto: "Canhoto", naoSei: "Não sei" },
};
const CAMPOS_OBRIGATORIOS = ["nivel", "mao", "backhand", "piso", "armaPrincipal", "pontoFraco", "padraoPonto", "rede", "devolucao", "pressao"];
const LIMITE_TEXTO = 500;

function texto(v, limite) { return String(v == null ? "" : v).trim().slice(0, limite || LIMITE_TEXTO); }
function opcao(lista, v) { return Object.prototype.hasOwnProperty.call(lista, v) ? v : ""; }
function multi(lista, v) {
  return Array.isArray(v) ? [...new Set(v.filter((x) => Object.prototype.hasOwnProperty.call(lista, x)))] : [];
}

/* Limpa a ficha vinda do app: só campos conhecidos, só valores válidos. */
function normalizarFicha(f) {
  f = f || {};
  const ficha = {};
  for (const campo of Object.keys(OPCOES)) ficha[campo] = opcao(OPCOES[campo], f[campo]);
  ficha.observacoes = texto(f.observacoes);
  const a = f.adversario || {};
  ficha.adversario = {
    ativo: a.ativo === true,
    nome: texto(a.nome, 60),
    estilo: opcao(OPCOES_ADVERSARIO.estilo, a.estilo),
    mao: opcao(OPCOES_ADVERSARIO.mao, a.mao),
    pontosFortes: multi(AREAS, a.pontosFortes),
    pontosFracos: multi(AREAS, a.pontosFracos),
    observacoes: texto(a.observacoes),
  };
  return ficha;
}

function fichaCompleta(ficha) {
  return CAMPOS_OBRIGATORIOS.every((c) => !!ficha[c]);
}
function adversarioUtil(ficha) {
  const a = ficha.adversario || {};
  return a.ativo && (a.pontosFortes.length > 0 || a.pontosFracos.length > 0 || !!a.observacoes);
}

/* ── pedido à IA ──
   Só os princípios da Metodologia MTY que valem para estratégia de jogo
   (os de periodização de treino ficam de fora — isto não é plano de
   treino). A regra central é a mesma do plano de jogo do app do
   treinador: nenhuma diretriz sem dado da ficha que a sustente. */
const PRINCIPIOS_JOGO = [
  "Três objetivos do jogo, nesta ordem: ganhar a quadra, produzir ângulo, diminuir o tempo.",
  "NUNCA sugerir esperar o adversário errar. Não existe estilo de jogo baseado em esperar o erro do outro.",
  "NUNCA pedir mais efeito na bola de ataque para ela cair dentro. Isso converte ataque em bola de controle.",
  "Velocidade da bola no ar é o motor; consistência e acerto são consequência de pernas e decisão.",
  "Saque, devolução e jogo de rede são obrigatoriedades, não estilos opcionais. Cerca de 65-70% dos pontos terminam em até 4 golpes — saque e devolução decidem o ponto cedo e nenhum plano pode tratá-los como secundários.",
  "Trajetória se define pela função da bola: paralela no ataque busca margem; cruzada para abrir pede mais efeito.",
  "Defesa tem duas formas que coexistem: bola alta para ganhar tempo, e cruzada acelerada. Ambas válidas.",
];

function linhasFicha(ficha) {
  const L = [
    "FICHA DO JOGADOR (autoavaliação — é como ele se vê, não um diagnóstico feito por treinador):",
    "· Nível: " + OPCOES.nivel[ficha.nivel],
    "· Mão: " + OPCOES.mao[ficha.mao] + "; " + OPCOES.backhand[ficha.backhand],
    "· Piso onde mais joga: " + OPCOES.piso[ficha.piso],
    "· Golpe mais forte: " + AREAS[ficha.armaPrincipal],
    "· Ponto mais vulnerável: " + AREAS[ficha.pontoFraco],
    "· Padrão de ponto: " + OPCOES.padraoPonto[ficha.padraoPonto],
    "· Rede: " + OPCOES.rede[ficha.rede],
    "· " + OPCOES.devolucao[ficha.devolucao],
    "· " + OPCOES.pressao[ficha.pressao],
  ];
  if (ficha.observacoes) L.push("· Observações do jogador (texto livre dele): " + ficha.observacoes);
  return L.join("\n");
}

function linhasAdversario(a) {
  const L = ["ADVERSÁRIO (descrito pelo próprio jogador): " + (a.nome || "sem nome")];
  if (a.estilo) L.push("· Estilo: " + OPCOES_ADVERSARIO.estilo[a.estilo]);
  if (a.mao) L.push("· Mão: " + OPCOES_ADVERSARIO.mao[a.mao]);
  if (a.pontosFortes.length) L.push("· Pontos fortes dele: " + a.pontosFortes.map((x) => AREAS[x]).join(", "));
  if (a.pontosFracos.length) L.push("· Pontos fracos dele: " + a.pontosFracos.map((x) => AREAS[x]).join(", "));
  if (a.observacoes) L.push("· Observações sobre ele: " + a.observacoes);
  return L.join("\n");
}

function resumoDrill(d) {
  const obj = (d.o || d.m || "").replace(/\s+/g, " ").trim();
  return d.c + " | " + d.n + " | " + (FAMILIAS[d.f] || d.f) + " | " + (obj.length > 130 ? obj.slice(0, 127) + "..." : obj);
}

function promptPlano(ficha) {
  const comAdversario = adversarioUtil(ficha);
  const drills = drillsDoNivel(ficha.nivel);
  return [
    "Você é o assistente tático da Metodologia MTY, método de tênis do treinador Richard Tsukada,",
    "dentro do QuadraLab Player. Escreva em português do Brasil, falando direto com o jogador (\"você\").",
    comAdversario
      ? "Monte um PLANO TÁTICO para o jogador enfrentar o adversário descrito abaixo."
      : "Monte o PLANO TÁTICO GERAL do jogador: como ele deve construir os pontos a partir do jogo que tem hoje.",
    "O plano tem duas partes: as DIRETRIZES (estratégia) e as JOGADAS (sequências de bolas concretas) com DRILLS para treiná-las.",
    "",
    "PRINCÍPIOS TRAVADOS — obrigatórios:",
    ...PRINCIPIOS_JOGO.map((p, i) => (i + 1) + ". " + p),
    "",
    linhasFicha(ficha),
    ...(comAdversario ? ["", linhasAdversario(ficha.adversario)] : []),
    "",
    "REGRA CENTRAL: cada diretriz e cada jogada precisa se apoiar em dados reais da ficha acima" +
      (comAdversario
        ? " — casar um ponto do jogo do jogador com uma fraqueza registrada do adversário, ou evitar expor um ponto fraco do jogador a uma força registrada dele."
        : " — usar o golpe forte, proteger o ponto vulnerável, ou ajustar o padrão de ponto, a rede, a devolução e a reação sob pressão que ele descreveu."),
    "Nunca invente dado que não esteja na ficha. Se faltar informação para algo importante, registre em \"lacunas\" em vez de supor.",
    "Adapte a linguagem e a ambição ao nível informado: para iniciante, diretrizes e jogadas simples e poucas variáveis.",
    "",
    "JOGADAS: de 3 a 4 opções de jogada que o jogador pode usar em quadra para executar o plano. Cada jogada é uma",
    "sequência curta de bolas (2 a 4 passos, na ordem em que acontecem — por exemplo saque, 1ª bola depois do saque,",
    "finalização), com o momento certo de usá-la. Respeite a mão, o backhand e o piso informados. Jogadas diferentes",
    "entre si (não repita a mesma ideia com outro nome).",
    "",
    "DRILLS: para cada jogada, de 1 a 3 drills do CATÁLOGO abaixo que treinem o que ela exige (o golpe, o padrão ou a decisão).",
    "· Use SOMENTE drills do catálogo, copiando o código exato (a primeira coluna). Nunca invente drill nem código.",
    "· Ordene do mais controlado ao mais livre: padrão novo não entra direto no ponto livre.",
    "· Em \"motivo\", uma frase dizendo qual parte da jogada aquele drill treina.",
    "· Se nenhum drill do catálogo servir a uma jogada, deixe a lista de drills dela vazia, sem forçar um que não serve.",
    "",
    "CATÁLOGO DE DRILLS (código | nome | tipo | objetivo):",
    ...drills.map(resumoDrill),
    "",
    "FORMATO DA RESPOSTA:",
    "· titulo: curto (até 60 caracteres).",
    "· resumo: 2 ou 3 frases com a ideia central do plano.",
    "· diretrizes: de 3 a 5. Cada uma com titulo (curto), acao (o que fazer em quadra, concreto e acionável)",
    "  e porque (qual dado da ficha sustenta essa diretriz, citando-o).",
    "· jogadas: de 3 a 4. Cada uma com titulo, quando (em que situação do jogo usar), sequencia (lista de 2 a 4 passos curtos),",
    "  porque (qual dado da ficha sustenta a jogada) e drills (lista de objetos com codigo e motivo).",
    "· lacunas: de 0 a 3 informações que deixariam o plano melhor (lista vazia se não houver).",
  ].join("\n");
}

const SCHEMA_PLANO = {
  type: "object",
  properties: {
    titulo: { type: "string" },
    resumo: { type: "string" },
    diretrizes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          acao: { type: "string" },
          porque: { type: "string" },
        },
        required: ["titulo", "acao", "porque"],
        additionalProperties: false,
      },
    },
    jogadas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          quando: { type: "string" },
          sequencia: { type: "array", items: { type: "string" } },
          porque: { type: "string" },
          drills: {
            type: "array",
            items: {
              type: "object",
              properties: { codigo: { type: "string" }, motivo: { type: "string" } },
              required: ["codigo", "motivo"],
              additionalProperties: false,
            },
          },
        },
        required: ["titulo", "quando", "sequencia", "porque", "drills"],
        additionalProperties: false,
      },
    },
    lacunas: { type: "array", items: { type: "string" } },
  },
  required: ["titulo", "resumo", "diretrizes", "jogadas", "lacunas"],
  additionalProperties: false,
};

/* Confere o JSON devolvido pela IA antes de mostrar ao jogador. */
function planoValido(p) {
  return !!p && typeof p.titulo === "string" && typeof p.resumo === "string" &&
    Array.isArray(p.diretrizes) && p.diretrizes.length >= 1 &&
    p.diretrizes.every((d) => d && typeof d.titulo === "string" && typeof d.acao === "string" && typeof d.porque === "string") &&
    Array.isArray(p.jogadas) && p.jogadas.length >= 1 &&
    p.jogadas.every((j) => j && typeof j.titulo === "string" && typeof j.quando === "string" && typeof j.porque === "string" &&
      Array.isArray(j.sequencia) && Array.isArray(j.drills)) &&
    Array.isArray(p.lacunas);
}

/* Troca cada código de drill pelo drill real do catálogo (com montagem, carga,
   regressão, progressão...) e descarta o que a IA citou fora da lista do
   nível do jogador: um código que não existe nunca chega ao jogador. O plano
   guarda uma cópia dos dados do drill, então mudar o catálogo depois não
   altera planos já entregues. */
function finalizarPlano(plano, nivel) {
  const permitidos = new Set(drillsDoNivel(nivel).map((d) => d.c));
  plano.diretrizes = plano.diretrizes.slice(0, 5);
  plano.lacunas = plano.lacunas.slice(0, 3);
  plano.jogadas = plano.jogadas.slice(0, 4).map((j) => {
    const vistos = new Set();
    const drills = [];
    for (const r of j.drills) {
      const codigo = String((r && r.codigo) || "").trim().toUpperCase();
      if (!permitidos.has(codigo) || vistos.has(codigo)) continue;
      vistos.add(codigo);
      const d = PORCODIGO[codigo];
      drills.push({
        codigo, nome: d.n, tipo: FAMILIAS[d.f] || d.f,
        motivo: String((r && r.motivo) || "").trim(),
        objetivo: d.o || "", montagem: d.m || "", carga: d.g || "",
        regressao: d.r || "", progressao: d.p || "", corrigir: d.x || "", ignorar: d.i || "",
      });
      if (drills.length === 3) break;
    }
    return {
      titulo: j.titulo, quando: j.quando, porque: j.porque,
      sequencia: j.sequencia.map((x) => String(x)).slice(0, 4), drills,
    };
  });
  return plano;
}

module.exports = {
  admin, app, ErroPublico, resposta, usuarioDoPedido, refJogador,
  PLANOS_GRATIS, planoFull, NIVEIS_PLANO, nivelDoJogador, recursosDoNivel, PRINCIPIOS_JOGO, linhasFicha, resumoDrill, AREAS, OPCOES, OPCOES_ADVERSARIO,
  normalizarFicha, fichaCompleta, adversarioUtil, promptPlano, SCHEMA_PLANO, planoValido, finalizarPlano,
};
