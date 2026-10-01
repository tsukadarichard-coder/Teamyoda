const { chromium } = require('/opt/node22/lib/node_modules/playwright');
function assert(cond, msg) { if (!cond) throw new Error('FALHOU: ' + msg); console.log('OK:', msg); }

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('http://localhost:8781/autonomo.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  assert(errors.length === 0, 'sem erro de JS no carregamento inicial: ' + JSON.stringify(errors));

  await page.evaluate(() => { window.__proximasClaims = { orgId: 'team-yoda', role: 'coordenador' }; });
  await page.fill('input[type=email]', 'coord@team-yoda.com');
  await page.fill('input[type=password]', 'x');
  await page.click('text=Entrar');
  await page.waitForTimeout(700);

  let body = await page.evaluate(() => document.body.innerText);
  assert(body.includes('Dashboard'), 'login funciona, mostra o Dashboard: ' + body.slice(0, 300));

  // ── módulos de academia removidos não aparecem mais no menu ──
  assert(!/\bEquipe\b/.test(body), 'não existe mais aba Equipe: ' + body.slice(0, 600));
  assert(!body.includes('Formação'), 'não existe mais aba Formação: ' + body.slice(0, 600));
  assert(!body.includes('Quadras'), 'não existe mais aba Quadras: ' + body.slice(0, 600));
  assert(!body.includes('Grade de aulas'), 'não existe mais aba Grade de aulas: ' + body.slice(0, 600));
  assert(!body.includes('Torneios'), 'não existe mais aba Torneios: ' + body.slice(0, 600));
  assert(!body.includes('Eventos'), 'não existe mais aba Eventos: ' + body.slice(0, 600));
  assert(!body.includes('Clientes'), 'não existe mais aba Clientes: ' + body.slice(0, 600));

  // ── o núcleo do produto continua funcionando: criar jogador, ficha, questionário, plano ──
  await page.getByText('Jogadores', { exact: true }).first().click();
  await page.waitForTimeout(200);
  await page.getByText('Novo jogador', { exact: true }).click();
  await page.waitForTimeout(200);
  await page.fill('input[placeholder="Nome do jogador ou da turma"]', 'Teste Autônomo');
  body = await page.evaluate(() => document.body.innerText);
  assert(body.includes('Identificação') && body.includes('Classificação inicial') && body.includes('Nível do jogador'),
    'a ficha com o bloco de nível continua existindo: ' + body.slice(0, 1500));
  assert(!/Y1.{0,3}Y6|\(Y1|Nível do jogador \(Y/i.test(body),
    'não sobra citação literal de Y1-Y6 no título: ' + body.slice(0, 1500));
  assert(body.includes('Perfil de jogo') && body.includes('Ficha de entrada') && body.includes('Prioridades'),
    'Perfil de jogo, Ficha de entrada e Prioridades já aparecem sem precisar de "mostrar mais": ' + body.slice(0, 2000));
  assert(!body.includes('Horizonte') && !body.includes('Calendário e rotina'),
    'Horizonte e Calendário e rotina ficam ocultos: ' + body.slice(0, 2000));
  assert(!body.includes('Físico observado') && !body.includes('Mental observado'),
    'Ficha de entrada não tem mais os blocos de Físico e Mental observado: ' + body.slice(0, 2000));
  await page.getByText('Salvar ficha', { exact: true }).click();
  await page.waitForTimeout(200);
  body = await page.evaluate(() => document.body.innerText);
  assert(body.includes('Teste Autônomo'), 'o jogador foi salvo e a ficha abre normalmente: ' + body.slice(0, 500));

  await page.getByText('Plano', { exact: true }).first().click();
  await page.waitForTimeout(200);
  body = await page.evaluate(() => document.body.innerText);
  assert(/gerar.*partir da ficha|colar plano pronto/i.test(body), 'a tela de Plano (geração por IA) continua existindo: ' + body.slice(0, 800));

  await page.getByText('Caderno', { exact: true }).click();
  await page.waitForTimeout(200);
  body = await page.evaluate(() => document.body.innerText);
  assert(/registrado ainda|histórico/i.test(body), 'o Caderno continua existindo: ' + body.slice(0, 500));

  // ── Turmas continua existindo (versão leve, mantida no roadmap) ──
  await page.getByText('← Todos os jogadores', { exact: true }).click();
  await page.waitForTimeout(150);
  await page.getByText('Turmas', { exact: true }).first().click();
  await page.waitForTimeout(200);
  body = await page.evaluate(() => document.body.innerText);
  assert(/nova turma/i.test(body), 'a aba Turmas continua existindo: ' + body.slice(0, 500));

  assert(errors.length === 0, 'sem erro de JS durante todo o fluxo: ' + JSON.stringify(errors));
  console.log('\nTODOS OS TESTES DE SMOKE DO FORK AUTÔNOMO PASSARAM');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
