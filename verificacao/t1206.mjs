// T12.06 Horas num Chrome de verdade: lançamento rápido, múltiplos de 15 minutos, repetir último, edição,
// relatórios, remoção e a média apontada no simulador do M07 (D20). Uso: node t1206.mjs <pasta> <url>
import { iniciar, ID_KIMBERLY } from './apoio.mjs';

const h = await iniciar({ nome: 't1206', porta: 9461 });
const { c, ok, passo, ir, texto, preencher, escolher, valor, esperarAviso, pularAbertura, tabela, conferirTela, painelAberto, painelFechado, clicarNoDialogo, dialogoAberto } = h;
const js = (v) => JSON.stringify(v);
const ID_KIPI = 'c4e2a3f6-9d51-4c32-8e23-2b3c4d5e6f03';
const hoje = await (async () => {
  await ir('/meu-dia');
  return c.avaliar(`new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date())`);
})();
const mesPassado = (() => {
  const [ano, mes] = hoje.split('-').map(Number);
  const total = ano * 12 + mes - 2;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-10`;
})();
const clicarBotao = async (rotulo, dentro = 'main') => {
  await c.ate(`[...document.querySelectorAll(${js(dentro + ' button')})].some(b=>b.textContent.trim()===${js(rotulo)}&&!b.disabled)`);
  await c.avaliar(`[...document.querySelectorAll(${js(dentro + ' button')})].find(b=>b.textContent.trim()===${js(rotulo)}&&!b.disabled).click()`);
};
const aba = async (rotulo) => {
  const alvo = `[...document.querySelectorAll('main [role=tab]')].find(a=>a.textContent.trim()===${js(rotulo)})`;
  await c.avaliar(`(()=>{const a=${alvo};a.focus();a.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}))})()`);
  await c.ate(`${alvo}.getAttribute('data-state')==='active'`);
};
const apontar = async ({ data = hoje, horas, contexto = ID_KIPI, descricao = '' }) => {
  await preencher('rapido-horas-data', data);
  await preencher('rapido-horas-horas', horas);
  await escolher('rapido-horas-contexto', contexto);
  await preencher('rapido-horas-descricao', descricao);
  await clicarBotao('Apontar horas');
};

await c.tamanho(1440, 900);
await pularAbertura();

for (const largura of [1440, 768, 360]) {
  await passo(`rota em ${largura}px`, async () => {
    await c.tamanho(largura, largura === 360 ? 780 : 900);
    await ir('/operacao/horas');
    await c.ate(`document.querySelector('main h1')?.textContent==='Horas'`);
    await c.ate(`document.getElementById('rapido-horas-horas')`);
    await c.espera(250);
    await conferirTela('/operacao/horas', largura);
    await c.foto(`horas-${largura}`);
  });
}
await c.tamanho(1440, 900);

await passo('menu: Operação liberada, com as sete áreas', async () => {
  ok('Operação no menu leva ao módulo', await c.avaliar(`[...document.querySelectorAll('nav a')].some(a=>a.getAttribute('href')==='/operacao'&&a.textContent.includes('Operação'))`));
  const abas = await texto('nav[aria-label="Áreas da Operação"]');
  ok('as abas do módulo estão lá', ['Implantações', 'Suporte', 'Regras de SLA', 'Incidentes', 'Horas', 'Notas de liberação', 'Estimado × realizado'].every((nome) => abas.includes(nome)), abas);
  ok('nada depende de fase', !(await texto()).includes('Fase'));
});

await passo('lançamento rápido: só múltiplos de 15 minutos (RN-12.12)', async () => {
  await ir('/operacao/horas');
  await c.ate(`document.getElementById('rapido-horas-horas')`);
  ok('a data começa hoje', (await valor('rapido-horas-data')) === hoje);
  await apontar({ horas: '1,1' });
  await c.ate(`document.getElementById('rapido-horas-horas-erro')`);
  ok('1,1 h é recusado', (await h.erroDe('rapido-horas-horas')).includes('múltiplos de 15 minutos'));
  ok('nada foi gravado', (await tabela('apontamento_horas')).length === 0);
});

await passo('lançamento rápido: 1:30 no Kipi', async () => {
  await apontar({ horas: '1:30', descricao: 'Revisar o cadastro de tarefas' });
  await esperarAviso('Horas apontadas.');
  const [linha] = await tabela('apontamento_horas');
  ok('grava 1,5 h, no Kipi, para Kimberly', linha?.horas === 1.5 && linha.produto_id === ID_KIPI && linha.pessoa_id === ID_KIMBERLY && linha.data === hoje, JSON.stringify(linha));
  await c.ate(`document.querySelector('main table')?.textContent.includes('Revisar o cadastro de tarefas')`);
  const corpo = await texto();
  ok('a lista e o total mostram 1,5 h', corpo.includes('1,5 h') && corpo.includes('Total: 1,5 h'));
  ok('o contexto fica para o próximo, as horas não', (await valor('rapido-horas-contexto')) === ID_KIPI && (await valor('rapido-horas-horas')) === '');
});

await passo('data no futuro é recusada', async () => {
  const amanha = await c.avaliar(`(()=>{const d=new Date(${js(hoje)}+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10)})()`);
  await apontar({ data: amanha, horas: '1' });
  await esperarAviso('a data vai até hoje');
  ok('continua com um apontamento', (await tabela('apontamento_horas')).length === 1);
  await preencher('rapido-horas-data', hoje);
});

await passo('repetir último', async () => {
  await escolher('rapido-horas-contexto', '');
  await clicarBotao('Repetir último');
  await esperarAviso('Preenchido com o último apontamento');
  ok('volta 1,5 h, o Kipi e a descrição, com a data de hoje', (await valor('rapido-horas-horas')) === '1,5' && (await valor('rapido-horas-contexto')) === ID_KIPI && (await valor('rapido-horas-descricao')) === 'Revisar o cadastro de tarefas' && (await valor('rapido-horas-data')) === hoje);
});

await passo('editar um apontamento na janela', async () => {
  await c.avaliar(`document.querySelector('main button[aria-label^="Editar o apontamento"]').click()`);
  await painelAberto();
  ok('a janela abre com 1,5', (await valor('janela-horas-horas')) === '1,5');
  await preencher('janela-horas-horas', '2');
  await clicarNoDialogo('Salvar alterações');
  await esperarAviso('Apontamento atualizado.');
  await painelFechado();
  ok('grava 2 h', (await tabela('apontamento_horas'))[0]?.horas === 2);
});

await passo('mês passado e relatórios', async () => {
  await apontar({ data: mesPassado, horas: '3', contexto: ID_KIPI, descricao: 'Mês anterior' });
  await esperarAviso('Horas apontadas.');
  await apontar({ data: hoje, horas: '0,5', contexto: 'institucional', descricao: 'Organizar o Drive' });
  await esperarAviso('Horas apontadas.');
  await c.ate(`document.querySelector('main').textContent.includes('Total: 2,5 h')`);
  ok('a lista do mês não traz o mês passado', !(await texto()).includes('Mês anterior'));
  await aba('Pessoa × produto');
  await c.ate(`document.querySelector('main section[aria-label^="Horas por pessoa"]')`);
  const relatorio = await texto('main section[aria-label^="Horas por pessoa"]');
  ok('pessoa × produto: Kipi, Numa institucional e o total', relatorio.includes('Kimberly Grebe') && relatorio.includes('Kipi') && relatorio.includes('Numa institucional') && relatorio.includes('2,5 h'), relatorio.slice(0, 200));
  await preencher('horas-mes', mesPassado.slice(0, 7));
  await c.ate(`document.querySelector('main section[aria-label^="Horas por pessoa"]')?.textContent.includes('3 h')`);
  ok('o mês escolhido muda o relatório', (await texto('main section[aria-label^="Horas por pessoa"]')).includes('3 h'));
  await preencher('horas-mes', hoje.slice(0, 7));
  await aba('Horas × receita');
  ok('horas × receita sem contrato com horas', (await texto()).includes('Nenhum contrato com horas apontadas.'));
  await aba('Apontamentos');
});

await passo('remover um apontamento', async () => {
  await c.avaliar(`[...document.querySelectorAll('main button[aria-label^="Remover o apontamento"]')].at(-1).click()`);
  await dialogoAberto();
  await clicarNoDialogo('Remover');
  await esperarAviso('Apontamento removido.');
  const linhas = await tabela('apontamento_horas');
  ok('fica arquivado, no histórico', linhas.filter((linha) => linha.arquivado_em).length === 1 && linhas.length === 3);
});

await passo('contexto global recorta as horas', async () => {
  await ir('/operacao/horas');
  await c.ate(`document.querySelector('main').textContent.includes('Horas em')`);
  await c.avaliar(`(()=>{const k='numa-central:v1:meta';const m=JSON.parse(localStorage.getItem(k));m.contexto_id='institucional';localStorage.setItem(k,JSON.stringify(m))})()`);
  await ir('/operacao/horas');
  await c.ate(`document.querySelector('main').textContent.includes('Total: 0,5 h')`, 8000).catch(() => {});
  const corpo = await texto();
  ok('na Numa institucional, só as horas sem produto', corpo.includes('Total: 0,5 h') && !corpo.includes('Revisar o cadastro de tarefas'), corpo.slice(0, 300));
  await c.avaliar(`(()=>{const k='numa-central:v1:meta';const m=JSON.parse(localStorage.getItem(k));m.contexto_id='consolidada';localStorage.setItem(k,JSON.stringify(m))})()`);
});

await passo('360px: lançamento rápido utilizável no celular', async () => {
  await c.tamanho(360, 780);
  await ir('/operacao/horas');
  await c.ate(`document.getElementById('rapido-horas-horas')`);
  await apontar({ horas: '0,25', contexto: ID_KIPI, descricao: 'No celular' });
  await esperarAviso('Horas apontadas.');
  ok('grava pelo celular', (await tabela('apontamento_horas')).some((linha) => linha.descricao === 'No celular' && linha.horas === 0.25));
  await conferirTela('/operacao/horas com dados', 360);
  await c.foto('horas-360-com-dados');
  await c.tamanho(1440, 900);
});

await passo('simulador do M07: a média apontada alimenta H (D20)', async () => {
  await ir(`/produtos/simulador?produto=${ID_KIPI}`);
  await c.ate(`document.querySelector('[data-horas-apontadas]')`, 8000);
  const dica = await texto('[data-horas-apontadas]');
  ok('mostra a média do mês passado', dica.includes('3 h/mês') && dica.includes('1 mês com apontamento de 3'), dica);
  await clicarBotao('Usar a média apontada');
  await c.ate(`document.getElementById('sim-horas')?.value==='3'`);
  ok('H recebe a média', (await valor('sim-horas')) === '3');
});

await h.terminar();
