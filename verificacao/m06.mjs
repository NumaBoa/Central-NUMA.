// Verificação do M06 (T06.01 a T06.09) no sistema real: painel, sócias, acordos e vigência, ativos a transferir, marcas,
// constituição com a ativação da entidade, entidade, obrigações (F1) e reuniões e decisões. Larguras: 1440, 1024, 768 e 360.
import { ID_CAMILA, ID_KIMBERLY, iniciar } from './apoio.mjs';

const h = await iniciar({ nome: 'm06', porta: 9406 });
const { c, ok, passo, ir, preencher, escolher, erroDe, marcarPilula, clicarNoDialogo, painelAberto, painelFechado, pularAbertura, tabela, esperarAviso, conferirTela, terminar } = h;

const js = (v) => JSON.stringify(v);
const ID_MEMORANDO = '6e1a2b3c-4d5e-4f60-8a71-0b2c3d4e5f01';
const ID_MEMORANDO_V1 = '6e1a2b3c-4d5e-4f60-8a71-0b2c3d4e5f02';
const ID_ENTIDADE = 'd5f3b4a7-ae62-4d43-9f34-3c4d5e6f7a01';
const MARCA_NUMA = 'b3d1f2e5-8c40-4b21-9d12-1a2b3c4d5e01';
const MARCA_ZARPA = 'b3d1f2e5-8c40-4b21-9d12-1a2b3c4d5e05';
const PRODUTO_ZARPA = 'c4e2a3f6-9d51-4c32-8e23-2b3c4d5e6f05';
const item = (numero) => `7f2b3c4d-5e6f-4a70-9b82-1c3d4e5f6a${String(numero).padStart(2, '0')}`;
const LINK = 'https://drive.google.com/file/d/m06-verificacao/view';
const hoje = new Date();
const diaISO = (dias = 0) => new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + dias)).toISOString().slice(0, 10);

const pagina = () => c.avaliar(`document.querySelector('main').textContent.replace(/\\s+/g,' ')`);
const janela = () => c.avaliar(`[...document.querySelectorAll('.janela')].map(j=>j.textContent).join(' ').replace(/\\s+/g,' ')`);
/** O botão visível: a lista tem a versão em cartões, escondida no computador. */
const botao = (rotulo, onde = 'main') => `[...document.querySelectorAll(${js(onde + ' button')})].filter(b=>b.offsetParent!==null||getComputedStyle(b).position==='fixed').find(b=>b.textContent.trim()===${js(rotulo)}||b.getAttribute('aria-label')===${js(rotulo)})`;
const clicarBotao = (rotulo, onde = 'main') => c.avaliar(`(()=>{const b=${botao(rotulo, onde)};if(!b)throw new Error('sem botão: '+${js(rotulo)});b.click()})()`);
const botaoDesligado = (rotulo, onde = 'main') => c.avaliar(`Boolean(${botao(rotulo, onde)}?.disabled)`);
const existeBotao = (rotulo, onde = 'main') => c.avaliar(`Boolean(${botao(rotulo, onde)})`);
/** O último botão com o rótulo, em qualquer janela aberta: a janela mais nova vem depois. */
const naJanela = (rotulo) => c.avaliar(`(()=>{const b=[...document.querySelectorAll('.janela button')].reverse().find(b=>b.textContent.trim()===${js(rotulo)}||b.getAttribute('aria-label')===${js(rotulo)});if(!b)throw new Error('sem botão na janela: '+${js(rotulo)});b.click()})()`);
const aba = async (rotulo) => {
  await c.avaliar(`(()=>{const a=[...document.querySelectorAll('main [role=tab]')].find(a=>a.textContent.trim().startsWith(${js(rotulo)}));if(!a)throw new Error('sem aba: '+${js(rotulo)});a.focus();a.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}))})()`);
  await c.espera(200);
};
const motivo = (texto) => c.avaliar(`(()=>{const e=document.querySelector('.dialogo textarea');e.focus();Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,${js(texto)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`);
const menu = async (gatilho, item) => {
  await clicarBotao(gatilho);
  await c.ate(`[...document.querySelectorAll('button')].some(b=>b.offsetParent!==null&&b.textContent.trim()===${js(item)})`);
  await c.espera(150);
  await c.avaliar(`[...document.querySelectorAll('button')].reverse().find(b=>b.offsetParent!==null&&b.textContent.trim()===${js(item)}).click()`);
};
const alterarMeta = (corpo) => c.avaliar(`(()=>{const k='numa-central:v1:meta';const m=JSON.parse(localStorage.getItem(k)||'{}');${corpo};localStorage.setItem(k,JSON.stringify(m))})()`);
const comoPessoa = async (id) => {
  await alterarMeta(`m.pessoa_atual_id=${js(id)}`);
  await c.recarregar();
};
const mudarFase = async (fase) => {
  await c.avaliar(`(()=>{const k='numa-central:v1:configuracao';const t=JSON.parse(localStorage.getItem(k));const l=t.find(x=>x.chave==='fase_ativa');l.valor=${js(fase)};localStorage.setItem(k,JSON.stringify(t))})()`);
  await c.recarregar();
};
const esperarTexto = async (parte, onde = 'main') => {
  const condicao = `(document.querySelector(${js(onde)})?.textContent??'').replace(/\\s+/g,' ').includes(${js(parte)})`;
  try {
    return await c.ate(condicao, 30000);
  } catch (erro) {
    const visto = await c.avaliar(`JSON.stringify({caminho:location.pathname,mains:document.querySelectorAll('main').length,texto:(document.querySelector(${js(onde)})?.textContent??'').slice(0,240)})`);
    throw new Error(`${erro.message} | visto: ${visto}`);
  }
};
const linhasDaTabela = () => c.avaliar(`document.querySelectorAll('main table tbody tr').length`);

