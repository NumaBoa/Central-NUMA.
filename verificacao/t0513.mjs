// Verificação da T05.13 (Repasses a parceiros) e do mínimo de RN-11.26 no sistema real, em 1440 e 360.
// O contrato de parceiro e os termos do item saem pela tela; a assinatura é simulada nos dados (o fluxo de assinatura
// já tem a própria suíte). A regra da versão vigente na data da venda é coberta no Vitest.
import { iniciar } from './apoio.mjs';

const h = await iniciar({ nome: 't0513', porta: 9384 });
const { c, ok, passo, ir, texto, preencher, escolher, clicarNoDialogo, pularAbertura, tabela, esperarAviso, conferirTela, terminar } = h;

const js = (v) => JSON.stringify(v);
const KIPI = 'c4e2a3f6-9d51-4c32-8e23-2b3c4d5e6f03';
const hoje = new Date();
const mesPassado = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth() - 1, 1)).toISOString().slice(0, 7);
const esperarTitulo = (titulo) => c.ate(`document.querySelector('main h1')?.textContent.includes(${js(titulo)})`);
const clicarBotao = async (rotulo) => {
  await c.ate(`[...document.querySelectorAll('main button')].some(b=>b.textContent.trim()===${js(rotulo)}&&!b.disabled)`);
  await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()===${js(rotulo)}&&!b.disabled).click()`);
};
const janela = () => c.ate(`document.querySelector('.janela')`).then(() => c.espera(320));

await c.tamanho(1440, 900);
await ir('/financeiro/repasses');
await pularAbertura();
await esperarTitulo('Repasses a parceiros');

await passo('T05.13: a aba e o vazio', async () => {
  ok('a aba Repasses aparece no Financeiro, marcada', await c.avaliar(`Boolean(document.querySelector('nav[aria-label="Seções do financeiro"] a[href="/financeiro/repasses"][aria-current]'))`));
  ok('sem contrato de parceiro, o vazio explica o caminho', (await texto('main')).includes('Nenhum contrato de parceiro com termos de repasse em vigor.'));
  ok('lançar venda fica desligado', await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='Lançar venda').disabled`));
});

let contratoId;
await passo('RN-11.26: contrato de parceiro com os termos no item', async () => {
  await ir('/contratos/novo');
  await esperarTitulo('Novo contrato');
  await escolher('novo-familia', 'parceiro');
  await escolher('novo-tipo', 'parceria');
  await preencher('novo-titulo', 'Parceria de revenda');
  await c.avaliar(`document.getElementById('novo-contraparte').focus()`);
  await preencher('novo-contraparte', 'Souza');
  await c.ate(`document.querySelector('main [role=option]')`);
  await c.avaliar(`document.querySelector('main [role=option] button').click()`);
  await clicarBotao('Criar rascunho');
  await c.ate(`location.pathname.endsWith('/editar')`);
  contratoId = await c.avaliar(`location.pathname.split('/')[2]`);
  await c.avaliar(`[...document.querySelectorAll('nav button')].find(b=>b.textContent.replace(/^\\d+/,'').startsWith('Itens')).click()`);
  await clicarBotao('Item sob medida');
  await janela();
  await preencher('item-descricao', 'Revenda do Kipi');
  await escolher('item-produto', KIPI);
  await clicarNoDialogo('Salvar');
  await esperarAviso('Item adicionado.');
  await c.ate(`document.querySelector('[data-termos-de-repasse]')`);
  ok('o item mostra que ainda não tem termos', (await texto('[data-termos-de-repasse]')).includes('Sem termos de repasse'));
  await c.avaliar(`document.querySelector('button[aria-label="Termos de repasse de Revenda do Kipi"]').click()`);
  await janela();
  await preencher('repasse-percentual', '20');
  await clicarNoDialogo('Salvar termos');
  await esperarAviso('Escolha a base do repasse');
  ok('percentual sem base não passa', true);
  await escolher('repasse-base', 'bruta');
  await preencher('repasse-retencao', '10');
  await clicarNoDialogo('Salvar termos');
  await esperarAviso('Termos de repasse salvos.');
  await c.ate(`document.querySelector('[data-termos-de-repasse]').textContent.includes('20%')`);
  ok('o item mostra os termos', (await texto('[data-termos-de-repasse]')).includes('20% da venda bruta · retém 10%'));
  await conferirTela('t0513-contrato', 1440);
  // Assinatura simulada nos dados: a versão vira publicada, em vigor desde janeiro.
  await c.avaliar(`(()=>{const k='numa-central:v1:contrato_versao';const v=JSON.parse(localStorage.getItem(k));const linha=v.find(l=>l.contrato_id===${js(contratoId)});linha.situacao='publicada';linha.data_efeito='2026-01-01';localStorage.setItem(k,JSON.stringify(v));const kc='numa-central:v1:contrato';const cs=JSON.parse(localStorage.getItem(kc));const ct=cs.find(l=>l.id===${js(contratoId)});ct.versao_vigente_id=linha.id;ct.versao_elaboracao_id=null;localStorage.setItem(kc,JSON.stringify(cs))})()`);
});

