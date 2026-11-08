// Verificação da T07.10 (configuração contratual do produto) e dos campos de contrato da oferta (T07.04, 19 §8),
// no sistema real, em 1440 e 360. Nenhum valor daqui é da Numa: são só para exercitar o fluxo.
import { iniciar } from './apoio.mjs';

const h = await iniciar({ nome: 't0710', porta: 9378 });
const { c, ok, passo, ir, texto, preencher, pularAbertura, tabela, esperarAviso, conferirTela, terminar } = h;

const js = (v) => JSON.stringify(v);
const KIPI = 'c4e2a3f6-9d51-4c32-8e23-2b3c4d5e6f03';
const botao = (rotulo, onde = 'main') => `[...document.querySelectorAll(${js(onde + ' button')})].find(b=>b.textContent.trim()===${js(rotulo)})`;
const clicarBotao = (rotulo, onde) => c.avaliar(`(()=>{const b=${botao(rotulo, onde)};if(!b)throw new Error('sem botão: '+${js(rotulo)});b.click()})()`);
const marcar = (rotulo) => c.avaliar(`(()=>{const l=[...document.querySelectorAll('main label')].find(l=>l.textContent.trim()===${js(rotulo)});if(!l)throw new Error('sem caixa: '+${js(rotulo)});l.querySelector('input').click()})()`);
const valor = (id) => c.avaliar(`document.getElementById(${js(id)})?.value`);

const COMPLETO = {
  descricao_contratual: 'Teste de fluxo',
  funcoes_de_apoio: 'Teste de fluxo',
  email_contato: 'teste@exemplo.com.br',
  url_termos: 'https://exemplo.com.br/termos',
  url_privacidade: 'https://exemplo.com.br/privacidade',
  url_ajuda: 'https://exemplo.com.br/ajuda',
  prazo_reembolso_dias: '7',
  aviso_alteracao_dias: '30',
  aviso_manutencao_horas: '24',
  aviso_suboperador_dias: '10',
  prazo_encaminhar_titular_dias: '5',
  prazo_aviso_incidente_horas: '48',
  prazo_reativacao_horas: '24',
  aviso_resilicao_dias: '30',
  prazo_cura_dias: '10',
  aviso_cessao_dias: '30',
  prazo_exportacao_dias: '30',
  prazo_exclusao_dias: '30',
  prazo_expurgo_backup_dias: '90',
  categorias_dados_operador: 'Teste',
  categorias_titulares: 'Teste',
  categorias_dados_controlador: 'Teste',
  provedor_infraestrutura: 'Teste',
  local_armazenamento: 'Teste',
  transferencia_internacional_texto: 'Não há',
  medidas_seguranca: 'Teste',
  backup_frequencia: 'Diária',
  backup_retencao_dias: '30',
  procedimento_recuperacao: 'Teste',
  canal_privacidade: 'teste@exemplo.com.br',
  canal_incidentes: 'teste@exemplo.com.br',
};

await c.tamanho(1440, 900);
await ir(`/produtos/${KIPI}?aba=contrato`);
await pularAbertura();
await c.ate(`document.getElementById('contrato-nome_maiusculo')`);

await passo('T07.10: começa sem versão, vazia, com o nome vindo do produto', async () => {
  const m = await texto('main');
  ok('a aba Contrato aparece na ficha, mesmo com a F0a ativa', m.includes('Configuração contratual') && m.includes('Sem versão'));
  ok('nome em maiúsculas vem do produto', (await valor('contrato-nome_maiusculo')) === 'KIPI', await valor('contrato-nome_maiusculo'));
  ok('o resto começa vazio, sem padrão inventado', (await valor('contrato-prazo_reembolso_dias')) === '' && (await valor('contrato-descricao_contratual')) === '');
  ok('a faixa diz quantos campos faltam, sem despejar a lista', /faltam \d+ campos/.test(m), m.slice(0, 300));
  ok('salvar fica desligado sem alteração', await c.avaliar(`${botao('Salvar rascunho')}.disabled`));
});

await passo('T07.10: rascunho com vazios; enviar exige tudo', async () => {
  await preencher('contrato-descricao_contratual', 'Teste de fluxo');
  await c.espera(80);
  await clicarBotao('Salvar rascunho');
  await esperarAviso('Rascunho salvo (V1)');
  const [v1] = await tabela('configuracao_contratual');
  ok('grava a V1 em rascunho, com os vazios como null', v1?.versao === 1 && v1.situacao === 'rascunho' && v1.prazo_reembolso_dias === null, js(v1?.situacao));
  await clicarBotao('Enviar para validação');
  await esperarAviso('Falta preencher');
  ok('enviar com vazios é recusado e diz o que falta', (await tabela('configuracao_contratual'))[0].situacao === 'rascunho');
});

