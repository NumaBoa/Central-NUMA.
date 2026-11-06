import { hojeISO } from '@/lib/datas';
import { montarCodigo } from '@/lib/ids';
import type { Baixa, MovimentoSocietario, Titulo, TituloRateio } from '../tipos/titulo';
import { CATEGORIAS_INICIAIS, ID_CAMILA, ID_CONTA_CAMILA, ID_CONTA_KIMBERLY, ID_CONTRAPARTE_CONTABILIDADE, ID_KIMBERLY, ID_PRODUTO_KIPI, ID_PRODUTO_URBANA, ID_PRODUTO_ZUPI } from './base';
import { controle } from './controle';
import { ferramentasDeExemplo } from './ferramentas';

const idDoTitulo = (numero: number) => `ec0a0b14-5f60-4172-8d84-5e6f7a8b${String(numero).padStart(4, '0')}`;
const idDaLinha = (numero: number) => `fd1b1c25-6071-4283-9e95-6f7a8b9c${String(numero).padStart(4, '0')}`;
const idDoMovimento = (numero: number) => `0e2c2d36-7182-4394-8fa6-7a8b9c0d${String(numero).padStart(4, '0')}`;

const DRIVE_FICTICIO = 'https://drive.google.com/file/d/exemplo/view';
const categoria = (nome: string) => CATEGORIAS_INICIAIS.find((item) => item.nome === nome)?.id as string;

