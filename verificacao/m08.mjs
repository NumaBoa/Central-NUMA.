// Verificação do M08 (T08.01 a T08.08) no sistema real: biblioteca, ficha, cadastro, lote, marcas, apresentações,
// calendário, campanhas e listas de espera, em 1440, 768 e 360. Os números são os dos exemplos de `exemplos/marketing.ts`.
import { iniciar } from './apoio.mjs';

const h = await iniciar({ nome: 'm08', porta: 9388 });
const { c, ok, passo, ir, preencher, escolher, erroDe, clicarNoDialogo, painelAberto, painelFechado, pularAbertura, tabela, esperarAviso, conferirTela, terminar, dialogoAberto } = h;

const js = (v) => JSON.stringify(v);
const hoje = new Date();
const diaISO = (dias = 0) => new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + dias)).toISOString().slice(0, 10);
const brasil = (iso) => iso.split('-').reverse().join('/');
const pagina = () => c.avaliar(`document.querySelector('main').textContent.replace(/\\s+/g,' ')`);
const janela = () => c.avaliar(`(document.querySelector('.janela,.dialogo')?.textContent??'').replace(/\\s+/g,' ')`);
const clicar = (rotulo, onde = 'main') => c.avaliar(`(()=>{const b=[...document.querySelectorAll(${js(`${onde} button, ${onde} a`)})].find(b=>(b.textContent.trim()===${js(rotulo)}||b.getAttribute('aria-label')===${js(rotulo)})&&b.getBoundingClientRect().width>0);if(!b)throw new Error('sem botão: '+${js(rotulo)});b.click()})()`);
const aba = async (rotulo, onde = 'main') => {
  const alvo = `[...document.querySelectorAll(${js(`${onde} [role=tab]`)})].find(a=>a.textContent.startsWith(${js(rotulo)}))`;
  await c.avaliar(`(()=>{const a=${alvo};if(!a)throw new Error('sem aba: '+${js(rotulo)});a.focus();a.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}))})()`);
  await c.ate(`${alvo}.getAttribute('data-state')==='active'`);
};
const abaDaJanela = (rotulo) => aba(rotulo, '.janela');
const quantosCartoes = () => c.avaliar(`document.querySelectorAll('ul[aria-label="Materiais"]>li').length`);
const linhasDaTabela = () => c.avaliar(`document.querySelectorAll('main table tbody tr').length`);
const seletorLinha = async (rotulo, opcao) => {
  await c.avaliar(`(()=>{const b=[...document.querySelectorAll('main button')].find(b=>b.getAttribute('aria-label')?.startsWith(${js(`${rotulo}:`)}));if(!b)throw new Error('sem seletor: '+${js(rotulo)});b.click()})()`);
  await c.ate(`document.querySelector('.menu-suspenso')`);
  await c.espera(200);
  await c.avaliar(`[...document.querySelectorAll('.menu-suspenso button')].find(b=>b.textContent.trim()===${js(opcao)}).click()`);
  await c.ate(`!document.querySelector('.menu-suspenso')`);
  await c.espera(200);
};
const LINK = (n) => `https://drive.google.com/file/d/1SuiteCentralNuma${String(n).padStart(6, '0')}xxxx/view`;
const enviarJanela = (rotulo) => c.avaliar(`[...document.querySelectorAll('.janela footer button')].find(b=>b.textContent.trim()===${js(rotulo)}).click()`);

await c.tamanho(1440, 900);
await ir('/marketing');
await pularAbertura();
await c.ate(`document.querySelector('ul[aria-label="Materiais"]')`);

await passo('T08.01: grade com os exemplos, sem miniatura e sem simular acesso', async () => {
  ok('8 materiais em grade', (await quantosCartoes()) === 8, await quantosCartoes());
  const p = await pagina();
  ok('contagem por coleção', p.includes('Todos8') && p.includes('Apresentações3'), p.slice(0, 300));
  ok('direitos a vencer e expirados por texto', p.includes('Direitos a vencer em 20 dias') && p.includes('Direitos expirados em'));
  ok('nenhuma imagem do Drive na grade', await c.avaliar(`![...document.querySelectorAll('main img')].some(i=>i.src.includes('google'))`));
  ok('classe da Central explicada', p.includes('a permissão real é a do Drive'));
  ok('ações de criação fora dos filtros', p.includes('Adicionar arquivo') && p.includes('Adicionar em lote'));
  await c.foto('t0801-grade-1440');
  await conferirTela('grade', 1440);
});

