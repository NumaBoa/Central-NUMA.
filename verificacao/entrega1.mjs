// Verificação da entrega 1 (moldura e abertura) no sistema real, em http://localhost:3000.
import path from 'node:path';
import { abrirChrome } from './cdp.mjs';

const scratch = process.argv[2];
const BASE = process.argv[3] || 'http://localhost:3000';
const fotos = path.join(scratch, 'e1');
const c = await abrirChrome({ scratch, pastaFotos: fotos });
const resultados = [];
const ok = (nome, passou, extra) => resultados.push(`${passou ? 'OK   ' : 'FALHA'} ${nome}${extra !== undefined ? ` [${extra}]` : ''}`);
async function passo(nome, fn) {
  try { await fn(); } catch (e) { resultados.push(`ERRO  ${nome}: ${e.message}`); }
}

const MEDIR = `(()=>{
  const cs=e=>getComputedStyle(e);const vis=e=>{const b=e.getBoundingClientRect();return b.width>0&&b.height>0&&cs(e).visibility!=='hidden'};
  const r={larguraJanela:innerWidth,rolagemLateral:document.documentElement.scrollWidth>innerWidth};
  const menor=[];document.querySelectorAll('body *').forEach(e=>{if(vis(e)&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())){const s=parseFloat(cs(e).fontSize);if(s<12)menor.push(s+':'+e.textContent.trim().slice(0,24))}});r.textoAbaixo12=menor;
  const alvos=[];document.querySelectorAll('a,button:not(:disabled),select:not(:disabled),input:not(:disabled):not([type=radio]):not([type=file]),[role=tab]').forEach(e=>{if(vis(e)&&!e.closest('[data-sonner-toaster]')&&e.getAttribute('href')!=='#conteudo'){const b=e.getBoundingClientRect();if(b.height<44||b.width<44)alvos.push((e.textContent.trim().slice(0,20)||e.getAttribute('aria-label')||e.id)+' '+Math.round(b.width)+'x'+Math.round(b.height))}});r.alvosAbaixo44=alvos;
  const c16=[];document.querySelectorAll('input:not([type=radio]),select,textarea').forEach(e=>{if(vis(e)&&parseFloat(cs(e).fontSize)<16)c16.push((e.id||e.getAttribute('aria-label'))+':'+cs(e).fontSize)});r.camposAbaixo16=c16;
  const h1=document.querySelector('h1');if(h1)r.h1=cs(h1).fontSize+'/'+cs(h1).lineHeight+' '+cs(h1).fontFamily.slice(0,24);
  r.fundo=cs(document.body).backgroundColor;
  const n=document.querySelector('[aria-label^="Contexto"] .truncate, [aria-label^="Contexto"] .md\\\\:inline');
  const nomes=[...document.querySelectorAll('[aria-label^="Contexto"] span')].filter(vis).filter(e=>e.textContent.trim());
  r.contexto=nomes.map(e=>e.textContent.trim()+(e.scrollWidth>e.clientWidth?' CORTADO':'')).join(',');
  const bt=document.querySelector('[aria-label^="Contexto"]');if(bt)r.contextoAltura=Math.round(bt.getBoundingClientRect().height);
  const nav=document.querySelector('[data-menu-lateral] nav');if(nav&&vis(nav))r.menuRola=nav.scrollHeight>nav.clientHeight+1;
  const topo=document.querySelector('header');r.barraEstoura=topo.scrollWidth>topo.clientWidth;
  return r})()`;

