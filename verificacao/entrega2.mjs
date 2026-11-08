// Verificação da entrega 2 (camada de dados e Configurações › Dados) no sistema real.
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { abrirChrome } from './cdp.mjs';

const scratch = process.argv[2];
const BASE = process.argv[3] || 'http://localhost:3000';
const fotos = path.join(scratch, 'e2');
const downloads = path.join(scratch, 'baixados').replaceAll('/', '\\');
const arquivos = path.join(scratch, 'arquivos-teste');
rmSync(downloads, { recursive: true, force: true });
mkdirSync(downloads, { recursive: true });
mkdirSync(arquivos, { recursive: true });

const c = await abrirChrome({ scratch, porta: 9336, pastaFotos: fotos });
// Sem as rotinas do dia, os números não dependem do dia da semana (ver apoio.mjs).
await c.enviar('Emulation.setFocusEmulationEnabled', { enabled: true });
await c.enviar('Page.addScriptToEvaluateOnNewDocument', { source: `(()=>{try{const k='numa-central:v1:meta';const m=JSON.parse(localStorage.getItem(k)||'{}');if(!m.ultima_rotina_em){m.ultima_rotina_em=new Date().toISOString();localStorage.setItem(k,JSON.stringify(m))}}catch{}})()` });
await c.enviar('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });

const resultados = [];
const ok = (nome, passou, extra) => resultados.push(`${passou ? 'OK   ' : 'FALHA'} ${nome}${extra !== undefined ? ` [${extra}]` : ''}`);
async function passo(nome, fn) {
  try { await fn(); } catch (e) { resultados.push(`ERRO  ${nome}: ${e.message}`); }
}
const texto = (seletor = 'main') => c.avaliar(`document.querySelector(${JSON.stringify(seletor)})?.textContent ?? ''`);
const pagina = () => texto('main');
const historico = () => c.avaliar(`[...document.querySelectorAll('main ul li')].map(l=>l.textContent)`);
const pronta = () => c.ate(`document.querySelector('main')?.textContent.includes('Último backup')&&document.querySelector('main ul li')`);
const opcoesVoceE = () => c.avaliar(`[...document.querySelector('[data-menu-lateral] select').options].map(o=>o.textContent)`);
const etiqueta = () => c.avaliar(`[...document.querySelectorAll('header span')].some(s=>s.textContent==='Dados de exemplo'&&s.getBoundingClientRect().width>0)`);
const trocarPessoa = (nome) => c.avaliar(`(()=>{const s=document.querySelector('[data-menu-lateral] select');const o=[...s.options].find(x=>x.textContent===${JSON.stringify(nome)});Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,o.value);s.dispatchEvent(new Event('change',{bubbles:true}))})()`);
const ultimoAviso = () => c.avaliar(`[...document.querySelectorAll('[data-sonner-toast]')].map(t=>t.textContent).join(' | ')`);
// Avisos somem sozinhos em 5s; mexer neles por fora quebraria a página, então só se lê o texto.
const fecharAvisos = async () => {};
// O Chrome sobrescreve o arquivo de mesmo nome: cada download recebido é guardado à parte.
let baixados = 0;
const NOMES_BAIXADOS = [];
async function baixado() {
  // Só vale com o tamanho parado, sem `.crdownload` ao lado: antes disso, o Chrome ainda está gravando.
  let anterior = -1;
  for (let i = 0; i < 400; i++) {
    const presentes = readdirSync(downloads);
    const nome = presentes.find((n) => /^central-numa-.*\.json$/.test(n));
    if (nome && !presentes.some((n) => n.endsWith('.crdownload'))) {
      const tamanho = statSync(path.join(downloads, nome)).size;
      if (tamanho > 0 && tamanho === anterior) {
        await c.espera(300);
        baixados += 1;
        const destino = path.join(downloads, `b${baixados}-${nome}`);
        renameSync(path.join(downloads, nome), destino);
        NOMES_BAIXADOS.push(nome);
        return destino;
      }
      anterior = tamanho;
    } else anterior = -1;
    await c.espera(100);
  }
  throw new Error('download não chegou');
}

await c.tamanho(1440, 900);
const SEM_ABERTURA = `(()=>{localStorage.setItem('numa-central:v1:meta',JSON.stringify({ultima_abertura:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date())}))})()`;

await passo('primeira abertura', async () => {
  await c.ir(BASE + '/configuracoes');
  await c.ate(`location.pathname==='/configuracoes'`);
  // A tecla só pula a abertura depois que ela está na tela; antes disso, ninguém a escuta.
  await c.ate(`document.querySelector('.abertura')`);
  await c.tecla('a');
  await c.ate(`!document.querySelector('.abertura')`);
  await c.ir(BASE + '/configuracoes/dados');
  await pronta();
  const chaves = await c.avaliar(`Object.keys(localStorage).sort()`);
  ok('grava uma chave por tabela (02 §0.3)', ['numa-central:v1:auditoria', 'numa-central:v1:backup_registro', 'numa-central:v1:meta', 'numa-central:v1:pessoa'].every((k) => chaves.includes(k)), chaves.join(','));
  ok('todas as chaves no prefixo da especificação', chaves.every((k) => k.startsWith('numa-central:v1:')));
  const p = await pagina();
  ok('180 registros, 77 de exemplo', p.includes('Registros180') && p.includes('77 de exemplo'));
  ok('ainda sem backup', p.includes('Último backupNenhum'));
  ok('avisa os limites do armazenamento', p.includes('não é o registro oficial'));
  ok('etiqueta "Dados de exemplo" aparece', await etiqueta());
  ok('"Você é" traz as pessoas internas ativas', JSON.stringify(await opcoesVoceE()) === JSON.stringify(['Kimberly Grebe', 'Camila Lima', 'Bruna Alves']), (await opcoesVoceE()).join(','));
  ok('histórico mostra a carga inicial', (await historico())[0]?.startsWith('Sistema carregou os dados de exemplo'), (await historico())[0]);
  await c.foto('d-1440', { inteira: true });
});

let primeiroBackup;
await passo('exportar', async () => {
  await c.clicar('texto=Exportar tudo');
  await c.ate(`[...document.querySelectorAll('[data-sonner-toast]')].some(t=>t.textContent.includes('Backups/Central'))`);
  const avisoDoBackup = await ultimoAviso();
  primeiroBackup = await baixado();
  const arquivo = JSON.parse(readFileSync(primeiroBackup, 'utf8'));
  ok('baixa com a data no nome', /^central-numa-\d{4}-\d{2}-\d{2}\.json$/.test(NOMES_BAIXADOS[0]), NOMES_BAIXADOS[0]);
  ok('o arquivo traz todas as tabelas', arquivo.formato === 'central-numa' && arquivo.tabelas.pessoa.length === 4 && arquivo.tabelas.backup_registro.length === 1 && Array.isArray(arquivo.tabelas.auditoria));
  ok('o arquivo diz quem exportou', arquivo.exportado_por?.nome === 'Kimberly Grebe', arquivo.exportado_por?.nome);
  ok('orienta salvar no Drive', avisoDoBackup.includes('Backups/Central'), avisoDoBackup);
  await c.espera(100);
  const p = await pagina();
  ok('mostra o último backup e quem fez', p.includes('por Kimberly Grebe') && !p.includes('Último backupNenhum'));
  ok('o histórico registra', (await historico())[0]?.startsWith('Kimberly Grebe exportou todos os dados'), (await historico())[0]);
  await fecharAvisos();
});
await passo('autoria segue "Você é"', async () => {
  await trocarPessoa('Camila Lima');
  await c.espera(150);
  await c.clicar('texto=Exportar tudo');
  await baixado();
  await c.espera(150);
  ok('agora o histórico diz Camila Lima', (await historico())[0]?.startsWith('Camila Lima exportou todos os dados'), (await historico())[0]);
  ok('e o último backup também', (await pagina()).includes('por Camila Lima'));
  await fecharAvisos();
});
await passo('limpar exemplos', async () => {
  await c.clicar('texto=Limpar exemplos');
  await c.ate(`document.querySelector('.dialogo')`);
  await c.espera(420);
  await c.foto('d-limpar');
  ok('diz quantos serão removidos', (await texto('.dialogo')).includes('77 registros de exemplo serão removidos'), await texto('.dialogo'));
  await c.clicar('texto=Voltar');
  await c.ate(`!document.querySelector('.dialogo')`);
  ok('voltar não muda nada', (await pagina()).includes('Registros180'));
  await c.clicar('texto=Limpar exemplos');
  await c.ate(`document.querySelector('.dialogo')`);
  await c.espera(420);
  await c.avaliar(`[...document.querySelectorAll('.dialogo button')].find(b=>b.textContent==='Limpar exemplos').click()`);
  await c.ate(`!document.querySelector('.dialogo')`);
  await c.ate(`document.querySelector('main').textContent.includes('Nenhum de exemplo')`);
  const p = await pagina();
  ok('ficam só as sócias', p.includes('Registros103'));
  ok('a etiqueta some', !(await etiqueta()));
  ok('Bruna sai de "Você é"', JSON.stringify(await opcoesVoceE()) === JSON.stringify(['Kimberly Grebe', 'Camila Lima']));
  ok('o botão fica desativado', await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent==='Limpar exemplos').disabled`));
  ok('o histórico registra', (await historico())[0]?.includes('limpou 77 registros de exemplo'), (await historico())[0]);
  await fecharAvisos();
  await c.recarregar();
  await pronta();
  ok('recarregar mantém a alteração', (await pagina()).includes('Registros103'));
  ok('os exemplos não voltam sozinhos', !(await etiqueta()));
});
await passo('importar: prévia', async () => {
  await c.enviarArquivo('main input[type=file]', primeiroBackup);
  await c.ate(`document.querySelector('.dialogo table')`);
  await c.espera(420);
  await c.foto('d-previa');
  const linhas = await c.avaliar(`[...document.querySelectorAll('.dialogo tbody tr')].map(t=>[...t.children].map(x=>x.textContent).join('|'))`);
  ok('prévia: aqui e no arquivo', linhas.includes('Pessoas|2|4'), linhas.join(' ; '));
  const t = await texto('.dialogo');
  ok('avisa que substitui e mostra a origem', t.includes('substitui tudo') && t.includes('por Kimberly Grebe'), t.slice(0, 120));
  ok('avisa que baixa uma cópia antes', t.includes('baixa uma cópia do que há hoje') && t.includes('Baixar cópia e substituir'));
  ok('nada mudou ainda', (await pagina()).includes('Registros103'));
  await c.clicar('texto=Voltar');
  await c.ate(`!document.querySelector('.dialogo')`);
  ok('voltar cancela', (await pagina()).includes('Registros103'));
  await c.espera(600);
  ok('voltar não baixa nada', !readdirSync(downloads).some((n) => /^central-numa-/.test(n)));
});
await passo('importar: confirmar', async () => {
  await c.enviarArquivo('main input[type=file]', primeiroBackup);
  await c.ate(`document.querySelector('.dialogo table')`);
  await c.espera(420);
  // O aviso dura 5 s, e baixar a cópia pode demorar mais que isso com a máquina ocupada.
  const avisoDaImportacao = c.ate(`[...document.querySelectorAll('[data-sonner-toast]')].some(t=>t.textContent.includes('Dados importados'))`).then(() => ultimoAviso(), () => '');
  await c.clicar('texto=Baixar cópia e substituir');
  const copia = await baixado();
  const conteudoDaCopia = JSON.parse(readFileSync(copia, 'utf8'));
  ok('baixa a cópia com nome próprio', /^central-numa-antes-de-importar-\d{4}-\d{2}-\d{2}\.json$/.test(NOMES_BAIXADOS.at(-1)), NOMES_BAIXADOS.at(-1));
  ok('a cópia traz o que havia antes', conteudoDaCopia.tabelas.pessoa.length === 2, conteudoDaCopia.tabelas.pessoa.length);
  await c.ate(`!document.querySelector('.dialogo')`);
  await c.ate(`document.querySelector('main').textContent.includes('77 de exemplo')`);
  ok('volta o conteúdo do arquivo', (await pagina()).includes('Registros180'), (await pagina()).slice(150, 330));
  ok('a etiqueta volta', await etiqueta());
  const textoDoAviso = await avisoDaImportacao;
  ok('aviso de sucesso', textoDoAviso.includes('Dados importados: 180 registros'), textoDoAviso);
  ok('o aviso conta da cópia', textoDoAviso.includes('A cópia do que havia antes foi baixada'), textoDoAviso);
  ok('o histórico registra', (await historico())[0]?.includes('importou 180 registros de um arquivo, com cópia do que havia antes'), (await historico())[0]);
  await fecharAvisos();
});
await passo('importar: arquivos ruins', async () => {
  const casos = [
    ['nao-json.json', 'isso não é json', 'não é um JSON válido'],
    ['outro.json', '{"qualquer":"coisa"}', 'não é uma exportação da Central'],
    ['futuro.json', JSON.stringify({ formato: 'central-numa', versao_dados: 99, exportado_em: '2026-11-05T12:00:00.000Z', exportado_por: null, contadores: {}, tabelas: {} }), 'versão mais nova'],
    ['ruim.json', JSON.stringify({ formato: 'central-numa', versao_dados: 1, exportado_em: '2026-11-05T12:00:00.000Z', exportado_por: null, contadores: {}, tabelas: { pessoa: [{ nome_completo: '' }] } }), 'Pessoas, linha 1'],
  ];
  const antes = await c.avaliar(`localStorage.getItem('numa-central:v1:pessoa')`);
  for (const [nome, conteudo, esperado] of casos) {
    const caminho = path.join(arquivos, nome);
    writeFileSync(caminho, conteudo);
    await c.enviarArquivo('main input[type=file]', caminho);
    await c.ate(`document.querySelector('.dialogo')`);
    await c.espera(420);
    const t = await texto('.dialogo');
    ok(`recusa ${nome}`, t.includes(esperado) && t.includes('Nada foi alterado'), t.slice(0, 110));
    if (nome === 'ruim.json') await c.foto('d-arquivo-ruim');
    await c.clicar('.dialogo [aria-label="Fechar"]');
    await c.ate(`!document.querySelector('.dialogo')`);
  }
  ok('nenhum arquivo ruim alterou os dados', (await c.avaliar(`localStorage.getItem('numa-central:v1:pessoa')`)) === antes);
});
let alertasDosExemplos = 0;
await passo('rotinas', async () => {
  await c.avaliar(`(()=>{const k='numa-central:v1:recorrencia';localStorage.setItem(k,JSON.stringify(JSON.parse(localStorage.getItem(k)).map(r=>({...r,situacao:'pausada'}))))})()`);
  await c.clicar('texto=Rodar rotinas agora');
  await c.ate(`document.querySelector('[data-sonner-toast]')`);
  await c.ate(`[...document.querySelectorAll('[data-sonner-toast]')].some(t=>t.textContent.includes('Rotinas do dia executadas'))`);
  alertasDosExemplos = (await c.avaliar(`JSON.parse(localStorage.getItem('numa-central:v1:atividade'))`)).filter((a) => a.tipo === 'alerta' && a.chave_idempotencia).length;
  const alertasNovos = alertasDosExemplos;
  ok('avisa o resultado, com os alertas dos exemplos', alertasNovos > 0 && (await ultimoAviso()).includes(`Rotinas do dia executadas: ${alertasNovos} alertas novos.`), `${alertasNovos} ${await ultimoAviso()}`);
  await c.espera(100);
  ok('mostra a última execução', /Última execução: \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/.test(await pagina()));
  ok('o histórico registra', (await historico())[0]?.includes('rodou as rotinas do dia'), (await historico())[0]);
  await fecharAvisos();
  const n = (await c.avaliar(`JSON.parse(localStorage.getItem('numa-central:v1:auditoria')).length`));
  await c.recarregar();
  await pronta();
  await c.espera(200);
  ok('ao recarregar, não repete nem avisa de novo', (await c.avaliar(`JSON.parse(localStorage.getItem('numa-central:v1:auditoria')).length`)) === n && !(await ultimoAviso()));
});
await passo('rotinas ao abrir, uma vez por dia', async () => {
  await c.avaliar(`(()=>{const m=JSON.parse(localStorage.getItem('numa-central:v1:meta'));m.ultima_rotina_em=new Date(Date.now()-86400000).toISOString();localStorage.setItem('numa-central:v1:meta',JSON.stringify(m))})()`);
  await c.recarregar();
  await pronta();
  await c.espera(300);
  const m = await c.avaliar(`JSON.parse(localStorage.getItem('numa-central:v1:meta')).ultima_rotina_em`);
  ok('rodam sozinhas no novo dia', Date.now() - new Date(m).getTime() < 3600_000, m);
  ok('sem novidade, sem aviso', !(await ultimoAviso()));
});
await passo('backup atrasado', async () => {
  await c.avaliar(`(()=>{const k='numa-central:v1:backup_registro';const l=JSON.parse(localStorage.getItem(k));l.forEach(b=>{b.gerado_em='2026-01-01T12:00:00.000Z'});localStorage.setItem(k,JSON.stringify(l))})()`);
  await c.recarregar();
  await pronta();
  await c.ate(`document.querySelector('main').textContent.includes('Há mais de 8 dias')`, 5000);
  ok('avisa quando o último backup tem mais de 8 dias', true);
  await c.foto('d-atrasado');
});
await passo('mudança vinda de outra aba', async () => {
  // Os 180 da carga, mais os alertas que os exemplos geraram na rodada manual.
  const registros = 180 + alertasDosExemplos;
  await c.avaliar(`(()=>{const k='numa-central:v1:pessoa';const l=JSON.parse(localStorage.getItem(k));l.pop();const novo=JSON.stringify(l);localStorage.setItem(k,novo);window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:novo}))})()`);
  await c.ate(`document.querySelector('main').textContent.includes('Registros${registros - 1}')`, 3000);
  ok('a tela atualiza sozinha', true);
});
await passo('restaurar', async () => {
  await c.clicar('texto=Restaurar exemplos');
  await c.ate(`document.querySelector('.dialogo')`);
  await c.espera(420);
  await c.foto('d-restaurar');
  ok('usa o texto da especificação', (await texto('.dialogo')).includes('Isso apaga tudo o que foi cadastrado neste navegador'));
  await c.avaliar(`[...document.querySelectorAll('.dialogo button')].find(b=>b.textContent==='Restaurar exemplos').click()`);
  await c.ate(`!document.querySelector('.dialogo')`);
  await c.ate(`document.querySelector('main').textContent.includes('Último backupNenhum')`);
  const p = await pagina();
  ok('volta ao início', p.includes('Registros180') && p.includes('77 de exemplo'));
  const h = await historico();
  ok('o histórico recomeça, com o registro de quem restaurou', h.length === 1 && h[0].startsWith('Camila Lima restaurou os dados de exemplo'), h.join(' ; '));
  ok('quem estava selecionada continua', (await c.avaliar(`document.querySelector('[data-menu-lateral] select').selectedOptions[0].textContent`)) === 'Camila Lima');
  await fecharAvisos();
});
await passo('armazenamento cheio', async () => {
  const antes = await c.avaliar(`localStorage.getItem('numa-central:v1:backup_registro')`);
  await c.avaliar(`(()=>{window.__orig=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.endsWith(':auditoria'))throw new DOMException('cheio','QuotaExceededError');return window.__orig.call(this,k,v)}})()`);
  await c.clicar('texto=Exportar tudo');
  await c.ate(`[...document.querySelectorAll('[data-sonner-toast]')].some(t=>t.textContent.includes('está cheio'))`);
  ok('diz o que houve, em português', (await ultimoAviso()).includes('armazenamento deste navegador está cheio'), await ultimoAviso());
  await c.foto('d-cheio');
  await c.avaliar(`Storage.prototype.setItem=window.__orig`);
  ok('nada ficou pela metade', (await c.avaliar(`localStorage.getItem('numa-central:v1:backup_registro')`)) === antes);
  await c.espera(800);
  ok('nenhum arquivo foi baixado', !readdirSync(downloads).some((n) => /^central-numa-/.test(n)));
  await fecharAvisos();
});
await passo('dados danificados: restaurar', async () => {
  await c.avaliar(`localStorage.setItem('numa-central:v1:pessoa','{danificado')`);
  await c.recarregar();
  await c.ate(`document.querySelector('main').textContent.includes('Não deu para ler os dados deste navegador')`);
  await c.espera(200);
  await c.foto('d-danificado');
  ok('explica e mostra a saída', (await pagina()).includes('Importe um backup ou restaure os exemplos'));
  ok('a moldura continua funcionando', await c.avaliar(`Boolean(document.querySelector('[data-menu-lateral] select').value)`));
  await c.clicar('texto=Tentar de novo');
  await c.espera(200);
  ok('tentar de novo não apaga nada', (await c.avaliar(`localStorage.getItem('numa-central:v1:pessoa')`)) === '{danificado');
  await c.clicar('texto=Restaurar exemplos');
  await c.ate(`document.querySelector('.dialogo')`);
  await c.espera(420);
  await c.avaliar(`[...document.querySelectorAll('.dialogo button')].find(b=>b.textContent==='Restaurar exemplos').click()`);
  await c.ate(`document.querySelector('main').textContent.includes('Registros180')`);
  ok('restaurar recupera', true);
  await fecharAvisos();
});
await passo('dados danificados: importar', async () => {
  await c.avaliar(`localStorage.setItem('numa-central:v1:pessoa','{danificado')`);
  await c.recarregar();
  await c.ate(`document.querySelector('main').textContent.includes('Não deu para ler')`);
  await c.enviarArquivo('main input[type=file]', primeiroBackup);
  await c.ate(`document.querySelector('.dialogo table')`);
  await c.espera(420);
  ok('a prévia marca o que está danificado', (await texto('.dialogo tbody')).includes('Danificado'));
  ok('e explica que não há cópia a baixar', (await texto('.dialogo')).includes('não dá para baixar uma cópia') && !(await texto('.dialogo')).includes('Baixar cópia e substituir'));
  await c.clicar('texto=Substituir os dados');
  await c.ate(`document.querySelector('main').textContent.includes('Registros180')&&!document.querySelector('.dialogo')`);
  ok('importar recupera', true);
  await c.espera(600);
  ok('sem baixar cópia de dados danificados', !readdirSync(downloads).some((n) => /^central-numa-/.test(n)));
  await fecharAvisos();
});

const MEDIR = `(()=>{const cs=e=>getComputedStyle(e);const vis=e=>{const b=e.getBoundingClientRect();return b.width>1&&b.height>1&&cs(e).visibility!=='hidden'};const r={larguraJanela:innerWidth,rolagemLateral:document.documentElement.scrollWidth>innerWidth};
const menor=[];document.querySelectorAll('body *').forEach(e=>{if(vis(e)&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())){const s=parseFloat(cs(e).fontSize);if(s<12)menor.push(s+':'+e.textContent.trim().slice(0,24))}});r.textoAbaixo12=menor;
const alvos=[];document.querySelectorAll('a,button:not(:disabled),select:not(:disabled),input:not(:disabled):not([type=file]),[role=tab]').forEach(e=>{if(vis(e)&&e.getAttribute('href')!=='#conteudo'){const b=e.getBoundingClientRect();if(b.height<44||b.width<44)alvos.push((e.textContent.trim().slice(0,20)||e.getAttribute('aria-label')||e.id)+' '+Math.round(b.width)+'x'+Math.round(b.height))}});r.alvosAbaixo44=alvos;
const c16=[];document.querySelectorAll('input:not([type=file]),select,textarea').forEach(e=>{if(vis(e)&&parseFloat(cs(e).fontSize)<16)c16.push((e.id||e.getAttribute('aria-label'))+':'+cs(e).fontSize)});r.camposAbaixo16=c16;return r})()`;
for (const [l, a] of [[1440, 900], [1024, 768], [768, 1024], [360, 800]]) {
  await c.tamanho(l, a);
  await passo(`tela em ${l}px`, async () => {
    await c.ir(BASE + '/configuracoes/dados');
    await pronta();
    await c.espera(250);
    const m = await c.avaliar(MEDIR);
    if (l >= 768) { delete m.alvosAbaixo44; delete m.camposAbaixo16; }
    resultados.push(`  medida ${l}: ${JSON.stringify(m)}`);
    ok(`sem rolagem lateral em ${l}px`, !m.rolagemLateral && m.larguraJanela === l, m.larguraJanela);
    ok(`nada abaixo de 12px em ${l}px`, m.textoAbaixo12.length === 0, m.textoAbaixo12.join(','));
    if (l < 768) {
      ok(`alvos de 44px em ${l}px`, m.alvosAbaixo44.length === 0, m.alvosAbaixo44.join(' | '));
      ok(`campos de 16px em ${l}px`, m.camposAbaixo16.length === 0, m.camposAbaixo16.join(','));
    }
    await c.foto(`d-${l}-tela`);
  });
}
await passo('celular', async () => {
  await c.tamanho(360, 800);
  await c.ir(BASE + '/configuracoes/dados');
  await pronta();
  await c.espera(250);
  const altura = await c.avaliar(`document.documentElement.scrollHeight`);
  for (let y = 0, i = 0; y < altura; y += 700, i++) {
    await c.avaliar(`window.scrollTo({top:${y},behavior:'instant'})`);
    await c.espera(60);
    await c.foto(`dc-${i}`);
  }
  await c.enviarArquivo('main input[type=file]', primeiroBackup);
  await c.ate(`document.querySelector('.dialogo table')`);
  await c.espera(450);
  await c.foto('dc-previa');
  const d = await c.avaliar(`(()=>{const b=document.querySelector('.dialogo').getBoundingClientRect();return {base:Math.round(b.bottom),larg:b.width,rolagem:document.documentElement.scrollWidth>innerWidth}})()`);
  ok('prévia em folha inferior', d.base === 800 && d.larg === 360 && !d.rolagem, JSON.stringify(d));
  ok('a prévia inteira cabe na folha, com o botão ao alcance', await c.avaliar(`(()=>{const b=[...document.querySelectorAll('.dialogo button')].at(-1).getBoundingClientRect();return b.bottom<=800&&b.height>=44})()`));
  await c.clicar('texto=Voltar');
  await c.ate(`!document.querySelector('.dialogo')`);
  await c.clicar('texto=Mais');
  await c.ate(`document.querySelector('.dialogo #voce-e-celular')`);
  await c.espera(100);
  ok('"Você é" no celular vem dos dados', (await c.avaliar(`[...document.querySelector('#voce-e-celular').options].length`)) === 3);
  ok('foco fica no próprio menu, sem acender o campo', await c.avaliar(`document.activeElement===document.querySelector('.dialogo')`));
});
await c.tamanho(1440, 900);
await passo('movimento reduzido e teclado', async () => {
  await c.ir(BASE + '/configuracoes/dados');
  await pronta();
  await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent==='Restaurar exemplos').focus()`);
  await c.tecla('Enter');
  await c.ate(`document.querySelector('.dialogo')`);
  ok('dá para abrir a confirmação pelo teclado', true);
  await c.tecla('Escape');
  await c.ate(`!document.querySelector('.dialogo')`);
  ok('Esc fecha e o foco volta ao botão', await c.avaliar(`document.activeElement.textContent==='Restaurar exemplos'`));
});

const falhas = resultados.filter((r) => !r.startsWith('OK') && !r.startsWith('  '));
console.log(resultados.join('\n'));
console.log(`\n=== ${resultados.filter((r) => r.startsWith('OK')).length} OK, ${falhas.length} com problema`);
console.log('=== console:', c.erros.length ? '\n' + [...new Set(c.erros)].join('\n') : 'sem erros nem avisos');
await c.fechar();
process.exit(0);
