const { chromium } = require('/opt/node22/lib/node_modules/playwright');
function assert(cond, msg) { if (!cond) throw new Error('FALHOU: ' + msg); console.log('OK:', msg); }
function tem(texto, trecho) { return texto.toLowerCase().includes(trecho.toLowerCase()); } // rótulos viram MAIÚSCULO via CSS (text-transform), innerText reflete isso

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('http://localhost:8781/autonomo.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  assert(errors.length === 0, 'sem erro de JS no carregamento inicial: ' + JSON.stringify(errors));

  await page.evaluate(() => {
    window.__proximasClaims = { orgId: 'team-yoda', role: 'coordenador' };
    // Reproduz o cadastro individual: o nome do treinador vai tanto pro
    // meta/info da org (usado antes pela Marca) quanto pro registro dele
    // em solicitacoes (usado por "meu nome") — exatamente o que causava
    // o nome aparecer duas vezes no menu lateral.
    window.__docs['orgs/team-yoda/meta/info'] = { nome: 'Richard Tsukada', individual: true, plano: 'gratis' };
    window.__docs['orgs/team-yoda/solicitacoes/uid-coord@team-yoda.com'] = { nome: 'Richard Tsukada', email: 'coord@team-yoda.com', status: 'aprovada', role: 'coordenador' };
  });
  await page.fill('input[type=email]', 'coord@team-yoda.com');
  await page.fill('input[type=password]', 'x');
  await page.click('text=Entrar');
  await page.waitForTimeout(700);

  let body = await page.evaluate(() => document.body.innerText);
  assert(tem(body, 'Início') && body.includes('Olá, Richard'), 'login funciona, mostra o Início com saudação: ' + body.slice(0, 300));
  assert(!body.includes('Dashboard'), 'o rótulo "Dashboard" não aparece mais em lugar nenhum: ' + body.slice(0, 300));

  // ── estado vazio: sem jogador nenhum, mostra o convite pra criar o primeiro planejamento ──
  assert(body.includes('Prepare suas próximas aulas') && body.includes('Criar planejamento'),
    'estado vazio do Início é real (sem jogador) e tem o botão de ação: ' + body.slice(0, 600));

  // ── o nome do treinador não pode aparecer duas vezes no menu lateral ──
  const nomesNoMenu = await page.locator('.mty-sidebar').evaluate((el) =>
    (el.innerText.match(/Richard Tsukada/g) || []).length);
  assert(nomesNoMenu === 0, 'o nome do treinador não aparece solto no menu lateral — só dentro do menu do perfil: achou ' + nomesNoMenu + ' vez(es)');
  const logoNoMenu = await page.locator('.mty-sidebar img[alt="QuadraLab"]').count();
  assert(logoNoMenu >= 1, 'o logo do QuadraLab aparece no topo do menu');

  // ── menu do perfil: avatar consolida nome, plano e sair ──
  await page.getByLabel('Menu do perfil').click();
  await page.waitForTimeout(150);
  body = await page.evaluate(() => document.body.innerText);
  assert(body.includes('Richard Tsukada') && /plano gr.tis/i.test(body) && body.includes('Sair'),
    'o menu do perfil mostra nome completo, plano e Sair juntos: ' + body.slice(0, 500));
  await page.keyboard.press('Escape').catch(() => {});
  await page.mouse.click(600, 10);
  await page.waitForTimeout(150);

  // ── botão "Criar planejamento" do estado vazio conecta no fluxo real de Jogadores ──
  await page.getByText('Criar planejamento', { exact: true }).click();
  await page.waitForTimeout(200);
  body = await page.evaluate(() => document.body.innerText);
  assert(tem(body, 'Novo jogador'), '"Criar planejamento" leva pra tela de Jogadores (fluxo existente): ' + body.slice(0, 400));

  // ── módulos de academia removidos não aparecem mais no menu ──
  assert(!/\bEquipe\b/.test(body), 'não existe mais aba Equipe: ' + body.slice(0, 600));
  assert(!body.includes('Formação'), 'não existe mais aba Formação: ' + body.slice(0, 600));
  assert(!body.includes('Quadras'), 'não existe mais aba Quadras: ' + body.slice(0, 600));
  assert(!body.includes('Grade de aulas'), 'não existe mais aba Grade de aulas: ' + body.slice(0, 600));
  assert(!body.includes('Torneios'), 'não existe mais aba Torneios: ' + body.slice(0, 600));
  assert(!body.includes('Eventos'), 'não existe mais aba Eventos: ' + body.slice(0, 600));
  assert(!body.includes('Clientes'), 'não existe mais aba Clientes: ' + body.slice(0, 600));

  // ── o núcleo do produto continua funcionando: criar jogador, ficha, questionário, plano ──
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
  assert(!tem(body, 'Objetivo final') && !tem(body, 'Início do ciclo'),
    'Horizonte e Calendário ficam ocultos por padrão (nada foi apagado, só escondido): ' + body.slice(0, 2000));
  assert(!tem(body, 'Físico observado') && !tem(body, 'Mental observado'),
    'Físico observado e Mental observado ficam ocultos por padrão na Ficha de entrada: ' + body.slice(0, 2000));
  await page.getByText('Mostrar campos em avaliação', { exact: false }).click();
  await page.waitForTimeout(150);
  body = await page.evaluate(() => document.body.innerText);
  assert(tem(body, 'Físico observado') && tem(body, 'Mental observado'),
    'o botão "mostrar campos em avaliação" revela Físico e Mental observado (nada foi apagado): ' + body.slice(0, 2000));
  assert(tem(body, 'Objetivo final') && tem(body, 'Calendário e rotina'),
    'o mesmo botão revela Horizonte e Calendário e rotina: ' + body.slice(0, 2000));
  await page.getByText('Ocultar campos em avaliação', { exact: true }).click();
  await page.waitForTimeout(150);
  body = await page.evaluate(() => document.body.innerText);
  assert(!tem(body, 'Objetivo final') && !tem(body, 'Físico observado'),
    'o botão esconde de novo sem apagar nada: ' + body.slice(0, 2000));
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

  // ── Início com dados reais: próxima aula, planejamento e indicadores ──
  await page.getByText('Início', { exact: true }).first().click();
  await page.waitForTimeout(200);
  body = await page.evaluate(() => document.body.innerText);
  assert(tem(body, 'Próxima aula') && tem(body, 'Nenhuma aula agendada') && tem(body, 'Agendar aula'),
    'o cartão "Próxima aula" aparece antes dos indicadores, com estado vazio real (jogador sem horário fixo): ' + body.slice(0, 1200));
  assert(tem(body, 'Prepare suas próximas aulas') && tem(body, 'Criar planejamento'),
    'o cartão de planejamento mostra o estado vazio (jogador sem plano ainda): ' + body.slice(0, 1200));
  assert(tem(body, 'Jogadores') && tem(body, 'Aulas prontas') && tem(body, 'Aulas nesta semana') && tem(body, 'Pendências'),
    'o resumo compacto dos indicadores usa os novos rótulos: ' + body.slice(0, 1600));
  const quantosCriarPlanejamento = (body.match(/Criar planejamento/g) || []).length;
  assert(quantosCriarPlanejamento === 1, 'o botão "Criar planejamento" não se repete em partes diferentes da tela: achou ' + quantosCriarPlanejamento + ' vez(es)');

  assert(errors.length === 0, 'sem erro de JS durante todo o fluxo desktop: ' + JSON.stringify(errors));
  await browser.close();

  // ── navegação mobile: barra inferior fixa (Início / Jogadores / Agenda / Mais) ──
  const browser2 = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page2 = await browser2.newPage({ viewport: { width: 390, height: 844 } });
  const errors2 = [];
  page2.on('pageerror', e => errors2.push(e.message));
  await page2.goto('http://localhost:8781/autonomo.html', { waitUntil: 'networkidle' });
  await page2.evaluate(() => { window.__proximasClaims = { orgId: 'team-yoda', role: 'coordenador' }; });
  await page2.fill('input[type=email]', 'coord@team-yoda.com');
  await page2.fill('input[type=password]', 'x');
  await page2.click('text=Entrar');
  await page2.waitForTimeout(700);

  const bottomNavVisible = await page2.locator('.mty-bottomnav').isVisible();
  assert(bottomNavVisible, 'a barra inferior fixa aparece no celular (390px)');
  const itensBarra = await page2.locator('.mty-bottomnav button').allTextContents();
  assert(itensBarra.some((t) => t.includes('Início')) && itensBarra.some((t) => t.includes('Jogadores')) &&
    itensBarra.some((t) => t.includes('Agenda')) && itensBarra.some((t) => t.includes('Mais')),
    'a barra inferior tem Início, Jogadores, Agenda e Mais: ' + JSON.stringify(itensBarra));
  const sidebarEscondida = await page2.locator('.mty-sidebar').evaluate((el) => getComputedStyle(el).transform !== 'none' && !el.classList.contains('aberta'));
  assert(sidebarEscondida, 'o menu lateral antigo fica fora da tela no celular (vira conteúdo do "Mais")');

  // sem rolagem horizontal na tela inicial mobile
  const semScrollX = await page2.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  assert(semScrollX, 'não há rolagem horizontal no Início em 390px');

  await page2.getByText('Mais', { exact: true }).click();
  await page2.waitForTimeout(250);
  const corpoMais = await page2.evaluate(() => document.body.innerText);
  assert(tem(corpoMais, 'Turmas') && tem(corpoMais, 'Casos'), '"Mais" abre o menu completo com Turmas e Casos: ' + corpoMais.slice(0, 400));

  assert(errors2.length === 0, 'sem erro de JS no fluxo mobile: ' + JSON.stringify(errors2));
  await browser2.close();

  console.log('\nTODOS OS TESTES DE SMOKE DO FORK AUTÔNOMO PASSARAM');
})().catch((e) => { console.error(e); process.exit(1); });
