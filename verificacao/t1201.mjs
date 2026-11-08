// T12.01 e T12.02 Implantações num Chrome de verdade: criar a partir do contrato assinado (sem duplicar),
// marcos e linha do tempo, desvio e alerta (CA-12.01), tarefas, horas, aceite como evento do contrato,
// lista com filtros e os três tamanhos. Uso: node t1201.mjs <pasta> <url>
import { iniciar } from './apoio.mjs';
import { diaBr, ID_CONTRATO, ID_KIPI, scriptDoContrato, somarDias } from './semear-m12.mjs';

const h = await iniciar({ nome: 't1201', porta: 9462 });
const { c, ok, passo, ir, texto, preencher, escolher, valor, esperarAviso, pularAbertura, tabela, conferirTela, painelAberto, painelFechado, clicarNoDialogo } = h;
const js = (v) => JSON.stringify(v);
const ID_CAMILA = '1c8e2d63-4a7f-4b2c-8e3d-6f9b8d5a2b02';
const DRIVE = 'https://drive.google.com/file/d/xyz/view';

await ir('/meu-dia');
const hoje = await c.avaliar(`new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date())`);
const prazo = somarDias(hoje, 30);
await pularAbertura();
await c.avaliar(scriptDoContrato(hoje));

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
const editarMarco = async (rotulo, campos) => {
  await c.avaliar(`document.querySelector('main button[aria-label=${js(`Editar ${rotulo}`)}]').click()`);
  await painelAberto();
  for (const [id, novo] of Object.entries(campos)) await preencher(id, novo);
  await c.espera(150);
};

for (const largura of [1440, 768, 360]) {
  await passo(`lista vazia em ${largura}px`, async () => {
    await c.tamanho(largura, largura === 360 ? 780 : 900);
    await ir('/operacao');
    await c.ate(`document.querySelector('main h1')?.textContent==='Implantações'`);
    await c.ate(`document.querySelector('main').textContent.includes('Nenhuma implantação ainda.')`);
    await c.espera(250);
    await conferirTela('/operacao vazia', largura);
  });
}
await c.tamanho(1440, 900);

await passo('o contrato assinado oferece "Criar implantação"', async () => {
  await ir(`/contratos/${ID_CONTRATO}`);
  await c.ate(`document.querySelector('main h1')?.textContent.includes('Kipi para o Café Aurora')`);
  ok('a faixa do contrato não fala mais em fase', !(await texto()).includes('Implantação é da F2'));
  await aba('Operação');
  ok('a aba Operação ainda vazia', (await texto()).includes('Nenhuma implantação deste contrato.'));
  await acaoDoMenu('Criar implantação');
  await painelAberto();
  await c.ate(`document.querySelector('.janela')?.textContent.includes('Entrega contratual')`);
  const janela = await texto('.janela');
  ok('a prévia herda o prazo contratual', janela.includes(diaBr(prazo)), janela.slice(0, 400));
  ok('e os critérios de aceite', janela.includes('Agenda funcionando no celular da equipe.'));
  ok('sem estimativa, sem número inventado', janela.includes('Não estimadas') && janela.includes('Não estimado'));
  ok('a tarefa do item sob medida vem sugerida e marcada', await c.avaliar(`[...document.querySelectorAll('.janela ul[aria-label="Tarefas sugeridas"] label')].some(l=>l.textContent.includes('Implantação assistida')&&l.querySelector('input').checked)`));
  ok('responsável sugerida: Tecnologia (Camila)', (await valor('criar-imp-responsavel')) === ID_CAMILA);
  await clicarNoDialogo('Criar implantação');
  await esperarAviso('criada, com 1 tarefa no Meu dia');
  await c.ate(`location.pathname.startsWith('/operacao/')&&document.querySelector('main h1')`);
  const [implantacao] = await tabela('implantacao');
  ok('nasce Não iniciada, do contrato e do Kipi', implantacao?.situacao === 'nao_iniciada' && implantacao.contrato_id === ID_CONTRATO && implantacao.produto_id === ID_KIPI && implantacao.responsavel_id === ID_CAMILA, JSON.stringify(implantacao));
  ok('5 marcos, sem datas inventadas', (await tabela('implantacao_marco')).filter((marco) => marco.implantacao_id === implantacao.id && !marco.planejado_em && !marco.realizado_em).length === 5);
});

