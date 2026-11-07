// Verificação da T02.01 (Configurações gerais) no sistema real.
import { mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync, renameSync } from 'node:fs';
import path from 'node:path';
import { abrirChrome } from './cdp.mjs';

const scratch = process.argv[2];
const BASE = process.argv[3] || 'http://localhost:3000';
const fotos = path.join(scratch, 't0201');
const downloads = path.join(scratch, 'baixados-t0201').replaceAll('/', '\\');
const arquivos = path.join(scratch, 'arquivos-teste');
mkdirSync(fotos, { recursive: true });
mkdirSync(arquivos, { recursive: true });
rmSync(downloads, { recursive: true, force: true });
mkdirSync(downloads, { recursive: true });

const c = await abrirChrome({ scratch, porta: 9337, pastaFotos: fotos });
// Sem as rotinas do dia, os números não dependem do dia da semana (ver apoio.mjs).
await c.enviar('Page.addScriptToEvaluateOnNewDocument', { source: `(()=>{try{const k='numa-central:v1:meta';const m=JSON.parse(localStorage.getItem(k)||'{}');if(!m.ultima_rotina_em){m.ultima_rotina_em=new Date().toISOString();localStorage.setItem(k,JSON.stringify(m))}}catch{}})()` });
await c.enviar('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });

const resultados = [];
const ok = (nome, passou, extra) => resultados.push(`${passou ? 'OK   ' : 'FALHA'} ${nome}${extra !== undefined ? ` [${extra}]` : ''}`);
const inicio = Date.now();
async function passo(nome, fn) {
  console.log(`--- ${nome} (${Math.round((Date.now() - inicio) / 1000)}s)`);
  const antes = resultados.length;
  try { await fn(); } catch (e) {
    resultados.push(`ERRO  ${nome}: ${e.message}`);
    try {
      const d = await c.avaliar(`(()=>{const b=document.querySelector('main button[type=submit]');const r=b?.getBoundingClientRect();const e=r&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return JSON.stringify({caminho:location.pathname+location.search,avisos:[...document.querySelectorAll('[data-sonner-toast]')].map(t=>t.textContent),alerta:document.querySelector('main [role=alert]')?.textContent??null,botao:r&&{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),desligado:b.disabled},noPonto:e?(e.tagName+'.'+String(e.className).slice(0,50)):null,abertura:Boolean(document.querySelector('.abertura')),dialogo:Boolean(document.querySelector('.dialogo')),estado:document.querySelector('form')?.textContent.match(/Há alterações sem salvar|Tudo em ordem/)?.[0]??null})})()`);
      console.log('    estado:', d);
      await c.foto(`erro-${nome.replaceAll(/[^a-z0-9]+/gi, '-')}`);
    } catch {}
  }
  for (const r of resultados.slice(antes)) if (r.startsWith('FALHA') || r.startsWith('ERRO')) console.log(r);
}

const js = (v) => JSON.stringify(v);
const texto = (seletor = 'main') => c.avaliar(`document.querySelector(${js(seletor)})?.textContent ?? ''`);
const valor = (id) => c.avaliar(`document.getElementById(${js(id)})?.value`);
const pronta = () => c.ate(`document.getElementById('nome')&&document.getElementById('responsavel')`);
const ultimoAviso = () => c.avaliar(`[...document.querySelectorAll('[data-sonner-toast]')].map(t=>t.textContent).join(' | ')`);
const esperarAviso = (parte) => c.ate(`[...document.querySelectorAll('[data-sonner-toast]')].some(t=>t.textContent.includes(${js(parte)}))`);
const preencher = (id, novo) => c.avaliar(`(()=>{const e=document.getElementById(${js(id)});e.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${js(novo)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`);
const sair = (id) => c.avaliar(`document.getElementById(${js(id)}).blur()`);
const escolher = (id, novo) => c.avaliar(`(()=>{const s=document.getElementById(${js(id)});Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,${js(novo)});s.dispatchEvent(new Event('change',{bubbles:true}))})()`);
const opcoes = (id) => c.avaliar(`[...document.getElementById(${js(id)}).options].map(o=>o.textContent)`);
const erroDe = (id) => c.avaliar(`document.getElementById(${js(id + '-erro')})?.textContent ?? ''`);
const idPorRotulo = (rotulo) => c.avaliar(`[...document.querySelectorAll('.dialogo label')].find(l=>l.textContent.startsWith(${js(rotulo)}))?.htmlFor`);
const erroNoDialogo = (rotulo) => c.avaliar(`(()=>{const l=[...document.querySelectorAll('.dialogo label')].find(x=>x.textContent.startsWith(${js(rotulo)}));return document.getElementById(l.htmlFor+'-erro')?.textContent??''})()`);
const botao = (nome) => c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.includes(${js(nome)}))?.disabled`);
const salvar = async () => { await c.clicar('main button[type=submit]'); };
const dialogoAberto = () => c.ate(`document.querySelector('.dialogo')`);
const dialogoFechado = () => c.ate(`!document.querySelector('.dialogo')`);
const irPara = async (caminho) => { await c.ir(BASE + caminho); };
const historicoDados = async () => {
  await irPara('/configuracoes/dados');
  await c.ate(`document.querySelector('main')?.textContent.includes('Último backup')&&document.querySelector('main ul li')`);
  return c.avaliar(`[...document.querySelectorAll('main ul li')].map(l=>l.textContent)`);
};
const voltarGeral = async () => { await irPara('/configuracoes'); await pronta(); };

await c.tamanho(1440, 900);

await passo('primeira abertura', async () => {
  await irPara('/configuracoes');
  await c.ate(`location.pathname==='/configuracoes'`);
  await c.ate(`document.querySelector('.abertura')`);
  await c.tecla('a');
  await c.ate(`!document.querySelector('.abertura')`);
  await pronta();
  ok('abre em Configurações, na aba Geral', await c.avaliar(`[...document.querySelectorAll('nav[aria-label="Seções de configurações"] a')].find(a=>a.getAttribute('aria-current')==='page')?.textContent==='Geral'`));
  ok('a aba Dados é um link', await c.avaliar(`[...document.querySelectorAll('nav[aria-label="Seções de configurações"] a')].some(a=>a.textContent==='Dados'&&a.getAttribute('href')==='/configuracoes/dados')`));
  ok('nenhuma aba "Em breve"', !(await texto('nav[aria-label="Seções de configurações"]')).includes('Em breve'));
  const m = await texto('main');
  ok('título e resumo', m.includes('Configurações gerais') && m.includes('Uma base bem cuidada. O resto flui.'));
  await c.ate(`document.querySelector('main').textContent.includes('Uso imediato')`);
  ok('selo da fase no cabeçalho', (await texto('main')).includes('Fase 0a') && (await texto('main')).includes('Uso imediato'));
  ok('o título da aba diz a tela', (await c.avaliar(`document.title`)).startsWith('Configurações gerais'));
  await c.espera(300);
  await c.foto('a-1440-topo');
  await c.foto('a-1440-inteira', { inteira: true });
});

await passo('seções e índice', async () => {
  const ids = await c.avaliar(`[...document.querySelectorAll('main section[id]')].map(s=>s.id)`);
  ok('seções na ordem aprovada', ids.join() === 'organizacao,regiao,fase,alertas,financeiro,backup', ids.join());
  const titulos = await c.avaliar(`[...document.querySelectorAll('main section h2')].map(s=>s.textContent)`);
  ok('títulos das seções', titulos.join('|') === 'Organização|Região e calendário|Fase da Numa|Alertas e lembretes|Financeiro|Backup', titulos.join('|'));
  const m = await texto('main');
  ok('só o que é da F0a', !/Encarregado|Canal do titular|Validade padrão de propostas|revisão de acessos|Revisão jurídica|revisão jurídica/i.test(m));
  ok('sem aviso de demonstração do protótipo', !/Demonstração visual|nesta prévia|só nesta visualização/i.test(m));
  const indice = await c.avaliar(`[...document.querySelectorAll('nav[aria-label="Nesta página"] a')].map(a=>a.textContent)`);
  ok('"Nesta página" com as 6 seções', indice.length === 6, indice.join('|'));
  await c.clicar('nav[aria-label="Nesta página"] a[href="#backup"]');
  await c.ate(`location.hash==='#backup'`);
  await c.espera(700);
  ok('o índice leva à seção', await c.avaliar(`(()=>{const t=document.getElementById('backup').getBoundingClientRect().top;return t>=0&&t<innerHeight})()`));
  ok('o índice marca a seção clicada', (await c.avaliar(`document.querySelector('nav[aria-label="Nesta página"] a[aria-current]')?.textContent`)) === 'Backup');
  await c.espera(600);
  await c.avaliar(`document.getElementById('alertas').scrollIntoView({block:'start',behavior:'instant'})`);
  await c.espera(200);
  ok('o índice acompanha a rolagem', (await c.avaliar(`document.querySelector('nav[aria-label="Nesta página"] a[aria-current]')?.textContent`)) === 'Alertas e lembretes');
  await c.avaliar(`window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'})`);
  await c.espera(200);
  ok('no fim da página, marca a última seção', (await c.avaliar(`document.querySelector('nav[aria-label="Nesta página"] a[aria-current]')?.textContent`)) === 'Backup');
  await c.avaliar(`window.scrollTo({top:0,behavior:'instant'})`);
  await c.espera(100);
});

