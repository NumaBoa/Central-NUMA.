'use client';

import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Database, Layers, Plus, Scale, Trash2 } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { Campo } from '@/componentes/campos/campo';
import { Selecao } from '@/componentes/campos/selecao';
import { AbasLegal } from '@/componentes/f1/abas-modulos';
import { CaixasDeSelecao, errosDoFormulario, paraOpcoes, seletorDeOpcoes } from '@/componentes/f1/apoio';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaLivre, EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { FiltrosEmLinha } from '@/componentes/padroes/filtros-em-linha';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import { useConsulta } from '@/dados/use-consulta';
import { nomeDaContraparte } from '@/dominio/contrapartes';
import { carregarInventario, esquemaFormularioTratamento, FORMULARIO_TRATAMENTO_VAZIO, ID_NUMA_INSTITUCIONAL, ROTULOS_BASE_LEGAL, ROTULOS_CATEGORIA_DADOS, ROTULOS_TITULARES, ROTULOS_TRANSFERENCIA, salvarTratamento, type DadosInventario, type FormularioTratamento, type LinhaTratamento } from '@/dominio/legal';
import { formatarDiaISO } from '@/lib/formatacao';

const IDS = { nome: 'trat-nome', finalidade: 'trat-finalidade', titulares: 'trat-titulares', categorias_dados: 'trat-categorias', justificativa_sensiveis: 'trat-justificativa', base_legal: 'trat-base', ferramentas: 'trat-ferramentas', retencao: 'trat-retencao', transferencia_internacional: 'trat-transferencia', compartilhamentos: 'trat-compartilhamentos' } as const;

