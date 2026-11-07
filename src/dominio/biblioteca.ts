/**
 * Regras de T08.01 a T08.03 e T08.08 (10-M08): a biblioteca guarda links do Drive e metadados, nunca o
 * arquivo (RN-08.01). Sem integração com o Drive, a Central não sabe o nome do arquivo nem se ele é público:
 * o título é digitado, e a grade mostra ícones por tipo, sem miniatura.
 */
import { z } from 'zod';
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import { emTransacao } from '@/dados/transacao';
import type { Etiqueta, EtiquetaVinculo } from '@/dados/tipos/etiqueta';
import type { Marca, Produto } from '@/dados/tipos/marca';
import { CLASSES_DE_INFORMACAO, FINALIDADES_DE_APRESENTACAO, TIPOS_DE_ARQUIVO, type Arquivo, type ArquivoContexto, type ArquivoVersao, type ArquivoVinculo, type ClasseDeInformacao, type TipoDeArquivo } from '@/dados/tipos/marketing';
import type { Pessoa } from '@/dados/tipos/pessoa';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO } from '@/lib/formatacao';
import { sincronizarAlertasDosArquivos } from './alertas-m08';
import { classeRestrita, podeVerClasse } from './classes';
import { ID_CONSOLIDADA, ID_INSTITUCIONAL } from './contextos';
import { normalizarTexto } from './duplicidade';
import { definirEtiquetasDoRegistro, etiquetasPorRegistro } from './etiquetas';
import { linkDoDriveValido, MENSAGEM_LINK_DRIVE } from './link-drive';
import { somarDias } from './repeticao';
import { AVISO_CREDENCIAL, pareceCredencial } from './segredos';

export const ROTULOS_TIPO_ARQUIVO: Readonly<Record<TipoDeArquivo, string>> = {
  logo: 'Logo',
  imagem: 'Imagem',
  icone: 'Ícone',
  identidade: 'Identidade/manual de marca',
  apresentacao: 'Apresentação',
  modelo_proposta: 'Proposta (modelo)',
  modelo_documento: 'Modelo de documento',
  documento_institucional: 'Documento institucional',
  contrato: 'Contrato',
  video: 'Vídeo',
  print: 'Print/tela',
  outro: 'Outro',
};

export const ROTULOS_FINALIDADE: Readonly<Record<(typeof FINALIDADES_DE_APRESENTACAO)[number], string>> = { institucional: 'Institucional', comercial: 'Comercial', produto: 'Produto', investidores: 'Investidores', evento: 'Evento' };

/**
 * T08.03: "Logo/Imagem/Apresentação = PUB; Modelo/Documento = INT; Contrato = DOC". Os tipos que a
 * especificação não cita ficam INT, o mais conservador. É só o padrão: a classe é por item (RN-08.08).
 */
export function classePadraoDoTipo(tipo: TipoDeArquivo): ClasseDeInformacao {
  if (tipo === 'logo' || tipo === 'imagem' || tipo === 'icone' || tipo === 'apresentacao') return 'pub';
  if (tipo === 'contrato') return 'doc';
  return 'int';
}

/** Modelos jurídicos editáveis e documentos legais são do M09: aqui fica só o arquivo ou a referência. */
export const tipoJuridico = (tipo: TipoDeArquivo) => tipo === 'modelo_documento' || tipo === 'contrato';

/** Coleções rápidas de T08.01. "Marca" junta o que forma a identidade visual. */
export const COLECOES = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'numa', rotulo: 'Numa institucional' },
  { id: 'produtos', rotulo: 'Produtos' },
  { id: 'apresentacoes', rotulo: 'Apresentações' },
  { id: 'marca', rotulo: 'Marca' },
] as const;
export type IdDaColecao = (typeof COLECOES)[number]['id'];
const TIPOS_DE_MARCA: readonly TipoDeArquivo[] = ['logo', 'icone', 'identidade'];

// ---------- Link do Drive ----------

const PADROES_DO_ID = [/\/d\/([-\w]{10,})/, /[?&]id=([-\w]{10,})/, /\/folders\/([-\w]{10,})/];

/** O ID do arquivo no Drive, tirado da URL (RN-08.07). `null` quando o link não aponta um arquivo. */
export function idDoDrive(url: string): string | null {
  const limpo = url.trim();
  if (!linkDoDriveValido(limpo)) return null;
  for (const padrao of PADROES_DO_ID) {
    const achado = padrao.exec(limpo);
    if (achado?.[1]) return achado[1];
  }
  return null;
}

export const MENSAGEM_SEM_ID = 'Esse link não aponta um arquivo. No Drive, use Compartilhar › Copiar link no próprio arquivo.';

