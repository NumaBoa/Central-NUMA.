// Verificação da etapa 15 (Integração F0a) no sistema real: os alertas de 05-M03 §5 no Meu dia, e o FL-01 de ponta a ponta.
import { ID_CAMILA, ID_KIMBERLY, iniciar } from './apoio.mjs';

const h = await iniciar({ nome: 'f0a', porta: 9365 });
const { c, ok, passo, ir, texto, valor, preencher, escolher, marcarPilula, clicarNoDialogo, dialogoAberto, dialogoFechado, painelAberto, pularAbertura, tabela, esperarAviso, conferirTela, terminar } = h;

const js = (v) => JSON.stringify(v);
const hoje = new Date();
const diaISO = (dias = 0) => new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + dias)).toISOString().slice(0, 10);
const DRIVE = 'https://drive.google.com/file/d/abc/view';
const ID_CONTA_KIMBERLY = 'a8c6e7da-d195-4a76-8c67-6f7a8b9c0d01';

const espacos = (t) => (t ?? '').replaceAll(' ', ' ');
const clicarBotao = (rotulo, onde = 'main') => c.avaliar(`(()=>{const b=[...document.querySelectorAll(${js(onde + ' button')})].find(b=>b.textContent.trim()===${js(rotulo)}||b.getAttribute('aria-label')===${js(rotulo)});if(!b)throw new Error('sem botão: '+${js(rotulo)});b.click()})()`);
const alertas = async () => (await tabela('atividade')).filter((a) => a.tipo === 'alerta' && a.chave_idempotencia);
const alertaDe = async (titulo) => (await alertas()).find((a) => a.titulo === titulo);
const configurar = (chave, novo) => c.avaliar(`(()=>{const k='numa-central:v1:configuracao';const l=JSON.parse(localStorage.getItem(k));l.find(x=>x.chave===${js(chave)}).valor=${js(novo)};localStorage.setItem(k,JSON.stringify(l))})()`);
const mudarTabela = (nome, corpo) => c.avaliar(`(()=>{const k='numa-central:v1:${nome}';const l=JSON.parse(localStorage.getItem(k));${corpo};localStorage.setItem(k,JSON.stringify(l))})()`);
const avisoDasRotinas = `[...document.querySelectorAll('[data-sonner-toast]')].map(t=>t.textContent).find(t=>t.includes('Rotinas do dia executadas'))`;

/** "Rodar rotinas agora" em Configurações › Dados (02 §0.3). Espera o aviso anterior sair, para ler o novo. */
async function rodarRotinas() {
  await ir('/configuracoes/dados');
  await c.ate(`[...document.querySelectorAll('main button')].some(b=>b.textContent==='Rodar rotinas agora')`);
  await c.ate(`!(${avisoDasRotinas})`);
  await c.espera(200);
  const rodadas = () => c.avaliar(`JSON.parse(localStorage.getItem('numa-central:v1:auditoria')).filter(e=>e.depois?.funcao==='rodar_rotinas').map(e=>e.depois.novos)`);
  const antes = await rodadas();
  const desabilitado = await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent==='Rodar rotinas agora').disabled`);
  await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent==='Rodar rotinas agora').click()`);
  await c.ate(avisoDasRotinas);
  await c.espera(200);
  // A rodada manual roda de fato, mesmo com o clique logo ao abrir a página: fica no histórico.
  if (desabilitado || (await rodadas()).length !== antes.length + 1) throw new Error(`a rodada manual não rodou: ${JSON.stringify(await rodadas())}`);
  return espacos(await c.avaliar(avisoDasRotinas));
}

const irMeuDia = async () => {
  await ir('/meu-dia');
  await c.ate(`document.querySelector('main article')`);
  await c.espera(250);
};
const cartao = (titulo) => `[...document.querySelectorAll('main article')].find(a=>a.querySelector('h3')?.textContent===${js(titulo)})`;
const textoDoCartao = async (titulo) => espacos(await c.avaliar(`(${cartao(titulo)})?.textContent ?? ''`));
const acaoDoCartao = (titulo) => c.avaliar(`(()=>{const a=(${cartao(titulo)})?.querySelector('a');return a?{texto:a.textContent.trim(),href:a.getAttribute('href')}:null})()`);
const aba = async (rotulo) => {
  const i = await c.avaliar(`[...document.querySelectorAll('main [role=tab]')].findIndex(a=>a.textContent.trim()===${js(rotulo)})`);
  await c.clicar(`main [role=tab]:nth-child(${i + 1})`);
  await c.espera(200);
};

