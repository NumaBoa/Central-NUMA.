/**
 * T03.06 (05-M03): o que o resumo diário por e-mail traz, por pessoa. Nesta etapa é só a prévia: o envio
 * (`enviar_resumo_diario`) depende do servidor. Nunca mostra valores: a prévia não sabe quem vai ler.
 */
import { repositorios } from '@/dados/repositorios';
import type { Atividade } from '@/dados/tipos/atividade';
import type { Titulo } from '@/dados/tipos/titulo';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO } from '@/lib/formatacao';
import { avisaRenovacao } from './alertas';
import { CAMINHO_DA_ATIVIDADE, carregarMeuDia, contextosDaAtividade, ehParaHoje, estaAberta, estaAtrasada, ordenarAtividades, primeiroNome, textoDoPrazo, type AtividadeDoDia, type ContextoDaAtividade } from './atividades';
import { somarDias } from './repeticao';

/** "Até 10, com link" (T03.06). */
export const MAXIMO_POR_SECAO = 10;
const DIAS_A_FRENTE = 7;
const PEDEM_PAGAMENTO: readonly Titulo['situacao'][] = ['previsto', 'aberto', 'parcial'];

export type ItemDoResumo = { id: string; titulo: string; contextos: ContextoDaAtividade[]; detalhe: string; href: string };
export type SecaoDoResumo = { total: number; itens: ItemDoResumo[] };
export type EventoDoResumo = { id: string; dia: string; titulo: string; detalhe: string; acao: string; href: string };

export type ResumoDiario = {
  assunto: string;
  nome: string;
  /** A frase do topo: `itens` é o trecho com o destaque. */
  itens: string;
  atrasadas: SecaoDoResumo;
  paraHoje: SecaoDoResumo;
  aguardando: SecaoDoResumo;
  proximos: EventoDoResumo[];
  periodoDosProximos: string;
};

const plural = (quantidade: number, um: string, varios: string) => `${quantidade} ${quantidade === 1 ? um : varios}`;

/** "Seu dia na Numa — 4 itens, 2 atrasados". */
export function assuntoDoResumo(paraHoje: number, atrasadas: number): string {
  const partes = [paraHoje ? plural(paraHoje, 'item', 'itens') : '', atrasadas ? plural(atrasadas, 'atrasado', 'atrasados') : ''].filter(Boolean);
  return partes.length ? `Seu dia na Numa — ${partes.join(', ')}` : 'Seu dia na Numa — nada para hoje';
}

/** Responsável ou participante, como "Minhas" no Meu dia. */
const eDaPessoa = (atividade: AtividadeDoDia, pessoaId: string) => atividade.responsavel_id === pessoaId || atividade.participantes.includes(pessoaId);

type Dados = {
  atividades: readonly AtividadeDoDia[];
  produtos: Parameters<typeof contextosDaAtividade>[1]['produtos'];
  marcas: Parameters<typeof contextosDaAtividade>[1]['marcas'];
};

function secaoDe(atividades: readonly AtividadeDoDia[], dados: Dados, hoje: string, detalhe: (atividade: Atividade) => string): SecaoDoResumo {
  const ordenadas = ordenarAtividades(atividades, hoje);
  return {
    total: ordenadas.length,
    itens: ordenadas.slice(0, MAXIMO_POR_SECAO).map((atividade) => ({ id: atividade.id, titulo: atividade.titulo, contextos: contextosDaAtividade(atividade, dados), detalhe: detalhe(atividade), href: CAMINHO_DA_ATIVIDADE(atividade.id) })),
  };
}

