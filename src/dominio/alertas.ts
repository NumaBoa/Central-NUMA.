/**
 * A rotina do dia `gerar_alertas` (05-M03 §5), com as origens da F0a: títulos a pagar, reembolsos a
 * sócias, assinaturas de ferramentas, domínios e o backup. Duas chaves e revisão de acessos são da F2 (D14).
 */
import { AREAS_INICIAIS } from '@/dados/exemplos/base';
import { repositorios } from '@/dados/repositorios';
import { comoSistema } from '@/dados/sessao';
import { emTransacao } from '@/dados/transacao';
import type { Atividade } from '@/dados/tipos/atividade';
import type { AtivoDigital } from '@/dados/tipos/ativo';
import type { AssinaturaFerramenta, Ferramenta } from '@/dados/tipos/ferramenta';
import type { Baixa, Titulo } from '@/dados/tipos/titulo';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO } from '@/lib/formatacao';
import { ACOES_DE_ALERTA, estaAberta, MAXIMO_NO_TITULO } from './atividades';
import { backupAtrasado, DIAS_ATE_BACKUP_ATRASADO } from './backup';
import { somarDias } from './repeticao';
import { saldoDoTitulo } from './titulos';

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
  /** Nasce de um registro de exemplo: sai junto quando os exemplos forem limpos. */
  exemplo?: boolean;
};

/** `tipo_origem + id_origem + motivo + data_referencia` (05-M03 §5). */
export const chaveDoAlerta = ({ origem_tipo, origem_id, motivo, data_referencia }: Pick<AlertaDesejado, 'origem_tipo' | 'origem_id' | 'motivo' | 'data_referencia'>) => `${origem_tipo}:${origem_id}:${motivo}:${data_referencia}`;

/** Os motivos da F0a, como na tabela de 05-M03 §5. */
export const MOTIVOS_DE_ALERTA = {
  vencimentoProximo: 'Vencimento próximo',
  vencido: 'Vencido',
  reembolso: 'Reembolso pendente há 30 dias',
  renovacao: 'Renovação',
  fimDoTeste: 'Fim do período de teste',
  prazoParaCancelar: 'Prazo para cancelar',
  dominio: 'Vencimento',
  backup: 'Backup atrasado',
} as const;

const ORIGEM_TITULO = 'titulo';
const ORIGEM_FERRAMENTA = 'ferramenta';
const ORIGEM_ATIVO = 'ativo';

const idDaArea = (nome: string) => AREAS_INICIAIS.find((area) => area.nome === nome)?.id ?? null;
const AREA_FINANCEIRO = idDaArea('Financeiro');
const AREA_TECNOLOGIA = idDaArea('Tecnologia');

/** O título da atividade tem limite: o nome da origem pode ser longo. */
const limitar = (texto: string) => (texto.length <= MAXIMO_NO_TITULO ? texto : `${texto.slice(0, MAXIMO_NO_TITULO - 1).trimEnd()}…`);

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
    exemplo: desejado.exemplo ?? false,
  };
}

/** A nota de quem resolveu depende do que aconteceu na origem (RN-03.12). */
type NotaAoResolver = string | ((alerta: Atividade) => string);

/** Gerado por este motor. O alerta de exemplo da carga inicial não tem chave, e fica como está. */
const doMotor = (atividade: Atividade) => atividade.tipo === 'alerta' && (!atividade.exemplo || Boolean(atividade.chave_idempotencia));

/**
 * Deixa os alertas de uma origem iguais ao que ela pede. Dispensado ou concluído à mão não volta com o
 * mesmo motivo e a mesma data (RN-03.13 e RT-09). Data de referência que mudou atualiza o alerta aberto
 * (RN-03.14), e origem que deixou de exigir ação o conclui em nome do Sistema, com a nota (RN-03.12).
 * Concluído pelo Sistema volta a abrir se a origem voltar a pedir ação, como depois de um estorno.
 * `apenas` limita aos registros que uma ação acabou de mudar: o alerta se resolve na hora (CA-03.11).
 */
