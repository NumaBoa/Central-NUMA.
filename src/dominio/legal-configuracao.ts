/** Chaves de T02.01 usadas por M09 e M10. */
import { ErroDeRegra } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import type { ValoresConfiguracao } from '@/dados/tipos/configuracao';
import type { Pessoa } from '@/dados/tipos/pessoa';
import { pessoasDoSeletor } from './pessoa-atual';

export type DadosConfiguracaoLegal = { valores: ValoresConfiguracao; pessoas: Pessoa[] };

export async function carregarConfiguracaoLegal(): Promise<DadosConfiguracaoLegal> {
  const [valores, pessoas] = await Promise.all([repositorios.configuracao.ler(), repositorios.pessoa.listar()]);
  return { valores, pessoas: [...pessoasDoSeletor(pessoas)] };
}

const lerDias = (texto: string) => (/^\d+$/.test(texto.trim()) ? Number(texto.trim()) : null);

export async function salvarConfiguracaoLegal({ encarregado, canal, prazo, validade }: { encarregado: string; canal: string; prazo: string; validade: string }): Promise<void> {
  if (prazo.trim() && lerDias(prazo) === null) throw new ErroDeRegra('O prazo do titular é um número de dias. Vazio deixa pendente.');
  const validadeDias = lerDias(validade);
  if (validadeDias === null) throw new ErroDeRegra('A validade das propostas é um número de dias.');
  const email = canal.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ErroDeRegra('O canal do titular precisa ser um e-mail.');
  await repositorios.configuracao.salvar({ encarregado_pessoa_id: encarregado || null, canal_titular_email: email || null, prazo_resposta_titular_dias: prazo.trim() ? lerDias(prazo) : null, validade_proposta_dias: validadeDias });
}

/** `organizacao.encarregado_texto` (19 §6): sem encarregado definido, fica vazio e aparece como pendência. */
export function textoDoEncarregado(valores: Pick<ValoresConfiguracao, 'encarregado_pessoa_id' | 'canal_titular_email'>, pessoas: readonly Pick<Pessoa, 'id' | 'nome_completo'>[]): string | null {
  const pessoa = pessoas.find((item) => item.id === valores.encarregado_pessoa_id);
  if (!pessoa && !valores.canal_titular_email) return null;
  return [pessoa?.nome_completo, valores.canal_titular_email].filter(Boolean).join(' · ');
}
