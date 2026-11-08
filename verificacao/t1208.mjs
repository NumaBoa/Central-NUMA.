// T12.08 Estimado × realizado num Chrome de verdade: concluir uma implantação com estimativa, horas e prazo
// realizados; o relatório por produto, com amostra e desvio; a referência histórica na viabilidade (T10.04),
// por produto, sem somar. Uso: node t1208.mjs <pasta> <url>
import { iniciar } from './apoio.mjs';
import { ID_CONTRAPARTE, ID_CONTRATO, ID_KIMBERLY, ID_KIPI, scriptDoContrato, somarDias } from './semear-m12.mjs';

const h = await iniciar({ nome: 't1208', porta: 9467 });
const { c, ok, passo, ir, texto, preencher, esperarAviso, pularAbertura, tabela, conferirTela, painelAberto, painelFechado, clicarNoDialogo, dialogoAberto } = h;
const js = (v) => JSON.stringify(v);
const ID_ZUPI = 'c4e2a3f6-9d51-4c32-8e23-2b3c4d5e6f04';
const ID_OPORTUNIDADE = '7e000000-0000-4000-8000-000000000031';

await ir('/meu-dia');
const hoje = await c.avaliar(`new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date())`);
await pularAbertura();
await c.avaliar(scriptDoContrato(hoje));
// Dado de teste: uma oportunidade do Kipi e do Zupi, para ver a referência lado a lado.
await c.avaliar(`(()=>{const agora=new Date().toISOString();const base=(id)=>({id,criado_em:agora,criado_por:null,atualizado_em:agora,atualizado_por:null,arquivado_em:null,arquivado_por:null,versao_registro:1,exemplo:false});const put=(t,l)=>{const k='numa-central:v1:'+t;const a=JSON.parse(localStorage.getItem(k)||'[]');for(const x of l)if(!a.some(y=>y.id===x.id))a.push(x);localStorage.setItem(k,JSON.stringify(a))};put('oportunidade',[{...base(${js(ID_OPORTUNIDADE)}),codigo:'OPO-2026-0901',contraparte_id:${js(ID_CONTRAPARTE)},titulo:'Kipi e Zupi para a Souza',tipo:'sob_medida',origem:'indicacao',campanha_id:null,valor_estimado:null,valor_periodicidade:null,moeda:'BRL',probabilidade:null,fechamento_previsto:null,etapa:'qualificacao',etapa_desde:${js(hoje)},responsavel_id:${js(ID_KIMBERLY)},necessidade:null,motivo_perda:null,motivo_perda_texto:null,ganha_em:null,perdida_em:null,adesao_padrao:false}]);put('oportunidade_produto',[{...base('7e000000-0000-4000-8000-000000000032'),oportunidade_id:${js(ID_OPORTUNIDADE)},produto_id:${js(ID_KIPI)}},{...base('7e000000-0000-4000-8000-000000000033'),oportunidade_id:${js(ID_OPORTUNIDADE)},produto_id:${js(ID_ZUPI)}}])})()`);

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
const marco = async (rotulo, campos) => {
  await c.avaliar(`document.querySelector('main button[aria-label=${js(`Editar ${rotulo}`)}]').click()`);
  await painelAberto();
  if (campos.naoSeAplica) await c.avaliar(`[...document.querySelectorAll('.janela label')].find(l=>l.textContent.includes('Não se aplica')).querySelector('input').click()`);
  if (campos.realizado) await preencher('marco-realizado', campos.realizado);
  await clicarNoDialogo('Salvar marco');
  await esperarAviso('Marco salvo.');
  await painelFechado();
};

for (const largura of [1440, 768, 360]) {
  await passo(`vazio em ${largura}px`, async () => {
    await c.tamanho(largura, largura === 360 ? 780 : 900);
    await ir('/operacao/estimado');
    await c.ate(`document.querySelector('main').textContent.includes('Nenhuma implantação ainda.')`);
    await c.espera(250);
    await conferirTela('/operacao/estimado vazio', largura);
  });
}
await c.tamanho(1440, 900);

await passo('a viabilidade começa com "Histórico insuficiente", por produto', async () => {
  await ir(`/comercial/oportunidades/${ID_OPORTUNIDADE}`);
  await c.ate(`document.querySelector('main h1')`);
  await aba('Viabilidade');
  await clicarBotao('Registrar viabilidade');
  await painelAberto();
  await c.ate(`document.querySelector('.janela [data-referencia-historica]')`);
  const referencia = await texto('.janela [data-referencia-historica]');
  ok('uma linha por produto, sem somar', referencia.includes('Kipi: Histórico insuficiente') && referencia.includes('Zupi: Histórico insuficiente'), referencia);
  await c.tecla('Escape');
  await c.espera(300);
});

