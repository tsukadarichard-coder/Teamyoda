/* QuadraLab Player — planejamento por semanas (plano pago, nível p1).

   O jogador escolhe quantas semanas, em que dias da semana treina, quanto
   tempo tem por sessão e com quem treina. A IA monta as sessões de cada
   semana usando SÓ drills do catálogo da Metodologia MTY (por código) e as
   jogadas do plano tático dele; o servidor valida tudo, completa cada drill
   com os dados reais do catálogo e calcula as datas — a IA nunca decide
   data nem inventa exercício. */
const { FAMILIAS, PORCODIGO, drillsDoNivel } = require("./_player-catalogo");
const { PRINCIPIOS_JOGO, linhasFicha, resumoDrill } = require("./_player");

const DIAS = { seg: "Segunda", ter: "Terça", qua: "Quarta", qui: "Quinta", sex: "Sexta", sab: "Sábado", dom: "Domingo" };
const ORDEM_DIAS = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];
const DIA_JS = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 }; // Date.getUTCDay()
const SEMANAS_VALIDAS = [4, 8];
const MINUTOS_VALIDOS = [45, 60, 90];
const APOIOS = { parceiro: "Treino com um parceiro de jogo", treinador: "Treino com treinador ou alimentador de bolas" };
const MAX_SESSOES_SEMANA = 5;

class ErroParametros extends Error {}

function dataValida(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false;
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}

/* Limpa os parâmetros vindos do app; erro de verdade vira mensagem para o jogador. */
function normalizarParametros(p, hojeISO) {
  p = p || {};
  const semanas = Number(p.semanas);
  if (!SEMANAS_VALIDAS.includes(semanas)) throw new ErroParametros("Escolha 4 ou 8 semanas.");
  const dias = ORDEM_DIAS.filter((d) => Array.isArray(p.dias) && p.dias.includes(d));
  if (dias.length < 1) throw new ErroParametros("Escolha pelo menos um dia da semana para treinar.");
  if (dias.length > MAX_SESSOES_SEMANA) throw new ErroParametros("Escolha no máximo " + MAX_SESSOES_SEMANA + " dias de treino por semana.");
  const minutos = Number(p.minutos);
  if (!MINUTOS_VALIDOS.includes(minutos)) throw new ErroParametros("Escolha a duração do treino: 45, 60 ou 90 minutos.");
  const apoio = Object.prototype.hasOwnProperty.call(APOIOS, p.apoio) ? p.apoio : "";
  if (!apoio) throw new ErroParametros("Diga com quem você treina.");
  let inicio = String(p.inicio || "");
  if (!dataValida(inicio)) throw new ErroParametros("Escolha a data de início.");
  if (hojeISO && inicio < hojeISO) inicio = hojeISO; // não planeja no passado
  return { semanas, dias, minutos, apoio, inicio };
}

/* Data de cada sessão: a semana n começa em inicio + 7(n-1); o dia escolhido cai uma vez em cada janela de 7 dias. */
function dataDaSessao(inicio, semanaN, dia) {
  const base = new Date(inicio + "T00:00:00Z");
  const janela = new Date(base.getTime() + (semanaN - 1) * 7 * 86400000);
  const deslocamento = (DIA_JS[dia] - janela.getUTCDay() + 7) % 7;
  return new Date(janela.getTime() + deslocamento * 86400000).toISOString().slice(0, 10);
}