// ---------- Abertura ----------
await c.tamanho(1440, 900);
// O relógio fica dentro da página: o tempo não depende de quando o teste percebe o elemento.
await c.enviar('Page.addScriptToEvaluateOnNewDocument', { source: `(()=>{const m={};window.__abertura=m;new MutationObserver(()=>{const a=document.querySelector('.abertura');if(a&&m.inicio===undefined)m.inicio=performance.now();if(a&&a.hasAttribute('data-saindo')&&m.saindo===undefined)m.saindo=performance.now();if(!a&&m.saindo!==undefined&&m.fim===undefined)m.fim=performance.now()}).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['data-saindo']})})()` });
await passo('abertura automática', async () => {
  await c.ir(BASE + '/');
  ok('redireciona para o Meu dia', await c.avaliar(`location.pathname.startsWith('/meu-dia')`));
  const escondida = await c.avaliar(`document.documentElement.hasAttribute('data-abertura')&&getComputedStyle(document.getElementById('moldura')).visibility==='hidden'`);
  ok('a Central não aparece por trás da abertura', escondida);
  await c.ate(`document.querySelector('.abertura')`);
  await c.foto('a-inicio');
  await c.espera(300);
  await c.foto('a-300ms');
  await c.ate(`document.querySelector('.abertura[data-saindo]')`);
  const duracao = Math.round(await c.avaliar(`window.__abertura.saindo-window.__abertura.inicio`));
  ok('fica até 1,6s', duracao >= 1500 && duracao <= 1800, `${duracao}ms`);
  await c.ate(`window.__abertura.fim!==undefined`);
  const t = Math.round(await c.avaliar(`window.__abertura.fim-window.__abertura.saindo`));
  ok('transição de 400ms', t >= 350 && t <= 560, `${t}ms`);
  resultados.push(`  medida abertura: ${duracao}ms na tela, ${t}ms de saída`);
  ok('registra a abertura de hoje', await c.avaliar(`JSON.parse(localStorage.getItem('numa-central:v1:meta')).ultima_abertura===new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date())`));
  ok('Central visível depois', await c.avaliar(`getComputedStyle(document.getElementById('moldura')).visibility==='visible'`));
});
await passo('uma vez por dia', async () => {
  await c.recarregar();
  await c.espera(600);
  ok('não repete no mesmo dia', await c.avaliar(`!document.querySelector('.abertura')&&!document.documentElement.hasAttribute('data-abertura')`));
  await c.avaliar(`(()=>{const m=JSON.parse(localStorage.getItem('numa-central:v1:meta'));m.ultima_abertura='2020-01-01';localStorage.setItem('numa-central:v1:meta',JSON.stringify(m))})()`);
  await c.recarregar();
  await c.ate(`document.querySelector('.abertura')`);
  ok('volta no dia seguinte', true);
  await c.espera(100);
  await c.tecla('a');
  ok('tecla pula', await c.avaliar(`Boolean(document.querySelector('.abertura[data-saindo]'))`));
  await c.ate(`!document.querySelector('.abertura')`);
});
await passo('rever e manter', async () => {
  await c.ir(BASE + '/configuracoes?abertura=1');
  await c.ate(`document.querySelector('.abertura')`);
  await c.espera(150);
  await c.clicarPonto(400, 400);
  ok('clique pula', await c.avaliar(`Boolean(document.querySelector('.abertura[data-saindo]'))`));
  await c.ate(`!document.querySelector('.abertura')`);
  for (const [l, a] of [[1440, 900], [1024, 768], [768, 1024], [360, 800]]) {
    await c.tamanho(l, a);
    await c.ir(BASE + '/configuracoes?abertura=manter');
    await c.ate(`document.querySelector('.abertura')`);
    await c.espera(2200);
    ok(`manter segura em ${l}px`, await c.avaliar(`Boolean(document.querySelector('.abertura'))&&!document.querySelector('.abertura[data-saindo]')`));
    const m = await c.avaliar(`(()=>{const l=document.querySelector('.abertura .logo, .abertura span');const g=document.querySelector('.abertura > span');const p=document.querySelector('.abertura p');const b=g.getBoundingClientRect();return {logo:getComputedStyle(g).fontSize,fonte:getComputedStyle(g).fontFamily.slice(0,20),frase:getComputedStyle(p).fontSize+' '+p.textContent,dentro:b.left>=0&&b.right<=innerWidth,rolagem:document.documentElement.scrollWidth>innerWidth}})()`);
    resultados.push(`  medida abertura ${l}: ${JSON.stringify(m)}`);
    ok(`abertura sem rolagem em ${l}px`, !m.rolagem && m.dentro);
    await c.foto(`a-${l}`);
  }
});
await c.tamanho(1440, 900);
await passo('movimento reduzido', async () => {
  await c.reduzirMovimento(true);
  await c.ir(BASE + '/configuracoes?abertura=1');
  await c.ate(`document.querySelector('.abertura')`);
  const t0 = Date.now();
  await c.foto('a-reduzido');
  await c.ate(`!document.querySelector('.abertura')`);
  const d = Date.now() - t0;
  ok('imagem estática por 600ms', d >= 350 && d <= 900, `${d}ms`);
  await c.reduzirMovimento(false);
});

