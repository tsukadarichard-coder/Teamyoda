/* QuadraLab Player — assinaturas, consumo e consultorias.

   Tudo o que é COMERCIAL do Player mora aqui, num só lugar configurável:
   o catálogo de assinaturas, as consultorias e os links de suporte/termos.
   O app só mostra o que estiver configurado — nada de preço, desconto,
   limite ou condição inventados.

   ── Como configurar uma assinatura ──
   Acrescente um objeto em CATALOGO (cada produto é uma contratação na
   Eduzz, separada da assinatura do QuadraLab para treinadores):

     {
       id: "player-treino-mensal",        // identificador interno, único
       eduzzProductId: "1234567",         // productId da Eduzz (data.items[0].productId no webhook)
       checkoutUrl: "https://sun.eduzz.com/1234567",  // endereço real do checkout
       nivel: "p1",                       // p1 | p2 | p3 (o que a assinatura libera — ver recursosDoNivel)
       nome: "…", paraQuem: "…",          // textos mostrados na comparação
       periodicidade: "mensal",           // mensal | trimestral | semestral | anual
       precoCentavos: 0,                  // TOTAL cobrado a cada periodicidade, em centavos (ex.: 2990 = R$ 29,90)
       duracaoDias: 32,                   // dias de acesso por pagamento confirmado
       cobrancaAutomatica: true,          // true = renova sozinha (o app não mostra "Renovar")
       beneficios: ["…"],                 // frases de benefícios (só o que for verdade)
       limites: { estrategiasPorPeriodo: 5, programasPorPeriodo: 3 },  // opcional; sem o campo = sem limite definido
       destaque: false,                   // opcional: realça na comparação
     }

   Um produto só aparece para contratação quando tem eduzzProductId,
   checkoutUrl, precoCentavos, periodicidade e duracaoDias. Enquanto
   CATALOGO estiver vazio, o app diz que as assinaturas ainda não estão
   disponíveis e leva ao contato real — não mostra checkout sem destino.

   O acesso só é liberado pelo webhook da Eduzz (webhook-eduzz.js),
   conferido no servidor — nunca pelo botão, pelo endereço de retorno
   ou pelo estado do navegador. */
const CATALOGO = [];

/* ── Consultorias: serviços individuais do Richard Tsukada ──
   Contratados à parte, por contratação, sem renovação automática, e NÃO incluídos na assinatura da plataforma.
   Esta é a única fonte dos textos, preços, prazos e limites: o app só desenha o que está aqui, então cartão,
   detalhes, solicitação e mensagem de contato nunca divergem.

   Preços: o app mostra só o preço de LANÇAMENTO (precoCentavos). precoRegularPrevistoCentavos fica guardado para
   avaliação futura: nunca é mostrado, riscado ou comparado, e nada muda sozinho — trocar de preço é editar
   precoCentavos aqui, de propósito.

   Condições (pagamento, remarcação, cancelamento): escreva em POLITICAS quando forem definidas; enquanto
   estiverem null o app diz apenas que serão informadas no atendimento, antes de qualquer cobrança.

   Contato: o WhatsApp real abaixo. Ainda não há checkout nem agenda integrados — a solicitação sai montada para
   esse contato e pagamento e horário são confirmados lá. */
const WHATSAPP = "5511941773228";

const POLITICAS = {
  pagamento: null,    // ex.: "Pix ou cartão, combinado no atendimento."
  remarcacao: null,   // ex.: "Remarcação até 24 h antes do horário."
  cancelamento: null, // ex.: "…"
};

