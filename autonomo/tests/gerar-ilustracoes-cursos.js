/* Gera as ilustrações dos cursos da Academia Digital (mty/assets/cursos/*.svg).
   Estilo "transmissão": quadra em perspectiva (câmera alta atrás de você), trajetória da bola em arco 3D com a sombra
   no chão e a marca do quique, jogadores marcados no chão, chamadas numeradas e legenda. Mental: cartões editoriais.
   Sem figura humana desenhada (o golpe é mostrado com foto real; ver _cursos-mty.js).
   Rode: node tests/gerar-ilustracoes-cursos.js   (ou com --conferir para só checar se os arquivos estão em dia) */
const fs = require("fs"), path = require("path");
const DIR = path.join(__dirname, "../../mty/assets/cursos");
const C = {
  fundo: "#0C1D16", fundo2: "#12291F", texto: "#F3F7F4", suave: "#A9BBB1", fraco: "#6F857A", lima: "#E4F542", laranja: "#F07A2D",
  vermelho: "#FF6B57", azul: "#7FC4E8", ardosia: "#D5DED9", linha: "rgba(255,255,255,.92)", borda: "rgba(255,255,255,.08)",
};
const FONTE = "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, system-ui, sans-serif";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const n = (v) => Math.round(v * 10) / 10;
const pts = (a) => a.map((p) => n(p[0]) + "," + n(p[1])).join(" ");
const caminho = (a) => "M" + a.map((p) => n(p[0]) + " " + n(p[1])).join(" L");
function texto(x, y, t, o) {
  o = o || {};
  return '<text x="' + n(x) + '" y="' + n(y) + '" font-size="' + (o.tam || 15) + '" font-weight="' + (o.peso || 600) + '" fill="' + (o.cor || C.texto) + '"' +
    (o.esp ? ' letter-spacing="' + o.esp + '"' : "") + (o.meio ? ' text-anchor="middle"' : o.fim ? ' text-anchor="end"' : "") + ">" + esc(t) + "</text>";
}
function quebrar(t, max) {
  const out = []; let l = "";
  String(t).split(" ").forEach((p) => { if (l && (l + " " + p).length > max) { out.push(l); l = p; } else l = l ? l + " " + p : p; });
  if (l) out.push(l); return out;
}
const larg = (t, tam) => String(t).length * tam * 0.56; /* largura aproximada do texto em negrito */
function svg(w, h, corpo, titulo, defs) {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + " " + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="' + esc(titulo) + '" font-family="' + FONTE + '">' +
    "<title>" + esc(titulo) + "</title><defs>" +
    '<linearGradient id="gFundo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + C.fundo2 + '"/><stop offset="1" stop-color="' + C.fundo + '"/></linearGradient>' +
    '<clipPath id="cCartao"><rect width="' + w + '" height="' + h + '" rx="22"/></clipPath>' +
    '<filter id="fBrilho" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>' +
    (defs || "") + "</defs>" +
    '<g clip-path="url(#cCartao)"><rect width="' + w + '" height="' + h + '" fill="url(#gFundo)"/>' + corpo + "</g>" +
    '<rect x=".5" y=".5" width="' + (w - 1) + '" height="' + (h - 1) + '" rx="21.5" fill="none" stroke="' + C.borda + '"/></svg>\n';
}
function cabecalho(kicker, titulo, cor) {
  return '<rect x="28" y="30" width="22" height="3" rx="1.5" fill="' + (cor || C.lima) + '"/>' +
    texto(58, 36, kicker.toUpperCase(), { tam: 13, peso: 800, cor: cor || C.lima, esp: 1.6 }) + texto(28, 72, titulo, { tam: 27, peso: 800 });
}
/* legenda numerada embaixo: [número, cor, texto] */
function legenda(y0, itens, W) {
  let s = '<line x1="28" y1="' + y0 + '" x2="' + (W - 28) + '" y2="' + y0 + '" stroke="' + C.borda + '"/>', y = y0 + 22;
  itens.forEach(([num, cor, t]) => {
    const ls = quebrar(t, 50);
    s += '<circle cx="42" cy="' + (y + 7) + '" r="13" fill="' + cor + '"/>' + texto(42, y + 12, num, { tam: 14, peso: 800, cor: C.fundo, meio: true });
    ls.forEach((l, j) => { s += texto(68, y + 13 + j * 25, l, { tam: 19, peso: 500 }); });
    y += ls.length * 25 + 16;
  });
  return { s, y: y + 8 };
}

