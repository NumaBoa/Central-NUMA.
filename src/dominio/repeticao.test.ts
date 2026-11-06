import { describe, expect, it } from 'vitest';
import { avisoDoDia, datasDaRegra, errosDaRepeticao, fimPorExtenso, formularioDaRegra, mesmaAgenda, proximaData, proximasDatas, regraDoFormulario, regraPorExtenso, repeticaoPadrao, somarDias, type FormularioRepeticao, type RegraDeRepeticao } from './repeticao';

function regra(alteracoes: Partial<RegraDeRepeticao>): RegraDeRepeticao {
  return { frequencia: 'semanal', intervalo: 1, dias_semana: [], dia_mes: null, ultimo_dia: false, mes: null, hora: null, inicio: '2026-11-06', fim_data: null, fim_ocorrencias: null, ...alteracoes };
}

describe('datas da regra (RN-03.15)', () => {
  it('diária, com intervalo', () => {
    expect(datasDaRegra(regra({ frequencia: 'diaria' }), '2026-11-08')).toEqual(['2026-11-06', '2026-11-07', '2026-11-08']);
    expect(datasDaRegra(regra({ frequencia: 'diaria', intervalo: 3 }), '2026-11-13')).toEqual(['2026-11-06', '2026-11-09', '2026-11-12']);
  });

  it('semanal: nos dias escolhidos, sem nada antes do início', () => {
    // 06/11/2026 é uma sexta.
    expect(datasDaRegra(regra({ dias_semana: [1, 5] }), '2026-11-20')).toEqual(['2026-11-06', '2026-11-09', '2026-11-13', '2026-11-16', '2026-11-20']);
    expect(datasDaRegra(regra({ dias_semana: [1] }), '2026-11-20')).toEqual(['2026-11-09', '2026-11-16']);
    expect(datasDaRegra(regra({ dias_semana: [0] }), '2026-11-15')).toEqual(['2026-11-08', '2026-11-15']);
  });

  it('semanal a cada duas semanas conta a partir da semana do início', () => {
    expect(datasDaRegra(regra({ dias_semana: [1, 5], intervalo: 2 }), '2026-12-04')).toEqual(['2026-11-06', '2026-11-16', '2026-11-20', '2026-11-30', '2026-12-04']);
  });

  it('mensal no dia N; o dia que já passou fica para o mês seguinte', () => {
    expect(datasDaRegra(regra({ frequencia: 'mensal', dia_mes: 5 }), '2027-01-31')).toEqual(['2026-12-05', '2027-01-05']);
    expect(datasDaRegra(regra({ frequencia: 'mensal', dia_mes: 6 }), '2026-12-31')).toEqual(['2026-11-06', '2026-12-06']);
  });

  it('mês sem o dia escolhido cai no último dia (RN-03.16, CA-03.10)', () => {
    const dia31 = regra({ frequencia: 'mensal', dia_mes: 31, inicio: '2027-01-01' });
    expect(datasDaRegra(dia31, '2027-04-30')).toEqual(['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30']);
    expect(datasDaRegra({ ...dia31, inicio: '2028-02-01' }, '2028-03-01')).toEqual(['2028-02-29']);
  });

  it('último dia do mês, e a cada três meses', () => {
    expect(datasDaRegra(regra({ frequencia: 'mensal', ultimo_dia: true }), '2027-02-28')).toEqual(['2026-11-30', '2026-12-31', '2027-01-31', '2027-02-28']);
    expect(datasDaRegra(regra({ frequencia: 'mensal', dia_mes: 10, intervalo: 3 }), '2027-06-30')).toEqual(['2026-11-10', '2027-02-10', '2027-05-10']);
  });

  it('anual, com 29 de fevereiro nos anos comuns', () => {
    expect(datasDaRegra(regra({ frequencia: 'anual', dia_mes: 15, mes: 3 }), '2028-12-31')).toEqual(['2027-03-15', '2028-03-15']);
    expect(datasDaRegra(regra({ frequencia: 'anual', dia_mes: 29, mes: 2 }), '2028-12-31')).toEqual(['2027-02-28', '2028-02-29']);
    expect(datasDaRegra(regra({ frequencia: 'anual', dia_mes: 1, mes: 12, intervalo: 2 }), '2030-12-31')).toEqual(['2026-12-01', '2028-12-01', '2030-12-01']);
  });

  it('fim por data ou por número de ocorrências', () => {
    expect(datasDaRegra(regra({ frequencia: 'diaria', fim_data: '2026-11-07' }), '2026-12-31')).toEqual(['2026-11-06', '2026-11-07']);
    expect(datasDaRegra(regra({ dias_semana: [5], fim_ocorrencias: 2 }), '2027-12-31')).toEqual(['2026-11-06', '2026-11-13']);
  });

  it('a próxima data, inclusive quando a regra terminou ou está longe', () => {
    const semanal = regra({ dias_semana: [1] });
    expect(proximaData(semanal, '2026-11-10')).toBe('2026-11-16');
    expect(proximasDatas(semanal, '2026-11-10', 3)).toEqual(['2026-11-16', '2026-11-23', '2026-11-30']);
    expect(proximaData(regra({ dias_semana: [1], fim_ocorrencias: 1 }), '2026-11-10')).toBeNull();
    expect(proximaData(regra({ frequencia: 'anual', dia_mes: 1, mes: 1, intervalo: 5 }), '2026-11-10')).toBe('2031-01-01');
    expect(proximaData(regra({ dias_semana: [1], inicio: '2030-01-01' }), '2026-11-10')).toBe('2030-01-07');
  });

  it('somar dias atravessa o mês', () => {
    expect(somarDias('2026-11-30', 1)).toBe('2026-12-01');
    expect(somarDias('2026-12-01', -1)).toBe('2026-11-30');
  });
});