function diasDepois(dia: string, dias: number): string {
  const data = new Date(`${dia}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

type ExemploDeBaixa = Partial<Baixa> & Pick<Baixa, 'tipo' | 'data' | 'conta_financeira_id' | 'valor_moeda' | 'valor_brl'>;
type ExemploDeTitulo = Pick<Titulo, 'descricao' | 'categoria_id' | 'vencimento' | 'valor' | 'situacao' | 'responsavel_id'> &
  Partial<Titulo> & {
    /** Produto; `null` é a Numa; com percentual, é rateio. */
    rateio: readonly { produto: string | null; percentual: number }[];
    baixas?: readonly ExemploDeBaixa[];
  };

/** Lançamentos fictícios de 3 meses (17 §6): pagos, em aberto, vencidos, parcial, estorno, aporte e reembolso. */
export function titulosDeExemplo(agora: string) {
  const hoje = hojeISO(new Date(agora));
  const ano = hoje.slice(0, 4);
  const dia = (dias: number) => diasDepois(hoje, dias);
  const { ferramenta, assinatura_ferramenta } = ferramentasDeExemplo(agora);
  const daFerramenta = (nome: string) => {
    const achada = ferramenta.find((item) => item.nome === nome);
    return { ferramenta: achada, assinatura: assinatura_ferramenta.find((item) => item.ferramenta_id === achada?.id) };
  };
  const nuvem = daFerramenta('Nuvem Clara Hosting');
  const traco = daFerramenta('Traço Editor');
  const registro = daFerramenta('Estúdio Verde Registro');

  const previstosDaAssinatura = (grupo: ReturnType<typeof daFerramenta>, rateio: ExemploDeTitulo['rateio']): ExemploDeTitulo => {
    const proxima = grupo.assinatura?.proxima_cobranca as string;
    return {
      descricao: `${grupo.ferramenta?.nome} · ${grupo.assinatura?.plano}`,
      contraparte_id: grupo.ferramenta?.fornecedor_id ?? null,
      categoria_id: grupo.assinatura?.categoria_financeira_id as string,
      vencimento: proxima,
      valor: grupo.assinatura?.valor as number,
      moeda: grupo.assinatura?.moeda as string,
      situacao: 'previsto',
      responsavel_id: grupo.ferramenta?.responsavel_financeiro_id as string,
      origem: 'assinatura',
      origem_id: grupo.assinatura?.id as string,
      chave_idempotencia: `assinatura:${grupo.assinatura?.id}:${proxima}`,
      ferramenta_id: grupo.ferramenta?.id as string,
      assinatura_id: grupo.assinatura?.id as string,
      rateio,
    };
  };

  const NUMA = [{ produto: null, percentual: 100 }];
  const exemplos: readonly ExemploDeTitulo[] = [
    // Pago com o cartão de sócia, em dólar, tratado como reembolso (CA-05.01): o título de reembolso vem a seguir.
    {
      descricao: 'Nuvem Clara Hosting · Pro',
      contraparte_id: nuvem.ferramenta?.fornecedor_id ?? null,
      categoria_id: categoria('Hospedagem e nuvem'),
      vencimento: dia(-48),
      valor: 20,
      moeda: 'USD',
      situacao: 'quitado',
      responsavel_id: ID_KIMBERLY,
      ferramenta_id: nuvem.ferramenta?.id,
      assinatura_id: nuvem.assinatura?.id,
      rateio: [
        { produto: ID_PRODUTO_KIPI, percentual: 60 },
        { produto: ID_PRODUTO_ZUPI, percentual: 40 },
      ],
      baixas: [{ tipo: 'pagamento', data: dia(-48), conta_financeira_id: ID_CONTA_CAMILA, valor_moeda: 20, cambio: 5.4, iof_brl: 4.05, valor_brl: 112.05, comprovante_url: DRIVE_FICTICIO, tratamento: 'reembolso', registrado_por: ID_KIMBERLY }],
    },
    {
      descricao: 'Reembolso: Nuvem Clara Hosting · Pro',
      beneficiario_pessoa_id: ID_CAMILA,
      categoria_id: categoria('Reembolso de despesas'),
      vencimento: dia(12),
      valor: 112.05,
      situacao: 'aberto',
      responsavel_id: ID_KIMBERLY,
      origem: 'reembolso',
      rateio: [
        { produto: ID_PRODUTO_KIPI, percentual: 60 },
        { produto: ID_PRODUTO_ZUPI, percentual: 40 },
      ],
    },
    // Pago com o cartão de sócia, tratado como aporte (CA-05.02).
    {
      descricao: 'Traço Editor · Equipe',
      contraparte_id: null,
      categoria_id: categoria('Design e criação'),
      vencimento: dia(-27),
      valor: 89.9,
      situacao: 'quitado',
      responsavel_id: ID_KIMBERLY,
      ferramenta_id: traco.ferramenta?.id,
      assinatura_id: traco.assinatura?.id,
      rateio: NUMA,
      baixas: [{ tipo: 'pagamento', data: dia(-27), conta_financeira_id: ID_CONTA_KIMBERLY, valor_moeda: 89.9, valor_brl: 89.9, comprovante_url: DRIVE_FICTICIO, tratamento: 'aporte', registrado_por: ID_KIMBERLY }],
    },
    // Parcial (CA-05.03).
    {
      descricao: 'Honorários de contabilidade',
      contraparte_id: ID_CONTRAPARTE_CONTABILIDADE,
      categoria_id: categoria('Contabilidade'),
      vencimento: dia(-6),
      valor: 300,
      situacao: 'parcial',
      responsavel_id: ID_KIMBERLY,
      rateio: NUMA,
      baixas: [{ tipo: 'pagamento', data: dia(-8), conta_financeira_id: ID_CONTA_KIMBERLY, valor_moeda: 100, valor_brl: 100, comprovante_url: DRIVE_FICTICIO, tratamento: 'aporte', registrado_por: ID_KIMBERLY }],
    },
    // Estorno: pagou, estornou, voltou a ficar em aberto.
    {
      descricao: 'Anúncio de lançamento do Zupi',
      categoria_id: categoria('Anúncios pagos'),
      vencimento: dia(9),
      valor: 150,
      situacao: 'aberto',
      responsavel_id: ID_KIMBERLY,
      rateio: [{ produto: ID_PRODUTO_ZUPI, percentual: 100 }],
      baixas: [
        { tipo: 'pagamento', data: dia(-20), conta_financeira_id: ID_CONTA_KIMBERLY, valor_moeda: 150, valor_brl: 150, comprovante_url: DRIVE_FICTICIO, tratamento: 'aporte', registrado_por: ID_KIMBERLY },
        { tipo: 'estorno', data: dia(-18), conta_financeira_id: ID_CONTA_KIMBERLY, valor_moeda: 150, valor_brl: 150, comprovante_url: DRIVE_FICTICIO, motivo: 'A campanha não foi ao ar.', registrado_por: ID_KIMBERLY },
      ],
    },
    // Vencido.
    {
      descricao: 'Certificado digital',
      categoria_id: categoria('Certificado digital'),
      vencimento: dia(-15),
      valor: 180,
      situacao: 'aberto',
      responsavel_id: ID_KIMBERLY,
      rateio: NUMA,
    },
    // Pago sem comprovante, com motivo (RN-05.12).
    {
      descricao: 'Taxa de cartório',
      categoria_id: categoria('Cartório e registros'),
      vencimento: dia(-70),
      valor: 45,
      situacao: 'quitado',
      responsavel_id: ID_CAMILA,
      rateio: NUMA,
      baixas: [{ tipo: 'pagamento', data: dia(-70), conta_financeira_id: ID_CONTA_CAMILA, valor_moeda: 45, valor_brl: 45, sem_comprovante_motivo: 'Pago em dinheiro, sem recibo.', tratamento: 'aporte', registrado_por: ID_CAMILA }],
    },
    // Rateado entre produtos e a Numa (CA-05.06).
    {
      descricao: 'Sessão de fotos das marcas',
      categoria_id: categoria('Produção de conteúdo'),
      vencimento: dia(20),
      valor: 300,
      situacao: 'aberto',
      responsavel_id: ID_KIMBERLY,
      rateio: [
        { produto: ID_PRODUTO_KIPI, percentual: 50 },
        { produto: ID_PRODUTO_ZUPI, percentual: 30 },
        { produto: null, percentual: 20 },
      ],
    },
    // Cancelado.
    {
      descricao: 'Brindes do evento',
      categoria_id: categoria('Brindes e materiais'),
      vencimento: dia(-35),
      valor: 220,
      situacao: 'cancelado',
      responsavel_id: ID_KIMBERLY,
      cancelado_motivo: 'O evento foi adiado.',
      rateio: [{ produto: ID_PRODUTO_URBANA, percentual: 100 }],
    },
    // Previstos das assinaturas: a mesma chave de quem gera, para gerar de novo não duplicar.
    previstosDaAssinatura(traco, NUMA),
    previstosDaAssinatura(registro, NUMA),
    previstosDaAssinatura(nuvem, [
      { produto: ID_PRODUTO_KIPI, percentual: 60 },
      { produto: ID_PRODUTO_ZUPI, percentual: 40 },
    ]),
  ];

  let linha = 0;
  let movimentoNumero = 0;
  const titulo: Titulo[] = [];
  const titulo_rateio: TituloRateio[] = [];
  const baixa: Baixa[] = [];
  const movimento_societario: MovimentoSocietario[] = [];

  exemplos.forEach(({ rateio, baixas = [], ...dados }, indice) => {
    const id = idDoTitulo(indice + 1);
    const vencimento = dados.vencimento;
    titulo.push({
      ...controle(id, true, agora),
      codigo: montarCodigo('TIT', ano, indice + 1),
      natureza: 'pagar',
      contraparte_id: null,
      beneficiario_pessoa_id: null,
      competencia: `${vencimento.slice(0, 7)}-01`,
      moeda: 'BRL',
      entidade_id: null,
      origem: 'manual',
      origem_id: null,
      chave_idempotencia: null,
      ajustado_manualmente: false,
      ferramenta_id: null,
      assinatura_id: null,
      periodo_inicio: null,
      periodo_fim: null,
      suspenso: false,
      cancelado_motivo: null,
      observacao: null,
      ...dados,
    });
    let somado = 0;
    rateio.forEach(({ produto, percentual }, posicao) => {
      const valor = posicao === rateio.length - 1 ? Math.round((dados.valor - somado) * 100) / 100 : Math.round(dados.valor * percentual) / 100;
      somado += valor;
      titulo_rateio.push({ ...controle(idDaLinha(++linha), true, agora), titulo_id: id, produto_id: produto, percentual, valor });
    });
    let originalId: string | null = null;
    for (const dadosDaBaixa of baixas) {
      const idDaBaixa = idDaLinha(++linha);
      const nova: Baixa = {
        ...controle(idDaBaixa, true, agora),
        titulo_id: id,
        baixa_original_id: dadosDaBaixa.tipo === 'estorno' ? originalId : null,
        cambio: null,
        iof_brl: null,
        comprovante_url: null,
        sem_comprovante_motivo: null,
        tratamento: null,
        movimento_societario_id: null,
        titulo_reembolso_id: null,
        motivo: null,
        registrado_por: null,
        ...dadosDaBaixa,
      };
      if (nova.tipo === 'pagamento') originalId = idDaBaixa;
      // Estorno de um aporte desfaz o aporte: só os que ficaram de pé viram movimento.
      const estornada = baixas.some((outra) => outra.tipo === 'estorno') && nova.tipo === 'pagamento';
      if (nova.tratamento === 'aporte' && !estornada) {
        const idDoMov = idDoMovimento(++movimentoNumero);
        nova.movimento_societario_id = idDoMov;
        movimento_societario.push({
          ...controle(idDoMov, true, agora),
          codigo: montarCodigo('MOV', ano, movimentoNumero),
          tipo: 'aporte',
          socia_id: nova.conta_financeira_id === ID_CONTA_CAMILA ? ID_CAMILA : ID_KIMBERLY,
          data: nova.data,
          valor_brl: nova.valor_brl,
          forma: 'pagamento_despesa',
          titulo_origem_id: id,
          baixa_origem_id: idDaBaixa,
          conta_financeira_id: nova.conta_financeira_id,
          comprovante_url: nova.comprovante_url,
          observacao: null,
        });
      }
      if (nova.tratamento === 'reembolso') nova.titulo_reembolso_id = idDoTitulo(indice + 2);
      baixa.push(nova);
    }
  });
  // O reembolso aponta para a despesa de onde nasceu.
  const reembolso = titulo[1] as Titulo;
  reembolso.origem_id = idDoTitulo(1);
  reembolso.chave_idempotencia = `reembolso:${baixa[0]?.id}`;

  return { titulo, titulo_rateio, baixa, movimento_societario };
}