await passo('padrões da especificação', async () => {
  ok('nome: Numa', (await valor('nome')) === 'Numa');
  ok('e-mail vazio, sem inventar', (await valor('email')) === '');
  ok('logotipo vazio', (await valor('logo')) === '');
  ok('fuso: São Paulo', (await valor('fuso')) === 'America/Sao_Paulo');
  ok('moeda: BRL', (await valor('moeda')) === 'BRL');
  ok('estado: RJ', (await valor('uf')) === 'RJ');
  ok('município: Rio de Janeiro', (await valor('municipio')) === 'Rio de Janeiro');
  ok('alertas 3, 15, 3, 45', [await valor('vencimentos'), await valor('renovacao'), await valor('teste'), await valor('dominios')].join() === '3,15,3,45');
  const r = await c.avaliar(`(()=>{const s=document.getElementById('responsavel');return s.options[s.selectedIndex].textContent})()`);
  ok('responsável: Camila Lima', r === 'Camila Lima', r);
  const m = await texto('main');
  ok('regras fixas, sem controle', (m.match(/Regra fixa/g) || []).length === 2 && m.includes('Rateio sempre fecha em 100%') && m.includes('Comprovante obrigatório em todos os pagamentos'));
  ok('câmbio começa vazio', m.includes('Nenhum câmbio informado.'));
  ok('tudo em ordem, nada para descartar', m.includes('Tudo em ordem por aqui.') && (await botao('Descartar')) === true);
});

await passo('listas', async () => {
  const moedas = await opcoes('moeda');
  ok('BRL, USD e EUR no topo, em português', moedas.slice(0, 3).join('|') === 'BRL · Real brasileiro|USD · Dólar americano|EUR · Euro', moedas.slice(0, 3).join('|'));
  ok('as demais vêm do navegador', moedas.length > 100 && moedas.some((m) => m.startsWith('GBP · Libra')), moedas.length);
  ok('sem "moeda desconhecida" nem de teste', !moedas.some((m) => /^(XXX|XTS) /.test(m)));
  ok('grupos da lista', (await c.avaliar(`[...document.querySelectorAll('#moeda optgroup')].map(g=>g.label).join('|')`)) === 'Mais usadas|Todas as moedas');
  const fusos = await opcoes('fuso');
  ok('as 4 zonas oficiais', fusos.length === 4 && fusos[0].includes('Brasília') && fusos.some((f) => f.includes('Manaus')) && fusos.some((f) => f.includes('Rio Branco')) && fusos.some((f) => f.includes('Noronha')), fusos.join('|'));
  const ufs = await opcoes('uf');
  ok('27 estados e "Não informado"', ufs.length === 28 && ufs[0] === 'Não informado' && ufs.includes('Rio de Janeiro · RJ'), ufs.length);
  const rj = await opcoes('municipio');
  ok('os 92 municípios do RJ e "Não informado"', rj.length === 93 && rj.includes('Rio de Janeiro') && rj.includes('Niterói'), rj.length);
  await escolher('uf', 'SP');
  await c.espera(100);
  const sp = await opcoes('municipio');
  ok('ao trocar de estado, a lista muda', sp.includes('Campinas') && !sp.includes('Niterói'), sp.length);
  ok('e o município volta a "Não informado"', (await valor('municipio')) === '');
  ok('agora há o que descartar', (await texto('main')).includes('Há alterações sem salvar.') && (await botao('Descartar')) === false);
  await escolher('municipio', 'Campinas');
  await escolher('uf', '');
  await c.espera(100);
  ok('sem estado, município fica desligado', await c.avaliar(`document.getElementById('municipio').disabled`));
  await c.clicar('texto=Descartar');
  await c.espera(150);
  ok('descartar volta o estado', (await valor('uf')) === 'RJ');
  ok('descartar volta o município, com a lista certa', (await valor('municipio')) === 'Rio de Janeiro' && (await opcoes('municipio')).includes('Niterói'));
  ok('nada a descartar de novo', (await texto('main')).includes('Tudo em ordem por aqui.'));
  const pessoas = await opcoes('responsavel');
  ok('responsável: pessoas internas ativas', pessoas.join('|') === 'Kimberly Grebe|Camila Lima|Bruna Alves', pessoas.join('|'));
});

