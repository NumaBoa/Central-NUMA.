/**
 * T07.10 (19 §4): configuração contratual do produto, versionada (RN-11.30).
 * Rascunho → Em validação → Validada → Substituída. Só uma Validada vigora por produto; mudar uma Validada
 * cria nova versão em rascunho; o contrato emitido guarda a versão usada. Texto vazio é pendência, nunca padrão.
 */
import { repositorios } from '@/dados/repositorios';
import { emTransacao } from '@/dados/transacao';
import { ErroDeRegra } from '@/dados/erros';
import type { ConfiguracaoContratualRegistro, FORMATOS_DE_EXPORTACAO, MODALIDADES_DE_ACESSO } from '@/dados/tipos/precificacao';
import { camposVaziosDaConfiguracao, type ConfiguracaoContratual } from './integracoes/catalogo-comercial';
import { sugestaoDoAnexoII } from './legal';

type Modalidade = (typeof MODALIDADES_DE_ACESSO)[number];
type Formato = (typeof FORMATOS_DE_EXPORTACAO)[number];

/** Campos de texto da tela, na ordem do formulário. */
export const CAMPOS_DE_TEXTO = [
  'nome_maiusculo',
  'descricao_contratual',
  'funcoes_de_apoio',
  'diferencas_modalidades',
  'plano_apos_teste',
  'url_termos',
  'url_privacidade',
  'url_ajuda',
  'email_contato',
  'categorias_dados_operador',
  'categorias_titulares',
  'categorias_dados_controlador',
  'provedor_infraestrutura',
  'local_armazenamento',
  'transferencia_internacional_texto',
  'medidas_seguranca',
  'backup_frequencia',
  'procedimento_recuperacao',
  'canal_privacidade',
  'canal_incidentes',
] as const;

/** Prazos e avisos, em número inteiro. */
export const CAMPOS_DE_NUMERO = [
  'prazo_reembolso_dias',
  'aviso_alteracao_dias',
  'aviso_renovacao_anual_dias',
  'aviso_manutencao_horas',
  'aviso_suboperador_dias',
  'prazo_encaminhar_titular_dias',
  'prazo_aviso_incidente_horas',
  'prazo_reativacao_horas',
  'aviso_resilicao_dias',
  'prazo_cura_dias',
  'aviso_cessao_dias',
  'prazo_exportacao_dias',
  'prazo_exclusao_dias',
  'prazo_expurgo_backup_dias',
  'backup_retencao_dias',
] as const;

type CampoDeTexto = (typeof CAMPOS_DE_TEXTO)[number];
type CampoDeNumero = (typeof CAMPOS_DE_NUMERO)[number];

export type FormularioConfiguracao = Record<CampoDeTexto | CampoDeNumero, string> & {
  modalidades: Modalidade[];
  formatos_exportacao: Formato[];
  suboperadores: { nome: string; finalidade: string; pais: string }[];
};

export const FORMULARIO_CONFIGURACAO_VAZIO: FormularioConfiguracao = {
  ...(Object.fromEntries([...CAMPOS_DE_TEXTO, ...CAMPOS_DE_NUMERO].map((campo) => [campo, ''])) as Record<CampoDeTexto | CampoDeNumero, string>),
  modalidades: [],
  formatos_exportacao: [],
  suboperadores: [],
};

/** Mínimos de 19 §4: alteração e encerramento com 30 dias ou mais; incidente em até 72 horas. */
const LIMITES: Partial<Record<CampoDeNumero, { min?: number; max?: number; mensagem: string }>> = {
  aviso_alteracao_dias: { min: 30, mensagem: 'O aviso de alteração é de pelo menos 30 dias (cl. 7.2).' },
  aviso_resilicao_dias: { min: 30, mensagem: 'O aviso de encerramento é de pelo menos 30 dias (cl. 18.5).' },
  prazo_aviso_incidente_horas: { max: 72, mensagem: 'O aviso de incidente é de no máximo 72 horas (cl. 16.3).' },
};

/** Erros de formato, por campo. Vazio não é erro aqui: é pendência para enviar à validação. */
export function errosDoFormulario(formulario: FormularioConfiguracao): Partial<Record<keyof FormularioConfiguracao, string>> {
  const erros: Partial<Record<keyof FormularioConfiguracao, string>> = {};
  for (const campo of CAMPOS_DE_NUMERO) {
    const texto = formulario[campo].trim();
    if (!texto) continue;
    if (!/^\d{1,4}$/.test(texto)) {
      erros[campo] = 'Informe um número inteiro.';
      continue;
    }
    const limite = LIMITES[campo];
    const valor = Number(texto);
    if (limite && ((limite.min !== undefined && valor < limite.min) || (limite.max !== undefined && valor > limite.max))) erros[campo] = limite.mensagem;
  }
  for (const campo of ['url_termos', 'url_privacidade', 'url_ajuda'] as const) if (formulario[campo].trim() && !/^https?:\/\/\S+$/i.test(formulario[campo].trim())) erros[campo] = 'Informe o endereço completo, começando por https://.';
  if (formulario.email_contato.trim() && !/^\S+@\S+\.\S+$/.test(formulario.email_contato.trim())) erros.email_contato = 'Informe um e-mail válido.';
  if (formulario.suboperadores.some((item) => !item.nome.trim())) erros.suboperadores = 'Todo suboperador precisa do nome.';
  return erros;
}

