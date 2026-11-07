// Verificação da T02.04 (Marcas e produtos) no sistema real.
import { iniciar, ID_KIMBERLY } from './apoio.mjs';

const MARCAS = '/configuracoes/cadastros/marcas';
const ID_MARCA_NUMA = 'b3d1f2e5-8c40-4b21-9d12-1a2b3c4d5e01';
const ID_MARCA_KIPI = 'b3d1f2e5-8c40-4b21-9d12-1a2b3c4d5e03';
const ID_PRODUTO_KIPI = 'c4e2a3f6-9d51-4c32-8e23-2b3c4d5e6f03';
const FICHA_KIPI = `${MARCAS}/produtos/${ID_PRODUTO_KIPI}`;

const h = await iniciar({ nome: 't0204', porta: 9344 });
const { c, ok, passo, ir, texto, valor, preencher, escolher, opcoes, esperarAviso, marcarPilula, clicarNoDialogo, dialogoAberto, dialogoFechado, painelAberto, painelFechado, pularAbertura, tabela, conferirTela, idPorRotulo } = h;

const pronta = () => c.ate(`document.querySelector('nav[aria-label="Marcas"] button')`);
const irMarcas = async (extra = '') => { await ir(MARCAS + extra); await pronta(); };
const salvarPainel = () => c.avaliar(`document.querySelector('.janela button[type=submit]').click()`);
const escolherMarca = async (nome) => { await c.clicar(`nav[aria-label="Marcas"] button[data-marca="${nome}"]`); };
const nomesDasMarcas = () => c.avaliar(`[...document.querySelectorAll('nav[aria-label="Marcas"] button')].map(b=>b.textContent)`);
const produtosNaTela = () => c.avaliar(`[...document.querySelectorAll('main table tbody tr')].map(t=>t.children[0].textContent)`);
const clicarMarca = async (nome) => {
  await c.avaliar(`[...document.querySelectorAll('nav[aria-label="Marcas"] button')].find(b=>b.textContent.startsWith(${JSON.stringify(nome)})).click()`);
  await c.ate(`document.querySelector('main section h2')?.textContent===${JSON.stringify(nome)}`);
};
const opcoesDoContexto = async () => {
  await c.clicar('[aria-label^="Contexto"]');
  await c.ate(`document.querySelector('.menu-suspenso, .dialogo')`);
  await c.espera(150);
  const l = await c.avaliar(`[...document.querySelectorAll('.menu-suspenso ul button, .dialogo ul button')].map(b=>b.textContent.trim())`);
  await c.tecla('Escape');
  await c.espera(200);
  return l;
};

await c.tamanho(1440, 900);

await passo('tela', async () => {
  await ir(MARCAS);
  await pularAbertura();
  await pronta();
  ok('título e contadores', (await texto('main h1')) === 'Marcas e produtos' && (await texto('main')).includes('6 marcas · 5 produtos'));
  ok('no segundo nível de Cadastros base', (await c.avaliar(`document.querySelector('nav[aria-label="Cadastros base"] a[aria-current]').textContent`)) === 'Marcas e produtos');
  ok('o título da aba diz a tela', (await c.avaliar(`document.title`)).startsWith('Marcas e produtos'));
  const marcas = await nomesDasMarcas();
  ok('as 6 marcas da carga inicial', marcas.length === 6 && marcas[0].startsWith('Numa') && marcas[1].startsWith('Sobrevivência Urbana'), marcas.join('|'));
  ok('provisório aparece junto do nome', marcas[4].includes('Zarpa · provisório') && marcas[5].includes('Mimo · provisório'));
  ok('abre na primeira marca que tem produtos', (await texto('main section h2')) === 'Sobrevivência Urbana');
  ok('duas colunas no computador', await c.avaliar(`(()=>{const a=document.querySelector('nav[aria-label="Marcas"]').getBoundingClientRect();const b=document.querySelector('main section').getBoundingClientRect();return a.right<=b.left&&Math.abs(a.top-b.top)<2})()`));
  const p = await produtosNaTela();
  ok('produto da marca à direita, com código', p[0] === 'Sobrevivência UrbanaSURB', p.join('|'));
  const m = await texto('main');
  ok('avisa que falta responsável, sem inventar', m.includes('5 produtos estão sem responsável') && m.includes('A definir'));
  await c.foto('a-tela');
});

