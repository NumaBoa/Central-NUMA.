/** Regras de T04.04 e T04.05 (06-M04): ativos digitais, titularidade e transferência. Duas chaves e Acessos ficam para a F2 (D14). */
import { z } from 'zod';
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import type { AnexoLink } from '@/dados/tipos/apoio';
import { TIPOS_DE_ATIVO, type AtivoDigital } from '@/dados/tipos/ativo';
import type { AssinaturaFerramenta, Ferramenta } from '@/dados/tipos/ferramenta';
import type { Marca, Produto } from '@/dados/tipos/marca';
import type { Pessoa } from '@/dados/tipos/pessoa';
import type { Area } from '@/dados/tipos/area';
import { hojeISO } from '@/lib/datas';
import { sincronizarAlertasDosAtivos } from './alertas';
import { sincronizarAlertasDeTransferencia } from './alertas-m06';
import { quantasAtividadesAbertasVinculadas } from './atividades';
import { ID_CONSOLIDADA, ID_INSTITUCIONAL } from './contextos';
import { normalizarTexto } from './duplicidade';
import { linkDoDriveValido, MENSAGEM_LINK_DRIVE } from './link-drive';
import { AVISO_CREDENCIAL, pareceCredencial } from './segredos';
import { titularEhODesejado, type Titular } from './titularidade';

export const ROTULOS_TIPO_ATIVO: Readonly<Record<AtivoDigital['tipo'], string>> = {
  dominio: 'Domínio',
  loja_apple: 'Conta de loja Apple',
  loja_google: 'Conta de loja Google',
  repositorio: 'Repositório ou organização',
  rede_social: 'Perfil de rede social',
  email: 'Conta de e-mail',
  analytics: 'Analytics',
  outro: 'Outro',
};

export const ROTULOS_TRANSFERENCIA: Readonly<Record<AtivoDigital['transferencia_situacao'], string>> = {
  nao_necessaria: 'Não necessária',
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  impedida: 'Impedida',
};

/** Abas por tipo de T04.04. "Marcas" é um link para o M06 (T06.05). */
export const ABAS_DE_ATIVO = [
  { id: 'todos', rotulo: 'Todos', tipos: TIPOS_DE_ATIVO },
  { id: 'dominios', rotulo: 'Domínios', tipos: ['dominio'] },
  { id: 'lojas', rotulo: 'Contas de loja', tipos: ['loja_apple', 'loja_google'] },
  { id: 'repositorios', rotulo: 'Repositórios', tipos: ['repositorio'] },
  { id: 'redes', rotulo: 'Redes sociais', tipos: ['rede_social'] },
  { id: 'emails', rotulo: 'E-mails', tipos: ['email'] },
  { id: 'analytics', rotulo: 'Analytics', tipos: ['analytics'] },
  { id: 'outros', rotulo: 'Outros', tipos: ['outro'] },
] as const satisfies readonly { id: string; rotulo: string; tipos: readonly AtivoDigital['tipo'][] }[];

export type IdDaAbaDeAtivo = (typeof ABAS_DE_ATIVO)[number]['id'];

/** Perder um destes derruba um app ou impede a operação (M04 §2). */
const TIPOS_CRITICOS: readonly AtivoDigital['tipo'][] = ['dominio', 'loja_apple', 'loja_google', 'repositorio', 'email'];
export const tipoSugereCritico = (tipo: AtivoDigital['tipo']) => TIPOS_CRITICOS.includes(tipo);

// ---------- Formulário de T04.05 ----------

const textoCurto = z.string().trim();