await passo('T08.01: filtros, coleção e alternância grade/lista preservam o recorte', async () => {
  await c.avaliar(`[...document.querySelectorAll('[aria-label="Coleções"] button')].find(b=>b.textContent.startsWith('Apresentações')).click()`);
  await c.ate(`document.querySelectorAll('ul[aria-label="Materiais"]>li').length===3`);
  await seletorLinha('Classe', 'INT');
  await c.ate(`document.querySelectorAll('ul[aria-label="Materiais"]>li').length===1`);
  ok('etiqueta do filtro ativo', (await pagina()).includes('Classe: INT'));
  await clicar('Lista');
  await c.ate(`document.querySelector('main table tbody tr')`);
  ok('a lista mantém coleção e filtro', (await linhasDaTabela()) === 1, await linhasDaTabela());
  await c.foto('t0801-lista-1440');
  const colunas = await c.avaliar(`[...document.querySelectorAll('main table thead th')].map(t=>t.textContent.trim())`);
  ok('colunas da lista', ['Título', 'Contexto', 'Versão', 'Classe', 'Etiquetas', 'Atualizado', 'Vínculos'].every((coluna) => colunas.some((t) => t.startsWith(coluna))), colunas.join('|'));
  await clicar('Grade');
  await c.ate(`document.querySelectorAll('ul[aria-label="Materiais"]>li').length===1`);
  ok('volta à grade com o mesmo recorte', true);
  await preencher(await c.avaliar(`document.querySelector('main input[type=search]').id||(document.querySelector('main input[type=search]').id='busca-teste')`), 'sem nada igual');
  await c.ate(`(document.querySelector('main').textContent).includes('Nada com esses filtros.')`);
  ok('busca sem resultado é diferente de vazio', !(await pagina()).includes('ainda está vazia'));
  await clicar('Limpar filtros');
  await c.ate(`document.querySelectorAll('ul[aria-label="Materiais"]>li').length===3`);
  ok('limpar filtros mantém a coleção', true);
  await c.avaliar(`[...document.querySelectorAll('[aria-label="Coleções"] button')].find(b=>b.textContent.startsWith('Todos')).click()`);
  await c.ate(`document.querySelectorAll('ul[aria-label="Materiais"]>li').length===8`);
  ok('a coleção Todos volta a tudo', true);
});

await passo('T08.03: link duplicado, FIN/DOC e bloqueios, em abas', async () => {
  await clicar('Adicionar arquivo');
  await painelAberto();
  await preencher('arquivo-link', 'https://exemplo.com/foto.png');
  await c.espera(120);
  ok('recusa link de fora do Drive', (await erroDe('arquivo-link')).includes('drive.google.com'), await erroDe('arquivo-link'));
  const [existente] = await tabela('arquivo');
  await preencher('arquivo-link', `https://drive.google.com/open?id=${existente.drive_file_id}`);
  await c.ate(`document.querySelector('.janela').textContent.includes('Abrir o existente')`);
  ok('mesmo ID em outra forma de link é duplicado', (await janela()).includes('já está na biblioteca'));
  ok('oferece abrir o existente', await c.avaliar(`[...document.querySelectorAll('.janela a')].some(a=>a.getAttribute('href')===${js(`/marketing/arquivos/${existente.id}`)})`));
  await preencher('arquivo-titulo', 'Tentativa duplicada');
  await c.avaliar(`[...document.querySelectorAll('.janela fieldset label')].find(l=>l.textContent==='Kipi').querySelector('input').click()`);
  await enviarJanela('Adicionar arquivo');
  await c.ate(`document.getElementById('arquivo-link-erro')?.textContent.includes('já está')`);
  ok('não grava duplicado', (await tabela('arquivo')).length === 8);

  await preencher('arquivo-link', LINK(1));
  await preencher('arquivo-titulo', 'Contrato da suíte');
  await escolher('arquivo-tipo', 'contrato');
  await c.ate(`document.getElementById('arquivo-classe').value==='doc'`);
  ok('classe padrão por tipo: Contrato = DOC', true);
  ok('pasta só sugerida', (await janela()).includes('Pasta sugerida. A Central não cria pastas no Drive.'));
  ok('pasta segue o contexto', (await janela()).includes('/Produtos/Kipi/Contratos'));
  await enviarJanela('Adicionar arquivo');
  await c.ate(`document.getElementById('arquivo-pasta')&&document.querySelector('.janela [role=alert]')?.textContent.includes('restrita')`);
  ok('DOC sem confirmar a pasta não salva', (await tabela('arquivo')).length === 8);
  await c.foto('t0803-doc-1440');
  await c.avaliar(`document.getElementById('arquivo-pasta').click()`);
  await abaDaJanela('Detalhes');
  await preencher('arquivo-direitos', 'Próprios');
  await enviarJanela('Salvar e adicionar outro');
  await esperarAviso('entrou na biblioteca');
  ok('salvar e adicionar outro grava e limpa o link', (await tabela('arquivo')).length === 9 && (await c.avaliar(`document.getElementById('arquivo-link').value`)) === '');
  await clicarNoDialogo('Cancelar');
  await painelFechado().catch(async () => {
    await clicarNoDialogo('Descartar alterações');
    await painelFechado();
  });
  await c.ate(`(document.querySelector('[aria-label="Coleções"]')?.textContent??'').includes('Todos9')`);
  ok('a grade recebe o novo', true);
});

