import { z } from 'zod';
import { esquemaControle } from './controle';

/** Endereço estruturado (16 §4.2), usado em contrapartes e entidades. */
export const esquemaEndereco = z.object({
  cep: z.string().nullable(),
  logradouro: z.string().nullable(),
  numero: z.string().nullable(),
  complemento: z.string().nullable(),
  bairro: z.string().nullable(),
  cidade: z.string().nullable(),
  uf: z.string().nullable(),
});

export type Endereco = z.infer<typeof esquemaEndereco>;

/** `contraparte` (16 §4.2). `classe` fica guardada com o valor padrão, sem aparecer na tela (03 §0). */
export const esquemaContraparte = esquemaControle.extend({
  tipo_pessoa: z.enum(['pf', 'pj', 'estrangeira']),
  nome: z.string().trim().min(1),
  nome_fantasia: z.string().nullable(),
  documento: z.string().nullable(),
  documento_normalizado: z.string().nullable(),
  papeis: z.array(z.enum(['prospect', 'cliente', 'fornecedor', 'parceiro', 'institucional'])).min(1),
  site: z.string().nullable(),
  email: z.string().nullable(),
  telefone: z.string().nullable(),
  endereco: esquemaEndereco.nullable(),
  pais: z.string().length(2),
  origem: z.enum(['indicacao', 'rede_social', 'site', 'evento', 'busca_ativa', 'lista_espera', 'outro']).nullable(),
  responsavel_id: z.uuid(),
  classe: z.enum(['pub', 'int', 'fin', 'doc']),
  observacoes: z.string().nullable(),
  situacao: z.enum(['ativa', 'inativa']),
});

export type Contraparte = z.infer<typeof esquemaContraparte>;

/** `entidade` (16 §4.2): quem assina pela Numa. Ativa exige documento, endereço e data de abertura. */
export const esquemaEntidade = esquemaControle
  .extend({
    tipo_pessoa: z.enum(['pf', 'pj', 'socias_pf']),
    nome: z.string().trim().min(1),
    nome_fantasia: z.string().nullable(),
    documento: z.string().nullable(),
    situacao: z.enum(['planejada', 'em_constituicao', 'ativa', 'encerrada']),
    natureza_juridica: z.string().nullable(),
    regime_tributario: z.string().nullable(),
    inscricao_municipal: z.string().nullable(),
    inscricao_estadual: z.string().nullable(),
    endereco: esquemaEndereco.nullable(),
    data_abertura: z.iso.date().nullable(),
    entidade_padrao: z.boolean(),
    contador_id: z.uuid().nullable(),
  })
  .superRefine((entidade, contexto) => {
    // "Sócias pessoas físicas" pode ser Ativa sem CNPJ: o que ela exige está em `entidade_licenciante` (D-CTR-06).
    if (entidade.situacao === 'ativa' && entidade.tipo_pessoa !== 'socias_pf' && (!entidade.documento || !entidade.endereco || !entidade.data_abertura)) {
      contexto.addIssue({ code: 'custom', path: ['situacao'], message: 'Entidade ativa exige documento, endereço e data de abertura.' });
    }
  });

export type Entidade = z.infer<typeof esquemaEntidade>;

/** `entidade_representante` (16 §4.2): os representantes legais. */
export const esquemaEntidadeRepresentante = esquemaControle.extend({
  entidade_id: z.uuid(),
  pessoa_id: z.uuid(),
});

export type EntidadeRepresentante = z.infer<typeof esquemaEntidadeRepresentante>;