const LIMITE_HORAS_ANALISE = 6;
const PARTIDAS_ANALISE = 3;
const CONSULTORIAS = [
  {
    id: "revisao-estrategia", tipo: "revisao",
    nome: "Revisão de estratégia",
    descricao: "Ajuste seu plano de jogo com orientações de Richard a partir da sua ficha, dos seus objetivos e da estratégia atual.",
    indicadoPara: "Jogadores que já possuem uma estratégia estruturada ou que já passaram por uma análise e precisam de ajustes pontuais.",
    principais: ["Revisão de uma estratégia existente", "Três prioridades definidas", "Explicação em áudio de até cinco minutos"],
    inclui: [
      "Leitura da ficha e dos objetivos.",
      "Revisão de uma estratégia existente.",
      "Ajustes no plano de jogo.",
      "Definição de três prioridades.",
      "Explicação em áudio de até cinco minutos.",
      "Uma rodada de esclarecimentos por mensagem, enviada em até sete dias após a entrega.",
    ],
    naoInclui: ["Avaliação de partidas em vídeo.", "Diagnóstico completo do jogador.", "Videochamada.", "Acompanhamento contínuo."],
    prazo: "Até três dias úteis após o recebimento completo das informações.",
    prazoCurto: "Até 3 dias úteis após o recebimento completo das informações",
    unidadePreco: "por revisão",
    precoCentavos: 14900, precoRegularPrevistoCentavos: 19900,
    botao: "Solicitar revisão",
  },
  {
    id: "analise-completa", tipo: "analise",
    nome: "Análise completa do jogador",
    descricao: "Richard assiste a três partidas completas para identificar padrões do seu jogo e transformar essa observação em prioridades práticas de evolução.",
    indicadoPara: "Jogadores que querem entender os padrões que se repetem nas suas partidas.",
    regra: "A análise exige três partidas completas. Não é feita com apenas 15 minutos, melhores momentos ou pequenos recortes.",
    principais: ["Observação integral de três partidas completas", "Vídeo comentado e relatório objetivo", "Plano de ação com prioridades de treino"],
    material: [
      "Três partidas completas.",
      "Preferencialmente contra adversários diferentes.",
      "Ficha com objetivos e dificuldades percebidas.",
      "Informações sobre cada partida: data, superfície, placar e identificação do jogador analisado.",
      "Gravação que permita acompanhar o jogador e a dinâmica dos pontos.",
    ],
    escopoPreco: "O preço publicado cobre até seis horas de gravação somadas entre as três partidas.",
    acimaDoLimite: "Se a soma passar de seis horas, o pedido é encaminhado para avaliação do volume e orçamento antes do pagamento. As três partidas continuam sendo analisadas por inteiro: o material não é cortado automaticamente e nada é cobrado a mais sem que você veja o valor e aceite.",
    inclui: [
      "Observação integral das três partidas.",
      "Identificação de padrões recorrentes.",
      "Avaliação das decisões e da construção dos pontos.",
      "Observação do posicionamento e das transições.",
      "Identificação de pontos fortes e vulnerabilidades.",
      "Devolutiva em vídeo comentado com trechos selecionados.",
      "Relatório objetivo com as principais conclusões.",
      "Plano de ação com prioridades e orientações para os próximos treinos.",
      "Uma rodada de esclarecimentos por mensagem, enviada em até sete dias após a entrega.",
    ],
    naoInclui: ["Videochamada, salvo contratação do pacote correspondente.", "Acompanhamento contínuo.", "Nova análise de partidas enviadas posteriormente."],
    prazo: "De sete a dez dias úteis após a confirmação de que todo o material está completo e utilizável.",
    prazoCurto: "7 a 10 dias úteis após a confirmação de que o material está completo",
    unidadePreco: "por análise (até 6 horas de gravação)",
    precoCentavos: 119000, precoRegularPrevistoCentavos: 149000,
    botao: "Solicitar análise completa",
  },
  {
    id: "consultoria-ao-vivo", tipo: "ao-vivo",
    nome: "Consultoria ao vivo",
    descricao: "Uma conversa individual com Richard para discutir suas dificuldades, esclarecer decisões e definir os próximos passos para o seu jogo.",
    indicadoPara: "Jogadores que querem conversar sobre dúvidas e definir próximos passos.",
    principais: ["Videochamada de 50 minutos", "Orientações personalizadas", "Resumo com plano de ação"],
    inclui: [
      "Videochamada de 50 minutos.",
      "Leitura prévia da ficha e das perguntas enviadas.",
      "Discussão dos objetivos e dificuldades.",
      "Orientações personalizadas.",
      "Resumo com plano de ação.",
    ],
    naoInclui: ["Assistir previamente a três partidas ou realizar uma análise completa em vídeo."],
    aviso: "A sessão não inclui assistir previamente a três partidas nem realizar uma análise completa em vídeo. As orientações se baseiam nas informações fornecidas e, quando houver, em uma análise já contratada.",
    prazo: "Videochamada de 50 minutos, em horário confirmado no contato.",
    prazoCurto: "Videochamada de 50 minutos",
    unidadePreco: "por sessão",
    precoCentavos: 29900, precoRegularPrevistoCentavos: 34900,
    botao: "Solicitar agendamento", // sem agenda integrada; com agenda real, trocar para "Agendar consultoria"
  },
  {
    id: "analise-mais-consultoria", tipo: "completa",
    nome: "Análise completa + consultoria",
    selo: "Experiência completa",
    descricao: "Entenda os padrões do seu jogo e converse com Richard sobre como aplicar as prioridades identificadas.",
    indicadoPara: "Jogadores que querem a análise das partidas e uma conversa para aplicar as orientações.",
    principais: ["Todas as entregas da análise completa", "Videochamada de 50 minutos após a entrega", "Alinhamento das prioridades de treino"],
    inclui: [
      "Todas as entregas da Análise completa do jogador.",
      "Videochamada de 50 minutos após a entrega da análise.",
      "Discussão dos resultados e alinhamento das prioridades de treino.",
    ],
    naoInclui: ["Acompanhamento contínuo.", "Nova análise de partidas enviadas posteriormente."],
    prazo: "Análise: de sete a dez dias úteis após a confirmação de que todo o material está completo e utilizável. Videochamada de 50 minutos depois da entrega.",
    escopoPreco: "O preço publicado cobre até seis horas de gravação somadas entre as três partidas.",
    acimaDoLimite: "Se a soma passar de seis horas, o pedido é encaminhado para avaliação do volume e orçamento antes do pagamento. As três partidas continuam sendo analisadas por inteiro: o material não é cortado automaticamente e nada é cobrado a mais sem que você veja o valor e aceite.",
    prazoCurto: "Análise em 7 a 10 dias úteis após a confirmação do material; depois, videochamada de 50 minutos",
    unidadePreco: "pelo atendimento completo (até 6 horas de gravação)",
    precoCentavos: 149000, precoRegularPrevistoCentavos: 179000,
    botao: "Solicitar atendimento completo",
  },
];

