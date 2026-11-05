import { z } from 'zod';

export const controleSchema = z.object({ id: z.uuid(), criado_em: z.iso.datetime(), criado_por: z.uuid().nullable(), atualizado_em: z.iso.datetime(), atualizado_por: z.uuid().nullable(), arquivado_em: z.iso.datetime().nullable(), arquivado_por: z.uuid().nullable(), versao_registro: z.number().int().positive(), exemplo: z.boolean() });
export const pessoaSchema = controleSchema.extend({ nome_completo: z.string().min(1), nome_exibicao: z.string(), tipo: z.enum(['interna', 'externa']), eh_socia: z.boolean(), funcao: z.string(), situacao: z.enum(['ativa', 'inativa']) });
export const produtoSchema = controleSchema.extend({ nome: z.string().min(1), codigo_curto: z.string(), cor: z.enum(['urb', 'kipi', 'zupi', 'zarpa', 'mimo']), provisorio: z.boolean(), situacao: z.enum(['ativo', 'pausado', 'descontinuado']) });
const dias = z.number({ error: 'Informe um número de dias.' }).int('Use dias inteiros.').min(0, 'Use zero ou mais dias.').max(365, 'Use até 365 dias.');
export const configuracoesSchema = z.object({
  organizacao_nome: z.string().trim().min(1, 'Informe o nome da organização.').max(100, 'Use até 100 caracteres.'),
  organizacao_email: z.union([z.literal(''), z.email('Informe um e-mail válido.')]),
  organizacao_logo_url: z.string().refine((value) => { if (!value) return true; try { const url = new URL(value); return url.protocol === 'https:' && ['drive.google.com', 'docs.google.com'].includes(url.hostname); } catch { return false; } }, 'Use um link HTTPS do Google Drive ou Google Docs.'),
  fuso: z.string().min(1).refine((value) => { try { new Intl.DateTimeFormat('pt-BR', { timeZone: value }).format(); return true; } catch { return false; } }, 'Escolha um fuso válido.'),
  moeda_padrao: z.enum(['BRL', 'USD', 'EUR']), uf_padrao: z.string().regex(/^[A-Z]{2}$/, 'Escolha uma UF.'), municipio_padrao: z.string().trim().max(100), fase_ativa: z.enum(['f0a', 'f0b', 'f1', 'f2', 'f3']),
  alerta_vencimento_dias: dias, alerta_renovacao_ferramenta_dias: dias, alerta_fim_teste_dias: dias, alerta_dominio_dias: dias,
  comprovante_obrigatorio: z.literal(true), responsavel_backup_id: z.uuid('Escolha a responsável pelo backup.'),
});
export const cambioSchema = controleSchema.extend({ moeda: z.enum(['USD', 'EUR']), valor_brl: z.number().positive('Informe um câmbio maior que zero.').max(100000).refine((v) => Math.abs(v * 1e6 - Math.round(v * 1e6)) < 0.0001, 'Use até 6 casas decimais.'), data_referencia: z.iso.date('Informe uma data válida.'), fonte: z.string().trim().min(1, 'Informe a fonte do câmbio.').max(200) });
export const configuracaoSchema = controleSchema.extend({ chave: z.enum(Object.keys(configuracoesSchema.shape) as [string, ...string[]]), valor: z.union([z.string(), z.number(), z.boolean()]), descricao: z.string() });
export const auditoriaSchema = z.object({ id: z.uuid(), ocorrido_em: z.iso.datetime(), usuario_id: z.uuid().nullable(), autor_nome: z.string(), acao: z.enum(['inseriu', 'alterou', 'arquivou', 'restaurou', 'exportou', 'executou_acao']), tabela: z.string(), registro_id: z.string(), resumo: z.string(), antes: z.unknown().nullable(), depois: z.unknown().nullable(), motivo: z.string().nullable() });
export const metaSchema = z.object({ versao: z.literal(1), pessoa_atual: z.uuid().nullable(), contexto: z.string(), sidebar_recolhida: z.boolean(), ultima_abertura: z.string().nullable(), ultima_rotina: z.string().nullable(), ultimo_backup: z.iso.datetime().nullable(), ultimo_backup_por: z.string().nullable(), contadores: z.record(z.string(), z.number().int().nonnegative()) });
export type Pessoa = z.infer<typeof pessoaSchema>;
export type Produto = z.infer<typeof produtoSchema>;
export type Configuracoes = z.infer<typeof configuracoesSchema>;
export type Configuracao = z.infer<typeof configuracaoSchema>;
export type Cambio = z.infer<typeof cambioSchema>;
export type Auditoria = z.infer<typeof auditoriaSchema>;
export type Meta = z.infer<typeof metaSchema>;
export type Controle = z.infer<typeof controleSchema>;
export interface Colecoes { pessoa: Pessoa; produto: Produto; configuracao: Configuracao; cambio_referencia: Cambio; auditoria: Auditoria }
export type Tabela = keyof Colecoes;
export type Dados = { [K in Tabela]: Colecoes[K][] };
export interface Estado { dados: Dados; meta: Meta }
export const dadosSchema = z.object({ pessoa: z.array(pessoaSchema), produto: z.array(produtoSchema), configuracao: z.array(configuracaoSchema), cambio_referencia: z.array(cambioSchema), auditoria: z.array(auditoriaSchema) }).strict();
export const backupSchema = z.object({ sistema: z.literal('central-numa'), versao: z.literal(1), exportado_em: z.iso.datetime(), dados: dadosSchema, meta: metaSchema }).strict();
export type Backup = z.infer<typeof backupSchema>;
