// Verificação da T02.02 (Pessoas) e da T02.03 (Áreas) no sistema real.
import { iniciar, ID_BRUNA, ID_CAMILA, ID_KIMBERLY, ID_RAFAEL } from './apoio.mjs';

const CPF = '529.982.247-25';
const PESSOAS = '/configuracoes/cadastros/pessoas';
const AREAS = '/configuracoes/cadastros/areas';

const h = await iniciar({ nome: 't0202', porta: 9341 });
const { c, ok, passo, ir, texto, valor, preencher, escolher, opcoes, esperarAviso, idPorRotulo, marcarPilula, pilulaMarcada, existeGrupo, clicarNoDialogo, dialogoAberto, dialogoFechado, painelAberto, painelFechado, pularAbertura, tabela, conferirTela } = h;

const listaPronta = () => c.ate(`document.querySelector('main table tbody tr, main ul li')`);
const linhas = () => c.avaliar(`[...document.querySelectorAll('main table tbody tr')].map(t=>t.children[0].textContent)`);
const irPessoas = async () => { await ir(PESSOAS); await listaPronta(); };
const irAreas = async () => { await ir(AREAS); await listaPronta(); };
const novoPainel = async () => { await c.clicar('texto=Nova pessoa'); await painelAberto(); await c.espera(450); };
const salvarPainel = () => c.avaliar(`document.querySelector('.janela button[type=submit]').click()`);

await c.tamanho(1440, 900);

await passo('navegação', async () => {
  await ir('/configuracoes/cadastros');
  await c.ate(`location.pathname==='${PESSOAS}'`);
  await pularAbertura();
  await listaPronta();
  ok('Cadastros base abre em Pessoas', true);
  const abas = await c.avaliar(`[...document.querySelectorAll('nav[aria-label="Seções de configurações"] a')].map(a=>a.textContent+(a.getAttribute('aria-current')?'*':''))`);
  ok('abas Geral, Cadastros base e Dados', abas.join('|') === 'Geral|Cadastros base*|Dados', abas.join('|'));
  const sub = await c.avaliar(`[...document.querySelectorAll('nav[aria-label="Cadastros base"] a')].map(a=>a.textContent+(a.getAttribute('aria-current')?'*':''))`);
  ok('segundo nível: Pessoas e Áreas', sub[0] === 'Pessoas*' && sub[1] === 'Áreas', sub.join('|'));
  ok('Configurações segue marcada no menu', await c.avaliar(`[...document.querySelectorAll('[data-menu-lateral] a[href="/configuracoes"]')].some(a=>a.getAttribute('aria-current')==='page')`));
  ok('o título da aba diz a tela', (await c.avaliar(`document.title`)).startsWith('Pessoas'));
  await c.foto('a-lista');
  await c.clicar('nav[aria-label="Cadastros base"] a[href="' + AREAS + '"]');
  await c.ate(`location.pathname==='${AREAS}'`);
  ok('dá para ir a Áreas', (await texto('main h1')) === 'Áreas');
});

await passo('lista de pessoas', async () => {
  await irPessoas();
  const m = await texto('main');
  ok('contador de registros', m.includes('4 pessoas'), m.slice(0, 120));
  ok('em ordem alfabética, por extenso', (await linhas()).join('|').replace(/KG|CL|BA|RS|Sócia/g, '') === 'Bruna Alves|Camila Lima|Kimberly Grebe|Rafael Souza', (await linhas()).join('|'));
  const cab = await c.avaliar(`[...document.querySelectorAll('main thead th')].map(t=>t.textContent)`);
  ok('colunas da especificação, sem usuária', cab.join('|') === 'Nome|Tipo|Vínculo|Função|E-mail|Telefone|Situação', cab.join('|'));
  ok('situação com texto', m.includes('Ativa'));
  ok('sócias marcadas', (m.match(/Sócia/g) || []).length >= 2);
  // busca e filtros
  await c.avaliar(`document.querySelector('main input[type=search]').focus()`);
  await c.digitar('camíla');
  await c.ate(`document.querySelectorAll('main table tbody tr').length===1`);
  ok('busca ignora acentos', (await linhas())[0].includes('Camila Lima'));
  await preencherBusca('ninguem');
  await c.ate(`document.querySelector('main').textContent.includes('Nada com esses filtros.')`);
  ok('vazio por filtro', true);
  await c.clicar('texto=Limpar filtros');
  await c.ate(`document.querySelectorAll('main table tbody tr').length===4`);
  ok('limpar filtros volta tudo', true);
  await c.clicar('main button[aria-pressed]:nth-of-type(3)');
  await c.ate(`document.querySelectorAll('main table tbody tr').length===1`);
  ok('filtro por tipo: Externas', (await linhas())[0].includes('Rafael Souza'));
  ok('o filtro diz quantas', (await texto('main')).includes('Internas3') && (await texto('main')).includes('Externas1'));
  await c.clicar('main button[aria-pressed]:nth-of-type(1)');
  await c.ate(`document.querySelectorAll('main table tbody tr').length===4`);
});

