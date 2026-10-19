/* Motor de análise biomecânica (forehand) — funções puras, sem dependências.
   Entrada: quadros [{t, lm:[{x,y,z,v}...33 pontos MediaPipe]}] (x,y normalizados 0..1, y cresce para baixo). */
(function (raiz, fab) {
  if (typeof module === "object" && module.exports) module.exports = fab();
  else raiz.QLBiomec = fab();
})(this, function () {
  var P = { nariz: 0, ombroE: 11, ombroD: 12, cotE: 13, cotD: 14, punhoE: 15, punhoD: 16, quadrilE: 23, quadrilD: 24, joelhoE: 25, joelhoD: 26, tornE: 27, tornD: 28, peE: 31, peD: 32 };
  var FASES = ["Preparação", "Giro (unit turn)", "Descida da raquete", "Contato", "Seguimento", "Recuperação"];

  /* Faixas de referência editáveis. Valores iniciais vêm do caso do material-base; precisam de validação do especialista. */
  var REGRAS = {
    joelhos: { alvo: 90, tol: 10 },
    tronco: { alvo: 90, tol: 10 },
    antebracoNaoDominante: { max: 20 },
    contatoFrente: { min: 0.15 },
    splitStep: { min: 0.015 }
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
  function idxMax(arr, a, b) { var m = -Infinity, k = a; for (var i = a; i <= b; i++) if (isFinite(arr[i]) && arr[i] > m) { m = arr[i]; k = i; } return k; }
  function idxMin(arr, a, b) { var m = Infinity, k = a; for (var i = a; i <= b; i++) if (isFinite(arr[i]) && arr[i] < m) { m = arr[i]; k = i; } return k; }

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
    var giro = idxMin(sinal, 0, contato);                       // punho mais recuado
    var desc = idxMax(py, giro, contato);                       // ponto mais baixo (y maior) entre giro e contato
    if (desc >= contato) desc = Math.max(giro, contato - 1);
    var seg = idxMin(py, contato, n - 1);                       // punho mais alto após o contato
    if (seg <= contato) seg = Math.min(n - 1, contato + 1);
    return { dir: dir, idx: [0, giro, desc, contato, seg, Math.min(n - 1, seg + Math.max(1, Math.round((n - 1 - seg) / 2)))], contato: contato, giro: giro, vel: vs };
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
    return m;
  }

  function splitStep(quadros, fim) {
    var ys = [], i;
    for (i = 0; i <= fim; i++) { var a = quadros[i].lm[P.tornE], b = quadros[i].lm[P.tornD]; ys.push((a.y + b.y) / 2); }
    ys = suavizar(ys, 1);
    if (ys.length < 6) return { amp: 0 };
    var piso = Math.max.apply(null, ys), minimo = Math.min.apply(null, ys);
    return { amp: piso - minimo };
  }

  function classificar(valor, ok, aten) { return isFinite(valor) ? (ok ? "ok" : "atencao") : "nao_avaliavel"; }

  function checklist(quadros, dom, regras) {
    regras = regras || REGRAS;
    var s = segmentar(quadros, dom);
    if (!s) return { erro: "Vídeo curto demais ou pessoa não detectada." };
    var M = s.idx.map(function (i) { return medidas(quadros[i], dom, s.dir); });
    var giro = M[1], contato = M[3], ss = splitStep(quadros, s.giro);
    var itens = [];
    function item(fase, nome, valor, unidade, ok, ref, comentOk, comentAt, auto) {
      var st = auto === false ? "nao_avaliavel" : classificar(valor, ok);
      itens.push({ fase: fase, nome: nome, valor: auto === false ? null : valor, unidade: unidade, ref: ref, status: st,
        comentario: st === "ok" ? comentOk : st === "atencao" ? comentAt : "Não avaliável automaticamente com esta vista/qualidade — revisão do treinador." });
    }
    item(0, "Split step antes do golpe", ss.amp, "", ss.amp >= regras.splitStep.min, "oscilação vertical dos pés ≥ " + regras.splitStep.min,
      "Há impulso vertical dos pés antes do giro.", "Não se percebe split step claro antes da preparação.");
    item(0, "Pegada (semi-western)", null, "", false, "—", "", "", false);
    item(1, "Flexão de joelhos no giro", giro.joelhos, "°", Math.abs(giro.joelhos - regras.joelhos.alvo) <= regras.joelhos.tol, regras.joelhos.alvo + "° ± " + regras.joelhos.tol,
      "Joelhos flexionados dentro da faixa de referência.", giro.joelhos > regras.joelhos.alvo ? "Pouca flexão de joelhos: base alta." : "Flexão excessiva de joelhos.");
    item(1, "Flexão de tronco no giro", giro.tronco, "°", Math.abs(giro.tronco - regras.tronco.alvo) <= regras.tronco.tol, regras.tronco.alvo + "° ± " + regras.tronco.tol,
      "Tronco dentro da faixa de referência.", "Tronco fora da faixa de referência.");
    item(1, "Antebraço não dominante paralelo", giro.antebracoND, "°", giro.antebracoND <= regras.antebracoNaoDominante.max, "≤ " + regras.antebracoNaoDominante.max + "° da horizontal",
      "Braço não dominante bem posicionado, ajudando a equilibrar o giro.", "Braço não dominante caído ou solto no giro.");
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
    return { fases: s.idx.map(function (i, k) { return { nome: FASES[k], quadro: i, t: quadros[i].t, medidas: M[k] }; }), itens: itens, resumo: cont, direcao: s.dir };
  }


  /* Intervenções sugeridas por item em atenção. Apoio ao treinador; não substituem avaliação presencial. */
  var INTERV = {
    "Split step antes do golpe": { prio: 7, porque: "Sem o pequeno salto antes do golpe, a saída para a bola fica lenta.",
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

  /* Quadros sintéticos de um forehand (para demonstração e testes). */
  function sintetico(n, dom) {
    n = n || 60; var q = [], i;
    for (i = 0; i < n; i++) {
      var p = i / (n - 1), lm = [], k;
      for (k = 0; k < 33; k++) lm.push({ x: 0.5, y: 0.5, z: 0, v: 1 });
      var set = function (idx, x, y) { lm[idx] = { x: x, y: y, z: 0, v: 1 }; };
      var salto = (p < 0.12) ? 0.03 * Math.sin(p / 0.12 * Math.PI) : 0;
      var flex = p < 0.3 ? 0.02 : (p < 0.55 ? 0.02 - 0.02 * (p - 0.3) / 0.25 : 0);
      set(P.ombroE, 0.47, 0.30); set(P.ombroD, 0.53, 0.30);
      set(P.quadrilE, 0.47, 0.52); set(P.quadrilD, 0.53, 0.52);
      set(P.joelhoE, 0.52, 0.68 + flex); set(P.joelhoD, 0.56, 0.68 + flex);
      set(P.tornE, 0.47, 0.88 - salto); set(P.tornD, 0.53, 0.88 - salto);
      set(P.nariz, 0.5, 0.22);
      var px = p < 0.3 ? 0.50 - 0.2 * (p / 0.3) : (p < 0.55 ? 0.30 + 0.5 * ((p - 0.3) / 0.25) : 0.80 + 0.1 * ((p - 0.55) / 0.45));
      var py = p < 0.3 ? 0.45 : (p < 0.45 ? 0.45 + 0.2 * ((p - 0.3) / 0.15) : (p < 0.55 ? 0.65 - 0.25 * ((p - 0.45) / 0.1) : 0.40 - 0.15 * ((p - 0.55) / 0.45)));
      var D = dom === "E" ? { p: P.punhoE, c: P.cotE, nd: { p: P.punhoD, c: P.cotD } } : { p: P.punhoD, c: P.cotD, nd: { p: P.punhoE, c: P.cotE } };
      set(D.p, px, py); set(D.c, (px + 0.5) / 2, py - 0.03);
      set(D.nd.c, 0.45, 0.42); set(D.nd.p, 0.36, 0.43);
      q.push({ t: i / 30, lm: lm });
    }
    return q;
  }

  return { P: P, FASES: FASES, REGRAS: REGRAS, ang: ang, segmentar: segmentar, medidas: medidas, checklist: checklist, conclusao: conclusao, sintetico: sintetico, suavizar: suavizar };
});
