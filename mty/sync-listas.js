/* Junção de listas compartilhadas da academia (alunos, turmas…).
   Cada professor grava a lista inteira; sem junção, quem grava por último apaga o que os outros
   registraram (sessões, observações) e cada um só enxerga o que fez no próprio aparelho.
   mesclar(base, local, nuvem): base = última versão que este aparelho viu na nuvem; local = o que está
   na tela; nuvem = o que está na nuvem agora. Cada item é decidido pela diferença em relação à base:
   quem mudou fica; se os dois mudaram o mesmo item, registros com id são somados e, em campos soltos,
   vale o local. Item removido por um lado só some se o outro lado não o alterou. */
(function (raiz) {
  const J = (x) => JSON.stringify(x === undefined ? null : x);
  const ehObj = (x) => x && typeof x === "object" && !Array.isArray(x);
  const comId = (l) => Array.isArray(l) && l.length > 0 && l.every((x) => ehObj(x) && x.id !== undefined);

  function mesclarLista(base, local, nuvem) {
    const mapa = (l) => new Map((l || []).map((x) => [x.id, x]));
    const B = mapa(base), L = mapa(local), N = mapa(nuvem);
    const ids = [];
    const visto = new Set();
    [nuvem || [], local || []].forEach((l) => l.forEach((x) => { if (!visto.has(x.id)) { visto.add(x.id); ids.push(x.id); } }));
    const saida = [];
    ids.forEach((id) => {
      const b = B.get(id), l = L.get(id), n = N.get(id);
      let r;
      if (l && n) r = mesclarItem(b, l, n);
      else if (l) r = (b && J(l) === J(b)) ? null : l; /* sumiu na nuvem e não foi mexido aqui: foi removido */
      else r = (b && J(n) === J(b)) ? null : n; /* removido aqui e não mexido na nuvem */
      if (r) saida.push(r);
    });
    return saida;
  }

  function mesclarValor(b, l, n) {
    if (J(l) === J(n)) return l;
    if (J(l) === J(b)) return n;
    if (J(n) === J(b)) return l;
    if (Array.isArray(l) && Array.isArray(n)) {
      if (comId(l) && comId(n)) return mesclarLista(Array.isArray(b) ? b : [], l, n);
      const fora = new Set(n.map(J));
      return n.concat(l.filter((x) => !fora.has(J(x))));
    }
    if (ehObj(l) && ehObj(n)) return mesclarItem(ehObj(b) ? b : undefined, l, n);
    return l;
  }

  function mesclarItem(b, l, n) {
    if (b && J(l) === J(b)) return n;
    if (b && J(n) === J(b)) return l;
    if (J(l) === J(n)) return l;
    const chaves = new Set([...Object.keys(n), ...Object.keys(l)]);
    const r = {};
    chaves.forEach((k) => {
      const v = mesclarValor(b ? b[k] : undefined, l[k], n[k]);
      if (v !== undefined) r[k] = v;
    });
    return r;
  }

  raiz.MTYSync = { mesclar: mesclarLista, mesclarItem };
  if (typeof module !== "undefined") module.exports = raiz.MTYSync;
})(typeof window !== "undefined" ? window : globalThis);