await passo('T07.10: mínimos de 19 §4 e formato dos links', async () => {
  await preencher('contrato-aviso_alteracao_dias', '15');
  await preencher('contrato-prazo_aviso_incidente_horas', '96');
  await preencher('contrato-url_ajuda', 'exemplo.com');
  await c.espera(100);
  const m = await texto('main');
  ok('alteração com menos de 30 dias', m.includes('pelo menos 30 dias (cl. 7.2)'));
  ok('incidente acima de 72 horas', m.includes('no máximo 72 horas'));
  ok('link sem https', m.includes('começando por https://'));
});

await passo('T07.10: completo, em validação, validada e nova versão', async () => {
  for (const [campo, texto] of Object.entries(COMPLETO)) await preencher(`contrato-${campo}`, texto);
  await marcar('Navegador');
  await marcar('CSV');
  await clicarBotao('Adicionar suboperador');
  await c.espera(80);
  await preencher('contrato-sub-0-nome', 'Teste');
  await c.espera(80);
  ok('a faixa de pendências some quando está completo', !(await texto('main')).includes('Para enviar à validação'), (await texto('main')).slice(0, 400));
  await clicarBotao('Enviar para validação');
  await esperarAviso('enviada para validação');
  await c.ate(`${botao('Validar')}`);
  ok('em validação, os campos ficam bloqueados', await c.avaliar(`document.getElementById('contrato-descricao_contratual').disabled`));
  await clicarBotao('Validar');
  await esperarAviso('V1 validada');
  await c.ate(`(document.querySelector('main').textContent).includes('V1 · Validada')`);
  ok('V1 validada, e a emissão já pode usá-la', (await tabela('configuracao_contratual'))[0].situacao === 'validada');
  await preencher('contrato-prazo_reembolso_dias', '14');
  await c.espera(80);
  ok('mudar uma validada vira a V2', await c.avaliar(`Boolean(${botao('Salvar como V2')})`));
  await clicarBotao('Salvar como V2');
  await esperarAviso('Rascunho salvo (V2)');
  const versoes = (await tabela('configuracao_contratual')).map((v) => `${v.versao}:${v.situacao}`).sort();
  ok('a V1 continua valendo enquanto a V2 é rascunho', js(versoes) === js(['1:validada', '2:rascunho']), js(versoes));
  ok('a tela diz qual versão vale hoje', (await texto('main')).includes('Vale hoje a V1'));
  await conferirTela('t0710-contrato', 1440);
});

await passo('T07.04: campos de contrato na oferta', async () => {
  await ir(`/produtos/${KIPI}?aba=ofertas`);
  await c.ate(botao('Nova oferta'));
  await clicarBotao('Nova oferta');
  await c.ate(`document.getElementById('oferta-nome')`);
  const j = await texto('.janela');
  ok('a seção "Para o contrato" está na janela', j.includes('Para o contrato') && j.includes('Teste grátis (dias)') && j.includes('Adicionais deste plano'));
  await preencher('oferta-nome', 'Teste de contrato');
  await preencher('oferta-teste-dias', 'sete');
  await clicarBotao('Criar oferta', '.janela');
  await c.espera(200);
  ok('teste em dias aceita só número', (await texto('.janela')).includes('Informe o número de dias'));
  await preencher('oferta-teste-dias', '14');
  await preencher('oferta-disponibilidade', '99,5');
  await clicarBotao('Criar oferta', '.janela');
  await esperarAviso('Oferta criada');
  const oferta = (await tabela('oferta')).find((o) => o.nome === 'Teste de contrato');
  ok('grava teste e meta, e o resto fica vazio', oferta?.teste_dias === 14 && oferta.disponibilidade_meta === 99.5 && oferta.suporte_canal === null && js(oferta.adicionais_ids) === '[]', js(oferta));
  await ir(`/produtos/${KIPI}?aba=contrato`);
  await c.ate(`document.getElementById('contrato-nome_maiusculo')`);
  await c.espera(300);
  ok('com teste grátis, o contrato passa a pedir o plano após o teste', (await texto('main')).includes('falta 1 campo') || (await texto('main')).includes('Plano após o fim do teste'));
});

await passo('360px', async () => {
  await c.tamanho(360, 800);
  await ir(`/produtos/${KIPI}?aba=contrato`);
  await c.ate(`document.getElementById('contrato-nome_maiusculo')`);
  await c.espera(300);
  await conferirTela('t0710-contrato-360', 360);
});

await terminar();
