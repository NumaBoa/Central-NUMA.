/**
 * Alertas do M06 (05-M03 §5). Usam o motor do Meu dia (`sincronizarAlertas`): são atividades com origem, e não uma lista
 * paralela. Rodar de novo não duplica (RT-09). Concluir o alerta à mão não faz a ação de origem (RN-03.12): a transferência,
 * o prazo e a ocorrência só se resolvem na própria tela.
 */
import { AREAS_INICIAIS, ID_KIMBERLY } from '@/dados/exemplos/base';
import { repositorios } from '@/dados/repositorios';
import { comoSistema } from '@/dados/sessao';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO } from '@/lib/formatacao';
import { sincronizarAlertas, type AlertaDesejado } from './alertas';
import { estaAberta, MAXIMO_NO_TITULO } from './atividades';
import { itensATransferir } from './ativos-a-transferir';
import { ORIGEM_ACORDO, ORIGEM_MARCA_PRAZO, ORIGEM_OCORRENCIA, ORIGEM_TRANSFERENCIA } from './integracoes/meu-dia-m06';
import { somarDias } from './repeticao';

const idDaArea = (nome: string) => AREAS_INICIAIS.find((area) => area.nome === nome)?.id ?? null;
const AREA_JURIDICO = idDaArea('Jurídico e privacidade');
const AREA_TECNOLOGIA = idDaArea('Tecnologia');
const AREA_GESTAO = idDaArea('Gestão geral');

const limitar = (texto: string) => (texto.length <= MAXIMO_NO_TITULO ? texto : `${texto.slice(0, MAXIMO_NO_TITULO - 1).trimEnd()}…`);

/** 05-M03 §5: "30 dias antes da data de revisão". */
export const DIAS_ANTES_DA_REVISAO = 30;

export const MOTIVOS_M06 = { transferencia: 'Transferência pendente', prazoDeMarca: 'Prazo do processo', revisaoDoAcordo: 'Revisão prevista', vencimentoDaObrigacao: 'Vencimento' } as const;

type OpcoesDaTransferencia = {
  /** "Gerar atividades para todos os pendentes" (T06.04): mesmo com a entidade ainda planejada. */
  gerar?: boolean;
  /** Só os registros que uma ação acabou de mudar: o alerta se resolve na hora. */
  apenas?: readonly string[];
};

/**
 * RN-06.07: quando a entidade PJ fica Ativa, cada item pendente ganha uma atividade. Antes disso, só por pedido.
 * A chave usa o dia do cadastro do item, que não muda: dispensado não volta, e pedir de novo não duplica. Sem prazo: a
 * especificação não dá um, e um "atrasado" no dia seguinte só faria barulho. Atividade aberta já ligada ao item é
 * aproveitada, em vez de criar outra.
 */
export async function sincronizarAlertasDeTransferencia({ gerar = false, apenas }: OpcoesDaTransferencia = {}): Promise<number> {
  const corpo = async () => {
    const [ativos, ferramentas, contextos, pessoas, entidades, vinculos, atividades] = await Promise.all([repositorios.ativo_digital.listar(), repositorios.ferramenta.listar(), repositorios.ferramenta_contexto.listar(), repositorios.pessoa.listar({ incluirArquivados: true }), repositorios.entidade.listar(), repositorios.vinculo.listar(), repositorios.atividade.listar()]);
    const entidadeAtiva = entidades.some((entidade) => entidade.tipo_pessoa === 'pj' && entidade.situacao === 'ativa');
    const comAlertaAberto = new Set(atividades.filter((atividade) => atividade.origem_tipo === ORIGEM_TRANSFERENCIA && estaAberta(atividade)).map((atividade) => atividade.origem_id));
    const abertas = new Set(atividades.filter(estaAberta).map((atividade) => atividade.id));
    const comTarefaAberta = new Set(
      vinculos.flatMap((vinculo) => {
        if (vinculo.origem_tipo === 'atividade' && abertas.has(vinculo.origem_id)) return [vinculo.destino_id];
        if (vinculo.destino_tipo === 'atividade' && abertas.has(vinculo.destino_id)) return [vinculo.origem_id];
        return [];
      }),
    );
    const desejados: AlertaDesejado[] = itensATransferir({ ativos, ferramentas, contextos, pessoas })
      .filter((item) => comAlertaAberto.has(item.id) || ((gerar || entidadeAtiva) && !comTarefaAberta.has(item.id)))
      .filter((item) => !apenas || apenas.includes(item.id))
      .map((item) => ({
        origem_tipo: ORIGEM_TRANSFERENCIA,
        origem_id: item.id,
        motivo: MOTIVOS_M06.transferencia,
        data_referencia: item.criadoEm.slice(0, 10),
        titulo: limitar(`Transferir ${item.nome} para ${item.titularDesejado}`),
        responsavel_id: item.responsavelId,
        area_id: AREA_TECNOLOGIA,
        acao: item.origem === 'ativo' ? 'registrar_transferencia' : 'transferir_ferramenta',
        exemplo: item.exemplo,
        semPrazo: true,
      }));
    return sincronizarAlertas(ORIGEM_TRANSFERENCIA, desejados, 'Concluído: a transferência foi registrada.', apenas ? { apenas } : {});
  };
  return gerar ? corpo() : comoSistema(corpo);
}

