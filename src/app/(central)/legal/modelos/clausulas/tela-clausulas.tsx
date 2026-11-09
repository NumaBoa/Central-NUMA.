'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { BookOpen, CircleDot, CopyPlus, Layers, Plus } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { Campo } from '@/componentes/campos/campo';
import { Selecao } from '@/componentes/campos/selecao';
import { AbasLegal } from '@/componentes/f1/abas-modulos';
import { CartaoDePainel, errosDoFormulario, executar, paraOpcoes, seletorDeOpcoes } from '@/componentes/f1/apoio';
import { InsercaoDeVariaveis } from '@/componentes/f1/variaveis';
import { PainelDeValidacao } from '@/componentes/f1/validacao';
import { useAlteracoesPendentes } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaSituacao, type TipoSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { FiltrosEmLinha } from '@/componentes/padroes/filtros-em-linha';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import { repositorios } from '@/dados/repositorios';
import { CATEGORIAS_CLAUSULA, type ClausulaVersao, type Clausula, type Validacao } from '@/dados/tipos/legal';
import { useConsulta } from '@/dados/use-consulta';
import { analisarTexto } from '@/dominio/modelo-texto';
import { avisosDoTexto, carregarClausulas, criarClausula, esquemaFormularioClausula, novaVersaoDaClausula, ROTULOS_CATEGORIA_CLAUSULA, ROTULOS_SITUACAO_VALIDAVEL, salvarRascunhoDaClausula, ultimaValidacao, type ClausulaComVersoes, type FormularioClausula } from '@/dominio/modelos';

async function carregar() {
  const [clausulas, validacoes, pessoas] = await Promise.all([carregarClausulas(), repositorios.validacao.listar({ onde: { registro_tipo: 'clausula_versao' } }), repositorios.pessoa.listar({ incluirArquivados: true })]);
  return { clausulas, validacoes, pessoas };
}
type Dados = Awaited<ReturnType<typeof carregar>>;

const TIPOS: Readonly<Record<ClausulaVersao['situacao'], TipoSituacao>> = { rascunho: 'neutro', validada: 'sucesso', obsoleta: 'neutro' };
const SituacaoDaClausula = ({ situacao }: { situacao: ClausulaVersao['situacao'] }) => <EtiquetaSituacao tipo={TIPOS[situacao]}>{ROTULOS_SITUACAO_VALIDAVEL[situacao]}</EtiquetaSituacao>;