/* ── quadra em perspectiva ── */
const Lq = 11.885, Wq = 4.115, Wd = 5.485, Sq = 6.4;
function camera(o) {
  /* câmera alta e longe, atrás da sua linha de base (perspectiva suave, como na transmissão) */
  o = Object.assign({ W: 640, yCam: -Lq - 60, h: 35, F: 2131, topo: 126, yLonge: Lq + 3.5 }, o || {});
  const cx = o.W / 2, Y0 = o.topo - o.h * o.F / (o.yLonge - o.yCam), dRef = -Lq - o.yCam, lw = o.lw || 1;
  /* giro: câmera em diagonal (gira a quadra em torno do centro antes de projetar) */
  const g = o.giro || 0, cg = Math.cos(g), sg = Math.sin(g), rot = (x, y) => [x * cg - y * sg, x * sg + y * cg];
  const P = (x, y, z) => { const r = rot(x, y), d = r[1] - o.yCam; return [cx + r[0] * o.F / d, Y0 + (o.h - (z || 0)) * o.F / d]; };
  const esc1 = (y) => lw * dRef / (y - o.yCam); /* espessura: 1 (× lw) na sua linha de base, menor ao fundo */
  return Object.assign(o, { P, esc1, cx });
}
function chao(q, x1, y1, x2, y2) { return [q.P(x1, y1), q.P(x2, y1), q.P(x2, y2), q.P(x1, y2)]; }
function circuloChao(q, x, y, r) { const a = []; for (let i = 0; i < 28; i++) { const t = i / 28 * Math.PI * 2; a.push(q.P(x + r * Math.cos(t), y + r * Math.sin(t))); } return a; }
function quadraPerspectiva(q, yPerto) {
  const yP = yPerto == null ? -Lq - 3.5 : yPerto;
  let s = '<defs><linearGradient id="gFora" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#173B2B"/><stop offset="1" stop-color="#215440"/></linearGradient>' +
    '<linearGradient id="gQuadra" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2A684A"/><stop offset="1" stop-color="#358058"/></linearGradient>' +
    '<radialGradient id="gLuz" cx=".5" cy=".55" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".10"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
    '<pattern id="pRede" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="#fff" stroke-opacity=".22" stroke-width="1"/></pattern></defs>';
  s += '<rect width="' + q.W + '" height="' + n(q.P(0, q.yLonge)[1] + 2) + '" fill="#132F23"/>';
  s += '<polygon points="' + pts(chao(q, -Wd - 30, yP, Wd + 30, q.yLonge)) + '" fill="url(#gFora)"/>';
  s += '<polygon points="' + pts(chao(q, -Wd, -Lq, Wd, Lq)) + '" fill="url(#gQuadra)"/>';
  s += '<polygon points="' + pts(chao(q, -Wd - 30, yP, Wd + 30, q.yLonge)) + '" fill="url(#gLuz)"/>';
  const ln = (x1, y1, x2, y2, w) => { const A = q.P(x1, y1), B = q.P(x2, y2), e = (q.esc1(y1) + q.esc1(y2)) / 2;
    return '<line x1="' + n(A[0]) + '" y1="' + n(A[1]) + '" x2="' + n(B[0]) + '" y2="' + n(B[1]) + '" stroke="' + C.linha + '" stroke-width="' + n((w || 2.4) * e) + '" stroke-linecap="round"/>'; };
  /* linhas longas em pedaços, para a espessura acompanhar a profundidade */
  const longa = (x, y1, y2) => { let r = ""; const k = 6; for (let i = 0; i < k; i++) r += ln(x, y1 + (y2 - y1) * i / k, x, y1 + (y2 - y1) * (i + 1) / k); return r; };
  s += ln(-Wd, -Lq, Wd, -Lq, 3.2) + ln(-Wd, Lq, Wd, Lq, 3.2) + longa(-Wd, -Lq, Lq) + longa(Wd, -Lq, Lq) + longa(-Wq, -Lq, Lq) + longa(Wq, -Lq, Lq) +
    ln(-Wq, -Sq, Wq, -Sq) + ln(-Wq, Sq, Wq, Sq) + longa(0, -Sq, Sq) + ln(0, -Lq, 0, -Lq + 0.35, 3) + ln(0, Lq, 0, Lq - 0.35, 3);
  /* rede */
  const xp = Wd + 0.914, b1 = q.P(-xp, 0), b2 = q.P(xp, 0), t1 = q.P(-xp, 0, 1.07), tm = q.P(0, 0, 0.914), t2 = q.P(xp, 0, 1.07);
  s += '<polygon points="' + pts([b1, b2, t2, tm, t1]) + '" fill="rgba(10,25,18,.35)"/><polygon points="' + pts([b1, b2, t2, tm, t1]) + '" fill="url(#pRede)"/>';
  s += '<polyline points="' + pts([t1, tm, t2]) + '" fill="none" stroke="#fff" stroke-width="' + n(3 * q.esc1(0)) + '" stroke-linejoin="round"/>';
  s += '<line x1="' + n(b1[0]) + '" y1="' + n(b1[1]) + '" x2="' + n(t1[0]) + '" y2="' + n(t1[1]) + '" stroke="#0A1510" stroke-width="' + n(3.2 * q.esc1(0)) + '"/>' +
    '<line x1="' + n(b2[0]) + '" y1="' + n(b2[1]) + '" x2="' + n(t2[0]) + '" y2="' + n(t2[1]) + '" stroke="#0A1510" stroke-width="' + n(3.2 * q.esc1(0)) + '"/>';
  return s;
}
/* zona-alvo no chão com brilho */
let nZona = 0;
function zona(q, x1, y1, x2, y2, cor) {
  const id = "gZ" + (++nZona), c = cor || C.lima;
  return '<defs><radialGradient id="' + id + '" cx=".5" cy=".5" r=".7"><stop offset="0" stop-color="' + c + '" stop-opacity=".55"/><stop offset="1" stop-color="' + c + '" stop-opacity=".10"/></radialGradient></defs>' +
    '<polygon points="' + pts(chao(q, x1, y1, x2, y2)) + '" fill="url(#' + id + ')" stroke="' + c + '" stroke-opacity=".85" stroke-width="1.6" stroke-linejoin="round"/>';
}
function faixa(q, x1, y1, x2, y2, cor, op) { return '<polygon points="' + pts(chao(q, x1, y1, x2, y2)) + '" fill="' + cor + '" fill-opacity="' + (op || 0.32) + '"/>'; }
/* jogador: anel no chão e etiqueta (adversário em cima, com haste; você embaixo; ou ao lado, com pos "esq"/"dir") */
function jogador(q, x, y, rot, tipo, pos) {
  const voce = tipo !== "adv", cor = voce ? C.laranja : C.ardosia, base = q.P(x, y), e = q.esc1(y);
  const w = larg(rot, 13) + 18, ondeEt = pos || (voce ? "baixo" : "cima"), rx = 0.55 * q.F / (y - q.yCam);
  let s = '<polygon points="' + pts(circuloChao(q, x, y, 0.55)) + '" fill="' + cor + '" fill-opacity=".22" stroke="' + cor + '" stroke-width="' + n(2.2 * Math.max(0.6, e)) + '"/>' +
    '<circle cx="' + n(base[0]) + '" cy="' + n(base[1]) + '" r="' + n(3 * Math.max(0.6, e)) + '" fill="' + cor + '"/>';
  let tx = base[0], ty;
  if (ondeEt === "cima") { const alto = q.P(x, y, 1.1); ty = alto[1] - 10; s += '<line x1="' + n(base[0]) + '" y1="' + n(base[1]) + '" x2="' + n(alto[0]) + '" y2="' + n(alto[1]) + '" stroke="' + cor + '" stroke-opacity=".8" stroke-width="1.5"/>'; }
  else if (ondeEt === "baixo") ty = base[1] + 22;
  else { ty = base[1]; tx = base[0] + (ondeEt === "esq" ? -1 : 1) * (rx + 8 + w / 2); }
  return s + '<rect x="' + n(tx - w / 2) + '" y="' + n(ty - 11) + '" width="' + n(w) + '" height="22" rx="11" fill="' + cor + '"/>' +
    texto(tx, ty + 4.6, rot, { tam: 13, peso: 800, cor: voce ? "#fff" : C.fundo, meio: true, esp: 0.6 });
}
/* bola: trajetória 3D (sai na altura z1 e quica no chão), sombra no chão e marca do quique */
function bola(q, x1, y1, x2, y2, o) {
  o = Object.assign({ z1: 1, alt: 2.4, cor: C.lima, trac: false, quique: true, num: "" }, o || {});
  const ar = [], sombra = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t, z = o.z1 * (1 - t) + 4 * o.alt * t * (1 - t);
    ar.push(q.P(x, y, Math.max(0, z))); sombra.push(q.P(x, y, 0));
  }
  const e = q.esc1((y1 + y2) / 2), w = 3.4 * Math.max(0.7, e);
  let s = '<path d="' + caminho(sombra) + '" fill="none" stroke="#000" stroke-opacity=".16" stroke-width="' + n(w) + '" stroke-linecap="round"/>';
  s += '<path d="' + caminho(ar) + '" fill="none" stroke="' + o.cor + '" stroke-opacity=".35" stroke-width="' + n(w * 2.6) + '" stroke-linecap="round" filter="url(#fBrilho)"/>';
  s += '<path d="' + caminho(ar) + '" fill="none" stroke="' + o.cor + '" stroke-width="' + n(w) + '" stroke-linecap="round"' + (o.trac ? ' stroke-dasharray="' + n(w * 2.4) + " " + n(w * 2) + '"' : "") + "/>";
  const ini = q.P(x1, y1, o.z1);
  s += '<circle cx="' + n(ini[0]) + '" cy="' + n(ini[1]) + '" r="' + n(5 * Math.max(0.7, q.esc1(y1))) + '" fill="' + o.cor + '" stroke="#0C1D16" stroke-width="1.2"/>';
  if (o.quique) {
    const cq = q.P(x2, y2);
    s += '<polygon points="' + pts(circuloChao(q, x2, y2, 0.42)) + '" fill="' + o.cor + '" fill-opacity=".25" stroke="' + o.cor + '" stroke-width="1.8"/>' +
      '<circle cx="' + n(cq[0]) + '" cy="' + n(cq[1]) + '" r="2.6" fill="' + o.cor + '"/>';
    if (o.num) s += '<circle cx="' + n(cq[0]) + '" cy="' + n(cq[1] - 18) + '" r="10" fill="' + o.cor + '"/>' + texto(cq[0], cq[1] - 14, o.num, { tam: 11.5, peso: 800, cor: C.fundo, meio: true });
  }
  return s;
}
/* deslocamento no chão (seta tracejada) */
function anda(q, x1, y1, x2, y2, cor) {
  const A = q.P(x1, y1), B = q.P(x2, y2), ang = Math.atan2(B[1] - A[1], B[0] - A[0]), k = 9, c = cor || "#fff";
  return '<line x1="' + n(A[0]) + '" y1="' + n(A[1]) + '" x2="' + n(B[0]) + '" y2="' + n(B[1]) + '" stroke="' + c + '" stroke-width="2.2" stroke-dasharray="5 5" stroke-linecap="round"/>' +
    '<polygon points="' + pts([B, [B[0] - k * Math.cos(ang - 0.45), B[1] - k * Math.sin(ang - 0.45)], [B[0] - k * Math.cos(ang + 0.45), B[1] - k * Math.sin(ang + 0.45)]]) + '" fill="' + c + '"/>';
}
/* chamada: ponto no lugar + caixa com número e texto, ligada por uma linha fina */
function chamada(ancora, lx, ly, num, t, cor) {
  const c = cor || C.lima, w = larg(t, 15) + (num ? 42 : 22), x = Math.max(12, Math.min(lx, 628 - (larg(t, 15) + (num ? 42 : 22)))), y = ly;
  return '<line x1="' + n(ancora[0]) + '" y1="' + n(ancora[1]) + '" x2="' + n(x + (ancora[0] < x ? 0 : w)) + '" y2="' + n(y) + '" stroke="' + c + '" stroke-opacity=".8" stroke-width="1.3"/>' +
    '<circle cx="' + n(ancora[0]) + '" cy="' + n(ancora[1]) + '" r="3" fill="' + c + '"/>' +
    '<rect x="' + n(x) + '" y="' + n(y - 16) + '" width="' + n(w) + '" height="32" rx="16" fill="rgba(8,20,14,.9)" stroke="' + c + '" stroke-opacity=".6"/>' +
    (num ? '<circle cx="' + n(x + 17) + '" cy="' + n(y) + '" r="10.5" fill="' + c + '"/>' + texto(x + 17, y + 4.5, num, { tam: 12.5, peso: 800, cor: C.fundo, meio: true }) : "") +
    texto(x + (num ? 34 : 11), y + 5.2, t, { tam: 15, peso: 700 });
}
/* diagrama de quadra completo: cabeçalho, quadra, desenho e legenda */
function quadraSvg(kicker, titulo, desenhar, itens, opc) {
  nZona = 0;
  const q = camera(opc), W = q.W;
  const desenho = quadraPerspectiva(q) + desenhar(q);
  const baseQuadra = q.P(0, -Lq - 3.5)[1];
  const lg = legenda(baseQuadra + 18, itens, W);
  /* faixa escura atrás do cabeçalho, para o título ler bem sobre o fundo da quadra */
  const topo = '<rect width="' + W + '" height="92" fill="' + C.fundo2 + '"/><rect y="92" width="' + W + '" height="26" fill="url(#gSombraTopo)"/>';
  const defs = '<linearGradient id="gSombraTopo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + C.fundo2 + '"/><stop offset="1" stop-color="' + C.fundo2 + '" stop-opacity="0"/></linearGradient>';
  return svg(W, lg.y, desenho + topo + cabecalho(kicker, titulo) + lg.s, titulo, defs);
}

