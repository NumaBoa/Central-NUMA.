/**
 * Alertas do M08 no Meu dia, pelo motor do M03 (`sincronizarAlertas`): idempotentes, resolvidos sozinhos
 * quando a origem deixa de pedir ação. O lembrete não publica nada nas redes (T08.05).
 */
import { AREAS_INICIAIS } from '@/dados/exemplos/base';
import { repositorios } from '@/dados/repositorios';
import { comoSistema } from '@/dados/sessao';
import type { Atividade } from '@/dados/tipos/atividade';
import type { Arquivo, PecaConteudo } from '@/dados/tipos/marketing';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO } from '@/lib/formatacao';
import { sincronizarAlertas, type AlertaDesejado } from './alertas';
import { MAXIMO_NO_TITULO } from './atividades';
import { somarDias } from './repeticao';

export const ORIGEM_ARQUIVO = 'arquivo';
export const ORIGEM_PECA = 'peca_conteudo';
export const MOTIVO_DIREITOS = 'Direitos de uso';
export const MOTIVO_PUBLICACAO = 'Publicação prevista';
const DIAS_AVISO_DIREITOS = 30;

const AREA_MARKETING = AREAS_INICIAIS.find((area) => area.nome === 'Social media / Marketing')?.id ?? null;

const limitar = (texto: string) => (texto.length <= MAXIMO_NO_TITULO ? texto : `${texto.slice(0, MAXIMO_NO_TITULO - 1).trimEnd()}…`);

/** RN-08.06: 30 dias antes do fim, e fica depois dele, até a validade mudar ou o item sair. */
export function alertasDosArquivos(arquivos: readonly Arquivo[], hoje: string): AlertaDesejado[] {
  return arquivos.flatMap((arquivo) => {
    if (arquivo.arquivado_em || !arquivo.direitos_validade || somarDias(arquivo.direitos_validade, -DIAS_AVISO_DIREITOS) > hoje) return [];
    const venceu = arquivo.direitos_validade < hoje;
    const titulo = `${venceu ? 'Direitos de uso vencidos' : 'Direitos de uso vencem'} em ${formatarDiaISO(arquivo.direitos_validade)}: ${arquivo.titulo}`;
    return [{ origem_tipo: ORIGEM_ARQUIVO, origem_id: arquivo.id, motivo: MOTIVO_DIREITOS, data_referencia: arquivo.direitos_validade, titulo: limitar(titulo), responsavel_id: arquivo.responsavel_id, area_id: AREA_MARKETING, acao: 'abrir_arquivo', exemplo: arquivo.exemplo }];
  });
}

const PENDENTE: readonly PecaConteudo['situacao'][] = ['ideia', 'producao', 'revisao', 'aprovado'];

/** T08.05: na véspera da data prevista, para a responsável. Atrasada continua até publicar, cancelar ou mudar a data. */
export function alertasDasPecas(pecas: readonly PecaConteudo[], hoje: string): AlertaDesejado[] {
  return pecas.flatMap((peca) => {
    if (peca.arquivado_em || !PENDENTE.includes(peca.situacao) || somarDias(peca.data_prevista, -1) > hoje) return [];
    const quando = peca.data_prevista > hoje ? 'Publicação amanhã' : peca.data_prevista === hoje ? 'Publicação hoje' : `Publicação atrasada (${formatarDiaISO(peca.data_prevista)})`;
    return [{ origem_tipo: ORIGEM_PECA, origem_id: peca.id, motivo: MOTIVO_PUBLICACAO, data_referencia: peca.data_prevista, titulo: limitar(`${quando}: ${peca.titulo}`), responsavel_id: peca.responsavel_id, area_id: AREA_MARKETING, acao: 'abrir_peca', exemplo: peca.exemplo }];
  });
}

function notaDoArquivo(arquivos: readonly Arquivo[]) {
  return (alerta: Atividade): string => {
    const arquivo = arquivos.find((item) => item.id === alerta.origem_id);
    if (!arquivo || arquivo.arquivado_em) return 'Concluído: o item saiu da biblioteca.';
    return 'Concluído: a validade dos direitos de uso foi atualizada.';
  };
}

function notaDaPeca(pecas: readonly PecaConteudo[]) {
  return (alerta: Atividade): string => {
    const peca = pecas.find((item) => item.id === alerta.origem_id);
    if (!peca || peca.arquivado_em) return 'Concluído: a peça não existe mais.';
    if (peca.situacao === 'publicado') return 'Concluído: a peça foi publicada.';
    if (peca.situacao === 'cancelado') return 'Concluído: a peça foi cancelada.';
    return 'Concluído: a data prevista mudou.';
  };
}

export async function sincronizarAlertasDosArquivos(ids?: readonly string[], hoje: string = hojeISO()): Promise<number> {
  return comoSistema(async () => {
    const arquivos = await repositorios.arquivo.listar({ incluirArquivados: true });
    const escolhidos = ids ? arquivos.filter((arquivo) => ids.includes(arquivo.id)) : arquivos;
    return sincronizarAlertas(ORIGEM_ARQUIVO, alertasDosArquivos(escolhidos, hoje), notaDoArquivo(arquivos), ids ? { apenas: ids } : {});
  });
}

export async function sincronizarAlertasDasPecas(ids?: readonly string[], hoje: string = hojeISO()): Promise<number> {
  return comoSistema(async () => {
    const pecas = await repositorios.peca_conteudo.listar({ incluirArquivados: true });
    const escolhidas = ids ? pecas.filter((peca) => ids.includes(peca.id)) : pecas;
    return sincronizarAlertas(ORIGEM_PECA, alertasDasPecas(escolhidas, hoje), notaDaPeca(pecas), ids ? { apenas: ids } : {});
  });
}

/** Somado à rotina "Gerar alertas" do M03. */
export async function gerarAlertasM08(agora: Date = new Date()): Promise<number> {
  const hoje = hojeISO(agora);
  return (await sincronizarAlertasDosArquivos(undefined, hoje)) + (await sincronizarAlertasDasPecas(undefined, hoje));
}