await passo('validação', async () => {
  await preencher('nome', '   ');
  await sair('nome');
  await c.ate(`document.getElementById('nome-erro')`);
  ok('ao sair do campo: mensagem junto ao campo', (await erroDe('nome')).includes('Informe o nome da organização.'));
  ok('campo marcado como inválido', await c.avaliar(`document.getElementById('nome').getAttribute('aria-invalid')==='true'`));
  await preencher('email', 'contato');
  await preencher('logo', 'https://exemplo.com/logo.png');
  await preencher('vencimentos', '1,5');
  await preencher('dominios', '');
  await sair('dominios');
  await salvar();
  await c.ate(`document.querySelector('main [role=alert]')`);
  await c.espera(500);
  const r = await texto('main [role=alert]');
  ok('resumo no topo, com a contagem', r.startsWith('Faltam ajustar 5 campos.'), r.slice(0, 60));
  ok('uma mensagem para cada erro', ['Informe o nome da organização.', 'Informe um e-mail válido.', 'Use um link de drive.google.com ou docs.google.com.', 'Informe a antecedência de vencimentos, em dias.', 'Informe a antecedência de domínios, em dias.'].every((m) => r.includes(m)));
  ok('o foco vai para o resumo', await c.avaliar(`document.activeElement===document.querySelector('main [role=alert]')`));
  ok('nada foi gravado', !(await ultimoAviso()).includes('salvas'));
  await c.foto('b-erros');
  await c.clicar('main [role=alert] a:nth-of-type(4)');
  await c.espera(100);
  ok('o link do resumo leva ao campo', (await c.avaliar(`document.activeElement.id`)) === 'vencimentos', await c.avaliar(`document.activeElement.id`));
  await preencher('vencimentos', '4');
  await c.ate(`!document.getElementById('vencimentos-erro')`);
  ok('corrigir tira o erro na hora', (await texto('main [role=alert]')).startsWith('Faltam ajustar 4 campos.'));
  await c.clicar('texto=Descartar');
  await c.ate(`!document.querySelector('main [role=alert]')`);
  ok('descartar limpa os erros e os valores', (await valor('nome')) === 'Numa' && (await valor('vencimentos')) === '3' && !(await c.avaliar(`document.getElementById('nome-erro')`)));
});

await passo('link do Drive', async () => {
  ok('sem link, sem botão "Abrir"', !(await c.avaliar(`[...document.querySelectorAll('#organizacao a')].some(a=>a.textContent.includes('Abrir'))`)));
  await preencher('logo', 'https://drive.google.com/file/d/abc/view');
  await c.ate(`[...document.querySelectorAll('#organizacao a')].some(a=>a.textContent.includes('Abrir'))`);
  const a = await c.avaliar(`(()=>{const a=[...document.querySelectorAll('#organizacao a')].find(x=>x.textContent.includes('Abrir'));return {href:a.href,alvo:a.target,rel:a.rel}})()`);
  ok('com link válido, "Abrir" em nova aba', a.href === 'https://drive.google.com/file/d/abc/view' && a.alvo === '_blank' && a.rel.includes('noopener'), JSON.stringify(a));
  ok('lembrete do Drive da Numa', (await texto('#organizacao')).includes('Confirme que o arquivo está no Drive da Numa.'));
  await preencher('logo', 'javascript:alert(1)');
  await c.ate(`![...document.querySelectorAll('#organizacao a')].some(a=>a.textContent.includes('Abrir'))`);
  ok('com link inválido, o botão some', true);
  await c.clicar('texto=Descartar');
  await c.espera(100);
});

await passo('salvar', async () => {
  await preencher('nome', '  Numa Planejada  ');
  await preencher('email', 'contato@numa.com.br');
  await preencher('logo', 'https://drive.google.com/file/d/abc/view');
  await escolher('moeda', 'USD');
  await preencher('vencimentos', '5');
  await escolher('responsavel', '0b7f1c52-3f6e-4a1b-9d2c-5e8a7c4f1a01');
  await c.espera(100);
  await salvar();
  await esperarAviso('Configurações salvas.');
  ok('aviso curto ao salvar', true);
  await c.espera(150);
  ok('volta a "Tudo em ordem"', (await texto('main')).includes('Tudo em ordem por aqui.') && (await botao('Descartar')) === true);
  ok('tira os espaços do nome', (await valor('nome')) === 'Numa Planejada', await valor('nome'));
  await c.recarregar();
  await pronta();
  ok('recarregar mantém', [await valor('nome'), await valor('email'), await valor('moeda'), await valor('vencimentos')].join('|') === 'Numa Planejada|contato@numa.com.br|USD|5');
  await salvar();
  await esperarAviso('Nenhuma alteração para salvar.');
  ok('sem mudança, avisa e não registra', true);
  const h = await historicoDados();
  ok('o histórico diz quem mudou o quê', h.some((l) => l.includes('Kimberly Grebe alterou Moeda padrão: de BRL para USD')) && h.some((l) => l.includes('Kimberly Grebe alterou Vencimentos financeiros: de 3 dias para 5 dias')), h.slice(0, 3).join(' ; '));
  ok('com nomes por extenso', h.some((l) => l.includes('alterou Responsável pelo backup semanal: de Camila Lima para Kimberly Grebe')));
  ok('e o que estava vazio', h.some((l) => l.includes('alterou E-mail institucional: de não informado para contato@numa.com.br')));
  await voltarGeral();
});

