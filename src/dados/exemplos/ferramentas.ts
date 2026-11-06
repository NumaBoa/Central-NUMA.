import { hojeISO } from '@/lib/datas';
import { montarCodigo } from '@/lib/ids';
import type { AssinaturaFerramenta, CategoriaFerramenta, Ferramenta, FerramentaContexto } from '../tipos/ferramenta';
import { controle } from './controle';
import { CATEGORIAS_INICIAIS, ID_CAMILA, ID_CONTA_CAMILA, ID_CONTA_KIMBERLY, ID_KIMBERLY, ID_PRODUTO_KIPI, ID_PRODUTO_URBANA, ID_PRODUTO_ZUPI } from './base';

const idDaCategoriaFinanceira = (nome: string) => CATEGORIAS_INICIAIS.find((categoria) => categoria.nome === nome)?.id ?? null;
const idDaCategoria = (numero: number) => `a8e6c7d0-1b2c-4d3e-9f40-1a2b3c4d${String(numero).padStart(4, '0')}`;
const idDaFerramenta = (numero: number) => `b9f7d8e1-2c3d-4e4f-8a51-2b3c4d5e${String(numero).padStart(4, '0')}`;
const idDaLigacao = (numero: number) => `cae8e9f2-3d4e-4f50-9b62-3c4d5e6f${String(numero).padStart(4, '0')}`;

/** Categorias de T04.01: configuráveis, não são exemplo. `critica` sai das sugestões de T04.03. */
const CATEGORIAS = [
  { nome: 'Hospedagem e nuvem', critica: true, financeira: 'Hospedagem e nuvem' },
  { nome: 'Banco de dados', critica: true, financeira: 'Banco de dados' },
  { nome: 'Domínio e DNS', critica: true, financeira: 'Domínios' },
  { nome: 'E-mail e produtividade', critica: true, financeira: 'E-mail e produtividade' },
  { nome: 'Armazenamento (Drive)', critica: true, financeira: 'E-mail e produtividade' },
  { nome: 'Repositório e CI', critica: true, financeira: 'Desenvolvimento (repositório, CI)' },
  { nome: 'Lojas de aplicativos', critica: true, financeira: 'Lojas de aplicativos (contas de desenvolvedor)' },
  { nome: 'Design', critica: false, financeira: 'Design e criação' },
  { nome: 'IA', critica: false, financeira: 'IA' },
  { nome: 'Comunicação', critica: false, financeira: 'Outras assinaturas' },
  { nome: 'Redes sociais', critica: false, financeira: 'Outras assinaturas' },
  { nome: 'Analytics', critica: false, financeira: 'Outras assinaturas' },
  { nome: 'Pagamentos', critica: false, financeira: 'Outras assinaturas' },
  // Pode ser Contabilidade ou Jurídico: quem cadastra escolhe.
  { nome: 'Jurídico/contábil', critica: false, financeira: null },
  { nome: 'Outras', critica: false, financeira: 'Outras assinaturas' },
] as const;

export function categoriasDeFerramentaIniciais(agora: string): CategoriaFerramenta[] {
  return CATEGORIAS.map(({ nome, critica, financeira }, indice) => ({ ...controle(idDaCategoria(indice + 1), false, agora), nome, critica_sugerida: critica, categoria_financeira_id: financeira ? idDaCategoriaFinanceira(financeira) : null }));
}

const idDaCategoriaPorNome = (nome: (typeof CATEGORIAS)[number]['nome']) => idDaCategoria(CATEGORIAS.findIndex((categoria) => categoria.nome === nome) + 1);

