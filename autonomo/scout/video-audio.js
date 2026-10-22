/* Leitura do áudio de um vídeo de partida, em partes, sem carregar o arquivo inteiro na memória · Tecnologia QuadraLab.
   O vídeo não sai do aparelho. Três caminhos, do mais leve ao mais universal:
   1) MP4 / MOV / M4V / 3GP (celulares): lê só a tabela de amostras (moov) e depois só os pedaços de áudio, um a um
      (File.slice), decodificando com WebCodecs (AudioDecoder) — serve para partidas de várias horas;
      PCM sem compressão (sowt/twos/lpcm, comum em câmeras) é lido direto, sem decodificador.
   2) Arquivo pequeno de outro formato: decodeAudioData do navegador.
   3) Qualquer outro formato (MKV, AVI, MTS, WMV, FLV, WebM grande…) ou navegador sem WebCodecs: ffmpeg no próprio navegador
      (invólucro em scout/vendor/ffmpeg, núcleo baixado só quando precisa), lendo o arquivo direto do disco (WORKERFS).
   Também gera, sob demanda, um clipe curto em MP4/H.264 quando o navegador não consegue exibir o vídeo original (ex.: HEVC).
   QLAudioVideo.energia(file, { janelaMs, aoProgresso(fracao, texto) }) → { e, dt, dur, via }
   QLAudioVideo.clipe(file, ini, dur) → Promise<Blob> · QLAudioVideo.parar() · QLAudioVideo.ehIsoBmff(file) · QLAudioVideo.lerTabelaAudio(buffer) (testes) */
