/**
 * Alertas do M12 na rotina do dia, pelo mesmo motor do Meu dia (`sincronizarAlertas`). Nenhum depende da
 * fase da Numa. Os registros também sincronizam na hora, ao salvar (CA-03.11).
 */
import { hojeISO } from '@/lib/datas';

export async function gerarAlertasM12(hoje: string = hojeISO()): Promise<number> {
  const { sincronizarAlertasDasImplantacoes } = await import('./implantacoes');
  const { sincronizarAlertasDoSuporte } = await import('./suporte');
  return (await sincronizarAlertasDasImplantacoes(hoje)) + (await sincronizarAlertasDoSuporte());
}