function diasDepois(dia: string, dias: number): string {
  const data = new Date(`${dia}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

type ExemploDeFerramenta = Pick<Ferramenta, 'nome' | 'finalidade' | 'responsavel_tecnico_id'> &
  Partial<Ferramenta> & {
    categoria: (typeof CATEGORIAS)[number]['nome'];
    /** `null` é a Numa. */
    contextos: readonly { produto: string | null; percentual?: number }[];
    assinatura?: Partial<AssinaturaFerramenta> & Pick<AssinaturaFerramenta, 'modalidade'>;
  };

/** Ferramentas fictícias de `17 §6`: gratuitas, pagas em BRL e USD, uma em teste, críticas, uma paga sem valor. */
export function ferramentasDeExemplo(agora: string) {
  const hoje = hojeISO(new Date(agora));
  const dia = (dias: number) => diasDepois(hoje, dias);
  const paga = { modalidade: 'paga', moeda: 'BRL', periodicidade: 'mensal', renovacao: 'automatica', gerar_titulos: true } as const;

  const exemplos: readonly ExemploDeFerramenta[] = [
    {
      nome: 'Nuvem Clara Hosting',
      categoria: 'Hospedagem e nuvem',
      fornecedor_id: 'e6a4c5b8-bf73-4e54-8a45-4d5e6f7a8b03',
      finalidade: 'Hospedar os apps Kipi e Zupi',
      critica: true,
      situacao: 'ativa',
      responsavel_tecnico_id: ID_CAMILA,
      responsavel_financeiro_id: ID_KIMBERLY,
      titular_atual_tipo: 'pessoa_fisica',
      titular_atual_pessoa_id: ID_CAMILA,
      mfa_conta: 'sim',
      url_acesso: 'https://exemplo.com/nuvem-clara',
      ambiente: 'organização numa-studio',
      contextos: [
        { produto: ID_PRODUTO_KIPI, percentual: 60 },
        { produto: ID_PRODUTO_ZUPI, percentual: 40 },
      ],
      assinatura: { ...paga, plano: 'Pro', valor: 20, moeda: 'USD', proxima_cobranca: dia(12), dia_cobranca: Number(dia(12).slice(8, 10)), conta_financeira_id: ID_CONTA_CAMILA, categoria_financeira_id: idDaCategoriaFinanceira('Hospedagem e nuvem'), aviso_cancelamento_dias: 7 },
    },
    {
      nome: 'Estúdio Verde Registro',
      categoria: 'Domínio e DNS',
      fornecedor_id: 'e6a4c5b8-bf73-4e54-8a45-4d5e6f7a8b02',
      finalidade: 'Registrar os domínios das marcas',
      critica: true,
      situacao: 'ativa',
      responsavel_tecnico_id: ID_CAMILA,
      responsavel_financeiro_id: ID_KIMBERLY,
      titular_atual_tipo: 'pessoa_fisica',
      titular_atual_pessoa_id: ID_KIMBERLY,
      mfa_conta: 'nao',
      contextos: [{ produto: null }],
      assinatura: { ...paga, plano: 'Registro anual', valor: 120, periodicidade: 'anual', renovacao: 'manual', proxima_cobranca: dia(25), dia_cobranca: Number(dia(25).slice(8, 10)), conta_financeira_id: ID_CONTA_KIMBERLY, categoria_financeira_id: idDaCategoriaFinanceira('Domínios') },
    },
    {
      nome: 'Traço Editor',
      categoria: 'Design',
      finalidade: 'Peças de redes sociais e materiais das marcas',
      critica: false,
      situacao: 'ativa',
      responsavel_tecnico_id: ID_KIMBERLY,
      responsavel_financeiro_id: ID_KIMBERLY,
      titular_atual_tipo: 'pessoa_fisica',
      titular_atual_pessoa_id: ID_KIMBERLY,
      mfa_conta: 'desconhecido',
      contextos: [{ produto: null }],
      assinatura: { ...paga, plano: 'Equipe', valor: 89.9, proxima_cobranca: dia(4), dia_cobranca: Number(dia(4).slice(8, 10)), conta_financeira_id: ID_CONTA_KIMBERLY, categoria_financeira_id: idDaCategoriaFinanceira('Design e criação'), licencas: 2 },
    },
    {
      nome: 'Luma IA',
      categoria: 'IA',
      finalidade: 'Testar um assistente para textos de suporte',
      critica: false,
      situacao: 'teste',
      responsavel_tecnico_id: ID_CAMILA,
      responsavel_financeiro_id: ID_KIMBERLY,
      titular_atual_tipo: 'pessoa_fisica',
      titular_atual_pessoa_id: ID_CAMILA,
      mfa_conta: 'desconhecido',
      contextos: [{ produto: ID_PRODUTO_URBANA }],
      trata_dados_pessoais: true,
      tipos_dados: ['contato', 'uso'],
      regiao_dados: 'Estados Unidos',
      acordo_dados_situacao: 'nao_avaliado',
      assinatura: { modalidade: 'teste', plano: 'Teste de 14 dias', fim_teste: dia(5), valor_apos_teste: 15, moeda: 'USD', gerar_titulos: false },
    },
    {
      nome: 'Repositório Aberto',
      categoria: 'Repositório e CI',
      finalidade: 'Guardar o código dos apps',
      critica: true,
      situacao: 'ativa',
      responsavel_tecnico_id: ID_CAMILA,
      titular_atual_tipo: 'numa',
      mfa_conta: 'sim',
      contextos: [{ produto: null }, { produto: ID_PRODUTO_KIPI }],
      assinatura: { modalidade: 'gratuita', moeda: 'BRL', gerar_titulos: false },
    },
    {
      nome: 'Quadro Fácil',
      categoria: 'E-mail e produtividade',
      finalidade: 'Avaliar um quadro para a equipe de design',
      critica: false,
      situacao: 'avaliacao',
      responsavel_tecnico_id: ID_KIMBERLY,
      responsavel_financeiro_id: ID_KIMBERLY,
      titular_atual_tipo: 'pessoa_fisica',
      titular_atual_pessoa_id: ID_KIMBERLY,
      mfa_conta: 'desconhecido',
      contextos: [{ produto: null }],
      assinatura: { ...paga, plano: 'Equipe', valor: null, proxima_cobranca: dia(20), dia_cobranca: Number(dia(20).slice(8, 10)), renovacao: 'manual', conta_financeira_id: ID_CONTA_KIMBERLY, categoria_financeira_id: idDaCategoriaFinanceira('E-mail e produtividade'), gerar_titulos: false },
    },
  ];

  const ano = hoje.slice(0, 4);
  const ferramenta: Ferramenta[] = exemplos.map(({ categoria, contextos: _contextos, assinatura: _assinatura, ...dados }, indice) => ({
    ...controle(idDaFerramenta(indice + 1), true, agora),
    codigo: montarCodigo('FER', ano, indice + 1),
    categoria_id: idDaCategoriaPorNome(categoria),
    fornecedor_id: null,
    critica: false,
    situacao: 'ativa',
    url_acesso: null,
    url_admin: null,
    email_login_conta: null,
    ambiente: null,
    titular_atual_tipo: 'numa',
    titular_atual_pessoa_id: null,
    titular_atual_texto: null,
    titular_desejado: 'Numa',
    referencia_cofre: null,
    mfa_conta: 'desconhecido',
    responsavel_financeiro_id: null,
    caminho_recuperacao: null,
    recuperacao_verificada_em: null,
    trata_dados_pessoais: false,
    tipos_dados: [],
    regiao_dados: null,
    acordo_dados_situacao: null,
    acordo_dados_url: null,
    dados_revisado_em: null,
    cancelada_em: null,
    cancelamento_motivo: null,
    observacoes: null,
    ...dados,
  }));

  let ligacao = 0;
  const ferramenta_contexto: FerramentaContexto[] = exemplos.flatMap((exemplo, indice) => exemplo.contextos.map(({ produto, percentual }) => ({ ...controle(idDaLigacao(++ligacao), true, agora), ferramenta_id: idDaFerramenta(indice + 1), produto_id: produto, percentual_rateio: percentual ?? null, vigente_desde: hoje })));
  const assinatura_ferramenta: AssinaturaFerramenta[] = exemplos.flatMap((exemplo, indice) => {
    if (!exemplo.assinatura) return [];
    return [
      {
        ...controle(idDaLigacao(++ligacao), true, agora),
        ferramenta_id: idDaFerramenta(indice + 1),
        plano: null,
        valor: null,
        moeda: 'BRL',
        periodicidade: null,
        dia_cobranca: null,
        proxima_cobranca: null,
        renovacao: null,
        aviso_cancelamento_dias: null,
        fim_teste: null,
        valor_apos_teste: null,
        conta_financeira_id: null,
        categoria_financeira_id: null,
        gerar_titulos: false,
        licencas: null,
        data_contratacao: null,
        inicio: hoje,
        fim: null,
        situacao: 'ativa' as const,
        ...exemplo.assinatura,
      },
    ];
  });

  return { ferramenta, ferramenta_contexto, assinatura_ferramenta, assinatura_valor_historico: [] };
}