(function (raiz, fab) {
  var api = fab(raiz);
  if (typeof module === "object" && module.exports) module.exports = api; else raiz.QLAudioVideo = api;
})(typeof window !== "undefined" ? window : this, function (raiz) {
  var BASE = (function () {
    try { var s = raiz.document && (raiz.document.currentScript || [].slice.call(raiz.document.scripts).filter(function (x) { return /video-audio\.js/.test(x.src); })[0]); return s ? s.src.replace(/[^\/]*$/, "") : "scout/"; } catch (e) { return "scout/"; }
  })();

  /* ── acumulador de energia em janelas, com o filtro passa-alta de antes (a = 0,95 a 48 kHz; mesmo corte em outras taxas) ── */
  function Acumulador(taxa, janelaMs) {
    var w = Math.max(1, Math.round(taxa * (janelaMs || 10) / 1000)), a = Math.pow(0.95, 48000 / taxa), px = 0, py = 0, soma = 0, n = 0, out = [];
    return {
      taxa: taxa, w: w,
      add: function (x, ini, fim) {
        for (var i = ini || 0, f = fim == null ? x.length : fim; i < f; i++) {
          var y = a * py + a * (x[i] - px); px = x[i]; py = y;
          soma += y * y; if (++n === w) { out.push(Math.sqrt(soma / w)); soma = 0; n = 0; }
        }
      },
      fim: function () { return { e: out, dt: w / taxa }; },
    };
  }

  /* ── ISO BMFF (MP4/MOV): caixas e tabela de amostras de áudio ── */
  function tipo4(dv, o) { return String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3)); }
  function u64(dv, o) { return dv.getUint32(o) * 4294967296 + dv.getUint32(o + 4); }
  async function lerFatia(file, ini, fim) { return await file.slice(ini, fim).arrayBuffer(); }
  async function ehIsoBmff(file) {
    if (file.size < 12) return false;
    var dv = new DataView(await lerFatia(file, 0, 12)), t = tipo4(dv, 4);
    return ["ftyp", "moov", "mdat", "wide", "free", "skip", "pnot"].indexOf(t) >= 0;
  }
  /* caixas de topo, lendo só os cabeçalhos (16 bytes cada) */
  async function caixasTopo(file) {
    var o = 0, lista = [];
    while (o + 8 <= file.size && lista.length < 10000) {
      var dv = new DataView(await lerFatia(file, o, Math.min(file.size, o + 16))), tam = dv.getUint32(0), t = tipo4(dv, 4), cab = 8;
      if (tam === 1) { tam = u64(dv, 8); cab = 16; } else if (tam === 0) tam = file.size - o;
      if (tam < cab) break;
      lista.push({ tipo: t, ini: o, tam: tam, cab: cab }); o += tam;
    }
    return lista;
  }
  var CONTEINERES = { moov: 1, trak: 1, mdia: 1, minf: 1, stbl: 1, edts: 1, dinf: 1 };
  function filhos(dv, ini, fim) {
    var o = ini, l = [];
    while (o + 8 <= fim) {
      var tam = dv.getUint32(o), t = tipo4(dv, o + 4), cab = 8;
      if (tam === 1) { tam = u64(dv, o + 8); cab = 16; } else if (tam === 0) tam = fim - o;
      if (tam < cab || o + tam > fim) break;
      l.push({ tipo: t, ini: o, cab: cab, fim: o + tam }); o += tam;
    }
    return l;
  }
  function acha(dv, ini, fim, caminho) {
    var atual = { ini: ini - 8, cab: 8, fim: fim };
    for (var k = 0; k < caminho.length; k++) {
      var f = filhos(dv, atual.ini + atual.cab, atual.fim).filter(function (c) { return c.tipo === caminho[k]; })[0];
      if (!f) return null; atual = f;
    }
    return atual;
  }
  /* busca uma caixa pelo tipo em qualquer profundidade dentro de [ini, fim) (esds pode estar dentro de "wave" no MOV) */
  function buscaFundo(dv, ini, fim, alvo) {
    for (var o = ini; o + 8 <= fim; o++) {
      if (tipo4(dv, o + 4) === alvo) { var tam = dv.getUint32(o); if (tam >= 8 && o + tam <= fim) return { ini: o, fim: o + tam }; }
    }
    return null;
  }
  function lerDescritor(dv, o) {
    var tag = dv.getUint8(o++), len = 0, b, k = 0;
    do { b = dv.getUint8(o++); len = (len << 7) | (b & 0x7f); k++; } while ((b & 0x80) && k < 4);
    return { tag: tag, ini: o, len: len };
  }
  function lerEsds(dv, ini, fim) {
    var o = ini + 12, d = lerDescritor(dv, o); if (d.tag !== 3) return null;
    o = d.ini + 2; var fl = dv.getUint8(o++);
    if (fl & 0x80) o += 2; if (fl & 0x40) o += 1 + dv.getUint8(o); if (fl & 0x20) o += 2;
    var dc = lerDescritor(dv, o); if (dc.tag !== 4) return null;
    var oti = dv.getUint8(dc.ini); o = dc.ini + 13;
    var asc = null;
    if (o < dc.ini + dc.len) { var ds = lerDescritor(dv, o); if (ds.tag === 5) asc = new Uint8Array(dv.buffer, dv.byteOffset + ds.ini, ds.len).slice(); }
    return { oti: oti, asc: asc };
  }
  /* devolve a tabela da trilha de áudio: codec, configuração e cada amostra (deslocamento, tamanho, tempo) */
  function lerTabelaAudio(buf) {
    var dv = new DataView(buf), trilhas = filhos(dv, 8, buf.byteLength).filter(function (c) { return c.tipo === "trak"; });
    for (var i = 0; i < trilhas.length; i++) {
      var tk = trilhas[i], ini = tk.ini + tk.cab, fim = tk.fim;
      var hdlr = acha(dv, ini, fim, ["mdia", "hdlr"]); if (!hdlr || tipo4(dv, hdlr.ini + hdlr.cab + 8) !== "soun") continue;
      var mdhd = acha(dv, ini, fim, ["mdia", "mdhd"]), v = dv.getUint8(mdhd.ini + mdhd.cab);
      var escala = v === 1 ? dv.getUint32(mdhd.ini + mdhd.cab + 20) : dv.getUint32(mdhd.ini + mdhd.cab + 12);
      var duracaoT = v === 1 ? u64(dv, mdhd.ini + mdhd.cab + 24) : dv.getUint32(mdhd.ini + mdhd.cab + 16);
      var stbl = ["mdia", "minf", "stbl"], st = function (n) { return acha(dv, ini, fim, stbl.concat([n])); };
      var stsd = st("stsd"), ent = stsd.ini + stsd.cab + 8, entFim = ent + dv.getUint32(ent), formato = tipo4(dv, ent + 4);
      var vSom = dv.getUint16(ent + 16), canais = dv.getUint16(ent + 24), bits = dv.getUint16(ent + 26), taxa = dv.getUint32(ent + 32) / 65536;
      var extra = vSom === 1 ? 16 : vSom === 2 ? 36 : 0;
      if (vSom === 2) { taxa = dv.getFloat64(ent + 40); canais = dv.getUint32(ent + 48); bits = dv.getUint32(ent + 56); }
      var cfg = { formato: formato, canais: canais, bits: bits, taxa: taxa || escala, escala: escala, dur: escala ? duracaoT / escala : 0, codec: null, descricao: null, pcm: null };
      if (formato === "mp4a") {
        var es = buscaFundo(dv, ent + 36 + extra, entFim, "esds"), info = es && lerEsds(dv, es.ini, es.fim);
        if (info && info.oti === 0x40 && info.asc) {
          var aot = info.asc[0] >> 3; if (aot === 31) aot = 32 + (((info.asc[0] & 7) << 3) | (info.asc[1] >> 5));
          cfg.codec = "mp4a.40." + aot; cfg.descricao = info.asc;
          var idx = ((info.asc[0] & 7) << 1) | (info.asc[1] >> 7), TAXAS = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
          if (TAXAS[idx]) cfg.taxa = TAXAS[idx];
          var cc = (info.asc[1] >> 3) & 15; if (cc > 0 && cc < 8) cfg.canais = cc;
        } else if (info && (info.oti === 0x69 || info.oti === 0x6b)) cfg.codec = "mp3";
      } else if (formato === "Opus") {
        var dops = buscaFundo(dv, ent + 36, entFim, "dOps");
        if (dops) {
          var p = dops.ini + 8, cab = new Uint8Array(19), cdv = new DataView(cab.buffer);
          "OpusHead".split("").forEach(function (ch, k) { cab[k] = ch.charCodeAt(0); });
          cab[8] = 1; cab[9] = dv.getUint8(p + 1); cdv.setUint16(10, dv.getUint16(p + 2), true); cdv.setUint32(12, dv.getUint32(p + 4), true);
          cdv.setInt16(16, dv.getInt16(p + 8), true); cab[18] = dv.getUint8(p + 10);
          cfg.codec = "opus"; cfg.descricao = cab; cfg.taxa = 48000; cfg.canais = dv.getUint8(p + 1);
        }
      } else if (formato === "sowt" || formato === "twos" || formato === "lpcm" || formato === "ipcm" || formato === "in24" || formato === "raw ") {
        var le = formato === "sowt" || formato === "raw ";
        if (formato === "ipcm") { var pc = buscaFundo(dv, ent + 36, entFim, "pcmC"); if (pc) { le = (dv.getUint8(pc.ini + 12) & 1) === 1; bits = dv.getUint8(pc.ini + 13); } }
        if (formato === "lpcm" && vSom === 2) { var fl = dv.getUint32(ent + 52); le = !(fl & 2); if (fl & 1) bits = -bits; }
        if (formato === "in24") bits = 24;
        if (formato === "raw ") bits = 8;
        cfg.pcm = { bits: bits || 16, le: le }; cfg.codec = "pcm";
      }
      // tabela de amostras
      var stsz = st("stsz"), stsc = st("stsc"), stco = st("stco") || st("co64"), stts = st("stts"), co64 = stco && tipo4(dv, stco.ini + 4) === "co64";
      if (!stsz && st("stz2")) return { cfg: cfg, erro: "tabela compacta (stz2) não suportada" };
      var tamUnico = dv.getUint32(stsz.ini + stsz.cab + 4), nAm = dv.getUint32(stsz.ini + stsz.cab + 8), k;
      /* PCM: cada "amostra" é um quadro de som (milhões numa partida) — lê-se o pedaço inteiro, sem tabela por amostra */
      var porQuadro = cfg.codec === "pcm" && tamUnico ? (tamUnico > 1 ? tamUnico : Math.max(1, (cfg.canais || 1) * Math.abs(cfg.pcm.bits) / 8)) : 0;
      var tams = porQuadro ? null : new Uint32Array(nAm); if (tams) for (k = 0; k < nAm; k++) tams[k] = tamUnico || dv.getUint32(stsz.ini + stsz.cab + 12 + 4 * k);
      var nCh = dv.getUint32(stco.ini + stco.cab + 4), offs = new Float64Array(nCh);
      for (k = 0; k < nCh; k++) offs[k] = co64 ? u64(dv, stco.ini + stco.cab + 8 + 8 * k) : dv.getUint32(stco.ini + stco.cab + 8 + 4 * k);
      var nSc = dv.getUint32(stsc.ini + stsc.cab + 4), sc = [];
      for (k = 0; k < nSc; k++) { var b0 = stsc.ini + stsc.cab + 8 + 12 * k; sc.push([dv.getUint32(b0), dv.getUint32(b0 + 4)]); }
      var nTs = dv.getUint32(stts.ini + stts.cab + 4), deltas = [];
      for (k = 0; k < nTs; k++) { var t0 = stts.ini + stts.cab + 8 + 8 * k; deltas.push([dv.getUint32(t0), dv.getUint32(t0 + 4)]); }
      /* pedaços (chunks): cada um é um bloco contíguo de amostras — é o que se lê do arquivo de uma vez */
      var pedacos = [], am = 0, di = 0, dRest = deltas.length ? deltas[0][0] : 0, tempo = 0, regra = 0;
      for (var c = 0; c < nCh && am < nAm; c++) {
        while (regra + 1 < sc.length && sc[regra + 1][0] <= c + 1) regra++;
        var spc = sc[regra][1], ped = { off: offs[c], amostras: [] }, o2 = 0;
        if (porQuadro) { var q = Math.min(spc, nAm - am); ped.amostras = null; ped.tam = q * porQuadro; am += q; pedacos.push(ped); continue; }
        for (var j = 0; j < spc && am < nAm; j++, am++) {
          ped.amostras.push({ rel: o2, tam: tams[am], t: tempo / escala }); o2 += tams[am];
          while (dRest === 0 && di < deltas.length - 1) { di++; dRest = deltas[di][0]; }
          tempo += deltas.length ? deltas[di][1] : 0; dRest--;
        }
        ped.tam = o2; pedacos.push(ped);
      }
      return { cfg: cfg, pedacos: pedacos, nAmostras: nAm };
    }
    return null;
  }

  /* trilha de vídeo do MP4/MOV, para decodificar só os trechos dos pontos com WebCodecs (VideoDecoder):
     codec + descrição (avcC/hvcC/av1C), tamanho e, por amostra, posição no arquivo, tamanho, tempos (decodificação/exibição) e quadro-chave */
  function hex2(n) { return (n < 16 ? "0" : "") + n.toString(16); }
  function codecVideo(dv, ent, entFim, formato) {
    var caixa = function (t) { return buscaFundo(dv, ent + 86, entFim, t); }, b, u8 = function (o) { return dv.getUint8(o); };
    if (formato === "avc1" || formato === "avc3") {
      b = caixa("avcC"); if (!b) return null;
      return { codec: formato + "." + hex2(u8(b.ini + 9)) + hex2(u8(b.ini + 10)) + hex2(u8(b.ini + 11)), descricao: new Uint8Array(dv.buffer, dv.byteOffset + b.ini + 8, b.fim - b.ini - 8).slice() };
    }
    if (formato === "hvc1" || formato === "hev1") {
      b = caixa("hvcC"); if (!b) return null;
      var o = b.ini + 8, x = u8(o + 1), esp = ["", "A", "B", "C"][x >> 6], tier = (x >> 5) & 1, perfil = x & 31, compat = dv.getUint32(o + 2), rev = 0;
      for (var i = 0; i < 32; i++) if (compat & (1 << i)) rev |= 1 << (31 - i);
      var restr = []; for (i = 0; i < 6; i++) restr.push(u8(o + 6 + i));
      while (restr.length && restr[restr.length - 1] === 0) restr.pop();
      return { codec: formato + "." + esp + perfil + "." + (rev >>> 0).toString(16) + "." + (tier ? "H" : "L") + u8(o + 12) + (restr.length ? "." + restr.map(function (v) { return v.toString(16); }).join(".") : ""), descricao: new Uint8Array(dv.buffer, dv.byteOffset + o, b.fim - o).slice() };
    }
    if (formato === "vp09") {
      b = caixa("vpcC"); if (!b) return { codec: "vp09.00.10.08" };
      var p0 = b.ini + 12, d2 = function (n) { return ("0" + n).slice(-2); };
      return { codec: "vp09." + d2(u8(p0)) + "." + d2(u8(p0 + 1)) + "." + d2(u8(p0 + 2) >> 4) };
    }
    if (formato === "av01") {
      b = caixa("av1C"); if (!b) return null;
      var y1 = u8(b.ini + 9), y2 = u8(b.ini + 10), prof = y1 >> 5, nivel = y1 & 31, t = (y2 >> 7) & 1, hb = (y2 >> 6) & 1, tw = (y2 >> 5) & 1;
      return { codec: "av01." + prof + "." + ("0" + nivel).slice(-2) + (t ? "H" : "M") + "." + (hb ? (tw ? "12" : "10") : "08"), descricao: new Uint8Array(dv.buffer, dv.byteOffset + b.ini + 8, b.fim - b.ini - 8).slice() };
    }
    return null;
  }
  function lerTabelaVideo(buf) {
    var dv = new DataView(buf), trilhas = filhos(dv, 8, buf.byteLength).filter(function (c) { return c.tipo === "trak"; });
    for (var i = 0; i < trilhas.length; i++) {
      var tk = trilhas[i], ini = tk.ini + tk.cab, fim = tk.fim;
      var hdlr = acha(dv, ini, fim, ["mdia", "hdlr"]); if (!hdlr || tipo4(dv, hdlr.ini + hdlr.cab + 8) !== "vide") continue;
      var mdhd = acha(dv, ini, fim, ["mdia", "mdhd"]), v = dv.getUint8(mdhd.ini + mdhd.cab);
      var escala = v === 1 ? dv.getUint32(mdhd.ini + mdhd.cab + 20) : dv.getUint32(mdhd.ini + mdhd.cab + 12);
      var stbl = ["mdia", "minf", "stbl"], st = function (n) { return acha(dv, ini, fim, stbl.concat([n])); };
      var stsd = st("stsd"), ent = stsd.ini + stsd.cab + 8, entFim = ent + dv.getUint32(ent), formato = tipo4(dv, ent + 4);
      var larg = dv.getUint16(ent + 32), alt = dv.getUint16(ent + 34), cod = codecVideo(dv, ent, entFim, formato);
      var tkhd = acha(dv, ini, fim, ["tkhd"]), rot = 0;
      if (tkhd) { var vt = dv.getUint8(tkhd.ini + tkhd.cab), mo = tkhd.ini + tkhd.cab + (vt === 1 ? 52 : 40), a = dv.getInt32(mo), b2 = dv.getInt32(mo + 4); rot = Math.round(Math.atan2(b2, a) * 180 / Math.PI); }
      var stsz = st("stsz"), stsc = st("stsc"), stco = st("stco") || st("co64"), stts = st("stts"), ctts = st("ctts"), stss = st("stss"), co64 = stco && tipo4(dv, stco.ini + 4) === "co64";
      if (!stsz || !stco) return { formato: formato, erro: "tabela de amostras ausente" };
      var tamUnico = dv.getUint32(stsz.ini + stsz.cab + 4), n = dv.getUint32(stsz.ini + stsz.cab + 8), k;
      var tam = new Uint32Array(n), off = new Float64Array(n), dts = new Float64Array(n), pts = new Float64Array(n), chave = new Uint8Array(n);
      for (k = 0; k < n; k++) tam[k] = tamUnico || dv.getUint32(stsz.ini + stsz.cab + 12 + 4 * k);
      var nCh = dv.getUint32(stco.ini + stco.cab + 4), nSc = dv.getUint32(stsc.ini + stsc.cab + 4), regra = 0, am = 0;
      for (var c = 0; c < nCh && am < n; c++) {
        while (regra + 1 < nSc && dv.getUint32(stsc.ini + stsc.cab + 8 + 12 * (regra + 1)) <= c + 1) regra++;
        var spc = dv.getUint32(stsc.ini + stsc.cab + 8 + 12 * regra + 4), o2 = co64 ? u64(dv, stco.ini + stco.cab + 8 + 8 * c) : dv.getUint32(stco.ini + stco.cab + 8 + 4 * c);
        for (var j = 0; j < spc && am < n; j++, am++) { off[am] = o2; o2 += tam[am]; }
      }
      var nTs = dv.getUint32(stts.ini + stts.cab + 4), tempo = 0; am = 0;
      for (k = 0; k < nTs; k++) { var cnt = dv.getUint32(stts.ini + stts.cab + 8 + 8 * k), dl = dv.getUint32(stts.ini + stts.cab + 12 + 8 * k); for (j = 0; j < cnt && am < n; j++, am++) { dts[am] = tempo / escala; tempo += dl; } }
      for (k = 0; k < n; k++) pts[k] = dts[k];
      if (ctts) {
        var vc = dv.getUint8(ctts.ini + ctts.cab), nCt = dv.getUint32(ctts.ini + ctts.cab + 4); am = 0;
        for (k = 0; k < nCt; k++) { var cc = dv.getUint32(ctts.ini + ctts.cab + 8 + 8 * k), co = vc === 1 ? dv.getInt32(ctts.ini + ctts.cab + 12 + 8 * k) : dv.getUint32(ctts.ini + ctts.cab + 12 + 8 * k); for (j = 0; j < cc && am < n; j++, am++) pts[am] = dts[am] + co / escala; }
        var menor = Infinity; for (k = 0; k < Math.min(n, 64); k++) menor = Math.min(menor, pts[k]); // edição implícita: o primeiro quadro exibido começa em 0
        if (menor > 0 && isFinite(menor)) for (k = 0; k < n; k++) pts[k] -= menor;
      }
      if (stss) { var nS = dv.getUint32(stss.ini + stss.cab + 4); for (k = 0; k < nS; k++) { var ix = dv.getUint32(stss.ini + stss.cab + 8 + 4 * k) - 1; if (ix >= 0 && ix < n) chave[ix] = 1; } }
      else for (k = 0; k < n; k++) chave[k] = 1;
      return { formato: formato, codec: cod && cod.codec, descricao: cod && cod.descricao, largura: larg, altura: alt, rotacao: rot, n: n, off: off, tam: tam, dts: dts, pts: pts, chave: chave };
    }
    return null;
  }
  async function tabelaVideo(file) {
    if (!(await ehIsoBmff(file))) return null;
    var topo = await caixasTopo(file), moov = topo.filter(function (c) { return c.tipo === "moov"; })[0];
    if (!moov || moov.tam > 400 * 1024 * 1024) return null;
    return lerTabelaVideo(await lerFatia(file, moov.ini, moov.ini + moov.tam));
  }

  /* ── caminho 1: MP4/MOV em partes ── */
  async function viaIsoBmff(file, o) {
    var topo = await caixasTopo(file), moov = topo.filter(function (c) { return c.tipo === "moov"; })[0];
    if (!moov) throw new Error("sem moov");
    if (moov.tam > 400 * 1024 * 1024) throw new Error("moov grande demais");
    var buf = await lerFatia(file, moov.ini, moov.ini + moov.tam), tab = lerTabelaAudio(buf);
    if (!tab) throw new Error("O vídeo não tem trilha de áudio — sem som não dá para separar os pontos.");
    if (tab.erro || !tab.cfg.codec || tab.cfg.codec === "mp3") throw new Error("codec " + (tab.cfg.formato || "?"));
    var cfg = tab.cfg, total = tab.pedacos.length, dur = cfg.dur, acc, decoder = null, erroDec = null, pend = 0;
    if (cfg.codec === "pcm") {
      acc = Acumulador(cfg.taxa, o.janelaMs);
    } else {
      if (typeof raiz.AudioDecoder === "undefined") throw new Error("sem WebCodecs");
      var conf = { codec: cfg.codec, sampleRate: cfg.taxa, numberOfChannels: cfg.canais || 1, description: cfg.descricao };
      var sup = await raiz.AudioDecoder.isConfigSupported(conf).catch(function () { return { supported: false }; });
      if (!sup.supported) throw new Error("codec não suportado aqui: " + cfg.codec);
      decoder = new raiz.AudioDecoder({
        output: function (ad) {
          try {
            if (!acc) acc = Acumulador(ad.sampleRate, o.janelaMs);
            var n = ad.numberOfFrames, x = new Float32Array(n);
            ad.copyTo(x, { planeIndex: 0, format: "f32-planar" }); acc.add(x);
          } catch (e) { erroDec = e; } finally { ad.close(); pend--; }
        },
        error: function (e) { erroDec = e; },
      });
      decoder.configure(conf);
    }
    /* lê os pedaços em lotes contíguos de até ~2 MB (pedaços vizinhos viram uma leitura só);
       o progresso e o cancelar são verificados a cada 256 amostras, não só a cada lote */
    var i = 0, ultimoAviso = 0, bytesTotal = 0, feito = 0, cont = 0;
    tab.pedacos.forEach(function (p) { bytesTotal += p.tam; });
    async function pausa() {
      while (decoder && decoder.decodeQueueSize > 400) await new Promise(function (r) { setTimeout(r, 2); });
      if (o.sinal && o.sinal.cancelado) throw new Error("cancelado");
      if (erroDec) throw erroDec;
      var fr = feito / (bytesTotal || 1);
      if (o.aoProgresso && fr - ultimoAviso > 0.004) { ultimoAviso = fr; o.aoProgresso(fr, "Lendo o som da partida… " + Math.round(fr * 100) + "%"); }
    }
    try {
    while (i < total) {
      var ini = tab.pedacos[i].off, j = i, fim = ini + tab.pedacos[i].tam;
      while (j + 1 < total && tab.pedacos[j + 1].off >= fim && tab.pedacos[j + 1].off + tab.pedacos[j + 1].tam - ini < 2 * 1024 * 1024 && tab.pedacos[j + 1].off - fim < 256 * 1024) { j++; fim = tab.pedacos[j].off + tab.pedacos[j].tam; }
      var bloco = new Uint8Array(await lerFatia(file, ini, fim));
      for (var k = i; k <= j; k++) {
        var ped = tab.pedacos[k], base = ped.off - ini;
        if (!ped.amostras) { acc.add(pcmParaFloat(bloco.subarray(base, base + ped.tam), cfg)); feito += ped.tam; continue; }
        for (var a = 0; a < ped.amostras.length; a++) {
          var s = ped.amostras[a], dados = bloco.subarray(base + s.rel, base + s.rel + s.tam);
          if (cfg.codec === "pcm") acc.add(pcmParaFloat(dados, cfg));
          else { pend++; decoder.decode(new raiz.EncodedAudioChunk({ type: "key", timestamp: Math.round(s.t * 1e6), data: dados })); }
          feito += s.tam;
          if (++cont % 256 === 0) await pausa();
        }
      }
      await pausa();
      i = j + 1;
    }
    if (decoder) { await decoder.flush(); if (erroDec) throw erroDec; }
    } finally { if (decoder && decoder.state !== "closed") try { decoder.close(); } catch (e) {} }
    if (!acc) throw new Error("nenhum áudio decodificado");
    var r = acc.fim(); r.dur = dur || r.e.length * r.dt; r.via = cfg.codec === "pcm" ? "pcm" : "webcodecs"; return r;
  }
  function pcmParaFloat(b, cfg) {
    var bits = Math.abs(cfg.pcm.bits), byt = bits / 8, ch = cfg.canais || 1, n = Math.floor(b.length / (byt * ch)), x = new Float32Array(n), dv = new DataView(b.buffer, b.byteOffset, b.byteLength), le = cfg.pcm.le;
    for (var i = 0; i < n; i++) {
      var o = i * byt * ch;
      if (cfg.pcm.bits < 0) x[i] = bits === 64 ? dv.getFloat64(o, le) : dv.getFloat32(o, le);
      else if (bits === 16) x[i] = dv.getInt16(o, le) / 32768;
      else if (bits === 24) { var v = le ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)) : ((b[o] << 16) | (b[o + 1] << 8) | b[o + 2]); if (v & 0x800000) v -= 0x1000000; x[i] = v / 8388608; }
      else if (bits === 32) x[i] = dv.getInt32(o, le) / 2147483648;
      else x[i] = (b[o] - 128) / 128;
    }
    return x;
  }

  /* ── caminho 2: arquivo pequeno, decodeAudioData ── */
  async function viaDecodeAudio(file, o) {
    if (o.aoProgresso) o.aoProgresso(0.1, "Lendo o som do vídeo…");
    var buf = await file.arrayBuffer(), Ctx = raiz.AudioContext || raiz.webkitAudioContext, ac = new Ctx(), ab;
    try { ab = await ac.decodeAudioData(buf); } finally { try { ac.close(); } catch (e) {} }
    var acc = Acumulador(ab.sampleRate, o.janelaMs); acc.add(ab.getChannelData(0));
    var r = acc.fim(); r.dur = ab.duration; r.via = "navegador"; return r;
  }

  /* ── caminho 3: ffmpeg no navegador (qualquer formato), lendo direto do disco ── */
  var ffPromessa = null;
  function carregarScript(src) {
    return new Promise(function (ok, falha) { var s = raiz.document.createElement("script"); s.src = src; s.onload = ok; s.onerror = function () { falha(new Error("não foi possível carregar " + src)); }; raiz.document.head.appendChild(s); });
  }
  /* o invólucro (ffmpeg.js + 814.ffmpeg.js, ~8 KB) fica no site porque o Worker precisa ser da mesma origem;
     o núcleo (~30 MB) vem de CDN, só quando um vídeo precisa dele, e fica no cache do navegador */
  var NUCLEOS = ["https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd/", "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd/"];
  function ffmpeg(aoProgresso) {
    if (!ffPromessa) ffPromessa = (async function () {
      if (aoProgresso) aoProgresso(0.02, "Preparando o leitor universal de vídeo (só na primeira vez, ~30 MB)…");
      if (!raiz.FFmpegWASM) await carregarScript(BASE + "vendor/ffmpeg/ffmpeg.js");
      var ultimo;
      for (var i = 0; i < NUCLEOS.length; i++) {
        var ff = new raiz.FFmpegWASM.FFmpeg();
        try { await ff.load({ coreURL: NUCLEOS[i] + "ffmpeg-core.js", wasmURL: NUCLEOS[i] + "ffmpeg-core.wasm" }); return ff; }
        catch (e) { ultimo = e; try { ff.terminate(); } catch (e2) {} }
      }
      throw new Error("não foi possível baixar o leitor universal (" + ((ultimo && ultimo.message) || ultimo) + ")");
    })().catch(function (e) { ffPromessa = null; throw e; });
    return ffPromessa;
  }
  var montado = null;
  /* interrompe o ffmpeg (cancelar): o Worker é encerrado e recriado na próxima vez */
  function parar() {
    var pr = ffPromessa; ffPromessa = null; montado = null;
    if (pr) pr.then(function (ff) { try { ff.terminate(); } catch (e) {} }, function () {});
  }
  async function montar(ff, file) {
    if (montado && montado.file === file) return montado.caminho;
    if (montado) { try { await ff.unmount("/in"); } catch (e) {} }
    try { await ff.createDir("/in"); } catch (e) {}
    await ff.mount("WORKERFS", { files: [file] }, "/in");
    montado = { file: file, caminho: "/in/" + file.name }; return montado.caminho;
  }
  function segundos(h, m, s) { return (+h) * 3600 + (+m) * 60 + parseFloat(s); }
  async function viaFfmpeg(file, o) {
    var ff = await ffmpeg(o.aoProgresso), caminho = await montar(ff, file), dur = 0;
    /* 8 kHz mono: as batidas da bola ficam bem abaixo de 4 kHz, e 3 horas de partida cabem em ~170 MB */
    var taxa = 8000, log = function (ev) {
      var m = /Duration: (\d+):(\d+):([\d.]+)/.exec(ev.message); if (m) dur = segundos(m[1], m[2], m[3]);
      var t = /time=(\d+):(\d+):([\d.]+)/.exec(ev.message);
      if (t && dur && o.aoProgresso) o.aoProgresso(Math.min(0.99, segundos(t[1], t[2], t[3]) / dur), "Lendo o som da partida (leitor universal)… " + Math.round(segundos(t[1], t[2], t[3]) / dur * 100) + "%");
    };
    ff.on("log", log);
    var vigia = setInterval(function () { if (o.sinal && o.sinal.cancelado) parar(); }, 250);
    try {
      var cod = await ff.exec(["-hide_banner", "-i", caminho, "-vn", "-ac", "1", "-ar", String(taxa), "-f", "s16le", "-acodec", "pcm_s16le", "/audio.pcm"]);
      var dados = await ff.readFile("/audio.pcm").catch(function () { return null; });
      if (!dados || !dados.length) throw new Error(cod ? "o vídeo não tem trilha de áudio ou o formato não pôde ser lido" : "sem áudio");
      try { await ff.deleteFile("/audio.pcm"); } catch (e) {}
      var amostras = new Int16Array(dados.buffer, dados.byteOffset, Math.floor(dados.byteLength / 2)), acc = Acumulador(taxa, o.janelaMs), lote = new Float32Array(65536);
      for (var i = 0; i < amostras.length; i += lote.length) {
        var n = Math.min(lote.length, amostras.length - i);
        for (var k = 0; k < n; k++) lote[k] = amostras[i + k] / 32768;
        acc.add(lote, 0, n);
      }
      var r = acc.fim(); r.dur = dur || amostras.length / taxa; r.via = "ffmpeg"; return r;
    } catch (e) { parar(); throw e; } finally { clearInterval(vigia); ff.off("log", log); }
  }

  /* ── escolha do caminho ── */
  async function energia(file, o) {
    o = o || {};
    var erros = [], cancelado = function () { return o.sinal && o.sinal.cancelado; };
    if (await ehIsoBmff(file)) {
      try { return await viaIsoBmff(file, o); } catch (e) { if (cancelado()) throw new Error("cancelado"); if (/não tem trilha/i.test(e.message)) throw e; erros.push("mp4: " + e.message); }
    }
    if (file.size < 300 * 1024 * 1024) {
      try { return await viaDecodeAudio(file, o); } catch (e) { erros.push("navegador: " + (e.message || e)); }
    }
    if (cancelado()) throw new Error("cancelado");
    try { return await viaFfmpeg(file, o); } catch (e) {
      if (cancelado()) throw new Error("cancelado");
      erros.push("ffmpeg: " + (e.message || e));
      throw new Error("não consegui ler o som deste vídeo (" + erros.join(" · ") + ").");
    }
  }

  /* clipe curto (360p) para rever um ponto quando o navegador não exibe o vídeo original:
     MP4/H.264 onde o navegador toca H.264 (quase todos); WebM/VP8 nos que não tocam */
  function tocaH264() { try { var v = raiz.document.createElement("video"); return !!v.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"'); } catch (e) { return true; } }
  async function clipe(file, ini, dur, op) {
    var ff = await ffmpeg(), caminho = await montar(ff, file), mp4 = tocaH264(), nome = mp4 ? "/clipe.mp4" : "/clipe.webm", alt = (op && op.altura) || 360;
    var cod = mp4 ? ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "30", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart"]
      : ["-c:v", "libvpx", "-deadline", "realtime", "-cpu-used", "8", "-b:v", "700k", "-c:a", "libvorbis", "-q:a", "3"]; // libopus quebra no ffmpeg.wasm 0.12
    try { await ff.exec(["-hide_banner", "-ss", String(Math.max(0, ini)), "-i", caminho, "-t", String(dur), "-vf", "scale=-2:" + alt].concat(cod, ["-y", nome])); }
    catch (e) { parar(); throw e; } // um erro dentro do ffmpeg deixa a instância inutilizável: a próxima chamada recria
    var d = await ff.readFile(nome).catch(function () { return null; }); try { await ff.deleteFile(nome); } catch (e) {}
    if (!d || !d.length) throw new Error("não foi possível converter este trecho");
    return new Blob([d], { type: mp4 ? "video/mp4" : "video/webm" });
  }

  /* um quadro (PNG) do vídeo, para a calibração quando o navegador não exibe o original (o codificador JPEG quebra no ffmpeg.wasm 0.12) */
  async function quadro(file, t) {
    var ff = await ffmpeg(), caminho = await montar(ff, file);
    try { await ff.exec(["-hide_banner", "-ss", String(Math.max(0, t)), "-i", caminho, "-frames:v", "1", "-an", "-vf", "scale=-2:720", "-c:v", "png", "-f", "image2", "-update", "1", "-y", "/quadro.png"]); } catch (e) { parar(); throw e; }
    var d = await ff.readFile("/quadro.png").catch(function () { return null; }); try { await ff.deleteFile("/quadro.png"); } catch (e) {}
    if (!d || !d.length) throw new Error("não foi possível tirar um quadro do vídeo");
    return new Blob([d], { type: "image/png" });
  }

  return { energia: energia, clipe: clipe, parar: parar, tabelaVideo: tabelaVideo, lerTabelaVideo: lerTabelaVideo, quadro: quadro, ehIsoBmff: ehIsoBmff, lerTabelaAudio: lerTabelaAudio, Acumulador: Acumulador };
});
