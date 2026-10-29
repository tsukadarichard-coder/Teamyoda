/* Arquivo dos relatórios de análise de movimento · Tecnologia QuadraLab.
   Cada análise salva guarda o relatório INTEIRO (checklist com pareceres, fases, conclusão, comparação e as fotos das fases)
   num documento próprio da academia, fora da lista de jogadores: assim nenhum relatório depende do tamanho dessa lista
   nem de quem gravou por último, e qualquer um pode ser reaberto depois.
     orgs/{org}/dados/mty:movrel:v1:{id}        → um relatório completo
     orgs/{org}/dados/mty:movidx:v1:{alunoId}   → índice do jogador (resumos + removidos), base do histórico e da evolução
     orgs/{org}/dados/mty:movclip:v1:{id}       → trecho do golpe (quadros pequenos do vídeo + pose de cada um), para o vídeo e o
                                                  boneco rodarem juntos no relatório reaberto (documento à parte: não pesa no relatório)
   Sem nuvem (modo local), usa o localStorage com as mesmas chaves.
   QLMovArquivo.criar({ db, org }) -> { salvar(alunoId, arq), ler(id), salvarClip(id, clip), lerClip(id), indice(alunoId), registrar(alunoId, resumos), remover(alunoId, id), removerJogador(alunoId) }
   QLMovArquivo.juntar(resumosDoJogador, indice) -> histórico completo (o que estiver em qualquer um dos dois, menos os removidos) */
