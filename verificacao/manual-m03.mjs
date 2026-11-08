// Verificação do piloto dos manuais (M03 Meu dia): ondas nos cabeçalhos, "Como usar", manual na tela, busca
// "Registros" e "Como fazer", atalhos que não alteram dados, e o PDF para baixar. Pedido de Kimberly em 08/11/2026.
import { iniciar } from './apoio.mjs';

const h = await iniciar({ nome: 'manual-m03', porta: 9391 });
const { c, ok, passo, ir, texto, pularAbertura, conferirTela, BASE } = h;

const js = (v) => JSON.stringify(v);
const campo = `document.querySelector('.busca-global input')`;
const buscar = (termo) => c.avaliar(`(()=>{const e=${campo};Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${js(termo)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`);
const abrirBusca = async () => { await c.tecla('k', { ctrl: true }); await c.ate(`${campo}`); await c.espera(420); };
const fecharBusca = async () => { await c.tecla('Escape'); await c.ate(`!document.querySelector('.busca-global')`); };
const opcoes = () => c.avaliar(`[...document.querySelectorAll('.busca-global [role=option]')].map(o=>({texto:o.textContent.trim(),href:o.getAttribute('href'),selecionada:o.getAttribute('aria-selected')==='true'}))`);
const textoDaBusca = () => texto('.busca-global [role=listbox]');
// Tudo o que a Central guarda, menos o registro de uso (última abertura, menu recolhido): para provar que nada mudou.
const dados = () => c.avaliar(`JSON.stringify(Object.keys(localStorage).filter(k=>k.startsWith('numa-central:')&&!k.endsWith(':meta')).sort().map(k=>[k,localStorage.getItem(k)]))`);

/** As ondas: decorativas, fora do teclado e do leitor de tela, sem cobrir texto nem botões. */
const ONDAS = `(()=>{
  const ondas=[...document.querySelectorAll('main [aria-hidden] > svg[viewBox="0 0 520 140"]')].map(s=>s.parentElement);
  const visiveis=ondas.filter(o=>{const r=o.querySelector('svg').getBoundingClientRect();return r.width>0&&r.height>0});
  const sobrepoe=(a,b)=>!(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top);
  const cobre=[];
  for(const o of visiveis){
    const r=o.getBoundingClientRect();
    const cabecalho=o.parentElement;
    for(const e of cabecalho.querySelectorAll('h1,p,a,button,input,select')){const b=e.getBoundingClientRect();if(b.width&&b.height&&sobrepoe(r,b))cobre.push((e.textContent||e.tagName).trim().slice(0,24))}
  }
  return {total:ondas.length,visiveis:visiveis.length,cobre,
    escondidas:ondas.every(o=>o.getAttribute('aria-hidden')==='true'&&o.querySelector('svg').getAttribute('focusable')==='false'),
    semClique:ondas.every(o=>getComputedStyle(o).pointerEvents==='none'),
    semAnimacao:ondas.every(o=>o.getAnimations({subtree:true}).length===0)};
})()`;

const COMO_USAR = (href) => `[...document.querySelectorAll('main a')].find(a=>a.getAttribute('href')===${js(href)}&&(a.textContent.includes('Como usar')||a.getAttribute('aria-label')==='Como usar')&&a.getBoundingClientRect().width>0)`;

await c.tamanho(1440, 900);

await passo('ondas e Como usar no computador', async () => {
  await ir('/meu-dia');
  await pularAbertura();
  await c.ate(`document.querySelector('main article')`);
  let o = await c.avaliar(ONDAS);
  ok('Meu dia: ondas no cabeçalho', o.visiveis === 1, JSON.stringify(o));
  ok('Meu dia: ondas não cobrem texto, campos nem botões', o.cobre.length === 0, o.cobre.join('|'));
  ok('ondas: escondidas do leitor de tela e do teclado, sem clique e sem animação', o.escondidas && o.semClique && o.semAnimacao);
  ok('Meu dia: "Como usar" leva ao manual', await c.avaliar(`Boolean(${COMO_USAR('/ajuda/meu-dia')})`));
  await c.foto('a-meu-dia-1440');
  for (const [caminho, artigo, nome] of [['/meu-dia/historico', '/ajuda/meu-dia/historico', 'historico'], ['/meu-dia/rotinas', '/ajuda/meu-dia/criar-rotina', 'rotinas'], ['/meu-dia/resumo-diario', '/ajuda/meu-dia/previa-resumo-diario', 'resumo']]) {
    await ir(caminho);
    await c.ate(`document.querySelector('main h1')`);
    await c.espera(250);
    o = await c.avaliar(ONDAS);
    ok(`${nome}: ondas sem cobrir nada`, o.visiveis === 1 && o.cobre.length === 0, JSON.stringify(o));
    ok(`${nome}: "Como usar" leva ao artigo do assunto`, await c.avaliar(`Boolean(${COMO_USAR(artigo)})`));
    await c.foto(`a-${nome}-1440`);
  }
});

