const LINK_DO_DRIVE = /^https:\/\/(drive|docs)\.google\.com\/\S*$/;

/** Campo link do Drive (02): só `drive.google.com` e `docs.google.com`. A conta não dá para conferir. */
export function linkDoDriveValido(valor: string): boolean {
  return LINK_DO_DRIVE.test(valor.trim());
}

export const MENSAGEM_LINK_DRIVE = 'Use um link de drive.google.com ou docs.google.com.';
export const LEMBRETE_LINK_DRIVE = 'Confirme que o arquivo está no Drive da Numa.';