await passo('Enter no campo salva', async () => {
  await preencher('nome', 'Numa');
  await c.tecla('Enter');
  await esperarAviso('Configurações salvas.');
  ok('Enter envia o formulário', (await valor('nome')) === 'Numa');
});

await passo('alterações pendentes', async () => {
  await c.espera(5200);
  await preencher('nome', 'Rascunho');
  await c.espera(100);
  ok('fechar a aba avisa', await c.avaliar(`(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented})()`));
  ok('nenhum aviso nativo até aqui', c.dialogosNativos.length === 0, c.dialogosNativos.join());
  await c.recarregar();
  await pronta();
  ok('recarregar com pendências passa pelo aviso do navegador', c.dialogosNativos.includes('beforeunload'), c.dialogosNativos.join());
  ok('quem confirma perde o que não salvou', (await valor('nome')) === 'Numa');
  c.dialogosNativos.length = 0;
  await preencher('nome', 'Rascunho');
  await c.espera(100);
  await c.clicar('nav[aria-label="Seções de configurações"] a[href="/configuracoes/dados"]');
  await dialogoAberto();
  await c.espera(420);
  ok('sair pela aba pede confirmação (P3)', (await texto('.dialogo')).includes('Descartar as alterações?'));
  await c.foto('c-saida');
  await c.clicar('texto=Continuar editando');
  await dialogoFechado();
  ok('continuar editando mantém tudo', (await c.avaliar(`location.pathname`)) === '/configuracoes' && (await valor('nome')) === 'Rascunho');
  await c.clicar('[data-menu-lateral] a[href="/configuracoes"]');
  await c.espera(200);
  ok('o próprio link da tela não pergunta', !(await c.avaliar(`document.querySelector('.dialogo')`)) && (await valor('nome')) === 'Rascunho');
  await c.clicar('nav[aria-label="Seções de configurações"] a[href="/configuracoes/dados"]');
  await dialogoAberto();
  await c.espera(420);
  await c.clicar('texto=Descartar alterações');
  await c.ate(`location.pathname==='/configuracoes/dados'`);
  ok('descartar e sair leva à outra tela', true);
  ok('depois de sair, fechar a aba não avisa', await c.avaliar(`(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return !e.defaultPrevented})()`));
  await voltarGeral();
  ok('o que não foi salvo se perdeu', (await valor('nome')) === 'Numa');
  ok('sem pendências, a navegação é direta', await (async () => {
    await c.clicar('nav[aria-label="Seções de configurações"] a[href="/configuracoes/dados"]');
    await c.ate(`location.pathname==='/configuracoes/dados'`);
    return !(await c.avaliar(`document.querySelector('.dialogo')`));
  })());
  await voltarGeral();
});

await passo('fase: estado inicial', async () => {
  await c.ate(`document.getElementById('fase')`);
  const f = await texto('#fase');
  ok('fase atual e pergunta', f.includes('Fase 0a · Uso imediato') && f.includes('O que temos, quanto custa e o que precisamos fazer?') && f.includes('Fase atual'));
  const trilha = await c.avaliar(`[...document.querySelectorAll('#fase ol li')].map(l=>l.textContent)`);
  ok('trilha das 5 fases', trilha.length === 5 && trilha[4].includes('Integrações'), trilha.join('|'));
  ok('a fase atual está marcada', (await c.avaliar(`document.querySelector('#fase ol li[aria-current=step]').textContent`)).startsWith('0a'));
  ok('não há fase anterior', (await botao('Ainda não há fase anterior')) === true);
  ok('ainda não mudou de fase: sem registro', !f.includes('avançou') && !f.includes('voltou'));
});

await passo('fase: avançar', async () => {
  await preencher('nome', 'Pendente');
  await c.espera(60);
  await c.clicar('texto=Avançar para a Fase 0b');
  await dialogoAberto();
  await c.espera(420);
  const d = await texto('.dialogo');
  ok('confirmação com a fase e a pergunta', d.includes('Avançar para a Fase 0b?') && d.includes('Casa em ordem: Somos sócias de quê'));
  ok('lista as telas da fase', d.includes('Telas desta fase') && d.includes('Empresa: painel, sócias'));
  ok('texto combinado sobre "Em breve"', d.includes('As que ainda não foram construídas continuam com “Em breve”.'));
  ok('sem o texto antigo do protótipo', !d.includes('Telas que serão liberadas') && !d.includes('Nesta prévia'));
  await c.foto('d-avancar');
  await c.clicar('.dialogo button:first-of-type');
  await c.espera(50);
  await dialogoFechado();
  ok('cancelar não muda nada', (await texto('#fase')).includes('Fase 0a · Uso imediato'));
  const emBreveAntes = await c.avaliar(`[...document.querySelectorAll('[data-menu-lateral] [aria-disabled=true]')].length`);
  await c.clicar('texto=Avançar para a Fase 0b');
  await dialogoAberto();
  await c.espera(420);
  await c.avaliar(`[...document.querySelectorAll('.dialogo button')].find(b=>b.textContent==='Avançar para a Fase 0b').click()`);
  await esperarAviso('Agora a Numa está na Fase 0b.');
  await c.espera(200);
  const f = await texto('#fase');
  ok('muda na hora', f.includes('Fase 0b · Casa em ordem'));
  ok('selo acompanha', (await texto('main')).includes('Casa em ordem'));
  ok('registra quem avançou', f.includes('Kimberly Grebe avançou para a Fase 0b'), f.slice(-90));
  ok('o que estava sendo digitado continua lá', (await valor('nome')) === 'Pendente' && (await texto('main')).includes('Há alterações sem salvar.'));
  const emBreveDepois = await c.avaliar(`[...document.querySelectorAll('[data-menu-lateral] [aria-disabled=true]')].length`);
  ok('nenhuma tela não construída foi liberada', emBreveDepois === emBreveAntes && emBreveAntes === 8, `${emBreveAntes}→${emBreveDepois}`);
  ok('a fase já passada fica marcada', await c.avaliar(`document.querySelector('#fase ol li').className.includes('border-indigo')`));
  await c.clicar('texto=Descartar');
  await c.espera(100);
  await c.recarregar();
  await pronta();
  ok('recarregar mantém a fase', (await texto('#fase')).includes('Fase 0b · Casa em ordem') && (await texto('#fase')).includes('avançou para a Fase 0b'));
});

