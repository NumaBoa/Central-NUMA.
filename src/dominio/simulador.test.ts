import { describe, expect, it } from 'vitest';
import type { CanalDaSimulacao, Premissas } from '@/dados/tipos/precificacao';
import { calcularSimulacao, canalBloqueado, cenarioPrincipal, custoFixoFoiSubstituido, faltasDasPremissas, MENSAGEM_TAXAS_100, pontosDoGrafico, premissasVazias } from './simulador';

const canal = (dados: Partial<CanalDaSimulacao> = {}): CanalDaSimulacao => ({ canal_id: 'teste', nome: 'Canal de teste', taxa_percentual: 15, taxa_fixa: 0, taxa_fixa_original: 0, taxa_fixa_moeda: 'BRL', cambio: null, verificado_em: '2026-11-01', fonte_url: 'https://exemplo.com.br', ...dados });

/** O caso de referência: CF 300, CV 2, canal 15%, fixa zero, tributos 6%, margem 20%, horas zero. */
function referencia(dados: Partial<Premissas> = {}): Premissas {
  return { ...premissasVazias(), cf: 300, cf_calculado: 300, cv: 2, tributos_pct: 6, margem_pct: 20, horas: 0, valor_hora: 50, canais: [canal()], volumes: [10, 50, 200], preco_teste: 15, principal: { canal_id: 'teste', volume: 50 }, ...dados };
}

const moeda = (valor: number | null | undefined) => (valor === null || valor === undefined ? null : Math.round((valor + Number.EPSILON) * 100) / 100);

describe('M07 §4: caso de referência', () => {
  const { linhas, equilibrio } = calcularSimulacao(referencia());
  const em50 = linhas.find((linha) => linha.volume === 50)!;

  it('CA-07.04: preço sugerido R$ 13,56', () => {
    expect(moeda(em50.preco_sugerido)).toBe(13.56);
    expect(em50.preco_sugerido).toBeCloseTo(8 / 0.59, 10);
  });

  it('piso R$ 10,13', () => {
    expect(moeda(em50.piso)).toBe(10.13);
    expect(em50.piso).toBeCloseTo(8 / 0.79, 10);
  });

  it('com preço de teste de R$ 15: receita líquida 11,85 e contribuição 9,85', () => {
    expect(em50.receita_liquida).toBeCloseTo(11.85, 10);
    expect(em50.margem_contribuicao).toBeCloseTo(9.85, 10);
  });

  it('ponto de equilíbrio: 31 clientes, arredondado para cima', () => {
    expect(equilibrio[0]).toEqual({ canal_id: 'teste', clientes: 31, situacao: 'calculado' });
  });

  it('resultado para 50 clientes: R$ 192,50', () => {
    expect(em50.resultado_mensal).toBeCloseTo(192.5, 10);
  });

  it('acréscimo sobre custo é separado da margem: 87,5%', () => {
    expect(em50.markup).toBeCloseTo(0.875, 10);
  });

  it('os três volumes do guia', () => {
    expect(linhas.map((linha) => moeda(linha.preco_sugerido))).toEqual([54.24, 13.56, 5.93]);
    expect(linhas.map((linha) => moeda(linha.piso))).toEqual([40.51, 10.13, 4.43]);
    expect(linhas.map((linha) => moeda(linha.resultado_mensal))).toEqual([-201.5, 192.5, 1670]);
  });

  it('aprovação do guia, no canal web: sugerido 11,97 e piso 9,34', () => {
    const web = calcularSimulacao(referencia({ canais: [canal({ taxa_percentual: 3, taxa_fixa: 0.5, taxa_fixa_original: 0.5 })] })).linhas.find((linha) => linha.volume === 50)!;
    expect(moeda(web.preco_sugerido)).toBe(11.97);
    expect(moeda(web.piso)).toBe(9.34);
  });

  it('arredonda só para mostrar: guarda a precisão completa', () => {
    expect(em50.preco_sugerido).not.toBe(13.56);
  });
});

