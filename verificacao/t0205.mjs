// Verificação da T02.05 (Entidades) e da T02.06 (Contrapartes) no sistema real.
import { iniciar, ID_BRUNA, ID_CAMILA, ID_KIMBERLY, ID_RAFAEL } from './apoio.mjs';

const CONTRAPARTES = '/comercial/contrapartes';
const ENTIDADES = '/configuracoes/cadastros/entidades';
const PESSOAS = '/configuracoes/cadastros/pessoas';
const MARCAS = '/produtos/marcas';
const ID_SOUZA = 'e6a4c5b8-bf73-4e54-8a45-4d5e6f7a8b01';
const ID_ESTUDIO = 'e6a4c5b8-bf73-4e54-8a45-4d5e6f7a8b02';
const ID_NUVEM = 'e6a4c5b8-bf73-4e54-8a45-4d5e6f7a8b03';
const ID_PLANEJADA = 'd5f3b4a7-ae62-4d43-9f34-3c4d5e6f7a01';
const ID_PRODUTO_KIPI = 'c4e2a3f6-9d51-4c32-8e23-2b3c4d5e6f03';
const FICHA_KIPI = `/produtos/${ID_PRODUTO_KIPI}/cadastro`;
const CNPJ = '11.222.333/0001-81';
const CNPJ_LETRAS = '12.ABC.345/01DE-35';
const CPF = '529.982.247-25';

const h = await iniciar({ nome: 't0205', porta: 9346 });
const { c, ok, passo, ir, texto, valor, preencher, escolher, opcoes, esperarAviso, idPorRotulo, marcarPilula, pilulaMarcada, clicarNoDialogo, dialogoAberto, dialogoFechado, painelAberto, painelFechado, pularAbertura, tabela, conferirTela, erroDe } = h;