await passo('T05.13: venda, prévia e título a pagar', async () => {
  await ir('/financeiro/repasses');
  await esperarTitulo('Repasses a parceiros');
  await clicarBotao('Lançar venda');
  await janela();
  ok('contrato e item já vêm escolhidos quando só há um', (await c.avaliar(`document.getElementById('venda-item').value`)) !== '');
  await preencher('venda-data', `${mesPassado}-15`);
  await preencher('venda-descricao', 'Vendas da quinzena');
  await preencher('venda-bruto', '1.000,00');
  await clicarNoDialogo('Lançar venda');
  await esperarAviso('Venda lançada.');
  await c.ate(`document.querySelector('[data-vendas]')`);
  ok('a venda aparece aguardando repasse', (await texto('[data-vendas]')).includes('Aguardando repasse'));

  await clicarBotao('Calcular repasses do período');
  await janela();
  await clicarNoDialogo('Ver prévia');
  await c.ate(`document.querySelector('[data-total-do-repasse]')`);
  const total = (await texto('[data-total-do-repasse]')).replace(/\s+/g, ' ');
  ok('prévia: 20% de 1.000 menos 10% retidos', total.includes('A repassar: R$ 180,00') && total.includes('retido para estornos: R$ 20,00'), total);
  await conferirTela('t0513-previa', 1440);
  await preencher('calculo-vencimento', `${hoje.toISOString().slice(0, 7)}-28`);
  await c.avaliar(`(()=>{const s=document.getElementById('calculo-categoria');const o=[...s.options].find(o=>o.textContent.trim()==='Outros');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,o.value);s.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await clicarNoDialogo('Gerar repasse');
  await esperarAviso('Repasse gerado');
  await c.ate(`document.querySelector('[data-repasse="aprovado"]')`);
  const titulos = (await tabela('titulo')).filter((t) => t.origem === 'repasse');
  ok('um título a pagar, aberto, de 180', titulos.length === 1 && titulos[0].natureza === 'pagar' && titulos[0].situacao === 'aberto' && titulos[0].valor === 180, js(titulos));
  ok('a venda passa a "Em repasse"', (await texto('[data-vendas]')).includes('Em repasse'));
  ok('calcular de novo fica desligado: nenhuma venda livre', await c.avaliar(`[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='Calcular repasses do período').disabled`));
  await conferirTela('t0513', 1440);
});

await passo('T05.13: cancelar pede motivo e libera as vendas', async () => {
  await clicarBotao('Cancelar');
  await c.ate(`document.querySelector('.dialogo textarea')`);
  await c.espera(420);
  await c.avaliar(`document.querySelector('.dialogo textarea').focus()`);
  await c.digitar('Relatório do parceiro corrigido');
  await clicarNoDialogo('Cancelar repasse');
  await esperarAviso('Repasse cancelado.');
  await c.ate(`document.querySelector('[data-repasse="cancelado"]')`);
  ok('o título é cancelado', (await tabela('titulo')).find((t) => t.origem === 'repasse').situacao === 'cancelado');
  ok('a venda volta a aguardar', (await texto('[data-vendas]')).includes('Aguardando repasse'));
});

await passo('360px', async () => {
  await c.tamanho(360, 800);
  await ir('/financeiro/repasses');
  await c.ate(`document.querySelector('[data-repasses]')`);
  await c.espera(300);
  ok('a aba ativa fica visível no celular', await c.avaliar(`(()=>{const a=document.querySelector('nav[aria-label="Seções do financeiro"] a[aria-current]').getBoundingClientRect();return a.left>=0&&a.right<=innerWidth+1})()`));
  await conferirTela('t0513-360', 360);
});

await terminar();