describe('RN-07.12: bloqueio', () => {
  it('CA-07.03: 15% + 6% + 80% bloqueia, com a mensagem', () => {
    const resultado = calcularSimulacao(referencia({ margem_pct: 80 }));
    expect(resultado.bloqueios).toEqual([{ canal_id: 'teste', mensagem: MENSAGEM_TAXAS_100 }]);
    expect(resultado.linhas.every((linha) => linha.preco_sugerido === null)).toBe(true);
    // O piso não depende da margem, e continua existindo.
    expect(moeda(resultado.linhas[1]?.piso)).toBe(10.13);
  });

  it('exatamente 100% também bloqueia, sem cair no ponto flutuante', () => {
    expect(canalBloqueado(canal({ taxa_percentual: 33.3 }), { tributos_pct: 33.3, margem_pct: 33.4 })).toBe(true);
    expect(canalBloqueado(canal({ taxa_percentual: 33.3 }), { tributos_pct: 33.3, margem_pct: 33.3 })).toBe(false);
  });

  it('taxas e tributos em 100% derrubam também o piso e o equilíbrio', () => {
    const resultado = calcularSimulacao(referencia({ tributos_pct: 85 }));
    expect(resultado.linhas.every((linha) => linha.piso === null && linha.preco_sugerido === null)).toBe(true);
    expect(resultado.equilibrio[0]?.situacao).toBe('bloqueado');
  });

  it('sem as taxas informadas, não há bloqueio: há falta', () => {
    expect(canalBloqueado(canal({ taxa_percentual: null }), { tributos_pct: 6, margem_pct: 80 })).toBe(false);
  });
});

describe('RN-07.16 e RT-08: vazio não é zero', () => {
  it('sem nada informado, lista tudo o que falta', () => {
    expect(faltasDasPremissas(premissasVazias())).toEqual(['custo fixo', 'custo variável', 'tributos', 'margem desejada', 'horas das fundadoras', 'valor-hora', 'canal de venda', 'preço de teste']);
  });

  it('D20: horas marcadas por padrão, sem valor-hora padrão', () => {
    const vazias = premissasVazias();
    expect(vazias.incluir_horas).toBe(true);
    expect(vazias.valor_hora).toBeNull();
  });

  it('valor-hora vazio trava o preço, mesmo com zero horas, e diz o motivo', () => {
    const resultado = calcularSimulacao(referencia({ valor_hora: null }));
    expect(resultado.faltas).toEqual(['valor-hora']);
    expect(resultado.linhas.every((linha) => linha.preco_sugerido === null && linha.piso === null && linha.resultado_mensal === null)).toBe(true);
  });

  it('sem marcar horas, H e vh não fazem falta', () => {
    const resultado = calcularSimulacao(referencia({ incluir_horas: false, horas: null, valor_hora: null }));
    expect(resultado.faltas).toEqual([]);
    expect(moeda(resultado.linhas[1]?.preco_sugerido)).toBe(13.56);
  });

  it('horas entram no custo fixo por cliente', () => {
    const resultado = calcularSimulacao(referencia({ horas: 10, valor_hora: 50 }));
    expect(resultado.linhas[1]?.preco_sugerido).toBeCloseTo((2 + 800 / 50) / 0.59, 10);
    expect(resultado.linhas[1]?.resultado_mensal).toBeCloseTo(50 * 9.85 - 800, 10);
    expect(resultado.equilibrio[0]?.clientes).toBe(Math.ceil(800 / 9.85));
  });

  it('zero explícito é valor: custo fixo zero calcula', () => {
    const resultado = calcularSimulacao(referencia({ cf: 0 }));
    expect(resultado.faltas).toEqual([]);
    expect(resultado.linhas[1]?.preco_sugerido).toBeCloseTo(2 / 0.59, 10);
    expect(resultado.equilibrio[0]?.clientes).toBe(0);
  });

  it('taxa percentual e taxa fixa vazias são diferentes de zero', () => {
    const semTaxa = calcularSimulacao(referencia({ canais: [canal({ taxa_percentual: null })] }));
    expect(semTaxa.faltas).toEqual(['taxa percentual de Canal de teste']);
    expect(semTaxa.linhas[1]?.preco_sugerido).toBeNull();
    const semFixa = calcularSimulacao(referencia({ canais: [canal({ taxa_fixa: null, taxa_fixa_original: null })] }));
    expect(semFixa.faltas).toEqual(['taxa fixa de Canal de teste']);
    expect(semFixa.linhas[1]?.preco_sugerido).toBeNull();
    // A receita líquida também depende da taxa fixa.
    expect(semFixa.linhas[1]?.receita_liquida).toBeNull();
  });

  it('taxa em dólar sem câmbio aparece como falta do câmbio', () => {
    expect(calcularSimulacao(referencia({ canais: [canal({ taxa_fixa: null, taxa_fixa_original: 0.3, taxa_fixa_moeda: 'USD' })] })).faltas).toEqual(['câmbio de USD para Canal de teste']);
  });

  it('sem preço de teste, o preço sugerido sai; o que depende do teste, não', () => {
    const resultado = calcularSimulacao(referencia({ preco_teste: null }));
    const em50 = resultado.linhas[1]!;
    expect(moeda(em50.preco_sugerido)).toBe(13.56);
    expect(em50.receita_liquida).toBeNull();
    expect(em50.margem_contribuicao).toBeNull();
    expect(em50.resultado_mensal).toBeNull();
    expect(em50.markup).toBeNull();
    expect(resultado.equilibrio[0]?.situacao).toBe('falta');
    expect(resultado.faltas).toEqual(['preço de teste']);
  });

  it('sem contribuição positiva, não há equilíbrio com este preço', () => {
    expect(calcularSimulacao(referencia({ preco_teste: 2 })).equilibrio[0]).toEqual({ canal_id: 'teste', clientes: null, situacao: 'sem_equilibrio' });
  });
});