export async function sincronizarAlertas(origemTipo: string, desejados: readonly AlertaDesejado[], notaAoResolver: NotaAoResolver, { apenas }: { apenas?: readonly string[] } = {}): Promise<number> {
  const existentes = (await repositorios.atividade.listar({ onde: { origem_tipo: origemTipo }, incluirArquivados: true })).filter((atividade) => doMotor(atividade) && (!apenas || apenas.includes(atividade.origem_id ?? '')));
  const abertos = existentes.filter(estaAberta);
  const mesmoAlerta = (atividade: Atividade, desejado: AlertaDesejado) => atividade.origem_id === desejado.origem_id && atividade.alerta_motivo === desejado.motivo;
  const nota = (alerta: Atividade) => (typeof notaAoResolver === 'function' ? notaAoResolver(alerta) : notaAoResolver);
  let novos = 0;
  await emTransacao(async () => {
    for (const desejado of desejados) {
      const chave = chaveDoAlerta(desejado);
      const aberto = abertos.find((atividade) => mesmoAlerta(atividade, desejado));
      if (aberto) {
        if (aberto.chave_idempotencia !== chave || aberto.titulo !== desejado.titulo) await repositorios.atividade.atualizar(aberto.id, { alerta_data_referencia: desejado.data_referencia, prazo: desejado.data_referencia, chave_idempotencia: chave, titulo: desejado.titulo });
        continue;
      }
      const anterior = existentes.find((atividade) => atividade.chave_idempotencia === chave);
      if (anterior) {
        if (anterior.situacao === 'concluida' && !anterior.concluida_por && !anterior.arquivado_em) {
          await repositorios.atividade.atualizar(anterior.id, { situacao: 'a_fazer', concluida_em: null, concluida_por: null, conclusao_nota: null, titulo: desejado.titulo });
          novos += 1;
        }
        continue;
      }
      await repositorios.atividade.criar(novoAlerta(desejado));
      novos += 1;
    }
    for (const aberto of abertos) {
      if (!desejados.some((desejado) => mesmoAlerta(aberto, desejado))) await repositorios.atividade.atualizar(aberto.id, { situacao: 'concluida', concluida_em: new Date().toISOString(), concluida_por: null, conclusao_nota: nota(aberto) });
    }
  });
  return novos;
}

const abertosDe = (abertos: readonly Atividade[], origemId: string, motivo: string) => abertos.some((atividade) => atividade.origem_id === origemId && atividade.alerta_motivo === motivo && estaAberta(atividade));

// ---------- Títulos e reembolsos (M05) ----------

const PEDEM_PAGAMENTO: readonly Titulo['situacao'][] = ['previsto', 'aberto', 'parcial'];

export type OpcoesDosTitulos = {
  hoje: string;
  /** Antecedência do vencimento (T02.01). */
  dias: number;
  /** "Kimberly" em 05-M03 §5: a responsável padrão da área Financeiro. */
  responsavelDoReembolso: string | null;
  nomeDaPessoa: (id: string | null) => string;
};

/**
 * Vencimento próximo: N dias antes, até o dia do vencimento; depois dele, vira "Vencido". Previsto
 * também pede pagamento. Adiado para fora da janela, o alerta aberto continua, com a data nova (RN-03.14).
 */
export function alertasDosTitulos(titulos: readonly Titulo[], baixas: readonly Baixa[], abertos: readonly Atividade[], { hoje, dias, responsavelDoReembolso, nomeDaPessoa }: OpcoesDosTitulos): AlertaDesejado[] {
  const desejados: AlertaDesejado[] = [];
  for (const titulo of titulos) {
    if (titulo.arquivado_em || !PEDEM_PAGAMENTO.includes(titulo.situacao)) continue;
    if (saldoDoTitulo(titulo, baixas.filter((baixa) => baixa.titulo_id === titulo.id)) <= 0) continue;
    const base = { origem_tipo: ORIGEM_TITULO, origem_id: titulo.id, responsavel_id: titulo.responsavel_id, area_id: AREA_FINANCEIRO, exemplo: titulo.exemplo };
    if (titulo.vencimento < hoje) {
      desejados.push({ ...base, motivo: MOTIVOS_DE_ALERTA.vencido, data_referencia: titulo.vencimento, titulo: limitar(`${titulo.natureza === 'receber' ? 'Recebimento' : 'Pagamento'} vencido: ${titulo.descricao}`), acao: 'registrar_baixa' });
    } else if (titulo.natureza === 'pagar' && (somarDias(titulo.vencimento, -dias) <= hoje || abertosDe(abertos, titulo.id, MOTIVOS_DE_ALERTA.vencimentoProximo))) {
      desejados.push({ ...base, motivo: MOTIVOS_DE_ALERTA.vencimentoProximo, data_referencia: titulo.vencimento, titulo: limitar(`Vencimento de ${titulo.descricao}`), acao: 'registrar_pagamento' });
    }
    if (titulo.origem === 'reembolso' && titulo.natureza === 'pagar') {
      const desde = somarDias(hojeISO(new Date(titulo.criado_em)), 30);
      if (desde <= hoje) {
        desejados.push({ ...base, responsavel_id: responsavelDoReembolso ?? titulo.responsavel_id, motivo: MOTIVOS_DE_ALERTA.reembolso, data_referencia: desde, titulo: limitar(`Reembolso a ${nomeDaPessoa(titulo.beneficiario_pessoa_id)} pendente há 30 dias: ${titulo.descricao.replace(/^Reembolso: /, '')}`), acao: 'registrar_pagamento' });
      }
    }
  }
  return desejados;
}

