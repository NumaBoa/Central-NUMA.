'use client';

/** T05.12 Receita por canal (F1, RN-05.21): produto × canal × competência, com bruto, taxas, líquido e assinantes. */
import { useState } from 'react';
import { Pencil, Plus, Wallet } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { Selecao } from '@/componentes/campos/selecao';
import { AbasFinanceiro } from '@/componentes/financeiro/abas-financeiro';
import { useCentral } from '@/componentes/layout/central-provider';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { mensagemDoErro } from '@/dados/erros';
import { useConsulta } from '@/dados/use-consulta';
import { lerValor } from '@/dominio/dinheiro';
import { rotuloDoMes } from '@/dominio/lancamentos';
import { carregarReceitas, FORMULARIO_RECEITA_VAZIO, formularioDaReceita, salvarReceita, taxaSugerida, type FormularioReceita, type LinhaDaReceita, type TelaDaReceita } from '@/dominio/receita-canal';
import { hojeISO } from '@/lib/datas';
import { formatarDinheiro } from '@/lib/formatacao';

function JanelaDaReceita({ aberto, linha, tela, aoFechar, aoSalvar }: { aberto: boolean; linha: LinhaDaReceita | null; tela: TelaDaReceita; aoFechar: () => void; aoSalvar: () => void }) {
  const { pessoa, contexto } = useCentral();
  const mesPassado = (() => {
    const [ano, mes] = hojeISO().split('-').map(Number) as [number, number];
    return new Date(Date.UTC(ano, mes - 2, 1)).toISOString().slice(0, 7);
  })();
  const inicial = (): FormularioReceita => (linha ? formularioDaReceita(linha) : { ...FORMULARIO_RECEITA_VAZIO, competencia: mesPassado, produto_id: tela.produtos.some((produto) => produto.id === contexto.id) ? contexto.id : '' });
  const [dados, setDados] = useState<FormularioReceita>(inicial);
  const [salvando, setSalvando] = useState(false);
  const mudar = (parcial: Partial<FormularioReceita>) => setDados((atual) => ({ ...atual, ...parcial }));
  const canal = tela.canais.find((item) => item.id === dados.canal_id);
  const bruto = dados.receita_bruta.trim() ? lerValor(dados.receita_bruta) : null;
  const taxas = dados.taxas.trim() ? lerValor(dados.taxas) : 0;
  const sugerida = taxaSugerida(canal, bruto);
  const liquida = bruto !== null && taxas !== null ? bruto - taxas : null;
  const alterado = JSON.stringify(dados) !== JSON.stringify(inicial());

  return (
    <JanelaFormulario
      colunas={2}
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={linha ? 'Editar receita do canal' : 'Lançar receita do canal'}
      descricao="Um lançamento por produto, canal e mês. O líquido gera o título a receber do canal, que só fica recebido com a baixa."
      alterado={alterado}
      rotuloSalvar={linha ? 'Salvar alterações' : 'Lançar receita'}
      salvando={salvando}
      aoEnviar={(evento) => {
        evento.preventDefault();
        setSalvando(true);
        void salvarReceita(dados, pessoa.id, linha?.id)
          .then(() => {
            aviso(linha ? 'Receita atualizada.' : 'Receita lançada, com o título a receber do canal.');
            aoSalvar();
          })
          .catch((erro) => aviso(mensagemDoErro(erro)))
          .finally(() => setSalvando(false));
      }}
    >
      <div className="grid gap-[18px]">
        <Campo id="receita-produto" rotulo="Produto" obrigatorio>
          {(controle) => (
            <Selecao {...controle} value={dados.produto_id} disabled={Boolean(linha)} onChange={(evento) => mudar({ produto_id: evento.target.value })}>
              <option value="">Escolha</option>
              {tela.produtos.map((produto) => (
                <option key={produto.id} value={produto.id}>
                  {produto.nome}
                </option>
              ))}
            </Selecao>
          )}
        </Campo>
        <Campo id="receita-canal" rotulo="Canal" obrigatorio ajuda={tela.canais.length ? undefined : 'Cadastre os canais em Produtos › Canais de venda.'}>
          {(controle) => (
            <Selecao {...controle} value={dados.canal_id} disabled={Boolean(linha)} onChange={(evento) => mudar({ canal_id: evento.target.value, moeda: tela.canais.find((item) => item.id === evento.target.value)?.moeda_repasse ?? dados.moeda })}>
              <option value="">Escolha</option>
              {tela.canais.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </Selecao>
          )}
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo id="receita-competencia" rotulo="Competência" obrigatorio>
            {(controle) => <Input {...controle} type="month" value={dados.competencia} onChange={(evento) => mudar({ competencia: evento.target.value })} />}
          </Campo>
          <Campo id="receita-moeda" rotulo="Moeda" obrigatorio>
            {(controle) => <Input {...controle} maxLength={3} autoComplete="off" value={dados.moeda} onChange={(evento) => mudar({ moeda: evento.target.value.toUpperCase() })} />}
          </Campo>
        </div>
        <Campo id="receita-fonte" rotulo="Fonte" ajuda="Link do relatório da loja ou do gateway.">
          {(controle) => <Input {...controle} type="url" autoComplete="off" value={dados.fonte_url} onChange={(evento) => mudar({ fonte_url: evento.target.value })} />}
        </Campo>
      </div>
      <div className="grid gap-[18px]">
        <Campo id="receita-bruta" rotulo="Receita bruta" obrigatorio>
          {(controle) => <Input {...controle} inputMode="decimal" autoComplete="off" value={dados.receita_bruta} onChange={(evento) => mudar({ receita_bruta: evento.target.value })} />}
        </Campo>
        <Campo id="receita-taxas" rotulo="Taxas do canal" ajuda={sugerida !== null ? `Sugestão pelo canal (${canal?.taxa_percentual}%): ${formatarDinheiro(sugerida, dados.moeda || 'BRL')}. Confira com o relatório.` : canal ? 'O canal não tem taxa informada: use o valor do relatório.' : undefined}>
          {(controle) => (
            <div className="flex gap-2">
              <Input {...controle} inputMode="decimal" autoComplete="off" value={dados.taxas} onChange={(evento) => mudar({ taxas: evento.target.value })} />
              {sugerida !== null && (
                <Button variante="terciario" tamanho="pequeno" onClick={() => mudar({ taxas: sugerida.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })}>
                  Usar
                </Button>
              )}
            </div>
          )}
        </Campo>
        <p className="text-sm" data-receita-liquida>
          Receita líquida: <strong>{liquida === null ? '—' : formatarDinheiro(liquida, dados.moeda || 'BRL')}</strong>
        </p>
        <div className="grid grid-cols-3 gap-3">
          <Campo id="receita-ativos" rotulo="Assinantes ativos" ajuda="No fim do mês.">
            {(controle) => <Input {...controle} inputMode="numeric" autoComplete="off" value={dados.assinantes_ativos} onChange={(evento) => mudar({ assinantes_ativos: evento.target.value })} />}
          </Campo>
          <Campo id="receita-novos" rotulo="Novos">
            {(controle) => <Input {...controle} inputMode="numeric" autoComplete="off" value={dados.novos} onChange={(evento) => mudar({ novos: evento.target.value })} />}
          </Campo>
          <Campo id="receita-cancelados" rotulo="Cancelados">
            {(controle) => <Input {...controle} inputMode="numeric" autoComplete="off" value={dados.cancelados} onChange={(evento) => mudar({ cancelados: evento.target.value })} />}
          </Campo>
        </div>
      </div>
    </JanelaFormulario>
  );
}

export function TelaReceitas() {
  const { contexto } = useCentral();
  const consulta = useConsulta(() => carregarReceitas(contexto.id), [contexto.id]);
  const [janela, setJanela] = useState<{ linha: LinhaDaReceita | null } | null>(null);

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro' || !consulta.dados) {
    return (
      <>
        <h1 className="mb-5">Receita por canal</h1>
        <EstadoErro titulo="Não deu para ler as receitas." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos em Configurações › Dados." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }
  const tela = consulta.dados;
  const maior = Math.max(1, ...tela.porMes.map((mes) => mes.liquida));

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        comoUsar="/ajuda/financeiro/receita-por-canal"
        kicker="Financeiro"
        titulo="Receita por canal"
        resumo="Lojas e gateways: o que entrou em cada mês, por produto e canal."
        acoes={
          <Button onClick={() => setJanela({ linha: null })}>
            <Plus aria-hidden />
            Lançar receita
          </Button>
        }
      />
      <AbasFinanceiro ativa="receitas" />

      {tela.porMes.length > 0 && (
        <section aria-label="Receita líquida por mês, em reais" className="rounded-lg border border-line bg-paper p-4">
          <h2 className="mb-3 text-sm font-semibold">Receita líquida por mês (R$)</h2>
          <ul className="grid gap-2">
            {tela.porMes.map((mes) => (
              <li key={mes.competencia} className="grid grid-cols-[96px_1fr_auto] items-center gap-3 text-[13px]">
                <span>{rotuloDoMes(mes.competencia.slice(0, 7)).replace(/ de (\d{4})$/, '/$1')}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-mist" aria-hidden>
                  <span className="block h-full rounded-full bg-indigo" style={{ width: `${(Math.max(mes.liquida, 0) / maior) * 100}%` }} />
                </span>
                <span className="tabular-nums">{formatarDinheiro(mes.liquida, 'BRL')}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-soft">Só os lançamentos em reais somam aqui; outras moedas aparecem na lista.</p>
        </section>
      )}

      {tela.assinantesPorMes.length > 0 && (
        <section aria-label="Assinantes por mês" className="overflow-x-auto rounded-lg border border-line bg-paper p-4" data-assinantes-por-mes>
          <h2 className="mb-3 text-sm font-semibold">Assinantes por mês</h2>
          <table className="w-full border-collapse text-left text-[13px]">
            <caption className="sr-only">Assinantes ativos no fim do mês, novos e cancelados, somando os canais</caption>
            <thead>
              <tr className="border-b border-line text-xs text-ink-soft">
                {['Mês', 'Ativos', 'Novos', 'Cancelados'].map((titulo) => (
                  <th key={titulo} scope="col" className={titulo === 'Mês' ? 'py-1.5 pr-3 font-semibold' : 'px-3 py-1.5 text-right font-semibold'}>
                    {titulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tela.assinantesPorMes.map((mes) => (
                <tr key={mes.competencia} className="border-b border-line last:border-0">
                  <th scope="row" className="py-1.5 pr-3 font-medium whitespace-nowrap">
                    {rotuloDoMes(mes.competencia.slice(0, 7))}
                  </th>
                  {[mes.ativos, mes.novos, mes.cancelados].map((valor, indice) => (
                    <td key={indice} className="px-3 py-1.5 text-right tabular-nums">
                      {valor === null ? <span className="text-ink-soft">—</span> : valor}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-ink-soft">Soma dos canais lançados no mês. Canal sem o número informado não entra na soma.</p>
        </section>
      )}

      {tela.linhas.length ? (
        <div className="overflow-x-auto rounded-lg border border-line bg-paper">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">Receitas por canal</caption>
            <thead>
              <tr className="border-b border-line text-xs text-ink-soft">
                {['Competência', 'Produto · canal', 'Bruta', 'Taxas', 'Líquida', 'Assinantes', 'Título', ''].map((titulo) => (
                  <th key={titulo} scope="col" className="px-3 py-2 font-semibold">
                    {titulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tela.linhas.map((linha) => (
                <tr key={linha.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2.5 whitespace-nowrap">{rotuloDoMes(linha.competencia.slice(0, 7))}</td>
                  <td className="px-3 py-2.5">
                    <span className="font-medium">{linha.produto}</span> · {linha.canal}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">{formatarDinheiro(linha.receita_bruta, linha.moeda)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">{formatarDinheiro(linha.taxas, linha.moeda)}</td>
                  <td className="px-3 py-2.5 font-semibold whitespace-nowrap tabular-nums">{formatarDinheiro(linha.receita_liquida, linha.moeda)}</td>
                  <td className="px-3 py-2.5 text-[13px] whitespace-nowrap">
                    {linha.assinantes_ativos === null ? '—' : `${linha.assinantes_ativos} ativos`}
                    {linha.novos !== null || linha.cancelados !== null ? <span className="block text-xs text-ink-soft">+{linha.novos ?? '—'} · −{linha.cancelados ?? '—'}</span> : null}
                  </td>
                  <td className="px-3 py-2.5 text-[13px] whitespace-nowrap">
                    {linha.titulo_id ? (
                      <LinkCentral href={`/financeiro/${linha.titulo_id}`} className="inline-flex min-h-11 items-center underline underline-offset-2 md:min-h-0">
                        {linha.recebido ? 'Recebido' : 'A receber'}
                      </LinkCentral>
                    ) : (
                      'Sem título (líquido zero)'
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <Button variante="icone" tamanho="icone" aria-label={`Editar ${linha.produto} · ${linha.canal}`} onClick={() => setJanela({ linha })}>
                      <Pencil aria-hidden />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EstadoVazio icone={Wallet} titulo="Nenhuma receita por canal ainda." texto="Lance o mês de cada loja ou gateway pelo relatório do canal." acao={<Button onClick={() => setJanela({ linha: null })}>Lançar receita</Button>} />
      )}

      {janela && <JanelaDaReceita key={janela.linha?.id ?? 'nova'} aberto linha={janela.linha} tela={tela} aoFechar={() => setJanela(null)} aoSalvar={() => { setJanela(null); consulta.recarregar(); }} />}
    </div>
  );
}