describe('planos anuais', () => {
  const anual = referencia({ periodicidade: 'anual', preco_teste: 180, canais: [canal({ taxa_fixa: 1.2, taxa_fixa_original: 1.2 })] });
  const em50 = calcularSimulacao(anual).linhas[1]!;

  it('compara pelo equivalente mensal p/12', () => {
    expect(em50.receita_liquida).toBeCloseTo((180 / 12) * 0.79 - 0.1, 10);
  });

  it('a taxa fixa cai uma vez por cobrança, e não doze vezes', () => {
    expect(em50.preco_sugerido).toBeCloseTo((8 + 1.2 / 12) / 0.59, 10);
    expect(em50.piso).toBeCloseTo((8 + 1.2 / 12) / 0.79, 10);
  });
});

describe('canais, cenário e gráfico', () => {
  it('RN-07.14: uma linha por canal e volume', () => {
    const resultado = calcularSimulacao(referencia({ canais: [canal(), canal({ canal_id: 'b', nome: 'B', taxa_percentual: 3 })], volumes: [10, 50, 200] }));
    expect(resultado.linhas).toHaveLength(6);
    expect(resultado.equilibrio).toHaveLength(2);
  });

  it('o cenário principal cai no do meio quando o escolhido sai da simulação', () => {
    expect(cenarioPrincipal({ canais: [canal()], volumes: [10, 50, 200], principal: { canal_id: 'sumiu', volume: 50 } })).toEqual({ canal_id: 'teste', volume: 50 });
    expect(cenarioPrincipal({ canais: [], volumes: [10], principal: null })).toBeNull();
  });

  it('RN-07.11: mudar o custo calculado pede justificativa; igual, não', () => {
    expect(custoFixoFoiSubstituido({ cf: 300, cf_calculado: 300 })).toBe(false);
    expect(custoFixoFoiSubstituido({ cf: 350, cf_calculado: 300 })).toBe(true);
    expect(custoFixoFoiSubstituido({ cf: 350, cf_calculado: null })).toBe(true);
    expect(custoFixoFoiSubstituido({ cf: null, cf_calculado: 300 })).toBe(false);
  });

  it('o gráfico sai dos dados: passa por −CF em zero e pelos resultados calculados', () => {
    const premissas = referencia();
    const resultados = calcularSimulacao(premissas);
    const [serie] = pontosDoGrafico(premissas, resultados);
    expect(serie?.pontos[0]).toEqual({ x: 0, y: -300 });
    expect(serie?.pontos.find((ponto) => ponto.x === 50)?.y).toBeCloseTo(192.5, 10);
    expect(serie?.pontos.find((ponto) => ponto.x === 200)?.y).toBeCloseTo(1670, 10);
  });

  it('sem dados, sem gráfico inventado', () => {
    const premissas = referencia({ cf: null });
    expect(pontosDoGrafico(premissas, calcularSimulacao(premissas))).toEqual([]);
  });
});
