const { chromium } = require('/opt/node22/lib/node_modules/playwright');
function assert(cond, msg) { if (!cond) throw new Error('FALHOU: ' + msg); console.log('OK:', msg); }
function tem(texto, trecho) { return texto.toLowerCase().includes(trecho.toLowerCase()); }

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

  // cria um jogador com nome e um horário fixo pra ter algo na agenda
  await page.locator('.mty-bottomnav').getByText('Jogadores', { exact: true }).click();
  await page.waitForTimeout(200);
  await page.getByText('Novo jogador', { exact: true }).click();
  await page.waitForTimeout(250);
  await page.fill('input[placeholder="Nome do jogador ou da turma"]', 'Agenda Teste');
  await page.getByText('Salvar e continuar', { exact: true }).click();
  await page.waitForTimeout(250);
  // etapa 2 = Rotina: adiciona horário fixo pra HOJE no dia da semana atual
  const hoje = new Date();
  const diasPt = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const diaAtual = diasPt[hoje.getDay()];
  await page.getByText(diaAtual, { exact: true }).first().click();
  await page.fill('input[type=time]', '15:00');
  await page.getByText('+ Adicionar', { exact: true }).click();
  await page.waitForTimeout(200);
  await page.getByText('Salvar e continuar', { exact: true }).click();
  await page.waitForTimeout(250);

  await page.locator('.mty-bottomnav').getByText('Agenda', { exact: true }).click();
  await page.waitForTimeout(300);
  let body = await page.evaluate(() => document.body.innerText);
  assert(tem(body, 'Agenda') && tem(body, 'Hoje'), 'tela Agenda carrega com título e botão Hoje: ' + body.slice(0, 300));
  assert(tem(body, 'Agenda Teste') && tem(body, '15:00'), 'a aula agendada aparece na lista do dia: ' + body.slice(0, 600));
  assert(tem(body, 'Agendada'), 'status padrão é "Agendada" (nunca marca sozinho como realizada): ' + body.slice(0, 600));
  assert(tem(body, 'Dia') && tem(body, 'Semana'), 'segmentado Dia/Semana presente: ' + body.slice(0, 400));

  // abre o detalhe da ocorrência
  await page.getByText('Agenda Teste', { exact: false }).first().click();
  await page.waitForTimeout(250);
  body = await page.evaluate(() => document.body.innerText);
  assert(tem(body, 'Ver jogador') && tem(body, 'Abrir planejamento') && tem(body, 'Abrir sessão'),
    'detalhe da aula mostra as ações esperadas: ' + body.slice(0, 600));
  assert(tem(body, 'Registrar aula') && tem(body, 'Registrar falta') && tem(body, 'Reagendar') && tem(body, 'Cancelar aula'),
    'detalhe mostra registrar/reagendar/cancelar: ' + body.slice(0, 600));

  // marca como realizada e confirma que o status muda (ação deliberada, não automática)
  await page.getByText('Registrar aula', { exact: true }).click();
  await page.waitForTimeout(200);
  body = await page.evaluate(() => document.body.innerText);
  assert(tem(body, 'Realizada'), 'marcar manualmente muda o status pra Realizada: ' + body.slice(0, 600));

  // cancelar com pergunta de escopo (recorrente)
  await page.getByText('Agenda Teste', { exact: false }).first().click();
  await page.waitForTimeout(200);
  await page.getByText('Cancelar aula', { exact: true }).click();
  await page.waitForTimeout(150);
  body = await page.evaluate(() => document.body.innerText);
  assert(tem(body, 'Só esta aula') && tem(body, 'Esta e as próximas'),
    'cancelar aula recorrente pergunta o escopo (só esta vs esta e as próximas): ' + body.slice(0, 600));
  await page.getByText('Só esta aula', { exact: true }).click();
  await page.waitForTimeout(250);
  body = await page.evaluate(() => document.body.innerText);
  assert(tem(body, 'Cancelada'), 'cancelar só esta aula marca Cancelada sem apagar a recorrência: ' + body.slice(0, 600));

  // visão Semana
  await page.getByText('Semana', { exact: true }).click();
  await page.waitForTimeout(250);
  body = await page.evaluate(() => document.body.innerText);
  assert(tem(body, diaAtual), 'visão Semana mostra resumo por dia: ' + body.slice(0, 600));

  // +Agendar aula avulso (sem repetir)
  await page.getByText('Dia', { exact: true }).click();
  await page.waitForTimeout(150);
  await page.getByText('+ Agendar aula', { exact: true }).click();
  await page.waitForTimeout(200);
  body = await page.evaluate(() => document.body.innerText);
  assert(tem(body, 'Agendar pra quem'), 'diálogo de agendar aula abre escolhendo jogador/turma: ' + body.slice(0, 300));
  await page.getByRole('dialog', { name: 'Agendar aula' }).getByText('Agenda Teste', { exact: false }).click();
  await page.waitForTimeout(150);
  body = await page.evaluate(() => document.body.innerText);
  assert(tem(body, 'Repetição') && tem(body, 'Só esta data'), 'agendamento oferece recorrência opcional: ' + body.slice(0, 600));

  assert(errors.length === 0, 'sem erro de JS em todo o fluxo da Agenda: ' + JSON.stringify(errors));
  await page.screenshot({ path: 'agenda-390-dia.png' });
  await browser.close();
  console.log('\nTODOS OS TESTES DA AGENDA PASSARAM');
})().catch((e) => { console.error(e); process.exit(1); });
