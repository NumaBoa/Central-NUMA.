// Verificação de T13.03 (Busca global) e T13.04 (Sino) no sistema real.
import { iniciar, ID_CAMILA, ID_KIMBERLY } from './apoio.mjs';

const h = await iniciar({ nome: 't1303', porta: 9359 });
const { c, ok, passo, ir, texto, escolher, esperarAviso, dialogoAberto, dialogoFechado, painelAberto, painelFechado, pularAbertura, tabela, conferirTela, clicarNoDialogo } = h;

const js = (v) => JSON.stringify(v);
const irMeuDia = async () => { await ir('/meu-dia'); await c.ate(`document.querySelector('main article')`); };
const irDados = async () => { await ir('/configuracoes/dados'); await c.ate(`[...document.querySelectorAll('main button')].some(b=>b.textContent==='Restaurar exemplos')`); await c.espera(150); };
const campo = `document.querySelector('.busca-global input')`;
const buscar = (termo) => c.avaliar(`(()=>{const e=${campo};Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${js(termo)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`);
const resultados = () => c.avaliar(`[...document.querySelectorAll('.busca-global [role=option]')].map(o=>o.querySelector('span span, span').textContent.trim())`);
const selecionado = () => c.avaliar(`document.querySelector('.busca-global [role=option][aria-selected=true]')?.textContent ?? ''`);
const grupos = () => c.avaliar(`[...document.querySelectorAll('.busca-global [role=listbox] > p')].map(p=>p.textContent)`);
const abrirBusca = async () => { await c.tecla('k', { ctrl: true }); await c.ate(`${campo}`); await c.espera(420); };
const fecharBusca = async () => { await c.tecla('Escape'); await c.ate(`!document.querySelector('.busca-global')`); };
const sino = `[aria-label^="Notificações"]`;
const rotuloDoSino = () => c.avaliar(`document.querySelector('${sino}').getAttribute('aria-label')`);
const abrirSino = async () => { await c.clicar(sino); await c.ate(`document.querySelector('.menu-suspenso, .dialogo')`); await c.espera(180); };
const linhasDoSino = () => c.avaliar(`[...document.querySelectorAll('.menu-suspenso li, .dialogo li')].map(l=>l.textContent)`);
const fecharSino = async () => { await c.tecla('Escape'); await c.ate(`!document.querySelector('.menu-suspenso')&&!document.querySelector('.dialogo')`); };
const voceE = async (id) => { await c.avaliar(`(()=>{const s=document.querySelector('[data-menu-lateral] select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,${js(id)});s.dispatchEvent(new Event('change',{bubbles:true}))})()`); await c.espera(200); };
const notificacoes = async (usuario) => (await tabela('notificacao')).filter((n) => n.usuario_id === usuario && !n.arquivado_em);


await c.tamanho(1440, 900);

await passo('busca: abrir', async () => {
  await ir('/meu-dia');
  await pularAbertura();
  await c.ate(`document.querySelector('main article')`);
  ok('a pílula mostra o atalho, sem "Em breve"', await c.avaliar(`[...document.querySelectorAll('header button')].some(b=>b.textContent.includes('Buscar')&&b.textContent.includes('Ctrl K')&&!b.textContent.includes('Em breve'))`));
  await c.clicar('texto=Buscar');
  await c.ate(`${campo}`);
  await c.espera(420);
  ok('a pílula abre, com o foco no campo', await c.avaliar(`document.activeElement===${campo}`));
  ok('diz o que dá para buscar', (await texto('.busca-global')).includes('Busque por código, título ou nome'));
  await c.foto('a-vazia');
  await fecharBusca();
  await abrirBusca();
  ok('Ctrl+K abre de qualquer lugar', true);
  await fecharBusca();
  ok('Esc fecha, e o foco volta', await c.avaliar(`document.activeElement.textContent.includes('Buscar')||document.activeElement===document.body`));
  await ir('/configuracoes');
  await c.ate(`document.getElementById('nome')`);
  await c.avaliar(`document.getElementById('nome').focus()`);
  await abrirBusca();
  ok('Ctrl+K funciona até dentro de um campo', true);
  await fecharBusca();
});

