import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarArmazenamentoEmMemoria, usarDriverDeTeste } from '@/dados/armazenamento';
import { ID_BRUNA, ID_CONTRAPARTE_CONTABILIDADE, ID_PRODUTO_KIPI } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import { buscarNaCentral } from './busca';

describe('T13.03: busca global', () => {
  beforeEach(() => {
    usarDriverDeTeste(criarArmazenamentoEmMemoria());
    esquecerMetaEmMemoria();
    vi.useFakeTimers({ now: new Date('2026-11-06T15:00:00.000Z'), toFake: ['Date'] });
  });
  afterEach(() => {
    usarDriverDeTeste(null);
    esquecerMetaEmMemoria();
    vi.useRealTimers();
  });

  const grupos = async (termo: string) => (await buscarNaCentral(termo)).map((grupo) => grupo.rotulo);
  const titulos = async (termo: string, rotulo: string) => (await buscarNaCentral(termo)).find((grupo) => grupo.rotulo === rotulo)?.itens.map((item) => item.titulo) ?? [];

  it('com menos de 2 letras, não busca', async () => {
    expect(await buscarNaCentral('')).toEqual([]);
    expect(await buscarNaCentral(' k ')).toEqual([]);
  });

  it('agrupa por tipo, na ordem da especificação', async () => {
    expect(await grupos('camila')).toEqual(['Pessoas']);
    expect(await grupos('zarpa')).toEqual(['Produtos', 'Atividades']);
    expect(await grupos('login')).toEqual(['Atividades']);
    expect(await grupos('souza')).toEqual(['Contrapartes', 'Pessoas']);
  });

  it('sem ligar para acento ou maiúscula, com as palavras em qualquer ordem', async () => {
    expect(await titulos('POLITICA privacidade', 'Atividades')).toEqual(['Escrever a política de privacidade do Sobrevivência Urbana']);
    expect(await titulos('privacidade política', 'Atividades')).toEqual(['Escrever a política de privacidade do Sobrevivência Urbana']);
  });

  it('mostra código, título e contexto, e leva ao registro', async () => {
    const [grupo] = await buscarNaCentral('corrigir o erro');
    expect(grupo?.itens[0]).toMatchObject({ codigo: 'ATV-2026-0003', titulo: 'Corrigir o erro no login do Kipi', detalhe: 'Tarefa · Em andamento · Kipi' });
    expect(grupo?.itens[0]?.href).toMatch(/^\/meu-dia\?atividade=/);
    const [contraparte] = await buscarNaCentral('souza contabilidade');
    expect(contraparte?.itens[0]).toMatchObject({ titulo: 'Souza Contabilidade', detalhe: 'Souza Contabilidade Ltda', href: `/comercial/contrapartes/${ID_CONTRAPARTE_CONTABILIDADE}/cadastro` });
    const pessoa = (await buscarNaCentral('bruna')).find((item) => item.rotulo === 'Pessoas');
    expect(pessoa?.itens[0]).toMatchObject({ titulo: 'Bruna Alves', detalhe: 'Freelancer de design', href: `/configuracoes/cadastros/pessoas/${ID_BRUNA}` });
    const produto = (await buscarNaCentral('kipi')).find((item) => item.rotulo === 'Produtos');
    expect(produto?.itens[0]).toMatchObject({ titulo: 'Kipi', href: `/produtos/${ID_PRODUTO_KIPI}` });
  });

  it('código exato vem primeiro, para o Enter ir direto (T13.03)', async () => {
    const resultado = await buscarNaCentral('atv-2026-0010');
    expect(resultado[0]?.itens[0]).toMatchObject({ codigo: 'ATV-2026-0010', titulo: 'Definir o preço da oferta anual' });
    expect(resultado[0]?.itens).toHaveLength(1);
    const codigoDeProduto = (await repositorios.produto.obter(ID_PRODUTO_KIPI))!.codigo_curto;
    expect((await buscarNaCentral(codigoDeProduto))[0]?.rotulo).toBe('Produtos');
  });

  it('título que começa com a busca vem antes; abertas antes das encerradas', async () => {
    const lista = await titulos('conferir', 'Atividades');
    expect(lista.indexOf('Conferir as faturas de hospedagem')).toBeGreaterThanOrEqual(0);
    const atividade = (await repositorios.atividade.listar()).find((item) => item.titulo === 'Testar outra plataforma de e-mail')!;
    await repositorios.atividade.atualizar(atividade.id, { titulo: 'Conferir algo cancelado' });
    const aberta = (await repositorios.atividade.listar()).find((item) => item.situacao === 'a_fazer')!;
    await repositorios.atividade.atualizar(aberta.id, { titulo: 'Conferir algo aberto' });
    const depois = await titulos('conferir algo', 'Atividades');
    expect(depois).toEqual(['Conferir algo aberto', 'Conferir algo cancelado']);
  });

  it('até 5 por grupo, dizendo quantos há', async () => {
    const [grupo] = await buscarNaCentral('atv-2026');
    expect(grupo?.itens).toHaveLength(5);
    expect(grupo?.total).toBe(17);
  });

  it('o que foi arquivado não aparece', async () => {
    await repositorios.contraparte.arquivar(ID_CONTRAPARTE_CONTABILIDADE);
    expect(await grupos('souza contabilidade')).toEqual([]);
  });

  it('acha pelo e-mail e pela descrição', async () => {
    expect(await titulos('bruna@exemplo', 'Pessoas')).toEqual(['Bruna Alves']);
    const atividade = (await repositorios.atividade.listar())[0]!;
    await repositorios.atividade.atualizar(atividade.id, { descricao: 'palavra-rara' });
    expect(await titulos('palavra-rara', 'Atividades')).toEqual([atividade.titulo]);
  });

  it('nada encontrado', async () => {
    expect(await buscarNaCentral('xyzzy')).toEqual([]);
  });
});