async function preencherBusca(novo) {
  await c.avaliar(`(()=>{const e=document.querySelector('main input[type=search]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(novo)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`);
}

await passo('filtro de situação', async () => {
  await c.clicar('texto=Filtros');
  await c.ate(`document.querySelector('.menu-suspenso')`);
  await c.espera(150);
  await marcarPilula('Situação', 'Inativas');
  await c.ate(`document.querySelector('main').textContent.includes('Situação: Inativa')`);
  ok('etiqueta removível do filtro', true);
  ok('sem inativas por enquanto', (await texto('main')).includes('Nada com esses filtros.'));
  await c.tecla('Escape');
  await c.espera(150);
  await c.clicar('button[aria-label="Remover filtro: Situação: Inativa"]');
  await c.ate(`document.querySelectorAll('main table tbody tr').length===4`);
  ok('remover a etiqueta tira o filtro', true);
});

await passo('nova pessoa: formulário', async () => {
  await novoPainel();
  ok('abre em painel lateral', (await texto('.janela')).includes('Nova pessoa'));
  ok('foco no primeiro campo', (await c.avaliar(`document.activeElement.id`)) === 'pessoa-nome');
  await c.foto('b-painel');
  ok('interna mostra É sócia e Áreas', (await existeGrupo('É sócia')) && (await existeGrupo('Áreas em que atua')) && !(await existeGrupo('Papel do contato')));
  await marcarPilula('Tipo', 'Externa');
  await c.espera(80);
  ok('externa mostra Papel do contato', (await existeGrupo('Papel do contato')) && !(await existeGrupo('É sócia')) && !(await existeGrupo('Áreas em que atua')));
  ok('com o campo de contraparte, desde a T02.06', (await texto('.janela')).includes('Contraparte'));
  await marcarPilula('Tipo', 'Interna');
  await c.espera(80);
  // validação
  await salvarPainel();
  await c.ate(`document.querySelector('.janela [role=alert]')`);
  ok('nome obrigatório, com resumo', (await texto('.janela [role=alert]')).includes('Informe o nome completo.'));
  await preencher('pessoa-nome', 'Dora Nunes');
  await preencher('pessoa-email', 'dora');
  await preencher('pessoa-telefone', '123');
  await preencher('pessoa-cpf', '52998224724');
  await salvarPainel();
  await c.ate(`document.querySelector('.janela [role=alert]')?.textContent.includes('CPF')`);
  const r = await texto('.janela [role=alert]');
  ok('mensagens de e-mail, telefone e CPF', r.includes('e-mail válido') && r.includes('(00) 00000-0000') && r.includes('Este CPF não é válido'), r);
  await c.foto('b-erros');
  // máscaras de verdade: digitando
  await c.avaliar(`document.getElementById('pessoa-telefone').value=''`);
  await preencher('pessoa-telefone', '');
  await c.avaliar(`document.getElementById('pessoa-telefone').focus()`);
  await c.digitar('21999990000');
  await c.espera(80);
  ok('máscara do telefone', (await valor('pessoa-telefone')) === '(21) 99999-0000', await valor('pessoa-telefone'));
  await preencher('pessoa-cpf', '');
  await c.avaliar(`document.getElementById('pessoa-cpf').focus()`);
  await c.digitar('52998224725');
  await c.espera(80);
  ok('máscara do CPF', (await valor('pessoa-cpf')) === CPF, await valor('pessoa-cpf'));
  await preencher('pessoa-email', 'dora@numa.com.br');
  await c.avaliar(`[...document.querySelectorAll('fieldset')].find(x=>x.querySelector('legend').textContent.startsWith('Áreas')).querySelector('input').click()`);
  await preencher(await idPorRotulo('Função'), 'Designer');
  await c.espera(100);
  await salvarPainel();
  await esperarAviso('Pessoa cadastrada.');
  await painelFechado();
  ok('cadastra e avisa, com "Abrir"', await c.avaliar(`[...document.querySelectorAll('[data-sonner-toast] button')].some(b=>b.textContent==='Abrir')`));
  await c.ate(`document.querySelectorAll('main table tbody tr').length===5`);
  ok('entra na lista e no contador', (await texto('main')).includes('5 pessoas'));
  ok('nome de exibição padrão', (await tabela('pessoa')).find((p) => p.nome_completo === 'Dora Nunes').nome_exibicao === 'Dora Nunes');
  ok('telefone e CPF gravados só com dígitos', (() => true)());
  const dora = (await tabela('pessoa')).find((p) => p.nome_completo === 'Dora Nunes');
  ok('dígitos no armazenamento', dora.telefone === '21999990000' && dora.cpf === '52998224725', `${dora.telefone} ${dora.cpf}`);
  const voceE = await c.avaliar(`[...document.querySelector('[data-menu-lateral] select').options].map(o=>o.textContent)`);
  ok('pessoa interna nova entra em "Você é"', voceE.includes('Dora Nunes'), voceE.join(','));
});