/** RN-06.09: N dias antes do prazo cadastrado. O N é o de domínios (T02.01): perder este prazo perde a marca, e avisar cedo não custa nada. O INPI não é consultado. */
export async function sincronizarAlertasDasMarcas(hoje: string = hojeISO(), { apenas }: { apenas?: readonly string[] } = {}): Promise<number> {
  return comoSistema(async () => {
    const [prazos, processos, marcas, configuracoes] = await Promise.all([repositorios.marca_prazo.listar(), repositorios.marca_processo.listar(), repositorios.marca.listar({ incluirArquivados: true }), repositorios.configuracao.ler()]);
    const desejados: AlertaDesejado[] = prazos.flatMap((prazo) => {
      const processo = processos.find((item) => item.id === prazo.processo_id);
      if (!processo || prazo.cumprido_em || somarDias(prazo.data_limite, -configuracoes.alerta_dominio_dias) > hoje || (apenas && !apenas.includes(prazo.id))) return [];
      const marca = marcas.find((item) => item.id === processo.marca_id);
      return [{ origem_tipo: ORIGEM_MARCA_PRAZO, origem_id: prazo.id, motivo: MOTIVOS_M06.prazoDeMarca, data_referencia: prazo.data_limite, titulo: limitar(`${marca?.nome ?? 'Marca'}: ${prazo.descricao}`), responsavel_id: prazo.responsavel_id, area_id: AREA_JURIDICO, acao: 'abrir_processo_marca', exemplo: prazo.exemplo }];
    });
    return sincronizarAlertas(ORIGEM_MARCA_PRAZO, desejados, 'Concluído: o prazo foi cumprido ou removido.', apenas ? { apenas } : {});
  });
}

/** 05-M03 §5: a revisão prevista do acordo vigente, 30 dias antes. Responsável: a área jurídica, Kimberly por padrão. */
export async function sincronizarAlertasDosAcordos(hoje: string = hojeISO()): Promise<number> {
  return comoSistema(async () => {
    const [acordos, versoes, areas] = await Promise.all([repositorios.acordo_societario.listar(), repositorios.acordo_versao.listar({ onde: { situacao: 'vigente' } }), repositorios.area.listar()]);
    const responsavel = areas.find((area) => area.id === AREA_JURIDICO)?.responsavel_padrao_id ?? ID_KIMBERLY;
    const desejados: AlertaDesejado[] = versoes.flatMap((versao) => {
      const acordo = acordos.find((item) => item.id === versao.acordo_id);
      if (!acordo || !versao.revisao_prevista || somarDias(versao.revisao_prevista, -DIAS_ANTES_DA_REVISAO) > hoje) return [];
      return [{ origem_tipo: ORIGEM_ACORDO, origem_id: acordo.id, motivo: MOTIVOS_M06.revisaoDoAcordo, data_referencia: versao.revisao_prevista, titulo: limitar(`Revisar ${acordo.titulo}: prevista para ${formatarDiaISO(versao.revisao_prevista)}`), responsavel_id: responsavel, area_id: AREA_JURIDICO, acao: 'abrir_acordo', exemplo: acordo.exemplo }];
    });
    return sincronizarAlertas(ORIGEM_ACORDO, desejados, 'Concluído: nova versão ou revisão registrada.');
  });
}

/** RN-06.12 e 05-M03 §5: cada ocorrência em aberto. Quem resolve é o cumprimento, com comprovante: concluir o alerta não paga nada. */
export async function sincronizarAlertasDasObrigacoes(): Promise<number> {
  return comoSistema(async () => {
    const [ocorrencias, obrigacoes] = await Promise.all([repositorios.obrigacao_corporativa_ocorrencia.listar(), repositorios.obrigacao_corporativa.listar()]);
    const desejados: AlertaDesejado[] = ocorrencias.flatMap((ocorrencia) => {
      const obrigacao = obrigacoes.find((item) => item.id === ocorrencia.obrigacao_id);
      if (!obrigacao || obrigacao.situacao !== 'ativa' || ocorrencia.cumprida_em) return [];
      return [{ origem_tipo: ORIGEM_OCORRENCIA, origem_id: ocorrencia.id, motivo: MOTIVOS_M06.vencimentoDaObrigacao, data_referencia: ocorrencia.vencimento, titulo: limitar(`${obrigacao.nome}: vence em ${formatarDiaISO(ocorrencia.vencimento)}`), responsavel_id: obrigacao.responsavel_id, area_id: AREA_GESTAO, acao: 'abrir_obrigacao', exemplo: obrigacao.exemplo }];
    });
    return sincronizarAlertas(ORIGEM_OCORRENCIA, desejados, 'Concluído: a ocorrência foi cumprida ou a obrigação encerrada.');
  });
}

/** A rotina do dia do M06. */
export async function gerarAlertasM06(hoje: string = hojeISO()): Promise<number> {
  let novos = await sincronizarAlertasDeTransferencia();
  novos += await sincronizarAlertasDasMarcas(hoje);
  novos += await sincronizarAlertasDosAcordos(hoje);
  novos += await sincronizarAlertasDasObrigacoes();
  return novos;
}