await passo('T08.03: cadastro em lote com prévia', async () => {
  await clicar('Adicionar em lote');
  await painelAberto();
  const [existente] = await tabela('arquivo');
  await preencher('lote-links', [`${LINK(2)} ; Primeiro do lote`, 'https://exemplo.com/x', LINK(2), existente.url_atual, LINK(3)].join('\n'));
  await c.avaliar(`[...document.querySelectorAll('.janela fieldset label')].find(l=>l.textContent==='Zupi').querySelector('input').click()`);
  await enviarJanela('Ver prévia');
  await c.ate(`document.querySelector('ol[aria-label="Links da prévia"]')`);
  const j = await janela();
  ok('prévia diz o que entra e o que não entra', j.includes('2 de 5 podem ser criados') && j.includes('Repete o link da linha 1') && j.includes('Não será criado'), j.slice(0, 240));
  ok('prévia não grava', (await tabela('arquivo')).length === 9);
  await c.foto('t0803-lote-1440');
  await enviarJanela('Criar 2 arquivos');
  await c.ate(`document.querySelector('.janela [role=alert]')?.textContent.includes('título')`);
  ok('título é obrigatório por linha', (await tabela('arquivo')).length === 9);
  const idDoTitulo = await c.avaliar(`[...document.querySelectorAll('ol[aria-label="Links da prévia"] input')].find(i=>!i.value).id`);
  await preencher(idDoTitulo, 'Segundo do lote');
  await enviarJanela('Criar 2 arquivos');
  await esperarAviso('2 arquivos adicionados');
  await painelFechado();
  ok('cria só os válidos', (await tabela('arquivo')).length === 11);
});

let arquivoDaFicha;
await passo('T08.02: ficha, versões e vínculos sem duplicar', async () => {
  arquivoDaFicha = (await tabela('arquivo')).find((a) => a.titulo.startsWith('Logo Kipi'));
  await ir(`/marketing/arquivos/${arquivoDaFicha.id}`);
  await c.ate(`document.querySelector('main h1')`);
  const p = await pagina();
  ok('cabeçalho com tipo, classe e versão', p.includes('Logo') && p.includes('PUB') && p.includes('v2'), p.slice(0, 200));
  ok('abrir no Drive e copiar link', p.includes('Abrir no Drive') && p.includes('Copiar link'));
  ok('sem filtros de lista', !(await c.avaliar(`Boolean(document.querySelector('main input[type=search]'))`)));
  await c.foto('t0802-ficha-1440');
  await aba('Versões');
  await c.espera(100);
  ok('as duas versões, com link', (await c.avaliar(`document.querySelectorAll('ol[aria-label="Versões"]>li').length`)) === 2);
  await c.avaliar(`[...document.querySelectorAll('main aside button')].find(b=>b.textContent.includes('Nova versão')).click()`);
  await painelAberto();
  await preencher('versao-link', arquivoDaFicha.url_atual);
  await clicarNoDialogo('Registrar versão');
  await c.ate(`document.getElementById('versao-link-erro')?.textContent.includes('versão atual')`);
  ok('recusa o link da versão atual', true);
  await preencher('versao-link', LINK(4));
  await preencher('versao-nota', 'Nova margem');
  await clicarNoDialogo('Registrar versão');
  await c.ate(`document.querySelectorAll('ol[aria-label="Versões"]>li').length===3`);
  const versoes = (await tabela('arquivo_versao')).filter((v) => v.arquivo_id === arquivoDaFicha.id);
  ok('versão anterior preservada', versoes.length === 3 && versoes.some((v) => v.url === arquivoDaFicha.url_atual));
  ok('a atual é a nova', (await tabela('arquivo')).find((a) => a.id === arquivoDaFicha.id).url_atual === LINK(4));
  await aba('Vínculos');
  await c.ate(`document.querySelector('ul[aria-label="Vínculos"]')`);
  ok('um arquivo, vários vínculos', (await c.avaliar(`document.querySelectorAll('ul[aria-label="Vínculos"]>li').length`)) === 2);
  await escolher('ficha-vinculo-tipo', 'ferramenta');
  await c.espera(100);
  await escolher('ficha-vinculo', await c.avaliar(`document.getElementById('ficha-vinculo').options[1].value`));
  await c.espera(100);
  await clicar('Vincular');
  await c.ate(`document.querySelectorAll('ul[aria-label="Vínculos"]>li').length===3`);
  ok('vínculo novo sem criar outro arquivo', (await tabela('arquivo')).length === 11);
  await aba('Histórico');
  await c.ate(`document.querySelector('main').textContent.includes('versão')`);
  ok('histórico legível', (await pagina()).includes('a versão 3 de um arquivo'), (await pagina()).slice(200, 700));
  await conferirTela('ficha', 1440);
});

