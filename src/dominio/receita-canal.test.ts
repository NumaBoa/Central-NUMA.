import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarArmazenamentoEmMemoria, usarDriverDeTeste } from '@/dados/armazenamento';
import { garantirCarga } from '@/dados/carga';
import { ID_KIMBERLY, ID_PRODUTO_KIPI } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import { esquemaFormularioCanal, FORMULARIO_CANAL_VAZIO, salvarCanal } from './precificacao';
import { carregarReceitas, FORMULARIO_RECEITA_VAZIO, salvarReceita, taxaSugerida, vencimentoDoRepasse, type FormularioReceita } from './receita-canal';

describe('T05.12: receita por canal (RN-05.20 e RN-05.21)', () => {
  let canalId = '';
  const formulario = (parcial: Partial<FormularioReceita> = {}): FormularioReceita => ({ ...FORMULARIO_RECEITA_VAZIO, produto_id: ID_PRODUTO_KIPI, canal_id: canalId, competencia: '2026-10', receita_bruta: '1.000,00', taxas: '150,00', ...parcial });

  beforeEach(async () => {
    usarDriverDeTeste(criarArmazenamentoEmMemoria());
    esquecerMetaEmMemoria();
    vi.useFakeTimers({ now: new Date('2026-11-07T15:00:00.000Z'), toFake: ['Date'] });
    garantirCarga();
    canalId = (await salvarCanal(esquemaFormularioCanal.parse({ ...FORMULARIO_CANAL_VAZIO, nome: 'Google Play', tipo: 'loja_android', taxa_percentual: '15', prazo_repasse_dias: '15', verificado_em: '2026-10-01', fonte_url: 'https://exemplo.com.br/taxas' }))).id;
  });

  afterEach(() => {
    vi.useRealTimers();
    usarDriverDeTeste(null);
  });

  it('a taxa sugerida vem do percentual do canal; sem taxa informada, não há sugestão', () => {
    expect(taxaSugerida({ taxa_percentual: 15 }, 1000)).toBe(150);
    expect(taxaSugerida({ taxa_percentual: null }, 1000)).toBeNull();
    expect(vencimentoDoRepasse('2026-10', 15)).toBe('2026-11-15');
    expect(vencimentoDoRepasse('2026-02', null)).toBe('2026-02-28');
  });

  it('o líquido gera o título a receber do canal, aberto, nunca recebido sozinho', async () => {
    const receita = await salvarReceita(formulario({ assinantes_ativos: '42' }), ID_KIMBERLY);
    expect(receita).toMatchObject({ receita_bruta: 1000, taxas: 150, receita_liquida: 850, assinantes_ativos: 42, competencia: '2026-10-01' });
    const titulo = await repositorios.titulo.obter(receita.titulo_id!);
    expect(titulo).toMatchObject({ natureza: 'receber', valor: 850, situacao: 'aberto', origem: 'canal', origem_id: receita.id, vencimento: '2026-11-15', competencia: '2026-10-01' });
    const rateio = await repositorios.titulo_rateio.listar({ onde: { titulo_id: titulo!.id } });
    expect(rateio.map((linha) => [linha.produto_id, linha.percentual])).toEqual([[ID_PRODUTO_KIPI, 100]]);
    expect((await repositorios.baixa.listar({ onde: { titulo_id: titulo!.id } })).length).toBe(0);
  });

  it('um lançamento por produto × canal × competência; editar ajusta o título', async () => {
    const receita = await salvarReceita(formulario(), ID_KIMBERLY);
    await expect(salvarReceita(formulario(), ID_KIMBERLY)).rejects.toThrow('Já há receita');
    await salvarReceita(formulario({ receita_bruta: '2.000,00', taxas: '300,00' }), ID_KIMBERLY, receita.id);
    expect((await repositorios.titulo.obter(receita.titulo_id!))?.valor).toBe(1700);
    expect((await repositorios.titulo.listar()).filter((titulo) => titulo.origem === 'canal')).toHaveLength(1);
  });

  it('valida bruto, taxas, números e link', async () => {
    await expect(salvarReceita(formulario({ receita_bruta: '' }), ID_KIMBERLY)).rejects.toThrow('Informe a receita bruta');
    await expect(salvarReceita(formulario({ taxas: '2.000,00' }), ID_KIMBERLY)).rejects.toThrow('não podem passar');
    await expect(salvarReceita(formulario({ novos: 'dez' }), ID_KIMBERLY)).rejects.toThrow('Novos');
    await expect(salvarReceita(formulario({ fonte_url: 'relatorio.pdf' }), ID_KIMBERLY)).rejects.toThrow('https://');
    await expect(salvarReceita(formulario(), '')).rejects.toThrow('quem você é');
  });

  it('a lista soma só reais por mês e respeita o contexto', async () => {
    await salvarReceita(formulario(), ID_KIMBERLY);
    await salvarReceita(formulario({ competencia: '2026-09', moeda: 'USD', receita_bruta: '100,00', taxas: '15,00' }), ID_KIMBERLY);
    const tela = await carregarReceitas('consolidada');
    expect(tela.linhas.map((linha) => linha.competencia)).toEqual(['2026-10-01', '2026-09-01']);
    expect(tela.porMes).toEqual([{ competencia: '2026-10-01', liquida: 850, bruta: 1000, moeda: 'BRL' }]);
    expect((await carregarReceitas('outro-produto')).linhas).toEqual([]);
  });
});