await c.tamanho(1440, 900);

await passo('as rotinas do dia geram os alertas da F0a', async () => {
  await ir('/meu-dia');
  await pularAbertura();
  ok('sem rodar as rotinas, nenhum alerta gerado', (await alertas()).length === 0);
  const aviso = await rodarRotinas();
  ok('o aviso conta os alertas novos (02 §0.5)', aviso.includes('5 alertas novos'), aviso);
  const lista = await alertas();
  ok('cinco alertas, todos de exemplo, como os registros de onde vieram', lista.length === 5 && lista.every((a) => a.exemplo), lista.map((a) => a.titulo).join(' | '));
  ok('dois pagamentos vencidos, com Registrar baixa', ['Pagamento vencido: Certificado digital', 'Pagamento vencido: Honorários de contabilidade'].every((t) => lista.some((a) => a.titulo === t && a.alerta_motivo === 'Vencido' && a.alerta_acao === 'registrar_baixa')));
  ok('duas renovações, para a responsável financeira', ['Renovação de Traço Editor', 'Renovação de Nuvem Clara Hosting'].every((t) => lista.some((a) => a.titulo === t && a.alerta_motivo === 'Renovação' && a.responsavel_id === ID_KIMBERLY)));
  ok('o domínio, 45 dias antes, para a responsável dele', lista.some((a) => a.titulo === 'Renovar o domínio kipi-exemplo.com.br' && a.responsavel_id === ID_CAMILA));
  const outra = await rodarRotinas();
  ok('rodar de novo não duplica (RT-09)', outra.includes('nada novo') && (await alertas()).length === 5, outra);
});

await passo('no Meu dia, a origem e o botão da ação (RN-03.12)', async () => {
  await irMeuDia();
  const vencido = await textoDoCartao('Pagamento vencido: Certificado digital');
  ok('o cartão mostra a origem e o motivo', vencido.includes('Origem: Financeiro · Vencido'), vencido);
  ok('vencido aparece como atrasado (RN-03.04)', /Atrasad/.test(vencido), vencido);
  const certificado = (await tabela('titulo')).find((t) => t.descricao === 'Certificado digital');
  ok('"Registrar baixa" leva à baixa do título', js(await acaoDoCartao('Pagamento vencido: Certificado digital')) === js({ texto: 'Registrar baixa', href: `/financeiro/${certificado.id}?acao=baixa` }));
  const traco = (await tabela('ferramenta')).find((f) => f.nome === 'Traço Editor');
  ok('"Revisar renovação" leva à ferramenta', js(await acaoDoCartao('Renovação de Traço Editor')) === js({ texto: 'Revisar renovação', href: `/ferramentas/${traco.id}` }) && (await textoDoCartao('Renovação de Traço Editor')).includes('Origem: Ferramentas · Renovação'));
  const dominio = (await tabela('ativo_digital')).find((a) => a.identificador === 'kipi-exemplo.com.br');
  ok('"Renovar" leva ao ativo', js(await acaoDoCartao('Renovar o domínio kipi-exemplo.com.br')) === js({ texto: 'Renovar', href: `/ferramentas/ativos/${dominio.id}` }) && (await textoDoCartao('Renovar o domínio kipi-exemplo.com.br')).includes('Origem: Ativos digitais · Vencimento'));
  await c.foto('a-meu-dia', { inteira: true });
});