await passo('cores das marcas', async () => {
  const cores = await c.avaliar(`[...document.querySelectorAll('nav[aria-label="Marcas"] button')].map(b=>getComputedStyle(b.querySelector('span')).backgroundColor)`);
  ok('o ponto usa a cor da marca', cores[1] === 'rgb(217, 150, 43)' && cores[2] === 'rgb(168, 105, 58)', cores.join(' '));
  const chip = await c.avaliar(`(()=>{const s=document.querySelector('main section span[style]');const e=getComputedStyle(s);return {fundo:e.backgroundColor,cor:e.color}})()`);
  ok('o chip usa a tinta oficial, com o ícone na cor', chip.fundo === 'rgb(251, 239, 216)' && chip.cor === 'rgb(217, 150, 43)', JSON.stringify(chip));
  ok('o nome nunca usa a cor da marca (CA-18.03)', await c.avaliar(`getComputedStyle(document.querySelector('main section h2')).color==='rgb(43, 36, 33)'`));
});

await passo('escolher marca', async () => {
  await clicarMarca('Kipi');
  ok('mostra os produtos dela', (await produtosNaTela())[0] === 'KipiKIPI');
  ok('a escolha fica no endereço', (await c.avaliar(`location.search`)) === `?marca=${ID_MARCA_KIPI}`);
  ok('marca a escolhida', await c.avaliar(`document.querySelector('nav[aria-label="Marcas"] button[aria-current]').textContent.startsWith('Kipi')`));
  await clicarMarca('Numa');
  const m = await texto('main section');
  ok('a marca institucional explica', m.includes('Esta marca ainda não tem produtos.') && m.includes('Numa institucional') && m.includes('Institucional'));
  ok('sem arquivar a institucional', !(await c.avaliar(`Boolean(document.querySelector('button[aria-label="Arquivar Numa"]'))`)));
  await c.recarregar();
  await pronta();
  ok('recarregar mantém a escolha', (await texto('main section h2')) === 'Numa');
});

await passo('seletor de contexto (CA-02.03)', async () => {
  const lista = await opcoesDoContexto();
  ok('produtos ativos + Numa institucional + Numa consolidada', lista.join('|') === 'Numa consolidada|Numa institucional|Sobrevivência Urbana|Kipi|Zupi|Zarpa · provisório|Mimo · provisório', lista.join('|'));
  await c.clicar('[aria-label^="Contexto"]');
  await c.ate(`document.querySelector('.menu-suspenso')`);
  await c.espera(150);
  await c.avaliar(`[...document.querySelectorAll('.menu-suspenso ul button')].find(b=>b.textContent.trim()==='Kipi').click()`);
  await c.ate(`document.querySelector('[aria-label^="Contexto"]').getAttribute('aria-label')==='Contexto: Kipi'`);
  ok('escolher guarda o id do produto', (await c.avaliar(`JSON.parse(localStorage.getItem('numa-central:v1:meta')).contexto_id`)) === ID_PRODUTO_KIPI);
  await c.recarregar();
  await pronta();
  await c.ate(`document.querySelector('[aria-label^="Contexto"]').getAttribute('aria-label')==='Contexto: Kipi'`);
  ok('lembra ao recarregar', true);
  ok('o ponto usa a cor da marca', (await c.avaliar(`getComputedStyle(document.querySelector('[aria-label^="Contexto"] span')).backgroundColor`)) === 'rgb(168, 105, 58)');
});

