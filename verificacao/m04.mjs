// Revisão do M04 (07/11/2026): T04.01 a T04.05 com os protótipos de Prototipos/Imagens/M04, no sistema real.
// As suítes t0401 e t0404 continuam valendo para as regras de cada tela; esta confere o que a revisão mudou.
import { iniciar } from './apoio.mjs';

const h = await iniciar({ nome: 'm04', porta: 9426 });
const { c, ok, passo, ir, texto, valor, preencher, escolher, marcarPilula, pilulaMarcada, clicarNoDialogo, dialogoAberto, dialogoFechado, painelAberto, painelFechado, pularAbertura, tabela, esperarAviso, conferirTela, terminar } = h;

const js = (v) => JSON.stringify(v);
const hoje = new Date();
const diaISO = (dias = 0) => new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + dias)).toISOString().slice(0, 10);
const dataBr = (iso) => iso.split('-').reverse().join('/');
const clicarBotao = (rotulo, onde = 'main') => c.avaliar(`(()=>{const b=[...document.querySelectorAll(${js(onde + ' button')})].find(b=>(b.textContent.trim()===${js(rotulo)}||b.getAttribute('aria-label')===${js(rotulo)})&&b.getClientRects().length);if(!b)throw new Error('sem botão: '+${js(rotulo)});b.click()})()`);
const temBotao = (rotulo, onde = 'main') => c.avaliar(`[...document.querySelectorAll(${js(onde + ' button')})].some(b=>b.textContent.trim()===${js(rotulo)}&&b.getClientRects().length)`);
const irLista = async (caminho = '/ferramentas') => {
  await ir(caminho);
  await c.ate(`document.querySelector('main table tbody tr, main ul li')`);
  await c.espera(160);
};
const ferramenta = async (nome) => (await tabela('ferramenta')).find((f) => f.nome === nome);
const abrirFicha = async (nome) => {
  const f = await ferramenta(nome);
  await ir(`/ferramentas/${f.id}`);
  await c.ate(`document.querySelector('main h1')?.textContent.includes(${js(nome)})`);
  await c.ate(`document.querySelector('main').textContent.includes('Último pagamento')`);
  await c.espera(200);
  return f;
};
const aba = async (rotulo) => {
  const achar = `[...document.querySelectorAll('main [role=tab]')].find(a=>a.textContent.trim()===${js(rotulo)})`;
  const abrir = (alvo) => c.avaliar(`(()=>{const a=${alvo};a.focus();a.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}))})()`);
  if (!(await c.avaliar(`Boolean(${achar})`))) {
    await abrir(`[...document.querySelectorAll('main [role=tab]')].find(a=>a.textContent.trim()==='Mais áreas')`);
    await c.ate(`Boolean(${achar})`);
  }
  await abrir(achar);
  await c.espera(200);
};
const abrirMenu = async (rotulo = 'Mais ações da ferramenta') => {
  await clicarBotao(rotulo);
  await c.ate(`document.querySelector('.menu-suspenso, .dialogo')`);
  await c.espera(160);
};
const textoDoMenu = () => c.avaliar(`[...document.querySelectorAll('.menu-suspenso li, .dialogo li')].map(l=>l.textContent.trim()).join('|')`);
const irParaEtapa = async (numero) => {
  await c.avaliar(`[...document.querySelectorAll('.janela ol[aria-label="Etapas"] button')][${numero - 1}].click()`);
  await c.espera(80);
};
const rodarRotinas = async () => {
  // O vencimento mais próximo dos exemplos fica a 4 dias; o padrão avisa com 3.
  await c.avaliar(`(()=>{const k='numa-central:v1:configuracao';const t=JSON.parse(localStorage.getItem(k)||'[]');const r=t.find(x=>x.chave==='alerta_vencimento_dias');if(!r)throw new Error('sem a chave alerta_vencimento_dias');r.valor=10;localStorage.setItem(k,JSON.stringify(t))})()`);
  await c.avaliar(`(()=>{const m=JSON.parse(localStorage.getItem('numa-central:v1:meta'));m.ultima_rotina_em=null;localStorage.setItem('numa-central:v1:meta',JSON.stringify(m))})()`);
  await ir('/configuracoes/dados');
  await c.ate(`[...document.querySelectorAll('main button')].some(b=>b.textContent.includes('Rodar rotinas'))`);
  await c.espera(200);
  await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.includes('Rodar rotinas')).click()`);
  await c.espera(1500);
};

await c.tamanho(1440, 900);

await passo('T04.01: lista revista', async () => {
  await ir('/ferramentas');
  await pularAbertura();
  await c.ate(`document.querySelector('main table tbody tr')`);
  const indicadores = await c.avaliar(`[...document.querySelectorAll('[aria-label="Resumo das ferramentas"] > div')].map(d=>d.textContent)`);
  ok('o indicador conta cobranças, e não renovações', indicadores.some((t) => t.startsWith('Cobranças nos próximos 30 dias')) && !indicadores.join().includes('Renovações'), js(indicadores));
  ok('D14: nada de acessos nem duas chaves na lista', !(await texto('main')).toLowerCase().includes('duas chaves') && !(await texto('main')).includes('Acessos'));
  ok('Nova ferramenta no cabeçalho, separada das utilidades', await c.avaliar(`!document.querySelector('[aria-label="Utilidades da lista"]').textContent.includes('Nova ferramenta')`));
  ok('Visões, Colunas e Exportar juntas, com a contagem', await c.avaliar(`(()=>{const u=document.querySelector('[aria-label="Utilidades da lista"]').textContent;return ['Visões','Colunas','Exportar','6 ferramentas'].every(t=>u.includes(t))})()`));
  ok('busca e filtros logo acima da lista', await c.avaliar(`(()=>{const busca=document.querySelector('main input[type=search]').getBoundingClientRect();const tabela=document.querySelector('main table').getBoundingClientRect();return busca.bottom<tabela.top&&tabela.top-busca.bottom<140})()`));
  ok('sem seleção, sem ações em lote', !(await c.avaliar(`Boolean(document.querySelector('[aria-label="Ações em lote"]'))`)));
  ok('compartilhada aparece uma vez, com os dois produtos', await c.avaliar(`(()=>{const l=[...document.querySelectorAll('main table tbody tr')].filter(tr=>tr.textContent.includes('Nuvem Clara Hosting'));return l.length===1&&l[0].textContent.includes('Kipi')&&l[0].textContent.includes('Zupi')})()`));
  await conferirTela('lista', 1440);
  await c.foto('a-lista-1440');
});

await passo('T04.03: cadastro, custo e prévia ao vivo', async () => {
  await irLista();
  await clicarBotao('Nova ferramenta');
  await painelAberto();
  await c.espera(320);
  ok('etapa 1 de 3, com navegação livre', (await texto('.janela')).includes('Etapa 1 de 3'));
  await preencher('ferramenta-nome', 'Revisão paga');
  await c.avaliar(`(()=>{const s=document.getElementById('ferramenta-categoria');const o=[...s.options].find(o=>o.textContent.startsWith('IA'));Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,o.value);s.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await preencher('ferramenta-finalidade', 'Conferir a revisão');
  if (!(await pilulaMarcada('Contexto', 'Numa'))) await marcarPilula('Contexto', 'Numa');
  await irParaEtapa(2);
  const etapa2 = await texto('.janela');
  ok('autenticação em duas etapas por extenso, sem a sigla', etapa2.includes('Autenticação em duas etapas') && !etapa2.includes('MFA'));
  ok('referência ao cofre fica recolhida e opcional', await c.avaliar(`(()=>{const d=[...document.querySelectorAll('.janela details')].find(x=>x.textContent.includes('Referência ao cofre'));return d&&!d.open&&d.querySelector('summary').textContent.includes('opcional')})()`));
  ok('o desejado não muda o atual, e depende da entidade', etapa2.includes('Escolher o desejado não muda o titular atual'));
  await irParaEtapa(1);
  await marcarPilula('Crítica', 'Sim');
  await irParaEtapa(2);
  ok('crítica: caminho de recuperação recomendado, não obrigatório', (await texto('.janela')).includes('Opcional, mas recomendado') && !(await c.avaliar(`document.querySelector('label[for="ferramenta-recuperacao"]').textContent.includes('*')`)));
  await irParaEtapa(3);
  ok('modalidade com três opções', (await c.avaliar(`[...[...document.querySelectorAll('.janela fieldset')].find(f=>f.querySelector('legend')?.textContent.startsWith('Modalidade')).querySelectorAll('label')].map(l=>l.textContent).join()`)) === 'Gratuita,Paga,Teste');
  await marcarPilula('Modalidade', 'Paga');
  await c.espera(100);
  await preencher('ferramenta-plano', 'Pro');
  await escolher('ferramenta-periodicidade', 'mensal');
  await preencher('ferramenta-proxima', diaISO(10));
  await c.espera(200);
  const semValor = await texto('[aria-label="Prévia de cobranças"]');
  ok('sem valor, a prévia diz que aguarda, e não mostra zero', semValor.includes('Aguarda o valor') && semValor.includes('A confirmar') && !semValor.includes('0,00'), semValor);
  await preencher('ferramenta-valor', '25,00');
  await c.espera(200);
  const previa = await c.avaliar(`[...document.querySelectorAll('[aria-label="Prévia de cobranças"] li')].map(l=>l.textContent)`);
  ok('mensal: três cobranças a gerar, com data e valor', previa.length === 3 && previa[0].startsWith(dataBr(diaISO(10))) && previa.every((l) => l.includes('25,00') && l.includes('A gerar')), js(previa));
  ok('a referência mensal não é pagamento', (await texto('[aria-label="Prévia de cobranças"]')).includes('Não é pagamento'));
  await escolher('ferramenta-periodicidade', 'anual');
  await c.espera(200);
  const anual = await texto('[aria-label="Prévia de cobranças"]');
  ok('anual: só a próxima, e o mensal é só referência', (await c.avaliar(`document.querySelectorAll('[aria-label="Prévia de cobranças"] li').length`)) === 1 && anual.includes('continua anual'), anual);
  await conferirTela('formulário, custo', 1440);
  await c.foto('b-custo-1440');
  await clicarBotao('Definir custo depois', '.janela');
  await c.espera(120);
  ok('"Definir custo depois" tira a modalidade, sem virar gratuita', (await pilulaMarcada('Modalidade', 'Gratuita')) === false && (await pilulaMarcada('Modalidade', 'Paga')) === false && (await texto('.janela')).includes('A definir não é gratuita'));
  await clicarNoDialogo('Salvar ferramenta');
  await esperarAviso('Ferramenta criada.');
  await painelFechado();
  const f = await ferramenta('Revisão paga');
  ok('salva com o custo a definir: sem assinatura e sem lançamento', !(await tabela('assinatura_ferramenta')).some((a) => a.ferramenta_id === f.id) && !(await tabela('titulo')).some((t) => t.ferramenta_id === f.id));
});

