import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { criarArmazenamentoEmMemoria, usarDriverDeTeste } from '@/dados/armazenamento';
import { garantirCarga } from '@/dados/carga';
import { ID_CAMILA, ID_PRODUTO_KIPI, ID_PRODUTO_ZUPI } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import type { IncidenteDisponibilidade } from '@/dados/tipos/operacao';
import { instanteNoFuso } from '@/lib/datas';
import { contratoComImplantacao } from './apoio-testes-m12';
import { compromissosDoProduto, disponibilidadeDoMes, duracaoDoIncidente, encerrarIncidente, esquemaFormularioIncidente, formularioIncidenteVazio, removerIncidente, salvarIncidente, textoDaDisponibilidade, type FormularioIncidente } from './incidentes';
import { criarCatalogoDeExemplo } from './integracoes/catalogo-de-exemplo';
import { usarCatalogoDeTeste } from './integracoes/conexoes';
import { formularioDeRegras, salvarRegras } from './sla';
import { abrirSolicitacao, formularioSolicitacaoVazio, vincularIncidente } from './suporte';

const FUSO = 'America/Sao_Paulo';
const em = (dia: string, hora: string) => instanteNoFuso(dia, hora, FUSO);
const AGORA = em('2026-11-20', '12:00');
const incidente = (alteracoes: Partial<IncidenteDisponibilidade>) => ({ produto_id: ID_PRODUTO_KIPI, inicio: em('2026-11-10', '10:00'), fim: em('2026-11-10', '11:00'), impacto: 'total' as const, arquivado_em: null, ...alteracoes });
const formulario = (alteracoes: Partial<FormularioIncidente> = {}): FormularioIncidente => ({ ...formularioIncidenteVazio(ID_CAMILA, AGORA), produto_id: ID_PRODUTO_KIPI, titulo: 'Fora do ar', inicio_dia: '2026-11-19', inicio_hora: '22:00', envolve_dados_pessoais: 'nao', ...alteracoes });