await passo('nova marca', async () => {
  await c.clicar('texto=Nova marca');
  await painelAberto();
  await c.espera(450);
  await salvarPainel();
  await c.ate(`document.querySelector('.janela [role=alert]')`);
  ok('nome obrigatório', (await texto('.janela [role=alert]')).includes('Informe o nome da marca.'));
  await preencher('marca-nome', 'KIPI');
  await preencher('marca-cor', '#FFEEAA');
  await c.espera(60);
  await salvarPainel();
  await c.ate(`document.getElementById('marca-cor-erro')`);
  ok('cor clara demais é recusada (validar contraste)', (await h.erroDe('marca-cor')).includes('clara demais'));
  await preencher('marca-cor', 'azul');
  await c.espera(60);
  await salvarPainel();
  await c.ate(`document.getElementById('marca-cor-erro')?.textContent.includes('#RRGGBB')`);
  ok('formato da cor', true);
  await preencher('marca-cor', '#884EA0');
  await c.ate(`document.querySelector('.janela').textContent.includes('Como aparece:')`);
  ok('prévia da etiqueta', (await texto('.janela')).includes('Como aparece:KIPI'));
  await c.foto('b-marca');
  await salvarPainel();
  await c.ate(`document.getElementById('marca-nome-erro')?.textContent.includes('Já existe uma marca com esse nome.')`);
  ok('nome único', true);
  await preencher('marca-nome', 'Lumi');
  await preencher('marca-logo', 'https://exemplo.com/logo.png');
  await c.espera(60);
  await salvarPainel();
  await c.ate(`document.getElementById('marca-logo-erro')`);
  ok('logotipo só do Drive', true);
  await preencher('marca-logo', 'https://drive.google.com/file/d/abc');
  await marcarPilula('Nome provisório', 'Sim');
  await c.espera(60);
  await salvarPainel();
  await esperarAviso('Marca criada.');
  await painelFechado();
  await c.ate(`document.querySelector('main section h2')?.textContent==='Lumi'`);
  ok('a marca nova fica escolhida', (await texto('main section')).includes('provisório'));
  ok('sem produtos, oferece o primeiro', (await texto('main section')).includes('Que tal cadastrar o primeiro?'));
  ok('o chip usa tinta calculada', await c.avaliar(`(()=>{const c=getComputedStyle(document.querySelector('main section span[style]')).backgroundColor;return c.startsWith('rgb')&&c!=='rgb(251, 239, 216)'})()`));
});

await passo('novo produto', async () => {
  await c.avaliar(`[...document.querySelectorAll('main section button')].find(b=>b.textContent.trim()==='Novo produto').click()`);
  await painelAberto();
  await c.espera(450);
  ok('já vem com a marca escolhida', (await c.avaliar(`document.getElementById('produto-marca').selectedOptions[0].textContent`)) === 'Lumi');
  ok('estágio padrão: Ideia', await c.avaliar(`[...document.querySelectorAll('.janela select')].some(s=>s.selectedOptions[0].textContent==='Ideia')`));
  ok('com o campo de entidade, desde a T02.05', (await texto('.janela')).includes('Entidade'));
  await c.foto('c-produto');
  await salvarPainel();
  await c.ate(`document.querySelector('.janela [role=alert]')`);
  const r = await texto('.janela [role=alert]');
  ok('obrigatórios', r.includes('Informe o nome do produto.') && r.includes('Use de 3 a 6 letras') && r.includes('Escolha a pessoa responsável'), r);
  await preencher('produto-nome', 'Lumi App');
  await c.avaliar(`document.getElementById('produto-codigo').focus()`);
  await c.digitar('kipi');
  await c.espera(60);
  ok('código em maiúsculas enquanto digita', (await valor('produto-codigo')) === 'KIPI');
  const pessoas = await opcoes('produto-responsavel');
  ok('responsável: pessoa interna', pessoas.includes('Kimberly Grebe') && !pessoas.includes('Rafael Souza'), pessoas.join('|'));
  await escolher('produto-responsavel', ID_KIMBERLY);
  await c.espera(60);
  await salvarPainel();
  await c.ate(`document.getElementById('produto-codigo-erro')?.textContent.includes('Este código já é de Kipi.')`);
  ok('código único', true);
  await preencher('produto-codigo', 'LUMI');
  await preencher('produto-descricao', 'token do painel');
  await c.espera(60);
  await salvarPainel();
  await c.ate(`document.querySelector('.dialogo')?.textContent.includes('Salvar mesmo assim?')`);
  ok('texto que parece segredo pede confirmação (RT-14)', (await texto('.dialogo')).includes('senha ou um token'));
  await c.espera(420);
  await clicarNoDialogo('Voltar e revisar');
  await dialogoFechado();
  await preencher('produto-descricao', 'App de teste');
  await c.espera(60);
  ok('fila aparece em Ideia', await c.avaliar(`Boolean(document.getElementById('produto-fila'))`));
  await preencher('produto-fila', '4');
  await c.espera(60);
  await salvarPainel();
  await esperarAviso('Produto criado.');
  await painelFechado();
  await c.ate(`document.querySelector('main table tbody tr')`);
  ok('entra na lista da marca', (await produtosNaTela())[0] === 'Lumi AppLUMI');
  ok('e no contador', (await texto('main')).includes('7 marcas · 6 produtos'));
  const lista = await opcoesDoContexto();
  ok('produto novo entra no contexto', lista.includes('Lumi App · provisório'), lista.join('|'));
});