await passo('T04.02: ficha organizada', async () => {
  await abrirFicha('Nuvem Clara Hosting');
  const abas = await c.avaliar(`[...document.querySelectorAll('main [role=tab]')].map(a=>a.textContent.trim())`);
  ok('cinco abas, com as complementares em Mais áreas', js(abas) === js(['Resumo', 'Assinatura e custos', 'Produtos e rateio', 'Dados pessoais', 'Mais áreas']), js(abas));
  const m = (await texto('main')).replaceAll('\u00a0', ' ');
  ok('lateral: próxima cobrança, último pagamento e o que falta', ['Próxima cobrança', 'Último pagamento', 'O que falta'].every((t) => m.includes(t)));
  ok('previsto e efetivo separados: US$ na cobrança, R$ efetivos no pagamento', m.includes('US$ 20,00') && m.includes('efetivos') && m.includes('vencimento previsto'), m.slice(0, 300));
  ok('sem câmbio, não inventa estimativa', m.includes('Sem estimativa em reais'));
  ok('titularidade lê a entidade: a Numa ainda não tem PJ ativa', m.includes('Transferência a planejar: a Numa ainda não tem entidade PJ ativa.'));
  ok('crítica sem caminho de recuperação: recomendação', m.includes('Recomendado: registrar o caminho de recuperação'));
  ok('crítica: avisa os produtos afetados', m.includes('a indisponibilidade pode afetar Kipi e Zupi'));
  ok('duas etapas por extenso, com texto', m.includes('Autenticação em duas etapas') && !m.includes('MFA'));
  ok('ação principal: Registrar pagamento, com lançamento em aberto', await temBotao('Registrar pagamento'));
  await abrirMenu();
  const menu = await textoDoMenu();
  ok('Mais ações: trocar plano, vincular, cancelar e arquivar', ['Trocar plano', 'Vincular lançamento existente', 'Cancelar ferramenta', 'Arquivar'].every((t) => menu.includes(t)) && !menu.includes('Registrar pagamento'), menu);
  await c.tecla('Escape');
  await c.ate(`!document.querySelector('.menu-suspenso')`);
  await c.espera(160);
  await conferirTela('ficha, resumo', 1440);
  await c.foto('c-ficha-1440');
  await aba('Assinatura e custos');
  const custos = await texto('main');
  ok('assinatura: dia de cobrança, renovação e geração', ['Dia de cobrança', 'Automática', 'Geração de lançamentos', 'Ligada'].every((t) => custos.includes(t)), custos.slice(0, 400));
  ok('lançamentos: vencimento previsto, valor original, pagamento e valor efetivo', ['Vencimento previsto', 'Valor original', 'Pagamento efetivo', 'Valor efetivo em reais', 'Quitado', 'Não pago'].every((t) => custos.includes(t)));
  ok('gerar não registra pagamento', custos.includes('Gerar lançamentos não registra pagamento'));
  await conferirTela('ficha, assinatura', 1440);
  await aba('Produtos e rateio');
  ok('rateio: 100% com a Numa, e a data de início', (await texto('main')).includes('somando 100%, com a Numa incluída') && (await texto('main')).includes('Vale a partir de'));
  await aba('Dados pessoais');
  ok('dados pessoais: não confunde conta de acesso, e diz do inventário', (await texto('main')).includes('Trata dados pessoais') && (await texto('main')).includes('O inventário de dados (Legal e privacidade, M09) ainda não está nesta versão'));
  await aba('Ativos hospedados');
  ok('Mais áreas: ativos, atividades, arquivos e histórico', js(await c.avaliar(`[...document.querySelectorAll('[aria-label="Mais áreas da ferramenta"] [role=tab]')].map(a=>a.textContent.trim())`)) === js(['Ativos hospedados', 'Atividades', 'Arquivos', 'Histórico']));
  await aba('Histórico');
  ok('o histórico continua', await c.avaliar(`[...document.querySelectorAll('[aria-label="Mais áreas da ferramenta"] [role=tab]')].find(a=>a.textContent.trim()==='Histórico').getAttribute('data-state')==='active'`));
  await conferirTela('ficha, mais áreas', 1440);
});

