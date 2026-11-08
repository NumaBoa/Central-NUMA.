'use client';

import { Rocket } from 'lucide-react';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { EstadoCarregando, EstadoVazio } from '@/componentes/padroes/estados';
import { Button } from '@/componentes/ui/button';
import { repositorios } from '@/dados/repositorios';
import { useConsulta } from '@/dados/use-consulta';
import { implantacoesDoContrato, produtosParaImplantar } from '@/dominio/implantacoes';
import { SituacaoDaImplantacao, SituacaoDaSolicitacao } from './situacoes';

async function carregar(contratoId: string) {
  const [implantacoes, produtos, paraImplantar, solicitacoes] = await Promise.all([implantacoesDoContrato(contratoId), repositorios.produto.listar({ incluirArquivados: true }), produtosParaImplantar(contratoId), repositorios.solicitacao_suporte.listar({ onde: { contrato_id: contratoId } })]);
  return { implantacoes, produtos, paraImplantar, solicitacoes };
}

/** T11.02, aba Operação (13-M11 §3): as implantações do contrato, o mesmo registro do M12, sem cópia. */
export function AbaOperacaoDoContrato({ contratoId, aoCriar }: { contratoId: string; aoCriar?: () => void }) {
  const consulta = useConsulta(() => carregar(contratoId), [contratoId]);
  if (!consulta.dados) return <EstadoCarregando linhas={2} />;
  const { implantacoes, produtos, paraImplantar, solicitacoes } = consulta.dados;
  const nome = (id: string) => produtos.find((produto) => produto.id === id)?.nome ?? 'Produto removido';
  const faltam = paraImplantar.produtos.filter((linha) => !linha.implantacaoId);
  return (
    <div className="grid gap-3">
      {implantacoes.length ? (
        <ul aria-label="Implantações do contrato" className="grid gap-2">
          {implantacoes.map((implantacao) => (
            <li key={implantacao.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-paper px-4 py-3">
              <LinkCentral href={`/operacao/${implantacao.id}`} className="inline-flex min-h-11 items-center font-medium underline md:min-h-0">
                {implantacao.codigo} · {nome(implantacao.produto_id)}
              </LinkCentral>
              <SituacaoDaImplantacao situacao={implantacao.situacao} />
            </li>
          ))}
        </ul>
      ) : (
        <EstadoVazio icone={Rocket} titulo="Nenhuma implantação deste contrato." texto={paraImplantar.motivo ?? 'Uma por produto com item de implantação ou sob medida.'} />
      )}
      {faltam.length > 0 && aoCriar && (
        <Button variante="secundario" className="justify-self-start" onClick={aoCriar}>
          <Rocket aria-hidden />
          Criar implantação
        </Button>
      )}
      <h3 className="mt-2 text-[15px]">Solicitações de suporte</h3>
      {solicitacoes.length ? (
        <ul aria-label="Solicitações do contrato" className="grid gap-2">
          {[...solicitacoes].sort((a, b) => b.aberta_em.localeCompare(a.aberta_em)).map((solicitacao) => (
            <li key={solicitacao.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-paper px-4 py-3">
              <LinkCentral href={`/operacao/suporte/${solicitacao.id}`} className="inline-flex min-h-11 items-center font-medium underline md:min-h-0">
                {solicitacao.codigo} · {solicitacao.titulo}
              </LinkCentral>
              <SituacaoDaSolicitacao situacao={solicitacao.situacao} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-ink-soft">Nenhuma solicitação de suporte deste contrato.</p>
      )}
    </div>
  );
}
