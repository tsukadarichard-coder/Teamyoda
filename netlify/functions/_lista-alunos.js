/* Lista de jogadores em partes (26/11/2026). A lista inteira da academia ficava num documento só do Firestore
   (orgs/{org}/dados/mty:alunos:v2), que aceita até 1 MiB; o Team Yoda chegou a 1.024 KB e nenhuma mudança nos jogadores
   salvava mais. Agora a lista mora em "mty:alunos:v3": um documento principal { partes, versao, bytes, atualizado } e as
   partes "mty:alunos:v3~1", "~2"… com { texto, versao } (o JSON da lista cortado em pedaços). A lista antiga (v2) fica
   guardada como estava e é lida só enquanto a v3 não existe (a primeira gravação cria a v3).
   O app (mty/index.html, storageFirestore) faz o mesmo do lado do navegador; mantenha os dois iguais. */
const CHAVE_V2 = "mty:alunos:v2";
const CHAVE = "mty:alunos:v3";
const parte = (i) => CHAVE + "~" + i;
const MAX_CHARS = 300000; // ≤ 900 KB mesmo com 3 bytes por caractere

function dividir(texto) {
  const t = String(texto || ""), l = [];
  for (let i = 0; i < t.length; i += MAX_CHARS) l.push(t.slice(i, i + MAX_CHARS));
  return l.length ? l : [""];
}
function novaVersao() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
const lerJSON = (t) => { try { const v = JSON.parse(t || "[]"); return Array.isArray(v) ? v : null; } catch (e) { return null; } };

/* lê o texto da lista; `ler(ref)` é ref.get() ou tx.get(ref) (dentro de uma transação). null = sem lista nenhuma */
async function lerTexto(base, ler) {
  const g = ler || ((r) => r.get());
  const m = await g(base.doc(CHAVE));
  if (m.exists && m.data() && m.data().partes > 0) {
    const d = m.data(), n = d.partes;
    const ps = await Promise.all([...Array(n).keys()].map((i) => g(base.doc(parte(i + 1)))));
    if (ps.some((p) => !p.exists || p.data().versao !== d.versao)) throw new Error("A lista de jogadores estava sendo gravada; tente de novo.");
    return { texto: ps.map((p) => p.data().texto || "").join(""), principal: d };
  }
  const v2 = await g(base.doc(CHAVE_V2));
  return { texto: v2.exists ? (v2.data().value || "[]") : null, principal: null };
}

/* lista de jogadores da academia (base = db.collection("orgs").doc(org).collection("dados")) */
async function lerAlunos(base) {
  for (let i = 0; i < 3; i++) {
    try { const r = await lerTexto(base); return r.texto == null ? [] : (lerJSON(r.texto) || []); } catch (e) { if (i === 2) throw e; }
  }
  return [];
}

/* grava a lista dentro de uma transação já aberta (depois das leituras): partes novas + principal, e apaga as que sobraram */
function escrever(tx, base, lista, principalAntes) {
  const texto = JSON.stringify(lista), pedacos = dividir(texto), versao = novaVersao();
  pedacos.forEach((t, i) => tx.set(base.doc(parte(i + 1)), { texto: t, versao }));
  for (let i = pedacos.length + 1; i <= ((principalAntes && principalAntes.partes) || 0); i++) tx.delete(base.doc(parte(i)));
  tx.set(base.doc(CHAVE), { partes: pedacos.length, versao, bytes: Buffer.byteLength(texto, "utf8"), atualizado: Date.now() });
  return versao;
}

/* ler-mudar-gravar numa transação: mudar(lista) devolve a lista nova (ou null para não gravar) */
async function mudarAlunos(db, base, mudar) {
  return db.runTransaction(async (tx) => {
    const r = await lerTexto(base, (ref) => tx.get(ref));
    const lista = r.texto == null ? [] : lerJSON(r.texto);
    if (!lista) throw new Error("A lista de jogadores não pôde ser lida.");
    const nova = await mudar(lista);
    if (nova) escrever(tx, base, nova, r.principal);
    return nova || lista;
  });
}

module.exports = { CHAVE_V2, CHAVE, parte, MAX_CHARS, dividir, lerTexto, lerAlunos, escrever, mudarAlunos, lerJSON };
