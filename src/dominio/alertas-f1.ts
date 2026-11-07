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
  return (await sincronizarAlertasLegais(hoje)) + (await sincronizarAlertasComerciais(hoje));
}

// ---------- M10 e M11 (05-M03 §5, linhas F1) ----------

const AREA_COMERCIAL = idDaArea('Comercial');

/** Proposta: 3 dias antes da validade. Contrato: assinatura pendente 5 dias após o envio, renovação antes da data-limite e obrigações. */
export async function sincronizarAlertasComerciais(hoje: string = hojeISO()): Promise<number> {
  return comoSistema(async () => {
    const { carregarContrato, dataLimiteDaRenovacao, ANTECEDENCIA_RENOVACAO_DIAS, prazoDaObrigacao } = await import('./contratos');
    const [versoesProposta, propostas, oportunidades, contratos, feriados] = await Promise.all([repositorios.proposta_versao.listar(), repositorios.proposta.listar(), repositorios.oportunidade.listar(), repositorios.contrato.listar(), repositorios.feriado.listar()]);
    const desejadosPropostas: AlertaDesejado[] = versoesProposta.flatMap((versao) => {
      const proposta = propostas.find((item) => item.id === versao.proposta_id);
      const oportunidade = oportunidades.find((item) => item.id === proposta?.oportunidade_id);
      if (!proposta || !oportunidade || versao.situacao !== 'enviada' || somarDias(versao.validade, -3) > hoje) return [];
      return [{ origem_tipo: 'proposta', origem_id: proposta.id, motivo: MOTIVOS_F1.validadeProposta, data_referencia: versao.validade, titulo: limitar(`Validade de ${proposta.codigo} V${versao.numero} expirando`), responsavel_id: oportunidade.responsavel_id, area_id: AREA_COMERCIAL, acao: 'abrir_proposta', exemplo: proposta.exemplo }];
    });
    let novos = await sincronizarAlertas('proposta', desejadosPropostas, 'Concluído: a proposta foi aceita, recusada ou expirou.');
    const desejadosContratos: AlertaDesejado[] = [];
    const desejadosObrigacoes: AlertaDesejado[] = [];
    for (const contrato of contratos) {
      if (contrato.encerrado_em || contrato.situacao_documental === 'cancelado') continue;
      const ficha = await carregarContrato(contrato.id, hoje);
      if (!ficha) continue;
      const base = { origem_tipo: 'contrato', origem_id: contrato.id, responsavel_id: contrato.responsavel_id, area_id: AREA_COMERCIAL, exemplo: contrato.exemplo };
      if (ficha.atual.situacao === 'em_elaboracao' && ficha.atual.fluxo === 'enviado_assinatura' && ficha.atual.enviada_em && somarDias(ficha.atual.enviada_em, 5) <= hoje) desejadosContratos.push({ ...base, motivo: MOTIVOS_F1.assinaturaPendente, data_referencia: somarDias(ficha.atual.enviada_em, 5), titulo: limitar(`Assinatura pendente: ${contrato.codigo}`), acao: 'registrar_assinatura' });
      const limite = dataLimiteDaRenovacao(contrato, ficha.vigente, ficha.eventos);
      if (limite && contrato.renovacao_situacao !== 'nao_renovar' && contrato.renovacao_situacao !== 'renovado' && !(contrato.renovacao_situacao === 'renovar' && contrato.versao_elaboracao_id) && somarDias(limite, -ANTECEDENCIA_RENOVACAO_DIAS) <= hoje) desejadosContratos.push({ ...base, motivo: MOTIVOS_F1.renovacao, data_referencia: limite, titulo: limitar(`Decidir a renovação de ${contrato.codigo} até ${limite.split('-').reverse().join('/')}`), acao: 'decidir_renovacao' });
      if (ficha.vigente) {
        const regras = await repositorios.regra_prazo.listar({ onde: { versao_id: ficha.vigente.id } });
        for (const obrigacao of await repositorios.obrigacao_contratual.listar({ onde: { versao_id: ficha.vigente.id } })) {
          const prazo = prazoDaObrigacao(obrigacao, regras, ficha.eventos, feriados);
          if (obrigacao.situacao !== 'pendente' || prazo.pendente || somarDias(prazo.data, -7) > hoje) continue;
          desejadosObrigacoes.push({ origem_tipo: 'obrigacao_contratual', origem_id: obrigacao.id, motivo: MOTIVOS_F1.obrigacao, data_referencia: prazo.data, titulo: limitar(`${contrato.codigo}: ${obrigacao.descricao}`), responsavel_id: obrigacao.responsavel_id, area_id: AREA_COMERCIAL, acao: 'registrar_cumprimento', exemplo: obrigacao.exemplo });
        }
      }
    }
    novos += await sincronizarAlertas('contrato', desejadosContratos, 'Concluído: o contrato não pede mais esta ação.');
    novos += await sincronizarAlertas('obrigacao_contratual', desejadosObrigacoes, 'Concluído: a obrigação foi cumprida ou dispensada.');
    return novos;
  });
}

/** "Atualizar situações" (02 §0.5): propostas expiradas (RN-10.10) e renovação automática (RN-11.22). */
export async function atualizarSituacoesF1(hoje: string = hojeISO()): Promise<number> {
  const { expirarPropostas } = await import('./comercial');
  const { renovarAutomaticamente } = await import('./contratos');
  return comoSistema(async () => (await expirarPropostas(hoje)) + (await renovarAutomaticamente(hoje)));
}
