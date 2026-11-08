/** Arquivos das fichas do M12: links do Drive em `anexo_link`, como nas ferramentas, até a Biblioteca (M08) existir. */
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import type { AnexoLink } from '@/dados/tipos/apoio';
import { linkDoDriveValido, MENSAGEM_LINK_DRIVE } from './link-drive';

export type RegistroComArquivos = 'implantacao' | 'solicitacao_suporte' | 'incidente_disponibilidade';

export async function linksDoRegistro(tipo: RegistroComArquivos, id: string): Promise<AnexoLink[]> {
  return repositorios.anexo_link.listar({ onde: { registro_tipo: tipo, registro_id: id } });
}

export async function adicionarLinkAoRegistro(tipo: RegistroComArquivos, id: string, url: string): Promise<void> {
  const limpo = url.trim();
  if (!linkDoDriveValido(limpo)) throw new ErroDeRegra(MENSAGEM_LINK_DRIVE);
  await repositorios.anexo_link.criar({ registro_tipo: tipo, registro_id: id, titulo: 'Arquivo do Drive', url: limpo });
}

export async function removerLinkDoRegistro(anexoId: string): Promise<void> {
  await repositorios.anexo_link.arquivar(anexoId);
}
