// Verificação de T05.05 (Sócias), T05.06 (Transferências) e T05.07 (Contas e saldos) no sistema real.
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { ID_CAMILA, ID_KIMBERLY, iniciar } from './apoio.mjs';

const h = await iniciar({ nome: 't0505', porta: 9364 });
const { c, ok, passo, ir, texto, valor, preencher, escolher, erroDe, opcoes, clicarNoDialogo, dialogoAberto, dialogoFechado, pularAbertura, tabela, esperarAviso, conferirTela, terminar } = h;

const js = (v) => JSON.stringify(v);
const hoje = new Date();
const diaISO = (dias = 0) => new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + dias)).toISOString().slice(0, 10);
const DRIVE = 'https://drive.google.com/file/d/abc/view';
const ID_CONTA_KIMBERLY = 'a8c6e7da-d195-4a76-8c67-6f7a8b9c0d01';
const ID_BANCO = 'e1000000-0000-4000-8000-000000000001';
const ID_RESERVA = 'e1000000-0000-4000-8000-000000000002';
const ID_DOLAR = 'e1000000-0000-4000-8000-000000000003';
const ID_ENCERRADA = 'e1000000-0000-4000-8000-000000000004';

const espacos = (t) => t.replaceAll(' ', ' ');
const reais = (v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const naTela = async (seletor = 'main') => espacos(await texto(seletor));
const clicarBotao = (rotulo, onde = 'main') => c.avaliar(`(()=>{const b=[...document.querySelectorAll(${js(onde + ' button')})].find(b=>b.textContent.trim()===${js(rotulo)}||b.getAttribute('aria-label')===${js(rotulo)});if(!b)throw new Error('sem botão: '+${js(rotulo)});b.click()})()`);
const aba = async (rotulo) => {
  const i = await c.avaliar(`[...document.querySelectorAll('main [role=tab]')].findIndex(a=>a.textContent.trim()===${js(rotulo)})`);
  await c.clicar(`main [role=tab]:nth-child(${i + 1})`);
  await c.espera(160);
};
const abasDaFicha = () => c.avaliar(`[...document.querySelectorAll('main [role=tab]')].map(t=>t.textContent).join('|')`);
const linhas = (rotulo) => c.avaliar(`[...document.querySelectorAll(${js(`table[aria-label="${rotulo}"] tbody tr`)})].map(tr=>tr.textContent)`);
const irPara = async (caminho, h1) => {
  await ir(caminho);
  await c.ate(`document.querySelector('main h1')?.textContent.includes(${js(h1)})`);
  await c.espera(160);
};
const emReais = (t) => espacos(t);
const cartao = (nome) => naTela(`section[aria-label="${nome}"]`);
const novaConta = (id, campos) => c.avaliar(`(()=>{const k='numa-central:v1:conta_financeira';const l=JSON.parse(localStorage.getItem(k));l.push({...l[0],id:${js(id)},exemplo:false,titular_pessoa_id:${js(ID_KIMBERLY)},titular_entidade_id:null,...${js(campos)}});localStorage.setItem(k,JSON.stringify(l))})()`);
const somar = (lista, campo) => Math.round(lista.reduce((t, x) => t + x[campo], 0) * 100) / 100;

const downloads = path.join(process.argv[2], 'baixados-t0505').replaceAll('/', '\\');
rmSync(downloads, { recursive: true, force: true });
mkdirSync(downloads, { recursive: true });
await c.enviar('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
const baixado = async (prefixo) => {
  for (let i = 0; i < 300; i += 1) {
    const presentes = readdirSync(downloads);
    const nome = presentes.find((n) => n.startsWith(prefixo) && n.endsWith('.csv'));
    if (nome && !presentes.some((n) => n.endsWith('.crdownload')) && statSync(path.join(downloads, nome)).size > 0) return nome;
    await c.espera(100);
  }
  throw new Error(`não baixou: ${prefixo}`);
};

await c.tamanho(1440, 900);

await passo('as seções do Financeiro têm link', async () => {
  await ir('/financeiro');
  await pularAbertura();
  await c.ate(`document.querySelector('main h1')`);
  await c.espera(160);
  for (const [href, rotulo, h1] of [['/financeiro/socias', 'Sócias', 'Sócias'], ['/financeiro/transferencias', 'Transferências', 'Transferências'], ['/financeiro/contas', 'Contas e saldos', 'Contas e saldos']]) {
    await c.avaliar(`document.querySelector('nav[aria-label="Seções do financeiro"] a[href="${href}"]').click()`);
    await c.ate(`location.pathname===${js(href)}&&document.querySelector('main h1')?.textContent.includes(${js(h1)})`);
    await c.espera(120);
    ok(`${rotulo}: a aba leva à tela e fica marcada`, await c.avaliar(`document.querySelector('nav[aria-label="Seções do financeiro"] a[href="${href}"]').getAttribute('aria-current')==='page'`));
  }
  ok('nenhuma seção diz "Em breve"', !(await texto('nav[aria-label="Seções do financeiro"]')).includes('Em breve'));
});

await passo('T05.05: cartões por sócia', async () => {
  await irPara('/financeiro/socias', 'Sócias');
  ok('um cartão por sócia', await c.avaliar(`['Kimberly Grebe','Camila Lima'].every(n=>document.querySelector('section[aria-label="'+n+'"]'))`));
  const k = await cartao('Kimberly Grebe');
  ok('o cartão traz os cinco totais', ['Investimento líquido', 'Aportes', 'Retiradas e distribuições', 'Reembolsos pagos', 'Reembolsos em aberto'].every((x) => k.includes(x)), k);
  const movimentos = (await tabela('movimento_societario')).filter((m) => !m.arquivado_em);
  for (const [id, nome] of [[ID_KIMBERLY, 'Kimberly Grebe'], [ID_CAMILA, 'Camila Lima']]) {
    const dela = movimentos.filter((m) => m.socia_id === id);
    const liquido = somar(dela.filter((m) => m.tipo === 'aporte'), 'valor_brl') - somar(dela.filter((m) => m.tipo !== 'aporte'), 'valor_brl');
    ok(`CA-05.05: líquido de ${nome} é aportes menos retiradas`, (await cartao(nome)).includes(`Investimento líquido${reais(liquido)}`), await cartao(nome));
  }
  const botao = await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.includes('Nova retirada'))?.disabled`);
  ok('Nova retirada é da F1: "Em breve", sem clique', botao === true && (await texto('main')).includes('Nova retiradaEm breve'));
  await c.foto('a-socias', { inteira: true });
});

await passo('T05.05: lista de movimentos', async () => {
  const lista = await linhas('Movimentos das sócias');
  ok('um por movimento', lista.length === 3, lista.length);
  ok('as colunas da especificação', (await c.avaliar(`[...document.querySelectorAll('table[aria-label="Movimentos das sócias"] th')].map(t=>t.textContent).join('|')`)) === 'Data|Sócia|Tipo|Valor|Forma|Título de origem|Comprovante|Observação');
  const movimentos = await tabela('movimento_societario');
  const comOrigem = movimentos.find((m) => m.titulo_origem_id);
  ok('o título de origem é um link', await c.avaliar(`Boolean(document.querySelector('table[aria-label="Movimentos das sócias"] a[href="/financeiro/${comOrigem.titulo_origem_id}"]'))`));
  ok('o mais recente vem primeiro', [...movimentos].sort((a, b) => b.data.localeCompare(a.data))[0].data.split('-').reverse().join('/') === lista[0].slice(0, 10), lista[0]);
  await clicarBotao('Camila Lima');
  await c.espera(120);
  const daCamila = await linhas('Movimentos das sócias');
  ok('filtra por sócia', daCamila.every((l) => l.includes('Camila Lima')) && daCamila.length === movimentos.filter((m) => m.socia_id === ID_CAMILA).length, daCamila.length);
  await clicarBotao('Todas');
  await c.espera(100);
  await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>/^Filtros/.test(b.textContent.trim())).click()`);
  await c.ate(`document.querySelector('.menu-suspenso')`);
  await c.espera(120);
  await escolher('filtro-tipo', 'retirada');
  await c.tecla('Escape');
  await c.ate(`!document.querySelector('.menu-suspenso')`);
  await c.espera(120);
  ok('filtro sem resultado explica', (await texto('main')).includes('Nada com esses filtros') || (await texto('main')).includes('filtros'));
  await clicarBotao('Limpar filtros');
  await c.espera(120);
  ok('limpar volta tudo', (await linhas('Movimentos das sócias')).length === 3);
});

