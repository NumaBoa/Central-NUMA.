/** O histórico por extenso das tabelas do M06. Sem importar `historico.ts`, que lê daqui. */
import type { EventoAuditoria } from '@/dados/tipos/auditoria';
import { formatarDiaISO } from '@/lib/formatacao';

type Nomes = ReadonlyMap<string, string>;
type CampoLegivel = { rotulo: string; valor?: (valor: unknown, nomes: Nomes) => string; semValores?: boolean };

const dia = (valor: unknown) => formatarDiaISO(String(valor));
const percentual = (valor: unknown) => `${Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}%`;
const dinheiro = (valor: unknown) => Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pessoa = (valor: unknown, nomes: Nomes) => nomes.get(String(valor)) ?? 'Pessoa removida';
const simNao = (valor: unknown) => (valor ? 'sim' : 'não');
const rotuloDe = (rotulos: Readonly<Record<string, string>>) => (valor: unknown) => rotulos[String(valor)] ?? String(valor);

const SITUACOES_DA_VERSAO = { rascunho: 'Rascunho', em_revisao: 'Em revisão', aguardando_assinaturas: 'Aguardando assinaturas', vigente: 'Vigente', substituida: 'Substituída', cancelada: 'Cancelada' };
const SITUACOES_DO_ITEM = { a_fazer: 'A fazer', em_andamento: 'Em andamento', concluido: 'Concluído', nao_se_aplica: 'Não se aplica' };
const SITUACOES_DO_PROCESSO = { planejado: 'Planejado', protocolado: 'Protocolado', em_exame: 'Em exame', publicado: 'Publicado', oposicao: 'Oposição', exigencia: 'Exigência', deferido: 'Deferido', registrado: 'Registrado', indeferido: 'Indeferido', arquivado: 'Arquivado' };

export const CAMPOS_LEGIVEIS_M06: Readonly<Record<string, Readonly<Record<string, CampoLegivel>>>> = {
  socia: {
    participacao: { rotulo: 'Participação', valor: percentual },
    entrada_em: { rotulo: 'Data de entrada', valor: dia },
    saida_em: { rotulo: 'Data de saída', valor: dia },
    acordo_versao_id: { rotulo: 'Acordo de fundamento', semValores: true },
    decisao_id: { rotulo: 'Decisão de fundamento', semValores: true },
  },
  acordo_societario: {
    titulo: { rotulo: 'Título' },
    tipo: { rotulo: 'Tipo', valor: rotuloDe({ memorando: 'Memorando de entendimento', acordo_socias: 'Acordo de sócias', ata: 'Ata', cessao_pi: 'Termo de cessão de PI', alteracao_contratual: 'Alteração contratual', outro: 'Outro' }) },
    versao_vigente_id: { rotulo: 'Versão vigente', semValores: true },
  },
  acordo_versao: {
    situacao: { rotulo: 'Situação', valor: rotuloDe(SITUACOES_DA_VERSAO) },
    resumo: { rotulo: 'Resumo estruturado', semValores: true },
    titularidade_numa: { rotulo: 'Titularidade na Numa', valor: simNao },
    arquivo_url: { rotulo: 'Arquivo assinado', semValores: true },
    data_assinatura: { rotulo: 'Data de assinatura', valor: dia },
    revisao_prevista: { rotulo: 'Revisão prevista', valor: dia },
    cancelada_motivo: { rotulo: 'Motivo do cancelamento' },
  },
  marca_processo: {
    classes: { rotulo: 'Classes' },
    apresentacao: { rotulo: 'Apresentação', valor: rotuloDe({ nominativa: 'Nominativa', mista: 'Mista', figurativa: 'Figurativa' }) },
    titular_entidade_id: { rotulo: 'Titular', semValores: true },
    numero_processo: { rotulo: 'Número do processo' },
    data_deposito: { rotulo: 'Data do depósito', valor: dia },
    situacao: { rotulo: 'Situação', valor: rotuloDe(SITUACOES_DO_PROCESSO) },
    procurador_id: { rotulo: 'Procurador', semValores: true },
    observacoes: { rotulo: 'Observações', semValores: true },
  },
  marca_prazo: {
    descricao: { rotulo: 'Descrição' },
    data_limite: { rotulo: 'Data-limite', valor: dia },
    responsavel_id: { rotulo: 'Responsável', valor: pessoa },
    cumprido_em: { rotulo: 'Cumprido em', valor: dia },
  },
  constituicao_item: {
    titulo: { rotulo: 'Título' },
    descricao: { rotulo: 'Descrição', semValores: true },
    depende_de: { rotulo: 'Dependências', semValores: true },
    exige_evidencia: { rotulo: 'Exige evidência', valor: simNao },
    responsavel_tipo: { rotulo: 'Quem cuida', valor: rotuloDe({ pessoa: 'Uma pessoa', ambas: 'Ambas', contador: 'Contador' }) },
    responsavel_id: { rotulo: 'Responsável', valor: pessoa },
    prazo: { rotulo: 'Prazo', valor: dia },
    situacao: { rotulo: 'Situação', valor: rotuloDe(SITUACOES_DO_ITEM) },
    evidencia_url: { rotulo: 'Evidência', semValores: true },
    evidencia_registro_id: { rotulo: 'Evidência', semValores: true },
    motivo_nao_aplica: { rotulo: 'Motivo de não se aplicar' },
    concluido_em: { rotulo: 'Concluído em', valor: dia },
  },
  obrigacao_corporativa: {
    nome: { rotulo: 'Nome' },
    descricao: { rotulo: 'Descrição', semValores: true },
    orgao: { rotulo: 'Órgão' },
    periodicidade: { rotulo: 'Periodicidade', valor: rotuloDe({ mensal: 'Mensal', trimestral: 'Trimestral', anual: 'Anual', outra: 'Outra' }) },
    vencimento_base: { rotulo: 'Próximo vencimento', valor: dia },
    antecedencia_dias: { rotulo: 'Antecedência em dias' },
    responsavel_id: { rotulo: 'Responsável', valor: pessoa },
    gera_titulo: { rotulo: 'Gera título', valor: simNao },
    valor_estimado: { rotulo: 'Valor estimado', valor: dinheiro },
    situacao: { rotulo: 'Situação', valor: rotuloDe({ rascunho: 'Rascunho', ativa: 'Ativa', encerrada: 'Encerrada' }) },
  },
  obrigacao_corporativa_ocorrencia: {
    cumprida_em: { rotulo: 'Cumprida em', valor: dia },
    comprovante_url: { rotulo: 'Comprovante', semValores: true },
    titulo_id: { rotulo: 'Título vinculado', semValores: true },
    observacao: { rotulo: 'Observação', semValores: true },
  },
  reuniao: {
    titulo: { rotulo: 'Título' },
    data_hora: { rotulo: 'Data e hora', semValores: true },
    produto_id: { rotulo: 'Contexto', semValores: true },
    pauta: { rotulo: 'Pauta', semValores: true },
    notas: { rotulo: 'Notas', semValores: true },
  },
};