await c.tamanho(1440, 900);
await ir('/empresa');
await pularAbertura();
await esperarTexto('Jornada da empresa');

await passo('T06.01: painel da empresa, com a fase ainda não ativa', async () => {
  const p = await pagina();
  ok('título e resumo', p.includes('A Numa, por inteiro') && p.includes('Sociedade, patrimônio e próximos passos.'));
  ok('aviso de fase, sem o menu ligar a tela', p.includes('A Fase 0b ainda não está ativa') && (await c.avaliar(`!document.querySelector('aside a[href="/empresa"]')`)));
  ok('os 12 marcos na linha da jornada', (await c.avaliar(`document.querySelectorAll('ol[aria-label="Marcos da jornada"] li').length`)) === 12);
  ok('sócias com 50% cada', p.includes('Kimberly Grebe50%') && p.includes('Camila Lima50%'), p.slice(0, 300));
  ok('alerta de titularidade (RN-06.06)', p.includes('Titularidade de ativos e PI ainda não formalizada em acordo vigente.'));
  ok('entidade planejada, sem CNPJ, regime ou contador inventados', p.includes('Planejada') && p.includes('CNPJNão definido') && p.includes('RegimeNão definido') && p.includes('ContadorNão escolhido'));
  ok('constituição em 0 de 17', p.includes('0 de 17 itens concluídos'));
  ok('aviso das marcas provisórias (CA-06.04)', p.includes('Verificar disponibilidade antes de investir em identidade'));
  ok('decisões e obrigações nos estados vazios', p.includes('Nenhuma decisão registrada.') && p.includes('As obrigações corporativas chegam com a Fase 1'));
  ok('antes da F1, a aba Obrigações fica Em breve, sem link', !(await c.avaliar(`[...document.querySelectorAll('nav[aria-label="Seções da empresa"] a')].some(a=>a.textContent.includes('Obrigações'))`)));
  ok('investimento vindo do Financeiro', p.includes('Investimento das sócias') && p.includes('Ver no Financeiro'));
  await clicarBotao('Ver jornada completa');
  await painelAberto();
  const j = await janela();
  ok('a jornada completa lista ME-01 a ME-12, com o que falta', j.includes('ME-01') && j.includes('ME-12') && j.includes('Memorando assinado') && j.includes('Depende da entidade Ativa'), j.slice(0, 200));
  ok('nenhum marco atingido por falta de dado', !j.includes('ME-04Memorando assinadoAtingido'));
  await naJanela('Fechar');
  await painelFechado();
  await conferirTela('painel', 1440);
  await c.foto('a-painel-1440');
});

await passo('T06.02: sócias e participação; 90% não salva (CA-06.02)', async () => {
  await ir('/empresa/socias');
  await esperarTexto('Participação cadastrada');
  const p = await pagina();
  ok('duas sócias, com 50%', (await c.avaliar(`document.querySelectorAll('main article').length`)) === 2 && p.includes('Participação cadastrada: 50%'));
  ok('data de entrada vazia, não inventada', p.includes('Data de entradaNão informada'));
  ok('referência ao memorando ainda não vigente', p.includes('Memorando entre sócias V1 (ainda não vigente)') && p.includes('ainda não está vigente'));
  await clicarBotao('Editar participação');
  await painelAberto();
  await preencher(`participacao-participacao_${ID_CAMILA}`, '40');
  await c.espera(120);
  ok('o total aparece na hora', (await janela()).includes('Total90%'));
  await naJanela('Salvar alterações');
  await c.espera(250);
  ok('somar 90% é bloqueado, com a mensagem', (await janela()).includes('As participações devem somar 100%.'));
  ok('nada foi gravado', (await tabela('socia')).map((linha) => linha.participacao).join() === '50,50');
  await preencher(`participacao-participacao_${ID_KIMBERLY}`, '60');
  await marcarPilula('Fundamento', 'Decisão');
  await c.ate(`document.getElementById('participacao-decisao-titulo')`);
  await preencher('participacao-decisao-titulo', 'Participação de teste');
  await preencher('participacao-decisao-descricao', 'Mudança para a verificação');
  await naJanela('Salvar alterações');
  await esperarAviso('Participação atualizada.');
  await painelFechado();
  ok('grava 60/40 com a decisão de fundamento', (await tabela('socia')).map((linha) => linha.participacao).join() === '60,40' && (await tabela('decisao')).length === 1);
  await aba('Histórico de participação');
  ok('a linha do tempo mostra a mudança e o fundamento', (await pagina()).includes('Kimberly Grebe: 60%') && (await pagina()).includes('Participação de teste'));
  await aba('Sócias');
  await menu('Mais ações de Camila Lima', 'Registrar saída');
  await painelAberto();
  await naJanela('Registrar saída');
  await c.espera(200);
  ok('saída exige o motivo', (await erroDe('saida-motivo')).includes('motivo'));
  await naJanela('Cancelar');
  await c.espera(200);
  if (await c.avaliar(`Boolean(document.querySelector('.dialogo'))`)) await clicarNoDialogo('Descartar alterações');
  await painelFechado();
  ok('sem saída registrada', (await tabela('socia')).every((linha) => linha.saida_em === null));
});