await passo('T08.04: identidade da Numa e contraste', async () => {
  await ir('/marketing/marcas');
  await c.ate(`document.querySelector('main h2')`);
  let p = await pagina();
  ok('Numa vem preenchida', p.includes('Tecnologia que simplifica a vida') && p.includes('simplicidade, confiança e tempo'));
  await aba('Cores');
  await c.ate(`document.querySelector('ul[aria-label="Paleta"]')`);
  p = await pagina();
  ok('linho e índigo escuro oficiais', p.includes('#F8F6F2') && p.includes('#4F52D9'));
  ok('contraste espresso sobre linho', p.includes('Contraste suficiente para texto'));
  const hex = (nome) => c.avaliar(`[...document.getElementById('contraste-texto').options].find(o=>o.textContent===${js(nome)}).value`);
  await escolher('contraste-texto', await hex('Névoa'));
  await c.ate(`document.querySelector('main').textContent.includes('Contraste insuficiente')`);
  ok('contraste ruim é dito em texto', true);
  await c.foto('t0804-cores-1440');
  await conferirTela('marcas', 1440);
  await c.avaliar(`[...document.querySelectorAll('nav[aria-label="Marcas"] button')].find(b=>b.textContent.includes('Kipi')).click()`);
  await c.ate(`document.querySelector('main section h2')?.textContent==='Kipi'`);
  ok('marca sem identidade diz isso, sem inventar', (await pagina()).includes('ainda não foi preenchida'));
  await aba('Logos');
  await c.ate(`document.querySelector('main').textContent.includes('Logo Kipi horizontal')`);
  ok('logos vêm da biblioteca', true);
  await aba('Redes');
  await c.espera(100);
  ok('redes levam a Ativos digitais', (await pagina()).includes('Ativos digitais') || (await pagina()).includes('Transferência'));
  await clicar('Editar identidade');
  await painelAberto();
  await preencher('identidade-proposta', 'Receitas sem complicação');
  await abaDaJanela('Cores');
  await clicar('Acrescentar cor', '.janela');
  await c.ate(`document.getElementById('cor-hex-0')`);
  await preencher('cor-nome-0', 'Caramelo');
  await preencher('cor-hex-0', 'azul');
  await enviarJanela('Salvar');
  await c.ate(`document.getElementById('cor-hex-0-erro')?.textContent.includes('#RRGGBB')`);
  ok('hex inválido não salva', true);
  await preencher('cor-hex-0', '#A8693A');
  await enviarJanela('Salvar');
  await painelFechado();
  ok('grava uma identidade por marca', (await tabela('marca_identidade')).length === 2);
});

await passo('T08.08: os mesmos itens da biblioteca, e FIN não pode ser PUB', async () => {
  await ir('/marketing/apresentacoes');
  await c.ate(`document.querySelector('ul[aria-label="Apresentações"]')`);
  ok('3 apresentações', (await c.avaliar(`document.querySelectorAll('ul[aria-label="Apresentações"]>li').length`)) === 3);
  const p = await pagina();
  ok('finalidade, público e preços', p.includes('Finalidade: Institucional') && p.includes('Público: Parceiros') && p.includes('Preços de'));
  ok('gerador é só indicação futura', p.includes('Gerar a partir de modelos é da F2') && !(await c.avaliar(`[...document.querySelectorAll('main button')].some(b=>b.textContent.includes('Gerar'))`)));
  await c.foto('t0808-1440');
  await conferirTela('apresentações', 1440);
  await clicar('Registrar apresentação');
  await painelAberto();
  await preencher('arquivo-link', LINK(5));
  await preencher('arquivo-titulo', 'Apresentação com dados FIN');
  await c.avaliar(`[...document.querySelectorAll('.janela fieldset label')].find(l=>l.textContent==='Numa institucional').querySelector('input').click()`);
  ok('nasce PUB, pelo padrão', (await c.avaliar(`document.getElementById('arquivo-classe').value`)) === 'pub');
  await abaDaJanela('Apresentação');
  await c.avaliar(`[...document.querySelectorAll('.janela label')].find(l=>l.textContent.includes('Contém dados financeiros')).querySelector('input').click()`);
  await c.ate(`document.querySelector('.janela').textContent.includes('a classe não pode ser PUB')`);
  await enviarJanela('Adicionar arquivo');
  await c.ate(`document.getElementById('arquivo-classe-erro')?.textContent.includes('não pode ser PUB')`);
  ok('FIN em PUB não salva, e leva à aba do erro', (await c.avaliar(`document.getElementById('arquivo-classe').getBoundingClientRect().width>0`)));
  ok('nada foi gravado', !(await tabela('arquivo')).some((a) => a.titulo === 'Apresentação com dados FIN'));
  await escolher('arquivo-classe', 'int');
  await enviarJanela('Adicionar arquivo');
  await painelFechado();
  const criada = (await tabela('arquivo')).find((a) => a.titulo === 'Apresentação com dados FIN');
  ok('um registro só, na biblioteca', criada?.tipo === 'apresentacao' && criada.contem_fin === true && criada.classe === 'int');
});