const linhasProntas = () => c.ate(`document.querySelector('main table tbody tr, main ul[aria-label] li')`);
const linhas = () => c.avaliar(`[...document.querySelectorAll('main table tbody tr')].map(t=>t.children[0].textContent)`);
const quantasLinhas = (n) => c.ate(`document.querySelectorAll('main table tbody tr').length===${n}`);
const irContrapartes = async () => { await ir(CONTRAPARTES); await linhasProntas(); };
const irEntidades = async () => { await ir(ENTIDADES); await linhasProntas(); };
const irPessoas = async () => { await ir(PESSOAS); await linhasProntas(); };
const irFicha = async (id, nome) => { await ir(`${CONTRAPARTES}/${id}/cadastro`); await c.ate(`document.querySelector('main h1')?.textContent===${JSON.stringify(nome)}`); };
const salvarPainel = () => c.avaliar(`document.querySelector('.janela button[type=submit]').click()`);
const novaContraparte = async () => { await c.clicar('texto=Nova contraparte'); await painelAberto(); await c.espera(450); };
const novaEntidade = async () => { await c.clicar('texto=Nova entidade'); await painelAberto(); await c.espera(450); };
const clicarBotaoPrincipal = (rotulo) => c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()===${JSON.stringify(rotulo)}&&b.getBoundingClientRect().height>0).click()`);
const painelTemErro = (parte) => c.ate(`document.querySelector('.janela [role=alert]')?.textContent.includes(${JSON.stringify(parte)})`);
const salvarESaber = async (avisoEsperado) => { await salvarPainel(); await esperarAviso(avisoEsperado); await painelFechado(); };
const aba = async (indice) => { await c.clicar(`main [role=tab]:nth-child(${indice})`); await c.espera(80); };
const painelAtivo = () => texto('main [role=tabpanel][data-state=active]');
const preencherBusca = (novo) => c.avaliar(`(()=>{const e=document.querySelector('main input[type=search]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(novo)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`);
const restaurarExemplos = async () => {
  await ir('/configuracoes/dados');
  await c.ate(`[...document.querySelectorAll('main button')].some(b=>b.textContent==='Restaurar exemplos')`);
  await c.espera(200);
  await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent==='Restaurar exemplos').click()`);
  await dialogoAberto();
  await c.espera(420);
  await clicarNoDialogo('Restaurar exemplos');
  await dialogoFechado();
  await c.ate(`document.querySelector('main').textContent.includes('Registros151')`);
};
const mudarTabela = (nome, corpo) => c.avaliar(`(()=>{const k='numa-central:v1:${nome}';const l=JSON.parse(localStorage.getItem(k));${corpo};localStorage.setItem(k,JSON.stringify(l))})()`);

await c.tamanho(1440, 900);

await passo('segundo nível de Cadastros base', async () => {
  await ir(CONTRAPARTES);
  await pularAbertura();
  await linhasProntas();
  ok('a lista fica em Comercial › Contrapartes (decisão de 07/11/2026)', await c.avaliar(`Boolean(document.querySelector('nav a[href="/comercial/contrapartes"][aria-current]'))`));
  ok('o título da aba diz a tela', (await c.avaliar(`document.title`)).startsWith('Contrapartes'));
  await ir(ENTIDADES);
  await c.ate(`document.querySelector('main h1')?.textContent==='Entidades'`);
  const sub = await c.avaliar(`[...document.querySelectorAll('nav[aria-label="Cadastros base"] a')].map(a=>a.textContent+(a.getAttribute('aria-current')?'*':''))`);
  ok('os cadastros que ficam em Configurações, na ordem', sub.join('|') === 'Pessoas|Áreas|Entidades*|Calendário|Etiquetas', sub.join('|'));
});

await passo('lista de contrapartes', async () => {
  await irContrapartes();
  const m = await texto('main');
  ok('título e total', (await texto('main h1')) === 'Contrapartes' && m.includes('3 contrapartes'));
  const cab = await c.avaliar(`[...document.querySelectorAll('main thead th')].map(t=>t.textContent)`);
  ok('colunas da especificação', cab.join('|') === 'Nome|Tipo de pessoa|Documento|Papéis|Responsável|Situação|Contratados|Interesse|Etapa mais avançada', cab.join('|'));
  const l = await linhas();
  ok('em ordem pelo nome que aparece, com a razão social embaixo', l.join('|') === 'Estúdio Verde Hospedagem Ltda|Nuvem Clara Inc.|Souza ContabilidadeSouza Contabilidade Ltda', l.join('|'));
  ok('nenhum documento inventado', await c.avaliar(`[...document.querySelectorAll('main table tbody tr')].every(t=>t.children[2].textContent==='—')`));
  ok('o filtro diz quantas de cada papel', m.includes('Todas3') && m.includes('Fornecedores3') && m.includes('Clientes0') && m.includes('Parceiros1') && m.includes('Prospects0') && m.includes('Institucionais0'), m.slice(0, 300));
  await c.foto('a-lista');
});

await passo('busca e filtros', async () => {
  await preencherBusca('souza');
  await quantasLinhas(1);
  ok('busca pelo nome fantasia', (await linhas())[0].startsWith('Souza Contabilidade'));
  await preencherBusca('nuvem clara');
  await c.ate(`document.querySelector('main table tbody tr')?.textContent.includes('Nuvem Clara')`);
  ok('busca pela razão social', (await linhas()).length === 1);
  await preencherBusca('contato@exemplo');
  await c.ate(`document.querySelector('main table tbody tr')?.textContent.includes('Souza')`);
  ok('busca pelo e-mail', (await linhas()).length === 1);
  await preencherBusca('ninguém');
  await c.ate(`document.querySelector('main').textContent.includes('Nada com esses filtros.')`);
  ok('vazio por filtro', true);
  await c.clicar('texto=Limpar filtros');
  await quantasLinhas(3);
  await c.avaliar(`[...document.querySelectorAll('main button[aria-pressed]')].find(b=>b.textContent.startsWith('Parceiros')).click()`);
  await quantasLinhas(1);
  ok('filtro de papel', (await linhas())[0].startsWith('Estúdio Verde'));
  await c.avaliar(`[...document.querySelectorAll('main button[aria-pressed]')].find(b=>b.textContent.startsWith('Fornecedores')).click()`);
  await quantasLinhas(3);
  ok('quem tem dois papéis aparece nas duas visões, sem duplicar (CA-02.06)', (await linhas()).filter((n) => n.startsWith('Estúdio Verde')).length === 1);
  await c.avaliar(`[...document.querySelectorAll('main button[aria-pressed]')].find(b=>b.textContent.startsWith('Todas')).click()`);
  await c.clicar('texto=Filtros');
  await c.ate(`document.querySelector('.menu-suspenso')`);
  await c.espera(150);
  await c.foto('b-filtros');
  ok('filtros da especificação', await c.avaliar(`['Situação','Responsável','Estado','Cidade','Origem'].every(t=>document.querySelector('.menu-suspenso').textContent.includes(t))`));
  await escolher('filtro-responsavel', ID_CAMILA);
  await quantasLinhas(2);
  ok('filtro de responsável', (await linhas()).every((n) => !n.startsWith('Souza')));
  await escolher('filtro-responsavel', '');
  ok('as cidades vêm dos cadastros', (await opcoes('filtro-cidade')).join('|') === 'Todas|Rio de Janeiro', (await opcoes('filtro-cidade')).join('|'));
  await escolher('filtro-cidade', 'Rio de Janeiro');
  await quantasLinhas(1);
  ok('filtro de cidade', (await linhas())[0].startsWith('Souza') && (await texto('main')).includes('Cidade: Rio de Janeiro'));
  await escolher('filtro-cidade', '');
  await quantasLinhas(3);
  await escolher('filtro-uf', 'RJ');
  await quantasLinhas(1);
  ok('filtro de estado', (await linhas())[0].startsWith('Souza'));
  ok('o botão diz quantos filtros há', (await c.avaliar(`[...document.querySelectorAll('main button')].some(b=>b.textContent==='Filtros (1)')`)));
  await c.tecla('Escape');
  await c.ate(`!document.querySelector('.menu-suspenso')`);
  await c.espera(100);
  await c.clicar('button[aria-label="Remover filtro: Estado: RJ"]');
  await quantasLinhas(3);
  ok('etiqueta removível', true);
  await c.clicar('texto=Filtros');
  await c.ate(`document.querySelector('.menu-suspenso')`);
  await c.espera(150);
  await escolher('filtro-origem', 'evento');
  await c.ate(`document.querySelector('main').textContent.includes('Nada com esses filtros.')`);
  ok('filtro de origem', true);
  await escolher('filtro-origem', '');
  await c.tecla('Escape');
  await c.ate(`!document.querySelector('.menu-suspenso')`);
  await quantasLinhas(3);
});

await passo('formulário: padrões', async () => {
  await novaContraparte();
  ok('título', (await texto('.janela h2')).includes('Nova contraparte'));
  ok('pessoa jurídica e fornecedor por padrão', (await pilulaMarcada('Tipo de pessoa', 'Pessoa jurídica')) && (await pilulaMarcada('Papéis', 'Fornecedor')));
  ok('situação ativa por padrão', await pilulaMarcada('Situação', 'Ativa'));
  ok('Brasil por padrão, e em primeiro', (await valor(await idPorRotulo('País'))) === 'BR' && (await opcoes(await idPorRotulo('País')))[0] === 'Brasil');
  ok('lista completa de países', (await opcoes(await idPorRotulo('País'))).length > 200);
  ok('a responsável sugerida é a pessoa atual', (await valor('contraparte-responsavel')) === ID_KIMBERLY);
  ok('só pessoas internas ativas como responsável', (await opcoes('contraparte-responsavel')).join('|') === 'Kimberly Grebe|Camila Lima|Bruna Alves', (await opcoes('contraparte-responsavel')).join('|'));
  ok('sem campo de classe (03 §0)', !(await texto('.janela')).includes('Classe'));
  ok('origens da especificação', (await opcoes(await idPorRotulo('Origem'))).join('|') === 'Não informada|Indicação|Rede social|Site|Evento|Busca ativa|Outro', (await opcoes(await idPorRotulo('Origem'))).join('|'));
  await c.foto('c-formulario');
});

await passo('formulário: validações', async () => {
  await salvarPainel();
  await painelTemErro('Informe o nome ou a razão social.');
  ok('nome obrigatório, com resumo', true);
  await marcarPilula('Papéis', 'Fornecedor');
  await painelTemErro('Escolha pelo menos um papel.');
  ok('pelo menos um papel', (await texto('#contraparte-papeis')).includes('Escolha pelo menos um papel.'));
  await marcarPilula('Papéis', 'Fornecedor');
  await preencher('contraparte-nome', 'Lumi Serviços Ltda');

  await preencher('contraparte-documento', '11222333000181');
  ok('máscara de CNPJ', (await valor('contraparte-documento')) === CNPJ, await valor('contraparte-documento'));
  await preencher('contraparte-documento', '11222333000100');
  await salvarPainel();
  await painelTemErro('Este CNPJ não é válido.');
  ok('CNPJ inválido bloqueia', true);
  await preencher('contraparte-documento', '12abc34501de35');
  ok('CNPJ alfanumérico, com a máscara em maiúsculas', (await valor('contraparte-documento')) === CNPJ_LETRAS, await valor('contraparte-documento'));

  await marcarPilula('Tipo de pessoa', 'Pessoa física');
  await c.espera(60);
  ok('pessoa física pede CPF', await c.avaliar(`[...document.querySelectorAll('.janela label')].some(l=>l.textContent.startsWith('CPF'))`));
  await preencher('contraparte-documento', '52998224700');
  ok('máscara de CPF', (await valor('contraparte-documento')) === '529.982.247-00', await valor('contraparte-documento'));
  await salvarPainel();
  await painelTemErro('Este CPF não é válido.');
  ok('CPF inválido bloqueia', true);

  await marcarPilula('Tipo de pessoa', 'Estrangeira');
  await c.espera(60);
  ok('estrangeira pede ID estrangeiro e explica', await c.avaliar(`document.querySelector('.janela').textContent.includes('ID estrangeiro')&&document.querySelector('.janela').textContent.includes('não precisa de CPF nem CNPJ')`));
  await preencher('contraparte-documento', '12-3456789');
  ok('sem máscara no ID estrangeiro', (await valor('contraparte-documento')) === '12-3456789');

  await preencher('contraparte-site', 'exemplo.com');
  await preencher('contraparte-email', 'isso-nao');
  await preencher('contraparte-telefone', '219999');
  await preencher('contraparte-endereco-cep', '2004');
  await salvarPainel();
  await painelTemErro('Use o endereço completo');
  const r = await texto('.janela [role=alert]');
  ok('site, e-mail, telefone e CEP, todos no resumo', r.includes('Informe um e-mail válido.') && r.includes('Use o formato (00) 00000-0000.') && r.includes('Use o formato 00000-000.'), r);
  await c.foto('d-erros');
  await preencher('contraparte-telefone', '21999998888');
  ok('máscara do telefone no Brasil', (await valor('contraparte-telefone')) === '(21) 99999-8888', await valor('contraparte-telefone'));
  await preencher('contraparte-endereco-cep', '20040002');
  ok('máscara do CEP no Brasil', (await valor('contraparte-endereco-cep')) === '20040-002', await valor('contraparte-endereco-cep'));
  ok('estado como lista, no Brasil', (await c.avaliar(`document.getElementById('contraparte-endereco-uf').tagName`)) === 'SELECT');
  await escolher('contraparte-endereco-uf', 'RJ');
  ok('com os 27 estados', (await opcoes('contraparte-endereco-uf')).length === 28);

  await escolher(await idPorRotulo('País'), 'US');
  await c.espera(100);
  ok('fora do Brasil, código postal e estado em texto', (await texto('.janela')).includes('Código postal') && (await c.avaliar(`document.getElementById('contraparte-endereco-uf').tagName`)) === 'INPUT');
  ok('o estado do Brasil não vai junto', (await valor('contraparte-endereco-uf')) === '');
  await preencher('contraparte-telefone', '+1 415 555 0100');
  await preencher('contraparte-endereco-cep', '94103-1234');
  ok('sem máscara fora do Brasil', (await valor('contraparte-telefone')) === '+1 415 555 0100' && (await valor('contraparte-endereco-cep')) === '94103-1234');
  await preencher('contraparte-endereco-uf', 'California');
  await escolher(await idPorRotulo('País'), 'BR');
  await c.espera(100);
  ok('o texto de fora não vira estado do Brasil', (await c.avaliar(`document.getElementById('contraparte-endereco-uf').tagName`)) === 'SELECT' && (await valor('contraparte-endereco-uf')) === '');
  await salvarPainel();
  await painelTemErro('Use o formato (00) 00000-0000.');
  ok('voltou ao Brasil, o que veio de fora é conferido', (await texto('.janela [role=alert]')).includes('Use o formato 00000-000.'));

  // sair sem salvar pergunta antes
  await c.tecla('Escape');
  await c.ate(`document.querySelector('.dialogo')?.textContent.includes('Descartar as alterações?')`);
  ok('sair com alterações pergunta', true);
  await c.espera(350);
  await clicarNoDialogo('Descartar alterações');
  await dialogoFechado();
  await painelFechado();
});

await passo('cadastrar e duplicidade', async () => {
  await novaContraparte();
  await preencher('contraparte-nome', 'Lumi Serviços Ltda');
  await preencher(await idPorRotulo('Nome fantasia'), 'Lumi');
  await preencher('contraparte-documento', '11222333000181');
  await escolher(await idPorRotulo('Origem'), 'indicacao');
  await salvarPainel();
  await esperarAviso('Contraparte cadastrada.');
  await painelFechado();
  await quantasLinhas(4);
  const lumi = (await tabela('contraparte')).find((x) => x.nome === 'Lumi Serviços Ltda');
  ok('grava o documento normalizado', lumi.documento === '11222333000181' && lumi.documento_normalizado === '11222333000181', lumi.documento);
  ok('classe no padrão, sem marca de exemplo', lumi.classe === 'int' && lumi.exemplo === false, lumi.classe);
  ok('o nome fantasia aparece na lista', (await linhas()).some((n) => n.startsWith('LumiLumi Serviços')), (await linhas()).join('|'));
  ok('o documento aparece com a máscara', (await texto('main table')).includes(CNPJ));

  // CA-02.05
  await novaContraparte();
  await preencher('contraparte-nome', 'Outro Nome Qualquer');
  await preencher('contraparte-documento', '11222333000181');
  await salvarPainel();
  await c.ate(`document.querySelector('.janela').textContent.includes('Abrir a ficha de Lumi')`);
  ok('CNPJ repetido bloqueia e oferece a ficha (CA-02.05)', (await erroDe('contraparte-documento')).includes('Já existe: Lumi.'), await erroDe('contraparte-documento'));
  const href = await c.avaliar(`[...document.querySelectorAll('.janela a')].find(a=>a.textContent.includes('Abrir a ficha de Lumi')).getAttribute('href')`);
  ok('o link abre a ficha certa', href === `${CONTRAPARTES}/${lumi.id}/cadastro`, href);
  ok('não cria nada', (await tabela('contraparte')).length === 4);
  await c.foto('e-repetido');

  // só avisam
  await preencher('contraparte-documento', '');
  await preencher('contraparte-nome', 'Souza Contabilidade Ltda.');
  await preencher('contraparte-email', 'contato@exemplo.com.br');
  await salvarPainel();
  await c.ate(`document.querySelector('.dialogo')?.textContent.includes('Salvar mesmo assim?')`);
  const d = await texto('.dialogo');
  ok('nome parecido e e-mail igual só avisam', d.includes('Nome parecido com Souza Contabilidade.') && d.includes('E-mail igual ao de Souza Contabilidade.'), d);
  await c.espera(350);
  await clicarNoDialogo('Voltar e revisar');
  await dialogoFechado();
  ok('voltar não grava', (await tabela('contraparte')).length === 4);
  await preencher('contraparte-email', '');
  await preencher('contraparte-nome', 'Clínica Sol');
  await preencher(await idPorRotulo('Observações'), 'senha: abc123');
  await c.ate(`document.querySelector('.janela').textContent.includes('senha ou um token') || document.querySelector('.janela').textContent.includes('Parece')`);
  ok('observação com segredo: avisa na hora (RT-14)', true);
  await c.foto('e-segredo');
  await salvarPainel();
  await c.ate(`document.querySelector('.dialogo')?.textContent.includes('Salvar mesmo assim?')`);
  ok('e pede confirmação', (await texto('.dialogo')).includes('senha ou um token'), await texto('.dialogo'));
  await c.espera(350);
  await clicarNoDialogo('Voltar e revisar');
  await dialogoFechado();
  await preencher(await idPorRotulo('Observações'), '');

  // dois papéis, alfanumérico, pessoa física
  await preencher('contraparte-documento', '12ABC34501DE35');
  await marcarPilula('Papéis', 'Cliente');
  await salvarPainel();
  await esperarAviso('Contraparte cadastrada.');
  await painelFechado();
  const sol = (await tabela('contraparte')).find((x) => x.nome === 'Clínica Sol');
  ok('CNPJ alfanumérico é aceito', sol.documento === '12ABC34501DE35', sol.documento);
  ok('dois papéis', sol.papeis.join('|') === 'fornecedor|cliente', sol.papeis.join('|'));
  ok('aparece com a máscara', (await texto('main table')).includes(CNPJ_LETRAS));

  await novaContraparte();
  await marcarPilula('Tipo de pessoa', 'Pessoa física');
  await preencher('contraparte-nome', 'Ana Lima Prado');
  await preencher('contraparte-documento', CPF);
  await marcarPilula('Papéis', 'Fornecedor');
  await marcarPilula('Papéis', 'Prospect');
  await salvarPainel();
  await esperarAviso('Contraparte cadastrada.');
  await painelFechado();
  ok('pessoa física com CPF', (await tabela('contraparte')).find((x) => x.nome === 'Ana Lima Prado').documento === '52998224725');
  const m = await texto('main');
  ok('os contadores acompanham', m.includes('6 contrapartes') && m.includes('Prospects1') && m.includes('Clientes1'), m.slice(0, 300));

  // estrangeira sem documento
  await novaContraparte();
  await marcarPilula('Tipo de pessoa', 'Estrangeira');
  await preencher('contraparte-nome', 'Hosting Far Away LLC');
  await escolher(await idPorRotulo('País'), 'US');
  await c.espera(60);
  await preencher('contraparte-telefone', '+1 415 555 0100');
  await preencher('contraparte-endereco-uf', 'California');
  await preencher('contraparte-site', 'https://exemplo.com');
  await salvarPainel();
  await esperarAviso('Contraparte cadastrada.');
  await painelFechado();
  const far = (await tabela('contraparte')).find((x) => x.nome === 'Hosting Far Away LLC');
  ok('estrangeira dispensa documento', far.documento === null && far.pais === 'US' && far.telefone === '+1 415 555 0100' && far.endereco.uf === 'California', JSON.stringify(far.endereco));
  // ficha da estrangeira
  await irFicha(far.id, 'Hosting Far Away LLC');
  const fm = await texto('main');
  ok('a ficha mostra o país em português e o telefone como veio', fm.includes('Estados Unidos') && fm.includes('+1 415 555 0100'), fm.slice(0, 400));
});

await passo('ficha da contraparte', async () => {
  await irContrapartes();
  await c.clicar('main table tbody tr:nth-child(5)');
  await c.ate(`location.pathname.startsWith('${CONTRAPARTES}/')`);
  await c.ate(`document.querySelector('main h1')`);
  ok('a linha abre a ficha', true);
  await irFicha(ID_SOUZA, 'Souza Contabilidade');
  ok('o título da aba diz a tela', (await c.avaliar(`document.title`)).startsWith('Ficha da contraparte'), await c.avaliar(`document.title`));
  const abas = await c.avaliar(`[...document.querySelectorAll('main [role=tab]')].map(t=>t.textContent).join('|')`);
  ok('abas da F0a que já existem', abas === 'Resumo|Contatos (1)|Ferramentas fornecidas|Lançamentos|Atividades|Histórico', abas);
  const m = await painelAtivo();
  ok('resumo por extenso', m.includes('Souza Contabilidade Ltda') && m.includes('Pessoa jurídica') && m.includes('Rio de Janeiro, RJ') && m.includes('Kimberly Grebe') && m.includes('Fornecedor') && m.includes('Brasil'), m);
  ok('sem documento inventado', !/\d{2}\.\d{3}\.\d{3}/.test(m));
  await c.foto('f-ficha');
  await aba(2);
  const contatos = await painelAtivo();
  ok('contatos, com o papel', contatos.includes('Rafael Souza') && contatos.includes('Principal') && contatos.includes('Financeiro') && contatos.includes('Contador'), contatos);
  await c.foto('f-contatos');
  ok('o contato leva à ficha da pessoa', await c.avaliar(`Boolean(document.querySelector('main [role=tabpanel][data-state=active] a[href="${PESSOAS}/${ID_RAFAEL}"]'))`));

  // novo contato
  await c.clicar('texto=Novo contato');
  await painelAberto();
  await c.espera(450);
  ok('novo contato já vem como Externa', await pilulaMarcada('Tipo', 'Externa'));
  ok('e com a contraparte escolhida', (await valor(await idPorRotulo('Contraparte'))) === ID_SOUZA);
  await c.foto('f-novo-contato');
  await preencher(await idPorRotulo('Nome completo'), 'Dora Nunes');
  await marcarPilula('Papel do contato', 'Financeiro');
  await salvarPainel();
  await esperarAviso('Contato cadastrado.');
  await painelFechado();
  await c.ate(`[...document.querySelectorAll('main [role=tab]')].some(t=>t.textContent==='Contatos (2)')`);
  const dora = (await tabela('pessoa')).find((x) => x.nome_completo === 'Dora Nunes');
  ok('o contato fica ligado à contraparte', dora.contraparte_id === ID_SOUZA && dora.tipo === 'externa');
  ok('aparece na aba', (await painelAtivo()).includes('Dora Nunes'));

  // editar
  await aba(1);
  await clicarBotaoPrincipal('Editar');
  await painelAberto();
  await c.espera(450);
  ok('o formulário vem preenchido', (await valor('contraparte-nome')) === 'Souza Contabilidade Ltda' && (await valor(await idPorRotulo('Nome fantasia'))) === 'Souza Contabilidade' && (await valor('contraparte-endereco-uf')) === 'RJ');
  ok('título de edição', (await texto('.janela h2')).includes('Editar contraparte'));
  await preencher('contraparte-telefone', '21988887777');
  await preencher('contraparte-documento', CNPJ.replace('11.222.333/0001-81', '11.444.777/0001-61'));
  await marcarPilula('Papéis', 'Institucional');
  await salvarPainel();
  await esperarAviso('Contraparte atualizada.');
  await painelFechado();
  await c.ate(`document.querySelector('main [role=tabpanel][data-state=active]').textContent.includes('(21) 98888-7777')`);
  ok('o resumo acompanha', (await painelAtivo()).includes('Institucional') && (await painelAtivo()).includes('11.444.777/0001-61'));
  await aba(6);
  await c.ate(`document.querySelector('main [role=tabpanel][data-state=active]').textContent.includes('alterou')`);
  const hist = await painelAtivo();
  ok('o histórico diz o que mudou', hist.includes('Souza Contabilidade') && hist.includes('Telefone'), hist.slice(0, 400));
  ok('sem mostrar o documento no histórico', !hist.includes('11.444.777') && !hist.includes('11444777'), hist.slice(0, 400));
  await aba(1);

  // inativar e reativar
  await clicarBotaoPrincipal('Inativar');
  await dialogoAberto();
  await c.espera(350);
  ok('inativar pede confirmação', (await texto('.dialogo')).includes('Inativar Souza Contabilidade?'));
  await clicarNoDialogo('Inativar contraparte');
  await esperarAviso('Contraparte inativada.');
  await dialogoFechado();
  await c.ate(`document.querySelector('main').textContent.includes('Reativar')`);
  ok('fica inativa', (await tabela('contraparte')).find((x) => x.id === ID_SOUZA).situacao === 'inativa');
  await clicarBotaoPrincipal('Reativar');
  await esperarAviso('Contraparte reativada.');
  await c.ate(`[...document.querySelectorAll('main button')].some(b=>b.textContent==='Inativar')`);
  ok('reativa sem confirmar', (await tabela('contraparte')).find((x) => x.id === ID_SOUZA).situacao === 'ativa');

  // arquivar bloqueado
  await clicarBotaoPrincipal('Arquivar');
  await dialogoAberto();
  await c.espera(350);
  const bloqueio = await texto('.dialogo');
  ok('com contatos não arquiva, e diz por quê', bloqueio.includes('Não dá para arquivar Souza Contabilidade') && bloqueio.includes('Contato: Rafael Souza') && bloqueio.includes('Contato: Dora Nunes') && bloqueio.includes('inative'), bloqueio);
  await c.foto('f-bloqueio');
  ok('só um botão', (await c.avaliar(`document.querySelectorAll('.dialogo button').length`)) === 1);
  await clicarNoDialogo('Entendi');
  await dialogoFechado();

  // arquivar sem vínculo: a Nuvem Clara fornece uma ferramenta de exemplo, e deixa de fornecer aqui
  await mudarTabela('ferramenta', `l.forEach(x=>{if(x.fornecedor_id==='${ID_NUVEM}')x.fornecedor_id=null})`);
  await mudarTabela('titulo', `l.forEach(x=>{if(x.contraparte_id==='${ID_NUVEM}')x.contraparte_id=null})`);
  await irFicha(ID_NUVEM, 'Nuvem Clara Inc.');
  await clicarBotaoPrincipal('Arquivar');
  await dialogoAberto();
  await c.espera(350);
  ok('sem vínculos, pede confirmação', (await texto('.dialogo')).includes('Arquivar Nuvem Clara Inc.?'));
  await clicarNoDialogo('Arquivar contraparte');
  await esperarAviso('Contraparte arquivada.');
  await dialogoFechado();
  await c.ate(`document.querySelector('main').textContent.includes('Esta contraparte está arquivada')`);
  ok('a ficha diz que está arquivada, sem ações de edição', !(await c.avaliar(`[...document.querySelectorAll('main button')].some(b=>b.textContent==='Editar')`)));
  await aba(2);
  ok('sem novo contato numa arquivada', !(await c.avaliar(`[...document.querySelectorAll('main button')].some(b=>b.textContent.includes('Novo contato'))`)));
  await aba(1);
  await irContrapartes();
  ok('sai da lista', !(await linhas()).some((n) => n.startsWith('Nuvem')));
  await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent==='Arquivados (1)').click()`);
  await c.ate(`document.querySelector('main table tbody tr')?.textContent.includes('Nuvem Clara')`);
  ok('aparece em Arquivados', true);
  await c.clicar('main table tbody tr');
  await c.ate(`document.querySelector('main h1')?.textContent==='Nuvem Clara Inc.'`);
  await clicarBotaoPrincipal('Restaurar');
  await esperarAviso('Contraparte restaurada.');
  await c.ate(`!document.querySelector('main').textContent.includes('Esta contraparte está arquivada')`);
  ok('dá para restaurar', (await tabela('contraparte')).find((x) => x.id === ID_NUVEM).arquivado_em === null);
  await aba(6);
  await c.ate(`document.querySelector('main [role=tabpanel][data-state=active]').textContent.includes('restaurou')`);
  ok('o histórico registra', (await painelAtivo()).includes('arquivou'));
});