await passo('teclado no cabeçalho', async () => {
  await ir('/meu-dia');
  await c.ate(`document.querySelector('main article')`);
  await c.avaliar(`document.querySelector('main h1').setAttribute('tabindex','-1'),document.querySelector('main h1').focus()`);
  const focados = [];
  for (let i = 0; i < 6; i++) {
    await c.tecla('Tab');
    focados.push(await c.avaliar(`(document.activeElement.getAttribute('aria-label')||document.activeElement.textContent||document.activeElement.tagName).trim().slice(0,20)`));
  }
  ok('Tab passa por Histórico, Rotinas, Como usar e Adicionar, nunca pelas ondas', ['Histórico', 'Rotinas', 'Como usar'].every((t) => focados.some((f) => f.startsWith(t))) && !focados.some((f) => f === 'svg' || f === 'DIV'), focados.join('|'));
  await c.avaliar(`${COMO_USAR('/ajuda/meu-dia')}.focus()`);
  await c.tecla('Enter');
  await c.ate(`location.pathname==='/ajuda/meu-dia'&&document.querySelector('main h1')?.textContent==='Manual do Meu dia'`);
  ok('Enter em "Como usar" abre o manual do Meu dia', true);
});

await passo('manual na tela', async () => {
  const t = await texto();
  ok('versão e data', t.includes('Versão 1.0') && t.includes('8 de novembro de 2026'));
  ok('Baixar manual em PDF', await c.avaliar(`(()=>{const a=[...document.querySelectorAll('main a')].find(a=>a.textContent.includes('Baixar manual em PDF'));return a&&a.getAttribute('href')==='/manuais/Manual-Meu-Dia-Numa.pdf'&&a.getAttribute('download')==='Manual-Meu-Dia-Numa.pdf'})()`));
  const pdf = await c.avaliar(`fetch('/manuais/Manual-Meu-Dia-Numa.pdf').then(async r=>({status:r.status,tipo:r.headers.get('content-type'),inicio:new TextDecoder().decode((await r.arrayBuffer()).slice(0,5))}))`);
  ok('o PDF baixa', pdf.status === 200 && pdf.tipo.includes('pdf') && pdf.inicio === '%PDF-', JSON.stringify(pdf));
  ok('navegação por assunto ao lado, com os 30 artigos', await c.avaliar(`document.querySelectorAll('main aside nav a').length===30`));
  ok('artigos em cartões, por assunto', await c.avaliar(`document.querySelectorAll('main section h2').length===7`));
  const o = await c.avaliar(ONDAS);
  ok('manual: ondas sem cobrir nada', o.visiveis === 1 && o.cobre.length === 0, JSON.stringify(o));
  await c.foto('b-manual-1440');
  await conferirTela('manual', 1440);
});

await passo('artigo: abre direto, e o atalho não altera dados', async () => {
  await ir('/ajuda/meu-dia/adiar');
  await c.ate(`document.querySelector('main h1')?.textContent==='Como adiar uma atividade'`);
  const t = await texto();
  ok('procedimento completo, com os nomes reais', ['Objetivo', 'Antes de começar', 'Onde fica', 'Passo a passo', 'Resultado esperado', 'Cuidados e exceções', '+1 semana', 'Escolher data'].every((p) => t.includes(p)));
  ok('selo "Disponível para usar"', t.includes('Disponível para usar'));
  ok('o artigo atual fica marcado na navegação', await c.avaliar(`document.querySelector('aside nav a[aria-current=page]')?.textContent==='Como adiar uma atividade'`));
  ok('anterior e próximo', t.includes('Anterior') && t.includes('Próximo'));
  await c.foto('c-artigo-1440');
  const antes = await dados();
  await c.clicar('texto=Ir para essa ação');
  await c.ate(`location.pathname==='/meu-dia'&&document.querySelector('main article')`);
  await c.espera(600);
  ok('"Ir para essa ação" só abre a tela', !(await c.avaliar(`Boolean(document.querySelector('.janela,.dialogo'))`)));
  ok('nenhum dado mudou', (await dados()) === antes);

  await ir('/ajuda/meu-dia/limitacoes');
  await c.ate(`document.querySelector('main h1')`);
  const futuro = await texto();
  ok('recurso futuro: identificado, sem ação', futuro.includes('Ainda não implementado') && futuro.includes('Previsto para') && !futuro.includes('Ir para essa ação'));
  await ir('/ajuda/meu-dia/previa-resumo-diario');
  await c.ate(`document.querySelector('main h1')`);
  const condicao = await texto();
  ok('com condição: diz qual', condicao.includes('Disponível mediante condição') && condicao.includes('O envio por e-mail chega com o servidor'));
});