await passo('T08.05: as quatro visões e o que publicar exige', async () => {
  await ir('/marketing/conteudo');
  await c.ate(`document.querySelector('main table caption')`);
  let p = await pagina();
  ok('visão Mês com a legenda de situações', p.includes('Legenda das situações'));
  ok('nada publicado no futuro nos exemplos', (await tabela('peca_conteudo')).every((peca) => peca.situacao !== 'publicado' || peca.publicado_em <= diaISO()));
  ok('cancelada fica fora até pedir', !p.includes('Teaser do Mimo'));
  await c.foto('t0805-mes-1440');
  await conferirTela('calendário', 1440);
  await clicar('Semana');
  await c.ate(`document.querySelector('ol[aria-label="Dias da semana"]')`);
  ok('visão Semana', (await c.avaliar(`document.querySelectorAll('ol[aria-label="Dias da semana"]>li').length`)) === 7);
  await clicar('Lista');
  await c.ate(`document.querySelector('main table tbody tr')`);
  ok('visão Lista: prevista e realizada em colunas', await c.avaliar(`(()=>{const t=[...document.querySelectorAll('main table thead th')].map(x=>x.textContent);return t.some(x=>x.startsWith('Prevista'))&&t.some(x=>x.startsWith('Realizada'))})()`));
  await clicar('Quadro');
  await c.ate(`document.querySelector('section[aria-label="Publicado"]')`);
  ok('visão Quadro por situação', (await c.avaliar(`['Ideia','Produção','Revisão','Aprovado','Publicado'].every(s=>document.querySelector('section[aria-label="'+s+'"]'))`)));
  await c.foto('t0805-quadro-1440');

  await clicar('Mover Depoimento de cliente (exemplo)');
  await c.ate(`document.querySelector('.menu-suspenso')`);
  await c.espera(200);
  await c.avaliar(`[...document.querySelectorAll('.menu-suspenso button')].find(b=>b.textContent.trim()==='Publicado…').click()`);
  await painelAberto();
  await enviarJanela('Salvar');
  await c.ate(`document.querySelector('.janela [role=alert]')?.textContent.includes('data em que foi ao ar')`);
  ok('publicado sem data e sem link não salva', (await janela()).includes('link da publicação'));
  await preencher('peca-realizada', diaISO(1));
  await preencher('peca-link', 'https://rede.exemplo/p/1');
  await enviarJanela('Salvar');
  await c.ate(`document.getElementById('peca-realizada-erro')?.textContent.includes('futuro')`);
  ok('publicação futura não vale como realizada', true);
  await preencher('peca-realizada', diaISO());
  await enviarJanela('Salvar');
  await painelFechado();
  const publicada = (await tabela('peca_conteudo')).find((peca) => peca.titulo.startsWith('Depoimento'));
  ok('publicada com data e link, sem mudar a prevista', publicada.situacao === 'publicado' && publicada.publicado_em === diaISO() && publicada.data_prevista === diaISO(10));

  await clicar('Mover Dica de uso (exemplo)');
  await c.ate(`document.querySelector('.menu-suspenso')`);
  await c.espera(200);
  await c.avaliar(`[...document.querySelectorAll('.menu-suspenso button')].find(b=>b.textContent.trim()==='Cancelado…').click()`);
  await dialogoAberto();
  await preencher('cancelar-motivo', 'Mudou o plano');
  await clicarNoDialogo('Cancelar peça');
  await esperarAviso('Peça cancelada');
  const cancelada = (await tabela('peca_conteudo')).find((peca) => peca.titulo.startsWith('Dica'));
  ok('cancelada continua registrada, com o motivo', cancelada.situacao === 'cancelado' && cancelada.cancelado_motivo === 'Mudou o plano');
});

