import { z } from 'zod';
import { esquemaControle } from './controle';

/*
 * M08 — Biblioteca, marcas e marketing (16 §4.8 e 10-M08). Os nomes de campos seguem o 16; o que
 * foi acrescentado está marcado e registrado em `frente-m08/INTEGRACAO.md`.
 */

const texto = z.string().nullable();
const dia = z.iso.date().nullable();
const inteiro = z.number().int().nonnegative().nullable();

export const CLASSES_DE_INFORMACAO = ['pub', 'int', 'fin', 'doc'] as const;
export type ClasseDeInformacao = (typeof CLASSES_DE_INFORMACAO)[number];

/** `arquivo_tipo` (16 §3). */
export const TIPOS_DE_ARQUIVO = ['logo', 'imagem', 'icone', 'identidade', 'apresentacao', 'modelo_proposta', 'modelo_documento', 'documento_institucional', 'contrato', 'video', 'print', 'outro'] as const;
export type TipoDeArquivo = (typeof TIPOS_DE_ARQUIVO)[number];

/** T08.08. */
export const FINALIDADES_DE_APRESENTACAO = ['institucional', 'comercial', 'produto', 'investidores', 'evento'] as const;

/**
 * `arquivo` (ARQ): link do Drive e metadados; a Central não guarda o arquivo (RN-08.01). As regras da
 * própria linha valem também num backup importado. `data_uso` é de T08.08 e não está no 16.
 */
export const esquemaArquivo = esquemaControle
  .extend({
    codigo: z.string().min(1),
    titulo: z.string().trim().min(1),
    tipo: z.enum(TIPOS_DE_ARQUIVO),
    descricao: texto,
    classe: z.enum(CLASSES_DE_INFORMACAO),
    pasta_restrita_confirmada: z.boolean(),
    versao_atual: z.number().int().positive(),
    url_atual: z.string().min(1),
    drive_file_id: texto,
    origem_autor: texto,
    direitos_uso: texto,
    direitos_validade: dia,
    responsavel_id: z.string().min(1),
    finalidade: z.enum(FINALIDADES_DE_APRESENTACAO).nullable(),
    publico: texto,
    data_uso: dia,
    contem_precos: z.boolean().nullable(),
    precos_data: dia,
    contem_fin: z.boolean(),
  })
  .superRefine((arquivo, contexto) => {
    const falha = (campo: string, message: string) => contexto.addIssue({ code: 'custom', path: [campo], message });
    // RN-08.03.
    if ((arquivo.classe === 'fin' || arquivo.classe === 'doc') && !arquivo.pasta_restrita_confirmada) falha('pasta_restrita_confirmada', 'Confirme que a pasta no Drive está restrita.');
    // T08.08: contém dados FIN bloqueia a classe PUB.
    if (arquivo.contem_fin && arquivo.classe === 'pub') falha('classe', 'Material com dados financeiros não pode ser PUB.');
    if (arquivo.contem_precos && !arquivo.precos_data) falha('precos_data', 'Informe a data dos preços.');
  });

export type Arquivo = z.infer<typeof esquemaArquivo>;

/** `arquivo_contexto`: sem produto, é a Numa institucional. */
export const esquemaArquivoContexto = esquemaControle.extend({ arquivo_id: z.string().min(1), produto_id: texto });
export type ArquivoContexto = z.infer<typeof esquemaArquivoContexto>;

/** `arquivo_versao`: autor e data são os do controle da linha (RN-08.04). */
export const esquemaArquivoVersao = esquemaControle.extend({
  arquivo_id: z.string().min(1),
  versao: z.number().int().positive(),
  url: z.string().min(1),
  drive_file_id: texto,
  nota: texto,
});
export type ArquivoVersao = z.infer<typeof esquemaArquivoVersao>;