await passo('T05.05: novo aporte sem conta da Numa', async () => {
  await clicarBotao('Novo aporte em dinheiro');
  await dialogoAberto();
  await c.espera(200);
  ok('avisa e leva ao cadastro', (await texto('.dialogo')).includes('Ainda não há conta da Numa') && (await c.avaliar(`Boolean(document.querySelector('.dialogo a[href="/configuracoes/cadastros/contas"]'))`)));
  ok('conta pessoal não aparece', !(await opcoes('aporte-conta')).some((o) => o.includes('Cartão pessoal')));
  await c.foto('b-aporte-sem-conta');
  await clicarNoDialogo('Voltar');
  await dialogoFechado();
});

await passo('prepara contas da Numa', async () => {
  await novaConta(ID_BANCO, { nome: 'Banco Numa', tipo: 'banco', instituicao: 'Banco', moeda: 'BRL', saldo_inicial: 1000, data_saldo_inicial: diaISO(-90), situacao: 'ativa' });
  await novaConta(ID_RESERVA, { nome: 'Reserva Numa', tipo: 'banco', instituicao: 'Banco', moeda: 'BRL', saldo_inicial: 0, data_saldo_inicial: diaISO(-90), situacao: 'ativa' });
  await novaConta(ID_DOLAR, { nome: 'Conta em dólar', tipo: 'banco', instituicao: 'Banco', moeda: 'USD', saldo_inicial: 0, data_saldo_inicial: diaISO(-90), situacao: 'ativa' });
  await novaConta(ID_ENCERRADA, { nome: 'Antiga', tipo: 'caixa', instituicao: null, moeda: 'BRL', saldo_inicial: 10, data_saldo_inicial: diaISO(-90), situacao: 'encerrada' });
  await irPara('/financeiro/socias', 'Sócias');
  ok('as contas entraram', (await tabela('conta_financeira')).length === 6);
});

