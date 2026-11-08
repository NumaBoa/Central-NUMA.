'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { FolderOpen, Plus, UsersRound } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { Selecao } from '@/componentes/campos/selecao';
import { seletorDeOpcoes } from '@/componentes/f1/apoio';
import { useCentral } from '@/componentes/layout/central-provider';
import { AbasMarketing, EtiquetaDoContexto, KICKER_MARKETING } from '@/componentes/marketing/apoio';
import { aviso } from '@/componentes/padroes/aviso';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { FiltrosEmLinha } from '@/componentes/padroes/filtros-em-linha';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import type { ListaEspera } from '@/dados/tipos/marketing';
import { useConsulta } from '@/dados/use-consulta';
import { ID_CONSOLIDADA } from '@/dominio/contextos';
import { normalizarTexto } from '@/dominio/duplicidade';
import { carregarListas, contadoresDaLista, criarLista, esquemaFormularioLista, inscritosDaLista, inscritosPorOrigem, type DadosDasListas, type FormularioLista } from '@/dominio/listas-espera';
import { hojeISO } from '@/lib/datas';
import { formatarData } from '@/lib/formatacao';

type Filtros = { busca: string; produto: string };
const FILTROS_INICIAIS: Filtros = { busca: '', produto: '' };

function FormularioDeLista({ dados, aoFechar, aoCriar }: { dados: DadosDasListas; aoFechar: () => void; aoCriar: (lista: ListaEspera) => void }) {
  const { contexto } = useCentral();
  const { register, handleSubmit, control, formState } = useForm<FormularioLista>({
    resolver: zodResolver(esquemaFormularioLista),
    defaultValues: { produto_id: contexto.id === ID_CONSOLIDADA || !dados.produtos.some((produto) => produto.id === contexto.id) ? '' : contexto.id, nome: '', texto: '', vigente_desde: hojeISO() },
    mode: 'onTouched',
  });
  const { errors, isDirty, isSubmitting } = formState;
  const enviar = handleSubmit(async (formulario) => {
    try {
      aoCriar(await criarLista(formulario));
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  });
  return (
    <JanelaFormulario aberto aoFechar={aoFechar} titulo="Nova lista de espera" descricao="Cada lista é de um produto e nasce com a versão 1 do texto de consentimento." alterado={isDirty} aoEnviar={(evento) => void enviar(evento)} rotuloSalvar="Criar lista" salvando={isSubmitting}>
      <div className="grid gap-[18px]">
        <Controller
          control={control}
          name="produto_id"
          render={({ field }) => (
            <Campo id="lista-produto" rotulo="Produto" obrigatorio erro={errors.produto_id?.message}>
              {(controle) => (
                <Selecao {...controle} {...field}>
                  <option value="">Escolha</option>
                  {dados.produtos
                    .filter((produto) => !produto.arquivado_em && produto.situacao === 'ativo')
                    .map((produto) => (
                      <option key={produto.id} value={produto.id}>
                        {produto.nome}
                      </option>
                    ))}
                </Selecao>
              )}
            </Campo>
          )}
        />
        <Campo id="lista-nome" rotulo="Nome da lista" obrigatorio erro={errors.nome?.message}>
          {(controle) => <Input autoComplete="off" {...controle} {...register('nome')} />}
        </Campo>
        <Campo id="lista-texto" rotulo="Texto de consentimento" obrigatorio erro={errors.texto?.message} ajuda="É o que a pessoa aceita. Uma versão aceita não muda: para alterar, publique outra.">
          {(controle) => <Textarea {...controle} rows={4} {...register('texto')} />}
        </Campo>
        <Campo id="lista-vigente" rotulo="Vale desde" obrigatorio erro={errors.vigente_desde?.message}>
          {(controle) => <EntradaData {...controle} {...register('vigente_desde')} />}
        </Campo>
      </div>
    </JanelaFormulario>
  );
}

/** T08.07, lista de listas. */
export function TelaListas() {
  const roteador = useRouter();
  const { contexto } = useCentral();
  const consulta = useConsulta(carregarListas);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIAIS);
  const [nova, setNova] = useState(false);
  const dados = consulta.dados;

  const linhas = useMemo(() => {
    if (!dados) return [];
    const texto = normalizarTexto(filtros.busca);
    const produto = filtros.produto || (contexto.id === ID_CONSOLIDADA ? '' : contexto.id);
    return dados.listas.filter((lista) => !lista.arquivado_em && (!texto || normalizarTexto(lista.nome).includes(texto)) && (!produto || lista.produto_id === produto)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [dados, filtros, contexto.id]);

  const colunas = useMemo<readonly Coluna<ListaEspera>[]>(() => {
    if (!dados) return [];
    const de = (lista: ListaEspera) => contadoresDaLista(inscritosDaLista(lista.id, dados.inscritos));
    const numero = (id: string, titulo: string, campo: keyof ReturnType<typeof de>, essencial = false): Coluna<ListaEspera> => ({ id, titulo, essencial, numerica: true, ordenar: (a, b) => de(a)[campo] - de(b)[campo], texto: (lista) => String(de(lista)[campo]), celula: (lista) => de(lista)[campo] });
    return [
      { id: 'nome', titulo: 'Lista', fixa: true, essencial: true, ordenar: (a, b) => a.nome.localeCompare(b.nome, 'pt-BR'), texto: (lista) => lista.nome, celula: (lista) => <span className="flex min-w-44 flex-wrap items-center gap-2 font-medium break-words">{lista.nome}{lista.situacao === 'encerrada' && <EtiquetaSituacao tipo="neutro">Encerrada</EtiquetaSituacao>}</span> },
      { id: 'produto', titulo: 'Produto', essencial: true, celula: (lista) => <EtiquetaDoContexto id={lista.produto_id} produtos={dados.produtos} marcas={dados.marcas} /> },
      numero('ativos', 'Ativos', 'ativos', true),
      numero('convidados', 'Convidados', 'convidados'),
      numero('convertidos', 'Convertidos', 'convertidos'),
      numero('descadastrados', 'Descadastrados', 'descadastrados', true),
      { id: 'origem', titulo: 'Origem principal', texto: (lista) => inscritosPorOrigem(inscritosDaLista(lista.id, dados.inscritos))[0]?.origem ?? '', celula: (lista) => inscritosPorOrigem(inscritosDaLista(lista.id, dados.inscritos))[0]?.origem ?? '—' },
      { id: 'criada', titulo: 'Criada em', ordenar: (a, b) => a.criado_em.localeCompare(b.criado_em), celula: (lista) => <span className="tabular-nums">{formatarData(lista.criado_em)}</span> },
    ];
  }, [dados]);

  const cabecalho = (
    <CabecalhoPagina
      kicker={KICKER_MARKETING}
      titulo="Listas de espera"
      resumo="Inscritos, consentimentos e acompanhamento por produto. A Central não envia mensagens."
      acoes={
        <Button disabled={!dados} onClick={() => setNova(true)}>
          <Plus aria-hidden />
          Nova lista
        </Button>
      }
    />
  );

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro' || !dados) {
    return (
      <>
        {cabecalho}
        <AbasMarketing ativa="listas" />
        <EstadoErro className="mt-5" titulo="Não deu para ler as listas de espera." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }

  const nomeDoProduto = dados.produtos.find((produto) => produto.id === filtros.produto)?.nome;
  return (
    <div>
      {cabecalho}
      <AbasMarketing ativa="listas" />
      <div className="mt-5 space-y-4">
        <FiltrosEmLinha
          filtros={filtros}
          aoMudar={(parcial) => setFiltros((atuais) => ({ ...atuais, ...parcial }))}
          aoLimpar={() => setFiltros(FILTROS_INICIAIS)}
          rotuloBusca="Buscar lista pelo nome"
          seletores={[seletorDeOpcoes<Filtros>({ id: 'produto', rotulo: 'Produto', icone: FolderOpen, campo: 'produto', opcoes: dados.produtos.filter((produto) => !produto.arquivado_em).map((produto) => ({ valor: produto.id, rotulo: produto.nome })) })]}
          quantosAvancados={() => 0}
          avancados={() => <p className="text-[13px] text-ink-soft">Os filtros de inscritos ficam dentro de cada lista.</p>}
          ativos={nomeDoProduto ? [{ id: 'produto', rotulo: `Produto: ${nomeDoProduto}` }] : []}
          aoRemoverAtivo={() => setFiltros((atuais) => ({ ...atuais, produto: '' }))}
        />
        <Lista
          rotulo="Listas de espera"
          linhas={linhas}
          colunas={colunas}
          chave={(lista) => lista.id}
          aoAbrir={(lista) => roteador.push(`/marketing/listas/${lista.id}`)}
          filtrando={Boolean(filtros.busca.trim() || filtros.produto)}
          aoLimparFiltros={() => setFiltros(FILTROS_INICIAIS)}
          vazio={<EstadoVazio icone={UsersRound} titulo="Nenhuma lista de espera ainda." texto="Crie a lista de um produto com o texto de consentimento que as pessoas vão aceitar." acao={<Button onClick={() => setNova(true)}>Nova lista</Button>} />}
          cartao={(lista) => {
            const contagem = contadoresDaLista(inscritosDaLista(lista.id, dados.inscritos));
            return (
              <span className="grid gap-1.5">
                <span className="font-semibold break-words">{lista.nome}</span>
                <EtiquetaDoContexto id={lista.produto_id} produtos={dados.produtos} marcas={dados.marcas} />
                <span className="text-[13px] text-ink-soft tabular-nums">
                  {contagem.ativos} ativos · {contagem.convidados} convidados · {contagem.convertidos} convertidos · {contagem.descadastrados} descadastrados
                </span>
              </span>
            );
          }}
        />
      </div>
      {nova && <FormularioDeLista dados={dados} aoFechar={() => setNova(false)} aoCriar={(lista) => roteador.push(`/marketing/listas/${lista.id}`)} />}
    </div>
  );
}