export const esquemaFormularioAtivo = z
  .object({
    tipo: z.enum(TIPOS_DE_ATIVO),
    identificador: z.string().trim().min(1, 'Informe o identificador.'),
    contexto: z.string().min(1, 'Escolha a Numa ou um produto.'),
    ferramenta_id: z.string(),
    titular_atual_tipo: z.enum(['numa', 'pessoa_fisica', 'terceiro']),
    titular_atual_pessoa_id: z.string(),
    titular_atual_texto: textoCurto,
    titular_desejado: textoCurto,
    /** Só vale quando o titular não é o desejado: "Concluída" é pela ação de registrar a transferência. */
    transferencia_situacao: z.enum(['pendente', 'em_andamento', 'impedida']),
    requisito_transferencia: textoCurto,
    registrado_em: z.string(),
    vencimento: z.string(),
    renovacao_automatica: z.enum(['', 'sim', 'nao']),
    assinatura_id: z.string(),
    critico: z.boolean(),
    responsavel_id: z.string().min(1, 'Escolha a responsável.'),
    observacoes: textoCurto,
  })
  .superRefine((dados, contexto) => {
    const falha = (campo: string, message: string) => contexto.addIssue({ code: 'custom', path: [campo], message });
    // CA-04.06 e RN-04.18.
    if (dados.tipo === 'dominio' && !dados.vencimento) falha('vencimento', 'Domínio precisa da data de vencimento.');
    if (dados.titular_atual_tipo === 'pessoa_fisica' && !dados.titular_atual_pessoa_id) falha('titular_atual_pessoa_id', 'Diga de qual sócia é a conta.');
    if (dados.titular_atual_tipo === 'terceiro' && !dados.titular_atual_texto) falha('titular_atual_texto', 'Diga de quem é a conta.');
    if (!dados.titular_desejado) falha('titular_desejado', 'Diga em nome de quem deveria estar.');
  });

export type FormularioAtivo = z.infer<typeof esquemaFormularioAtivo>;

export function formularioAtivoVazio(pessoaId: string, contextoGlobalId: string, responsavelId: string, tipo: AtivoDigital['tipo'] = 'dominio'): FormularioAtivo {
  return {
    tipo,
    identificador: '',
    contexto: contextoGlobalId === ID_CONSOLIDADA ? '' : contextoGlobalId,
    ferramenta_id: '',
    // Sem PJ aberta, o mais provável é estar em nome de quem cadastra (RN-04.14), como nas ferramentas.
    titular_atual_tipo: 'pessoa_fisica',
    titular_atual_pessoa_id: pessoaId,
    titular_atual_texto: '',
    titular_desejado: 'Numa',
    transferencia_situacao: 'pendente',
    requisito_transferencia: '',
    registrado_em: '',
    vencimento: '',
    renovacao_automatica: '',
    assinatura_id: '',
    critico: tipoSugereCritico(tipo),
    responsavel_id: responsavelId,
    observacoes: '',
  };
}

export function formularioDoAtivo(ativo: AtivoDigital): FormularioAtivo {
  const situacao = ativo.transferencia_situacao;
  return {
    tipo: ativo.tipo,
    identificador: ativo.identificador,
    contexto: ativo.produto_id ?? ID_INSTITUCIONAL,
    ferramenta_id: ativo.ferramenta_id ?? '',
    titular_atual_tipo: ativo.titular_atual_tipo,
    titular_atual_pessoa_id: ativo.titular_atual_pessoa_id ?? '',
    titular_atual_texto: ativo.titular_atual_texto ?? '',
    titular_desejado: ativo.titular_desejado,
    transferencia_situacao: situacao === 'em_andamento' || situacao === 'impedida' ? situacao : 'pendente',
    requisito_transferencia: ativo.requisito_transferencia ?? '',
    registrado_em: ativo.registrado_em ?? '',
    vencimento: ativo.vencimento ?? '',
    renovacao_automatica: ativo.renovacao_automatica === null ? '' : ativo.renovacao_automatica ? 'sim' : 'nao',
    assinatura_id: ativo.assinatura_id ?? '',
    critico: ativo.critico,
    responsavel_id: ativo.responsavel_id,
    observacoes: ativo.observacoes ?? '',
  };
}

const nulo = (texto: string) => texto.trim() || null;