await passo('fase: voltar', async () => {
  await c.clicar('texto=Voltar para a Fase 0a');
  await dialogoAberto();
  await c.espera(420);
  const d = await texto('.dialogo');
  ok('texto combinado ao voltar', d.includes('Nenhum dado é apagado. As telas abaixo voltam a ficar com “Em breve” até a fase avançar de novo.'));
  ok('lista as telas da fase', d.includes('Telas desta fase') && d.includes('Empresa: painel'));
  ok('sem o texto antigo do protótipo', !d.includes('deixam de aparecer'));
  await c.foto('d-voltar');
  await c.avaliar(`[...document.querySelectorAll('.dialogo button')].find(b=>b.textContent==='Voltar para a Fase 0a').click()`);
  await c.ate(`document.querySelector('.dialogo').textContent.includes('Informe o motivo para voltar de fase.')`);
  ok('sem motivo, não volta', (await texto('#fase')).includes('Fase 0b'));
  ok('o foco vai para o motivo', await c.avaliar(`document.activeElement.tagName==='TEXTAREA'`));
  await c.digitar('Ainda faltam telas da 0a');
  await c.avaliar(`[...document.querySelectorAll('.dialogo button')].find(b=>b.textContent==='Voltar para a Fase 0a').click()`);
  await esperarAviso('A Numa voltou para a Fase 0a. Nenhum dado foi apagado.');
  await c.espera(200);
  const f = await texto('#fase');
  ok('voltou', f.includes('Fase 0a · Uso imediato'));
  ok('registra o motivo', f.includes('Kimberly Grebe voltou para a Fase 0a. Motivo: Ainda faltam telas da 0a'), f.slice(-110));
  ok('não apagou nada', (await valor('email')) === 'contato@numa.com.br');
  const h = await historicoDados();
  ok('fases no histórico', h.some((l) => l.includes('avançou para a Fase 0b')) && h.some((l) => l.includes('voltou para a Fase 0a. Motivo: Ainda faltam telas da 0a')));
  await voltarGeral();
});

await passo('fase: última', async () => {
  await c.avaliar(`(()=>{const k='numa-central:v1:configuracao';const l=JSON.parse(localStorage.getItem(k));l.find(x=>x.chave==='fase_ativa').valor='f3';localStorage.setItem(k,JSON.stringify(l))})()`);
  await c.recarregar();
  await pronta();
  ok('na última fase, não há o que avançar', (await botao('Já está na última fase')) === true && (await botao('Voltar para a Fase 2')) === false);
  ok('mesmo na F3, os módulos não construídos seguem "Em breve"', (await c.avaliar(`[...document.querySelectorAll('[data-menu-lateral] [aria-disabled=true]')].length`)) === 8);
  await c.avaliar(`(()=>{const k='numa-central:v1:configuracao';const l=JSON.parse(localStorage.getItem(k));l.find(x=>x.chave==='fase_ativa').valor='f0a';localStorage.setItem(k,JSON.stringify(l))})()`);
  await c.recarregar();
  await pronta();
});

await passo('câmbio', async () => {
  await c.clicar('#financeiro button');
  await dialogoAberto();
  await c.espera(420);
  await c.foto('e-cambio');
  ok('moeda sem o real, com USD e EUR no topo', (await c.avaliar(`[...document.querySelector('.dialogo select').options].slice(0,2).map(o=>o.value).join()`)) === 'USD,EUR' && !(await c.avaliar(`[...document.querySelector('.dialogo select').options].some(o=>o.value==='BRL')`)));
  await c.clicar('texto=Adicionar câmbio');
  await c.ate(`document.querySelector('.dialogo').textContent.includes('Informe a cotação em reais.')`);
  ok('cotação e data obrigatórias', (await erroNoDialogo('Cotação')).includes('Informe a cotação em reais.') && (await erroNoDialogo('Data')).includes('Informe a data de referência.'));
  ok('enviar o câmbio não dispara o salvar da página', !(await ultimoAviso()).includes('Nenhuma alteração') && !(await ultimoAviso()).includes('salvas'));
  const cot = await idPorRotulo('Cotação');
  await preencher(cot, 'cinco');
  await c.ate(`document.querySelector('.dialogo').textContent.includes('Use só números, como 0,00.')`);
  ok('cotação só com números', true);
  await preencher(cot, '0');
  await c.ate(`document.querySelector('.dialogo').textContent.includes('A cotação precisa ser maior que zero.')`);
  ok('cotação maior que zero', true);
  await preencher(cot, '5,42');
  await c.clicar('.dialogo button.min-h-11:not([type=submit])');
  await c.espera(60);
  const data = await idPorRotulo('Data');
  ok('"Hoje" preenche a data no fuso configurado', (await valor(data)) === (await c.avaliar(`new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date())`)), await valor(data));
  await preencher(await idPorRotulo('Fonte'), 'Banco Central');
  await c.tecla('Enter');
  await esperarAviso('Câmbio de USD adicionado.');
  await dialogoFechado();
  ok('Enter adiciona, sem salvar a página', !(await ultimoAviso()).includes('Configurações salvas'));
  await c.ate(`document.querySelector('#financeiro table tbody tr')`);
  const linha = await c.avaliar(`[...document.querySelectorAll('#financeiro table tbody tr td')].map(t=>t.textContent).slice(0,4).join('|')`);
  const hoje = await c.avaliar(`new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo'}).format(new Date())`);
  ok('a linha aparece formatada', linha === `USD|R$ 5,42|${hoje}|Banco Central`, linha);
  ok('o vazio some', !(await texto('#financeiro')).includes('Nenhum câmbio informado.'));
  ok('o foco volta ao botão', await c.avaliar(`document.activeElement.textContent.includes('Adicionar')`));
  await c.foto('e-linha');
  await c.recarregar();
  await pronta();
  ok('recarregar mantém o câmbio', await c.avaliar(`document.querySelector('#financeiro table tbody tr td').textContent==='USD'`));
  // repetida
  await c.clicar('#financeiro button');
  await dialogoAberto();
  await c.espera(420);
  ok('o formulário abre limpo', (await valor(await idPorRotulo('Cotação'))) === '');
  await preencher(await idPorRotulo('Cotação'), '6');
  await preencher(await idPorRotulo('Data'), await c.avaliar(`new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date())`));
  await c.clicar('texto=Adicionar câmbio');
  await c.ate(`document.querySelector('.dialogo').textContent.includes('Já existe essa moeda nessa data.')`);
  ok('mesma moeda na mesma data não entra', (await c.avaliar(`document.querySelectorAll('#financeiro table tbody tr').length`)) === 1);
  await c.ate(`document.activeElement.type==='date'`);
  ok('o foco vai para a data', true);
  await c.tecla('Escape');
  await dialogoFechado();
  ok('Esc fecha o diálogo', true);
  // remover
  await c.espera(100);
  await c.clicar('#financeiro table button[aria-label^="Remover USD"]');
  await dialogoAberto();
  await c.espera(420);
  const conf = await texto('.dialogo');
  ok('remover pede confirmação e diz o que acontece', conf.includes('Remover este câmbio?') && conf.includes('sai da lista') && conf.includes('continua no histórico'), conf.slice(0, 120));
  await c.foto('e-remover');
  await c.avaliar(`[...document.querySelectorAll('.dialogo button')].find(b=>b.textContent==='Remover câmbio').click()`);
  await esperarAviso('removido.');
  await c.ate(`document.querySelector('#financeiro').textContent.includes('Nenhum câmbio informado.')`);
  ok('sai da lista', true);
  await c.espera(500);
  ok('o foco não se perde', await c.avaliar(`document.activeElement?.textContent?.includes('Adicionar')`), await c.avaliar(`document.activeElement?.tagName`));
  ok('continua guardado como arquivado', await c.avaliar(`JSON.parse(localStorage.getItem('numa-central:v1:cambio_referencia'))[0].arquivado_em!==null`));
  const h = await historicoDados();
  ok('histórico do câmbio', h.some((l) => l.includes('adicionou o câmbio de USD de')) && h.some((l) => l.includes('removeu o câmbio de USD de')), h.slice(0, 2).join(' ; '));
  ok('câmbio removido não conta como registro', (await texto('main')).includes('Registros151'));
  await voltarGeral();
});

