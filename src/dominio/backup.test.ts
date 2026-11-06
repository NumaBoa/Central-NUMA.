import { describe, expect, it } from 'vitest';
import { backupAtrasado, nomeDaCopiaAntesDeImportar, nomeDoArquivoDeBackup } from './backup';

describe('backupAtrasado', () => {
  const agora = new Date('2026-11-20T12:00:00.000Z');

  it('avisa só depois de mais de 8 dias', () => {
    expect(backupAtrasado('2026-11-12T12:00:00.000Z', agora)).toBe(false);
    expect(backupAtrasado('2026-11-12T11:59:59.000Z', agora)).toBe(true);
  });

  it('sem nenhum backup, não há atraso a contar', () => {
    expect(backupAtrasado(null, agora)).toBe(false);
  });
});

describe('nomeDoArquivoDeBackup', () => {
  it('leva a data no nome', () => {
    expect(nomeDoArquivoDeBackup('2026-11-05')).toBe('central-numa-2026-11-05.json');
    expect(nomeDaCopiaAntesDeImportar('2026-11-05')).toBe('central-numa-antes-de-importar-2026-11-05.json');
  });
});