function FormularioTratamentoDados({ tratamento, dados, aoFechar }: { tratamento: LinhaTratamento | null; dados: DadosInventario; aoFechar: () => void }) {
  const inicial: Partial<FormularioTratamento> = tratamento
    ? { produto_id: tratamento.produto_id ?? '', nome: tratamento.nome, finalidade: tratamento.finalidade, titulares: tratamento.titulares, categorias_dados: tratamento.categorias_dados, justificativa_sensiveis: tratamento.justificativa_sensiveis ?? '', base_legal: tratamento.base_legal, ferramentas: tratamento.ferramentas, retencao: tratamento.retencao, transferencia_internacional: tratamento.transferencia_internacional, medidas: tratamento.medidas ?? '', compartilhamentos: tratamento.compartilhamentos }
    : { ...FORMULARIO_TRATAMENTO_VAZIO, titulares: [], categorias_dados: [], ferramentas: [], compartilhamentos: [] };
  const { register, control, handleSubmit, watch, formState } = useForm<FormularioTratamento>({ resolver: zodResolver(esquemaFormularioTratamento), defaultValues: inicial, mode: 'onTouched' });
  const { errors } = formState;
  const categorias = watch('categorias_dados') ?? [];
  const enviar = handleSubmit(async (formulario) => {
    try {
      await salvarTratamento(formulario, tratamento?.id);
      aviso(tratamento ? 'Operação atualizada.' : 'Operação registrada.');
      aoFechar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  });
  return (
    <JanelaFormulario colunas={2} aberto aoFechar={aoFechar} titulo={tratamento ? 'Editar operação' : 'Nova operação de tratamento'} alterado={formState.isDirty} aoEnviar={enviar} salvando={formState.isSubmitting} erros={errosDoFormulario(errors, IDS)} rotuloSalvar={tratamento ? 'Salvar alterações' : 'Salvar'}>
      <div className="grid grid-cols-1 gap-[18px]">
        <Controller
          control={control}
          name="produto_id"
          render={({ field }) => (
            <Campo id="trat-produto" rotulo="Produto" obrigatorio>
              {(controle) => (
                <Selecao {...controle} {...field}>
                  <option value="">Numa institucional</option>
                  {dados.produtos
                    .filter((produto) => !produto.arquivado_em)
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
        <Campo id={IDS.nome} rotulo="Nome da operação" obrigatorio erro={errors.nome?.message}>
          {(controle) => <Input {...controle} autoComplete="off" {...register('nome')} />}
        </Campo>
        <Campo id={IDS.finalidade} rotulo="Finalidade" obrigatorio erro={errors.finalidade?.message}>
          {(controle) => <Textarea {...controle} rows={2} {...register('finalidade')} />}
        </Campo>
        <Controller control={control} name="titulares" render={({ field }) => <CaixasDeSelecao id={IDS.titulares} rotulo="Categorias de titulares" obrigatorio opcoes={paraOpcoes(ROTULOS_TITULARES)} valores={field.value ?? []} aoMudar={field.onChange} erro={errors.titulares?.message} />} />
        <Controller control={control} name="categorias_dados" render={({ field }) => <CaixasDeSelecao id={IDS.categorias_dados} rotulo="Categorias de dados" obrigatorio opcoes={paraOpcoes(ROTULOS_CATEGORIA_DADOS)} valores={field.value ?? []} aoMudar={field.onChange} erro={errors.categorias_dados?.message} />} />
        {categorias.includes('criancas_adolescentes') && <Faixa tipo="atencao">Dados de crianças e adolescentes pedem cuidado redobrado: confira a base legal com quem valida.</Faixa>}
        {categorias.includes('sensiveis') && (
          <Campo id={IDS.justificativa_sensiveis} rotulo="Justificativa dos dados sensíveis" obrigatorio erro={errors.justificativa_sensiveis?.message}>
            {(controle) => <Textarea {...controle} rows={2} {...register('justificativa_sensiveis')} />}
          </Campo>
        )}
        <Controller
          control={control}
          name="base_legal"
          render={({ field }) => (
            <Campo id={IDS.base_legal} rotulo="Base legal" obrigatorio erro={errors.base_legal?.message}>
              {(controle) => (
                <Selecao {...controle} {...field} value={field.value ?? ''}>
                  <option value="">Escolha</option>
                  {paraOpcoes(ROTULOS_BASE_LEGAL).map((opcao) => (
                    <option key={opcao.valor} value={opcao.valor}>
                      {opcao.rotulo}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          )}
        />
        <Controller
          control={control}
          name="ferramentas"
          render={({ field }) =>
            dados.ferramentas.length ? (
              <CaixasDeSelecao id={IDS.ferramentas} rotulo="Ferramentas de armazenamento ou processamento" obrigatorio opcoes={dados.ferramentas.map((ferramenta) => ({ valor: ferramenta.id, rotulo: ferramenta.nome }))} valores={field.value ?? []} aoMudar={field.onChange} erro={errors.ferramentas?.message} />
            ) : (
              <Faixa tipo="atencao" acao={<LinkCentral href="/ferramentas">Abrir ferramentas</LinkCentral>}>
                Nenhuma ferramenta cadastrada. A operação precisa de pelo menos uma.
              </Faixa>
            )
          }
        />
        <Controller
          control={control}
          name="transferencia_internacional"
          render={({ field }) => (
            <Campo id={IDS.transferencia_internacional} rotulo="Transferência internacional" obrigatorio erro={errors.transferencia_internacional?.message}>
              {(controle) => (
                <Selecao {...controle} {...field} value={field.value ?? ''}>
                  <option value="">Escolha</option>
                  {paraOpcoes(ROTULOS_TRANSFERENCIA).map((opcao) => (
                    <option key={opcao.valor} value={opcao.valor}>
                      {opcao.rotulo}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          )}
        />
        <Campo id={IDS.retencao} rotulo="Retenção" obrigatorio erro={errors.retencao?.message} ajuda="Prazo e critério de eliminação.">
          {(controle) => <Input {...controle} autoComplete="off" {...register('retencao')} />}
        </Campo>
        <Campo id="trat-medidas" rotulo="Medidas de segurança">
          {(controle) => <Textarea {...controle} rows={2} {...register('medidas')} />}
        </Campo>
        <Controller
          control={control}
          name="compartilhamentos"
          render={({ field }) => (
            <div id={IDS.compartilhamentos} tabIndex={-1} className="grid gap-2">
              <p className="texto-rotulo">Compartilhamento com terceiros</p>
              {(field.value ?? []).map((linha, indice) => (
                <div key={indice} className="grid gap-2 rounded-md border border-line p-3">
                  <Selecao aria-label={`Contraparte do compartilhamento ${indice + 1}`} value={linha.contraparte_id} onChange={(evento) => field.onChange(field.value.map((item, i) => (i === indice ? { ...item, contraparte_id: evento.target.value } : item)))}>
                    <option value="">Escolha a contraparte</option>
                    {dados.contrapartes
                      .filter((contraparte) => !contraparte.arquivado_em)
                      .map((contraparte) => (
                        <option key={contraparte.id} value={contraparte.id}>
                          {nomeDaContraparte(contraparte)}
                        </option>
                      ))}
                  </Selecao>
                  <Input aria-label={`Finalidade do compartilhamento ${indice + 1}`} placeholder="Finalidade" autoComplete="off" value={linha.finalidade} onChange={(evento) => field.onChange(field.value.map((item, i) => (i === indice ? { ...item, finalidade: evento.target.value } : item)))} />
                  <Button variante="terciario" tamanho="pequeno" className="justify-self-start" onClick={() => field.onChange(field.value.filter((_, i) => i !== indice))}>
                    <Trash2 aria-hidden />
                    Tirar
                  </Button>
                </div>
              ))}
              <Button variante="secundario" className="justify-self-start" onClick={() => field.onChange([...(field.value ?? []), { contraparte_id: '', finalidade: '' }])}>
                <Plus aria-hidden />
                Incluir compartilhamento
              </Button>
              {errors.compartilhamentos && <p className="text-xs text-err">Complete a contraparte e a finalidade de cada compartilhamento.</p>}
            </div>
          )}
        />
      </div>
    </JanelaFormulario>
  );
}

type Filtros = { busca: string; produto: string; base: string };
const INICIAIS: Filtros = { busca: '', produto: '', base: '' };

/** T09.03. Mudar dado, finalidade ou ferramenta marca a política vigente para revisão (RN-09.06). */
export function TelaInventario() {
  const consulta = useConsulta(carregarInventario);
  const dados = consulta.dados;
  const [filtros, setFiltros] = useState<Filtros>(INICIAIS);
  const [janela, setJanela] = useState<{ tratamento: LinhaTratamento | null } | null>(null);
  const nomeDoProduto = (id: string | null) => (id ? (dados?.produtos.find((produto) => produto.id === id)?.nome ?? 'Produto removido') : 'Numa institucional');
  const nomesDasFerramentas = (ids: readonly string[]) => ids.map((id) => dados?.ferramentas.find((ferramenta) => ferramenta.id === id)?.nome ?? 'Ferramenta removida').join(', ');

  const linhas = useMemo(() => {
    const termo = filtros.busca.trim().toLowerCase();
    return (dados?.tratamentos ?? []).filter((linha) => !linha.arquivado_em && (!filtros.produto || (filtros.produto === ID_NUMA_INSTITUCIONAL ? linha.produto_id === null : linha.produto_id === filtros.produto)) && (!filtros.base || linha.base_legal === filtros.base) && (!termo || `${linha.nome} ${linha.finalidade}`.toLowerCase().includes(termo)));
  }, [dados, filtros]);
  const opcoesProduto = [{ valor: ID_NUMA_INSTITUCIONAL, rotulo: 'Numa institucional' }, ...(dados?.produtos ?? []).filter((produto) => !produto.arquivado_em).map((produto) => ({ valor: produto.id, rotulo: produto.nome }))];
  const opcoesBase = paraOpcoes(ROTULOS_BASE_LEGAL);

  const colunas: readonly Coluna<LinhaTratamento>[] = [
    { id: 'produto', titulo: 'Produto', essencial: true, ordenar: (a, b) => nomeDoProduto(a.produto_id).localeCompare(nomeDoProduto(b.produto_id), 'pt-BR'), celula: (linha) => nomeDoProduto(linha.produto_id) },
    { id: 'operacao', titulo: 'Operação', essencial: true, ordenar: (a, b) => a.nome.localeCompare(b.nome, 'pt-BR'), celula: (linha) => <span className="font-medium">{linha.nome}</span> },
    { id: 'finalidade', titulo: 'Finalidade', celula: (linha) => <span className="block max-w-56 truncate">{linha.finalidade}</span> },
    { id: 'dados', titulo: 'Categorias de dados', celula: (linha) => <span className="flex max-w-64 flex-wrap gap-1">{linha.categorias_dados.map((categoria) => <EtiquetaLivre key={categoria}>{ROTULOS_CATEGORIA_DADOS[categoria]}</EtiquetaLivre>)}</span> },
    { id: 'base', titulo: 'Base legal', essencial: true, celula: (linha) => ROTULOS_BASE_LEGAL[linha.base_legal] },
    { id: 'ferramentas', titulo: 'Ferramentas', celula: (linha) => nomesDasFerramentas(linha.ferramentas) },
    { id: 'retencao', titulo: 'Retenção', celula: (linha) => linha.retencao },
    { id: 'compartilhamentos', titulo: 'Compartilhamentos', numerica: true, celula: (linha) => linha.compartilhamentos.length },
    { id: 'revisado', titulo: 'Revisado em', celula: (linha) => (linha.revisado_em ? formatarDiaISO(linha.revisado_em) : '—') },
  ];

  return (
    <>
      <CabecalhoPagina
        comoUsar="/ajuda/legal/inventario"
        kicker="Legal e privacidade"
        titulo="Inventário de tratamento"
        resumo="O que a Numa trata, para quê, onde e por quanto tempo."
        acoes={
          <Button disabled={!dados} onClick={() => setJanela({ tratamento: null })}>
            <Plus aria-hidden />
            Nova operação
          </Button>
        }
      />
      <AbasLegal ativa="privacidade" sub="inventario" />
      <div className="mt-5 space-y-4">
        {consulta.estado === 'erro' && <EstadoErro titulo="Não deu para ler o inventário." aoTentarDeNovo={consulta.recarregar} />}
        {Boolean(dados?.semOperacao.length) && (
          <Faixa tipo="atencao">
            Ferramentas que tratam dados e não têm operação no inventário: {dados?.semOperacao.map((ferramenta) => ferramenta.nome).join(', ')} (RN-09.09).
          </Faixa>
        )}
        <FiltrosEmLinha
          filtros={filtros}
          aoMudar={(parcial) => setFiltros((atuais) => ({ ...atuais, ...parcial }))}
          aoLimpar={() => setFiltros(INICIAIS)}
          rotuloBusca="Buscar operações"
          seletores={[seletorDeOpcoes<Filtros>({ id: 'produto', rotulo: 'Produto', icone: Layers, campo: 'produto', opcoes: opcoesProduto }), seletorDeOpcoes<Filtros>({ id: 'base', rotulo: 'Base legal', icone: Scale, campo: 'base', opcoes: opcoesBase, todos: 'Todas' })]}
          avancados={() => null}
          quantosAvancados={() => 0}
          ativos={[...(filtros.produto ? [{ id: 'produto', rotulo: `Produto: ${opcoesProduto.find((opcao) => opcao.valor === filtros.produto)?.rotulo ?? ''}` }] : []), ...(filtros.base ? [{ id: 'base', rotulo: `Base legal: ${opcoesBase.find((opcao) => opcao.valor === filtros.base)?.rotulo ?? ''}` }] : [])]}
          aoRemoverAtivo={(id) => setFiltros((atuais) => ({ ...atuais, [id]: '' }))}
        />
        <Lista
          rotulo="Inventário de tratamento"
          linhas={linhas}
          colunas={colunas}
          chave={(linha) => linha.id}
          estado={consulta.estado === 'carregando' ? 'carregando' : 'pronto'}
          filtrando={Boolean(filtros.busca.trim() || filtros.produto || filtros.base)}
          aoLimparFiltros={() => setFiltros(INICIAIS)}
          aoAbrir={(linha) => setJanela({ tratamento: linha })}
          cartao={(linha) => (
            <span className="grid gap-1">
              <span className="font-semibold">{linha.nome}</span>
              <span className="text-[13px] text-ink-soft">
                {nomeDoProduto(linha.produto_id)} · {ROTULOS_BASE_LEGAL[linha.base_legal]}
              </span>
              {linha.categorias_dados.includes('sensiveis') && <EtiquetaSituacao tipo="atencao">Dados sensíveis</EtiquetaSituacao>}
            </span>
          )}
          vazio={<EstadoVazio icone={Database} titulo="Nenhuma operação no inventário." texto="Registre cada uso de dado pessoal: o que é tratado, para quê, onde e por quanto tempo." acao={<Button onClick={() => setJanela({ tratamento: null })}>Nova operação</Button>} />}
        />
      </div>
      {janela && dados && <FormularioTratamentoDados tratamento={janela.tratamento} dados={dados} aoFechar={() => setJanela(null)} />}
    </>
  );
}