/** `arquivo_vinculo`: o mesmo arquivo em vários registros, sem duplicar (RN-08.05). */
export const esquemaArquivoVinculo = esquemaControle.extend({ arquivo_id: z.string().min(1), registro_tipo: z.string().min(1), registro_id: z.string().min(1) });
export type ArquivoVinculo = z.infer<typeof esquemaArquivoVinculo>;

const esquemaCor = z.object({ nome: z.string().trim().min(1), hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/), uso: texto });
export type CorDaPaleta = z.infer<typeof esquemaCor>;

const esquemaFonte = z.object({ fonte: z.string().trim().min(1), pesos: texto, uso: texto });
export type FonteDaMarca = z.infer<typeof esquemaFonte>;

/** `marca_identidade`: uma por marca. No 16 a chave é `marca_id`; aqui ela é única pela regra. */
export const esquemaMarcaIdentidade = esquemaControle.extend({
  marca_id: z.string().min(1),
  proposta: texto,
  publico: texto,
  personalidade: texto,
  tom_faca: z.array(z.string()),
  tom_nao_faca: z.array(z.string()),
  frases: z.array(z.string()),
  paleta: z.array(esquemaCor),
  tipografia: z.array(esquemaFonte),
  manual_url: texto,
});
export type MarcaIdentidade = z.infer<typeof esquemaMarcaIdentidade>;

// ---------- Campanhas, conteúdo e listas (F1) ----------

export const SITUACOES_DE_CAMPANHA = ['planejada', 'em_andamento', 'encerrada', 'cancelada'] as const;

/** Resultados básicos, informados à mão (RN-08.11). Vazio é "não informado", nunca zero. */
const esquemaResultadosCampanha = z.object({
  inscritos: inteiro,
  contatos: inteiro,
  oportunidades: inteiro,
  vendas: inteiro,
  medido_em: dia,
  observacao: texto,
});
export type ResultadosCampanha = z.infer<typeof esquemaResultadosCampanha>;

/** `campanha` (CAM). Sem produto, é da Numa. Orçamento vazio é "não definido" (RT-08). */
export const esquemaCampanha = esquemaControle
  .extend({
    codigo: z.string().min(1),
    nome: z.string().trim().min(1),
    produto_id: texto,
    objetivo: texto,
    publico: texto,
    canais: z.array(z.string()),
    inicio: dia,
    fim: dia,
    orcamento: z.number().nonnegative().nullable(),
    responsavel_id: z.string().min(1),
    situacao: z.enum(SITUACOES_DE_CAMPANHA),
    resultados: esquemaResultadosCampanha,
    cancelada_motivo: texto,
  })
  .superRefine((campanha, contexto) => {
    if (campanha.inicio && campanha.fim && campanha.fim < campanha.inicio) contexto.addIssue({ code: 'custom', path: ['fim'], message: 'O fim vem antes do início.' });
  });
export type Campanha = z.infer<typeof esquemaCampanha>;

export const CANAIS_DE_CONTEUDO = ['instagram', 'tiktok', 'linkedin', 'blog', 'email', 'loja', 'outro'] as const;
export const FORMATOS_DE_CONTEUDO = ['post', 'carrossel', 'video_curto', 'story', 'artigo', 'email'] as const;
export const SITUACOES_DE_PECA = ['ideia', 'producao', 'revisao', 'aprovado', 'publicado', 'cancelado'] as const;
export type SituacaoDaPeca = (typeof SITUACOES_DE_PECA)[number];

const esquemaResultadosPeca = z.object({ alcance: inteiro, interacoes: inteiro, cliques: inteiro, inscritos: inteiro });
export type ResultadosPeca = z.infer<typeof esquemaResultadosPeca>;

/**
 * `peca_conteudo` (PEC). O 16 pede `produto_id`; aqui ele pode ficar vazio para a Numa institucional,
 * como nos demais registros. Data prevista e data realizada (`publicado_em`) são campos distintos.
 */
