/* quadralab.com.br/tatica (autonomo/tatica/index.html) é gerado de autonomo/tatica-app/: confere que está atualizado.
   Se falhar: python3 autonomo/tatica-app/montar-prototipo.py --site autonomo/tatica/index.html */
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const raiz = path.join(__dirname, "..", "..");
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "tatica-")), "index.html");
execFileSync("python3", [path.join(raiz, "autonomo", "tatica-app", "montar-prototipo.py"), "--site", tmp], { stdio: "ignore" });
const atual = fs.readFileSync(path.join(raiz, "autonomo", "tatica", "index.html"), "utf8");
if (fs.readFileSync(tmp, "utf8") !== atual) { console.error("check-tatica-site: autonomo/tatica/index.html está desatualizado. Rode: python3 autonomo/tatica-app/montar-prototipo.py --site autonomo/tatica/index.html"); process.exit(1); }
if (!/noindex/.test(atual) || /R\$\s*\d|eduzz/i.test(atual)) { console.error("check-tatica-site: a página precisa ficar fora dos buscadores e sem preço ou link de compra"); process.exit(1); }
console.log("check-tatica-site: ok");