await passo('ficha do produto', async () => {
  await c.clicar('main table tbody tr');
  await c.ate(`document.querySelector('main h1')?.textContent==='Lumi App'`);
  ok('a linha abre a ficha', true);
  const f = await texto('main');
  ok('dados do cadastro', f.includes('LUMI') && f.includes('App de teste') && f.includes('Kimberly Grebe') && f.includes('Ideia'));
  ok('entidade: a definir (RN-02.06)', f.includes('Entidade responsávelA definir'));
  ok('abas: Resumo, Atividades e Histórico', (await c.avaliar(`[...document.querySelectorAll('main [role=tab]')].map(t=>t.textContent).join('|')`)) === 'Resumo|Ferramentas|Atividades|Histórico');
  await c.clicar('main [role=tab]:nth-child(4)');
  await c.ate(`document.querySelector('main [role=tabpanel][data-state=active]').textContent.includes('criou o produto Lumi App')`);
  ok('aba Histórico', true);
  await c.clicar('texto=Marcas e produtos');
  await c.ate(`location.pathname==='${MARCAS}'`);
  await pronta();
  ok('voltar mantém a marca', (await texto('main section h2')) === 'Lumi');
});

await passo('fonte da marca', async () => {
  await ir(FICHA_KIPI);
  await c.ate(`document.querySelector('main h1')?.textContent==='Kipi'`);
  await c.espera(600);
  const fonte = await c.avaliar(`getComputedStyle(document.querySelector('main h1')).fontFamily`);
  ok('o nome do produto usa a fonte da marca (18 §3.2)', /fraunces/i.test(fonte), fonte);
  const corpo = await c.avaliar(`getComputedStyle(document.querySelector('main dl')).fontFamily`);
  ok('o resto segue na fonte da Central', !/fraunces/i.test(corpo), corpo);
  await c.foto('d-ficha-kipi');
  ok('faltando responsável, a ficha diz', (await texto('main')).includes('A definir: edite e escolha uma pessoa'));
  ok('Kipi tem usuários reais', (await texto('main')).includes('Tem usuários reaisSim'));
});

await passo('editar produto e descontinuar', async () => {
  await c.clicar('texto=Editar');
  await painelAberto();
  await c.espera(450);
  ok('avisa e pede a responsável', (await texto('.janela')).includes('Escolha uma pessoa') && (await valor('produto-responsavel')) === '');
  await escolher('produto-responsavel', ID_KIMBERLY);
  // M07 (RN-07.08): estágio, fila e situação mudam em Produtos, com critério e decisão. Descontinuar é coberto em m07.mjs.
  ok('estágio e situação ficam fora do cadastro básico', (await texto('.janela')).includes('mudam em Produtos') && !(await h.existeGrupo('Situação')));
  await salvarPainel();
  await esperarAviso('Produto atualizado.');
  await painelFechado();
  await c.clicar('main [role=tab]:nth-child(4)');
  await c.ate(`document.querySelector('main [role=tabpanel][data-state=active]').textContent.includes('Responsável: de não informado para Kimberly Grebe')`);
  ok('o histórico registra o que mudou', true);
});

await passo('vínculo com a responsável', async () => {
  await ir(`/configuracoes/cadastros/pessoas/${ID_KIMBERLY}`);
  await c.ate(`document.querySelector('main h1')?.textContent==='Kimberly Grebe'`);
  await c.clicar('texto=Inativar');
  await dialogoAberto();
  await c.espera(420);
  ok('a confirmação lista os produtos dela', (await texto('.dialogo')).includes('Responsável pelo produto Kipi'));
  await clicarNoDialogo('Voltar');
  await dialogoFechado();
});