await passo('fuso', async () => {
  await escolher('fuso', 'America/Rio_Branco');
  await c.espera(60);
  await salvar();
  await esperarAviso('Configurações salvas.');
  await c.clicar('#financeiro button');
  await dialogoAberto();
  await c.espera(420);
  await c.clicar('.dialogo button.min-h-11:not([type=submit])');
  await c.espera(60);
  const esperado = await c.avaliar(`new Intl.DateTimeFormat('en-CA',{timeZone:'America/Rio_Branco'}).format(new Date())`);
  ok('"hoje" passa a seguir o novo fuso (RT-06)', (await valor(await idPorRotulo('Data'))) === esperado, `${await valor(await idPorRotulo('Data'))} / ${esperado}`);
  await c.tecla('Escape');
  await dialogoFechado();
  await c.ir(BASE + '/configuracoes?abertura=1');
  await c.ate(`document.querySelector('.abertura')`);
  await c.tecla('a');
  await c.ate(`!document.querySelector('.abertura')`);
  ok('a abertura conta o dia no mesmo fuso', (await c.avaliar(`JSON.parse(localStorage.getItem('numa-central:v1:meta')).ultima_abertura`)) === esperado);
  await irPara('/configuracoes');
  await c.espera(300);
  ok('e não repete no mesmo dia desse fuso', await c.avaliar(`!document.querySelector('.abertura')&&!document.documentElement.hasAttribute('data-abertura')`));
  await pronta();
  await escolher('fuso', 'America/Sao_Paulo');
  await c.espera(60);
  await salvar();
  await esperarAviso('Configurações salvas.');
});

await passo('responsável fora da lista', async () => {
  await c.espera(5200);
  await escolher('responsavel', '2d9f3e74-5b8a-4c3d-9f4e-7a0c9e6b3c03');
  await c.espera(60);
  await salvar();
  await esperarAviso('Configurações salvas.');
  ok('dá para escolher Bruna', (await valor('responsavel')) === '2d9f3e74-5b8a-4c3d-9f4e-7a0c9e6b3c03');
  await irPara('/configuracoes/dados');
  await c.ate(`document.querySelector('main').textContent.includes('51 de exemplo')`);
  await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent==='Limpar exemplos').click()`);
  await dialogoAberto();
  await c.espera(420);
  await c.avaliar(`[...document.querySelectorAll('.dialogo button')].find(b=>b.textContent==='Limpar exemplos').click()`);
  await c.ate(`document.querySelector('main').textContent.includes('Registros100')`);
  await voltarGeral();
  await c.ate(`document.getElementById('backup').textContent.includes('não está mais na lista')`);
  ok('a tela avisa, sem trocar sozinha', (await valor('responsavel')) === '' && (await texto('#backup')).includes('A pessoa responsável pelo backup não está mais na lista. Escolha outra.'));
  ok('o dado salvo continua o mesmo', await c.avaliar(`JSON.parse(localStorage.getItem('numa-central:v1:configuracao')).find(x=>x.chave==='responsavel_backup_id').valor==='2d9f3e74-5b8a-4c3d-9f4e-7a0c9e6b3c03'`));
  ok('Bruna saiu da lista', !(await opcoes('responsavel')).includes('Bruna Alves'));
  await c.foto('f-fora-da-lista');
  await salvar();
  await c.ate(`document.querySelector('main [role=alert]')`);
  ok('salvar pede que escolha', (await texto('main [role=alert]')).includes('Escolha a pessoa responsável pelo backup.'));
  await escolher('responsavel', '1c8e2d63-4a7f-4b2c-8e3d-6f9b8d5a2b02');
  await c.espera(100);
  await salvar();
  await esperarAviso('Configurações salvas.');
  await c.espera(150);
  ok('escolhendo outra, o aviso some', !(await texto('#backup')).includes('não está mais na lista'));
  const h = await historicoDados();
  ok('o histórico não quebra sem a pessoa', h.some((l) => l.includes('alterou Responsável pelo backup semanal: de pessoa removida para Camila Lima')), h.slice(0, 2).join(' ; '));
});

await passo('restaurar exemplos', async () => {
  await irPara('/configuracoes/dados');
  await c.ate(`document.querySelector('main').textContent.includes('Último backup')`);
  await c.espera(200);
  await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent==='Restaurar exemplos').click()`);
  await dialogoAberto();
  await c.espera(420);
  await c.avaliar(`[...document.querySelectorAll('.dialogo button')].find(b=>b.textContent==='Restaurar exemplos').click()`);
  await c.ate(`document.querySelector('main').textContent.includes('Registros151')`);
  await voltarGeral();
  ok('tudo volta aos padrões', [await valor('nome'), await valor('email'), await valor('moeda'), await valor('vencimentos'), await valor('responsavel')].join('|') === 'Numa||BRL|3|1c8e2d63-4a7f-4b2c-8e3d-6f9b8d5a2b02');
  ok('câmbio vazio de novo', (await texto('#financeiro')).includes('Nenhum câmbio informado.'));
  ok('fase inicial', (await texto('#fase')).includes('Fase 0a') && !(await texto('#fase')).includes('avançou'));
});