await passo('RN-04.04: vincular lançamento existente', async () => {
  await abrirFicha('Nuvem Clara Hosting');
  await abrirMenu();
  await clicarBotao('Vincular lançamento existente', '.menu-suspenso');
  await painelAberto();
  await c.ate(`document.querySelector('.janela').textContent.includes('lançamento')`);
  await c.espera(300);
  const janela = await texto('.janela');
  ok('explica que vincular não paga nem duplica', janela.includes('Vincular não registra pagamento nem muda o valor') && janela.includes('é substituída por este lançamento'));
  ok('sem despesa do fornecedor, diz por quê', janela.includes('Nenhum lançamento para vincular.') || janela.includes('Lançamento'));
  await clicarNoDialogo('Voltar');
  await painelFechado();
});

await passo('Registrar pagamento: a baixa do Financeiro, e o alerta resolve', async () => {
  await rodarRotinas();
  const f = await ferramenta('Traço Editor');
  const aberto = (await tabela('titulo')).filter((t) => t.ferramenta_id === f.id && ['previsto', 'aberto'].includes(t.situacao)).sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0];
  const alertasAbertos = async () => (await tabela('atividade')).filter((a) => a.origem_id === aberto.id && a.situacao !== 'concluida' && !a.arquivado_em);
  ok('o vencimento próximo gera alerta no Meu dia, ligado ao lançamento', (await alertasAbertos()).length >= 1, (await alertasAbertos()).length);
  await abrirFicha('Traço Editor');
  await clicarBotao('Registrar pagamento');
  await dialogoAberto();
  await c.ate(`document.querySelector('.dialogo')?.textContent.includes('Registrar baixa')`);
  await c.espera(200);
  ok('abre a baixa do Financeiro, do lançamento mais antigo em aberto', (await valor('baixa-valor')) === '89,90', await valor('baixa-valor'));
  await c.avaliar(`(()=>{const s=document.getElementById('baixa-conta');if(s&&!s.value){Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,s.options[1].value);s.dispatchEvent(new Event('change',{bubbles:true}))}})()`);
  await c.espera(120);
  if (await c.avaliar(`[...document.querySelectorAll('.dialogo fieldset legend')].some(l=>l.textContent.startsWith('Conta de sócia'))`)) {
    await c.avaliar(`[...document.querySelectorAll('.dialogo fieldset')].find(f=>f.querySelector('legend').textContent.startsWith('Conta de sócia')).querySelector('input').click()`);
    await c.espera(80);
  }
  await preencher('baixa-comprovante', 'https://drive.google.com/file/d/comprovante/view');
  await c.espera(80);
  await clicarNoDialogo('Registrar baixa');
  await dialogoFechado();
  await c.ate(`document.querySelector('main').textContent.replaceAll('\u00a0',' ').includes('R$ 89,90')&&document.querySelector('main').textContent.includes('efetivos')`);
  const titulo = (await tabela('titulo')).find((t) => t.id === aberto.id);
  ok('o lançamento fica quitado pela baixa', titulo.situacao === 'quitado', titulo.situacao);
  ok('o alerta do lançamento se resolve, sem cópia no M04', (await alertasAbertos()).length === 0);
  ok('o último pagamento aparece na ficha', (await texto('main')).includes(`Pago em ${dataBr(diaISO())}`));
});

