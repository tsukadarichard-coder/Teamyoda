/* Motor de análise biomecânica (forehand) — funções puras, sem dependências.
   Entrada: quadros [{t, lm:[{x,y,z,v}...33 pontos MediaPipe]}] (x,y normalizados 0..1, y cresce para baixo). */
(function (raiz, fab) {
  if (typeof module === "object" && module.exports) module.exports = fab();
  else raiz.QLBiomec = fab();
})(this, function () {
  var P = { nariz: 0, ombroE: 11, ombroD: 12, cotE: 13, cotD: 14, punhoE: 15, punhoD: 16, quadrilE: 23, quadrilD: 24, joelhoE: 25, joelhoD: 26, tornE: 27, tornD: 28, peE: 31, peD: 32 };
  var FASES = ["Preparação", "Giro (unit turn)", "Descida da raquete", "Contato", "Seguimento", "Recuperação"];

  var FASES_SAQUE = ["Preparação", "Lançamento da bola", "Armada (racket drop)", "Contato", "Seguimento", "Recuperação"];
  function nomesFases(golpe) { return golpe === "saque" ? FASES_SAQUE : FASES; }

  /* Faixas de referência editáveis. Valores iniciais de referência; o treinador ajusta na tela. */
  var REGRAS = {
    /* ângulo do joelho (quadril-joelho-tornozelo) e do tronco (ombro-quadril-joelho) no giro: 180° = reto. Base atlética, não agachamento. */
    joelhos: { alvo: 130, tol: 15 },
    tronco: { alvo: 155, tol: 15 },
    antebracoNaoDominante: { max: 20 },
    contatoFrente: { min: 0.15 },
    splitStep: { min: 0.015 },
    saque: { joelhosArmada: { alvo: 125, tol: 20 }, cotoveloArmada: { alvo: 90, tol: 20 }, cotoveloContato: { min: 160 }, cotoveloLancamento: { min: 150 }, alturaContato: { min: 0.5 }, frenteCabeca: { min: 0.1 }, extensaoJoelhos: { min: 25 } },
    backhand: { duasMaos: { max: 0.45 }, ndAtras: { min: 0.3 }, rotacao: { min: 0.1 } }
  };

  function ang(a, b, c) { // ângulo em b (graus), 2D
    var v1x = a.x - b.x, v1y = a.y - b.y, v2x = c.x - b.x, v2y = c.y - b.y;
    var n = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
    if (!n) return NaN;
    var cs = (v1x * v2x + v1y * v2y) / n;
    return Math.acos(Math.max(-1, Math.min(1, cs))) * 180 / Math.PI;
  }
  function visivel(p) { return p && (p.v === undefined || p.v > 0.3); }
  function ladoIdx(dom) { return dom === "E" ? { p: P.punhoE, o: P.ombroE, c: P.cotE, q: P.quadrilE, j: P.joelhoE, t: P.tornE, nd: { p: P.punhoD, c: P.cotD, o: P.ombroD, q: P.quadrilD, j: P.joelhoD, t: P.tornD } }
    : { p: P.punhoD, o: P.ombroD, c: P.cotD, q: P.quadrilD, j: P.joelhoD, t: P.tornD, nd: { p: P.punhoE, c: P.cotE, o: P.ombroE, q: P.quadrilE, j: P.joelhoE, t: P.tornE } }; }
  function meio(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
  function suavizar(arr, k) {
    var out = [], i, j, s, n;
    for (i = 0; i < arr.length; i++) { s = 0; n = 0; for (j = Math.max(0, i - k); j <= Math.min(arr.length - 1, i + k); j++) { if (isFinite(arr[j])) { s += arr[j]; n++; } } out.push(n ? s / n : NaN); }
    return out;
  }
  /* duração típica de um quadro (mediana), para transformar segundos em quadros */
  function passo(quadros) {
    var d = [];
    for (var i = 1; i < quadros.length; i++) { var x = quadros[i].t - quadros[i - 1].t; if (x > 0) d.push(x); }
    d.sort(function (a, b) { return a - b; });
    return d.length ? d[Math.floor(d.length / 2)] : 1 / 30;
  }
  function quadrosEm(quadros, seg) { return Math.max(1, Math.round(seg / passo(quadros))); }

  /* Limpeza dos quadros que vêm da pose (MediaPipe), antes de achar as fases:
     1) troca esquerda/direita: de lado, o modelo às vezes inverte braços e pernas num quadro (o punho "pula" para o outro braço e
        parece o golpe mais rápido do vídeo). Quando trocar os lados deixa o corpo bem mais perto do quadro anterior, a troca é desfeita.
     2) salto isolado: um ponto que pula longe num quadro e volta no seguinte fica "não visto" (v = 0) só naquele quadro.
     Devolve quadros novos, do mesmo tamanho e na mesma ordem (os índices das fases continuam valendo para o vídeo). */
  var PARES = [[11, 12], [13, 14], [15, 16], [17, 18], [19, 20], [21, 22], [23, 24], [25, 26], [27, 28], [29, 30], [31, 32], [1, 4], [2, 5], [3, 6], [7, 8], [9, 10]];
  var PAR = {}; PARES.forEach(function (p) { PAR[p[0]] = p[1]; PAR[p[1]] = p[0]; });
  var MEMBROS = [13, 14, 15, 16, 25, 26, 27, 28];
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function limpar(quadros) {
    if (!quadros || !quadros.length || quadros.limpo) return quadros;
    var out = quadros.map(function (q) { return { t: q.t, lm: (q.lm || []).map(function (p) { return p ? { x: p.x, y: p.y, z: p.z, v: p.v } : p; }) }; });
    var i, k;
    for (i = 1; i < out.length; i++) {
      var ant = out[i - 1].lm, cur = out[i].lm, manter = 0, trocar = 0, n = 0;
      MEMBROS.forEach(function (j) {
        var a = ant[j], b = cur[j], c = cur[PAR[j]];
        if (!visivel(a) || !visivel(b) || !visivel(c)) return;
        manter += dist(a, b); trocar += dist(a, c); n++;
      });
      if (n >= 4 && trocar < manter * 0.6 && manter / n > 0.015) {
        var novo = cur.slice();
        Object.keys(PAR).forEach(function (j) { novo[j] = cur[PAR[j]]; });
        out[i].lm = novo;
      }
    }
    /* tronco típico do vídeo, para medir o que é "salto" */
    var tr = out.map(function (q) { var l = q.lm; return l[11] && l[12] && l[23] && l[24] ? dist(meio(l[11], l[12]), meio(l[23], l[24])) : NaN; }).filter(isFinite).sort(function (a, b) { return a - b; });
    var J = (tr.length ? tr[Math.floor(tr.length / 2)] : 0.2) * 0.6;
    for (i = 1; i < out.length - 1; i++) {
      for (k = 0; k < (out[i].lm || []).length; k++) {
        var p0 = out[i - 1].lm[k], p1 = out[i].lm[k], p2 = out[i + 1].lm[k];
        if (!visivel(p0) || !visivel(p1) || !visivel(p2)) continue;
        if (dist(p0, p1) > J && dist(p1, p2) > J && dist(p0, p2) < J * 0.5) out[i].lm[k] = { x: p1.x, y: p1.y, z: p1.z, v: 0 };
      }
    }
    out.limpo = true;
    return out;
  }

  function idxMax(arr, a, b) { var m = -Infinity, k = a; for (var i = a; i <= b; i++) if (isFinite(arr[i]) && arr[i] > m) { m = arr[i]; k = i; } return k; }
  function idxMin(arr, a, b) { var m = Infinity, k = a; for (var i = a; i <= b; i++) if (isFinite(arr[i]) && arr[i] < m) { m = arr[i]; k = i; } return k; }

  /* Preparação = posição de espera, o último instante parado antes de o movimento começar. Volta do ponto `fim` (giro ou lançamento):
     passa pela virada (velocidade baixa no ponto extremo), atravessa o movimento (velocidade alta) e para no primeiro quadro calmo antes
     dele. Se o movimento já vinha desde o começo da janela, fica o quadro mais "à frente" (`posicao` máxima) da janela. */
  function inicioDoMovimento(vel, fim, ini, limiar, posicao, maiorEhFrente) {
    var k = fim, virada = 0;
    while (k > ini && (vel[k] || 0) < limiar && virada < 12) { k--; virada++; }
    /* atravessa o movimento; um quadro calmo isolado (ruído da pose) não encerra: precisa de dois seguidos */
    var andou = false;
    while (k > ini && ((vel[k] || 0) >= limiar || (vel[k - 1] || 0) >= limiar)) { k--; andou = true; }
    if (andou && k > ini) return k;
    var melhor = ini, m = -Infinity;
    for (var i = ini; i < fim; i++) { var v = maiorEhFrente ? posicao[i] : -posicao[i]; if (isFinite(v) && v > m) { m = v; melhor = i; } }
    return Math.min(melhor, Math.max(ini, fim - 1));
  }

  /* Direção para onde o jogador está virado (+1 direita da imagem, -1 esquerda): sentido do movimento do punho até o contato. */
  function segmentar(quadros, dom) {
    var L = ladoIdx(dom), n = quadros.length;
    if (n < 12) return null;
    var px = [], py = [], vel = [], i;
    for (i = 0; i < n; i++) { var w = quadros[i].lm[L.p]; px.push(visivel(w) ? w.x : NaN); py.push(visivel(w) ? w.y : NaN); }
    px = suavizar(px, 2); py = suavizar(py, 2);
    for (i = 0; i < n; i++) {
      if (i === 0 || !isFinite(px[i]) || !isFinite(px[i - 1])) { vel.push(0); continue; }
      var dt = Math.max(1e-3, quadros[i].t - quadros[i - 1].t);
      vel.push(Math.hypot(px[i] - px[i - 1], py[i] - py[i - 1]) / dt);
    }
    var vs = suavizar(vel, 1);
    var contato = idxMax(vs, 2, n - 3);
    // direção do golpe: do ponto mais recuado ao contato
    var pre = Math.max(0, contato - Math.round(n * 0.35));
    var dir = (px[contato] - px[idxMin(px, pre, contato)]) >= 0 ? 1 : -1;
    var sinal = dir > 0 ? px : px.map(function (v) { return -v; });
    /* o giro (punho mais recuado) é procurado só no último 1,6 s antes do contato: o que acontece antes disso (andar, quicar a bola,
       outro golpe) não é a preparação deste golpe */
    var ini = Math.max(0, contato - quadrosEm(quadros, 1.6));
    var giro = idxMin(sinal, ini, contato);                     // punho mais recuado
    var desc = idxMax(py, giro, contato);                       // ponto mais baixo (y maior) entre giro e contato
    if (desc >= contato) desc = Math.max(giro, contato - 1);
    var seg = idxMin(py, contato, n - 1);                       // punho mais alto após o contato
    if (seg <= contato) seg = Math.min(n - 1, contato + 1);
    var prep = inicioDoMovimento(vs, giro, Math.max(0, giro - quadrosEm(quadros, 1.5)), 0.12 * (vs[contato] || 1), sinal, true);
    return { dir: dir, idx: [prep, giro, desc, contato, seg, Math.min(n - 1, seg + Math.max(1, Math.round((n - 1 - seg) / 2)))], contato: contato, giro: giro, prep: prep, vel: vs };
  }

  function joelhosEm(q) {
    var lm = q.lm, js = [ang(lm[P.quadrilE], lm[P.joelhoE], lm[P.tornE]), ang(lm[P.quadrilD], lm[P.joelhoD], lm[P.tornD])].filter(isFinite);
    return js.length ? Math.min.apply(null, js) : Infinity;
  }
  function medidas(q, dom, dir) {
    var L = ladoIdx(dom), lm = q.lm, m = {};
    var ombroM = meio(lm[P.ombroE], lm[P.ombroD]), quadM = meio(lm[P.quadrilE], lm[P.quadrilD]);
    var torso = Math.hypot(ombroM.x - quadM.x, ombroM.y - quadM.y) || 1;
    var jE = ang(lm[P.quadrilE], lm[P.joelhoE], lm[P.tornE]), jD = ang(lm[P.quadrilD], lm[P.joelhoD], lm[P.tornD]);
    var js = [jE, jD].filter(isFinite);
    m.joelhos = js.length ? Math.min.apply(null, js) : NaN;
    // flexão de tronco: ângulo entre o tronco e a vertical (0 = reto). Reportado como ângulo ombro-quadril-joelho (180 = reto).
    var jm = meio(lm[P.joelhoE], lm[P.joelhoD]);
    m.tronco = ang(ombroM, quadM, jm);
    // antebraço do braço não dominante em relação à horizontal
    var nd = L.nd, cot = lm[nd.c], pun = lm[nd.p];
    m.antebracoND = (visivel(cot) && visivel(pun)) ? Math.abs(Math.atan2(pun.y - cot.y, Math.abs(pun.x - cot.x))) * 180 / Math.PI : NaN;
    // contato à frente: distância horizontal do punho dominante ao quadril, na direção do golpe, em comprimentos de tronco
    m.contatoFrente = ((lm[L.p].x - quadM.x) * dir) / torso;
    m.alturaContato = (quadM.y - lm[L.p].y) / torso; // positivo = acima do quadril
    // rotação de ombros (proxy): largura aparente dos ombros / largura do quadril
    var lo = Math.abs(lm[P.ombroE].x - lm[P.ombroD].x), lq = Math.abs(lm[P.quadrilE].x - lm[P.quadrilD].x);
    m.largOmbros = lo / torso; m.largQuadril = lq / torso;
    var domW = lm[L.p], domC = lm[L.c], domO = lm[L.o], ndW = lm[nd.p], ndC = lm[nd.c], ndO = lm[nd.o], nz = lm[P.nariz];
    m.cotoveloDom = ang(domO, domC, domW);
    m.cotoveloND = ang(ndO, ndC, ndW);
    m.alturaPunhoCabeca = (nz.y - domW.y) / torso;           // positivo = punho acima da cabeça
    m.alturaPunhoNDCabeca = (nz.y - ndW.y) / torso;
    m.frenteCabeca = ((domW.x - nz.x) * dir) / torso;
    m.distMaos = Math.hypot(domW.x - ndW.x, domW.y - ndW.y) / torso;
    m.ndAtras = ((domW.x - ndW.x) * dir) / torso;            // quanto a mão não dominante está atrás da dominante
    m.ndFrente = ((ndW.x - quadM.x) * dir) / torso;
    return m;
  }

  function splitStep(quadros, fim, ini) {
    var ys = [], i;
    for (i = Math.max(0, ini || 0); i <= fim; i++) { var a = quadros[i].lm[P.tornE], b = quadros[i].lm[P.tornD]; ys.push((a.y + b.y) / 2); }
    ys = suavizar(ys, 1);
    if (ys.length < 6) return { amp: 0 };
    var piso = Math.max.apply(null, ys), minimo = Math.min.apply(null, ys);
    return { amp: piso - minimo };
  }

  function classificar(valor, ok, aten) { return isFinite(valor) ? (ok ? "ok" : "atencao") : "nao_avaliavel"; }


  /* Saque: contato = ponto mais alto do punho dominante; lançamento = ápice do punho não dominante; armada = ponto mais baixo do punho dominante entre eles. */
  function segmentarSaque(quadros, dom) {
    var L = ladoIdx(dom), n = quadros.length;
    if (n < 12) return null;
    var dy = [], ny = [], dx = [], i;
    for (i = 0; i < n; i++) { var w = quadros[i].lm[L.p], v = quadros[i].lm[L.nd.p]; dy.push(visivel(w) ? w.y : NaN); dx.push(visivel(w) ? w.x : NaN); ny.push(visivel(v) ? v.y : NaN); }
    dy = suavizar(dy, 2); ny = suavizar(ny, 2); dx = suavizar(dx, 2);
    var contato = idxMin(dy, 2, n - 3);
    var lanc = idxMin(ny, Math.max(0, contato - quadrosEm(quadros, 2)), contato);
    if (lanc >= contato) lanc = Math.max(1, contato - 2);
    /* armada (racket drop): o cotovelo da raquete já subiu à altura do ombro e o punho cai atrás das costas (punho o mais abaixo
       do cotovelo). Não é o ponto mais baixo do punho: no lançamento o braço da raquete ainda está pendurado e o punho fica bem mais
       baixo, o que fazia a armada cair no mesmo quadro do lançamento. */
    var arm = -1, melhor = -Infinity;
    for (i = lanc + 1; i < contato; i++) {
      var lm = quadros[i].lm, cw = lm[L.c], ow = lm[L.o], pw = lm[L.p], qw = lm[L.q];
      if (!visivel(cw) || !visivel(ow) || !visivel(pw)) continue;
      var tr = visivel(qw) ? Math.max(0.05, Math.abs(qw.y - ow.y)) : 0.2;
      if (cw.y > ow.y + 0.25 * tr) continue;               // cotovelo ainda abaixo do ombro: braço pendurado ou subindo
      var queda = (pw.y - cw.y) / tr;
      if (queda > melhor) { melhor = queda; arm = i; }
    }
    if (arm < 0) arm = Math.max(lanc + 1, contato - quadrosEm(quadros, 0.12));
    if (arm >= contato) arm = Math.max(lanc, contato - 1);
    /* carga das pernas: a flexão mais funda entre o lançamento e a armada (o joelho dobra no troféu e já estende na armada) */
    var carga = lanc, menorJ = Infinity;
    for (i = lanc; i <= arm; i++) { var mj = joelhosEm(quadros[i]); if (mj < menorJ) { menorJ = mj; carga = i; } }
    var hipX = (quadros[lanc].lm[P.quadrilE].x + quadros[lanc].lm[P.quadrilD].x) / 2, nw = quadros[lanc].lm[L.nd.p];
    var dir = (nw.x - hipX) >= 0 ? 1 : -1;
    var seg = Math.min(n - 1, contato + Math.max(2, Math.round((n - 1 - contato) / 2)));
    /* preparação: posição de espera antes de o braço do lançamento começar a subir */
    var vn = [0];
    for (i = 1; i < n; i++) vn.push(isFinite(ny[i]) && isFinite(ny[i - 1]) ? Math.abs(ny[i] - ny[i - 1]) / Math.max(1e-3, quadros[i].t - quadros[i - 1].t) : 0);
    vn = suavizar(vn, 1);
    var iniPrep = Math.max(0, lanc - quadrosEm(quadros, 2.5)), picoN = 0;
    for (i = iniPrep; i <= lanc; i++) if (vn[i] > picoN) picoN = vn[i];
    var prep = inicioDoMovimento(vn, lanc, iniPrep, 0.12 * (picoN || 1), ny, true);
    return { dir: dir, idx: [prep, lanc, arm, contato, seg, Math.min(n - 1, Math.max(seg + 1, contato + quadrosEm(quadros, 1.2)))], contato: contato, prep: prep, carga: carga };
  }

  /* Pose do quadro de cada fase, compacta ([x, y] com 3 casas; null onde o ponto não foi visto): vai no relatório guardado para que
     toda análise tenha a imagem da fase, mesmo quando a foto do vídeo não pôde ser guardada. */
  function poseCompacta(lm) {
    return (lm || []).map(function (p) { return p && isFinite(p.x) && isFinite(p.y) && (p.v == null || p.v >= 0.2) ? [Math.round(p.x * 1000) / 1000, Math.round(p.y * 1000) / 1000] : null; });
  }
  function checklistSaque(quadros, dom, regras, original) {
    original = original || quadros;
    var s = segmentarSaque(quadros, dom);
    if (!s) return { erro: "Vídeo curto demais ou pessoa não detectada." };
    var R = regras.saque, M = s.idx.map(function (i) { return medidas(quadros[i], dom, s.dir); });
    var lanc = M[1], arm = M[2], cont = M[3], itens = [];
    var jCarga = joelhosEm(quadros[s.carga]);
    if (isFinite(jCarga)) arm = Object.assign({}, arm, { joelhos: isFinite(arm.joelhos) ? Math.min(arm.joelhos, jCarga) : jCarga });
    function item(fase, nome, valor, unidade, ok, ref, cOk, cAt, auto) {
      var st = auto === false ? "nao_avaliavel" : classificar(valor, ok);
      itens.push({ fase: fase, nome: nome, valor: auto === false ? null : valor, unidade: unidade, ref: ref, status: st,
        comentario: st === "ok" ? cOk : st === "atencao" ? cAt : "Não avaliável automaticamente com esta vista/qualidade — revisão do treinador." });
    }
    item(0, "Pegada continental", null, "", false, "—", "", "", false);
    item(1, "Braço de lançamento estendido", lanc.cotoveloND, "°", lanc.cotoveloND >= R.cotoveloLancamento.min, "≥ " + R.cotoveloLancamento.min + "° (provisório)",
      "Braço de lançamento estendido, sem dobrar o cotovelo.", "Cotovelo do braço de lançamento dobrado: lançamento menos consistente.");
    item(1, "Altura do lançamento (mão acima da cabeça)", lanc.alturaPunhoNDCabeca, " tronco", lanc.alturaPunhoNDCabeca >= 0.4, "≥ 0,4 tronco acima da cabeça (provisório)",
      "Lançamento alto o suficiente.", "Lançamento baixo: pouco tempo para a armada.");
    item(1, "Posição e trajetória da bola", null, "", false, "—", "", "", false);
    item(2, "Flexão de joelhos na armada", arm.joelhos, "°", Math.abs(arm.joelhos - R.joelhosArmada.alvo) <= R.joelhosArmada.tol, R.joelhosArmada.alvo + "° ± " + R.joelhosArmada.tol + " (provisório)",
      "Flexão de joelhos adequada para gerar impulso.", arm.joelhos > R.joelhosArmada.alvo ? "Pouca flexão de joelhos: falta carga para subir ao contato." : "Flexão excessiva de joelhos.");
    item(2, "Cotovelo dominante na armada", arm.cotoveloDom, "°", Math.abs(arm.cotoveloDom - R.cotoveloArmada.alvo) <= R.cotoveloArmada.tol, R.cotoveloArmada.alvo + "° ± " + R.cotoveloArmada.tol + " (provisório)",
      "Cotovelo flexionado na armada, favorecendo o chicote.", "Cotovelo fora da faixa na armada: afeta o alongamento do braço.");
    item(2, "Pronação e estabilização do punho", null, "", false, "—", "", "", false);
    item(3, "Extensão do cotovelo no contato", cont.cotoveloDom, "°", cont.cotoveloDom >= R.cotoveloContato.min, "≥ " + R.cotoveloContato.min + "° (provisório)",
      "Braço estendido no contato.", "Cotovelo dobrado no contato: ponto de impacto mais baixo e menor alavanca.");
    item(3, "Altura do contato (punho acima da cabeça)", cont.alturaPunhoCabeca, " tronco", cont.alturaPunhoCabeca >= R.alturaContato.min, "≥ " + R.alturaContato.min + " tronco acima da cabeça (provisório)",
      "Contato alto.", "Contato baixo: poucas opções de ângulo e velocidade.");
    item(3, "Contato à frente da cabeça", cont.frenteCabeca, " tronco", cont.frenteCabeca >= R.frenteCabeca.min, "≥ " + R.frenteCabeca.min + " tronco à frente da cabeça (provisório)",
      "Contato à frente do corpo.", "Contato atrás ou sobre a cabeça: perde direção e profundidade.");
    item(3, "Extensão de pernas do armada ao contato", cont.joelhos - arm.joelhos, "°", (cont.joelhos - arm.joelhos) >= R.extensaoJoelhos.min, "≥ " + R.extensaoJoelhos.min + "° (provisório)",
      "Boa transferência de energia das pernas.", "Pouca extensão de pernas: o saque depende mais do braço.");
    item(4, "Seguimento", s.idx[4] - s.idx[3], " quadros", s.idx[4] - s.idx[3] >= 2, "≥ 2 quadros",
      "Seguimento completo após o contato.", "Seguimento curto: o golpe termina cedo.");
    item(5, "Aterrissagem e retorno à quadra", null, "", false, "—", "", "", false);
    var cont2 = { ok: 0, atencao: 0, nao_avaliavel: 0 };
    itens.forEach(function (i) { cont2[i.status]++; });
    return { golpe: "saque", nomes: FASES_SAQUE, fases: s.idx.map(function (i, k) { return { nome: FASES_SAQUE[k], quadro: i, t: quadros[i].t, medidas: M[k], pose: poseCompacta(original[i].lm) }; }), itens: itens, resumo: cont2, direcao: s.dir };
  }

  /* `prop` = altura/largura do vídeo. A pose vem normalizada (x em fração da largura, y da altura): sem corrigir a proporção, os
     ângulos de um vídeo em pé (1080×1920) saem distorcidos. As medidas usam a pose em unidades iguais; as poses guardadas continuam
     normalizadas (para desenhar sobre o vídeo). */
  function emEscala(quadros, prop) {
    if (!(prop > 0.2 && prop < 5) || Math.abs(prop - 1) < 1e-3) return quadros;
    return quadros.map(function (q) { return { t: q.t, lm: q.lm.map(function (p) { return p ? { x: p.x, y: p.y * prop, z: p.z, v: p.v } : p; }) }; });
  }
  function checklist(quadros, dom, regras, golpe, emp, prop) {
    golpe = golpe || "forehand";
    regras = regras || REGRAS;
    if (!regras.saque) regras = Object.assign({}, REGRAS, regras);
    var original = limpar(quadros);
    quadros = emEscala(original, prop);
    if (golpe === "saque") return checklistSaque(quadros, dom, regras, original);
    var s = segmentar(quadros, dom);
    if (!s) return { erro: "Vídeo curto demais ou pessoa não detectada." };
    var M = s.idx.map(function (i) { return medidas(quadros[i], dom, s.dir); });
    var giro = M[1], contato = M[3], ss = splitStep(quadros, s.giro, s.prep - quadrosEm(quadros, 0.8));
    var itens = [];
    function item(fase, nome, valor, unidade, ok, ref, comentOk, comentAt, auto) {
      var st = auto === false ? "nao_avaliavel" : classificar(valor, ok);
      itens.push({ fase: fase, nome: nome, valor: auto === false ? null : valor, unidade: unidade, ref: ref, status: st,
        comentario: st === "ok" ? comentOk : st === "atencao" ? comentAt : "Não avaliável automaticamente com esta vista/qualidade — revisão do treinador." });
    }
    item(0, "Split step antes do golpe", ss.amp, "", ss.amp >= regras.splitStep.min, "oscilação vertical dos pés ≥ " + regras.splitStep.min,
      "Há impulso vertical dos pés antes do giro.", "Não se percebe split step claro antes da preparação.");
    item(0, golpe === "backhand" ? (emp === "2" ? "Pegadas (duas mãos)" : "Pegada (backhand de uma mão)") : "Pegada (semi-western)", null, "", false, "—", "", "", false);
    item(1, "Flexão de joelhos no giro", giro.joelhos, "°", Math.abs(giro.joelhos - regras.joelhos.alvo) <= regras.joelhos.tol, regras.joelhos.alvo + "° ± " + regras.joelhos.tol,
      "Joelhos flexionados dentro da faixa de referência.", giro.joelhos > regras.joelhos.alvo ? "Pouca flexão de joelhos: base alta." : "Flexão excessiva de joelhos.");
    item(1, "Flexão de tronco no giro", giro.tronco, "°", Math.abs(giro.tronco - regras.tronco.alvo) <= regras.tronco.tol, regras.tronco.alvo + "° ± " + regras.tronco.tol,
      "Tronco dentro da faixa de referência.", "Tronco fora da faixa de referência.");
    if (golpe === "backhand" && emp === "2") {
        item(1, "Duas mãos na raquete", giro.distMaos, " tronco", giro.distMaos <= regras.backhand.duasMaos.max, "mãos a ≤ " + regras.backhand.duasMaos.max + " tronco uma da outra",
        "Mãos juntas na raquete, dando estabilidade ao giro.", "Mãos afastadas: perda de estabilidade na preparação.");
    } else if (golpe === "backhand") {
      item(1, "Braço não dominante como contrapeso (1 mão)", contato.ndAtras, " tronco", contato.ndAtras >= regras.backhand.ndAtras.min, "≥ " + regras.backhand.ndAtras.min + " tronco atrás do punho dominante no contato",
        "Braço não dominante aberto, equilibrando o golpe.", "Braço não dominante colado ao corpo: menos equilíbrio e menos rotação.");
    } else {
  item(1, "Antebraço não dominante paralelo", giro.antebracoND, "°", giro.antebracoND <= regras.antebracoNaoDominante.max, "≤ " + regras.antebracoNaoDominante.max + "° da horizontal",
      "Braço não dominante bem posicionado, ajudando a equilibrar o giro.", "Braço não dominante caído ou solto no giro.");
    }
    if (golpe === "backhand") {
      var rot = Math.abs(contato.largOmbros - giro.largOmbros);
      item(2, "Rotação de ombros do giro ao contato", rot, " tronco", rot >= regras.backhand.rotacao.min, "variação da largura dos ombros ≥ " + regras.backhand.rotacao.min,
        "Há rotação de ombros do giro até o contato.", "Pouca rotação de ombros: golpe feito só com o braço.");
    }
    item(1, "Ângulo do pé dominante (~45°)", null, "", false, "—", "", "", false);
    item(2, "Extensão dos joelhos até o contato", contato.joelhos - giro.joelhos, "°", (contato.joelhos - giro.joelhos) > 10, "> 10° de extensão",
      "Há extensão de pernas transferindo energia para o golpe.", "Pouca extensão de pernas na aceleração.");
    item(2, "Estabilização do punho e pronação", null, "", false, "—", "", "", false);
    item(3, "Contato à frente do corpo", contato.contatoFrente, " tronco", contato.contatoFrente >= regras.contatoFrente.min, "≥ " + regras.contatoFrente.min + " comprimento de tronco à frente do quadril",
      "Contato à frente do corpo.", "Contato atrasado, próximo ou atrás do quadril.");
    item(3, "Altura do contato", contato.alturaContato, " tronco", contato.alturaContato >= -0.2 && contato.alturaContato <= 0.9, "entre -0,2 e 0,9 tronco do quadril",
      "Altura de contato confortável.", "Contato muito baixo ou muito alto.");
    item(3, "Foco visual na bola", null, "", false, "—", "", "", false);
    item(4, "Trajetória do seguimento", s.idx[4] - s.idx[3], " quadros", s.idx[4] - s.idx[3] >= 2, "≥ 2 quadros de seguimento",
      "Seguimento completo após o contato.", "Seguimento curto: o golpe termina cedo.");
    item(5, "Frenagem / retorno ao centro", null, "", false, "—", "", "", false);
    var cont = { ok: 0, atencao: 0, nao_avaliavel: 0 };
    itens.forEach(function (i) { cont[i.status]++; });
    return { golpe: golpe, nomes: FASES, fases: s.idx.map(function (i, k) { return { nome: FASES[k], quadro: i, t: quadros[i].t, medidas: M[k], pose: poseCompacta(original[i].lm) }; }), itens: itens, resumo: cont, direcao: s.dir, proporcao: prop > 0.2 && prop < 5 ? Math.round(prop * 1000) / 1000 : undefined };
  }


  /* Intervenções sugeridas por item em atenção. Apoio ao treinador; não substituem avaliação presencial. */
  var INTERV = {
    "Braço de lançamento estendido": { prio: 1, porque: "Lançamento com cotovelo dobrado varia a posição da bola.", ex: ["Lançar sem raquete, estendendo o braço e soltando a bola na altura dos olhos (20 repetições).", "Lançamento contra a parede/cone: a bola deve subir reta no mesmo ponto.", "Deixar a mão aberta e o braço \"acompanhando\" a bola para cima."] },
    "Altura do lançamento (mão acima da cabeça)": { prio: 2, porque: "Lançamento baixo encurta o tempo para a armada e para a subida ao contato.", ex: ["Lançar e deixar a bola cair no chão, mirando um ponto marcado à frente.", "Elevar o lançamento até que a bola passe da altura do contato.", "Coordenar lançamento e armada em câmera lenta (shadow serve)."] },
    "Flexão de joelhos na armada": { prio: 3, porque: function (it) { return it.valor > 145 ? "Pouca flexão de joelhos: falta carga para subir ao contato." : "Flexão excessiva de joelhos."; }, ex: ["Saque com ênfase em \"sentar\" na armada e subir com o contato.", "Agachamentos com salto leve simulando a subida do saque.", "Trabalhar o ritmo: dobrar, parar um instante e explodir."] },
    "Cotovelo dominante na armada": { prio: 4, porque: "Cotovelo fora da faixa na armada reduz o alongamento e a velocidade da cabeça da raquete.", ex: ["Shadow serve parando na posição de armada e conferindo o cotovelo.", "Saque com a raquete caindo atrás das costas (racket drop) sem pressa.", "Exercício com elástico para dar fluidez ao movimento de chicote."] },
    "Extensão do cotovelo no contato": { prio: 5, porque: "Braço dobrado no contato derruba o ponto de impacto e diminui a alavanca.", ex: ["Tocar a bola no ponto mais alto, braço estendido (saque lento).", "Contato em uma bola pendurada, alcançando-a com o braço esticado.", "Foco visual no ponto de contato."] },
    "Altura do contato (punho acima da cabeça)": { prio: 6, porque: "Contato baixo limita ângulo e velocidade do saque.", ex: ["Bola pendurada na altura de alcance máximo para marcar o ponto.", "Subir do chão com as duas pernas e esticar o corpo até a bola.", "Alinhar o lançamento com o ponto de contato desejado."] },
    "Contato à frente da cabeça": { prio: 7, porque: "Contato atrás da cabeça tira a direção e a profundidade.", ex: ["Lançar um pouco mais à frente (conferir com cone no chão).", "Contato com inclinação do corpo para dentro da quadra.", "Saque com o corpo \"caindo\" para a frente, aterrissando dentro da quadra."] },
    "Extensão de pernas do armada ao contato": { prio: 8, porque: "Pouca extensão de pernas faz o saque depender só do braço.", ex: ["Saque com salto no contato (progressivo).", "Arremesso de medicine ball por cima da cabeça.", "Subida explosiva a partir da flexão da armada."] },
    "Duas mãos na raquete": { prio: 3, porque: "Mãos afastadas desestabilizam a preparação do backhand de duas mãos.", ex: ["Preparar o backhand segurando a raquete com as duas mãos desde a primeira passada.", "Shadow swing com foco em manter a mão não dominante sobre o cabo.", "Bola na cesta pedindo \"mãos juntas\" na preparação."] },
    "Braço não dominante como contrapeso (1 mão)": { prio: 3, porque: "No backhand de uma mão, o braço não dominante ajuda no equilíbrio e na rotação.", ex: ["Abrir o braço não dominante para trás no contato (shadow swing).", "Backhand com ênfase na abertura dos braços, em câmera lenta.", "Bola na cesta pedindo \"braço de trás aberto\"."] },
    "Rotação de ombros do giro ao contato": { prio: 4, porque: "Pouca rotação de ombros: golpe feito só com o braço.", ex: ["Giro de ombros com bastão para ampliar a amplitude.", "Shadow swing com foco em fechar os ombros no giro e abri-los no contato.", "Arremesso de medicine ball rotacional."] },
    "Split step antes do golpe": { prio: 9, porque: "Sem o pequeno salto antes do golpe, a saída para a bola fica lenta.",
      ex: ["Split step na cadência do adversário (cesta ou parceiro), buscando pousar quando ele bate na bola.", "Jogos de reação: bola em direção aleatória após o split."] },
    "Flexão de joelhos no giro": { prio: 1, porque: function (it) { return it.valor > 100 ? "Base alta: pouca carga nas pernas para gerar potência." : "Flexão excessiva: perde mobilidade e velocidade de saída."; },
      ex: ["Agachamento com bola de tênis na altura do giro (pausa de 2 s).", "Shadow swing com foco em sentar na base antes de acelerar.", "Bola na cesta pedindo \"base baixa e estável\"."] },
    "Flexão de tronco no giro": { prio: 2, porque: "Tronco fora da faixa: afeta equilíbrio e a transferência de energia do solo.",
      ex: ["Giro de tronco com bastão nos ombros, mantendo a coluna alinhada.", "Feedback em vídeo de lado, comparando com a referência.", "Exercício de equilíbrio unipodal na preparação."] },
    "Antebraço não dominante paralelo": { prio: 3, porque: "Braço não dominante solto reduz equilíbrio e a separação entre quadril e ombro.",
      ex: ["Manter a mão não dominante na raquete (garganta) até o giro.", "Shadow swing deixando o braço não dominante \"apontando\" para a bola.", "Bola na cesta com a mão não dominante como guia."] },
    "Extensão dos joelhos até o contato": { prio: 4, porque: "Pouca extensão de pernas: o golpe fica dependente do braço.",
      ex: ["Saltos curtos (counter movement) com ênfase em empurrar o chão.", "Forehand com drive de pernas, lembrando de \"subir\" no contato.", "Arremesso de medicine ball lateral."] },
    "Contato à frente do corpo": { prio: 5, porque: "Contato atrasado reduz controle, profundidade e velocidade.",
      ex: ["Bola na cesta marcando um cone à frente do quadril como ponto de contato.", "Tocar a bola à frente com a mão antes de bater (feeding).", "Antecipar a preparação: raquete atrás já na primeira passada."] },
    "Altura do contato": { prio: 6, porque: "Altura fora da faixa confortável: exige compensações no tronco.",
      ex: ["Trabalhar o posicionamento (passo ajustado) para bater na altura entre cintura e ombro.", "Treino com bolas altas e baixas, praticando o ajuste de passadas.", "Pernas ajudam a ajustar a altura, não o braço."] },
    "Trajetória do seguimento": { prio: 8, porque: "Seguimento curto: o golpe termina cedo e perde fluidez.",
      ex: ["Finalizar o golpe passando a raquete sobre o ombro oposto.", "Shadow swing em câmera lenta, mantendo a cabeça da raquete acelerando depois do contato."] }
  };

  function conclusao(r) {
    if (!r || r.erro) return null;
    var fortes = [], aten = [], rev = [], i, it, d;
    for (i = 0; i < r.itens.length; i++) {
      it = r.itens[i];
      if (it.status === "ok") fortes.push(it.nome);
      else if (it.status === "nao_avaliavel") rev.push(it.nome);
      else {
        d = INTERV[it.nome] || { prio: 9, porque: it.comentario, ex: [] };
        aten.push({ nome: it.nome, fase: it.fase, valor: it.valor, unidade: it.unidade, ref: it.ref, prio: d.prio,
          porque: typeof d.porque === "function" ? d.porque(it) : d.porque, exercicios: d.ex });
      }
    }
    aten.sort(function (a, b) { return a.prio - b.prio; });
    var total = fortes.length + aten.length;
    var txt = !total ? "Poucos itens puderam ser medidos nesta vista."
      : (aten.length ? "Dos " + total + " itens medidos, " + fortes.length + " estão dentro da referência e " + aten.length + " merecem atenção. Prioridade sugerida: " + aten.slice(0, 3).map(function (a) { return a.nome.toLowerCase(); }).join(", ") + "."
        : "Todos os " + total + " itens medidos estão dentro da referência.");
    return { texto: txt, fortes: fortes, prioridades: aten, revisar: rev };
  }


  /* ── Histórico, comparação de evolução e cotas por plano ── */
  var RANK = { ok: 2, atencao: 1, nao_avaliavel: 0 };

  /* Registro compacto guardado no jogador: só medidas e pareceres (sem vídeo nem fotos). */
  function resumir(r, meta) {
    meta = meta || {};
    var co = conclusao(r);
    return {
      id: meta.id || ("mv" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
      criadoEm: meta.criadoEm || new Date().toISOString(),
      golpe: r.golpe || "forehand", emp: meta.emp || "", dom: meta.dom || "D",
      itens: r.itens.map(function (i) { return { n: i.nome, s: i.status, v: i.valor == null ? null : Math.round(i.valor * 10) / 10, u: i.unidade || "", r: i.ref || "" }; }),
      res: { ok: r.resumo.ok, atencao: r.resumo.atencao, nao: r.resumo.nao_avaliavel },
      texto: co ? co.texto : "", prio: co ? co.prioridades.map(function (p) { return p.nome; }) : [],
      origem: meta.origem || "video"
    };
  }

  function mesmoGolpe(a, b) { return a.golpe === b.golpe && (a.golpe !== "backhand" || String(a.emp) === String(b.emp)); }
  function ordenar(lista) { return (lista || []).slice().sort(function (a, b) { return a.criadoEm < b.criadoEm ? -1 : 1; }); }

  /* Última análise do mesmo golpe anterior à data do registro (ou a mais recente, se ainda não há data). */
  function anteriorDe(historico, reg) {
    var ant = null;
    ordenar(historico).forEach(function (h) {
      if (h.id !== reg.id && mesmoGolpe(h, reg) && (!reg.criadoEm || h.criadoEm < reg.criadoEm)) ant = h;
    });
    return ant;
  }

  function comparar(ant, atu) {
    if (!ant || !atu) return null;
    var mapa = {}, itens = [], melhor = [], pior = [], igual = 0;
    ant.itens.forEach(function (i) { mapa[i.n] = i; });
    atu.itens.forEach(function (i) {
      var a = mapa[i.n];
      if (!a) return;
      var d = (a.v != null && i.v != null) ? Math.round((i.v - a.v) * 10) / 10 : null;
      var sent = RANK[i.s] > RANK[a.s] ? 1 : (RANK[i.s] < RANK[a.s] ? -1 : 0);
      if (i.s === "nao_avaliavel" || a.s === "nao_avaliavel") sent = 0;
      itens.push({ nome: i.n, ant: a, atu: i, delta: d, sentido: sent });
      if (sent > 0) melhor.push(i.n); else if (sent < 0) pior.push(i.n); else igual++;
    });
    var dok = atu.res.ok - ant.res.ok;
    var txt = !itens.length ? "Sem itens em comum para comparar."
      : (melhor.length ? "Melhoraram: " + melhor.join(", ") + ". " : "") + (pior.length ? "Pioraram: " + pior.join(", ") + ". " : "")
        + (!melhor.length && !pior.length ? "Os pareceres se mantiveram iguais à análise anterior. " : "")
        + "Itens dentro da referência: " + ant.res.ok + " → " + atu.res.ok + (dok > 0 ? " (+" + dok + ")" : dok < 0 ? " (" + dok + ")" : " (igual)") + ".";
    return { de: ant.criadoEm, para: atu.criadoEm, itens: itens, melhoraram: melhor, pioraram: pior, iguais: igual, deltaOk: dok, texto: txt };
  }

  /* Série para o gráfico de evolução de um golpe: itens OK/Atenção por análise. */
  function serie(historico, golpe, emp) {
    return ordenar(historico).filter(function (h) { return h.golpe === golpe && (golpe !== "backhand" || String(h.emp) === String(emp || h.emp)); })
      .map(function (h) { return { id: h.id, t: h.criadoEm, ok: h.res.ok, atencao: h.res.atencao, nao: h.res.nao }; });
  }

  /* Quanto o plano libera. Sem plano (academia antiga/Team Yoda): ilimitado. null = ilimitado. */
  var LIMITES_PLANO = {
    movimento: { gratis: 0, essencial: 5, premium: null },
    video: { gratis: 0, essencial: 2, premium: null }
  };
  function mesDe(iso) { return String(iso || "").slice(0, 7); }
  function cota(recurso, plano, registros, agora) {
    var tabela = LIMITES_PLANO[recurso] || {};
    var limite = (plano && Object.prototype.hasOwnProperty.call(tabela, plano)) ? tabela[plano] : null;
    var mes = mesDe(agora || new Date().toISOString());
    var usados = (registros || []).filter(function (r) { return mesDe(r.criadoEm) === mes; }).length;
    return { limite: limite, usados: usados, restantes: limite == null ? null : Math.max(0, limite - usados), liberado: limite == null || usados < limite, bloqueado: limite === 0 };
  }


  /* Quadros sintéticos (demonstração e testes). golpe: "forehand" | "backhand" | "saque". */
  function sintetico(n, dom, golpe) {
    if (golpe === "saque") return sinteticoSaque(n, dom);
    n = n || 60; var q = [], i;
    for (i = 0; i < n; i++) {
      var p = i / (n - 1), lm = [], k;
      for (k = 0; k < 33; k++) lm.push({ x: 0.5, y: 0.5, z: 0, v: 1 });
      var set = function (idx, x, y) { lm[idx] = { x: x, y: y, z: 0, v: 1 }; };
      var salto = (p < 0.12) ? 0.03 * Math.sin(p / 0.12 * Math.PI) : 0;
      var flex = p < 0.3 ? 0.02 : (p < 0.55 ? 0.02 - 0.02 * (p - 0.3) / 0.25 : 0);
      var abre = 0.03 + 0.03 * Math.min(1, Math.max(0, (p - 0.3) / 0.25));
      set(P.ombroE, 0.5 - abre, 0.30); set(P.ombroD, 0.5 + abre, 0.30);
      set(P.quadrilE, 0.47, 0.52); set(P.quadrilD, 0.53, 0.52);
      set(P.joelhoE, 0.52, 0.68 + flex); set(P.joelhoD, 0.56, 0.68 + flex);
      set(P.tornE, 0.47, 0.88 - salto); set(P.tornD, 0.53, 0.88 - salto);
      set(P.nariz, 0.5, 0.22);
      var px = p < 0.3 ? 0.50 - 0.2 * (p / 0.3) : (p < 0.55 ? 0.30 + 0.5 * ((p - 0.3) / 0.25) : 0.80 + 0.1 * ((p - 0.55) / 0.45));
      var py = p < 0.3 ? 0.45 : (p < 0.45 ? 0.45 + 0.2 * ((p - 0.3) / 0.15) : (p < 0.55 ? 0.65 - 0.25 * ((p - 0.45) / 0.1) : 0.40 - 0.15 * ((p - 0.55) / 0.45)));
      var D = dom === "E" ? { p: P.punhoE, c: P.cotE, nd: { p: P.punhoD, c: P.cotD } } : { p: P.punhoD, c: P.cotD, nd: { p: P.punhoE, c: P.cotE } };
      set(D.p, px, py); set(D.c, (px + 0.5) / 2, py - 0.03);
      if (golpe === "backhand") { set(D.nd.p, px - 0.05, py + 0.02); set(D.nd.c, (px + 0.5) / 2 - 0.03, py - 0.01); }
      else { set(D.nd.c, 0.45, 0.42); set(D.nd.p, 0.36, 0.43); }
      q.push({ t: i / 30, lm: lm });
    }
    return q;
  }

  function lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }
  function sinteticoSaque(n, dom) {
    n = n || 70; var q = [], i;
    for (i = 0; i < n; i++) {
      var p = i / (n - 1), lm = [], k;
      for (k = 0; k < 33; k++) lm.push({ x: 0.5, y: 0.5, z: 0, v: 1 });
      var set = function (idx, x, y) { lm[idx] = { x: x, y: y, z: 0, v: 1 }; };
      var d = p < 0.2 ? 0.02 : (p < 0.5 ? lerp(0.02, 0.08, (p - 0.2) / 0.1) : lerp(0.08, 0, (p - 0.5) / 0.12));
      set(P.ombroE, 0.47, 0.30); set(P.ombroD, 0.53, 0.30); set(P.quadrilE, 0.47, 0.52); set(P.quadrilD, 0.53, 0.52);
      set(P.joelhoE, 0.47 + d, 0.70); set(P.joelhoD, 0.53 + d, 0.70); set(P.tornE, 0.47, 0.88); set(P.tornD, 0.53, 0.88); set(P.nariz, 0.5, 0.22);
      var ndy = p < 0.3 ? lerp(0.50, 0.12, p / 0.3) : lerp(0.12, 0.5, (p - 0.3) / 0.3), ndx = 0.60;
      var dy, dx, ex, ey;
      if (p < 0.3) { dy = lerp(0.50, 0.35, p / 0.3); dx = 0.42; }
      else if (p < 0.5) { dy = lerp(0.35, 0.45, (p - 0.3) / 0.2); dx = lerp(0.42, 0.38, (p - 0.3) / 0.2); }
      else if (p < 0.62) { dy = lerp(0.45, 0.08, (p - 0.5) / 0.12); dx = lerp(0.38, 0.62, (p - 0.5) / 0.12); }
      else { dy = lerp(0.08, 0.55, (p - 0.62) / 0.38); dx = lerp(0.62, 0.55, (p - 0.62) / 0.38); }
      var tc = p < 0.5 ? 1 : lerp(1, 0, (p - 0.5) / 0.12);
      ex = lerp((0.53 + dx) / 2, 0.38, tc); ey = lerp((0.30 + dy) / 2, 0.30, tc);
      var D = dom === "E" ? { o: P.ombroE, p: P.punhoE, c: P.cotE, nd: { o: P.ombroD, p: P.punhoD, c: P.cotD } } : { o: P.ombroD, p: P.punhoD, c: P.cotD, nd: { o: P.ombroE, p: P.punhoE, c: P.cotE } };
      set(D.p, dx, dy); set(D.c, ex, ey);
      set(D.nd.p, ndx, ndy); set(D.nd.c, (ndx + 0.5) / 2 + 0.01, (ndy + 0.30) / 2);
      q.push({ t: i / 30, lm: lm });
    }
    return q;
  }

  /* ── Modelo de referência (opcional na tela) ──
     Uma pose de técnica padrão por fase de cada golpe, desenhada pelo QuadraLab (não é um atleta real), para comparar lado a lado.
     Coordenadas do corpo: quadril no (0, 0), unidade = comprimento do tronco, y para baixo, x para a frente do golpe (rumo à rede),
     jogador destro. alinharModelo() leva a pose para a imagem do atleta: mesma posição do quadril, mesmo tamanho de tronco, mesmo
     sentido do golpe; para canhotos, troca os lados. Pontos: 0 nariz, 11/12 ombros, 13/14 cotovelos, 15/16 punhos, 23/24 quadris,
     25/26 joelhos, 27/28 tornozelos, 31/32 pés (ímpar = esquerdo). */
  function pose(o) { var lm = []; for (var k = 0; k < 33; k++) lm.push(null); Object.keys(o).forEach(function (k) { lm[+k] = { x: o[k][0], y: o[k][1], v: 1 }; }); return lm; }
  var BASE_PERNAS = { 23: [0.03, 0], 24: [-0.03, 0], 25: [0.30, 0.82], 26: [0.26, 0.84], 27: [0.08, 1.66], 28: [0.02, 1.68], 31: [0.30, 1.72], 32: [0.24, 1.74] };
  function com(base, o) { var x = {}; Object.keys(base).forEach(function (k) { x[k] = base[k]; }); Object.keys(o).forEach(function (k) { x[k] = o[k]; }); return x; }
  var ESPERA = com(BASE_PERNAS, { 0: [0.25, -1.42], 11: [0.12, -0.98], 12: [0.06, -1.0], 13: [0.32, -0.55], 14: [0.28, -0.52], 15: [0.62, -0.42], 16: [0.60, -0.38] });
  var MODELO = {
    forehand: [
      ESPERA,
      { 0: [0.12, -1.40], 11: [0.30, -0.95], 12: [-0.32, -0.98], 13: [0.62, -0.88], 15: [1.05, -0.82], 14: [-0.62, -0.74], 16: [-0.78, -1.05],
        23: [0.12, 0.02], 24: [-0.14, 0], 25: [0.52, 0.70], 26: [0.22, 0.74], 27: [0.34, 1.56], 28: [-0.08, 1.57], 31: [0.56, 1.62], 32: [0.14, 1.62] },
      { 0: [0.14, -1.40], 11: [0.24, -0.95], 12: [-0.26, -0.97], 13: [0.50, -0.70], 15: [0.78, -0.55], 14: [-0.55, -0.42], 16: [-0.62, 0.05],
        23: [0.10, 0.02], 24: [-0.10, 0], 25: [0.52, 0.70], 26: [0.24, 0.74], 27: [0.34, 1.56], 28: [-0.08, 1.57], 31: [0.56, 1.62], 32: [0.14, 1.62] },
      { 0: [0.26, -1.42], 11: [0.08, -0.98], 12: [0.02, -1.0], 13: [-0.05, -0.55], 15: [0.12, -0.35], 14: [0.42, -0.62], 16: [0.80, -0.45],
        23: [0.05, 0], 24: [-0.05, 0], 25: [0.36, 0.80], 26: [0.18, 0.84], 27: [0.24, 1.66], 28: [-0.02, 1.66], 31: [0.46, 1.70], 32: [0.20, 1.70] },
      { 0: [0.20, -1.42], 11: [-0.22, -0.96], 12: [0.28, -0.98], 13: [-0.42, -0.62], 15: [-0.32, -0.40], 14: [0.30, -1.22], 16: [-0.28, -1.30],
        23: [-0.06, 0], 24: [0.10, 0], 25: [0.32, 0.82], 26: [0.26, 0.84], 27: [0.22, 1.66], 28: [0.06, 1.64], 31: [0.44, 1.70], 32: [0.28, 1.68] },
      com(ESPERA, { 0: [0.22, -1.42], 15: [0.56, -0.44], 16: [0.54, -0.40] })
    ],
    backhand2: [
      ESPERA,
      { 0: [0.12, -1.40], 11: [-0.30, -0.98], 12: [0.30, -0.95], 13: [-0.42, -0.52], 15: [-0.70, -0.66], 14: [-0.05, -0.60], 16: [-0.62, -0.72],
        23: [-0.14, 0], 24: [0.12, 0.02], 25: [0.22, 0.74], 26: [0.52, 0.70], 27: [-0.08, 1.57], 28: [0.34, 1.56], 31: [0.14, 1.62], 32: [0.56, 1.62] },
      { 0: [0.14, -1.40], 11: [-0.26, -0.97], 12: [0.24, -0.95], 13: [-0.42, -0.30], 15: [-0.66, 0.0], 14: [-0.15, -0.40], 16: [-0.60, -0.04],
        23: [-0.10, 0], 24: [0.10, 0.02], 25: [0.24, 0.74], 26: [0.52, 0.70], 27: [-0.08, 1.57], 28: [0.34, 1.56], 31: [0.14, 1.62], 32: [0.56, 1.62] },
      { 0: [0.26, -1.42], 11: [0.04, -0.98], 12: [0.10, -1.0], 13: [0.32, -0.55], 15: [0.70, -0.42], 14: [0.40, -0.60], 16: [0.78, -0.40],
        23: [-0.05, 0], 24: [0.05, 0], 25: [0.18, 0.84], 26: [0.36, 0.80], 27: [-0.02, 1.66], 28: [0.24, 1.66], 31: [0.20, 1.70], 32: [0.46, 1.70] },
      { 0: [0.20, -1.42], 11: [0.28, -0.97], 12: [-0.22, -0.96], 13: [0.20, -1.15], 15: [-0.30, -1.30], 14: [0.25, -1.20], 16: [-0.25, -1.35],
        23: [0.10, 0], 24: [-0.06, 0], 25: [0.26, 0.84], 26: [0.32, 0.82], 27: [0.06, 1.64], 28: [0.22, 1.66], 31: [0.28, 1.68], 32: [0.44, 1.70] },
      com(ESPERA, { 0: [0.22, -1.42] })
    ],
    backhand1: [
      ESPERA,
      { 0: [0.12, -1.40], 11: [-0.30, -0.98], 12: [0.30, -0.95], 13: [-0.20, -0.62], 15: [-0.45, -0.80], 14: [-0.02, -0.62], 16: [-0.55, -0.75],
        23: [-0.14, 0], 24: [0.12, 0.02], 25: [0.22, 0.74], 26: [0.52, 0.70], 27: [-0.08, 1.57], 28: [0.34, 1.56], 31: [0.14, 1.62], 32: [0.56, 1.62] },
      { 0: [0.14, -1.40], 11: [-0.26, -0.97], 12: [0.24, -0.95], 13: [-0.30, -0.55], 15: [-0.40, -0.30], 14: [-0.10, -0.40], 16: [-0.60, 0.0],
        23: [-0.10, 0], 24: [0.10, 0.02], 25: [0.24, 0.74], 26: [0.52, 0.70], 27: [-0.08, 1.57], 28: [0.34, 1.56], 31: [0.14, 1.62], 32: [0.56, 1.62] },
      { 0: [0.20, -1.42], 11: [-0.20, -0.96], 12: [0.22, -0.98], 13: [-0.50, -0.80], 15: [-0.55, -0.55], 14: [0.50, -0.70], 16: [0.80, -0.48],
        23: [-0.08, 0], 24: [0.08, 0], 25: [0.18, 0.84], 26: [0.38, 0.80], 27: [-0.02, 1.66], 28: [0.26, 1.66], 31: [0.20, 1.70], 32: [0.48, 1.70] },
      { 0: [0.18, -1.42], 11: [-0.30, -0.96], 12: [0.30, -0.98], 13: [-0.70, -0.85], 15: [-0.80, -0.62], 14: [0.45, -1.30], 16: [0.40, -1.62],
        23: [-0.08, 0], 24: [0.10, 0], 25: [0.24, 0.84], 26: [0.36, 0.82], 27: [0.04, 1.66], 28: [0.24, 1.66], 31: [0.26, 1.70], 32: [0.46, 1.70] },
      com(ESPERA, { 0: [0.22, -1.42] })
    ],
    saque: [
      { 0: [0.10, -1.45], 11: [0.28, -1.0], 12: [-0.28, -1.0], 13: [0.30, -0.62], 15: [0.35, -0.25], 14: [0.0, -0.55], 16: [0.30, -0.22],
        23: [0.15, 0], 24: [-0.15, 0], 25: [0.25, 0.85], 26: [-0.18, 0.86], 27: [0.30, 1.70], 28: [-0.22, 1.70], 31: [0.50, 1.72], 32: [-0.10, 1.74] },
      { 0: [0.10, -1.45], 11: [0.30, -1.02], 12: [-0.26, -0.96], 13: [0.40, -1.55], 15: [0.48, -2.10], 14: [-0.55, -1.05], 16: [-0.60, -1.45],
        23: [0.15, 0.01], 24: [-0.15, 0.02], 25: [0.40, 0.75], 26: [-0.05, 0.80], 27: [0.30, 1.68], 28: [-0.22, 1.68], 31: [0.50, 1.72], 32: [-0.10, 1.72] },
      { 0: [0.12, -1.42], 11: [0.30, -1.05], 12: [-0.25, -0.88], 13: [0.42, -1.55], 15: [0.50, -2.0], 14: [-0.40, -1.30], 16: [-0.75, -1.10],
        23: [0.14, 0.02], 24: [-0.16, 0.04], 25: [0.52, 0.66], 26: [0.12, 0.72], 27: [0.30, 1.62], 28: [-0.16, 1.62], 31: [0.50, 1.68], 32: [-0.04, 1.68] },
      { 0: [0.20, -1.50], 11: [0.10, -0.95], 12: [0.02, -1.15], 13: [0.20, -0.55], 15: [0.10, -0.25], 14: [0.21, -1.73], 16: [0.40, -2.31],
        23: [0.08, -0.05], 24: [-0.06, -0.04], 25: [0.30, 0.82], 26: [0.04, 0.84], 27: [0.36, 1.68], 28: [-0.06, 1.68], 31: [0.56, 1.72], 32: [0.14, 1.72] },
      { 0: [0.34, -1.40], 11: [0.06, -0.96], 12: [0.34, -1.00], 13: [-0.10, -0.55], 15: [-0.05, -0.20], 14: [0.40, -0.45], 16: [0.10, 0.10],
        23: [0.12, 0], 24: [0.20, 0.0], 25: [0.42, 0.80], 26: [0.10, 0.84], 27: [0.36, 1.66], 28: [-0.08, 1.60], 31: [0.58, 1.70], 32: [0.10, 1.60] },
      { 0: [0.28, -1.42], 11: [0.16, -0.98], 12: [0.08, -1.0], 13: [0.30, -0.58], 15: [0.50, -0.45], 14: [0.26, -0.55], 16: [0.52, -0.40],
        23: [0.05, 0], 24: [-0.05, 0], 25: [0.30, 0.82], 26: [0.24, 0.84], 27: [0.10, 1.66], 28: [0.02, 1.68], 31: [0.32, 1.72], 32: [0.26, 1.74] }
    ]
  };
  function chaveModelo(golpe, emp) { return golpe === "saque" ? "saque" : golpe === "backhand" ? (String(emp) === "1" ? "backhand1" : "backhand2") : "forehand"; }
  function modeloPadrao(golpe, emp) { return MODELO[chaveModelo(golpe, emp)].map(pose); }
  /* pose do modelo (coordenadas do corpo) na imagem do atleta: `ref` é a pose do atleta naquela fase ([x, y] ou {x, y}), `prop` = altura/largura
     do vídeo (para medir em unidades iguais nos dois eixos), dir = sentido do golpe, dom = "D"/"E". Devolve lm normalizado como a pose. */
  function xy(p) { return !p ? null : Array.isArray(p) ? { x: p[0], y: p[1] } : p; }
  function alinharModelo(modeloLm, ref, prop, dir, dom) {
    prop = prop > 0.2 && prop < 5 ? prop : 1;
    var r = (ref || []).map(xy), oE = r[11], oD = r[12], qE = r[23], qD = r[24];
    if (!oE || !oD || !qE || !qD) return null;
    var hx = (qE.x + qD.x) / 2, hy = (qE.y + qD.y) / 2 * prop, sx = (oE.x + oD.x) / 2, sy = (oE.y + oD.y) / 2 * prop;
    var T = Math.hypot(sx - hx, sy - hy) || 0.2, d = dir < 0 ? -1 : 1;
    var lm = modeloLm.slice();
    if (dom === "E") { var t = lm.slice(); Object.keys(PAR).forEach(function (j) { t[j] = lm[PAR[j]]; }); lm = t; }
    return lm.map(function (p) { return p ? { x: hx + d * p.x * T, y: (hy + p.y * T) / prop, v: 1 } : null; });
  }
  /* comparação atleta × modelo numa fase: as medidas que dizem algo naquela fase, lado a lado */
  var MEDIDAS_FASE = {
    golpe: [["joelhos", "Joelhos", "°"], ["tronco", "Tronco (ombro-quadril-joelho)", "°"], ["cotoveloDom", "Cotovelo do braço do golpe", "°"], ["largOmbros", "Abertura dos ombros", " tronco"], ["contatoFrente", "Punho à frente do quadril", " tronco"]],
    saque: [["joelhos", "Joelhos", "°"], ["cotoveloDom", "Cotovelo do braço do golpe", "°"], ["cotoveloND", "Cotovelo do braço do lançamento", "°"], ["alturaPunhoCabeca", "Punho do golpe acima da cabeça", " tronco"], ["alturaPunhoNDCabeca", "Mão do lançamento acima da cabeça", " tronco"]]
  };
  function compararModelo(resultado, dom, modeloLms) {
    var r = resultado || {}, dir = r.direcao || 1, lista = MEDIDAS_FASE[r.golpe === "saque" ? "saque" : "golpe"];
    return (r.fases || []).map(function (f, i) {
      var ref = (f.pose || []).map(xy), alvo = modeloLms && modeloLms[i] ? alinharModelo(modeloLms[i], f.pose, r.proporcao, dir, dom) : null;
      if (!alvo || !ref.length || !ref[11] || !ref[23]) return { fase: f.nome, linhas: [] };
      var cheio = function (lm) { return lm.map(function (p) { return p || { x: NaN, y: NaN, v: 0 }; }); };
      var escala = function (lm) { var pr = r.proporcao > 0.2 ? r.proporcao : 1; return lm.map(function (p) { return { x: p.x, y: p.y * pr, v: p.v == null ? 1 : p.v }; }); };
      var ma = medidas({ lm: escala(cheio(ref)) }, dom, dir), mm = medidas({ lm: escala(cheio(alvo)) }, dom, dir);
      return { fase: f.nome, linhas: lista.map(function (x) { return { chave: x[0], nome: x[1], unidade: x[2], atleta: ma[x[0]], modelo: mm[x[0]] }; }).filter(function (l) { return isFinite(l.atleta) && isFinite(l.modelo); }) };
    });
  }
  /* Modelo a partir de uma análise de verdade (um atleta de referência filmado e analisado no app): leva a pose de cada fase para as
     coordenadas do corpo (quadril na origem, tronco = 1, golpe para a frente, como destro). Devolve null se faltar alguma fase. */
  function modeloDeResultado(resultado, dom) {
    var r = resultado || {}, prop = r.proporcao > 0.2 && r.proporcao < 5 ? r.proporcao : 1, d = r.direcao < 0 ? -1 : 1;
    if (!r.fases || !r.fases.length) return null;
    var lms = r.fases.map(function (f) {
      var p = (f.pose || []).map(xy), oE = p[11], oD = p[12], qE = p[23], qD = p[24];
      if (!oE || !oD || !qE || !qD) return null;
      var hx = (qE.x + qD.x) / 2, hy = (qE.y + qD.y) / 2 * prop, sx = (oE.x + oD.x) / 2, sy = (oE.y + oD.y) / 2 * prop;
      var T = Math.hypot(sx - hx, sy - hy) || 0.2;
      var lm = p.map(function (q) { return q ? { x: (q.x - hx) * d / T, y: (q.y * prop - hy) / T, v: 1 } : null; });
      if (dom === "E") { var t = lm.slice(); Object.keys(PAR).forEach(function (j) { t[j] = lm[PAR[j]]; }); lm = t; }
      return lm;
    });
    return lms.every(Boolean) ? lms : null;
  }
  /* pose interpolada entre as fases (para animar o modelo junto do vídeo): `t` é o tempo do vídeo, `fases` traz o tempo de cada fase */
  function poseNoTempo(lms, fases, t) {
    if (!lms || !lms.length || !fases || !fases.length) return null;
    if (t <= fases[0].t) return lms[0];
    for (var i = 1; i < fases.length; i++) {
      if (t <= fases[i].t) {
        var a = lms[i - 1], b = lms[i], u = (t - fases[i - 1].t) / Math.max(1e-6, fases[i].t - fases[i - 1].t);
        return a.map(function (p, k) { var q = b[k]; return p && q ? { x: p.x + (q.x - p.x) * u, y: p.y + (q.y - p.y) * u, v: 1 } : p || q; });
      }
    }
    return lms[lms.length - 1];
  }

  return { P: P, FASES: FASES, REGRAS: REGRAS, ang: ang, limpar: limpar, modeloPadrao: modeloPadrao, modeloDeResultado: modeloDeResultado, alinharModelo: alinharModelo, compararModelo: compararModelo, poseNoTempo: poseNoTempo, chaveModelo: chaveModelo, segmentarSaque: segmentarSaque, segmentar: segmentar, medidas: medidas, nomesFases: nomesFases, checklist: checklist, conclusao: conclusao, INTERV: INTERV, resumir: resumir, comparar: comparar, anteriorDe: anteriorDe, serie: serie, cota: cota, LIMITES_PLANO: LIMITES_PLANO, ordenar: ordenar, sintetico: sintetico, suavizar: suavizar };
});
