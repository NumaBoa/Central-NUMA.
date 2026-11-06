import { ROTULOS_FUSO } from '@/dados/fuso';
import { listarHistorico } from '@/dados/historico';
import { repositorios } from '@/dados/repositorios';
import { TABELAS, type Tabela } from '@/dados/tabelas';
import type { EventoAuditoria } from '@/dados/tipos/auditoria';
import { CATALOGO_CONFIGURACAO, chaveConhecida } from '@/dados/tipos/configuracao';
import { formatarDiaISO } from '@/lib/formatacao';
import { avancouDeFase, rotuloDaFase } from './fases';
import { FASES, type Fase } from './navegacao';

type Nomes = ReadonlyMap<string, string>;

function plural(quantidade: number, singular: string, varios: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : varios}`;
}

function fraseDaAcaoExecutada(depois: EventoAuditoria['depois']): string {
  const registros = Number(depois?.registros ?? 0);
  switch (depois?.funcao) {
    case 'carga_inicial':
      return 'carregou os dados de exemplo';
    case 'migrar_dados':
      return 'atualizou os dados para a nova versão da Central';
    case 'importar_dados':
      return `importou ${plural(registros, 'registro', 'registros')} de um arquivo${depois?.copia_antes ? ', com cópia do que havia antes' : ''}`;
    case 'restaurar_exemplos':
      return 'restaurou os dados de exemplo';
    case 'limpar_exemplos':
      return `limpou ${plural(registros, 'registro', 'registros')} de exemplo`;
    case 'rodar_rotinas':
      return 'rodou as rotinas do dia';
    default:
      return 'executou uma ação';
  }
}

function nomeDaTabela(tabela: string | null): string {
  return (tabela && TABELAS[tabela as Tabela]?.rotulo) || tabela || 'registros';
}

function ehFase(valor: unknown): valor is Fase {
  return FASES.includes(valor as Fase);
}

function valorLegivel(chave: string, valor: unknown, nomes: Nomes): string {
  if (valor === null || valor === undefined || valor === '') return 'não informado';
  if (chave === 'fuso') return ROTULOS_FUSO[valor as keyof typeof ROTULOS_FUSO] ?? String(valor);
  if (chave === 'responsavel_backup_id') return nomes.get(String(valor)) ?? 'pessoa removida';
  if (chave.endsWith('_dias')) return plural(Number(valor), 'dia', 'dias');
  return String(valor);
}

/** "alterou Moeda padrão: de BRL para USD"; a fase tem verbo próprio e, ao voltar, o motivo. */
function fraseDaConfiguracao(evento: EventoAuditoria, nomes: Nomes): string {
  const chave = String(evento.depois?.chave ?? '');
  const antes = evento.antes?.valor;
  const depois = evento.depois?.valor;
  if (chave === 'fase_ativa' && ehFase(antes) && ehFase(depois)) {
    const verbo = avancouDeFase(antes, depois) ? 'avançou' : 'voltou';
    return `${verbo} para a ${rotuloDaFase(depois)}${evento.motivo ? `. Motivo: ${evento.motivo}` : ''}`;
  }
  const rotulo = chaveConhecida(chave) ? CATALOGO_CONFIGURACAO[chave].rotulo : 'uma configuração';
  return `alterou ${rotulo}: de ${valorLegivel(chave, antes, nomes)} para ${valorLegivel(chave, depois, nomes)}`;
}

function oCambio(dados: EventoAuditoria['depois']): string {
  const moeda = dados?.moeda;
  const data = dados?.data_referencia;
  return typeof moeda === 'string' && typeof data === 'string' ? `o câmbio de ${moeda} de ${formatarDiaISO(data)}` : 'um câmbio';
}

/** Histórico legível (02 §6): quem fez o quê. */
export function descreverEvento(evento: EventoAuditoria, nomes: Nomes): string {
  const quem = evento.usuario_id === null ? 'Sistema' : (nomes.get(evento.usuario_id) ?? 'Pessoa removida');
  const onde = nomeDaTabela(evento.tabela);
  const registro = evento.registro_codigo ? ` ${evento.registro_codigo}` : '';
  const ehCambio = evento.tabela === 'cambio_referencia';
  switch (evento.acao) {
    case 'exportou':
      return `${quem} exportou todos os dados`;
    case 'executou_acao':
      return `${quem} ${fraseDaAcaoExecutada(evento.depois)}`;
    case 'inseriu':
      if (ehCambio) return `${quem} adicionou ${oCambio(evento.depois)}`;
      return `${quem} criou um registro em ${onde}${registro}`;
    case 'alterou':
      if (evento.tabela === 'configuracao') return `${quem} ${fraseDaConfiguracao(evento, nomes)}`;
      return `${quem} alterou um registro em ${onde}${registro}`;
    case 'arquivou':
      if (ehCambio) return `${quem} removeu ${oCambio(evento.antes)}`;
      return `${quem} arquivou um registro em ${onde}${registro}${evento.motivo ? `. Motivo: ${evento.motivo}` : ''}`;
    case 'restaurou':
      return `${quem} restaurou um registro em ${onde}${registro}`;
    default:
      return `${quem} fez uma alteração`;
  }
}

export type LinhaHistorico = { id: string; texto: string; em: string };

async function nomesDasPessoas(): Promise<Map<string, string>> {
  const pessoas = await repositorios.pessoa.listar({ incluirArquivados: true });
  return new Map(pessoas.map((pessoa) => [pessoa.id, pessoa.nome_completo]));
}

export async function historicoRecente(limite: number): Promise<LinhaHistorico[]> {
  const [eventos, nomes] = await Promise.all([listarHistorico({ limite }), nomesDasPessoas()]);
  return eventos.map((evento) => ({ id: evento.id, texto: descreverEvento(evento, nomes), em: evento.ocorrido_em }));
}

/** A última mudança de fase, mostrada na própria seção; `null` se a fase nunca mudou. */
export async function ultimaMudancaDeFase(): Promise<LinhaHistorico | null> {
  const [eventos, nomes] = await Promise.all([listarHistorico({ tabela: 'configuracao' }), nomesDasPessoas()]);
  const evento = eventos.find((item) => item.depois?.chave === 'fase_ativa');
  return evento ? { id: evento.id, texto: descreverEvento(evento, nomes), em: evento.ocorrido_em } : null;
}