await passo('T06.03: lista, roteiro e resumo do memorando', async () => {
  await ir('/empresa/acordos');
  await esperarTexto('Memorando entre sócias');
  const p = await pagina();
  ok('o memorando em rascunho e o alerta de titularidade', p.includes('Rascunho') && p.includes('Formalize a titularidade'));
  await c.clicar('texto=Roteiro do memorando');
  await painelAberto();
  ok('roteiro com os tópicos, sem minuta', (await janela()).includes('Destino dos produtos em caso de saída') && (await janela()).includes('redigido fora da Central'));
  await naJanela('Fechar');
  await painelFechado();
  await ir(`/empresa/acordos/${ID_MEMORANDO}`);
  await esperarTexto('Resumo estruturado');
  ok('a ficha avisa que o rascunho não vale como vigente', (await pagina()).includes('ainda não vale como acordo vigente'));
  await clicarBotao('Editar resumo');
  await painelAberto();
  await c.avaliar(`document.getElementById('acordo-titularidade').click()`);
  await preencher('acordo-revisao_prevista', diaISO(20));
  await preencher(`acordo-dedicacao-${ID_KIMBERLY}`, 'Financeiro e comercial');
  await naJanela('Salvar alterações');
  await esperarAviso('Resumo salvo.');
  await painelFechado();
  const versao = (await tabela('acordo_versao')).find((linha) => linha.id === ID_MEMORANDO_V1);
  ok('o resumo grava titularidade, revisão e dedicação', versao.titularidade_numa === true && versao.revisao_prevista === diaISO(20) && versao.resumo.dedicacao[0]?.texto === 'Financeiro e comercial');
});

await passo('T06.03: assinaturas e vigência (RN-06.04 e CA-06.03)', async () => {
  await clicarBotao('Enviar para revisão');
  await esperarAviso('Enviado para revisão.');
  await c.ate(`${botao('Pedir assinaturas')}`);
  await clicarBotao('Pedir assinaturas');
  await esperarAviso('Aguardando as assinaturas.');
  await aba('Assinaturas');
  let p = await pagina();
  ok('as duas pendentes, e Tornar vigente desligado', p.includes('Pendente') && (await botaoDesligado('Tornar vigente')));
  ok('diz o que falta', p.includes('Falta o arquivo assinado.') && p.includes('Falta a confirmação de Camila Lima.'));
  ok('aviso de que a etapa local só simula a confirmação', p.includes('não é autenticação nem assinatura eletrônica'));
  await clicarBotao('Confirmar: li e assinei');
  await c.ate(`document.querySelector('.dialogo')`);
  await clicarNoDialogo('Confirmar');
  await esperarAviso('Confirmação registrada.');
  await clicarBotao('Registrar arquivo e data');
  await painelAberto();
  await preencher('assinado-arquivo_url', LINK);
  await preencher('assinado-data_assinatura', diaISO(0));
  await naJanela('Salvar');
  await esperarAviso('Arquivo e data registrados.');
  await painelFechado();
  p = await pagina();
  ok('CA-06.03: sem Camila, não fica vigente, mesmo com arquivo e data', (await botaoDesligado('Tornar vigente')) && p.includes('Falta a confirmação de Camila Lima.') && !p.includes('Falta o arquivo assinado.'));
  ok('Kimberly não confirma por Camila', p.includes('Você, Kimberly Grebe, não pode confirmar em nome de Camila Lima.'));
  ok('a versão continua aguardando', (await tabela('acordo_versao')).find((linha) => linha.id === ID_MEMORANDO_V1).situacao === 'aguardando_assinaturas');
  await comoPessoa(ID_CAMILA);
  await esperarTexto('Resumo estruturado');
  await aba('Assinaturas');
  await clicarBotao('Confirmar: li e assinei');
  await c.ate(`document.querySelector('.dialogo')`);
  await clicarNoDialogo('Confirmar');
  await esperarAviso('Confirmação registrada.');
  await c.ate(`!${botao('Tornar vigente')}.disabled`);
  await clicarBotao('Tornar vigente');
  await c.ate(`document.querySelector('.dialogo')`);
  await clicarNoDialogo('Tornar vigente');
  await esperarAviso('Versão vigente.');
  const acordo = (await tabela('acordo_societario')).find((linha) => linha.id === ID_MEMORANDO);
  ok('vigente, com o acordo apontando para ela', acordo.versao_vigente_id === ID_MEMORANDO_V1 && (await tabela('acordo_versao')).find((linha) => linha.id === ID_MEMORANDO_V1).situacao === 'vigente');
  ok('duas confirmações, cada uma da própria sócia', (await tabela('acordo_assinatura')).map((linha) => linha.pessoa_id).sort().join() === [ID_KIMBERLY, ID_CAMILA].sort().join());
  await comoPessoa(ID_KIMBERLY);
  await esperarTexto('Resumo estruturado');
});

