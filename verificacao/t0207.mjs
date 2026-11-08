// Verificação de T02.07 (Categorias), T02.08 (Contas), T02.09 (Calendário) e T02.10 (Etiquetas) no sistema real.
import { iniciar, ID_CAMILA, ID_KIMBERLY } from './apoio.mjs';

const CATEGORIAS = '/financeiro/categorias';
const CONTAS = '/financeiro/contas/cadastro';
const CALENDARIO = '/configuracoes/cadastros/calendario';
const ETIQUETAS = '/configuracoes/cadastros/etiquetas';
const ENTIDADES = '/configuracoes/cadastros/entidades';
const ID_PLANEJADA = 'd5f3b4a7-ae62-4d43-9f34-3c4d5e6f7a01';
const ANO = new Date().getFullYear();
const PROXIMO = ANO + 1;

const h = await iniciar({ nome: 't0207', porta: 9350 });
const { c, ok, passo, ir, texto, valor, preencher, escolher, opcoes, esperarAviso, idPorRotulo, marcarPilula, pilulaMarcada, clicarNoDialogo, dialogoAberto, dialogoFechado, painelAberto, painelFechado, pularAbertura, tabela, conferirTela, erroDe, existeGrupo } = h;

const js = (v) => JSON.stringify(v);
const pronta = () => c.ate(`document.querySelector('main table tbody tr, main ul[aria-label] li, main section, main .marca-agua, main h2')`);
const irPara = async (caminho) => { await ir(caminho); await pronta(); };
const salvarPainel = () => c.avaliar(`document.querySelector('.janela button[type=submit]').click()`);
const abrirPainel = async (rotulo) => { await c.clicar(`texto=${rotulo}`); await painelAberto(); await c.espera(450); };
const painelTemErro = (parte) => c.ate(`document.querySelector('.janela [role=alert]')?.textContent.includes(${js(parte)})`);
const salvarESaber = async (avisoEsperado) => { await salvarPainel(); await esperarAviso(avisoEsperado); await painelFechado(); };
const descartar = async () => {
  await c.tecla('Escape');
  await c.ate(`!document.querySelector('.janela') || document.querySelector('.dialogo')`);
  if (await c.avaliar(`Boolean(document.querySelector('.dialogo'))`)) { await c.espera(350); await clicarNoDialogo('Descartar alterações'); await dialogoFechado(); }
  await painelFechado();
};
const clicarRotulo = async (rotulo) => { await c.avaliar(`document.querySelector(${js(`[aria-label="${rotulo}"]`)}).click()`); };
const botao = (rotulo) => c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()===${js(rotulo)}&&b.getBoundingClientRect().height>0).click()`);
const preencherBusca = (novo) => c.avaliar(`(()=>{const e=document.querySelector('main input[type=search]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${js(novo)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`);
const pilulaFiltro = (rotulo) => c.avaliar(`[...document.querySelectorAll('main button[aria-pressed]')].find(b=>b.textContent.startsWith(${js(rotulo)})).click()`);
const grupos = () => c.avaliar(`[...document.querySelectorAll('main section h2')].map(t=>t.textContent)`);
const noGrupo = (grupo) => c.avaliar(`[...document.querySelectorAll('main section')].find(s=>s.querySelector('h2')?.textContent===${js(grupo)})?.textContent ?? ''`);
const linhas = () => c.avaliar(`[...document.querySelectorAll('main table tbody tr')].map(t=>t.textContent)`);
const quantasLinhas = (n) => c.ate(`document.querySelectorAll('main table tbody tr').length===${n}`);
const linhaDe = (nome) => c.avaliar(`[...document.querySelectorAll('main table tbody tr')].find(t=>t.textContent.includes(${js(nome)}))?.textContent ?? ''`);
const mudarTabela = (nome, corpo) => c.avaliar(`(()=>{const k='numa-central:v1:${nome}';const l=JSON.parse(localStorage.getItem(k));${corpo};localStorage.setItem(k,JSON.stringify(l))})()`);
const restaurarExemplos = async () => {
  await ir('/configuracoes/dados');
  await c.ate(`[...document.querySelectorAll('main button')].some(b=>b.textContent==='Restaurar exemplos')`);
  await c.espera(200);
  await botao('Restaurar exemplos');
  await dialogoAberto();
  await c.espera(420);
  await clicarNoDialogo('Restaurar exemplos');
  await dialogoFechado();
  await c.ate(`document.querySelector('main').textContent.includes('Registros151')`);
};

await c.tamanho(1440, 900);

await passo('navegação', async () => {
  await ir(CATEGORIAS);
  await pularAbertura();
  await pronta();
  ok('Categorias é uma aba do Financeiro (decisão de 07/11/2026)', await c.avaliar(`Boolean(document.querySelector('nav[aria-label="Seções do financeiro"] a[href="/financeiro/categorias"][aria-current]'))`));
  for (const [caminho, titulo, aba] of [[CATEGORIAS, 'Categorias financeiras', 'Categorias financeiras'], [CONTAS, 'Contas financeiras', 'Contas financeiras'], [CALENDARIO, 'Calendário e feriados', 'Calendário e feriados'], [ETIQUETAS, 'Etiquetas', 'Etiquetas']]) {
    await ir(caminho);
    await c.ate(`document.querySelector('main h1')?.textContent===${js(titulo)}`);
    ok(`${titulo}: o título da aba diz a tela`, (await c.avaliar(`document.title`)).startsWith(aba), await c.avaliar(`document.title`));
  }
});

// ---------- T02.07 ----------

await passo('categorias: árvore', async () => {
  await irPara(CATEGORIAS);
  await c.ate(`document.querySelector('main section h2')`);
  const m = await texto('main');
  ok('título e totais', m.includes('8 grupos · 35 categorias'), m.slice(0, 200));
  ok('os 8 grupos, na ordem da especificação', (await grupos()).join('|') === 'Infraestrutura e software|Serviços de terceiros|Marketing|Administrativo|Pessoal / sócias|Receitas|Movimentos societários|Transferências', (await grupos()).join('|'));
  const infra = await noGrupo('Infraestrutura e software');
  ok('as categorias dentro do grupo', infra.includes('Hospedagem e nuvem') && infra.includes('Lojas de aplicativos (contas de desenvolvedor)') && infra.includes('Outras assinaturas'));
  ok('o tipo aparece no grupo', infra.includes('Despesa') && (await noGrupo('Receitas')).includes('Receita'));
  ok('fora do resultado fica dito', (await noGrupo('Movimentos societários')).includes('Fora do resultado') && (await noGrupo('Transferências')).includes('Fora do resultado') && !infra.includes('Fora do resultado'));
  ok('natureza vazia, sem inventar', infra.includes('A definir') && m.includes('25 categorias de despesa estão sem natureza do custo'));
  ok('receita não tem natureza', !(await noGrupo('Receitas')).includes('A definir'));
  ok('os filtros dizem quantas de cada tipo', m.includes('Todas35') && m.includes('Despesas25') && m.includes('Receitas6') && m.includes('Movimentos societários3') && m.includes('Transferências1'));
  ok('colunas de cada grupo alinhadas', await c.avaliar(`(()=>{const t=[...document.querySelectorAll('main section table')];const pos=t.map(x=>Math.round(x.querySelectorAll('thead th')[1].getBoundingClientRect().left));return new Set(pos).size===1})()`));
  await c.foto('a-categorias');
});

await passo('categorias: filtros', async () => {
  await preencherBusca('domínios');
  await c.ate(`document.querySelectorAll('main section').length===1`);
  ok('busca pela categoria, ignorando acento', (await grupos())[0] === 'Infraestrutura e software' && (await c.avaliar(`document.querySelectorAll('main section table tbody tr').length`)) === 1);
  await preencherBusca('MARKETING');
  await c.ate(`document.querySelector('main section h2')?.textContent==='Marketing'`);
  ok('busca pelo grupo mostra todas as dele', (await c.avaliar(`document.querySelectorAll('main section table tbody tr').length`)) === 4);
  await preencherBusca('ninguém');
  await c.ate(`document.querySelector('main').textContent.includes('Nada com esses filtros.')`);
  ok('vazio por filtro', true);
  await preencherBusca('');
  await pilulaFiltro('Transferências');
  await c.ate(`document.querySelectorAll('main section').length===1`);
  ok('filtro de tipo', (await grupos())[0] === 'Transferências');
  await pilulaFiltro('Todas');
  await c.ate(`document.querySelectorAll('main section').length===8`);
  await botao('Ver quais');
  await c.ate(`document.querySelector('main').textContent.includes('Natureza: A definir')`);
  ok('"Ver quais" filtra as que faltam', !(await grupos()).includes('Receitas') && (await grupos()).includes('Marketing'));
  ok('o aviso sai enquanto filtra por ele', !(await texto('main')).includes('sem natureza do custo. Ela orienta'));
  await c.clicar('button[aria-label="Remover filtro: Natureza: A definir"]');
  await c.ate(`document.querySelectorAll('main section').length===8`);
  await c.clicar('texto=Filtros');
  await c.ate(`document.querySelector('.menu-suspenso')`);
  await c.espera(150);
  await c.foto('b-filtros');
  await marcarPilula('Situação', 'Inativas');
  await c.ate(`document.querySelector('main').textContent.includes('Nada com esses filtros.')`);
  ok('sem inativas por enquanto', true);
  await marcarPilula('Situação', 'Todas');
  await c.tecla('Escape');
  await c.ate(`!document.querySelector('.menu-suspenso')`);
});

await passo('categorias: cadastrar', async () => {
  await irPara(CATEGORIAS);
  await c.ate(`document.querySelector('main section h2')`);
  await c.clicar('button[aria-label="Nova categoria em Marketing"]');
  await painelAberto();
  await c.espera(450);
  ok('já vem no grupo escolhido', (await valor('categoria-grupo')) === (await c.avaliar(`[...document.querySelectorAll('#categoria-grupo option')].find(o=>o.textContent==='Marketing').value`)));
  ok('com o tipo do grupo', (await valor(await idPorRotulo('Tipo'))) === 'despesa');
  ok('as naturezas da especificação', (await opcoes('categoria-natureza')).join('|') === 'Escolha a natureza|Direto do produto|Compartilhado|Investimento|Operacional da Numa', (await opcoes('categoria-natureza')).join('|'));
  await c.foto('c-formulario');
  await salvarPainel();
  await painelTemErro('Informe o nome.');
  ok('nome obrigatório, com resumo', (await texto('.janela [role=alert]')).includes('Escolha a natureza do custo.'));
  await preencher('categoria-nome', 'eventos');
  await escolher('categoria-natureza', 'direto');
  await salvarPainel();
  await c.ate(`document.getElementById('categoria-nome-erro')?.textContent.includes('Já existe')`);
  ok('nome único no grupo (Único pai_id, nome)', (await erroDe('categoria-nome')).includes('Já existe “Eventos” neste grupo.'), await erroDe('categoria-nome'));
  await preencher('categoria-nome', 'Podcasts');
  await salvarPainel();
  await esperarAviso('Categoria criada.');
  await painelFechado();
  await c.ate(`document.querySelector('main').textContent.includes('Podcasts')`);
  const m = await noGrupo('Marketing');
  ok('entra no grupo, com a natureza por extenso', m.includes('Podcasts') && m.includes('Direto do produto'));
  ok('os totais acompanham', (await texto('main')).includes('8 grupos · 36 categorias'));
  const nova = (await tabela('categoria_financeira')).find((x) => x.nome === 'Podcasts');
  ok('grava com a natureza e sem marca de exemplo', nova.natureza_custo === 'direto' && nova.tipo === 'despesa' && nova.exemplo === false);

  // o mesmo nome em outro grupo pode
  await c.clicar('button[aria-label="Nova categoria em Administrativo"]');
  await painelAberto();
  await c.espera(450);
  await preencher('categoria-nome', 'Podcasts');
  await escolher('categoria-natureza', 'operacional');
  await salvarESaber('Categoria criada.');
  ok('o mesmo nome pode em outro grupo', (await tabela('categoria_financeira')).filter((x) => x.nome === 'Podcasts').length === 2);

  // grupo novo
  await abrirPainel('Nova categoria');
  ok('sem grupo, explica que vira grupo', (await texto('.janela')).includes('Sem grupo, esta linha vira um novo grupo.'));
  await preencher('categoria-nome', 'Marketing');
  await salvarPainel();
  await c.ate(`document.getElementById('categoria-nome-erro')?.textContent.includes('Já existe')`);
  ok('nome único entre os grupos', (await erroDe('categoria-nome')).includes('Já existe um grupo “Marketing”.'));
  await preencher('categoria-nome', 'Viagens');
  await salvarESaber('Categoria criada.');
  await c.ate(`[...document.querySelectorAll('main section h2')].some(t=>t.textContent==='Viagens')`);
  ok('grupo novo, vazio, diz que está vazio', (await noGrupo('Viagens')).includes('Nenhuma categoria neste grupo.'));
  ok('grupo não precisa de natureza', (await tabela('categoria_financeira')).find((x) => x.nome === 'Viagens').natureza_custo === null);
});

await passo('categorias: editar e 2 níveis', async () => {
  await irPara(CATEGORIAS);
  await c.ate(`document.querySelector('main section h2')`);
  await clicarRotulo('Editar Marketing');
  await painelAberto();
  await c.espera(450);
  const p = await texto('.janela');
  ok('grupo: título e aviso dos 2 níveis, sem seletor de grupo', p.includes('Editar grupo') && p.includes('com 5 categorias') && p.includes('A árvore só tem 2 níveis') && !(await c.avaliar(`Boolean(document.getElementById('categoria-grupo'))`)), p.slice(0, 200));
  await marcarPilula('Situação', 'Inativa');
  await c.ate(`document.querySelector('.janela').textContent.includes('também deixam de ser oferecidas')`);
  ok('inativar o grupo avisa sobre as categorias', true);
  await c.foto('d-grupo');
  await salvarESaber('Categoria atualizada.');
  await c.ate(`[...document.querySelectorAll('main section')].find(s=>s.querySelector('h2')?.textContent==='Marketing').querySelector('h2').parentElement.textContent.includes('Inativa')`);
  ok('o grupo mostra que está inativo', true);
  await clicarRotulo('Editar Marketing');
  await painelAberto();
  await c.espera(450);
  await marcarPilula('Situação', 'Ativa');
  await salvarESaber('Categoria atualizada.');

  // categoria muda de grupo: o tipo acompanha
  await c.avaliar(`[...document.querySelectorAll('main section')].find(s=>s.querySelector('h2')?.textContent==='Viagens').scrollIntoView()`);
  await c.avaliar(`document.querySelector('[aria-label="Nova categoria em Viagens"]').click()`);
  await painelAberto();
  await c.espera(450);
  await preencher('categoria-nome', 'Passagens');
  await escolher('categoria-natureza', 'operacional');
  await salvarESaber('Categoria criada.');
  await c.ate(`document.querySelector('[aria-label="Editar Passagens"]')`);
  await clicarRotulo('Editar Passagens');
  await painelAberto();
  await c.espera(450);
  ok('título de edição', (await texto('.janela h2')).includes('Editar categoria'));
  ok('o grupo atual fora das opções de si mesma', !(await opcoes('categoria-grupo')).includes('Passagens'));
  const idReceitas = await c.avaliar(`[...document.querySelectorAll('#categoria-grupo option')].find(o=>o.textContent==='Receitas').value`);
  await escolher('categoria-grupo', idReceitas);
  await c.espera(80);
  ok('escolher o grupo traz o tipo dele', (await valor(await idPorRotulo('Tipo'))) === 'receita');
  ok('natureza some em quem não é despesa', !(await c.avaliar(`Boolean(document.getElementById('categoria-natureza'))`)));
  await escolher(await idPorRotulo('Tipo'), 'despesa');
  await c.espera(80);
  await escolher('categoria-natureza', 'operacional');
  await salvarPainel();
  await c.ate(`document.querySelector('.dialogo')?.textContent.includes('Salvar mesmo assim?')`);
  ok('tipo diferente do grupo só avisa', (await texto('.dialogo')).includes('O grupo Receitas é de Receita, e esta categoria é de Despesa.'), await texto('.dialogo'));
  await c.espera(350);
  await clicarNoDialogo('Voltar e revisar');
  await dialogoFechado();
  await descartar();
});

await passo('categorias: arquivar', async () => {
  await irPara(CATEGORIAS);
  await c.ate(`document.querySelector('main section h2')`);
  await clicarRotulo('Arquivar Marketing');
  await dialogoAberto();
  await c.espera(350);
  const d = await texto('.dialogo');
  ok('grupo com categorias não arquiva e diz quais', d.includes('Não dá para arquivar Marketing') && d.includes('Categoria Eventos') && d.includes('inative'), d);
  ok('só um botão', (await c.avaliar(`document.querySelectorAll('.dialogo button').length`)) === 1);
  await c.foto('e-bloqueio');
  await clicarNoDialogo('Entendi');
  await dialogoFechado();
  await clicarRotulo('Arquivar Eventos');
  await dialogoAberto();
  await c.espera(350);
  ok('sem vínculos, pede confirmação', (await texto('.dialogo')).includes('Arquivar Eventos?'));
  await clicarNoDialogo('Arquivar categoria');
  await esperarAviso('Categoria arquivada.');
  await dialogoFechado();
  await c.ate(`!document.querySelector('[aria-label="Editar Eventos"]')`);
  ok('sai da árvore', !(await noGrupo('Marketing')).includes('Eventos'));
  await botao('Arquivados (1)');
  await c.ate(`document.querySelector('main table tbody tr')?.textContent.includes('Eventos')`);
  ok('aparece em Arquivados, com o tipo', (await linhas())[0].includes('Despesa'));
  ok('sem filtros na visão de arquivados', !(await c.avaliar(`Boolean(document.querySelector('main input[type=search]'))`)));
  await c.foto('e-arquivados');
  await c.clicar('button[aria-label="Restaurar Eventos"]');
  await esperarAviso('Categoria restaurada.');
  await c.ate(`document.querySelector('main').textContent.includes('Nenhuma categoria arquivada.')`);
  ok('dá para restaurar', (await tabela('categoria_financeira')).find((x) => x.nome === 'Eventos').arquivado_em === null);
  await botao('Voltar às categorias ativas');
  await c.ate(`document.querySelector('main section h2')`);
  ok('volta à árvore', (await grupos()).includes('Marketing'));
});

// ---------- T02.08 ----------

await passo('contas: lista', async () => {
  await irPara(CONTAS);
  await c.ate(`document.querySelector('main table tbody tr')`);
  const m = await texto('main');
  ok('título e total', (await texto('main h1')) === 'Contas financeiras' && m.includes('2 contas'));
  const cab = await c.avaliar(`[...document.querySelectorAll('main thead th')].map(t=>t.textContent)`);
  ok('colunas da especificação', cab.slice(0, 8).join('|') === 'Conta|Tipo|Titular|Instituição|Final|Moeda|Saldo inicial|Situação', cab.join('|'));
  const l = await linhas();
  ok('as duas contas pessoais de 17 §6, em ordem', l[0].startsWith('Cartão pessoal — Camila') && l[1].startsWith('Cartão pessoal — Kimberly'), l.join('|'));
  ok('tipo e titular', l[1].includes('Conta pessoal de sócia') && l[1].includes('Kimberly Grebe'));
  ok('sem instituição, final nem saldo inventados', await c.avaliar(`[...document.querySelectorAll('main table tbody tr')].every(t=>t.children[3].textContent==='—'&&t.children[4].textContent==='—'&&t.children[6].textContent==='—')`));
  ok('o filtro diz quantas', m.includes('Pessoais de sócia2') && m.includes('Bancárias0') && m.includes('Caixa0'), m.slice(0, 400));
  await c.foto('f-contas');
  await preencherBusca('camila');
  await quantasLinhas(1);
  ok('busca pelo titular', (await linhas())[0].includes('Camila'));
  await preencherBusca('');
  await quantasLinhas(2);
  await pilulaFiltro('Cartões');
  await c.ate(`document.querySelector('main').textContent.includes('Nada com esses filtros.')`);
  ok('filtro de tipo', true);
  await pilulaFiltro('Todas');
  await quantasLinhas(2);
});

await passo('contas: formulário', async () => {
  await abrirPainel('Nova conta');
  ok('título', (await texto('.janela h2')).includes('Nova conta'));
  ok('conta bancária e moeda padrão', (await valor('conta-tipo')) === 'banco' && (await valor('conta-moeda')) === 'BRL');
  ok('os tipos da especificação', (await opcoes('conta-tipo')).join('|') === 'Conta bancária|Cartão de crédito|Carteira digital|Conta pessoal de sócia|Caixa', (await opcoes('conta-tipo')).join('|'));
  ok('sem situação ao criar', !(await existeGrupo('Situação')));
  ok('banco pede saldo e data', await c.avaliar(`Boolean(document.getElementById('conta-saldo')&&document.getElementById('conta-data-saldo'))`));
  await c.foto('g-formulario');
  await salvarPainel();
  await painelTemErro('Informe o nome.');
  const r = await texto('.janela [role=alert]');
  ok('obrigatórios, todos no resumo', r.includes('Escolha o titular.') && r.includes('Informe o saldo inicial.') && r.includes('Informe a data do saldo.'), r);
  await c.foto('g-erros');
  const titulares = await opcoes('conta-titular');
  ok('titular: sócias e entidades', titulares.join('|') === 'Escolha o titular|Kimberly Grebe|Camila Lima|Planejada — Numa', titulares.join('|'));

  await preencher('conta-nome', 'Cartão 4111 1111 1111 1111');
  await salvarPainel();
  await c.ate(`document.getElementById('conta-nome-erro')?.textContent.includes('número completo')`);
  ok('nome com número de cartão é barrado (RT-14)', true);
  await preencher('conta-nome', 'Conta PJ Numa');
  await preencher('conta-instituicao', '5500-0000-0000-0004');
  await salvarPainel();
  await c.ate(`document.getElementById('conta-instituicao-erro')?.textContent.includes('número completo')`);
  ok('instituição com número de cartão é barrada', true);
  await preencher('conta-instituicao', 'Banco Teste');
  await preencher('conta-final', '12a34');
  ok('final só com dígitos', (await valor('conta-final')) === '1234', await valor('conta-final'));
  await preencher('conta-final', '123');
  await salvarPainel();
  await c.ate(`document.getElementById('conta-final-erro')?.textContent.includes('4 últimos')`);
  ok('final precisa de 4 dígitos', true);
  await preencher('conta-final', '1234');
  await preencher('conta-saldo', 'muito');
  await salvarPainel();
  await c.ate(`document.getElementById('conta-saldo-erro')?.textContent.includes('Use só números')`);
  ok('saldo em formato errado', true);

  // conta pessoal
  await escolher('conta-titular', `entidade:${ID_PLANEJADA}`);
  await escolher('conta-tipo', 'pessoal_socia');
  await c.espera(100);
  ok('conta pessoal limpa a entidade escolhida', (await valor('conta-titular')) === '');
  ok('conta pessoal só oferece sócias', (await opcoes('conta-titular')).join('|') === 'Escolha a sócia|Kimberly Grebe|Camila Lima', (await opcoes('conta-titular')).join('|'));
  ok('o rótulo vira Sócia, e explica o aporte ou reembolso', await c.avaliar(`[...document.querySelectorAll('.janela label')].some(l=>l.textContent.startsWith('Sócia'))&&document.querySelector('.janela').textContent.includes('aporte ou reembolso')`));
  ok('conta pessoal não tem saldo', !(await c.avaliar(`Boolean(document.getElementById('conta-saldo'))`)));
  await c.foto('g-pessoal');
  await escolher('conta-tipo', 'cartao');
  await c.espera(100);
  ok('cartão explica que não tem saldo', !(await c.avaliar(`Boolean(document.getElementById('conta-saldo'))`)) && (await texto('.janela')).includes('não têm saldo controlado'));
  await escolher('conta-tipo', 'banco');
  await c.espera(100);

  await escolher('conta-titular', `entidade:${ID_PLANEJADA}`);
  await preencher('conta-saldo', '1.000,50');
  await preencher('conta-data-saldo', `${ANO}-11-01`);
  await salvarESaber('Conta criada.');
  await quantasLinhas(3);
  const pj = (await tabela('conta_financeira')).find((x) => x.nome === 'Conta PJ Numa');
  ok('grava o valor como número, e o titular certo', pj.saldo_inicial === 1000.5 && pj.titular_entidade_id === ID_PLANEJADA && pj.titular_pessoa_id === null && pj.final_numero === '1234' && pj.exemplo === false, JSON.stringify(pj));
  const linha = await linhaDe('Conta PJ Numa');
  ok('a linha mostra tudo', linha.includes('Planejada — Numa') && linha.includes('Banco Teste') && linha.includes('1234') && linha.includes('BRL') && linha.includes('1.000,50'), linha);

  // nome igual só avisa
  await abrirPainel('Nova conta');
  await preencher('conta-nome', 'conta pj numa');
  await escolher('conta-tipo', 'cartao');
  await c.espera(80);
  await escolher('conta-titular', `pessoa:${ID_KIMBERLY}`);
  await salvarPainel();
  await c.ate(`document.querySelector('.dialogo')?.textContent.includes('Salvar mesmo assim?')`);
  ok('nome igual só avisa', (await texto('.dialogo')).includes('Já existe uma conta chamada conta pj numa.'));
  await c.espera(350);
  await clicarNoDialogo('Voltar e revisar');
  await dialogoFechado();
  await descartar();
});

await passo('contas: editar e encerrar', async () => {
  await clicarRotulo('Editar Conta PJ Numa');
  await painelAberto();
  await c.espera(450);
  ok('o formulário vem preenchido', (await valor('conta-nome')) === 'Conta PJ Numa' && (await valor('conta-saldo')) === '1.000,50' && (await valor('conta-titular')) === `entidade:${ID_PLANEJADA}` && (await valor('conta-final')) === '1234');
  ok('situação ao editar', await pilulaMarcada('Situação', 'Ativa'));
  await marcarPilula('Situação', 'Encerrada');
  await c.ate(`Boolean(document.getElementById('conta-motivo'))`);
  ok('encerrar com saldo pede motivo', (await texto('.janela')).includes('A conta ainda tem saldo.'));
  await c.foto('g-encerrar');
  await salvarPainel();
  await c.ate(`document.getElementById('conta-motivo-erro')?.textContent.includes('Informe o motivo')`);
  ok('sem motivo, não salva', (await tabela('conta_financeira')).find((x) => x.nome === 'Conta PJ Numa').situacao === 'ativa');
  await preencher('conta-saldo', '0,00');
  await c.ate(`!document.getElementById('conta-motivo')`);
  ok('saldo zero dispensa o motivo', true);
  await preencher('conta-saldo', '1.000,50');
  await c.ate(`Boolean(document.getElementById('conta-motivo'))`);
  await preencher('conta-motivo', 'Agência fechou');
  await salvarESaber('Conta atualizada.');
  await c.ate(`[...document.querySelectorAll('main table tbody tr')].find(t=>t.textContent.includes('Conta PJ Numa')).textContent.includes('Encerrada')`);
  ok('fica encerrada, e continua na lista', true);
  await c.clicar('texto=Filtros');
  await c.ate(`document.querySelector('.menu-suspenso')`);
  await c.espera(150);
  await marcarPilula('Situação', 'Encerradas');
  await quantasLinhas(1);
  ok('filtro de situação', (await linhas())[0].includes('Conta PJ Numa'));
  await c.tecla('Escape');
  await c.ate(`!document.querySelector('.menu-suspenso')`);
  await c.espera(100);
  await c.clicar('button[aria-label="Remover filtro: Situação: Encerrada"]');
  await quantasLinhas(3);
  // reabrir não pede motivo
  await clicarRotulo('Editar Conta PJ Numa');
  await painelAberto();
  await c.espera(450);
  await marcarPilula('Situação', 'Ativa');
  await salvarESaber('Conta atualizada.');
  ok('reabrir não pede motivo', (await tabela('conta_financeira')).find((x) => x.nome === 'Conta PJ Numa').situacao === 'ativa');
  // arquivar
  await clicarRotulo('Arquivar Conta PJ Numa');
  await dialogoAberto();
  await c.espera(350);
  ok('arquivar pede confirmação e sugere encerrar', (await texto('.dialogo')).includes('prefira encerrar'));
  await clicarNoDialogo('Arquivar conta');
  await esperarAviso('Conta arquivada.');
  await dialogoFechado();
  await quantasLinhas(2);
  await botao('Arquivados (1)');
  await c.ate(`document.querySelector('main table tbody tr')?.textContent.includes('Conta PJ Numa')`);
  await c.clicar('button[aria-label="Restaurar Conta PJ Numa"]');
  await esperarAviso('Conta restaurada.');
  await c.ate(`document.querySelector('main').textContent.includes('Nenhuma conta arquivada.')`);
  ok('dá para restaurar', true);
  await botao('Voltar às contas ativas');
  await quantasLinhas(3);
  ok('o histórico registra o motivo', true);
  await ir('/configuracoes/dados');
  await c.ate(`document.querySelector('main').textContent.includes('Conta PJ Numa')`);
  const dados = await texto('main');
  ok('o histórico registra o motivo e não mostra o saldo', dados.includes('Motivo: Agência fechou') && dados.includes('restaurou a conta Conta PJ Numa') && !dados.includes('1.000,50'), dados.slice(0, 900));
});

await passo('contas: titular fora da lista e vínculos', async () => {
  await mudarTabela('pessoa', `l.find(x=>x.id==='${ID_CAMILA}').situacao='inativa'`);
  await irPara(CONTAS);
  await c.ate(`document.querySelector('main table tbody tr')`);
  const linha = await linhaDe('Cartão pessoal — Camila');
  ok('a lista avisa, com o nome', linha.includes('Camila Lima') && linha.includes('Escolha outro titular'), linha);
  await clicarRotulo('Editar Cartão pessoal — Camila');
  await painelAberto();
  await c.espera(450);
  ok('o formulário pede outro, sem trocar sozinho', (await texto('.janela')).includes('O titular desta conta não está mais na lista.') && (await valor('conta-titular')) === '');
  await salvarPainel();
  await painelTemErro('Escolha a sócia.');
  ok('não salva sem titular', true);
  await descartar();
  await mudarTabela('pessoa', `l.find(x=>x.id==='${ID_CAMILA}').situacao='ativa'`);

  await irPara(ENTIDADES);
  await c.ate(`document.querySelector('main table tbody tr')`);
  await c.clicar('button[aria-label="Arquivar Planejada — Numa"]');
  await dialogoAberto();
  await c.espera(350);
  ok('entidade com conta não arquiva', (await texto('.dialogo')).includes('Conta Conta PJ Numa'), await texto('.dialogo'));
  await clicarNoDialogo('Entendi');
  await dialogoFechado();

  await ir(`/configuracoes/cadastros/pessoas/${ID_KIMBERLY}`);
  await c.ate(`document.querySelector('main h1')?.textContent==='Kimberly Grebe'`);
  await botao('Arquivar');
  await dialogoAberto();
  await c.espera(350);
  ok('a sócia com conta tem vínculo', (await texto('.dialogo')).includes('Titular da conta Cartão pessoal — Kimberly'), await texto('.dialogo'));
  await clicarNoDialogo('Entendi');
  await dialogoFechado();
});

// ---------- T02.09 ----------

await passo('calendário: lista', async () => {
  await irPara(CALENDARIO);
  await quantasLinhas(15);
  const m = await texto('main');
  ok('título e total do ano', (await texto('main h1')) === 'Calendário e feriados' && m.includes(`15 feriados em ${ANO}`), m.slice(0, 220));
  ok('abre no ano atual, oferecendo o próximo', (await valor('calendario-ano')) === String(ANO) && (await opcoes('calendario-ano')).join('|') === `${ANO}|${PROXIMO}`, (await opcoes('calendario-ano')).join('|'));
  const cab = await c.avaliar(`[...document.querySelectorAll('main thead th')].map(t=>t.textContent)`);
  ok('colunas', cab.slice(0, 5).join('|') === 'Data|Dia da semana|Feriado|Abrangência|Local', cab.join('|'));
  const l = await linhas();
  ok('em ordem de data', l[0].startsWith(`01/01/${ANO}`) && l[0].includes('Confraternização Universal') && l[14].startsWith(`25/12/${ANO}`), l[0]);
  ok('São Sebastião: municipal, no Rio', (await linhaDe('São Sebastião')).includes('Municipal') && (await linhaDe('São Sebastião')).includes('Rio de Janeiro · RJ'));
  ok('São Jorge: estadual, no RJ', (await linhaDe('São Jorge')).includes('Estadual') && (await linhaDe('São Jorge')).includes('RJ'));
  ok('o dia da semana por extenso', /(domingo|segunda-feira|terça-feira|quarta-feira|quinta-feira|sexta-feira|sábado)/.test(l[0]));
  ok('Carnaval, Sexta-feira Santa e Corpus Christi entram', ['Carnaval (segunda-feira)', 'Carnaval (terça-feira)', 'Sexta-feira Santa', 'Corpus Christi'].every((nome) => l.some((x) => x.includes(nome))));
  ok('os filtros dizem quantos', m.includes('Todos15') && m.includes('Nacionais13') && m.includes('Estaduais1') && m.includes('Municipais1'), m.slice(0, 400));
  await c.foto('h-calendario');
  await pilulaFiltro('Municipais');
  await quantasLinhas(1);
  ok('filtro de abrangência', (await linhas())[0].includes('São Sebastião'));
  await pilulaFiltro('Todos');
  await quantasLinhas(15);
});

await passo('calendário: carregar o ano', async () => {
  await botao(`Carregar feriados de ${ANO}`);
  await dialogoAberto();
  await c.espera(350);
  const d = await texto('.dialogo');
  ok('ano completo: diz que não há nada a acrescentar', d.includes(`Os feriados de ${ANO} já estão aqui`), d);
  ok('só um botão', (await c.avaliar(`document.querySelectorAll('.dialogo button').length`)) === 1);
  await clicarNoDialogo('Entendi');
  await dialogoFechado();

  await escolher('calendario-ano', String(PROXIMO));
  await c.ate(`document.querySelector('main').textContent.includes('Nenhum feriado em ${PROXIMO}.')`);
  ok('ano vazio explica e oferece carregar', (await texto('main')).includes('Carregue os feriados do ano'));
  await c.foto('h-vazio');
  await botao(`Carregar feriados de ${PROXIMO}`);
  await dialogoAberto();
  await c.espera(350);
  const previa = await texto('.dialogo');
  ok('confere antes de confirmar (P6)', previa.includes('Confira antes de confirmar') && previa.includes('a partir da Páscoa'), previa.slice(0, 300));
  const celulas = await c.avaliar(`[...document.querySelectorAll('.dialogo tbody tr')].map(t=>t.textContent)`);
  ok('todos como novos', celulas.length === 15 && celulas.every((x) => x.endsWith('Novo')), celulas.join('|').slice(0, 300));
  ok('nada grava antes de confirmar', !(await tabela('feriado')).some((x) => x.data.startsWith(String(PROXIMO))));
  ok('estadual e municipal aparecem no nome', celulas.some((x) => x.startsWith('Dia de São Jorge (estadual)')) && celulas.some((x) => x.startsWith('Dia de São Sebastião (municipal)')), celulas.join('|').slice(0, 300));
  ok('confirmar fica à vista, mesmo com a lista longa', await c.avaliar(`(()=>{const d=document.querySelector('.dialogo').getBoundingClientRect();const b=[...document.querySelectorAll('.dialogo button')].find(x=>x.textContent.includes('Carregar 15')).getBoundingClientRect();return b.bottom<=d.bottom&&b.top>=d.top})()`));
  await c.foto('h-previa');
  await clicarNoDialogo('Carregar 15 feriados');
  await esperarAviso(`15 feriados de ${PROXIMO} carregados.`);
  await dialogoFechado();
  await quantasLinhas(15);
  ok('o ano fica cheio', (await texto('main')).includes(`15 feriados em ${PROXIMO}`));

  // remover e carregar de novo
  await clicarRotulo('Remover Tiradentes');
  await dialogoAberto();
  await c.espera(350);
  ok('remover pede confirmação', (await texto('.dialogo')).includes('Remover Tiradentes?') && (await texto('.dialogo')).includes('deixa de contar nos dias úteis'));
  await clicarNoDialogo('Remover feriado');
  await esperarAviso('Feriado removido.');
  await dialogoFechado();
  await quantasLinhas(14);
  await botao(`Carregar feriados de ${PROXIMO}`);
  await dialogoAberto();
  await c.espera(350);
  const de14 = await texto('.dialogo');
  ok('a prévia separa o novo do que já existe', de14.includes('14 feriados já cadastrados ficam como está.') && de14.includes('Já cadastrado'), de14.slice(-260));
  await clicarNoDialogo('Carregar 1 feriado');
  await esperarAviso(`1 feriado de ${PROXIMO} carregado.`);
  await dialogoFechado();
  await quantasLinhas(15);
  ok('só o que faltava entra', (await tabela('feriado')).filter((x) => x.data.startsWith(String(PROXIMO)) && !x.arquivado_em).length === 15);
});

await passo('calendário: formulário', async () => {
  await abrirPainel('Novo feriado');
  await c.foto('i-formulario');
  await salvarPainel();
  await painelTemErro('Informe a data.');
  ok('data e nome obrigatórios', (await texto('.janela [role=alert]')).includes('Informe o nome.'));
  ok('nacional não pede local', !(await c.avaliar(`Boolean(document.getElementById('feriado-uf'))`)));
  await marcarPilula('Abrangência', 'Estadual');
  await c.ate(`Boolean(document.getElementById('feriado-uf'))`);
  ok('estadual: começa no estado padrão', (await valor('feriado-uf')) === 'RJ');
  ok('estadual não pede município', !(await c.avaliar(`Boolean(document.getElementById('feriado-municipio'))`)));
  await marcarPilula('Abrangência', 'Municipal');
  await c.ate(`Boolean(document.getElementById('feriado-municipio'))`);
  ok('municipal: começa no município padrão', (await valor('feriado-municipio')) === 'Rio de Janeiro');
  ok('municípios do IBGE', (await opcoes('feriado-municipio')).includes('Niterói'));
  await escolher('feriado-uf', 'SP');
  await c.espera(100);
  ok('trocar o estado limpa o município', (await valor('feriado-municipio')) === '' && (await opcoes('feriado-municipio')).includes('Campinas'));
  await preencher('feriado-data', `${ANO}-12-25`);
  await preencher('feriado-nome', 'natal');
  await escolher('feriado-municipio', 'Campinas');
  await salvarPainel();
  await c.ate(`document.getElementById('feriado-nome-erro')?.textContent.includes('Já existe')`);
  ok('o mesmo feriado na mesma data é barrado', (await erroDe('feriado-nome')) === 'Já existe esse feriado nessa data.', await erroDe('feriado-nome'));
  const futuro = ANO + 2;
  await preencher('feriado-data', `${futuro}-03-10`);
  await preencher('feriado-nome', 'Aniversário de Campinas');
  await salvarESaber('Feriado criado.');
  await c.ate(`document.getElementById('calendario-ano').value==='${futuro}'`);
  ok('a lista vai para o ano do feriado salvo', (await opcoes('calendario-ano')).includes(String(futuro)));
  await quantasLinhas(1);
  ok('a linha mostra o local', (await linhas())[0].includes('Campinas · SP'));
  // editar
  await clicarRotulo('Editar Aniversário de Campinas');
  await painelAberto();
  await c.espera(450);
  ok('o formulário vem preenchido', (await valor('feriado-data')) === `${futuro}-03-10` && (await valor('feriado-municipio')) === 'Campinas' && (await pilulaMarcada('Abrangência', 'Municipal')));
  await marcarPilula('Abrangência', 'Nacional');
  await preencher('feriado-nome', 'Feriado Geral');
  await salvarESaber('Feriado atualizado.');
  await c.ate(`document.querySelector('main table tbody tr')?.textContent.includes('Feriado Geral')`);
  const f = (await tabela('feriado')).find((x) => x.nome === 'Feriado Geral');
  ok('nacional não guarda local', f.uf === null && f.municipio === null);
  ok('e a lista mostra sem local', (await linhas())[0].includes('—'));
});

// ---------- T02.10 ----------

await passo('etiquetas: cadastrar', async () => {
  await irPara(ETIQUETAS);
  await c.ate(`document.querySelector('main').textContent.includes('Nenhuma etiqueta ainda.')`);
  ok('começa vazia, e explica', (await texto('main')).includes('Etiquetas são livres e servem a filtros e buscas.'));
  await c.foto('j-vazio');
  await abrirPainel('Nova etiqueta');
  ok('todos os módulos por padrão', await pilulaMarcada('Onde pode ser usada', 'Todos os módulos'));
  ok('sem módulos à mostra', !(await existeGrupo('Módulos')));
  await c.foto('j-formulario');
  await salvarPainel();
  await painelTemErro('Informe o nome.');
  ok('nome obrigatório', true);
  await preencher('etiqueta-nome', 'Urgente');
  await preencher('etiqueta-cor', 'azul');
  await salvarPainel();
  await painelTemErro('Use o formato #RRGGBB.');
  ok('cor em formato errado', true);
  await preencher('etiqueta-cor', '#FFFFFF');
  await salvarPainel();
  await painelTemErro('clara demais');
  ok('cor clara demais', true);
  await preencher('etiqueta-cor', '#3478B8');
  await marcarPilula('Onde pode ser usada', 'Só alguns');
  await c.ate(`[...document.querySelectorAll('fieldset legend')].some(l=>l.textContent.startsWith('Módulos'))`);
  ok('os módulos da fase ativa', await c.avaliar(`['Atividades','Ferramentas e ativos','Financeiro','Contrapartes'].every(t=>[...document.querySelectorAll('.janela fieldset label')].some(l=>l.textContent===t))`));
  await salvarPainel();
  await painelTemErro('Escolha pelo menos um módulo.');
  ok('só alguns pede pelo menos um', (await texto('#etiqueta-modulos')).includes('Escolha pelo menos um módulo.'));
  await marcarPilula('Módulos', 'Financeiro');
  await marcarPilula('Módulos', 'Atividades');
  await salvarESaber('Etiqueta criada.');
  await quantasLinhas(1);
  const l = await linhaDe('Urgente');
  ok('a linha diz onde pode ser usada', l.includes('Financeiro, Atividades') || l.includes('Atividades, Financeiro'), l);
  const cor = await c.avaliar(`(()=>{const s=document.querySelector('main table tbody span[style]');return getComputedStyle(s.querySelector('span')).backgroundColor})()`);
  ok('o ponto usa a cor escolhida', cor === 'rgb(52, 120, 184)', cor);
  await c.foto('j-lista');

  await abrirPainel('Nova etiqueta');
  await preencher('etiqueta-nome', 'urgente');
  await salvarPainel();
  await c.ate(`document.getElementById('etiqueta-nome-erro')?.textContent.includes('Já existe')`);
  ok('nome único, sem ligar para maiúscula', (await erroDe('etiqueta-nome')).includes('Já existe “Urgente”.'));
  await preencher('etiqueta-nome', 'Importante');
  await salvarESaber('Etiqueta criada.');
  await quantasLinhas(2);
  ok('em ordem de nome, e sem cor fica neutra', (await linhas())[0].startsWith('Importante') && (await linhaDe('Importante')).includes('Todos os módulos'));
  await preencherBusca('urg');
  await quantasLinhas(1);
  ok('busca', (await linhas())[0].startsWith('Urgente'));
  await preencherBusca('');
  await quantasLinhas(2);
  // editar
  await clicarRotulo('Editar Urgente');
  await painelAberto();
  await c.espera(450);
  ok('o formulário vem preenchido', (await valor('etiqueta-nome')) === 'Urgente' && (await valor('etiqueta-cor')) === '#3478B8' && (await pilulaMarcada('Onde pode ser usada', 'Só alguns')) && (await pilulaMarcada('Módulos', 'Financeiro')));
  await marcarPilula('Onde pode ser usada', 'Todos os módulos');
  await salvarESaber('Etiqueta atualizada.');
  await c.ate(`[...document.querySelectorAll('main table tbody tr')].find(t=>t.textContent.includes('Urgente')).textContent.includes('Todos os módulos')`);
  ok('voltar para todos limpa os módulos', (await tabela('etiqueta')).find((x) => x.nome === 'Urgente').modulos.length === 0);
});

await passo('etiquetas: usos, mesclar e arquivar', async () => {
  const [importante, urgente] = ['Importante', 'Urgente'].map(() => null);
  void importante; void urgente;
  const t = await tabela('etiqueta');
  const idUrgente = t.find((x) => x.nome === 'Urgente').id;
  const idImportante = t.find((x) => x.nome === 'Importante').id;
  // simula o uso que os módulos farão a partir da T03
  const agora = new Date().toISOString();
  await c.avaliar(`(()=>{const v=(id,e,r)=>({id,criado_em:${js(agora)},criado_por:null,atualizado_em:${js(agora)},atualizado_por:null,arquivado_em:null,arquivado_por:null,versao_registro:1,exemplo:false,etiqueta_id:e,registro_tipo:'pessoa',registro_id:r});localStorage.setItem('numa-central:v1:etiqueta_vinculo',JSON.stringify([v('a1000000-0000-4000-8000-000000000001',${js(idUrgente)},${js(ID_KIMBERLY)}),v('a1000000-0000-4000-8000-000000000002',${js(idUrgente)},${js(ID_CAMILA)}),v('a1000000-0000-4000-8000-000000000003',${js(idImportante)},${js(ID_CAMILA)})]))})()`);
  await irPara(ETIQUETAS);
  await quantasLinhas(2);
  ok('a coluna diz em quantos registros', (await linhaDe('Urgente')).endsWith('2') && (await linhaDe('Importante')).endsWith('1'), await linhaDe('Urgente'));
  await clicarRotulo('Arquivar Urgente');
  await dialogoAberto();
  await c.espera(350);
  const d = await texto('.dialogo');
  ok('em uso não arquiva: sugere mesclar', d.includes('Não dá para arquivar Urgente') && d.includes('2 registros') && d.includes('Mescle'), d);
  await c.foto('k-bloqueio');
  await clicarNoDialogo('Entendi');
  await dialogoFechado();

  await clicarRotulo('Mesclar Urgente');
  await dialogoAberto();
  await c.espera(350);
  const m = await texto('.dialogo');
  ok('mesclar explica o que acontece', m.includes('2 registros passam para a etiqueta escolhida, sem repetir.') && m.includes('Urgente vai para Arquivados.'), m);
  ok('oferece as outras etiquetas', (await opcoes('mesclar-destino')).join('|') === 'Importante', (await opcoes('mesclar-destino')).join('|'));
  await c.foto('k-mesclar');
  await clicarNoDialogo('Mesclar etiquetas');
  await esperarAviso('Etiquetas mescladas.');
  await dialogoFechado();
  await quantasLinhas(1);
  ok('a de destino fica com os registros, sem repetir', (await linhaDe('Importante')).endsWith('2'), await linhaDe('Importante'));
  const vinculos = (await tabela('etiqueta_vinculo')).filter((x) => !x.arquivado_em);
  ok('moveu e tirou a repetição', vinculos.length === 2 && vinculos.every((x) => x.etiqueta_id === idImportante), JSON.stringify(vinculos.map((x) => x.registro_id)));
  ok('com uma só etiqueta, não oferece mesclar', !(await c.avaliar(`Boolean(document.querySelector('[aria-label="Mesclar Importante"]'))`)));
  await botao('Arquivados (1)');
  await c.ate(`document.querySelector('main table tbody tr')?.textContent.includes('Urgente')`);
  ok('a mesclada vai para Arquivados', true);
  await c.clicar('button[aria-label="Restaurar Urgente"]');
  await esperarAviso('Etiqueta restaurada.');
  await c.ate(`document.querySelector('main').textContent.includes('Nenhuma etiqueta arquivada.')`);
  ok('dá para restaurar', (await tabela('etiqueta')).find((x) => x.nome === 'Urgente').arquivado_em === null);
  await botao('Voltar às etiquetas ativas');
  await quantasLinhas(2);
  // sem uso, arquiva
  await clicarRotulo('Arquivar Urgente');
  await dialogoAberto();
  await c.espera(350);
  ok('sem uso, pede confirmação', (await texto('.dialogo')).includes('Arquivar Urgente?'));
  await clicarNoDialogo('Arquivar etiqueta');
  await esperarAviso('Etiqueta arquivada.');
  await dialogoFechado();
  await quantasLinhas(1);
  await ir('/configuracoes/dados');
  await c.ate(`document.querySelector('main').textContent.includes('arquivou a etiqueta Urgente')`);
  const h2 = await texto('main');
  ok('o histórico diz a mescla por extenso', h2.includes('Motivo: Mesclada em Importante') && h2.includes('moveu um registro para a etiqueta Importante'), h2.slice(0, 800));
});

// ---------- Com os outros dados ----------

await passo('limpar e restaurar exemplos', async () => {
  await restaurarExemplos();
  const m = await texto('main');
  ok('a carga inicial conta tudo', m.includes('Registros151') && m.includes('51 de exemplo'), m.slice(0, 500));
  await botao('Limpar exemplos');
  await dialogoAberto();
  await c.espera(420);
  ok('diz quantos saem', (await texto('.dialogo')).includes('51 registros de exemplo serão removidos'), await texto('.dialogo'));
  await clicarNoDialogo('Limpar exemplos');
  await dialogoFechado();
  await c.ate(`document.querySelector('main').textContent.includes('Registros100')`);
  ok('as contas fictícias saem', (await tabela('conta_financeira')).length === 0);
  ok('categorias e feriados ficam: não são exemplo', (await tabela('categoria_financeira')).length === 43 && (await tabela('feriado')).filter((x) => !x.arquivado_em).length === 15);
  await irPara(CONTAS);
  await c.ate(`document.querySelector('main').textContent.includes('Nenhuma conta ainda.')`);
  ok('a tela explica', (await texto('main')).includes('Cadastre o cartão ou a conta usados para as despesas da Numa.'));
  await restaurarExemplos();
  ok('restaurar volta tudo', (await tabela('conta_financeira')).length === 2 && (await tabela('etiqueta')).length === 0 && (await tabela('categoria_financeira')).length === 43);
});

await passo('dados de quem vinha da versão anterior', async () => {
  const antes = `for(const t of ['categoria_financeira','conta_financeira','feriado','etiqueta','etiqueta_vinculo'])localStorage.removeItem('numa-central:v1:'+t);const m=JSON.parse(localStorage.getItem('numa-central:v1:meta'));m.versao_dados=5;localStorage.setItem('numa-central:v1:meta',JSON.stringify(m));`;
  await c.avaliar(`(()=>{${antes}const k='numa-central:v1:pessoa';const l=JSON.parse(localStorage.getItem(k));l.find(x=>x.id==='${ID_CAMILA}').funcao='Dado que precisa continuar';localStorage.setItem(k,JSON.stringify(l))})()`);
  await irPara(CATEGORIAS);
  await c.ate(`document.querySelector('main section h2')`);
  ok('categorias entram', (await tabela('categoria_financeira')).length === 43);
  ok('feriados do ano entram', (await tabela('feriado')).length === 15 && (await tabela('feriado')).every((x) => x.data.startsWith(String(ANO))));
  ok('contas de exemplo entram', (await tabela('conta_financeira')).length === 2);
  ok('etiquetas ficam vazias', (await tabela('etiqueta')).length === 0 && (await tabela('etiqueta_vinculo')).length === 0);
  ok('versão atualizada', (await c.avaliar(`JSON.parse(localStorage.getItem('numa-central:v1:meta')).versao_dados`)) === 22);
  ok('o que existia continua como estava', (await tabela('pessoa')).find((x) => x.id === ID_CAMILA).funcao === 'Dado que precisa continuar');
  await restaurarExemplos();
  await botao('Limpar exemplos');
  await dialogoAberto();
  await c.espera(420);
  await clicarNoDialogo('Limpar exemplos');
  await dialogoFechado();
  await c.ate(`document.querySelector('main').textContent.includes('Registros100')`);
  await c.avaliar(`(()=>{${antes}})()`);
  await ir(CONTAS);
  await c.ate(`document.querySelector('main').textContent.includes('Nenhuma conta ainda.')`);
  ok('quem limpou os exemplos não recebe contas de exemplo', (await tabela('conta_financeira')).length === 0);
  await restaurarExemplos();
});

await passo('dados danificados', async () => {
  for (const [tabelaDanificada, caminho, mensagem] of [['categoria_financeira', CATEGORIAS, 'Não deu para ler as categorias.'], ['conta_financeira', CONTAS, 'Não deu para ler as contas.'], ['feriado', CALENDARIO, 'Não deu para ler os feriados.'], ['etiqueta', ETIQUETAS, 'Não deu para ler as etiquetas.']]) {
    await c.avaliar(`localStorage.setItem('numa-central:v1:${tabelaDanificada}','{danificado')`);
    await ir(caminho);
    await c.ate(`document.querySelector('main').textContent.includes(${js(mensagem)})`);
    ok(`${tabelaDanificada}: explica e aponta a saída`, (await texto('main')).includes('aba Dados'));
    await restaurarExemplos();
  }
  await irPara(CONTAS);
  await c.ate(`document.querySelector('main table tbody tr')`);
  ok('restaurar recupera', (await linhas()).length === 2);
});

for (const [l, a] of [[1440, 900], [1024, 768], [768, 1024], [360, 800]]) {
  await c.tamanho(l, a);
  await passo(`telas em ${l}px`, async () => {
    for (const [caminho, nome, botaoNovo] of [[CATEGORIAS, 'categorias', 'Nova categoria'], [CONTAS, 'contas', 'Nova conta'], [CALENDARIO, 'calendario', 'Novo feriado'], [ETIQUETAS, 'etiquetas', 'Nova etiqueta']]) {
      await irPara(caminho);
      await c.espera(250);
      await conferirTela(nome, l);
      await c.foto(`l-${l}-${nome}`);
      await c.clicar(`texto=${botaoNovo}`);
      await painelAberto();
      await c.espera(450);
      await conferirTela(`Formulário de ${nome}`, l);
      await c.foto(`l-${l}-${nome}-form`);
      await c.tecla('Escape');
      await painelFechado();
    }
  });
}

await passo('celular', async () => {
  await c.tamanho(360, 800);
  await irPara(CATEGORIAS);
  await c.espera(200);
  ok('categorias em cartões', await c.avaliar(`document.querySelector('main ul[aria-label="Categorias de Marketing"]').getBoundingClientRect().height>0&&document.querySelector('main table').getBoundingClientRect().height===0`));
  ok('as ações do cartão têm 44px', await c.avaliar(`document.querySelector('main ul[aria-label="Categorias de Marketing"] button[aria-label="Editar Eventos"]').getBoundingClientRect().height>=44`));
  ok('as abas do módulo cabem, com a ativa visível e sem rolagem da página', await c.avaliar(`(()=>{const a=[...document.querySelectorAll('main nav a[aria-current]')].find(x=>x.getBoundingClientRect().width>0);const r=a?.getBoundingClientRect();return Boolean(r)&&r.left>=0&&r.right<=innerWidth+1&&document.documentElement.scrollWidth<=innerWidth})()`));
  await c.foto('m-categorias');
  await c.clicar('texto=Filtros');
  await c.ate(`document.querySelector('.dialogo')`);
  await c.espera(450);
  await conferirTela('Filtros', 360);
  await c.tecla('Escape');
  await dialogoFechado();
  await irPara(CONTAS);
  await c.espera(200);
  ok('contas em cartões, com o tipo e o titular', await c.avaliar(`(()=>{const u=document.querySelector('main ul[aria-label="Contas"]');return u.getBoundingClientRect().height>0&&u.textContent.includes('Conta pessoal de sócia')&&u.textContent.includes('Kimberly Grebe')})()`));
  await c.foto('m-contas');
  await irPara(CALENDARIO);
  await c.espera(200);
  ok('feriados em cartões, com data e dia', await c.avaliar(`(()=>{const u=document.querySelector('main ul[aria-label^="Feriados de"]');return u.getBoundingClientRect().height>0&&/\\d{2}\\/\\d{2}\\/\\d{4} · /.test(u.textContent)})()`));
  await c.foto('m-calendario');
  await botao(`Carregar feriados de ${ANO}`);
  await dialogoAberto();
  await c.espera(450);
  await conferirTela('Diálogo do calendário', 360);
  await c.tecla('Escape');
  await dialogoFechado();
  await escolher('calendario-ano', String(PROXIMO));
  await c.ate(`document.querySelector('main').textContent.includes('Nenhum feriado em ${PROXIMO}.')`);
  await botao(`Carregar feriados de ${PROXIMO}`);
  await dialogoAberto();
  await c.espera(450);
  ok('a prévia cabe, sem rolagem lateral', await c.avaliar(`(()=>{const t=document.querySelector('.dialogo table');return document.documentElement.scrollWidth<=innerWidth&&t.parentElement.scrollWidth<=t.parentElement.clientWidth})()`));
  ok('confirmar fica à vista', await c.avaliar(`(()=>{const b=[...document.querySelectorAll('.dialogo button')].find(x=>x.textContent.includes('Carregar 15'));const r=b.getBoundingClientRect();return r.bottom<=innerHeight&&r.top>=0})()`));
  await c.foto('m-previa');
  await c.tecla('Escape');
  await dialogoFechado();
  await irPara(ETIQUETAS);
  await c.ate(`document.querySelector('main').textContent.includes('Nenhuma etiqueta ainda.')`);
  await conferirTela('Etiquetas vazia', 360);
  await c.foto('m-etiquetas');
});

await c.tamanho(1440, 900);
await passo('teclado', async () => {
  await irPara(CATEGORIAS);
  await c.ate(`document.querySelector('[aria-label="Editar Marketing"]')`);
  await c.avaliar(`document.querySelector('[aria-label="Editar Marketing"]').focus()`);
  await c.tecla('Enter');
  await painelAberto();
  await c.espera(450);
  await c.tecla('Escape');
  await painelFechado();
  await c.espera(100);
  ok('Esc fecha e o foco volta ao botão', await c.avaliar(`document.activeElement.getAttribute('aria-label')==='Editar Marketing'`));
  await c.avaliar(`document.querySelector('[aria-label="Arquivar Marketing"]').focus()`);
  await c.tecla('Enter');
  await dialogoAberto();
  await c.tecla('Escape');
  await dialogoFechado();
  await c.espera(100);
  ok('o diálogo também devolve o foco', await c.avaliar(`document.activeElement.getAttribute('aria-label')==='Arquivar Marketing'`));
  await irPara(CONTAS);
  await c.clicar('texto=Nova conta');
  await painelAberto();
  await c.espera(450);
  ok('foco no primeiro campo', (await c.avaliar(`document.activeElement.id`)) === 'conta-nome');
  await salvarPainel();
  await painelTemErro('Informe o nome.');
  await c.espera(100);
  ok('com erro, o foco vai para o primeiro campo errado', (await c.avaliar(`document.activeElement.id`)) === 'conta-nome', await c.avaliar(`document.activeElement.id`));
});

await h.terminar();