await passo('responsável fora da lista', async () => {
  await mudarTabela('contraparte', `l.find(x=>x.id==='${ID_ESTUDIO}').responsavel_id='${ID_BRUNA}'`);
  await mudarTabela('pessoa', `l.find(x=>x.id==='${ID_BRUNA}').situacao='inativa'`);
  await irContrapartes();
  const linha = await c.avaliar(`[...document.querySelectorAll('main table tbody tr')].find(t=>t.textContent.includes('Estúdio Verde')).textContent`);
  ok('a lista avisa, com o nome', linha.includes('Bruna Alves') && linha.includes('Escolha outra pessoa'), linha);
  await irFicha(ID_ESTUDIO, 'Estúdio Verde Hospedagem Ltda');
  ok('a ficha avisa', (await painelAtivo()).includes('edite e escolha outra pessoa'));
  await clicarBotaoPrincipal('Editar');
  await painelAberto();
  await c.espera(450);
  ok('o formulário pede outra, sem trocar sozinho', (await texto('.janela')).includes('A pessoa responsável não está mais na lista.') && (await valor('contraparte-responsavel')) === '');
  await salvarPainel();
  await painelTemErro('Escolha a pessoa responsável.');
  ok('não salva sem responsável', true);
  await escolher('contraparte-responsavel', ID_CAMILA);
  await salvarESaber('Contraparte atualizada.');
  ok('escolhendo outra, salva', (await tabela('contraparte')).find((x) => x.id === ID_ESTUDIO).responsavel_id === ID_CAMILA);
  await mudarTabela('pessoa', `l.find(x=>x.id==='${ID_BRUNA}').situacao='ativa'`);
});