await passo('T06.03: nova versão não derruba a vigente (RN-06.03)', async () => {
  await clicarBotao('Nova versão');
  await esperarAviso('Nova versão criada em rascunho.');
  await aba('Versões');
  let p = await pagina();
  ok('V2 em rascunho e V1 ainda vigente', p.includes('V2Rascunho') && p.includes('V1Vigente'), p.slice(0, 400));
  await menu('Mais ações do acordo', 'Cancelar a V2');
  await c.ate(`document.querySelector('.dialogo textarea')`);
  await motivo('Só para a verificação');
  await clicarNoDialogo('Cancelar versão');
  await esperarAviso('Versão cancelada.');
  p = await pagina();
  const versoes = await tabela('acordo_versao');
  ok('V2 cancelada com o motivo; V1 segue vigente', versoes.find((linha) => linha.numero === 2).situacao === 'cancelada' && versoes.find((linha) => linha.numero === 1).situacao === 'vigente' && p.includes('Motivo do cancelamento: Só para a verificação'));
  await ir('/empresa');
  await esperarTexto('Jornada da empresa');
  ok('com a titularidade marcada e vigente, o alerta sai do painel', !(await pagina()).includes('Titularidade de ativos e PI ainda não formalizada'));
  await clicarBotao('Ver jornada completa');
  await painelAberto();
  ok('CA-06.01: ME-04 atingido, com a data', (await janela()).includes(`Memorando assinadoAtingido em ${diaISO(0).split('-').reverse().join('/')}`), (await janela()).slice(0, 600));
  await naJanela('Fechar');
  await painelFechado();
});

await passo('T06.02: o acordo vigente traz outra participação; aplicar exige o mesmo caminho', async () => {
  await ir('/empresa/socias');
  await esperarTexto('traz outra participação');
  await clicarBotao('Aplicar a do acordo');
  await painelAberto();
  ok('o formulário vem com 50/50 e o acordo vigente', (await c.avaliar(`document.getElementById(${js(`participacao-participacao_${ID_KIMBERLY}`)}).value`)) === '50' && (await c.avaliar(`document.getElementById('participacao-acordo_versao_id').value`)) === ID_MEMORANDO_V1);
  await naJanela('Salvar alterações');
  await esperarAviso('Participação atualizada.');
  await painelFechado();
  const socias = await tabela('socia');
  ok('volta a 50/50, com o memorando como fundamento', socias.map((linha) => linha.participacao).join() === '50,50' && socias.every((linha) => linha.acordo_versao_id === ID_MEMORANDO_V1));
  ok('o aviso sai', !(await pagina()).includes('traz outra participação'));
});

await passo('T06.04: ativos a transferir; gerar não duplica; o fluxo é o do M04', async () => {
  await ir('/empresa/ativos');
  await esperarTexto('itens');
  const contagem = async () => Number((await c.avaliar(`document.querySelector('main [role=status]').textContent`)).match(/\d+/)[0]);
  const antes = await contagem();
  ok('a lista sai de ativos e ferramentas', antes > 0 && (await pagina()).includes('Titular desejado'));
  await clicarBotao('Gerar atividades pendentes');
  await esperarAviso('no Meu dia');
  const alertas = async () => (await tabela('atividade')).filter((linha) => linha.origem_tipo === 'transferencia');
  ok('uma atividade por item, sem prazo inventado', (await alertas()).length === antes && (await alertas()).every((linha) => linha.prazo === null));
  await clicarBotao('Gerar atividades pendentes');
  await esperarAviso('Nada novo');
  ok('gerar de novo não duplica', (await alertas()).length === antes);
  // O primeiro que ainda não está impedido: os exemplos do M04 já trazem um impedido.
  const primeiro = await c.avaliar(`(()=>{const b=[...document.querySelectorAll('main tbody tr')].filter(l=>!l.textContent.includes('Impedida')).flatMap(l=>[...l.querySelectorAll('button')]).find(b=>b.offsetParent!==null&&b.getAttribute('aria-label')?.startsWith('Mais ações de '));return b.getAttribute('aria-label').replace('Mais ações de ','')})()`);
  await menu(`Mais ações de ${primeiro}`, 'Marcar impedida');
  await c.ate(`document.querySelector('.dialogo textarea')`);
  await motivo('Exige conta de organização');
  await clicarNoDialogo('Marcar impedida');
  await esperarAviso('impedida');
  ok('impedida mostra o motivo na lista', (await pagina()).includes('Exige conta de organização'));
  // Um item com o alerta aberto: quem já tinha uma atividade ligada ficou com ela, sem alerta novo.
  const comAlerta = (await alertas()).filter((linha) => linha.situacao !== 'concluida').map((linha) => linha.origem_id);
  const alvo = (await tabela('ativo_digital')).find((linha) => comAlerta.includes(linha.id));
  await c.avaliar(`[...document.querySelectorAll('main tbody tr')].find(l=>l.textContent.includes(${js(alvo.identificador)})).querySelector('button').click()`);
  await c.ate(`[...document.querySelectorAll('.dialogo h2')].some(h=>h.textContent.startsWith('Registrar a transferência de '))`);
  const nome = alvo.identificador;
  await clicarNoDialogo('Registrar transferência');
  await c.espera(200);
  ok('sem evidência, não conclui (CA-04.07)', (await erroDe('transferencia-evidencia')).includes('evidência'));
  await preencher('transferencia-evidencia', LINK);
  await clicarNoDialogo('Registrar transferência');
  await esperarAviso('Transferência registrada.');
  await c.ate(`!document.querySelector('.dialogo')`);
  await c.espera(300);
  ok('o item sai da lista', (await contagem()) === antes - 1, nome);
  const ativo = (await tabela('ativo_digital')).find((linha) => linha.identificador === nome);
  const alerta = (await alertas()).find((linha) => linha.origem_id === ativo?.id);
  ok('o alerta se resolve, com a nota do sistema', alerta?.situacao === 'concluida' && alerta?.concluida_por === null, JSON.stringify({ nome, alvo: alvo?.identificador, ativo: ativo?.id, situacao: ativo?.transferencia_situacao, alerta: alerta && { s: alerta.situacao, por: alerta.concluida_por, nota: alerta.conclusao_nota } }));
});

