'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Landmark, ListChecks, Scale } from 'lucide-react';
import { DialogoDeConferencia } from '@/componentes/financeiro/dialogo-conferencia';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaLivre, EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { Ficha } from '@/componentes/padroes/ficha';
import { ListaHistorico } from '@/componentes/padroes/historico';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { BotaoExportarCsv } from '@/componentes/padroes/recursos-lista';
import { Button } from '@/componentes/ui/button';
import type { ContaFinanceira } from '@/dados/tipos/financeiro';
import type { ConferenciaSaldo } from '@/dados/tipos/transferencia';
import { useConsulta } from '@/dados/use-consulta';
import { controlaSaldo, nomeDoTitular, ROTULOS_TIPO_CONTA } from '@/dominio/contas';
import { historicoDaConta } from '@/dominio/historico';
import { carregarSaldos, extratoDaConta, saldoDaConta, ultimaMovimentacao, type DadosDosSaldos, type LinhaDoExtrato } from '@/dominio/saldos';
import { formatarDiaISO, formatarDinheiro } from '@/lib/formatacao';

const CAMINHO = '/financeiro/contas';
const LINK = 'inline-flex min-h-11 items-center underline md:min-h-0';

function AbaExtrato({ conta, dados }: { conta: ContaFinanceira; dados: DadosDosSaldos }) {
  const controlada = controlaSaldo(conta.tipo) && conta.saldo_inicial !== null;
  // O mais recente primeiro: é o que se procura. O saldo de cada linha continua sendo o daquele momento.
  const linhas = [...extratoDaConta(conta, dados)].reverse();
  const dinheiro = (valor: number) => formatarDinheiro(valor, conta.moeda);
  const descricao = (linha: LinhaDoExtrato) =>
    linha.href ? (
      <LinkCentral href={linha.href} className={`${LINK} break-words`}>
        {linha.descricao}
      </LinkCentral>
    ) : (
      linha.descricao
    );
  const colunas: readonly Coluna<LinhaDoExtrato>[] = [
    { id: 'data', titulo: 'Data', essencial: true, ordenar: (a, b) => a.data.localeCompare(b.data), texto: (l) => formatarDiaISO(l.data), celula: (l) => <span className="whitespace-nowrap tabular-nums">{formatarDiaISO(l.data)}</span> },
    { id: 'descricao', titulo: 'Descrição', essencial: true, texto: (l) => l.descricao, celula: descricao },
    { id: 'entrada', titulo: 'Entrada', numerica: true, essencial: true, texto: (l) => (l.entrada ? dinheiro(l.entrada) : ''), celula: (l) => (l.entrada ? <span className="whitespace-nowrap">{dinheiro(l.entrada)}</span> : '—') },
    { id: 'saida', titulo: 'Saída', numerica: true, essencial: true, texto: (l) => (l.saida ? dinheiro(l.saida) : ''), celula: (l) => (l.saida ? <span className="whitespace-nowrap">{dinheiro(l.saida)}</span> : '—') },
    ...(controlada ? [{ id: 'saldo', titulo: 'Saldo', numerica: true, essencial: true, texto: (l: LinhaDoExtrato) => dinheiro(l.saldo as number), celula: (l: LinhaDoExtrato) => <span className="whitespace-nowrap font-medium">{dinheiro(l.saldo as number)}</span> } satisfies Coluna<LinhaDoExtrato>] : []),
  ];
  return (
    <div className="space-y-4">
      {controlada && (
        <p className="text-[13px] text-ink-soft">
          Saldo inicial de <strong className="font-semibold text-ink tabular-nums">{dinheiro(conta.saldo_inicial as number)}</strong>
          {conta.data_saldo_inicial ? ` em ${formatarDiaISO(conta.data_saldo_inicial)}` : ''}. Só o que veio a partir daí entra no saldo.
        </p>
      )}
      <Lista
        rotulo={`Extrato de ${conta.nome}`}
        linhas={linhas}
        colunas={colunas}
        chave={(linha) => linha.id}
        vazio={<EstadoVazio icone={ListChecks} titulo="Nenhuma movimentação ainda." texto="Baixas, transferências e aportes nesta conta aparecem aqui." />}
        cartao={(linha) => (
          <span className="grid gap-1">
            <span className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[13px] text-ink-soft tabular-nums">{formatarDiaISO(linha.data)}</span>
              <span className="font-semibold tabular-nums">{linha.entrada ? `+ ${dinheiro(linha.entrada)}` : `− ${dinheiro(linha.saida)}`}</span>
            </span>
            <span className="text-sm break-words">{descricao(linha)}</span>
            {linha.saldo !== null && <span className="text-[13px] text-ink-soft tabular-nums">Saldo: {dinheiro(linha.saldo)}</span>}
          </span>
        )}
      />
      <div className="flex justify-end">
        <BotaoExportarCsv nomeDoArquivo="extrato" colunas={colunas} linhas={linhas} />
      </div>
    </div>
  );
}