await passo('pessoa que é responsável não arquiva', async () => {
  await ir(`${PESSOAS}/${ID_CAMILA}`);
  await c.ate(`document.querySelector('main h1')?.textContent==='Camila Lima'`);
  await clicarBotaoPrincipal('Arquivar');
  await dialogoAberto();
  await c.espera(350);
  const d = await texto('.dialogo');
  ok('diz de quais contrapartes é responsável', d.includes('Estúdio Verde') && d.includes('Nuvem Clara'), d);
  await clicarNoDialogo('Entendi');
  await dialogoFechado();
});

await passo('vínculo em Pessoas', async () => {
  await irPessoas();
  const rafael = await c.avaliar(`[...document.querySelectorAll('main table tbody tr')].find(t=>t.textContent.includes('Rafael Souza')).children[2].textContent`);
  ok('coluna Vínculo', rafael === 'Souza Contabilidade', rafael);
  const kim = await c.avaliar(`[...document.querySelectorAll('main table tbody tr')].find(t=>t.textContent.includes('Kimberly')).children[2].textContent`);
  ok('interna sem vínculo', kim === '—', kim);
  await c.clicar('texto=Filtros');
  await c.ate(`document.querySelector('.menu-suspenso')`);
  await c.espera(150);
  await escolher('filtro-contraparte', ID_SOUZA);
  await quantasLinhas(2);
  ok('filtro por contraparte', (await linhas()).join('|').includes('Rafael Souza') && (await linhas()).join('|').includes('Dora Nunes'));
  await c.tecla('Escape');
  await c.ate(`!document.querySelector('.menu-suspenso')`);
  await c.espera(100);
  ok('etiqueta do filtro', (await texto('main')).includes('Contraparte: Souza Contabilidade'));
  await c.clicar('button[aria-label="Remover filtro: Contraparte: Souza Contabilidade"]');
  await quantasLinhas(5);

  await c.clicar('texto=Nova pessoa');
  await painelAberto();
  await c.espera(450);
  ok('interna: sem contraparte', !(await texto('.janela')).includes('Contraparte'));
  await marcarPilula('Tipo', 'Externa');
  await c.espera(80);
  ok('externa: pode escolher a contraparte', (await opcoes(await idPorRotulo('Contraparte'))).includes('Souza Contabilidade'));
  ok('é opcional', (await opcoes(await idPorRotulo('Contraparte')))[0] === 'Nenhuma');
  await c.tecla('Escape');
  await c.ate(`!document.querySelector('.janela') || document.querySelector('.dialogo')`);
  if (await c.avaliar(`Boolean(document.querySelector('.dialogo'))`)) { await c.espera(350); await clicarNoDialogo('Descartar alterações'); await dialogoFechado(); }
  await painelFechado();

  await ir(`${PESSOAS}/${ID_RAFAEL}`);
  await c.ate(`document.querySelector('main h1')?.textContent==='Rafael Souza'`);
  ok('a ficha da pessoa leva à contraparte', await c.avaliar(`Boolean(document.querySelector('main a[href="${CONTRAPARTES}/${ID_SOUZA}/cadastro"]'))`));
  await c.avaliar(`document.querySelector('main a[href="${CONTRAPARTES}/${ID_SOUZA}/cadastro"]').click()`);
  await c.ate(`document.querySelector('main h1')?.textContent==='Souza Contabilidade'`);
  ok('e o link funciona', true);

  // contraparte inativa sai das opções de quem ainda não a tem
  await mudarTabela('contraparte', `l.find(x=>x.id==='${ID_NUVEM}').situacao='inativa'`);
  await irPessoas();
  await c.clicar('texto=Nova pessoa');
  await painelAberto();
  await c.espera(450);
  await marcarPilula('Tipo', 'Externa');
  await c.espera(80);
  ok('contraparte inativa não é oferecida', !(await opcoes(await idPorRotulo('Contraparte'))).includes('Nuvem Clara Inc.'));
  await c.tecla('Escape');
  await c.ate(`!document.querySelector('.janela') || document.querySelector('.dialogo')`);
  if (await c.avaliar(`Boolean(document.querySelector('.dialogo'))`)) { await c.espera(350); await clicarNoDialogo('Descartar alterações'); await dialogoFechado(); }
  await painelFechado();
});