await passo('T06.05: marcas, pesquisa manual e aviso de nome provisório (CA-06.04)', async () => {
  await ir(`/produtos/${PRODUTO_ZARPA}`);
  await esperarTexto('Nome provisório, sem pesquisa registrada.');
  ok('a ficha do produto avisa', true);
  await ir('/empresa/marcas');
  await esperarTexto('6 marcas');
  ok('as provisórias aparecem com o aviso', (await pagina()).includes('Zarpa e Mimo: nome provisório, sem pesquisa.'));
  await clicarBotao('Registrar pesquisa');
  await painelAberto();
  ok('a nota de registro manual', (await janela()).includes('não consulta o INPI'));
  await naJanela('Salvar');
  await c.espera(200);
  ok('marca e resultado obrigatórios', (await erroDe('pesquisa-marca_id')).length > 0 && (await janela()).includes('Escolha o resultado.'));
  await escolher('pesquisa-marca_id', MARCA_ZARPA);
  await marcarPilula('Resultado', 'Disponível');
  await naJanela('Salvar');
  await esperarAviso('Pesquisa registrada.');
  await painelFechado();
  ok('o aviso da Zarpa sai; o da Mimo fica', (await pagina()).includes('Mimo: nome provisório, sem pesquisa.') && !(await pagina()).includes('Zarpa e Mimo'));
  await clicarBotao('Novo processo');
  await painelAberto();
  await escolher('processo-marca_id', MARCA_NUMA);
  await preencher('processo-classes', '42');
  await marcarPilula('Apresentação', 'Nominativa');
  await escolher('processo-titular_entidade_id', ID_ENTIDADE);
  await escolher('processo-situacao', 'protocolado');
  await naJanela('Salvar');
  await c.espera(200);
  ok('protocolo exige número, data e titular real', (await erroDe('processo-numero_processo')).includes('número') && (await erroDe('processo-titular_entidade_id')).includes('Ativa'));
  await escolher('processo-situacao', 'planejado');
  await naJanela('Salvar');
  await esperarAviso('Processo criado.');
  await painelFechado();
  await ir(`/produtos/${PRODUTO_ZARPA}`);
  await c.ate(`document.querySelector('main h1')`);
  await c.espera(600);
  ok('com a pesquisa, a ficha do produto não avisa mais', !(await pagina()).includes('Nome provisório, sem pesquisa registrada.'));
  await ir(`/empresa/marcas/${MARCA_NUMA}`);
  await esperarTexto('Processos (1)');
  await aba('Processos');
  await clicarBotao('Novo prazo');
  await painelAberto();
  await preencher('prazo-descricao', 'Acompanhar a publicação');
  await preencher('prazo-data_limite', diaISO(10));
  await naJanela('Salvar');
  await esperarAviso('Prazo adicionado.');
  await painelFechado();
  const doPrazo = async () => (await tabela('atividade')).filter((linha) => linha.origem_tipo === 'marca_prazo');
  ok('RN-06.09: o alerta nasce na antecedência', (await doPrazo()).length === 1 && (await doPrazo())[0].situacao === 'a_fazer');
  await clicarBotao('Cumprido');
  await esperarAviso('Prazo cumprido.');
  ok('cumprir resolve o alerta', (await doPrazo())[0].situacao === 'concluida');
});

await passo('T06.06: checklist com dependências e evidências (CA-06.05)', async () => {
  await ir(`/empresa/constituicao?item=${item(6)}`);
  await painelAberto();
  const j = await janela();
  ok('o item 6 bloqueado, com o motivo', j.includes('Depende de: Memorando entre sócias vigente, Definir tipo societário e regime tributário com o contador') && (await botaoDesligado('Concluir', '.janela')));
  await naJanela('Fechar');
  await painelFechado();
  ok('0 de 17', (await pagina()).includes('0 de 17 itens concluídos'));
  await clicarBotao('Iniciar checklist');
  await esperarAviso('17 atividades criadas');
  await c.ate(`${botao('Atualizar atividades')}`);
  await clicarBotao('Atualizar atividades');
  await esperarAviso('Nada novo');
  const atividades = (await tabela('atividade')).filter((linha) => linha.origem_tipo === 'constituicao_item');
  const seis = (await tabela('constituicao_item')).find((linha) => linha.id === item(6));
  ok('17 atividades, sem duplicar; a do item 6 nasce bloqueada', atividades.length === 17 && atividades.find((linha) => linha.id === seis.atividade_id)?.bloqueada === true);
  const concluir = async (numero, preparar) => {
    await ir(`/empresa/constituicao?item=${item(numero)}`);
    await painelAberto();
    await naJanela('Concluir');
    await c.ate(`[...document.querySelectorAll('.janela')].some(j=>j.textContent.includes('Concluir:'))`);
    if (preparar) await preparar();
    await naJanela('Concluir item');
    await esperarAviso('Item concluído.');
  };
  await concluir(2);
  const decisao = (await tabela('decisao'))[0];
  await concluir(3, () => escolher('conclusao-evidencia_registro_id', decisao.id));
  await concluir(1);
  ok('o item 1 aceita o memorando vigente', (await tabela('constituicao_item')).find((linha) => linha.id === item(1)).evidencia_registro_id === ID_MEMORANDO);
  await ir(`/empresa/constituicao?item=${item(6)}`);
  await painelAberto();
  ok('com 1 e 3 concluídos, o item 6 libera', !(await botaoDesligado('Concluir', '.janela')));
  await naJanela('Concluir');
  await c.ate(`document.getElementById('conclusao-evidencia_url')`);
  await naJanela('Concluir item');
  await c.espera(200);
  ok('sem evidência, não conclui', (await erroDe('conclusao-evidencia_url')).includes('exige evidência'));
  await preencher('conclusao-evidencia_url', LINK);
  await naJanela('Concluir item');
  await esperarAviso('Item concluído.');
  const atividadeDoSeis = (await tabela('atividade')).find((linha) => linha.id === seis.atividade_id);
  ok('concluir o item conclui a atividade do Meu dia', atividadeDoSeis.situacao === 'concluida');
  await ir(`/empresa/constituicao?item=${item(14)}`);
  await painelAberto();
  await naJanela('Não se aplica');
  await c.ate(`document.querySelector('.dialogo textarea')`);
  await motivo('Não temos app nas lojas');
  await clicarNoDialogo('Não se aplica');
  await esperarAviso('não aplicável');
  await painelFechado().catch(() => {});
  await ir('/empresa/constituicao');
  await esperarTexto('itens concluídos');
  ok('"Não se aplica" sai do total', (await pagina()).includes('4 de 16 itens concluídos'), (await pagina()).slice(0, 300));
});