/* ── cartões do mental: linha do tempo editorial ── */
function passos(titulo, itens, o) {
  o = o || {};
  const W = 640; let y = 112;
  let s = cabecalho("Mental", titulo, C.azul);
  if (o.sub) { s += texto(28, 104, o.sub, { tam: 17, peso: 500, cor: C.suave }); y = 138; }
  const blocos = itens.map((it) => ({ it, ls: quebrar(it[1], 44) }));
  blocos.forEach(({ it, ls }, i) => {
    const h = 38 + ls.length * 24, cor = it[2] || C.lima, num = o.icone ? o.icone[i] : String(i + 1).padStart(2, "0");
    if (i < blocos.length - 1) s += '<line x1="56" y1="' + (y + 38) + '" x2="56" y2="' + (y + h + 16) + '" stroke="rgba(255,255,255,.14)" stroke-width="2"/>';
    s += '<circle cx="56" cy="' + (y + 16) + '" r="22" fill="' + C.fundo + '" stroke="' + cor + '" stroke-width="2.2"/>' + texto(56, y + 22, num, { tam: 16, peso: 800, cor, meio: true });
    s += texto(96, y + 16, it[0], { tam: 21, peso: 800 });
    ls.forEach((l, j) => { s += texto(96, y + 42 + j * 24, l, { tam: 18, peso: 500, cor: C.suave }); });
    if (it[3]) { const wc = larg(it[3], 13.5) + 20; s += '<rect x="' + n(W - 28 - wc) + '" y="' + (y - 1) + '" width="' + n(wc) + '" height="26" rx="13" fill="rgba(255,255,255,.08)"/>' + texto(W - 28 - 10, y + 17, it[3], { tam: 13.5, peso: 700, cor: C.texto, fim: true }); }
    y += h + 22;
  });
  return svg(W, y + 10, s, titulo);
}

