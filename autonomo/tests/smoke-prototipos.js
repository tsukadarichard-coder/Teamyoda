var pw = require("playwright"), path = require("path"), a = require("assert");
(async function () {
  var b = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] }), erros = [];
  var p = await b.newPage({ viewport: { width: 390, height: 800 } });
  p.on("pageerror", function (e) { erros.push(e.message); });
  await p.goto("file://" + path.resolve(__dirname, "../prototipos/biomecanica/index.html"));
  await p.click('[data-r="demo"]');
  await p.waitForSelector('[data-r="saida"]:not([hidden])');
  a.strictEqual(await p.locator(".qm-fase").count(), 6);
  a.ok(await p.locator('[data-r="tb"] tr').count() > 12);
  a.ok((await p.textContent('[data-r="kpi"]')).includes("OK"));
  a.ok((await p.textContent('[data-r="ctx"]')).length > 20);
  a.ok(await p.locator('[data-r="cbody"] .qm-pr').count() >= 1, "intervenções");
  a.ok((await p.textContent('[data-r="cbody"]')).includes("Pontos fortes"));
  a.ok((await p.textContent(".qm-marca")).includes("Tecnologia"));
  for (var g of ["backhand", "saque"]) {
    await p.click('[data-r="tabs"] button[data-g="' + g + '"]'); await p.click('[data-r="demo"]');
    await p.waitForSelector('[data-r="saida"]:not([hidden])');
    a.strictEqual(await p.locator(".qm-fase").count(), 6, g);
    if (g === "saque") a.ok((await p.textContent('[data-r="fases"]')).includes("Lançamento da bola"));
    if (g === "backhand") a.ok(await p.isVisible('[data-r="empL"]'));
  }
  // vídeo real (webm gerado): duas análises seguidas do mesmo golpe -> salva, compara e mostra evolução
  var res = await p.evaluate(async function () {
    var c = document.createElement("canvas"); c.width = 180; c.height = 320; var x = c.getContext("2d"), mr = new MediaRecorder(c.captureStream(15), { mimeType: "video/webm" }), ch = [];
    mr.ondataavailable = function (e) { ch.push(e.data); }; mr.start();
    for (var i = 0; i < 40; i++) { x.fillStyle = "hsl(" + i * 9 + ",80%,50%)"; x.fillRect(0, 0, 180, 320); await new Promise(function (r) { setTimeout(r, 66); }); }
    await new Promise(function (r) { mr.onstop = r; mr.stop(); });
    var v = document.querySelector('[data-r="v"]'); v.src = URL.createObjectURL(new Blob(ch, { type: "video/webm" })); await new Promise(function (r) { v.onloadeddata = r; });
    document.querySelector('[data-r="tabs"] button[data-g="forehand"]').click();
    window.__mov.injetar(window.QLBiomec.sintetico(40, "D").map(function (q, k) { q.t = k * 0.05; return q; }), {});
    await new Promise(function (r) { setTimeout(r, 3500); });
    var cores = [].map.call(document.querySelectorAll(".qm-fase canvas"), function (cc) { var d = cc.getContext("2d").getImageData(5, 250, 1, 1).data; return d[0] + "," + d[1] + "," + d[2]; });
    var primeira = JSON.parse(localStorage.getItem("ql-proto-movimentos")).length;
    var cmpOculta = document.querySelector('[data-r="cmpC"]').hidden;
    window.__mov.injetar(window.QLBiomec.sintetico(40, "D").map(function (q, k) { q.t = k * 0.05; return q; }), {});
    await new Promise(function (r) { setTimeout(r, 3500); });
    return { cores: cores, primeira: primeira, cmpOculta: cmpOculta, segunda: JSON.parse(localStorage.getItem("ql-proto-movimentos")).length, cmpVisivel: !document.querySelector('[data-r="cmpC"]').hidden, evo: document.querySelector('[data-r="evo"]').innerHTML.includes("polyline") };
  });
  a.strictEqual(res.cores.length, 6);
  a.ok(res.cores.every(function (c) { return c !== "17,17,17" && c !== "0,0,0"; }), "fotos pretas: " + res.cores);
  a.ok(new Set(res.cores).size >= 3, "fotos iguais: " + res.cores);
  a.strictEqual(res.primeira, 1); a.ok(res.cmpOculta, "primeira análise não compara");
  a.strictEqual(res.segunda, 2); a.ok(res.cmpVisivel, "segunda análise compara com a anterior"); a.ok(res.evo, "gráfico de evolução");
  await p.screenshot({ path: "/tmp/bio.png", fullPage: true });
  await p.goto("file://" + path.resolve(__dirname, "../prototipos/video-scout/index.html"));
  // vídeo sintético com som: usa WAV gerado em memória
  var sr = 8000, n = sr * 30, buf = Buffer.alloc(44 + n * 2), i;
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVEfmt ", 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  var seed = 3; for (i = 0; i < n; i++) { seed = (seed * 16807) % 2147483647; buf.writeInt16LE(Math.round((seed / 2147483647 - 0.5) * 600), 44 + i * 2); }
  [3, 4.3, 5.6, 18, 19.2, 20.5, 21.6].forEach(function (t) { var s = Math.round(t * sr); for (var k = 0; k < 400; k++) { var o = 44 + (s + k) * 2; buf.writeInt16LE(Math.max(-32000, Math.min(32000, Math.round(26000 * Math.exp(-k / 80) * (k % 2 ? 1 : -1)))), o); } });
  require("fs").writeFileSync("/tmp/teste.wav", buf);
  await p.setInputFiles("#arq", "/tmp/teste.wav");
  await p.click("#go");
  await p.waitForSelector("#rev:not([hidden])", { timeout: 20000 });
  a.strictEqual(await p.locator(".pt").count(), 2, await p.textContent("#st"));
  await p.click(".pt:nth-child(1) button.a"); await p.click(".pt:nth-child(2) button.b");
  var d = await p.evaluate(function () { return window.__st().map(function (x) { return x.venc + ":" + x.golpes; }); });
  a.deepStrictEqual(d, ["A:3", "B:4"]);
  await p.screenshot({ path: "/tmp/vid.png", fullPage: true });
  a.deepStrictEqual(erros, []);
  await b.close(); console.log("smoke prototipos: ok");
})().catch(function (e) { console.error(e); process.exit(1); });
