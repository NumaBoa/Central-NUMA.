/** Regras de T02.01 (04-M02): formulário em seções e o que a tela precisa carregar. */
import { alinharRotinaDoBackup } from './recorrencias';
import { z } from 'zod';
import { ErroDeDados } from '@/dados/erros';
import { FUSOS } from '@/dados/fuso';
import { carregarMunicipios } from '@/dados/referencia/municipios';
import { repositorios } from '@/dados/repositorios';
import type { ValoresConfiguracao } from '@/dados/tipos/configuracao';
import type { Pessoa } from '@/dados/tipos/pessoa';
import { listarCambios } from './cambio';
import { linkDoDriveValido, MENSAGEM_LINK_DRIVE } from './link-drive';
import { pessoasDoSeletor } from './pessoa-atual';

export const lerConfiguracoes = (): Promise<ValoresConfiguracao> => repositorios.configuracao.ler();

/** Até 4 dígitos: antecedências de dias, nunca negativas nem com casas decimais. */
const antecedencia = (mensagem: string) => z.string().trim().regex(/^\d{1,4}$/, mensagem);

const opcional = (valido: (valor: string) => boolean, mensagem: string) =>
  z
    .string()
    .trim()
    .refine((valor) => !valor || valido(valor), mensagem);

/** Mensagens da T02.01 aprovada. Todo campo é texto na tela; a conversão vem em `valoresDoFormulario`. */
export const esquemaFormularioGeral = z.object({
  organizacao_nome: z.string().trim().min(1, 'Informe o nome da organização.'),
  organizacao_email: opcional((valor) => z.email().safeParse(valor).success, 'Informe um e-mail válido.'),
  organizacao_logo_url: opcional(linkDoDriveValido, MENSAGEM_LINK_DRIVE),
  fuso: z.enum(FUSOS, 'Escolha o fuso horário.'),
  moeda_padrao: z.string().regex(/^[A-Z]{3}$/, 'Escolha a moeda padrão.'),
  uf_padrao: z.string(),
  municipio_padrao: z.string(),
  alerta_vencimento_dias: antecedencia('Informe a antecedência de vencimentos, em dias.'),
  alerta_renovacao_ferramenta_dias: antecedencia('Informe a antecedência de renovações, em dias.'),
  alerta_fim_teste_dias: antecedencia('Informe a antecedência do fim de testes, em dias.'),
  alerta_dominio_dias: antecedencia('Informe a antecedência de domínios, em dias.'),
  responsavel_backup_id: z.string().min(1, 'Escolha a pessoa responsável pelo backup.'),
});

export type FormularioGeral = z.infer<typeof esquemaFormularioGeral>;

/** Decisão de 05/11/2026: todas as pessoas internas ativas. É a mesma lista de "Você é" (02 §0.4). */
export const pessoasParaBackup = pessoasDoSeletor;

/** A pessoa escolhida pode ter saído da lista, por exemplo ao limpar os exemplos. */
export function responsavelDisponivel(id: string, pessoas: readonly Pessoa[]): boolean {
  return pessoasParaBackup(pessoas).some((pessoa) => pessoa.id === id);
}

/** Se a responsável saiu da lista, o campo fica vazio: a tela avisa e pede outra, sem trocar sozinha. */
export function formularioDosValores(valores: ValoresConfiguracao, pessoas: readonly Pessoa[]): FormularioGeral {
  return {
    organizacao_nome: valores.organizacao_nome,
    organizacao_email: valores.organizacao_email ?? '',
    organizacao_logo_url: valores.organizacao_logo_url ?? '',
    fuso: valores.fuso,
    moeda_padrao: valores.moeda_padrao,
    uf_padrao: valores.uf_padrao ?? '',
    municipio_padrao: valores.municipio_padrao ?? '',
    alerta_vencimento_dias: String(valores.alerta_vencimento_dias),
    alerta_renovacao_ferramenta_dias: String(valores.alerta_renovacao_ferramenta_dias),
    alerta_fim_teste_dias: String(valores.alerta_fim_teste_dias),
    alerta_dominio_dias: String(valores.alerta_dominio_dias),
    responsavel_backup_id: responsavelDisponivel(valores.responsavel_backup_id, pessoas) ? valores.responsavel_backup_id : '',
  };
}

/** Vazio é vazio, não texto em branco nem zero (RT-08). Sem estado, não há município. */
export function valoresDoFormulario(formulario: FormularioGeral): Partial<ValoresConfiguracao> {
  const { uf_padrao: uf, municipio_padrao: municipio } = formulario;
  return {
    organizacao_nome: formulario.organizacao_nome,
    organizacao_email: formulario.organizacao_email || null,
    organizacao_logo_url: formulario.organizacao_logo_url || null,
    fuso: formulario.fuso,
    moeda_padrao: formulario.moeda_padrao,
    uf_padrao: uf || null,
    municipio_padrao: uf && municipio ? municipio : null,
    alerta_vencimento_dias: Number(formulario.alerta_vencimento_dias),
    alerta_renovacao_ferramenta_dias: Number(formulario.alerta_renovacao_ferramenta_dias),
    alerta_fim_teste_dias: Number(formulario.alerta_fim_teste_dias),
    alerta_dominio_dias: Number(formulario.alerta_dominio_dias),
    responsavel_backup_id: formulario.responsavel_backup_id,
  };
}

/** Grava o formulário inteiro de uma vez. Devolve quantas configurações mudaram. */
export async function salvarFormularioGeral(formulario: FormularioGeral): Promise<number> {
  if (!responsavelDisponivel(formulario.responsavel_backup_id, await repositorios.pessoa.listar())) throw new ErroDeDados('validacao');
  const alteradas = await repositorios.configuracao.salvar(valoresDoFormulario(formulario));
  await alinharRotinaDoBackup(formulario.responsavel_backup_id);
  return alteradas.length;
}


// ---------- Tela ----------

/** Tudo o que a tela mostra, lido de uma vez: ou ela abre inteira, ou mostra o erro. */
export async function carregarTelaGeral() {
  const [configuracoes, pessoas, cambios, municipios] = await Promise.all([lerConfiguracoes(), repositorios.pessoa.listar(), listarCambios(), carregarMunicipios()]);
  return { configuracoes, pessoas, cambios, municipios };
}

export type DadosDaTelaGeral = Awaited<ReturnType<typeof carregarTelaGeral>>;
