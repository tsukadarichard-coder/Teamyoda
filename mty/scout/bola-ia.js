/* Bola por IA no jogo em vídeo: o detector WASB treinado em tênis ("Widely Applicable Strong Baseline for Sports Ball
   Detection and Tracking", Tarashima et al., BMVC 2023 — github.com/nttcom/WASB-SBDT, licença MIT; rede HRNet, licença MIT),
   convertido para ONNX (vendor/wasb/wasb-tenis.onnx) e rodando no próprio aparelho com o onnxruntime-web: WebGPU quando o
   navegador tem, senão WebAssembly. Nada do vídeo sai do aparelho.
   Entrada: 3 quadros seguidos reduzidos a 512×288 como no WASB (uma escala só, pelo lado maior, imagem centrada, sobra
   preta) e normalizados pela média/desvio do ImageNet. Saída: um mapa de calor por quadro; cada mancha acima de 0,5 é um
   candidato, no centro ponderado pelo mapa e com a soma do mapa como nota. */
(function (raiz) {
  "use strict";
  var ORT = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/";
  var W = 512, H = 288, N = W * H;
  var MEDIA = [0.485, 0.456, 0.406], DESVIO = [0.229, 0.224, 0.225];
  var aqui = (typeof document !== "undefined" && document.currentScript && document.currentScript.src) || "";
  var MODELO = aqui ? new URL("vendor/wasb/wasb-tenis.onnx", aqui).href : "scout/vendor/wasb/wasb-tenis.onnx";
  var carregando = null;

  function script(src) {
    return new Promise(function (ok, falha) {
      var s = document.createElement("script"); s.src = src; s.async = true;
      s.onload = ok; s.onerror = function () { falha(new Error("não carregou " + src)); };
      document.head.appendChild(s);
    });
  }

  /* carrega uma vez (biblioteca + modelo + sessão). Só com placa de vídeo (WebGPU: iPhone com iOS 26, Chrome do Android e
     do computador): sem ela a rede leva ~1 s por quadro e o app fica no detector por pixels (devolve null, sem baixar nada).
     o.wasm: roda mesmo sem placa (testes) */
  function carregar(o) {
    o = o || {};
    if (carregando) return carregando;
    carregando = (async function () {
      var adaptador = null;
      if (o.gpu !== false && typeof navigator !== "undefined" && navigator.gpu) adaptador = await navigator.gpu.requestAdapter().catch(function () { return null; });
      var gpu = !!adaptador;
      if (!gpu && !o.wasm) return null;
      if (!raiz.ort) await script(ORT + (gpu ? "ort.webgpu.min.js" : "ort.min.js"));
      var ort = raiz.ort;
      ort.env.wasm.wasmPaths = ORT;
      ort.env.wasm.numThreads = raiz.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
      var r = await fetch(o.modelo || MODELO);
      if (!r.ok) throw new Error("modelo da bola não encontrado");
      var bytes = new Uint8Array(await r.arrayBuffer()), sessao = null, via = "";
      if (gpu) { try { sessao = await ort.InferenceSession.create(bytes, { executionProviders: ["webgpu"] }); via = "webgpu"; } catch (e) { sessao = null; } }
      if (!sessao && !o.wasm) return null;
      if (!sessao) { sessao = await ort.InferenceSession.create(bytes, { executionProviders: ["wasm"] }); via = "wasm"; }
      return { sessao: sessao, ort: ort, via: via, trecho: function () { return Trecho(sessao, ort); } };
    })().then(function (r) { if (!r) carregando = null; return r; }, function (e) { carregando = null; throw e; });
    return carregando;
  }

  /* centros das manchas do mapa (logits): acima de 0 ⇔ sigmoide acima de 0,5 */
  var marca = new Uint8Array(N), fila = new Int32Array(N);
  function manchas(mapa, ini) {
    var out = []; marca.fill(0);
    for (var p = 0; p < N; p++) {
      if (marca[p] || !(mapa[ini + p] > 0)) continue;
      var sx = 0, sy = 0, sw = 0, cab = 0, fim = 0; fila[fim++] = p; marca[p] = 1;
      while (cab < fim) {
        var q = fila[cab++], x = q % W, y = (q / W) | 0, w = 1 / (1 + Math.exp(-mapa[ini + q]));
        sx += x * w; sy += y * w; sw += w;
        if (x > 0 && !marca[q - 1] && mapa[ini + q - 1] > 0) { marca[q - 1] = 1; fila[fim++] = q - 1; }
        if (x < W - 1 && !marca[q + 1] && mapa[ini + q + 1] > 0) { marca[q + 1] = 1; fila[fim++] = q + 1; }
        if (y > 0 && !marca[q - W] && mapa[ini + q - W] > 0) { marca[q - W] = 1; fila[fim++] = q - W; }
        if (y < H - 1 && !marca[q + W] && mapa[ini + q + W] > 0) { marca[q + W] = 1; fila[fim++] = q + W; }
      }
      out.push([sx / sw, sy / sw, sw]);
    }
    return out.sort(function (a, b) { return b[2] - a[2]; });
  }

  /* um trecho (ponto) do vídeo: quadros entram um a um; a cada 3 a rede roda e deixa os candidatos em alvo.ia
     (imagem normalizada de referência: com a câmera na mão, cada quadro vem com G, como no detector por pixels) */
  function Trecho(sessao, ort) {
    var cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    var cx = cv.getContext("2d", { willReadFrequently: true });
    var entrada = new Float32Array(9 * N), pend = [], ultimo = null, tempos = [];
    function poe(k, d) {
      for (var c = 0; c < 3; c++) {
        var base = (k * 3 + c) * N, m = MEDIA[c], s = DESVIO[c];
        for (var i = 0, j = c; i < N; i++, j += 4) entrada[base + i] = (d[j] / 255 - m) / s;
      }
    }
    async function roda() {
      var t0 = Date.now();
      var r = await sessao.run({ quadros: new ort.Tensor("float32", entrada, [1, 9, H, W]) });
      var mapa = r.mapas.data;
      tempos.push(Date.now() - t0);
      pend.forEach(function (f, k) {
        if (!f.alvo) return;
        f.alvo.ia = manchas(mapa, k * N).slice(0, 4).map(function (c) {
          var pt = [(c[0] + 0.5 - f.ox) / f.k / f.wi, (c[1] + 0.5 - f.oy) / f.k / f.he], G = f.G;
          if (G) { var z = G[6] * pt[0] + G[7] * pt[1] + G[8]; pt = [(G[0] * pt[0] + G[1] * pt[1] + G[2]) / z, (G[3] * pt[0] + G[4] * pt[1] + G[5]) / z]; }
          return [Math.round(pt[0] * 10000) / 10000, Math.round(pt[1] * 10000) / 10000];
        }).filter(function (p) { return p[0] >= -0.05 && p[0] <= 1.05 && p[1] >= -0.05 && p[1] <= 1.05; });
      });
      pend = [];
    }
    return {
      quadro: async function (img, wi, he, G, alvo) {
        var k = W / Math.max(wi, he), ox = W / 2 - k * wi / 2, oy = H / 2 - k * he / 2;
        cx.setTransform(1, 0, 0, 1, 0, 0); cx.fillStyle = "#000"; cx.fillRect(0, 0, W, H);
        cx.setTransform(k, 0, 0, k, ox, oy); cx.drawImage(img, 0, 0, wi, he);
        var d = cx.getImageData(0, 0, W, H).data;
        poe(pend.length, d);
        ultimo = d;
        pend.push({ alvo: alvo, G: G || null, k: k, ox: ox, oy: oy, wi: wi, he: he });
        if (pend.length === 3) await roda();
      },
      /* fim do trecho: completa o último trio repetindo o último quadro (sem alvo) */
      fim: async function () {
        if (!pend.length) return;
        var f = pend[pend.length - 1];
        while (pend.length < 3) { poe(pend.length, ultimo); pend.push({ alvo: null, G: f.G, k: f.k, ox: f.ox, oy: f.oy, wi: f.wi, he: f.he }); }
        await roda();
      },
      /* tempo típico de uma rodada (mediana, sem as 2 primeiras, que compilam os shaders da placa) */
      medida: function () {
        var l = tempos.slice(tempos.length > 4 ? 2 : 0).sort(function (a, b) { return a - b; });
        return { rodadas: tempos.length, msMediana: l.length ? l[Math.floor(l.length / 2)] : 0 };
      },
    };
  }

  raiz.QLBolaIA = { carregar: carregar, _manchas: manchas, MODELO: MODELO };
})(typeof window !== "undefined" ? window : this);
