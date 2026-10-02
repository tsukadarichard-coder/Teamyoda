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
  await page.fill('input[placeholder="Nome do jogador ou da turma"]', 'Caderno Teste');
  await page.getByText('Salvar rascunho', { exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByText('Cancelar', { exact: true }).click();
  await page.waitForTimeout(200);

  await page.getByText('Mais ▼', { exact: true }).click();
  await page.waitForTimeout(150);
  await page.getByText('Caderno', { exact: true }).click();
  await page.waitForTimeout(250);
  let body = await page.evaluate(() => document.body.innerText);
  assert(tem(body, 'Caderno') && tem(body, 'Anotações'), 'Caderno carrega com título e modo Anotações: ' + body.slice(0, 400));

  await page.getByText('Anotações', { exact: true }).click();
  await page.waitForTimeout(200);
  body = await page.evaluate(() => document.body.innerText);
  assert(tem(body, 'Suas observações sobre este jogador ficam aqui'), 'estado vazio das anotações: ' + body.slice(0, 400));
  const temBuscaInput = await page.locator('input[placeholder="Buscar anotação"]').count();
  assert(tem(body, 'Nova anotação') && temBuscaInput > 0, 'tem nova anotação e busca: ' + body.slice(0, 400));

  await page.getByText('+ Nova anotação', { exact: true }).click();
  await page.waitForTimeout(150);
  await page.fill('input[placeholder="Ex.: Conversa sobre a pré-temporada"]', 'Primeira conversa');
  await page.fill('textarea', 'Falou que quer focar no saque este mês.');
  await page.fill('input[placeholder="Ex.: aula de terça, semana 3"]', 'aula de hoje');
  await page.getByText('Salvar anotação', { exact: true }).click();
  await page.waitForTimeout(250);
  body = await page.evaluate(() => document.body.innerText);
  assert(tem(body, 'Primeira conversa') && tem(body, 'Falou que quer focar no saque') && tem(body, 'aula de hoje'),
    'anotação criada aparece na lista com título/trecho/vínculo: ' + body.slice(0, 600));

  // busca
  await page.fill('input[placeholder="Buscar anotação"]', 'saque');
  await page.waitForTimeout(150);
  body = await page.evaluate(() => document.body.innerText);
  assert(tem(body, 'Primeira conversa'), 'busca encontra pela anotação: ' + body.slice(0, 400));
  await page.fill('input[placeholder="Buscar anotação"]', 'nada-disso-existe');
  await page.waitForTimeout(150);
  body = await page.evaluate(() => document.body.innerText);
  assert(tem(body, 'Nenhuma anotação encontrada'), 'busca sem resultado mostra estado claro: ' + body.slice(0, 400));
  await page.fill('input[placeholder="Buscar anotação"]', '');
  await page.waitForTimeout(150);

  // editar
  await page.getByText('Primeira conversa', { exact: true }).click();
  await page.waitForTimeout(150);
  body = await page.evaluate(() => document.body.innerText);
  assert(tem(body, 'Salvar anotação') && tem(body, 'Cancelar'), 'clicar na anotação abre edição: ' + body.slice(0, 300));
  await page.getByText('Cancelar', { exact: true }).click();
  await page.waitForTimeout(150);

  // excluir com confirmação
  await page.locator('[aria-label="Excluir anotação"]').click();
  await page.waitForTimeout(150);
  body = await page.evaluate(() => document.body.innerText);
  const temConfirmar = await page.locator('[aria-label="Confirmar exclusão"]').count();
  assert(temConfirmar > 0, 'excluir pede confirmação antes de apagar');
  await page.locator('[aria-label="Confirmar exclusão"]').click();
  await page.waitForTimeout(200);
  body = await page.evaluate(() => document.body.innerText);
  assert(!tem(body, 'Primeira conversa'), 'confirmar exclusão remove a anotação: ' + body.slice(0, 400));

  assert(errors.length === 0, 'sem erro de JS no fluxo do Caderno: ' + JSON.stringify(errors));
  console.log('\nTODOS OS TESTES DO CADERNO PASSARAM');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