await passo('criar de novo não duplica (RN-12.01)', async () => {
  await ir(`/contratos/${ID_CONTRATO}`);
  await c.ate(`document.querySelector('main h1')`);
  await acaoDoMenu('Criar implantação');
  await painelAberto();
  await c.ate(`document.querySelector('.janela')?.textContent.includes('Criar de novo não duplica')`);
  ok('a janela oferece abrir a que existe', (await texto('.janela')).includes('Abrir a implantação'));
  await clicarNoDialogo('Abrir a implantação');
  await c.ate(`location.pathname.startsWith('/operacao/')`);
  ok('continua uma implantação', (await tabela('implantacao')).length === 1);
});

const [implantacao] = await tabela('implantacao');
await passo('ficha: cabeçalho, prazo contratual e abas', async () => {
  await ir(`/operacao/${implantacao.id}`);
  await c.ate(`document.querySelector('main h1')`);
  const corpo = await texto();
  ok('código, situação e contrato', corpo.includes(implantacao.codigo) && corpo.includes('Não iniciada') && corpo.includes('CTR-2026-0901'));
  ok('entrega contratual, só leitura, com a regra', corpo.includes(diaBr(prazo)) && corpo.includes('30 dias corridos após assinatura'), corpo.slice(0, 600));
  ok('ainda sem entrega planejada', corpo.includes('Entrega ainda não planejada'));
  await aba('Tarefas');
  await c.ate(`document.querySelector('main').textContent.includes('Implantação assistida')`);
  ok('a tarefa é atividade do Meu dia vinculada', (await tabela('vinculo')).some((v) => (v.destino_tipo === 'implantacao' && v.destino_id === implantacao.id) || (v.origem_tipo === 'implantacao' && v.origem_id === implantacao.id)));
  await aba('Escopo');
  ok('escopo do contrato, só leitura', (await texto()).includes('Mudar o escopo é aditivo') && (await texto()).includes('Implantação assistida'));
  await aba('Marcos');
});

await passo('CA-12.01: entrega planejada depois do prazo avisa e cria alerta, sem mudar o contrato', async () => {
  const regraAntes = JSON.stringify(await tabela('regra_prazo'));
  await editarMarco('Entrega (Go Live)', { 'marco-planejado': somarDias(prazo, 5) });
  await c.ate(`document.querySelector('.janela')?.textContent.includes('Planejada depois do prazo contratual')`);
  ok('a janela avisa e deixa salvar', (await texto('.janela')).includes('Dá para salvar'));
  await clicarNoDialogo('Salvar marco');
  await esperarAviso('Marco salvo.');
  await painelFechado();
  await c.ate(`document.querySelector('main').textContent.includes('5 dias depois do prazo contratual')`);
  ok('a ficha mostra o desvio e a faixa', (await texto()).includes('A entrega planejada está 5 dias depois do prazo contratual'));
  const alertas = (await tabela('atividade')).filter((a) => a.origem_tipo === 'implantacao' && a.origem_id === implantacao.id);
  ok('alerta para a responsável, no prazo contratual', alertas.length === 1 && alertas[0].responsavel_id === ID_CAMILA && alertas[0].prazo === prazo && alertas[0].situacao === 'a_fazer', JSON.stringify(alertas[0] ?? {}));
  ok('a regra do contrato não mudou', JSON.stringify(await tabela('regra_prazo')) === regraAntes);
  ok('a linha do tempo destaca o prazo contratual', await c.avaliar(`Boolean(document.querySelector('main ol[aria-label="Linha do tempo"] [data-contratual]'))`));
});

await passo('o alerta aparece no Meu dia e leva à implantação', async () => {
  await ir('/meu-dia');
  await c.ate(`document.querySelector('main').textContent.includes('entrega planejada para')`, 8000);
  ok('com origem Operação', (await texto()).includes('Origem: Operação'));
});

await passo('apontar horas pela ficha, já com o vínculo', async () => {
  await ir(`/operacao/${implantacao.id}`);
  await c.ate(`document.querySelector('main h1')`);
  await clicarBotao('Apontar horas');
  await painelAberto();
  ok('vínculo e contexto preenchidos', (await valor('janela-horas-vinculo')) === `implantacao:${implantacao.id}` && (await valor('janela-horas-contexto')) === ID_KIPI);
  await preencher('janela-horas-horas', '2,5');
  await clicarNoDialogo('Apontar horas');
  await esperarAviso('Horas apontadas.');
  await painelFechado();
  await aba('Estimado × realizado');
  await c.ate(`document.querySelector('main ul[aria-label="Horas apontadas na implantação"]')`);
  ok('estimado × realizado mostra as horas', (await texto()).includes('2,5 h'));
  await aba('Marcos');
});