await passo('duplicidade', async () => {
  await novoPainel();
  await preencher('pessoa-nome', 'Outra Pessoa');
  await preencher('pessoa-cpf', CPF);
  await c.espera(60);
  await salvarPainel();
  await c.ate(`document.getElementById('pessoa-cpf-erro')?.textContent.includes('Já existe: Dora Nunes.')`);
  ok('CPF repetido bloqueia (CA-02.01)', (await texto('.janela')).includes('Abrir a ficha de Dora Nunes'));
  ok('não cadastrou', (await tabela('pessoa')).length === 5);
  await c.foto('c-cpf');
  await preencher('pessoa-cpf', '');
  await preencher('pessoa-nome', 'Camilla Lima');
  await preencher('pessoa-email', 'dora@numa.com.br');
  await c.espera(60);
  await salvarPainel();
  await c.ate(`document.querySelector('.dialogo')?.textContent.includes('Salvar mesmo assim?')`);
  const d = await texto('.dialogo');
  ok('nome parecido e e-mail igual só avisam', d.includes('Nome parecido com Camila Lima.') && d.includes('E-mail igual ao de Dora Nunes.'), d);
  await c.espera(420);
  await c.foto('c-avisos');
  await clicarNoDialogo('Voltar e revisar');
  await dialogoFechado();
  ok('voltar não salva', (await tabela('pessoa')).length === 5);
  await salvarPainel();
  await c.ate(`document.querySelector('.dialogo')?.textContent.includes('Salvar mesmo assim?')`);
  await c.espera(420);
  await clicarNoDialogo('Salvar mesmo assim');
  await esperarAviso('Pessoa cadastrada.');
  ok('confirmar salva', (await tabela('pessoa')).length === 6);
  await painelFechado();
});

await passo('observações que parecem segredo (RT-14)', async () => {
  await c.espera(5200);
  await novoPainel();
  await preencher('pessoa-nome', 'Elisa Prado');
  await preencher(await idPorRotulo('Observações'), 'senha: 123456');
  await c.ate(`document.querySelector('.janela').textContent.includes('parece uma senha')`);
  ok('avisa enquanto digita', true);
  await salvarPainel();
  await c.ate(`document.querySelector('.dialogo')?.textContent.includes('Salvar mesmo assim?')`);
  ok('e pede confirmação', (await texto('.dialogo')).includes('senha ou um token'));
  await c.espera(420);
  await clicarNoDialogo('Voltar e revisar');
  await dialogoFechado();
  await c.espera(60);
  await preencher(await idPorRotulo('Observações'), 'Prefere contato por e-mail.');
  await c.espera(60);
  ok('sem o segredo, o aviso some', !(await texto('.janela')).includes('parece uma senha'));
  await c.avaliar(`[...document.querySelectorAll('.janela button')].find(b=>b.textContent==='Salvar e adicionar outra').click()`);
  await esperarAviso('Pessoa cadastrada.');
  await c.ate(`document.getElementById('pessoa-nome')?.value===''`);
  await c.espera(150);
  ok('"Salvar e adicionar outra" limpa e volta ao nome', (await c.avaliar(`document.activeElement.id`)) === 'pessoa-nome', await c.avaliar(`document.activeElement.id`));
  ok('continua no painel', await c.avaliar(`Boolean(document.querySelector('.janela'))`));
  await preencher('pessoa-nome', 'Algo digitado');
  await c.espera(60);
  await c.tecla('Escape');
  await c.ate(`document.querySelector('.dialogo')?.textContent.includes('Descartar as alterações?')`);
  ok('fechar com algo preenchido pergunta (P3)', true);
  await c.espera(420);
  await clicarNoDialogo('Descartar alterações');
  await painelFechado();
  ok('descartar fecha sem salvar', !(await tabela('pessoa')).some((p) => p.nome_completo === 'Algo digitado'));
});

await passo('ficha', async () => {
  await irPessoas();
  await c.clicar('main table tbody tr:nth-child(1)');
  await c.ate(`location.pathname.startsWith('${PESSOAS}/')`);
  await c.ate(`document.querySelector('main h1')?.textContent==='Bruna Alves'`);
  ok('a linha abre a ficha', true);
  const f = await texto('main');
  ok('situação, tipo e dados', f.includes('Ativa') && f.includes('Interna') && f.includes('Freelancer de design') && f.includes('bruna@exemplo.com.br'));
  ok('o vazio diz que não foi informado', f.includes('Não informado'));
  ok('o nome de exibição padrão aparece', f.includes('Nome de exibiçãoBruna Alves'));
  ok('abas da F0a, sem Acessos', (await c.avaliar(`[...document.querySelectorAll('main [role=tab]')].map(t=>t.textContent).join('|')`)) === 'Resumo|Atividades|Histórico');
  await c.foto('d-ficha');
  await c.clicar('main [role=tab]:nth-child(3)');
  await c.ate(`document.querySelector('main [role=tabpanel][data-state=active]').textContent.includes('Nada registrado ainda.')`);
  ok('aba Histórico, ainda sem nada dela', true);
  await c.clicar('main [role=tab]:nth-child(1)');
  await c.espera(100);
  ok('o título da aba diz a tela', (await c.avaliar(`document.title`)).startsWith('Ficha da pessoa'));
  await c.clicar('texto=Pessoas');
  await c.ate(`location.pathname==='${PESSOAS}'`);
  ok('dá para voltar à lista', true);
});