await passo('lista de entidades', async () => {
  await irEntidades();
  ok('título', (await texto('main h1')) === 'Entidades' && (await texto('main')).includes('1 entidade: quem assina pela Numa'), (await texto('main')).slice(0, 200));
  const cab = await c.avaliar(`[...document.querySelectorAll('main thead th')].map(t=>t.textContent)`);
  ok('colunas', cab.slice(0, 5).join('|') === 'Entidade|Tipo|Documento|Abertura|Situação', cab.join('|'));
  const l = await linhas();
  ok('a planejada da carga inicial, como padrão (T02.05)', l[0] === 'Planejada — NumaPadrão', l[0]);
  ok('situação planejada, sem documento inventado', await c.avaliar(`(()=>{const t=document.querySelector('main table tbody tr');return t.children[4].textContent==='Planejada'&&t.children[2].textContent==='—'&&t.children[3].textContent==='—'})()`));
  await c.foto('g-entidades');
});

await passo('entidade: validações', async () => {
  await novaEntidade();
  ok('planejada por padrão', await pilulaMarcada('Situação', 'Planejada'));
  ok('todas as situações', await c.avaliar(`['Planejada','Em constituição','Ativa','Encerrada'].every(t=>[...document.querySelectorAll('.janela fieldset label')].some(l=>l.textContent===t))`));
  await salvarPainel();
  await painelTemErro('Informe o nome ou a razão social.');
  ok('nome obrigatório, com resumo', true);
  await preencher('entidade-nome', 'Numa Tecnologia Ltda');
  await marcarPilula('Situação', 'Ativa');
  await c.ate(`document.querySelector('.janela').textContent.includes('Para ativar, são obrigatórios')`);
  ok('ativa: explica o que precisa', (await texto('.janela')).includes('CNPJ válido, endereço, representante legal e data de abertura'));
  await salvarPainel();
  await painelTemErro('Para ativar, informe o CNPJ.');
  const r = await texto('.janela [role=alert]');
  ok('ativa exige os quatro, todos no resumo', r.includes('Para ativar, preencha o endereço') && r.includes('Para ativar, escolha pelo menos um representante legal.') && r.includes('Para ativar, informe a data de abertura.'), r);
  ok('o erro do representante aparece junto do campo', (await texto('#entidade-representantes')).includes('Para ativar, escolha pelo menos um representante legal.'));
  await c.foto('g-ativa-erros');
  await preencher('entidade-documento', '11222333000100');
  await salvarPainel();
  await painelTemErro('Este CNPJ não é válido.');
  ok('CNPJ inválido não ativa', true);
  await preencher('entidade-documento', '11222333000181');
  ok('máscara de CNPJ', (await valor('entidade-documento')) === CNPJ);
  await marcarPilula('Tipo', 'Pessoa física');
  await c.espera(60);
  ok('pessoa física pede CPF', await c.avaliar(`[...document.querySelectorAll('.janela label')].some(l=>l.textContent.startsWith('CPF'))`));
  await marcarPilula('Tipo', 'Pessoa jurídica');
  await c.espera(60);
  await preencher('entidade-documento', '11222333000181');
  await preencher('entidade-endereco-cep', '2004');
  await salvarPainel();
  await painelTemErro('Use o formato 00000-000.');
  ok('CEP em formato errado', true);
  await preencher('entidade-endereco-cep', '20040002');
  await preencher('entidade-endereco-logradouro', 'Avenida Teste');
  await preencher('entidade-endereco-numero', '100');
  await preencher('entidade-endereco-bairro', 'Centro');
  await preencher('entidade-endereco-cidade', 'Rio de Janeiro');
  await escolher('entidade-endereco-uf', 'RJ');
  ok('representantes: só pessoas internas ativas', await c.avaliar(`(()=>{const f=[...document.querySelectorAll('fieldset')].find(x=>x.querySelector('legend').textContent.startsWith('Representantes'));const t=[...f.querySelectorAll('label')].map(l=>l.textContent).join('|');return t==='Kimberly Grebe|Camila Lima|Bruna Alves'})()`));
  await marcarPilula('Representantes legais', 'Kimberly Grebe');
  await marcarPilula('Representantes legais', 'Camila Lima');
  await preencher('entidade-abertura', '2026-11-06');
  const contadores = await opcoes(await idPorRotulo('Contador responsável'));
  ok('contador: contrapartes ativas', contadores.includes('Souza Contabilidade') && !contadores.includes('Nuvem Clara Inc.'), contadores.join('|'));
  await escolher(await idPorRotulo('Contador responsável'), ID_SOUZA);
  await marcarPilula('Entidade padrão', 'Sim');
  await c.foto('g-ativa-pronta');
  await salvarESaber('Entidade criada.');
  await quantasLinhas(2);
});