await passo('marcos realizados: Entregue, e o alerta se resolve', async () => {
  await editarMarco('Início (kickoff)', { 'marco-realizado': hoje });
  await clicarNoDialogo('Salvar marco');
  await esperarAviso('Marco salvo.');
  await painelFechado();
  await c.ate(`document.querySelector('main').textContent.includes('Em andamento')`);
  ok('Início realizado: Em andamento', true);
  await editarMarco('Entrega (Go Live)', { 'marco-realizado': hoje });
  await clicarNoDialogo('Salvar marco');
  await esperarAviso('Marco salvo.');
  await painelFechado();
  await c.ate(`[...document.querySelectorAll('main button')].some(b=>b.textContent.trim()==='Registrar aceite')`);
  ok('Entrega realizada: Entregue, e o aceite vira a ação principal', (await texto()).includes('Entregue'));
  ok('realizada antes do prazo', (await texto()).includes('30 dias antes do prazo contratual'));
  const alerta = (await tabela('atividade')).find((a) => a.origem_tipo === 'implantacao');
  ok('o alerta de prazo foi concluído pelo Sistema', alerta?.situacao === 'concluida');
});

await passo('aceite vira o evento Aceite do contrato (CA-12.02)', async () => {
  await clicarBotao('Registrar aceite');
  await painelAberto();
  await preencher('aceite-por', 'Ana do Café');
  await preencher('aceite-evidencia', DRIVE);
  await clicarNoDialogo('Registrar aceite');
  await esperarAviso('Aceite registrado.');
  await painelFechado();
  const evento = (await tabela('evento_contrato')).find((e) => e.contrato_id === ID_CONTRATO && e.tipo === 'aceite');
  ok('o contrato ganha o evento Aceite', evento?.data === hoje && evento.evidencia_url === DRIVE, JSON.stringify(evento ?? {}));
  await c.ate(`document.querySelector('main').textContent.includes('Em acompanhamento')`);
  ok('com aceite e acompanhamento por fazer: Em acompanhamento', true);
  await aba('Aceite');
  ok('a aba Aceite mostra quem aceitou', (await texto()).includes('Ana do Café'));
});

await passo('lista: colunas, desvio e filtros', async () => {
  await ir('/operacao');
  await c.ate(`document.querySelector('main table')?.textContent.includes(${js(implantacao.codigo)})`);
  const linha = await texto('main table');
  ok('contraparte, contrato, marco atual, entrega contratual e situação', linha.includes('CTR-2026-0901') && linha.includes('Configuração ou desenvolvimento') && linha.includes(diaBr(prazo)) && linha.includes('Em acompanhamento'), linha.slice(0, 500));
  ok('horas estimadas × apontadas', linha.includes('— × 2,5 h'));
  await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.startsWith('Situação')).click()`);
  await c.ate(`[...document.querySelectorAll('.menu-suspenso button, .dialogo button')].some(b=>b.textContent.trim()==='Cancelada')`);
  await c.avaliar(`[...document.querySelectorAll('.menu-suspenso button, .dialogo button')].find(b=>b.textContent.trim()==='Cancelada').click()`);
  await c.ate(`document.querySelector('main').textContent.includes('Nada com esses filtros')`);
  ok('filtro de situação', true);
  await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.trim().startsWith('Limpar')).click()`);
  await c.ate(`document.querySelector('main table')`);
});

await passo('o contrato mostra a implantação na aba Operação', async () => {
  await ir(`/contratos/${ID_CONTRATO}`);
  await c.ate(`document.querySelector('main h1')`);
  await aba('Operação');
  ok('a mesma implantação, sem cópia', (await texto()).includes(`${implantacao.codigo} · Kipi`));
});

for (const largura of [768, 360]) {
  await passo(`ficha e lista em ${largura}px`, async () => {
    await c.tamanho(largura, largura === 360 ? 780 : 900);
    await ir(`/operacao/${implantacao.id}`);
    await c.ate(`document.querySelector('main h1')`);
    await c.espera(250);
    await conferirTela('/operacao/[id]', largura);
    await c.foto(`ficha-${largura}`);
    await ir('/operacao');
    await c.ate(`document.querySelector('main').textContent.includes(${js(implantacao.codigo)})`);
    await conferirTela('/operacao', largura);
    await c.foto(`lista-${largura}`);
  });
}
await c.tamanho(1440, 900);

await h.terminar();