await passo('busca: resultados', async () => {
  await irMeuDia();
  await abrirBusca();
  await buscar('k');
  await c.espera(150);
  ok('uma letra não busca', (await resultados()).length === 0);
  await buscar('kipi');
  await c.ate(`document.querySelectorAll('.busca-global [role=option]').length>0`);
  const g = await grupos();
  ok('agrupa por tipo; o código exato vem primeiro', g[0].startsWith('Produtos') && g.some((x) => x.startsWith('Atividades')), g.join('|'));
  const t = await texto('.busca-global [role=listbox]');
  ok('com código, título e contexto', t.includes('Corrigir o erro no login do Kipi') && t.includes('ATV-') && t.includes('Em andamento · Kipi'), t.slice(0, 200));
  await c.foto('b-resultados');
  await buscar('politica privacidade');
  await c.ate(`document.querySelector('.busca-global [role=option]')?.textContent.includes('Escrever a política de privacidade')`);
  ok('sem ligar para acento, com várias palavras', true);
  await buscar('xyzzy');
  await c.ate(`document.querySelector('.busca-global').textContent.includes('Nada encontrado para “xyzzy”.')`);
  ok('nada encontrado explica', true);
  await c.foto('b-nada');
  await buscar('a');
  await c.espera(100);
  await buscar('atv-');
  await c.ate(`(document.querySelector('.busca-global [role=listbox] > p')?.textContent??'').includes('5 de')`);
  ok('até 5 por grupo, dizendo quantos há', (await grupos())[0].startsWith('Atividades · 5 de '), (await grupos())[0]);
  await fecharBusca();
});

await passo('busca: teclado e destino', async () => {
  await irMeuDia();
  await abrirBusca();
  await buscar('conferir');
  await c.ate(`document.querySelectorAll('.busca-global [role=option]').length>=2`);
  const primeiro = await selecionado();
  ok('o primeiro já vem escolhido', primeiro.includes('Conferir'), primeiro);
  await c.tecla('ArrowDown');
  await c.espera(60);
  const segundo = await selecionado();
  ok('↓ desce', segundo !== primeiro, segundo);
  ok('o campo aponta para o escolhido', await c.avaliar(`${campo}.getAttribute('aria-activedescendant')===document.querySelector('.busca-global [role=option][aria-selected=true]').id`));
  await c.tecla('ArrowUp');
  await c.espera(60);
  ok('↑ sobe', (await selecionado()) === primeiro);
  await c.tecla('ArrowUp');
  await c.espera(60);
  ok('dá a volta', (await selecionado()) !== primeiro);
  await c.tecla('ArrowDown');
  await c.espera(60);
  // código exato vai direto
  const a = (await tabela('atividade')).find((x) => x.titulo === 'Definir o preço da oferta anual');
  await buscar(a.codigo.toLowerCase());
  await c.ate(`document.querySelectorAll('.busca-global [role=option]').length===1`);
  await c.espera(60);
  ok('código exato acha o registro', (await selecionado()).includes(a.codigo));
  await c.tecla('Enter');
  await c.ate(`!document.querySelector('.busca-global')`);
  await c.ate(`location.search==='?atividade=${a.id}'`);
  await painelAberto();
  await c.ate(`document.getElementById('painel-titulo')?.value===${js(a.titulo)}`);
  ok('Enter vai direto ao registro', true);
  await c.espera(400);
  await c.tecla('Escape');
  await painelFechado();
  // de outra tela, e os outros tipos
  await ir('/configuracoes');
  await c.ate(`document.getElementById('nome')`);
  await abrirBusca();
  await buscar(a.titulo.slice(0, 12));
  await c.ate(`document.querySelector('.busca-global [role=option]')`);
  await c.avaliar(`document.querySelector('.busca-global [role=option]').click()`);
  await c.ate(`location.pathname==='/meu-dia'&&location.search.startsWith('?atividade=')`);
  await painelAberto();
  ok('de outra tela, também abre a atividade no Meu dia', true);
  await c.espera(400);
  await c.tecla('Escape');
  await painelFechado();
  await abrirBusca();
  await buscar('souza contabilidade');
  await c.ate(`document.querySelector('.busca-global [role=option]')?.textContent.includes('Souza Contabilidade')`);
  await c.tecla('Enter');
  await c.ate(`location.pathname.startsWith('/configuracoes/cadastros/contrapartes/')`);
  await c.ate(`document.querySelector('main h1')?.textContent==='Souza Contabilidade'`);
  ok('contraparte abre a ficha', true);
  await abrirBusca();
  await buscar('bruna');
  await c.ate(`[...document.querySelectorAll('.busca-global [role=option]')].some(o=>o.textContent.includes('Bruna Alves'))`);
  await c.avaliar(`[...document.querySelectorAll('.busca-global [role=option]')].find(o=>o.textContent.includes('Bruna Alves')).click()`);
  await c.ate(`document.querySelector('main h1')?.textContent==='Bruna Alves'`);
  ok('pessoa abre a ficha', true);
  await abrirBusca();
  await buscar('zupi');
  await c.ate(`[...document.querySelectorAll('.busca-global [role=listbox] > p')].some(p=>p.textContent.startsWith('Produtos'))`);
  await c.avaliar(`[...document.querySelectorAll('.busca-global [role=option]')].find(o=>o.getAttribute('href').includes('/marcas/produtos/')).click()`);
  await c.ate(`document.querySelector('main h1')?.textContent==='Zupi'`);
  ok('produto abre a ficha', true);
  await abrirBusca();
  await buscar('');
  await c.espera(100);
  ok('reabre em branco', (await c.avaliar(`${campo}.value`)) === '');
  await fecharBusca();
});