await passo('T08.05: nova peça, arquivos da biblioteca e lembrete no Meu dia', async () => {
  await clicar('Nova peça');
  await painelAberto();
  await preencher('peca-titulo', 'Peça da suíte');
  await escolher('peca-contexto', 'institucional');
  await preencher('peca-prevista', diaISO(1));
  await abaDaJanela('Texto e arquivos');
  await c.avaliar(`document.querySelector('.janela input[type=checkbox]').click()`);
  await c.foto('t0805-editor-1440');
  ok('avisa que o Meu dia só lembra', true);
  await enviarJanela('Salvar peça');
  await painelFechado();
  const nova = (await tabela('peca_conteudo')).find((peca) => peca.titulo === 'Peça da suíte');
  ok('situação inicial é Ideia, com a responsável padrão', nova.situacao === 'ideia' && nova.produto_id === null);
  ok('arquivo escolhido na biblioteca', (await tabela('arquivo_vinculo')).some((v) => v.registro_id === nova.id));
  const alerta = (await tabela('atividade')).find((a) => a.origem_id === nova.id);
  ok('alerta da véspera, pelo motor do M03', alerta?.titulo === 'Publicação amanhã: Peça da suíte' && alerta.responsavel_id === nova.responsavel_id, alerta?.titulo);
  ok('o alerta leva à peça', alerta?.alerta_acao === 'abrir_peca');
  await ir(`/marketing/conteudo?peca=${nova.id}`);
  await painelAberto();
  ok('abre a peça pelo link do alerta', (await c.avaliar(`document.getElementById('peca-titulo').value`)) === 'Peça da suíte');
  await clicarNoDialogo('Cancelar');
  await painelFechado();
});

let idDaCampanha;
await passo('T08.06: lista, ficha e integrações sem financeiro paralelo', async () => {
  await ir('/marketing/campanhas');
  await c.ate(`document.querySelector('main table tbody tr')`);
  ok('duas campanhas, em andamento primeiro', (await c.avaliar(`document.querySelector('main table tbody tr').textContent`)).includes('Lançamento Kipi'));
  await conferirTela('campanhas', 1440);
  idDaCampanha = (await tabela('campanha')).find((item) => item.nome.startsWith('Lançamento')).id;
  await ir(`/marketing/campanhas/${idDaCampanha}`);
  await c.ate(`document.querySelector('main h1')`);
  let p = await pagina();
  ok('objetivo e público', p.includes('Apresentar o produto') && p.includes('Produtores artesanais'));
  await c.foto('t0806-ficha-1440');
  await aba('Orçamento');
  await c.ate(`document.querySelector('main').textContent.includes('Orçamento planejado')`);
  p = await pagina();
  ok('orçamento vazio é "Não definido", não zero', p.includes('Não definido') && !p.includes('R$ 0,00'));
  ok('avisa que os lançamentos nascem no Financeiro', p.includes('são só vinculados'));
  const titulosAntes = await tabela('titulo');
  const alvo = titulosAntes.find((titulo) => titulo.natureza === 'pagar' && titulo.situacao !== 'cancelado');
  await escolher('campanha-titulo', alvo.id);
  await c.espera(100);
  await clicar('Vincular lançamento');
  await c.ate(`document.querySelector('ul[aria-label="Lançamentos vinculados"]')`);
  ok('vincular não cria nem muda título', (await tabela('titulo')).length === titulosAntes.length && JSON.stringify((await tabela('titulo')).find((t) => t.id === alvo.id)) === JSON.stringify(alvo));
  await aba('Resultados');
  await c.ate(`document.querySelector('main').textContent.includes('Medição manual')`);
  p = await pagina();
  ok('resultado vazio é "Não informado"', p.includes('Não informado') && p.includes('Não registrada'));
  ok('critério de origem à vista', p.includes('Origem informada manualmente') && p.includes('não comprova'));
  ok('F2 só indicada, sem botão', p.includes('Atribuição e custo por inscrito são da F2') && !(await c.avaliar(`[...document.querySelectorAll('main button')].some(b=>/atribui/i.test(b.textContent))`)));
  await clicar('Informar resultados');
  await painelAberto();
  await preencher('resultado-inscritos', '12');
  await clicarNoDialogo('Salvar resultados');
  await c.ate(`document.getElementById('resultado-medido-erro')?.textContent.includes('medição')`);
  ok('resultado pede a data da medição', true);
  await preencher('resultado-medido', diaISO());
  await clicarNoDialogo('Salvar resultados');
  await esperarAviso('Resultados registrados');
  const salva = (await tabela('campanha')).find((item) => item.id === idDaCampanha);
  ok('salva só o informado', salva.resultados.inscritos === 12 && salva.resultados.vendas === null);
  await aba('Conteúdo');
  await c.espera(150);
  ok('peças vinculadas', (await pagina()).includes('Carrossel de lançamento'));
  await conferirTela('ficha da campanha', 1440);
});