await passo('FL-01: o vencimento da assinatura, pago com o cartão pessoal', async () => {
  await configurar('alerta_vencimento_dias', 12);
  const aviso = await rodarRotinas();
  ok('com 12 dias de antecedência, nascem os de vencimento próximo', aviso.includes('4 alertas novos'), aviso);
  const nuvem = (await tabela('titulo')).find((t) => t.descricao === 'Nuvem Clara Hosting · Pro' && t.situacao === 'previsto');
  const alerta = await alertaDe('Vencimento de Nuvem Clara Hosting · Pro');
  ok('o alerta é do título, com o vencimento e a responsável dele', alerta?.alerta_motivo === 'Vencimento próximo' && alerta.origem_id === nuvem.id && alerta.prazo === nuvem.vencimento && alerta.responsavel_id === nuvem.responsavel_id, js(alerta));
  await ir(`/meu-dia?atividade=${alerta.id}`);
  await painelAberto();
  await c.ate(`document.querySelector('.painel-lateral')?.textContent.includes('Concluir aqui não executa a ação de origem.')`);
  await c.espera(200);
  const painel = espacos(await texto('.painel-lateral'));
  ok('o painel mostra a origem, o motivo e a data, e avisa que concluir não paga', painel.includes('Origem:Financeiro') && painel.includes('Motivo:Vencimento próximo') && painel.includes('Data de referência:'), painel.slice(0, 400));
  await c.foto('b-painel-alerta');
  await c.avaliar(`[...document.querySelectorAll('.painel-lateral a')].find(a=>a.textContent.trim()==='Registrar pagamento').click()`);
  await c.ate(`location.pathname==='/financeiro/${nuvem.id}'&&document.querySelector('.dialogo')?.textContent.includes('Registrar baixa')`);
  await c.espera(300);
  ok('abre T05.04 com o título já preenchido', (await texto('.dialogo')).includes('Nuvem Clara Hosting · Pro') && (await valor('baixa-valor')) === '20,00', await valor('baixa-valor'));
  ok('o endereço volta a ser o da ficha', (await c.avaliar(`location.search`)) === '');
  await escolher('baixa-conta', ID_CONTA_KIMBERLY);
  await preencher('baixa-cambio', '5,4321');
  await preencher('baixa-iof', '4,05');
  await c.ate(`document.getElementById('baixa-valor-brl')?.value==='112,69'`);
  ok('o valor em reais sai do câmbio de 4 casas (RT-07)', true);
  await preencher('baixa-comprovante', DRIVE);
  await c.ate(`[...document.querySelectorAll('.dialogo legend')].some(l=>l.textContent.startsWith('Conta de sócia'))`);
  ok('conta de sócia pergunta: aporte ou reembolso (RN-05.06)', true);
  await marcarPilula('Conta de sócia', 'Reembolso');
  await c.ate(`document.getElementById('baixa-vencimento-reembolso')`);
  await preencher('baixa-vencimento-reembolso', diaISO(20));
  await c.foto('c-baixa-fl01');
  await clicarNoDialogo('Registrar baixa');
  await esperarAviso('Baixa registrada.');
  await dialogoFechado();
  await c.espera(300);
  const pago = (await tabela('titulo')).find((t) => t.id === nuvem.id);
  const [baixa] = (await tabela('baixa')).filter((b) => b.titulo_id === nuvem.id);
  ok('quitado, com a baixa em dólar, câmbio, IOF e reais', pago.situacao === 'quitado' && baixa.valor_moeda === 20 && baixa.cambio === 5.4321 && baixa.iof_brl === 4.05 && baixa.valor_brl === 112.69, js(baixa));
  const reembolso = (await tabela('titulo')).find((t) => t.id === baixa.titulo_reembolso_id);
  ok('nasce o reembolso para Kimberly, no valor em reais', reembolso?.origem === 'reembolso' && reembolso.beneficiario_pessoa_id === ID_KIMBERLY && reembolso.valor === 112.69 && reembolso.vencimento === diaISO(20), js(reembolso));
  const produtosDaFerramenta = (await tabela('ferramenta_contexto')).filter((x) => x.ferramenta_id === nuvem.ferramenta_id && !x.arquivado_em).map((x) => x.produto_id).sort();
  const rateio = (await tabela('titulo_rateio')).filter((r) => r.titulo_id === nuvem.id && !r.arquivado_em);
  ok('o custo fica rateado entre os produtos da ferramenta', js(rateio.map((r) => r.produto_id).sort()) === js(produtosDaFerramenta) && Math.abs(rateio.reduce((t, r) => t + r.percentual, 0) - 100) < 0.01, js(rateio.map((r) => [r.produto_id, r.percentual])));
  const concluido = (await alertas()).find((a) => a.id === alerta.id);
  ok('CA-03.11: o alerta é concluído na hora, pelo Sistema, com a nota', concluido.situacao === 'concluida' && concluido.concluida_por === null && concluido.conclusao_nota === 'Concluído por Registrar pagamento em Financeiro.', js(concluido));
  await ir(`/meu-dia?atividade=${alerta.id}`);
  await painelAberto();
  await c.ate(`document.querySelector('.painel-lateral')?.textContent.includes('Concluído por Registrar pagamento em Financeiro.')`);
  ok('o painel diz quem concluiu e por quê', (await texto('.painel-lateral')).includes('por Sistema. Concluído por Registrar pagamento em Financeiro.'));
  await c.tecla('Escape');
});

