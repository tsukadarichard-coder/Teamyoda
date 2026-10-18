/* QuadraLab Player — registro de partidas (avaliação pós-jogo).

   Cada partida é um documento em jogadores/{uid}/partidas/{id}, só do dono (as functions conferem o login; o
   Firestore não tem regra que libere esses dados ao navegador). Tudo é PREENCHIDO PELO JOGADOR: o sistema nunca
   afirma ter observado a partida. Os campos de múltipla escolha vêm de listas fechadas; os textos livres têm
   tamanho limitado e são opcionais. Do adversário guardamos só o nome que o jogador digitou. */

const TIPOS = { treino: "Treino", competicao: "Competição" };
const SUPERFICIES = { saibro: "Saibro", rapida: "Quadra rápida", grama: "Grama", outra: "Outra" };
const RESULTADOS = { vitoria: "Vitória", derrota: "Derrota" };
/* escala de execução da estratégia escolhida: 1 a 5 */
const EXECUCAO = { 1: "Quase nada", 2: "Pouco", 3: "Em parte", 4: "Bem", 5: "Muito bem" };
/* uma só lista de aspectos do jogo para os quatro campos de escolha (o que funcionou, o que não funcionou,
   dificuldades e pontos positivos): rápido de tocar no celular e fácil de comparar depois */
const ASPECTOS = {
  saque: "Saque", devolucao: "Devolução", direita: "Direita", esquerda: "Esquerda (backhand)", voleio: "Rede e voleio",
  deslocamento: "Deslocamento", consistencia: "Consistência", finalizacao: "Finalização do ponto", construcao: "Construção do ponto",
  decisao: "Tomada de decisão", emocional: "Controle emocional", fisico: "Condição física",
};
const CAMPOS_ASPECTO = ["funcionou", "naoFuncionou", "dificuldades", "positivos"];
const LIMITE_PARTIDAS = 1000; // teto de segurança por jogador, não um limite comercial
const ID_VALIDO = /^[A-Za-z0-9_-]{8,40}$/;

function texto(v, max) { return String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max); }
function dataValida(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ""))) return null;
  const d = new Date(s + "T12:00:00Z");
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : s;
}

/* Valida e normaliza. Lança Error com mensagem para o jogador quando falta algo essencial. */
function normalizarPartida(b, hoje) {
  b = b || {};
  const data = dataValida(b.data);
  if (!data) throw new Error("Informe a data da partida.");
  if (data > hoje) throw new Error("A data da partida não pode estar no futuro.");
  if (!RESULTADOS[b.resultado]) throw new Error("Informe se foi vitória ou derrota.");
  const tipo = TIPOS[b.tipo] ? b.tipo : "treino";
  const execucao = Number.isInteger(b.execucao) && b.execucao >= 1 && b.execucao <= 5 ? b.execucao : null;
  const p = {
    data, tipo, resultado: b.resultado,
    superficie: SUPERFICIES[b.superficie] ? b.superficie : null,
    adversario: texto(b.adversario, 60),
    placar: texto(b.placar, 40),
    planoId: ID_VALIDO.test(String(b.planoId || "")) ? String(b.planoId) : null, // dono conferido pela function
    torneioId: ID_VALIDO.test(String(b.torneioId || "")) ? String(b.torneioId) : null, // idem: a function confere que o torneio é do jogador
    rodada: texto(b.rodada, 30),
    preparoId: ID_VALIDO.test(String(b.preparoId || "")) ? String(b.preparoId) : null, // a function confere que a preparação é do jogador e do mesmo torneio
    execucao,
    obs: texto(b.obs, 500),
    funcionouTexto: texto(b.funcionouTexto, 300),
    naoFuncionouTexto: texto(b.naoFuncionouTexto, 300),
  };
  for (const c of CAMPOS_ASPECTO) p[c] = [...new Set((Array.isArray(b[c]) ? b[c] : []).filter((k) => ASPECTOS[k]))];
  return p;
}

/* resumo simples de evolução, calculado só com o que o jogador registrou */
function resumoPartidas(lista) {
  const n = lista.length, vit = lista.filter((p) => p.resultado === "vitoria").length;
  const comExec = lista.filter((p) => p.execucao);
  const contar = (campo) => {
    const m = {};
    for (const p of lista) for (const k of p[campo] || []) m[k] = (m[k] || 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => ({ chave: k, nome: ASPECTOS[k], vezes: v }));
  };
  return {
    total: n, vitorias: vit, derrotas: n - vit,
    execucaoMedia: comExec.length ? Math.round(comExec.reduce((s, p) => s + p.execucao, 0) / comExec.length * 10) / 10 : null,
    dificuldadesFrequentes: contar("dificuldades"), funcionouFrequente: contar("funcionou"),
  };
}

module.exports = { TIPOS, SUPERFICIES, RESULTADOS, EXECUCAO, ASPECTOS, CAMPOS_ASPECTO, LIMITE_PARTIDAS, normalizarPartida, resumoPartidas };