await passo('arquivar', async () => {
  await irMarcas(`?marca=${ID_MARCA_KIPI}`);
  await c.clicar('button[aria-label="Arquivar Kipi"]');
  await dialogoAberto();
  await c.espera(420);
  const d = await texto('.dialogo');
  ok('marca com produto fica bloqueada', d.includes('Não dá para arquivar Kipi') && d.includes('Esta marca tem um produto: Kipi.'), d);
  await clicarNoDialogo('Entendi');
  await dialogoFechado();
  // arquiva o produto de Lumi, depois a marca
  await clicarMarca('Lumi');
  await c.clicar('main table tbody tr');
  await c.ate(`document.querySelector('main h1')?.textContent==='Lumi App'`);
  await c.clicar('texto=Arquivar');
  await dialogoAberto();
  await c.espera(420);
  await clicarNoDialogo('Arquivar produto');
  await esperarAviso('Produto arquivado.');
  await dialogoFechado();
  await c.ate(`document.querySelector('main').textContent.includes('está arquivado')`);
  ok('a ficha mostra e oferece restaurar', (await texto('main')).includes('Restaurar'));
  await irMarcas();
  await clicarMarca('Lumi');
  await c.clicar('button[aria-label="Arquivar Lumi"]');
  await dialogoAberto();
  await c.espera(420);
  ok('sem produtos, pede confirmação', (await texto('.dialogo')).includes('Arquivar Lumi?'));
  await clicarNoDialogo('Arquivar marca');
  await esperarAviso('Marca arquivada.');
  await dialogoFechado();
  ok('sai da lista', !(await nomesDasMarcas()).join().includes('Lumi'));
  await c.clicar('texto=Arquivados (2)');
  await c.ate(`document.querySelector('section[aria-label="Marcas arquivadas"] table')`);
  ok('Arquivados lista a marca e o produto', (await texto('main')).includes('Lumi') && (await texto('main')).includes('Lumi App'));
  await c.foto('e-arquivados');
  await c.clicar('section[aria-label="Marcas arquivadas"] button[aria-label="Restaurar Lumi"]');
  await esperarAviso('Marca restaurada.');
  await c.clicar('section[aria-label="Produtos arquivados"] button[aria-label="Restaurar Lumi App"]');
  await esperarAviso('Produto restaurado.');
  await c.ate(`document.querySelector('main').textContent.includes('Nenhum produto arquivado.')`);
  ok('dá para restaurar os dois', (await tabela('marca')).find((m) => m.nome === 'Lumi').arquivado_em === null);
});

await passo('restaurar exemplos', async () => {
  await ir('/configuracoes/dados');
  await c.ate(`[...document.querySelectorAll('main button')].some(b=>b.textContent==='Restaurar exemplos')`);
  await c.espera(200);
  await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent==='Restaurar exemplos').click()`);
  await dialogoAberto();
  await c.espera(420);
  await clicarNoDialogo('Restaurar exemplos');
  await dialogoFechado();
  await c.ate(`document.querySelector('main').textContent.includes('Registros151')`);
  ok('volta à carga inicial', (await tabela('marca')).length === 6 && (await tabela('produto')).length === 5);
});

await passo('dados de quem vinha da versão anterior', async () => {
  await c.avaliar(`(()=>{localStorage.removeItem('numa-central:v1:marca');localStorage.removeItem('numa-central:v1:produto');const m=JSON.parse(localStorage.getItem('numa-central:v1:meta'));m.versao_dados=3;m.contexto_id='zupi';localStorage.setItem('numa-central:v1:meta',JSON.stringify(m))})()`);
  await irMarcas();
  ok('marcas e produtos entram', (await tabela('marca')).length === 6);
  ok('versão atualizada', (await c.avaliar(`JSON.parse(localStorage.getItem('numa-central:v1:meta')).versao_dados`)) === 16);
  await c.ate(`document.querySelector('[aria-label^="Contexto"]').getAttribute('aria-label')==='Contexto: Zupi'`);
  ok('quem estava em um produto continua nele', true);
  await c.clicar('[aria-label^="Contexto"]');
  await c.ate(`document.querySelector('.menu-suspenso')`);
  await c.espera(150);
  await c.avaliar(`[...document.querySelectorAll('.menu-suspenso ul button')].find(b=>b.textContent.trim()==='Numa consolidada').click()`);
  await c.espera(100);
});

await passo('dados danificados', async () => {
  await c.avaliar(`localStorage.setItem('numa-central:v1:produto','{danificado')`);
  await ir(MARCAS);
  await c.ate(`document.querySelector('main').textContent.includes('Não deu para ler as marcas e os produtos.')`);
  ok('explica e aponta a saída', (await texto('main')).includes('aba Dados'));
  ok('o seletor de contexto não quebra', (await c.avaliar(`document.querySelector('[aria-label^="Contexto"]').getAttribute('aria-label')`)) === 'Contexto: Numa consolidada');
  await ir('/configuracoes/dados');
  await c.ate(`[...document.querySelectorAll('main button')].some(b=>b.textContent==='Restaurar exemplos')`);
  await c.espera(200);
  await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent==='Restaurar exemplos').click()`);
  await dialogoAberto();
  await c.espera(420);
  await clicarNoDialogo('Restaurar exemplos');
  await dialogoFechado();
  await irMarcas();
  ok('restaurar recupera', true);
});