const ARQ = {};
/* ── técnica (diagramas; o golpe em si vai com foto) ── */
ARQ["devolucao-posicoes"] = quadraSvg("Técnica · Devolução", "Onde ficar para devolver", (q) =>
  bola(q, 1.2, Lq + 0.6, -2.6, -Sq + 0.6, { z1: 2.8, alt: 0.6, cor: "#fff", trac: true }) +
  jogador(q, -2.2, -Lq - 1.4, "1º SAQUE", "", "esq") + jogador(q, -2.0, -Lq + 1.0, "2º SAQUE", "", "esq") + anda(q, -2.2, -Lq - 0.8, -2.05, -Lq + 0.4) +
  zona(q, -2.0, 7.6, 2.0, 10.8) + bola(q, -2.0, -Lq + 1.0, 0.2, 9.4, { alt: 2.6 }) + jogador(q, 1.2, Lq + 0.6, "ADV.", "adv") +
  chamada(q.P(0.2, 9.4), 410, 150, "3", "fundo e ao centro"), [
  ["1", C.laranja, "1º saque forte: atrás da linha de base, bloqueie com direção."],
  ["2", C.laranja, "2º saque: um passo para dentro da quadra, ataque cedo."],
  ["3", C.lima, "Split no contato do sacador; alvo da devolução: fundo e ao centro."]]);
ARQ["voleio-zona"] = quadraSvg("Técnica · Voleio", "A zona de voleio", (q) =>
  zona(q, -Wq, -Sq, Wq, -1.6, C.azul) + anda(q, 1.0, -Sq - 0.4, 0.8, -3.6) +
  bola(q, -1.5, Lq + 0.4, 0.6, -3.0, { z1: 1, alt: 1.3, cor: "#fff", trac: true, quique: false }) +
  jogador(q, 0.8, -3.4, "VOCÊ") + bola(q, 0.6, -3.0, -3.4, 6.8, { z1: 1.1, alt: 0.5 }) + jogador(q, -1.5, Lq + 0.4, "ADV.", "adv") +
  chamada(q.P(-3.0, -4.2), 24, 470, "1", "zona de voleio", C.azul), [
  ["1", C.azul, "Entre a linha de saque e a rede: é onde o voleio ganha o ponto."],
  ["2", C.laranja, "Split quando o adversário bate; depois, para a frente."],
  ["3", C.lima, "Voleio fechando o ângulo, curto e cruzado, nunca para trás."]]);
ARQ["approach-paralela"] = quadraSvg("Técnica · Aproximação", "Approach na paralela e split", (q) =>
  zona(q, 1.8, 7.2, Wq, 10.8) + bola(q, 2.6, -5.6, 3.2, 9.2, { z1: 1.1, alt: 1.6 }) + anda(q, 2.6, -5.0, 1.6, -2.6) +
  jogador(q, 2.6, -5.6, "CONTATO") + jogador(q, 1.4, -2.2, "SPLIT", "", "esq") + jogador(q, 2.6, Lq + 0.8, "ADV.", "adv") +
  chamada(q.P(3.2, 9.2), 60, 150, "1", "paralela, funda"), [
  ["1", C.lima, "Contato na subida da bola, direção paralela: fecha o ângulo da passada."],
  ["2", C.laranja, "O approach termina no split, já na zona de voleio, no lado da bola."]]);
