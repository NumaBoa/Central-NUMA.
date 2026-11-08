'use client';

import { useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { ArchiveRestore, ArrowLeft, BarChart3, Ellipsis, Link2, Lock, Megaphone, Pencil, Trash2 } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { Selecao } from '@/componentes/campos/selecao';
import { executar } from '@/componentes/f1/apoio';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { EtiquetaDaCampanha, EtiquetaDaPeca, EtiquetaDoContexto } from '@/componentes/marketing/apoio';
import { FormularioDeCampanha } from '@/componentes/marketing/formulario-campanha';
import { SeletorDeArquivos } from '@/componentes/marketing/seletor-arquivos';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { Dado, ListaDeDados } from '@/componentes/padroes/dado';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { Faixa } from '@/componentes/padroes/faixa';
import { Ficha } from '@/componentes/padroes/ficha';
import { ListaHistorico } from '@/componentes/padroes/historico';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { CLASSE_LINHA_MENU, MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import { Pessoa as NomeDaPessoa } from '@/componentes/padroes/pessoa';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import type { Campanha } from '@/dados/tipos/marketing';
import { useConsulta } from '@/dados/use-consulta';
import { definirArquivosDoRegistro } from '@/dominio/biblioteca';
import { arquivarCampanha, carregarCampanhas, CRITERIO_DE_ORIGEM, desvincularLista, desvincularTitulo, esquemaResultadosCampanha, formularioDosResultados, indicarCampanhaDaOportunidade, ligadosACampanha, restaurarCampanha, salvarResultados, totaisDosTitulos, vincularLista, vincularPeca, vincularTitulo, type DadosDasCampanhas, type FormularioResultados } from '@/dominio/campanhas';
import { ROTULOS_CANAL } from '@/dominio/conteudo';
import { historicoDoRegistro } from '@/dominio/historico';
import { ROTULOS_SITUACAO_TITULO } from '@/dominio/titulos';
import { formatarData, formatarDiaISO, formatarDinheiro } from '@/lib/formatacao';

const CAMINHO = '/marketing/campanhas';
const BRANCO = '';

function Vincular({ id, rotulo, opcoes, botao, aoVincular }: { id: string; rotulo: string; opcoes: readonly { valor: string; rotulo: string }[]; botao: string; aoVincular: (valor: string) => Promise<unknown> }) {
  const [valor, setValor] = useState(BRANCO);
  if (!opcoes.length) return null;
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md border border-line bg-paper p-3">
      <Campo id={id} rotulo={rotulo} className="min-w-52 flex-1">
        {(controle) => (
          <Selecao {...controle} value={valor} onChange={(evento) => setValor(evento.target.value)}>
            <option value="">Escolha</option>
            {opcoes.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </Selecao>
        )}
      </Campo>
      <Button
        variante="secundario"
        disabled={!valor}
        onClick={() => {
          const escolhido = valor;
          setValor(BRANCO);
          void executar(() => aoVincular(escolhido), 'Vínculo registrado.');
        }}
      >
        <Link2 aria-hidden />
        {botao}
      </Button>
    </div>
  );
}

function Linha({ children, aoTirar, rotuloTirar }: { children: ReactNode; aoTirar?: () => void; rotuloTirar?: string }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-paper p-3 text-[13px]">
      <span className="min-w-0 flex-1">{children}</span>
      {aoTirar && (
        <Button variante="icone" tamanho="icone" aria-label={rotuloTirar} onClick={aoTirar}>
          <Trash2 aria-hidden />
        </Button>
      )}
    </li>
  );
}

function Resumo({ campanha, dados, somenteLeitura }: { campanha: Campanha; dados: DadosDasCampanhas; somenteLeitura: boolean }) {
  const { listas } = ligadosACampanha(campanha.id, dados);
  const livres = dados.listas.filter((lista) => !listas.some((item) => item.id === lista.id));
  return (
    <div className="grid gap-4">
      <ListaDeDados>
        <Dado rotulo="Objetivo">{campanha.objetivo}</Dado>
        <Dado rotulo="Público">{campanha.publico}</Dado>
        <Dado rotulo="Canais">{campanha.canais.length ? campanha.canais.map((canal) => ROTULOS_CANAL[canal as keyof typeof ROTULOS_CANAL] ?? canal).join(', ') : null}</Dado>
        <Dado rotulo="Início">{campanha.inicio && formatarDiaISO(campanha.inicio)}</Dado>
        <Dado rotulo="Fim">{campanha.fim && formatarDiaISO(campanha.fim)}</Dado>
        {campanha.cancelada_motivo && <Dado rotulo="Motivo do cancelamento">{campanha.cancelada_motivo}</Dado>}
      </ListaDeDados>
      <section aria-label="Listas de espera" className="grid gap-2">
        <h2>Listas de espera</h2>
        {listas.length ? (
          <ul className="grid gap-2">
            {listas.map((lista) => (
              <Linha key={lista.id} rotuloTirar={`Tirar o vínculo com ${lista.nome}`} aoTirar={somenteLeitura ? undefined : () => void executar(() => desvincularLista(campanha.id, lista.id), 'Vínculo retirado.')}>
                <LinkCentral href={`/marketing/listas/${lista.id}`} className="inline-flex min-h-11 items-center font-semibold underline md:min-h-0">
                  {lista.nome}
                </LinkCentral>
              </Linha>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-soft">Nenhuma lista vinculada.</p>
        )}
        {!somenteLeitura && <Vincular id="campanha-lista" rotulo="Vincular lista de espera" botao="Vincular lista" opcoes={livres.map((lista) => ({ valor: lista.id, rotulo: lista.nome }))} aoVincular={(valor) => vincularLista(campanha.id, valor)} />}
      </section>
    </div>
  );
}

function Conteudo({ campanha, dados, somenteLeitura }: { campanha: Campanha; dados: DadosDasCampanhas; somenteLeitura: boolean }) {
  const { pecas } = ligadosACampanha(campanha.id, dados);
  const livres = dados.pecas.filter((peca) => !peca.campanha_id);
  const arquivosDaCampanha = dados.vinculosDeArquivos.filter((vinculo) => vinculo.registro_id === campanha.id && !vinculo.arquivado_em).map((vinculo) => vinculo.arquivo_id);
  return (
    <div className="grid gap-5">
      <section aria-label="Peças vinculadas" className="grid gap-2">
        <h2>Peças</h2>
        {pecas.length ? (
          <ul className="grid gap-2">
            {pecas.map((peca) => (
              <Linha key={peca.id} rotuloTirar={`Tirar ${peca.titulo} da campanha`} aoTirar={somenteLeitura ? undefined : () => void executar(() => vincularPeca(peca.id, null), 'A peça saiu da campanha.')}>
                <span className="flex flex-wrap items-center gap-2">
                  <LinkCentral href={`/marketing/conteudo?peca=${peca.id}`} className="inline-flex min-h-11 items-center font-semibold underline md:min-h-0">
                    {peca.titulo}
                  </LinkCentral>
                  <EtiquetaDaPeca situacao={peca.situacao} />
                  <span className="text-xs text-ink-soft tabular-nums">Prevista: {formatarDiaISO(peca.data_prevista)}</span>
                </span>
              </Linha>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-soft">Nenhuma peça vinculada.</p>
        )}
        {!somenteLeitura && <Vincular id="campanha-peca" rotulo="Vincular peça sem campanha" botao="Vincular peça" opcoes={livres.map((peca) => ({ valor: peca.id, rotulo: peca.titulo }))} aoVincular={(valor) => vincularPeca(valor, campanha.id)} />}
      </section>
      <section aria-label="Arquivos da campanha" className="grid gap-2">
        <h2>Arquivos</h2>
        <SeletorDeArquivos arquivos={dados.arquivos} valores={arquivosDaCampanha} aoMudar={(ids) => void executar(() => definirArquivosDoRegistro('campanha', campanha.id, ids))} />
      </section>
    </div>
  );
}

/** Orçamento 🔒 FIN: vínculos com o M05, sem financeiro paralelo e sem somar moedas. */
function Orcamento({ campanha, dados, somenteLeitura }: { campanha: Campanha; dados: DadosDasCampanhas; somenteLeitura: boolean }) {
  const { titulos } = ligadosACampanha(campanha.id, dados);
  const livres = dados.titulos.filter((titulo) => titulo.natureza === 'pagar' && titulo.situacao !== 'cancelado' && !titulos.some((item) => item.id === titulo.id));
  const totais = totaisDosTitulos(titulos);
  return (
    <div className="grid gap-4">
      <Faixa tipo="atencao">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <Lock className="size-3.5" aria-hidden />
          Dados financeiros (FIN).
        </span>{' '}
        A Central não criou nenhum lançamento aqui: eles nascem no Financeiro e são só vinculados.
      </Faixa>
      <ListaDeDados>
        <Dado rotulo="Orçamento planejado">{campanha.orcamento === null ? <span className="text-ink-soft">Não definido</span> : formatarDinheiro(campanha.orcamento, 'BRL')}</Dado>
        <Dado rotulo="Lançamentos vinculados">{totais.length ? totais.map((total) => `${formatarDinheiro(total.valor, total.moeda)} (${total.quantos} ${total.quantos === 1 ? 'lançamento' : 'lançamentos'})`).join(' + ') : 'Nenhum'}</Dado>
      </ListaDeDados>
      {totais.length > 1 && <p className="text-xs text-ink-soft">Moedas diferentes não são somadas. Valor original de cada lançamento, sem os cancelados.</p>}
      {titulos.length > 0 && (
        <ul aria-label="Lançamentos vinculados" className="grid gap-2">
          {titulos.map((titulo) => (
            <Linha key={titulo.id} rotuloTirar={`Tirar o vínculo com ${titulo.descricao}`} aoTirar={somenteLeitura ? undefined : () => void executar(() => desvincularTitulo(campanha.id, titulo.id), 'Vínculo retirado. O lançamento continua no Financeiro.')}>
              <LinkCentral href={`/financeiro/${titulo.id}`} className="inline-flex min-h-11 items-center font-semibold underline md:min-h-0">
                {titulo.descricao}
              </LinkCentral>
              <span className="mt-0.5 block text-xs text-ink-soft tabular-nums">
                {titulo.codigo} · {formatarDinheiro(titulo.valor, titulo.moeda)} · {ROTULOS_SITUACAO_TITULO[titulo.situacao]}
              </span>
            </Linha>
          ))}
        </ul>
      )}
      {!somenteLeitura && <Vincular id="campanha-titulo" rotulo="Vincular lançamento a pagar (M05)" botao="Vincular lançamento" opcoes={livres.map((titulo) => ({ valor: titulo.id, rotulo: `${titulo.codigo} · ${titulo.descricao}` }))} aoVincular={(valor) => vincularTitulo(campanha.id, valor)} />}
    </div>
  );
}

function DialogoResultados({ campanha, aoFechar }: { campanha: Campanha; aoFechar: () => void }) {
  const [valores, setValores] = useState<FormularioResultados>(() => formularioDosResultados(campanha));
  const [erros, setErros] = useState<Partial<Record<keyof FormularioResultados, string>>>({});
  const mudar = (parcial: Partial<FormularioResultados>) => setValores((atuais) => ({ ...atuais, ...parcial }));
  async function confirmar() {
    const conferido = esquemaResultadosCampanha.safeParse(valores);
    if (!conferido.success) {
      setErros(Object.fromEntries(conferido.error.issues.map((problema) => [problema.path[0], problema.message])));
      return;
    }
    if (await executar(() => salvarResultados(campanha.id, conferido.data), 'Resultados registrados.')) aoFechar();
  }
  const numero = (campo: 'inscritos' | 'contatos' | 'oportunidades' | 'vendas', rotulo: string) => (
    <Campo id={`resultado-${campo}`} rotulo={rotulo} erro={erros[campo]}>
      {(controle) => <Input inputMode="numeric" autoComplete="off" {...controle} value={valores[campo]} onChange={(evento) => mudar({ [campo]: evento.target.value })} />}
    </Campo>
  );
  return (
    <JanelaFormulario
      aberto
      aoFechar={aoFechar}
      titulo={`Resultados de ${campanha.nome}`}
      descricao="Informados à mão. O que ficar vazio aparece como não informado, nunca como zero."
      alterado={JSON.stringify(valores) !== JSON.stringify(formularioDosResultados(campanha))}
      rotuloSalvar="Salvar resultados"
      aoEnviar={(evento) => {
        evento.preventDefault();
        void confirmar();
      }}
    >
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          {numero('inscritos', 'Inscritos')}
          {numero('contatos', 'Contatos')}
          {numero('oportunidades', 'Oportunidades')}
          {numero('vendas', 'Vendas')}
        </div>
        <Campo id="resultado-medido" rotulo="Data da medição" erro={erros.medido_em}>
          {(controle) => <EntradaData {...controle} value={valores.medido_em} onChange={(evento) => mudar({ medido_em: evento.target.value })} />}
        </Campo>
        <Campo id="resultado-observacao" rotulo="Observação">
          {(controle) => <Textarea {...controle} value={valores.observacao} onChange={(evento) => mudar({ observacao: evento.target.value })} />}
        </Campo>
        <Faixa tipo="atencao">{CRITERIO_DE_ORIGEM}</Faixa>
      </div>
    </JanelaFormulario>
  );
}

function Resultados({ campanha, dados, somenteLeitura }: { campanha: Campanha; dados: DadosDasCampanhas; somenteLeitura: boolean }) {
  const [editando, setEditando] = useState(false);
  const { inscritos, oportunidades, contatos, vendas, medido_em, observacao } = campanha.resultados;
  const ligados = ligadosACampanha(campanha.id, dados);
  const livres = dados.oportunidades.filter((oportunidade) => !oportunidade.campanha_id);
  const informado = (valor: number | null) => (valor === null ? <span className="text-ink-soft">Não informado</span> : valor);
  return (
    <div className="grid gap-5">
      <section aria-label="Resultados manuais" className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2>Medição manual</h2>
          {!somenteLeitura && (
            <Button variante="secundario" onClick={() => setEditando(true)}>
              <Pencil aria-hidden />
              Informar resultados
            </Button>
          )}
        </div>
        <ListaDeDados>
          <Dado rotulo="Inscritos">{informado(inscritos)}</Dado>
          <Dado rotulo="Contatos">{informado(contatos)}</Dado>
          <Dado rotulo="Oportunidades">{informado(oportunidades)}</Dado>
          <Dado rotulo="Vendas">{informado(vendas)}</Dado>
          <Dado rotulo="Data da medição">{medido_em ? formatarDiaISO(medido_em) : <span className="text-ink-soft">Não registrada</span>}</Dado>
          {observacao && <Dado rotulo="Observação">{observacao}</Dado>}
        </ListaDeDados>
      </section>
      <section aria-label="Registros ligados à campanha" className="grid gap-2">
        <h2>Registros que apontam para a campanha</h2>
        <p className="text-[13px] text-ink-soft">
          {ligados.inscritos.length === 1 ? '1 inscrito' : `${ligados.inscritos.length} inscritos`} e {ligados.oportunidades.length === 1 ? '1 oportunidade' : `${ligados.oportunidades.length} oportunidades`} com esta campanha informada.
        </p>
        <Faixa tipo="atencao">{CRITERIO_DE_ORIGEM}</Faixa>
        {ligados.oportunidades.length > 0 && (
          <ul aria-label="Oportunidades com esta origem" className="grid gap-2">
            {ligados.oportunidades.map((oportunidade) => (
              <Linha key={oportunidade.id} rotuloTirar={`Tirar a origem de ${oportunidade.titulo}`} aoTirar={somenteLeitura ? undefined : () => void executar(() => indicarCampanhaDaOportunidade(oportunidade.id, null), 'Origem retirada.')}>
                <LinkCentral href={`/comercial/oportunidades/${oportunidade.id}`} className="inline-flex min-h-11 items-center font-semibold underline md:min-h-0">
                  {oportunidade.titulo}
                </LinkCentral>
              </Linha>
            ))}
          </ul>
        )}
        {!somenteLeitura && <Vincular id="campanha-oportunidade" rotulo="Indicar esta campanha como origem de uma oportunidade (M10)" botao="Indicar origem" opcoes={livres.map((oportunidade) => ({ valor: oportunidade.id, rotulo: `${oportunidade.codigo} · ${oportunidade.titulo}` }))} aoVincular={(valor) => indicarCampanhaDaOportunidade(valor, campanha.id)} />}
      </section>
      <p className="flex items-center gap-2 rounded-md border border-line bg-mist p-3 text-[13px] text-ink-soft">
        <BarChart3 className="size-4 shrink-0" aria-hidden />
        Atribuição e custo por inscrito são da F2 e ainda não existem aqui.
      </p>
      {editando && <DialogoResultados campanha={campanha} aoFechar={() => setEditando(false)} />}
    </div>
  );
}

function AbaHistorico({ id }: { id: string }) {
  const consulta = useConsulta(() => historicoDoRegistro('campanha', id), [id]);
  return (
    <div className="rounded-lg border border-line bg-paper p-4 md:p-5">
      <ListaHistorico consulta={consulta} comFiltros />
    </div>
  );
}

/** T08.06, ficha (P2). */
export function FichaCampanha() {
  const { id } = useParams<{ id: string }>();
  const consulta = useConsulta(carregarCampanhas);
  const [editando, setEditando] = useState(false);
  const [arquivando, setArquivando] = useState(false);

  const voltar = (
    <LinkCentral href={CAMINHO} className="mb-5 inline-flex min-h-11 items-center gap-1.5 rounded-pill pr-3 text-[13px] font-medium text-ink-soft hover:text-ink md:min-h-0 [&_svg]:size-4">
      <ArrowLeft aria-hidden />
      Campanhas
    </LinkCentral>
  );

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro' || !consulta.dados) {
    return (
      <>
        {voltar}
        <EstadoErro titulo="Não deu para ler esta campanha." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }
  const dados = consulta.dados;
  const campanha = dados.campanhas.find((item) => item.id === id);
  if (!campanha) {
    return (
      <>
        {voltar}
        <EstadoVazio icone={Megaphone} titulo="Essa campanha não existe mais." texto="Ela pode ter sido removida ao limpar os exemplos ou ao importar um arquivo." />
      </>
    );
  }
  const arquivada = Boolean(campanha.arquivado_em);
  const responsavel = dados.pessoas.find((pessoa) => pessoa.id === campanha.responsavel_id)?.nome_completo ?? 'Pessoa removida';
  const acoes = arquivada ? null : (
    <>
      <Button onClick={() => setEditando(true)}>
        <Pencil aria-hidden />
        Editar campanha
      </Button>
      <MenuSobreposto
        titulo="Mais ações"
        largura={220}
        alinhar="end"
        gatilho={
          <Button variante="icone" tamanho="icone" aria-label="Mais ações da campanha">
            <Ellipsis aria-hidden />
          </Button>
        }
      >
        {(fechar) => (
          <button
            type="button"
            className={`${CLASSE_LINHA_MENU} hover:bg-hover`}
            onClick={() => {
              fechar();
              setArquivando(true);
            }}
          >
            Arquivar
          </button>
        )}
      </MenuSobreposto>
    </>
  );

  return (
    <>
      {voltar}
      <Ficha
        tituloDePagina
        codigo={campanha.codigo}
        titulo={campanha.nome}
        etiquetas={
          <>
            <EtiquetaDaCampanha situacao={campanha.situacao} />
            <EtiquetaDoContexto id={campanha.produto_id} produtos={dados.produtos} marcas={dados.marcas} />
          </>
        }
        responsavel={
          <span className="inline-flex items-center gap-2">
            Responsável: <NomeDaPessoa nome={responsavel} className="text-ink" />
          </span>
        }
        acoes={acoes}
        acoesCelular={acoes}
        arquivado={
          arquivada
            ? {
                texto: `Esta campanha foi arquivada em ${formatarData(campanha.arquivado_em as string)}.`,
                acao: (
                  <Button variante="secundario" tamanho="pequeno" onClick={() => void executar(() => restaurarCampanha(campanha.id), 'Campanha restaurada.')}>
                    <ArchiveRestore aria-hidden />
                    Restaurar
                  </Button>
                ),
              }
            : undefined
        }
        abas={[
          { id: 'resumo', rotulo: 'Resumo', conteudo: <Resumo campanha={campanha} dados={dados} somenteLeitura={arquivada} /> },
          { id: 'conteudo', rotulo: 'Conteúdo', conteudo: <Conteudo campanha={campanha} dados={dados} somenteLeitura={arquivada} /> },
          { id: 'orcamento', rotulo: 'Orçamento', conteudo: <Orcamento campanha={campanha} dados={dados} somenteLeitura={arquivada} /> },
          { id: 'resultados', rotulo: 'Resultados', conteudo: <Resultados campanha={campanha} dados={dados} somenteLeitura={arquivada} /> },
          { id: 'historico', rotulo: 'Histórico', conteudo: <AbaHistorico id={campanha.id} /> },
        ]}
      />
      {editando && <FormularioDeCampanha dados={dados} campanha={campanha} aoFechar={() => setEditando(false)} />}
      <Confirmacao
        aberto={arquivando}
        aoFechar={() => setArquivando(false)}
        titulo={`Arquivar ${campanha.nome}?`}
        texto="Ela sai da lista. Dá para restaurar depois. Lançamentos, peças e oportunidades não mudam."
        rotuloConfirmar="Arquivar campanha"
        perigo
        aoConfirmar={() => {
          setArquivando(false);
          void executar(() => arquivarCampanha(campanha.id), 'Campanha arquivada.');
        }}
      />
    </>
  );
}

