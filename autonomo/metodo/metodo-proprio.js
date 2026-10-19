/* "Meu método" · QuadraLab (plano Premium, treinador independente).
   O treinador descreve o método DELE por parâmetros guiados; o gerador de plano com IA passa a seguir só as regras dele (nada do MTY).
   Funções puras, sem tela: o app entrega ficha, índice de exercícios e demais textos. Os dados do método são do treinador e ficam na conta dele. */
(function (raiz, fab) {
  if (typeof module === "object" && module.exports) module.exports = fab();
  else raiz.QLMetodo = fab();
})(this, function () {
  var LIM = { princ: 12, nao: 8, areas: 10, niveis: 8, exemplos: 3, linha: 300, nome: 80, exemplo: 6000, obs: 600, exercicios: 80 };
  var MIN = { principios: 3, areas: 2, exercicios: 6 };
  var ESTAGIOS = ["V", "L", "G", "A", "C"];

  function txt(v, n) { return String(v == null ? "" : v).replace(/[ \t]+/g, " ").trim().slice(0, n); }
  function lista(v, max, n) { return (Array.isArray(v) ? v : []).map(function (x) { return txt(typeof x === "string" ? x : x && (x.t || x.texto), n); }).filter(Boolean).slice(0, max); }
  function par(v, max) {
    return (Array.isArray(v) ? v : []).map(function (x) { return { nome: txt(x && x.nome, 60), criterio: txt(x && x.criterio, LIM.linha) }; }).filter(function (x) { return x.nome; }).slice(0, max);
  }
  function inteiro(v, min, max, padrao) { var n = parseInt(v, 10); return isFinite(n) ? Math.max(min, Math.min(max, n)) : padrao; }

  function vazio() {
    return { v: 1, ativo: false, nome: "", estrutura: { semanasCiclo: 4, aulasSemana: 2, blocosCiclo: 3, observacao: "" }, areas: [], niveis: [], principios: [], naoFazer: [], exemplos: [], atualizadoEm: null };
  }
  /* aceita qualquer coisa (inclusive saída da IA) e devolve um método válido e dentro dos limites */
  function limpar(m) {
    m = m || {}; var e = m.estrutura || {};
    return {
      v: 1, ativo: !!m.ativo, nome: txt(m.nome, LIM.nome),
      estrutura: { semanasCiclo: inteiro(e.semanasCiclo, 1, 16, 4), aulasSemana: inteiro(e.aulasSemana, 1, 7, 2), blocosCiclo: inteiro(e.blocosCiclo, 1, 6, 3), observacao: txt(e.observacao, LIM.obs) },
      areas: par(m.areas, LIM.areas), niveis: par(m.niveis, LIM.niveis),
      principios: lista(m.principios, LIM.princ, LIM.linha), naoFazer: lista(m.naoFazer, LIM.nao, LIM.linha),
      exemplos: (Array.isArray(m.exemplos) ? m.exemplos : []).map(function (x) { return { titulo: txt(x && x.titulo, 80), texto: String((x && x.texto) || "").trim().slice(0, LIM.exemplo) }; }).filter(function (x) { return x.texto; }).slice(0, LIM.exemplos),
      atualizadoEm: m.atualizadoEm || null
    };
  }
  /* o que falta para o método poder gerar planos */
  function prontidao(m, nExercicios) {
    m = limpar(m); var f = [];
    if (m.principios.length < MIN.principios) f.push("Escreva pelo menos " + MIN.principios + " princípios do seu método (você tem " + m.principios.length + ").");
    if (m.areas.length < MIN.areas) f.push("Cadastre pelo menos " + MIN.areas + " áreas de trabalho com o critério de saída (você tem " + m.areas.length + ").");
    if ((nExercicios || 0) < MIN.exercicios) f.push("Cadastre pelo menos " + MIN.exercicios + " exercícios na sua biblioteca (você tem " + (nExercicios || 0) + ").");
    return { ok: f.length === 0, faltas: f };
  }

  function montarPrompt(m, o) {
    m = limpar(m); o = o || {}; var e = m.estrutura, L = [];
    L.push("Você é assistente de planejamento de tênis. Monte o planejamento deste jogador seguindo SOMENTE o método do treinador descrito abaixo.");
    L.push("Não aplique nenhuma outra metodologia nem regras que não estejam aqui. Se o método não disser algo, não invente: deixe de fora ou registre em observacao.", "");
    L.push("MÉTODO DO TREINADOR" + (m.nome ? ": " + m.nome : ""));
    L.push("Estrutura: ciclos de " + e.semanasCiclo + " semanas, " + e.aulasSemana + " aulas por semana, " + e.blocosCiclo + " blocos por ciclo." + (e.observacao ? " " + e.observacao : ""), "");
    if (m.areas.length) { L.push("ÁREAS DE TRABALHO E CRITÉRIOS DE SAÍDA DELE (cada bloco trabalha uma delas; escreva o critério dele em \"saida\"):"); m.areas.forEach(function (a) { L.push("· " + a.nome + (a.criterio ? ": " + a.criterio : "")); }); L.push(""); }
    if (m.niveis.length) { L.push("NÍVEIS DO JOGADOR NO MÉTODO DELE:"); m.niveis.forEach(function (a) { L.push("· " + a.nome + (a.criterio ? ": " + a.criterio : "")); }); L.push(""); }
    if (m.principios.length) { L.push("PRINCÍPIOS DELE — obrigatórios:"); m.principios.forEach(function (p, i) { L.push((i + 1) + ". " + p); }); L.push(""); }
    if (m.naoFazer.length) { L.push("O QUE ELE NUNCA FAZ — nunca inclua:"); m.naoFazer.forEach(function (p) { L.push("· " + p); }); L.push(""); }
    if (m.exemplos.length) { L.push("PLANOS DE EXEMPLO DELE (referência de estrutura e estilo; não copie nomes, datas nem números):"); m.exemplos.forEach(function (x, i) { L.push("── Exemplo " + (i + 1) + (x.titulo ? " · " + x.titulo : "") + " ──", x.texto); }); L.push(""); }
    L.push("EXERCÍCIOS DA BIBLIOTECA DELE — use SOMENTE estes códigos:", o.indice || "(nenhum)", "");
    L.push("FICHA DO JOGADOR:", o.ficha || "");
    (o.extras || []).forEach(function (x) { if (x) L.push("", x); });
    L.push("", "FORMATO: " + (o.semanas || e.semanasCiclo) + " semanas, " + (o.nBlocos || e.blocosCiclo) + " blocos de cerca de " + (o.porBloco || 1) + " semana(s), " + (o.aulasSemana || e.aulasSemana) + " aula(s) por semana.");
    (o.enfase || []).forEach(function (x) { L.push(x); });
    L.push("", "Devolva APENAS um JSON válido, sem texto antes ou depois, sem crases, neste formato:");
    L.push(JSON.stringify({ tipo: "Plano de desenvolvimento · N semanas", prioridade: "a prioridade do ciclo em uma frase", cadeia: [{ camada: "Foco", txt: "...", raiz: true }],
      blocos: [{ nome: "Bloco um", titulo: "...", semanas: "1 a 4", etiqueta: "N AULAS", alvo: "...", area: "nome de uma das áreas dele", areaFoco: "", saida: "o critério de saída DELE para esta área, observável", portao: "",
        semanasLista: [{ n: 1, foco: "...", carga: "...", aulas: [{ t: "título da aula", d: "o que se faz", ex: ["COD001"] }] }] }],
      observacao: [{ t: "campo", d: "por que importa", urgente: false }] }));
    L.push("", "REGRAS:", "· nenhum código fora da lista acima. Códigos inventados invalidam o plano.", "· areaFoco deve ficar sempre vazio (\"\").",
      "· o critério de saída de cada bloco vem do método dele, é observável e nunca por calendário.", "· marque raiz:true em UMA camada só, ou nenhuma se a ficha não permitir.",
      "· campos [não sei] ou [em branco] da ficha viram item de observacao; nunca preencha por suposição.");
    return L.join("\n");
  }

  /* ── importar o método (e exercícios) de um texto colado ── */
  function promptExtracao(texto) {
    return ["Você lê o material de um treinador de tênis (planejamentos, descrição do método, listas de exercícios) e extrai os parâmetros do método dele.",
      "Extraia SOMENTE o que está escrito no material. O que não aparecer fica vazio. Nunca invente princípios, critérios ou exercícios.", "",
      "MATERIAL DO TREINADOR:", String(texto || "").slice(0, 30000), "",
      "Devolva APENAS um JSON válido, sem texto antes ou depois, sem crases, neste formato:",
      JSON.stringify({ nome: "nome do método, se houver", estrutura: { semanasCiclo: 4, aulasSemana: 2, blocosCiclo: 3, observacao: "" },
        areas: [{ nome: "área de trabalho", criterio: "critério de saída, com número se houver" }], niveis: [{ nome: "nível", criterio: "o que define o nível" }],
        principios: ["regra ou princípio do treinador, em uma frase"], naoFazer: ["o que ele nunca faz"],
        exercicios: [{ nome: "...", objetivo: "...", montagem: "...", carga: "...", progressao: "..." }] })].join("\n");
  }
  function lerJSON(t) {
    t = String(t || "").trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    var i = t.indexOf("{"); if (i > 0) t = t.slice(i);
    return JSON.parse(t);
  }
  function lerExtracao(t) {
    var j = lerJSON(t), m = limpar(j);
    m.ativo = false;
    var ex = (Array.isArray(j.exercicios) ? j.exercicios : []).map(function (x) { return { nome: txt(x && x.nome, 80), objetivo: txt(x && x.objetivo, 200), montagem: txt(x && x.montagem, 500), carga: txt(x && x.carga, 120), progressao: txt(x && x.progressao, 300) }; }).filter(function (x) { return x.nome; }).slice(0, LIM.exercicios);
    return { metodo: m, exercicios: ex };
  }

  /* ── exercícios próprios: CSV/planilha colada (separador ; , ou tab; 1ª linha pode ser cabeçalho) ── */
  function celulas(linha, sep) {
    var out = [], atual = "", asp = false;
    for (var i = 0; i < linha.length; i++) {
      var c = linha[i];
      if (c === '"') { if (asp && linha[i + 1] === '"') { atual += '"'; i++; } else asp = !asp; }
      else if (c === sep && !asp) { out.push(atual); atual = ""; }
      else atual += c;
    }
    out.push(atual); return out.map(function (x) { return x.trim(); });
  }
  function exerciciosDeCSV(texto) {
    var linhas = String(texto || "").split(/\r?\n/).filter(function (l) { return l.trim(); });
    if (!linhas.length) return [];
    var sep = [";", "\t", ","].sort(function (a, b) { return linhas[0].split(b).length - linhas[0].split(a).length; })[0];
    var cab = celulas(linhas[0], sep).map(function (x) { return x.toLowerCase(); });
    var temCab = cab.some(function (x) { return /nome|exerc/.test(x); });
    var idx = { nome: 0, objetivo: 1, montagem: 2, carga: 3, progressao: 4 };
    if (temCab) { idx = {}; cab.forEach(function (x, i) { if (/nome|exerc/.test(x) && idx.nome == null) idx.nome = i; else if (/objetiv/.test(x)) idx.objetivo = i; else if (/montag|descri|como/.test(x)) idx.montagem = i; else if (/carga|dura|tempo|s[eé]rie/.test(x)) idx.carga = i; else if (/progress/.test(x)) idx.progressao = i; }); }
    return linhas.slice(temCab ? 1 : 0, (temCab ? 1 : 0) + LIM.exercicios).map(function (l) {
      var c = celulas(l, sep), g = function (k) { return idx[k] == null ? "" : txt(c[idx[k]], k === "nome" ? 80 : 500); };
      return { nome: g("nome"), objetivo: g("objetivo"), montagem: g("montagem"), carga: g("carga"), progressao: g("progressao") };
    }).filter(function (x) { return x.nome; });
  }
  /* vira exercício da biblioteca (mesmo formato do catálogo); códigos MEU001, MEU002… sem repetir os já existentes */
  function paraBiblioteca(itens, existentes) {
    var usados = {}; (existentes || []).forEach(function (e) { usados[e.c] = 1; });
    var nomes = {}; (existentes || []).forEach(function (e) { nomes[String(e.n || "").toLowerCase()] = 1; });
    var n = 0, out = [];
    (itens || []).forEach(function (x) {
      if (nomes[String(x.nome).toLowerCase()]) return;
      do { n++; } while (usados["MEU" + String(n).padStart(3, "0")]);
      var c = "MEU" + String(n).padStart(3, "0"); usados[c] = 1; nomes[String(x.nome).toLowerCase()] = 1;
      out.push({ c: c, n: x.nome, f: "FB", e: ESTAGIOS.slice(), o: x.objetivo || "", m: x.montagem || "", g: x.carga || "", r: "", p: x.progressao || "", x: "", i: "", d: "", videoUrl: "", diagrama: { pontos: [], setas: [] }, meu: true });
    });
    return out;
  }
  /* índice de exercícios para o prompt: só a biblioteca dele */
  function indice(exercicios) {
    return (exercicios || []).filter(function (e) { return e && e.c && e.n; }).map(function (e) { return e.c + " " + e.n + (e.o ? " — " + String(e.o).slice(0, 90) : ""); }).join("\n");
  }

  return { LIM: LIM, MIN: MIN, vazio: vazio, limpar: limpar, prontidao: prontidao, montarPrompt: montarPrompt, promptExtracao: promptExtracao, lerExtracao: lerExtracao, exerciciosDeCSV: exerciciosDeCSV, paraBiblioteca: paraBiblioteca, indice: indice };
});