for (const [l, a] of [[1440, 900], [1024, 768], [768, 1024], [360, 800]]) {
  await c.tamanho(l, a);
  await passo(`telas em ${l}px`, async () => {
    await irMarcas();
    await c.espera(250);
    await conferirTela('Marcas', l);
    await c.foto(`i-${l}-marcas`);
    await ir(FICHA_KIPI);
    await c.ate(`document.querySelector('main h1')?.textContent==='Kipi'`);
    await c.espera(300);
    await conferirTela('Ficha', l);
    await c.foto(`i-${l}-ficha`);
  });
}

await passo('celular', async () => {
  await c.tamanho(360, 800);
  await irMarcas();
  await c.espera(200);
  ok('marcas em fileira de pílulas, com rolagem só nela', await c.avaliar(`(()=>{const u=document.querySelector('nav[aria-label="Marcas"] ul');return u.scrollWidth>u.clientWidth&&document.documentElement.scrollWidth<=innerWidth})()`));
  ok('produtos em cartões', await c.avaliar(`document.querySelector('main ul[aria-label^="Produtos de"]').getBoundingClientRect().height>0&&document.querySelector('main table').getBoundingClientRect().height===0`));
  ok('o segundo nível rola até o item ativo', await c.avaliar(`(()=>{const a=document.querySelector('nav[aria-label="Cadastros base"] a[aria-current]').getBoundingClientRect();return a.left>=0&&a.right<=360})()`));
  await c.foto('j-marcas');
  await clicarMarca('Mimo');
  ok('escolher no celular funciona', (await texto('main section h2')) === 'Mimo');
  await c.espera(100);
  await c.clicar('main ul[aria-label^="Produtos de"] button');
  await c.ate(`document.querySelector('main h1')?.textContent==='Mimo'`);
  await c.espera(400);
  await c.foto('j-ficha');
  const barra = await c.avaliar(`(()=>{const e=[...document.querySelectorAll('main button')].filter(b=>b.textContent.includes('Editar')).find(b=>b.getBoundingClientRect().height>0);const r=e.getBoundingClientRect();return r.bottom<=innerHeight&&r.top>=0})()`);
  ok('ações em barra fixa', barra);
  await c.clicar('texto=Editar');
  await painelAberto();
  await c.espera(450);
  const p = await c.avaliar(`(()=>{const r=document.querySelector('.janela').getBoundingClientRect();return r.width===360&&r.height===800})()`);
  ok('formulário em tela inteira', p);
  await conferirTela('Formulário de produto', 360);
  await c.foto('j-painel');
  await c.tecla('Escape');
  await painelFechado();
  await irMarcas();
  await c.clicar('texto=Nova marca');
  await painelAberto();
  await c.espera(450);
  await conferirTela('Formulário de marca', 360);
  await c.foto('j-painel-marca');
  await c.tecla('Escape');
  await painelFechado();
});

await c.tamanho(1440, 900);
await passo('teclado', async () => {
  await irMarcas();
  await c.avaliar(`document.querySelector('nav[aria-label="Marcas"] button').focus()`);
  await c.tecla('Enter');
  await c.ate(`document.querySelector('main section h2')?.textContent==='Numa'`);
  ok('dá para escolher a marca pelo teclado', true);
  await c.avaliar(`document.querySelector('button[aria-label="Editar Numa"]').focus()`);
  await c.tecla('Enter');
  await painelAberto();
  await c.espera(450);
  ok('a institucional explica e esconde o que não muda', (await texto('.janela')).includes('marca institucional') && !(await h.existeGrupo('Situação')) && !(await h.existeGrupo('Nome provisório')));
  await c.tecla('Escape');
  await painelFechado();
  await c.espera(100);
  ok('Esc fecha e o foco volta ao botão', await c.avaliar(`document.activeElement.getAttribute('aria-label')==='Editar Numa'`));
});

await h.terminar();
