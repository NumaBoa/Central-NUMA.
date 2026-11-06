/** Alerta se o último backup tiver mais de 8 dias (T02.11 e M03 §5). */
export const DIAS_ATE_BACKUP_ATRASADO = 8;

const DIA_MS = 24 * 60 * 60 * 1000;

export function backupAtrasado(ultimoBackupEm: string | null, agora: Date = new Date()): boolean {
  if (!ultimoBackupEm) return false;
  return agora.getTime() - new Date(ultimoBackupEm).getTime() > DIAS_ATE_BACKUP_ATRASADO * DIA_MS;
}

/** `central-numa-2026-11-05.json`, para o arquivo ficar fácil de achar em Backups/Central. */
export function nomeDoArquivoDeBackup(dia: string): string {
  return `central-numa-${dia}.json`;
}

/** A cópia baixada antes de uma importação não se confunde com um backup comum. */
export function nomeDaCopiaAntesDeImportar(dia: string): string {
  return `central-numa-antes-de-importar-${dia}.json`;
}
