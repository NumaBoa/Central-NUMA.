import { EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import type { Decisao } from '@/dados/tipos/decisao';

export function SituacaoDaDecisao({ situacao }: { situacao: Decisao['situacao'] }) {
  return situacao === 'registrada' ? <EtiquetaSituacao tipo="sucesso">Registrada</EtiquetaSituacao> : <EtiquetaSituacao tipo="neutro">Substituída</EtiquetaSituacao>;
}