ARQ["saque-lancamentos"] = (function () {
  /* vista de cima: você atrás da linha de base, a quadra para cima; onde a bola sobe e cai em cada saque */
  const W = 640, cx = 300, cy = 300;
  let s = cabecalho("Técnica · Saque", "Onde lançar a bola (destro)");
  s += texto(28, 98, "Visto de cima, com a quadra à frente. O círculo é a sua cabeça.", { tam: 16, peso: 500, cor: C.suave });
  const defs = '<linearGradient id="gPiso" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2E7050"/><stop offset="1" stop-color="#1D4A36"/></linearGradient>';
  s += '<rect x="28" y="122" width="' + (W - 56) + '" height="300" rx="18" fill="url(#gPiso)"/>';
  s += '<line x1="28" y1="268" x2="' + (W - 28) + '" y2="268" stroke="#fff" stroke-width="4"/><line x1="' + cx + '" y1="268" x2="' + cx + '" y2="256" stroke="#fff" stroke-width="4"/>' +
    texto(40, 288, "LINHA DE BASE", { tam: 11, peso: 800, cor: "rgba(255,255,255,.7)", esp: 1.2 });
  s += '<line x1="' + (cx - 60) + '" y1="168" x2="' + (cx - 60) + '" y2="140" stroke="' + C.lima + '" stroke-width="2.5"/><polygon points="' + (cx - 66) + ",144 " + (cx - 60) + ",134 " + (cx - 54) + ',144" fill="' + C.lima + '"/>' +
    texto(cx - 48, 151, "para a quadra", { tam: 14, peso: 700, cor: C.lima });
  /* pés (destro, de lado para a quadra) e cabeça */
  const sola = (x, y, ang, cor) => '<g transform="translate(' + x + " " + y + ") rotate(" + ang + ')"><path d="M0 -22 C9 -22 11 -10 10 -2 C9 8 8 19 0 20 C-8 19 -8 8 -8 -2 C-9 -10 -8 -22 0 -22Z" fill="' + cor + '"/></g>';
  s += sola(cx - 22, cy + 8, 60, C.ardosia) + sola(cx + 30, cy + 34, 80, C.laranja);
  s += '<circle cx="' + cx + '" cy="' + (cy + 10) + '" r="17" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="2" stroke-dasharray="4 3"/>';
  [["1", "Plano", cx + 28, cy - 44, C.lima, 400, 200], ["2", "Slice", cx + 70, cy - 6, C.azul, 440, 300], ["3", "Kick", cx - 4, cy + 4, C.laranja, 110, 230]].forEach(([k, r, x, y, c, lx, ly]) => {
    s += '<circle cx="' + x + '" cy="' + y + '" r="18" fill="' + c + '" fill-opacity=".28" filter="url(#fBrilho)"/><circle cx="' + x + '" cy="' + y + '" r="9" fill="' + c + '" stroke="#0C1D16" stroke-width="1.5"/>';
    s += chamada([x, y], lx, ly, k, r, c);
  });
  const lg = legenda(446, [["1", C.lima, "Plano: à frente do corpo e um pouco à direita, para bater de cima para baixo."], ["2", C.azul, "Slice: mais à direita, para a raquete passar pelo lado da bola."], ["3", C.laranja, "Kick: sobre a cabeça ou um pouco atrás, para escovar de baixo para cima."]], W);
  return svg(W, lg.y, s + lg.s, "Onde lançar a bola no saque plano, slice e kick", defs);
})();
ARQ["empunhaduras"] = (function () {
  const W = 640, cx = 190, cy = 250, r = 112;
  let s = cabecalho("Técnica · Empunhaduras", "O cabo visto de baixo (destro)");
  const defs = '<linearGradient id="gCabo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2B4A3C"/><stop offset="1" stop-color="#17302A"/></linearGradient>';
  const v = []; for (let i = 0; i < 8; i++) { const a = (-90 + 22.5 + i * 45) * Math.PI / 180; v.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  s += '<polygon points="' + pts(v.map((p) => [p[0] + 6, p[1] + 10])) + '" fill="#000" fill-opacity=".35" filter="url(#fBrilho)"/>';
  s += '<polygon points="' + pts(v) + '" fill="url(#gCabo)" stroke="rgba(255,255,255,.25)" stroke-width="2"/>';
  const cores = { 2: C.lima, 3: C.azul, 4: C.laranja };
  for (let i = 0; i < 8; i++) {
    const a = (-90 + i * 45) * Math.PI / 180, num = i + 1, c = cores[num], A = v[(i + 7) % 8], B = v[i];
    if (c) s += '<line x1="' + n(A[0]) + '" y1="' + n(A[1]) + '" x2="' + n(B[0]) + '" y2="' + n(B[1]) + '" stroke="' + c + '" stroke-width="7" stroke-linecap="round"/>';
    const px = cx + (r - 34) * Math.cos(a), py = cy + (r - 34) * Math.sin(a);
    s += '<circle cx="' + n(px) + '" cy="' + n(py) + '" r="15" fill="' + (c || "rgba(255,255,255,.07)") + '"/>' + texto(px, py + 5, String(num), { tam: 14, peso: 800, cor: c ? C.fundo : C.fraco, meio: true });
  }
  s += texto(cx, cy + 5, "cabo", { tam: 12, peso: 700, cor: C.fraco, meio: true, esp: 1 });
  s += texto(cx, cy - r - 18, "▲ face da raquete para cima", { tam: 14, peso: 700, cor: C.suave, meio: true });
  [["Continental", "face 2", "saque, voleio, smash e slice", C.lima], ["Eastern", "face 3", "contato à frente, na altura da cintura", C.azul], ["Semi-western", "face 4", "fundo moderno, com topspin", C.laranja]].forEach(([t, f, d, c], i) => {
    const y = 150 + i * 96;
    s += '<rect x="352" y="' + (y - 26) + '" width="4" height="56" rx="2" fill="' + c + '"/>' + texto(370, y - 6, f.toUpperCase(), { tam: 12.5, peso: 800, cor: c, esp: 1.2 }) +
      texto(370, y + 16, t, { tam: 21, peso: 800 });
    quebrar(d, 26).forEach((l, j) => { s += texto(370, y + 38 + j * 20, l, { tam: 15.5, peso: 500, cor: C.suave }); });
  });
  s += '<line x1="28" y1="430" x2="' + (W - 28) + '" y2="430" stroke="' + C.borda + '"/>' + texto(28, 462, "A base do dedo indicador e a palma apoiadas na face numerada.", { tam: 16, peso: 500, cor: C.suave });
  return svg(W, 488, s, "Empunhaduras continental, eastern e semi-western no cabo", defs);
})();
ARQ["apoios"] = (function () {
  const W = 640;
  let s = cabecalho("Técnica · Apoios", "Os quatro apoios no forehand (destro)");
  s += texto(28, 98, "Vistos de cima. A seta mostra a rede.", { tam: 16, peso: 500, cor: C.suave });
  /* sola do tênis: pé com ponta arredondada e travas */
  const sola = (x, y, ang, cor) => '<g transform="translate(' + x + " " + y + ") rotate(" + ang + ')"><path d="M0 -26 C11 -26 13 -12 12 -2 C11 9 9 22 0 24 C-9 22 -10 9 -10 -2 C-11 -12 -10 -26 0 -26Z" fill="' + cor + '"/>' +
    '<path d="M-6 -16 H6 M-7 -9 H7 M-7 -2 H7 M-6 12 H6" stroke="' + C.fundo + '" stroke-opacity=".35" stroke-width="2" stroke-linecap="round"/></g>';
  [["Aberto", "pressão de tempo, bola larga", [[-22, 2, 8], [26, 2, -8]]], ["Semiaberto", "troca de fundo de quadra", [[-16, 16, 30], [24, -10, 12]]], ["Quadrado", "com tempo, bola na cintura", [[-14, 28, 62], [20, -22, 62]]], ["Fechado", "bola baixa, slice, devolução", [[-4, 32, 80], [24, -26, 84]]]].forEach(([t, d, pes], i) => {
    const x0 = 28 + i * 148, cx = x0 + 66, cy = 210;
    s += '<rect x="' + x0 + '" y="122" width="134" height="258" rx="16" fill="rgba(255,255,255,.04)" stroke="' + C.borda + '"/>';
    s += '<line x1="' + cx + '" y1="160" x2="' + cx + '" y2="140" stroke="' + C.lima + '" stroke-width="2.5"/><polygon points="' + (cx - 6) + ",143 " + cx + ",133 " + (cx + 6) + ',143" fill="' + C.lima + '"/>';
    s += '<line x1="' + (x0 + 14) + '" y1="282" x2="' + (x0 + 120) + '" y2="282" stroke="rgba(255,255,255,.35)" stroke-width="2" stroke-dasharray="4 4"/>';
    pes.forEach(([dx, dy, ang], j) => { s += sola(cx + dx, cy + dy, ang, j === 0 ? C.ardosia : C.laranja); });
    s += texto(cx, 310, t, { tam: 17, peso: 800, meio: true });
    quebrar(d, 16).forEach((l, j) => { s += texto(cx, 332 + j * 17, l, { tam: 13.5, peso: 500, cor: C.suave, meio: true }); });
  });
  s += '<circle cx="36" cy="406" r="7" fill="' + C.ardosia + '"/>' + texto(50, 412, "pé esquerdo", { tam: 15, peso: 600, cor: C.suave }) +
    '<circle cx="170" cy="406" r="7" fill="' + C.laranja + '"/>' + texto(184, 412, "pé direito", { tam: 15, peso: 600, cor: C.suave });
  return svg(W, 434, s, "Os quatro apoios: aberto, semiaberto, quadrado e fechado");
})();

/* ── tática ── */
ARQ["tat-reconhecer"] = quadraSvg("Tática · Ler a bola", "Que bola você recebeu?", (q) =>
  faixa(q, -Wq, -Lq, Wq, -8.6, C.vermelho, 0.36) + faixa(q, -Wq, -8.6, Wq, -5.0, C.lima, 0.28) + faixa(q, -Wq, -5.0, Wq, -1.0, "#5BD08A", 0.34) +
  jogador(q, 0, -Lq - 1.2, "VOCÊ") + jogador(q, 0.4, Lq + 0.6, "ADV.", "adv") +
  chamada(q.P(Wq, -10.3), 470, 520, "1", "defesa", C.vermelho) + chamada(q.P(Wq, -6.8), 476, 420, "2", "neutra", C.lima) + chamada(q.P(Wq, -3.0), 476, 340, "3", "ataque", "#5BD08A"), [
  ["1", C.vermelho, "Defesa: funda ou você chegando correndo. Responda alta e funda, ou acelerada na cruzada."],
  ["2", C.lima, "Neutra: na cintura e você equilibrado. Fundo e ao centro, com margem."],
  ["3", "#5BD08A", "Ataque: curta ou lenta. Entre na quadra e acelere."]]);
ARQ["tat-neutra"] = quadraSvg("Tática · Bola neutra", "Fundo e ao centro", (q) =>
  zona(q, -2.1, 7.0, 2.1, 9.9) + bola(q, 1.4, -Lq - 0.6, 0, 8.6, { alt: 3.2 }) + jogador(q, 1.4, -Lq - 0.6, "VOCÊ") + jogador(q, 0.4, Lq + 0.8, "ADV.", "adv") +
  chamada(q.P(0, 8.6), 400, 150, "1", "2 m para dentro") + chamada(q.P(0.7, -1.5, 3.1), 400, 330, "2", "margem sobre a rede", C.azul), [
  ["1", C.lima, "Alvo grande: fundo e ao centro, dois metros para dentro das linhas."],
  ["2", C.azul, "Passe bem acima da rede. Nesta bola, não tente ganhar o ponto."]]);
ARQ["tat-ataque"] = quadraSvg("Tática · Bola de ataque", "Entre na quadra e acelere", (q) =>
  anda(q, 1.4, -Lq - 0.6, 1.6, -6.6) + zona(q, -Wq, 8.6, -2.3, Lq) + jogador(q, 1.6, -6.0, "VOCÊ") +
  bola(q, 1.6, -6.0, -3.3, 10.4, { z1: 1.2, alt: 1.5 }) + jogador(q, 1.2, Lq + 0.8, "ADV.", "adv") +
  chamada(q.P(1.5, -9.0), 420, 500, "1", "entre na quadra", "#fff") + chamada(q.P(-3.3, 10.4), 40, 150, "2", "perto da linha"), [
  ["1", "#fff", "A bola veio curta: avance e faça o contato entre a cintura e o peito."],
  ["2", C.lima, "Trajetória mais reta e alvo mais perto das linhas."]]);
ARQ["tat-defesa"] = quadraSvg("Tática · Bola de defesa", "Duas respostas", (q) =>
  jogador(q, -3.8, -Lq - 1.0, "VOCÊ") + bola(q, -3.8, -Lq - 1.0, 0.2, 10.2, { alt: 3.6, cor: C.azul }) + bola(q, -3.8, -Lq - 1.0, 3.6, 6.4, { alt: 1.5 }) +
  jogador(q, 1.6, 3.4, "ADV.", "adv") +
  chamada(q.P(0.2, 10.2), 380, 150, "1", "alta e funda", C.azul) + chamada(q.P(3.6, 6.4), 440, 250, "2", "acelerada cruzada"), [
  ["1", C.azul, "Alta e funda: ganha tempo para voltar ao centro."],
  ["2", C.lima, "Acelerada na cruzada: corta o ataque dele, que veio para a rede."],
  ["3", C.laranja, "A transição para o ataque é a bola seguinte, não esta."]]);
ARQ["tat-arma-converte"] = quadraSvg("Tática · Construção", "A bola que arma e a que converte", (q) =>
  zona(q, -3.2, 6.8, -0.8, 9.9) + zona(q, 2.4, 9.0, Wq, Lq, C.laranja) + bola(q, 1.2, -Lq - 0.4, -2.0, 8.4, { alt: 2.8, num: "1" }) +
  jogador(q, -2.4, Lq + 0.6, "ADV.", "adv") + bola(q, 0.4, -9.8, 3.4, 10.6, { z1: 1.2, alt: 1.6, cor: C.laranja, num: "2" }) +
  jogador(q, 0.4, -9.8, "VOCÊ"), [
  ["1", C.lima, "Arma: alvo de segurança, dois metros para dentro. Tira o adversário do lugar."],
  ["2", C.laranja, "Converte: na bola curta que vem, perto da linha, no espaço que abriu."]]);
ARQ["tat-ganhar-quadra"] = quadraSvg("Tática · Tempo", "Reduzir o tempo e ganhar a quadra", (q) =>
  anda(q, 0.4, -Lq - 1.0, 0.4, -9.8) + jogador(q, 0.4, -9.4, "VOCÊ") + zona(q, -2.0, 8.8, 2.4, Lq) + bola(q, 0.4, -9.4, 0.6, 10.4, { alt: 2.4 }) +
  anda(q, 0.6, Lq + 0.2, 0.6, Lq + 1.5) + jogador(q, 0.6, Lq + 1.8, "ADV.", "adv", "dir") +
  chamada(q.P(0.4, -10.6), 420, 520, "1", "você avança", "#fff") + chamada(q.P(0.6, Lq + 1.0), 440, 150, "2", "ele recua", C.ardosia), [
  ["1", "#fff", "Cada bola funda: você avança um metro e pega a próxima mais cedo."],
  ["2", C.ardosia, "Ele recua um metro e tem menos ângulo e menos tempo."]]);
ARQ["tat-direcao"] = quadraSvg("Tática · Direção", "Mudar a direção e virar a quadra", (q) =>
  bola(q, -2.6, Lq + 0.4, 3.0, -9.6, { z1: 1, alt: 2.2, cor: "#fff", trac: true }) + jogador(q, 3.2, -Lq - 0.6, "VOCÊ") +
  bola(q, 3.2, -Lq - 0.6, 3.4, 9.6, { alt: 2.2 }) + jogador(q, -2.6, Lq + 0.6, "ADV.", "adv") + zona(q, 2.4, 8.2, Wq, Lq) +
  chamada(q.P(0.8, -0.6, 2.0), 30, 410, "1", "veio cruzada", "#fff") + chamada(q.P(3.4, 9.6), 400, 140, "2", "paralela"), [
  ["1", "#fff", "A bola veio na cruzada, confortável: na cintura e você equilibrado."],
  ["2", C.lima, "Mude a direção para a paralela só com bola assim; vire a quadra com a bola que veio para o meio."]]);
ARQ["tat-negar-angulo"] = quadraSvg("Tática · Negar ângulo", "Funda ao centro", (q) =>
  zona(q, -1.4, 8.2, 1.4, 11.2) + bola(q, -0.8, -Lq - 0.6, 0, 9.6, { alt: 3.0 }) + jogador(q, -0.8, -Lq - 0.6, "VOCÊ") + jogador(q, 0, Lq + 0.6, "ADV.", "adv") +
  '<polygon points="' + pts([q.P(0, Lq + 0.4), q.P(-Wq - 1.2, -3.2), q.P(-Wq, -6.4)]) + '" fill="' + C.vermelho + '" fill-opacity=".16"/>' +
  '<polygon points="' + pts([q.P(0, Lq + 0.4), q.P(Wq + 1.2, -3.2), q.P(Wq, -6.4)]) + '" fill="' + C.vermelho + '" fill-opacity=".16"/>' +
  chamada(q.P(-Wq - 0.8, -4.2), 20, 330, "2", "sem ângulo", C.vermelho) + chamada(q.P(0, 9.6), 400, 150, "1", "centro, funda"), [
  ["1", C.lima, "Bola funda ao centro: ele bate de trás e do meio."],
  ["2", C.vermelho, "Do centro e de longe, os ângulos abertos ficam difíceis para ele."]]);
ARQ["tat-padrao"] = quadraSvg("Tática · Padrão", "2 a 4 bolas decididas antes", (q) =>
  jogador(q, 0.8, -Lq - 0.6, "VOCÊ") + bola(q, 0.8, -Lq - 0.6, -2.8, 9.0, { alt: 2.6, num: "1" }) + bola(q, 0.4, -Lq + 0.2, -3.4, 10.0, { alt: 2.6, num: "2", trac: true }) +
  bola(q, 0.6, -8.0, 3.4, 8.6, { z1: 1.2, alt: 1.6, cor: C.laranja, num: "3" }) + jogador(q, -3.0, Lq + 0.6, "ADV.", "adv"), [
  ["1", C.lima, "1 e 2: cruzadas fundas que tiram o adversário para o lado."],
  ["3", C.laranja, "3: com a quadra aberta, mude a direção para o espaço livre."]]);
ARQ["tat-margem"] = (function () {
  const W = 640, chaoY = 340, rede = 330;
  let s = cabecalho("Tática · Margem", "A bola funda nasce da altura");
  const defs = '<linearGradient id="gChao" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2E7050"/><stop offset="1" stop-color="#1B4433"/></linearGradient>' +
    '<pattern id="pRede2" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#0A1510"/><path d="M0 0L4 4M4 0L0 4" stroke="#fff" stroke-opacity=".3"/></pattern>';
  s += '<rect x="0" y="' + chaoY + '" width="' + W + '" height="60" fill="url(#gChao)"/><line x1="40" y1="' + chaoY + '" x2="' + (W - 30) + '" y2="' + chaoY + '" stroke="#fff" stroke-opacity=".9" stroke-width="2"/>';
  s += '<rect x="' + (rede - 3) + '" y="' + (chaoY - 46) + '" width="6" height="46" fill="url(#pRede2)"/><rect x="' + (rede - 3) + '" y="' + (chaoY - 48) + '" width="6" height="4" fill="#fff"/>';
  s += '<line x1="' + (rede + 14) + '" y1="' + (chaoY - 46) + '" x2="' + (rede + 14) + '" y2="' + (chaoY - 126) + '" stroke="' + C.suave + '" stroke-width="1.2" stroke-dasharray="3 3"/>' + texto(rede + 22, chaoY - 82, "1 a 2 m", { tam: 12, peso: 700, cor: C.suave });
  const arco = (x1, y1, cxq, cyq, x2, cor, trac) => '<path d="M' + x1 + " " + y1 + " Q" + cxq + " " + cyq + " " + x2 + " " + chaoY + '" fill="none" stroke="' + cor + '" stroke-opacity=".35" stroke-width="9" filter="url(#fBrilho)"/>' +
    '<path d="M' + x1 + " " + y1 + " Q" + cxq + " " + cyq + " " + x2 + " " + chaoY + '" fill="none" stroke="' + cor + '" stroke-width="3.5"' + (trac ? ' stroke-dasharray="9 7"' : "") + ' stroke-linecap="round"/>' +
    '<ellipse cx="' + x2 + '" cy="' + chaoY + '" rx="12" ry="4" fill="' + cor + '" fill-opacity=".35" stroke="' + cor + '" stroke-width="1.6"/>';
  s += arco(60, chaoY - 40, 330, chaoY - 330, 580, C.lima) + arco(60, chaoY - 40, 250, chaoY - 70, 410, C.vermelho, true);
  s += '<circle cx="60" cy="' + (chaoY - 40) + '" r="7" fill="' + C.lima + '" stroke="#0C1D16" stroke-width="1.4"/>';
  s += chamada([470, chaoY - 150], 430, 118, "1", "alta: cai funda") + chamada([400, chaoY - 14], 410, chaoY - 60, "2", "rasante: cai curta", C.vermelho);
  s += texto(40, chaoY + 26, "VOCÊ", { tam: 11.5, peso: 800, cor: C.suave, esp: 1 }) + texto(W - 30, chaoY + 26, "FUNDO DO OUTRO LADO", { tam: 11.5, peso: 800, cor: C.suave, fim: true, esp: 1 });
  const lg = legenda(chaoY + 60, [["1", C.lima, "Mire bem acima da rede: a bola passa com margem e cai perto do fundo."], ["2", C.vermelho, "Rasante: qualquer erro vai para a rede ou cai curta, no meio da quadra."]], W);
  return svg(W, lg.y, s + lg.s, "Margem: a bola alta sobre a rede cai funda; a rasante cai curta", defs);
})();

/* ── capas dos cursos (sem texto): quadra noturna de estádio em perspectiva baixa, com as trajetórias brilhando ── */
function capaSvg(cat) {
  nZona = 0;
  const W = 1600, H = 900, cor = { tecnica: C.laranja, tatica: C.lima, mental: C.azul, geral: C.lima }[cat];
  const q = camera({ W, yCam: -Lq - 24, h: 11, F: 2300, topo: 250, yLonge: Lq + 3.5, lw: 2.4, giro: -0.42 });
  let s = '<defs><radialGradient id="gCeu" cx=".5" cy="0" r="1"><stop offset="0" stop-color="#1F4A37"/><stop offset=".55" stop-color="#0B1712"/><stop offset="1" stop-color="#050907"/></radialGradient>' +
    '<radialGradient id="gHolofote" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="gTinta" cx=".5" cy=".62" r=".7"><stop offset="0" stop-color="' + cor + '" stop-opacity=".22"/><stop offset="1" stop-color="' + cor + '" stop-opacity="0"/></radialGradient>' +
    '<linearGradient id="gVinheta" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050907" stop-opacity=".2"/><stop offset=".7" stop-color="#050907" stop-opacity="0"/><stop offset="1" stop-color="#050907" stop-opacity=".75"/></linearGradient>' +
    '<filter id="fGrande" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter></defs>';
  s += '<rect width="' + W + '" height="' + H + '" fill="url(#gCeu)"/>';
  [[260, 40], [800, 10], [1340, 40]].forEach(([x, y]) => { s += '<ellipse cx="' + x + '" cy="' + y + '" rx="260" ry="150" fill="url(#gHolofote)"/>'; });
  s += '<rect y="120" width="' + W + '" height="190" fill="#0A1611"/><rect y="306" width="' + W + '" height="4" fill="#fff" fill-opacity=".06"/>';
  s += quadraPerspectiva(q, -Lq - 6).replace('<rect width="' + W + '" height="' + n(q.P(0, q.yLonge)[1] + 2) + '" fill="#132F23"/>', "");
  const arco = (x1, y1, x2, y2, alt, c, k) => bola(q, x1, y1, x2, y2, { alt, cor: c, z1: 1 }).replace(/stroke-width="([\d.]+)"/g, (m, v) => 'stroke-width="' + n(v * (k || 1)) + '"').replace('filter="url(#fBrilho)"', 'filter="url(#fGrande)"');
  if (cat === "tatica") s += zona(q, -3.2, 7.0, -0.8, 10.2) + zona(q, 2.2, 8.6, Wq, Lq, C.laranja) + arco(1.0, -Lq - 0.6, -2.0, 8.6, 2.2, C.lima, 1.6) + arco(0.4, -8.6, 3.2, 10.2, 1.3, C.laranja, 1.6) + arco(-2.6, Lq, 2.4, -9.0, 1.8, "#fff", 1.2);
  else if (cat === "mental") {
    const B = q.P(0, -2.2, 0); s += '<ellipse cx="' + n(B[0]) + '" cy="' + n(B[1]) + '" rx="34" ry="10" fill="#000" fill-opacity=".35"/>';
    [260, 190, 120].forEach((r, i) => { s += '<ellipse cx="' + n(B[0]) + '" cy="' + n(B[1] - 40) + '" rx="' + r + '" ry="' + n(r * 0.34) + '" fill="none" stroke="' + C.azul + '" stroke-opacity="' + (0.18 + i * 0.12) + '" stroke-width="3"/>'; });
    s += '<circle cx="' + n(B[0]) + '" cy="' + n(B[1] - 40) + '" r="70" fill="' + C.azul + '" fill-opacity=".25" filter="url(#fGrande)"/><circle cx="' + n(B[0]) + '" cy="' + n(B[1] - 40) + '" r="30" fill="' + C.lima + '" stroke="#0C1D16" stroke-width="3"/>' +
      '<path d="M' + n(B[0] - 22) + " " + n(B[1] - 60) + " Q" + n(B[0] + 6) + " " + n(B[1] - 40) + " " + n(B[0] - 22) + " " + n(B[1] - 20) + '" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="3"/>';
  } else s += arco(0.6, -Lq - 0.4, -1.2, 9.4, 2.4, cor, 1.8) + arco(-1.6, Lq, 2.8, -8.0, 1.7, "#fff", 1.1);
  s += '<rect width="' + W + '" height="' + H + '" fill="url(#gTinta)"/><rect width="' + W + '" height="' + H + '" fill="url(#gVinheta)"/>';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="Capa"><title>Capa</title>' +
    '<defs><filter id="fBrilho" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter></defs>' + s + "</svg>\n";
}
["tecnica", "tatica", "mental", "geral"].forEach((c) => { ARQ["capa-" + c] = capaSvg(c); });

/* ── mental ── */
ARQ["men-rotina"] = passos("A rotina de 20 segundos", [["Fechar o ponto", "Vire de costas para a rede e olhe para as cordas.", C.azul, "0–5 s"], ["Respirar", "Uma ou mais respirações lentas, pela barriga.", C.azul, "5–12 s"], ["Decidir", "Escolha a tática do próximo ponto e só então volte.", C.lima, "12–20 s"]], { sub: "Entre um ponto e outro, sempre na mesma ordem." });
ARQ["men-processo"] = passos("Foco no processo", [["Depois de cada ponto", "Nomeie uma coisa que você executou bem: o split, o alvo, a altura.", C.lima], ["Ganhou ou perdeu", "Não importa agora. O placar fica de fora; o processo fica dentro.", C.azul]], { sub: "O resultado é consequência do que você controla." });
ARQ["men-respirar"] = passos("Respirar entre os pontos", [["Primeira respiração", "Pela barriga, devagar, ombros soltos.", C.azul, "4 s"], ["Segunda respiração", "Solte o ar mais devagar do que puxou.", C.azul, "6 s"], ["Terceira respiração", "Só depois volte para o saque ou para a devolução.", C.lima, "6 s"]], { sub: "Três respirações baixam o ritmo do coração." });
ARQ["men-erros"] = passos("Voltar depois de erros", [["Bola difícil", "Erro forçado pelo adversário: tudo bem, siga o plano.", C.vermelho], ["Bola difícil", "Erro forçado de novo: o plano continua certo.", C.vermelho], ["Bola difícil", "Respire, mantenha a margem, não mude por impulso.", C.vermelho], ["Bola fácil", "Volte à rotina e execute com margem e alvo grande.", C.lima]], { icone: ["✕", "✕", "✕", "✓"], sub: "Separe o erro forçado do erro que dependia de você." });
ARQ["men-visualizar"] = passos("Visualização antes do treino", [["Feche os olhos", "Cinco minutos antes de entrar em quadra.", C.azul, "5 min"], ["Veja e sinta", "O som da bola, o toque na raquete, o alvo do outro lado.", C.azul], ["Execute na cabeça", "Os exercícios do dia, bem feitos, do começo ao fim.", C.lima]], { sub: "O cérebro ensaia o movimento antes do corpo." });
ARQ["men-checklist-saque"] = passos("Checklist antes do saque", [["Pés", "Posição dos pés na linha, peso equilibrado.", C.azul], ["Alvo", "Olhe para onde vai sacar.", C.azul], ["Respirar", "Uma respiração lenta.", C.azul], ["Visualizar", "A trajetória da bola até o alvo.", C.azul], ["Executar", "E só então sacar.", C.lima]], { sub: "O mesmo checklist em todos os saques, em treino e em jogo." });
ARQ["men-balanco"] = passos("O balanço depois do jogo", [["O que funcionou", "Decisões e golpes que deram certo.", C.lima], ["O que não funcionou", "Sem culpar ninguém, nem você.", C.vermelho], ["Por que os erros", "Foi decisão ou execução?", C.azul], ["O que treinar", "Um ou dois pontos para a próxima semana.", C.laranja]], { sub: "Dez minutos, no mesmo dia, por escrito." });

const conferir = process.argv.includes("--conferir");
fs.mkdirSync(DIR, { recursive: true });
let fora = [];
for (const [nome, conteudo] of Object.entries(ARQ)) {
  const f = path.join(DIR, nome + ".svg");
  if (conferir) { if (!fs.existsSync(f) || fs.readFileSync(f, "utf8") !== conteudo) fora.push(nome); }
  else fs.writeFileSync(f, conteudo);
}
/* arquivos que não são mais gerados (ex.: os bonecos antigos) */
const sobra = fs.readdirSync(DIR).filter((f) => f.endsWith(".svg") && !ARQ[f.replace(/\.svg$/, "")]);
if (conferir) fora = fora.concat(sobra); else sobra.forEach((f) => fs.unlinkSync(path.join(DIR, f)));
if (conferir && fora.length) { console.error("ilustrações fora de dia (rode node tests/gerar-ilustracoes-cursos.js): " + fora.join(", ")); process.exit(1); }
console.log((conferir ? "ilustrações dos cursos em dia: " : "geradas: ") + Object.keys(ARQ).length);
module.exports = { NOMES: Object.keys(ARQ) };