await passo('índice dos manuais', async () => {
  await ir('/ajuda');
  await c.ate(`document.querySelector('main h1')?.textContent==='Manuais da Central'`);
  ok('os 13 módulos', await c.avaliar(`document.querySelectorAll('main ul > li').length===13`));
  ok('os 13 manuais publicados, cada um com link', await c.avaliar(`(()=>{const l=[...document.querySelectorAll('main ul > li')];return l.filter(x=>x.querySelector('a')).length===13&&!l.some(x=>x.textContent.includes('Manual em preparação'))})()`));
  await c.foto('d-indice-1440');
});

await passo('busca: Registros e Como fazer', async () => {
  await ir('/meu-dia');
  await c.ate(`document.querySelector('main article')`);
  await abrirBusca();
  ok('a busca convida a perguntar como se faz', (await texto('.busca-global')).includes('para ver como se faz'));

  await buscar('reembolso');
  await c.ate(`document.querySelector('.busca-global [role=option]')`);
  let t = await textoDaBusca();
  ok('reembolso: lançamentos em Registros e o artigo do Financeiro em Como fazer', t.includes('Registros') && t.includes('Lançamentos') && t.includes('Como fazer') && t.includes('Reembolsar uma sócia') && t.includes('Manual Financeiro'), t.slice(0, 260));
  await buscar('xilofone');
  await c.ate(`(document.querySelector('.busca-global')?.textContent??'').includes('nem nos registros nem nos manuais')`);
  ok('sem registro nem artigo, o aviso diz isso', true);
  await buscar('cartorio');
  await c.ate(`(document.querySelector('.busca-global [role=listbox]')?.textContent??'').includes('Nenhum artigo de ajuda sobre')`);
  ok('com registro e sem artigo, Como fazer explica e leva aos manuais', await c.avaliar(`[...document.querySelectorAll('.busca-global [role=listbox] a')].some(a=>a.getAttribute('href')==='/ajuda')`));
  await c.foto('e-busca-reembolso');

  await buscar('dar baixa');
  await c.ate(`(document.querySelector('.busca-global [role=listbox]')?.textContent??'').includes('Concluir ou dispensar um alerta')`);
  ok('"dar baixa" acha o artigo pelo termo equivalente', true);

  await buscar('adiar');
  await c.ate(`(document.querySelector('.busca-global [role=listbox]')?.textContent??'').includes('Como adiar uma atividade')`);
  t = await textoDaBusca();
  ok('artigo com o módulo e o atalho', t.includes('Manual Meu dia') && t.includes('Ir para essa ação: Abrir o Meu dia'), t.slice(0, 300));
  await c.foto('e-busca-adiar');
  // Teclado: desce até o artigo e abre.
  let lista = await opcoes();
  const alvo = lista.findIndex((o) => o.href === '/ajuda/meu-dia/adiar');
  for (let i = 0; i < alvo; i++) await c.tecla('ArrowDown');
  ok('as setas chegam ao artigo', (await opcoes())[alvo]?.selecionada, alvo);
  await c.tecla('Enter');
  await c.ate(`location.pathname==='/ajuda/meu-dia/adiar'&&!document.querySelector('.busca-global')`);
  ok('Enter abre o artigo no manual do módulo', true);

  await abrirBusca();
  await buscar('criar rotina');
  await c.ate(`(document.querySelector('.busca-global [role=listbox]')?.textContent??'').includes('Criar uma rotina')`);
  lista = await opcoes();
  const acao = lista.findIndex((o) => o.href === '/meu-dia/rotinas');
  ok('o atalho é uma opção própria, logo abaixo do artigo', acao > 0 && lista[acao - 1].href === '/ajuda/meu-dia/criar-rotina', JSON.stringify(lista.slice(0, 4)));
  const antes = await dados();
  for (let i = 0; i < acao; i++) await c.tecla('ArrowDown');
  await c.tecla('Enter');
  await c.ate(`location.pathname==='/meu-dia/rotinas'&&!document.querySelector('.busca-global')`);
  await c.espera(500);
  ok('o atalho leva à tela, sem abrir formulário', !(await c.avaliar(`Boolean(document.querySelector('.janela,.dialogo'))`)), await c.avaliar(`document.querySelector('.janela,.dialogo')?.textContent.slice(0,120)`));
  const depois = await dados();
  ok('o atalho não muda dados', depois === antes, depois === antes ? '' : JSON.parse(depois).filter(([k, v]) => !JSON.parse(antes).some(([k2, v2]) => k2 === k && v2 === v)).map(([k]) => k).join(','));

  await abrirBusca();
  await buscar('kipi');
  await c.ate(`document.querySelector('.busca-global [role=option]')`);
  t = await textoDaBusca();
  ok('a busca de registros continua igual', t.includes('Produtos') && t.includes('Corrigir o erro no login do Kipi'), t.slice(0, 200));
  await buscar('xyzzy');
  await c.ate(`(document.querySelector('.busca-global')?.textContent??'').includes('nem nos registros nem nos manuais')`);
  ok('nada encontrado: sugere outro jeito de dizer e leva aos manuais', await c.avaliar(`[...document.querySelectorAll('.busca-global a')].some(a=>a.getAttribute('href')==='/ajuda')`));
  await c.foto('e-busca-nada');
  await fecharBusca();
});