await passo('quem já tinha dados da versão anterior', async () => {
  await c.avaliar(`(()=>{localStorage.removeItem('numa-central:v1:configuracao');localStorage.removeItem('numa-central:v1:cambio_referencia');const m=JSON.parse(localStorage.getItem('numa-central:v1:meta'));m.versao_dados=1;localStorage.setItem('numa-central:v1:meta',JSON.stringify(m));const k='numa-central:v1:pessoa';const l=JSON.parse(localStorage.getItem(k));l[2].funcao='Dado que precisa continuar';localStorage.setItem(k,JSON.stringify(l))})()`);
  await c.recarregar();
  await pronta();
  ok('as configurações entram com os padrões', (await valor('nome')) === 'Numa' && (await c.avaliar(`JSON.parse(localStorage.getItem('numa-central:v1:meta')).versao_dados`)) === 16);
  ok('o que já existia continua', await c.avaliar(`JSON.parse(localStorage.getItem('numa-central:v1:pessoa'))[2].funcao==='Dado que precisa continuar'`));
  const h = await historicoDados();
  ok('fica no histórico', h[0]?.includes('Sistema atualizou os dados para a nova versão da Central'), h[0]);
});

await passo('backup anterior às configurações', async () => {
  const velho = await c.avaliar(`(()=>{const t=['pessoa','backup_registro','auditoria'];const tabelas={};for(const n of t)tabelas[n]=JSON.parse(localStorage.getItem('numa-central:v1:'+n));return JSON.stringify({formato:'central-numa',versao_dados:1,exportado_em:new Date().toISOString(),exportado_por:null,contadores:{},tabelas})})()`);
  const arquivo = path.join(arquivos, 'versao-1.json');
  writeFileSync(arquivo, velho);
  await c.enviarArquivo('main input[type=file]', arquivo.replaceAll('/', '\\'));
  await c.ate(`document.querySelector('.dialogo table')`);
  await c.espera(420);
  const d = await texto('.dialogo');
  ok('é aceito e avisa', d.includes('Configurações') && d.includes('voltam aos valores iniciais') && d.includes('Câmbio de referência'), d.slice(-200));
  await c.foto('g-backup-antigo');
  await c.clicar('texto=Voltar');
  await dialogoFechado();
});

