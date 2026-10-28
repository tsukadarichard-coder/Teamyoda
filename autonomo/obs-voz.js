/* Observar jogos por voz — regras puras, sem rede e sem IA (rodam no aparelho, testadas em tests/check-obs-voz.js):

   · identificarJogador(texto, jogos): o professor pode começar a fala pelo nome curto do jogador ("Nicolas, está devolvendo muito
     atrás", "Insight para o Pedro: ..."). Só o COMEÇO da fala é lido. Nome igual ao apelido de um único jogo → "nome" (vai para esse
     jogo). Nome parecido, ou igual em dois jogos → "confirmar" (fica em "Confirmar jogador", nunca vai em silêncio para a pessoa
     errada). Nenhum nome → "ativo" (vai para o jogo selecionado na tela).
   · classificar(texto): sugestão por palavras-chave da natureza (positivo, atenção, insight, pergunta, observação) e do fundamento
     (saque, devolução, ...). Só sugere quando a pista é única; frase mista ("Boa construção, mas precipitou") fica "observação" e
     "Geral", com as opções listadas para um toque. Não interpreta, não resume e não tira conclusão: o texto original fica intacto. */
(function (raiz) {
  function normalizar(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9?\s]/g, " ").replace(/\s+/g, " ").trim();
  }
  function distancia(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length; if (!m || !n) return Math.max(m, n);
    let ant = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(ant[j] + 1, cur[j - 1] + 1, ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      ant = cur;
    }
    return ant[n];
  }
  /* palavras que podem vir antes do nome: "insight para o Nicolas", "pro Pedro", "nota do Nicolas", "observação para a Lia" */
  const PREFIXOS = ["insight", "nota", "observacao", "lembrete", "anotar", "anota", "registrar", "registro", "pergunta", "ponto", "para", "pra", "pro", "do", "da", "de", "o", "a", "ao", "sobre", "jogo"];
  const PALAVRAS_COMUNS = new Set(["segundo", "primeiro", "saque", "boa", "bom", "muito", "esta", "ele", "ela", "melhorou", "lembrar", "rever", "observar", "trabalhar", "voltou", "de", "novo", "mais", "menos", "nao", "sim", "agora", "quando", "precisa", "errou", "ganhou", "perdeu", "fez", "jogou"]);

  function identificarJogador(texto, jogos) {
    const alvos = (jogos || []).map((j) => ({ id: j.id, chaves: [j.apelido, j.nome].map((x) => normalizar(x)).filter(Boolean) })).filter((j) => j.chaves.length);
    const palavras = normalizar(texto).split(" ").filter(Boolean);
    if (!palavras.length || !alvos.length) return { modo: "ativo" };
    let i = 0;
    while (i < palavras.length && i < 4 && PREFIXOS.includes(palavras[i])) i++;
    const resto = palavras.slice(i);
    if (!resto.length) return { modo: "ativo" };
    const exatos = new Set(), parecidos = new Set();
    for (const a of alvos) {
      for (const ch of a.chaves) {
        const n = ch.split(" ").length, alvo = resto.slice(0, n).join(" ");
        if (alvo === ch) exatos.add(a.id);
        /* parecido: mesma inicial e até 1 letra de diferença (até 2 em nome longo); "Nicolau" × "Nicolas" */
        else if (ch.length >= 4 && alvo[0] === ch[0] && !PALAVRAS_COMUNS.has(alvo) && distancia(alvo, ch) <= (ch.length >= 7 ? 2 : 1)) parecidos.add(a.id);
      }
    }
    /* mesmo nome em dois jogos, ou um nome igual e outro parecido: o professor confirma */
    if (exatos.size === 1 && ![...parecidos].some((id) => !exatos.has(id))) return { modo: "nome", jogoId: [...exatos][0] };
    if (exatos.size > 1) return { modo: "confirmar", candidatos: [...exatos] };
    if (exatos.size === 1) return { modo: "confirmar", candidatos: [...new Set([...exatos, ...parecidos])] };
    if (parecidos.size) return { modo: "confirmar", candidatos: [...parecidos] };
    return { modo: "ativo" };
  }

  const NATUREZAS = ["observacao", "positivo", "atencao", "insight", "pergunta"];
  const ROTULO_NATUREZA = { observacao: "Observação do jogo", positivo: "Ponto positivo", atencao: "Ponto de atenção", insight: "Insight para o treino", pergunta: "Pergunta para conversar" };
  const PISTAS_NATUREZA = {
    pergunta: [/\?/, /\bperguntar\b/, /\bconversar (com|sobre)\b/, /\blembrar de conversar\b/, /\bfalar com (ele|ela)\b/, /\bperguntar (a|ao|pra|para)\b/],
    insight: [/\binsight\b/, /\b(proximo|proxima|nos proximos) treinos?\b/, /\btrabalhar\b/, /\btreinar\b/, /\brever\b/, /\blevar para o treino\b/, /\bobservar se\b/, /\bno treino\b/],
    positivo: [/\bboa\b/, /\bbom\b/, /\bmelhorou\b/, /\bmelhor\b/, /\botim[oa]\b/, /\bexcelente\b/, /\bacertou\b/, /\bfuncionou\b/, /\bcorajos[oa]\b/, /\bfirme\b/, /\bconsistente\b/, /\bganhou\b/],
    atencao: [/\berr(ou|o|os|ando)\b/, /\bcurt[oa]s?\b/, /\bprecipit/, /\bfaltou\b/, /\bfalt(a|ando)\b/, /\batrasad[oa]\b/, /\bmuito atras\b/, /\bde novo\b/, /\bdupla falta\b/, /\bperdeu\b/, /\bruim\b/, /\bnervos[oa]\b/, /\bsem (confianca|perna|ritmo)\b/, /\bdificuldade\b/, /\bcuidado\b/, /\bnao (consegue|conseguiu|entrou|passou)\b/],
  };
  const CATEGORIAS = ["saque", "devolucao", "fundo", "transicao", "tatico", "mental", "fisico"];
  const PISTAS_CATEGORIA = {
    saque: [/\bsaque/, /\bsacar\b/, /\bsacou\b/, /\bdupla falta\b/, /\blancamento\b/],
    devolucao: [/\bdevolu/, /\bdevolv/],
    fundo: [/\bfundo de quadra\b/, /\bforehand\b/, /\bbackhand\b/, /\bdireita\b/, /\besquerda\b/, /\btroca de bola\b/, /\btrocas?\b/, /\bprofundidade\b/, /\bcruzad[oa]\b/],
    transicao: [/\brede\b/, /\bvoleio/, /\bsubida\b/, /\bsubiu\b/, /\btransicao\b/, /\bsmash\b/, /\baproximacao\b/, /\bdeixadinha\b/],
    tatico: [/\btatic/, /\bdirecao\b/, /\bpadrao\b/, /\bescolha\b/, /\bconstrucao\b/, /\bconstruiu\b/, /\bfinaliza/, /\bestrategia\b/, /\bplano de jogo\b/, /\bparalela\b/],
    mental: [/\bnervos/, /\bconfianca\b/, /\bconcentra/, /\bemoc/, /\bcalm[oa]\b/, /\bcabeca\b/, /\birritad/, /\bfrustrad/, /\bansios/, /\bpressao\b/, /\bfoco\b/],
    fisico: [/\bcansad/, /\bfisic/, /\bpernas?\b/, /\bdesloca/, /\bfolego\b/, /\bresistencia\b/, /\blesao\b/, /\bdor\b/, /\bcaimbra/, /\bagilidade\b/],
  };
  function casam(t, pistas) { return pistas.some((r) => r.test(t)); }
  function classificar(texto) {
    const t = normalizar(texto);
    const nat = ["pergunta", "insight", "positivo", "atencao"].filter((k) => casam(t, PISTAS_NATUREZA[k]));
    let natureza = "observacao";
    if (nat.includes("pergunta")) natureza = "pergunta";
    else if (nat.includes("insight")) natureza = "insight";
    else if (nat.length === 1) natureza = nat[0];
    const cats = CATEGORIAS.filter((k) => casam(t, PISTAS_CATEGORIA[k]));
    return { natureza, cat: cats.length === 1 ? cats[0] : "geral", opcoesNatureza: natureza === "observacao" ? nat : [], opcoesCat: cats.length > 1 ? cats : [] };
  }

  const api = { normalizar, distancia, identificarJogador, classificar, NATUREZAS, ROTULO_NATUREZA, CATEGORIAS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.QLObservarVoz = api;
})(typeof window !== "undefined" ? window : this);
