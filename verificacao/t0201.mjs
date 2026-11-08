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
      const d = await c.avaliar(`(()=>{const b=document.querySelector('main button[type=submit]');const r=b?.getBoundingClientRect();const e=r&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return JSON.stringify({caminho:location.pathname+location.search,avisos:[...document.querySelectorAll('[data-sonner-toast]')].map(t=>t.textContent),alerta:document.querySelector('main [role=alert]')?.textContent??null,botao:r&&{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),desligado:b.disabled},noPonto:e?(e.tagName+'.'+String(e.className).slice(0,50)):null,abertura:Boolean(document.querySelector('.abertura')),dialogo:Boolean(document.querySelector('.dialogo')),estado:document.querySelector('main form p[role=status]')?.textContent??null})})()`);
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
const aba = (id) => `[role=tablist] [role=tab][id$="-trigger-${id}"]`;
const irSecao = async (id) => { await c.clicar(aba(id)); await c.ate(`document.getElementById(${js(id)})?.offsetParent`); };
const secaoAberta = () => c.avaliar(`[...document.querySelectorAll('[role=tabpanel] > section')].filter(s=>s.offsetParent).map(s=>s.id).join()`);
const textoDaAba = (id) => c.avaliar(`document.querySelector(${js(aba(id))})?.textContent ?? ''`);
const estadoDaBarra = () => c.avaliar(`document.querySelector('main form p[role=status]')?.textContent ?? ''`);
const focado = () => c.avaliar(`document.activeElement?.id ?? ''`);
const guardado = (chave) => c.avaliar(`JSON.parse(localStorage.getItem('numa-central:v1:configuracao')).find(x=>x.chave===${js(chave)}).valor`);
const SECOES = ['organizacao', 'alertas', 'financeiro', 'legal', 'backup'];

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
  ok('título e resumo', m.includes('Configurações gerais') && m.includes('Dados e preferências da Central Numa.'));
  ok('sem selo de fase no cabeçalho (decisão de 08/11/2026)', !(await texto('main')).includes('Uso imediato'));
  ok('o título da aba diz a tela', (await c.avaliar(`document.title`)).startsWith('Configurações gerais'));
  await c.espera(300);
  await c.foto('a-1440-topo');
  await c.foto('a-1440-inteira', { inteira: true });
});