describe('T12.05 Incidentes de disponibilidade', () => {
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

  describe('disponibilidade mensal (RN-12.11)', () => {
    it('1 − (totais + 50% das parciais) ÷ minutos do mês; degradado não conta', () => {
      const conta = disponibilidadeDoMes([incidente({}), incidente({ impacto: 'parcial', inicio: em('2026-11-12', '08:00'), fim: em('2026-11-12', '10:00') }), incidente({ impacto: 'degradado', inicio: em('2026-11-13', '08:00'), fim: em('2026-11-13', '20:00') }), incidente({ produto_id: ID_PRODUTO_ZUPI })], ID_PRODUTO_KIPI, '2026-11', AGORA, FUSO);
      expect(conta).toMatchObject({ minutosDoMes: 43200, minutosTotais: 60, minutosParciais: 120, incidentes: 2, emAndamento: false });
      expect(conta.disponibilidade).toBeCloseTo(1 - 120 / 43200, 10);
      expect(textoDaDisponibilidade(conta.disponibilidade)).toBe('99,722%');
    });

    it('só a parte que cai no mês; o que não terminou conta até agora', () => {
      const virada = incidente({ inicio: em('2026-10-31', '23:00'), fim: em('2026-11-01', '01:00') });
      expect(disponibilidadeDoMes([virada], ID_PRODUTO_KIPI, '2026-11', AGORA, FUSO).minutosTotais).toBe(60);
      expect(disponibilidadeDoMes([virada], ID_PRODUTO_KIPI, '2026-10', AGORA, FUSO).minutosTotais).toBe(60);
      const aberto = disponibilidadeDoMes([incidente({ inicio: em('2026-11-20', '11:00'), fim: null })], ID_PRODUTO_KIPI, '2026-11', AGORA, FUSO);
      expect(aberto).toMatchObject({ minutosTotais: 60, emAndamento: true });
      expect(disponibilidadeDoMes([], ID_PRODUTO_KIPI, '2026-11', AGORA, FUSO).disponibilidade).toBe(1);
    });

    it('meta do contrato (exceção) e créditos possíveis abaixo dela, para decidir à mão', async () => {
      const ficha = await contratoComImplantacao('2026-11-06');
      expect(await compromissosDoProduto(ID_PRODUTO_KIPI, 0.99)).toEqual([]);
      const base = formularioDeRegras([]);
      await salvarRegras({ tipo: 'contrato', id: ficha.contrato.id }, { ...base, disponibilidade_minima: '99,5', creditos: '5% da mensalidade', linhas: base.linhas.map((linha) => (linha.prioridade === 'critica' ? { ...linha, resposta_horas: '1', resolucao_horas: '4' } : linha)) });
      expect(await compromissosDoProduto(ID_PRODUTO_KIPI, 0.99)).toMatchObject([{ origem: 'contrato', meta: 99.5, creditos: '5% da mensalidade', abaixo: true }]);
      expect((await compromissosDoProduto(ID_PRODUTO_KIPI, 0.996))[0]?.abaixo).toBe(false);
    });
  });

  describe('registro (RN-12.10)', () => {
    it('grava em andamento, sem inventar o fim, e encerra depois', async () => {
      const salvo = await salvarIncidente(formulario(), undefined, AGORA);
      expect(salvo).toMatchObject({ codigo: 'INC-2026-0001', fim: null, impacto: 'total', comunicado: false, canal: null, envolve_dados_pessoais: false, incidente_seguranca_id: null });
      expect(duracaoDoIncidente(salvo, AGORA)).toBe('14 h, em andamento');
      await expect(encerrarIncidente(salvo.id, em('2026-11-19', '21:00'), AGORA)).rejects.toThrow('depois do início');
      const encerrado = await encerrarIncidente(salvo.id, em('2026-11-19', '23:30'), AGORA);
      expect(duracaoDoIncidente(encerrado, AGORA)).toBe('1 h 30 min');
      await expect(encerrarIncidente(salvo.id, AGORA, AGORA)).rejects.toThrow('já foi encerrado');
    });

    it('comunicado pede quando e por qual canal; a pergunta de dados pessoais é obrigatória', () => {
      const erros = (dados: Partial<FormularioIncidente>) => esquemaFormularioIncidente.safeParse(formulario(dados)).error?.issues.map((issue) => issue.message) ?? [];
      expect(erros({ comunicado: true })).toEqual(['Diga quando os clientes foram comunicados.', 'Diga por qual canal.']);
      expect(erros({ fim_dia: '2026-11-19', fim_hora: '21:00' })).toEqual(['O fim vem depois do início.']);
      expect(erros({ fim_dia: '2026-11-19' })).toEqual(['Informe o dia e a hora do fim, ou deixe os dois vazios enquanto durar.']);
      expect(erros({ envolve_dados_pessoais: '' as never })).toEqual(['Responda se envolve dados pessoais.']);
    });

    it('não registra o futuro; dados pessoais fica gravado, sem vínculo inventado com o M09', async () => {
      await expect(salvarIncidente(formulario({ inicio_dia: '2026-11-21' }), undefined, AGORA)).rejects.toThrow('até agora');
      const salvo = await salvarIncidente(formulario({ envolve_dados_pessoais: 'sim', comunicado: true, comunicado_dia: '2026-11-19', comunicado_hora: '23:00', canal: 'E-mail aos clientes' }), undefined, AGORA);
      expect(salvo).toMatchObject({ envolve_dados_pessoais: true, incidente_seguranca_id: null, comunicado: true, canal: 'E-mail aos clientes', comunicado_em: em('2026-11-19', '23:00') });
    });

    it('com solicitação vinculada, o produto não muda e não se remove', async () => {
      const salvo = await salvarIncidente(formulario(), undefined, AGORA);
      const solicitacao = await abrirSolicitacao({ ...formularioSolicitacaoVazio(ID_CAMILA), solicitante_texto: 'Maria', produto_id: ID_PRODUTO_KIPI, titulo: 'Fora do ar' }, AGORA);
      await vincularIncidente(solicitacao.id, salvo.id);
      await expect(salvarIncidente(formulario({ produto_id: ID_PRODUTO_ZUPI }), salvo.id, AGORA)).rejects.toThrow('o produto não muda');
      await expect(removerIncidente(salvo.id, 'Duplicado')).rejects.toThrow('tire os vínculos');
      await vincularIncidente(solicitacao.id, null);
      await removerIncidente(salvo.id, 'Duplicado');
      expect(await repositorios.incidente_disponibilidade.listar()).toHaveLength(0);
    });
  });
});
