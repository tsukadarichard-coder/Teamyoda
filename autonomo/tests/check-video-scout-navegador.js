/* Scout automático de ponta a ponta no navegador: vídeo sintético (quadra, jogadores, bola, som das batidas — gerado pelo
   simulador), envio, detecção dos pontos pelo som, calibração tocando nos 4 cantos e nos dois jogadores, leitura dos quadros
   (WebCodecs, VP9), bola achada nos pixels, placar reconstruído, edição de um ponto e gravação como scout do caderno.
   A pose vem do simulador (o modelo MediaPipe não é baixado no teste). Precisa de ffmpeg e Python com Pillow.
   Rode: node tests/check-video-scout-navegador.js [pasta-das-capturas] */
const fs = require("fs"), path = require("path"), http = require("http"), os = require("os"), cp = require("child_process"), assert = require("assert");
try { cp.execSync("ffmpeg -version && python3 -c 'import PIL'", { stdio: "ignore" }); } catch (e) { console.log("check-video-scout-navegador: pulado (sem ffmpeg ou Pillow)"); process.exit(0); }
const raiz = path.join(__dirname, ".."), pasta = fs.mkdtempSync(path.join(os.tmpdir(), "qlscout-")), video = path.join(pasta, "partida.mp4"), capturas = process.argv[2] || "";
cp.execFileSync("node", [path.join(__dirname, "gerar-video-sintetico.js"), video, JSON.stringify({ maxPontos: 10, semente: 5, panoramica: !!process.env.PANORAMICA })], { stdio: "ignore" });
const D = JSON.parse(fs.readFileSync(video.replace(/\.mp4$/, ".json"), "utf8"));
/* AVI=1: o mesmo jogo num formato que o navegador não lê (tudo passa pelo ffmpeg no aparelho: quadro, som e clipes dos pontos) */
const CORE = process.env.FFMPEG_CORE_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/npmv/x/ffmpeg-core-0.12.10/package/dist/umd";
let arquivo = video;
if (process.env.AVI) {
  if (!fs.existsSync(path.join(CORE, "ffmpeg-core.wasm"))) { console.log("check-video-scout-navegador (AVI): pulado (defina FFMPEG_CORE_DIR)"); process.exit(0); }
  arquivo = video.replace(/\.mp4$/, ".avi"); cp.execSync(`ffmpeg -v error -y -i "${video}" -c:v mpeg4 -q:v 3 -c:a libmp3lame "${arquivo}"`);
}
const pagina = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><link rel=stylesheet href=/scout/movimento.css><div id=a style="max-width:1000px;margin:auto"></div>
<script src=/scout/video-segmentador.js></script><script src=/scout/video-audio.js></script><script src=/scout/video-scout.js></script><script src=/scout/video-visao.js></script><script src=/scout/video-scout-ui.js></script><script src=/scout/quadra-auto.js></script><script src=/scout/padroes.js></script><script src=/scout/video-jogo.js></script>
<script>
window.__salvos = []; window.__videos = [];
window.vj = QLVideoJogo.montar(document.getElementById("a"), { atleta: "Ana", aoSalvar: (r) => window.__videos.push(r), aoSalvarScout: (d) => window.__salvos.push(JSON.parse(JSON.stringify(d))) });
fetch("/dados.json").then((r) => r.json()).then((D) => {
  window.__D = D;
  const cal = QLVideoScout.calibrar(D.cantos, { aspecto: D.W / D.H });
  QLVisao.carregarPose = () => Promise.resolve({ detectarQuadro(t, lado) {
    const q = D.quadros[Math.round(t * D.fps)]; if (!q) return null;
    const j = q.j.filter((x) => x.lm && (QLVideoScout.aplicarH(cal.H, x.pe)[1] < 0) === (lado === "perto"))[0];
    const M = D.mov && D.mov[Math.round(t * D.fps)]; // PANORAMICA=1: a pose segue a câmera na mão
    const leva = (p) => { if (!M) return p; const z = M[6] * p[0] + M[7] * p[1] + M[8]; return [(M[0] * p[0] + M[1] * p[1] + M[2]) / z, (M[3] * p[0] + M[4] * p[1] + M[5]) / z]; };
    return j ? j.lm.map((p) => { const q = leva(p); return { x: q[0], y: q[1], v: 0.9 }; }) : null;
  } });
});
</script>`;
const srv = http.createServer((q, r) => {
  const u = q.url.split("?")[0];
  if (u === "/") { r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return r.end(pagina); }
  if (u === "/dados.json") { r.writeHead(200, { "content-type": "application/json" }); return r.end(JSON.stringify({ W: D.W, H: D.H, fps: D.fps, cantos: D.cantos, quadros: D.quadros, mov: D.mov })); }
  const f = path.join(raiz, u); if (f.startsWith(raiz) && fs.existsSync(f)) { r.writeHead(200, { "content-type": u.endsWith(".css") ? "text/css" : "text/javascript" }); return r.end(fs.readFileSync(f)); }
  r.writeHead(404); r.end();
}).listen(0);
(async () => {
  const { chromium } = require("/opt/node22/lib/node_modules/playwright");
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const p = await b.newPage({ viewport: { width: +process.env.LARGURA || 1100, height: 1000 } }), erros = [];
  p.on("pageerror", (e) => erros.push(e.message));
  await p.route(/@ffmpeg\/core@0\.12\.10\/dist\/umd\/(.*)$/, async (rt) => { const n = /umd\/(.*)$/.exec(rt.request().url())[1]; if (!fs.existsSync(path.join(CORE, n))) return rt.abort(); await rt.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-type": n.endsWith(".wasm") ? "application/wasm" : "text/javascript" }, body: fs.readFileSync(path.join(CORE, n)) }); });
  await p.goto("http://localhost:" + srv.address().port + "/");
  await p.waitForFunction(() => window.__D);
  if (process.env.MANUAL) await p.evaluate(() => { QLQuadraAuto.detectar = () => null; }); // simula um vídeo em que a quadra não é achada
  await p.setInputFiles("input[type=file]", arquivo); await p.waitForTimeout(600);
  await p.click('[data-r="go"]');
  await p.waitForFunction(() => /pontos detectados/.test(document.querySelector('[data-r="st"]').textContent), null, { timeout: 120000 });
  const hits = await p.evaluate(() => vj.estado.hits.length);
  assert(Math.abs(hits - D.hits.length) <= 1, "batidas pelo som: " + hits + " de " + D.hits.length);
  if (process.env.AVI) assert(await p.evaluate(() => vj.estado.clipes), "AVI: o navegador não exibe, modo de clipes");
  /* automático: depois de achar os pontos o app acha a quadra sozinho, lê o vídeo, monta e salva o scout. MANUAL=1 testa a
     marcação à mão (quando a quadra não é achada) */
  const t0 = Date.now();
  if (process.env.MANUAL) {
    await p.waitForFunction(() => /Toque no canto 1/.test((document.querySelector('[data-r="instr"]') || {}).textContent || ""), null, { timeout: 120000 })
      .catch(async () => { throw new Error("quadro da calibração não apareceu: " + await p.textContent('[data-r="calmsg"]').catch(() => "") + " | " + erros.join(" | ")); });
    assert(/Não achei as linhas/.test(await p.textContent('[data-r="calmsg"]')), "aviso de marcação manual");
    const cv = await p.$('[data-r="cv"]'); await cv.scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, 120)); await p.waitForTimeout(200); const bx = await cv.boundingBox();
    const toque = (x, y) => p.mouse.click(bx.x + x * bx.width, bx.y + y * bx.height);
    if (capturas) {
      fs.mkdirSync(capturas, { recursive: true });
      await p.mouse.move(bx.x + D.cantos[0][0] * bx.width, bx.y + D.cantos[0][1] * bx.height); await p.mouse.down(); await p.waitForTimeout(100);
      await cv.screenshot({ path: path.join(capturas, "scout-lupa.png") }); await p.mouse.up();
      for (const c of D.cantos.slice(1)) await toque(c[0], c[1]);
    } else for (const c of D.cantos) await toque(c[0], c[1]);
    const fq = D.quadros[Math.round(D.hits[0] * D.fps)] || D.quadros.find((q) => q);
    const dist = (a, c) => Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]);
    const tronco = (cor) => { const j = fq.j.filter((x) => x.lm).sort((a, c) => dist(a.cor, cor) - dist(c.cor, cor))[0]; const l = [11, 12, 23, 24].map((i) => j.lm[i]); return [l.reduce((s, v) => s + v[0], 0) / 4, l.reduce((s, v) => s + v[1], 0) / 4]; };
    const tA = tronco(D.cores.nos), tB = tronco(D.cores.ele);
    await toque(tA[0], tA[1]); await toque(tB[0], tB[1]);
    assert(/Pronto/.test(await p.textContent('[data-r="instr"]')), "calibração completa");
    await p.click('[data-a="gerar"]');
  }
  await p.waitForSelector(".vs-res", { timeout: 600000 }).catch(async () => { throw new Error("o scout não ficou pronto: " + (await p.textContent('[data-r="scout"]')).slice(0, 300) + " | " + erros.join(" | ")); });
  if (!process.env.MANUAL) assert(await p.evaluate(() => vj.estado.scoutUI.estado.quadraAuto), "a quadra foi achada sozinha");
  await p.waitForTimeout(300);
  assert.strictEqual((await p.evaluate(() => window.__salvos.length)) >= 1, true, "salvo sozinho no caderno");
  const r = await p.evaluate(() => { const S = vj.estado.scoutUI.estado; return { pontos: S.pontos.map((x) => ({ nos: x.nos, saque: x.saque, sacador: x.sacador, golpe: x.golpe, efeito: x.efeito, bola: x.bola, n: (x.batidas || []).length, fonte: null })), placar: QLVideoScout.Placar.texto(S.placar), bolas: S.dados.reduce((s, d) => s + d.quadros.filter((q) => q.bolas.length).length, 0), quadros: S.dados.reduce((s, d) => s + d.quadros.length, 0) }; });
  const V = D.pontos, n = Math.min(V.length, r.pontos.length), certo = (k) => V.slice(0, n).filter((v, i) => r.pontos[i][k] === v[k]).length;
  console.log("  " + r.pontos.length + "/" + V.length + " pontos · placar " + r.placar + " (verdade " + D.placar + ") · quem ganhou " + certo("nos") + "/" + n + " · saque " + certo("saque") + "/" + n + " · sacador " + certo("sacador") + "/" + n +
    " · bola achada em " + Math.round(r.bolas / r.quadros * 100) + "% dos quadros · " + ((Date.now() - t0) / 1000).toFixed(0) + " s");
  if (process.env.DEPURA_DADOS) fs.writeFileSync(process.env.DEPURA_DADOS, JSON.stringify(Object.assign(await p.evaluate(() => { const S = vj.estado.scoutUI.estado; return { dados: S.dados, cantos: S.cantos, asp: S.asp, cores: S.cores, maos: S.maos, perto: S.ctx.atletaComecaPerto }; }), { verdade: D.verdade })));
  if (process.env.DEPURA) { const dd = await p.evaluate(() => { const S = vj.estado.scoutUI.estado; return S.dec.decisoes.map((d, k) => ({ papel: d.papel, nos: d.nos, saida: S.an[k].saida, pUlt: S.an[k].pUltimoGanhou, nH: S.an[k].nHits, falsas: (S.an[k].falsas || []).length, ult: S.an[k].batidas.length ? S.an[k].batidas[S.an[k].batidas.length - 1].quem : null, qq: S.an[k].batidas.map((b) => b.quique ? b.quique.P.map((v) => v.toFixed(1)).join(",") : "-").join(" ") })); }); dd.forEach((d, k) => console.log(k, JSON.stringify(d), "verdade:", JSON.stringify({ papel: D.verdade[k].papel, nos: D.verdade[k].nos, fim: D.verdade[k].fimTipo, nH: D.verdade[k].nHits, alvos: D.verdade[k].batidas.map((x) => x.alvo.map((v) => v.toFixed(1)).join(",")).join(" ") }))); }
  assert.strictEqual(r.pontos.length, V.length, "um ponto do scout para cada ponto jogado");
  assert(certo("sacador") === n && certo("saque") >= n - 1 && certo("nos") >= n - 1, "sacador, tipo de saque e quem ganhou");
  assert(r.bolas / r.quadros > 0.5, "a bola é achada nos pixels na maior parte dos quadros");
  if (capturas) await p.screenshot({ path: path.join(capturas, "scout-revisao.png"), fullPage: true });
  /* edição: trocar como terminou o 1º ponto refaz o placar dos seguintes */
  const antes = await p.evaluate(() => vj.estado.scoutUI.estado.pontos.map((x) => x.placarAntes).join("|"));
  await p.click('.vs-pt[data-cart="0"] [data-acao="editar"]');
  const atual = await p.evaluate(() => vj.estado.scoutUI.estado.pontos[0].fim);
  await p.selectOption('[data-ed="0"] select[data-k="fim"]', atual === "winner_nos" || atual === "erro_dele" ? "erro_nos" : "winner_nos");
  await p.waitForTimeout(200);
  const depois = await p.evaluate(() => ({ placares: vj.estado.scoutUI.estado.pontos.map((x) => x.placarAntes).join("|"), auto: vj.estado.scoutUI.estado.pontos[0].auto.nos }));
  assert(depois.placares !== antes && depois.auto === "treinador", "a edição refaz o placar e fica marcada como do treinador");
  await p.click('[data-ed="0"] select[data-k="situacao"]').catch(() => {});
  await p.selectOption('[data-ed="0"] select[data-k="situacao"]', "ataque");
  await p.waitForTimeout(300);
  const salvo = await p.evaluate(() => ({ s: window.__salvos, v: window.__videos }));
  assert(salvo.s.length >= 2, "salvo sozinho ao gerar e de novo a cada correção");
  const ult = salvo.s[salvo.s.length - 1], sp = ult.pontos;
  assert(salvo.s.every((x) => x.id === ult.id), "o mesmo registro é atualizado (não duplica no caderno)");
  assert.strictEqual(sp.length, r.pontos.length); assert.strictEqual(sp[0].situacao, "ataque");
  assert(sp.every((x) => typeof x.nos === "boolean" && x.sacador && x.placarAntes && x.fim && x.bola && /^[ne]S/.test(x.seq)), "pontos no formato do scout, com as batidas compactas");
  assert(sp.some((x) => /:\d+/.test(x.seq)), "velocidade das bolas gravada");
  assert(JSON.stringify(ult).length < 500 * r.pontos.length, "gravação compacta (" + JSON.stringify(ult).length + " bytes)");
  assert(salvo.v.length >= 1 && salvo.v.every((x) => x.id === salvo.v[0].id), "também vai para o histórico de jogos em vídeo (um registro só)");
  /* padrões da partida na tela */
  const tp = await p.textContent('[data-r="scout"]');
  assert(/Padrões da partida/.test(tp) && /Como os pontos foram/.test(tp) && /Velocidade e profundidade/.test(tp) && /km\/h/.test(tp), "padrões, velocidade e profundidade na revisão");
  /* trocar o atleta: o placar e quem ganhou cada ponto se invertem */
  const ganhosAntes = await p.evaluate(() => vj.estado.scoutUI.estado.pontos.filter((x) => x.nos).length);
  await p.click(".vs-aj summary"); await p.click('[data-a="trocar"]'); await p.waitForTimeout(400);
  const troca = await p.evaluate(() => ({ g: vj.estado.scoutUI.estado.pontos.filter((x) => x.nos).length, n: vj.estado.scoutUI.estado.pontos.length, perto: vj.estado.scoutUI.estado.ctx.atletaComecaPerto }));
  assert(troca.perto === false && Math.abs(troca.g - (troca.n - ganhosAntes)) <= 1, "trocar o atleta inverte os pontos ganhos (" + ganhosAntes + " → " + troca.g + " de " + troca.n + ")");
  assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
  console.log("check-video-scout-navegador: ok");
  await b.close(); srv.close(); fs.rmSync(pasta, { recursive: true, force: true });
})().catch((e) => { console.error(e.message || e); srv.close(); process.exit(1); });