function promptPlanejamento(ficha, planoTatico, escolhidas, params) {
  const jogadas = (planoTatico.jogadas || []).map((j, i) => ({ j, i }));
  const foco = escolhidas.length ? jogadas.filter((x) => escolhidas.includes(x.i)) : jogadas;
  const drills = drillsDoNivel(ficha.nivel);
  return [
    "Você é o assistente de planejamento da Metodologia MTY, método de tênis do treinador Richard Tsukada,",
    "dentro do QuadraLab Player. Escreva em português do Brasil, falando direto com o jogador (\"você\").",
    "Monte o PLANEJAMENTO de treino de um jogador amador, dividido em semanas e sessões, para ele colocar em prática",
    "as jogadas do plano tático dele.",
    "",
    "PRINCÍPIOS TRAVADOS — obrigatórios:",
    ...PRINCIPIOS_JOGO.map((p, i) => (i + 1) + ". " + p),
    "8. Trilho de ensino: fechado, depois semiaberto, depois aberto com regra, e só então ponto livre. Padrão novo nunca entra direto no ponto livre.",
    "9. Um estímulo dura três treinos; a rotação é parcial. Não repita o mesmo drill em todas as sessões nem troque tudo a cada semana.",
    "",
    linhasFicha(ficha),
    "",
    "PLANO TÁTICO DO JOGADOR: " + planoTatico.titulo,
    planoTatico.resumo,
    escolhidas.length ? "JOGADAS QUE ELE ESCOLHEU TREINAR (use estas; o número entre colchetes é o índice):" : "JOGADAS DO PLANO (ele não marcou nenhuma: distribua todas; o número entre colchetes é o índice):",
    ...foco.map((x) => "[" + x.i + "] " + x.j.titulo + " — sequência: " + x.j.sequencia.join(" > ") + " — por quê: " + x.j.porque +
      ((x.j.fundamentos || []).length ? "\n    fundamentos: " + x.j.fundamentos.map((f) => f.categoria + ": " + f.nome + " (" + f.foco + ")").join(" | ") : "")),
    "",
    "PARÂMETROS DO PLANEJAMENTO:",
    "· " + params.semanas + " semanas.",
    "· " + params.dias.length + " sessão(ões) por semana, nos dias: " + params.dias.map((d) => DIAS[d]).join(", ") + " (as sessões de cada semana seguem esta ordem).",
    "· Cada sessão tem cerca de " + params.minutos + " minutos no total (a soma dos minutos dos itens deve ficar próxima disso).",
    "· " + APOIOS[params.apoio] + ".",
    "",
    "REGRAS:",
    "· Toda sessão tem: um aquecimento (item livre), de 1 a 3 drills do catálogo, e fecha com uma aplicação (um drill de jogo aplicado ou um item livre de pontos jogados).",
    "· Cada sessão treina pelo menos uma das jogadas acima (campo jogadas, com os índices) e, ao longo do planejamento, todas elas aparecem.",
    "· FUNDAMENTOS: o planejamento tem de trabalhar os fundamentos de cada jogada (golpe, movimento de pernas, recuperação, equilíbrio, decisão), e não só repetir o golpe.",
    "  Em cada sessão, liste em fundamentos (2 a 4 frases curtas) o que ela trabalha e, na nota de cada drill, diga qual fundamento ele treina",
    "  (por exemplo \"foco: recuperação depois do saque\"). Ao longo das semanas, todos os fundamentos das jogadas aparecem.",
    "· Progressão semana a semana: comece com drills mais controlados, evolua para semiabertos e aplicação com regra; a última semana consolida e é mais leve.",
    "· TODA semana tem pelo menos um drill de saque ou início de ponto (tipos Power drills · saque e Início do ponto) e pelo menos um de devolução: saque e devolução nunca saem do plano.",
    "· Use SOMENTE drills do CATÁLOGO abaixo, copiando o código exato. Nunca invente drill nem código. Para " + APOIOS[params.apoio].toLowerCase() + ", prefira drills que essa forma de treino sustenta.",
    "· Item livre só pode ser: aquecimento, pontos jogados, ou alongamento/volta à calma. Nada de exercício inventado.",
    "· Nunca invente dado que não esteja na ficha. Adapte a ambição ao nível informado.",
    "· Seja conciso: títulos curtos e notas de uma frase, para o planejamento caber inteiro na resposta.",
    "",
    "CATÁLOGO DE DRILLS (código | nome | tipo | objetivo):",
    ...drills.map(resumoDrill),
    "",
    "FORMATO DA RESPOSTA:",
    "· titulo (até 60 caracteres) e resumo (2 frases com a lógica do ciclo).",
    "· semanas: exatamente " + params.semanas + " itens, na ordem das semanas. Cada um com foco (o tema da semana, curto), carga (leve, moderada ou alta, com uma frase)",
    "  e sessoes: exatamente " + params.dias.length + " itens, na ordem dos dias acima.",
    "· Cada sessão: titulo, objetivo (uma frase), jogadas (índices das jogadas treinadas), fundamentos (lista de 2 a 4 frases curtas) e itens.",
    "· Cada item: tipo (\"drill\" ou \"livre\"), codigo (código do catálogo para drill; vazio para livre), titulo (só para livre; vazio para drill),",
    "  minutos (inteiro) e nota (uma frase com o foco daquele item, ou vazio).",
  ].join("\n");
}

