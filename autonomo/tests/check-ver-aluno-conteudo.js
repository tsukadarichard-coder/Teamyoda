/* Link do aluno (ver-aluno.js): além do plano, entra o planejamento de cada turma do jogador, todas as análises de movimento
   (com o relatório completo, só as dele), os jogos com scout (mesmo resumo da página da família) e os jogos em vídeo.
   Roda a function real (raiz e cópia do QuadraLab) com um Firestore de mentira. Rode: node tests/check-ver-aluno-conteudo.js */
const assert = require("assert"), path = require("path");

for (const dir of ["../../netlify/functions", "../netlify/functions"]) {
  const dados = {};
  const docRef = (k) => ({ get: async () => ({ exists: k in dados, data: () => dados[k] }), set: async (v) => { dados[k] = v; } });
  const fakeAdmin = { firestore: () => ({ collection: () => ({ doc: () => ({ collection: () => ({ doc: docRef }) }) }) }) };
  const modPath = path.join(__dirname, dir, "_firebase-admin.js");
  require.cache[require.resolve(modPath)] = { id: modPath, filename: modPath, loaded: true, exports: { admin: fakeAdmin, app: () => {} } };
  const { handler } = require(path.join(__dirname, dir, "ver-aluno.js"));
  const get = async (id, extra) => { const r = await handler({ httpMethod: "GET", queryStringParameters: Object.assign({ org: "o", id, t: "tok" }, extra || {}) }); return { status: r.statusCode, d: JSON.parse(r.body) }; };
  const plano = (aprovado, t) => ({ aprovado, tipo: "ciclo", prioridade: "Saque", blocos: [{ nome: "B1", semanasLista: [{ n: 1, foco: "Saque", aulas: [{ t: t + " 1" }, { t: t + " 2" }] }] }] });
  const mov = (id, criadoEm) => ({ id, criadoEm, golpe: "forehand", emp: "", dom: "D", itens: [{ n: "Joelhos", s: "ok", v: 92, u: "°", r: "90 ± 10" }], res: { ok: 4, atencao: 2, nao: 1 }, texto: "ok", prio: ["Joelhos"] });

  (async () => {
    dados["mty:alunos:v2"] = { value: JSON.stringify([
      { id: "a1", nome: "Nicolas", linkToken: "tok", horarios: [], movimentos: [mov("mv1", "2026-09-01T10:00:00Z"), mov("mvRem", "2026-09-02T10:00:00Z")], jogosVideo: [{ id: "jv1", criadoEm: "2026-09-05T10:00:00Z", adversario: "Fulano", res: { total: 30, pctGanhos: 60, batidasMedia: 4.2 } }] },
      { id: "a2", nome: "Duda", linkToken: "tok", horarios: [], plano: plano(true, "Individual"), regPlano: {} },
      { id: "a3", nome: "Rascunho", linkToken: "tok", horarios: [], plano: plano(false, "Individual") },
    ]) };
    dados["mty:turmas:v1"] = { value: JSON.stringify([
      { id: "t1", nome: "Turma Sábado", membros: ["a1", "a2", "a3"], plano: plano(true, "Turma"), regPlano: { A01: { feita: true, data: "2026-09-06" } }, horarios: [{ dia: 6, hora: "09:00" }] },
      { id: "t2", nome: "Turma Quarta", membros: ["a2"], plano: plano(false, "Quarta"), horarios: [{ dia: 3, hora: "18:00" }] },
    ]) };
    // índice do arquivo de análises: uma que só existe ali (a ficha perdeu) e uma removida
    dados["mty:movidx:v1:a1"] = { value: JSON.stringify({ itens: [mov("mv2", "2026-10-01T10:00:00Z")], removidos: ["mvRem"] }) };
    dados["mty:movrel:v1:mv2"] = { value: JSON.stringify({ id: "mv2", alunoId: "a1", criadoEm: "2026-10-01T10:00:00Z", golpe: "forehand", resultado: { nomes: [], fases: [], itens: [], resumo: { ok: 4, atencao: 2, nao_avaliavel: 1 } }, fotos: ["data:image/jpeg;base64,AAAA"], cabecalho: "Academia" }) };
    dados["mty:movrel:v1:mvOutro"] = { value: JSON.stringify({ id: "mvOutro", alunoId: "a2", resultado: {} }) };
    dados["mty:paraAluno:v1:a1"] = { value: JSON.stringify({ jogos: [
      { id: "j1", video: false, atleta: "Nicolas", data: "2026-09-10", torneio: "Copa", resultado: "6/4 6/3", concluida: true, n: 80, ganhos: 44, pctGanhos: 55, serie: [[1, 1, "15-0", "winner_nos"]], sinais: ["Bom saque"], numeros: { aces: 3 } },
      { id: "j2", video: true, atleta: "Nicolas", data: "2026-10-12", n: 40, pctGanhos: 50 },
    ] }) };

    // jogador só de turma: plano da turma como principal + tudo o que é dele
    let { d } = await get("a1");
    assert.strictEqual(d.temPlano, true, dir + ": plano da turma");
    assert.strictEqual(d.planoDaTurma.nome, "Turma Sábado");
    assert.deepStrictEqual(d.turmas, [], dir + ": turma principal não se repete");
    assert.deepStrictEqual(d.movimentos.map((h) => h.id), ["mv2", "mv1"], dir + ": análises da ficha + do arquivo, sem a removida, mais recente primeiro");
    assert.deepStrictEqual(d.jogos.map((j) => j.id), ["j2", "j1"], dir + ": jogos com scout");
    assert.strictEqual(d.jogos[0].video, true);
    assert.strictEqual(d.jogosVideo.length, 1, dir + ": jogos em vídeo");
    assert(!JSON.stringify(d.jogosVideo).includes("Fulano"), dir + ": nome do adversário não vai");

    // jogador com plano individual E turma: os dois aparecem
    ({ d } = await get("a2"));
    assert.strictEqual(d.aulas[0].titulo, "Individual 1", dir + ": plano individual como principal");
    assert.deepStrictEqual(d.turmas.map((tu) => tu.nome), ["Turma Sábado", "Turma Quarta"], dir + ": planejamento das turmas também");
    assert.strictEqual(d.turmas[0].temPlano, true);
    assert.strictEqual(d.turmas[0].aulasFeitas, 1);
    assert.strictEqual(d.turmas[0].aulas[0].titulo, "Turma 1");
    assert.strictEqual(d.turmas[1].temPlano, false, dir + ": rascunho da turma não aparece");
    assert.strictEqual(d.turmas[1].planoRascunho, true);
    assert.strictEqual(d.turmas[1].aulas.length, 0);
    assert.deepStrictEqual(d.movimentos, [], dir + ": sem análises");

    // plano individual ainda em rascunho: o plano aprovado da turma não fica escondido
    ({ d } = await get("a3"));
    assert.strictEqual(d.temPlano, true, dir + ": rascunho individual não esconde o plano da turma");
    assert.strictEqual(d.planoDaTurma.nome, "Turma Sábado");

    // relatório completo de uma análise: só a do próprio jogador
    let r = await get("a1", { rel: "mv2" });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.d.arquivo.fotos.length, 1, dir + ": relatório completo com fotos");
    assert.strictEqual(r.d.arquivo.cabecalho, undefined);
    r = await get("a1", { rel: "mvOutro" });
    assert.strictEqual(r.status, 404, dir + ": relatório de outro jogador não abre");
    r = await get("a1", { rel: "mvRem" });
    assert.strictEqual(r.status, 404, dir + ": análise removida não abre");
    r = await get("a1", { rel: "mv1" });
    assert.strictEqual(r.status, 200); assert.strictEqual(r.d.arquivo, null, dir + ": análise antiga sem arquivo → abre pelo resumo");
    r = await get("a1", { rel: "../x" });
    assert.strictEqual(r.status, 400);

    // resumo de um jogo (página do scout aberta pelo link do aluno)
    r = await get("a1", { jogo: "j1" });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.d.publico.pctGanhos, 55); assert.strictEqual(r.d.publico.sinais[0], "Bom saque");
    r = await get("a2", { jogo: "j1" });
    assert.strictEqual(r.status, 404, dir + ": jogo de outro jogador não abre");

    // token errado: nada sai
    r = await handler({ httpMethod: "GET", queryStringParameters: { org: "o", id: "a1", t: "x", rel: "mv2" } });
    assert.strictEqual(r.statusCode, 404, dir + ": sem o token certo nada sai");
    console.log("check-ver-aluno-conteudo " + dir + ": ok");
  })().catch((e) => { console.error(e); process.exit(1); });
}