await passo('T05.05: novo aporte em dinheiro', async () => {
  const [titulosAntes, aportesAntes] = [(await tabela('titulo')).length, (await tabela('movimento_societario')).length];
  await clicarBotao('Novo aporte em dinheiro');
  await dialogoAberto();
  await c.espera(200);
  const contas = await opcoes('aporte-conta');
  ok('só contas da Numa, ativas e em reais', contas.includes('Banco Numa') && contas.includes('Reserva Numa') && !contas.some((o) => /dólar|Cartão|Antiga/.test(o)), contas.join(','));
  await clicarNoDialogo('Registrar aporte');
  await c.ate(`document.getElementById('aporte-socia-erro')`);
  ok('pede sócia, valor, conta e comprovante', (await erroDe('aporte-socia')) === 'Escolha a sócia.' && (await erroDe('aporte-valor')).includes('Informe o valor') && (await erroDe('aporte-conta')).includes('Escolha a conta') && (await erroDe('aporte-comprovante')).includes('comprovante'));
  await c.foto('c-aporte-erros');
  await escolher('aporte-socia', ID_KIMBERLY);
  await preencher('aporte-valor', '500,00');
  await escolher('aporte-conta', ID_BANCO);
  await preencher('aporte-comprovante', 'https://exemplo.com/x');
  await c.espera(120);
  ok('comprovante só no Drive', (await erroDe('aporte-comprovante')).includes('drive.google.com'), await erroDe('aporte-comprovante'));
  await c.avaliar(`[...document.querySelectorAll('.dialogo label')].find(l=>l.textContent.includes('Não tenho comprovante')).click()`);
  await c.ate(`document.getElementById('aporte-sem-comprovante-motivo-erro')`);
  await c.espera(400);
  ok('sem comprovante pede o motivo, e o erro fica', (await erroDe('aporte-sem-comprovante-motivo')).includes('Diga por que') && !(await c.avaliar(`Boolean(document.getElementById('aporte-comprovante'))`)));
  await c.avaliar(`[...document.querySelectorAll('.dialogo label')].find(l=>l.textContent.includes('Não tenho comprovante')).click()`);
  await c.ate(`document.getElementById('aporte-comprovante')`);
  await preencher('aporte-comprovante', DRIVE);
  await preencher('aporte-observacao', 'Capital para abrir a conta');
  await clicarNoDialogo('Registrar aporte');
  await esperarAviso('Aporte registrado.');
  await dialogoFechado();
  await c.espera(200);
  const movimentos = await tabela('movimento_societario');
  const novo = movimentos.find((m) => m.observacao === 'Capital para abrir a conta');
  ok('grava o aporte em dinheiro', movimentos.length === aportesAntes + 1 && novo?.tipo === 'aporte' && novo.forma === 'dinheiro' && novo.valor_brl === 500 && novo.conta_financeira_id === ID_BANCO && novo.comprovante_url === DRIVE, js(novo));
  ok('RN-05.11: aporte não vira título', (await tabela('titulo')).length === titulosAntes);
  ok('aparece na lista, com o comprovante', (await linhas('Movimentos das sócias'))[0].includes('Capital para abrir a conta') && (await c.avaliar(`Boolean(document.querySelector('table[aria-label="Movimentos das sócias"] a[href=${js(DRIVE)}]'))`)));
  const dela = movimentos.filter((m) => m.socia_id === ID_KIMBERLY && !m.arquivado_em);
  ok('o cartão soma o aporte', (await cartao('Kimberly Grebe')).includes(`Investimento líquido${reais(somar(dela.filter((m) => m.tipo === 'aporte'), 'valor_brl'))}`), await cartao('Kimberly Grebe'));
});

