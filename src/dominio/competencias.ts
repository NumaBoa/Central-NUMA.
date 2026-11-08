/**
 * RN-05.18 e CA-05.04: competência fechada não aceita lançamento, baixa nem rateio. A mensagem orienta lançar um
 * ajuste na competência aberta. Fica à parte para que títulos, baixas e receitas possam conferir sem ciclo de import.
 */
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';

/** `AAAA-MM` das competências fechadas. */
export async function competenciasFechadas(): Promise<Set<string>> {
  const linhas = await repositorios.competencia_fechamento.listar({ onde: { situacao: 'fechada' } });
  return new Set(linhas.map((linha) => linha.competencia.slice(0, 7)));
}

const porExtenso = (mes: string) => `${mes.slice(5, 7)}/${mes.slice(0, 4)}`;

/** `quando` é um dia (`AAAA-MM-DD`) ou uma competência (`AAAA-MM` ou o primeiro dia do mês). */
export async function garantirCompetenciaAberta(quando: string, oQue: 'lancamento' | 'baixa' = 'lancamento'): Promise<void> {
  const mes = quando.slice(0, 7);
  if (!(await competenciasFechadas()).has(mes)) return;
  throw new ErroDeRegra(
    oQue === 'baixa'
      ? `A competência ${porExtenso(mes)} está fechada: não aceita baixa. Registre com a data de hoje ou lance um ajuste na competência aberta.`
      : `A competência ${porExtenso(mes)} está fechada: não aceita lançamento nem mudança. Lance um ajuste na competência aberta.`,
  );
}
