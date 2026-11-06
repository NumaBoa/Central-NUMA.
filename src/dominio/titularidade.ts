/** Titular atual e desejado (RN-04.14), comuns a ferramentas e ativos. */
import type { Pessoa } from '@/dados/tipos/pessoa';
import { normalizarTexto } from './duplicidade';

export const ROTULOS_TITULAR = { numa: 'Numa (PJ)', pessoa_fisica: 'Pessoa física', terceiro: 'Terceiro' } as const;

export type Titular = {
  titular_atual_tipo: keyof typeof ROTULOS_TITULAR;
  titular_atual_pessoa_id: string | null;
  titular_atual_texto: string | null;
};

export function textoDoTitular(titular: Titular, pessoas: readonly Pick<Pessoa, 'id' | 'nome_completo'>[]): string {
  if (titular.titular_atual_tipo === 'pessoa_fisica') return `Pessoa física — ${pessoas.find((pessoa) => pessoa.id === titular.titular_atual_pessoa_id)?.nome_completo ?? 'pessoa removida'}`;
  if (titular.titular_atual_tipo === 'terceiro') return `Terceiro — ${titular.titular_atual_texto ?? ''}`;
  return ROTULOS_TITULAR.numa;
}

/** "Numa" e "Numa (PJ)" são o mesmo titular; os outros valem pelo nome. */
export function titularEhODesejado(titular: Titular, desejado: string, pessoas: readonly Pick<Pessoa, 'id' | 'nome_completo'>[]): boolean {
  const alvo = normalizarTexto(desejado);
  if (titular.titular_atual_tipo === 'numa') return alvo === 'numa' || alvo === 'numa (pj)';
  if (titular.titular_atual_tipo === 'pessoa_fisica') return normalizarTexto(pessoas.find((pessoa) => pessoa.id === titular.titular_atual_pessoa_id)?.nome_completo ?? '') === alvo;
  return normalizarTexto(titular.titular_atual_texto ?? '') === alvo;
}