// ---------- Moldura nos tamanhos ----------
for (const [l, a] of [[1440, 900], [1366, 657], [1024, 768], [768, 1024], [390, 844], [360, 800]]) {
  await passo(`moldura ${l}`, async () => {
    await c.tamanho(l, a);
    await c.ir(BASE + '/configuracoes');
    await c.espera(400);
    const m = await c.avaliar(MEDIR);
    if (l >= 768) delete m.alvosAbaixo44, delete m.camposAbaixo16;
    resultados.push(`  medida ${l}x${a}: ${JSON.stringify(m)}`);
    ok(`sem rolagem lateral em ${l}px`, !m.rolagemLateral && m.larguraJanela === l, m.larguraJanela);
    ok(`nada abaixo de 12px em ${l}px`, m.textoAbaixo12.length === 0);
    if (l < 768) {
      ok(`alvos de 44px em ${l}px`, m.alvosAbaixo44.length === 0);
      ok(`campos de 16px em ${l}px`, m.camposAbaixo16.length === 0);
    }
    ok(`nome do contexto inteiro em ${l}px`, !String(m.contexto).includes('CORTADO'), m.contexto);
    await c.foto(`m-${l}`);
  });
}
await passo('todos os nomes de contexto cabem em 360px', async () => {
  await c.tamanho(360, 800);
  await c.ir(BASE + '/configuracoes');
  await c.espera(300);
  const ids = ['consolidada', 'institucional', 'c4e2a3f6-9d51-4c32-8e23-2b3c4d5e6f02', 'c4e2a3f6-9d51-4c32-8e23-2b3c4d5e6f03', 'c4e2a3f6-9d51-4c32-8e23-2b3c4d5e6f04', 'c4e2a3f6-9d51-4c32-8e23-2b3c4d5e6f05', 'c4e2a3f6-9d51-4c32-8e23-2b3c4d5e6f06'];
  const cortados = [];
  for (const id of ids) {
    await c.avaliar(`(()=>{const m=JSON.parse(localStorage.getItem('numa-central:v1:meta'));m.contexto_id='${id}';localStorage.setItem('numa-central:v1:meta',JSON.stringify(m))})()`);
    await c.recarregar();
    await c.espera(200);
    const v = await c.avaliar(`(()=>{const e=[...document.querySelectorAll('[aria-label^="Contexto"] span')].find(s=>s.getBoundingClientRect().width>10);return {t:e.textContent,cortado:e.scrollWidth>e.clientWidth}})()`);
    if (v.cortado) cortados.push(v.t);
  }
  ok('nenhum contexto cortado em 360px', cortados.length === 0, cortados.join(','));
  await c.avaliar(`(()=>{const m=JSON.parse(localStorage.getItem('numa-central:v1:meta'));m.contexto_id='consolidada';localStorage.setItem('numa-central:v1:meta',JSON.stringify(m))})()`);
});