await passo('concluir uma implantação com estimativa, horas e prazo realizados', async () => {
  await ir(`/contratos/${ID_CONTRATO}`);
  await c.ate(`document.querySelector('main h1')`);
  await acaoDoMenu('Criar implantação');
  await painelAberto();
  await c.ate(`document.querySelector('.janela ul[aria-label="Tarefas sugeridas"]')`);
  await c.avaliar(`document.querySelectorAll('.janela ul[aria-label="Tarefas sugeridas"] input').forEach(i=>i.checked&&i.click())`);
  await clicarNoDialogo('Criar implantação');
  await esperarAviso('criada');
  await c.ate(`location.pathname.startsWith('/operacao/')&&document.querySelector('main h1')`);
  await acaoDoMenu('Editar responsável e estimativas');
  await painelAberto();
  await preencher('imp-horas', '10');
  await preencher('imp-prazo', '20');
  await clicarNoDialogo('Salvar alterações');
  await esperarAviso('Implantação atualizada.');
  await painelFechado();
  await marco('Início (kickoff)', { realizado: somarDias(hoje, -10) });
  await marco('Configuração ou desenvolvimento', { naoSeAplica: true });
  await marco('Validação com o cliente', { naoSeAplica: true });
  await marco('Entrega (Go Live)', { realizado: hoje });
  await marco('Acompanhamento', { naoSeAplica: true });
  await acaoDoMenu('Apontar horas');
  await painelAberto();
  await preencher('janela-horas-horas', '12');
  await clicarNoDialogo('Apontar horas');
  await esperarAviso('Horas apontadas.');
  await painelFechado();
  await acaoDoMenu('Concluir');
  await dialogoAberto();
  ok('a confirmação avisa que falta o aceite', (await texto('.dialogo')).includes('O aceite da entrega não foi registrado.'));
  await clicarNoDialogo('Concluir');
  await esperarAviso('Implantação concluída.');
  await c.ate(`document.querySelector('main').textContent.includes('Fica só para consulta')`);
  ok('Concluída', (await tabela('implantacao'))[0].situacao === 'concluida');
  await aba('Estimado × realizado');
  const corpo = await texto();
  ok('na ficha: +20% de horas e −50% de prazo', corpo.includes('+20%') && corpo.includes('−50%'), corpo.slice(0, 200));
});

await passo('o relatório por produto: amostra, médias e desvios', async () => {
  await ir('/operacao/estimado');
  await c.ate(`document.querySelector(${js(`main [data-produto="${ID_KIPI}"]`)})`);
  const cartao = await texto(`main [data-produto="${ID_KIPI}"]`);
  ok('a referência do Kipi', cartao.includes('Kipi: média de 12 h (1 com horas) e 10 dias (1 com prazo), em 1 implantação concluída'), cartao.slice(0, 300));
  ok('desvio médio e a implantação concluída', cartao.includes('+20%') && cartao.includes('−50%') && cartao.includes('IMP-2026-0001'));
});

await passo('a viabilidade passa a mostrar a referência do Kipi, e o Zupi continua sem', async () => {
  await ir(`/comercial/oportunidades/${ID_OPORTUNIDADE}`);
  await c.ate(`document.querySelector('main h1')`);
  await aba('Viabilidade');
  await clicarBotao('Registrar viabilidade');
  await painelAberto();
  await c.ate(`document.querySelector('.janela [data-referencia-historica]')?.textContent.includes('média de 12 h')`);
  const referencia = await texto('.janela [data-referencia-historica]');
  ok('lado a lado, sem somar', referencia.includes('Kipi: média de 12 h') && referencia.includes('Zupi: Histórico insuficiente'), referencia);
  await c.tecla('Escape');
  await c.espera(300);
});

for (const largura of [768, 360]) {
  await passo(`relatório em ${largura}px`, async () => {
    await c.tamanho(largura, largura === 360 ? 780 : 900);
    await ir('/operacao/estimado');
    await c.ate(`document.querySelector(${js(`main [data-produto="${ID_KIPI}"]`)})`);
    await c.espera(250);
    await conferirTela('/operacao/estimado', largura);
    await c.foto(`estimado-${largura}`);
  });
}
await c.tamanho(1440, 900);

await h.terminar();
