/** A regra de repetição (RN-03.15 e RN-03.16): datas, texto por extenso e o componente de recorrência. */
import { z } from 'zod';
import type { Recorrencia } from '@/dados/tipos/recorrencia';
import { formatarDiaISO } from '@/lib/formatacao';

export type RegraDeRepeticao = Pick<Recorrencia, 'frequencia' | 'intervalo' | 'dias_semana' | 'dia_mes' | 'ultimo_dia' | 'mes' | 'hora' | 'inicio' | 'fim_data' | 'fim_ocorrencias'>;

export const ROTULOS_FREQUENCIA = { diaria: 'Diária', semanal: 'Semanal', mensal: 'Mensal', anual: 'Anual' } as const;

/** Segunda primeiro, como no calendário da Numa. O valor é o de `Date.getUTCDay`: domingo é 0. */
export const DIAS_DA_SEMANA = [
  { valor: 1, curto: 'Seg', nome: 'segunda', artigo: 'Toda' },
  { valor: 2, curto: 'Ter', nome: 'terça', artigo: 'Toda' },
  { valor: 3, curto: 'Qua', nome: 'quarta', artigo: 'Toda' },
  { valor: 4, curto: 'Qui', nome: 'quinta', artigo: 'Toda' },
  { valor: 5, curto: 'Sex', nome: 'sexta', artigo: 'Toda' },
  { valor: 6, curto: 'Sáb', nome: 'sábado', artigo: 'Todo' },
  { valor: 0, curto: 'Dom', nome: 'domingo', artigo: 'Todo' },
] as const;

export const NOMES_DOS_MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'] as const;

// ---------- Datas ----------

const doisDigitos = (numero: number) => String(numero).padStart(2, '0');

