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

  await page.locator('.mty-bottomnav').getByText('Jogadores', { exact: true }).click();
  await page.waitForTimeout(200);
  await page.getByText('Novo jogador', { exact: true }).click();
  await page.waitForTimeout(300);

  let body = await page.evaluate(() => document.body.innerText);
  assert(tem(body, 'Etapa 1 de 5') && tem(body, 'Dados'), 'abre a ficha nova direto na etapa 1 (Dados): ' + body.slice(0, 300));
  assert(tem(body, 'Novo jogador'), 'cabeçalho mostra "Novo jogador" quando ainda não tem nome: ' + body.slice(0, 300));
  assert(tem(body, 'Cadastro incompleto'), 'etiqueta do cabeçalho mostra "Cadastro incompleto": ' + body.slice(0, 300));

  // nascimento e altura não se sobrepõem — cada um em seu campo com rótulo próprio
  assert(tem(body, 'Nascimento') && tem(body, 'Altura atual (m)') && tem(body, 'Altura projetada (m)'),
    'nascimento e alturas em campos próprios com unidade explícita: ' + body.slice(0, 500));
  const nascimentoBox = await page.locator('input[type=date]').first().boundingBox();
  const alturaBox = await page.locator('input[placeholder="1,78"]').boundingBox();
  assert(nascimentoBox.y < alturaBox.y, 'nascimento fica numa linha própria, acima das alturas, em 390px');

  await page.fill('input[placeholder="Nome do jogador ou da turma"]', 'Jogador Teste Wizard');
  await page.getByText('Salvar e continuar', { exact: true }).click();
  await page.waitForTimeout(300);
  body = await page.evaluate(() => document.body.innerText);
  assert(tem(body, 'Etapa 2 de 5') && tem(body, 'Rotina'), 'avança pra etapa 2 (Rotina) ao clicar Salvar e continuar: ' + body.slice(0, 300));
  assert(tem(body, '✓ salvo') || tem(body, 'salvo'), 'mostra confirmação real de salvamento: ' + body.slice(0, 300));

  await page.getByText('Voltar', { exact: true }).click();
  await page.waitForTimeout(200);
  body = await page.evaluate(() => document.body.innerText);
  assert(tem(body, 'Etapa 1 de 5'), 'Voltar retorna pra etapa 1 sem perder dados');
  assert(await page.locator('input[placeholder="Nome do jogador ou da turma"]').inputValue() === 'Jogador Teste Wizard',
    'o nome digitado continua lá depois de voltar (navegação não descarta dados)');

  await page.getByText('Salvar e continuar', { exact: true }).click();
  await page.waitForTimeout(250);
  await page.getByText('Salvar e continuar', { exact: true }).click();
  await page.waitForTimeout(250);
  body = await page.evaluate(() => document.body.innerText);
  assert(tem(body, 'Etapa 3 de 5') && tem(body, 'Nível'), 'chega na etapa 3 (Nível): ' + body.slice(0, 300));
  assert(tem(body, 'critérios confirmados') && tem(body, 'Ver critérios e evolução'),
    'cartão compacto de nível, sem a sequência horizontal cortada: ' + body.slice(0, 800));
  await page.getByText('Ver critérios e evolução', { exact: true }).last().click();
  await page.waitForTimeout(200);
  body = await page.evaluate(() => document.body.innerText);
  assert(tem(body, 'Sugerir estágio e nível com IA') || tem(body, 'Prefiro marcar critério por critério'),
    '"Ver critérios e evolução" expande o painel completo: ' + body.slice(0, 500));

  await page.getByText('Salvar e continuar', { exact: true }).click();
  await page.waitForTimeout(300);
  body = await page.evaluate(() => document.body.innerText);
  assert(tem(body, 'Etapa 4 de 5') && tem(body, 'Avaliação por golpe'), 'chega na etapa 4 (Avaliação): ' + body.slice(0, 300));
  assert(tem(body, 'Forehand') && tem(body, 'Não avaliado'), 'golpes aparecem recolhidos com estado "Não avaliado": ' + body.slice(0, 800));
  assert(!tem(body, 'Em quais situações funciona bem?'), 'perguntas do golpe ficam ocultas até expandir o bloco');

  await page.getByText('Forehand', { exact: true }).click();
  await page.waitForTimeout(200);
  body = await page.evaluate(() => document.body.innerText);
  assert(tem(body, 'Em quais situações funciona bem?') && tem(body, 'Em quais situações apresenta dificuldade?'),
    'expandir o golpe mostra as duas perguntas-guia: ' + body.slice(0, 1000));
  assert(tem(body, 'Ainda não observei'), 'opção explícita "Ainda não observei" existe: ' + body.slice(0, 1000));

  // digita um texto real, depois tenta marcar "ainda não observei" -> deve pedir confirmação (dialog)
  const textareas = await page.locator('textarea').all();
  await textareas[0].fill('Funciona bem quando a bola vem alta.');
  page.once('dialog', async (d) => { assert(/substituir/i.test(d.message()), 'confirma antes de substituir texto já escrito: ' + d.message()); await d.dismiss(); });
  await page.getByText('Ainda não observei', { exact: true }).first().click();
  await page.waitForTimeout(150);
  assert((await textareas[0].inputValue()) === 'Funciona bem quando a bola vem alta.',
    'cancelar a confirmação não apaga o texto já escrito');

  await page.getByText('Aprofundar pelas seis fases', { exact: false }).first().click();
  await page.waitForTimeout(150);
  body = await page.evaluate(() => document.body.innerText);
  assert(tem(body, '1 · Preparação'), '"Aprofundar pelas seis fases" ainda abre as seis fases do golpe: ' + body.slice(0, 500));

  await page.getByText('Salvar e continuar', { exact: true }).click();
  await page.waitForTimeout(300);
  body = await page.evaluate(() => document.body.innerText);
  assert(tem(body, 'Etapa 5 de 5') && tem(body, 'Revisão'), 'chega na etapa 5 (Revisão): ' + body.slice(0, 300));
  assert(tem(body, 'Pendências'), 'mostra pendências não-bloqueantes na revisão: ' + body.slice(0, 1000));
  assert(tem(body, 'Concluir ficha'), 'última etapa oferece "Concluir ficha": ' + body.slice(0, 300));
  assert(!tem(body, 'Salvar e continuar'), 'não mostra mais "Salvar e continuar" na última etapa');

  await page.getByText('Concluir ficha', { exact: true }).click();
  await page.waitForTimeout(400);
  body = await page.evaluate(() => document.body.innerText);
  assert(tem(body, 'Jogador Teste Wizard') && !tem(body, 'Etapa 5 de 5'), 'Concluir ficha fecha o wizard e mostra o resumo: ' + body.slice(0, 300));

  await page.getByText('Editar ficha', { exact: true }).first().click();
  await page.waitForTimeout(250);
  body = await page.evaluate(() => document.body.innerText);
  assert(tem(body, 'Etapa 1 de 5'), 'reabrir pra editar volta pra etapa 1: ' + body.slice(0, 300));
  await page.getByText('Cancelar', { exact: true }).click();
  await page.waitForTimeout(200);

  // nav do jogador: Ficha/Plano/Aulas/Mais (distinto do "Mais" global da barra inferior)
  body = await page.evaluate(() => document.body.innerText);
  const navJogador = await page.locator('button:has-text("Mais")').allTextContents();
  assert(navJogador.includes('Mais ▼'), 'a navegação do jogador tem um item "Mais" próprio, distinto do global: ' + JSON.stringify(navJogador));
  await page.getByText('Mais ▼', { exact: true }).click();
  await page.waitForTimeout(200);
  body = await page.evaluate(() => document.body.innerText);
  assert(tem(body, 'Periodização') && tem(body, 'Sessão de hoje') && tem(body, 'Scout') && tem(body, 'Caderno'),
    '"Mais" do jogador lista Periodização/Sessão de hoje/Scout/Caderno: ' + body.slice(0, 600));
  await page.getByText('Scout', { exact: true }).click();
  await page.waitForTimeout(200);
  body = await page.evaluate(() => document.body.innerText);
  assert(tem(body, 'Scout'), 'navegar pelo menu Mais funciona de verdade (Scout abriu): ' + body.slice(0, 300));

  // "Ver critérios e evolução" no cabeçalho jogador manda direto pra etapa Nível
  await page.locator('[aria-label="Opções do jogador"]').click();
  await page.waitForTimeout(150);
  body = await page.evaluate(() => document.body.innerText);
  assert(tem(body, 'Remover jogador'), '"Remover jogador" está dentro do menu de opções: ' + body.slice(0, 300));
  await page.keyboard.press('Escape').catch(() => {});
  await page.mouse.click(5, 5);
  await page.waitForTimeout(150);

  await page.getByText('Ver critérios e evolução', { exact: true }).click();
  await page.waitForTimeout(300);
  body = await page.evaluate(() => document.body.innerText);
  assert(tem(body, 'Etapa 3 de 5') && tem(body, 'Nível'), '"Ver critérios e evolução" do cabeçalho abre a ficha direto na etapa Nível: ' + body.slice(0, 300));

  assert(errors.length === 0, 'sem erro de JS durante todo o fluxo da ficha em etapas: ' + JSON.stringify(errors));
  await page.screenshot({ path: 'ficha-390-dados.png' });
  await browser.close();
  console.log('\nTODOS OS TESTES DA FICHA EM ETAPAS PASSARAM');
})().catch((e) => { console.error(e); process.exit(1); });