function notaDoTitulo(titulos: readonly Titulo[], baixas: readonly Baixa[], hoje: string) {
  return (alerta: Atividade): string => {
    const titulo = titulos.find((item) => item.id === alerta.origem_id);
    if (!titulo || titulo.arquivado_em) return 'Concluído: o lançamento não existe mais.';
    if (titulo.situacao === 'cancelado') return 'Concluído: o lançamento foi cancelado.';
    if (saldoDoTitulo(titulo, baixas.filter((baixa) => baixa.titulo_id === titulo.id)) <= 0) return `Concluído por ${ACOES_DE_ALERTA[alerta.alerta_acao ?? '']?.rotulo ?? 'Registrar baixa'} em Financeiro.`;
    if (alerta.alerta_motivo === MOTIVOS_DE_ALERTA.vencimentoProximo && titulo.vencimento < hoje) return 'Substituído pelo alerta de vencido.';
    if (alerta.alerta_motivo === MOTIVOS_DE_ALERTA.vencido && titulo.vencimento >= hoje) return `Concluído: o vencimento mudou para ${formatarDiaISO(titulo.vencimento)}.`;
    return 'Concluído: o lançamento não pede mais ação.';
  };
}

/** Sem `ids`, todos os títulos; com eles, só os que uma ação acabou de mudar. */
export async function sincronizarAlertasDosTitulos(ids?: readonly string[], hoje: string = hojeISO()): Promise<number> {
  return comoSistema(async () => {
    const [titulos, baixas, alertas, configuracao, areas, pessoas] = await Promise.all([
      repositorios.titulo.listar({ incluirArquivados: true }),
      repositorios.baixa.listar(),
      repositorios.atividade.listar({ onde: { origem_tipo: ORIGEM_TITULO } }),
      repositorios.configuracao.ler(),
      repositorios.area.listar({ incluirArquivados: true }),
      repositorios.pessoa.listar({ incluirArquivados: true }),
    ]);
    const escolhidos = ids ? titulos.filter((titulo) => ids.includes(titulo.id)) : titulos;
    const desejados = alertasDosTitulos(escolhidos, baixas, alertas.filter(estaAberta), {
      hoje,
      dias: configuracao.alerta_vencimento_dias,
      responsavelDoReembolso: areas.find((area) => area.id === AREA_FINANCEIRO)?.responsavel_padrao_id ?? null,
      nomeDaPessoa: (id) => pessoas.find((pessoa) => pessoa.id === id)?.nome_completo ?? 'sócia',
    });
    return sincronizarAlertas(ORIGEM_TITULO, desejados, notaDoTitulo(titulos, baixas, hoje), ids ? { apenas: ids } : {});
  });
}

// ---------- Assinaturas de ferramentas (M04) ----------

export type OpcoesDasFerramentas = { hoje: string; diasRenovacao: number; diasTeste: number };

/** Uma cobrança única ou por uso não se renova. */
const renova = (assinatura: AssinaturaFerramenta) => assinatura.modalidade === 'paga' && Boolean(assinatura.proxima_cobranca) && assinatura.periodicidade !== 'unica' && assinatura.periodicidade !== 'por_uso';

/**
 * Decisão de Kimberly em 06/11/2026: renovação só nas trimestrais, semestrais e anuais, e nas de renovação
 * manual. A mensal automática fica só com o alerta de vencimento do lançamento, que já cobre o pagamento.
 */
const PERIODOS_LONGOS: readonly string[] = ['trimestral', 'semestral', 'anual'];
const periodoLongo = (assinatura: AssinaturaFerramenta) => PERIODOS_LONGOS.includes(assinatura.periodicidade ?? '');
export const avisaRenovacao = (assinatura: AssinaturaFerramenta) => renova(assinatura) && (assinatura.renovacao === 'manual' || periodoLongo(assinatura));
/** Só na renovação automática, que é a que acontece sem ninguém agir, com o aviso informado. */
export const avisaPrazoParaCancelar = (assinatura: AssinaturaFerramenta) => renova(assinatura) && assinatura.renovacao === 'automatica' && periodoLongo(assinatura) && assinatura.aviso_cancelamento_dias !== null;