function titularDoFormulario(formulario: Pick<FormularioAtivo, 'titular_atual_tipo' | 'titular_atual_pessoa_id' | 'titular_atual_texto'>): Titular {
  return {
    titular_atual_tipo: formulario.titular_atual_tipo,
    titular_atual_pessoa_id: formulario.titular_atual_tipo === 'pessoa_fisica' ? nulo(formulario.titular_atual_pessoa_id) : null,
    titular_atual_texto: formulario.titular_atual_tipo === 'terceiro' ? nulo(formulario.titular_atual_texto) : null,
  };
}

/** Titular atual igual ao desejado não tem o que transferir (T04.05); quem já concluiu continua concluída. */
export function situacaoDaTransferencia(formulario: FormularioAtivo, pessoas: readonly Pick<Pessoa, 'id' | 'nome_completo'>[], atual?: Pick<AtivoDigital, 'transferencia_situacao'> | null): AtivoDigital['transferencia_situacao'] {
  if (!titularEhODesejado(titularDoFormulario(formulario), formulario.titular_desejado, pessoas)) return formulario.transferencia_situacao;
  return atual?.transferencia_situacao === 'concluida' ? 'concluida' : 'nao_necessaria';
}

/** Domínio não diferencia maiúsculas; os outros guardam como foi escrito, e a unicidade vale do mesmo jeito. */
function identificadorLimpo(tipo: AtivoDigital['tipo'], identificador: string): string {
  const limpo = identificador.trim();
  return tipo === 'dominio' ? limpo.toLowerCase() : limpo;
}

function dadosDoAtivo(formulario: FormularioAtivo, pessoas: readonly Pick<Pessoa, 'id' | 'nome_completo'>[], atual?: AtivoDigital | null) {
  return {
    tipo: formulario.tipo,
    identificador: identificadorLimpo(formulario.tipo, formulario.identificador),
    produto_id: formulario.contexto === ID_INSTITUCIONAL ? null : formulario.contexto,
    ferramenta_id: nulo(formulario.ferramenta_id),
    ...titularDoFormulario(formulario),
    titular_desejado: formulario.titular_desejado,
    transferencia_situacao: situacaoDaTransferencia(formulario, pessoas, atual),
    requisito_transferencia: nulo(formulario.requisito_transferencia),
    registrado_em: nulo(formulario.registrado_em),
    vencimento: nulo(formulario.vencimento),
    renovacao_automatica: formulario.renovacao_automatica === '' ? null : formulario.renovacao_automatica === 'sim',
    assinatura_id: nulo(formulario.assinatura_id),
    critico: formulario.critico,
    responsavel_id: formulario.responsavel_id,
    observacoes: nulo(formulario.observacoes),
  };
}

export type ConferenciaAtivo = {
  /** Identificador igual, do mesmo tipo: não deixa salvar (T04.05). */
  erroIdentificador: string | null;
  avisos: string[];
};

const DOMINIO_VALIDO = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

export function conferirAtivo(formulario: FormularioAtivo, existentes: readonly Pick<AtivoDigital, 'id' | 'tipo' | 'identificador' | 'arquivado_em'>[], idAtual: string | undefined, hoje: string = hojeISO()): ConferenciaAtivo {
  const igual = existentes.find((ativo) => ativo.id !== idAtual && ativo.tipo === formulario.tipo && normalizarTexto(ativo.identificador) === normalizarTexto(formulario.identificador));
  const erroIdentificador = igual ? `Já existe ${ROTULOS_TIPO_ATIVO[igual.tipo].toLowerCase()} com esse identificador${igual.arquivado_em ? ', em Arquivados' : ''}.` : null;
  const avisos: string[] = [];
  if (formulario.tipo === 'dominio' && formulario.identificador && !DOMINIO_VALIDO.test(formulario.identificador.trim())) avisos.push('Isso não parece um domínio, como numa.com.br.');
  if (formulario.vencimento && formulario.vencimento < hoje) avisos.push('O vencimento já passou.');
  if ([formulario.observacoes, formulario.requisito_transferencia].some(pareceCredencial)) avisos.push(AVISO_CREDENCIAL);
  return { erroIdentificador, avisos };
}