await passo('T05.05: pagar reembolso', async () => {
  const antes = await cartao('Camila Lima');
  const lista = await linhas('Reembolsos em aberto');
  ok('lista o que a Numa deve', lista.length === 1 && lista[0].includes('Reembolso: Nuvem Clara Hosting · Pro') && lista[0].includes('Camila Lima') && espacos(lista[0]).includes('R$ 112,05'), lista.join(' ; '));
  await clicarBotao('Pagar reembolso: Reembolso: Nuvem Clara Hosting · Pro');
  await dialogoAberto();
  await c.espera(200);
  ok('abre a baixa do título, com o saldo', (await naTela('.dialogo')).includes('Reembolso: Nuvem Clara Hosting · Pro') && (await naTela('.dialogo')).includes('R$ 112,05') && (await valor('baixa-valor')) === '112,05');
  await escolher('baixa-conta', ID_CONTA_KIMBERLY);
  await preencher('baixa-comprovante', DRIVE);
  await clicarNoDialogo('Registrar baixa');
  await c.ate(`document.getElementById('baixa-conta-erro')`);
  ok('reembolso é pago por conta da empresa', (await erroDe('baixa-conta')).includes('conta da empresa'), await erroDe('baixa-conta'));
  await escolher('baixa-conta', ID_BANCO);
  await clicarNoDialogo('Registrar baixa');
  await esperarAviso('Baixa registrada.');
  await dialogoFechado();
  await c.ate(`document.querySelector('main').textContent.includes('Nenhum reembolso em aberto.')`);
  ok('sai da lista', true);
  const depois = await cartao('Camila Lima');
  ok('os reembolsos do cartão mudam', depois.includes('Reembolsos em aberto' + reais(0)) && depois.includes('Reembolsos pagos' + reais(112.05)), depois);
  const liquido = (t) => t.match(/Investimento líquido(R\$ [\d.,-]+)/)?.[1];
  ok('CA-05.05: o investimento líquido não muda', liquido(antes) === liquido(depois) && Boolean(liquido(depois)), `${liquido(antes)} ${liquido(depois)}`);
});

await passo('T05.05: relatório', async () => {
  const principal = await naTela();
  ok('explica o período: sem PJ ativa, vale até hoje', principal.includes('Investimento das sócias no período pré-operacional') && principal.includes('Ainda não há PJ ativa'));
  const lista = await linhas('Investimento por sócia e por mês');
  const movimentos = (await tabela('movimento_societario')).filter((m) => !m.arquivado_em);
  const chaves = new Set(movimentos.map((m) => m.data.slice(0, 7) + m.socia_id));
  ok('uma linha por sócia e por mês', lista.length === chaves.size, `${lista.length} ${chaves.size}`);
  const consolidado = await c.avaliar(`[...document.querySelectorAll('ul[aria-label="Consolidado por sócia"] li')].map(l=>l.textContent)`);
  const aportes = somar(movimentos.filter((m) => m.socia_id === ID_KIMBERLY && m.tipo === 'aporte'), 'valor_brl');
  const camila = espacos(consolidado.find((l) => l.startsWith('Camila Lima')) ?? '');
  const reembolsosDaCamila = reais((await tabela('titulo')).filter((x) => x.origem === 'reembolso' && x.beneficiario_pessoa_id === ID_CAMILA && x.situacao !== 'cancelado' && x.situacao !== 'quitado').reduce((t, x) => t + x.valor, 0));
  ok('aportes líquidos e reembolsos em aberto separados, sem somar (decisão de 06/11)', consolidado.length === 2 && espacos(consolidado[0]).includes(`Aportes líquidos${reais(aportes)}`) && camila.includes(`Reembolsos em aberto${reembolsosDaCamila}`) && !consolidado.some((l) => l.includes('=')), espacos(consolidado.join(' ; ')));
  ok('a nota explica por que não soma', (await naTela()).includes('quem diz é o contador'));
  const botoes = await c.avaliar(`(()=>{const s=[...document.querySelectorAll('main section')].find(x=>x.textContent.includes('Consolidado')||x.querySelector('ul[aria-label="Consolidado por sócia"]'));[...s.querySelectorAll('button')].find(b=>b.textContent.trim()==='Exportar').click();return true})()`);
  await esperarAviso('linhas exportadas.');
  const nome = await baixado('investimento-das-socias');
  ok('exporta um CSV com a data', botoes && nome === `investimento-das-socias-${diaISO()}.csv`, nome);
  const arquivo = readFileSync(path.join(downloads, nome), 'utf8').replace(/^﻿/, '').split('\r\n');
  ok('com os meses e o consolidado', arquivo[0] === 'Período;Sócia;Aportes;Retiradas e distribuições;Aportes líquidos;Reembolsos em aberto' && arquivo.some((l) => l.startsWith('Consolidado;Kimberly Grebe')) && arquivo.length === lista.length + 3, arquivo.join(' / ').slice(0, 300));
});