await passo('navegação por seções', async () => {
  const abas = await c.avaliar(`[...document.querySelectorAll('[role=tablist] [role=tab]')].map(a=>a.textContent)`);
  ok('as 5 seções, na ordem: sem Fase da Numa (decisão de 08/11/2026)', abas.join('|') === 'Organização e região|Alertas|Financeiro|Legal e comercial|Backup', abas.join('|'));
  ok('começa em Organização e região', (await secaoAberta()) === 'organizacao');
  ok('o índice "Nesta página" saiu', !(await c.avaliar(`Boolean(document.querySelector('nav[aria-label="Nesta página"]'))`)));
  const grupos = await c.avaliar(`[...document.querySelectorAll('#organizacao h3')].map(h=>h.textContent)`);
  ok('dois grupos em Organização e região', grupos.join('|') === 'Organização|Região e calendário', grupos.join('|'));
  const rotulos = await c.avaliar(`[...document.querySelectorAll('#organizacao label')].map(l=>l.textContent)`);
  ok('os campos da proposta', rotulos.join('|') === 'Nome da organização *|E-mail institucional|Link do logotipo no Drive|Fuso horário *|Moeda padrão *|UF|Município', rotulos.join('|'));
  const m = await c.avaliar(`(()=>{const k=document.querySelector('main').cloneNode(true);k.querySelector('#legal')?.remove();return k.textContent})()`);
  ok('fora de Legal e comercial, só o que é da F0a', !/Encarregado|Canal do titular|Validade padrão de propostas|revisão de acessos|Revisão jurídica|revisão jurídica/i.test(m));
  ok('sem aviso de demonstração do protótipo', !/Demonstração visual|nesta prévia|só nesta visualização/i.test(m));
  for (const [id, titulo] of [['alertas', 'Alertas'], ['financeiro', 'Financeiro'], ['backup', 'Backup'], ['organizacao', 'Organização e região']]) {
    await irSecao(id);
    ok(`${titulo}: só ela à vista`, (await secaoAberta()) === id, await secaoAberta());
    ok(`${titulo}: título e aba marcada`, (await texto(`#${id} h2`)) === titulo && (await c.avaliar(`document.querySelector(${js(aba(id))}).getAttribute('aria-selected')`)) === 'true');
    ok(`${titulo}: o endereço acompanha`, (await c.avaliar(`location.hash`)) === `#${id}`);
  }
  ok('com o mouse, sem contorno de foco na seção', await c.avaliar(`document.activeElement.getAttribute('role')==='tab'&&!document.activeElement.matches(':focus-visible')`));
  await c.avaliar(`location.hash='#alertas'`);
  await c.recarregar();
  await pronta();
  ok('recarregar fica na mesma seção', (await secaoAberta()) === 'alertas');
  await irSecao('backup');
  await c.avaliar(`history.back()`);
  await c.ate(`location.hash==='#alertas'`);
  await c.ate(`document.getElementById('alertas').offsetParent`);
  ok('o voltar do navegador passa pelas seções, sem sair da tela', (await c.avaliar(`location.pathname`)) === '/configuracoes' && (await secaoAberta()) === 'alertas');
  await irSecao('backup');
  ok('Backup configura a responsável; exportar e importar seguem em Dados', await c.avaliar(`Boolean(document.querySelector('#backup a[href="/configuracoes/dados"]'))&&!document.querySelector('#backup input[type=file]')`));
  await irSecao('organizacao');
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
  ok('o câmbio aponta para Contas e saldos', m.includes('O câmbio de referência fica em'));
  ok('sem alterações: nenhum aviso e ações desligadas', (await estadoDaBarra()) === '' && (await botao('Descartar')) === true && (await botao('Salvar alterações')) === true);
  ok('obrigatórios explicados junto às ações', (await texto('main form')).includes('Campos com * são obrigatórios.'));
  ok('"Não informado" é só indicação visual', (await c.avaliar(`document.getElementById('email').placeholder`)) === 'Não informado' && (await c.avaliar(`document.getElementById('logo').placeholder`)) === 'Não informado');
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
  ok('agora há o que descartar', (await estadoDaBarra()) === 'Alterações não salvas' && (await botao('Descartar')) === false && (await botao('Salvar alterações')) === false);
  await escolher('municipio', 'Campinas');
  await escolher('uf', '');
  await c.espera(100);
  ok('sem estado, município fica desligado', await c.avaliar(`document.getElementById('municipio').disabled`));
  ok('e a tela diz por quê', (await texto('#organizacao')).includes('Escolha a UF para ver os municípios.'));
  await c.clicar('texto=Descartar');
  await c.espera(150);
  ok('descartar volta o estado', (await valor('uf')) === 'RJ');
  ok('descartar volta o município, com a lista certa', (await valor('municipio')) === 'Rio de Janeiro' && (await opcoes('municipio')).includes('Niterói'));
  ok('nada a descartar de novo', (await estadoDaBarra()) === '' && (await botao('Salvar alterações')) === true);
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
  ok('uma mensagem para cada erro, com a seção', ['Organização e região: Informe o nome da organização.', 'Organização e região: Informe um e-mail válido.', 'Organização e região: Use um link de drive.google.com ou docs.google.com.', 'Alertas: Informe a antecedência de vencimentos, em dias.', 'Alertas: Informe a antecedência de domínios, em dias.'].every((m) => r.includes(m)), r);
  ok('com erro na seção aberta, fica nela e o foco vai para o campo', (await secaoAberta()) === 'organizacao' && (await focado()) === 'nome', await focado());
  ok('a navegação marca as seções com erro', (await textoDaAba('organizacao')).includes('3 campos para ajustar') && (await textoDaAba('alertas')).includes('2 campos para ajustar') && !(await textoDaAba('backup')).includes('ajustar'));
  ok('nada foi gravado', !(await ultimoAviso()).includes('salvas'));
  await c.foto('b-erros');
  await c.clicar('main [role=alert] a:nth-of-type(4)');
  await c.espera(100);
  ok('o link do resumo abre a seção e leva ao campo', (await secaoAberta()) === 'alertas' && (await focado()) === 'vencimentos', await focado());
  await preencher('vencimentos', '4');
  await c.ate(`!document.getElementById('vencimentos-erro')`);
  ok('corrigir tira o erro na hora', (await texto('main [role=alert]')).startsWith('Faltam ajustar 4 campos.'));
  await c.clicar('texto=Descartar');
  await c.ate(`!document.querySelector('main [role=alert]')`);
  ok('descartar limpa os erros e os valores', (await valor('nome')) === 'Numa' && (await valor('vencimentos')) === '3' && !(await c.avaliar(`document.getElementById('nome-erro')`)));
  ok('e as marcas da navegação', !(await textoDaAba('organizacao')).includes('ajustar') && !(await textoDaAba('alertas')).includes('ajustar'));
});