export const esquemaPecaConteudo = esquemaControle
  .extend({
    codigo: z.string().min(1),
    titulo: z.string().trim().min(1),
    produto_id: texto,
    canal: z.enum(CANAIS_DE_CONTEUDO),
    formato: z.enum(FORMATOS_DE_CONTEUDO).nullable(),
    data_prevista: z.iso.date(),
    situacao: z.enum(SITUACOES_DE_PECA),
    responsavel_id: z.string().min(1),
    campanha_id: texto,
    texto: texto,
    link_publicacao: texto,
    publicado_em: dia,
    resultados: esquemaResultadosPeca,
    medido_em: dia,
    cancelado_motivo: texto,
  })
  .superRefine((peca, contexto) => {
    const falha = (campo: string, message: string) => contexto.addIssue({ code: 'custom', path: [campo], message });
    // RN-08.11.
    if (peca.situacao === 'publicado' && !peca.publicado_em) falha('publicado_em', 'Publicado precisa da data em que foi ao ar.');
    if (peca.situacao === 'publicado' && !peca.link_publicacao) falha('link_publicacao', 'Publicado precisa do link da publicação.');
    if (Object.values(peca.resultados).some((valor) => valor !== null) && !peca.medido_em) falha('medido_em', 'Informe a data da medição.');
  });
export type PecaConteudo = z.infer<typeof esquemaPecaConteudo>;

/** `lista_espera`: uma por produto e nome. */
export const esquemaListaEspera = esquemaControle.extend({ produto_id: z.string().min(1), nome: z.string().trim().min(1), situacao: z.enum(['ativa', 'encerrada']) });
export type ListaEspera = z.infer<typeof esquemaListaEspera>;

/** `consentimento_texto`: o texto aceito, versionado. Uma versão publicada não muda mais. */
export const esquemaConsentimentoTexto = esquemaControle.extend({ lista_id: z.string().min(1), versao: z.number().int().positive(), texto: z.string().trim().min(1), vigente_desde: z.iso.date() });
export type ConsentimentoTexto = z.infer<typeof esquemaConsentimentoTexto>;

export const SITUACOES_DE_INSCRITO = ['ativo', 'descadastrado', 'convidado', 'convertido'] as const;
export type SituacaoDoInscrito = (typeof SITUACOES_DE_INSCRITO)[number];
export const ORIGENS_DE_INSCRITO = ['site', 'rede_social', 'evento', 'indicacao', 'outro'] as const;

/**
 * `inscrito`. O 16 marca o consentimento como obrigatório. Aqui ele pode faltar na inclusão manual,
 * e quem não tem consentimento registrado não pode receber marketing (RN-08.09). A importação exige
 * as duas colunas (CA-08.03). Versão e data andam juntas. `convidado_em` e `convertido_em` não estão no 16.
 */
export const esquemaInscrito = esquemaControle
  .extend({
    lista_id: z.string().min(1),
    nome: texto,
    email: z.string().trim().min(3),
    email_normalizado: z.string().min(3),
    origem: z.enum(ORIGENS_DE_INSCRITO).nullable(),
    campanha_id: texto,
    consentimento_versao_id: texto,
    consentido_em: dia,
    situacao: z.enum(SITUACOES_DE_INSCRITO),
    descadastrado_em: dia,
    convidado_em: dia,
    convertido_em: dia,
  })
  .superRefine((inscrito, contexto) => {
    const falha = (campo: string, message: string) => contexto.addIssue({ code: 'custom', path: [campo], message });
    if (Boolean(inscrito.consentimento_versao_id) !== Boolean(inscrito.consentido_em)) falha('consentido_em', 'Consentimento precisa da versão do texto e da data, juntas.');
    if (inscrito.situacao === 'descadastrado' && !inscrito.descadastrado_em) falha('descadastrado_em', 'Descadastro precisa da data.');
  });
export type Inscrito = z.infer<typeof esquemaInscrito>;
