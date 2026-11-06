import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarArmazenamentoEmMemoria, usarDriverDeTeste } from '@/dados/armazenamento';
import { ID_CAMILA, ID_KIMBERLY } from '@/dados/exemplos/base';
import { esquecerMetaEmMemoria } from '@/dados/meta';
import { repositorios } from '@/dados/repositorios';
import type { Atividade } from '@/dados/tipos/atividade';
import { chaveDoAlerta, gerarAlertas, sincronizarAlertas, type AlertaDesejado } from './alertas';
import { dispensarAlerta } from './atividades';
import { exportarTudo } from './dados';
import { executarRotinas, mensagemDasRotinas } from './rotinas';

const alertasReais = async (): Promise<Atividade[]> => (await repositorios.atividade.listar({ onde: { tipo: 'alerta' } })).filter((atividade) => !atividade.exemplo);

function desejado(alteracoes: Partial<AlertaDesejado> = {}): AlertaDesejado {
  return { origem_tipo: 'titulo', origem_id: 'titulo-1', motivo: 'Vencimento próximo', data_referencia: '2026-11-10', titulo: 'Pagar a hospedagem', responsavel_id: ID_KIMBERLY, area_id: null, acao: 'exportar_dados', ...alteracoes };
}

describe('alertas (05-M03 §5)', () => {
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

  describe('sincronizar uma origem', () => {
    it('cria uma vez só, com a chave da especificação', async () => {
      expect(await sincronizarAlertas('titulo', [desejado()], 'Resolvido.')).toBe(1);
      expect(await sincronizarAlertas('titulo', [desejado()], 'Resolvido.')).toBe(0);
      const [alerta] = await alertasReais();
      expect(alerta).toMatchObject({ tipo: 'alerta', titulo: 'Pagar a hospedagem', prazo: '2026-11-10', origem_tipo: 'titulo', origem_id: 'titulo-1', alerta_motivo: 'Vencimento próximo', alerta_data_referencia: '2026-11-10', alerta_acao: 'exportar_dados', chave_idempotencia: 'titulo:titulo-1:Vencimento próximo:2026-11-10' });
      expect(await alertasReais()).toHaveLength(1);
    });

    it('dispensado não volta com o mesmo motivo e a mesma data (RN-03.13)', async () => {
      await sincronizarAlertas('titulo', [desejado()], 'Resolvido.');
      const [alerta] = await alertasReais();
      await dispensarAlerta(alerta!.id, 'Vai ser cancelada');
      expect(await sincronizarAlertas('titulo', [desejado()], 'Resolvido.')).toBe(0);
      expect((await repositorios.atividade.obter(alerta!.id))?.situacao).toBe('cancelada');
    });

    it('data de referência que mudou atualiza o alerta aberto, sem outro (RN-03.14, CA-03.13)', async () => {
      await sincronizarAlertas('titulo', [desejado()], 'Resolvido.');
      expect(await sincronizarAlertas('titulo', [desejado({ data_referencia: '2026-12-10' })], 'Resolvido.')).toBe(0);
      const alertas = await alertasReais();
      expect(alertas).toHaveLength(1);
      expect(alertas[0]).toMatchObject({ prazo: '2026-12-10', alerta_data_referencia: '2026-12-10', chave_idempotencia: chaveDoAlerta(desejado({ data_referencia: '2026-12-10' })) });
    });

    it('a origem deixou de exigir ação: conclui com a nota, sem autor (RN-03.12 e RN-03.14)', async () => {
      await sincronizarAlertas('titulo', [desejado()], 'Resolvido.');
      await sincronizarAlertas('titulo', [], 'Concluído por Registrar pagamento em Financeiro.');
      const [alerta] = (await repositorios.atividade.listar({ onde: { origem_tipo: 'titulo' } }));
      expect(alerta).toMatchObject({ situacao: 'concluida', concluida_por: null, conclusao_nota: 'Concluído por Registrar pagamento em Financeiro.' });
    });

    it('uma origem não mexe nos alertas de outra', async () => {
      await sincronizarAlertas('titulo', [desejado()], 'Resolvido.');
      await sincronizarAlertas('ferramenta', [], 'Resolvido.');
      expect((await alertasReais())[0]?.situacao).toBe('a_fazer');
    });
  });

  describe('backup atrasado', () => {
    const diasDepois = (dias: number) => new Date(Date.now() + dias * 86_400_000);

    it('Central recém-aberta não tem atraso; passados 8 dias da primeira carga, tem', async () => {
      expect(await gerarAlertas()).toBe(0);
      expect(await alertasReais()).toEqual([]);
      expect(await gerarAlertas(diasDepois(8))).toBe(0);
      expect(await gerarAlertas(diasDepois(9))).toBe(1);
      expect(await gerarAlertas(diasDepois(9))).toBe(0);
      const [alerta] = await alertasReais();
      expect(alerta).toMatchObject({ titulo: 'Exportar os dados da Central', responsavel_id: ID_CAMILA, alerta_motivo: 'Backup atrasado', alerta_data_referencia: '2026-11-14', alerta_acao: 'exportar_dados', prioridade: 'alta' });
    });

    it('a responsável vem de T02.01', async () => {
      await repositorios.configuracao.salvar({ responsavel_backup_id: ID_KIMBERLY });
      await gerarAlertas(diasDepois(9));
      expect((await alertasReais())[0]?.responsavel_id).toBe(ID_KIMBERLY);
    });

    it('exportar conclui o alerta na hora, e o próximo atraso é outro alerta', async () => {
      await gerarAlertas(diasDepois(9));
      vi.setSystemTime(diasDepois(10));
      await exportarTudo();
      const [alerta] = (await repositorios.atividade.listar({ onde: { origem_tipo: 'backup' } })).filter((atividade) => !atividade.exemplo);
      expect(alerta).toMatchObject({ situacao: 'concluida', concluida_por: null, conclusao_nota: 'Concluído por Exportar dados em Configurações.' });
      expect(await gerarAlertas()).toBe(0);
      expect(await gerarAlertas(diasDepois(9))).toBe(1);
      const abertos = (await alertasReais()).filter((atividade) => atividade.situacao === 'a_fazer');
      expect(abertos).toHaveLength(1);
      expect(abertos[0]?.id).not.toBe(alerta?.id);
    });

    it('o alerta de exemplo não entra na conta', async () => {
      await exportarTudo();
      const exemplo = (await repositorios.atividade.listar({ onde: { tipo: 'alerta' } })).find((atividade) => atividade.exemplo);
      expect(exemplo?.situacao).toBe('a_fazer');
    });

    it('nas rotinas do dia, entra no aviso', async () => {
      vi.setSystemTime(diasDepois(0));
      await executarRotinas();
      vi.setSystemTime(diasDepois(9));
      const resultado = await executarRotinas();
      expect(resultado.novidades[0]).toBe('1 alerta novo');
      expect(mensagemDasRotinas(resultado)).toContain('Rotinas do dia executadas: 1 alerta novo e');
    });
  });
});