(function (raiz, fab) {
  if (typeof module === "object" && module.exports) module.exports = fab();
  else raiz.QLMovArquivo = fab();
})(typeof self !== "undefined" ? self : this, function () {
  var REL = "mty:movrel:v1:", IDX = "mty:movidx:v1:", CLIP = "mty:movclip:v1:", LIMITE = 900000; /* um documento do Firestore aceita ~1 MB */

  function lerJSON(v, padrao) { try { var x = JSON.parse(v); return x == null ? padrao : x; } catch (e) { return padrao; } }
  function idValido(id) { return typeof id === "string" && /^[A-Za-z0-9_.:-]{1,120}$/.test(id) && id !== "." && id !== ".."; }
  function indiceVazio() { return { itens: [], removidos: [] }; }
  function normIndice(x) { x = x && typeof x === "object" ? x : {}; return { itens: Array.isArray(x.itens) ? x.itens : [], removidos: Array.isArray(x.removidos) ? x.removidos : [] }; }

  /* relatório grande demais (fotos de vídeo em alta resolução): guarda sem as fotos em vez de não guardar nada */
  function caber(arq) {
    var s = JSON.stringify(arq);
    if (s.length <= LIMITE) return s;
    var sem = {}; for (var k in arq) sem[k] = arq[k];
    sem.fotos = []; sem.semFotos = true;
    return JSON.stringify(sem);
  }
  function comResumo(ind, resumo) {
    ind.itens = ind.itens.filter(function (h) { return h.id !== resumo.id; }).concat([resumo]);
    ind.removidos = ind.removidos.filter(function (id) { return id !== resumo.id; });
    return ind;
  }
  function semResumo(ind, id) {
    ind.itens = ind.itens.filter(function (h) { return h.id !== id; });
    if (ind.removidos.indexOf(id) < 0) ind.removidos = ind.removidos.concat([id]).slice(-500);
    return ind;
  }

  function juntar(doJogador, indice) {
    var ind = normIndice(indice), fora = {}, mapa = {}, ordem = [];
    ind.removidos.forEach(function (id) { fora[id] = true; });
    (doJogador || []).concat(ind.itens).forEach(function (h) {
      if (!h || !h.id || fora[h.id]) return;
      if (!mapa[h.id]) ordem.push(h.id);
      mapa[h.id] = h;
    });
    return ordem.map(function (id) { return mapa[id]; });
  }

  function nuvem(db, org) {
    async function col() {
      var o = await org();
      if (!o) throw new Error("Sem academia: entre com a sua conta para salvar.");
      return db.collection("orgs").doc(o).collection("dados");
    }
    async function mexerIndice(alunoId, fn) {
      var c = await col(), ref = c.doc(IDX + alunoId);
      await db.runTransaction(async function (tx) {
        var s = await tx.get(ref);
        var ind = fn(normIndice(s.exists ? lerJSON(s.data().value, null) : null));
        tx.set(ref, { value: JSON.stringify(ind), atualizado: Date.now() });
      });
    }
    return {
      salvar: async function (alunoId, arq) {
        var c = await col();
        await c.doc(REL + arq.id).set({ value: caber(arq), alunoId: alunoId, criadoEm: arq.criadoEm, atualizado: Date.now() });
        await mexerIndice(alunoId, function (ind) { return comResumo(ind, arq.resumo); });
      },
      ler: async function (id) {
        var s = await (await col()).doc(REL + id).get();
        return s.exists ? lerJSON(s.data().value, null) : null;
      },
      salvarClip: async function (id, clip) {
        var v = JSON.stringify(clip);
        if (v.length > LIMITE) return;
        await (await col()).doc(CLIP + id).set({ value: v, atualizado: Date.now() });
      },
      lerClip: async function (id) {
        var s = await (await col()).doc(CLIP + id).get();
        return s.exists ? lerJSON(s.data().value, null) : null;
      },
      indice: async function (alunoId) {
        var s = await (await col()).doc(IDX + alunoId).get();
        return normIndice(s.exists ? lerJSON(s.data().value, null) : null);
      },
      registrar: async function (alunoId, resumos) {
        await mexerIndice(alunoId, function (ind) { resumos.forEach(function (r) { if (ind.removidos.indexOf(r.id) < 0 && !ind.itens.some(function (h) { return h.id === r.id; })) ind.itens.push(r); }); return ind; });
      },
      remover: async function (alunoId, id) {
        await mexerIndice(alunoId, function (ind) { return semResumo(ind, id); });
        await (await col()).doc(REL + id).delete();
        await (await col()).doc(CLIP + id).delete();
      },
      removerJogador: async function (alunoId) {
        var c = await col(), s = await c.doc(IDX + alunoId).get();
        var ind = normIndice(s.exists ? lerJSON(s.data().value, null) : null);
        for (var i = 0; i < ind.itens.length; i++) { await c.doc(REL + ind.itens[i].id).delete(); await c.doc(CLIP + ind.itens[i].id).delete(); }
        await c.doc(IDX + alunoId).delete();
      }
    };
  }

  function local(ls) {
    function get(k) { try { return ls.getItem("local:" + k); } catch (e) { return null; } }
    function set(k, v) { ls.setItem("local:" + k, v); }
    function del(k) { try { ls.removeItem("local:" + k); } catch (e) { /* sem armazenamento */ } }
    function ind(alunoId) { return normIndice(lerJSON(get(IDX + alunoId), null)); }
    return {
      salvar: async function (alunoId, arq) {
        var s = caber(arq);
        try { set(REL + arq.id, s); } catch (e) { var sem = lerJSON(s, {}); sem.fotos = []; sem.semFotos = true; set(REL + arq.id, JSON.stringify(sem)); }
        set(IDX + alunoId, JSON.stringify(comResumo(ind(alunoId), arq.resumo)));
      },
      ler: async function (id) { return lerJSON(get(REL + id), null); },
      salvarClip: async function (id, clip) { try { set(CLIP + id, JSON.stringify(clip)); } catch (e) { /* aparelho sem espaço: o relatório fica sem o trecho */ } },
      lerClip: async function (id) { return lerJSON(get(CLIP + id), null); },
      indice: async function (alunoId) { return ind(alunoId); },
      registrar: async function (alunoId, resumos) {
        var i = ind(alunoId);
        resumos.forEach(function (r) { if (i.removidos.indexOf(r.id) < 0 && !i.itens.some(function (h) { return h.id === r.id; })) i.itens.push(r); });
        set(IDX + alunoId, JSON.stringify(i));
      },
      remover: async function (alunoId, id) { set(IDX + alunoId, JSON.stringify(semResumo(ind(alunoId), id))); del(REL + id); del(CLIP + id); },
      removerJogador: async function (alunoId) { ind(alunoId).itens.forEach(function (h) { del(REL + h.id); del(CLIP + h.id); }); del(IDX + alunoId); }
    };
  }

  function criar(o) {
    o = o || {};
    var base = o.db ? nuvem(o.db, o.org || function () { return Promise.resolve(null); }) : local(o.localStorage || (typeof localStorage !== "undefined" ? localStorage : null));
    function checa(alunoId, id) {
      if (!idValido(alunoId)) return Promise.reject(new Error("Jogador inválido."));
      if (id !== undefined && !idValido(id)) return Promise.reject(new Error("Análise inválida."));
      return null;
    }
    return {
      salvar: function (alunoId, arq) { return checa(alunoId, arq && arq.id) || base.salvar(alunoId, arq); },
      ler: function (id) { return idValido(id) ? base.ler(id) : Promise.resolve(null); },
      salvarClip: function (id, clip) { return idValido(id) ? base.salvarClip(id, clip) : Promise.reject(new Error("Análise inválida.")); },
      lerClip: function (id) { return idValido(id) ? base.lerClip(id) : Promise.resolve(null); },
      indice: function (alunoId) { return idValido(alunoId) ? base.indice(alunoId) : Promise.resolve(indiceVazio()); },
      registrar: function (alunoId, resumos) { return checa(alunoId) || base.registrar(alunoId, (resumos || []).filter(function (r) { return r && idValido(r.id); })); },
      remover: function (alunoId, id) { return checa(alunoId, id) || base.remover(alunoId, id); },
      removerJogador: function (alunoId) { return checa(alunoId) || base.removerJogador(alunoId); }
    };
  }

  return { criar: criar, juntar: juntar, REL: REL, IDX: IDX, CLIP: CLIP };
});