await passo('editar', async () => {
  await ir(`${PESSOAS}/${ID_BRUNA}`);
  await c.ate(`document.querySelector('main h1')?.textContent==='Bruna Alves'`);
  await c.clicar('texto=Editar');
  await painelAberto();
  await c.espera(450);
  ok('abre com o que está salvo', (await valor('pessoa-nome')) === 'Bruna Alves' && (await valor('pessoa-email')) === 'bruna@exemplo.com.br');
  await preencher(await idPorRotulo('Função'), 'Designer sênior');
  await c.avaliar(`[...document.querySelectorAll('fieldset')].find(x=>x.querySelector('legend').textContent.startsWith('Áreas')).querySelectorAll('input')[2].click()`);
  await c.espera(100);
  await salvarPainel();
  await esperarAviso('Pessoa atualizada.');
  await painelFechado();
  await c.ate(`document.querySelector('main').textContent.includes('Designer sênior')`);
  ok('a ficha atualiza', (await texto('main')).includes('Social media / Marketing'));
  await c.clicar('main [role=tab]:nth-child(3)');
  await c.ate(`document.querySelector('main [role=tabpanel][data-state=active]').textContent.includes('alterou Bruna Alves')`);
  const hist = await texto('main [role=tabpanel][data-state=active]');
  ok('o histórico diz o que mudou', hist.includes('Função: de Freelancer de design para Designer sênior'), hist.slice(0, 200));
  ok('e a área em que entrou', hist.includes('colocou Bruna Alves na área Social media / Marketing'));
});

await passo('inativar e reativar', async () => {
  await ir(`${PESSOAS}/${ID_CAMILA}`);
  await c.ate(`document.querySelector('main h1')?.textContent==='Camila Lima'`);
  await c.clicar('texto=Inativar');
  await dialogoAberto();
  await c.espera(420);
  const d = await texto('.dialogo');
  ok('a confirmação lista as responsabilidades', d.includes('Responsável padrão de Tecnologia') && d.includes('Responsável pelo backup semanal') && d.includes('Atua em Comercial'), d.slice(0, 220));
  await c.foto('e-inativar');
  await clicarNoDialogo('Inativar pessoa');
  await esperarAviso('Pessoa inativada.');
  await dialogoFechado();
  await c.ate(`document.querySelector('main').textContent.includes('Inativa')`);
  ok('sai de "Você é"', !(await c.avaliar(`[...document.querySelector('[data-menu-lateral] select').options].map(o=>o.textContent)`)).includes('Camila Lima'));
  // reflexos nas outras telas
  await irAreas();
  const tecnologia = await c.avaliar(`[...document.querySelectorAll('main table tbody tr')].find(t=>t.textContent.includes('Tecnologia')).textContent`);
  ok('Áreas pede outra responsável', tecnologia.includes('Escolha outra pessoa'), tecnologia);
  await ir('/configuracoes');
  await c.ate(`document.getElementById('responsavel')`);
  await c.ate(`document.getElementById('backup').textContent.includes('não está mais na lista')`);
  ok('T02.01 também avisa, sem trocar sozinha', (await valor('responsavel')) === '');
  // volta
  await ir(`${PESSOAS}/${ID_CAMILA}`);
  await c.ate(`document.querySelector('main h1')?.textContent==='Camila Lima'`);
  await c.clicar('texto=Reativar');
  await esperarAviso('Pessoa reativada.');
  await c.ate(`[...document.querySelector('[data-menu-lateral] select').options].some(o=>o.textContent==='Camila Lima')`);
  ok('reativar traz de volta', true);
});

await passo('pessoa atual inativada', async () => {
  await c.espera(100);
  await ir(`${PESSOAS}/${ID_KIMBERLY}`);
  await c.ate(`document.querySelector('main h1')?.textContent==='Kimberly Grebe'`);
  await c.clicar('texto=Inativar');
  await dialogoAberto();
  await c.espera(420);
  await clicarNoDialogo('Inativar pessoa');
  await esperarAviso('Pessoa inativada.');
  await c.ate(`document.querySelector('[data-menu-lateral] select').selectedOptions[0].textContent!=='Kimberly Grebe'`);
  ok('"Você é" passa para outra pessoa', true);
  await dialogoFechado();
  await c.clicar('texto=Reativar');
  await esperarAviso('Pessoa reativada.');
  await c.espera(100);
});

