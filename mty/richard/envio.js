/* Envio retomável de arquivo grande direto ao Storage (sessão "resumable" do Google Cloud Storage, aberta pelo servidor).
   window.QLEnvio.enviar(sessao, arquivo, { aoProgresso(enviados, total), aoEstado(texto), controle }) → Promise
   · manda o arquivo em pedaços de 8 MB; depois de cada pedaço o Storage diz quanto já guardou (cabeçalho Range);
   · se a internet cair, espera o sinal voltar, pergunta ao Storage quanto chegou e continua de onde parou;
   · a mesma sessão vale uma semana: recarregar a página e escolher o mesmo arquivo continua o envio.
   controle.cancelar() interrompe. Sem dependências. */
(function (raiz) {
  "use strict";
  var PEDACO = 8 * 1024 * 1024; // múltiplo de 256 KiB, como o Storage pede

  function put(url, corpo, cabecalhos, aoProgresso, controle) {
    return new Promise(function (ok, falha) {
      var x = new XMLHttpRequest();
      x.open("PUT", url, true);
      Object.keys(cabecalhos).forEach(function (k) { x.setRequestHeader(k, cabecalhos[k]); });
      if (aoProgresso && x.upload) x.upload.onprogress = function (e) { if (e.lengthComputable) aoProgresso(e.loaded); };
      x.onload = function () { ok({ status: x.status, range: x.getResponseHeader("Range") || x.getResponseHeader("range") }); };
      x.onerror = function () { falha(new Error("rede")); };
      x.ontimeout = function () { falha(new Error("rede")); };
      x.onabort = function () { falha(new Error("cancelado")); };
      if (controle) controle.xhr = x;
      x.send(corpo == null ? null : corpo);
    });
  }
  /* "bytes=0-1048575" → 1048576 */
  function proximo(range) { var m = /bytes=\d+-(\d+)/.exec(String(range || "")); return m ? Number(m[1]) + 1 : 0; }
  function esperar(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function esperarInternet() {
    if (raiz.navigator.onLine !== false) return Promise.resolve();
    return new Promise(function (r) { raiz.addEventListener("online", function f() { raiz.removeEventListener("online", f); r(); }); });
  }

  function enviar(sessao, arquivo, o) {
    o = o || {};
    var total = arquivo.size, controle = o.controle || {}, falhas = 0;
    controle.cancelar = function () { controle.cancelado = true; if (controle.xhr) try { controle.xhr.abort(); } catch (e) { /* já terminou */ } };
    var prog = o.aoProgresso || function () {}, estado = o.aoEstado || function () {};
    /* quanto já chegou (sessão nova: 0; retomada: o que o Storage guardou) */
    function consultar() {
      return put(sessao, null, { "Content-Range": "bytes */" + total }).then(function (r) {
        if (r.status === 200 || r.status === 201) return total;
        if (r.status === 308) return proximo(r.range);
        if (r.status === 404 || r.status === 410) { var e = new Error("A sessão de envio venceu. Escolha o vídeo e envie de novo."); e.fatal = true; throw e; }
        throw new Error("rede");
      });
    }
    function laco(inicio) {
      if (controle.cancelado) return Promise.reject(new Error("cancelado"));
      if (inicio >= total) return Promise.resolve();
      var fim = Math.min(inicio + (raiz.QL_ENVIO_PEDACO || PEDACO), total); // QL_ENVIO_PEDACO: só nos testes
      prog(inicio, total);
      return put(sessao, arquivo.slice(inicio, fim), { "Content-Range": "bytes " + inicio + "-" + (fim - 1) + "/" + total }, function (n) { prog(inicio + n, total); }, controle)
        .then(function (r) {
          falhas = 0;
          if (r.status === 200 || r.status === 201) { prog(total, total); return; }
          if (r.status === 308) return laco(r.range ? proximo(r.range) : fim);
          if (r.status === 404 || r.status === 410) { var e = new Error("A sessão de envio venceu. Escolha o vídeo e envie de novo."); e.fatal = true; throw e; }
          throw new Error("rede");
        })
        .catch(function (e) { return tentarDeNovo(e); });
    }
    function tentarDeNovo(e) {
      if (e && (e.fatal || e.message === "cancelado" || controle.cancelado)) throw e;
      falhas++;
      if (falhas > 40) throw new Error("A internet está instável demais agora. O envio fica guardado: volte e escolha o mesmo vídeo para continuar.");
      estado(raiz.navigator.onLine === false ? "Sem internet. O envio continua quando o sinal voltar." : "A conexão caiu. Tentando de novo…");
      return esperarInternet().then(function () { return esperar(Math.min(30000, 1000 * Math.pow(2, Math.min(falhas, 5)))); })
        .then(function () { if (controle.cancelado) throw new Error("cancelado"); return consultar(); })
        .then(function (n) { estado(""); return laco(n); })
        .catch(function (x) { return tentarDeNovo(x); });
    }
    return consultar().catch(function (e) { if (e && e.fatal) throw e; return 0; }).then(laco);
  }

  raiz.QLEnvio = { enviar: enviar, PEDACO: PEDACO, proximo: proximo };
})(typeof window !== "undefined" ? window : this);