describe('por extenso', () => {
  it('semanal, do jeito que se fala', () => {
    expect(regraPorExtenso(regra({ dias_semana: [1] }))).toBe('Toda segunda');
    expect(regraPorExtenso(regra({ dias_semana: [1], hora: '09:00' }))).toBe('Toda segunda às 9h');
    expect(regraPorExtenso(regra({ dias_semana: [1], hora: '09:30' }))).toBe('Toda segunda às 9h30');
    expect(regraPorExtenso(regra({ dias_semana: [6] }))).toBe('Todo sábado');
    expect(regraPorExtenso(regra({ dias_semana: [5, 1, 3] }))).toBe('Toda segunda, quarta e sexta');
    expect(regraPorExtenso(regra({ dias_semana: [5, 6] }))).toBe('Toda sexta e todo sábado');
    expect(regraPorExtenso(regra({ dias_semana: [1, 2, 3, 4, 5] }))).toBe('De segunda a sexta');
    expect(regraPorExtenso(regra({ dias_semana: [1, 6], intervalo: 2 }))).toBe('A cada 2 semanas, na segunda e no sábado');
  });

  it('diária, mensal e anual', () => {
    expect(regraPorExtenso(regra({ frequencia: 'diaria' }))).toBe('Todo dia');
    expect(regraPorExtenso(regra({ frequencia: 'diaria', intervalo: 3 }))).toBe('A cada 3 dias');
    expect(regraPorExtenso(regra({ frequencia: 'mensal', dia_mes: 5 }))).toBe('Dia 5 de cada mês');
    expect(regraPorExtenso(regra({ frequencia: 'mensal', ultimo_dia: true }))).toBe('Todo último dia do mês');
    expect(regraPorExtenso(regra({ frequencia: 'mensal', dia_mes: 1, intervalo: 3 }))).toBe('A cada 3 meses, no dia 1');
    expect(regraPorExtenso(regra({ frequencia: 'mensal', ultimo_dia: true, intervalo: 2 }))).toBe('A cada 2 meses, no último dia');
    expect(regraPorExtenso(regra({ frequencia: 'anual', dia_mes: 15, mes: 3 }))).toBe('Todo ano, em 15 de março');
    expect(regraPorExtenso(regra({ frequencia: 'anual', ultimo_dia: true, mes: 2, intervalo: 2 }))).toBe('A cada 2 anos, no último dia de fevereiro');
  });

  it('o fim', () => {
    expect(fimPorExtenso(regra({}))).toBeNull();
    expect(fimPorExtenso(regra({ fim_data: '2026-12-31' }))).toBe('até 31/12/2026');
    expect(fimPorExtenso(regra({ fim_ocorrencias: 12 }))).toBe('por 12 vezes');
    expect(fimPorExtenso(regra({ fim_ocorrencias: 1 }))).toBe('só uma vez');
  });

  it('o formulário informa os meses sem o dia escolhido (CA-03.10)', () => {
    expect(avisoDoDia(regra({ frequencia: 'mensal', dia_mes: 31 }))).toBe('Nos meses sem o dia 31, a ocorrência cai no último dia do mês.');
    expect(avisoDoDia(regra({ frequencia: 'mensal', dia_mes: 28 }))).toBeNull();
    expect(avisoDoDia(regra({ frequencia: 'mensal', ultimo_dia: true }))).toBeNull();
    expect(avisoDoDia(regra({ frequencia: 'anual', dia_mes: 29, mes: 2 }))).toBe('Nos anos sem 29 de fevereiro, a ocorrência cai no dia 28.');
    expect(avisoDoDia(regra({ frequencia: 'semanal' }))).toBeNull();
  });
});