await passo('tablet', async () => {
  await c.tamanho(768, 1024);
  await ir('/meu-dia');
  await c.ate(`document.querySelector('main article')`);
  await c.espera(300);
  ok('Meu dia: sem ondas no tablet, onde falta espaço', (await c.avaliar(ONDAS)).visiveis === 0);
  ok('Meu dia: "Como usar" à vista', await c.avaliar(`Boolean(${COMO_USAR('/ajuda/meu-dia')})`));
  await conferirTela('Meu dia', 768);
  await c.foto('f-meu-dia-768');
  await ir('/ajuda/meu-dia/criar-tarefa');
  await c.ate(`document.querySelector('main h1')`);
  await conferirTela('artigo', 768);
  await c.foto('f-artigo-768');
});

await passo('celular', async () => {
  await c.tamanho(360, 800);
  await ir('/meu-dia');
  await c.ate(`document.querySelector('main article')`);
  await c.espera(300);
  ok('Meu dia: sem ondas no celular', (await c.avaliar(ONDAS)).visiveis === 0);
  ok('Meu dia: "Como usar" só com o ícone, de 44px', await c.avaliar(`(()=>{const a=${COMO_USAR('/ajuda/meu-dia')};const r=a?.getBoundingClientRect();return a&&r.width>=44&&r.height>=44&&a.getAttribute('aria-label')==='Como usar'})()`));
  await conferirTela('Meu dia', 360);
  await c.foto('g-meu-dia-360');
  await ir('/meu-dia/rotinas');
  await c.ate(`document.querySelector('main h1')`);
  await c.espera(250);
  await conferirTela('Rotinas', 360);
  await c.foto('g-rotinas-360');
  await ir('/ajuda/meu-dia');
  await c.ate(`document.querySelector('main h1')`);
  ok('manual: assuntos recolhidos num botão', await c.avaliar(`(()=>{const d=document.querySelector('main details');return d&&d.getBoundingClientRect().height>=44&&getComputedStyle(document.querySelector('main aside')).display==='none'})()`));
  await conferirTela('manual', 360);
  await c.foto('g-manual-360');
  await c.clicar('main details summary');
  await c.espera(200);
  ok('os assuntos abrem', await c.avaliar(`document.querySelector('main details').open&&document.querySelectorAll('main details nav a').length===30`));
  await c.foto('g-manual-assuntos-360');
  await ir('/ajuda/meu-dia/criar-tarefa');
  await c.ate(`document.querySelector('main h1')`);
  await conferirTela('artigo', 360);
  await c.foto('g-artigo-360', { inteira: true });
  await c.clicar('[aria-label="Buscar"]');
  await c.ate(`${campo}`);
  await c.espera(450);
  await buscar('lembrete');
  await c.ate(`(document.querySelector('.busca-global [role=listbox]')?.textContent??'').includes('Como criar um lembrete')`);
  await conferirTela('busca', 360);
  await c.foto('g-busca-360');
  await c.clicar(`.busca-global a[href="/ajuda/meu-dia/criar-lembrete"]`);
  await c.ate(`location.pathname==='/ajuda/meu-dia/criar-lembrete'`);
  ok('tocar no artigo abre o manual', true);
});

ok('servidor usado', Boolean(BASE), BASE);
await h.terminar();