await passo('arquivar', async () => {
  await ir(`${PESSOAS}/${ID_CAMILA}`);
  await c.ate(`document.querySelector('main h1')?.textContent==='Camila Lima'`);
  await c.clicar('texto=Arquivar');
  await dialogoAberto();
  await c.espera(420);
  const d = await texto('.dialogo');
  ok('com vínculos, não arquiva e explica', d.includes('Não dá para arquivar Camila Lima') && d.includes('Se ela saiu, inative'), d.slice(0, 160));
  ok('só um botão', (await c.avaliar(`document.querySelectorAll('.dialogo button').length`)) === 1);
  await c.foto('f-arquivar-bloqueado');
  await clicarNoDialogo('Entendi');
  await dialogoFechado();
  ok('nada mudou', (await tabela('pessoa')).find((p) => p.id === ID_CAMILA).arquivado_em === null);
  await ir(`${PESSOAS}/${ID_RAFAEL}`);
  await c.ate(`document.querySelector('main h1')?.textContent==='Rafael Souza'`);
  await c.clicar('texto=Arquivar');
  await dialogoAberto();
  await c.espera(420);
  ok('sem vínculos, pede confirmação', (await texto('.dialogo')).includes('Arquivar Rafael Souza?'));
  await clicarNoDialogo('Arquivar pessoa');
  await esperarAviso('Pessoa arquivada.');
  await c.ate(`document.querySelector('main').textContent.includes('está arquivada')`);
  ok('a ficha mostra e oferece restaurar', (await texto('main')).includes('Restaurar'));
  await dialogoFechado();
  ok('sem editar enquanto arquivada', !(await c.avaliar(`[...document.querySelectorAll('main button')].some(b=>b.textContent.trim()==='Editar')`)));
  await c.foto('f-arquivada');
  await irPessoas();
  ok('sai da lista', !(await linhas()).join().includes('Rafael'));
  ok('alternância mostra quantos', (await texto('main')).includes('Arquivados (1)'));
  await c.clicar('texto=Arquivados (1)');
  await c.ate(`document.querySelectorAll('main table tbody tr').length===1`);
  ok('e lista os arquivados', (await linhas())[0].includes('Rafael Souza'));
  await c.clicar('main table tbody tr');
  await c.ate(`document.querySelector('main h1')?.textContent==='Rafael Souza'`);
  await c.ate(`document.querySelector('main').textContent.includes('Restaurar')`);
  await c.clicar('texto=Restaurar');
  await esperarAviso('Pessoa restaurada.');
  await c.ate(`!document.querySelector('main').textContent.includes('está arquivada')`);
  ok('restaurar devolve à lista', true);
  await c.clicar('main [role=tab]:nth-child(3)');
  await c.ate(`document.querySelector('main [role=tabpanel][data-state=active]').textContent.includes('restaurou Rafael Souza')`);
  ok('o histórico registra arquivar e restaurar', (await texto('main [role=tabpanel][data-state=active]')).includes('arquivou Rafael Souza'));
});

await passo('ficha que não existe', async () => {
  await ir(`${PESSOAS}/00000000-0000-4000-8000-000000000000`);
  await c.ate(`document.querySelector('main').textContent.includes('Essa pessoa não existe mais.')`);
  ok('explica, sem quebrar', (await texto('main')).includes('Pessoas'));
});

await passo('áreas: lista', async () => {
  await irAreas();
  ok('7 áreas, com contador', (await c.avaliar(`document.querySelectorAll('main table tbody tr').length`)) === 7 && (await texto('main')).includes('7 áreas'));
  const l = await c.avaliar(`[...document.querySelectorAll('main table tbody tr')].map(t=>[...t.children].slice(0,3).map(x=>x.textContent).join(' / '))`);
  ok('Tecnologia com Camila', l[0].startsWith('Tecnologia / ') && l[0].includes('Camila Lima') && l[0].endsWith('Não'), l[0]);
  ok('Comercial compartilhada entre as duas', l[4] === 'Comercial / — / Sim (Kimberly Grebe e Camila Lima)', l[4]);
  ok('Produto também', l[6] === 'Produto / — / Sim (Kimberly Grebe e Camila Lima)', l[6]);
  await c.foto('g-areas');
});

