/* Simulador de partida de simples filmada de trás da quadra, para testar o scout automático (scout/video-scout.js).
   Gera o que a visão do navegador entregaria por trecho (batidas do áudio + quadros com pés, pose de 33 pontos, cor da roupa
   e candidatos a bola, com ruído, falhas e detecções falsas) e a verdade de cada ponto. Determinístico pela semente. */
const V = require("../scout/video-scout.js");
const P = V.Placar;

function gerador(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/* câmera: atrás da linha de base de baixo, elevada, olhando para o meio da quadra */
function camera(o) {
  const pos = o.pos || [0.4, -20.5, 6.2], alvo = o.alvo || [0, 1.5, 0], f = o.foco || 1.55, asp = o.aspecto || 16 / 9;
  const fw = norm(sub(alvo, pos)), dir = norm(cross(fw, [0, 0, 1])), up = cross(dir, fw);
  return { asp, proj(p) { const d = sub(p, pos), z = dot(d, fw); return [0.5 + 0.5 * f * dot(d, dir) / z / asp, 0.5 - 0.5 * f * dot(d, up) / z]; } };
}
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function norm(a) { const n = Math.hypot(a[0], a[1], a[2]); return [a[0] / n, a[1] / n, a[2] / n]; }

/* pose de 33 pontos (MediaPipe) de um jogador em pé em (x,y), virado para a rede; braço dominante conforme o golpe */
function pose(cam, x, y, perto, mao, braco, rnd, ruido) {
  const fw = perto ? 1 : -1, dir = [fw, 0], j = {}; // direita da pessoa: +x se olha para +y
  const P3 = (lat, frente, z) => [x + dir[0] * lat, y + fw * frente, z];
  j[0] = P3(0, 0.08, 1.7);
  for (let i = 1; i <= 10; i++) j[i] = P3((i % 2 ? -1 : 1) * 0.05, 0.06, 1.68);
  j[11] = P3(-0.21, 0, 1.45); j[12] = P3(0.21, 0, 1.45); j[23] = P3(-0.15, 0, 0.95); j[24] = P3(0.15, 0, 0.95);
  j[25] = P3(-0.16, 0.05, 0.5); j[26] = P3(0.16, 0.05, 0.5); j[27] = P3(-0.17, 0, 0.08); j[28] = P3(0.17, 0, 0.08);
  for (const [a, b] of [[29, 27], [31, 27], [30, 28], [32, 28]]) j[a] = [j[b][0], j[b][1] + fw * (a > 30 ? 0.12 : -0.04), 0.03];
  const dom = mao === "E" ? -1 : 1, livre = braco || { lat: 0.3, frente: 0.25, z: 1.0 };
  const wD = P3(dom * livre.lat, livre.frente, livre.z), wN = braco && braco.duasMaos ? P3(dom * livre.lat - dom * 0.08, livre.frente, livre.z - 0.05) : P3(-dom * 0.3, 0.2, 1.0);
  const iD = mao === "E" ? 15 : 16, iN = mao === "E" ? 16 : 15;
  j[iD] = wD; j[iN] = wN; j[iD - 2] = mid(j[iD + -4], wD); j[iN - 2] = mid(j[iN - 4], wN);
  for (const [a, b] of [[17, 15], [19, 15], [21, 15], [18, 16], [20, 16], [22, 16]]) j[a] = j[b];
  const out = [];
  for (let i = 0; i < 33; i++) { const p = cam.proj(j[i]); out.push({ x: p[0] + (rnd() - 0.5) * ruido, y: p[1] + (rnd() - 0.5) * ruido, z: 0, v: 0.9 }); }
  return out;
}
function mid(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; }

function simularPartida(o = {}) {
  const rnd = gerador(o.semente || 7), cam = camera(o), asp = cam.asp, fps = o.fps || 30;
  const cfg = { formato: o.formato || "1set", semVantagem: !!o.semVantagem, superTiebreakDecisivo: !!o.superTiebreakDecisivo };
  const maos = { nos: o.maoA || "D", ele: o.maoB || "D" }, cores = { nos: [200, 45, 40], ele: [40, 70, 190] };
  let e = P.inicial(cfg, o.saca || "nos"), ap = o.atletaComecaPerto !== false, t = o.inicio != null ? o.inicio : 30;
  const segs = [], verdade = [], pontosV = [];
  const S = V.QUADRA, MS = S.larguraSimples / 2, L = S.comprimento / 2;
  const maxPontos = o.maxPontos || 400;
  const ruidoPose = o.ruidoPose == null ? 0.004 : o.ruidoPose, falhaBola = o.falhaBola == null ? 0.2 : o.falhaBola, falsos = o.falsos == null ? 2 : o.falsos;
  const lado = (quem) => (quem === "nos" ? ap : !ap) ? "perto" : "longe";
  while (!e.fim && pontosV.length < maxPontos) {
    const sac = P.quemSaca(e), rec = sac === "nos" ? "ele" : "nos", ld = P.lado(e);
    let tentativa = 1, resultado = null;
    while (!resultado) {
      /* um trecho = um saque (e o rali, se a bola entrou) */
      const bats = [], seg = { hits: [], quadros: [] }, posIni = {};
      const sacPerto = lado(sac) === "perto", sgn = sacPerto ? -1 : 1;
      const dirSac = sacPerto ? 1 : -1; // direita de quem saca em +x quando está perto
      const xs = (ld === "D" ? 1 : -1) * dirSac * (0.5 + rnd() * 0.6);
      posIni[sac] = [xs, sgn * (L + 0.4)];
      posIni[rec] = [-(ld === "D" ? 1 : -1) * dirSac * (2.8 + rnd() * 0.8), -sgn * (L + 0.6)];
      /* o saque */
      const entra = tentativa === 1 ? rnd() < 0.62 : rnd() < 0.9;
      const ace = entra && rnd() < 0.07;
      const ds = ["aberto", "fechado", "corpo"][Math.floor(rnd() * 3)];
      const ux = ds === "aberto" ? 0.8 : ds === "fechado" ? 0.12 : 0.47, xb0 = -Math.sign(xs) * ux * MS;
      let alvo = entra ? [xb0, -sgn * (4.2 + rnd() * 1.8)] : (rnd() < 0.5 ? [xb0, -sgn * (S.linhaSaque + 0.6 + rnd() * 1.2)] : [-Math.sign(xs) * (MS + 0.5 + rnd()), -sgn * (4 + rnd() * 2)]);
      let rede = !entra && rnd() < 0.35;
      bats.push({ quem: sac, golpe: "saque", t: 0, de: [xs, sgn * (L + 0.3)], z: 2.75, alvo: rede ? [xb0 * 0.4, sgn * 1.5] : alvo, dur: 0.62 + rnd() * 0.12, direcao: null, ds });
      let fimTipo = null, venc = null;
      if (!entra) { fimTipo = "falta"; }
      else if (ace) { fimTipo = "ace"; venc = sac; }
      else {
        /* rali */
        let quem = rec, n = 1;
        while (true) {
          const ant = bats[bats.length - 1], perto = lado(quem) === "perto", s2 = perto ? -1 : 1;
          const tC = ant.t + ant.dur + 0.45 + rnd() * 0.2; // quique + subida até o contato
          let de = [ant.alvo[0] + (rnd() - 0.5) * 0.6, s2 * (Math.abs(ant.alvo[1]) + 2.2 + rnd() * 1.5)];
          const sobe = n > 2 && rnd() < 0.08; // subiu à rede: voleio sem quique
          if (sobe) de = [ant.alvo[0] * 0.6, s2 * (3 + rnd() * 1.5)];
          de[1] = Math.max(-L - 3, Math.min(L + 3, de[1]));
          const smash = sobe && rnd() < 0.3;
          const fh = rnd() < 0.58, efeito = sobe ? null : ["top", "top", "slice", "flat"][Math.floor(rnd() * 4)];
          const golpe = smash ? "smash" : sobe ? "voleio" : (fh ? "forehand" : "backhand");
          const termina = rnd() < 0.27 || n > 16;
          const dirOp = ["cruzado", "paralelo", "cruzado", "centro"][Math.floor(rnd() * 4)];
          const xd = dirOp === "centro" ? (rnd() - 0.5) * 1.2 : (dirOp === "cruzado" ? -Math.sign(de[0] || 1) : Math.sign(de[0] || 1)) * (2.2 + rnd() * 1.6);
          let al = [Math.max(-MS + 0.3, Math.min(MS - 0.3, xd)), -s2 * (7.5 + rnd() * 3.5)], tipoFim = null;
          if (termina) {
            const winner = rnd() < 0.36;
            if (winner) { tipoFim = "winner"; venc = quem; }
            else {
              tipoFim = rnd() < 0.5 ? "rede" : "fora"; venc = quem === "nos" ? "ele" : "nos";
              if (tipoFim === "fora") al = rnd() < 0.5 ? [Math.sign(xd || 1) * (MS + 0.6 + rnd()), al[1]] : [al[0], -s2 * (L + 0.7 + rnd() * 1.5)];
            }
          }
          bats.push({ quem, golpe, t: tC, de, z: smash ? 2.6 : sobe ? 1.3 : 0.95, alvo: tipoFim === "rede" ? [al[0] * 0.5, s2 * 0.2] : al, dur: smash ? 0.5 : 0.8 + rnd() * 0.3, efeito, direcao: Math.abs(de[0]) < 0.8 ? null : dirOp, sobe, fim: tipoFim });
          if (termina) { fimTipo = tipoFim; break; }
          quem = quem === "nos" ? "ele" : "nos"; n++;
        }
      }
      /* tempo absoluto + áudio */
      bats.forEach((b) => { b.T = t + b.t; });
      seg.hits = bats.map((b) => b.T + (rnd() - 0.5) * 0.02);
      if (o.batidaExtra && rnd() < o.batidaExtra) seg.hits.splice(1 + Math.floor(rnd() * seg.hits.length), 0, seg.hits[0] + 0.3 + rnd() * (seg.hits[seg.hits.length - 1] - seg.hits[0]));
      seg.hits.sort((a, b) => a - b);
      const tFim = bats[bats.length - 1].T + 2.4;
      seg.ini = bats[0].T - 2; seg.fim = tFim;
      /* posição dos jogadores ao longo do tempo: vão até onde batem */
      const traj = { nos: [], ele: [] };
      ["nos", "ele"].forEach((q) => { traj[q].push([seg.ini, posIni[q][0], posIni[q][1]]); });
      bats.forEach((b) => { traj[b.quem].push([b.T, b.de[0], b.de[1]]); });
      ["nos", "ele"].forEach((q) => { const u = traj[q][traj[q].length - 1]; traj[q].push([tFim, u[1] * 0.7, u[2]]); });
      const ondeEsta = (q, tt) => { const l = traj[q]; for (let i = 1; i < l.length; i++) if (tt <= l[i][0]) { const a = l[i - 1], b = l[i], f = (tt - a[0]) / Math.max(1e-6, b[0] - a[0]); return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]; } const u = l[l.length - 1]; return [u[1], u[2]]; };
      /* bola em 3D: o efeito muda a aceleração vertical (top spin cai mais rápido, slice flutua) */
      const aEf = (b) => b.efeito === "top" ? 9.81 + 5 : b.efeito === "slice" ? 9.81 - 3.5 : 9.81;
      const bola = (tt) => {
        for (let i = bats.length - 1; i >= 0; i--) {
          const b = bats[i]; if (tt < b.T) continue;
          const u = tt - b.T, T1 = b.dur, g = aEf(b), z0 = b.z, vz = (g * T1 * T1 / 2 - z0) / T1;
          const vx = (b.alvo[0] - b.de[0]) / T1, vy = (b.alvo[1] - b.de[1]) / T1;
          if (b.fim === "rede" && u > T1) return null;
          if (u <= T1) return [b.de[0] + vx * u, b.de[1] + vy * u, z0 + vz * u - g * u * u / 2];
          const w = u - T1, vz2 = -0.68 * (vz - g * T1);
          const z = vz2 * w - g * w * w / 2; if (z < 0 && w > 0.2) return null;
          return [b.alvo[0] + vx * 0.8 * w, b.alvo[1] + vy * 0.8 * w, Math.max(0, z)];
        }
        return null;
      };
      /* braço de quem bate perto do contato */
      const braco = (q, tt) => {
        const b = bats.filter((x) => x.quem === q && Math.abs(tt - x.T) < 0.3)[0]; if (!b) return null;
        const u = (tt - b.T) / 0.16;
        if (b.golpe === "saque" || b.golpe === "smash") return { lat: 0.25, frente: 0.3, z: 2.0 + 0.5 * Math.max(0, 1 - Math.abs(u)) };
        if (b.golpe === "voleio") return { lat: b.de[0] > 0 ? 0.55 : -0.55, frente: 0.5, z: 1.25 };
        const ini = b.efeito === "top" ? 0.55 : b.efeito === "slice" ? 1.45 : 0.95, fim = b.efeito === "top" ? 1.65 : b.efeito === "slice" ? 0.65 : 1.05;
        const z = ini + (fim - ini) * Math.max(0, Math.min(1, (u + 1) / 2));
        const lat = b.golpe === "forehand" ? 0.62 : -0.58;
        return { lat, frente: 0.45, z, duasMaos: b.golpe === "backhand" && rnd() < 0.5 };
      };
      for (let tt = seg.ini; tt <= tFim; tt += 1 / fps) {
        const q = { t: Math.round(tt * 1000) / 1000, jog: [], bolas: [] };
        ["nos", "ele"].forEach((qq) => {
          const pos = ondeEsta(qq, tt), perto = lado(qq) === "perto";
          const temPose = rnd() > (perto ? 0.05 : 0.18);
          const pe = cam.proj([pos[0], pos[1], 0]);
          q.jog.push({ pe: [pe[0] + (rnd() - 0.5) * 0.004, pe[1] + (rnd() - 0.5) * 0.004], lm: temPose ? pose(cam, pos[0], pos[1], perto, maos[qq], braco(qq, tt), rnd, perto ? ruidoPose : ruidoPose * 0.6) : null,
            cor: cores[qq].map((c) => c + (rnd() - 0.5) * 30) });
        });
        if (rnd() < 0.5) q.jog.reverse();
        const b3 = bola(tt);
        if (b3 && rnd() > falhaBola) { const p = cam.proj(b3); if (p[0] > 0 && p[0] < 1 && p[1] > 0 && p[1] < 1) q.bolas.push([p[0] + (rnd() - 0.5) * 0.002, p[1] + (rnd() - 0.5) * 0.002]); }
        for (let k = 0; k < falsos; k++) if (rnd() < 0.5) q.bolas.push([rnd(), 0.2 + rnd() * 0.75]);
        seg.quadros.push(q);
      }
      segs.push(seg);
      const v = { papel: fimTipo === "falta" ? "falta" : "ponto", sacador: sac, lado: ld, nHits: bats.length, dirSaque: ds, entra,
        batidas: bats.map((b) => ({ quem: b.quem, golpe: b.golpe, efeito: b.efeito || null, direcao: b.direcao || null, corrida: false, alvo: b.alvo, fim: b.fim || null,
          vel: (() => { const T1 = b.dur, d = Math.hypot(b.alvo[0] - b.de[0], b.alvo[1] - b.de[1]), vz = (aEf(b) * T1 * T1 / 2 - b.z) / T1; return Math.round(Math.hypot(d / T1, vz) * 3.6); })() })) };
      t = tFim + (o.pausaFalta != null ? o.pausaFalta : 6 + rnd() * 10);
      if (fimTipo === "falta") {
        if (tentativa === 2) { venc = rec; v.papel = "ponto"; v.saque = "df"; resultado = { venc, saque: "df" }; }
        else { tentativa = 2; verdade.push(v); continue; }
      } else {
        v.saque = fimTipo === "ace" ? "ace" : String(tentativa); resultado = { venc, saque: v.saque, fimTipo };
      }
      v.nos = venc === "nos"; v.fimTipo = fimTipo; v.ultimo = bats[bats.length - 1].quem;
      verdade.push(v);
    }
    const ant = e; e = P.aplicar(e, resultado.venc === "nos"); if (P.trocaLado(ant, e)) ap = !ap;
    pontosV.push(verdade[verdade.length - 1]);
    t += o.pausaPonto != null ? o.pausaPonto : 12;
  }
  /* cantos da quadra de duplas na imagem (como o treinador tocaria) */
  const W = S.larguraDuplas / 2, cantos = [[-W, -L], [W, -L], [W, L], [-W, L]].map((c) => cam.proj([c[0], c[1], 0]));
  return { cantos, aspecto: asp, segmentos: segs, verdade, pontos: pontosV, placar: e, cores, cfg };
}
module.exports = { simularPartida, camera };