await passo('RN-04.10: cancelar com prévia', async () => {
  await abrirFicha('Nuvem Clara Hosting');
  await abrirMenu();
  await clicarBotao('Cancelar ferramenta', '.menu-suspenso');
  await painelAberto();
  await c.espera(300);
  const janela = await texto('.janela');
  ok('não cancela no fornecedor', janela.includes('Este registro não cancela a contratação no fornecedor'));
  ok('prévia: pago preservado, futuro sem pagamento cancelado', janela.includes('Preservado (pago)') && janela.includes('Será cancelado'), janela.slice(0, 600));
  ok('situação: Ativa → Cancelada', janela.includes('Situação:') && janela.includes('Cancelada'));
  ok('os produtos afetados aparecem', janela.includes('Kipi e Zupi usam esta ferramenta'));
  await conferirTela('cancelar', 1440);
  await c.foto('d-cancelar-1440');
  await clicarNoDialogo('Confirmar cancelamento');
  await c.espera(120);
  ok('data e motivo obrigatórios', (await texto('.janela')).includes('Informe o motivo do cancelamento.'));
  await clicarNoDialogo('Voltar');
  await painelFechado();
  ok('voltar não muda nada', (await ferramenta('Nuvem Clara Hosting')).situacao === 'ativa');
});

