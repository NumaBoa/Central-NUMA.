/**
 * Emissão de documentos (T10.06 e T11.05): o texto sai do modelo com os dados daquele momento e fica
 * guardado como foi emitido (RT-10). Mudar depois o modelo, a cláusula, o cadastro ou o catálogo não muda
 * nada aqui (CA-11.04). O PDF é a impressão do próprio navegador, sem serviço externo (02 §1).
 */
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import { idDaPessoaAtual } from '@/dados/sessao';
import type { DocumentoEmitido } from '@/dados/tipos/contrato';
import type { Contraparte, Entidade } from '@/dados/tipos/contraparte';
import type { EntidadeLicenciante } from '@/dados/tipos/contrato';
import type { ModeloVersao } from '@/dados/tipos/legal';
import type { Pessoa } from '@/dados/tipos/pessoa';
import { formatarDiaISO, formatarDinheiro } from '@/lib/formatacao';
import { nomeDaContraparte, formatarDocumento } from './contrapartes';
import { enderecoEmLinha } from './endereco';
import { linkDoDriveValido, MENSAGEM_LINK_DRIVE } from './link-drive';
import type { NoDocumento } from './modelo-texto';
import { NOMES_DOS_MESES } from './repeticao';

export const AVISO_MODELO_NAO_VALIDADO = 'Emitido com modelo não validado pelo jurídico (RN-09.13).';

export type EmissaoNoSnapshot = { nos: NoDocumento[]; dados: unknown; modelo: { id: string | null; codigo: string | null; versao: string | null; situacao: string | null }; aviso: string | null; rascunho: boolean; titulo: string };

export function dataPorExtenso(dia: string): string {
  const [ano, mes, data] = dia.split('-');
  return `${Number(data)} de ${NOMES_DOS_MESES[Number(mes) - 1]} de ${ano}`;
}

export async function emitirDocumento({ registroTipo, registroId, modeloVersao, modeloCodigo, final, nos, dados, confirmarModeloNaoValidado = false, motivo = '', titulo }: { registroTipo: DocumentoEmitido['registro_tipo']; registroId: string; modeloVersao: ModeloVersao | null; modeloCodigo: string | null; final: boolean; nos: NoDocumento[]; dados: unknown; confirmarModeloNaoValidado?: boolean; motivo?: string; titulo: string }): Promise<DocumentoEmitido> {
  const naoValidado = !modeloVersao || modeloVersao.situacao !== 'validada';
  if (final && naoValidado && (!confirmarModeloNaoValidado || !motivo.trim())) throw new ErroDeRegra('O modelo não está validado. Para emitir o final mesmo assim, confirme “Emitir com modelo não validado” e diga o motivo (RN-09.13).');
  const anteriores = await repositorios.documento_emitido.listar({ onde: { registro_id: registroId } });
  const aviso = final && naoValidado ? AVISO_MODELO_NAO_VALIDADO : null;
  const snapshot: EmissaoNoSnapshot = { nos, dados, modelo: { id: modeloVersao?.id ?? null, codigo: modeloCodigo, versao: modeloVersao?.rotulo_versao ?? null, situacao: modeloVersao?.situacao ?? null }, aviso, rascunho: !final, titulo };
  return repositorios.documento_emitido.criar({
    registro_tipo: registroTipo,
    registro_id: registroId,
    modelo_versao_id: modeloVersao?.id ?? null,
    numero_emissao: anteriores.length + 1,
    final,
    modelo_nao_validado_confirmado: final && naoValidado,
    motivo: final && naoValidado ? motivo.trim() : null,
    dados_snapshot: snapshot as unknown as Record<string, unknown>,
    arquivo_url: null,
    emitido_por: idDaPessoaAtual(),
    emitido_em: new Date().toISOString(),
    enviado: false,
  });
}

export function emissaoDoSnapshot(documento: DocumentoEmitido): EmissaoNoSnapshot {
  return documento.dados_snapshot as unknown as EmissaoNoSnapshot;
}