await passo('entidade: padrão único, representantes, histórico', async () => {
  const t = await tabela('entidade');
  const nova = t.find((x) => x.nome === 'Numa Tecnologia Ltda');
  ok('só uma padrão', t.filter((x) => x.entidade_padrao).map((x) => x.id).join() === nova.id);
  ok('a etiqueta acompanha', (await linhas()).join('|') === 'Numa Tecnologia LtdaPadrão|Planejada — Numa', (await linhas()).join('|'));
  ok('situação e documento na lista', await c.avaliar(`[...document.querySelectorAll('main table tbody tr')].find(t=>t.textContent.includes('Numa Tecnologia')).textContent.includes('11.222.333/0001-81')`));
  const r = (await tabela('entidade_representante')).filter((x) => x.entidade_id === nova.id && !x.arquivado_em);
  ok('dois representantes gravados', r.length === 2 && r.some((x) => x.pessoa_id === ID_KIMBERLY) && r.some((x) => x.pessoa_id === ID_CAMILA));
  // editar traz tudo de volta
  await c.clicar('button[aria-label="Editar Numa Tecnologia Ltda"]');
  await painelAberto();
  await c.espera(450);
  ok('o formulário vem preenchido', (await valor('entidade-nome')) === 'Numa Tecnologia Ltda' && (await valor('entidade-documento')) === CNPJ && (await valor('entidade-endereco-uf')) === 'RJ' && (await valor('entidade-abertura')) === '2026-11-06' && (await valor(await idPorRotulo('Contador responsável'))) === ID_SOUZA);
  ok('representantes marcados', (await pilulaMarcada('Representantes legais', 'Kimberly Grebe')) && (await pilulaMarcada('Representantes legais', 'Camila Lima')) && !(await pilulaMarcada('Representantes legais', 'Bruna Alves')));
  await marcarPilula('Representantes legais', 'Kimberly Grebe');
  await marcarPilula('Representantes legais', 'Camila Lima');
  await salvarPainel();
  await painelTemErro('Para ativar, escolha pelo menos um representante legal.');
  ok('sem representante, ativa não salva', true);
  await marcarPilula('Representantes legais', 'Camila Lima');
  await salvarESaber('Entidade atualizada.');
  const r2 = (await tabela('entidade_representante')).filter((x) => x.entidade_id === nova.id && !x.arquivado_em);
  ok('tirar um representante', r2.length === 1 && r2[0].pessoa_id === ID_CAMILA, JSON.stringify(r2.map((x) => x.pessoa_id)));
  // encerrada
  await c.clicar('button[aria-label="Editar Numa Tecnologia Ltda"]');
  await painelAberto();
  await c.espera(450);
  await marcarPilula('Situação', 'Encerrada');
  await salvarPainel();
  await painelTemErro('Uma entidade encerrada não pode ser a padrão.');
  ok('encerrada não pode ser a padrão', (await texto('#entidade-padrao')).includes('Uma entidade encerrada não pode ser a padrão.'));
  await marcarPilula('Entidade padrão', 'Não');
  await marcarPilula('Situação', 'Ativa');
  await marcarPilula('Entidade padrão', 'Sim');
  await salvarESaber('Entidade atualizada.');
  // representante que saiu da lista
  await mudarTabela('pessoa', `l.find(x=>x.id==='${ID_CAMILA}').situacao='inativa'`);
  await irEntidades();
  await c.clicar('button[aria-label="Editar Numa Tecnologia Ltda"]');
  await painelAberto();
  await c.espera(450);
  const p = await texto('.janela');
  ok('representante fora da lista: avisa, e continua marcado até alguém tirar', p.includes('Camila Lima (fora da lista)') && p.includes('não está mais entre as pessoas internas ativas') && (await pilulaMarcada('Representantes legais', 'Camila Lima (fora da lista)')), p.slice(0, 200));
  await c.foto('g-representante-fora');
  await marcarPilula('Representantes legais', 'Camila Lima (fora da lista)');
  await c.ate(`!document.querySelector('.janela').textContent.includes('(fora da lista)')`);
  ok('tirando, o aviso some', true);
  await c.tecla('Escape');
  await c.ate(`document.querySelector('.dialogo')?.textContent.includes('Descartar as alterações?')`);
  await c.espera(350);
  await clicarNoDialogo('Descartar alterações');
  await dialogoFechado();
  await painelFechado();
  await mudarTabela('pessoa', `l.find(x=>x.id==='${ID_CAMILA}').situacao='ativa'`);
  await ir('/configuracoes/dados');
  await c.ate(`document.querySelector('main').textContent.includes('Numa Tecnologia')`);
  const dados = await texto('main');
  ok('o histórico registra representantes por extenso', dados.includes('representante de Numa Tecnologia Ltda'), dados.slice(0, 700));
});