await passo('T04.04 e T04.05: ativos revistos', async () => {
  await irLista('/ferramentas/ativos');
  const colunas = await c.avaliar(`[...document.querySelectorAll('main table thead th')].map(th=>th.textContent.trim()).filter(Boolean)`);
  ok('seis colunas: ativo, produto, plataforma, titularidade, vencimento e responsável', js(colunas) === js(['Ativo', 'Produto', 'Plataforma', 'Titularidade', 'Vencimento', 'Responsável']), js(colunas));
  ok('titular atual e desejado lado a lado, com a situação', await c.avaliar(`[...document.querySelectorAll('main table tbody tr')].find(tr=>tr.textContent.includes('kipi-exemplo')).textContent.includes('Desejado: Numa')`));
  ok('o vencimento diz quanto falta', (await texto('main')).includes('vence em'));
  await conferirTela('lista de ativos', 1440);
  const ativo = (await tabela('ativo_digital')).find((a) => a.identificador === 'kipi-exemplo.com.br');
  await ir(`/ferramentas/ativos/${ativo.id}`);
  await c.ate(`document.querySelector('main').textContent.includes('Evidência da transferência')`);
  await c.espera(200);
  const m = await texto('main');
  ok('ficha: identificação, titularidade, vencimento, assinatura e evidência', ['Identificação', 'Titularidade', 'Vencimento', 'Assinatura relacionada', 'Evidência da transferência', 'Não registrada'].every((t) => m.includes(t)));
  ok('a assinatura é da ferramenta, e o ativo não cria cobrança', m.includes('o ativo não cria outra cobrança') && m.includes('só referência'));
  ok('registrar aqui não transfere no fornecedor', m.includes('Registrar aqui não transfere a propriedade no fornecedor.'));
  ok('ação principal: Registrar transferência', await temBotao('Registrar transferência'));
  await conferirTela('ficha do ativo', 1440);
  await clicarBotao('Registrar transferência');
  await painelAberto();
  await c.espera(300);
  ok('sem evidência, explica o bloqueio', (await texto('.janela')).includes('Falta a evidência'));
  await clicarNoDialogo('Registrar transferência');
  await c.espera(150);
  ok('CA-04.07: e a regra barra de novo ao confirmar', (await texto('.janela')).includes('Sem o link da evidência') && (await tabela('ativo_digital')).find((a) => a.id === ativo.id).transferencia_situacao === 'pendente');
  await conferirTela('transferência', 1440);
  await clicarNoDialogo('Voltar');
  await painelFechado();
});

await passo('responsivo: 768', async () => {
  await c.tamanho(768, 1024);
  await irLista();
  await conferirTela('lista', 768);
  await abrirFicha('Nuvem Clara Hosting');
  await conferirTela('ficha', 768);
  await irLista('/ferramentas/ativos');
  await conferirTela('ativos', 768);
});