/**
 * Renovação: N dias antes da próxima cobrança, nas trimestrais, semestrais, anuais e manuais, e fica até a
 * data mudar. Prazo para cancelar: renovação − aviso − 3 dias, nas automáticas desses períodos com aviso
 * informado. Fim do teste: N dias antes, e fica até a ferramenta sair do teste, mesmo expirado (RN-04.09).
 */
export function alertasDasFerramentas(ferramentas: readonly Ferramenta[], assinaturas: readonly AssinaturaFerramenta[], abertos: readonly Atividade[], { hoje, diasRenovacao, diasTeste }: OpcoesDasFerramentas): AlertaDesejado[] {
  const desejados: AlertaDesejado[] = [];
  for (const ferramenta of ferramentas) {
    if (ferramenta.arquivado_em || ferramenta.situacao === 'cancelada') continue;
    const assinatura = assinaturas.find((item) => item.ferramenta_id === ferramenta.id && item.situacao === 'ativa' && !item.arquivado_em);
    if (!assinatura) continue;
    const base = { origem_tipo: ORIGEM_FERRAMENTA, origem_id: ferramenta.id, exemplo: ferramenta.exemplo };
    const financeira = { responsavel_id: ferramenta.responsavel_financeiro_id ?? ferramenta.responsavel_tecnico_id, area_id: AREA_FINANCEIRO };
    if (renova(assinatura)) {
      const renovacao = assinatura.proxima_cobranca as string;
      if (avisaRenovacao(assinatura) && somarDias(renovacao, -diasRenovacao) <= hoje) desejados.push({ ...base, ...financeira, motivo: MOTIVOS_DE_ALERTA.renovacao, data_referencia: renovacao, titulo: limitar(`Renovação de ${ferramenta.nome}`), acao: 'revisar_renovacao' });
      if (avisaPrazoParaCancelar(assinatura)) {
        const limite = somarDias(renovacao, -(assinatura.aviso_cancelamento_dias as number));
        if (somarDias(limite, -3) <= hoje) desejados.push({ ...base, ...financeira, motivo: MOTIVOS_DE_ALERTA.prazoParaCancelar, data_referencia: limite, titulo: limitar(`Prazo para cancelar ${ferramenta.nome}`), acao: 'cancelar_ou_manter' });
      }
    }
    const emTeste = ferramenta.situacao === 'teste' || ferramenta.situacao === 'teste_expirado';
    if (emTeste && assinatura.modalidade === 'teste' && assinatura.fim_teste && (somarDias(assinatura.fim_teste, -diasTeste) <= hoje || abertosDe(abertos, ferramenta.id, MOTIVOS_DE_ALERTA.fimDoTeste))) {
      desejados.push({ ...base, responsavel_id: ferramenta.responsavel_tecnico_id, area_id: AREA_TECNOLOGIA, motivo: MOTIVOS_DE_ALERTA.fimDoTeste, data_referencia: assinatura.fim_teste, titulo: limitar(`Fim do teste de ${ferramenta.nome}`), acao: 'decidir_teste' });
    }
  }
  return desejados;
}

function notaDaFerramenta(ferramentas: readonly Ferramenta[], assinaturas: readonly AssinaturaFerramenta[]) {
  return (alerta: Atividade): string => {
    const ferramenta = ferramentas.find((item) => item.id === alerta.origem_id);
    if (!ferramenta || ferramenta.arquivado_em) return 'Concluído: a ferramenta não existe mais.';
    if (ferramenta.situacao === 'cancelada') return 'Concluído por Cancelar ferramenta em Ferramentas.';
    if (alerta.alerta_motivo === MOTIVOS_DE_ALERTA.fimDoTeste) return 'Concluído: a ferramenta saiu do teste.';
    const assinatura = assinaturas.find((item) => item.ferramenta_id === ferramenta.id && item.situacao === 'ativa' && !item.arquivado_em);
    if (!assinatura || !renova(assinatura)) return 'Concluído: a assinatura não tem mais renovação.';
    const continua = alerta.alerta_motivo === MOTIVOS_DE_ALERTA.renovacao ? avisaRenovacao(assinatura) : avisaPrazoParaCancelar(assinatura);
    if (!continua) return 'Concluído: assinatura mensal com renovação automática fica só com o alerta de vencimento do lançamento.';
    return 'Concluído: a data de renovação foi atualizada.';
  };
}