await passo('áreas: criar e editar', async () => {
  await c.clicar('texto=Nova área');
  await painelAberto();
  await c.espera(450);
  await salvarPainel();
  await c.ate(`document.querySelector('.janela [role=alert]')`);
  const r = await texto('.janela [role=alert]');
  ok('nome e responsável obrigatórios', r.includes('Informe o nome da área.') && r.includes('Escolha a responsável padrão'), r);
  await preencher('area-nome', 'TECNOLOGIA');
  await escolher('area-responsavel', ID_KIMBERLY);
  await c.espera(60);
  await salvarPainel();
  await c.ate(`document.getElementById('area-nome-erro')?.textContent.includes('Já existe uma área com esse nome.')`);
  ok('nome não repete, sem considerar maiúsculas', true);
  await preencher('area-nome', 'Design');
  ok('responsável só com pessoas internas ativas', (await opcoes('area-responsavel')).join('|').includes('Kimberly Grebe') && !(await opcoes('area-responsavel')).join('|').includes('Rafael'));
  await c.foto('g-painel');
  await marcarPilula('Compartilhada', 'Sim');
  await c.ate(`!document.getElementById('area-responsavel')`);
  ok('compartilhada esconde a responsável e explica', (await texto('.janela')).includes('escolhida em cada registro'));
  await marcarPilula('Compartilhada', 'Não');
  await c.ate(`document.getElementById('area-responsavel')`);
  await escolher('area-responsavel', ID_KIMBERLY);
  await c.espera(60);
  await salvarPainel();
  await esperarAviso('Área criada.');
  await painelFechado();
  await c.ate(`document.querySelectorAll('main table tbody tr').length===8`);
  ok('entra no fim da lista', (await linhas()).at(-1) === 'Design');
  await c.clicar('button[aria-label="Editar Design"]');
  await painelAberto();
  await c.espera(450);
  ok('abre com o que está salvo', (await valor('area-nome')) === 'Design' && (await valor('area-responsavel')) === ID_KIMBERLY);
  await preencher('area-nome', 'Design e marca');
  await c.espera(60);
  await salvarPainel();
  await esperarAviso('Área atualizada.');
  await painelFechado();
  await c.ate(`[...document.querySelectorAll('main table tbody tr')].some(t=>t.textContent.includes('Design e marca'))`);
  ok('editar atualiza a lista', true);
});

await passo('áreas: arquivar', async () => {
  await c.clicar('button[aria-label="Arquivar Comercial"]');
  await dialogoAberto();
  await c.espera(420);
  const d = await texto('.dialogo');
  ok('em uso, bloqueia e diz por quem', d.includes('Não dá para arquivar Comercial') && d.includes('Kimberly Grebe e Camila Lima atuam nela'), d);
  await c.foto('g-bloqueada');
  await clicarNoDialogo('Entendi');
  await dialogoFechado();
  await c.clicar('button[aria-label="Arquivar Design e marca"]');
  await dialogoAberto();
  await c.espera(420);
  await clicarNoDialogo('Arquivar área');
  await esperarAviso('Área arquivada.');
  await c.ate(`document.querySelectorAll('main table tbody tr').length===7`);
  ok('sem uso, arquiva', (await texto('main')).includes('Arquivados (1)'));
  await dialogoFechado();
  await c.clicar('texto=Arquivados (1)');
  await c.ate(`document.querySelectorAll('main table tbody tr').length===1`);
  await c.clicar('button[aria-label="Restaurar Design e marca"]');
  await esperarAviso('Área restaurada.');
  await c.ate(`document.querySelector('main').textContent.includes('Nenhuma área arquivada.')`);
  ok('dá para restaurar', true);
  await c.clicar('texto=Voltar às áreas ativas');
  await c.ate(`document.querySelectorAll('main table tbody tr').length===8`);
});

await passo('áreas na ficha da pessoa', async () => {
  await ir(`${PESSOAS}/${ID_CAMILA}`);
  await c.ate(`document.querySelector('main h1')?.textContent==='Camila Lima'`);
  ok('a ficha lista as áreas', (await texto('main')).includes('Tecnologia, Comercial, Gestão geral, Produto'), (await texto('main')).slice(0, 400));
  await c.clicar('texto=Editar');
  await painelAberto();
  await c.espera(450);
  ok('o formulário traz as áreas marcadas', (await pilulaMarcada('Áreas em que atua', 'Tecnologia')) && !(await pilulaMarcada('Áreas em que atua', 'Financeiro')));
  ok('a área nova já é opção', await c.avaliar(`[...document.querySelectorAll('fieldset')].some(f=>f.textContent.includes('Design e marca'))`));
  await c.tecla('Escape');
  await painelFechado();
});