await passo('T05.06: transferências', async () => {
  const titulosAntes = (await tabela('titulo')).length;
  const baixasAntes = (await tabela('baixa')).length;
  await irPara('/financeiro/transferencias', 'Transferências');
  ok('começa vazia, com o que fazer', (await texto('main')).includes('Nenhuma transferência ainda.'));
  await c.foto('d-transferencias-vazia');
  await clicarBotao('Nova transferência');
  await dialogoAberto();
  await c.espera(200);
  const contas = await opcoes('transferencia-origem');
  ok('só contas da Numa, ativas, com a moeda', contas.includes('Banco Numa (BRL)') && contas.includes('Conta em dólar (USD)') && !contas.some((o) => /Cartão pessoal|Antiga/.test(o)), contas.join(','));
  await clicarNoDialogo('Registrar transferência');
  await c.ate(`document.getElementById('transferencia-origem-erro')`);
  ok('pede as contas e o valor', (await erroDe('transferencia-origem')).includes('origem') && (await erroDe('transferencia-destino')).includes('destino') && (await erroDe('transferencia-valor')).includes('Informe o valor'));
  await escolher('transferencia-origem', ID_BANCO);
  await escolher('transferencia-destino', ID_BANCO);
  await preencher('transferencia-valor', '200,00');
  await c.ate(`document.getElementById('transferencia-destino-erro')?.textContent.includes('outra')`);
  await c.espera(400);
  ok('a mesma conta não pode, e o erro fica', (await erroDe('transferencia-destino')) === 'A conta de destino precisa ser outra.');
  ok('o rótulo do valor diz a moeda', (await naTela('.dialogo')).includes('Valor em BRL'));
  ok('mesma moeda não pede câmbio', !(await c.avaliar(`Boolean(document.getElementById('transferencia-cambio'))`)));
  await escolher('transferencia-destino', ID_DOLAR);
  await c.ate(`document.getElementById('transferencia-cambio')`);
  await c.espera(120);
  ok('moeda diferente pede câmbio e quanto chegou', (await naTela('.dialogo')).includes('Chegou em USD'));
  await preencher('transferencia-valor', '540,00');
  await preencher('transferencia-cambio', '5,4');
  await c.ate(`document.getElementById('transferencia-chegou').value==='100,00'`);
  ok('calcula quanto chega', true);
  await preencher('transferencia-chegou', '99,50');
  await c.foto('e-transferencia-cambio');
  await preencher('transferencia-comprovante', DRIVE);
  await preencher('transferencia-observacao', 'senha: abc12345');
  await clicarNoDialogo('Registrar transferência');
  await c.ate(`document.querySelector('.dialogo').textContent.includes('não guarda segredos')`);
  ok('RT-14: texto que parece senha avisa antes de gravar', (await tabela('transferencia')).length === 0);
  await preencher('transferencia-observacao', 'Para pagar assinaturas');
  await c.espera(120);
  ok('tirou a senha, o aviso some', !(await texto('.dialogo')).includes('não guarda segredos'));
  await clicarNoDialogo('Registrar transferência');
  await esperarAviso('Transferência registrada.');
  await dialogoFechado();
  await c.espera(200);
  const [salva] = await tabela('transferencia');
  ok('grava as duas pernas', salva.conta_origem_id === ID_BANCO && salva.valor_origem === 540 && salva.moeda_origem === 'BRL' && salva.conta_destino_id === ID_DOLAR && salva.valor_destino === 99.5 && salva.moeda_destino === 'USD' && salva.cambio === 5.4, js(salva));
  ok('RN-05.10: não é receita nem despesa', (await tabela('titulo')).length === titulosAntes && (await tabela('baixa')).length === baixasAntes);
  const lista = await linhas('Transferências');
  ok('aparece na lista, com as contas e os valores', lista.length === 1 && lista[0].includes('Banco Numa') && lista[0].includes('Conta em dólar') && espacos(lista[0]).includes('R$ 540,00') && lista[0].includes('US$') && lista[0].includes('5,4'), espacos(lista[0]));
  await clicarBotao('Nova transferência');
  await dialogoAberto();
  await c.espera(200);
  await escolher('transferencia-origem', ID_BANCO);
  await escolher('transferencia-destino', ID_RESERVA);
  await preencher('transferencia-valor', '100,00');
  await clicarNoDialogo('Registrar transferência');
  await c.ate(`document.getElementById('transferencia-comprovante-erro')`);
  ok('D17: pede o comprovante, ou o motivo de não ter', (await erroDe('transferencia-comprovante')).includes('marque que não tem'), await erroDe('transferencia-comprovante'));
  await c.avaliar(`[...document.querySelectorAll('.dialogo label')].find(l=>l.textContent.includes('Não tenho comprovante')).click()`);
  await c.ate(`document.getElementById('transferencia-sem-comprovante-motivo')`);
  await c.espera(120);
  await preencher('transferencia-sem-comprovante-motivo', 'Pelo aplicativo, sem recibo');
  await clicarNoDialogo('Registrar transferência');
  await dialogoFechado();
  await c.espera(200);
  ok('sem comprovante, o motivo fica na observação', (await tabela('transferencia')).some((t) => t.comprovante_url === null && t.observacao === 'Sem comprovante: Pelo aplicativo, sem recibo'));
  await c.foto('f-transferencias');
  await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>/^Filtros/.test(b.textContent.trim())).click()`);
  await c.ate(`document.querySelector('.menu-suspenso')`);
  await c.espera(120);
  await escolher('filtro-conta', ID_RESERVA);
  await c.tecla('Escape');
  await c.ate(`!document.querySelector('.menu-suspenso')`);
  await c.espera(120);
  const filtrada = await linhas('Transferências');
  ok('filtra por conta, em qualquer ponta', filtrada.length === 1 && filtrada[0].includes('Reserva Numa'), filtrada.join(' ; '));
  await clicarBotao('Limpar filtros');
  await c.espera(120);
  ok('limpar volta as duas', (await linhas('Transferências')).length === 2);
});

await passo('T05.07: contas e saldos', async () => {
  await irPara('/financeiro/contas', 'Contas e saldos');
  const principal = await naTela();
  const cartaoDa = (nome) => c.avaliar(`[...document.querySelectorAll('ul[aria-label="Contas"] li')].map(l=>l.textContent).find(t=>t.startsWith(${js(nome)}))`);
  const banco = espacos(await cartaoDa('Banco Numa'));
  // 1000 + 500 de aporte − 112,05 de reembolso − 540 − 100 de transferências.
  ok('RN-05.16: saldo = inicial + entradas − saídas', banco.includes(reais(747.95)), banco);
  ok('o cartão traz tipo, titular e última movimentação', banco.includes('Conta bancária') && banco.includes('Kimberly Grebe') && banco.includes('Última movimentação em '), banco);
  ok('conta em dólar soma em dólar', (await cartaoDa('Conta em dólar')).includes('US$') && (await cartaoDa('Conta em dólar')).includes('99,50'), await cartaoDa('Conta em dólar'));
  const pessoal = espacos(await cartaoDa('Cartão pessoal — Kimberly'));
  ok('conta pessoal de sócia não tem saldo', pessoal.includes('Sem saldo controlado') && pessoal.includes('Conta pessoal de sócia'), pessoal);
  ok('encerrada aparece, marcada, por último', (await cartaoDa('Antiga')).includes('Encerrada') && (await c.avaliar(`[...document.querySelectorAll('ul[aria-label="Contas"] li')].at(-1).textContent.startsWith('Antiga')`)));
  ok('sem movimentação, diz isso', (await cartaoDa('Antiga')).includes('Nenhuma movimentação ainda'));
  ok('leva ao cadastro das contas', principal.includes('Cadastrar conta') && (await c.avaliar(`Boolean(document.querySelector('main a[href="/configuracoes/cadastros/contas"]'))`)));
  await c.foto('g-contas', { inteira: true });
  await c.avaliar(`document.querySelector('ul[aria-label="Contas"] a[href="/financeiro/contas/${ID_BANCO}"]').click()`);
  await c.ate(`location.pathname==='/financeiro/contas/${ID_BANCO}'&&document.querySelector('main h1')?.textContent.includes('Banco Numa')`);
  await c.espera(160);
  ok('a ficha mostra o saldo atual e as abas', (await naTela()).includes(`Saldo atual: ${reais(747.95)}`) && (await abasDaFicha()) === 'Extrato|Conferências|Histórico', await abasDaFicha());
  ok('explica de onde o saldo parte', (await naTela()).includes(`Saldo inicial de ${reais(1000)}`));
  const extrato = (await linhas('Extrato de Banco Numa')).map(espacos);
  ok('o extrato tem as baixas, as transferências e o aporte', extrato.length === 4 && extrato.some((l) => l.includes('Aporte em dinheiro')) && extrato.some((l) => l.includes('Reembolso: Nuvem Clara')) && extrato.filter((l) => l.includes('Transferência enviada')).length === 2, extrato.join(' ; '));
  ok('com o saldo acumulado em cada linha', extrato[0].includes(reais(747.95)), extrato[0]);
  ok('as linhas levam ao que as gerou', await c.avaliar(`['/financeiro/transferencias','/financeiro/socias'].every(h=>document.querySelector('table[aria-label="Extrato de Banco Numa"] a[href="'+h+'"]'))`));
  await c.foto('h-extrato', { inteira: true });
});

await passo('T05.07: conferir saldo', async () => {
  await clicarBotao('Conferir saldo');
  await dialogoAberto();
  await c.espera(200);
  ok('começa em hoje, sem nada marcado', (await valor('conferencia-data')) === diaISO() && !(await texto('.dialogo')).includes('Motivo do ajuste'));
  await clicarNoDialogo('Registrar conferência');
  await c.ate(`document.getElementById('conferencia-saldo-erro')`);
  ok('pede o saldo do banco', (await erroDe('conferencia-saldo')).includes('Informe o saldo'));
  await preencher('conferencia-saldo', '700,00');
  await c.espera(120);
  const comparacao = await naTela('.dialogo dl');
  ok('mostra o sistema e a diferença', comparacao.includes(reais(747.95)) && comparacao.includes('-R$ 47,95'), comparacao);
  await c.foto('i-conferir');
  await clicarNoDialogo('Registrar conferência');
  await esperarAviso('Conferência registrada.');
  await dialogoFechado();
  await c.espera(200);
  ok('não ajusta sozinho', (await naTela()).includes(`Saldo atual: ${reais(747.95)}`) && !(await tabela('titulo')).some((t) => t.origem === 'ajuste'));
  const [primeira] = await tabela('conferencia_saldo');
  ok('guarda a conferência', primeira.saldo_informado === 700 && primeira.saldo_sistema === 747.95 && primeira.diferenca === -47.95 && primeira.ajuste_titulo_id === null, js(primeira));
  await aba('Conferências');
  ok('a aba lista, e diz que ficou sem ajuste', (await naTela()).includes('Sem ajuste') && (await naTela()).includes(reais(700)));
  await clicarBotao('Conferir saldo');
  await dialogoAberto();
  await c.espera(200);
  await preencher('conferencia-saldo', '747,95');
  await c.espera(120);
  ok('sem diferença, não oferece ajuste', !(await texto('.dialogo')).includes('Criar um ajuste'));
  await preencher('conferencia-saldo', '700,00');
  await c.espera(120);
  await c.avaliar(`[...document.querySelectorAll('.dialogo label')].find(l=>l.textContent.includes('Criar um ajuste')).click()`);
  await c.ate(`document.getElementById('conferencia-motivo')`);
  await clicarNoDialogo('Registrar conferência');
  await c.ate(`document.getElementById('conferencia-motivo-erro')`);
  await c.espera(400);
  ok('o ajuste exige motivo', (await erroDe('conferencia-motivo')) === 'Diga por que está ajustando.');
  await preencher('conferencia-motivo', 'Tarifa que não foi lançada');
  await clicarNoDialogo('Registrar conferência');
  await esperarAviso('Conferência registrada, com o ajuste.');
  await dialogoFechado();
  await c.espera(240);
  ok('com o ajuste, o saldo fica igual ao do banco', (await naTela()).includes(`Saldo atual: ${reais(700)}`), (await naTela()).slice(0, 300));
  const ajuste = (await tabela('titulo')).find((t) => t.origem === 'ajuste');
  ok('o ajuste é um título quitado, com o motivo', ajuste?.situacao === 'quitado' && ajuste.valor === 47.95 && ajuste.natureza === 'pagar' && ajuste.observacao === 'Tarifa que não foi lançada', js(ajuste));
  await aba('Extrato');
  ok('o ajuste aparece no extrato', (await linhas('Extrato de Banco Numa')).some((l) => l.includes('Ajuste de saldo: Banco Numa')));
  await aba('Conferências');
  ok('a conferência leva ao ajuste', await c.avaliar(`Boolean(document.querySelector('main a[href="/financeiro/${ajuste.id}"]'))`));
  await aba('Histórico');
  await c.ate(`document.querySelector('main').textContent.includes('conferência de saldo')`);
  ok('o histórico da conta conta o que houve', (await texto('main')).includes('transferência'));
  await irPara(`/financeiro/${ajuste.id}`, 'Ajuste de saldo: Banco Numa');
  ok('a ficha do ajuste mostra a origem', (await texto('main')).includes('Ajuste'));
  await clicarBotao('Mais ações do lançamento');
  await c.ate(`document.querySelector('.menu-suspenso')`);
  await c.espera(160);
  ok('ajuste não se duplica', !(await texto('.menu-suspenso')).includes('Duplicar'));
  await c.tecla('Escape');
  await c.ate(`!document.querySelector('.menu-suspenso')`);
});

await passo('T05.07: conta sem saldo controlado', async () => {
  await irPara(`/financeiro/contas/${ID_CONTA_KIMBERLY}`, 'Cartão pessoal — Kimberly');
  ok('não tem saldo nem conferência', (await naTela()).includes('Sem saldo controlado') && (await abasDaFicha()) === 'Extrato|Histórico' && !(await c.avaliar(`[...document.querySelectorAll('main button')].some(b=>b.textContent.trim()==='Conferir saldo')`)), await abasDaFicha());
  const lista = await linhas('Extrato de Cartão pessoal — Kimberly');
  ok('o extrato continua, sem a coluna de saldo', lista.length >= 1 && !(await c.avaliar(`[...document.querySelectorAll('table[aria-label="Extrato de Cartão pessoal — Kimberly"] th')].some(t=>t.textContent.includes('Saldo'))`)), lista.length);
});

await passo('T05.07: conta encerrada', async () => {
  await irPara(`/financeiro/contas/${ID_ENCERRADA}`, 'Antiga');
  ok('conta encerrada mostra o saldo, e não oferece conferir', (await naTela()).includes('Saldo atual') && (await texto('main')).includes('Encerrada') && !(await c.avaliar(`[...document.querySelectorAll('main button')].some(b=>b.textContent.trim()==='Conferir saldo')`)));
  await irPara('/financeiro/contas/nao-existe', 'Contas').catch(() => {});
  await c.ate(`document.querySelector('main').textContent.includes('Essa conta não existe mais.')`);
  ok('conta que não existe explica', true);
});

await passo('estornar transferência (decisão de 06/11)', async () => {
  await irPara('/financeiro/transferencias', 'Transferências');
  const antes = (await tabela('transferencia')).length;
  const original = (await tabela('transferencia')).find((t) => t.conta_destino_id === ID_DOLAR);
  await clicarBotao(`Estornar a transferência de ${original.data.split('-').reverse().join('/')}`);
  await dialogoAberto();
  await c.espera(200);
  ok('o diálogo explica o que acontece', (await texto('.dialogo')).includes('transferência inversa, de Conta em dólar para Banco Numa'), await texto('.dialogo'));
  await clicarNoDialogo('Estornar');
  await c.ate(`document.querySelector('.dialogo')?.textContent.includes('Diga por que está estornando.')`);
  ok('pede o motivo', true);
  await c.avaliar(`(()=>{const e=document.querySelector('.dialogo textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'Foi para a conta errada');e.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  await c.espera(60);
  await clicarNoDialogo('Estornar');
  await esperarAviso('Transferência estornada.');
  await dialogoFechado();
  await c.espera(300);
  const estorno = (await tabela('transferencia')).find((t) => t.transferencia_original_id === original.id);
  ok('lança a inversa, ligada à original', (await tabela('transferencia')).length === antes + 1 && estorno?.conta_origem_id === ID_DOLAR && estorno.conta_destino_id === ID_BANCO && estorno.valor_origem === 99.5 && estorno.valor_destino === 540 && estorno.data === diaISO() && estorno.observacao === 'Estorno: Foi para a conta errada', js(estorno));
  const lista = await linhas('Transferências');
  ok('a lista marca as duas, e só a normal oferece estornar', lista.some((l) => l.includes('Estornada')) && lista.some((l) => l.includes('Estorno:')) && (await c.avaliar(`[...document.querySelectorAll('table[aria-label="Transferências"] button')].filter(b=>b.textContent.trim()==='Estornar').length`)) === 1, lista.join(' ; '));
  await c.foto('p-estorno', { inteira: true });
  await irPara('/financeiro/contas', 'Contas e saldos');
  const cartaoDa = (nome) => c.avaliar(`[...document.querySelectorAll('ul[aria-label="Contas"] li')].map(l=>l.textContent).find(t=>t.startsWith(${js(nome)}))`);
  ok('os saldos voltam', espacos(await cartaoDa('Banco Numa')).includes(reais(1240)) && espacos(await cartaoDa('Conta em dólar')).includes('US$ 0,00'), `${espacos(await cartaoDa('Banco Numa'))} | ${espacos(await cartaoDa('Conta em dólar'))}`);
});

await passo('responsivo', async () => {
  for (const largura of [1440, 768, 360]) {
    await c.tamanho(largura, largura === 360 ? 780 : 900);
    await irPara('/financeiro/socias', 'Sócias');
    await conferirTela('Sócias', largura);
    if (largura === 360) await c.foto('j-socias-360', { inteira: true });
    await irPara('/financeiro/transferencias', 'Transferências');
    await conferirTela('Transferências', largura);
    if (largura === 360) await c.foto('k-transferencias-360', { inteira: true });
    await irPara('/financeiro/contas', 'Contas e saldos');
    await conferirTela('Contas', largura);
    if (largura === 360) await c.foto('l-contas-360', { inteira: true });
    await irPara(`/financeiro/contas/${ID_BANCO}`, 'Banco Numa');
    await conferirTela('Extrato', largura);
    if (largura === 360) await c.foto('m-extrato-360', { inteira: true });
    await aba('Conferências');
    await conferirTela('Conferências', largura);
    await clicarBotao('Conferir saldo');
    await dialogoAberto();
    await c.espera(240);
    await conferirTela('Conferir saldo', largura);
    if (largura === 360) await c.foto('n-conferir-360');
    await clicarNoDialogo('Voltar');
    await dialogoFechado();
  }
  await irPara('/financeiro/socias', 'Sócias');
  await clicarBotao('Novo aporte em dinheiro');
  await dialogoAberto();
  await c.espera(240);
  await conferirTela('Novo aporte', 360);
  await c.foto('o-aporte-360');
  await clicarNoDialogo('Voltar');
  await dialogoFechado();
  await irPara('/financeiro/transferencias', 'Transferências');
  await clicarBotao('Nova transferência');
  await dialogoAberto();
  await c.espera(240);
  await conferirTela('Nova transferência', 360);
  await clicarNoDialogo('Voltar');
  await dialogoFechado();
  await c.tamanho(1440, 900);
});

await terminar();
