'use client';

import { useMemo, useState } from 'react';
import { Archive, ArchiveRestore, Landmark, Pencil, Plus, TriangleAlert } from 'lucide-react';
import { Pilulas } from '@/componentes/campos/pilulas';
import { aviso } from '@/componentes/padroes/aviso';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { BarraFiltros, type FiltroAtivo } from '@/componentes/padroes/filtros';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { Button } from '@/componentes/ui/button';
import { mensagemDoErro } from '@/dados/erros';
import type { ContaFinanceira } from '@/dados/tipos/financeiro';
import { useConsulta } from '@/dados/use-consulta';
import {
  arquivarConta,
  carregarContas,
  FILTROS_CONTAS_INICIAIS,
  filtrarContas,
  nomeDoTitular,
  restaurarConta,
  ROTULOS_SITUACAO_CONTA,
  ROTULOS_TIPO_CONTA,
  titularDisponivel,
  type DadosContas,
  type FiltrosContas,
} from '@/dominio/contas';
import { formatarDiaISO, formatarDinheiro, formatarNumero } from '@/lib/formatacao';
import { AbasFinanceiro } from '@/componentes/financeiro/abas-financeiro';
import { FormularioConta } from './formulario-conta';

function SituacaoDaConta({ situacao }: { situacao: ContaFinanceira['situacao'] }) {
  return <EtiquetaSituacao tipo={situacao === 'ativa' ? 'sucesso' : 'neutro'}>{ROTULOS_SITUACAO_CONTA[situacao]}</EtiquetaSituacao>;
}

/** Quem saiu da lista aparece com o nome e um aviso: a tela nunca troca sozinha. */
function TitularDaConta({ conta, dados }: { conta: ContaFinanceira; dados: DadosContas }) {
  const nome = nomeDoTitular(conta, dados);
  if (titularDisponivel(conta, dados) || conta.situacao === 'encerrada') return <>{nome}</>;
  return (
    <span className="flex flex-wrap items-center gap-2">
      {nome}
      <EtiquetaSituacao tipo="atencao" icone={TriangleAlert}>
        Escolha outro titular
      </EtiquetaSituacao>
    </span>
  );
}

function saldoInicial(conta: ContaFinanceira): string {
  return conta.saldo_inicial === null ? '—' : formatarDinheiro(conta.saldo_inicial, conta.moeda);
}

const plural = (quantidade: number) => `${formatarNumero(quantidade)} ${quantidade === 1 ? 'conta' : 'contas'}`;