await passo('RN-06.11: o CNPJ ativa a entidade, pelo cadastro de T02.05', async () => {
  await ir(`/empresa/constituicao?item=${item(7)}`);
  await painelAberto();
  await naJanela('Concluir');
  await c.ate(`document.getElementById('conclusao-evidencia_url')`);
  await preencher('conclusao-evidencia_url', LINK);
  await naJanela('Concluir item');
  await esperarAviso('Item concluído.');
  await ir(`/empresa/constituicao?item=${item(8)}`);
  await painelAberto();
  await naJanela('Concluir');
  await c.ate(`document.getElementById('conclusao-entidade')`);
  await naJanela('Concluir item');
  await c.espera(250);
  ok('sem a entidade Ativa, não conclui', (await janela()).includes('Complete os dados da entidade e deixe-a Ativa'));
  await c.avaliar(`document.getElementById('conclusao-entidade').click()`);
  await c.ate(`document.getElementById('entidade-documento')`);
  await preencher('entidade-documento', '11.222.333/0001-81');
  await preencher('entidade-endereco-cep', '20000-000');
  await escolher('entidade-endereco-uf', 'RJ');
  await preencher('entidade-endereco-logradouro', 'Rua de Teste');
  await preencher('entidade-endereco-numero', '1');
  await preencher('entidade-endereco-bairro', 'Centro');
  await preencher('entidade-endereco-cidade', 'Rio de Janeiro');
  await marcarPilula('Representantes legais', 'Kimberly Grebe');
  await preencher('entidade-abertura', diaISO(0));
  const alertasAntes = (await tabela('atividade')).filter((linha) => linha.origem_tipo === 'transferencia').length;
  await naJanela('Salvar alterações');
  await esperarAviso('Entidade atualizada.');
  await c.ate(`!document.getElementById('entidade-documento')`);
  ok('a entidade fica Ativa, no mesmo cadastro', (await tabela('entidade')).find((linha) => linha.id === ID_ENTIDADE).situacao === 'ativa' && (await tabela('entidade')).length === 1);
  ok('RN-06.07: ativar não duplica as atividades de transferência', (await tabela('atividade')).filter((linha) => linha.origem_tipo === 'transferencia').length === alertasAntes);
  await esperarTexto('está Ativa', '.janela');
  await preencher('conclusao-evidencia_url', LINK);
  await naJanela('Concluir item');
  await esperarAviso('Item concluído.');
  ok('o item 8 conclui', (await tabela('constituicao_item')).find((linha) => linha.id === item(8)).situacao === 'concluido');
});

await passo('T06.07: a entidade, sem um segundo cadastro', async () => {
  await ir('/empresa/entidade');
  await esperarTexto('Cadastro compartilhado');
  const p = await pagina();
  ok('Ativa, com o CNPJ formatado', p.includes('Ativa') && p.includes('11.222.333/0001-81'));
  ok('regime e contador seguem vazios', p.includes('Regime tributárioA definir') && p.includes('ContadorNão escolhido'));
  await aba('Obrigações');
  ok('obrigações dependem da F1', (await pagina()).includes('chegam com a Fase 1'));
  await aba('Contas financeiras');
  ok('nenhuma conta da PJ ainda', (await pagina()).includes('Nenhuma conta em nome desta entidade.'));
});