await passo('produto com entidade', async () => {
  await ir(FICHA_KIPI);
  await c.ate(`document.querySelector('main h1')?.textContent==='Kipi'`);
  ok('a ficha mostra a definir', (await painelAtivo()).includes('Entidade responsávelA definir'), (await painelAtivo()).slice(0, 400));
  await clicarBotaoPrincipal('Editar');
  await painelAberto();
  await c.espera(450);
  const o = await opcoes(await idPorRotulo('Entidade responsável'));
  ok('a planejada pode ser vinculada (CA-02.04)', o.join('|') === 'A definir|Numa Tecnologia Ltda|Planejada — Numa', o.join('|'));
  await escolher(await idPorRotulo('Entidade responsável'), ID_PLANEJADA);
  await escolher('produto-responsavel', ID_KIMBERLY);
  await salvarESaber('Produto atualizado.');
  await c.ate(`document.querySelector('main [role=tabpanel][data-state=active]').textContent.includes('Planejada — Numa')`);
  ok('a ficha mostra a entidade', true);
  ok('grava o vínculo', (await tabela('produto')).find((x) => x.id === ID_PRODUTO_KIPI).entidade_id === ID_PLANEJADA);
  await aba(4);
  await c.ate(`document.querySelector('main [role=tabpanel][data-state=active]').textContent.includes('Entidade responsável')`);
  ok('o histórico diz a entidade', (await painelAtivo()).includes('Planejada — Numa'), (await painelAtivo()).slice(0, 300));

  // arquivar bloqueado por produto
  await irEntidades();
  await c.clicar('button[aria-label="Arquivar Planejada — Numa"]');
  await dialogoAberto();
  await c.espera(350);
  const d = await texto('.dialogo');
  ok('em uso por produto não arquiva, e diz qual', d.includes('Não dá para arquivar Planejada — Numa') && d.includes('Produto Kipi'), d);
  ok('só um botão', (await c.avaliar(`document.querySelectorAll('.dialogo button').length`)) === 1);
  await c.foto('h-bloqueio');
  await clicarNoDialogo('Entendi');
  await dialogoFechado();

  // sem uso: arquiva e restaura
  await mudarTabela('produto', `l.find(x=>x.id==='${ID_PRODUTO_KIPI}').entidade_id=null`);
  await irEntidades();
  await c.clicar('button[aria-label="Arquivar Planejada — Numa"]');
  await dialogoAberto();
  await c.espera(350);
  ok('sem uso, pede confirmação', (await texto('.dialogo')).includes('Arquivar Planejada — Numa?'));
  await clicarNoDialogo('Arquivar entidade');
  await esperarAviso('Entidade arquivada.');
  await dialogoFechado();
  await quantasLinhas(1);
  await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent==='Arquivados (1)').click()`);
  await c.ate(`document.querySelector('main table tbody tr')?.textContent.includes('Planejada')`);
  await c.clicar('button[aria-label="Restaurar Planejada — Numa"]');
  await esperarAviso('Entidade restaurada.');
  await c.ate(`document.querySelector('main').textContent.includes('Nenhuma entidade arquivada.')`);
  ok('dá para restaurar', (await tabela('entidade')).find((x) => x.id === ID_PLANEJADA).arquivado_em === null);

  // arquivada e encerrada não aparecem para vincular
  await mudarTabela('entidade', `l.find(x=>x.id==='${ID_PLANEJADA}').situacao='encerrada'`);
  await ir(FICHA_KIPI);
  await c.ate(`document.querySelector('main h1')?.textContent==='Kipi'`);
  await clicarBotaoPrincipal('Editar');
  await painelAberto();
  await c.espera(450);
  ok('encerrada não é oferecida', !(await opcoes(await idPorRotulo('Entidade responsável'))).includes('Planejada — Numa'));
  await c.tecla('Escape');
  await painelFechado();
  await mudarTabela('entidade', `l.find(x=>x.id==='${ID_PLANEJADA}').situacao='planejada'`);
});

await passo('limpar exemplos', async () => {
  await ir('/configuracoes/dados');
  await c.ate(`[...document.querySelectorAll('main button')].some(b=>b.textContent==='Limpar exemplos')`);
  await c.espera(200);
  await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent==='Limpar exemplos').click()`);
  await dialogoAberto();
  await c.espera(420);
  await clicarNoDialogo('Limpar exemplos');
  await dialogoFechado();
  await c.ate(`!document.querySelector('main').textContent.includes('de exemplo')||document.querySelector('main').textContent.includes('Limpar exemplos')`);
  const contrapartes = await tabela('contraparte');
  ok('as contrapartes fictícias saem', !contrapartes.some((x) => x.exemplo), contrapartes.map((x) => x.nome).join('|'));
  ok('as cadastradas ficam', contrapartes.some((x) => x.nome === 'Lumi Serviços Ltda'));
  const dora = (await tabela('pessoa')).find((x) => x.nome_completo === 'Dora Nunes');
  ok('o contato real perde o vínculo, sem ficar pendurado', dora.contraparte_id === null);
  const nova = (await tabela('entidade')).find((x) => x.nome === 'Numa Tecnologia Ltda');
  ok('o contador fictício sai da entidade', nova.contador_id === null);
  ok('a entidade planejada continua: não é exemplo', (await tabela('entidade')).some((x) => x.id === ID_PLANEJADA));
  await restaurarExemplos();
  ok('restaurar volta à carga inicial', (await tabela('contraparte')).length === 3 && (await tabela('entidade')).length === 1 && (await tabela('entidade_representante')).length === 0);
  ok('o contato do exemplo volta ligado', (await tabela('pessoa')).find((x) => x.id === ID_RAFAEL).contraparte_id === ID_SOUZA);
});