export async function sincronizarAlertasDasFerramentas(ids?: readonly string[], hoje: string = hojeISO()): Promise<number> {
  return comoSistema(async () => {
    const [ferramentas, assinaturas, alertas, configuracao] = await Promise.all([repositorios.ferramenta.listar({ incluirArquivados: true }), repositorios.assinatura_ferramenta.listar({ incluirArquivados: true }), repositorios.atividade.listar({ onde: { origem_tipo: ORIGEM_FERRAMENTA } }), repositorios.configuracao.ler()]);
    const escolhidas = ids ? ferramentas.filter((ferramenta) => ids.includes(ferramenta.id)) : ferramentas;
    const desejados = alertasDasFerramentas(escolhidas, assinaturas, alertas.filter(estaAberta), { hoje, diasRenovacao: configuracao.alerta_renovacao_ferramenta_dias, diasTeste: configuracao.alerta_fim_teste_dias });
    return sincronizarAlertas(ORIGEM_FERRAMENTA, desejados, notaDaFerramenta(ferramentas, assinaturas), ids ? { apenas: ids } : {});
  });
}

// ---------- Domínios (M04) ----------

/** N dias antes do vencimento, e fica depois dele, até a data mudar (RN-04.18). */
export function alertasDosAtivos(ativos: readonly AtivoDigital[], { hoje, dias }: { hoje: string; dias: number }): AlertaDesejado[] {
  return ativos.flatMap((ativo) =>
    !ativo.arquivado_em && ativo.tipo === 'dominio' && ativo.vencimento && somarDias(ativo.vencimento, -dias) <= hoje
      ? [{ origem_tipo: ORIGEM_ATIVO, origem_id: ativo.id, motivo: MOTIVOS_DE_ALERTA.dominio, data_referencia: ativo.vencimento, titulo: limitar(`Renovar o domínio ${ativo.identificador}`), responsavel_id: ativo.responsavel_id, area_id: AREA_TECNOLOGIA, acao: 'renovar_dominio', exemplo: ativo.exemplo }]
      : [],
  );
}

function notaDoAtivo(ativos: readonly AtivoDigital[]) {
  return (alerta: Atividade): string => {
    const ativo = ativos.find((item) => item.id === alerta.origem_id);
    if (!ativo || ativo.arquivado_em) return 'Concluído: o ativo não existe mais.';
    if (ativo.tipo !== 'dominio' || !ativo.vencimento) return 'Concluído: o ativo não tem mais vencimento de domínio.';
    return 'Concluído: o vencimento do domínio foi atualizado.';
  };
}

export async function sincronizarAlertasDosAtivos(ids?: readonly string[], hoje: string = hojeISO()): Promise<number> {
  return comoSistema(async () => {
    const [ativos, configuracao] = await Promise.all([repositorios.ativo_digital.listar({ incluirArquivados: true }), repositorios.configuracao.ler()]);
    const escolhidos = ids ? ativos.filter((ativo) => ids.includes(ativo.id)) : ativos;
    return sincronizarAlertas(ORIGEM_ATIVO, alertasDosAtivos(escolhidos, { hoje, dias: configuracao.alerta_dominio_dias }), notaDoAtivo(ativos), ids ? { apenas: ids } : {});
  });
}

// ---------- Backup ----------

const ORIGEM_BACKUP = 'backup';
const ID_DO_BACKUP = 'central';
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
      motivo: MOTIVOS_DE_ALERTA.backup,
      data_referencia: hojeISO(new Date(new Date(desde).getTime() + DIAS_ATE_BACKUP_ATRASADO * UM_DIA)),
      titulo: 'Exportar os dados da Central',
      responsavel_id: responsavel_backup_id,
      area_id: AREA_TECNOLOGIA,
      acao: 'exportar_dados',
    },
  ];
}

const NOTA_DO_BACKUP = 'Concluído por Exportar dados em Configurações.';

export async function sincronizarAlertasDeBackup(agora: Date = new Date()): Promise<number> {
  return comoSistema(async () => sincronizarAlertas(ORIGEM_BACKUP, await alertasDeBackup(agora), NOTA_DO_BACKUP));
}

/** Soma de todas as origens da F0a. */
export async function gerarAlertas(agora: Date = new Date()): Promise<number> {
  const hoje = hojeISO(agora);
  let novos = await sincronizarAlertasDeBackup(agora);
  novos += await sincronizarAlertasDosTitulos(undefined, hoje);
  novos += await sincronizarAlertasDasFerramentas(undefined, hoje);
  novos += await sincronizarAlertasDosAtivos(undefined, hoje);
  return novos;
}
