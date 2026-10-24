/* Visão do scout automático · Tecnologia QuadraLab. Roda no navegador, no aparelho; o vídeo não sai dele.
   Para cada trecho (ponto) lê os quadros do vídeo e entrega o que scout/video-scout.js precisa:
   { ini, fim, hits, quadros: [{ t, jog: [{ pe:[x,y], lm:[33 pontos]|null, cor:[r,g,b]|null }], bolas: [[x,y], ...] }] } (imagem normalizada 0..1)
   Quadros: WebCodecs (VideoDecoder) direto do MP4/MOV, só os trechos dos pontos — rápido; senão o <video> do navegador; senão
   clipes convertidos pelo ffmpeg (QLAudioVideo.clipe). Bola: diferença entre quadros vizinhos + cor/brilho, componentes pequenos.
   Jogadores: pose MediaPipe em recortes em volta de cada um (o de longe é pequeno no quadro inteiro); sem pose, mancha de movimento.
   QLVisao.processar(file, video, trechos, cal, { pose, aoProgresso, sinal, aoTrecho }) → Promise<dados[]> · QLVisao.carregarPose() */
(function (raiz) {
  var LARG = 480; // largura da imagem reduzida para achar a bola
  var MP = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/";
  var MODELO = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task";

  /* ── pose (MediaPipe): duas instâncias, uma para cada lado da quadra (o modo VIDEO acompanha a pessoa entre quadros) ── */
  var posePromessa = null;
  function carregarPose() {
    if (!posePromessa) posePromessa = (async function () {
      var mod = await import(MP + "vision_bundle.mjs"), fs = await mod.FilesetResolver.forVisionTasks(MP + "wasm");
      async function cria() {
        var op = function (d) { return { baseOptions: { modelAssetPath: MODELO, delegate: d }, runningMode: "VIDEO", numPoses: 1, minPoseDetectionConfidence: 0.3, minPosePresenceConfidence: 0.3, minTrackingConfidence: 0.3 }; };
        try { return await mod.PoseLandmarker.createFromOptions(fs, op("GPU")); } catch (e) { return mod.PoseLandmarker.createFromOptions(fs, op("CPU")); }
      }
      var inst = { perto: await cria(), longe: await cria() }, ultTs = { perto: 0, longe: 0 };
      return {
        detectar: function (img, ms, lado) {
          var ts = Math.max(Math.round(ms), ultTs[lado] + 1); ultTs[lado] = ts;
          var r = inst[lado].detectForVideo(img, ts);
          return r && r.landmarks && r.landmarks[0] ? r.landmarks[0].map(function (p) { return { x: p.x, y: p.y, v: p.visibility == null ? 1 : p.visibility }; }) : null;
        },
      };
    })().catch(function (e) { posePromessa = null; throw e; });
    return posePromessa;
  }

  /* ── fontes de quadros ── */
  function espera(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function fonteWebCodecs(file) {
    if (typeof raiz.VideoDecoder === "undefined" || !raiz.QLAudioVideo) return null;
    var tab = await raiz.QLAudioVideo.tabelaVideo(file).catch(function () { return null; });
    if (!tab || !tab.codec || !tab.n) return null;
    var conf = { codec: tab.codec, codedWidth: tab.largura, codedHeight: tab.altura };
    if (tab.descricao) conf.description = tab.descricao;
    var sup = await raiz.VideoDecoder.isConfigSupported(conf).catch(function () { return { supported: false }; });
    if (!sup.supported) return null;
    /* vídeo de celular gravado "de lado": o quadro decodificado vem sem a rotação que o player aplica */
    var rot = ((tab.rotacao % 360) + 360) % 360, gira = rot === 90 || rot === 180 || rot === 270, cvR = null, cxR = null;
    function girado(f) {
      var w = f.displayWidth, h = f.displayHeight, W2 = rot === 180 ? w : h, H2 = rot === 180 ? h : w;
      if (!cvR) { cvR = document.createElement("canvas"); cxR = cvR.getContext("2d"); }
      if (cvR.width !== W2 || cvR.height !== H2) { cvR.width = W2; cvR.height = H2; }
      cxR.save(); cxR.translate(W2 / 2, H2 / 2); cxR.rotate(rot * Math.PI / 180); cxR.drawImage(f, -w / 2, -h / 2); cxR.restore();
      return cvR;
    }
    return {
      tipo: "webcodecs", largura: tab.largura, altura: tab.altura, rotacao: rot,
      trecho: async function (ini, fim, aoQuadro, sinal) {
        var k0 = 0;
        for (var k = 0; k < tab.n; k++) { if (tab.chave[k] && tab.pts[k] <= ini + 0.001) k0 = k; if (tab.dts[k] > ini + 1) break; }
        var k1 = k0; while (k1 + 1 < tab.n && tab.dts[k1 + 1] <= fim + 0.6) k1++;
        var fila = [], erro = null, fechado = false;
        var dec = new raiz.VideoDecoder({ output: function (f) { fila.push(f); }, error: function (e) { erro = e; } });
        dec.configure(conf);
        var consumidor = (async function () {
          while (!fechado || fila.length) {
            if (!fila.length) { await espera(2); continue; }
            var f = fila.shift(), t = f.timestamp / 1e6;
            try {
              if (t >= ini - 0.001 && t <= fim && !(sinal && sinal.cancelado)) {
                if (gira) { var g = girado(f); await aoQuadro(t, g, g.width, g.height); } else await aoQuadro(t, f, f.displayWidth, f.displayHeight);
              }
            } finally { f.close(); }
          }
        })();
        try {
          /* lê os bytes em blocos contíguos (até 24 MB) e alimenta o decodificador, sem deixar a fila crescer */
          var i = k0;
          while (i <= k1) {
            if (sinal && sinal.cancelado) throw new Error("cancelado");
            var j = i, ini2 = tab.off[i], fim2 = ini2 + tab.tam[i];
            while (j + 1 <= k1 && tab.off[j + 1] >= ini2 && tab.off[j + 1] + tab.tam[j + 1] - ini2 < 24 * 1024 * 1024) { j++; fim2 = Math.max(fim2, tab.off[j] + tab.tam[j]); }
            var bloco = new Uint8Array(await file.slice(ini2, fim2).arrayBuffer());
            for (var s = i; s <= j; s++) {
              while (dec.decodeQueueSize > 8 || fila.length > 6) { if (erro) throw erro; await espera(3); }
              dec.decode(new raiz.EncodedVideoChunk({ type: tab.chave[s] ? "key" : "delta", timestamp: Math.round(tab.pts[s] * 1e6), data: bloco.subarray(tab.off[s] - ini2, tab.off[s] - ini2 + tab.tam[s]) }));
            }
            i = j + 1;
          }
          await dec.flush();
          if (erro) throw erro;
        } finally {
          fechado = true; await consumidor;
          if (dec.state !== "closed") try { dec.close(); } catch (e) {}
          fila.forEach(function (f) { f.close(); }); fila = [];
        }
      },
    };
  }
  /* <video> tocando o trecho (um quadro por chamada de requestVideoFrameCallback); deslocamento para clipes convertidos */
  function fonteVideo(v, desloc) {
    desloc = desloc || 0;
    return {
      tipo: "video", largura: v.videoWidth, altura: v.videoHeight,
      trecho: function (ini, fim, aoQuadro, sinal) {
        return new Promise(function (ok, falha) {
          var feito = false, ocupado = false, pend = Promise.resolve();
          function acabou(e) { if (feito) return; feito = true; v.pause(); pend.then(function () { e ? falha(e) : ok(); }); }
          function quadro(agora, meta) {
            if (feito) return;
            var t = (meta && meta.mediaTime != null ? meta.mediaTime : v.currentTime) + desloc;
            if ((sinal && sinal.cancelado) || t > fim || v.ended) return acabou(sinal && sinal.cancelado ? new Error("cancelado") : null);
            if (!ocupado && t >= ini) { ocupado = true; pend = Promise.resolve(aoQuadro(t, v, v.videoWidth, v.videoHeight)).catch(function () {}).then(function () { ocupado = false; }); }
            v.requestVideoFrameCallback(quadro);
          }
          var antes = function () {
            v.removeEventListener("seeked", antes); v.muted = true;
            if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(quadro); else return acabou(new Error("este navegador não entrega os quadros do vídeo"));
            v.play().catch(acabou);
          };
          v.addEventListener("seeked", antes); v.currentTime = Math.max(0, ini - desloc);
          setTimeout(function () { if (!feito && v.paused) acabou(); }, (fim - ini + 15) * 1000);
        });
      },
    };
  }

  /* ── bola: diferença com o quadro anterior e o seguinte, cor amarelada ou brilho, componentes pequenos ──
     Câmera na mão: cada quadro vem com G (imagem normalizada do quadro → imagem de referência, pela quadra acompanhada);
     antes de comparar, o pixel do quadro do meio é levado aos vizinhos por G e a diferença é a menor numa janela 3×3
     (meio pixel de erro do acompanhamento não vira "movimento" nas bordas das linhas). Saída já na imagem de referência */
  function DetectorBola(w, h) {
    var ant = null, atual = null, rgbAtual = null, tAtual = 0, gAnt = null, gAtual = null;
    var area = w * h, marca = new Uint8Array(area), fila = new Int32Array(area);
    var S = [w, 0, 0, 0, h, 0, 0, 0, 1], Si = [1 / w, 0, 0, 0, 1 / h, 0, 0, 0, 1];
    function lum(d) { var L = new Uint8Array(area); for (var i = 0, j = 0; i < area; i++, j += 4) L[i] = (d[j] * 3 + d[j + 1] * 5 + d[j + 2] * 2) / 10; return L; }
    function mul(A, B) { var C = []; for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) C.push(A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]); return C; }
    function inv(H) { return raiz.QLQuadraAuto.inverter(H); }
    function identidade(G) { return !G || (Math.abs(G[0] - 1) + Math.abs(G[1]) + Math.abs(G[2]) + Math.abs(G[3]) + Math.abs(G[4] - 1) + Math.abs(G[5]) + Math.abs(G[6]) + Math.abs(G[7])) < 1e-6; }
    /* pixel do quadro do meio → pixel do vizinho */
    function ponte(gc, gv) { return mul(S, mul(inv(gv), mul(gc, Si))); }
    function difMin(L, M, x, y, v) {
      var wv = M[6] * x + M[7] * y + M[8], xa = Math.round((M[0] * x + M[1] * y + M[2]) / wv), ya = Math.round((M[3] * x + M[4] * y + M[5]) / wv);
      if (xa < 1 || ya < 1 || xa >= w - 1 || ya >= h - 1) return 0;
      var mn = 255; for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) { var d = Math.abs(v - L[(ya + dy) * w + xa + dx]); if (d < mn) mn = d; }
      return mn;
    }
    return {
      /* recebe o quadro novo; devolve os candidatos do quadro anterior (que agora tem vizinhos dos dois lados) */
      quadro: function (t, rgba, G) {
        var L = lum(rgba), saida = null, gNovo = G || null;
        if (ant && atual) {
          var th = 16; marca.fill(0);
          var parado = identidade(gAnt) && identidade(gAtual) && identidade(gNovo);
          var Ma = parado ? null : ponte(gAtual || [1, 0, 0, 0, 1, 0, 0, 0, 1], gAnt || [1, 0, 0, 0, 1, 0, 0, 0, 1]), Mn = parado ? null : ponte(gAtual || [1, 0, 0, 0, 1, 0, 0, 0, 1], gNovo || [1, 0, 0, 0, 1, 0, 0, 0, 1]);
          for (var i = 0, j = 0; i < area; i++, j += 4) {
            var v = atual[i], ok;
            if (parado) ok = Math.abs(v - ant[i]) > th && Math.abs(v - L[i]) > th;
            else { var x = i % w, y = (i / w) | 0; ok = difMin(ant, Ma, x, y, v) > th && difMin(L, Mn, x, y, v) > th; }
            if (ok) {
              var r = rgbAtual[j], g = rgbAtual[j + 1], b = rgbAtual[j + 2];
              if (Math.min(r, g) - b > 40 || v > 205) marca[i] = 1; // amarelo-esverdeado da bola (pele e saibro ficam de fora) ou bola muito clara
            }
          }
          var comps = [], maxA = Math.max(40, area / 2500);
          for (var p = 0; p < area; p++) {
            if (marca[p] !== 1) continue;
            var n = 0, sx = 0, sy = 0, cab = 0, fim = 0; fila[fim++] = p; marca[p] = 2;
            while (cab < fim) {
              var q = fila[cab++], qx = q % w, qy = (q / w) | 0; n++; sx += qx; sy += qy;
              if (n > maxA * 3) continue;
              if (qx > 0 && marca[q - 1] === 1) { marca[q - 1] = 2; fila[fim++] = q - 1; }
              if (qx < w - 1 && marca[q + 1] === 1) { marca[q + 1] = 2; fila[fim++] = q + 1; }
              if (qy > 0 && marca[q - w] === 1) { marca[q - w] = 2; fila[fim++] = q - w; }
              if (qy < h - 1 && marca[q + w] === 1) { marca[q + w] = 2; fila[fim++] = q + w; }
            }
            if (n >= 1 && n <= maxA) comps.push([sx / n / w, sy / n / h, n]);
          }
          comps.sort(function (a, b) { return Math.abs(a[2] - 6) - Math.abs(b[2] - 6); });
          saida = { t: tAtual, bolas: comps.slice(0, 14).map(function (c) {
            var pt = [c[0], c[1]];
            if (gAtual) { var z = gAtual[6] * pt[0] + gAtual[7] * pt[1] + gAtual[8]; pt = [(gAtual[0] * pt[0] + gAtual[1] * pt[1] + gAtual[2]) / z, (gAtual[3] * pt[0] + gAtual[4] * pt[1] + gAtual[5]) / z]; }
            return [Math.round(pt[0] * 10000) / 10000, Math.round(pt[1] * 10000) / 10000];
          }) };
        }
        ant = atual; atual = L; rgbAtual = rgba; tAtual = t; gAnt = gAtual; gAtual = gNovo;
        return saida;
      },
      reiniciar: function () { ant = atual = rgbAtual = null; gAnt = gAtual = null; },
    };
  }

  /* ── processamento de todos os trechos ── */
  async function processar(file, video, trechos, cal, o) {
    o = o || {};
    var VS = raiz.QLVideoScout, sinal = o.sinal || {}, aviso = o.aoProgresso || function () {};
    var fonte = await fonteWebCodecs(file), clipe = false;
    if (!fonte && video && video.videoWidth) fonte = fonteVideo(video);
    if (!fonte) clipe = true;
    var pose = o.pose === undefined ? await raiz.QLVisao.carregarPose().catch(function () { return null; }) : o.pose;
    /* bola pela IA (WASB) quando o aparelho consegue rodar; senão, o detector por pixels abaixo */
    var ia = null;
    if (o.bolaIA !== false && raiz.QLBolaIA) {
      aviso(0, "Preparando a IA que segue a bola…");
      ia = await raiz.QLBolaIA.carregar(o.bolaIA).catch(function () { return null; });
    }
    var viaIA = ia ? ia.via : "", comIA = 0;
    var asp = cal.asp, W = LARG, Hh = Math.round(LARG / asp);
    var cv = document.createElement("canvas"); cv.width = W; cv.height = Hh;
    var cx = cv.getContext("2d", { willReadFrequently: true });
    var rc = document.createElement("canvas"); rc.width = rc.height = 256;
    var rx = rc.getContext("2d", { willReadFrequently: true });
    /* metade da quadra de cada jogador, em pixels da imagem, para começar a procurar */
    var L2 = VS.QUADRA.comprimento / 2, W2 = VS.QUADRA.larguraDuplas / 2 + 2;
    function caixaMetade(lado, Hiq) {
      var ys = lado === "perto" ? [-L2 - 3, -1] : [1, L2 + 4], pts = [[-W2, ys[0]], [W2, ys[0]], [W2, ys[1]], [-W2, ys[1]]].map(function (p) { return VS.aplicarH(Hiq || cal.Hi, p); });
      var x0 = Math.min.apply(null, pts.map(function (p) { return p[0]; })), x1 = Math.max.apply(null, pts.map(function (p) { return p[0]; }));
      var y0 = Math.min.apply(null, pts.map(function (p) { return p[1]; })), y1 = Math.max.apply(null, pts.map(function (p) { return p[1]; }));
      var alt = 1.9 * cal.escala(lado === "perto" ? -L2 : L2);
      return [x0, y0 - alt * 1.1, x1, y1];
    }
    var roi = { perto: null, longe: null }, ultVarre = {};
    /* câmera na mão: a quadra é acompanhada a cada quadro (em 640 px) e tudo o que sai do quadro (pés, pose, bola) vai para a
       imagem de referência, a da calibração, por G = Hi_ref · H_quadro. Para um celular que gira na mão isso vale também
       para a bola no ar. Câmera parada (G ≈ identidade por 1 s): confere a quadra só a cada 6 quadros */
    var QA = raiz.QLQuadraAuto, acomp = QA && QA.Acompanhador && o.acompanhar !== false ? QA.Acompanhador(cal.Hi) : null;
    var cq = document.createElement("canvas"), cqx = cq.getContext("2d", { willReadFrequently: true }); cq.width = 640; cq.height = Math.round(640 / asp);
    var HnAtual = cal.Hi, quietos = 0, nq = 0, movel = false;
    function mul(A, B) { return QA.multiplicar(A, B); }
    /* maior deslocamento (px na imagem reduzida) por G de pontos da quadra (cantos e meio): os cantos do quadro, longe da
       quadra, ampliam o ruído do acompanhamento e fariam uma câmera parada parecer mexida */
    var PQ = [[-5.5, -11.9], [5.5, -11.9], [5.5, 11.9], [-5.5, 11.9], [0, 0]].map(function (p) { return VS.aplicarH(cal.Hi, p); });
    function desvio(G) {
      var m = 0; PQ.forEach(function (c) { var p = VS.aplicarH(G, c); m = Math.max(m, Math.hypot((p[0] - c[0]) * W, (p[1] - c[1]) * Hh)); }); return m;
    }
    function quadraNoQuadro(img) {
      if (!acomp) return null;
      nq++;
      if (quietos < 30 || nq % 6 === 0) {
        cqx.drawImage(img, 0, 0, cq.width, cq.height);
        var r = acomp.quadro(cqx.getImageData(0, 0, cq.width, cq.height).data, cq.width, cq.height), antes = HnAtual;
        HnAtual = r.Hn;
        var passo = desvio(QA.multiplicar(antes, QA.inverter(HnAtual)));
        quietos = passo < 0.5 ? quietos + 1 : 0;
      }
      /* até ~3 px é o ruído entre a calibração e o acompanhamento numa câmera parada: fica a imagem como está */
      var G = QA.multiplicar(cal.Hi, QA.inverter(HnAtual));
      if (desvio(G) < 3) return null;
      movel = true; return G;
    }
    function leva(G, p) { if (!G || !p) return p; var q = VS.aplicarH(G, [p.x != null ? p.x : p[0], p.y != null ? p.y : p[1]]); return p.x != null ? { x: q[0], y: q[1], v: p.v } : q; }
    var resultados = [], t0 = Date.now(), total = trechos.reduce(function (s, x) { return s + (x.fim - x.ini); }, 0), feito = 0;
    for (var k = 0; k < trechos.length; k++) {
      if (sinal.cancelado) throw new Error("cancelado");
      var tr = trechos[k], det = DetectorBola(W, Hh), quadros = [], alvoPose = [], fps = 30, dia = ia ? ia.trecho() : null;
      if (acomp) { acomp.novoTrecho(); quietos = 0; }
      tr.hits.forEach(function (h) { [-0.55, -0.16, -0.12, -0.05, 0, 0.12, 0.16].forEach(function (d) { alvoPose.push(h + d); }); });
      for (var tp = tr.ini; tp <= tr.fim; tp += 0.2) alvoPose.push(tp);
      alvoPose.sort(function (a, b) { return a - b; });
      var ip = 0;
      var aoQuadro = async function (t, img, wi, he) {
        var G = quadraNoQuadro(img), Hiq = G ? HnAtual : cal.Hi, Hq = G ? QA.inverter(HnAtual) : cal.H;
        cx.drawImage(img, 0, 0, W, Hh);
        var d = cx.getImageData(0, 0, W, Hh).data, sb = det.quadro(t, d, G);
        if (sb) { var qa = quadros[quadros.length - 1]; if (qa && Math.abs(qa.t - sb.t) < 0.001) qa.bolas = sb.bolas; }
        var q = { t: Math.round(t * 1000) / 1000, jog: [], bolas: [] };
        if (G) q.G = G.map(function (x) { return Math.round(x * 1e6) / 1e6; }); // imagem deste quadro → imagem de referência (câmera em movimento)
        if (dia) { try { await dia.quadro(img, wi, he, G, q); } catch (e) { dia = null; ia = null; } }
        while (ip < alvoPose.length && alvoPose[ip] < t - 0.5 / fps) ip++;
        if (ip < alvoPose.length && alvoPose[ip] <= t + 0.5 / fps) {
          while (ip < alvoPose.length && alvoPose[ip] <= t + 0.5 / fps) ip++;
          ["perto", "longe"].forEach(function (lado) {
            var j = jogador(img, wi, he, t, lado, d, Hq, Hiq, !!G);
            if (j) q.jog.push(G ? { pe: leva(G, j.pe), lm: j.lm && j.lm.map(function (p) { return leva(G, p); }), cor: j.cor } : j);
          });
        }
        quadros.push(q);
      };
      function jogador(img, wi, he, t, lado, rgba, Hq, Hiq, mexe) {
        var r = roi[lado] || caixaMetade(lado, Hiq);
        var cxr = (r[0] + r[2]) / 2 * wi, cyr = (r[1] + r[3]) / 2 * he, lado2 = Math.max((r[2] - r[0]) * wi, (r[3] - r[1]) * he, 96);
        function recorte(sx, sy, lado2) { // pose num quadrado da imagem; devolve os pontos no quadro inteiro
          sx = Math.max(0, sx); sy = Math.max(0, sy); var sw = Math.min(wi - sx, lado2), sh = Math.min(he - sy, lado2);
          if (sw < 16 || sh < 16) return null;
          rx.clearRect(0, 0, 256, 256); rx.drawImage(img, sx, sy, sw, sh, 0, 0, 256, 256);
          var lm = null; try { lm = pose.detectar(rc, t * 1000, lado); } catch (e) { lm = null; }
          return lm ? lm.map(function (p) { return { x: (sx + p.x * sw) / wi, y: (sy + p.y * sh) / he, v: p.v }; }) : null;
        }
        function naMetade(f) { // pessoa nova: pés dentro da área de jogo do lado certo, longe da rede (juiz, gente na lateral, poste)
          var pp = [27, 28].map(function (i) { return f[i]; }); if (!pp[0] || !pp[1]) return false;
          var P = VS.aplicarH(Hq, [(pp[0].x + pp[1].x) / 2, Math.max(pp[0].y, pp[1].y)]);
          return Math.abs(P[0]) <= 7.5 && (lado === "perto" ? P[1] <= -3 && P[1] >= -L2 - 6 : P[1] >= 3 && P[1] <= L2 + 6);
        }
        var full = null;
        if (pose && pose.detectarQuadro) full = pose.detectarQuadro(t, lado); // testes: pose já no quadro inteiro
        else if (pose) {
          /* sem a pessoa acompanhada e com a metade da quadra grande demais perto do tamanho dela (o jogador de longe vira
             15 px no recorte), varre a metade em quadrados de ~3 alturas de pessoa */
          var altPx = 1.9 * cal.escala(lado === "perto" ? -L2 : L2) * he, T = Math.max(96, 3.2 * altPx);
          if (roi[lado] || lado2 <= 1.6 * T) full = recorte(cxr - lado2 / 2, cyr - lado2 / 2, lado2);
          else if (!(t - (ultVarre[lado] || -9) < 0.5)) {
            /* no máximo a cada 0,5 s, começando pela linha de fundo (onde o jogador costuma estar), até 6 quadrados */
            ultVarre[lado] = t;
            var sinal = lado === "perto" ? -1 : 1, quad = [];
            [L2 - 0.5, L2 - 4, L2 - 7.5].forEach(function (yq) {
              [-4, 0, 4].forEach(function (xq) { var c = VS.aplicarH(Hiq, [xq, sinal * yq]); quad.push([c[0] * wi - T / 2, c[1] * he - T * 0.75]); });
            });
            for (var qi = 0; qi < quad.length && qi < 6 && !full; qi++) { var f = recorte(quad[qi][0], quad[qi][1], T); if (f && naMetade(f)) full = f; }
          }
        }
        if (full) {
          var pes = [27, 28, 29, 30, 31, 32].map(function (i) { return full[i]; }).filter(function (p) { return p && p.v > 0.2; });
          if (!pes.length) return null;
          var pe = [(full[27].x + full[28].x) / 2, Math.max.apply(null, pes.map(function (p) { return p.y; }))];
          var P = VS.aplicarH(Hq, pe);
          if (Math.abs(P[0]) > 9 || (lado === "perto" ? P[1] > 0.5 || P[1] < -L2 - 7 : P[1] < -0.5 || P[1] > L2 + 7)) { roi[lado] = null; return null; } // outra pessoa
          var xs = full.map(function (p) { return p.x; }), ys = full.map(function (p) { return p.y; }), alt = Math.max.apply(null, ys) - Math.min.apply(null, ys);
          var c = [(Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2, (Math.min.apply(null, ys) + Math.max.apply(null, ys)) / 2], m = Math.max(alt * 1.3, 0.04);
          roi[lado] = [c[0] - m / asp, c[1] - m, c[0] + m / asp, c[1] + m];
          /* cor do tronco: média dos pixels entre ombros e quadris, na imagem reduzida */
          var tx = [11, 12, 23, 24].map(function (i) { return full[i]; }), cor = null;
          var bx0 = Math.min.apply(null, tx.map(function (p) { return p.x; })) * W, bx1 = Math.max.apply(null, tx.map(function (p) { return p.x; })) * W;
          var by0 = Math.min.apply(null, tx.map(function (p) { return p.y; })) * Hh, by1 = Math.max.apply(null, tx.map(function (p) { return p.y; })) * Hh;
          var ax0 = Math.round(bx0 + (bx1 - bx0) * 0.25), ax1 = Math.max(ax0, Math.round(bx1 - (bx1 - bx0) * 0.25)), ay0 = Math.round(by0 + (by1 - by0) * 0.2), ay1 = Math.max(ay0, Math.round(by1 - (by1 - by0) * 0.3));
          var sr = 0, sg = 0, sbb = 0, nn = 0;
          for (var yy = Math.max(0, ay0); yy <= Math.min(Hh - 1, ay1); yy++) for (var xx = Math.max(0, ax0); xx <= Math.min(W - 1, ax1); xx++) { var ii = (yy * W + xx) * 4; sr += rgba[ii]; sg += rgba[ii + 1]; sbb += rgba[ii + 2]; nn++; }
          if (nn) cor = [sr / nn, sg / nn, sbb / nn];
          return { pe: pe, lm: full, cor: cor };
        }
        roi[lado] = null;
        return mexe ? null : manchaDeMovimento(rgba, lado);
      }
      /* sem pose: a maior mancha de movimento na metade da quadra (bastante para posição e lado) */
      var antL = {};
      function manchaDeMovimento(rgba, lado) {
        var L = new Uint8Array(W * Hh); for (var i = 0, j = 0; i < L.length; i++, j += 4) L[i] = (rgba[j] + rgba[j + 1] + rgba[j + 2]) / 3;
        var res = null;
        if (antL[lado]) {
          var r = caixaMetade(lado), x0 = Math.max(0, Math.floor(r[0] * W)), x1 = Math.min(W - 1, Math.ceil(r[2] * W)), y0 = Math.max(0, Math.floor(r[1] * Hh)), y1 = Math.min(Hh - 1, Math.ceil(r[3] * Hh));
          var n = 0, sx = 0, ymax = 0;
          for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) { var p = y * W + x; if (Math.abs(L[p] - antL[lado][p]) > 25) { n++; sx += x; if (y > ymax) ymax = y; } }
          if (n > 30) { var pe = [sx / n / W, ymax / Hh], P = VS.aplicarH(cal.H, pe); if (Math.abs(P[0]) < 9) res = { pe: pe, lm: null, cor: null }; }
        }
        antL[lado] = L; return res;
      }
      if (clipe) {
        aviso(feito / total, "Convertendo o trecho " + (k + 1) + " de " + trechos.length + " (o navegador não lê este vídeo direto)…");
        var blob = await raiz.QLAudioVideo.clipe(file, tr.ini, tr.fim - tr.ini + 0.3, { altura: 540 });
        var vv = document.createElement("video"); vv.muted = true; vv.playsInline = true; vv.src = URL.createObjectURL(blob);
        await new Promise(function (r) { vv.onloadeddata = r; vv.onerror = r; });
        await fonteVideo(vv, tr.ini).trecho(tr.ini, tr.fim, aoQuadro, sinal);
        URL.revokeObjectURL(vv.src);
      } else await fonte.trecho(tr.ini, tr.fim, aoQuadro, sinal);
      if (dia) { try { await dia.fim(); } catch (e) { dia = null; ia = null; } }
      /* com a IA: os candidatos dela (q.ia) no lugar dos do detector por pixels; se ela falhou no meio, fica o detector */
      quadros.forEach(function (q) { if (dia) q.bolas = q.ia || []; delete q.ia; });
      if (dia) comIA++;
      /* placa de vídeo fraca demais (a análise passaria de ~2,5× a duração dos pontos): os próximos pontos vão pelos pixels */
      if (dia && dia.medida().rodadas >= 4 && dia.medida().msMediana > ((o.bolaIA && o.bolaIA.limiteMs) || 250)) ia = null;
      var dados = { ini: tr.ini, fim: tr.fim, hits: tr.hits, quadros: quadros };
      resultados.push(dados);
      if (o.aoTrecho) o.aoTrecho(k, dados);
      feito += tr.fim - tr.ini;
      var seg = (Date.now() - t0) / 1000, falta = feito ? seg / feito * (total - feito) : 0;
      aviso(feito / total, "Analisando o ponto " + (k + 1) + " de " + trechos.length + (k > 2 ? " · cerca de " + Math.max(1, Math.round(falta / 60)) + " min restantes" : "") + "…");
    }
    return { dados: resultados, fonte: clipe ? "clipes" : fonte.tipo, pose: !!pose, cameraMovel: movel, bola: comIA ? "ia-" + viaIA + (comIA < trechos.length ? "-parcial" : "") : "pixels" };
  }

  /* ── um quadro do vídeo no instante t, para achar a quadra ──
     No iPhone (Safari), desenhar um <video> que só foi posicionado (sem tocar) devolve um quadro PRETO; por isso, em ordem:
     1) decodificar o quadro direto do arquivo (WebCodecs); 2) tocar um instante do vídeo, sem som, e pegar o quadro que o
     navegador entrega (requestVideoFrameCallback); 3) o conversor do próprio app (ffmpeg). Quadro preto é descartado. */
  function copia(img, w, h) { var c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(img, 0, 0, w, h); return c; }
  function escuro(c) {
    var w = 64, h = Math.max(1, Math.round(64 * c.height / c.width)), m = document.createElement("canvas"); m.width = w; m.height = h;
    var x = m.getContext("2d", { willReadFrequently: true }); x.drawImage(c, 0, 0, w, h);
    var d = x.getImageData(0, 0, w, h).data, soma = 0, soma2 = 0, n = w * h;
    for (var i = 0; i < d.length; i += 4) { var l = (d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 2) / 10; soma += l; soma2 += l * l; }
    var med = soma / n, dp = Math.sqrt(Math.max(0, soma2 / n - med * med));
    return med < 8 || dp < 2; // tudo preto (ou uma cor só): o navegador não entregou o quadro
  }
  var fontes = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  async function quadroEm(file, v, t, o) {
    o = o || {};
    var tentativas = [];
    if (file) tentativas.push(async function () {
      var f = fontes && fontes.get(file);
      if (f === undefined) { f = await fonteWebCodecs(file).catch(function () { return null; }); if (fontes) fontes.set(file, f); }
      if (!f) return null;
      var c = null;
      await f.trecho(Math.max(0, t), t + 0.25, function (tq, img, w, h) { if (!c) c = copia(img, w, h); });
      return c;
    });
    if (v && v.src && !o.semVideo) tentativas.push(async function () {
      if (!v.videoWidth) await new Promise(function (r) { var f = function () { v.removeEventListener("loadeddata", f); r(); }; v.addEventListener("loadeddata", f); setTimeout(r, 4000); });
      if (!v.videoWidth || !v.requestVideoFrameCallback) return null;
      var c = null, mutado = v.muted;
      await Promise.race([fonteVideo(v, 0).trecho(t, t + 0.4, function (tq, img, w, h) { if (!c) c = copia(img, w, h); }), espera(8000)]);
      v.pause(); v.muted = mutado;
      return c;
    });
    if (file && raiz.QLAudioVideo && raiz.QLAudioVideo.quadro) tentativas.push(async function () {
      var b = await raiz.QLAudioVideo.quadro(file, t), im = new Image(), url = URL.createObjectURL(b);
      try { await new Promise(function (r, f) { im.onload = r; im.onerror = f; im.src = url; }); return copia(im, im.naturalWidth, im.naturalHeight); }
      finally { URL.revokeObjectURL(url); }
    });
    for (var k = 0; k < tentativas.length; k++) {
      var c = await tentativas[k]().catch(function () { return null; });
      if (c && c.width && !escuro(c)) return { img: c, asp: c.width / c.height };
    }
    return null;
  }

  raiz.QLVisao = { processar: processar, carregarPose: carregarPose, DetectorBola: DetectorBola, fonteWebCodecs: fonteWebCodecs, quadroEm: quadroEm, _escuro: escuro };
})(typeof window !== "undefined" ? window : this);
