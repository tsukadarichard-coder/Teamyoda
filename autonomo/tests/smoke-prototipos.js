var pw = require("playwright"), path = require("path"), a = require("assert");
(async function () {
  var b = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] }), erros = [];
  var p = await b.newPage({ viewport: { width: 390, height: 800 } });
  p.on("pageerror", function (e) { erros.push(e.message); });
  await p.goto("file://" + path.resolve(__dirname, "../../prototipos/biomecanica/index.html"));
  await p.click("#demo");
  await p.waitForSelector("#chk:not([hidden])");
  a.strictEqual(await p.locator(".fase").count(), 6);
  a.ok(await p.locator("#tb tr").count() > 12);
  a.ok((await p.textContent("#kpi")).includes("OK"));
  await p.selectOption("#dom", "E"); await p.click("#demo");
  a.strictEqual(await p.locator(".fase").count(), 6);
  await p.screenshot({ path: "/tmp/bio.png", fullPage: true });
  await p.goto("file://" + path.resolve(__dirname, "../../prototipos/video-scout/index.html"));
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