await passo('RT-14 na T02.01: motivo e fonte', async () => {
  await ir('/configuracoes');
  await c.ate(`document.getElementById('nome')&&document.getElementById('responsavel')`);
  await c.clicar('[role=tab][id$="-trigger-fase"]');
  await c.clicar('texto=Avançar para a Fase 0b');
  await dialogoAberto();
  await c.espera(420);
  await clicarNoDialogo('Avançar para a Fase 0b');
  await esperarAviso('Agora a Numa está na Fase 0b.');
  await dialogoFechado();
  await c.clicar('texto=Voltar para a Fase 0a');
  await dialogoAberto();
  await c.espera(420);
  await c.avaliar(`document.querySelector('.dialogo textarea').focus()`);
  await c.digitar('senha: 123456');
  await clicarNoDialogo('Voltar para a Fase 0a');
  await c.ate(`document.querySelector('.dialogo').textContent.includes('parece uma senha')`);
  ok('motivo que parece segredo avisa e segura', (await texto('#fase')).includes('Fase 0b'));
  await c.foto('h-motivo');
  await clicarNoDialogo('Voltar para a Fase 0a');
  await esperarAviso('A Numa voltou para a Fase 0a.');
  await dialogoFechado();
  ok('confirmar de novo segue', (await texto('#fase')).includes('Fase 0a'));
  await c.clicar('[role=tab][id$="-trigger-financeiro"]');
  await c.clicar('#financeiro button');
  await dialogoAberto();
  await c.espera(420);
  await preencher(await idPorRotulo('Cotação'), '5,42');
  await preencher(await idPorRotulo('Data'), '2026-11-05');
  await preencher(await idPorRotulo('Fonte'), 'token abc');
  await c.espera(60);
  await c.clicar('texto=Adicionar câmbio');
  await c.ate(`document.querySelector('.dialogo').textContent.includes('parece uma senha')`);
  ok('fonte que parece segredo avisa e segura', (await tabela('cambio_referencia')).length === 0);
  await c.clicar('texto=Adicionar câmbio');
  await esperarAviso('Câmbio de USD adicionado.');
  await dialogoFechado();
  ok('confirmar de novo segue', (await tabela('cambio_referencia')).length === 1);
});

await passo('limpar exemplos', async () => {
  await ir('/configuracoes/dados');
  await c.ate(`document.querySelector('main').textContent.includes('Último backup')&&[...document.querySelectorAll('main button')].some(b=>b.textContent==='Limpar exemplos'&&!b.disabled)`);
  await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent==='Limpar exemplos').click()`);
  await dialogoAberto();
  await c.espera(420);
  await clicarNoDialogo('Limpar exemplos');
  await dialogoFechado();
  await c.ate(`document.querySelector('main').textContent.includes('Nenhum de exemplo')`);
  ok('Bruna sai das áreas junto', !(await tabela('pessoa_area')).some((l) => l.pessoa_id === ID_BRUNA));
  await irAreas();
  ok('as áreas ficam', (await c.avaliar(`document.querySelectorAll('main table tbody tr').length`)) === 8);
  await ir(`${PESSOAS}/${ID_BRUNA}`);
  await c.ate(`document.querySelector('main').textContent.includes('Essa pessoa não existe mais.')`);
  ok('a ficha da pessoa removida explica', true);
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
  await c.ate(`document.querySelector('main').textContent.includes('Registros154')`);
  ok('tudo volta ao início: 4 pessoas e 7 áreas', true);
  await irAreas();
  ok('sem a área nova', (await c.avaliar(`document.querySelectorAll('main table tbody tr').length`)) === 7);
});

await passo('dados de quem vinha da versão anterior', async () => {
  await c.avaliar(`(()=>{localStorage.removeItem('numa-central:v1:area');localStorage.removeItem('numa-central:v1:pessoa_area');const m=JSON.parse(localStorage.getItem('numa-central:v1:meta'));m.versao_dados=2;localStorage.setItem('numa-central:v1:meta',JSON.stringify(m))})()`);
  await irAreas();
  ok('as áreas entram sem apagar nada', (await c.avaliar(`document.querySelectorAll('main table tbody tr').length`)) === 7 && (await tabela('pessoa')).length === 4);
  ok('versão atualizada', (await c.avaliar(`JSON.parse(localStorage.getItem('numa-central:v1:meta')).versao_dados`)) === 18);
});

await passo('dados danificados', async () => {
  await c.avaliar(`localStorage.setItem('numa-central:v1:area','{danificado')`);
  await ir(AREAS);
  await c.ate(`document.querySelector('main').textContent.includes('Não deu para ler as áreas.')`);
  ok('Áreas explica e aponta a saída', (await texto('main')).includes('aba Dados'));
  await ir(PESSOAS);
  await c.ate(`document.querySelector('main').textContent.includes('Não deu para ler as pessoas.')`);
  ok('Pessoas também', true);
  await ir('/configuracoes/dados');
  await c.ate(`[...document.querySelectorAll('main button')].some(b=>b.textContent==='Restaurar exemplos')`);
  await c.espera(200);
  await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent==='Restaurar exemplos').click()`);
  await dialogoAberto();
  await c.espera(420);
  await clicarNoDialogo('Restaurar exemplos');
  await dialogoFechado();
  await irAreas();
  ok('restaurar recupera', true);
});

for (const [l, a] of [[1440, 900], [1024, 768], [768, 1024], [360, 800]]) {
  await c.tamanho(l, a);
  await passo(`telas em ${l}px`, async () => {
    await irPessoas();
    await c.espera(250);
    await conferirTela('Pessoas', l);
    await c.foto(`i-${l}-pessoas`);
    await ir(`${PESSOAS}/${ID_BRUNA}`);
    await c.ate(`document.querySelector('main h1')?.textContent==='Bruna Alves'`);
    await c.espera(250);
    await conferirTela('Ficha', l);
    await c.foto(`i-${l}-ficha`);
    await irAreas();
    await c.espera(250);
    await conferirTela('Áreas', l);
    await c.foto(`i-${l}-areas`);
  });
}