// ---------- Gravar ----------

export async function criarAtivo(formulario: FormularioAtivo, pessoas: readonly Pick<Pessoa, 'id' | 'nome_completo'>[]): Promise<AtivoDigital> {
  const ativo = await repositorios.ativo_digital.criar({ ...dadosDoAtivo(formulario, pessoas), evidencia_transferencia_url: null, transferido_em: null });
  await sincronizarAlertasDosAtivos([ativo.id]);
  return ativo;
}

/** RN-03.14: renovar o domínio muda o vencimento, e o alerta se resolve na hora. */
export async function salvarAtivo(id: string, formulario: FormularioAtivo, pessoas: readonly Pick<Pessoa, 'id' | 'nome_completo'>[]): Promise<AtivoDigital> {
  const atual = await repositorios.ativo_digital.obter(id);
  const salvo = await repositorios.ativo_digital.atualizar(id, dadosDoAtivo(formulario, pessoas, atual));
  await sincronizarAlertasDosAtivos([id]);
  await sincronizarAlertasDeTransferencia({ apenas: [id] });
  return salvo;
}

export const esquemaRegistrarTransferencia = z
  .object({
    data: z.string().min(1, 'Informe a data da transferência.'),
    titular_tipo: z.enum(['numa', 'pessoa_fisica', 'terceiro']),
    titular_pessoa_id: z.string(),
    titular_texto: textoCurto,
    evidencia: textoCurto,
    observacao: textoCurto,
  })
  .superRefine((dados, contexto) => {
    const falha = (campo: string, message: string) => contexto.addIssue({ code: 'custom', path: [campo], message });
    if (dados.titular_tipo === 'pessoa_fisica' && !dados.titular_pessoa_id) falha('titular_pessoa_id', 'Diga para qual sócia.');
    if (dados.titular_tipo === 'terceiro' && !dados.titular_texto) falha('titular_texto', 'Diga para quem.');
    // CA-04.07.
    if (!dados.evidencia) falha('evidencia', 'Sem o link da evidência, a transferência não conta como concluída.');
    else if (!linkDoDriveValido(dados.evidencia)) falha('evidencia', MENSAGEM_LINK_DRIVE);
  });

export type FormularioTransferencia = z.infer<typeof esquemaRegistrarTransferencia>;

export function formularioTransferenciaVazio(hoje: string = hojeISO()): FormularioTransferencia {
  return { data: hoje, titular_tipo: 'numa', titular_pessoa_id: '', titular_texto: '', evidencia: '', observacao: '' };
}

/** T04.05: situação Concluída, titular atual atualizado, histórico gravado. */
export async function registrarTransferencia(id: string, formulario: FormularioTransferencia): Promise<AtivoDigital> {
  const conferido = esquemaRegistrarTransferencia.safeParse(formulario);
  if (!conferido.success) throw new ErroDeRegra(conferido.error.issues[0]?.message ?? 'Confira os dados da transferência.');
  const { data, titular_tipo, titular_pessoa_id, titular_texto, evidencia, observacao } = conferido.data;
  const salvo = await repositorios.ativo_digital.atualizar(
    id,
    {
      titular_atual_tipo: titular_tipo,
      titular_atual_pessoa_id: titular_tipo === 'pessoa_fisica' ? titular_pessoa_id : null,
      titular_atual_texto: titular_tipo === 'terceiro' ? titular_texto : null,
      transferencia_situacao: 'concluida',
      transferido_em: data,
      evidencia_transferencia_url: evidencia,
    },
    observacao ? { motivo: observacao } : undefined,
  );
  await sincronizarAlertasDeTransferencia({ apenas: [id] });
  return salvo;
}

/** T06.04: impedida com motivo. O motivo aparece na lista, e o histórico guarda (RT-16). */
export async function marcarTransferenciaImpedida(id: string, motivo: string): Promise<void> {
  const limpo = motivo.trim();
  if (!limpo) throw new ErroDeRegra('Diga o que impede a transferência.');
  await repositorios.ativo_digital.atualizar(id, { transferencia_situacao: 'impedida', impedimento_motivo: limpo }, { motivo: limpo });
}

