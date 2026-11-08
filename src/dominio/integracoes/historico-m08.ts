/**
 * O histórico por extenso das tabelas do M08 (CLAUDE.md, passo 7). À parte para não disputar linhas em
 * `historico.ts`, que só espalha estes registros. Sem importações do domínio, para não criar ciclo.
 */
import { formatarDiaISO } from '@/lib/formatacao';

type Campo = { rotulo: string; valor?: (valor: unknown, nomes: ReadonlyMap<string, string>) => string; semValores?: boolean };
type Evento = { tabela: string | null; depois: Record<string, unknown> | null; antes: Record<string, unknown> | null };

const dia = (valor: unknown) => formatarDiaISO(String(valor));
const pessoa = (valor: unknown, nomes: ReadonlyMap<string, string>) => nomes.get(String(valor)) ?? 'pessoa removida';
const simNao = (valor: unknown) => (valor ? 'Sim' : 'Não');
const classe = (valor: unknown) => String(valor).toUpperCase();

export const CAMPOS_LEGIVEIS_M08: Readonly<Record<string, Readonly<Record<string, Campo>>>> = {
  arquivo: {
    titulo: { rotulo: 'Título' },
    tipo: { rotulo: 'Tipo' },
    descricao: { rotulo: 'Descrição', semValores: true },
    classe: { rotulo: 'Classe', valor: classe },
    pasta_restrita_confirmada: { rotulo: 'Pasta restrita confirmada', valor: simNao },
    versao_atual: { rotulo: 'Versão atual' },
    origem_autor: { rotulo: 'Origem ou autor' },
    direitos_uso: { rotulo: 'Direitos de uso' },
    direitos_validade: { rotulo: 'Validade dos direitos', valor: dia },
    responsavel_id: { rotulo: 'Responsável', valor: pessoa },
    finalidade: { rotulo: 'Finalidade' },
    publico: { rotulo: 'Público' },
    data_uso: { rotulo: 'Data de uso', valor: dia },
    contem_precos: { rotulo: 'Contém preços', valor: simNao },
    precos_data: { rotulo: 'Data dos preços', valor: dia },
    contem_fin: { rotulo: 'Contém dados FIN', valor: simNao },
  },
  marca_identidade: {
    proposta: { rotulo: 'Proposta' },
    publico: { rotulo: 'Público' },
    personalidade: { rotulo: 'Personalidade' },
    tom_faca: { rotulo: 'Tom de voz: faça', semValores: true },
    tom_nao_faca: { rotulo: 'Tom de voz: não faça', semValores: true },
    frases: { rotulo: 'Frases-chave', semValores: true },
    paleta: { rotulo: 'Paleta', semValores: true },
    tipografia: { rotulo: 'Tipografia', semValores: true },
    manual_url: { rotulo: 'Manual completo', semValores: true },
  },
  campanha: {
    nome: { rotulo: 'Nome' },
    objetivo: { rotulo: 'Objetivo', semValores: true },
    publico: { rotulo: 'Público', semValores: true },
    canais: { rotulo: 'Canais', semValores: true },
    inicio: { rotulo: 'Início', valor: dia },
    fim: { rotulo: 'Fim', valor: dia },
    orcamento: { rotulo: 'Orçamento' },
    responsavel_id: { rotulo: 'Responsável', valor: pessoa },
    situacao: { rotulo: 'Situação' },
    resultados: { rotulo: 'Resultados', semValores: true },
  },
  peca_conteudo: {
    titulo: { rotulo: 'Título' },
    canal: { rotulo: 'Canal' },
    formato: { rotulo: 'Formato' },
    data_prevista: { rotulo: 'Data prevista', valor: dia },
    situacao: { rotulo: 'Situação' },
    responsavel_id: { rotulo: 'Responsável', valor: pessoa },
    texto: { rotulo: 'Texto', semValores: true },
    link_publicacao: { rotulo: 'Link da publicação', semValores: true },
    publicado_em: { rotulo: 'Data realizada', valor: dia },
    resultados: { rotulo: 'Resultados', semValores: true },
    medido_em: { rotulo: 'Data da medição', valor: dia },
    cancelado_motivo: { rotulo: 'Motivo do cancelamento' },
  },
  lista_espera: {
    nome: { rotulo: 'Nome' },
    situacao: { rotulo: 'Situação' },
  },
  inscrito: {
    // Dado pessoal (RN-08.10): o histórico diz que mudou, sem repetir o conteúdo.
    nome: { rotulo: 'Nome', semValores: true },
    email: { rotulo: 'E-mail', semValores: true },
    situacao: { rotulo: 'Situação' },
    consentido_em: { rotulo: 'Data do consentimento', valor: dia },
    descadastrado_em: { rotulo: 'Data do descadastro', valor: dia },
    convidado_em: { rotulo: 'Data do convite', valor: dia },
    convertido_em: { rotulo: 'Data da conversão', valor: dia },
  },
};

const texto = (valor: unknown) => (typeof valor === 'string' && valor ? valor : undefined);

/** Como chamar o registro na frase. E-mails e nomes de inscritos ficam de fora: são dados pessoais. */
export function registroPorExtensoM08({ tabela, depois, antes }: Evento): string | undefined {
  const nome = (campo: string) => texto(depois?.[campo]) ?? texto(antes?.[campo]);
  switch (tabela) {
    case 'arquivo':
      return nome('titulo') && `o arquivo ${nome('titulo')}`;
    case 'arquivo_versao':
      return `a versão ${String(depois?.versao ?? antes?.versao ?? '')} de um arquivo`.replace('  ', ' ');
    case 'arquivo_contexto':
      return 'o contexto de um arquivo';
    case 'arquivo_vinculo':
      return 'um vínculo de arquivo';
    case 'marca_identidade':
      return 'a identidade de uma marca';
    case 'campanha':
      return nome('nome') && `a campanha ${nome('nome')}`;
    case 'peca_conteudo':
      return nome('titulo') && `a peça ${nome('titulo')}`;
    case 'lista_espera':
      return nome('nome') && `a lista ${nome('nome')}`;
    case 'consentimento_texto':
      return `a versão ${String(depois?.versao ?? antes?.versao ?? '')} do texto de consentimento`.replace('  ', ' ');
    case 'inscrito':
      return 'um inscrito';
    default:
      return undefined;
  }
}

/** A frase de uma exportação de inscritos: quantos e de qual lista, nunca quem (RN-08.10). */
export function fraseDaExportacaoM08(depois: Record<string, unknown> | null): string | null {
  if (depois?.funcao !== 'exportar_inscritos') return null;
  const quantidade = Number(depois.quantidade ?? 0);
  return `exportou ${quantidade} ${quantidade === 1 ? 'inscrito' : 'inscritos'} da lista ${String(depois.lista ?? '')}`.trim();
}

export function fraseDaImportacaoM08(depois: Record<string, unknown> | null): string | null {
  if (depois?.funcao !== 'importar_inscritos') return null;
  const novos = Number(depois.novos ?? 0);
  const consentimentos = Number(depois.consentimentos ?? 0);
  const mantidos = Number(depois.descadastrados_mantidos ?? 0);
  const partes = [`${novos} ${novos === 1 ? 'novo' : 'novos'}`, consentimentos ? `${consentimentos} com consentimento registrado` : null, mantidos ? `${mantidos} descadastrados mantidos` : null].filter(Boolean);
  return `importou inscritos: ${partes.join(', ')}`;
}