// ---------- Navegação no computador ----------
await c.tamanho(1440, 900);
await passo('menu', async () => {
  await c.ir(BASE + '/configuracoes');
  await c.espera(400);
  const m = await c.avaliar(`(()=>{const links=[...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href'));const emBreve=[...document.querySelectorAll('[data-menu-lateral] [aria-disabled=true]')];return {links,emBreve:emBreve.length,textos:emBreve.every(e=>e.textContent.includes('Em breve')),semLink:emBreve.every(e=>!e.closest('a')),ativo:document.querySelector('[data-menu-lateral] a[aria-current=page]')?.textContent}})()`);
  ok('8 módulos "Em breve", sem link', m.emBreve === 8 && m.textos && m.semLink);
  ok('Configurações marcada como atual', m.ativo === 'Configurações', m.ativo);
  ok('nenhum link vazio', !m.links.some((h) => h === '#' || !h));
  const respostas = await c.avaliar(`Promise.all([...new Set([...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')).filter(h=>h.startsWith('/')))].map(h=>fetch(h).then(r=>h+':'+r.status)))`);
  ok('todos os links respondem', respostas.every((r) => r.endsWith(':200')), respostas.join(' '));
});
await passo('recolher menu', async () => {
  await c.clicar('[aria-label="Recolher ou expandir o menu"]');
  await c.espera(300);
  const l = await c.avaliar(`document.querySelector('[data-menu-lateral]').getBoundingClientRect().width`);
  ok('recolhe para 76px', l === 76, l);
  await c.foto('m-1440-recolhido');
  await c.recarregar();
  ok('continua recolhido ao recarregar', await c.avaliar(`document.documentElement.hasAttribute('data-menu-recolhido')`));
  await c.espera(300);
  await c.clicar('[aria-label="Recolher ou expandir o menu"]');
  await c.espera(300);
  ok('expande de novo', (await c.avaliar(`document.querySelector('[data-menu-lateral]').getBoundingClientRect().width`)) === 260);
});
await passo('contexto', async () => {
  await c.clicar('[aria-label^="Contexto"]');
  await c.ate(`document.querySelector('.menu-suspenso')`);
  await c.foto('o-contexto');
  ok('lista os 7 contextos (CA-02.03)', (await c.avaliar(`document.querySelectorAll('.menu-suspenso li').length`)) === 7);
  await c.clicar('texto=Kipi');
  await c.espera(300);
  ok('escolhe Kipi', await c.avaliar(`document.querySelector('[aria-label^="Contexto"]').getAttribute('aria-label')==='Contexto: Kipi'`));
  await c.recarregar();
  await c.espera(300);
  ok('lembra o contexto ao recarregar', await c.avaliar(`document.querySelector('[aria-label^="Contexto"]').getAttribute('aria-label')==='Contexto: Kipi'`));
  await c.clicar('[aria-label^="Contexto"]');
  await c.ate(`document.querySelector('.menu-suspenso')`);
  await c.tecla('Escape');
  await c.ate(`!document.querySelector('.menu-suspenso')`);
  ok('Esc fecha o menu', true);
  await c.clicar('[aria-label^="Contexto"]');
  await c.ate(`document.querySelector('.menu-suspenso')`);
  await c.clicar('texto=Numa consolidada');
  await c.espera(200);
});
await passo('você é', async () => {
  await c.avaliar(`(()=>{const s=document.querySelector('[data-menu-lateral] select');const set=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;set.call(s,'1c8e2d63-4a7f-4b2c-8e3d-6f9b8d5a2b02');s.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await c.espera(100);
  ok('troca as iniciais', (await c.avaliar(`document.querySelector('[data-menu-lateral] select').closest('div').querySelector('span').textContent`)) === 'CL');
  await c.recarregar();
  await c.ate(`document.querySelector('[data-menu-lateral] select').value==='1c8e2d63-4a7f-4b2c-8e3d-6f9b8d5a2b02'`, 5000);
  ok('lembra a pessoa ao recarregar', true);
  await c.avaliar(`(()=>{const s=document.querySelector('[data-menu-lateral] select');const set=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;set.call(s,'0b7f1c52-3f6e-4a1b-9d2c-5e8a7c4f1a01');s.dispatchEvent(new Event('change',{bubbles:true}))})()`);
});
await passo('+ Novo', async () => {
  await c.clicar('texto=Novo');
  await c.ate(`document.querySelector('.menu-suspenso')`);
  await c.foto('o-novo');
  const r = await c.avaliar(`[...document.querySelectorAll('.menu-suspenso li')].map(l=>l.textContent)`);
  ok('as 6 opções ativas e 1 "Em breve"', r.length === 7 && r.filter((t) => t.includes('Em breve')).length === 1 && ['Tarefa', 'Demanda', 'Lembrete', 'Despesa', 'Ferramenta', 'Contraparte'].every((t) => r.includes(t)), r.join('|'));
  await c.tecla('Escape');
  await c.ate(`!document.querySelector('.menu-suspenso')`);
});
await passo('sino', async () => {
  await c.clicar('[aria-label^="Notificações"]');
  await c.ate(`document.querySelector('.menu-suspenso')`);
  await c.foto('o-sino');
  ok('o sino abre a lista de notificações', await c.avaliar(`document.querySelector('.menu-suspenso').textContent.includes('Notificações')`));
  await c.tecla('Escape');
  await c.ate(`!document.querySelector('.menu-suspenso')`);
});
await passo('busca', async () => {
  await c.clicar('texto=Buscar');
  await c.ate(`document.querySelector('.dialogo')`);
  await c.foto('o-busca');
  ok('a busca abre, com o campo', await c.avaliar(`Boolean(document.querySelector('.dialogo input[aria-label="Buscar"]'))`));
  await c.tecla('Escape');
  await c.ate(`!document.querySelector('.dialogo')`);
  await c.tecla('k', { ctrl: true });
  await c.ate(`document.querySelector('.dialogo')`);
  ok('Ctrl+K abre', true);
  await c.tecla('Escape');
  await c.ate(`!document.querySelector('.dialogo')`);
});
await passo('teclado', async () => {
  await c.recarregar();
  await c.espera(300);
  await c.tecla('Tab');
  const pulo = await c.avaliar(`(()=>{const e=document.activeElement;return {t:e.textContent,topo:e.getBoundingClientRect().top,contorno:getComputedStyle(e).outlineWidth+' '+getComputedStyle(e).outlineColor}})()`);
  ok('primeiro Tab mostra "Ir para o conteúdo"', pulo.t === 'Ir para o conteúdo' && pulo.topo >= 0, JSON.stringify(pulo));
  await c.foto('t-pulo');
  await c.tecla('Tab');
  const foco = await c.avaliar(`(()=>{const c=getComputedStyle(document.activeElement);return c.outlineWidth+' '+c.outlineColor+' '+c.outlineStyle})()`);
  ok('foco índigo visível (CA-18.10)', foco.includes('3px') && foco.includes('solid'), foco);
});

// ---------- Tablet ----------
await c.tamanho(768, 1024);
await passo('tablet', async () => {
  await c.ir(BASE + '/configuracoes');
  await c.espera(400);
  ok('menu em 76px no tablet', (await c.avaliar(`document.querySelector('[data-menu-lateral]').getBoundingClientRect().width`)) === 76);
  ok('busca vira ícone', await c.avaliar(`document.querySelector('[aria-label="Buscar"]').getBoundingClientRect().width>0`));
  await c.clicar('[aria-label="Recolher ou expandir o menu"]');
  await c.espera(350);
  ok('expande sobre o conteúdo', (await c.avaliar(`document.querySelector('[data-menu-lateral]').getBoundingClientRect().width`)) === 260);
  await c.foto('m-768-aberto');
  await c.clicarPonto(600, 500);
  await c.espera(350);
  ok('clique fora recolhe', (await c.avaliar(`document.querySelector('[data-menu-lateral]').getBoundingClientRect().width`)) === 76);
});

// ---------- Celular ----------
await c.tamanho(360, 800);
await passo('celular', async () => {
  await c.ir(BASE + '/configuracoes');
  await c.espera(400);
  const b = await c.avaliar(`(()=>{const n=document.querySelector('nav[aria-label="Navegação do celular"]');const c=[...n.children].map(e=>e.textContent.trim()||e.getAttribute('aria-label'));return {itens:c,altura:n.getBoundingClientRect().height,menuLateral:getComputedStyle(document.querySelector('[data-menu-lateral]')).display}})()`);
  ok('barra inferior: Meu dia, Financeiro, +, Ferramentas e Mais', b.itens.length === 5 && b.itens[2] === 'Criar' && b.itens[0].startsWith('Meu dia') && b.itens[3].startsWith('Ferramentas') && b.itens[4] === 'Mais', b.itens.join(' | '));
  ok('barra de 64px e sem menu lateral', b.altura === 64 && b.menuLateral === 'none', `${b.altura} ${b.menuLateral}`);
  ok('sem etiqueta de exemplo na barra superior', await c.avaliar(`![...document.querySelectorAll('header span')].some(s=>s.textContent==='Dados de exemplo'&&s.getBoundingClientRect().width>0)`));
  await c.clicar('nav[aria-label="Navegação do celular"] button[aria-label="Criar"]');
  await c.ate(`document.querySelector('.dialogo')`);
  await c.espera(450);
  await c.foto('c-criar');
  ok('"+" abre a folha Criar', await c.avaliar(`document.querySelector('.dialogo').textContent.includes('Tarefa')`));
  await c.clicar('.dialogo [aria-label="Fechar"]');
  await c.ate(`!document.querySelector('.dialogo')`);
  await c.clicar('texto=Mais');
  await c.ate(`document.querySelector('.dialogo')`);
  await c.espera(450);
  await c.foto('c-mais');
  const mais = await c.avaliar(`(()=>{const d=document.querySelector('.dialogo');return {etiqueta:d.textContent.includes('Dados de exemplo'),voceE:Boolean(d.querySelector('#voce-e-celular')),config:Boolean(d.querySelector('a[href="/configuracoes"]')),emBreve:(d.textContent.match(/Em breve/g)||[]).length}})()`);
  ok('"Mais" traz módulos, "Você é" e a etiqueta', mais.etiqueta && mais.voceE && mais.config && mais.emBreve === 8, JSON.stringify(mais));
  await c.clicar('.dialogo a[href="/configuracoes"]');
  await c.ate(`!document.querySelector('.dialogo')`);
  await c.clicar('[aria-label^="Contexto"]');
  await c.ate(`document.querySelector('.dialogo')`);
  await c.espera(450);
  await c.foto('c-contexto');
  const linhas = await c.avaliar(`[...document.querySelectorAll('.dialogo li button')].map(b=>Math.round(b.getBoundingClientRect().height))`);
  ok('contexto em folha, opções de 48px', linhas.length === 7 && linhas.every((h) => h >= 48), linhas.join(','));
  await c.clicar('.dialogo [aria-label="Fechar"]');
  await c.ate(`!document.querySelector('.dialogo')`);
  await c.clicar('[aria-label="Buscar"]');
  await c.ate(`document.querySelector('.dialogo')`);
  await c.espera(450);
  await c.foto('c-busca');
  await c.clicar('.dialogo [aria-label="Fechar"]');
  await c.ate(`!document.querySelector('.dialogo')`);
});

// ---------- Padrões ----------
for (const [l, a] of [[1440, 900], [768, 1024], [360, 800]]) {
  await c.tamanho(l, a);
  await passo(`padrões ${l}`, async () => {
    await c.ir(BASE + '/padroes');
    await c.ate(`document.querySelector('h1')?.textContent==='Padrões da Central'`);
    await c.espera(500);
    const m = await c.avaliar(MEDIR);
    if (l >= 768) delete m.alvosAbaixo44, delete m.camposAbaixo16;
    resultados.push(`  medida padrões ${l}: ${JSON.stringify(m)}`);
    ok(`padrões sem rolagem lateral em ${l}px`, !m.rolagemLateral && m.larguraJanela === l, m.larguraJanela);
    ok(`padrões sem texto abaixo de 12px em ${l}px`, m.textoAbaixo12.length === 0);
    if (l < 768) {
      ok(`padrões com alvos de 44px em ${l}px`, m.alvosAbaixo44.length === 0, m.alvosAbaixo44.join(' | '));
      ok(`padrões com campos de 16px em ${l}px`, m.camposAbaixo16.length === 0);
    }
    await c.foto(`p-${l}`, { inteira: true });
    const v = await c.avaliar(`(()=>{const vis=e=>e&&e.getBoundingClientRect().width>0;const t=document.querySelector('table');const ths=[...t.querySelectorAll('th')].filter(vis).map(e=>e.textContent.trim());return {tabela:vis(t),colunas:ths,cartoes:vis(document.querySelector('ul[aria-label="Atividades de exemplo"]'))}})()`);
    if (l >= 1024) ok('computador: tabela completa', v.tabela && !v.cartoes && v.colunas.length >= 7, v.colunas.join(','));
    else if (l >= 768) ok('tablet: colunas essenciais', v.tabela && !v.cartoes && v.colunas.includes('Título') && !v.colunas.includes('Código'), v.colunas.join(','));
    else ok('celular: cartões', !v.tabela && v.cartoes);
  });
}
await c.tamanho(1440, 900);
await passo('lista', async () => {
  await c.ir(BASE + '/padroes');
  const linhas = `document.querySelectorAll('table tbody tr').length`;
  await c.ate(`${linhas}===5`);
  await c.espera(400);
  ok('5 linhas de exemplo', (await c.avaliar(linhas)) === 5, await c.avaliar(linhas));
  await c.clicar('button[aria-pressed]:not([aria-pressed=true])');
  await c.espera(100);
  ok('pílula filtra', (await c.avaliar(linhas)) === 1, await c.avaliar(linhas));
  await c.clicar('input[type=search]');
  await c.digitar('zzzz');
  await c.espera(100);
  ok('vazio por filtro', await c.avaliar(`document.body.textContent.includes('Nada com esses filtros.')`));
  await c.clicar('texto=Limpar filtros');
  await c.espera(100);
  ok('limpar filtros volta tudo', (await c.avaliar(linhas)) === 5);
  await c.clicar('th button');
  await c.espera(100);
  const a1 = await c.avaliar(`document.querySelector('table tbody tr td').textContent`);
  await c.clicar('th button');
  await c.espera(100);
  const a2 = await c.avaliar(`document.querySelector('table tbody tr td').textContent`);
  ok('ordena nos dois sentidos', a1 !== a2, `${a1} / ${a2}`);
  await c.clicar('texto=Vazia');
  await c.espera(100);
  ok('estado vazio', await c.avaliar(`document.body.textContent.includes('Tudo em dia por aqui.')`));
  await c.clicar('texto=Carregando');
  await c.espera(100);
  ok('estado carregando', await c.avaliar(`Boolean(document.querySelector('section [role=status]'))`));
  await c.clicar('texto=Com erro');
  await c.espera(100);
  ok('estado de erro', await c.avaliar(`Boolean(document.querySelector('section [role=alert]'))`));
  await c.clicar('texto=Tentar de novo');
  await c.espera(100);
  ok('tentar de novo volta', (await c.avaliar(linhas)) === 5);
  await c.clicar('table tbody tr');
  await c.ate(`document.querySelector('[data-sonner-toast]')`);
  await c.espera(350);
  await c.foto('p-aviso');
  ok('linha abre e o aviso aparece', true);
  const t0 = Date.now();
  await c.ate(`!document.querySelector('[data-sonner-toast]')`, 8000);
  const d = Date.now() - t0;
  ok('aviso some em cerca de 5s', d > 3800 && d < 6500, `${d}ms`);
});
await passo('filtros detalhados', async () => {
  await c.clicar('texto=Filtros');
  await c.ate(`document.querySelector('.menu-suspenso #filtro-contexto')`);
  await c.foto('p-filtros');
  await c.avaliar(`(()=>{const s=document.querySelector('#filtro-contexto');const set=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;set.call(s,'kipi');s.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await c.espera(100);
  await c.tecla('Escape');
  await c.espera(250);
  ok('etiqueta removível e contador', await c.avaliar(`Boolean(document.querySelector('[aria-label="Remover filtro: Kipi"]'))&&document.body.textContent.includes('Filtros (1)')`));
  await c.clicar('[aria-label="Remover filtro: Kipi"]');
  await c.espera(100);
});
await passo('formulário', async () => {
  await c.clicar('texto=Nova tarefa');
  await c.ate(`document.querySelector('.painel-lateral')`);
  await c.espera(450);
  ok('painel de 480px', (await c.avaliar(`document.querySelector('.painel-lateral').getBoundingClientRect().width`)) === 480);
  await c.clicar('.painel-lateral button[type=submit]');
  await c.espera(150);
  ok('erro junto ao campo e no resumo', await c.avaliar(`(()=>{const p=document.querySelector('.painel-lateral');return p.querySelector('[role=alert]')?.textContent.includes('Informe o título')&&document.getElementById('exemplo-titulo').getAttribute('aria-invalid')==='true'&&document.activeElement.id==='exemplo-titulo'})()`));
  await c.foto('p-formulario-erro');
  await c.digitar('Pagar o domínio');
  await c.espera(100);
  await c.clicar('.painel-lateral [aria-label="Fechar"]');
  await c.ate(`document.querySelector('.dialogo')`);
  await c.espera(450);
  await c.foto('p-descartar');
  ok('fechar com alteração pede confirmação', await c.avaliar(`document.querySelector('.dialogo').textContent.includes('Descartar as alterações?')`));
  await c.clicar('texto=Continuar editando');
  await c.ate(`!document.querySelector('.dialogo')`);
  ok('continuar editando mantém o texto', (await c.avaliar(`document.getElementById('exemplo-titulo').value`)) === 'Pagar o domínio');
  await c.clicar('.painel-lateral label:has(input[value="Camila Lima"])');
  await c.clicar('texto=Salvar e adicionar outro');
  await c.espera(200);
  ok('salvar e outro limpa o título e mantém a responsável', await c.avaliar(`document.getElementById('exemplo-titulo').value===''&&document.querySelector('.painel-lateral input[value="Camila Lima"]').checked`));
  await c.digitar('Outra tarefa');
  await c.clicar('.painel-lateral button[type=submit]');
  await c.ate(`!document.querySelector('.painel-lateral')`);
  ok('salvar fecha o painel', true);
});
await passo('confirmação', async () => {
  await c.clicar('texto=Arquivar com motivo');
  await c.ate(`document.querySelector('.dialogo')`);
  await c.espera(450);
  await c.clicar('.dialogo button:last-child');
  await c.espera(100);
  ok('motivo obrigatório', await c.avaliar(`document.querySelector('.dialogo').textContent.includes('Informe o motivo.')`));
  await c.foto('p-confirmacao');
  await c.clicar('.dialogo textarea');
  await c.digitar('Teste');
  await c.clicar('texto=Arquivar registro');
  await c.ate(`!document.querySelector('.dialogo')`);
  ok('confirma com motivo', true);
});
await c.tamanho(360, 800);
await passo('padrões no celular', async () => {
  await c.ir(BASE + '/padroes');
  await c.ate(`document.querySelector('h1')?.textContent==='Padrões da Central'`);
  await c.espera(400);
  await c.clicar('texto=Nova tarefa');
  await c.ate(`document.querySelector('.painel-lateral')`);
  await c.espera(450);
  const p = await c.avaliar(`(()=>{const b=document.querySelector('.painel-lateral').getBoundingClientRect();const f=document.querySelector('.painel-lateral footer').getBoundingClientRect();return {l:b.width,a:b.height,rodapeNoFim:Math.round(f.bottom)===Math.round(b.bottom),voltar:Boolean(document.querySelector('.painel-lateral [aria-label="Voltar"]'))}})()`);
  ok('painel em tela inteira, com Voltar e ações fixas', p.l === 360 && p.a === 800 && p.rodapeNoFim && p.voltar, JSON.stringify(p));
  await c.foto('c-painel');
  await c.clicar('.painel-lateral [aria-label="Voltar"]');
  await c.ate(`!document.querySelector('.painel-lateral')`);
  await c.clicar('texto=Filtros');
  await c.ate(`document.querySelector('.dialogo #filtro-contexto')`);
  await c.espera(450);
  await c.foto('c-filtros');
  ok('filtros em folha inferior', true);
  await c.clicar('.dialogo [aria-label="Fechar"]');
  await c.ate(`!document.querySelector('.dialogo')`);
  await c.clicar('texto=Cancelar a ferramenta');
  await c.ate(`document.querySelector('.dialogo')`);
  await c.espera(450);
  await c.foto('c-confirmacao');
  const d = await c.avaliar(`(()=>{const b=document.querySelector('.dialogo').getBoundingClientRect();return {base:Math.round(b.bottom),larg:b.width}})()`);
  ok('confirmação em folha inferior', d.base === 800 && d.larg === 360, JSON.stringify(d));
  await c.clicar('texto=Voltar');
  await c.ate(`!document.querySelector('.dialogo')`);
  ok('rolagem lateral com folha aberta e fechada: não', await c.avaliar(`document.documentElement.scrollWidth<=innerWidth`));
  ok('sem armazenar nada fora da chave da especificação', await c.avaliar(`Object.keys(localStorage).every(k=>k.startsWith('numa-central:v1:'))`), await c.avaliar(`Object.keys(localStorage).join(',')`));
});

await c.tamanho(360, 800);
await passo('fotos do celular em partes', async () => {
  await c.ir(BASE + '/padroes');
  await c.ate(`document.querySelector('h1')?.textContent==='Padrões da Central'`);
  await c.espera(400);
  const altura = await c.avaliar(`document.documentElement.scrollHeight`);
  for (let y = 0, i = 0; y < altura; y += 720, i++) {
    await c.avaliar(`window.scrollTo({top:${y},behavior:'instant'})`);
    await c.espera(60);
    await c.foto(`pc-${i}`);
  }
  resultados.push(`  altura padrões 360: ${altura}`);
});
await c.tamanho(1440, 900);
await passo('foco ao abrir', async () => {
  await c.ir(BASE + '/padroes');
  await c.ate(`document.querySelector('h1')?.textContent==='Padrões da Central'`);
  await c.espera(400);
  await c.clicar('texto=Nova tarefa');
  await c.ate(`document.querySelector('.painel-lateral')`);
  await c.espera(100);
  ok('formulário foca o primeiro campo', (await c.avaliar(`document.activeElement.id`)) === 'exemplo-titulo');
  await c.tecla('Escape');
  await c.ate(`!document.querySelector('.painel-lateral')`);
  await c.clicar('texto=Arquivar com motivo');
  await c.ate(`document.querySelector('.dialogo')`);
  await c.espera(100);
  ok('diálogo foca o próprio diálogo', await c.avaliar(`document.activeElement===document.querySelector('.dialogo')`));
  await c.tecla('Escape');
  await c.ate(`!document.querySelector('.dialogo')`);
  ok('Esc devolve o foco ao botão', await c.avaliar(`document.activeElement.tagName==='BUTTON'&&document.activeElement.textContent==='Arquivar com motivo'`));
});

const falhas = resultados.filter((r) => !r.startsWith('OK') && !r.startsWith('  '));
console.log(resultados.join('\n'));
console.log(`\n=== ${resultados.filter((r) => r.startsWith('OK')).length} OK, ${falhas.length} com problema`);
console.log('=== console:', c.erros.length ? '\n' + [...new Set(c.erros)].join('\n') : 'sem erros nem avisos');
await c.fechar();
process.exit(0);
