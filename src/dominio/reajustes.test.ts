import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarArmazenamentoEmMemoria, usarDriverDeTeste } from '@/dados/armazenamento';
import { garantirCarga } from '@/dados/carga';
import { CATEGORIAS_INICIAIS, ID_CONTA_KIMBERLY, ID_KIMBERLY, ID_PRODUTO_KIPI } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import type { Titulo } from '@/dados/tipos/titulo';
import { aplicarReajuste, dispensarReajuste, fatorDosReajustes, lerPercentual, previaDoReajuste, proximaDataBase, registrarComunicacao } from './reajustes';
import { gravarRateio, registrarPagamento } from './titulos';

const CONTRATO = 'contrato-1';
const titulo = (id: string, parcial: Partial<Titulo> = {}) => ({ id, descricao: id, valor: 1000, situacao: 'aberto', arquivado_em: null, vencimento: '2027-01-10', ...parcial }) as Titulo;

describe('T11.10: reajuste (RN-11.20, CA-11.09)', () => {
  it('data-base: o próximo aniversário não tratado, nos próximos 60 dias; o vencido e não tratado continua', () => {
    expect(proximaDataBase('2025-12-01', 12, [], '2026-11-08')).toBe('2026-12-01');
    expect(proximaDataBase('2025-12-01', 12, ['2026-12-01'], '2026-11-08')).toBeNull();
    expect(proximaDataBase('2026-03-15', 12, [], '2026-11-08')).toBeNull();
    expect(proximaDataBase('2025-10-01', 12, [], '2026-11-08')).toBe('2026-10-01');
    expect(proximaDataBase('2026-05-01', 6, [], '2026-11-08')).toBe('2026-11-01');
    expect(proximaDataBase('2025-12-01', null, [], '2026-11-08')).toBe('2026-12-01');
    expect(proximaDataBase('2025-12-01', 12, [], '2026-11-08', '2026-11-30')).toBeNull();
    expect(proximaDataBase(null, 12, [], '2026-11-08')).toBeNull();
  });

  it('CA-11.09: a prévia leva os recorrentes e só os títulos futuros não pagos', () => {
    const itens = [
      { id: 'i1', descricao: 'Assinatura', recorrente: true, valor_unitario: 1000, valor_total: 1000 },
      { id: 'i2', descricao: 'Implantação', recorrente: false, valor_unitario: 2000, valor_total: 2000 },
    ];
    const titulos = [titulo('pago'), titulo('antes', { vencimento: '2026-11-10' }), titulo('cancelado', { situacao: 'cancelado' }), titulo('futuro'), titulo('previsto', { situacao: 'previsto', vencimento: '2027-02-10' })];
    const previa = previaDoReajuste(itens, titulos, [{ titulo_id: 'pago', arquivado_em: null }], '2026-12-01', 4.68);
    expect(previa.itens).toEqual([{ id: 'i1', descricao: 'Assinatura', de: 1000, para: 1046.8, vencimento: null }]);
    expect(previa.titulos.map((linha) => [linha.id, linha.para])).toEqual([['futuro', 1046.8], ['previsto', 1046.8]]);
  });

  it('o percentual vem à mão e o fator acumula só os aplicados', () => {
    expect(lerPercentual('4,68%')).toBe(4.68);
    expect(lerPercentual('')).toBeNull();
    expect(() => lerPercentual('muito')).toThrow('Percentual');
    const aplicados = [{ situacao: 'aplicado' as const, data_base: '2026-12-01', percentual: 10 }, { situacao: 'dispensado' as const, data_base: '2027-12-01', percentual: null }, { situacao: 'aplicado' as const, data_base: '2027-12-01', percentual: 10 }];
    expect(fatorDosReajustes(aplicados, '2026-11-01')).toBe(1);
    expect(fatorDosReajustes(aplicados, '2027-01-01')).toBeCloseTo(1.1);
    expect(fatorDosReajustes(aplicados, '2028-01-01')).toBeCloseTo(1.21);
  });

  describe('com os dados', () => {
    beforeEach(() => {
      usarDriverDeTeste(criarArmazenamentoEmMemoria());
      esquecerMetaEmMemoria();
      vi.useFakeTimers({ now: new Date('2026-11-08T15:00:00.000Z'), toFake: ['Date'] });
      garantirCarga();
    });
    afterEach(() => {
      vi.useRealTimers();
      usarDriverDeTeste(null);
    });

    const criarTitulo = async (vencimento: string) => {
      const novo = await repositorios.titulo.criar({ natureza: 'receber', descricao: `Mensalidade ${vencimento}`, contraparte_id: null, beneficiario_pessoa_id: null, categoria_id: CATEGORIAS_INICIAIS.find((item) => item.nome === 'Assinaturas')!.id, competencia: `${vencimento.slice(0, 7)}-01`, vencimento, valor: 1000, moeda: 'BRL', situacao: 'aberto', responsavel_id: ID_KIMBERLY, entidade_id: null, origem: 'contrato', origem_id: CONTRATO, chave_idempotencia: `t:${vencimento}`, ajustado_manualmente: false, ferramenta_id: null, assinatura_id: null, periodo_inicio: null, periodo_fim: null, suspenso: false, cancelado_motivo: null, observacao: null });
      await gravarRateio(novo.id, 1000, [{ contexto: ID_PRODUTO_KIPI, percentual: 100 }]);
      return novo;
    };

    it('CA-11.09: aplicar muda só os futuros não pagos; o quitado fica com o valor original', async () => {
      const [dezembro, janeiro] = [await criarTitulo('2026-12-10'), await criarTitulo('2027-01-10')];
      const registro = await repositorios.reajuste_aplicado.criar({ contrato_id: CONTRATO, versao_id: 'v1', data_base: '2026-12-01', indice_nome: 'IPCA', percentual: 4.68, indice_fonte: 'IBGE', indice_data: '2026-11-05', previa: { itens: [], titulos: [dezembro, janeiro].map((t) => ({ id: t.id, descricao: t.descricao, de: 1000, para: 1046.8, vencimento: t.vencimento })) }, situacao: 'calculado', aplicado_por: null, aplicado_em: null, dispensado_motivo: null, comunicado_em: null, comunicado_canal: null, comunicado_evidencia_url: null, exemplo: false });
      await registrarPagamento(dezembro.id, { data: '2026-11-08', contaId: ID_CONTA_KIMBERLY, valorMoeda: 1000, cambio: null, iofBrl: null, valorBrl: 1000, comprovanteUrl: 'https://drive.google.com/file/d/x/view', semComprovanteMotivo: null, tratamento: 'aporte', vencimentoReembolso: null, pagoAMais: false, motivo: null }, '2026-11-08');
      expect(await aplicarReajuste(registro.id, ID_KIMBERLY)).toBe(1);
      expect((await repositorios.titulo.obter(dezembro.id))?.valor).toBe(1000);
      expect((await repositorios.titulo.obter(janeiro.id))?.valor).toBe(1046.8);
      expect((await repositorios.titulo_rateio.listar({ onde: { titulo_id: janeiro.id } }))[0]?.valor).toBe(1046.8);
      expect((await repositorios.reajuste_aplicado.obter(registro.id))?.situacao).toBe('aplicado');
      await expect(aplicarReajuste(registro.id, ID_KIMBERLY)).rejects.toThrow('já foi tratado');
      await expect(registrarComunicacao(registro.id, { data: '2026-11-09', canal: '', evidencia: '' })).rejects.toThrow('canal');
      expect((await registrarComunicacao(registro.id, { data: '2026-11-09', canal: 'E-mail', evidencia: 'https://drive.google.com/file/d/c/view' })).comunicado_canal).toBe('E-mail');
    });

    it('dispensar exige motivo', async () => {
      const linha = { contrato: { id: CONTRATO, vigente: { id: 'v1' } } as never, dataBase: '2026-12-01', indice: 'IPCA', registro: null };
      await expect(dispensarReajuste(linha, '  ', ID_KIMBERLY)).rejects.toThrow('motivo');
      expect(await dispensarReajuste(linha, 'Cliente estratégico, combinado em reunião', ID_KIMBERLY)).toMatchObject({ situacao: 'dispensado', data_base: '2026-12-01' });
    });
  });
});
