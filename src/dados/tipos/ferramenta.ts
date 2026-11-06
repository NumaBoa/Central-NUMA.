import { z } from 'zod';
import { esquemaControle } from './controle';

const texto = z.string().nullable();
const dia = z.iso.date().nullable();
const inteiro = z.number().int().nonnegative().nullable();
const dinheiro = z.number().nonnegative().nullable();

/** `categoria_ferramenta` (16 §4.4): configurável, com a sugestão de crítica e a categoria financeira. */
export const esquemaCategoriaFerramenta = esquemaControle.extend({
  nome: z.string().trim().min(1),
  critica_sugerida: z.boolean(),
  categoria_financeira_id: texto,
});

export type CategoriaFerramenta = z.infer<typeof esquemaCategoriaFerramenta>;

export const SITUACOES_FERRAMENTA = ['avaliacao', 'teste', 'teste_expirado', 'ativa', 'cancelada'] as const;
export const TIPOS_DE_DADOS = ['identificacao', 'contato', 'localizacao', 'financeiro', 'saude', 'terceiros', 'uso', 'outros'] as const;

/** `ferramenta` (16 §4.4). As regras que olham só para a própria linha ficam aqui, para valerem também em um arquivo importado. */
export const esquemaFerramenta = esquemaControle
  .extend({
    codigo: z.string().min(1),
    nome: z.string().trim().min(1),
    categoria_id: z.string().min(1),
    fornecedor_id: texto,
    finalidade: z.string().trim().min(1),
    critica: z.boolean(),
    situacao: z.enum(SITUACOES_FERRAMENTA),
    url_acesso: texto,
    url_admin: texto,
    email_login_conta: texto,
    ambiente: texto,
    titular_atual_tipo: z.enum(['numa', 'pessoa_fisica', 'terceiro']),
    titular_atual_pessoa_id: texto,
    titular_atual_texto: texto,
    titular_desejado: z.string().trim().min(1),
    referencia_cofre: texto,
    mfa_conta: z.enum(['sim', 'nao', 'desconhecido']),
    responsavel_tecnico_id: z.string().min(1),
    responsavel_financeiro_id: texto,
    caminho_recuperacao: texto,
    recuperacao_verificada_em: dia,
    trata_dados_pessoais: z.boolean(),
    tipos_dados: z.array(z.enum(TIPOS_DE_DADOS)),
    regiao_dados: texto,
    acordo_dados_situacao: z.enum(['nao_avaliado', 'termos_padrao', 'dpa_assinado', 'nao_aplicavel']).nullable(),
    acordo_dados_url: texto,
    dados_revisado_em: dia,
    cancelada_em: dia,
    cancelamento_motivo: texto,
    observacoes: texto,
  })
  .superRefine((ferramenta, contexto) => {
    const falha = (campo: string, message: string) => contexto.addIssue({ code: 'custom', path: [campo], message });
    if (ferramenta.titular_atual_tipo === 'pessoa_fisica' && !ferramenta.titular_atual_pessoa_id) falha('titular_atual_pessoa_id', 'Diga de quem é a conta.');
    if (ferramenta.titular_atual_tipo === 'terceiro' && !ferramenta.titular_atual_texto) falha('titular_atual_texto', 'Diga de quem é a conta.');
    if (ferramenta.situacao === 'cancelada' && (!ferramenta.cancelada_em || !ferramenta.cancelamento_motivo)) falha('cancelamento_motivo', 'Cancelar exige data e motivo.');
  });

export type Ferramenta = z.infer<typeof esquemaFerramenta>;

/** `ferramenta_contexto` (16 §4.4). Sem produto, é a Numa. Percentuais: soma 100 ou todos vazios. */
export const esquemaFerramentaContexto = esquemaControle.extend({
  ferramenta_id: z.string().min(1),
  produto_id: texto,
  percentual_rateio: z.number().min(0).max(100).nullable(),
  vigente_desde: z.iso.date(),
});

export type FerramentaContexto = z.infer<typeof esquemaFerramentaContexto>;

export const PERIODICIDADES = ['mensal', 'trimestral', 'semestral', 'anual', 'unica', 'por_uso'] as const;

/** `assinatura_ferramenta` (16 §4.4). Único parcial: uma ativa por ferramenta. */
export const esquemaAssinaturaFerramenta = esquemaControle
  .extend({
    ferramenta_id: z.string().min(1),
    plano: texto,
    modalidade: z.enum(['gratuita', 'paga', 'teste']),
    valor: dinheiro,
    moeda: z.string().regex(/^[A-Z]{3}$/),
    periodicidade: z.enum(PERIODICIDADES).nullable(),
    dia_cobranca: inteiro,
    proxima_cobranca: dia,
    renovacao: z.enum(['automatica', 'manual']).nullable(),
    aviso_cancelamento_dias: inteiro,
    fim_teste: dia,
    valor_apos_teste: dinheiro,
    conta_financeira_id: texto,
    categoria_financeira_id: texto,
    gerar_titulos: z.boolean(),
    licencas: inteiro,
    data_contratacao: dia,
    inicio: z.iso.date(),
    fim: dia,
    situacao: z.enum(['ativa', 'encerrada']),
  })
  .superRefine((assinatura, contexto) => {
    if (assinatura.modalidade === 'teste' && !assinatura.fim_teste) contexto.addIssue({ code: 'custom', path: ['fim_teste'], message: 'Teste exige a data de fim (RN-04.09).' });
  });

export type AssinaturaFerramenta = z.infer<typeof esquemaAssinaturaFerramenta>;

/** `assinatura_valor_historico` (16 §4.4): RN-04.17. */
export const esquemaAssinaturaValorHistorico = esquemaControle.extend({
  assinatura_id: z.string().min(1),
  valor_anterior: dinheiro,
  valor_novo: z.number().nonnegative(),
  moeda: z.string().regex(/^[A-Z]{3}$/),
  efeito_em: z.iso.date(),
  motivo: z.string().trim().min(1),
});

export type AssinaturaValorHistorico = z.infer<typeof esquemaAssinaturaValorHistorico>;