export function formularioDaConfiguracao(registro: ConfiguracaoContratualRegistro): FormularioConfiguracao {
  return {
    ...(Object.fromEntries(CAMPOS_DE_TEXTO.map((campo) => [campo, registro[campo] ?? ''])) as Record<CampoDeTexto, string>),
    ...(Object.fromEntries(CAMPOS_DE_NUMERO.map((campo) => [campo, registro[campo] === null ? '' : String(registro[campo])])) as Record<CampoDeNumero, string>),
    modalidades: [...registro.modalidades],
    formatos_exportacao: [...registro.formatos_exportacao],
    suboperadores: registro.suboperadores.map((item) => ({ ...item })),
  };
}

function valoresDoFormulario(formulario: FormularioConfiguracao) {
  return {
    ...(Object.fromEntries(CAMPOS_DE_TEXTO.map((campo) => [campo, formulario[campo].trim() || null])) as Record<CampoDeTexto, string | null>),
    ...(Object.fromEntries(CAMPOS_DE_NUMERO.map((campo) => [campo, formulario[campo].trim() ? Number(formulario[campo]) : null])) as Record<CampoDeNumero, number | null>),
    modalidades: formulario.modalidades,
    formatos_exportacao: formulario.formatos_exportacao,
    suboperadores: formulario.suboperadores.filter((item) => item.nome.trim()).map((item) => ({ nome: item.nome.trim(), finalidade: item.finalidade.trim(), pais: item.pais.trim() })),
  };
}

/** O que o catálogo entrega a M11: os campos de 19 §4, sem os de controle. */
export function configuracaoDoCatalogo(registro: ConfiguracaoContratualRegistro): ConfiguracaoContratual {
  const { criado_em: _c, criado_por: _cp, atualizado_em: _a, atualizado_por: _ap, arquivado_em: _ar, arquivado_por: _arp, versao_registro: _v, exemplo: _e, enviado_por: _ep, enviado_em: _ee, validado_por: _vp, validado_em: _ve, devolucao_motivo: _d, ...campos } = registro;
  return campos;
}

/** Todas as versões do produto, da mais recente para a mais antiga. */
export async function versoesDaConfiguracao(produtoId: string): Promise<ConfiguracaoContratualRegistro[]> {
  return (await repositorios.configuracao_contratual.listar({ onde: { produto_id: produtoId } })).sort((a, b) => b.versao - a.versao);
}

export async function configuracaoValidadaDoProduto(produtoId: string): Promise<ConfiguracaoContratualRegistro | null> {
  return (await versoesDaConfiguracao(produtoId)).find((versao) => versao.situacao === 'validada') ?? null;
}

/**
 * O que falta para enviar à validação: os campos de RN-11.35 g, mais os condicionais de 19 §4
 * (plano após o teste, se alguma oferta tem teste; aviso de renovação, se há plano anual).
 */
export async function pendenciasDaConfiguracao(produtoId: string, formulario: FormularioConfiguracao): Promise<string[]> {
  const valores = valoresDoFormulario(formulario);
  const pendencias = camposVaziosDaConfiguracao({ id: '', produto_id: produtoId, versao: 1, situacao: 'rascunho', ...valores });
  const ofertas = (await repositorios.oferta.listar({ onde: { produto_id: produtoId } })).filter((oferta) => oferta.situacao !== 'inativa');
  if (ofertas.some((oferta) => oferta.teste_dias) && !valores.plano_apos_teste) pendencias.push('Plano após o fim do teste');
  if (ofertas.some((oferta) => oferta.periodicidade === 'anual') && valores.aviso_renovacao_anual_dias === null) pendencias.push('Aviso de renovação anual');
  return pendencias;
}

/** Primeira versão: o nome em maiúsculas vem do produto (19 §4), o canal de privacidade de T02.01. O resto começa vazio. */
export async function formularioInicial(produtoId: string): Promise<FormularioConfiguracao> {
  const [produto, configuracoes] = await Promise.all([repositorios.produto.obter(produtoId), repositorios.configuracao.ler()]);
  return { ...FORMULARIO_CONFIGURACAO_VAZIO, nome_maiusculo: produto ? produto.nome.toLocaleUpperCase('pt-BR') : '', canal_privacidade: configuracoes.canal_titular_email ?? '' };
}

