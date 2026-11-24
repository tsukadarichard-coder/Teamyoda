/* Central › Gravações (pedido do Richard em 24/11/2026: "Transforme isso em algo que eu possa consultar dentro da central",
   versão "ligada ao app"). Roteiro de gravação dos cursos da Academia Digital do Team Yoda, montado na hora a partir do
   conteúdo que está no app (digitalConteudo/academia, só leitura; sem ele, os cursos de base de _cursos-mty.js):
   cada aula com sessão de gravação, etapas, erro comum, exercício e pergunta de fecho. O status "No app" vem sozinho quando a
   aula já tem link do YouTube; "Gravada" e "No YouTube" são marcados na Central e ficam em central/gravacoes ({ marcas }).
   Regras puras (testáveis): montar, limparMarca. Nada aqui muda a Academia Digital. */

const STATUS = ["agravar", "gravada", "youtube", "app"];
const ROTULO_STATUS = { agravar: "A gravar", gravada: "Gravada", youtube: "No YouTube", app: "No app" };

/* sessões de gravação agrupadas pelo lugar da quadra (as aulas de base; curso novo da coordenação fica "sem sessão") */
const SESSOES = [
  { n: 1, onde: "Fundo de quadra", levar: "Um jogador para demonstrar, alguém alimentando bolas, cesto cheio" },
  { n: 2, onde: "Saque e devolução", levar: "Sacador e devolvedor, câmera atrás e ao lado da linha de base" },
  { n: 3, onde: "Rede", levar: "Alimentador no fundo, jogador na rede, bolas altas para o smash" },
  { n: 4, onde: "Quadra com dois jogadores", levar: "Dois jogadores trocando bolas, cones para marcar zonas, o celular com o simulador para a última aula" },
  { n: 5, onde: "Banco da quadra ou sala", levar: "Você falando para a câmera; cenas curtas em quadra para a rotina entre pontos e antes do saque" },
];
const SESSAO_DA_AULA = {
  "cmty-tec-01": 1, "cmty-tec-02": 1, "cmty-tec-03": 1, "cmty-tec-04": 1, "cmty-tec-11": 1, "cmty-tec-12": 1,
  "cmty-tec-05": 2, "cmty-tec-06": 2, "cmty-tec-07": 2,
  "cmty-tec-08": 3, "cmty-tec-09": 3, "cmty-tec-10": 3,
};
function sessaoDe(trilha, aula) {
  if (SESSAO_DA_AULA[aula.id]) return SESSAO_DA_AULA[aula.id];
  if (trilha.id === "cmty-tatica") return 4;
  if (trilha.id === "cmty-mental") return 5;
  return null;
}
const minutos = (d) => { const m = /(\d+)/.exec(String(d || "")); return m ? Number(m[1]) : 0; };

/* trilhas: as do app (ou as de base); marcas: { aulaId: "gravada" | "youtube" }; nomes: { código: nome do exercício } */
function montar(trilhas, marcas, nomes) {
  const mk = marcas && typeof marcas === "object" ? marcas : {}, nm = nomes || {};
  const cursos = (Array.isArray(trilhas) ? trilhas : []).map((t, ci) => {
    const aulas = (Array.isArray(t.aulas) ? t.aulas : []).map((a, ai) => {
      const etapas = (Array.isArray(a.etapas) ? a.etapas : []).map((e) => ({ titulo: String(e.titulo || ""), pontos: Array.isArray(e.pontos) ? e.pontos.map(String) : [] })).filter((e) => e.titulo);
      const erros = [];
      (Array.isArray(a.etapas) ? a.etapas : []).forEach((e) => [e.erro].concat(e.erros || []).forEach((x) => {
        if (x && x.sinal && erros.length < 2 && !erros.some((y) => y.sinal === x.sinal)) erros.push({ sinal: String(x.sinal), correcao: String(x.correcao || "") });
      }));
      const status = a.youtube ? "app" : (mk[a.id] === "gravada" || mk[a.id] === "youtube" ? mk[a.id] : "agravar");
      return {
        id: String(a.id || ""), n: (ci + 1) + "." + (ai + 1), titulo: String(a.titulo || "Aula"), duracao: String(a.duracao || ""), minutos: minutos(a.duracao),
        sessao: sessaoDe(t, a), status, temVideo: !!a.youtube, etapas, erros,
        exercicios: (Array.isArray(a.exercicios) ? a.exercicios : []).map((c) => ({ codigo: String(c), nome: nm[c] || "" })),
        fecho: a.quiz && a.quiz[0] && a.quiz[0].p ? String(a.quiz[0].p) : "",
      };
    });
    return { id: String(t.id || ""), n: ci + 1, titulo: String(t.titulo || "Curso"), publicada: t.publicada !== false, aulas };
  }).filter((c) => c.aulas.length);
  const todas = cursos.flatMap((c) => c.aulas);
  const conta = (s) => todas.filter((a) => a.status === s).length;
  const resumo = { aulas: todas.length, minutos: todas.reduce((s, a) => s + a.minutos, 0), agravar: conta("agravar"), gravada: conta("gravada"), youtube: conta("youtube"), app: conta("app") };
  const sessoes = SESSOES.map((s) => {
    const l = todas.filter((a) => a.sessao === s.n);
    return { ...s, aulas: l.map((a) => a.n), minutos: l.reduce((x, a) => x + a.minutos, 0), feitas: l.filter((a) => a.status !== "agravar").length, total: l.length };
  }).filter((s) => s.total);
  return { cursos, resumo, sessoes };
}

/* marcação feita na Central: só "agravar" (apaga a marca), "gravada" ou "youtube"; "No app" vem do link do YouTube */
function limparMarca(marcas, aulaId, status) {
  const id = String(aulaId || "");
  if (!/^[A-Za-z0-9_-]{2,80}$/.test(id)) throw new Error("Aula inválida.");
  if (!["agravar", "gravada", "youtube"].includes(status)) throw new Error("Status inválido.");
  const m = { ...(marcas && typeof marcas === "object" ? marcas : {}) };
  if (status === "agravar") delete m[id]; else m[id] = status;
  const chaves = Object.keys(m);
  if (chaves.length > 500) chaves.slice(0, chaves.length - 500).forEach((k) => delete m[k]);
  return m;
}

module.exports = { STATUS, ROTULO_STATUS, SESSOES, SESSAO_DA_AULA, montar, limparMarca };