await passo('CA-03.13: adiar o vencimento atualiza o mesmo alerta', async () => {
  const anuncio = (await tabela('titulo')).find((t) => t.descricao === 'Anúncio de lançamento do Zupi');
  const antes = await alertaDe('Vencimento de Anúncio de lançamento do Zupi');
  ok('o alerta existe', antes?.origem_id === anuncio.id && antes.situacao === 'a_fazer');
  await ir(`/financeiro/${anuncio.id}`);
  await c.ate(`document.querySelector('main h1')?.textContent.includes('Anúncio de lançamento do Zupi')`);
  await c.espera(200);
  for (const dias of [11, 40]) {
    await clicarBotao('Editar');
    await painelAberto();
    await c.espera(320);
    await preencher('titulo-vencimento', diaISO(dias));
    await c.espera(100);
    await clicarNoDialogo('Salvar');
    await esperarAviso('Lançamento atualizado.');
    await c.ate(`!document.querySelector('.painel-lateral')`);
    await c.espera(300);
    const dele = (await alertas()).filter((a) => a.origem_id === anuncio.id);
    ok(`adiado para ${dias} dias: um alerta só, aberto, com a data nova`, dele.length === 1 && dele[0].id === antes.id && dele[0].situacao === 'a_fazer' && dele[0].prazo === diaISO(dias) && dele[0].alerta_data_referencia === diaISO(dias), js(dele.map((a) => [a.situacao, a.prazo])));
  }
  await aba('Atividades');
  await c.ate(`document.querySelector('main').textContent.includes('Vencimento de Anúncio de lançamento do Zupi')`);
  ok('a aba Atividades da ficha mostra o alerta dela (T05.03)', true);
});

await passo('CA-03.12: concluir o alerta à mão não paga', async () => {
  const traco = (await tabela('titulo')).find((t) => t.descricao === 'Traço Editor · Equipe' && t.situacao === 'previsto');
  const alerta = await alertaDe('Vencimento de Traço Editor · Equipe');
  ok('o alerta do título previsto existe', alerta?.origem_id === traco.id);
  await irMeuDia();
  await c.clicar(`[aria-label="Concluir Vencimento de Traço Editor · Equipe"]`);
  await c.ate(`[...document.querySelectorAll('[data-sonner-toast]')].length>0`);
  await c.espera(400);
  const depois = (await alertas()).find((a) => a.id === alerta.id);
  ok('o alerta fica concluído por quem concluiu', depois.situacao === 'concluida' && depois.concluida_por === ID_KIMBERLY, js([depois.situacao, depois.concluida_por]));
  ok('e o título continua sem pagar', (await tabela('titulo')).find((t) => t.id === traco.id).situacao === 'previsto' && !(await tabela('baixa')).some((b) => b.titulo_id === traco.id));
  await rodarRotinas();
  ok('ele não volta na rotina seguinte (RN-03.13)', (await alertas()).filter((a) => a.origem_id === traco.id && a.alerta_motivo === 'Vencimento próximo').length === 1 && (await alertas()).find((a) => a.id === alerta.id).situacao === 'concluida');
});

await passo('fim do teste da ferramenta, e o cancelamento conclui o alerta', async () => {
  await configurar('alerta_fim_teste_dias', 7);
  const aviso = await rodarRotinas();
  const luma = (await tabela('ferramenta')).find((f) => f.nome === 'Luma IA');
  const alerta = await alertaDe('Fim do teste de Luma IA');
  ok('nasce o alerta do fim do teste, para a responsável técnica', aviso.includes('1 alerta novo') && alerta?.alerta_motivo === 'Fim do período de teste' && alerta.responsavel_id === luma.responsavel_tecnico_id && alerta.alerta_acao === 'decidir_teste', aviso);
  await irMeuDia();
  ok('o botão diz a decisão', (await acaoDoCartao('Fim do teste de Luma IA'))?.texto === 'Decidir: assinar ou cancelar');
  await c.avaliar(`(${cartao('Fim do teste de Luma IA')}).querySelector('a').click()`);
  await c.ate(`location.pathname==='/ferramentas/${luma.id}'&&document.querySelector('main h1')?.textContent.includes('Luma IA')`);
  await c.espera(300);
  ok('leva à ficha da ferramenta', true);
  await clicarBotao('Mais ações da ferramenta');
  await c.ate(`document.querySelector('.menu-suspenso')`);
  await c.espera(160);
  await clicarBotao('Cancelar ferramenta', '.menu-suspenso');
  await dialogoAberto();
  await c.espera(160);
  await preencher('cancelar-motivo', 'Não vamos assinar');
  await clicarNoDialogo('Cancelar ferramenta');
  await esperarAviso('Ferramenta cancelada.');
  await dialogoFechado();
  await c.espera(300);
  ok('o alerta é concluído na hora, com a nota de Ferramentas', (await alertas()).find((a) => a.id === alerta.id)?.conclusao_nota === 'Concluído por Cancelar ferramenta em Ferramentas.', (await alertas()).find((a) => a.id === alerta.id)?.conclusao_nota);
});