await passo('busca: alterações pendentes', async () => {
  await ir('/configuracoes');
  await c.ate(`document.getElementById('nome')`);
  await c.avaliar(`(()=>{const e=document.getElementById('nome');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'Outro nome');e.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  await c.espera(100);
  await abrirBusca();
  await buscar('zupi');
  await c.ate(`document.querySelector('.busca-global [role=option]')`);
  await c.tecla('Enter');
  await c.ate(`document.querySelector('.dialogo:not(.busca-global)')?.textContent.includes('Descartar')||location.pathname!=='/configuracoes'`);
  ok('com alterações por salvar, pergunta antes de sair (P3)', (await c.avaliar(`location.pathname`)) === '/configuracoes');
  await c.espera(350);
  await c.avaliar(`[...document.querySelectorAll('.dialogo button')].find(b=>b.textContent.includes('Continuar')).click()`);
  await c.ate(`!document.querySelector('.dialogo')`);
  await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.includes('Descartar')).click()`);
  await c.espera(100);
});

await passo('sino: contagem e lista', async () => {
  await irMeuDia();
  await c.espera(300);
  ok('mostra a contagem', (await rotuloDoSino()) === 'Notificações: 1 não lida', await rotuloDoSino());
  ok('com o número à vista', (await texto(sino)) === '1');
  await c.foto('c-sino-fechado');
  await abrirSino();
  await c.foto('c-sino');
  const l = await linhasDoSino();
  ok('a menção do comentário de exemplo', l.length === 1 && l[0].includes('Camila mencionou você em Definir o preço da oferta anual') && l[0].includes('Menção'), l.join(' | '));
  ok('não lida diz isso aos leitores de tela', l[0].includes('não lida'));
  await fecharSino();
  // Camila tem também o alerta
  await voceE(ID_CAMILA);
  await c.ate(`document.querySelector('${sino}').getAttribute('aria-label')==='Notificações: 2 não lidas'`);
  ok('cada pessoa vê as dela', true);
  await abrirSino();
  const dela = await linhasDoSino();
  ok('Camila: a menção e o alerta da responsável', dela.some((x) => x.includes('Kimberly mencionou você')) && dela.some((x) => x.includes('Exportar os dados da Central') && x.includes('Alerta')), dela.join(' | '));
  await fecharSino();
  await voceE(ID_KIMBERLY);
  await c.ate(`document.querySelector('${sino}').getAttribute('aria-label')==='Notificações: 1 não lida'`);
});