await passo('responsivo: 360', async () => {
  await c.tamanho(360, 780);
  await ir('/ferramentas');
  await c.ate(`document.querySelector('main ul li')`);
  await c.espera(200);
  await conferirTela('lista', 360);
  ok('cartões, sem Colunas', !(await temBotao('Colunas')) && (await c.avaliar(`document.querySelector('main table').getClientRects().length===0||document.querySelector('main table').getBoundingClientRect().width===0`)));
  await clicarBotao('Mais filtros');
  await dialogoAberto();
  await c.espera(200);
  ok('filtros em folha, com categoria, produto e situação', (await texto('.dialogo')).includes('Situação') && (await texto('.dialogo')).includes('Modalidade'));
  await conferirTela('folha de filtros', 360);
  await c.tecla('Escape');
  await dialogoFechado();
  await abrirFicha('Nuvem Clara Hosting');
  await conferirTela('ficha', 360);
  ok('barra de baixo: ação principal e Mais ações', await c.avaliar(`(()=>{const b=[...document.querySelectorAll('main .fixed button')].filter(x=>x.getClientRects().length).map(x=>x.textContent.trim());return b.length===2&&b[0]==='Registrar pagamento'&&b[1].startsWith('Mais ações')})()`));
  for (const rotulo of ['Assinatura e custos', 'Produtos e rateio', 'Dados pessoais', 'Ativos hospedados', 'Histórico']) {
    await aba(rotulo);
    await conferirTela(`aba ${rotulo}`, 360);
  }
  await aba('Assinatura e custos');
  ok('lançamentos viram cartões legíveis no celular', await c.avaliar(`[...document.querySelectorAll('main ul[aria-label="Lançamentos vinculados"] li')].length>0`));
  await c.foto('e-assinatura-360', { inteira: true });
  await abrirMenu();
  await c.avaliar(`[...document.querySelectorAll('.menu-suspenso button, .dialogo button')].find(b=>b.textContent.trim()==='Cancelar ferramenta').click()`);
  await painelAberto();
  await c.espera(300);
  await conferirTela('cancelar', 360);
  ok('a janela ocupa a tela inteira', await c.avaliar(`document.querySelector('.janela').getBoundingClientRect().width>=359`));
  await c.tecla('Escape');
  await painelFechado();
  await ir('/ferramentas');
  await c.ate(`document.querySelector('main ul li')`);
  await clicarBotao('Nova ferramenta');
  await painelAberto();
  await c.espera(320);
  for (const etapa of [1, 2, 3]) {
    await irParaEtapa(etapa);
    if (etapa === 3) {
      await marcarPilula('Modalidade', 'Paga');
      await escolher('ferramenta-periodicidade', 'mensal');
      await preencher('ferramenta-proxima', diaISO(10));
      await preencher('ferramenta-valor', '25,00');
      await c.espera(200);
    }
    await conferirTela(`formulário, etapa ${etapa}`, 360);
  }
  ok('uma etapa por vez, com "Etapa 3 de 3"', (await texto('.janela')).includes('Etapa 3 de 3') && !(await c.avaliar(`Boolean(document.getElementById('ferramenta-nome'))`)));
  ok('prévia legível, sem colunas estreitas', await c.avaliar(`[...document.querySelectorAll('[aria-label="Prévia de cobranças"] li')].every(l=>l.getBoundingClientRect().width>=280)`));
  await c.foto('f-custo-360', { inteira: true });
  await c.tecla('Escape');
  await c.espera(200);
  await c.avaliar(`[...document.querySelectorAll('.dialogo button')].find(b=>/^Descartar/.test(b.textContent.trim()))?.click()`);
  await painelFechado();
  const ativo = (await tabela('ativo_digital')).find((a) => a.identificador === 'kipi-exemplo.com.br');
  await irLista('/ferramentas/ativos');
  await conferirTela('ativos', 360);
  await ir(`/ferramentas/ativos/${ativo.id}`);
  await c.ate(`document.querySelector('main').textContent.includes('Evidência da transferência')`);
  await c.espera(200);
  await conferirTela('ficha do ativo', 360);
  await clicarBotao('Registrar transferência');
  await painelAberto();
  await c.espera(300);
  await conferirTela('transferência', 360);
  await c.tecla('Escape');
  await painelFechado();
  await c.tamanho(1440, 900);
});

await terminar();
