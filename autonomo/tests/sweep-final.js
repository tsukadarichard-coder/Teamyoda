const { chromium } = require('/opt/node22/lib/node_modules/playwright');
function assert(cond, msg) { if (!cond) throw new Error('FALHOU: ' + msg); console.log('OK:', msg); }

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });

  async function login(page) {
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
  }
  async function noScrollX(page, label) {
    const r = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, w: window.innerWidth }));
    assert(r.s <= r.w + 1, `${label}: sem rolagem horizontal (scrollWidth=${r.s} innerWidth=${r.w})`);
  }

  for (const w of [320, 375, 390, 430, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await login(page);

    // Início
    await noScrollX(page, `${w}px Início`);

    // Agenda
    const agendaNav = w < 760 ? page.locator('.mty-bottomnav').getByText('Agenda', { exact: true }) : page.getByText('Agenda', { exact: true }).first();
    await agendaNav.click();
    await page.waitForTimeout(250);
    await noScrollX(page, `${w}px Agenda (Dia)`);
    await page.getByText('Semana', { exact: true }).click();
    await page.waitForTimeout(250);
    await noScrollX(page, `${w}px Agenda (Semana)`);

    // Jogadores -> cria um pra navegar pelas abas internas
    const jogadoresNav = w < 760 ? page.locator('.mty-bottomnav').getByText('Jogadores', { exact: true }) : page.getByText('Jogadores', { exact: true }).first();
    await jogadoresNav.click();
    await page.waitForTimeout(200);
    await page.getByText('Novo jogador', { exact: true }).click();
    await page.waitForTimeout(250);
    await noScrollX(page, `${w}px Ficha (Dados)`);
    await page.fill('input[placeholder="Nome do jogador ou da turma"]', 'Sweep ' + w);
    await page.getByText('Salvar rascunho', { exact: true }).click();
    await page.waitForTimeout(400);
    await page.getByText('Cancelar', { exact: true }).click();
    await page.waitForTimeout(200);

    await page.getByText('Plano', { exact: true }).first().click();
    await page.waitForTimeout(250);
    await noScrollX(page, `${w}px Plano`);

    const maisBtn = w < 760 ? page.getByText('Mais ▼', { exact: true }) : page.getByText('Mais ▼', { exact: true });
    await maisBtn.click();
    await page.waitForTimeout(150);
    await page.getByText('Periodização', { exact: true }).click();
    await page.waitForTimeout(250);
    await noScrollX(page, `${w}px Periodização (vazio)`);

    await page.getByText('Periodização ▼', { exact: true }).click();
    await page.waitForTimeout(150);
    await page.getByText('Scout', { exact: true }).click();
    await page.waitForTimeout(250);
    await noScrollX(page, `${w}px Scout`);

    await page.getByText('Scout ▼', { exact: true }).click();
    await page.waitForTimeout(150);
    await page.getByText('Caderno', { exact: true }).click();
    await page.waitForTimeout(250);
    await noScrollX(page, `${w}px Caderno (histórico)`);
    await page.getByText('Anotações', { exact: true }).click();
    await page.waitForTimeout(200);
    await noScrollX(page, `${w}px Caderno (anotações)`);

    assert(errors.length === 0, `${w}px: sem erro de JS: ` + JSON.stringify(errors));
    await page.close();
  }

  await browser.close();
  console.log('\nTODOS OS TESTES DE RESPONSIVIDADE FINAL PASSARAM');
})().catch((e) => { console.error(e); process.exit(1); });