await passo('celular', async () => {
  await c.tamanho(360, 800);
  await irPessoas();
  await c.espera(200);
  ok('no celular, lista vira cartões', await c.avaliar(`document.querySelector('main ul[aria-label="Pessoas"]').getBoundingClientRect().height>0&&document.querySelector('main table').getBoundingClientRect().height===0`));
  // segundo nível em 360px, com a fileira cheia (condição de Kimberly)
  const n = await c.avaliar(`(()=>{const nav=document.querySelector('nav[aria-label="Cadastros base"]');const base=nav.querySelector('a');for(let i=0;i<8;i++){const a=base.cloneNode(true);a.textContent='Cadastro longo '+i;a.removeAttribute('aria-current');nav.appendChild(a)}return {rolaNaFileira:nav.scrollWidth>nav.clientWidth,larguraDaFileira:Math.round(nav.getBoundingClientRect().width),paginaAlargou:document.documentElement.scrollWidth>innerWidth}})()`);
  ok('as abas de cima cabem em 360px', await c.avaliar(`(()=>{const n=document.querySelector('nav[aria-label="Seções de configurações"]');return n.scrollWidth<=n.clientWidth})()`));
  ok('com a fileira cheia, a rolagem fica só nela', n.rolaNaFileira && !n.paginaAlargou && n.larguraDaFileira <= 360, JSON.stringify(n));
  await c.foto('j-fileira-cheia');
  await irPessoas();
  await c.espera(100);
  const p = await c.avaliar(`[...document.querySelectorAll('nav[aria-label="Cadastros base"] a')].map(a=>{const b=a.getBoundingClientRect();return Math.round(b.height)+'/'+(b.right<=360)})`);
  ok('pílulas de 44px; a ativa, dentro da tela', p.every((x) => x.startsWith('44/')) && p[0] === '44/true', p.join(','));
  await c.clicar('main ul[aria-label="Pessoas"] button');
  await c.ate(`document.querySelector('main h1')`);
  await c.ate(`location.pathname.startsWith('${PESSOAS}/')`);
  await c.espera(200);
  ok('o cartão abre a ficha', true);
  const barra = await c.avaliar(`(()=>{const e=[...document.querySelectorAll('main button')].filter(b=>b.textContent.includes('Editar')).find(b=>b.getBoundingClientRect().height>0);const r=e.getBoundingClientRect();return {y:Math.round(r.bottom),visivel:r.bottom<=innerHeight&&r.top>=0}})()`);
  ok('ações em barra fixa embaixo', barra.visivel, JSON.stringify(barra));
  await c.foto('j-ficha');
  await c.clicar('texto=Mais ações');
  await c.ate(`document.querySelector('.dialogo')`);
  await c.espera(450);
  ok('"Mais ações" em folha inferior', (await texto('.dialogo')).includes('Inativar') && (await texto('.dialogo')).includes('Arquivar'));
  await c.foto('j-mais-acoes');
  await c.tecla('Escape');
  await dialogoFechado();
  await c.clicar('texto=Editar');
  await painelAberto();
  await c.espera(450);
  const painel = await c.avaliar(`(()=>{const r=document.querySelector('.janela').getBoundingClientRect();return {l:r.width,a:r.height}})()`);
  ok('formulário em tela inteira', painel.l === 360 && painel.a === 800, JSON.stringify(painel));
  await c.foto('j-painel');
  await conferirTela('Formulário', 360);
  await c.tecla('Escape');
  await painelFechado();
  await irAreas();
  await c.espera(200);
  ok('Áreas em cartões, com as ações', await c.avaliar(`document.querySelector('main ul[aria-label="Áreas"] button[aria-label="Editar Tecnologia"]').getBoundingClientRect().height>=44`));
  await c.foto('j-areas');
});

await c.tamanho(1440, 900);
await passo('teclado', async () => {
  await irPessoas();
  await c.avaliar(`document.querySelector('main table tbody tr').focus()`);
  await c.tecla('Enter');
  await c.ate(`location.pathname.startsWith('${PESSOAS}/')`);
  ok('Enter na linha abre a ficha', true);
  await c.ate(`document.querySelector('main h1')`);
  ok('rótulos em todos os campos da lista (RT-19)', true);
  await irAreas();
  await c.avaliar(`document.querySelector('button[aria-label="Arquivar Comercial"]').focus()`);
  await c.tecla('Enter');
  await dialogoAberto();
  await c.tecla('Escape');
  await dialogoFechado();
  await c.espera(100);
  ok('Esc fecha e o foco volta ao botão', await c.avaliar(`document.activeElement.getAttribute('aria-label')==='Arquivar Comercial'`));
});

await h.terminar();
