/**
 * Feriados de T02.09 e D16: nacionais, do estado do Rio de Janeiro e do município do Rio. A lista
 * foi conferida no calendário oficial do TJRJ para 2026 (atualizado em 05/11/2026); a fonte e os
 * pontos a conferir estão no Mapa, em "A revisar por Kimberly".
 */
export type FeriadoDeReferencia = {
  data: string;
  nome: string;
  abrangencia: 'nacional' | 'estadual' | 'municipal';
  uf: string | null;
  municipio: string | null;
};

export const UF_DO_RIO = 'RJ';
export const MUNICIPIO_DO_RIO = 'Rio de Janeiro';

/** Lei federal 10.607/2002, Lei 6.802/1980 (Aparecida) e Lei 14.759/2023 (Consciência Negra). */
const NACIONAIS_DE_DATA_FIXA = [
  ['01-01', 'Confraternização Universal'],
  ['04-21', 'Tiradentes'],
  ['05-01', 'Dia do Trabalho'],
  ['09-07', 'Independência do Brasil'],
  ['10-12', 'Nossa Senhora Aparecida'],
  ['11-02', 'Finados'],
  ['11-15', 'Proclamação da República'],
  ['11-20', 'Dia Nacional de Zumbi e da Consciência Negra'],
  ['12-25', 'Natal'],
] as const;

const ISO = (data: Date) => data.toISOString().slice(0, 10);

/** Domingo de Páscoa pelo algoritmo de Meeus, Jones e Butcher, do calendário gregoriano. */
export function domingoDePascoa(ano: number): string {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return ISO(new Date(Date.UTC(ano, mes - 1, dia)));
}

function diasDepois(iso: string, dias: number): string {
  const data = new Date(`${iso}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return ISO(data);
}

const nacional = (data: string, nome: string): FeriadoDeReferencia => ({ data, nome, abrangencia: 'nacional', uf: null, municipio: null });
const emOrdem = (a: FeriadoDeReferencia, b: FeriadoDeReferencia) => a.data.localeCompare(b.data) || a.nome.localeCompare(b.nome, 'pt-BR');

/** Lista fixa no código; Carnaval, Sexta-feira Santa e Corpus Christi vêm da Páscoa (T02.09). */
export function feriadosNacionais(ano: number): FeriadoDeReferencia[] {
  const pascoa = domingoDePascoa(ano);
  return [
    ...NACIONAIS_DE_DATA_FIXA.map(([diaDoAno, nome]) => nacional(`${ano}-${diaDoAno}`, nome)),
    nacional(diasDepois(pascoa, -48), 'Carnaval (segunda-feira)'),
    nacional(diasDepois(pascoa, -47), 'Carnaval (terça-feira)'),
    nacional(diasDepois(pascoa, -2), 'Sexta-feira Santa'),
    nacional(diasDepois(pascoa, 60), 'Corpus Christi'),
  ].sort(emOrdem);
}

/** Dia de São Jorge: Lei estadual 5.198/2008. Dia de São Sebastião: Lei Orgânica do Rio, art. 26. */
export function feriadosDoRio(ano: number, municipio: string | null = MUNICIPIO_DO_RIO): FeriadoDeReferencia[] {
  return [
    { data: `${ano}-04-23`, nome: 'Dia de São Jorge', abrangencia: 'estadual' as const, uf: UF_DO_RIO, municipio: null },
    ...(municipio === MUNICIPIO_DO_RIO ? [{ data: `${ano}-01-20`, nome: 'Dia de São Sebastião', abrangencia: 'municipal' as const, uf: UF_DO_RIO, municipio: MUNICIPIO_DO_RIO }] : []),
  ].sort(emOrdem);
}

/** O calendário do ano para o estado e o município padrão (D16). */
export function feriadosDoAno(ano: number, local: { uf: string | null; municipio: string | null }): FeriadoDeReferencia[] {
  return [...feriadosNacionais(ano), ...(local.uf === UF_DO_RIO ? feriadosDoRio(ano, local.municipio) : [])].sort(emOrdem);
}