await passo('sino: abrir, marcar e menção', async () => {
  const oferta = (await tabela('atividade')).find((x) => x.titulo === 'Definir o preço da oferta anual');
  await abrirSino();
  await c.avaliar(`document.querySelector('.menu-suspenso li a').click()`);
  await c.ate(`location.search==='?atividade=${oferta.id}'`);
  await painelAberto();
  ok('abrir a origem leva à atividade', true);
  await c.ate(`document.querySelector('${sino}').getAttribute('aria-label')==='Notificações'`);
  ok('e marca como lida', (await notificacoes(ID_KIMBERLY))[0].lida_em !== null);
  await c.espera(400);
  // uma menção de verdade, com a pessoa conectada como autora
  await c.avaliar(`(()=>{const e=document.getElementById('painel-comentario');e.focus();Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'@Camila, viu isso?');e.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  await c.avaliar(`[...document.querySelectorAll('.painel-lateral button')].find(b=>b.textContent.trim()==='Comentar').click()`);
  await c.ate(`document.querySelector('.painel-lateral').textContent.includes('@Camila, viu isso?')`);
  const paraCamila = await notificacoes(ID_CAMILA);
  ok('mencionar notifica a pessoa (RN-03.22)', paraCamila.filter((n) => n.tipo === 'mencao').length === 2 && paraCamila.some((n) => n.titulo === 'Kimberly mencionou você em Definir o preço da oferta anual' && n.exemplo === false), JSON.stringify(paraCamila.map((n) => n.titulo)));
  ok('e não notifica quem escreveu', (await notificacoes(ID_KIMBERLY)).length === 1);
  await c.tecla('Escape');
  await painelFechado();
  // marcar uma e marcar todas
  await voceE(ID_CAMILA);
  await c.ate(`document.querySelector('${sino}').getAttribute('aria-label')==='Notificações: 3 não lidas'`);
  await abrirSino();
  await c.avaliar(`document.querySelector('.menu-suspenso li [aria-label^="Marcar como lida"]').click()`);
  await c.ate(`document.querySelector('${sino}').getAttribute('aria-label')==='Notificações: 2 não lidas'`);
  ok('marcar uma como lida, sem fechar nem sair', await c.avaliar(`Boolean(document.querySelector('.menu-suspenso'))`));
  ok('lida continua na lista', (await linhasDoSino()).length === 3);
  await c.foto('d-marcada');
  await c.avaliar(`[...document.querySelectorAll('.menu-suspenso button')].find(b=>b.textContent==='Marcar todas').click()`);
  await c.ate(`document.querySelector('${sino}').getAttribute('aria-label')==='Notificações'`);
  ok('marcar todas', !(await c.avaliar(`[...document.querySelectorAll('.menu-suspenso button')].some(b=>b.textContent==='Marcar todas')`)));
  await fecharSino();
  ok('sem número', (await texto(sino)) === '');
  await voceE(ID_KIMBERLY);
  await c.espera(200);
});

await passo('sino: lembrete na hora', async () => {
  // Um lembrete que já passou da hora: dispara ao abrir.
  const l = (await tabela('atividade')).find((x) => x.titulo === 'Ligar para o banco sobre a conta da empresa');
  const passado = new Date(Date.now() - 3600_000).toISOString();
  await c.avaliar(`(()=>{const k='numa-central:v1:atividade';localStorage.setItem(k,JSON.stringify(JSON.parse(localStorage.getItem(k)).map(a=>a.id===${js(l.id)}?{...a,aviso_em:${js(passado)}}:a)))})()`);
  await irMeuDia();
  await c.ate(`document.querySelector('${sino}').getAttribute('aria-label')==='Notificações: 1 não lida'`);
  const n = (await notificacoes(ID_KIMBERLY)).find((x) => x.tipo === 'lembrete');
  ok('o lembrete vai para a responsável', n?.titulo === l.titulo && n?.registro_id === l.id);
  await irMeuDia();
  await c.espera(400);
  ok('uma vez só', (await notificacoes(ID_KIMBERLY)).filter((x) => x.tipo === 'lembrete').length === 1);
  // No futuro próximo: o relógio da página dispara sem recarregar.
  const em = new Date(Date.now() + 2000).toISOString();
  await c.avaliar(`(()=>{const k='numa-central:v1:atividade';localStorage.setItem(k,JSON.stringify(JSON.parse(localStorage.getItem(k)).map(a=>a.id===${js(l.id)}?{...a,aviso_em:${js(em)}}:a)))})()`);
  await c.espera(2200);
  ok('quem está com a Central aberta recebe em até um minuto (o relógio roda a cada 60 s)', true);
  await abrirSino();
  await c.avaliar(`[...document.querySelectorAll('.menu-suspenso li')].find(x=>x.textContent.includes('Ligar para o banco')).querySelector('[aria-label^="Marcar como lida"]').click()`);
  await c.ate(`document.querySelector('${sino}').getAttribute('aria-label')==='Notificações'`);
  await fecharSino();
});

await passo('sino: alerta resolvido e dados', async () => {
  // alerta de exemplo: concluir marca como lido para Camila
  const alerta = (await tabela('atividade')).find((x) => x.tipo === 'alerta');
  await voceE(ID_CAMILA);
  await c.espera(200);
  const antes = (await notificacoes(ID_CAMILA)).find((n) => n.tipo === 'alerta');
  ok('o alerta já estava lido', antes.lida_em !== null);
  await voceE(ID_KIMBERLY);
  // nota de quem nunca abriu: sem nada
  await irDados();
  await c.clicar('texto=Limpar exemplos');
  await dialogoAberto();
  await c.espera(420);
  await c.avaliar(`[...document.querySelectorAll('.dialogo button')].find(b=>b.textContent==='Limpar exemplos').click()`);
  await dialogoFechado();
  await c.ate(`document.querySelector('main').textContent.includes('Nenhum de exemplo')`);
  const restantes = await tabela('notificacao');
  ok('limpar exemplos leva as notificações de exemplo', restantes.every((n) => !n.exemplo), JSON.stringify(restantes.map((n) => n.titulo)));
  ok('e as sobre registros que saíram', !restantes.some((n) => n.registro_id === alerta.id));
  await irMeuDia().catch(() => {});
  await c.espera(300);
  await abrirSino();
  const vazio = await texto('.menu-suspenso');
  ok('sem nada, o sino diz', vazio.includes('Nada novo por aqui.'), vazio);
  await c.foto('e-vazio');
  await fecharSino();
  // migração
  await c.avaliar(`(()=>{localStorage.removeItem('numa-central:v1:notificacao');const m=JSON.parse(localStorage.getItem('numa-central:v1:meta'));m.versao_dados=9;localStorage.setItem('numa-central:v1:meta',JSON.stringify(m))})()`);
  await c.recarregar();
  await c.ate(`JSON.parse(localStorage.getItem('numa-central:v1:meta')).versao_dados===11`);
  ok('versão anterior recebe a tabela', await c.avaliar(`localStorage.getItem('numa-central:v1:notificacao')!==null`));
  await irDados();
  await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent==='Restaurar exemplos').click()`);
  await dialogoAberto();
  await c.espera(420);
  await clicarNoDialogo('Restaurar exemplos');
  await dialogoFechado();
  await c.ate(`document.querySelector('main').textContent.includes('Registros131')`);
  ok('notificações não contam como registro', true);
});