await passo('prazo para cancelar: renovação − aviso − 3 dias', async () => {
  const nuvem = (await tabela('ferramenta')).find((f) => f.nome === 'Nuvem Clara Hosting');
  const proxima = (await tabela('assinatura_ferramenta')).find((a) => a.ferramenta_id === nuvem.id && a.situacao === 'ativa').proxima_cobranca;
  await mudarTabela('assinatura_ferramenta', `l.forEach(x=>{if(x.ferramenta_id===${js(nuvem.id)}&&x.situacao==='ativa')x.aviso_cancelamento_dias=10})`);
  await rodarRotinas();
  const alerta = await alertaDe('Prazo para cancelar Nuvem Clara Hosting');
  const limite = new Date(`${proxima}T00:00:00Z`);
  limite.setUTCDate(limite.getUTCDate() - 10);
  ok('o prazo é a renovação menos o aviso, e nasce 3 dias antes dele', alerta?.alerta_motivo === 'Prazo para cancelar' && alerta.prazo === limite.toISOString().slice(0, 10) && alerta.alerta_acao === 'cancelar_ou_manter' && alerta.responsavel_id === ID_KIMBERLY, js(alerta && [alerta.prazo, proxima]));
});

await passo('o domínio renovado conclui o alerta', async () => {
  const dominio = (await tabela('ativo_digital')).find((a) => a.identificador === 'kipi-exemplo.com.br');
  const alerta = await alertaDe('Renovar o domínio kipi-exemplo.com.br');
  await irMeuDia();
  await c.avaliar(`(${cartao('Renovar o domínio kipi-exemplo.com.br')}).querySelector('a').click()`);
  await c.ate(`location.pathname==='/ferramentas/ativos/${dominio.id}'&&document.querySelector('main h1')`);
  await c.espera(300);
  await aba('Atividades');
  await c.ate(`document.querySelector('main').textContent.includes('Renovar o domínio kipi-exemplo.com.br')`);
  ok('a ficha do ativo mostra o alerta dele', true);
  await clicarBotao('Editar');
  await painelAberto();
  await c.espera(320);
  await preencher('ativo-vencimento', diaISO(400));
  await c.espera(60);
  await clicarNoDialogo('Salvar');
  await esperarAviso('Ativo atualizado.');
  await c.ate(`!document.querySelector('.painel-lateral')`);
  await c.espera(300);
  ok('vencimento novo: o alerta se resolve, com a nota', (await alertas()).find((a) => a.id === alerta.id)?.conclusao_nota === 'Concluído: o vencimento do domínio foi atualizado.', (await alertas()).find((a) => a.id === alerta.id)?.conclusao_nota);
});

await passo('responsivo', async () => {
  for (const largura of [768, 360]) {
    await c.tamanho(largura, largura === 360 ? 780 : 900);
    await irMeuDia();
    await conferirTela('Meu dia com alertas', largura);
    if (largura === 360) await c.foto('d-meu-dia-360', { inteira: true });
    const alerta = await alertaDe('Pagamento vencido: Certificado digital');
    await ir(`/meu-dia?atividade=${alerta.id}`);
    await painelAberto();
    await c.ate(`document.querySelector('.painel-lateral')?.textContent.includes('Concluir aqui não executa a ação de origem.')`);
    await c.espera(300);
    await conferirTela('Painel do alerta', largura);
    if (largura === 360) await c.foto('e-painel-360');
    await c.tecla('Escape');
    await c.espera(200);
  }
  await c.tamanho(1440, 900);
});

await terminar();
