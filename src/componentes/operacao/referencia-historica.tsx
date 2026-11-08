'use client';

import { repositorios } from '@/dados/repositorios';
import { useConsulta } from '@/dados/use-consulta';
import { referenciasDosProdutos, textoDaReferencia } from '@/dominio/estimado';

async function carregar(produtoIds: readonly string[]) {
  const [referencias, produtos] = await Promise.all([referenciasDosProdutos(produtoIds), repositorios.produto.listar({ incluirArquivados: true })]);
  return referencias.map((referencia) => textoDaReferencia(referencia, produtos.find((produto) => produto.id === referencia.produtoId)?.nome ?? 'Produto removido'));
}

/** T10.04 com a base de T12.08: uma linha por produto, sem somar médias de produtos executados em paralelo (RN-12.06). */
export function ReferenciaHistorica({ produtoIds }: { produtoIds: readonly string[] }) {
  const consulta = useConsulta(() => carregar(produtoIds), [produtoIds.join(',')]);
  if (!produtoIds.length) return <>Histórico insuficiente</>;
  if (!consulta.dados) return <>…</>;
  return (
    <span className="grid gap-0.5" data-referencia-historica>
      {consulta.dados.map((texto) => <span key={texto}>{texto}</span>)}
    </span>
  );
}