describe('o componente de recorrência', () => {
  const padrao = repeticaoPadrao('2026-11-06');
  const erros = (alteracoes: Partial<FormularioRepeticao>, opcoes: { lembrete?: boolean; minimoInicio?: string } = {}) => errosDaRepeticao({ ...padrao, ...alteracoes }, { lembrete: false, ...opcoes });

  it('começa toda semana, no dia da semana do início', () => {
    expect(padrao).toMatchObject({ frequencia: 'semanal', dias_semana: [5], dia_mes: '6', mes: '11', inicio: '2026-11-06', fim: 'sem' });
    expect(erros({})).toEqual({});
  });

  it('confere cada campo', () => {
    expect(erros({ intervalo: '0' }).intervalo).toBe('Use um número a partir de 1.');
    expect(erros({ intervalo: 'x' }).intervalo).toBe('Use um número a partir de 1.');
    expect(erros({ dias_semana: [] }).dias_semana).toBe('Escolha ao menos um dia.');
    expect(erros({ frequencia: 'mensal', dia_mes: '32' }).dia_mes).toBe('Use um dia de 1 a 31.');
    expect(erros({ frequencia: 'mensal', modo_mes: 'ultimo', dia_mes: '' }).dia_mes).toBeUndefined();
    expect(erros({ frequencia: 'anual', mes: '' }).mes).toBe('Escolha o mês.');
    expect(erros({ frequencia: 'anual', mes: '4', dia_mes: '31' }).dia_mes).toBe('Abril não tem dia 31.');
    expect(erros({ frequencia: 'anual', mes: '2', dia_mes: '29' }).dia_mes).toBeUndefined();
    expect(erros({ inicio: '' }).inicio).toBe('Informe o início.');
    expect(erros({ inicio: '2026-11-05' }, { minimoInicio: '2026-11-06' }).inicio).toBe('A rotina começa hoje ou depois.');
    expect(erros({ fim: 'data' }).fim_data).toBe('Informe a data final.');
    expect(erros({ fim: 'data', fim_data: '2026-11-01' }).fim_data).toBe('A data final precisa ser depois do início.');
    expect(erros({ fim: 'vezes', fim_ocorrencias: '0' }).fim_ocorrencias).toBe('Use um número a partir de 1.');
  });

  it('lembrete exige a hora do aviso (RN-03.03)', () => {
    expect(erros({}, { lembrete: true }).hora).toBe('Lembrete exige a hora do aviso.');
    expect(erros({ hora: '09:00' }, { lembrete: true }).hora).toBeUndefined();
  });

  it('vai e volta sem perder nada, e só guarda o que a frequência usa', () => {
    const mensal: FormularioRepeticao = { ...padrao, frequencia: 'mensal', modo_mes: 'ultimo', hora: '08:00', fim: 'vezes', fim_ocorrencias: '12', intervalo: '2' };
    const lida = regraDoFormulario(mensal);
    expect(lida).toEqual({ frequencia: 'mensal', intervalo: 2, dias_semana: [], dia_mes: null, ultimo_dia: true, mes: null, hora: '08:00', inicio: '2026-11-06', fim_data: null, fim_ocorrencias: 12 });
    expect(formularioDaRegra(lida)).toMatchObject({ frequencia: 'mensal', modo_mes: 'ultimo', hora: '08:00', fim: 'vezes', fim_ocorrencias: '12', intervalo: '2' });
    expect(regraDoFormulario({ ...padrao, frequencia: 'anual', dia_mes: '15', mes: '3' })).toMatchObject({ dias_semana: [], dia_mes: 15, mes: 3 });
    expect(regraDoFormulario({ ...padrao, frequencia: 'diaria' })).toMatchObject({ dias_semana: [], dia_mes: null, mes: null });
  });

  it('sabe quando a agenda mudou', () => {
    const base = regra({ dias_semana: [1, 5] });
    expect(mesmaAgenda(base, regra({ dias_semana: [5, 1] }))).toBe(true);
    expect(mesmaAgenda(base, regra({ dias_semana: [1] }))).toBe(false);
    expect(mesmaAgenda(base, regra({ dias_semana: [1, 5], hora: '09:00' }))).toBe(false);
    expect(mesmaAgenda(base, regra({ dias_semana: [1, 5], fim_ocorrencias: 3 }))).toBe(false);
  });
});