/** O que há nos próximos 7 dias e é da pessoa: vencimentos, renovações, fim de testes e domínios. */
export async function proximosDaPessoa(pessoaId: string, hoje: string): Promise<EventoDoResumo[]> {
  const [titulos, ferramentas, assinaturas, ativos] = await Promise.all([repositorios.titulo.listar(), repositorios.ferramenta.listar(), repositorios.assinatura_ferramenta.listar(), repositorios.ativo_digital.listar()]);
  const ate = somarDias(hoje, DIAS_A_FRENTE);
  const naJanela = (dia: string | null | undefined): dia is string => Boolean(dia && dia > hoje && dia <= ate);
  const eventos: EventoDoResumo[] = [];
  for (const titulo of titulos) {
    if (titulo.natureza !== 'pagar' || titulo.responsavel_id !== pessoaId || !PEDEM_PAGAMENTO.includes(titulo.situacao) || !naJanela(titulo.vencimento)) continue;
    eventos.push({ id: `titulo:${titulo.id}`, dia: titulo.vencimento, titulo: `Vencimento: ${titulo.descricao}`, detalhe: 'Conferir cobrança e comprovante', acao: 'Ver lançamento', href: `/financeiro/${titulo.id}` });
  }
  for (const ferramenta of ferramentas) {
    if (ferramenta.situacao === 'cancelada') continue;
    const assinatura = assinaturas.find((item) => item.ferramenta_id === ferramenta.id && item.situacao === 'ativa');
    if (!assinatura) continue;
    const financeira = ferramenta.responsavel_financeiro_id ?? ferramenta.responsavel_tecnico_id;
    if (financeira === pessoaId && avisaRenovacao(assinatura) && naJanela(assinatura.proxima_cobranca)) {
      eventos.push({ id: `renovacao:${ferramenta.id}`, dia: assinatura.proxima_cobranca as string, titulo: `Renovação de ${ferramenta.nome}`, detalhe: 'Revisar renovação', acao: 'Revisar', href: `/ferramentas/${ferramenta.id}` });
    }
    if (ferramenta.responsavel_tecnico_id === pessoaId && assinatura.modalidade === 'teste' && naJanela(assinatura.fim_teste)) {
      eventos.push({ id: `teste:${ferramenta.id}`, dia: assinatura.fim_teste as string, titulo: `Fim do teste de ${ferramenta.nome}`, detalhe: 'Decidir se mantém a assinatura', acao: 'Revisar', href: `/ferramentas/${ferramenta.id}` });
    }
  }
  for (const ativo of ativos) {
    if (ativo.tipo !== 'dominio' || ativo.responsavel_id !== pessoaId || !naJanela(ativo.vencimento)) continue;
    eventos.push({ id: `ativo:${ativo.id}`, dia: ativo.vencimento, titulo: `Renovação de ${ativo.identificador}`, detalhe: 'Revisar renovação', acao: 'Abrir ativo', href: `/ferramentas/ativos/${ativo.id}` });
  }
  return eventos.sort((a, b) => a.dia.localeCompare(b.dia) || a.titulo.localeCompare(b.titulo, 'pt-BR'));
}

export async function carregarResumoDiario(pessoaId: string, nomeCompleto: string, hoje: string = hojeISO()): Promise<ResumoDiario> {
  const dados = await carregarMeuDia();
  const daPessoa = dados.atividades.filter((atividade) => eDaPessoa(atividade, pessoaId) && estaAberta(atividade));
  const atrasadas = daPessoa.filter((atividade) => estaAtrasada(atividade, hoje));
  const paraHoje = daPessoa.filter((atividade) => ehParaHoje(atividade, hoje));
  // O acompanhamento de hoje conta nos itens de hoje, e aparece na própria seção.
  const acompanhar = paraHoje.filter((atividade) => atividade.situacao === 'aguardando' && atividade.acompanhamento_em === hoje);
  const prazoDoDia = (atividade: Atividade) => textoDoPrazo(atividade, hoje).texto;
  const quem = (atividade: AtividadeDoDia) => (atividade.aguardando_de_pessoa_id ? (dados.pessoas.find((pessoa) => pessoa.id === atividade.aguardando_de_pessoa_id)?.nome_completo ?? 'Pessoa removida') : (atividade.aguardando_de_texto ?? ''));
  return {
    assunto: assuntoDoResumo(paraHoje.length, atrasadas.length),
    nome: primeiroNome(nomeCompleto),
    itens: plural(paraHoje.length, 'item', 'itens'),
    atrasadas: secaoDe(atrasadas, dados, hoje, prazoDoDia),
    paraHoje: secaoDe(paraHoje.filter((atividade) => !acompanhar.includes(atividade)), dados, hoje, prazoDoDia),
    aguardando: secaoDe(acompanhar, dados, hoje, (atividade) => `Aguardando: ${quem(atividade as AtividadeDoDia)}`),
    proximos: await proximosDaPessoa(pessoaId, hoje),
    periodoDosProximos: `${formatarDiaISO(somarDias(hoje, 1)).slice(0, 5)} a ${formatarDiaISO(somarDias(hoje, DIAS_A_FRENTE)).slice(0, 5)}`,
  };
}
