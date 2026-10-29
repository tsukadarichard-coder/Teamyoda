/* Arquivo dos relatórios de análise de movimento (scout/movimento-arquivo.js): cada relatório fica num documento próprio
   da academia, o índice do jogador junta resumos e remoções, e nada depende da lista de jogadores.
   Rode: node tests/check-movimento-arquivo.js */
const assert = require("assert");
const A = require("../scout/movimento-arquivo.js");

/* Firestore mínimo (API compat): orgs/{org}/dados/{id}, get/set/delete e transação */
function fakeDb() {
  const docs = new Map();
  const ref = (p) => ({
    path: p,
    collection: (c) => ({ doc: (d) => ref(p + "/" + c + "/" + d) }),
    get: async () => ({ exists: docs.has(p), data: () => docs.get(p) }),
    set: async (v) => { docs.set(p, JSON.parse(JSON.stringify(v))); },
    delete: async () => { docs.delete(p); },
  });
  return {
    docs,
    collection: (c) => ({ doc: (d) => ref(c + "/" + d) }),
    runTransaction: async (fn) => fn({ get: (r) => r.get(), set: (r, v) => { docs.set(r.path, JSON.parse(JSON.stringify(v))); } }),
  };
}
function fakeLs() { const m = new Map(); return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; }

const resumo = (id, criadoEm, golpe) => ({ id, criadoEm, golpe: golpe || "forehand", emp: "", dom: "D", itens: [{ n: "Joelhos", s: "ok", v: 92, u: "°", r: "90 ± 10" }], res: { ok: 1, atencao: 0, nao: 0 }, texto: "ok", prio: [] });
const arquivo = (id, criadoEm, extra) => Object.assign({ id, alunoId: "a1", criadoEm, golpe: "forehand", emp: "", dom: "D", atleta: "Ana", resultado: { golpe: "forehand", nomes: ["Base"], fases: [{ nome: "Base", quadro: 0, t: 0 }], itens: [], resumo: { ok: 1, atencao: 0, nao_avaliavel: 0 } }, fotos: ["data:image/jpeg;base64,AAAA"], resumo: resumo(id, criadoEm) }, extra || {});