export function somarDias(dia: string, dias: number): string {
  const data = new Date(`${dia}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

function diasNoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/** RN-03.16: mês sem o dia escolhido cai no último dia. */
function diaNoMes(ano: number, mes: number, regra: Pick<RegraDeRepeticao, 'dia_mes' | 'ultimo_dia'>): string {
  const ultimo = diasNoMes(ano, mes);
  return `${ano}-${doisDigitos(mes)}-${doisDigitos(regra.ultimo_dia ? ultimo : Math.min(regra.dia_mes ?? 1, ultimo))}`;
}

/** As datas da regra, em ordem, do início até `ate`. A posição de cada uma é o número da ocorrência. */
export function datasDaRegra(regra: RegraDeRepeticao, ate: string): string[] {
  const limite = regra.fim_data && regra.fim_data < ate ? regra.fim_data : ate;
  const datas: string[] = [];
  const cabe = () => !regra.fim_ocorrencias || datas.length < regra.fim_ocorrencias;
  const incluir = (dia: string) => {
    if (dia >= regra.inicio && dia <= limite && cabe()) datas.push(dia);
  };
  const intervalo = Math.max(1, regra.intervalo);
  const anoInicial = Number(regra.inicio.slice(0, 4));

  if (regra.frequencia === 'diaria') {
    for (let dia = regra.inicio; dia <= limite && cabe(); dia = somarDias(dia, intervalo)) incluir(dia);
  } else if (regra.frequencia === 'semanal') {
    const depoisDaSegunda = [...regra.dias_semana].map((dia) => (dia + 6) % 7).sort((a, b) => a - b);
    const segunda = somarDias(regra.inicio, -((new Date(`${regra.inicio}T00:00:00Z`).getUTCDay() + 6) % 7));
    for (let semana = segunda; semana <= limite && cabe(); semana = somarDias(semana, 7 * intervalo)) {
      for (const dias of depoisDaSegunda) incluir(somarDias(semana, dias));
    }
  } else if (regra.frequencia === 'mensal') {
    let mes = Number(regra.inicio.slice(5, 7)) - 1 + 12 * anoInicial;
    for (;;) {
      const ano = Math.floor(mes / 12);
      const mesDoAno = (mes % 12) + 1;
      if (`${ano}-${doisDigitos(mesDoAno)}-01` > limite || !cabe()) break;
      incluir(diaNoMes(ano, mesDoAno, regra));
      mes += intervalo;
    }
  } else {
    for (let ano = anoInicial; `${ano}-01-01` <= limite && cabe(); ano += intervalo) incluir(diaNoMes(ano, regra.mes ?? 1, regra));
  }
  return datas;
}

/** Até onde olhar para achar `quantas` datas, sem percorrer o futuro inteiro de uma regra sem fim. */
function horizonte(regra: RegraDeRepeticao, quantas: number): number {
  const passo = { diaria: 1, semanal: 7, mensal: 31, anual: 366 }[regra.frequencia];
  return passo * Math.max(1, regra.intervalo) * (quantas + 1);
}

export function proximasDatas(regra: RegraDeRepeticao, desde: string, quantas: number): string[] {
  const inicio = desde > regra.inicio ? desde : regra.inicio;
  return datasDaRegra(regra, somarDias(inicio, horizonte(regra, quantas)))
    .filter((dia) => dia >= desde)
    .slice(0, quantas);
}

/** `null` quando a regra terminou. */
export function proximaData(regra: RegraDeRepeticao, desde: string): string | null {
  return proximasDatas(regra, desde, 1)[0] ?? null;
}

// ---------- Por extenso ----------

/** "às 9h" ou "às 9h30". */
function horaPorExtenso(hora: string): string {
  const [horas, minutos] = hora.split(':');
  return `às ${Number(horas)}h${minutos === '00' ? '' : minutos}`;
}

function juntar(partes: readonly string[]): string {
  if (partes.length < 2) return partes.join('');
  return `${partes.slice(0, -1).join(', ')} e ${partes.at(-1)}`;
}

function diasPorExtenso(diasSemana: readonly number[], intervalo: number): string {
  const dias = DIAS_DA_SEMANA.filter((dia) => diasSemana.includes(dia.valor));
  if (intervalo > 1) return `A cada ${intervalo} semanas, ${juntar(dias.map((dia) => `${dia.artigo === 'Toda' ? 'na' : 'no'} ${dia.nome}`))}`;
  if (dias.length === 7) return 'Todo dia';
  if (dias.length === 5 && dias.every((dia) => dia.artigo === 'Toda')) return 'De segunda a sexta';
  // "Toda segunda e quarta"; só repete o artigo quando ele muda: "Toda sexta e todo sábado".
  const partes = dias.map((dia, indice) => {
    if (indice === 0) return `${dia.artigo} ${dia.nome}`;
    return dia.artigo === dias[indice - 1]?.artigo ? dia.nome : `${dia.artigo.toLowerCase()} ${dia.nome}`;
  });
  return juntar(partes);
}

function diaDoMesPorExtenso(regra: Pick<RegraDeRepeticao, 'dia_mes' | 'ultimo_dia' | 'mes'>): string {
  const mes = regra.mes ? NOMES_DOS_MESES[regra.mes - 1] : '';
  return regra.ultimo_dia ? `no último dia de ${mes}` : `em ${regra.dia_mes} de ${mes}`;
}

/** "Toda segunda às 9h", "Todo último dia do mês", "A cada 3 meses, no dia 5". */
export function regraPorExtenso(regra: Pick<RegraDeRepeticao, 'frequencia' | 'intervalo' | 'dias_semana' | 'dia_mes' | 'ultimo_dia' | 'mes' | 'hora'>): string {
  const { frequencia, intervalo } = regra;
  const principal = (() => {
    if (frequencia === 'diaria') return intervalo > 1 ? `A cada ${intervalo} dias` : 'Todo dia';
    if (frequencia === 'semanal') return diasPorExtenso(regra.dias_semana, intervalo);
    if (frequencia === 'mensal') {
      if (intervalo > 1) return `A cada ${intervalo} meses, ${regra.ultimo_dia ? 'no último dia' : `no dia ${regra.dia_mes}`}`;
      return regra.ultimo_dia ? 'Todo último dia do mês' : `Dia ${regra.dia_mes} de cada mês`;
    }
    return `${intervalo > 1 ? `A cada ${intervalo} anos` : 'Todo ano'}, ${diaDoMesPorExtenso(regra)}`;
  })();
  return regra.hora ? `${principal} ${horaPorExtenso(regra.hora)}` : principal;
}

/** "até 31/12/2026" ou "por 12 vezes". Sem fim, nada a dizer. */
export function fimPorExtenso(regra: Pick<RegraDeRepeticao, 'fim_data' | 'fim_ocorrencias'>): string | null {
  if (regra.fim_data) return `até ${formatarDiaISO(regra.fim_data)}`;
  if (regra.fim_ocorrencias) return regra.fim_ocorrencias === 1 ? 'só uma vez' : `por ${regra.fim_ocorrencias} vezes`;
  return null;
}

/** CA-03.10: o formulário informa o que acontece nos meses sem o dia escolhido. */
export function avisoDoDia(regra: Pick<RegraDeRepeticao, 'frequencia' | 'dia_mes' | 'ultimo_dia' | 'mes'>): string | null {
  if (regra.ultimo_dia || !regra.dia_mes) return null;
  if (regra.frequencia === 'mensal' && regra.dia_mes >= 29) return `Nos meses sem o dia ${regra.dia_mes}, a ocorrência cai no último dia do mês.`;
  if (regra.frequencia === 'anual' && regra.mes === 2 && regra.dia_mes === 29) return 'Nos anos sem 29 de fevereiro, a ocorrência cai no dia 28.';
  return null;
}

// ---------- O componente de recorrência (02 §5) ----------

export const esquemaCamposRepeticao = z.object({
  frequencia: z.enum(['diaria', 'semanal', 'mensal', 'anual']),
  intervalo: z.string(),
  dias_semana: z.array(z.number()),
  modo_mes: z.enum(['dia', 'ultimo']),
  dia_mes: z.string(),
  mes: z.string(),
  hora: z.string(),
  inicio: z.string(),
  fim: z.enum(['sem', 'data', 'vezes']),
  fim_data: z.string(),
  fim_ocorrencias: z.string(),
});

export type FormularioRepeticao = z.infer<typeof esquemaCamposRepeticao>;

/** O ponto de partida: toda semana, no mesmo dia da semana do início. */
export function repeticaoPadrao(inicio: string): FormularioRepeticao {
  return {
    frequencia: 'semanal',
    intervalo: '1',
    dias_semana: [new Date(`${inicio}T00:00:00Z`).getUTCDay()],
    modo_mes: 'dia',
    dia_mes: String(Number(inicio.slice(8, 10))),
    mes: String(Number(inicio.slice(5, 7))),
    hora: '',
    inicio,
    fim: 'sem',
    fim_data: '',
    fim_ocorrencias: '',
  };
}

const ehInteiroDe = (texto: string, minimo: number, maximo: number) => /^\d+$/.test(texto.trim()) && Number(texto) >= minimo && Number(texto) <= maximo;

/** As mensagens de quem usa o componente, com o nome do campo onde cada uma aparece. */
export function errosDaRepeticao(campos: FormularioRepeticao, { lembrete, minimoInicio }: { lembrete: boolean; minimoInicio?: string }): Partial<Record<keyof FormularioRepeticao, string>> {
  const erros: Partial<Record<keyof FormularioRepeticao, string>> = {};
  if (!ehInteiroDe(campos.intervalo, 1, 999)) erros.intervalo = 'Use um número a partir de 1.';
  if (campos.frequencia === 'semanal' && !campos.dias_semana.length) erros.dias_semana = 'Escolha ao menos um dia.';
  const usaDia = campos.frequencia === 'mensal' || campos.frequencia === 'anual';
  if (usaDia && campos.modo_mes === 'dia' && !ehInteiroDe(campos.dia_mes, 1, 31)) erros.dia_mes = 'Use um dia de 1 a 31.';
  if (campos.frequencia === 'anual' && !ehInteiroDe(campos.mes, 1, 12)) erros.mes = 'Escolha o mês.';
  if (campos.frequencia === 'anual' && !erros.dia_mes && !erros.mes && campos.modo_mes === 'dia' && Number(campos.dia_mes) > new Date(Date.UTC(2024, Number(campos.mes), 0)).getUTCDate()) {
    erros.dia_mes = `${NOMES_DOS_MESES[Number(campos.mes) - 1]} não tem dia ${Number(campos.dia_mes)}.`.replace(/^./, (letra) => letra.toUpperCase());
  }
  if (lembrete && !campos.hora) erros.hora = 'Lembrete exige a hora do aviso.';
  if (!campos.inicio) erros.inicio = 'Informe o início.';
  else if (minimoInicio && campos.inicio < minimoInicio) erros.inicio = 'A rotina começa hoje ou depois.';
  if (campos.fim === 'data' && !campos.fim_data) erros.fim_data = 'Informe a data final.';
  else if (campos.fim === 'data' && campos.inicio && campos.fim_data < campos.inicio) erros.fim_data = 'A data final precisa ser depois do início.';
  if (campos.fim === 'vezes' && !ehInteiroDe(campos.fim_ocorrencias, 1, 9999)) erros.fim_ocorrencias = 'Use um número a partir de 1.';
  return erros;
}

export function regraDoFormulario(campos: FormularioRepeticao): RegraDeRepeticao {
  const usaDia = campos.frequencia === 'mensal' || campos.frequencia === 'anual';
  return {
    frequencia: campos.frequencia,
    intervalo: Number(campos.intervalo) || 1,
    dias_semana: campos.frequencia === 'semanal' ? campos.dias_semana : [],
    dia_mes: usaDia && campos.modo_mes === 'dia' ? Number(campos.dia_mes) || null : null,
    ultimo_dia: usaDia && campos.modo_mes === 'ultimo',
    mes: campos.frequencia === 'anual' ? Number(campos.mes) || null : null,
    hora: campos.hora || null,
    inicio: campos.inicio,
    fim_data: campos.fim === 'data' ? campos.fim_data || null : null,
    fim_ocorrencias: campos.fim === 'vezes' ? Number(campos.fim_ocorrencias) || null : null,
  };
}

export function formularioDaRegra(regra: RegraDeRepeticao): FormularioRepeticao {
  const padrao = repeticaoPadrao(regra.inicio);
  return {
    frequencia: regra.frequencia,
    intervalo: String(regra.intervalo),
    dias_semana: regra.frequencia === 'semanal' ? regra.dias_semana : padrao.dias_semana,
    modo_mes: regra.ultimo_dia ? 'ultimo' : 'dia',
    dia_mes: regra.dia_mes ? String(regra.dia_mes) : padrao.dia_mes,
    mes: regra.mes ? String(regra.mes) : padrao.mes,
    hora: regra.hora ?? '',
    inicio: regra.inicio,
    fim: regra.fim_data ? 'data' : regra.fim_ocorrencias ? 'vezes' : 'sem',
    fim_data: regra.fim_data ?? '',
    fim_ocorrencias: regra.fim_ocorrencias ? String(regra.fim_ocorrencias) : '',
  };
}

/** Só o que define a agenda: mudar isso começa uma regra nova (RN-03.17). */
export function mesmaAgenda(a: RegraDeRepeticao, b: RegraDeRepeticao): boolean {
  const chave = (regra: RegraDeRepeticao) => JSON.stringify([regra.frequencia, regra.intervalo, [...regra.dias_semana].sort(), regra.dia_mes, regra.ultimo_dia, regra.mes, regra.hora, regra.inicio, regra.fim_data, regra.fim_ocorrencias]);
  return chave(a) === chave(b);
}