/* Endereços reais de apoio. Deixe null o que ainda não existir: o app
   simplesmente não mostra o link (nada de página vazia). */
const LINKS = {
  termos: null,              // ex.: "https://quadralab.com.br/termos"
  privacidade: null,         // ex.: "https://quadralab.com.br/privacidade"
  gerenciarPagamento: null,  // área da Eduzz em que o cliente gerencia pagamentos e cancela
  historicoPagamentos: null, // página da Eduzz com as faturas do cliente, se houver
};

const NIVEIS = ["p1", "p2", "p3"];
const PERIODICIDADES = { mensal: "mês", trimestral: "trimestre", semestral: "semestre", anual: "ano" };

function produtoCompleto(p) {
  return !!(p && p.id && p.eduzzProductId && /^https:\/\//.test(String(p.checkoutUrl || "")) && NIVEIS.includes(p.nivel) &&
    Number.isInteger(p.precoCentavos) && p.precoCentavos > 0 && PERIODICIDADES[p.periodicidade] && Number.isInteger(p.duracaoDias) && p.duracaoDias > 0);
}
function produtoPorEduzz(id, catalogo) {
  const c = catalogo || CATALOGO;
  return c.find((p) => String(p.eduzzProductId) === String(id) && produtoCompleto(p)) || null;
}
function produtoPorId(id, catalogo) {
  return (catalogo || CATALOGO).find((p) => p.id === id) || null;
}
/* o que o app recebe: só produtos completos, sem nada além do necessário */
function catalogoPublico(catalogo) {
  return (catalogo || CATALOGO).filter(produtoCompleto).map((p) => ({
    id: p.id, nivel: p.nivel, nome: p.nome, paraQuem: p.paraQuem || "", periodicidade: p.periodicidade,
    precoCentavos: p.precoCentavos, cobrancaAutomatica: !!p.cobrancaAutomatica, checkoutUrl: p.checkoutUrl,
    beneficios: Array.isArray(p.beneficios) ? p.beneficios.map(String) : [],
    limites: p.limites || null, destaque: !!p.destaque,
  }));
}
/* O que o app recebe: só o preço de lançamento e as regras publicadas. O preço regular previsto nunca sai do servidor. */
function consultoriasPublicas() {
  return CONSULTORIAS.map((c) => {
    const { precoRegularPrevistoCentavos, ...publico } = c; // eslint-disable-line no-unused-vars
    return { ...publico, ...(c.tipo === "analise" || c.tipo === "completa" ? { partidas: PARTIDAS_ANALISE, limiteHoras: LIMITE_HORAS_ANALISE } : {}) };
  });
}
function politicasPublicas() {
  const p = {};
  for (const k of Object.keys(POLITICAS)) if (POLITICAS[k]) p[k] = String(POLITICAS[k]);
  return p;
}
function linksPublicos() {
  const l = {};
  for (const k of Object.keys(LINKS)) if (/^https:\/\//.test(String(LINKS[k] || ""))) l[k] = LINKS[k];
  l.suporte = "https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent("Olá, Richard! Preciso de ajuda com o QuadraLab Player.");
  return l;
}

function hojeISO() { return new Date().toISOString().slice(0, 10); }
function somarDias(iso, dias) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/* Situações que o jogador enxerga. Só `ativa` e `encerrada` são gravadas hoje pelo webhook;
   as demais existem para quando a Eduzz confirmar os eventos correspondentes (ver webhook-eduzz.js). */
const ESTADOS = ["gratuito", "teste", "ativa", "pagamento_pendente", "problema_pagamento", "cancelamento_programado", "encerrada"];
const ROTULO_ESTADO = {
  gratuito: "Gratuito", teste: "Teste", ativa: "Ativa", pagamento_pendente: "Pagamento pendente",
  problema_pagamento: "Problema no pagamento", cancelamento_programado: "Cancelamento programado", encerrada: "Acesso encerrado",
};

/* A assinatura gravada vale como acesso enquanto não vencer. */
function assinaturaVigente(ass, hoje) {
  return !!(ass && ass.ativoAte && ass.ativoAte >= (hoje || hojeISO()) && ass.status !== "encerrada");
}

module.exports = {
  CATALOGO, CONSULTORIAS, POLITICAS, LINKS, WHATSAPP, LIMITE_HORAS_ANALISE, PARTIDAS_ANALISE, politicasPublicas, NIVEIS, PERIODICIDADES, ESTADOS, ROTULO_ESTADO,
  produtoCompleto, produtoPorEduzz, produtoPorId, catalogoPublico, consultoriasPublicas, linksPublicos,
  hojeISO, somarDias, assinaturaVigente,
};
