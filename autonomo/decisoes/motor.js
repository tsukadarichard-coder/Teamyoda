/* QuadraLab Player · Simulador de Decisões — LÓGICA (sem tela). Funciona no navegador (window.QLD_MOTOR) e no Node (testes).

   · simular(cenario, estado, etapaId, escolha) → { anim, estadoFinal, avaliacao }: o que acontece numa decisão.
     A animação é uma lista de quadros-chave (bola com altura, você, adversário) em segundos de exibição.
   · Continuidade: o estado final de uma etapa é o estado inicial da seguinte (posições, bola, bola ainda no ar).
     Um golpe seguido de uma recuperação para com a bola cruzando a rede; a recuperação continua desse instante.
   · Avaliação: combina alvo, altura e intensidade com o contexto. Não calcula probabilidade de ganhar o ponto.
   · Progresso: normalizar() aceita qualquer coisa vinda do armazenamento local e devolve só o que é válido.
   Todos os tempos, velocidades e respostas do adversário são ilustrativos. */
(function (raiz, fab) {
  if (typeof module === "object" && module.exports) module.exports = fab();
  else raiz.QLD_MOTOR = fab();
})(typeof self !== "undefined" ? self : this, function () {
  var L = 11.885, W = 4.115, S = 6.4, REDE = 0.914;
  var LENTO = 1.8;                                   // a animação roda mais devagar que o real, para dar para acompanhar
  var VEL = { controlada: 15, firme: 21, maxima: 27 }; // m/s, só para a ilustração
  var CORRIDA = 5.6;                                 // m/s de deslocamento dos jogadores
  var APICE = { baixa: 1.45, media: 2.4, alta: 3.9 };
  var APICE_SAQUE = { baixa: 2.75, media: 2.95, alta: 3.5 };
  var ALTURAS = ["baixa", "media", "alta"], INTENSIDADES = ["controlada", "firme", "maxima"];
  var NOME_ALTURA = { baixa: "Baixa", media: "Média", alta: "Alta" };
  var NOME_INTENSIDADE = { controlada: "Controlada", firme: "Firme", maxima: "Máxima" };
  var QUADRO = 1 / 30;
  /* variações de uma mesma situação (camada de jogo): superfície, perfil do adversário e ponto decisivo.
     Mudam a ilustração (velocidade, quique, resposta) e a avaliação (a mesma escolha pesa diferente) */
  var SUPERFICIE = { saibro: { vel: 0.88, chute: -0.3, hC: 0.25 }, rapida: { vel: 1.15, chute: 0.4, hC: -0.15 } };
  var PERFIL_ADV = { equilibrado: { vel: 1 }, defensor: { vel: 0.9 }, agressivo: { vel: 1.15 } };
  function varianteOk(v) {
    v = v || {};
    return { superficie: SUPERFICIE[v.superficie] ? v.superficie : null, adversario: PERFIL_ADV[v.adversario] ? v.adversario : "equilibrado", decisivo: !!v.decisivo };
  }
  function velSup(v) { return v && v.superficie ? SUPERFICIE[v.superficie].vel : 1; }

  /* ── vetores ── */
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
  function soma(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
  function mult(a, k) { return [a[0] * k, a[1] * k]; }
  function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
  function unit(a) { var n = Math.hypot(a[0], a[1]) || 1; return [a[0] / n, a[1] / n]; }
  function lerp(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; }
  function lim(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function r2(v) { return Math.round(v * 100) / 100; }

  /* ponto que divide ao meio o ângulo das respostas possíveis (das laterais da sua linha de base), na profundidade y */
  function cobertura(C, y) {
    var a = unit(sub([-W, -L], C)), b = unit(sub([W, -L], C)), u = soma(a, b);
    if (Math.abs(u[1]) < 1e-6) return [0, y];
    var k = (y - C[1]) / u[1], p = soma(C, mult(u, k));
    return [lim(p[0], -W + 0.4, W - 0.4), y];
  }

  /* altura da bola ao longo de um arco: começa em h0, termina em h1 e passa pelo ápice informado */
  function arco(h0, h1, apice) {
    apice = Math.max(apice, h0 + 0.05, h1 + 0.05);
    var lo = 0, hi = 20, A = 0;
    for (var i = 0; i < 40; i++) {
      A = (lo + hi) / 2;
      var mx = 0; for (var s = 0; s <= 1.0001; s += 0.02) mx = Math.max(mx, h0 * (1 - s) + h1 * s + 4 * A * s * (1 - s));
      if (mx > apice) hi = A; else lo = A;
    }
    return function (s) { return h0 * (1 - s) + h1 * s + 4 * A * s * (1 - s); };
  }

  /* trajetória: de P (altura h0) até o quique Q, depois até K (altura hK). Devolve quadros-chave a partir de t0 */
  function voo(P, h0, Q, K, hK, apice, v, t0, apice2) {
    var d1 = dist(P, Q), d2 = dist(Q, K), t1 = d1 / v * LENTO, t2 = d2 / (v * 0.72) * LENTO;
    var a1 = arco(h0, 0, apice), a2 = arco(0, hK, apice2 != null ? apice2 : Math.max(hK + 0.3, apice * 0.45));
    var q = [];
    for (var t = 0; t < t1; t += QUADRO) { var s = t / t1, p = lerp(P, Q, s); q.push({ t: t0 + t, x: p[0], y: p[1], h: a1(s) }); }
    q.push({ t: t0 + t1, x: Q[0], y: Q[1], h: 0, quique: true });
    for (t = QUADRO; t < t2; t += QUADRO) { s = t / t2; p = lerp(Q, K, s); q.push({ t: t0 + t1 + t, x: p[0], y: p[1], h: a2(s) }); }
    q.push({ t: t0 + t1 + t2, x: K[0], y: K[1], h: hK });
    /* instante e altura em que a bola passa pela rede (se passar) */
    var rede = null;
    if ((P[1] < 0) !== (Q[1] < 0)) { var sn = (0 - P[1]) / (Q[1] - P[1]); rede = { t: t0 + sn * t1, h: a1(sn), x: P[0] + (Q[0] - P[0]) * sn }; }
    return { quadros: q, tQuique: t0 + t1, tFim: t0 + t1 + t2, rede: rede, perfil: { d1: d1, d2: d2, a1: a1, a2: a2 } };
  }

  /* trajetória sem quique do seu lado (você toca de voleio): de P (altura h0) até K (altura hK) */
  function direto(P, h0, K, hK, apice, v, t0) {
    var d = dist(P, K), t1 = d / v * LENTO, a = arco(h0, hK, apice), q = [];
    for (var t = 0; t < t1; t += QUADRO) { var s = t / t1, p = lerp(P, K, s); q.push({ t: t0 + t, x: p[0], y: p[1], h: a(s) }); }
    q.push({ t: t0 + t1, x: K[0], y: K[1], h: hK });
    var rede = null;
    if ((P[1] < 0) !== (K[1] < 0)) { var sn = (0 - P[1]) / (K[1] - P[1]); rede = { t: t0 + sn * t1, h: a(sn), x: P[0] + (K[0] - P[0]) * sn }; }
    return { quadros: q, tQuique: null, tFim: t0 + t1, rede: rede };
  }

  /* deslocamento: de A até B a partir de tIni, na velocidade v (ou chegando exatamente em tChega) */
  function trilha(pontos) { return pontos; }
  function mover(A, B, tIni, tChega, v) {
    var d = dist(A, B);
    var dur = tChega != null ? Math.max(0.05, tChega - tIni) : d / (v || CORRIDA) * LENTO;
    return [{ t: tIni, x: A[0], y: A[1] }, { t: tIni + dur, x: B[0], y: B[1] }];
  }
  /* até onde chega quem parte de A em direção a B entre tIni e tFim */
  function ate(A, B, tIni, tFim) {
    var d = dist(A, B), alcance = Math.max(0, tFim - tIni) / LENTO * CORRIDA;
    return alcance >= d ? B.slice() : lerp(A, B, alcance / d);
  }
  function posEm(trilhaPts, t) {
    if (!trilhaPts.length) return null;
    if (t <= trilhaPts[0].t) return [trilhaPts[0].x, trilhaPts[0].y];
    for (var i = 1; i < trilhaPts.length; i++) {
      var a = trilhaPts[i - 1], b = trilhaPts[i];
      if (t <= b.t) { var k = (t - a.t) / ((b.t - a.t) || 1); return [a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k]; }
    }
    var u = trilhaPts[trilhaPts.length - 1]; return [u.x, u.y];
  }
  function bolaEm(quadros, t) {
    if (!quadros.length) return null;
    for (var i = 1; i < quadros.length; i++) if (t <= quadros[i].t) {
      var a = quadros[i - 1], b = quadros[i], k = (t - a.t) / ((b.t - a.t) || 1);
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, h: a.h + (b.h - a.h) * k };
    }
    var u = quadros[quadros.length - 1]; return { x: u.x, y: u.y, h: u.h };
  }

  /* ── avaliação de um golpe: alvo + altura + intensidade no contexto ── */
  function contextoDe(etapa, opcao) { return opcao.contexto || etapa.contexto || "neutro"; }
  /* "ideal" pode ser uma faixa ({ altura, intensidade }) ou uma lista de faixas igualmente válidas — por exemplo, as
     duas defesas do método: bola alta para ganhar tempo, ou cruzada acelerada. Vale a faixa que a escolha mais se aproxima */
  function pontosFaixa(ctx, ideal, ia, ii) {
    var faixaA = (ideal.altura || ALTURAS).map(function (x) { return ALTURAS.indexOf(x); });
    var faixaI = (ideal.intensidade || INTENSIDADES).map(function (x) { return INTENSIDADES.indexOf(x); });
    var p = 0, m = [];
    if (ia < Math.min.apply(null, faixaA)) { p += 1; m.push("altura"); }
    else if (ia > Math.max.apply(null, faixaA)) { if (ctx === "ataque" || ctx === "saque" || ctx === "passada" || ctx === "rede") { p += 0.5; m.push("altura"); } }
    if (ii > Math.max.apply(null, faixaI)) { p += ctx === "defesa" && ii === 2 ? 1.5 : 1; m.push("intensidade"); }
    else if (ii < Math.min.apply(null, faixaI)) { p += 0.5; m.push("intensidade"); }
    return { p: p, m: m };
  }
  /* o que a variação muda no peso de uma escolha (regras gerais; os textos estão em conteudo.VARIANTES) */
  function ajustesVariante(variante, etapa, opcao, intensidade, ctx) {
    var v = varianteOk(variante), d = 0, notas = [];
    var curta = opcao.alvo && opcao.alvo[1] < S && ctx !== "saque";
    var sobe = !!(opcao.resposta && opcao.resposta.voleio);
    function nota(k, delta) { d += delta; notas.push(k); }
    if (v.superficie === "rapida") {
      if (opcao.objetivo === "tempo" || sobe) nota("rapida_tempo", -0.5);
      else if (curta && ctx !== "passada" && ctx !== "rede") nota("rapida_toque", 0.5);
    } else if (v.superficie === "saibro") {
      if (curta && ctx !== "passada") nota("saibro_toque", -0.5);
      else if (intensidade === "maxima" && ctx !== "defesa") nota("saibro_forca", 0.5);
    }
    if (v.adversario === "defensor") {
      if (opcao.nivel === "iniciativa" || opcao.objetivo === "margem") nota("defensor_sem_intencao", 0.5);
      else if (sobe || (curta && ctx !== "passada")) nota("defensor_frente", -0.5);
    } else if (v.adversario === "agressivo") {
      if (curta && ctx !== "passada" && ctx !== "rede") nota("agressivo_curta", 0.5);
      else if (opcao.objetivo === "quadra" || opcao.objetivo === "ganhar_tempo") nota("agressivo_profundidade", -0.5);
    }
    if (v.decisivo) {
      if ((opcao.risco || 0) >= 1.5) nota("decisivo_margem", 0.5);
      else if (opcao.nivel === "iniciativa") nota("decisivo_iniciativa", 0);
    }
    return { delta: d, notas: notas };
  }
  function avaliarGolpe(conteudo, etapa, opcao, altura, intensidade, variante) {
    var ctx = contextoDe(etapa, opcao), ideais = Array.isArray(opcao.ideal) ? opcao.ideal : [opcao.ideal || {}];
    var ia = ALTURAS.indexOf(altura), ii = INTENSIDADES.indexOf(intensidade);
    var melhor = ideais.map(function (f) { return pontosFaixa(ctx, f, ia, ii); }).sort(function (a, b) { return a.p - b.p; })[0];
    var aj = ajustesVariante(variante, etapa, opcao, intensidade, ctx);
    var pontos = Math.max(0, (opcao.risco || 0) + melhor.p + aj.delta), motivos = melhor.m;
    var nivel = opcao.nivel || (pontos <= 0.5 ? "coerente" : pontos <= 1.5 ? "inicio" : "controle");
    var NV = (conteudo.VARIANTES || {}).notas || {};
    var ataque = ctx === "ataque" || ctx === "saque";
    var pressao = (opcao.pressao || 0) + { controlada: -0.3, firme: 0, maxima: 0.3 }[intensidade] + (ataque ? { baixa: 0.15, media: 0, alta: -0.35 } : { baixa: 0, media: 0, alta: 0.1 })[altura];
    var pressaoNivel = pressao < 0.8 ? "baixa" : pressao < 1.5 ? "media" : "alta";
    var N = conteudo.NOTAS;
    return {
      nivel: nivel, rotulo: conteudo.ROTULOS[nivel], pontos: pontos, pressao: r2(pressao), pressaoNivel: pressaoNivel, motivos: motivos,
      texto: opcao.texto, notaAltura: N.altura[ctx][altura], notaIntensidade: N.intensidade[ctx][intensidade], resumo: opcao.resumo,
      objetivo: opcao.objetivo || null, notasVariante: aj.notas.map(function (k) { return NV[k]; }).filter(Boolean),
    };
  }
  function efeitoTexto(pressaoNivel, tempoVoo) {
    var adv = { baixa: "com tempo para se organizar", media: "com algum tempo", alta: "com pouco tempo" }[pressaoNivel];
    var seu = tempoVoo > 1.45 ? "mais tempo" : tempoVoo > 1.05 ? "um tempo razoável" : "pouco tempo";
    return "Nesta combinação, o adversário recebe a bola " + adv + ", e você tem " + seu + " para se recuperar enquanto ela viaja.";
  }

  /* ── um golpe ── */
  function planoGolpe(cenario, estado, etapaId, opcao, altura, intensidade) {
    var etapa = cenario.etapas[etapaId], P = estado.jog, T = opcao.alvo, saque = !!(cenario.inicio.saque && etapaId === "d1");
    var dir = unit(sub(T, P)), curta = Math.abs(T[1]) < S;
    var chute = saque ? 3.4 + { baixa: 0.6, media: 0.3, alta: 0 }[altura] + { controlada: 0, firme: 0.5, maxima: 1.0 }[intensidade]
      : curta ? 1.2 + { baixa: 0, media: 0.2, alta: 0.5 }[altura]
      : 2.4 + { baixa: 0, media: 0.6, alta: 1.3 }[altura] + { controlada: 0, firme: 0.4, maxima: 0.8 }[intensidade];
    var va = varianteOk(estado.variante), sup = va.superficie ? SUPERFICIE[va.superficie] : null;
    if (sup && !curta) chute = Math.max(1.2, chute + sup.chute);
    var C = soma(T, mult(dir, chute));
    C = [lim(C[0], -W - 2.4, W + 2.4), lim(C[1], -L - 3.4, L + 3.4)];
    var hC = (altura === "alta" && !curta ? 1.35 : 0.95) + (sup && !curta ? sup.hC : 0);
    var apice = saque ? APICE_SAQUE[altura] : APICE[altura];
    var v = VEL[intensidade] * (saque ? 1.35 : 1) * velSup(va);
    var b = voo(P, estado.hContato || 1, T, C, hC, apice, v, 0);
    var advIni = estado.adv;
    var tSai = 0.12;
    var adv = mover(advIni, C, tSai, b.tFim);
    return { etapa: etapa, P: P, T: T, C: C, b: b, adv: adv, saque: saque, tempoVoo: (b.tFim) / LENTO };
  }

  function simularGolpe(conteudo, cenario, estado, etapaId, opcao, altura, intensidade) {
    var g = planoGolpe(cenario, estado, etapaId, opcao, altura, intensidade), etapa = g.etapa;
    var av = avaliarGolpe(conteudo, etapa, opcao, altura, intensidade, estado.variante);
    av.efeito = efeitoTexto(av.pressaoNivel, g.tempoVoo);
    var fatorResp = velSup(estado.variante) * PERFIL_ADV[varianteOk(estado.variante).adversario].vel;
    var proxima = opcao.proxima ? cenario.etapas[opcao.proxima] : null;
    var anim = { bola: g.b.quadros.slice(), jog: [], adv: g.adv.slice(), alvo: g.T, quiques: [g.T], rastrosBola: [], rastrosJog: [], rastrosAdv: [], rede: g.b.rede, dur: g.b.tFim, pausa: null };
    var final;
    if (proxima && proxima.tipo === "recuperacao") {
      /* para com a bola cruzando a rede: a próxima decisão é para onde ir enquanto ela viaja */
      var tPara = g.b.rede ? g.b.rede.t + 0.12 : g.b.tQuique * 0.5;
      anim.bola = g.b.quadros.filter(function (q) { return q.t <= tPara; });
      anim.adv = [anim.adv[0], { t: tPara, x: posEm(g.adv, tPara)[0], y: posEm(g.adv, tPara)[1] }];
      anim.jog = [{ t: 0, x: g.P[0], y: g.P[1] }, { t: tPara, x: g.P[0], y: g.P[1] }];
      anim.quiques = [];
      anim.dur = tPara; anim.pausa = "A bola ainda está no ar.";
      var bp = bolaEm(g.b.quadros, tPara), ap = posEm(g.adv, tPara);
      final = { etapa: opcao.proxima, jog: g.P.slice(), adv: ap, bola: [bp.x, bp.y], hBola: bp.h, hContato: null,
        voo: { de: etapaId, opcao: opcao.id, altura: altura, intensidade: intensidade, desde: tPara, jogAntes: estado.jog.slice(), advAntes: estado.adv.slice(), hAntes: estado.hContato || 1, variante: estado.variante || null },
        pressaoNivel: av.pressaoNivel, pressao: av.pressao };
    } else if (opcao.resposta) {
      /* resposta possível do adversário, coerente com o alvo; você se recupera e depois vai para a bola */
      var R = opcao.resposta, tGolpe = g.b.tFim + 0.25;
      var vR = (av.pressaoNivel === "alta" ? 15 : av.pressaoNivel === "media" ? 18 : 21) * fatorResp;
      var br = R.voleio ? direto(g.C, 1.0, R.contato, 1.1, av.pressaoNivel === "alta" ? 2.6 : 1.9, vR, tGolpe)
        : voo(g.C, 1.0, R.quique, R.contato, 0.9, av.pressaoNivel === "alta" ? 3.1 : 2.3, vR, tGolpe);
      var R0 = R.jogRecupera || cobertura(g.C, -12.0), tJogSai = 0.22;
      var meio = ate(g.P, R0, tJogSai, tGolpe + 0.1);
      anim.bola = g.b.quadros.concat(br.quadros);
      anim.quiques = R.voleio ? [g.T] : [g.T, R.quique];
      anim.jog = mover(g.P, meio, tJogSai, tGolpe + 0.1).concat(mover(meio, R.contato, tGolpe + 0.1, br.tFim).slice(1));
      anim.adv = g.adv.concat(mover(g.C, R.advRecupera, tGolpe + 0.05, br.tFim + 0.3).slice(1));
      anim.dur = br.tFim + 0.3;
      anim.resposta = { de: g.C, quique: R.voleio ? null : R.quique, contato: R.contato, rede: br.rede, voleio: !!R.voleio };
      final = { etapa: opcao.proxima, jog: R.contato.slice(), adv: R.advRecupera.slice(), bola: R.contato.slice(), hContato: R.voleio ? 1.1 : 0.9, voo: null, pressaoNivel: av.pressaoNivel, pressao: av.pressao };
    } else {
      /* último golpe da sequência: a bola chega ao adversário e você se recupera na profundidade em que está */
      var yRec = g.P[1] < -7 ? -12.0 : g.P[1];
      anim.jog = mover(g.P, cobertura(g.C, yRec), 0.22, null);
      anim.adv = g.adv.concat([{ t: anim.dur + 0.3, x: g.C[0], y: g.C[1] }]);
      anim.dur += 0.3;
      final = { etapa: null, jog: posEm(anim.jog, anim.dur), adv: g.C.slice(), bola: g.C.slice(), voo: null, fim: true, pressaoNivel: av.pressaoNivel };
    }
    anim.contatoAdv = g.C;
    return { anim: anim, estadoFinal: final, avaliacao: av, golpe: { P: g.P, T: g.T, C: g.C, altura: altura, intensidade: intensidade, rede: g.b.rede, saque: g.saque } };
  }

  /* ── recuperação: continua o voo da bola, você se desloca, o adversário joga uma resposta possível ── */
  function posicaoRecuperacao(opcao, J, C) {
    var m = opcao.posicao || { modo: "ficar" };
    if (m.modo === "bissetriz") return cobertura(C, m.y);
    if (m.modo === "recuar") return cobertura(C, -13.4);
    return J.slice();
  }
  function simularRecuperacao(conteudo, cenario, estado, etapaId, opcao) {
    var v = estado.voo, etapa = cenario.etapas[etapaId];
    var opAnt = cenario.etapas[v.de].opcoes.filter(function (o) { return o.id === v.opcao; })[0];
    var g = planoGolpe(cenario, { jog: v.jogAntes, adv: v.advAntes, hContato: v.hAntes, variante: estado.variante }, v.de, opAnt, v.altura, v.intensidade);
    var t0 = v.desde, C = g.C, J = estado.jog, va = varianteOk(estado.variante);
    var R = posicaoRecuperacao(opcao, J, C);
    var nivelP = estado.pressaoNivel || "media";
    /* a resposta possível: com o adversário pressionado, uma bola defensiva (alta e central, ou lobby se você estiver
       perto da rede); senão, para o lado mais longe de onde você escolheu ficar */
    var lado = C[0] <= 0 ? 1 : -1, naRede = R[1] > -6.5;
    var cand = [
      { id: "cruzada", q: [lado * 2.9, -8.9], ap: 2.3 },
      { id: "paralela", q: [-lado * 3.1, -9.3], ap: 2.3 },
    ];
    var escolha;
    /* perfil do adversário: quem devolve tudo se defende alto mesmo sem estar tão pressionado; o agressivo
       contra-ataca para o espaço mesmo pressionado */
    var defende = nivelP === "alta" && va.adversario !== "agressivo" || (nivelP === "media" && va.adversario === "defensor");
    if (defende) escolha = naRede ? { id: "lobby", q: [-R[0] * 0.3, -9.6], ap: 5.6 } : { id: "central", q: [0.3, -9.4], ap: 3.2 };
    else {
      if (naRede) cand.push({ id: "lobby", q: [-R[0] * 0.3, -9.9], ap: 5.8 });
      escolha = cand.slice().sort(function (a, b) { return dist(b.q, R) - dist(a.q, R); })[0];
    }
    var vR = (nivelP === "alta" ? 14 : nivelP === "media" ? 18 : 22) * velSup(va) * PERFIL_ADV[va.adversario].vel;
    var dirR = unit(sub(escolha.q, C)), fimR = soma(escolha.q, mult(dirR, escolha.id === "lobby" ? 4.0 : 4.2));
    fimR = [lim(fimR[0], -W - 2.2, W + 2.2), lim(fimR[1], -L - 3.2, -1)];
    var tAdvChega = g.b.tFim - t0, tGolpe = tAdvChega + 0.25;
    var bolaResto = g.b.quadros.filter(function (q) { return q.t > t0; }).map(function (q) { return { t: q.t - t0, x: q.x, y: q.y, h: q.h, quique: q.quique }; });
    var b0 = bolaEm(g.b.quadros, t0); bolaResto.unshift({ t: 0, x: b0.x, y: b0.y, h: b0.h });
    var br = voo(C, 1.0, escolha.q, fimR, 0.3, escolha.ap, vR, tGolpe);
    /* você: vai para a posição escolhida; quando o adversário bate, reage e vai ao melhor ponto de encontro com a bola
       (de voleio, se estiver perto da rede; depois do quique, se estiver no fundo), onde ela ainda dá para ser batida */
    var tReage = tGolpe + 0.2;
    var noReage = ate(J, R, 0, tReage);
    var chegaR = mover(J, R, 0, null), tR = chegaR[1].t;
    var jog = tR <= tReage ? chegaR.concat([{ t: tReage, x: R[0], y: R[1] }]) : [{ t: 0, x: J[0], y: J[1] }, { t: tReage, x: noReage[0], y: noReage[1] }];
    var melhor = null;
    br.quadros.forEach(function (q) {
      if (q.y > -0.6 || q.h > 2.7 || q.t <= tReage) return;
      var paraTras = q.y < noReage[1] - 1.5; // correr de costas (bola por cima, lobby) é mais lento
      var m = (q.t - tReage) / LENTO * CORRIDA * (paraTras ? 0.62 : 1) - dist(noReage, [q.x, q.y]);
      if (!melhor || m > melhor.m) melhor = { m: m, q: q };
    });
    if (!melhor) { var u = br.quadros[br.quadros.length - 1]; melhor = { m: -9, q: u }; }
    var margem = melhor.m, I = [melhor.q.x, melhor.q.y], tI = melhor.q.t;
    var alcancou = margem >= -0.6;
    var precisa = dist(noReage, I), alcance = Math.max(0, tI - tReage) / LENTO * CORRIDA * (I[1] < noReage[1] - 1.5 ? 0.62 : 1);
    var fimJ = alcancou ? I.slice() : lerp(noReage, I, Math.min(1, alcance / (precisa || 1)));
    var bolaResp = alcancou ? br.quadros.filter(function (q) { return q.t <= tI; }) : br.quadros;
    var tFimResp = alcancou ? tI : br.tFim;
    jog.push({ t: tFimResp, x: fimJ[0], y: fimJ[1] });
    var advPts = [{ t: 0, x: estado.adv[0], y: estado.adv[1] }, { t: tAdvChega, x: C[0], y: C[1] }];
    var advVolta = C[1] > 6.4 ? [C[0] * 0.35, Math.min(C[1], 12.2)] : [C[0] * 0.6, C[1] + 1.2];
    advPts = advPts.concat(mover(C, advVolta, tGolpe + 0.05, tFimResp + 0.3).slice(1));
    var cobertura_ = margem >= 1 ? "tempo" : alcancou ? "limite" : "longe";
    var textoCob = { tempo: "Na ilustração, você chega à resposta com tempo para preparar o golpe.", limite: "Na ilustração, você chega à resposta no limite, esticado.", longe: "Na ilustração, a resposta passa fora do seu alcance." }[cobertura_];
    var descResp = { cruzada: "uma resposta cruzada", paralela: "uma resposta na paralela", lobby: "um lobby", central: "uma bola alta e central, para se defender" }[escolha.id];
    var nivel = (opcao.rotulos || {})[nivelP] || "inicio";
    var av = {
      nivel: nivel, rotulo: conteudo.ROTULOS[nivel], pressaoNivel: nivelP, texto: (opcao.textos || {})[nivelP] || "", resumo: opcao.resumo,
      resposta: "Uma resposta possível do adversário: " + descResp + ".", cobertura: cobertura_, textoCobertura: textoCob,
      notasVariante: va.adversario !== "equilibrado" && conteudo.VARIANTES ? [conteudo.VARIANTES.notas["recupera_" + va.adversario]].filter(Boolean) : [],
    };
    var quiqueOk = bolaResp.some(function (q) { return q.quique; });
    var anim = { bola: bolaResto.concat(bolaResp), jog: jog, adv: advPts, quiques: quiqueOk ? [g.T, escolha.q] : [g.T], alvo: null, dur: tFimResp + 0.4, rede: br.rede, recuperacao: R, resposta: { de: C, quique: quiqueOk ? escolha.q : null, contato: I, voleio: !quiqueOk } };
    var final = { etapa: null, jog: fimJ, adv: advVolta, bola: alcancou ? I : fimR, voo: null, fim: true };
    return { anim: anim, estadoFinal: final, avaliacao: av, recuperacao: { R: R, I: I, margem: r2(margem), resposta: escolha.id } };
  }

  function simular(conteudo, cenario, estado, etapaId, escolha) {
    var etapa = cenario.etapas[etapaId];
    if (!etapa) throw new Error("etapa inexistente: " + etapaId);
    var opcao = etapa.opcoes.filter(function (o) { return o.id === escolha.opcao; })[0];
    if (!opcao) throw new Error("opção inexistente: " + escolha.opcao);
    var r = etapa.tipo === "recuperacao" ? simularRecuperacao(conteudo, cenario, estado, etapaId, opcao)
      : simularGolpe(conteudo, cenario, estado, etapaId, opcao, escolha.altura || "media", escolha.intensidade || "firme");
    r.estadoFinal.variante = estado.variante || null;
    r.respostaCategoria = categoriaResposta(r);
    if (escolha.previsao && r.respostaCategoria) r.previsao = { escolhida: escolha.previsao, certa: escolha.previsao === r.respostaCategoria };
    return r;
  }
  /* para "prever antes de ver": classifica a resposta possível do adversário que a animação mostra */
  var CATEGORIAS = { cruzada: "Cruzada", paralela: "Na paralela", meio: "Pelo meio", curta: "Curta", lobby: "Lobby" };
  function categoriaResposta(r) {
    if (r.recuperacao) return { cruzada: "cruzada", paralela: "paralela", lobby: "lobby", central: "meio" }[r.recuperacao.resposta] || null;
    var a = r.anim && r.anim.resposta; if (!a) return null;
    var Q = a.quique || a.contato, C = a.de;
    if (!a.voleio && Math.abs(Q[1]) < S) return "curta";
    if (Math.abs(Q[0]) < 1.2) return "meio";
    if (Math.abs(C[0]) < 0.6) return "meio";
    return (Q[0] > 0) === (C[0] > 0) ? "paralela" : "cruzada";
  }
  /* a etapa vai mostrar uma resposta do adversário? (golpe com resposta, ou recuperação) */
  function temResposta(cenario, etapaId, opcaoId) {
    var e = cenario.etapas[etapaId]; if (!e) return false;
    if (e.tipo === "recuperacao") return true;
    var o = e.opcoes.filter(function (x) { return x.id === opcaoId; })[0];
    if (!o || !o.resposta) return false;
    var prox = o.proxima ? cenario.etapas[o.proxima] : null;
    return !(prox && prox.tipo === "recuperacao");
  }

  /* para a tela da recuperação: onde está a bola em voo (alvo, contato do adversário, caminho no chão) e onde fica
     cada opção de posição */
  function vooAtual(cenario, estado) {
    var v = estado.voo; if (!v) return null;
    var op = cenario.etapas[v.de].opcoes.filter(function (o) { return o.id === v.opcao; })[0];
    var g = planoGolpe(cenario, { jog: v.jogAntes, adv: v.advAntes, hContato: v.hAntes, variante: estado.variante }, v.de, op, v.altura, v.intensidade);
    return { P: g.P, T: g.T, C: g.C, desde: v.desde, quadros: g.b.quadros };
  }
  function posicoesRecuperacao(cenario, estado, etapaId) {
    var va = vooAtual(cenario, estado), etapa = cenario.etapas[etapaId];
    if (!va || !etapa) return [];
    return etapa.opcoes.map(function (o) { return { id: o.id, R: posicaoRecuperacao(o, estado.jog, va.C) }; });
  }

  function estadoInicial(cenario, variante) {
    var i = cenario.inicio;
    return { etapa: "d1", jog: i.jog.slice(), adv: i.adv.slice(), bola: i.jog.slice(), hContato: i.hContato || 1, voo: null, variante: variante ? varianteOk(variante) : null };
  }

  /* refaz o caminho já decidido (para retomar exatamente de onde parou); devolve null se algo não confere */
  function refazer(conteudo, cenario, caminho, variante) {
    var est = estadoInicial(cenario, variante), passos = [];
    for (var i = 0; i < caminho.length; i++) {
      var c = caminho[i];
      if (!c || c.etapa !== est.etapa || !cenario.etapas[c.etapa]) return null;
      var r;
      try { r = simular(conteudo, cenario, est, c.etapa, c); } catch (e) { return null; }
      passos.push({ escolha: c, resultado: r, estadoAntes: est });
      est = r.estadoFinal;
    }
    return { estado: est, passos: passos };
  }

  /* perfil lateral (altura × distância) de um golpe, para a vista lateral ilustrativa */
  function perfil(cenario, estado, etapaId, opcao, altura, intensidade) {
    var g = planoGolpe(cenario, estado, etapaId, opcao, altura, intensidade), pts = [], d1 = g.b.perfil.d1, d2 = g.b.perfil.d2;
    for (var s = 0; s <= 1.0001; s += 0.05) pts.push([d1 * s, g.b.perfil.a1(s)]);
    for (s = 0.05; s <= 1.0001; s += 0.05) pts.push([d1 + d2 * s, g.b.perfil.a2(s)]);
    var dRede = g.b.rede ? dist(g.P, [g.b.rede.x, 0]) : null;
    return { pontos: pts, dRede: dRede, folga: g.b.rede ? r2(g.b.rede.h - REDE) : null, total: d1 + d2, hRede: REDE };
  }

  /* ── progresso (armazenamento local) ──
     Cada situação é um padrão num nível: chave "<cenario>.<nivel>" (a chave antiga, só "<cenario>", vira o nível 1).
     Também guarda o modo relâmpago e os dias jogados (para a sequência de dias). */
  var CHAVE = "qlDecisoes:v1";
  function progressoVazio() { return { v: 2, cenarios: {}, relampago: { melhor: 0, partidas: [] }, dias: [] }; }
  function escolhaValida(cenario, e) {
    if (!e || typeof e !== "object") return null;
    var et = cenario.etapas[e.etapa]; if (!et) return null;
    if (!et.opcoes.some(function (o) { return o.id === e.opcao; })) return null;
    var out = { etapa: e.etapa, opcao: e.opcao };
    if (et.tipo === "golpe") { out.altura = ALTURAS.indexOf(e.altura) >= 0 ? e.altura : "media"; out.intensidade = INTENSIDADES.indexOf(e.intensidade) >= 0 ? e.intensidade : "firme"; }
    if (CATEGORIAS[e.previsao]) out.previsao = e.previsao;
    return out;
  }
  function tentativaValida(cenario, t) {
    var e = escolhaValida(cenario, t); if (!e) return null;
    e.primeira = !!(t && t.primeira); e.em = dataValida(t && t.em) || null; e.previsaoCerta = !!(t && t.previsaoCerta && e.previsao);
    return e;
  }
  function dataValida(s) { return typeof s === "string" && /^\d{4}-\d{2}-\d{2}T/.test(s) ? s.slice(0, 30) : null; }
  function chaveSituacao(cenId, n) { return cenId + "." + n; }
  function niveis(conteudo) { return conteudo.NIVEIS || [{ n: 1, nome: "Base", variante: {} }]; }
  function varianteDoNivel(conteudo, n) { var x = niveis(conteudo).filter(function (v) { return v.n === n; })[0]; return x ? x.variante : {}; }
  function normalizar(bruto, conteudo) {
    var p = progressoVazio();
    if (!bruto || typeof bruto !== "object") return p;
    var fonte = bruto.cenarios && typeof bruto.cenarios === "object" ? bruto.cenarios : {};
    conteudo.CENARIOS.forEach(function (cen) {
      niveis(conteudo).forEach(function (nv) {
        var chave = chaveSituacao(cen.id, nv.n), variante = nv.variante;
        var c = fonte[chave] || (nv.n === 1 ? fonte[cen.id] : null);
        if (!c || typeof c !== "object") return;
        var exec = c.execucao && typeof c.execucao === "object" ? c.execucao : {};
        var caminho = (Array.isArray(exec.caminho) ? exec.caminho : []).slice(0, 3).map(function (e) { return escolhaValida(cen, e); });
        if (caminho.some(function (x) { return !x; }) || !refazer(conteudo, cen, caminho, variante)) caminho = [];
        var rf = refazer(conteudo, cen, caminho, variante);
        var pend = escolhaValida(cen, exec.pendente);
        if (pend && (!rf || rf.estado.etapa !== pend.etapa)) pend = null;
        var tent = (Array.isArray(exec.tentativas) ? exec.tentativas : []).slice(-60).map(function (t) { return tentativaValida(cen, t); }).filter(Boolean);
        var hist = (Array.isArray(c.historico) ? c.historico : []).slice(-20).map(function (h) {
          if (!h || typeof h !== "object") return null;
          var cam = (Array.isArray(h.caminho) ? h.caminho : []).map(function (e) { return escolhaValida(cen, e); });
          if (cam.length !== 3 || cam.some(function (x) { return !x; })) return null;
          var tt = (Array.isArray(h.tentativas) ? h.tentativas : []).slice(-60).map(function (t) { return tentativaValida(cen, t); }).filter(Boolean);
          var est = Number.isInteger(h.estrelas) ? lim(h.estrelas, 0, 3) : estrelas(conteudo, cen, cam, tt, variante).estrelas;
          return { concluidoEm: dataValida(h.concluidoEm), caminho: cam, exploradas: Math.max(0, Math.min(99, h.exploradas | 0)), tentativas: tt, estrelas: est, leitura: lim(h.leitura | 0, 0, 3) };
        }).filter(Boolean);
        var fim = !!(rf && rf.estado.fim);
        p.cenarios[chave] = {
          iniciadoEm: dataValida(c.iniciadoEm), atualizadoEm: dataValida(c.atualizadoEm), concluidoEm: dataValida(c.concluidoEm),
          execucao: { caminho: caminho, pendente: fim ? null : pend, tentativas: tent, fim: fim },
          historico: hist,
        };
      });
    });
    var rl = bruto.relampago && typeof bruto.relampago === "object" ? bruto.relampago : {};
    p.relampago = { melhor: lim(rl.melhor | 0, 0, 999), partidas: (Array.isArray(rl.partidas) ? rl.partidas : []).slice(-20).map(function (x) { return x && dataValida(x.em) ? { em: x.em, pontos: lim(x.pontos | 0, 0, 999) } : null; }).filter(Boolean) };
    p.dias = (Array.isArray(bruto.dias) ? bruto.dias : []).filter(function (d) { return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d); }).sort().filter(function (d, i, a) { return a.indexOf(d) === i; }).slice(-120);
    return p;
  }

  /* ── camada de jogo ── */
  /* estrelas de uma situação concluída: uma por decisão em que a PRIMEIRA escolha foi coerente com o contexto
     (explorar alternativas depois não tira nem dá estrela). Leitura: previsões certas da resposta do adversário */
  function estrelas(conteudo, cenario, caminho, tentativas, variante) {
    var rf = refazer(conteudo, cenario, caminho, variante); if (!rf) return { estrelas: 0, leitura: 0, detalhe: [] };
    var detalhe = rf.passos.map(function (ps) {
      var prim = (tentativas || []).filter(function (t) { return t.etapa === ps.escolha.etapa && t.primeira; })[0] || ps.escolha;
      var r; try { r = simular(conteudo, cenario, ps.estadoAntes, prim.etapa, prim); } catch (e) { r = ps.resultado; }
      return { etapa: ps.escolha.etapa, nivel: r.avaliacao.nivel, estrela: r.avaliacao.nivel === "coerente" };
    });
    var leitura = (tentativas || []).filter(function (t) { return t.previsaoCerta; }).length;
    return { estrelas: detalhe.filter(function (d) { return d.estrela; }).length, leitura: Math.min(3, leitura), detalhe: detalhe };
  }
  function melhorEstrelas(prog, chave) { var c = prog.cenarios[chave]; return c && c.historico.length ? Math.max.apply(null, c.historico.map(function (h) { return h.estrelas || 0; })) : -1; }
  /* nível liberado: o 1 sempre; os seguintes com 2 estrelas ou mais no anterior */
  function nivelLiberado(prog, cenId, n) { return n <= 1 || melhorEstrelas(prog, chaveSituacao(cenId, n - 1)) >= 2; }
  /* revisão espaçada: cada padrão volta depois de 1, 3 ou 7 dias (conforme as estrelas da última vez), num nível
     diferente do último jogado, para ver se o princípio se transfere para outro contexto */
  var DIA = 86400000;
  function revisoes(conteudo, prog, agora) {
    agora = agora || Date.now();
    var out = [];
    conteudo.CENARIOS.forEach(function (cen) {
      var ult = null;
      niveis(conteudo).forEach(function (nv) {
        var c = prog.cenarios[chaveSituacao(cen.id, nv.n)]; if (!c) return;
        c.historico.forEach(function (h) { if (h.concluidoEm && (!ult || h.concluidoEm > ult.em)) ult = { em: h.concluidoEm, n: nv.n, estrelas: h.estrelas || 0 }; });
      });
      if (!ult) return;
      var intervalo = ult.estrelas >= 3 ? 7 : ult.estrelas === 2 ? 3 : 1, vence = Date.parse(ult.em) + intervalo * DIA;
      if (vence > agora) return;
      var proximo = (ult.n % niveis(conteudo).length) + 1;
      out.push({ cenario: cen.id, nivel: proximo, desde: ult.em, estrelas: ult.estrelas, atraso: Math.floor((agora - vence) / DIA) });
    });
    return out.sort(function (a, b) { return a.estrelas - b.estrelas || b.atraso - a.atraso; });
  }
  /* sequência de dias seguidos até hoje (ou até ontem, se hoje ainda não jogou) */
  function sequenciaDias(dias, hoje) {
    var set = {}; (dias || []).forEach(function (d) { set[d] = 1; });
    var d = new Date(hoje + "T12:00:00Z"), n = 0;
    if (!set[hoje]) d = new Date(d.getTime() - DIA);
    while (set[d.toISOString().slice(0, 10)]) { n++; d = new Date(d.getTime() - DIA); }
    return n;
  }
  /* modo relâmpago: as decisões de golpe que dá para jogar isoladas (decisão 1 e, pelo caminho mais natural, a 2),
     em qualquer nível. A escolha é só do alvo: a altura e a intensidade usadas são as da primeira faixa ideal da opção */
  function poolRelampago(conteudo) {
    var pool = [];
    conteudo.CENARIOS.forEach(function (cen) {
      niveis(conteudo).forEach(function (nv) {
        var e0 = estadoInicial(cen, nv.variante);
        pool.push({ cenario: cen.id, nivel: nv.n, etapa: "d1", estado: e0 });
        cen.etapas.d1.opcoes.forEach(function (o) {
          var prox = o.proxima && cen.etapas[o.proxima];
          if (!prox || prox.tipo !== "golpe" || !o.resposta) return;
          var esc = escolhaPadrao(o); esc.opcao = o.id;
          var r = simular(conteudo, cen, e0, "d1", esc);
          pool.push({ cenario: cen.id, nivel: nv.n, etapa: o.proxima, estado: r.estadoFinal });
        });
      });
    });
    return pool;
  }
  function escolhaPadrao(opcao) {
    var f = Array.isArray(opcao.ideal) ? opcao.ideal[0] : (opcao.ideal || {});
    var a = (f.altura || ["media"]), i = (f.intensidade || ["firme"]);
    return { altura: a.indexOf("media") >= 0 ? "media" : a[0], intensidade: i.indexOf("firme") >= 0 ? "firme" : i[0] };
  }
  var PONTOS_NIVEL = { coerente: 3, inicio: 2, controle: 1, iniciativa: 1 };

  return {
    L: L, W: W, S: S, REDE: REDE, ALTURAS: ALTURAS, INTENSIDADES: INTENSIDADES, NOME_ALTURA: NOME_ALTURA, NOME_INTENSIDADE: NOME_INTENSIDADE, CHAVE: CHAVE,
    cobertura: cobertura, simular: simular, varianteOk: varianteOk, CATEGORIAS: CATEGORIAS, categoriaResposta: categoriaResposta, temResposta: temResposta, vooAtual: vooAtual, posicoesRecuperacao: posicoesRecuperacao, estadoInicial: estadoInicial, refazer: refazer, avaliarGolpe: avaliarGolpe, perfil: perfil,
    posEm: posEm, bolaEm: bolaEm, progressoVazio: progressoVazio, normalizar: normalizar, escolhaValida: escolhaValida, trilha: trilha,
    chaveSituacao: chaveSituacao, varianteDoNivel: varianteDoNivel, estrelas: estrelas, melhorEstrelas: melhorEstrelas, nivelLiberado: nivelLiberado,
    revisoes: revisoes, sequenciaDias: sequenciaDias, poolRelampago: poolRelampago, escolhaPadrao: escolhaPadrao, PONTOS_NIVEL: PONTOS_NIVEL,
  };
});