/** O que impede o link de entrar. `null` quando ele serve. */
export function problemaDoLink(url: string): string | null {
  if (!url.trim()) return 'Cole o link do Drive.';
  if (!linkDoDriveValido(url)) return MENSAGEM_LINK_DRIVE;
  if (!idDoDrive(url)) return MENSAGEM_SEM_ID;
  return null;
}

export type Duplicado = { arquivoId: string; codigo: string; titulo: string; /** `null`: é a versão atual. */ versao: number | null; arquivado: boolean };

/** Mesmo ID de arquivo já cadastrado, na versão atual ou numa anterior (RN-08.07 e CA-08.02). */
export function acharDuplicado(driveId: string | null, arquivos: readonly Pick<Arquivo, 'id' | 'codigo' | 'titulo' | 'drive_file_id' | 'versao_atual' | 'arquivado_em'>[], versoes: readonly Pick<ArquivoVersao, 'arquivo_id' | 'versao' | 'drive_file_id' | 'arquivado_em'>[]): Duplicado | null {
  if (!driveId) return null;
  const atual = arquivos.find((arquivo) => arquivo.drive_file_id === driveId);
  if (atual) return { arquivoId: atual.id, codigo: atual.codigo, titulo: atual.titulo, versao: null, arquivado: Boolean(atual.arquivado_em) };
  const antiga = versoes.find((versao) => !versao.arquivado_em && versao.drive_file_id === driveId);
  const dono = antiga && arquivos.find((arquivo) => arquivo.id === antiga.arquivo_id);
  return antiga && dono ? { arquivoId: dono.id, codigo: dono.codigo, titulo: dono.titulo, versao: antiga.versao === dono.versao_atual ? null : antiga.versao, arquivado: Boolean(dono.arquivado_em) } : null;
}

export function mensagemDoDuplicado(duplicado: Duplicado): string {
  const onde = duplicado.versao ? `a versão ${duplicado.versao} de ${duplicado.titulo}` : duplicado.titulo;
  return `Esse arquivo já está na biblioteca: ${onde} (${duplicado.codigo})${duplicado.arquivado ? ', em Arquivados' : ''}.`;
}

// ---------- Direitos de uso ----------

export const DIAS_AVISO_DIREITOS = 30;

export type SituacaoDosDireitos = { estado: 'sem_validade' | 'vigentes' | 'a_vencer' | 'expirados'; dias: number | null };

/** RN-08.06: alerta 30 dias antes do fim e "Direitos expirados" depois. */
export function situacaoDosDireitos(arquivo: Pick<Arquivo, 'direitos_validade'>, hoje: string): SituacaoDosDireitos {
  if (!arquivo.direitos_validade) return { estado: 'sem_validade', dias: null };
  const dias = Math.round((new Date(`${arquivo.direitos_validade}T00:00:00Z`).getTime() - new Date(`${hoje}T00:00:00Z`).getTime()) / 86_400_000);
  if (dias < 0) return { estado: 'expirados', dias };
  return { estado: somarDias(arquivo.direitos_validade, -DIAS_AVISO_DIREITOS) <= hoje ? 'a_vencer' : 'vigentes', dias };
}