function AbaConferencias({ conta, dados }: { conta: ContaFinanceira; dados: DadosDosSaldos }) {
  const dinheiro = (valor: number) => formatarDinheiro(valor, conta.moeda);
  const linhas = dados.conferencias.filter((item) => item.conta_id === conta.id).sort((a, b) => b.data.localeCompare(a.data) || b.criado_em.localeCompare(a.criado_em));
  const ajuste = (item: ConferenciaSaldo) =>
    item.ajuste_titulo_id ? (
      <LinkCentral href={`/financeiro/${item.ajuste_titulo_id}`} className={LINK}>
        Abrir o ajuste
      </LinkCentral>
    ) : null;
  const colunas: readonly Coluna<ConferenciaSaldo>[] = [
    { id: 'data', titulo: 'Data', essencial: true, celula: (c) => <span className="whitespace-nowrap tabular-nums">{formatarDiaISO(c.data)}</span> },
    { id: 'banco', titulo: 'No banco', numerica: true, essencial: true, celula: (c) => <span className="whitespace-nowrap">{dinheiro(c.saldo_informado)}</span> },
    { id: 'sistema', titulo: 'No sistema', numerica: true, essencial: true, celula: (c) => <span className="whitespace-nowrap">{dinheiro(c.saldo_sistema)}</span> },
    { id: 'diferenca', titulo: 'Diferença', numerica: true, essencial: true, celula: (c) => <span className="whitespace-nowrap font-medium">{dinheiro(c.diferenca)}</span> },
    { id: 'ajuste', titulo: 'Ajuste', essencial: true, celula: (c) => ajuste(c) ?? (c.diferenca === 0 ? 'Sem diferença' : 'Sem ajuste') },
  ];
  return (
    <Lista
      rotulo={`Conferências de ${conta.nome}`}
      linhas={linhas}
      colunas={colunas}
      chave={(item) => item.id}
      vazio={<EstadoVazio icone={Scale} titulo="Nenhuma conferência ainda." texto="Compare o saldo do banco com o do sistema em “Conferir saldo”." />}
      cartao={(item) => (
        <span className="grid gap-1">
          <span className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-semibold tabular-nums">{formatarDiaISO(item.data)}</span>
            <span className="font-semibold tabular-nums">Diferença: {dinheiro(item.diferenca)}</span>
          </span>
          <span className="text-[13px] text-ink-soft tabular-nums">
            No banco {dinheiro(item.saldo_informado)} · No sistema {dinheiro(item.saldo_sistema)}
          </span>
          <span className="text-[13px]">{ajuste(item) ?? (item.diferenca === 0 ? 'Sem diferença' : 'Sem ajuste')}</span>
        </span>
      )}
    />
  );
}

function AbaHistorico({ id }: { id: string }) {
  const consulta = useConsulta(() => historicoDaConta(id), [id]);
  return (
    <div className="rounded-lg border border-line bg-paper p-4 md:p-5">
      <ListaHistorico consulta={consulta} comFiltros />
    </div>
  );
}

/** T05.07: extrato com saldo acumulado, e a conferência contra o banco. */
export function FichaConta() {
  const { id } = useParams<{ id: string }>();
  const consulta = useConsulta(carregarSaldos);
  const [conferindo, setConferindo] = useState(false);
  const dados = consulta.dados;

  const voltar = (
    <LinkCentral href={CAMINHO} className="mb-5 inline-flex min-h-11 items-center gap-1.5 rounded-pill pr-3 text-[13px] font-medium text-ink-soft hover:text-ink md:min-h-0 [&_svg]:size-4">
      <ArrowLeft aria-hidden />
      Contas e saldos
    </LinkCentral>
  );

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro' || !dados) {
    return (
      <>
        {voltar}
        <EstadoErro titulo="Não deu para ler esta conta." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos em Configurações › Dados." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }
  const conta = dados.contas.find((item) => item.id === id);
  if (!conta) {
    return (
      <>
        {voltar}
        <EstadoVazio icone={Landmark} titulo="Essa conta não existe mais." texto="Ela pode ter sido removida ao limpar os exemplos ou ao importar um arquivo." />
      </>
    );
  }

  const saldo = saldoDaConta(conta, dados);
  const ultima = ultimaMovimentacao(conta, dados);
  const titular = nomeDoTitular(conta, dados);
  const podeConferir = saldo !== null && conta.situacao === 'ativa' && !conta.arquivado_em;
  const acoes = podeConferir ? (
    <Button onClick={() => setConferindo(true)}>
      <Scale aria-hidden />
      Conferir saldo
    </Button>
  ) : undefined;

  return (
    <>
      {voltar}
      <Ficha
        tituloDePagina
        titulo={conta.nome}
        etiquetas={
          <>
            <EtiquetaLivre>{ROTULOS_TIPO_CONTA[conta.tipo]}</EtiquetaLivre>
            <EtiquetaLivre>{conta.moeda}</EtiquetaLivre>
            {conta.situacao === 'encerrada' && <EtiquetaSituacao tipo="neutro">Encerrada</EtiquetaSituacao>}
          </>
        }
        responsavel={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1 tabular-nums">
            {titular && <span>Titular: {titular}</span>}
            <span>
              {saldo === null ? (
                'Sem saldo controlado'
              ) : (
                <>
                  Saldo atual: <strong className="text-ink">{formatarDinheiro(saldo, conta.moeda)}</strong>
                </>
              )}
            </span>
            <span>{ultima ? `Última movimentação em ${formatarDiaISO(ultima)}` : 'Nenhuma movimentação ainda'}</span>
          </span>
        }
        {...(acoes ? { acoes, acoesCelular: acoes } : {})}
        abas={[
          { id: 'extrato', rotulo: 'Extrato', conteudo: <AbaExtrato conta={conta} dados={dados} /> },
          ...(saldo !== null ? [{ id: 'conferencias', rotulo: 'Conferências', conteudo: <AbaConferencias conta={conta} dados={dados} /> }] : []),
          { id: 'historico', rotulo: 'Histórico', conteudo: <AbaHistorico id={conta.id} /> },
        ]}
      />
      {conferindo && <DialogoDeConferencia conta={conta} dados={dados} aoFechar={() => setConferindo(false)} />}
    </>
  );
}
