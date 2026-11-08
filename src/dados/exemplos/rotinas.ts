import { hojeISO } from '@/lib/datas';
import type { Recorrencia } from '../tipos/recorrencia';
import { controle } from './controle';
import { AREAS_INICIAIS, ID_CAMILA, ID_KIMBERLY, ID_ROTINA_BACKUP, ID_ROTINA_EXEMPLO } from './base';

const idDaArea = (nome: (typeof AREAS_INICIAIS)[number]['nome']) => AREAS_INICIAIS.find((area) => area.nome === nome)?.id ?? null;

type Regra = Pick<Recorrencia, 'titulo' | 'responsavel_id' | 'frequencia'> & Partial<Pick<Recorrencia, 'intervalo' | 'dias_semana' | 'dia_mes' | 'ultimo_dia' | 'mes' | 'situacao'>> & { id: string; area: (typeof AREAS_INICIAIS)[number]['nome'] };

function rotina({ id, area, ...regra }: Regra, inicio: string, exemplo: boolean, agora: string): Recorrencia {
  return {
    ...controle(id, exemplo, agora),
    modelo: { tipo: 'tarefa', descricao: null, area_id: idDaArea(area), prioridade: 'normal', produtos: [], participantes: [], solicitante_pessoa_id: null, solicitante_texto: null, resultado_esperado: null, checklist: [], vinculos: [], arquivos: [] },
    intervalo: 1,
    dias_semana: [],
    dia_mes: null,
    ultimo_dia: false,
    mes: null,
    hora: null,
    inicio,
    fim_data: null,
    fim_ocorrencias: null,
    situacao: 'ativa',
    substitui_id: null,
    ...regra,
  };
}

/**
 * "Rotinas criadas na carga inicial" (T03.05): vêm da especificação, não são exemplo. As das outras
 * fases esperam a fase delas para gerar. O dia da revisão de acessos e o mês da revisão jurídica serão
 * configuráveis quando as telas dessas fases chegarem; até lá valem o dia 1 e janeiro, sem gerar nada.
 */
export function rotinasIniciais(agora: string): Recorrencia[] {
  const hoje = hojeISO(new Date(agora));
  const regras: readonly Regra[] = [
    { id: ID_ROTINA_BACKUP, titulo: 'Exportar backup da Central e salvar no Drive', responsavel_id: ID_CAMILA, frequencia: 'semanal', dias_semana: [1], area: 'Tecnologia' },
    { id: 'f7c1d2e3-4a5b-4c6d-8e7f-9a0b1c2d3e02', titulo: 'Lançar despesas e comprovantes da semana', responsavel_id: ID_KIMBERLY, frequencia: 'semanal', dias_semana: [5], area: 'Financeiro' },
    { id: 'f7c1d2e3-4a5b-4c6d-8e7f-9a0b1c2d3e03', titulo: 'Revisão de acessos às ferramentas', responsavel_id: ID_CAMILA, frequencia: 'mensal', intervalo: 3, dia_mes: 1, area: 'Tecnologia', situacao: 'pausada' },
    { id: 'f7c1d2e3-4a5b-4c6d-8e7f-9a0b1c2d3e04', titulo: 'Atualizar KPIs mensais dos produtos', responsavel_id: ID_KIMBERLY, frequencia: 'mensal', dia_mes: 5, area: 'Produto' },
    { id: 'f7c1d2e3-4a5b-4c6d-8e7f-9a0b1c2d3e05', titulo: 'Fechamento mensal', responsavel_id: ID_KIMBERLY, frequencia: 'mensal', dia_mes: 5, area: 'Financeiro', situacao: 'pausada' },
    { id: 'f7c1d2e3-4a5b-4c6d-8e7f-9a0b1c2d3e06', titulo: 'Revisão jurídica anual dos documentos legais', responsavel_id: ID_KIMBERLY, frequencia: 'anual', dia_mes: 1, mes: 1, area: 'Jurídico e privacidade' },
  ];
  return regras.map((regra) => rotina(regra, hoje, false, agora));
}

function diasAntes(dia: string, dias: number): string {
  const data = new Date(`${dia}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() - dias);
  return data.toISOString().slice(0, 10);
}

/** Começou há 20 dias: a primeira ocorrência já está no Histórico, e a próxima vem com a janela. */
export function rotinaDeExemplo(agora: string): Recorrencia {
  const inicio = diasAntes(hojeISO(new Date(agora)), 20);
  return rotina({ id: ID_ROTINA_EXEMPLO, titulo: 'Conferir o extrato do cartão', responsavel_id: ID_KIMBERLY, frequencia: 'mensal', dia_mes: Number(inicio.slice(8, 10)), area: 'Financeiro' }, inicio, true, agora);
}