/** O PDF salvo no Drive, depois de imprimir (RT-15). */
export async function registrarArquivoDoDocumento(id: string, url: string): Promise<void> {
  if (!linkDoDriveValido(url.trim())) throw new ErroDeRegra(MENSAGEM_LINK_DRIVE);
  await repositorios.documento_emitido.atualizar(id, { arquivo_url: url.trim() });
}

export async function documentosDoRegistro(registroId: string): Promise<DocumentoEmitido[]> {
  return (await repositorios.documento_emitido.listar({ onde: { registro_id: registroId } })).sort((a, b) => b.numero_emissao - a.numero_emissao);
}

// ---------- As partes, como saem nos modelos (19 §6) ----------

const cpfFormatado = (cpf: string | null) => (cpf ? cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') : null);

export function dadosDaEntidadeNoModelo(entidade: Entidade | null, licenciantes: readonly EntidadeLicenciante[], marcaComercial: string | null, representantes: readonly Pick<Pessoa, 'nome_completo' | 'funcao' | 'cpf'>[]) {
  if (!entidade) return {};
  if (entidade.tipo_pessoa === 'socias_pf') {
    return {
      tipo: 'Sócias pessoas físicas',
      nome: entidade.nome,
      marca_comercial: marcaComercial,
      licenciantes: licenciantes.map((socia) => ({ nome_civil: socia.nome_civil, nacionalidade: socia.nacionalidade, cpf: cpfFormatado(socia.cpf), endereco: socia.endereco, email: socia.email, responsabilidade_pct: socia.responsabilidade_pct })),
    };
  }
  const representante = representantes[0];
  return {
    tipo: entidade.tipo_pessoa === 'pj' ? 'Pessoa jurídica' : 'Pessoa física',
    nome: entidade.nome_fantasia ?? entidade.nome,
    marca_comercial: entidade.nome_fantasia ?? entidade.nome,
    razao_social: entidade.nome,
    cnpj: entidade.documento ? formatarDocumento('pj', entidade.documento) : null,
    endereco: enderecoEmLinha(entidade.endereco),
    representante: representante ? { nome: representante.nome_completo, cargo: representante.funcao, cpf: cpfFormatado(representante.cpf) } : {},
  };
}

export function dadosDaContraparteNoModelo(contraparte: Contraparte | null, representante: Pick<Pessoa, 'nome_completo' | 'cpf'> | null) {
  if (!contraparte) return {};
  const pj = contraparte.tipo_pessoa === 'pj';
  const documento = contraparte.documento ? formatarDocumento(contraparte.tipo_pessoa, contraparte.documento) : null;
  return {
    tipo: pj ? 'PJ' : 'PF',
    nome: contraparte.nome,
    razao_social: pj ? contraparte.nome : null,
    nome_ou_razao: nomeDaContraparte(contraparte),
    cpf: pj ? null : documento,
    cnpj: pj ? documento : null,
    documento,
    endereco: enderecoEmLinha(contraparte.endereco),
    email: contraparte.email,
    representante: representante ? { nome: representante.nome_completo, cpf: cpfFormatado(representante.cpf) } : {},
  };
}

/** O que falta na contraparte para a emissão final (T11.04 e RN-11.35 b). */
export function pendenciasDaContraparte(contraparte: Contraparte | null): string[] {
  if (!contraparte) return ['Escolha a contraparte.'];
  const faltando = [!contraparte.documento && 'documento', !contraparte.endereco?.logradouro && 'endereço', !contraparte.email && 'e-mail'].filter(Boolean);
  return faltando.length ? [`Contraparte ${nomeDaContraparte(contraparte)} sem ${faltando.join(', ')}.`] : [];
}

export const valorEmTexto = (valor: number | null, moeda = 'BRL') => (valor === null ? null : formatarDinheiro(valor, moeda));
export const diaEmTexto = (dia: string | null) => (dia ? formatarDiaISO(dia) : null);
