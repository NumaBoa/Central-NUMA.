import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { criarArmazenamentoEmMemoria, usarDriverDeTeste } from '@/dados/armazenamento';
import { garantirCarga } from '@/dados/carga';
import { ID_PRODUTO_KIPI } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import { instanteNoFuso } from '@/lib/datas';
import { contratoComImplantacao } from './apoio-testes-m12';
import { ID_OFERTA_ATELIE, ID_OFERTA_REVENDA, criarCatalogoDeExemplo } from './integracoes/catalogo-de-exemplo';
import { usarCatalogoDeTeste } from './integracoes/conexoes';
import { calcularPrazoSla, divergenciasDaOferta, formularioDeRegras, horasDoTexto, minutosContaveis, regraParaSolicitacao, removerRegras, salvarRegras, situacaoDoPrazo, type FormularioDeRegras } from './sla';

const uteis = { contagem: 'horas_uteis' as const, horario_inicio: '09:00', horario_fim: '18:00' };
const em = (dia: string, hora: string) => instanteNoFuso(dia, hora, 'America/Sao_Paulo');

function formulario(linhas: Partial<Record<'baixa' | 'normal' | 'alta' | 'critica', [string, string]>>, extra: Partial<FormularioDeRegras> = {}): FormularioDeRegras {
  const base = formularioDeRegras([]);
  return { ...base, ...extra, linhas: base.linhas.map((linha) => ({ ...linha, resposta_horas: linhas[linha.prioridade]?.[0] ?? '', resolucao_horas: linhas[linha.prioridade]?.[1] ?? '' })) };
}

