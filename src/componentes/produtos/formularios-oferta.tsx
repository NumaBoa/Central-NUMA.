'use client';

import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { Pilulas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { SelecaoMoeda } from '@/componentes/campos/selecao-moeda';
import { aviso } from '@/componentes/padroes/aviso';
import { Faixa } from '@/componentes/padroes/faixa';
import { JanelaFormulario, type ErroDeCampo } from '@/componentes/padroes/janela-formulario';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import type { CanalVenda, Oferta, OfertaRecurso, PrecoVersao, Simulacao } from '@/dados/tipos/precificacao';
import { valorParaCampo } from '@/dominio/dinheiro';
import { criarRascunhoDePreco, erroDoValor, esquemaFormularioOferta, FORMULARIO_OFERTA_VAZIO, formularioDaOferta, lerValorDoCampo, PERIODICIDADES_DE_PRECO, ROTULOS_FORMALIZACAO, ROTULOS_PERIODICIDADE_PRECO, ROTULOS_PUBLICO_OFERTA, ROTULOS_TIPO_OFERTA, salvarOferta, salvarRascunhoDePreco, TODOS_OS_CANAIS, type FormularioOferta as DadosDoFormulario } from '@/dominio/precificacao';
import { useAvisoDeCredencial } from './aviso-credencial-m07';

const OPCOES_PUBLICO = Object.entries(ROTULOS_PUBLICO_OFERTA).map(([valor, rotulo]) => ({ valor, rotulo }));

type FormularioOfertaProps = { aberto: boolean; aoFechar: () => void; produtoId: string; nomeDoProduto: string; oferta?: Oferta | null; recursos?: readonly OfertaRecurso[]; aoCriar?: (oferta: Oferta) => void };

/** T07.04: nasce Em estudo e sem preço. O preço só vem depois, em uma versão. */
export function FormularioOferta({ aberto, aoFechar, produtoId, nomeDoProduto, oferta, recursos = [], aoCriar }: FormularioOfertaProps) {
  const { register, control, handleSubmit, reset, watch, setError, formState } = useForm<DadosDoFormulario>({ resolver: zodResolver(esquemaFormularioOferta), defaultValues: FORMULARIO_OFERTA_VAZIO, mode: 'onTouched' });
  const { errors, isDirty, isSubmitting } = formState;
  const lista = useFieldArray({ control, name: 'recursos' });
  const credencial = useAvisoDeCredencial();
  const tipo = watch('tipo');

  useEffect(() => {
    if (!aberto) return;
    reset(oferta ? formularioDaOferta(oferta, recursos) : FORMULARIO_OFERTA_VAZIO);
    credencial.limpar();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- começa do que está salvo a cada vez que abre
  }, [aberto, oferta?.id]);

  const erros: ErroDeCampo[] = [
    ...(errors.nome?.message ? [{ campoId: 'oferta-nome', mensagem: errors.nome.message }] : []),
    ...(errors.periodicidade?.message ? [{ campoId: 'oferta-periodicidade', mensagem: errors.periodicidade.message }] : []),
    ...lista.fields.flatMap((_, indice) => {
      const mensagem = errors.recursos?.[indice]?.nome?.message;
      return mensagem ? [{ campoId: `oferta-recurso-${indice}`, mensagem }] : [];
    }),
  ];

  const enviar = handleSubmit(async (dados) => {
    if (!credencial.conferir([dados.nome, dados.descricao, dados.exclusoes, ...dados.recursos.flatMap((recurso) => [recurso.nome, recurso.observacao])])) return;
    try {
      const salva = await salvarOferta(produtoId, dados, oferta?.id);
      aviso(oferta ? 'Oferta atualizada.' : 'Oferta criada: Em estudo e sem preço.');
      aoFechar();
      if (!oferta) aoCriar?.(salva);
    } catch (erro) {
      const mensagem = mensagemDoErro(erro);
      if (mensagem.includes('nome')) setError('nome', { message: mensagem }, { shouldFocus: true });
      else aviso(mensagem);
    }
  });

  return (
    <JanelaFormulario colunas={2} aberto={aberto} aoFechar={aoFechar} titulo={oferta ? 'Editar oferta' : 'Nova oferta'} descricao={`${nomeDoProduto}: cada produto tem as suas ofertas.`} alterado={isDirty} aoEnviar={(evento) => void enviar(evento)} rotuloSalvar={oferta ? 'Salvar alterações' : 'Criar oferta'} salvando={isSubmitting} erros={erros}>
      {credencial.faixa}
      <div className="grid grid-cols-1 gap-[18px]">
        <Campo id="oferta-nome" rotulo="Nome" obrigatorio erro={errors.nome?.message} ajuda="Único neste produto.">
          {(controle) => <Input autoComplete="off" {...controle} {...register('nome')} />}
        </Campo>
        <Controller
          control={control}
          name="tipo"
          render={({ field }) => (
            <Campo rotulo="Tipo" obrigatorio ajuda={tipo === 'gratuidade' ? 'Gratuidade tem preço R$ 0,00 explícito e dispensa simulação.' : undefined}>
              {(controle) => (
                <Selecao {...controle} {...field}>
                  {Object.entries(ROTULOS_TIPO_OFERTA).map(([valor, rotulo]) => (
                    <option key={valor} value={valor}>
                      {rotulo}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          )}
        />
        <Controller control={control} name="publico" render={({ field }) => <Pilulas rotulo="Público" obrigatorio valor={field.value} aoMudar={field.onChange} opcoes={OPCOES_PUBLICO} />} />
        <Controller
          control={control}
          name="formalizacao"
          render={({ field }) => (
            <Campo rotulo="Forma de formalização" obrigatorio>
              {(controle) => (
                <Selecao {...controle} {...field}>
                  {Object.entries(ROTULOS_FORMALIZACAO).map(([valor, rotulo]) => (
                    <option key={valor} value={valor}>
                      {rotulo}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          )}
        />
        <Controller
          control={control}
          name="periodicidade"
          render={({ field }) => (
            <Campo id="oferta-periodicidade" rotulo="Periodicidade de cobrança" obrigatorio={tipo === 'assinatura'} erro={errors.periodicidade?.message}>
              {(controle) => (
                <Selecao {...controle} {...field}>
                  <option value="">Não se aplica</option>
                  {PERIODICIDADES_DE_PRECO.map((opcao) => (
                    <option key={opcao} value={opcao}>
                      {ROTULOS_PERIODICIDADE_PRECO[opcao]}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          )}
        />
        <Campo rotulo="Descrição">{(controle) => <Textarea {...controle} {...register('descricao')} />}</Campo>
        <div className="md:col-span-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="texto-rotulo">Recursos incluídos</h3>
            <Button variante="terciario" tamanho="pequeno" onClick={() => lista.append({ id: '', nome: '', incluido: true, limite: '', observacao: '' })}>
              <Plus aria-hidden />
              Adicionar recurso
            </Button>
          </div>
          {lista.fields.length === 0 && <p className="text-[13px] text-ink-soft">Nenhum recurso ainda. Ex.: “até 3 revendedores”.</p>}
          <ul className="grid gap-2.5">
            {lista.fields.map((campo, indice) => (
              <li key={campo.id} className="grid gap-2.5 rounded-md border border-line p-3">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <Campo id={`oferta-recurso-${indice}`} rotulo="Recurso" obrigatorio erro={errors.recursos?.[indice]?.nome?.message}>
                    {(controle) => <Input autoComplete="off" {...controle} {...register(`recursos.${indice}.nome`)} />}
                  </Campo>
                  <Campo rotulo="Limite">{(controle) => <Input autoComplete="off" {...controle} {...register(`recursos.${indice}.limite`)} />}</Campo>
                </div>
                <Campo rotulo="Observação">{(controle) => <Input autoComplete="off" {...controle} {...register(`recursos.${indice}.observacao`)} />}</Campo>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Controller
                    control={control}
                    name={`recursos.${indice}.incluido`}
                    render={({ field }) => (
                      <Pilulas
                        rotulo="Incluído"
                        valor={field.value ? 'sim' : 'nao'}
                        aoMudar={(valor) => field.onChange(valor === 'sim')}
                        opcoes={[
                          { valor: 'sim', rotulo: 'Sim' },
                          { valor: 'nao', rotulo: 'Não' },
                        ]}
                      />
                    )}
                  />
                  <Button variante="terciario" tamanho="pequeno" onClick={() => lista.remove(indice)}>
                    <Trash2 aria-hidden />
                    Remover
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="md:col-span-2">
          <Campo rotulo="Exclusões" ajuda="Vai para as propostas (M10).">
            {(controle) => <Textarea {...controle} {...register('exclusoes')} />}
          </Campo>
        </div>
      </div>
    </JanelaFormulario>
  );
}

type FormularioVersaoProps = { aberto: boolean; aoFechar: () => void; oferta: Oferta; canais: readonly CanalVenda[]; simulacoes: readonly Simulacao[]; preco?: PrecoVersao | null };

/** Rascunho: não vale nada até ser aprovado. Valor vazio fica "Não definido". */
export function FormularioVersao({ aberto, aoFechar, oferta, canais, simulacoes, preco }: FormularioVersaoProps) {
  const gratuidade = oferta.tipo === 'gratuidade';
  const [canalId, setCanalId] = useState('');
  const [valor, setValor] = useState('');
  const [moeda, setMoeda] = useState('BRL');
  const [periodicidade, setPeriodicidade] = useState<PrecoVersao['periodicidade']>('mensal');
  const [inicio, setInicio] = useState('');
  const [simulacaoId, setSimulacaoId] = useState('');
  const [erroDoCampo, setErroDoCampo] = useState<string | undefined>();
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setCanalId(preco?.canal_id ?? '');
    setValor(preco?.valor === null || preco?.valor === undefined ? (gratuidade ? '0,00' : '') : valorParaCampo(preco.valor));
    setMoeda(preco?.moeda ?? 'BRL');
    setPeriodicidade(preco?.periodicidade ?? oferta.periodicidade ?? 'mensal');
    setInicio(preco?.valido_de ?? '');
    setSimulacaoId(preco?.simulacao_id ?? '');
    setErroDoCampo(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- começa do que está salvo a cada vez que abre
  }, [aberto, preco?.id]);

  async function enviar() {
    if (salvando) return;
    const lido = lerValorDoCampo(valor);
    const erro = lido === undefined ? 'Use um valor como 19,90. Sem valor, deixe vazio.' : erroDoValor(oferta.tipo, lido);
    if (erro) {
      setErroDoCampo(erro);
      document.getElementById('versao-valor')?.focus();
      return;
    }
    setSalvando(true);
    const dados = { canal_id: canalId || null, valor: lido ?? null, moeda, periodicidade, valido_de: inicio || null, simulacao_id: simulacaoId || null };
    try {
      if (preco) await salvarRascunhoDePreco(preco.id, dados);
      else await criarRascunhoDePreco(oferta.id, dados);
      aviso(preco ? 'Rascunho atualizado.' : 'Rascunho criado. Ele ainda não vale: precisa ser aprovado.');
      aoFechar();
    } catch (falha) {
      aviso(mensagemDoErro(falha));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <JanelaFormulario
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={preco ? `Editar rascunho v${preco.versao}` : 'Nova versão de preço'}
      descricao={`${oferta.nome}: fica em rascunho até ser aprovada.`}
      alterado={Boolean(valor && !preco)}
      aoEnviar={(evento) => {
        evento.preventDefault();
        void enviar();
      }}
      rotuloSalvar={preco ? 'Salvar rascunho' : 'Criar rascunho'}
      salvando={salvando}
      erros={erroDoCampo ? [{ campoId: 'versao-valor', mensagem: erroDoCampo }] : []}
    >
      <div className="grid gap-[18px]">
        <Campo rotulo="Canal" obrigatorio>
          {(controle) => (
            <Selecao {...controle} value={canalId} onChange={(evento) => setCanalId(evento.target.value)}>
              <option value="">{TODOS_OS_CANAIS}</option>
              {canais
                .filter((canal) => canal.situacao === 'ativo' || canal.id === canalId)
                .map((canal) => (
                  <option key={canal.id} value={canal.id}>
                    {canal.nome}
                  </option>
                ))}
            </Selecao>
          )}
        </Campo>
        <Campo id="versao-valor" rotulo="Valor" erro={erroDoCampo} ajuda={gratuidade ? 'Gratuidade: R$ 0,00 explícito.' : 'Vazio fica “Não definido”, e isso é diferente de R$ 0,00.'}>
          {(controle) => <Input {...controle} inputMode="decimal" autoComplete="off" value={valor} onChange={(evento) => setValor(evento.target.value)} />}
        </Campo>
        <Campo rotulo="Moeda" obrigatorio>
          {(controle) => <SelecaoMoeda {...controle} value={moeda} onChange={(evento) => setMoeda(evento.target.value)} />}
        </Campo>
        <Campo rotulo="Periodicidade" obrigatorio>
          {(controle) => (
            <Selecao {...controle} value={periodicidade} onChange={(evento) => setPeriodicidade(evento.target.value as PrecoVersao['periodicidade'])}>
              {PERIODICIDADES_DE_PRECO.map((opcao) => (
                <option key={opcao} value={opcao}>
                  {ROTULOS_PERIODICIDADE_PRECO[opcao]}
                </option>
              ))}
            </Selecao>
          )}
        </Campo>
        <Campo rotulo="Início da validade">{(controle) => <EntradaData {...controle} value={inicio} onChange={(evento) => setInicio(evento.target.value)} />}</Campo>
        <Campo rotulo="Simulação">
          {(controle) => (
            <Selecao {...controle} value={simulacaoId} onChange={(evento) => setSimulacaoId(evento.target.value)}>
              <option value="">Sem simulação por enquanto</option>
              {simulacoes
                .filter((item) => !item.oferta_id || item.oferta_id === oferta.id)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.codigo} · {item.nome} v{item.versao}
                  </option>
                ))}
            </Selecao>
          )}
        </Campo>
        <Faixa tipo="info">Aprovar é outra etapa: pede início da validade, simulação (exceto em Gratuidade) e decisão.</Faixa>
      </div>
    </JanelaFormulario>
  );
}
