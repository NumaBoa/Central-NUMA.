'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, FileText, HandCoins, Plus, Receipt, Users } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { Selecao } from '@/componentes/campos/selecao';
import { AbasFinanceiro } from '@/componentes/financeiro/abas-financeiro';
import { DialogoDeAporte } from '@/componentes/financeiro/dialogo-aporte';
import { DialogoDeBaixa } from '@/componentes/financeiro/dialogo-baixa';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EmBreve, EtiquetaLivre } from '@/componentes/padroes/etiquetas';
import { BarraFiltros, type FiltroAtivo } from '@/componentes/padroes/filtros';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { Pessoa as NomeDaPessoa } from '@/componentes/padroes/pessoa';
import { BotaoExportarCsv } from '@/componentes/padroes/recursos-lista';
import { Secao } from '@/componentes/padroes/secao';
import { Button } from '@/componentes/ui/button';
import type { MovimentoSocietario } from '@/dados/tipos/titulo';
import { useConsulta } from '@/dados/use-consulta';
import type { LinhaDoTitulo } from '@/dominio/lancamentos';
import { carregarSocias, consolidadoDoRelatorio, filtrarMovimentos, FILTROS_MOVIMENTOS_INICIAIS, reembolsosEmAberto, relatorioDeInvestimento, resumoDaSocia, ROTULOS_FORMA_MOVIMENTO, ROTULOS_TIPO_MOVIMENTO, type DadosDasSocias, type FiltrosMovimentos, type LinhaDoRelatorio, type ResumoDaSocia } from '@/dominio/socias';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO, formatarDinheiro } from '@/lib/formatacao';

const LINK = 'inline-flex min-h-11 items-center gap-1.5 underline md:min-h-0 [&_svg]:size-[14px]';
const reais = (valor: number) => formatarDinheiro(valor, 'BRL');

function CartaoDaSocia({ resumo }: { resumo: ResumoDaSocia }) {
  const linha = (rotulo: string, valor: number) => (
    <div className="min-w-0">
      <dt className="text-xs text-ink-soft">{rotulo}</dt>
      <dd className="mt-0.5 font-medium tabular-nums">{reais(valor)}</dd>
    </div>
  );
  return (
    <section aria-label={resumo.socia.nome_completo} className="min-w-0 rounded-lg border border-line bg-paper p-4 md:p-5">
      <NomeDaPessoa nome={resumo.socia.nome_completo} className="font-semibold" />
      <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-ink-soft before:size-2 before:shrink-0 before:rounded-full before:bg-indigo">Investimento líquido</p>
      <strong className="mt-2 block texto-kpi tabular-nums">{reais(resumo.investimentoLiquido)}</strong>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 text-[13px]">
        {linha('Aportes', resumo.aportes)}
        {linha('Retiradas e distribuições', resumo.retiradasEDistribuicoes)}
        {linha('Reembolsos pagos', resumo.reembolsosPagos)}
        {linha('Reembolsos em aberto', resumo.reembolsosEmAberto)}
      </dl>
    </section>
  );
}