export async function retomarTransferencia(id: string): Promise<void> {
  await repositorios.ativo_digital.atualizar(id, { transferencia_situacao: 'pendente', impedimento_motivo: null });
}

export async function vinculosDoAtivo(id: string): Promise<string[]> {
  const abertas = await quantasAtividadesAbertasVinculadas('ativo_digital', id);
  return abertas ? [abertas === 1 ? '1 atividade aberta' : `${abertas} atividades abertas`] : [];
}

export async function arquivarAtivo(id: string): Promise<void> {
  const vinculos = await vinculosDoAtivo(id);
  if (vinculos.length) throw new ErroDeRegra(`Este ativo tem ${vinculos.join(', ')}. Conclua ou tire o vínculo antes.`);
  await repositorios.ativo_digital.arquivar(id);
  await sincronizarAlertasDosAtivos([id]);
}

export async function restaurarAtivo(id: string): Promise<void> {
  await repositorios.ativo_digital.restaurar(id);
  await sincronizarAlertasDosAtivos([id]);
}

// ---------- Arquivos (links do Drive, até o M08) ----------

const TIPO_DO_REGISTRO = 'ativo_digital';

export async function linksDoAtivo(id: string): Promise<AnexoLink[]> {
  return repositorios.anexo_link.listar({ onde: { registro_id: id, registro_tipo: TIPO_DO_REGISTRO } });
}

export async function adicionarLinkDoAtivo(id: string, url: string): Promise<void> {
  const limpo = url.trim();
  if (!linkDoDriveValido(limpo)) throw new ErroDeRegra(MENSAGEM_LINK_DRIVE);
  await repositorios.anexo_link.criar({ registro_tipo: TIPO_DO_REGISTRO, registro_id: id, titulo: 'Arquivo do Drive', url: limpo });
}

export async function removerLinkDoAtivo(id: string): Promise<void> {
  await repositorios.anexo_link.arquivar(id);
}

// ---------- Carga ----------

export type DadosDosAtivos = {
  ativos: AtivoDigital[];
  pessoas: Pessoa[];
  produtos: Produto[];
  marcas: Marca[];
  areas: Area[];
  ferramentas: Ferramenta[];
  assinaturas: AssinaturaFerramenta[];
};

export async function carregarAtivos(): Promise<DadosDosAtivos> {
  const [ativos, pessoas, produtos, marcas, areas, ferramentas, assinaturas] = await Promise.all([
    repositorios.ativo_digital.listar({ incluirArquivados: true }),
    repositorios.pessoa.listar({ incluirArquivados: true }),
    repositorios.produto.listar({ incluirArquivados: true }),
    repositorios.marca.listar({ incluirArquivados: true }),
    repositorios.area.listar(),
    repositorios.ferramenta.listar({ incluirArquivados: true }),
    repositorios.assinatura_ferramenta.listar({ onde: { situacao: 'ativa' } }),
  ]);
  return { ativos, pessoas, produtos, marcas, areas, ferramentas, assinaturas };
}

// ---------- Lista (T04.04) ----------

export type FiltrosAtivos = {
  busca: string;
  aba: IdDaAbaDeAtivo;
  tipo: string;
  contexto: string;
  situacao: string;
  titularDiferente: boolean;
  venceEm: '' | '30' | '45' | '60' | '90';
  arquivados: boolean;
};

export const FILTROS_ATIVOS_INICIAIS: FiltrosAtivos = { busca: '', aba: 'todos', tipo: '', contexto: '', situacao: '', titularDiferente: false, venceEm: '', arquivados: false };