/** Decisão vigente 8: o inventário (T09.03) só sugere; a pessoa confere e grava. Campos já preenchidos não mudam. */
export async function aplicarSugestaoDoInventario(produtoId: string, formulario: FormularioConfiguracao): Promise<{ formulario: FormularioConfiguracao; aplicados: number }> {
  const sugestao = await sugestaoDoAnexoII(produtoId);
  let aplicados = 0;
  const novo = { ...formulario };
  if (!novo.categorias_dados_operador.trim() && sugestao.categorias_dados.length) {
    novo.categorias_dados_operador = sugestao.categorias_dados.join('; ');
    aplicados += 1;
  }
  if (!novo.categorias_titulares.trim() && sugestao.titulares.length) {
    novo.categorias_titulares = sugestao.titulares.join('; ');
    aplicados += 1;
  }
  if (!novo.suboperadores.length && sugestao.suboperadores.length) {
    novo.suboperadores = sugestao.suboperadores.map((item) => ({ nome: item.nome, finalidade: item.finalidade ?? '', pais: '' }));
    aplicados += 1;
  }
  return { formulario: novo, aplicados };
}

function conferirFormato(formulario: FormularioConfiguracao) {
  const erros = errosDoFormulario(formulario);
  const primeiro = Object.values(erros)[0];
  if (primeiro) throw new ErroDeRegra(primeiro);
}

/**
 * Salvar rascunho: edita o rascunho aberto; sem rascunho (ou com a última Validada), cria a versão seguinte.
 * Em validação não se edita: é preciso devolver antes.
 */
export async function salvarRascunhoDaConfiguracao(produtoId: string, formulario: FormularioConfiguracao): Promise<ConfiguracaoContratualRegistro> {
  conferirFormato(formulario);
  const versoes = await versoesDaConfiguracao(produtoId);
  const ultima = versoes[0];
  if (ultima?.situacao === 'em_validacao') throw new ErroDeRegra(`A versão ${ultima.versao} está em validação. Devolva para rascunho antes de editar.`);
  const valores = valoresDoFormulario(formulario);
  if (ultima?.situacao === 'rascunho') return repositorios.configuracao_contratual.atualizar(ultima.id, valores);
  return repositorios.configuracao_contratual.criar({ produto_id: produtoId, versao: (ultima?.versao ?? 0) + 1, situacao: 'rascunho', ...valores, enviado_por: null, enviado_em: null, validado_por: null, validado_em: null, devolucao_motivo: null, exemplo: false });
}

/** Enviar para validação: grava o rascunho e exige tudo o que a emissão final exige. */
export async function enviarParaValidacao(produtoId: string, formulario: FormularioConfiguracao, pessoaId: string | null): Promise<ConfiguracaoContratualRegistro> {
  conferirFormato(formulario);
  const pendencias = await pendenciasDaConfiguracao(produtoId, formulario);
  if (pendencias.length) throw new ErroDeRegra(`Falta preencher: ${pendencias.join(', ')}.`);
  return emTransacao(async () => {
    const rascunho = await salvarRascunhoDaConfiguracao(produtoId, formulario);
    return repositorios.configuracao_contratual.atualizar(rascunho.id, { situacao: 'em_validacao', enviado_por: pessoaId, enviado_em: new Date().toISOString(), devolucao_motivo: null });
  });
}

/** Validar (legal.validar, RN-11.30): a anterior Validada passa a Substituída. Sem permissões nesta etapa (D27). */
export async function validarConfiguracao(configuracaoId: string, pessoaId: string | null): Promise<ConfiguracaoContratualRegistro> {
  const registro = await repositorios.configuracao_contratual.obter(configuracaoId);
  if (!registro || registro.situacao !== 'em_validacao') throw new ErroDeRegra('Só a versão em validação pode ser validada.');
  return emTransacao(async () => {
    const anterior = await configuracaoValidadaDoProduto(registro.produto_id);
    if (anterior) await repositorios.configuracao_contratual.atualizar(anterior.id, { situacao: 'substituida' });
    return repositorios.configuracao_contratual.atualizar(registro.id, { situacao: 'validada', validado_por: pessoaId, validado_em: new Date().toISOString() });
  });
}

/** Devolver: volta para rascunho, com o motivo à vista. */
export async function devolverConfiguracao(configuracaoId: string, motivo: string): Promise<ConfiguracaoContratualRegistro> {
  const limpo = motivo.trim();
  if (!limpo) throw new ErroDeRegra('Informe o motivo da devolução.');
  const registro = await repositorios.configuracao_contratual.obter(configuracaoId);
  if (!registro || registro.situacao !== 'em_validacao') throw new ErroDeRegra('Só a versão em validação pode ser devolvida.');
  return repositorios.configuracao_contratual.atualizar(registro.id, { situacao: 'rascunho', devolucao_motivo: limpo });
}

export const ROTULOS_SITUACAO_CONFIGURACAO: Record<ConfiguracaoContratualRegistro['situacao'], string> = { rascunho: 'Rascunho', em_validacao: 'Em validação', validada: 'Validada', substituida: 'Substituída' };