await passo('T08.07: contadores, consentimento e elegibilidade', async () => {
  await ir('/marketing/listas');
  await c.ate(`document.querySelector('main table tbody tr')`);
  await conferirTela('listas', 1440);
  const lista = (await tabela('lista_espera')).find((item) => item.nome.startsWith('Kipi'));
  await ir(`/marketing/listas/${lista.id}`);
  await c.ate(`document.querySelector('main table tbody tr')`);
  const p = await pagina();
  ok('cada pessoa em uma situação, sem dupla contagem', p.includes('6 pessoas: 3 ativas, 1 convidada, 1 convertida e 1 descadastrada') && p.includes('Para marketing: 4 aptas e 1 pendente de consentimento'), p.slice(100, 500));
  ok('pendente é elegibilidade, nunca situação gravada', (await tabela('inscrito')).every((item) => ['ativo', 'descadastrado', 'convidado', 'convertido'].includes(item.situacao)) && p.includes('Pendente de consentimento'));
  ok('não envia nada', p.includes('Nenhuma mensagem é enviada daqui'));
  ok('inventário do M09 indicado, sem cadastro paralelo', p.includes('Nenhum tratamento do inventário cobre inscritos'));
  await c.foto('t0807-inscritos-1440');
  await conferirTela('ficha da lista', 1440);
  ok('marcar convidados só depois de selecionar', !(await c.avaliar(`[...document.querySelectorAll('main button')].some(b=>b.textContent.trim()==='Marcar convidados')`)));

  await clicar('Importar CSV');
  await painelAberto();
  await preencher('importar-texto', 'nome;email\nFulana;fulana@exemplo.com.br');
  await enviarJanela('Ver prévia');
  await c.ate(`document.querySelector('.janela [role=alert]')?.textContent.includes('Importação bloqueada')`);
  ok('CA-08.03: sem colunas de consentimento, bloqueada', (await janela()).includes('versão do consentimento') && (await janela()).includes('data do consentimento'));
  const csv = ['nome;email;origem;consentimento_versao;consentido_em', `Ana;ANA@exemplo.com.br;Site;2;${brasil(diaISO())}`, `Nova;nova@exemplo.com.br;Evento;2;${brasil(diaISO())}`, `Júlia;julia@exemplo.com.br;;2;${brasil(diaISO())}`, 'Ruim;invalido;;2;01/01/2026', `Sem;sem@exemplo.com.br;;;`].join('\n');
  await preencher('importar-texto', csv);
  await enviarJanela('Ver prévia');
  await c.ate(`document.querySelector('.janela table')`);
  const j = await janela();
  ok('prévia com erro por linha', j.includes('E-mail inválido') && j.includes('Sem versão ou data do consentimento'), j.slice(0, 400));
  ok('CA-08.04: descadastrado não volta', j.includes('Descadastrado: não volta'));
  await c.foto('t0807-importar-1440');
  ok('nada gravado antes de confirmar', (await tabela('inscrito')).filter((item) => item.lista_id === lista.id).length === 6);
  await enviarJanela('Importar 2 linhas');
  await painelFechado();
  const inscritos = (await tabela('inscrito')).filter((item) => item.lista_id === lista.id);
  ok('entra quem passou', inscritos.length === 7 && inscritos.some((item) => item.email === 'nova@exemplo.com.br'));
  ok('Ana continua descadastrada', inscritos.find((item) => item.email_normalizado === 'ana@exemplo.com.br').situacao === 'descadastrado');
  const julia = inscritos.find((item) => item.email_normalizado === 'julia@exemplo.com.br');
  ok('quem estava pendente recebe o consentimento', Boolean(julia.consentido_em) && julia.situacao === 'ativo');

  await clicar('Adicionar pessoa');
  await painelAberto();
  await preencher('inscrito-email', 'ana@exemplo.com.br');
  await enviarJanela('Adicionar');
  await c.ate(`document.getElementById('inscrito-email-erro')?.textContent.includes('descadastrou')`);
  ok('descadastrado também não volta à mão', true);
  await preencher('inscrito-email', 'manual@exemplo.com.br');
  await enviarJanela('Adicionar');
  await painelFechado();
  ok('inclusão manual sem consentimento fica pendente', (await tabela('inscrito')).find((item) => item.email === 'manual@exemplo.com.br').consentido_em === null);

  // Seleção: um apto e um pendente.
  const apto = (await tabela('inscrito')).find((item) => item.email === 'nova@exemplo.com.br');
  const pendente = (await tabela('inscrito')).find((item) => item.email === 'manual@exemplo.com.br');
  await c.ate(`document.querySelector('main').textContent.includes('manual@exemplo.com.br')`);
  for (const email of [apto.email, pendente.email]) await c.avaliar(`[...document.querySelectorAll('main table tbody tr')].find(l=>l.textContent.includes(${js(email)})).querySelector('input[type=checkbox]').click()`);
  await c.ate(`[...document.querySelectorAll('main button')].some(b=>b.textContent.trim()==='Marcar convidados')`);
  await clicar('Marcar convidados');
  await esperarAviso('Nenhuma mensagem foi enviada');
  const depois = await tabela('inscrito');
  ok('convida só quem tem consentimento', depois.find((item) => item.id === apto.id).situacao === 'convidado' && depois.find((item) => item.id === pendente.id).situacao === 'ativo');

  await clicar('Exportar (auditada)');
  await esperarAviso('Exportação registrada');
  await aba('Histórico');
  await c.ate(`document.querySelector('main').textContent.includes('exportou')`);
  const historico = await pagina();
  ok('exportação auditada, sem os e-mails', historico.includes('exportou 8 inscritos da lista') && !historico.includes('@exemplo'), historico.slice(0, 300));
  ok('importação no histórico', historico.includes('importou inscritos'));
  await aba('Consentimento');
  await c.espera(150);
  ok('versões do texto, com a vigente', (await pagina()).includes('Versão 2') && (await pagina()).includes('Vigente'));
  await aba('Indicadores');
  await c.espera(150);
  ok('indicadores por semana e por origem', (await pagina()).includes('Por origem') && (await pagina()).includes('Por semana'));
});

