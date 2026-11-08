// T12.03 Solicitações de suporte num Chrome de verdade: abrir com o SLA da oferta do contrato (contrato
// sugerido), usuário sem cadastro, responder com pausa, retomar, nota, horas, resolver e fechar, Novo escopo
// com oportunidade (CA-12.03), lista, relatório e os três tamanhos. Uso: node t1203.mjs <pasta> <url>
import { iniciar } from './apoio.mjs';
import { ID_CONTRATO, ID_KIPI, scriptDasRegras, scriptDoContrato } from './semear-m12.mjs';

const h = await iniciar({ nome: 't1203', porta: 9464 });
const { c, ok, passo, ir, texto, preencher, escolher, valor, esperarAviso, pularAbertura, tabela, conferirTela, painelAberto, painelFechado, clicarNoDialogo, dialogoAberto } = h;
const js = (v) => JSON.stringify(v);

await ir('/meu-dia');
const hoje = await c.avaliar(`new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date())`);
await pularAbertura();
await c.avaliar(scriptDoContrato(hoje));
await c.avaliar(scriptDasRegras());

const clicarBotao = async (rotulo, dentro = 'main') => {
  await c.ate(`[...document.querySelectorAll(${js(dentro + ' button')})].some(b=>b.textContent.trim()===${js(rotulo)}&&!b.disabled&&b.getBoundingClientRect().width>0)`);
  await c.avaliar(`[...document.querySelectorAll(${js(dentro + ' button')})].find(b=>b.textContent.trim()===${js(rotulo)}&&!b.disabled&&b.getBoundingClientRect().width>0).click()`);
};
const acaoDoMenu = async (rotulo) => {
  await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='Mais ações'&&b.getBoundingClientRect().width>0).click()`);
  await c.ate(`[...document.querySelectorAll('.menu-suspenso button, .dialogo button')].some(b=>b.textContent.trim()===${js(rotulo)})`);
  await c.avaliar(`[...document.querySelectorAll('.menu-suspenso button, .dialogo button')].find(b=>b.textContent.trim()===${js(rotulo)}).click()`);
};
const aba = async (rotulo) => {
  const alvo = `[...document.querySelectorAll('main [role=tab]')].find(a=>a.textContent.trim()===${js(rotulo)})`;
  await c.avaliar(`(()=>{const a=${alvo};a.focus();a.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}))})()`);
  await c.ate(`${alvo}.getAttribute('data-state')==='active'`);
};
const escolherContraparte = async (parte) => {
  await c.avaliar(`document.getElementById('sup-contraparte').focus()`);
  await preencher('sup-contraparte', parte);
  await c.ate(`document.querySelector('.janela [role=option]')`);
  await c.avaliar(`document.querySelector('.janela [role=option] button').click()`);
};
const novaSolicitacao = async () => {
  await ir('/operacao/suporte');
  await c.ate(`document.querySelector('main h1')?.textContent==='Solicitações de suporte'`);
  await clicarBotao('Nova solicitação');
  await painelAberto();
};
const solicitacao = async (codigo) => (await tabela('solicitacao_suporte')).find((linha) => linha.codigo === codigo);

for (const largura of [1440, 768, 360]) {
  await passo(`lista vazia em ${largura}px`, async () => {
    await c.tamanho(largura, largura === 360 ? 780 : 900);
    await ir('/operacao/suporte');
    await c.ate(`document.querySelector('main').textContent.includes('Nenhuma solicitação aberta.')`);
    await c.espera(250);
    await conferirTela('/operacao/suporte vazia', largura);
  });
}
await c.tamanho(1440, 900);

await passo('abrir: contrato sugerido e o SLA da oferta do contrato, congelado (RN-12.08)', async () => {
  await novaSolicitacao();
  await escolherContraparte('Souza');
  await escolher('sup-produto', ID_KIPI);
  await c.ate(`document.getElementById('sup-contrato')?.value===${js(ID_CONTRATO)}`);
  ok('o contrato vem sugerido pela contraparte e pelo produto', true);
  await escolher('sup-tipo', 'falha');
  await preencher('sup-titulo', 'A agenda não abre no celular');
  await clicarNoDialogo('Abrir solicitação');
  await esperarAviso('Solicitação SUP-2026-0001 aberta.');
  await c.ate(`location.pathname.startsWith('/operacao/suporte/')&&document.querySelector('main h1')`);
  const linha = await solicitacao('SUP-2026-0001');
  ok('aberta, com o SLA da oferta e os dois prazos', linha?.situacao === 'aberta' && linha.sla?.origem === 'oferta' && linha.sla.resposta_horas === 4 && Boolean(linha.prazo_resposta_em) && Boolean(linha.prazo_resolucao_em), JSON.stringify(linha?.sla));
  const lateral = await texto('main aside');
  ok('a ficha mostra o SLA e o contrato', lateral.includes('1ª resposta') && lateral.includes('Regra da oferta') && lateral.includes('CTR-2026-0901'), lateral.slice(0, 300));
});

await passo('responder aguardando o cliente pausa; o cliente responde e retoma', async () => {
  await clicarBotao('Responder');
  await painelAberto();
  ok('a janela avisa que é a primeira resposta', (await texto('.janela')).includes('É a primeira resposta'));
  await preencher('sup-texto', 'Pode mandar um print da tela?');
  await c.avaliar(`[...document.querySelectorAll('.janela label')].find(l=>l.textContent.includes('Aguardar o cliente')).querySelector('input').click()`);
  await clicarNoDialogo('Registrar resposta');
  await esperarAviso('O prazo fica pausado');
  await painelFechado();
  let linha = await solicitacao('SUP-2026-0001');
  ok('Aguardando cliente, com a primeira resposta e a pausa aberta', linha.situacao === 'aguardando_cliente' && Boolean(linha.primeira_resposta_em) && linha.pausas.length === 1 && linha.pausas[0].fim === null);
  await c.ate(`document.querySelector('main aside').textContent.includes('Pausado')`);
  ok('a resolução aparece pausada', true);
  await clicarBotao('Cliente respondeu');
  await painelAberto();
  await preencher('sup-texto', 'Mandou o print.');
  await clicarNoDialogo('Retomar o atendimento');
  await esperarAviso('Atendimento retomado');
  await painelFechado();
  linha = await solicitacao('SUP-2026-0001');
  ok('Em atendimento, com a pausa fechada', linha.situacao === 'em_atendimento' && Boolean(linha.pausas[0].fim));
  ok('a linha do tempo registra tudo', (await texto('main ol[aria-label="Linha do tempo da solicitação"]')).includes('Pode mandar um print da tela?') && (await texto('main ol[aria-label="Linha do tempo da solicitação"]')).includes('Cliente respondeu: Mandou o print.'));
});

await passo('nota interna, horas e resolver', async () => {
  await acaoDoMenu('Nota interna');
  await painelAberto();
  await preencher('sup-texto', 'Parece cache do app.');
  await clicarNoDialogo('Registrar nota');
  await esperarAviso('Nota registrada.');
  await painelFechado();
  await acaoDoMenu('Apontar horas');
  await painelAberto();
  ok('as horas vêm com o vínculo da solicitação', (await valor('janela-horas-vinculo')).startsWith('solicitacao_suporte:'));
  await preencher('janela-horas-horas', '0,5');
  await clicarNoDialogo('Apontar horas');
  await esperarAviso('Horas apontadas.');
  await painelFechado();
  await acaoDoMenu('Resolver');
  await painelAberto();
  await preencher('sup-texto', 'Limpamos o cache e atualizamos o app.');
  await clicarNoDialogo('Resolver');
  await esperarAviso('Solicitação resolvida.');
  await painelFechado();
  const linha = await solicitacao('SUP-2026-0001');
  ok('Resolvida, com a solução', linha.situacao === 'resolvida' && linha.solucao === 'Limpamos o cache e atualizamos o app.' && Boolean(linha.resolvida_em));
  await clicarBotao('Fechar');
  await dialogoAberto();
  await clicarNoDialogo('Fechar');
  await esperarAviso('Solicitação fechada.');
  ok('Fechada', (await solicitacao('SUP-2026-0001')).situacao === 'fechada');
  await aba('Horas');
  ok('as horas na ficha', (await texto()).includes('Horas apontadas: 0,5 h'));
});

await passo('usuário sem cadastro: nome e contato livres (RN-12.09)', async () => {
  await novaSolicitacao();
  await escolher('sup-produto', ID_KIPI);
  await preencher('sup-titulo', 'Esqueci a senha');
  await clicarNoDialogo('Abrir solicitação');
  await c.ate(`document.getElementById('sup-solicitante-erro')`);
  ok('pede contraparte ou nome e contato', (await h.erroDe('sup-solicitante')).includes('nome e o contato'));
  await preencher('sup-solicitante', 'Maria, maria@exemplo.com');
  await escolher('sup-prioridade', 'critica');
  await clicarNoDialogo('Abrir solicitação');
  await esperarAviso('Solicitação SUP-2026-0002 aberta.');
  const linha = await solicitacao('SUP-2026-0002');
  ok('sem contrato, vale a única oferta aprovada com SLA', linha.contraparte_id === null && linha.solicitante_texto === 'Maria, maria@exemplo.com' && linha.sla?.origem === 'oferta' && linha.sla.resposta_horas === 1, JSON.stringify(linha.sla));
});

await passo('CA-12.03: Novo escopo fica aguardando proposta e cria a oportunidade; o contrato não muda', async () => {
  const versoesAntes = JSON.stringify(await tabela('contrato_versao'));
  await novaSolicitacao();
  await escolherContraparte('Souza');
  await escolher('sup-produto', ID_KIPI);
  await escolher('sup-tipo', 'novo_escopo');
  await c.ate(`document.querySelector('.janela').textContent.includes('Novo escopo não é atendido como suporte')`);
  await preencher('sup-titulo', 'Integrar com o caixa');
  await clicarNoDialogo('Abrir solicitação');
  await esperarAviso('SUP-2026-0003 aberta');
  await c.ate(`document.querySelector('main h1')?.textContent==='Integrar com o caixa'`);
  ok('Aguardando proposta', (await solicitacao('SUP-2026-0003')).situacao === 'aguardando_proposta' && (await texto()).includes('Novo escopo não é executado como suporte'));
  await clicarBotao('Criar oportunidade');
  await esperarAviso('Oportunidade criada');
  await c.ate(`location.pathname.startsWith('/comercial/oportunidades/')`);
  const oportunidade = (await tabela('oportunidade')).find((linha) => linha.titulo === 'Aditivo: Integrar com o caixa');
  ok('a oportunidade nasce vinculada', Boolean(oportunidade) && (await solicitacao('SUP-2026-0003')).oportunidade_id === oportunidade.id);
  ok('o contrato não mudou', JSON.stringify(await tabela('contrato_versao')) === versoesAntes);
});

await passo('lista: recortes, SLA e o relatório de cumprimento', async () => {
  await ir('/operacao/suporte');
  await c.ate(`document.querySelector('main table')`);
  const abertas = await texto('main table');
  ok('abertas: a de Maria e a de novo escopo; a fechada fica fora', abertas.includes('SUP-2026-0002') && abertas.includes('SUP-2026-0003') && !abertas.includes('SUP-2026-0001'));
  ok('Aguardando proposta não conta SLA', abertas.includes('Aguardando proposta'));
  await c.avaliar(`[...document.querySelectorAll('main [aria-label="Recortes"] button')].find(b=>b.textContent.startsWith('Todas')).click()`);
  await c.ate(`document.querySelector('main table').textContent.includes('SUP-2026-0001')`);
  ok('Todas traz a fechada', true);
  await aba('Cumprimento de SLA');
  const relatorio = await texto();
  ok('o relatório por mês, produto e tipo', relatorio.includes('Por mês de abertura') && relatorio.includes('Por produto') && relatorio.includes('Por tipo') && relatorio.includes('Kipi'), relatorio.slice(0, 300));
});

await passo('o contrato lista as solicitações na aba Operação', async () => {
  await ir(`/contratos/${ID_CONTRATO}`);
  await c.ate(`document.querySelector('main h1')`);
  await aba('Operação');
  const corpo = await texto();
  ok('as do contrato, sem a de Maria', corpo.includes('SUP-2026-0001') && corpo.includes('SUP-2026-0003') && !corpo.includes('SUP-2026-0002'));
});

for (const largura of [768, 360]) {
  await passo(`ficha, janela e lista em ${largura}px`, async () => {
    await c.tamanho(largura, largura === 360 ? 780 : 900);
    const linha = await solicitacao('SUP-2026-0002');
    await ir(`/operacao/suporte/${linha.id}`);
    await c.ate(`document.querySelector('main h1')`);
    await c.espera(250);
    await conferirTela('/operacao/suporte/[id]', largura);
    await c.foto(`ficha-${largura}`);
    await ir('/operacao/suporte');
    await c.ate(`document.querySelector('main').textContent.includes('SUP-2026-0002')`);
    await conferirTela('/operacao/suporte', largura);
    await clicarBotao('Nova solicitação');
    await painelAberto();
    await c.espera(300);
    await conferirTela('nova solicitação', largura);
    await c.foto(`nova-${largura}`);
  });
}
await c.tamanho(1440, 900);

await h.terminar();