/** T02.08 (P1 + formulário). Saldos e movimentos ficam na T05.07. */
export function TelaContas() {
  const consulta = useConsulta(carregarContas);
  const [filtros, setFiltros] = useState<FiltrosContas>(FILTROS_CONTAS_INICIAIS);
  const [painel, setPainel] = useState<{ aberto: boolean; conta: ContaFinanceira | null }>({ aberto: false, conta: null });
  const [arquivando, setArquivando] = useState<ContaFinanceira | null>(null);

  const dados = consulta.dados;
  const contas = dados?.contas;
  const visiveis = useMemo(() => (dados ? filtrarContas(dados.contas, filtros, dados) : []), [dados, filtros]);
  const contagem = useMemo(() => {
    const semTipo = dados ? filtrarContas(dados.contas, { ...filtros, tipo: 'todos' }, dados) : [];
    const de = (tipo: ContaFinanceira['tipo']) => semTipo.filter((conta) => conta.tipo === tipo).length;
    return { todos: semTipo.length, banco: de('banco'), cartao: de('cartao'), carteira: de('carteira'), pessoal_socia: de('pessoal_socia'), caixa: de('caixa') };
  }, [dados, filtros]);
  const arquivadas = useMemo(() => (contas ?? []).filter((conta) => conta.arquivado_em).length, [contas]);
  const ativas = (contas ?? []).length - arquivadas;

  const mudar = (parcial: Partial<FiltrosContas>) => setFiltros((atuais) => ({ ...atuais, ...parcial }));
  const limpar = () => setFiltros((atuais) => ({ ...FILTROS_CONTAS_INICIAIS, arquivadas: atuais.arquivadas }));
  const filtrando = Boolean(filtros.busca.trim()) || filtros.tipo !== 'todos' || filtros.situacao !== 'todas';

  async function executar(acao: () => Promise<void>, mensagem: string) {
    try {
      await acao();
      aviso(mensagem);
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  }

  const acoes = (conta: ContaFinanceira) =>
    conta.arquivado_em ? (
      <Button variante="icone" tamanho="icone" aria-label={`Restaurar ${conta.nome}`} onClick={() => void executar(() => restaurarConta(conta.id), 'Conta restaurada.')}>
        <ArchiveRestore aria-hidden />
      </Button>
    ) : (
      <span className="inline-flex">
        <Button variante="icone" tamanho="icone" aria-label={`Editar ${conta.nome}`} onClick={() => setPainel({ aberto: true, conta })}>
          <Pencil aria-hidden />
        </Button>
        <Button variante="icone" tamanho="icone" aria-label={`Arquivar ${conta.nome}`} onClick={() => setArquivando(conta)}>
          <Archive aria-hidden />
        </Button>
      </span>
    );

  const colunas: readonly Coluna<ContaFinanceira>[] = dados
    ? [
        { id: 'nome', titulo: 'Conta', essencial: true, ordenar: (a, b) => a.nome.localeCompare(b.nome, 'pt-BR'), celula: (conta) => <span className="font-medium">{conta.nome}</span> },
        { id: 'tipo', titulo: 'Tipo', essencial: true, ordenar: (a, b) => a.tipo.localeCompare(b.tipo), celula: (conta) => ROTULOS_TIPO_CONTA[conta.tipo] },
        { id: 'titular', titulo: 'Titular', celula: (conta) => <TitularDaConta conta={conta} dados={dados} /> },
        { id: 'instituicao', titulo: 'Instituição', celula: (conta) => conta.instituicao ?? '—' },
        { id: 'final', titulo: 'Final', celula: (conta) => <span className="tabular-nums">{conta.final_numero ?? '—'}</span> },
        { id: 'moeda', titulo: 'Moeda', celula: (conta) => conta.moeda },
        { id: 'saldo', titulo: 'Saldo inicial', numerica: true, celula: (conta) => <span title={conta.data_saldo_inicial ? `Em ${formatarDiaISO(conta.data_saldo_inicial)}` : undefined}>{saldoInicial(conta)}</span> },
        { id: 'situacao', titulo: 'Situação', essencial: true, ordenar: (a, b) => a.situacao.localeCompare(b.situacao), celula: (conta) => <SituacaoDaConta situacao={conta.situacao} /> },
      ]
    : [];

  const ativos: FiltroAtivo[] = filtros.situacao !== 'todas' ? [{ id: 'situacao', rotulo: `Situação: ${ROTULOS_SITUACAO_CONTA[filtros.situacao]}` }] : [];

  return (
    <>
      <CabecalhoPagina
        migalhas={['Central Numa', 'Financeiro', 'Contas e saldos', 'Cadastro das contas']}
        kicker="Financeiro"
        titulo="Contas financeiras"
        resumo={contas ? plural(ativas) : undefined}
        acoes={
          <Button onClick={() => setPainel({ aberto: true, conta: null })} disabled={!dados}>
            <Plus aria-hidden />
            Nova conta
          </Button>
        }
      />
      <AbasFinanceiro ativa="contas" className="" />

      <div className="mt-5 space-y-4">
        {consulta.estado === 'carregando' && <EstadoCarregando />}
        {consulta.estado === 'erro' && <EstadoErro titulo="Não deu para ler as contas." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos na aba Dados." aoTentarDeNovo={consulta.recarregar} />}
        {consulta.estado === 'pronto' && dados && (
          <>
            <BarraFiltros
              busca={filtros.busca}
              aoBuscar={(busca) => mudar({ busca })}
              rotuloBusca="Buscar por nome, instituição, final ou titular"
              rapidos={[
                { id: 'todos', rotulo: 'Todas', contador: contagem.todos },
                { id: 'banco', rotulo: 'Bancárias', contador: contagem.banco },
                { id: 'cartao', rotulo: 'Cartões', contador: contagem.cartao },
                { id: 'carteira', rotulo: 'Carteiras', contador: contagem.carteira },
                { id: 'pessoal_socia', rotulo: 'Pessoais de sócia', contador: contagem.pessoal_socia },
                { id: 'caixa', rotulo: 'Caixa', contador: contagem.caixa },
              ]}
              rapidoAtivo={filtros.tipo}
              aoEscolherRapido={(tipo) => mudar({ tipo: tipo as FiltrosContas['tipo'] })}
              ativos={ativos}
              aoRemoverAtivo={() => mudar({ situacao: 'todas' })}
              aoLimpar={limpar}
              filtrosDetalhados={
                <div className="grid gap-4 px-1 pb-2 md:px-3">
                  <Pilulas
                    rotulo="Situação"
                    valor={filtros.situacao}
                    aoMudar={(situacao) => mudar({ situacao: situacao as FiltrosContas['situacao'] })}
                    opcoes={[
                      { valor: 'todas', rotulo: 'Todas' },
                      { valor: 'ativa', rotulo: 'Ativas' },
                      { valor: 'encerrada', rotulo: 'Encerradas' },
                    ]}
                  />
                </div>
              }
            />
            <div className="flex justify-end">
              <Button variante="terciario" tamanho="pequeno" aria-pressed={filtros.arquivadas} onClick={() => mudar({ arquivadas: !filtros.arquivadas })}>
                <Archive aria-hidden />
                {filtros.arquivadas ? 'Voltar às contas ativas' : `Arquivados (${formatarNumero(arquivadas)})`}
              </Button>
            </div>
            <Lista
              rotulo={filtros.arquivadas ? 'Contas arquivadas' : 'Contas'}
              linhas={visiveis}
              colunas={colunas}
              chave={(conta) => conta.id}
              acoesDaLinha={acoes}
              filtrando={filtrando}
              aoLimparFiltros={limpar}
              cartao={(conta) => (
                <div className="flex items-start justify-between gap-2">
                  <div className="grid min-w-0 gap-1.5">
                    <p className="font-semibold break-words">{conta.nome}</p>
                    <p className="text-[13px] text-ink-soft">{ROTULOS_TIPO_CONTA[conta.tipo]}</p>
                    <div className="text-[13px] text-ink-soft">
                      <TitularDaConta conta={conta} dados={dados} />
                    </div>
                    {(conta.instituicao || conta.final_numero) && <p className="text-[13px] break-words text-ink-soft">{[conta.instituicao, conta.final_numero && `Final ${conta.final_numero}`].filter(Boolean).join(' · ')}</p>}
                    {conta.saldo_inicial !== null && <p className="text-[13px] text-ink-soft tabular-nums">Saldo inicial: {saldoInicial(conta)}</p>}
                    <span>
                      <SituacaoDaConta situacao={conta.situacao} />
                    </span>
                  </div>
                  <div className="shrink-0">{acoes(conta)}</div>
                </div>
              )}
              vazio={
                filtros.arquivadas ? (
                  <EstadoVazio icone={Archive} titulo="Nenhuma conta arquivada." texto="As arquivadas aparecem aqui, e dá para restaurar quando precisar." />
                ) : (
                  <EstadoVazio icone={Landmark} titulo="Nenhuma conta ainda." texto="Cadastre o cartão ou a conta usados para as despesas da Numa." acao={<Button onClick={() => setPainel({ aberto: true, conta: null })}>Nova conta</Button>} />
                )
              }
            />
            <FormularioConta aberto={painel.aberto} aoFechar={() => setPainel((atual) => ({ ...atual, aberto: false }))} conta={painel.conta} dados={dados} />
          </>
        )}
      </div>

      <Confirmacao
        aberto={arquivando !== null}
        aoFechar={() => setArquivando(null)}
        titulo={`Arquivar ${arquivando?.nome ?? ''}?`}
        texto="Ela sai das listas e dos seletores. Dá para restaurar quando precisar, em Arquivados. Para uma conta que deixou de existir, prefira encerrar."
        rotuloConfirmar="Arquivar conta"
        perigo
        aoConfirmar={() => {
          const alvo = arquivando;
          setArquivando(null);
          if (alvo) void executar(() => arquivarConta(alvo.id), 'Conta arquivada.');
        }}
      />
    </>
  );
}