describe('T12.04 Regras de SLA', () => {
  beforeEach(() => {
    usarDriverDeTeste(criarArmazenamentoEmMemoria());
    esquecerMetaEmMemoria();
    usarCatalogoDeTeste(criarCatalogoDeExemplo());
    garantirCarga();
  });
  afterEach(() => {
    usarDriverDeTeste(null);
    usarCatalogoDeTeste(null);
  });

  describe('contagem do prazo (RN-12.08)', () => {
    it('CA-12.04: 8 horas úteis abertas na sexta às 17h vencem na segunda às 16h', () => {
      expect(calcularPrazoSla(em('2026-11-13', '17:00'), 8, uteis, [], [], 'America/Sao_Paulo')).toBe(em('2026-11-16', '16:00'));
    });

    it('pula o feriado do calendário', () => {
      expect(calcularPrazoSla(em('2026-11-19', '17:00'), 8, uteis, [{ data: '2026-11-20' }], [], 'America/Sao_Paulo')).toBe(em('2026-11-23', '16:00'));
    });

    it('aberta fora do horário começa a contar no próximo atendimento', () => {
      expect(calcularPrazoSla(em('2026-11-14', '11:00'), 2, uteis, [], [], 'America/Sao_Paulo')).toBe(em('2026-11-16', '11:00'));
      expect(calcularPrazoSla(em('2026-11-16', '07:30'), 0.5, uteis, [], [], 'America/Sao_Paulo')).toBe(em('2026-11-16', '09:30'));
    });

    it('horas corridas contam a noite e o fim de semana', () => {
      expect(calcularPrazoSla(em('2026-11-13', '17:00'), 8, { ...uteis, contagem: 'horas_corridas' }, [], [], 'America/Sao_Paulo')).toBe(em('2026-11-14', '01:00'));
    });

    it('a pausa "Aguardando cliente" empurra o prazo', () => {
      const pausas = [{ inicio: em('2026-11-16', '10:00'), fim: em('2026-11-16', '12:00') }];
      expect(calcularPrazoSla(em('2026-11-16', '09:00'), 8, uteis, [], pausas, 'America/Sao_Paulo')).toBe(em('2026-11-17', '10:00'));
      expect(minutosContaveis(em('2026-11-16', '09:00'), em('2026-11-16', '13:00'), uteis, [], pausas, 'America/Sao_Paulo')).toBe(120);
    });
  });

  describe('situação do prazo', () => {
    const base = { abertaEm: em('2026-11-16', '09:00'), horas: 10, configuracao: uteis, concluidoEm: null, pausas: [], feriados: [], fuso: 'America/Sao_Paulo' };

    it('no prazo, em risco a 80%, violado ao passar', () => {
      expect(situacaoDoPrazo({ ...base, agora: em('2026-11-16', '12:00') })).toMatchObject({ estado: 'no_prazo', texto: 'Faltam 7 h', prazo: em('2026-11-17', '10:00') });
      expect(situacaoDoPrazo({ ...base, agora: em('2026-11-17', '09:00') })).toMatchObject({ estado: 'em_risco', texto: 'Em risco: faltam 1 h' });
      expect(situacaoDoPrazo({ ...base, agora: em('2026-11-17', '11:30') })).toMatchObject({ estado: 'violado', texto: 'Violado há 1 h 30 min' });
    });

    it('concluída: cumprido ou fora do prazo; sem regra: Sem SLA; pausa aberta: pausado', () => {
      expect(situacaoDoPrazo({ ...base, agora: em('2026-11-18', '09:00'), concluidoEm: em('2026-11-17', '10:00') }).estado).toBe('cumprido');
      expect(situacaoDoPrazo({ ...base, agora: em('2026-11-18', '09:00'), concluidoEm: em('2026-11-17', '10:15') }).texto).toBe('Fora do prazo, por 15 min');
      expect(situacaoDoPrazo({ ...base, horas: null, agora: em('2026-11-16', '10:00') }).texto).toBe('Sem SLA');
      expect(situacaoDoPrazo({ ...base, agora: em('2026-11-16', '15:00'), pausas: [{ inicio: em('2026-11-16', '11:00'), fim: null }] })).toMatchObject({ estado: 'pausado', texto: 'Pausado: faltam 8 h' });
    });
  });

  describe('regras', () => {
    it('grava uma linha por prioridade preenchida, com o horário padrão 9h–18h (D25)', async () => {
      const salvas = await salvarRegras({ tipo: 'oferta', id: ID_OFERTA_REVENDA }, formulario({ critica: ['4', '8'], normal: ['8', '24'] }));
      expect(salvas.map((regra) => [regra.prioridade, regra.resposta_horas, regra.resolucao_horas, regra.horario_inicio, regra.horario_fim])).toEqual([['normal', 8, 24, '09:00', '18:00'], ['critica', 4, 8, '09:00', '18:00']]);
      expect(salvas.every((regra) => regra.disponibilidade_minima === null && regra.creditos === null)).toBe(true);
      // Salvar de novo sem a normal tira a normal, sem duplicar a crítica.
      await salvarRegras({ tipo: 'oferta', id: ID_OFERTA_REVENDA }, formulario({ critica: ['2', '8'] }));
      expect((await repositorios.sla_regra.listar()).map((regra) => [regra.prioridade, regra.resposta_horas])).toEqual([['critica', 2]]);
      await removerRegras({ tipo: 'oferta', id: ID_OFERTA_REVENDA });
      expect(await repositorios.sla_regra.listar()).toHaveLength(0);
    });

    it('recusa resolução antes da resposta, metade preenchida, horário invertido e nada preenchido', async () => {
      const alvo = { tipo: 'oferta' as const, id: ID_OFERTA_REVENDA };
      await expect(salvarRegras(alvo, formulario({ alta: ['8', '4'] }))).rejects.toThrow('Alta: a resolução não pode vir antes');
      await expect(salvarRegras(alvo, formulario({ alta: ['8', ''] }))).rejects.toThrow('Alta: informe a primeira resposta e a resolução');
      await expect(salvarRegras(alvo, formulario({ alta: ['1', '2'] }, { horario_inicio: '18:00', horario_fim: '09:00' }))).rejects.toThrow('termina depois de começar');
      await expect(salvarRegras(alvo, formulario({}))).rejects.toThrow('pelo menos uma prioridade');
      await expect(salvarRegras({ tipo: 'oferta', id: 'nao-existe' }, formulario({ alta: ['1', '2'] }))).rejects.toThrow('não existe no catálogo');
    });

    it('a exceção do contrato guarda disponibilidade e créditos; horas corridas não guardam horário', async () => {
      const ficha = await contratoComImplantacao('2026-11-06');
      const [regra] = await salvarRegras({ tipo: 'contrato', id: ficha.contrato.id }, formulario({ critica: ['1', '4'] }, { contagem: 'horas_corridas', disponibilidade_minima: '99,5', creditos: '5% da mensalidade por hora' }));
      expect(regra).toMatchObject({ contrato_id: ficha.contrato.id, oferta_id: null, horario_inicio: null, horario_fim: null, disponibilidade_minima: 99.5, creditos: '5% da mensalidade por hora' });
      await expect(salvarRegras({ tipo: 'contrato', id: ficha.contrato.id }, formulario({ critica: ['1', '4'] }, { disponibilidade_minima: '101' }))).rejects.toThrow('de 0 a 100%');
    });
  });

  describe('o que a oferta promete, sem duplicar', () => {
    it('lê as horas do texto da oferta e avisa quando a regra promete menos', () => {
      expect(horasDoTexto('até 4 horas úteis')).toEqual({ horas: 4, uteis: true });
      expect(horasDoTexto('2 dias úteis')).toBeNull();
      const oferta = { suporte: { canal: null, horario: null, prazo_critico: 'até 4 horas úteis', prazo_normal: 'até 24 horas corridas' } };
      expect(divergenciasDaOferta(oferta, [{ prioridade: 'critica', resposta_horas: 8, contagem: 'horas_uteis' }])).toEqual(['A oferta promete primeira resposta em até 4 horas úteis no caso crítico; a regra dá 8 h.']);
      expect(divergenciasDaOferta(oferta, [{ prioridade: 'normal', resposta_horas: 24, contagem: 'horas_uteis' }])).toEqual(['A oferta fala em horas corridas no caso normal; a regra conta horas úteis.']);
      expect(divergenciasDaOferta(oferta, [{ prioridade: 'critica', resposta_horas: 4, contagem: 'horas_uteis' }])).toEqual([]);
    });
  });

  describe('qual regra vale (RN-12.08 e RN-12.09)', () => {
    it('a exceção do contrato vem antes da oferta do contrato', async () => {
      const ficha = await contratoComImplantacao('2026-11-06');
      await salvarRegras({ tipo: 'oferta', id: ID_OFERTA_REVENDA }, formulario({ critica: ['4', '8'] }));
      expect((await regraParaSolicitacao({ contratoId: ficha.contrato.id, produtoId: ID_PRODUTO_KIPI, prioridade: 'critica' }))?.origem).toBe('oferta');
      await salvarRegras({ tipo: 'contrato', id: ficha.contrato.id }, formulario({ critica: ['1', '2'] }));
      expect(await regraParaSolicitacao({ contratoId: ficha.contrato.id, produtoId: ID_PRODUTO_KIPI, prioridade: 'critica' })).toMatchObject({ origem: 'contrato', regra: { resposta_horas: 1 } });
      expect(await regraParaSolicitacao({ contratoId: ficha.contrato.id, produtoId: ID_PRODUTO_KIPI, prioridade: 'baixa' })).toBeNull();
    });

    it('sem contrato: a única oferta aprovada com SLA; com duas, Sem SLA', async () => {
      await salvarRegras({ tipo: 'oferta', id: ID_OFERTA_REVENDA }, formulario({ normal: ['8', '24'] }));
      expect((await regraParaSolicitacao({ contratoId: null, produtoId: ID_PRODUTO_KIPI, prioridade: 'normal' }))?.oferta?.id).toBe(ID_OFERTA_REVENDA);
      await salvarRegras({ tipo: 'oferta', id: ID_OFERTA_ATELIE }, formulario({ normal: ['4', '12'] }));
      expect(await regraParaSolicitacao({ contratoId: null, produtoId: ID_PRODUTO_KIPI, prioridade: 'normal' })).toBeNull();
    });
  });
});
