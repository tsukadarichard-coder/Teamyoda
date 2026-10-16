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

/* Consultorias: serviços independentes da assinatura. Enquanto não
   houver checkout próprio (eduzzUrl), o contato é o WhatsApp real. */
const WHATSAPP = "5511941773228";
const CONSULTORIAS = [
  {
    id: "revisao-estrategia", nome: "Revisão de estratégia",
    descricao: "O Richard Tsukada revisa a estratégia gerada para o seu jogo e indica ajustes.",
    mensagem: "Olá, Richard! Quero contratar a revisão de estratégia do QuadraLab Player.",
    eduzzUrl: null,
  },
  {
    id: "analise-video", nome: "Análise de vídeo",
    descricao: "Você envia um vídeo do seu jogo e recebe a análise do Richard.",
    mensagem: "Olá, Richard! Quero contratar a análise de vídeo do QuadraLab Player.",
    eduzzUrl: null,
  },
  {
    id: "consultoria-ao-vivo", nome: "Consultoria ao vivo",
    descricao: "Uma conversa ao vivo com o Richard sobre o seu jogo.",
    mensagem: "Olá, Richard! Quero contratar a consultoria ao vivo do QuadraLab Player.",
    eduzzUrl: null,
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
function consultoriasPublicas() {
  return CONSULTORIAS.map((c) => ({
    id: c.id, nome: c.nome, descricao: c.descricao,
    url: c.eduzzUrl || ("https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(c.mensagem)),
    canal: c.eduzzUrl ? "checkout" : "whatsapp",
  }));
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
  CATALOGO, CONSULTORIAS, LINKS, WHATSAPP, NIVEIS, PERIODICIDADES, ESTADOS, ROTULO_ESTADO,
  produtoCompleto, produtoPorEduzz, produtoPorId, catalogoPublico, consultoriasPublicas, linksPublicos,
  hojeISO, somarDias, assinaturaVigente,
};