(async () => {
  for (const modo of ["nuvem", "local"]) {
    const db = fakeDb(), ls = fakeLs();
    const S = modo === "nuvem" ? A.criar({ db, org: async () => "team-yoda" }) : A.criar({ localStorage: ls });
    const chave = (k) => (modo === "nuvem" ? "orgs/team-yoda/dados/" + k : "local:" + k);
    const tem = (k) => (modo === "nuvem" ? db.docs.has(chave(k)) : ls.m.has(chave(k)));

    // salvar guarda o relatório inteiro num documento próprio e o resumo no índice do jogador
    await S.salvar("a1", arquivo("mv1", "2026-10-01T10:00:00.000Z"));
    await S.salvar("a1", arquivo("mv2", "2026-10-08T10:00:00.000Z"));
    assert(tem("mty:movrel:v1:mv1") && tem("mty:movrel:v1:mv2"), modo + ": um documento por relatório");
    assert(!tem("mty:alunos:v2"), modo + ": não mexe na lista de jogadores");
    let ind = await S.indice("a1");
    assert.deepStrictEqual(ind.itens.map((h) => h.id), ["mv1", "mv2"], modo + ": índice com os dois resumos");
    const lido = await S.ler("mv1");
    assert.strictEqual(lido.atleta, "Ana", modo + ": relatório completo volta");
    assert.strictEqual(lido.fotos.length, 1, modo + ": com as fotos");

    // regravar a mesma análise (Reaplicar faixas) substitui, não duplica
    await S.salvar("a1", arquivo("mv2", "2026-10-08T10:00:00.000Z", { atleta: "Ana S." }));
    ind = await S.indice("a1");
    assert.strictEqual(ind.itens.length, 2, modo + ": regravar não duplica");
    assert.strictEqual((await S.ler("mv2")).atleta, "Ana S.", modo + ": regravar atualiza");

    // a lista do jogador perdeu as análises (gravação falhou / outro aparelho sobrescreveu): o índice devolve tudo
    const junto = A.juntar([], ind);
    assert.deepStrictEqual(junto.map((h) => h.id), ["mv1", "mv2"], modo + ": histórico recuperado do arquivo");
    // análise antiga que só existe no jogador continua e é registrada no índice
    await S.registrar("a1", [resumo("mv0", "2026-09-01T10:00:00.000Z")]);
    ind = await S.indice("a1");
    assert(ind.itens.some((h) => h.id === "mv0"), modo + ": resumo antigo entra no índice");
    assert.strictEqual(await S.ler("mv0"), null, modo + ": análise antiga não tem relatório completo (abre o resumo)");

    // remover tira do índice, apaga o documento e não deixa voltar pela lista do jogador
    await S.remover("a1", "mv1");
    ind = await S.indice("a1");
    assert(!tem("mty:movrel:v1:mv1"), modo + ": documento removido");
    assert(ind.removidos.includes("mv1"), modo + ": remoção lembrada");
    assert.deepStrictEqual(A.juntar([resumo("mv1", "2026-10-01T10:00:00.000Z")], ind).map((h) => h.id).sort(), ["mv0", "mv2"], modo + ": removida não volta");
    // nova gravação com o mesmo id (desfazer) volta a valer
    await S.salvar("a1", arquivo("mv1", "2026-10-01T10:00:00.000Z"));
    assert(!(await S.indice("a1")).removidos.includes("mv1"), modo + ": regravada sai dos removidos");

    // relatório grande demais para um documento: guarda sem as fotos, nunca deixa de guardar
    const grande = "data:image/jpeg;base64," + "A".repeat(950000);
    await S.salvar("a1", arquivo("mv3", "2026-10-15T10:00:00.000Z", { fotos: [grande] }));
    const g = await S.ler("mv3");
    assert(g && g.semFotos && g.fotos.length === 0 && g.resultado, modo + ": sem fotos, mas com o relatório");

    // ids estranhos não viram caminho no banco
    await assert.rejects(S.salvar("../x", arquivo("mv9", "2026-10-15T10:00:00.000Z")), /inválido/, modo + ": jogador inválido");
    await assert.rejects(S.salvar("a1", arquivo("a/b", "2026-10-15T10:00:00.000Z")), /inválida/, modo + ": análise inválida");
    assert.strictEqual(await S.ler("a/b"), null, modo + ": leitura com id inválido");

    // trecho do golpe (vídeo + boneco juntos no relatório): documento à parte, sai junto com a análise
    const clip = { prop: 1.778, t: [1, 1.1], fotos: ["data:image/jpeg;base64,AA", "data:image/jpeg;base64,BB"], poses: [[null], [null]], fases: [1], nomes: ["Contato"] };
    await S.salvarClip("mv2", clip);
    assert.deepStrictEqual(await S.lerClip("mv2"), clip, modo + ": trecho guardado e lido");
    assert(tem("mty:movclip:v1:mv2"), modo + ": trecho num documento próprio");
    assert.strictEqual(await S.lerClip("mv1"), null, modo + ": análise sem trecho");
    await assert.rejects(S.salvarClip("a/b", clip), /inválida/, modo + ": trecho com id inválido");
    await S.salvarClip("mv3", clip);
    await S.remover("a1", "mv3");
    assert(!tem("mty:movclip:v1:mv3"), modo + ": remover a análise leva o trecho");

    // remover o jogador apaga os relatórios dele
    await S.removerJogador("a1");
    assert(!tem("mty:movrel:v1:mv2") && !tem("mty:movrel:v1:mv3") && !tem("mty:movidx:v1:a1") && !tem("mty:movclip:v1:mv2"), modo + ": jogador removido leva os relatórios e os trechos");
  }
  // sem academia (conta sem org): falha clara, nada gravado
  const db = fakeDb(), S = A.criar({ db, org: async () => null });
  await assert.rejects(S.salvar("a1", arquivo("mv1", "2026-10-01T10:00:00.000Z")), /academia/);
  assert.strictEqual(db.docs.size, 0);
  console.log("check-movimento-arquivo: ok");
})().catch((e) => { console.error(e); process.exit(1); });