await passo('dados de quem vinha da versão anterior', async () => {
  await c.avaliar(`(()=>{for(const t of ['contraparte','entidade','entidade_representante'])localStorage.removeItem('numa-central:v1:'+t);const m=JSON.parse(localStorage.getItem('numa-central:v1:meta'));m.versao_dados=4;localStorage.setItem('numa-central:v1:meta',JSON.stringify(m));const k='numa-central:v1:pessoa';const l=JSON.parse(localStorage.getItem(k));const r=l.find(x=>x.id==='${ID_RAFAEL}');r.contraparte_id=null;r.funcao='Dado que precisa continuar';localStorage.setItem(k,JSON.stringify(l))})()`);
  await irContrapartes();
  ok('as contrapartes entram', (await tabela('contraparte')).length === 3);
  ok('a entidade planejada entra', (await tabela('entidade')).length === 1 && (await tabela('entidade'))[0].id === ID_PLANEJADA);
  ok('versão atualizada', (await c.avaliar(`JSON.parse(localStorage.getItem('numa-central:v1:meta')).versao_dados`)) === 23);
  const r = (await tabela('pessoa')).find((x) => x.id === ID_RAFAEL);
  ok('o que existia continua como estava', r.funcao === 'Dado que precisa continuar' && r.contraparte_id === null, JSON.stringify(r));
  await restaurarExemplos();
  // quem já limpou não recebe exemplos novos
  await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent==='Limpar exemplos').click()`);
  await dialogoAberto();
  await c.espera(420);
  await clicarNoDialogo('Limpar exemplos');
  await dialogoFechado();
  await c.ate(`document.querySelector('main').textContent.includes('Registros100')`);
  await c.avaliar(`(()=>{for(const t of ['contraparte','entidade','entidade_representante'])localStorage.removeItem('numa-central:v1:'+t);const m=JSON.parse(localStorage.getItem('numa-central:v1:meta'));m.versao_dados=4;localStorage.setItem('numa-central:v1:meta',JSON.stringify(m))})()`);
  await ir(CONTRAPARTES);
  await c.ate(`document.querySelector('main').textContent.includes('Nenhuma contraparte ainda.')`);
  ok('quem limpou os exemplos não recebe exemplos novos', (await tabela('contraparte')).length === 0);
  await c.foto('i-vazio');
  await restaurarExemplos();
});

await passo('dados danificados', async () => {
  await c.avaliar(`localStorage.setItem('numa-central:v1:contraparte','{danificado')`);
  await ir(CONTRAPARTES);
  await c.ate(`document.querySelector('main').textContent.includes('Não deu para ler as contrapartes.')`);
  ok('a lista explica e aponta a saída', (await texto('main')).includes('aba Dados'));
  await ir(`${CONTRAPARTES}/${ID_SOUZA}/cadastro`);
  await c.ate(`document.querySelector('main').textContent.includes('Não deu para ler esta contraparte.')`);
  ok('a ficha explica', true);
  await ir(`${CONTRAPARTES}/nao-existe/cadastro`);
  await restaurarExemplos();
  await ir(`${CONTRAPARTES}/nao-existe/cadastro`);
  await c.ate(`document.querySelector('main').textContent.includes('Essa contraparte não existe mais.')`);
  ok('endereço de uma ficha que não existe', true);
  await c.avaliar(`localStorage.setItem('numa-central:v1:entidade','{danificado')`);
  await ir(ENTIDADES);
  await c.ate(`document.querySelector('main').textContent.includes('Não deu para ler as entidades.')`);
  ok('entidades explica e aponta a saída', (await texto('main')).includes('aba Dados'));
  await restaurarExemplos();
  await irEntidades();
  ok('restaurar recupera', (await linhas()).length === 1);
});

for (const [l, a] of [[1440, 900], [1024, 768], [768, 1024], [360, 800]]) {
  await c.tamanho(l, a);
  await passo(`telas em ${l}px`, async () => {
    await irContrapartes();
    await c.espera(250);
    await conferirTela('Contrapartes', l);
    await c.foto(`j-${l}-contrapartes`);
    await irFicha(ID_SOUZA, 'Souza Contabilidade');
    await c.espera(300);
    await conferirTela('Ficha', l);
    await c.foto(`j-${l}-ficha`);
    await aba(2);
    await c.espera(150);
    await conferirTela('Contatos', l);
    await c.foto(`j-${l}-contatos`);
    await irEntidades();
    await c.espera(250);
    await conferirTela('Entidades', l);
    await c.foto(`j-${l}-entidades`);
    await c.clicar('texto=Nova entidade');
    await painelAberto();
    await c.espera(450);
    await conferirTela('Formulário de entidade', l);
    await c.foto(`j-${l}-entidade-form`);
    await c.tecla('Escape');
    await painelFechado();
    await irContrapartes();
    await c.clicar('texto=Nova contraparte');
    await painelAberto();
    await c.espera(450);
    await conferirTela('Formulário de contraparte', l);
    await c.foto(`j-${l}-contraparte-form`);
    await c.tecla('Escape');
    await painelFechado();
  });
}

await passo('celular', async () => {
  await c.tamanho(360, 800);
  await irContrapartes();
  await c.espera(200);
  ok('lista vira cartões', await c.avaliar(`document.querySelector('main ul[aria-label="Contrapartes"]').getBoundingClientRect().height>0&&document.querySelector('main table').getBoundingClientRect().height===0`));
  ok('as abas do módulo cabem, com a ativa visível e sem rolagem da página', await c.avaliar(`(()=>{const a=[...document.querySelectorAll('main nav a[aria-current]')].find(x=>x.getBoundingClientRect().width>0);const r=a?.getBoundingClientRect();return Boolean(r)&&r.left>=0&&r.right<=innerWidth+1&&document.documentElement.scrollWidth<=innerWidth})()`));
  ok('os filtros de papel rolam só na fileira', await c.avaliar(`(()=>{const f=document.querySelector('main button[aria-pressed]').parentElement;return f.scrollWidth>f.clientWidth&&document.documentElement.scrollWidth<=innerWidth})()`));
  await c.foto('k-lista');
  await c.clicar('texto=Filtros');
  await c.ate(`document.querySelector('.dialogo')`);
  await c.espera(450);
  ok('filtros em folha inferior', (await texto('.dialogo')).includes('Responsável'));
  await conferirTela('Filtros', 360);
  await c.foto('k-filtros');
  await c.tecla('Escape');
  await dialogoFechado();
  await c.clicar('main ul[aria-label="Contrapartes"] button');
  await c.ate(`location.pathname.startsWith('${CONTRAPARTES}/')`);
  await c.ate(`document.querySelector('main h1')`);
  await c.espera(300);
  ok('o cartão abre a ficha', true);
  const barra = await c.avaliar(`(()=>{const e=[...document.querySelectorAll('main button')].filter(b=>b.textContent.includes('Editar')).find(b=>b.getBoundingClientRect().height>0);const r=e.getBoundingClientRect();return r.bottom<=innerHeight&&r.top>=0})()`);
  ok('ações em barra fixa', barra);
  await c.foto('k-ficha');
  await c.clicar('texto=Mais ações');
  await c.ate(`document.querySelector('.dialogo')`);
  await c.espera(450);
  ok('"Mais ações" em folha inferior', (await texto('.dialogo')).includes('Inativar') && (await texto('.dialogo')).includes('Arquivar'));
  await c.tecla('Escape');
  await dialogoFechado();
  await c.clicar('texto=Editar');
  await painelAberto();
  await c.espera(450);
  ok('formulário em tela inteira', await c.avaliar(`(()=>{const r=document.querySelector('.janela').getBoundingClientRect();return r.width===360&&r.height===800})()`));
  await c.tecla('Escape');
  await painelFechado();
  await irEntidades();
  await c.espera(200);
  ok('entidades em cartões, com as ações', await c.avaliar(`document.querySelector('main ul[aria-label="Entidades"] button[aria-label="Editar Planejada — Numa"]').getBoundingClientRect().height>=44`));
  await c.foto('k-entidades');
});

await c.tamanho(1440, 900);
await passo('teclado', async () => {
  await irContrapartes();
  await c.avaliar(`document.querySelector('main table tbody tr').focus()`);
  await c.tecla('Enter');
  await c.ate(`location.pathname.startsWith('${CONTRAPARTES}/')`);
  ok('Enter na linha abre a ficha', true);
  await c.ate(`document.querySelector('main [role=tab]')`);
  await c.avaliar(`document.querySelector('main [role=tab]').focus()`);
  await c.tecla('ArrowRight');
  await c.espera(100);
  ok('o contorno de foco não é cortado pela fileira', await c.avaliar(`(()=>{const e=document.activeElement;return e.getAttribute('role')==='tab'&&e.matches(':focus-visible')&&getComputedStyle(e).outlineOffset==='-3px'})()`), await c.avaliar(`getComputedStyle(document.activeElement).outlineOffset`));
  await irEntidades();
  await c.avaliar(`document.querySelector('button[aria-label="Editar Planejada — Numa"]').focus()`);
  await c.tecla('Enter');
  await painelAberto();
  await c.espera(450);
  await c.tecla('Escape');
  await painelFechado();
  await c.espera(100);
  ok('Esc fecha e o foco volta ao botão', await c.avaliar(`document.activeElement.getAttribute('aria-label')==='Editar Planejada — Numa'`));
  await irContrapartes();
  await c.clicar('texto=Nova contraparte');
  await painelAberto();
  await c.espera(450);
  await salvarPainel();
  await painelTemErro('Informe o nome ou a razão social.');
  await c.espera(100);
  ok('com erro, o foco vai para o primeiro campo errado', (await c.avaliar(`document.activeElement.id`)) === 'contraparte-nome', await c.avaliar(`document.activeElement.id`));
  await c.avaliar(`document.getElementById('contraparte-site').focus()`);
  await c.avaliar(`document.querySelector('.janela [role=alert] a, .janela [role=alert] button').click()`);
  await c.espera(100);
  ok('o resumo leva ao campo', (await c.avaliar(`document.activeElement.id`)) === 'contraparte-nome', await c.avaliar(`document.activeElement.id`));
});

await h.terminar();
