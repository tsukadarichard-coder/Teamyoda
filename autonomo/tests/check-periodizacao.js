const { chromium } = require('/opt/node22/lib/node_modules/playwright');
function assert(cond, msg) { if (!cond) throw new Error('FALHOU: ' + msg); console.log('OK:', msg); }
function tem(t, s) { return t.toLowerCase().includes(s.toLowerCase()); }
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8781/autonomo.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    window.__proximasClaims = { orgId: 'team-yoda', role: 'coordenador' };
    window.__docs['orgs/team-yoda/meta/info'] = { nome: 'Richard Tsukada', individual: true, plano: 'gratis' };
    window.__docs['orgs/team-yoda/solicitacoes/uid-coord@team-yoda.com'] = { nome: 'Richard Tsukada', email: 'coord@team-yoda.com', status: 'aprovada', role: 'coordenador' };
  });
  await page.fill('input[type=email]', 'coord@team-yoda.com');
  await page.fill('input[type=password]', 'x');
  await page.click('text=Entrar');
  await page.waitForTimeout(700);
  await page.locator('.mty-bottomnav').getByText('Jogadores', { exact: true }).click();
  await page.waitForTimeout(200);
  await page.getByText('Novo jogador', { exact: true }).click();
  await page.waitForTimeout(250);
  await page.fill('input[placeholder="Nome do jogador ou da turma"]', 'Periodizacao Teste');
  await page.getByText('Salvar rascunho', { exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByText('Cancelar', { exact: true }).click();
  await page.waitForTimeout(200);

  await page.getByText('Mais ▼', { exact: true }).click();
  await page.waitForTimeout(150);
  await page.getByText('Periodização', { exact: true }).click();
  await page.waitForTimeout(250);
  let body = await page.evaluate(() => document.body.innerText);
  assert(tem(body, 'Nenhum período de treino definido') && tem(body, 'Criar período'), 'estado vazio da Periodização com CTA: ' + body.slice(0, 500));

  await page.getByText('Criar período', { exact: true }).click();
  await page.waitForTimeout(300);
  body = await page.evaluate(() => document.body.innerText);
  assert(tem(body, 'Etapa 2 de 5') && tem(body, 'Rotina'), '"Criar período" leva direto pra etapa Rotina da ficha: ' + body.slice(0, 300));

  assert(errors.length === 0, 'sem erro de JS: ' + JSON.stringify(errors));
  console.log('PERIODIZACAO OK');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