/** O texto que acompanha a cor (CA-18.07). */
export function textoDosDireitos(arquivo: Pick<Arquivo, 'direitos_validade'>, hoje: string): string | null {
  const { estado, dias } = situacaoDosDireitos(arquivo, hoje);
  if (estado === 'expirados') return `Direitos expirados em ${formatarDiaISO(arquivo.direitos_validade as string)}`;
  if (estado === 'a_vencer') return dias === 0 ? 'Direitos vencem hoje' : `Direitos a vencer em ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
  return null;
}

// ---------- Pasta sugerida (D19) ----------

/** A estrutura de pastas de 10-M08 §4. É só orientação: a Central não cria pastas no Drive. */
export function pastaSugerida(tipo: TipoDeArquivo, contextos: readonly string[], produtos: readonly Pick<Produto, 'id' | 'nome'>[]): string | null {
  const primeiro = contextos[0];
  if (!primeiro) return null;
  if (primeiro === ID_INSTITUCIONAL) return '/Numa/Institucional';
  const produto = produtos.find((item) => item.id === primeiro);
  if (!produto) return null;
  const sub = tipo === 'contrato' ? 'Contratos' : tipo === 'modelo_documento' || tipo === 'documento_institucional' ? 'Legal' : tipo === 'apresentacao' || tipo === 'modelo_proposta' ? 'Apresentações' : 'Marca';
  return `/Produtos/${produto.nome}/${sub}`;
}

// ---------- Formulário (T08.03, T08.08) ----------

const curto = z.string().trim();
const SIM_NAO = z.enum(['', 'sim', 'nao']);

const camposDoArquivo = {
  titulo: curto.min(1, 'Informe o título. Sem integração com o Drive, a Central não sabe o nome do arquivo.'),
  tipo: z.enum(TIPOS_DE_ARQUIVO),
  contextos: z.array(z.string()).min(1, 'Escolha a Numa ou ao menos um produto.'),
  classe: z.enum(CLASSES_DE_INFORMACAO),
  pasta_restrita_confirmada: z.boolean(),
  responsavel_id: z.string().min(1, 'Escolha a responsável.'),
  etiquetas: z.array(z.string()),
  descricao: curto,
  origem_autor: curto,
  direitos_uso: curto,
  direitos_validade: z.string(),
  finalidade: z.string(),
  publico: curto,
  data_uso: z.string(),
  contem_precos: SIM_NAO,
  precos_data: z.string(),
  contem_fin: z.boolean(),
};

type CamposComuns = { classe: ClasseDeInformacao; pasta_restrita_confirmada: boolean; contem_fin: boolean; contem_precos: '' | 'sim' | 'nao'; precos_data: string };

function conferirRegrasComuns(dados: CamposComuns, falha: (campo: string, mensagem: string) => void) {
  // RN-08.03.
  if (classeRestrita(dados.classe) && !dados.pasta_restrita_confirmada) falha('pasta_restrita_confirmada', 'Confirme que a pasta no Drive está restrita.');
  // T08.08.
  if (dados.contem_fin && dados.classe === 'pub') falha('classe', 'Material com dados financeiros não pode ser PUB. Escolha INT, FIN ou DOC.');
  if (dados.contem_precos === 'sim' && !dados.precos_data) falha('precos_data', 'Informe a data dos preços.');
}

export const esquemaFormularioArquivo = z
  .object({ link: curto, vinculo: z.string(), ...camposDoArquivo })
  .superRefine((dados, contexto) => {
    const falha = (campo: string, message: string) => contexto.addIssue({ code: 'custom', path: [campo], message });
    const problema = problemaDoLink(dados.link);
    if (problema) falha('link', problema);
    conferirRegrasComuns(dados, falha);
  });
export type FormularioArquivo = z.infer<typeof esquemaFormularioArquivo>;

/** A edição não troca o link: para isso há "Nova versão" (RN-08.04). */
export const esquemaEdicaoArquivo = z.object(camposDoArquivo).superRefine((dados, contexto) => conferirRegrasComuns(dados, (campo, message) => contexto.addIssue({ code: 'custom', path: [campo], message })));
export type EdicaoArquivo = z.infer<typeof esquemaEdicaoArquivo>;

export function formularioArquivoVazio(responsavelId: string, contextoGlobalId: string, tipo: TipoDeArquivo = 'imagem'): FormularioArquivo {
  return {
    link: '',
    vinculo: '',
    titulo: '',
    tipo,
    contextos: contextoGlobalId === ID_CONSOLIDADA ? [] : [contextoGlobalId],
    classe: classePadraoDoTipo(tipo),
    pasta_restrita_confirmada: false,
    responsavel_id: responsavelId,
    etiquetas: [],
    descricao: '',
    origem_autor: '',
    direitos_uso: '',
    direitos_validade: '',
    finalidade: '',
    publico: '',
    data_uso: '',
    contem_precos: '',
    precos_data: '',
    contem_fin: false,
  };
}

export function edicaoDoArquivo(arquivo: Arquivo, contextos: readonly ArquivoContexto[], etiquetas: readonly string[]): EdicaoArquivo {
  return {
    titulo: arquivo.titulo,
    tipo: arquivo.tipo,
    contextos: contextos.filter((item) => item.arquivo_id === arquivo.id && !item.arquivado_em).map((item) => item.produto_id ?? ID_INSTITUCIONAL),
    classe: arquivo.classe,
    pasta_restrita_confirmada: arquivo.pasta_restrita_confirmada,
    responsavel_id: arquivo.responsavel_id,
    etiquetas: [...etiquetas],
    descricao: arquivo.descricao ?? '',
    origem_autor: arquivo.origem_autor ?? '',
    direitos_uso: arquivo.direitos_uso ?? '',
    direitos_validade: arquivo.direitos_validade ?? '',
    finalidade: arquivo.finalidade ?? '',
    publico: arquivo.publico ?? '',
    data_uso: arquivo.data_uso ?? '',
    contem_precos: arquivo.contem_precos === null ? '' : arquivo.contem_precos ? 'sim' : 'nao',
    precos_data: arquivo.precos_data ?? '',
    contem_fin: arquivo.contem_fin,
  };
}

const nulo = (texto: string) => texto.trim() || null;

function dadosDoArquivo(formulario: EdicaoArquivo) {
  const apresentacao = formulario.tipo === 'apresentacao';
  return {
    titulo: formulario.titulo.trim(),
    tipo: formulario.tipo,
    descricao: nulo(formulario.descricao),
    classe: formulario.classe,
    // A confirmação só vale para FIN e DOC; numa classe aberta, ela não diz nada.
    pasta_restrita_confirmada: classeRestrita(formulario.classe) && formulario.pasta_restrita_confirmada,
    responsavel_id: formulario.responsavel_id,
    origem_autor: nulo(formulario.origem_autor),
    direitos_uso: nulo(formulario.direitos_uso),
    direitos_validade: nulo(formulario.direitos_validade),
    finalidade: apresentacao && formulario.finalidade ? (formulario.finalidade as Arquivo['finalidade']) : null,
    publico: apresentacao ? nulo(formulario.publico) : null,
    data_uso: apresentacao ? nulo(formulario.data_uso) : null,
    contem_precos: apresentacao && formulario.contem_precos ? formulario.contem_precos === 'sim' : null,
    precos_data: apresentacao && formulario.contem_precos === 'sim' ? nulo(formulario.precos_data) : null,
    contem_fin: formulario.contem_fin,
  };
}

/** Avisos que não impedem salvar. */
export function avisosDoArquivo(formulario: Pick<EdicaoArquivo, 'descricao' | 'origem_autor' | 'direitos_uso' | 'direitos_validade'>, hoje: string = hojeISO()): string[] {
  const avisos: string[] = [];
  if (formulario.direitos_validade && formulario.direitos_validade < hoje) avisos.push('A validade dos direitos de uso já passou: o item fica marcado "Direitos expirados".');
  if ([formulario.descricao, formulario.origem_autor, formulario.direitos_uso].some(pareceCredencial)) avisos.push(AVISO_CREDENCIAL);
  return avisos;
}

// ---------- Gravar ----------

type Existentes = { arquivos: Arquivo[]; versoes: ArquivoVersao[] };

async function lerExistentes(): Promise<Existentes> {
  const [arquivos, versoes] = await Promise.all([repositorios.arquivo.listar({ incluirArquivados: true }), repositorios.arquivo_versao.listar({ incluirArquivados: true })]);
  return { arquivos, versoes };
}

async function definirContextos(arquivoId: string, contextos: readonly string[]) {
  const desejados = [...new Set(contextos)].map((id) => (id === ID_INSTITUCIONAL ? null : id));
  const atuais = await repositorios.arquivo_contexto.listar({ onde: { arquivo_id: arquivoId } });
  for (const atual of atuais) if (!desejados.includes(atual.produto_id)) await repositorios.arquivo_contexto.arquivar(atual.id);
  for (const produtoId of desejados) if (!atuais.some((atual) => atual.produto_id === produtoId)) await repositorios.arquivo_contexto.criar({ arquivo_id: arquivoId, produto_id: produtoId });
}

/** "tipo:id" do seletor de registros. */
export function lerVinculo(valor: string): { tipo: string; id: string } | null {
  const [tipo, ...resto] = valor.split(':');
  const id = resto.join(':');
  return tipo && id ? { tipo, id } : null;
}

/** T08.03. Duplicidade conferida de novo dentro da transação: a tela pode estar desatualizada. */
export async function criarArquivo(formulario: FormularioArquivo): Promise<Arquivo> {
  const conferido = esquemaFormularioArquivo.safeParse(formulario);
  if (!conferido.success) throw new ErroDeRegra(conferido.error.issues[0]?.message ?? 'Confira os dados do arquivo.');
  const dados = conferido.data;
  const driveId = idDoDrive(dados.link);
  const criado = await emTransacao(async () => {
    const { arquivos, versoes } = await lerExistentes();
    const duplicado = acharDuplicado(driveId, arquivos, versoes);
    if (duplicado) throw new ErroDeRegra(mensagemDoDuplicado(duplicado));
    const arquivo = await repositorios.arquivo.criar({ ...dadosDoArquivo(dados), versao_atual: 1, url_atual: dados.link.trim(), drive_file_id: driveId });
    await repositorios.arquivo_versao.criar({ arquivo_id: arquivo.id, versao: 1, url: arquivo.url_atual, drive_file_id: driveId, nota: null });
    await definirContextos(arquivo.id, dados.contextos);
    if (dados.etiquetas.length) await definirEtiquetasDoRegistro('arquivo', arquivo.id, dados.etiquetas);
    const vinculo = lerVinculo(dados.vinculo);
    if (vinculo) await repositorios.arquivo_vinculo.criar({ arquivo_id: arquivo.id, registro_tipo: vinculo.tipo, registro_id: vinculo.id });
    return arquivo;
  });
  await sincronizarAlertasDosArquivos([criado.id]);
  return criado;
}

export async function salvarArquivo(id: string, formulario: EdicaoArquivo): Promise<Arquivo> {
  const conferido = esquemaEdicaoArquivo.safeParse(formulario);
  if (!conferido.success) throw new ErroDeRegra(conferido.error.issues[0]?.message ?? 'Confira os dados do arquivo.');
  const salvo = await emTransacao(async () => {
    const arquivo = await repositorios.arquivo.atualizar(id, dadosDoArquivo(conferido.data));
    await definirContextos(id, conferido.data.contextos);
    await definirEtiquetasDoRegistro('arquivo', id, conferido.data.etiquetas);
    return arquivo;
  });
  await sincronizarAlertasDosArquivos([id]);
  return salvo;
}

export const esquemaNovaVersao = z
  .object({ link: curto, nota: curto })
  .superRefine((dados, contexto) => {
    const problema = problemaDoLink(dados.link);
    if (problema) contexto.addIssue({ code: 'custom', path: ['link'], message: problema });
  });
export type FormularioNovaVersao = z.infer<typeof esquemaNovaVersao>;

/** RN-08.04: novo link, data, autor e nota; a anterior continua consultável, com o link dela. */
export async function registrarNovaVersao(id: string, formulario: FormularioNovaVersao): Promise<Arquivo> {
  const conferido = esquemaNovaVersao.safeParse(formulario);
  if (!conferido.success) throw new ErroDeRegra(conferido.error.issues[0]?.message ?? 'Confira o link da nova versão.');
  const link = conferido.data.link.trim();
  const driveId = idDoDrive(link);
  return emTransacao(async () => {
    const { arquivos, versoes } = await lerExistentes();
    const arquivo = arquivos.find((item) => item.id === id);
    if (!arquivo || arquivo.arquivado_em) throw new ErroDeRegra('Esse arquivo não está ativo. Restaure antes de registrar uma versão.');
    const duplicado = acharDuplicado(driveId, arquivos, versoes);
    if (duplicado?.arquivoId === id) throw new ErroDeRegra(duplicado.versao ? `Esse link é a versão ${duplicado.versao} deste arquivo. Use o link do arquivo novo.` : 'Esse é o link da versão atual. Use o link do arquivo novo.');
    if (duplicado) throw new ErroDeRegra(mensagemDoDuplicado(duplicado));
    const numero = Math.max(arquivo.versao_atual, ...versoes.filter((versao) => versao.arquivo_id === id).map((versao) => versao.versao)) + 1;
    await repositorios.arquivo_versao.criar({ arquivo_id: id, versao: numero, url: link, drive_file_id: driveId, nota: nulo(conferido.data.nota) });
    return repositorios.arquivo.atualizar(id, { versao_atual: numero, url_atual: link, drive_file_id: driveId });
  });
}

/** RN-08.05: o mesmo arquivo em vários registros, sem duplicar o arquivo nem o vínculo. */
export async function vincularArquivo(arquivoId: string, registroTipo: string, registroId: string): Promise<ArquivoVinculo> {
  const existentes = await repositorios.arquivo_vinculo.listar({ onde: { arquivo_id: arquivoId, registro_tipo: registroTipo, registro_id: registroId } });
  if (existentes.length) throw new ErroDeRegra('Esse arquivo já está vinculado a esse registro.');
  return repositorios.arquivo_vinculo.criar({ arquivo_id: arquivoId, registro_tipo: registroTipo, registro_id: registroId });
}

export async function desvincularArquivo(vinculoId: string): Promise<void> {
  await repositorios.arquivo_vinculo.arquivar(vinculoId);
}

/** Os arquivos ligados a um registro de outro módulo (aba Arquivos de fichas, peças e campanhas). */
export async function arquivosDoRegistro(registroTipo: string, registroId: string): Promise<{ vinculo: ArquivoVinculo; arquivo: Arquivo }[]> {
  const [vinculos, arquivos] = await Promise.all([repositorios.arquivo_vinculo.listar({ onde: { registro_tipo: registroTipo, registro_id: registroId } }), repositorios.arquivo.listar({ incluirArquivados: true })]);
  return vinculos.flatMap((vinculo) => {
    const arquivo = arquivos.find((item) => item.id === vinculo.arquivo_id);
    return arquivo && podeVerClasse(arquivo.classe) ? [{ vinculo, arquivo }] : [];
  });
}

/** Deixa o registro ligado exatamente a estes arquivos (peça de conteúdo, campanha). */
export async function definirArquivosDoRegistro(registroTipo: string, registroId: string, arquivoIds: readonly string[]): Promise<void> {
  const desejados = [...new Set(arquivoIds)];
  await emTransacao(async () => {
    const atuais = await repositorios.arquivo_vinculo.listar({ onde: { registro_tipo: registroTipo, registro_id: registroId } });
    for (const atual of atuais) if (!desejados.includes(atual.arquivo_id)) await repositorios.arquivo_vinculo.arquivar(atual.id);
    for (const arquivoId of desejados) if (!atuais.some((atual) => atual.arquivo_id === arquivoId)) await repositorios.arquivo_vinculo.criar({ arquivo_id: arquivoId, registro_tipo: registroTipo, registro_id: registroId });
  });
}

export async function arquivarArquivo(id: string): Promise<void> {
  await repositorios.arquivo.arquivar(id);
  await sincronizarAlertasDosArquivos([id]);
}

/** Restaurar não pode criar duplicidade: outro item pode ter recebido o mesmo link nesse meio-tempo. */
export async function restaurarArquivo(id: string): Promise<void> {
  const { arquivos, versoes } = await lerExistentes();
  const arquivo = arquivos.find((item) => item.id === id);
  const outro = arquivo?.drive_file_id ? acharDuplicado(arquivo.drive_file_id, arquivos.filter((item) => item.id !== id), versoes.filter((versao) => versao.arquivo_id !== id)) : null;
  if (outro) throw new ErroDeRegra(`${mensagemDoDuplicado(outro)} Não dá para restaurar este item sem duplicar o arquivo.`);
  await repositorios.arquivo.restaurar(id);
  await sincronizarAlertasDosArquivos([id]);
}

// ---------- Cadastro em lote (T08.03) ----------

export type LinhaDoLote = { numero: number; link: string; titulo: string; driveId: string | null; problema: string | null; duplicado: Duplicado | null };

/** Um link por linha; um título depois de tabulação, ";" ou " | " já vem preenchido na prévia. */
export function lerLote(texto: string, existentes: Existentes): LinhaDoLote[] {
  const vistos = new Map<string, number>();
  return texto
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter(Boolean)
    .map((linha, indice) => {
      const [link = '', ...resto] = linha.split(/\t|;| \| /);
      const titulo = resto.join(' ').trim();
      const driveId = idDoDrive(link);
      const numero = indice + 1;
      const duplicado = acharDuplicado(driveId, existentes.arquivos, existentes.versoes);
      let problema = problemaDoLink(link);
      if (!problema && duplicado) problema = mensagemDoDuplicado(duplicado);
      if (!problema && driveId && vistos.has(driveId)) problema = `Repete o link da linha ${vistos.get(driveId)}.`;
      if (driveId && !vistos.has(driveId)) vistos.set(driveId, numero);
      return { numero, link: link.trim(), titulo, driveId, problema, duplicado };
    });
}

export const LIMITE_DO_LOTE = 50;

export type ComunsDoLote = Pick<FormularioArquivo, 'tipo' | 'contextos' | 'classe' | 'pasta_restrita_confirmada' | 'responsavel_id' | 'etiquetas'>;

/** Prévia confirmada: cria só as linhas sem problema, todas com título, numa transação. */
export async function criarLote(linhas: readonly Pick<LinhaDoLote, 'link' | 'titulo' | 'problema'>[], comuns: ComunsDoLote): Promise<number> {
  const validas = linhas.filter((linha) => !linha.problema);
  if (!validas.length) throw new ErroDeRegra('Nenhuma linha pode ser criada. Confira os links.');
  if (validas.length > LIMITE_DO_LOTE) throw new ErroDeRegra(`Até ${LIMITE_DO_LOTE} links por vez.`);
  if (validas.some((linha) => !linha.titulo.trim())) throw new ErroDeRegra('Dê um título a cada link que será criado.');
  const base = formularioArquivoVazio(comuns.responsavel_id, ID_CONSOLIDADA, comuns.tipo);
  const formularios = validas.map((linha) => ({ ...base, ...comuns, link: linha.link, titulo: linha.titulo }));
  for (const formulario of formularios) {
    const conferido = esquemaFormularioArquivo.safeParse(formulario);
    if (!conferido.success) throw new ErroDeRegra(conferido.error.issues[0]?.message ?? 'Confira os dados comuns.');
  }
  const criados = await emTransacao(async () => {
    const ids: string[] = [];
    for (const formulario of formularios) ids.push((await criarArquivoSemAlertas(formulario)).id);
    return ids;
  });
  await sincronizarAlertasDosArquivos(criados);
  return criados.length;
}

async function criarArquivoSemAlertas(formulario: FormularioArquivo): Promise<Arquivo> {
  const driveId = idDoDrive(formulario.link);
  const { arquivos, versoes } = await lerExistentes();
  const duplicado = acharDuplicado(driveId, arquivos, versoes);
  if (duplicado) throw new ErroDeRegra(mensagemDoDuplicado(duplicado));
  const arquivo = await repositorios.arquivo.criar({ ...dadosDoArquivo(formulario), versao_atual: 1, url_atual: formulario.link.trim(), drive_file_id: driveId });
  await repositorios.arquivo_versao.criar({ arquivo_id: arquivo.id, versao: 1, url: arquivo.url_atual, drive_file_id: driveId, nota: null });
  await definirContextos(arquivo.id, formulario.contextos);
  if (formulario.etiquetas.length) await definirEtiquetasDoRegistro('arquivo', arquivo.id, formulario.etiquetas);
  return arquivo;
}

// ---------- Carga ----------

export type DadosDaBiblioteca = {
  arquivos: Arquivo[];
  contextos: ArquivoContexto[];
  versoes: ArquivoVersao[];
  vinculos: ArquivoVinculo[];
  etiquetas: Etiqueta[];
  etiquetasDosArquivos: Map<string, string[]>;
  pessoas: Pessoa[];
  produtos: Produto[];
  marcas: Marca[];
};

export async function carregarBiblioteca(): Promise<DadosDaBiblioteca> {
  const [arquivos, contextos, versoes, vinculos, etiquetas, etiquetaVinculos, pessoas, produtos, marcas] = await Promise.all([
    repositorios.arquivo.listar({ incluirArquivados: true }),
    repositorios.arquivo_contexto.listar(),
    repositorios.arquivo_versao.listar({ incluirArquivados: true }),
    repositorios.arquivo_vinculo.listar(),
    repositorios.etiqueta.listar({ incluirArquivados: true }),
    repositorios.etiqueta_vinculo.listar({ onde: { registro_tipo: 'arquivo' } as Partial<EtiquetaVinculo> }),
    repositorios.pessoa.listar({ incluirArquivados: true }),
    repositorios.produto.listar({ incluirArquivados: true }),
    repositorios.marca.listar({ incluirArquivados: true }),
  ]);
  return { arquivos: arquivos.filter((arquivo) => podeVerClasse(arquivo.classe)), contextos, versoes, vinculos, etiquetas, etiquetasDosArquivos: etiquetasPorRegistro(etiquetaVinculos, 'arquivo'), pessoas, produtos, marcas };
}

/** Numa e os produtos do arquivo, na ordem do cadastro. */
export function contextosDoArquivo(arquivoId: string, contextos: readonly ArquivoContexto[]): string[] {
  return contextos.filter((item) => item.arquivo_id === arquivoId && !item.arquivado_em).map((item) => item.produto_id ?? ID_INSTITUCIONAL);
}

// ---------- Lista e grade (T08.01, T08.08) ----------

export type FiltrosBiblioteca = {
  busca: string;
  colecao: IdDaColecao;
  tipo: string;
  contexto: string;
  classe: string;
  etiqueta: string;
  responsavel: string;
  atualizadoDe: string;
  atualizadoAte: string;
  direitos: '' | 'a_vencer' | 'expirados';
  vinculadoA: string;
  finalidade: string;
  arquivados: boolean;
};

export const FILTROS_BIBLIOTECA_INICIAIS: FiltrosBiblioteca = { busca: '', colecao: 'todos', tipo: '', contexto: '', classe: '', etiqueta: '', responsavel: '', atualizadoDe: '', atualizadoAte: '', direitos: '', vinculadoA: '', finalidade: '', arquivados: false };

type OpcoesDoFiltro = { contextoGlobalId: string; hoje: string; dados: Pick<DadosDaBiblioteca, 'contextos' | 'vinculos' | 'etiquetas' | 'etiquetasDosArquivos'>; /** T08.08: só um tipo. */ tipoFixo?: TipoDeArquivo };

function passaNaColecao(arquivo: Arquivo, colecao: IdDaColecao, contextos: readonly string[]): boolean {
  if (colecao === 'numa') return contextos.includes(ID_INSTITUCIONAL);
  if (colecao === 'produtos') return contextos.some((id) => id !== ID_INSTITUCIONAL);
  if (colecao === 'apresentacoes') return arquivo.tipo === 'apresentacao';
  if (colecao === 'marca') return TIPOS_DE_MARCA.includes(arquivo.tipo);
  return true;
}

function passaNosFiltros(arquivo: Arquivo, filtros: FiltrosBiblioteca, { contextoGlobalId, hoje, dados, tipoFixo }: OpcoesDoFiltro): boolean {
  if (Boolean(arquivo.arquivado_em) !== filtros.arquivados) return false;
  if (tipoFixo && arquivo.tipo !== tipoFixo) return false;
  const contextos = contextosDoArquivo(arquivo.id, dados.contextos);
  const contexto = filtros.contexto || (contextoGlobalId === ID_CONSOLIDADA ? '' : contextoGlobalId);
  if (contexto && !contextos.includes(contexto)) return false;
  const etiquetas = dados.etiquetasDosArquivos.get(arquivo.id) ?? [];
  const texto = normalizarTexto(filtros.busca);
  if (texto) {
    const nomes = dados.etiquetas.filter((etiqueta) => etiquetas.includes(etiqueta.id)).map((etiqueta) => etiqueta.nome);
    const alvo = normalizarTexto([arquivo.codigo, arquivo.titulo, arquivo.descricao ?? '', arquivo.publico ?? '', ...nomes].join(' '));
    if (!texto.split(/\s+/).every((palavra) => alvo.includes(palavra))) return false;
  }
  if (filtros.tipo && arquivo.tipo !== filtros.tipo) return false;
  if (filtros.classe && arquivo.classe !== filtros.classe) return false;
  if (filtros.etiqueta && !etiquetas.includes(filtros.etiqueta)) return false;
  if (filtros.responsavel && arquivo.responsavel_id !== filtros.responsavel) return false;
  const atualizado = arquivo.atualizado_em.slice(0, 10);
  if (filtros.atualizadoDe && atualizado < filtros.atualizadoDe) return false;
  if (filtros.atualizadoAte && atualizado > filtros.atualizadoAte) return false;
  if (filtros.direitos && situacaoDosDireitos(arquivo, hoje).estado !== filtros.direitos) return false;
  if (filtros.vinculadoA && !dados.vinculos.some((vinculo) => vinculo.arquivo_id === arquivo.id && !vinculo.arquivado_em && vinculo.registro_tipo === filtros.vinculadoA)) return false;
  if (filtros.finalidade && arquivo.finalidade !== filtros.finalidade) return false;
  return true;
}

/** Mais recente primeiro: é o que se procura com mais frequência. A coleção vale igual na grade e na lista. */
export function filtrarArquivos(arquivos: readonly Arquivo[], filtros: FiltrosBiblioteca, opcoes: OpcoesDoFiltro): Arquivo[] {
  return arquivos
    .filter((arquivo) => {
      const contextos = contextosDoArquivo(arquivo.id, opcoes.dados.contextos);
      return passaNaColecao(arquivo, filtros.colecao, contextos) && passaNosFiltros(arquivo, filtros, opcoes);
    })
    .sort((a, b) => b.atualizado_em.localeCompare(a.atualizado_em) || a.titulo.localeCompare(b.titulo, 'pt-BR'));
}

export function contadoresDasColecoes(arquivos: readonly Arquivo[], filtros: FiltrosBiblioteca, opcoes: OpcoesDoFiltro): Record<IdDaColecao, number> {
  const passam = arquivos.filter((arquivo) => passaNosFiltros(arquivo, filtros, opcoes));
  return Object.fromEntries(COLECOES.map(({ id }) => [id, passam.filter((arquivo) => passaNaColecao(arquivo, id, contextosDoArquivo(arquivo.id, opcoes.dados.contextos))).length])) as Record<IdDaColecao, number>;
}

/** Os filtros que ficam em "Mais filtros" (T08.01). */
export function quantosMaisFiltros(filtros: FiltrosBiblioteca): number {
  return [filtros.etiqueta, filtros.responsavel, filtros.atualizadoDe, filtros.atualizadoAte, filtros.direitos, filtros.vinculadoA, filtros.finalidade].filter(Boolean).length;
}

export const quantosVinculos = (arquivoId: string, vinculos: readonly ArquivoVinculo[]) => vinculos.filter((vinculo) => vinculo.arquivo_id === arquivoId && !vinculo.arquivado_em).length;