function ListaDeMovimentos({ dados }: { dados: DadosDasSocias }) {
  const [filtros, setFiltros] = useState<FiltrosMovimentos>(FILTROS_MOVIMENTOS_INICIAIS);
  const nomeDaPessoa = (id: string) => dados.pessoas.find((pessoa) => pessoa.id === id)?.nome_completo ?? 'Pessoa removida';
  const tituloDe = (movimento: MovimentoSocietario) => dados.titulos.find((titulo) => titulo.id === movimento.titulo_origem_id);
  const linhas = filtrarMovimentos(dados.movimentos, filtros, nomeDaPessoa);
  const mudar = (parcial: Partial<FiltrosMovimentos>) => setFiltros((atuais) => ({ ...atuais, ...parcial }));

  const linkDoTitulo = (movimento: MovimentoSocietario) => {
    const titulo = tituloDe(movimento);
    return titulo ? (
      <LinkCentral href={`/financeiro/${titulo.id}`} className={LINK}>
        {titulo.codigo}
      </LinkCentral>
    ) : null;
  };
  const linkDoComprovante = (movimento: MovimentoSocietario) =>
    movimento.comprovante_url ? (
      <a href={movimento.comprovante_url} target="_blank" rel="noopener noreferrer" className={LINK}>
        <ExternalLink aria-hidden />
        Abrir
      </a>
    ) : null;

  const colunas: readonly Coluna<MovimentoSocietario>[] = [
    { id: 'data', titulo: 'Data', essencial: true, ordenar: (a, b) => a.data.localeCompare(b.data), texto: (m) => formatarDiaISO(m.data), celula: (m) => <span className="whitespace-nowrap tabular-nums">{formatarDiaISO(m.data)}</span> },
    { id: 'socia', titulo: 'Sócia', essencial: true, ordenar: (a, b) => nomeDaPessoa(a.socia_id).localeCompare(nomeDaPessoa(b.socia_id), 'pt-BR'), texto: (m) => nomeDaPessoa(m.socia_id), celula: (m) => <NomeDaPessoa nome={nomeDaPessoa(m.socia_id)} /> },
    { id: 'tipo', titulo: 'Tipo', essencial: true, texto: (m) => ROTULOS_TIPO_MOVIMENTO[m.tipo], celula: (m) => <EtiquetaLivre>{ROTULOS_TIPO_MOVIMENTO[m.tipo]}</EtiquetaLivre> },
    { id: 'valor', titulo: 'Valor', numerica: true, essencial: true, ordenar: (a, b) => a.valor_brl - b.valor_brl, texto: (m) => reais(m.valor_brl), celula: (m) => <span className="whitespace-nowrap">{reais(m.valor_brl)}</span> },
    { id: 'forma', titulo: 'Forma', texto: (m) => ROTULOS_FORMA_MOVIMENTO[m.forma], celula: (m) => ROTULOS_FORMA_MOVIMENTO[m.forma] },
    { id: 'titulo', titulo: 'Título de origem', texto: (m) => tituloDe(m)?.codigo ?? '', celula: (m) => linkDoTitulo(m) ?? '—' },
    { id: 'comprovante', titulo: 'Comprovante', texto: (m) => m.comprovante_url ?? '', celula: (m) => linkDoComprovante(m) ?? '—' },
    { id: 'observacao', titulo: 'Observação', texto: (m) => m.observacao ?? '', celula: (m) => m.observacao ?? '—' },
  ];

  const ativos: FiltroAtivo[] = [
    ...(filtros.tipo ? [{ id: 'tipo', rotulo: `Tipo: ${ROTULOS_TIPO_MOVIMENTO[filtros.tipo as MovimentoSocietario['tipo']]}` }] : []),
    ...(filtros.forma ? [{ id: 'forma', rotulo: `Forma: ${ROTULOS_FORMA_MOVIMENTO[filtros.forma as MovimentoSocietario['forma']]}` }] : []),
  ];

  return (
    <Secao icone={HandCoins} titulo="Movimentos" descricao="Aportes, retiradas e distribuições. Não são receita nem despesa.">
      <div className="space-y-4">
        <BarraFiltros
          busca={filtros.busca}
          aoBuscar={(busca) => mudar({ busca })}
          rotuloBusca="Buscar por código, sócia ou observação"
          rapidos={[{ id: '', rotulo: 'Todas' }, ...dados.socias.map((socia) => ({ id: socia.id, rotulo: socia.nome_completo }))]}
          rapidoAtivo={filtros.socia}
          aoEscolherRapido={(socia) => mudar({ socia })}
          ativos={ativos}
          aoRemoverAtivo={(id) => mudar({ [id]: '' })}
          aoLimpar={() => setFiltros((atuais) => ({ ...FILTROS_MOVIMENTOS_INICIAIS, socia: atuais.socia }))}
          filtrosDetalhados={
            <div className="grid gap-4 px-1 pb-2 md:px-3">
              <Campo rotulo="Tipo" id="filtro-tipo">
                {(controle) => (
                  <Selecao {...controle} value={filtros.tipo} onChange={(evento) => mudar({ tipo: evento.target.value })}>
                    <option value="">Todos</option>
                    {Object.entries(ROTULOS_TIPO_MOVIMENTO).map(([valor, rotulo]) => (
                      <option key={valor} value={valor}>
                        {rotulo}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
              <Campo rotulo="Forma" id="filtro-forma">
                {(controle) => (
                  <Selecao {...controle} value={filtros.forma} onChange={(evento) => mudar({ forma: evento.target.value })}>
                    <option value="">Todas</option>
                    {Object.entries(ROTULOS_FORMA_MOVIMENTO).map(([valor, rotulo]) => (
                      <option key={valor} value={valor}>
                        {rotulo}
                      </option>
                    ))}
                  </Selecao>
                )}
              </Campo>
            </div>
          }
          acoes={<BotaoExportarCsv nomeDoArquivo="movimentos-das-socias" colunas={colunas} linhas={linhas} />}
        />
        <Lista
          rotulo="Movimentos das sócias"
          linhas={linhas}
          colunas={colunas}
          chave={(movimento) => movimento.id}
          filtrando={ativos.length > 0 || Boolean(filtros.busca.trim()) || Boolean(filtros.socia)}
          aoLimparFiltros={() => setFiltros(FILTROS_MOVIMENTOS_INICIAIS)}
          vazio={<EstadoVazio icone={HandCoins} titulo="Nenhum movimento ainda." texto="Eles nascem de um aporte em dinheiro, ou de uma despesa paga por uma sócia e tratada como aporte." />}
          cartao={(movimento) => (
            <span className="grid gap-1.5">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{ROTULOS_TIPO_MOVIMENTO[movimento.tipo]}</span>
                <span className="font-semibold tabular-nums">{reais(movimento.valor_brl)}</span>
              </span>
              <span className="text-[13px] text-ink-soft">
                {nomeDaPessoa(movimento.socia_id)} · {formatarDiaISO(movimento.data)} · {ROTULOS_FORMA_MOVIMENTO[movimento.forma]}
              </span>
              {movimento.observacao && <span className="text-[13px] text-ink-soft">{movimento.observacao}</span>}
              <span className="flex flex-wrap gap-x-4 text-[13px]">
                {linkDoTitulo(movimento)}
                {linkDoComprovante(movimento)}
              </span>
            </span>
          )}
        />
      </div>
    </Secao>
  );
}

function ReembolsosEmAberto({ dados, aoPagar }: { dados: DadosDasSocias; aoPagar: (titulo: LinhaDoTitulo) => void }) {
  const roteador = useRouter();
  const linhas = reembolsosEmAberto(dados.reembolsos);
  const nomeDaPessoa = (id: string | null) => dados.pessoas.find((pessoa) => pessoa.id === id)?.nome_completo ?? 'Pessoa removida';
  const pagar = (titulo: LinhaDoTitulo) => (
    <Button variante="secundario" tamanho="pequeno" aria-label={`Pagar reembolso: ${titulo.descricao}`} onClick={() => aoPagar(titulo)}>
      Pagar reembolso
    </Button>
  );
  const colunas: readonly Coluna<LinhaDoTitulo>[] = [
    { id: 'descricao', titulo: 'Reembolso', essencial: true, celula: (t) => <span className="font-medium break-words">{t.descricao}</span> },
    { id: 'socia', titulo: 'Sócia', essencial: true, celula: (t) => <NomeDaPessoa nome={nomeDaPessoa(t.beneficiario_pessoa_id)} /> },
    { id: 'vencimento', titulo: 'Vencimento', essencial: true, celula: (t) => <span className="whitespace-nowrap tabular-nums">{formatarDiaISO(t.vencimento)}</span> },
    { id: 'saldo', titulo: 'Saldo', numerica: true, essencial: true, celula: (t) => <span className="whitespace-nowrap">{reais(t.saldo)}</span> },
  ];
  return (
    <Secao icone={Receipt} titulo="Reembolsos em aberto" descricao="O que a Numa ainda deve às sócias por despesas que elas pagaram.">
      <Lista
        rotulo="Reembolsos em aberto"
        linhas={linhas}
        colunas={colunas}
        chave={(titulo) => titulo.id}
        aoAbrir={(titulo) => roteador.push(`/financeiro/${titulo.id}`)}
        cartaoInterativo
        acoesDaLinha={pagar}
        vazio={<EstadoVazio icone={Receipt} titulo="Nenhum reembolso em aberto." texto="A Numa não deve nada às sócias agora." />}
        cartao={(titulo) => (
          <span className="grid gap-1.5">
            <LinkCentral href={`/financeiro/${titulo.id}`} className="inline-flex min-h-11 items-center font-semibold break-words underline">
              {titulo.descricao}
            </LinkCentral>
            <span className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-ink-soft">
              <span>
                {nomeDaPessoa(titulo.beneficiario_pessoa_id)} · Vence em {formatarDiaISO(titulo.vencimento)}
              </span>
              <span className="font-semibold text-ink tabular-nums">{reais(titulo.saldo)}</span>
            </span>
            <span className="mt-1">{pagar(titulo)}</span>
          </span>
        )}
      />
    </Secao>
  );
}

type LinhaDoCsv = { periodo: string; socia: string; aportes: number; retiradas: number; reembolsos: number | null; total: number };

function RelatorioDeInvestimento({ dados }: { dados: DadosDasSocias }) {
  const nomeDaPessoa = (id: string) => dados.pessoas.find((pessoa) => pessoa.id === id)?.nome_completo ?? 'Pessoa removida';
  const linhas = useMemo(() => relatorioDeInvestimento(dados.movimentos, dados.fimDoPreOperacional), [dados.movimentos, dados.fimDoPreOperacional]);
  const consolidado = useMemo(() => consolidadoDoRelatorio(dados.socias, linhas, dados.reembolsos), [dados.socias, linhas, dados.reembolsos]);
  const colunas: readonly Coluna<LinhaDoRelatorio>[] = [
    { id: 'mes', titulo: 'Mês', essencial: true, celula: (l) => <span className="whitespace-nowrap">{l.rotulo}</span> },
    { id: 'socia', titulo: 'Sócia', essencial: true, celula: (l) => <NomeDaPessoa nome={nomeDaPessoa(l.sociaId)} /> },
    { id: 'aportes', titulo: 'Aportes', numerica: true, essencial: true, celula: (l) => reais(l.aportes) },
    { id: 'retiradas', titulo: 'Retiradas e distribuições', numerica: true, essencial: true, celula: (l) => reais(l.retiradas) },
    { id: 'liquido', titulo: 'Líquido do mês', numerica: true, essencial: true, celula: (l) => reais(l.liquido) },
  ];
  const paraExportar: readonly LinhaDoCsv[] = [
    ...linhas.map((l) => ({ periodo: l.rotulo, socia: nomeDaPessoa(l.sociaId), aportes: l.aportes, retiradas: l.retiradas, reembolsos: null, total: l.liquido })),
    ...consolidado.map((c) => ({ periodo: 'Consolidado', socia: c.socia.nome_completo, aportes: c.aportes, retiradas: c.retiradas, reembolsos: c.reembolsosEmAberto, total: c.total })),
  ];
  const colunasDoArquivo: readonly Coluna<LinhaDoCsv>[] = [
    { id: 'periodo', titulo: 'Período', texto: (l) => l.periodo, celula: () => null },
    { id: 'socia', titulo: 'Sócia', texto: (l) => l.socia, celula: () => null },
    { id: 'aportes', titulo: 'Aportes', texto: (l) => reais(l.aportes), celula: () => null },
    { id: 'retiradas', titulo: 'Retiradas e distribuições', texto: (l) => reais(l.retiradas), celula: () => null },
    { id: 'reembolsos', titulo: 'Reembolsos em aberto', texto: (l) => (l.reembolsos === null ? '' : reais(l.reembolsos)), celula: () => null },
    { id: 'total', titulo: 'Total', texto: (l) => reais(l.total), celula: () => null },
  ];
  const fim = dados.fimDoPreOperacional;
  return (
    <Secao icone={FileText} titulo="Investimento das sócias no período pré-operacional" descricao={fim ? `Até ${formatarDiaISO(fim)}, quando a primeira PJ abriu. Base para o memorando de integralização.` : 'Ainda não há PJ ativa, então vale tudo até hoje. Base para o memorando de integralização.'}>
      <div className="space-y-4">
        <Lista
          rotulo="Investimento por sócia e por mês"
          linhas={linhas}
          colunas={colunas}
          chave={(linha) => linha.id}
          vazio={<EstadoVazio icone={FileText} titulo="Nenhum movimento neste período." texto="O relatório se monta sozinho com os aportes e retiradas." />}
          cartao={(linha) => (
            <span className="grid gap-1">
              <span className="font-semibold">
                {linha.rotulo} · {nomeDaPessoa(linha.sociaId)}
              </span>
              <span className="text-[13px] text-ink-soft tabular-nums">
                Aportes {reais(linha.aportes)} · Retiradas {reais(linha.retiradas)}
              </span>
              <span className="text-[13px] font-medium tabular-nums">Líquido do mês: {reais(linha.liquido)}</span>
            </span>
          )}
        />
        <ul className="grid gap-2 text-[13px]" aria-label="Consolidado por sócia">
          {consolidado.map((linha) => (
            <li key={linha.socia.id} className="rounded-md bg-mist px-3.5 py-2.5">
              <strong className="font-semibold">{linha.socia.nome_completo}:</strong> <span className="tabular-nums">{reais(linha.aportes)} em aportes − {reais(linha.retiradas)} em retiradas + {reais(linha.reembolsosEmAberto)} em reembolsos em aberto = <strong className="font-semibold">{reais(linha.total)}</strong></span>
            </li>
          ))}
        </ul>
        <div className="flex justify-end">
          <BotaoExportarCsv nomeDoArquivo="investimento-das-socias" colunas={colunasDoArquivo} linhas={paraExportar} />
        </div>
      </div>
    </Secao>
  );
}

/** T05.05: quanto cada sócia pôs, tirou e ainda tem a receber. */
export function TelaSocias() {
  const hoje = hojeISO();
  const consulta = useConsulta(() => carregarSocias(hoje), [hoje]);
  const [aportando, setAportando] = useState(false);
  const [pagando, setPagando] = useState<LinhaDoTitulo | null>(null);
  const dados = consulta.dados;

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro' || !dados) {
    return (
      <>
        <h1 className="mb-5">Sócias</h1>
        <EstadoErro titulo="Não deu para ler os movimentos." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos em Configurações › Dados." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        kicker="Financeiro"
        titulo="Sócias"
        resumo="Quanto cada sócia pôs na Numa, quanto tirou e o que ainda tem a receber."
        acoes={
          <>
            <Button onClick={() => setAportando(true)}>
              <Plus aria-hidden />
              Novo aporte em dinheiro
            </Button>
            <Button variante="secundario" disabled>
              Nova retirada
              <EmBreve />
            </Button>
          </>
        }
      />
      <AbasFinanceiro ativa="socias" />
      {dados.socias.length === 0 ? (
        <EstadoVazio icone={Users} titulo="Nenhuma sócia cadastrada." texto="Marque quem é sócia em Configurações › Cadastros base › Pessoas." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2" aria-label="Resumo por sócia" role="group">
          {dados.socias.map((socia) => (
            <CartaoDaSocia key={socia.id} resumo={resumoDaSocia(socia, dados.movimentos, dados.reembolsos)} />
          ))}
        </div>
      )}
      <ReembolsosEmAberto dados={dados} aoPagar={setPagando} />
      <ListaDeMovimentos dados={dados} />
      <RelatorioDeInvestimento dados={dados} />
      {aportando && <DialogoDeAporte socias={dados.socias.filter((socia) => !socia.arquivado_em)} contas={dados.contas} aoFechar={() => setAportando(false)} />}
      {pagando && <DialogoDeBaixa titulo={pagando} contas={dados.contas} aoFechar={() => setPagando(null)} />}
    </div>
  );
}