await passo('erro em seção que não está aberta', async () => {
  await irSecao('backup');
  await preencher('nome', '');
  await preencher('dominios', 'abc');
  await c.espera(60);
  await preencher('nome', '');
  await escolher('responsavel', '0b7f1c52-3f6e-4a1b-9d2c-5e8a7c4f1a01');
  await c.espera(60);
  await salvar();
  await c.ate(`document.querySelector('main [role=alert]')`);
  await c.ate(`document.getElementById('organizacao').offsetParent`);
  await c.espera(100);
  ok('abre a seção do primeiro erro e põe o foco no campo', (await secaoAberta()) === 'organizacao' && (await focado()) === 'nome', `${await secaoAberta()} ${await focado()}`);
  const r = await texto('main [role=alert]');
  ok('o resumo identifica as duas seções', r.includes('Organização e região: Informe o nome') && r.includes('Alertas: Informe a antecedência de domínios'), r);
  ok('a outra seção continua marcada', (await textoDaAba('alertas')).includes('1 campo para ajustar'));
  ok('nada foi gravado', (await guardado('responsavel_backup_id')) !== '0b7f1c52-3f6e-4a1b-9d2c-5e8a7c4f1a01');
  await c.foto('b-erro-em-outra-secao');
  await preencher('nome', 'Numa');
  await c.ate(`!document.getElementById('nome-erro')`);
  await salvar();
  await c.ate(`document.getElementById('alertas').offsetParent`);
  await c.espera(100);
  ok('corrigido um, salvar leva ao erro que restou', (await secaoAberta()) === 'alertas' && (await focado()) === 'dominios', `${await secaoAberta()} ${await focado()}`);
  await c.clicar('texto=Descartar');
  await c.ate(`!document.querySelector('main [role=alert]')`);
  ok('descartar volta todas as seções', (await valor('dominios')) === '45' && (await valor('responsavel')) === (await guardado('responsavel_backup_id')));
  await irSecao('organizacao');
});

