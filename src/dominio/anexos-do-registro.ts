/** Links do Drive de um registro do M06, na mesma tabela das outras fichas (`anexo_link`). Nada de upload nesta etapa. */
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import type { AnexoLink } from '@/dados/tipos/apoio';
import { linkDoDriveValido, MENSAGEM_LINK_DRIVE } from './link-drive';

export async function linksDoRegistro(tipo: string, id: string): Promise<AnexoLink[]> {
  return repositorios.anexo_link.listar({ onde: { registro_tipo: tipo, registro_id: id } });
}

export async function adicionarLinkAoRegistro(tipo: string, id: string, url: string, titulo = ''): Promise<void> {
  const limpo = url.trim();
  if (!limpo) throw new ErroDeRegra('Cole o link do Drive.');
  if (!linkDoDriveValido(limpo)) throw new ErroDeRegra(MENSAGEM_LINK_DRIVE);
  await repositorios.anexo_link.criar({ registro_tipo: tipo, registro_id: id, titulo: titulo.trim() || 'Arquivo do Drive', url: limpo });
}

export async function removerLinkDoRegistro(id: string): Promise<void> {
  await repositorios.anexo_link.arquivar(id);
}