const SCHEMA_PLANEJAMENTO = {
  type: "object",
  properties: {
    titulo: { type: "string" },
    resumo: { type: "string" },
    semanas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          foco: { type: "string" },
          carga: { type: "string" },
          sessoes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                titulo: { type: "string" },
                objetivo: { type: "string" },
                jogadas: { type: "array", items: { type: "integer" } },
                fundamentos: { type: "array", items: { type: "string" } },
                itens: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      tipo: { type: "string", enum: ["drill", "livre"] },
                      codigo: { type: "string" },
                      titulo: { type: "string" },
                      minutos: { type: "integer" },
                      nota: { type: "string" },
                    },
                    required: ["tipo", "codigo", "titulo", "minutos", "nota"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["titulo", "objetivo", "jogadas", "fundamentos", "itens"],
              additionalProperties: false,
            },
          },
        },
        required: ["foco", "carga", "sessoes"],
        additionalProperties: false,
      },
    },
  },
  required: ["titulo", "resumo", "semanas"],
  additionalProperties: false,
};

/* Estrutura mínima: o número de semanas e de sessões por semana precisa bater com o pedido. */
function planejamentoValido(p, params) {
  return !!p && typeof p.titulo === "string" && typeof p.resumo === "string" && Array.isArray(p.semanas) &&
    p.semanas.length === params.semanas &&
    p.semanas.every((s) => s && typeof s.foco === "string" && typeof s.carga === "string" && Array.isArray(s.sessoes) &&
      s.sessoes.length === params.dias.length &&
      s.sessoes.every((x) => x && typeof x.titulo === "string" && typeof x.objetivo === "string" && Array.isArray(x.jogadas) && Array.isArray(x.itens)));
}

const SAQUE_FAM = new Set(["PDS", "IP"]);
function ehDevolucao(d) { return /devolu/i.test(d.n + " " + (d.o || "")); }

/* Troca códigos por drills reais, descarta o que está fora do catálogo do nível, atribui dia, data e id de cada sessão. */
function finalizarPlanejamento(pl, params, nivel, totalJogadas) {
  const permitidos = new Set(drillsDoNivel(nivel).map((d) => d.c));
  const avisos = [];
  const semanas = pl.semanas.map((s, wi) => {
    let temSaque = false, temDevolucao = false;
    const sessoes = s.sessoes.map((x, si) => {
      const dia = params.dias[si];
      const itens = [];
      for (const it of x.itens) {
        const minutos = Math.min(Math.max(parseInt(it.minutos, 10) || 10, 5), 60);
        const nota = String(it.nota || "").trim();
        if (it.tipo === "drill") {
          const codigo = String(it.codigo || "").trim().toUpperCase();
          if (!permitidos.has(codigo)) continue;
          const d = PORCODIGO[codigo];
          if (SAQUE_FAM.has(d.f)) temSaque = true;
          if (ehDevolucao(d)) temDevolucao = true;
          itens.push({
            tipo: "drill", codigo, nome: d.n, tipoDrill: FAMILIAS[d.f] || d.f, minutos, nota,
            objetivo: d.o || "", montagem: d.m || "", carga: d.g || "", regressao: d.r || "",
            progressao: d.p || "", corrigir: d.x || "", ignorar: d.i || "",
          });
        } else {
          const titulo = String(it.titulo || "").trim();
          if (!titulo) continue;
          itens.push({ tipo: "livre", titulo, minutos, nota });
        }
      }
      return {
        id: "s" + (wi + 1) + "-" + (si + 1),
        dia, diaNome: DIAS[dia], data: dataDaSessao(params.inicio, wi + 1, dia),
        titulo: String(x.titulo).trim(), objetivo: String(x.objetivo).trim(),
        fundamentos: (Array.isArray(x.fundamentos) ? x.fundamentos : []).map((f) => String(f).trim()).filter(Boolean).slice(0, 4),
        jogadas: [...new Set(x.jogadas.filter((n) => Number.isInteger(n) && n >= 0 && n < totalJogadas))].sort((a, b) => a - b),
        itens,
      };
    });
    if (!temSaque) avisos.push("Semana " + (wi + 1) + " sem drill de saque ou início de ponto.");
    if (!temDevolucao) avisos.push("Semana " + (wi + 1) + " sem drill de devolução.");
    return { n: wi + 1, foco: String(s.foco).trim(), carga: String(s.carga).trim(), sessoes };
  });
  return { titulo: String(pl.titulo).trim(), resumo: String(pl.resumo).trim(), semanas, avisos };
}

module.exports = {
  DIAS, ORDEM_DIAS, SEMANAS_VALIDAS, MINUTOS_VALIDOS, APOIOS, MAX_SESSOES_SEMANA, ErroParametros,
  normalizarParametros, dataDaSessao, promptPlanejamento, SCHEMA_PLANEJAMENTO, planejamentoValido, finalizarPlanejamento,
};