await passo('T06.08: obrigações respeitam a F1; alerta, título e cumprimento sem duplicar', async () => {
  await ir('/empresa/obrigacoes');
  await esperarTexto('Nenhuma obrigação cadastrada.');
  ok('aviso da Fase 1 e nada presumido', (await pagina()).includes('A Fase 1 ainda não está ativa') && (await pagina()).includes('Nenhuma obrigação fiscal é presumida'));
  await clicarBotao('Nova obrigação');
  await painelAberto();
  await preencher('obrigacao-nome', 'Obrigação de verificação');
  await preencher('obrigacao-vencimento_base', diaISO(10));
  await preencher('obrigacao-antecedencia_dias', '30');
  await c.avaliar(`document.getElementById('obrigacao-gera-titulo').click()`);
  await c.ate(`document.getElementById('obrigacao-categoria_id')`);
  await c.avaliar(`(()=>{const s=document.getElementById('obrigacao-categoria_id');const o=[...s.options].find(o=>o.value);Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,o.value);s.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await preencher('obrigacao-valor_estimado', '150,00');
  await escolher('obrigacao-situacao', 'ativa');
  await naJanela('Salvar');
  await c.espera(250);
  ok('antes da F1, Ativa não salva', (await erroDe('obrigacao-situacao')).includes('a partir da Fase 1'));
  await escolher('obrigacao-situacao', 'rascunho');
  await naJanela('Salvar');
  await esperarAviso('Obrigação cadastrada.');
  await painelFechado();
  ok('rascunho não gera ocorrência', (await tabela('obrigacao_corporativa_ocorrencia')).length === 0);
  await mudarFase('f1');
  const obrigacao = (await tabela('obrigacao_corporativa'))[0];
  await ir(`/empresa/obrigacoes/${obrigacao.id}`);
  await esperarTexto('Ocorrências');
  await clicarBotao('Editar');
  await painelAberto();
  await escolher('obrigacao-situacao', 'ativa');
  await naJanela('Salvar alterações');
  await esperarAviso('Obrigação atualizada.');
  await painelFechado();
  await esperarTexto('Em aberto');
  const ocorrencias = await tabela('obrigacao_corporativa_ocorrencia');
  const titulos = (await tabela('titulo')).filter((linha) => linha.origem === 'obrigacao_corporativa');
  ok('ativa na F1: uma ocorrência, um alerta, um título previsto', ocorrencias.length === 1 && titulos.length === 1 && titulos[0].situacao === 'previsto' && (await tabela('atividade')).filter((linha) => linha.origem_tipo === 'obrigacao_ocorrencia').length === 1);
  await ir('/configuracoes/dados');
  await c.ate(`${botao('Rodar rotinas agora')}`);
  await clicarBotao('Rodar rotinas agora');
  await esperarAviso('otina');
  ok('rodar as rotinas de novo não duplica nada', (await tabela('obrigacao_corporativa_ocorrencia')).length === 1 && (await tabela('titulo')).filter((linha) => linha.origem === 'obrigacao_corporativa').length === 1 && (await tabela('atividade')).filter((linha) => linha.origem_tipo === 'obrigacao_ocorrencia').length === 1);
  await ir(`/empresa/obrigacoes/${obrigacao.id}`);
  await esperarTexto('Registrar cumprimento');
  await clicarBotao('Registrar cumprimento');
  await painelAberto();
  await naJanela('Registrar');
  await c.espera(200);
  ok('cumprir exige o comprovante', (await erroDe('cumprimento-comprovante_url')).includes('comprovante'));
  await preencher('cumprimento-comprovante_url', LINK);
  await naJanela('Registrar');
  await esperarAviso('Cumprimento registrado.');
  await painelFechado();
  const alerta = (await tabela('atividade')).find((linha) => linha.origem_tipo === 'obrigacao_ocorrencia');
  ok('o alerta se resolve; o título continua previsto (sem pagamento presumido)', alerta.situacao === 'concluida' && (await tabela('titulo')).find((linha) => linha.origem === 'obrigacao_corporativa').situacao === 'previsto');
  await mudarFase('f0a');
});

await passo('T06.09: reunião, ações no Meu dia e decisão inline (RN-06.14, CA-06.07)', async () => {
  await ir('/empresa/reunioes');
  await esperarTexto('Nenhuma reunião registrada.');
  await clicarBotao('Nova reunião');
  await painelAberto();
  await preencher('reuniao-titulo', 'Alinhamento das sócias');
  await preencher('reuniao-hora', '10:00');
  await marcarPilula('Participantes', 'Camila Lima');
  await preencher('reuniao-pauta', 'Precificação dos apps\nFormalização da Numa');
  await naJanela('Salvar');
  await esperarAviso('Reunião criada.');
  await c.ate(`location.pathname.startsWith('/empresa/reunioes/')`);
  await esperarTexto('Pauta');
  ok('a ficha abre, com a pauta em itens', (await pagina()).includes('Precificação dos apps') && (await tabela('reuniao_participante')).length === 2);
  await aba('Ações');
  await clicarBotao('Adicionar ação');
  await painelAberto();
  await preencher('acao-titulo', 'Levantar custos por app');
  await escolher('acao-responsavel_id', ID_CAMILA);
  await preencher('acao-prazo', diaISO(5));
  await naJanela('Adicionar');
  await esperarAviso('Ação criada no Meu dia.');
  await painelFechado();
  await esperarTexto('Levantar custos por app');
  const acao = (await tabela('atividade')).find((linha) => linha.origem_tipo === 'reuniao');
  ok('CA-06.07: a ação é a atividade do Meu dia, com o vínculo da reunião', acao?.responsavel_id === ID_CAMILA && (await tabela('vinculo')).some((linha) => [linha.origem_id, linha.destino_id].includes(acao.id) && [linha.origem_tipo, linha.destino_tipo].includes('reuniao')));
  await c.avaliar(`document.querySelector('input[aria-label="Concluir Levantar custos por app"]').click()`);
  await esperarAviso('Atividade concluída.');
  ok('concluir na reunião conclui a atividade', (await tabela('atividade')).find((linha) => linha.id === acao.id).situacao === 'concluida');
  await ir(`/meu-dia?atividade=${acao.id}`);
  await c.ate(`document.querySelector('.janela')`);
  ok('no Meu dia, a mesma atividade, com o vínculo', (await janela()).includes('Levantar custos por app'));
  await ir(`/empresa/reunioes/${acao.origem_id}`);
  await esperarTexto('Alinhamento das sócias');
  await aba('Decisões');
  await clicarBotao('Adicionar decisão');
  await painelAberto();
  await preencher('decisao-titulo', 'Centralizar custos de ferramentas');
  await preencher('decisao-descricao', 'Registrar assinaturas e custos na Central.');
  await naJanela('Registrar decisão');
  await esperarAviso('Decisão registrada.');
  await painelFechado();
  ok('a decisão fica ligada à reunião', (await tabela('decisao')).find((linha) => linha.titulo === 'Centralizar custos de ferramentas')?.reuniao_id === acao.origem_id);
});

await passo('T06.09: decisão registrada não muda; substituir liga as duas (CA-06.06)', async () => {
  const antiga = (await tabela('decisao')).find((linha) => linha.titulo === 'Centralizar custos de ferramentas');
  await ir(`/empresa/decisoes/${antiga.id}`);
  await esperarTexto('Decisões registradas não são editáveis.');
  ok('não há Editar, só Substituir', !(await existeBotao('Editar')) && (await existeBotao('Substituir por nova decisão')));
  await clicarBotao('Substituir por nova decisão');
  await painelAberto();
  ok('a substituição parte da decisão atual, com o vínculo', (await c.avaliar(`document.getElementById('decisao-titulo').value`)) === 'Centralizar custos de ferramentas' && (await janela()).includes(`substitui ${antiga.codigo}`));
  await naJanela('Registrar decisão');
  await c.espera(250);
  ok('pede o motivo da substituição', (await erroDe('decisao-motivo')).includes('motivo da substituição'));
  await preencher('decisao-motivo', 'O cenário mudou');
  await naJanela('Registrar decisão');
  await esperarAviso('Nova decisão registrada.');
  await c.ate(`!location.pathname.endsWith(${js(antiga.id)})`);
  await esperarTexto('Substitui');
  const depois = (await tabela('decisao')).find((linha) => linha.id === antiga.id);
  ok('a antiga fica Substituída, sem mudar o conteúdo', depois.situacao === 'substituida' && depois.substituida_por_id && depois.titulo === antiga.titulo && depois.descricao === antiga.descricao);
  await ir(`/empresa/decisoes/${antiga.id}`);
  await esperarTexto('Substituída por');
  ok('e mostra quem a substituiu, sem a ação de substituir de novo', !(await existeBotao('Substituir por nova decisão')));
  await ir('/empresa/decisoes');
  await esperarTexto('Participação de teste');
  ok('a lista geral traz todas, de todos os módulos', (await pagina()).includes('Substituída') && (await pagina()).includes('Participação de teste'));
});

await passo('Larguras: 1440, 1024, 768 e 360 sem rolagem lateral', async () => {
  const reuniao = (await tabela('reuniao'))[0];
  const decisao = (await tabela('decisao'))[0];
  const obrigacao = (await tabela('obrigacao_corporativa'))[0];
  const telas = [
    ['painel', '/empresa', 'Jornada da empresa'],
    ['socias', '/empresa/socias', 'Participação cadastrada'],
    ['acordos', '/empresa/acordos', 'Memorando entre sócias'],
    ['acordo', `/empresa/acordos/${ID_MEMORANDO}`, 'Resumo estruturado'],
    ['ativos', '/empresa/ativos', 'Titular'],
    ['marcas', '/empresa/marcas', 'marcas'],
    ['marca', `/empresa/marcas/${MARCA_NUMA}`, 'Pesquisas'],
    ['constituicao', '/empresa/constituicao', 'itens concluídos'],
    ['entidade', '/empresa/entidade', 'Cadastro compartilhado'],
    ['obrigacoes', '/empresa/obrigacoes', 'obrigaç'],
    ['obrigacao', `/empresa/obrigacoes/${obrigacao.id}`, 'Ocorrências'],
    ['reunioes', '/empresa/reunioes', 'reuni'],
    ['reuniao', `/empresa/reunioes/${reuniao.id}`, 'Pauta'],
    ['decisoes', '/empresa/decisoes', 'decisões'],
    ['decisao', `/empresa/decisoes/${decisao.id}`, 'Decisões registradas não são editáveis'],
  ];
  const todas = new Set(['painel', 'socias', 'acordos', 'ativos', 'constituicao', 'obrigacoes', 'reunioes']);
  for (const [largura, altura] of [
    [1440, 900],
    [1024, 768],
    [768, 1024],
    [360, 800],
  ]) {
    await c.tamanho(largura, altura);
    for (const [rotulo, caminho, pronto] of telas) {
      if ((largura === 1024 || largura === 768) && !todas.has(rotulo)) continue;
      await ir(caminho);
      await esperarTexto(pronto);
      await c.espera(250);
      await conferirTela(rotulo, largura);
      if (largura === 360 || largura === 1440) await c.foto(`b-${rotulo}-${largura}`);
    }
  }
  await ir('/empresa/socias');
  await esperarTexto('Participação cadastrada');
  await clicarBotao('Editar participação');
  await painelAberto();
  await c.espera(300);
  ok('no celular, a janela ocupa a tela inteira', await c.avaliar(`(()=>{const j=document.querySelector('.janela').getBoundingClientRect();return j.width>=359&&j.height>=700})()`));
  await conferirTela('janela de participação', 360);
  await c.foto('c-janela-participacao-360');
  await naJanela('Cancelar');
  await c.tamanho(1440, 900);
});

await terminar();