const textoDe = (valor: unknown) => (typeof valor === 'string' && valor ? valor : undefined);

/** Como cada registro do M06 aparece na frase do histórico. */
export function registroPorExtensoM06(evento: EventoAuditoria, nomes: Nomes): string | undefined {
  const id = evento.registro_id ?? '';
  const depois = evento.depois;
  const antes = evento.antes;
  const campo = (nome: string) => textoDe(depois?.[nome]) ?? textoDe(antes?.[nome]);
  switch (evento.tabela) {
    case 'socia':
      return `a participação de ${nomes.get(campo('pessoa_id') ?? '') ?? nomes.get(id) ?? 'uma sócia'}`;
    case 'socia_participacao_historico':
      return `o histórico de participação de ${nomes.get(campo('pessoa_id') ?? '') ?? 'uma sócia'}`;
    case 'acordo_societario':
      return `o acordo ${campo('titulo') ?? nomes.get(id) ?? ''}`.trim();
    case 'acordo_versao':
      return nomes.get(id) ? `a versão ${nomes.get(id)}` : depois?.numero ? `a versão V${String(depois.numero)} do acordo` : 'uma versão do acordo';
    case 'acordo_assinatura':
      return `a confirmação de ${nomes.get(campo('pessoa_id') ?? '') ?? 'uma sócia'}`;
    case 'marca_pesquisa':
      return 'uma pesquisa de marca';
    case 'marca_processo':
      return `o processo de marca ${campo('classes') ? `da classe ${campo('classes')}` : ''}`.trim();
    case 'marca_prazo':
      return `o prazo ${campo('descricao') ?? ''}`.trim();
    case 'constituicao_item':
      return `o item ${campo('titulo') ?? nomes.get(id) ?? ''} da constituição`.replace(/\s+/g, ' ');
    case 'obrigacao_corporativa':
      return `a obrigação ${campo('nome') ?? nomes.get(id) ?? ''}`.trim();
    case 'obrigacao_corporativa_ocorrencia':
      return campo('vencimento') ? `a ocorrência de ${formatarDiaISO(campo('vencimento') as string)}` : 'uma ocorrência';
    case 'reuniao':
      return `a reunião ${campo('titulo') ?? nomes.get(id) ?? ''}`.trim();
    case 'reuniao_participante':
      return `${nomes.get(campo('pessoa_id') ?? '') ?? 'alguém'} na reunião`;
    default:
      return undefined;
  }
}
