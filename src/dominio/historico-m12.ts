/**
 * Os campos do M12 por extenso, para o histórico (CLAUDE.md, "Como acrescentar uma tabela", item 7).
 * Sem importar `historico.ts`, que espalha este objeto no dele.
 */
import { formatarDataHora, formatarDiaISO } from '@/lib/formatacao';

type Nomes = ReadonlyMap<string, string>;
type CampoLegivel = { rotulo: string; valor?: (valor: unknown, nomes: Nomes) => string; semValores?: boolean };

const dia = (valor: unknown) => formatarDiaISO(String(valor));
const instante = (valor: unknown) => formatarDataHora(String(valor));
const pessoa = (valor: unknown, nomes: Nomes) => nomes.get(String(valor)) ?? 'pessoa removida';
const produto = (valor: unknown, nomes: Nomes) => nomes.get(String(valor)) ?? 'produto removido';
const de = (rotulos: Readonly<Record<string, string>>) => (valor: unknown) => rotulos[String(valor)] ?? String(valor);
const horas = (valor: unknown) => `${String(valor).replace('.', ',')} h`;

const SITUACOES_IMPLANTACAO = { nao_iniciada: 'Não iniciada', em_andamento: 'Em andamento', em_validacao: 'Em validação', entregue: 'Entregue', acompanhamento: 'Em acompanhamento', concluida: 'Concluída', suspensa: 'Suspensa', cancelada: 'Cancelada' };
const SITUACOES_SUPORTE = { aberta: 'Aberta', em_atendimento: 'Em atendimento', aguardando_cliente: 'Aguardando cliente', aguardando_proposta: 'Aguardando proposta', resolvida: 'Resolvida', fechada: 'Fechada', cancelada: 'Cancelada' };
const TIPOS_SUPORTE = { falha: 'Falha', duvida: 'Dúvida ou suporte', melhoria_incluida: 'Melhoria incluída no contrato', novo_escopo: 'Novo escopo' };
const PRIORIDADES = { baixa: 'Baixa', normal: 'Normal', alta: 'Alta', critica: 'Crítica' };
const IMPACTOS = { total: 'Total', parcial: 'Parcial', degradado: 'Degradado' };

export const CAMPOS_LEGIVEIS_M12: Readonly<Record<string, Readonly<Record<string, CampoLegivel>>>> = {
  implantacao: {
    responsavel_id: { rotulo: 'Responsável', valor: pessoa },
    situacao: { rotulo: 'Situação', valor: de(SITUACOES_IMPLANTACAO) },
    entrega_planejada: { rotulo: 'Entrega planejada', valor: dia },
    entrega_realizada: { rotulo: 'Entrega realizada', valor: dia },
    horas_estimadas: { rotulo: 'Horas estimadas', valor: horas },
    prazo_estimado_dias: { rotulo: 'Prazo estimado', valor: (valor) => `${String(valor)} dias` },
    aceite_em: { rotulo: 'Aceite', valor: dia },
    aceite_por_texto: { rotulo: 'Aceito por' },
    aceite_evidencia_url: { rotulo: 'Evidência do aceite', semValores: true },
    interrupcao: { rotulo: 'Suspensão ou cancelamento', valor: (valor) => (valor && typeof valor === 'object' ? `${(valor as { tipo: string }).tipo === 'suspensa' ? 'suspensa' : 'cancelada'}: ${(valor as { motivo: string }).motivo}` : 'nenhum') },
    concluida_em: { rotulo: 'Concluída em', valor: dia },
    observacoes: { rotulo: 'Observações', semValores: true },
  },
  implantacao_marco: {
    planejado_em: { rotulo: 'Data planejada', valor: dia },
    realizado_em: { rotulo: 'Data realizada', valor: dia },
    nao_se_aplica: { rotulo: 'Não se aplica', valor: (valor) => (valor ? 'sim' : 'não') },
    observacao: { rotulo: 'Observação', semValores: true },
  },
  sla_regra: {
    resposta_horas: { rotulo: 'Primeira resposta', valor: horas },
    resolucao_horas: { rotulo: 'Resolução', valor: horas },
    contagem: { rotulo: 'Contagem', valor: de({ horas_uteis: 'horas úteis', horas_corridas: 'horas corridas' }) },
    horario_inicio: { rotulo: 'Início do atendimento' },
    horario_fim: { rotulo: 'Fim do atendimento' },
    disponibilidade_minima: { rotulo: 'Disponibilidade mínima', valor: (valor) => `${String(valor).replace('.', ',')}%` },
    creditos: { rotulo: 'Créditos por descumprimento', semValores: true },
  },
  solicitacao_suporte: {
    titulo: { rotulo: 'Título' },
    descricao: { rotulo: 'Descrição', semValores: true },
    tipo: { rotulo: 'Tipo', valor: de(TIPOS_SUPORTE) },
    prioridade: { rotulo: 'Prioridade', valor: de(PRIORIDADES) },
    situacao: { rotulo: 'Situação', valor: de(SITUACOES_SUPORTE) },
    responsavel_id: { rotulo: 'Responsável', valor: pessoa },
    produto_id: { rotulo: 'Produto', valor: produto },
    primeira_resposta_em: { rotulo: 'Primeira resposta', valor: instante },
    resolvida_em: { rotulo: 'Resolvida em', valor: instante },
    solucao: { rotulo: 'Solução', semValores: true },
  },
  incidente_disponibilidade: {
    titulo: { rotulo: 'Título' },
    inicio: { rotulo: 'Início', valor: instante },
    fim: { rotulo: 'Fim', valor: instante },
    impacto: { rotulo: 'Impacto', valor: de(IMPACTOS) },
    causa: { rotulo: 'Causa', semValores: true },
    acoes: { rotulo: 'Ações', semValores: true },
    comunicado: { rotulo: 'Comunicado aos clientes', valor: (valor) => (valor ? 'sim' : 'não') },
    envolve_dados_pessoais: { rotulo: 'Envolve dados pessoais', valor: (valor) => (valor ? 'sim' : 'não') },
  },
  apontamento_horas: {
    data: { rotulo: 'Data', valor: dia },
    horas: { rotulo: 'Horas', valor: horas },
    produto_id: { rotulo: 'Contexto', valor: produto },
    descricao: { rotulo: 'Descrição', semValores: true },
  },
  nota_liberacao: {
    versao: { rotulo: 'Versão' },
    data: { rotulo: 'Data', valor: dia },
    publico: { rotulo: 'Público', valor: de({ interno: 'Interno', clientes: 'Clientes', todos: 'Todos' }) },
    situacao: { rotulo: 'Situação', valor: de({ rascunho: 'Rascunho', publicada: 'Publicada' }) },
  },
};
