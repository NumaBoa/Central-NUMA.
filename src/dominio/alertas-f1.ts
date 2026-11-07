/**
 * Alertas de M09, M10 e M11 (05-M03 §5). Usam o mesmo motor do Meu dia (`sincronizarAlertas`): são atividades
 * com origem, e não uma lista paralela. Os blocos de M10 e M11 entram junto com esses módulos.
 */
import { AREAS_INICIAIS } from '@/dados/exemplos/base';
import { repositorios } from '@/dados/repositorios';
import { comoSistema } from '@/dados/sessao';
import { hojeISO } from '@/lib/datas';
import { MAXIMO_NO_TITULO } from './atividades';
import { sincronizarAlertas, type AlertaDesejado } from './alertas';
import { ORIGEM_ALERTA_DOCUMENTO_LEGAL, ORIGEM_ALERTA_SOLICITACAO, ROTULOS_TIPO_DOCUMENTO_LEGAL } from './legal';
import { somarDias } from './repeticao';

const idDaArea = (nome: string) => AREAS_INICIAIS.find((area) => area.nome === nome)?.id ?? null;
const AREA_JURIDICO = idDaArea('Jurídico e privacidade');

const limitar = (texto: string) => (texto.length <= MAXIMO_NO_TITULO ? texto : `${texto.slice(0, MAXIMO_NO_TITULO - 1).trimEnd()}…`);

export const MOTIVOS_F1 = {
  revisaoNecessaria: 'Revisão necessária',
  revisaoAnual: 'Revisão anual',
  prazoTitular: 'Prazo de resposta',
  proximaAcao: 'Próxima ação',
  validadeProposta: 'Validade expirando',
  assinaturaPendente: 'Assinatura pendente',
  renovacao: 'Renovação / aviso prévio',
  obrigacao: 'Prazo da obrigação',
  programacao: 'Programação da renovação',
} as const;

export async function sincronizarAlertasLegais(hoje: string = hojeISO()): Promise<number> {
  return comoSistema(async () => {
    const [documentos, solicitacoes, produtos] = await Promise.all([repositorios.documento_legal.listar(), repositorios.solicitacao_titular.listar(), repositorios.produto.listar({ incluirArquivados: true })]);
    const nomeDoProduto = (id: string | null) => (id ? (produtos.find((produto) => produto.id === id)?.nome ?? 'Produto removido') : 'Numa');
    const desejadosDocumentos: AlertaDesejado[] = documentos.flatMap((documento) => {
      const base = { origem_tipo: ORIGEM_ALERTA_DOCUMENTO_LEGAL, origem_id: documento.id, responsavel_id: documento.responsavel_id, area_id: AREA_JURIDICO, acao: 'revisar_documento_legal', exemplo: documento.exemplo };
      const nome = `${ROTULOS_TIPO_DOCUMENTO_LEGAL[documento.tipo]} de ${nomeDoProduto(documento.produto_id)}`;
      const lista: AlertaDesejado[] = [];
      if (documento.revisao_necessaria) lista.push({ ...base, motivo: MOTIVOS_F1.revisaoNecessaria, data_referencia: hoje, titulo: limitar(`Revisar ${nome}: o inventário mudou`) });
      if (documento.versao_vigente_id && documento.proxima_revisao && somarDias(documento.proxima_revisao, -30) <= hoje) lista.push({ ...base, motivo: MOTIVOS_F1.revisaoAnual, data_referencia: documento.proxima_revisao, titulo: limitar(`Revisão anual de ${nome}`) });
      return lista;
    });
    // O alerta de revisão não muda de data a cada dia: o motor compara origem e motivo.
    let novos = await sincronizarAlertas(ORIGEM_ALERTA_DOCUMENTO_LEGAL, desejadosDocumentos, 'Concluído: o documento foi revisado.');
    const desejadosSolicitacoes: AlertaDesejado[] = solicitacoes.flatMap((solicitacao) => {
      const aberta = solicitacao.situacao === 'recebida' || solicitacao.situacao === 'em_analise';
      // Sem prazo definido, não há data para avisar: a pendência aparece na própria lista (decisão vigente 11).
      if (!aberta || !solicitacao.prazo || somarDias(solicitacao.prazo, -3) > hoje) return [];
      return [{ origem_tipo: ORIGEM_ALERTA_SOLICITACAO, origem_id: solicitacao.id, motivo: MOTIVOS_F1.prazoTitular, data_referencia: solicitacao.prazo, titulo: limitar(`Responder ${solicitacao.codigo}: prazo do titular`), responsavel_id: solicitacao.responsavel_id, area_id: AREA_JURIDICO, acao: 'responder_titular', exemplo: solicitacao.exemplo }];
    });
    novos += await sincronizarAlertas(ORIGEM_ALERTA_SOLICITACAO, desejadosSolicitacoes, 'Concluído: a solicitação foi respondida.');
    return novos;
  });
}

/** A rotina do dia desta frente: M10 e M11 acrescentam as origens deles aqui. */
export async function gerarAlertasF1(hoje: string = hojeISO()): Promise<number> {
  return sincronizarAlertasLegais(hoje);
}