await passo('link do Drive', async () => {
  await irSecao('organizacao');
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

await passo('"Não informado" nunca é gravado', async () => {
  await preencher('nome', 'Numa temporária');
  await c.espera(60);
  await salvar();
  await esperarAviso('Configurações salvas.');
  await c.espera(100);
  ok('e-mail e logotipo continuam vazios', !(await guardado('organizacao_email')) && !(await guardado('organizacao_logo_url')), `${await guardado('organizacao_email')} ${await guardado('organizacao_logo_url')}`);
  await preencher('nome', 'Numa');
  await c.espera(60);
  await salvar();
  await c.espera(5200);
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
  ok('o aviso de alterações some', (await estadoDaBarra()) === '' && (await botao('Descartar')) === true && (await botao('Salvar alterações')) === true);
  ok('tira os espaços do nome', (await valor('nome')) === 'Numa Planejada', await valor('nome'));
  await c.recarregar();
  await pronta();
  ok('recarregar mantém', [await valor('nome'), await valor('email'), await valor('moeda'), await valor('vencimentos')].join('|') === 'Numa Planejada|contato@numa.com.br|USD|5');
  ok('sem mudança, salvar fica desligado', (await botao('Salvar alterações')) === true);
  await preencher('nome', 'Numa Planejada ');
  await c.espera(60);
  await salvar();
  await esperarAviso('Nenhuma alteração para salvar.');
  ok('só espaços a mais: avisa e não registra', (await valor('nome')) === 'Numa Planejada');
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
  await c.avaliar(`[...document.querySelectorAll('.dialogo button')].find(b=>b.textContent==='Descartar alterações').click()`);
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

await passo('trocar de seção com alterações', async () => {
  await preencher('nome', 'Digitado');
  await c.espera(60);
  ok('a barra avisa', (await estadoDaBarra()) === 'Alterações não salvas');
  ok('a navegação marca a seção alterada', (await textoDaAba('organizacao')).includes('alterações não salvas') && !(await textoDaAba('alertas')).includes('alterações não salvas'));
  await preencher('nome', 'Numa');
  await c.espera(60);
  ok('voltar ao valor salvo tira o aviso e desliga salvar', (await estadoDaBarra()) === '' && (await botao('Salvar alterações')) === true && !(await textoDaAba('organizacao')).includes('alterações não salvas'));
  await preencher('nome', 'Digitado');
  await c.espera(60);
  await irSecao('alertas');
  ok('trocar de seção não pergunta nem apaga', !(await c.avaliar(`Boolean(document.querySelector('.dialogo'))`)) && (await valor('nome')) === 'Digitado');
  ok('a barra diz onde está a alteração', (await estadoDaBarra()) === 'Alterações não salvas em Organização e região', await estadoDaBarra());
  await preencher('vencimentos', '7');
  await c.espera(60);
  ok('e nas duas seções', (await estadoDaBarra()) === 'Alterações não salvas em Organização e região e Alertas', await estadoDaBarra());
  await irSecao('financeiro');
  ok('em Financeiro (só leitura), com alteração pendente, as ações aparecem', (await botao('Salvar alterações')) === false && (await botao('Descartar')) === false);
  await c.foto('c-alteracao-em-outra-secao');
  await irSecao('organizacao');
  ok('o que foi digitado continua lá', (await valor('nome')) === 'Digitado' && (await valor('vencimentos')) === '7');
  const antes = await c.avaliar(`localStorage.getItem('numa-central:v1:configuracao')`);
  await c.clicar('texto=Descartar');
  await c.espera(100);
  ok('descartar volta as duas seções', (await valor('nome')) === 'Numa' && (await valor('vencimentos')) === '5' && (await estadoDaBarra()) === '');
  ok('e não mexe em nada gravado', (await c.avaliar(`localStorage.getItem('numa-central:v1:configuracao')`)) === antes);
  await c.espera(5200);
  await preencher('nome', 'Numa Segunda');
  await preencher('vencimentos', '6');
  await c.espera(60);
  await irSecao('backup');
  await salvar();
  await esperarAviso('Configurações salvas.');
  await c.espera(100);
  ok('salvar de outra seção grava todas', (await guardado('organizacao_nome')) === 'Numa Segunda' && (await guardado('alerta_vencimento_dias')) === 6, `${await guardado('organizacao_nome')} ${await guardado('alerta_vencimento_dias')}`);
  ok('e fica na seção aberta', (await secaoAberta()) === 'backup');
  await c.recarregar();
  await pronta();
  ok('recarregar mantém, na mesma seção', (await valor('nome')) === 'Numa Segunda' && (await valor('vencimentos')) === '6' && (await secaoAberta()) === 'backup');
  await preencher('nome', 'Numa');
  await preencher('vencimentos', '5');
  await c.espera(60);
  await salvar();
  await c.espera(5200);
  await voltarGeral();
});

await passo('sem Fase da Numa (decisão de 08/11/2026)', async () => {
  ok('nenhuma seção nem selo de fase', !(await c.avaliar(`Boolean(document.getElementById('fase'))`)) && !(await texto('main')).includes('Fase da Numa') && !/Fase 0a|Fase 0b/.test(await texto('main')));
});

await passo('câmbio', async () => {
  await irSecao('financeiro');
  ok('regras fixas como informação, sem controle', (await c.avaliar(`[...document.querySelectorAll('#financeiro input,#financeiro select,#financeiro [role=switch]')].length`)) === 0);
  ok('o câmbio mudou para Financeiro › Contas e saldos, com o link', await c.avaliar(`Boolean(document.querySelector('#financeiro a[href="/financeiro/contas#cambio"]'))`));
  await irPara('/financeiro/contas');
  await c.ate(`document.querySelector('#cambio button')`);
  await c.clicar('#cambio button');
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
  await c.ate(`document.querySelector('#cambio table tbody tr')`);
  const linha = await c.avaliar(`[...document.querySelectorAll('#cambio table tbody tr td')].map(t=>t.textContent).slice(0,4).join('|')`);
  const hoje = await c.avaliar(`new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo'}).format(new Date())`);
  ok('a linha aparece formatada', linha === `USD|R$ 5,42|${hoje}|Banco Central`, linha);
  ok('o vazio some', !(await texto('#cambio')).includes('Nenhum câmbio informado.'));
  ok('o foco volta ao botão', await c.avaliar(`document.activeElement.textContent.includes('Adicionar')`));
  await c.foto('e-linha');
  await c.recarregar();
  await c.ate(`document.querySelector('#cambio table tbody tr')`);
  ok('recarregar mantém o câmbio', await c.avaliar(`document.querySelector('#cambio table tbody tr td').textContent==='USD'`));
  // repetida
  await c.clicar('#cambio button');
  await dialogoAberto();
  await c.espera(420);
  ok('o formulário abre limpo', (await valor(await idPorRotulo('Cotação'))) === '');
  await preencher(await idPorRotulo('Cotação'), '6');
  await preencher(await idPorRotulo('Data'), await c.avaliar(`new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date())`));
  await c.clicar('texto=Adicionar câmbio');
  await c.ate(`document.querySelector('.dialogo').textContent.includes('Já existe essa moeda nessa data.')`);
  ok('mesma moeda na mesma data não entra', (await c.avaliar(`document.querySelectorAll('#cambio table tbody tr').length`)) === 1);
  await c.ate(`document.activeElement.type==='date'`);
  ok('o foco vai para a data', true);
  await c.tecla('Escape');
  await dialogoFechado();
  ok('Esc fecha o diálogo', true);
  // remover
  await c.espera(100);
  await c.clicar('#cambio table button[aria-label^="Remover USD"]');
  await dialogoAberto();
  await c.espera(420);
  const conf = await texto('.dialogo');
  ok('remover pede confirmação e diz o que acontece', conf.includes('Remover este câmbio?') && conf.includes('sai da lista') && conf.includes('continua no histórico'), conf.slice(0, 120));
  await c.foto('e-remover');
  await c.avaliar(`[...document.querySelectorAll('.dialogo button')].find(b=>b.textContent==='Remover câmbio').click()`);
  await esperarAviso('removido.');
  await c.ate(`document.querySelector('#cambio').textContent.includes('Nenhum câmbio informado.')`);
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
  await irPara('/financeiro/contas');
  await c.ate(`document.querySelector('#cambio button')`);
  await c.clicar('#cambio button');
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
  ok('a navegação avisa, mesmo com outra seção aberta', (await secaoAberta()) === 'organizacao' && (await textoDaAba('backup')).includes('precisa de atenção'));
  ok('sem alteração, salvar fica desligado', (await botao('Salvar alterações')) === true);
  await preencher('nome', 'Numa com pendência');
  await c.espera(60);
  await salvar();
  await c.ate(`document.getElementById('backup').offsetParent`);
  await c.espera(100);
  ok('ao salvar outra coisa, abre Backup e pede que escolha', (await focado()) === 'responsavel' && (await texto('main [role=alert]')).includes('Backup: Escolha a pessoa responsável pelo backup.'), await focado());
  await c.foto('f-fora-da-lista');
  await preencher('nome', 'Numa');
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
  ok('câmbio vazio de novo', await c.avaliar(`JSON.parse(localStorage.getItem('numa-central:v1:cambio_referencia')||'[]').every(l=>l.arquivado_em)`));
});

await passo('quem já tinha dados da versão anterior', async () => {
  await c.avaliar(`(()=>{localStorage.removeItem('numa-central:v1:configuracao');localStorage.removeItem('numa-central:v1:cambio_referencia');const m=JSON.parse(localStorage.getItem('numa-central:v1:meta'));m.versao_dados=1;localStorage.setItem('numa-central:v1:meta',JSON.stringify(m));const k='numa-central:v1:pessoa';const l=JSON.parse(localStorage.getItem(k));l[2].funcao='Dado que precisa continuar';localStorage.setItem(k,JSON.stringify(l))})()`);
  await c.recarregar();
  await pronta();
  ok('as configurações entram com os padrões', (await valor('nome')) === 'Numa' && (await c.avaliar(`JSON.parse(localStorage.getItem('numa-central:v1:meta')).versao_dados`)) === 24);
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

const MEDIR_ACOES = `(()=>{const barra=document.querySelector('main form > div:last-child');const caixas=[...barra.querySelectorAll('p,button')].map(e=>e.getBoundingClientRect()).filter(r=>r.width>1&&r.height>1);let cruza=false;for(let i=0;i<caixas.length;i++)for(let j=i+1;j<caixas.length;j++){const a=caixas[i],b=caixas[j];if(a.left<b.right-0.5&&b.left<a.right-0.5&&a.top<b.bottom-0.5&&b.top<a.bottom-0.5)cruza=true}const base=barra.getBoundingClientRect();const nav=document.querySelector('nav[aria-label="Navegação do celular"]')?.getBoundingClientRect();return {cruza,dentro:caixas.every(c=>c.left>=base.left&&c.right<=base.right),acimaDaBarraInferior:!nav||nav.height===0||base.height===0||base.bottom<=nav.top+1,naTela:base.top>=0&&base.bottom<=innerHeight}})()`;
const NAVEGACAO = `(()=>{const abas=[...document.querySelectorAll('[role=tablist] [role=tab]')].map(e=>e.getBoundingClientRect());const painel=document.querySelector('main form').getBoundingClientRect();const lista=document.querySelector('[role=tablist]').getBoundingClientRect();return {todas:abas.length===5&&abas.every(r=>r.width>0&&r.left>=0&&r.right<=innerWidth&&r.height>=44),aEsquerda:lista.right<=painel.left,acima:lista.bottom<=painel.top}})()`;
const acoesEmOrdem = (b) => !b.cruza && b.dentro && b.acimaDaBarraInferior && b.naTela;

for (const [l, a] of [[1440, 900], [1024, 768], [768, 1024], [360, 800]]) {
  await c.tamanho(l, a);
  await passo(`tela em ${l}px`, async () => {
    await voltarGeral();
    await c.espera(300);
    for (const secao of SECOES) {
      await irSecao(secao);
      await c.avaliar(`window.scrollTo({top:0,behavior:'instant'})`);
      await c.espera(100);
      const m = await c.avaliar(MEDIR);
      ok(`${secao}: sem rolagem lateral em ${l}px`, !m.rolagemLateral && m.larguraJanela === l, m.larguraJanela);
      ok(`${secao}: nada abaixo de 12px em ${l}px`, m.textoAbaixo12.length === 0, m.textoAbaixo12.join(','));
      if (l < 768) {
        ok(`${secao}: alvos de 44px em ${l}px`, m.alvosAbaixo44.length === 0, m.alvosAbaixo44.join(' | '));
        ok(`${secao}: campos de 16px em ${l}px`, m.camposAbaixo16.length === 0, m.camposAbaixo16.join(','));
      }
      const n = await c.avaliar(NAVEGACAO);
      ok(`${secao}: as 5 opções à vista em ${l}px`, n.todas);
      ok(`${secao}: navegação ${l >= 1024 ? 'à esquerda' : 'acima'} em ${l}px`, l >= 1024 ? n.aEsquerda : n.acima);
      const b = await c.avaliar(MEDIR_ACOES);
      ok(`${secao}: ações sem sobreposição em ${l}px`, acoesEmOrdem(b), JSON.stringify(b));
      await c.foto(`i-${l}-${secao}`);
    }
    // Com alteração em duas seções, o texto da barra é o mais longo.
    await preencher('nome', 'Numa alterada');
    await preencher('vencimentos', '9');
    await c.espera(80);
    for (const secao of SECOES) {
      await irSecao(secao);
      await c.espera(60);
      const b = await c.avaliar(MEDIR_ACOES);
      ok(`${secao}: com alterações, ações sem sobreposição em ${l}px`, acoesEmOrdem(b), JSON.stringify(b));
      ok(`${secao}: com alterações, sem rolagem lateral em ${l}px`, !(await c.avaliar(`document.documentElement.scrollWidth>innerWidth`)));
    }
    await c.foto(`i-${l}-alterado`);
    await irSecao('organizacao');
    await c.avaliar(`window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'})`);
    await c.espera(100);
    const fim = await c.avaliar(`(()=>{const m=document.getElementById('municipio').getBoundingClientRect();const barra=document.querySelector('main form > div:last-child').getBoundingClientRect();return m.bottom<=barra.top})()`);
    ok(`rolando até o fim, a barra não cobre o último campo em ${l}px`, fim);
    await c.foto(`i-${l}-fim`);
    await c.clicar('texto=Descartar');
    await c.avaliar(`window.scrollTo({top:0,behavior:'instant'})`);
    await c.espera(500);
    const AVISO_E_ACOES = `(()=>{const t=[...document.querySelectorAll('[data-sonner-toast]')].map(e=>e.getBoundingClientRect());const b=[...document.querySelectorAll('main form > div:last-child button')].map(e=>e.getBoundingClientRect());return {avisos:t.length,botoes:b.length,cobre:t.some(a=>b.some(r=>a.left<r.right&&r.left<a.right&&a.top<r.bottom&&r.top<a.bottom))}})()`;
    const noInicio = await c.avaliar(AVISO_E_ACOES);
    ok(`o aviso não cobre as ações em ${l}px, no início da página`, noInicio.avisos > 0 && noInicio.botoes === 2 && !noInicio.cobre, JSON.stringify(noInicio));
    await c.foto(`i-${l}-aviso`);
    await c.avaliar(`window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'})`);
    await c.espera(100);
    const noFim = await c.avaliar(AVISO_E_ACOES);
    ok(`o aviso não cobre as ações em ${l}px, no fim da página`, noFim.avisos > 0 && noFim.botoes === 2 && !noFim.cobre, JSON.stringify(noFim));
    await c.avaliar(`window.scrollTo({top:0,behavior:'instant'})`);
    await c.espera(5200);
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
  // câmbio com linha, em cartão (em Financeiro › Contas e saldos)
  await irPara('/financeiro/contas');
  await c.ate(`document.querySelector('#cambio button')`);
  await c.clicar('#cambio button');
  await dialogoAberto();
  await c.espera(450);
  await c.foto('j-cambio');
  const d = await c.avaliar(`(()=>{const b=document.querySelector('.dialogo').getBoundingClientRect();return {base:Math.round(b.bottom),larg:b.width}})()`);
  ok('câmbio em folha inferior', d.base === 800 && d.larg === 360, JSON.stringify(d));
  await preencher(await idPorRotulo('Cotação'), '5,123456');
  await preencher(await idPorRotulo('Data'), '2026-11-05');
  await c.clicar('texto=Adicionar câmbio');
  await c.ate(`document.querySelector('#cambio ul li dl')`);
  await dialogoFechado();
  await c.espera(100);
  const cartao = await texto('#cambio ul li');
  ok('no celular, a linha vira cartão', cartao.includes('R$ 5,123456') && cartao.includes('05/11/2026') && cartao.includes('Não informada'), cartao);
  await c.avaliar(`document.querySelector('#cambio ul li').scrollIntoView({block:'center',behavior:'instant'})`);
  await c.espera(100);
  await c.foto('j-cartao');
  await c.clicar('#cambio ul button[aria-label^="Remover"]');
  await dialogoAberto();
  await c.espera(420);
  await c.avaliar(`[...document.querySelectorAll('.dialogo button')].find(b=>b.textContent==='Remover câmbio').click()`);
  await dialogoFechado();
  await voltarGeral();
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
});

await c.tamanho(1440, 900);
await passo('teclado', async () => {
  await voltarGeral();
  await c.avaliar(`document.querySelector(${js(aba('organizacao'))}).focus()`);
  await c.tecla('ArrowDown');
  await c.espera(100);
  ok('as setas passam pelas seções', (await secaoAberta()) === 'alertas' && (await c.avaliar(`document.activeElement.getAttribute('role')`)) === 'tab');
  ok('pelo teclado, o foco aparece', await c.avaliar(`document.activeElement.matches(':focus-visible')`));
  ok('as seções fechadas saem do caminho do Tab', await c.avaliar(`!document.getElementById('nome').offsetParent&&document.getElementById('nome').matches(':not(:focus)')`));
  ok('rótulos em todos os campos (RT-19)', await c.avaliar(`[...document.querySelectorAll('main input:not([type=file]),main select')].every(e=>e.labels?.length>0||e.getAttribute('aria-label'))`));
});

const falhas = resultados.filter((r) => !r.startsWith('OK') && !r.startsWith('  '));
console.log(resultados.join('\n'));
console.log(`\n=== ${resultados.filter((r) => r.startsWith('OK')).length} OK, ${falhas.length} com problema`);
console.log('=== console:', c.erros.length ? '\n' + [...new Set(c.erros)].join('\n') : 'sem erros nem avisos');
await c.fechar();
process.exit(0);