function NovaClausula({ dados, aoFechar }: { dados: Dados; aoFechar: () => void }) {
  const texto = useRef<HTMLTextAreaElement | null>(null);
  const { register, control, handleSubmit, formState, setValue, getValues, watch } = useForm<FormularioClausula>({ resolver: zodResolver(esquemaFormularioClausula), defaultValues: { codigo: '', titulo: '', categoria: 'objeto', alternativa_de_id: '', quando_usar: '', texto: '' }, mode: 'onTouched' });
  const { errors } = formState;
  const avisos = avisosDoTexto(watch('texto') ?? '');
  const estrutura = analisarTexto(watch('texto') ?? '').erros;
  const { ref: refTexto, ...camposTexto } = register('texto');
  const enviar = handleSubmit(async (formulario) => {
    try {
      await criarClausula(formulario);
      aviso('Cláusula criada em rascunho.');
      aoFechar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  });
  return (
    <JanelaFormulario colunas={2} aberto aoFechar={aoFechar} titulo="Nova cláusula" descricao="O texto jurídico é de quem valida: o sistema não oferece minutas prontas." alterado={formState.isDirty} aoEnviar={enviar} salvando={formState.isSubmitting} rotuloSalvar="Criar rascunho" erros={errosDoFormulario(errors, { codigo: 'cl-codigo', titulo: 'cl-titulo', categoria: 'cl-categoria', texto: 'cl-texto' })}>
      <div className="grid grid-cols-1 gap-[18px]">
        <Campo id="cl-codigo" rotulo="Código" obrigatorio erro={errors.codigo?.message} ajuda="Como CL-REAJ-01.">
          {(controle) => <Input {...controle} autoComplete="off" spellCheck={false} {...register('codigo')} />}
        </Campo>
        <Campo id="cl-titulo" rotulo="Título" obrigatorio erro={errors.titulo?.message}>
          {(controle) => <Input {...controle} autoComplete="off" {...register('titulo')} />}
        </Campo>
        <Controller
          control={control}
          name="categoria"
          render={({ field }) => (
            <Campo id="cl-categoria" rotulo="Categoria" obrigatorio erro={errors.categoria?.message}>
              {(controle) => (
                <Selecao {...controle} {...field}>
                  {CATEGORIAS_CLAUSULA.map((categoria) => (
                    <option key={categoria} value={categoria}>
                      {ROTULOS_CATEGORIA_CLAUSULA[categoria]}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          )}
        />
        <Controller
          control={control}
          name="alternativa_de_id"
          render={({ field }) => (
            <Campo id="cl-alternativa" rotulo="Alternativa de" ajuda="Por exemplo, a versão B2C de uma cláusula B2B.">
              {(controle) => (
                <Selecao {...controle} {...field}>
                  <option value="">Nenhuma</option>
                  {dados.clausulas.map((clausula) => (
                    <option key={clausula.id} value={clausula.id}>
                      {clausula.codigo} · {clausula.titulo}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          )}
        />
        <Campo id="cl-quando" rotulo="Quando usar">
          {(controle) => <Input {...controle} autoComplete="off" {...register('quando_usar')} />}
        </Campo>
        <Campo id="cl-texto" rotulo="Texto" obrigatorio erro={errors.texto?.message}>
          {(controle) => (
            <Textarea
              {...controle}
              rows={8}
              {...camposTexto}
              ref={(elemento) => {
                refTexto(elemento);
                texto.current = elemento;
              }}
            />
          )}
        </Campo>
        {estrutura.map((erro) => (
          <Faixa key={erro} tipo="erro">
            {erro}
          </Faixa>
        ))}
        {avisos.map((erro) => (
          <Faixa key={erro} tipo="atencao">
            {erro}
          </Faixa>
        ))}
        <InsercaoDeVariaveis
          aoInserir={(trecho) => {
            const campo = texto.current;
            const atual = getValues('texto') ?? '';
            const inicio = campo?.selectionStart ?? atual.length;
            setValue('texto', `${atual.slice(0, inicio)}${trecho}${atual.slice(campo?.selectionEnd ?? inicio)}`, { shouldDirty: true, shouldValidate: true });
          }}
        />
      </div>
    </JanelaFormulario>
  );
}

function EditorDaClausula({ clausula, validacoes, pessoas, todas, aoFechar }: { clausula: ClausulaComVersoes; validacoes: readonly Validacao[]; pessoas: Dados['pessoas']; todas: readonly Clausula[]; aoFechar: () => void }) {
  const versao = clausula.atual as ClausulaVersao;
  const ultima = ultimaValidacao(validacoes, versao.id);
  const pendente = ultima?.situacao === 'pendente';
  const editavel = versao.situacao === 'rascunho' && !pendente;
  const campo = useRef<HTMLTextAreaElement>(null);
  const [titulo, setTitulo] = useState(clausula.titulo);
  const [categoria, setCategoria] = useState(clausula.categoria);
  const [alternativa, setAlternativa] = useState(clausula.alternativa_de_id ?? '');
  const [quando, setQuando] = useState(versao.quando_usar ?? '');
  const [texto, setTexto] = useState(versao.texto);
  useEffect(() => {
    setTexto(versao.texto);
    setQuando(versao.quando_usar ?? '');
  }, [versao.id, versao.versao_registro]); // eslint-disable-line react-hooks/exhaustive-deps -- recomeça do que está salvo
  const alterado = titulo !== clausula.titulo || categoria !== clausula.categoria || alternativa !== (clausula.alternativa_de_id ?? '') || quando !== (versao.quando_usar ?? '') || texto !== versao.texto;
  useAlteracoesPendentes(alterado);
  return (
    <JanelaFormulario larga aberto aoFechar={aoFechar} titulo={`${clausula.codigo} · V${versao.numero}`} descricao={clausula.usadaEm ? `Usada em ${clausula.usadaEm} ${clausula.usadaEm === 1 ? 'modelo' : 'modelos'}, cada um preso à sua versão.` : 'Ainda não usada em modelos.'} alterado={alterado} soLeitura={!editavel} rotuloSalvar="Salvar rascunho" aoEnviar={(evento) => { evento.preventDefault(); void executar(() => salvarRascunhoDaClausula(versao.id, { titulo, categoria, quando_usar: quando, texto, alternativa_de_id: alternativa }), 'Rascunho salvo.'); }}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid min-w-0 content-start gap-[18px]">
          <Campo id="ed-titulo" rotulo="Título" obrigatorio>
            {(controle) => <Input {...controle} autoComplete="off" disabled={!editavel} value={titulo} onChange={(evento) => setTitulo(evento.target.value)} />}
          </Campo>
          <Campo id="ed-categoria" rotulo="Categoria" obrigatorio>
            {(controle) => (
              <Selecao {...controle} disabled={!editavel} value={categoria} onChange={(evento) => setCategoria(evento.target.value as Clausula['categoria'])}>
                {CATEGORIAS_CLAUSULA.map((item) => (
                  <option key={item} value={item}>
                    {ROTULOS_CATEGORIA_CLAUSULA[item]}
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>
          <Campo id="ed-alternativa" rotulo="Alternativa de">
            {(controle) => (
              <Selecao {...controle} disabled={!editavel} value={alternativa} onChange={(evento) => setAlternativa(evento.target.value)}>
                <option value="">Nenhuma</option>
                {todas
                  .filter((item) => item.id !== clausula.id)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.codigo} · {item.titulo}
                    </option>
                  ))}
              </Selecao>
            )}
          </Campo>
          <Campo id="ed-quando" rotulo="Quando usar">
            {(controle) => <Input {...controle} autoComplete="off" disabled={!editavel} value={quando} onChange={(evento) => setQuando(evento.target.value)} />}
          </Campo>
          <Campo id="ed-texto" rotulo="Texto" obrigatorio>
            {(controle) => <Textarea {...controle} ref={campo} rows={10} disabled={!editavel} value={texto} onChange={(evento) => setTexto(evento.target.value)} />}
          </Campo>
          {editavel && <InsercaoDeVariaveis aoInserir={(trecho) => setTexto((atual) => `${atual.slice(0, campo.current?.selectionStart ?? atual.length)}${trecho}${atual.slice(campo.current?.selectionEnd ?? atual.length)}`)} />}
        </div>
        <div className="grid content-start gap-3">
          <PainelDeValidacao tipo="clausula_versao" registroId={versao.id} ultima={ultima} pessoas={pessoas} podeEnviar={versao.situacao === 'rascunho'} validado={versao.situacao === 'validada'} naoEnviar={alterado ? 'Salve o rascunho antes de enviar.' : null} />
          {versao.situacao !== 'rascunho' && (
            <Button variante="secundario" onClick={() => void executar(() => novaVersaoDaClausula(clausula.id), 'Nova versão em rascunho. Os modelos seguem na versão deles.')}>
              <CopyPlus aria-hidden />
              Nova versão
            </Button>
          )}
          <CartaoDePainel titulo="Versões">
            <ul className="grid gap-1.5 text-[13px]">
              {clausula.versoes.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-2">
                  V{item.numero} <SituacaoDaClausula situacao={item.situacao} />
                </li>
              ))}
            </ul>
          </CartaoDePainel>
        </div>
      </div>
    </JanelaFormulario>
  );
}

type Filtros = { busca: string; categoria: string; situacao: string };
const INICIAIS: Filtros = { busca: '', categoria: '', situacao: '' };

/** T09.06: cláusulas com versão fixa (RN-09.12). */
export function TelaClausulas() {
  const consulta = useConsulta(carregar);
  const dados = consulta.dados;
  const [filtros, setFiltros] = useState<Filtros>(INICIAIS);
  const [nova, setNova] = useState(false);
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const aberta = dados?.clausulas.find((clausula) => clausula.id === abertaId && clausula.atual);
  const linhas = useMemo(() => {
    const termo = filtros.busca.trim().toLowerCase();
    return (dados?.clausulas ?? []).filter((linha) => !linha.arquivado_em && (!filtros.categoria || linha.categoria === filtros.categoria) && (!filtros.situacao || linha.atual?.situacao === filtros.situacao) && (!termo || `${linha.codigo} ${linha.titulo}`.toLowerCase().includes(termo)));
  }, [dados, filtros]);
  const opcoesCategoria = paraOpcoes(ROTULOS_CATEGORIA_CLAUSULA);
  const opcoesSituacao = paraOpcoes(ROTULOS_SITUACAO_VALIDAVEL);

  const colunas: readonly Coluna<ClausulaComVersoes>[] = [
    { id: 'codigo', titulo: 'Código', essencial: true, ordenar: (a, b) => a.codigo.localeCompare(b.codigo), celula: (linha) => <span className="font-medium whitespace-nowrap">{linha.codigo}</span> },
    { id: 'titulo', titulo: 'Título', essencial: true, celula: (linha) => linha.titulo },
    { id: 'categoria', titulo: 'Categoria', celula: (linha) => ROTULOS_CATEGORIA_CLAUSULA[linha.categoria] },
    { id: 'versao', titulo: 'Versão', celula: (linha) => (linha.atual ? `V${linha.atual.numero}` : '—') },
    { id: 'situacao', titulo: 'Situação', essencial: true, celula: (linha) => (linha.atual ? <SituacaoDaClausula situacao={linha.atual.situacao} /> : '—') },
    { id: 'usada', titulo: 'Usada em', numerica: true, celula: (linha) => linha.usadaEm },
  ];

  return (
    <>
      <CabecalhoPagina
        comoUsar="/ajuda/legal/clausulas"
        kicker="Legal e privacidade"
        titulo="Biblioteca de cláusulas"
        resumo="Blocos reutilizáveis, com versão fixa em cada modelo."
        acoes={
          <Button disabled={!dados} onClick={() => setNova(true)}>
            <Plus aria-hidden />
            Nova cláusula
          </Button>
        }
      />
      <AbasLegal ativa="modelos" sub="clausulas" />
      <div className="mt-5 space-y-4">
        {consulta.estado === 'erro' && <EstadoErro titulo="Não deu para ler as cláusulas." aoTentarDeNovo={consulta.recarregar} />}
        <FiltrosEmLinha
          filtros={filtros}
          aoMudar={(parcial) => setFiltros((atuais) => ({ ...atuais, ...parcial }))}
          aoLimpar={() => setFiltros(INICIAIS)}
          rotuloBusca="Buscar cláusulas"
          seletores={[seletorDeOpcoes<Filtros>({ id: 'categoria', rotulo: 'Categoria', icone: Layers, campo: 'categoria', opcoes: opcoesCategoria, todos: 'Todas' }), seletorDeOpcoes<Filtros>({ id: 'situacao', rotulo: 'Situação', icone: CircleDot, campo: 'situacao', opcoes: opcoesSituacao, todos: 'Todas' })]}
          avancados={() => null}
          quantosAvancados={() => 0}
          ativos={[...(filtros.categoria ? [{ id: 'categoria', rotulo: `Categoria: ${opcoesCategoria.find((opcao) => opcao.valor === filtros.categoria)?.rotulo ?? ''}` }] : []), ...(filtros.situacao ? [{ id: 'situacao', rotulo: `Situação: ${opcoesSituacao.find((opcao) => opcao.valor === filtros.situacao)?.rotulo ?? ''}` }] : [])]}
          aoRemoverAtivo={(id) => setFiltros((atuais) => ({ ...atuais, [id]: '' }))}
        />
        <Lista
          rotulo="Biblioteca de cláusulas"
          linhas={linhas}
          colunas={colunas}
          chave={(linha) => linha.id}
          estado={consulta.estado === 'carregando' ? 'carregando' : 'pronto'}
          filtrando={Boolean(filtros.busca.trim() || filtros.categoria || filtros.situacao)}
          aoLimparFiltros={() => setFiltros(INICIAIS)}
          aoAbrir={(linha) => setAbertaId(linha.id)}
          cartao={(linha) => (
            <span className="grid gap-1">
              <span className="font-semibold">
                {linha.codigo} · {linha.titulo}
              </span>
              <span className="text-[13px] text-ink-soft">{ROTULOS_CATEGORIA_CLAUSULA[linha.categoria]}</span>
              {linha.atual && <SituacaoDaClausula situacao={linha.atual.situacao} />}
            </span>
          )}
          vazio={<EstadoVazio icone={BookOpen} titulo="Nenhuma cláusula ainda." texto="Cadastre os blocos que se repetem nos contratos. O texto é de quem valida: o sistema não oferece minutas prontas." acao={<Button onClick={() => setNova(true)}>Nova cláusula</Button>} />}
        />
      </div>
      {nova && dados && <NovaClausula dados={dados} aoFechar={() => setNova(false)} />}
      {aberta && dados && <EditorDaClausula key={aberta.id} clausula={aberta} validacoes={dados.validacoes} pessoas={dados.pessoas} todas={dados.clausulas} aoFechar={() => setAbertaId(null)} />}
    </>
  );
}
