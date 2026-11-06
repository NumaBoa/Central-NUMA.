/** Câmbio de referência (T02.01): usado só em estimativas (RN-04.07 e RN-05.05). */
import { z } from 'zod';
import { repositorios } from '@/dados/repositorios';
import { MAIOR_COTACAO, type CambioReferencia } from '@/dados/tipos/cambio-referencia';
import { MOEDA_REAL } from './moedas';

const FORMATO_COTACAO = /^\d{1,6}([.,]\d{1,6})?$/;

/** Aceita vírgula ou ponto como separador decimal. */
export function lerCotacao(texto: string): number {
  return Number(texto.trim().replace(',', '.'));
}

export const esquemaNovoCambio = z.object({
  moeda: z
    .string()
    .regex(/^[A-Z]{3}$/, 'Escolha a moeda.')
    .refine((moeda) => moeda !== MOEDA_REAL, 'A cotação já é em reais: escolha outra moeda.'),
  cotacao: z
    .string()
    .trim()
    .min(1, { error: 'Informe a cotação em reais.', abort: true })
    .regex(FORMATO_COTACAO, { error: 'Use só números, como 0,00.', abort: true })
    .refine((texto) => lerCotacao(texto) > 0 && lerCotacao(texto) <= MAIOR_COTACAO, 'A cotação precisa ser maior que zero.'),
  data_referencia: z.iso.date('Informe a data de referência.'),
  fonte: z.string().trim(),
});

export type NovoCambio = z.infer<typeof esquemaNovoCambio>;

export const CAMPOS_NOVO_CAMBIO: NovoCambio = { moeda: 'USD', cotacao: '', data_referencia: '', fonte: '' };

export const MENSAGEM_CAMBIO_REPETIDO = 'Já existe essa moeda nessa data.';

/** Único por moeda e data (16 §4.1), só entre as linhas ativas: quem remove pode lançar de novo. */
export function cambioRepetido(cambios: readonly CambioReferencia[], moeda: string, data: string): boolean {
  return cambios.some((cambio) => !cambio.arquivado_em && cambio.moeda === moeda && cambio.data_referencia === data);
}

/** Mais recentes primeiro; na mesma data, por moeda. */
export async function listarCambios(): Promise<CambioReferencia[]> {
  const cambios = await repositorios.cambio_referencia.listar();
  return cambios.sort((a, b) => b.data_referencia.localeCompare(a.data_referencia) || a.moeda.localeCompare(b.moeda));
}

export type ResultadoNovoCambio = { ok: true; cambio: CambioReferencia } | { ok: false; repetido: true };

export async function adicionarCambio(dados: NovoCambio): Promise<ResultadoNovoCambio> {
  if (cambioRepetido(await repositorios.cambio_referencia.listar(), dados.moeda, dados.data_referencia)) return { ok: false, repetido: true };
  const cambio = await repositorios.cambio_referencia.criar({
    moeda: dados.moeda,
    valor_brl: lerCotacao(dados.cotacao),
    data_referencia: dados.data_referencia,
    fonte: dados.fonte || null,
  });
  return { ok: true, cambio };
}

/** "Remover" na tela é arquivar (RT-03): sai da lista, e o registro continua no histórico. */
export async function removerCambio(id: string): Promise<void> {
  await repositorios.cambio_referencia.arquivar(id);
}