function somarDias(dia: string, dias: number): string {
  const data = new Date(`${dia}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

/** Dias até o vencimento; negativo é vencido, e `null` é quem não tem data. */
export function diasParaVencer(ativo: Pick<AtivoDigital, 'vencimento'>, hoje: string): number | null {
  if (!ativo.vencimento) return null;
  return Math.round((new Date(`${ativo.vencimento}T00:00:00Z`).getTime() - new Date(`${hoje}T00:00:00Z`).getTime()) / 86400000);
}

type OpcoesDoFiltro = { contextoGlobalId: string; hoje: string; pessoas: readonly Pick<Pessoa, 'id' | 'nome_completo'>[]; nomeDaFerramenta: (id: string | null) => string };

/** Sem a aba: serve para os contadores das próprias abas. */
function passaNosFiltros(ativo: AtivoDigital, filtros: FiltrosAtivos, { contextoGlobalId, hoje, pessoas, nomeDaFerramenta }: OpcoesDoFiltro): boolean {
  const texto = normalizarTexto(filtros.busca);
  const contexto = filtros.contexto || (contextoGlobalId === ID_CONSOLIDADA ? '' : contextoGlobalId);
  if (Boolean(ativo.arquivado_em) !== filtros.arquivados) return false;
  if (texto && !normalizarTexto(`${ativo.codigo} ${ativo.identificador} ${nomeDaFerramenta(ativo.ferramenta_id)}`).includes(texto)) return false;
  if (filtros.tipo && ativo.tipo !== filtros.tipo) return false;
  if (contexto && (ativo.produto_id ?? ID_INSTITUCIONAL) !== contexto) return false;
  if (filtros.situacao && ativo.transferencia_situacao !== filtros.situacao) return false;
  if (filtros.titularDiferente && titularEhODesejado(ativo, ativo.titular_desejado, pessoas)) return false;
  if (filtros.venceEm) {
    if (!ativo.vencimento || ativo.vencimento < hoje || ativo.vencimento > somarDias(hoje, Number(filtros.venceEm))) return false;
  }
  return true;
}

const tiposDaAba = (aba: IdDaAbaDeAtivo): readonly AtivoDigital['tipo'][] => ABAS_DE_ATIVO.find((item) => item.id === aba)?.tipos ?? TIPOS_DE_ATIVO;

export function filtrarAtivos(ativos: readonly AtivoDigital[], filtros: FiltrosAtivos, opcoes: OpcoesDoFiltro): AtivoDigital[] {
  const tipos = tiposDaAba(filtros.aba);
  return ativos
    .filter((ativo) => tipos.includes(ativo.tipo) && passaNosFiltros(ativo, filtros, opcoes))
    .sort((a, b) => a.identificador.localeCompare(b.identificador, 'pt-BR'));
}

export function contadoresDasAbas(ativos: readonly AtivoDigital[], filtros: FiltrosAtivos, opcoes: OpcoesDoFiltro): Record<IdDaAbaDeAtivo, number> {
  const passam = ativos.filter((ativo) => passaNosFiltros(ativo, filtros, opcoes));
  return Object.fromEntries(ABAS_DE_ATIVO.map((aba) => [aba.id, passam.filter((ativo) => (aba.tipos as readonly AtivoDigital['tipo'][]).includes(ativo.tipo)).length])) as Record<IdDaAbaDeAtivo, number>;
}

// ---------- Nas fichas e nos vínculos dos outros cadastros ----------

/** T04.02, aba Ativos hospedados. */
export async function ativosDaFerramenta(id: string): Promise<AtivoDigital[]> {
  return (await repositorios.ativo_digital.listar({ onde: { ferramenta_id: id } })).sort((a, b) => a.identificador.localeCompare(b.identificador, 'pt-BR'));
}

export async function ativosDoProduto(id: string): Promise<AtivoDigital[]> {
  return (await repositorios.ativo_digital.listar({ onde: { produto_id: id } })).sort((a, b) => a.identificador.localeCompare(b.identificador, 'pt-BR'));
}

export async function vinculosDeAtivoDaPessoa(id: string): Promise<string[]> {
  return (await repositorios.ativo_digital.listar({ onde: { responsavel_id: id } })).map((ativo) => `Responsável por ${ativo.identificador}`);
}