await passo('dados danificados', async () => {
  await c.avaliar(`localStorage.setItem('numa-central:v1:configuracao','{danificado')`);
  await irPara('/configuracoes');
  await c.ate(`document.querySelector('main').textContent.includes('Não deu para ler as configurações.')`);
  ok('a tela explica e aponta a saída', (await texto('main')).includes('na aba Dados'));
  ok('a aba Dados continua à mão', await c.avaliar(`Boolean(document.querySelector('nav[aria-label="Seções de configurações"] a[href="/configuracoes/dados"]'))`));
  await c.foto('h-danificado');
  await c.clicar('nav[aria-label="Seções de configurações"] a[href="/configuracoes/dados"]');
  await c.ate(`location.pathname==='/configuracoes/dados'`);
  await c.ate(`[...document.querySelectorAll('main button')].some(b=>b.textContent==='Restaurar exemplos')`);
  await c.espera(300);
  await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent==='Restaurar exemplos').click()`);
  await dialogoAberto();
  await c.espera(420);
  await c.avaliar(`[...document.querySelectorAll('.dialogo button')].find(b=>b.textContent==='Restaurar exemplos').click()`);
  await dialogoFechado();
  await voltarGeral();
  ok('restaurar recupera', (await valor('nome')) === 'Numa');
});

await passo('carregando', async () => {
  // Sem dados ainda: o esqueleto dura um instante, mas não pode haver tela em branco nem salto de erro.
  await irPara('/configuracoes');
  await pronta();
  ok('sem erro depois de carregar', !(await texto('main')).includes('Não deu para'));
});

const MEDIR = `(()=>{const cs=e=>getComputedStyle(e);const vis=e=>{const b=e.getBoundingClientRect();return b.width>1&&b.height>1&&cs(e).visibility!=='hidden'};const r={larguraJanela:innerWidth,rolagemLateral:document.documentElement.scrollWidth>innerWidth};
const menor=[];document.querySelectorAll('body *').forEach(e=>{if(vis(e)&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())){const s=parseFloat(cs(e).fontSize);if(s<12)menor.push(s+':'+e.textContent.trim().slice(0,24))}});r.textoAbaixo12=menor;
const alvos=[];document.querySelectorAll('a,button:not(:disabled),select:not(:disabled),input:not(:disabled):not([type=file]),[role=tab]').forEach(e=>{if(vis(e)&&e.getAttribute('href')!=='#conteudo'){const b=e.getBoundingClientRect();if(b.height<44||b.width<44)alvos.push((e.textContent.trim().slice(0,20)||e.getAttribute('aria-label')||e.id)+' '+Math.round(b.width)+'x'+Math.round(b.height))}});r.alvosAbaixo44=alvos;
const c16=[];document.querySelectorAll('input:not([type=file]),select,textarea').forEach(e=>{if(vis(e)&&parseFloat(cs(e).fontSize)<16)c16.push((e.id||e.getAttribute('aria-label'))+':'+cs(e).fontSize)});r.camposAbaixo16=c16;return r})()`;

for (const [l, a] of [[1440, 900], [1024, 768], [768, 1024], [360, 800]]) {
  await c.tamanho(l, a);
  await passo(`tela em ${l}px`, async () => {
    await voltarGeral();
    await c.espera(300);
    const m = await c.avaliar(MEDIR);
    if (l >= 768) { delete m.alvosAbaixo44; delete m.camposAbaixo16; }
    resultados.push(`  medida ${l}: ${JSON.stringify(m)}`);
    ok(`sem rolagem lateral em ${l}px`, !m.rolagemLateral && m.larguraJanela === l, m.larguraJanela);
    ok(`nada abaixo de 12px em ${l}px`, m.textoAbaixo12.length === 0, m.textoAbaixo12.join(','));
    if (l < 768) {
      ok(`alvos de 44px em ${l}px`, m.alvosAbaixo44.length === 0, m.alvosAbaixo44.join(' | '));
      ok(`campos de 16px em ${l}px`, m.camposAbaixo16.length === 0, m.camposAbaixo16.join(','));
    }
    const indice = await c.avaliar(`document.querySelector('nav[aria-label="Nesta página"]').getBoundingClientRect().width>0`);
    ok(`índice ${l >= 1024 ? 'visível' : 'oculto'} em ${l}px`, indice === (l >= 1024));
    await c.foto(`i-${l}-topo`);
    await c.foto(`i-${l}-inteira`, { inteira: true });
  });
}

await passo('celular', async () => {
  await c.tamanho(360, 800);
  await voltarGeral();
  await c.espera(250);
  const altura = await c.avaliar(`document.documentElement.scrollHeight`);
  for (let y = 0, i = 0; y < altura; y += 700, i++) {
    await c.avaliar(`window.scrollTo({top:${y},behavior:'instant'})`);
    await c.espera(60);
    await c.foto(`j-${i}`);
  }
  await c.avaliar(`window.scrollTo({top:600,behavior:'instant'})`);
  await c.espera(100);
  const barra = await c.avaliar(`(()=>{const b=document.querySelector('main button[type=submit]').getBoundingClientRect();const nav=document.querySelector('nav[aria-label="Navegação principal"]')?.getBoundingClientRect();return {base:Math.round(b.bottom),topoNav:nav?Math.round(nav.top):null,visivel:b.top>=0&&b.bottom<=innerHeight}})()`);
  ok('salvar fica à mão no celular', barra.visivel, JSON.stringify(barra));
  // câmbio com linha, em cartão
  await c.clicar('#financeiro button');
  await dialogoAberto();
  await c.espera(450);
  await c.foto('j-cambio');
  const d = await c.avaliar(`(()=>{const b=document.querySelector('.dialogo').getBoundingClientRect();return {base:Math.round(b.bottom),larg:b.width}})()`);
  ok('câmbio em folha inferior', d.base === 800 && d.larg === 360, JSON.stringify(d));
  await preencher(await idPorRotulo('Cotação'), '5,123456');
  await preencher(await idPorRotulo('Data'), '2026-11-05');
  await c.clicar('texto=Adicionar câmbio');
  await c.ate(`document.querySelector('#financeiro ul li dl')`);
  await dialogoFechado();
  await c.espera(100);
  const cartao = await texto('#financeiro ul li');
  ok('no celular, a linha vira cartão', cartao.includes('R$ 5,123456') && cartao.includes('05/11/2026') && cartao.includes('Não informada'), cartao);
  await c.avaliar(`document.querySelector('#financeiro ul li').scrollIntoView({block:'center',behavior:'instant'})`);
  await c.espera(100);
  await c.foto('j-cartao');
  await c.clicar('#financeiro ul button[aria-label^="Remover"]');
  await dialogoAberto();
  await c.espera(420);
  await c.avaliar(`[...document.querySelectorAll('.dialogo button')].find(b=>b.textContent==='Remover câmbio').click()`);
  await dialogoFechado();
  // sair com pendência pelo "Mais"
  await preencher('nome', 'Pendente no celular');
  await c.espera(60);
  await c.clicar('texto=Mais');
  await c.ate(`document.querySelector('.dialogo #voce-e-celular')`);
  await c.espera(450);
  const temLink = await c.avaliar(`Boolean(document.querySelector('.dialogo a[href="/configuracoes"]'))`);
  ok('o "Mais" abre com pendências', temLink);
  await c.tecla('Escape');
  await dialogoFechado();
  await c.clicar('texto=Descartar');
  await c.espera(100);
  // fase no celular
  await c.clicar('texto=Avançar para a Fase 0b');
  await dialogoAberto();
  await c.espera(450);
  await c.foto('j-fase');
  const cabe = await c.avaliar(`(()=>{const d=document.querySelector('.dialogo');const b=[...d.querySelectorAll('button')].at(-1);b.scrollIntoView({block:'nearest'});const r=b.getBoundingClientRect();return r.bottom<=800&&r.height>=44})()`);
  ok('o diálogo de fase cabe na folha', cabe);
  await c.tecla('Escape');
  await dialogoFechado();
});

await c.tamanho(1440, 900);
await passo('teclado', async () => {
  await voltarGeral();
  await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.includes('Avançar para a Fase')).focus()`);
  await c.tecla('Enter');
  await dialogoAberto();
  ok('abre a fase pelo teclado', true);
  await c.tecla('Escape');
  await dialogoFechado();
  await c.espera(100);
  ok('Esc fecha e o foco volta ao botão', await c.avaliar(`document.activeElement.textContent.includes('Avançar para a Fase')`));
  ok('rótulos em todos os campos (RT-19)', await c.avaliar(`[...document.querySelectorAll('main input:not([type=file]),main select')].every(e=>e.labels?.length>0||e.getAttribute('aria-label'))`));
});

const falhas = resultados.filter((r) => !r.startsWith('OK') && !r.startsWith('  '));
console.log(resultados.join('\n'));
console.log(`\n=== ${resultados.filter((r) => r.startsWith('OK')).length} OK, ${falhas.length} com problema`);
console.log('=== console:', c.erros.length ? '\n' + [...new Set(c.erros)].join('\n') : 'sem erros nem avisos');
await c.fechar();
process.exit(0);
