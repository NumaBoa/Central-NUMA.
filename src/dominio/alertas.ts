/**
 * A rotina do dia `gerar_alertas` (05-M03 §5). Nesta etapa, só a origem que já existe: o backup.
 * Vencimentos, renovações, fim de teste e domínio entram junto com as telas deles (etapa 15).
 */
import { AREAS_INICIAIS } from '@/dados/exemplos/base';
import { repositorios } from '@/dados/repositorios';
import { comoSistema } from '@/dados/sessao';
import { emTransacao } from '@/dados/transacao';
import type { Atividade } from '@/dados/tipos/atividade';
import { hojeISO } from '@/lib/datas';
import { estaAberta } from './atividades';
import { backupAtrasado, DIAS_ATE_BACKUP_ATRASADO } from './backup';

/** O que a origem quer ver no Meu dia neste momento. */
export type AlertaDesejado = {
  origem_tipo: string;
  origem_id: string;
  motivo: string;
  data_referencia: string;
  titulo: string;
  responsavel_id: string;
  area_id: string | null;
  acao: string;
};

/** `tipo_origem + id_origem + motivo + data_referencia` (05-M03 §5). */
export const chaveDoAlerta = ({ origem_tipo, origem_id, motivo, data_referencia }: Pick<AlertaDesejado, 'origem_tipo' | 'origem_id' | 'motivo' | 'data_referencia'>) => `${origem_tipo}:${origem_id}:${motivo}:${data_referencia}`;

function novoAlerta(desejado: AlertaDesejado) {
  return {
    tipo: 'alerta' as const,
    titulo: desejado.titulo,
    descricao: null,
    area_id: desejado.area_id,
    responsavel_id: desejado.responsavel_id,
    prioridade: 'alta' as const,
    situacao: 'a_fazer' as const,
    bloqueada: false,
    bloqueio_motivo: null,
    bloqueada_em: null,
    inicio: null,
    prazo: desejado.data_referencia,
    prazo_hora: null,
    aviso_em: null,
    solicitante_pessoa_id: null,
    solicitante_texto: null,
    resultado_esperado: null,
    aguardando_de_pessoa_id: null,
    aguardando_de_texto: null,
    aguardando_desde: null,
    acompanhamento_em: null,
    recorrencia_id: null,
    ocorrencia_numero: null,
    ocorrencia_data: null,
    editada_individualmente: false,
    origem_tipo: desejado.origem_tipo,
    origem_id: desejado.origem_id,
    alerta_motivo: desejado.motivo,
    alerta_data_referencia: desejado.data_referencia,
    alerta_acao: desejado.acao,
    chave_idempotencia: chaveDoAlerta(desejado),
    adiamentos: 0,
    concluida_em: null,
    concluida_por: null,
    conclusao_nota: null,
    cancelada_motivo: null,
    dispensada_motivo: null,
  };
}

/**
 * Deixa os alertas de uma origem iguais ao que ela pede. O mesmo motivo e a mesma data nunca voltam,
 * nem depois de dispensados (RN-03.13 e RT-09). Data de referência que mudou atualiza o alerta aberto,
 * e origem que deixou de exigir ação o conclui em nome do Sistema (RN-03.14). Exemplos ficam de fora.
 */
export async function sincronizarAlertas(origemTipo: string, desejados: readonly AlertaDesejado[], notaAoResolver: string): Promise<number> {
  const existentes = (await repositorios.atividade.listar({ onde: { origem_tipo: origemTipo }, incluirArquivados: true })).filter((atividade) => atividade.tipo === 'alerta' && !atividade.exemplo);
  const abertos = existentes.filter(estaAberta);
  const mesmoAlerta = (atividade: Atividade, desejado: AlertaDesejado) => atividade.origem_id === desejado.origem_id && atividade.alerta_motivo === desejado.motivo;
  let novos = 0;
  await emTransacao(async () => {
    for (const desejado of desejados) {
      const chave = chaveDoAlerta(desejado);
      if (existentes.some((atividade) => atividade.chave_idempotencia === chave)) continue;
      const aberto = abertos.find((atividade) => mesmoAlerta(atividade, desejado));
      if (aberto) {
        await repositorios.atividade.atualizar(aberto.id, { alerta_data_referencia: desejado.data_referencia, prazo: desejado.data_referencia, chave_idempotencia: chave });
      } else {
        await repositorios.atividade.criar(novoAlerta(desejado));
        novos += 1;
      }
    }
    for (const aberto of abertos) {
      if (!desejados.some((desejado) => mesmoAlerta(aberto, desejado))) await repositorios.atividade.atualizar(aberto.id, { situacao: 'concluida', concluida_em: new Date().toISOString(), concluida_por: null, conclusao_nota: notaAoResolver });
    }
  });
  return novos;
}

// ---------- Backup ----------

const ORIGEM_BACKUP = 'backup';
const ID_DO_BACKUP = 'central';
const AREA_DO_BACKUP = AREAS_INICIAIS.find((area) => area.nome === 'Tecnologia')?.id ?? null;
const UM_DIA = 86_400_000;

/**
 * Backup atrasado: mais de 8 dias sem exportar. Quem nunca exportou conta desde a primeira carga:
 * uma Central recém-aberta não tem atraso nenhum.
 */
async function alertasDeBackup(agora: Date): Promise<AlertaDesejado[]> {
  const [backups, linhasDeConfiguracao, { responsavel_backup_id }] = await Promise.all([repositorios.backup_registro.listar(), repositorios.area.listar({ incluirArquivados: true }), repositorios.configuracao.ler()]);
  const ultimo = backups.reduce<string | null>((maior, backup) => (!maior || backup.gerado_em > maior ? backup.gerado_em : maior), null);
  const desde = ultimo ?? linhasDeConfiguracao.reduce<string | null>((menor, linha) => (!menor || linha.criado_em < menor ? linha.criado_em : menor), null);
  if (!desde || !backupAtrasado(desde, agora)) return [];
  return [
    {
      origem_tipo: ORIGEM_BACKUP,
      origem_id: ID_DO_BACKUP,
      motivo: 'Backup atrasado',
      data_referencia: hojeISO(new Date(new Date(desde).getTime() + DIAS_ATE_BACKUP_ATRASADO * UM_DIA)),
      titulo: 'Exportar os dados da Central',
      responsavel_id: responsavel_backup_id,
      area_id: AREA_DO_BACKUP,
      acao: 'exportar_dados',
    },
  ];
}

const NOTA_DO_BACKUP = 'Concluído por Exportar dados em Configurações.';

export async function sincronizarAlertasDeBackup(agora: Date = new Date()): Promise<number> {
  return comoSistema(async () => sincronizarAlertas(ORIGEM_BACKUP, await alertasDeBackup(agora), NOTA_DO_BACKUP));
}

/** Soma de todas as origens: cada módulo acrescenta a sua aqui. */
export async function gerarAlertas(agora: Date = new Date()): Promise<number> {
  return sincronizarAlertasDeBackup(agora);
}