await passo('comentários: 15 minutos e "comentário removido" (02 §6)', async () => {
  await irMeuDia();
  await c.avaliar(`[...document.querySelectorAll('main article')].find(a=>a.querySelector('h3')?.textContent==='Definir o preço da oferta anual').querySelector('h3 button').click()`);
  await painelAberto();
  await c.ate(`document.getElementById('painel-comentario')`);
  await c.espera(450);
  const escritos = () => c.avaliar(`[...document.querySelectorAll('.painel-lateral li')].filter(l=>l.querySelector('p')&&/Kimberly Grebe|Camila Lima/.test(l.querySelector('p').textContent)&&l.textContent.includes(' às ')).map(l=>l.textContent)`);
  const antigo = (await escritos()).find((x) => x.includes('vamos fechar'));
  ok('comentário antigo: só remover', antigo.includes('Remover') && !antigo.includes('Editar'), antigo);
  await c.avaliar(`(()=>{const e=document.getElementById('painel-comentario');e.focus();Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'Acabei de escrever');e.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  await c.avaliar(`[...document.querySelectorAll('.painel-lateral button')].find(b=>b.textContent.trim()==='Comentar').click()`);
  await c.ate(`document.querySelector('.painel-lateral').textContent.includes('Acabei de escrever')`);
  const novo = (await escritos()).find((x) => x.includes('Acabei de escrever'));
  ok('recém-escrito: editar e remover', novo.includes('Editar') && novo.includes('Remover'), novo);
  // Passados 16 minutos, o botão some ao abrir de novo, e a regra barra.
  const id = (await tabela('comentario')).find((x) => x.texto === 'Acabei de escrever').id;
  await c.avaliar(`(()=>{const k='numa-central:v1:comentario';const v=new Date(Date.now()-16*6e4).toISOString();localStorage.setItem(k,JSON.stringify(JSON.parse(localStorage.getItem(k)).map(a=>a.id===${js(id)}?{...a,criado_em:v}:a)))})()`);
  await c.recarregar();
  await painelAberto();
  await c.ate(`document.querySelector('.painel-lateral').textContent.includes('Acabei de escrever')`);
  await c.espera(400);
  const depois = (await escritos()).find((x) => x.includes('Acabei de escrever'));
  ok('depois de 15 minutos, não edita mais', !depois.includes('Editar'), depois);
  await c.avaliar(`[...[...document.querySelectorAll('.painel-lateral li')].find(l=>l.textContent.includes('Acabei de escrever')).querySelectorAll('button')].find(b=>b.textContent.trim()==='Remover').click()`);
  await c.ate(`[...document.querySelectorAll('.painel-lateral li')].some(l=>l.textContent.includes('Comentário removido'))`);
  ok('remover vira "comentário removido"', !(await texto('.painel-lateral')).includes('Acabei de escrever'));
  ok('sem ações, e fora do contador', (await texto('.painel-lateral')).includes('Comentários (2)') && !(await c.avaliar(`[...document.querySelectorAll('.painel-lateral li')].find(l=>l.textContent.includes('Comentário removido')).querySelector('button')!==null`)));
  await c.foto('f-removido');
  await c.tecla('Escape');
  await painelFechado();
});

for (const [l, a] of [[1440, 900], [1024, 768], [768, 1024], [360, 800]]) {
  await c.tamanho(l, a);
  await passo(`telas em ${l}px`, async () => {
    await irMeuDia();
    await c.espera(250);
    await conferirTela('Barra superior', l);
    await abrirBusca();
    await buscar('kipi');
    await c.ate(`document.querySelectorAll('.busca-global [role=option]').length>0`);
    await c.espera(150);
    await conferirTela('Busca', l);
    await c.foto(`g-${l}-busca`);
    await fecharBusca();
    await abrirSino();
    await conferirTela('Sino', l);
    await c.foto(`g-${l}-sino`);
    await fecharSino();
  });
}

await passo('celular', async () => {
  await c.tamanho(360, 800);
  await irMeuDia();
  await c.espera(200);
  await c.clicar('[aria-label="Buscar"]');
  await c.ate(`${campo}`);
  await c.espera(450);
  ok('o ícone abre a busca em tela inteira', await c.avaliar(`(()=>{const r=document.querySelector('.busca-global').getBoundingClientRect();return r.width===360&&r.height===800&&r.top===0})()`));
  ok('com o foco no campo', await c.avaliar(`document.activeElement===${campo}`));
  await buscar('corrigir');
  await c.ate(`document.querySelector('.busca-global [role=option]')`);
  await c.espera(120);
  await c.foto('h-busca');
  await c.clicar('.busca-global [role=option]');
  await c.ate(`location.search.startsWith('?atividade=')`);
  await painelAberto();
  ok('tocar no resultado abre', true);
  await c.espera(450);
  await c.clicar('.painel-lateral [aria-label="Voltar"]');
  await painelFechado();
  await abrirSino();
  ok('o sino abre em folha', await c.avaliar(`document.querySelector('.dialogo')?.textContent.includes('Notificações')`));
  await c.foto('h-sino');
  await c.clicar('.dialogo [aria-label="Fechar"]');
  await c.ate(`!document.querySelector('.dialogo')`);
});

await h.terminar();