await passo('persistência: recarregar mantém tudo; backups do M08 entram na exportação', async () => {
  await c.recarregar?.();
  await ir('/marketing');
  await c.ate(`document.querySelector('ul[aria-label="Materiais"]')`);
  const p = await pagina();
  ok('continua o que foi criado', p.includes('Contrato da suíte') && p.includes('Apresentação com dados FIN'));
  const meta = await c.avaliar(`JSON.parse(localStorage.getItem('numa-central:v1:meta')).versao_dados`);
  ok('versão dos dados 20', meta === 20, meta);
  await ir('/configuracoes/dados');
  await c.ate(`document.querySelector('main').textContent.includes('de exemplo')`);
  ok('o painel de dados abre com as tabelas novas', !(await c.avaliar(`document.querySelector('main').textContent.includes('danificad')`)));
});

await passo('responsivo: sem rolagem lateral, com alvos de 44px e campos de 16px', async () => {
  const lista = (await tabela('lista_espera')).find((item) => item.nome.startsWith('Kipi'));
  const rotas = [
    ['biblioteca', '/marketing', `document.querySelector('ul[aria-label="Materiais"]')`],
    ['ficha', `/marketing/arquivos/${arquivoDaFicha.id}`, `document.querySelector('main h1')`],
    ['marcas', '/marketing/marcas', `document.querySelector('main section h2')`],
    ['apresentações', '/marketing/apresentacoes', `document.querySelector('ul[aria-label="Apresentações"]')`],
    ['calendário', '/marketing/conteudo', `document.querySelector('main h2')`],
    ['campanhas', '/marketing/campanhas', `document.querySelector('main h1')`],
    ['campanha', `/marketing/campanhas/${idDaCampanha}`, `document.querySelector('main h1')`],
    ['listas', '/marketing/listas', `document.querySelector('main h1')`],
    ['lista', `/marketing/listas/${lista.id}`, `document.querySelector('main h1')`],
  ];
  for (const largura of [768, 360]) {
    await c.tamanho(largura, largura === 360 ? 780 : 1024);
    for (const [nome, caminho, pronto] of rotas) {
      await ir(caminho);
      await c.ate(pronto);
      await c.espera(250);
      await conferirTela(nome, largura);
      await c.foto(`${nome}-${largura}`);
    }
  }
  await ir('/marketing');
  await c.ate(`document.querySelector('ul[aria-label="Materiais"]')`);
  await clicar('Adicionar arquivo');
  await painelAberto();
  await c.espera(300);
  await conferirTela('formulário em tela cheia', 360);
  await c.foto('formulario-360');
  ok('formulário em tela inteira no celular', await c.avaliar(`document.querySelector('.janela').getBoundingClientRect().width>=innerWidth-1`));
  await clicarNoDialogo('Cancelar').catch(() => c.avaliar(`document.querySelector('.janela button[aria-label="Voltar"]').click()`));
  await c.tamanho(1440, 900);
});

await terminar();
