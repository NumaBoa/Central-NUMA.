import listaDeUfs from './ufs-ibge.json';

export type UfComMunicipios = { sigla: string; nome: string; municipios: readonly string[] };

/** Estados, do mesmo arquivo do IBGE: pequeno, pode ficar sempre carregado. */
export const UFS: readonly { sigla: string; nome: string }[] = listaDeUfs;

export type ReferenciaMunicipios = {
  fonte: string;
  endereco: string;
  /** Quando o arquivo foi baixado do IBGE. */
  consultado_em: string;
  total: number;
  ufs: readonly UfComMunicipios[];
};

/**
 * Estados e municípios do arquivo oficial do IBGE, guardado no próprio sistema: funciona sem
 * internet e só é carregado na tela que usa. Para atualizar: `node scripts/gerar-municipios.mjs`.
 */
export async function carregarMunicipios(): Promise<ReferenciaMunicipios> {
  const { default: referencia } = await import('./municipios-ibge.json');
  return referencia;
}

export function municipiosDaUf(referencia: ReferenciaMunicipios, sigla: string): readonly string[] {
  return referencia.ufs.find((uf) => uf.sigla === sigla)?.municipios ?? [];
}
