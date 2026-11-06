'use client';

import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Archive, ArchiveRestore, Landmark, Pencil, Plus } from 'lucide-react';
import { Campo, MensagemErro } from '@/componentes/campos/campo';
import { CamposEndereco } from '@/componentes/campos/endereco';
import { Pilulas, PilulasMultiplas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { aviso } from '@/componentes/padroes/aviso';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaLivre, EtiquetaSituacao, type TipoSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { PainelFormulario, type ErroDeCampo } from '@/componentes/padroes/painel-formulario';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { mensagemDoErro } from '@/dados/erros';
import type { Entidade } from '@/dados/tipos/contraparte';
import { useConsulta } from '@/dados/use-consulta';
import { nomeDaContraparte } from '@/dominio/contrapartes';
import {
  arquivarEntidade,
  carregarEntidades,
  esquemaFormularioEntidade,
  formatarDocumentoDaEntidade,
  formularioDaEntidade,
  FORMULARIO_ENTIDADE_VAZIO,
  nomeDaEntidade,
  pessoasParaRepresentante,
  representantesDaEntidade,
  restaurarEntidade,
  ROTULOS_SITUACAO_ENTIDADE,
  ROTULOS_TIPO_ENTIDADE,
  salvarEntidade,
  vinculosDaEntidade,
  type DadosEntidades,
  type FormularioEntidade,
} from '@/dominio/entidades';
import { formatarDiaISO, formatarNumero } from '@/lib/formatacao';
import { AbasConfiguracoes, SubabasCadastros } from '../../abas';

const paraOpcoes = (rotulos: Record<string, string>) => Object.entries(rotulos).map(([valor, rotulo]) => ({ valor, rotulo }));
const SIM_NAO = [
  { valor: 'sim', rotulo: 'Sim' },
  { valor: 'nao', rotulo: 'Não' },
];
const TIPOS_SITUACAO: Record<Entidade['situacao'], TipoSituacao> = { planejada: 'info', em_constituicao: 'atencao', ativa: 'sucesso', encerrada: 'neutro' };

function SituacaoDaEntidade({ situacao }: { situacao: Entidade['situacao'] }) {
  return <EtiquetaSituacao tipo={TIPOS_SITUACAO[situacao]}>{ROTULOS_SITUACAO_ENTIDADE[situacao]}</EtiquetaSituacao>;
}

function FormularioDaEntidade({ aberto, aoFechar, entidade, dados }: { aberto: boolean; aoFechar: () => void; entidade: Entidade | null; dados: DadosEntidades }) {
  const { register, handleSubmit, control, reset, watch, formState } = useForm<FormularioEntidade>({
    resolver: zodResolver(esquemaFormularioEntidade),
    defaultValues: FORMULARIO_ENTIDADE_VAZIO,
    mode: 'onTouched',
  });
  const { errors, isDirty, isSubmitting } = formState;
  const opcoesDePessoa = useMemo(() => pessoasParaRepresentante(dados.pessoas), [dados.pessoas]);

  // O formulário começa do que está salvo a cada vez que abre, e não enquanto alguém digita.
  useEffect(() => {
    if (aberto) reset(entidade ? formularioDaEntidade(entidade, representantesDaEntidade(entidade.id, dados.representantes)) : FORMULARIO_ENTIDADE_VAZIO);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- os dados mudam quando alguém mexe em outra aba
  }, [aberto, entidade?.id, reset]);

  const tipo = watch('tipo_pessoa');
  const situacao = watch('situacao');
  const rotuloDocumento = tipo === 'pf' ? 'CPF' : 'CNPJ';
  const representantes = watch('representantes');
  // Quem saiu da lista continua visível até alguém tirar: a tela avisa e nunca troca sozinha.
  const foraDaLista = representantes.filter((id) => !opcoesDePessoa.some((pessoa) => pessoa.id === id));
  const nomeDoRepresentante = (id: string) => dados.pessoas.find((pessoa) => pessoa.id === id)?.nome_completo ?? 'Pessoa removida';

  const erros: ErroDeCampo[] = [
    ['entidade-nome', errors.nome?.message],
    ['entidade-documento', errors.documento?.message],
    ['entidade-endereco-logradouro', errors.endereco?.logradouro?.message],
    ['entidade-endereco-cep', errors.endereco?.cep?.message],
    ['entidade-representantes', errors.representantes?.message],
    ['entidade-abertura', errors.data_abertura?.message],
    ['entidade-padrao', errors.entidade_padrao?.message],
  ].flatMap(([campoId, mensagem]) => (mensagem ? [{ campoId: campoId as string, mensagem }] : []));

  const enviar = handleSubmit(async (formulario) => {
    try {
      await salvarEntidade(formulario, entidade?.id);
      aviso(entidade ? 'Entidade atualizada.' : 'Entidade criada.');
      aoFechar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  });

  return (
    <PainelFormulario aberto={aberto} aoFechar={aoFechar} titulo={entidade ? 'Editar entidade' : 'Nova entidade'} alterado={isDirty} aoEnviar={enviar} rotuloSalvar={entidade ? 'Salvar alterações' : 'Salvar'} salvando={isSubmitting} erros={erros}>
      <div className="grid grid-cols-1 gap-[18px]">
        <Controller
          control={control}
          name="tipo_pessoa"
          render={({ field }) => <Pilulas rotulo="Tipo" obrigatorio valor={field.value} aoMudar={field.onChange} opcoes={paraOpcoes(ROTULOS_TIPO_ENTIDADE)} />}
        />
        <Campo id="entidade-nome" rotulo="Nome ou razão social" obrigatorio erro={errors.nome?.message}>
          {(controle) => <Input autoComplete="off" {...controle} {...register('nome')} />}
        </Campo>
        <Campo rotulo="Nome fantasia">{(controle) => <Input autoComplete="off" {...controle} {...register('nome_fantasia')} />}</Campo>
        <Controller
          control={control}
          name="situacao"
          render={({ field }) => <Pilulas rotulo="Situação" obrigatorio valor={field.value} aoMudar={field.onChange} opcoes={paraOpcoes(ROTULOS_SITUACAO_ENTIDADE)} />}
        />
        {situacao === 'ativa' && <Faixa>Para ativar, são obrigatórios: {rotuloDocumento} válido, endereço, representante legal e data de abertura.</Faixa>}
        <Controller
          control={control}
          name="documento"
          render={({ field }) => (
            <Campo id="entidade-documento" rotulo={rotuloDocumento} obrigatorio={situacao === 'ativa'} erro={errors.documento?.message}>
              {(controle) => <Input autoComplete="off" spellCheck={false} placeholder={tipo === 'pf' ? '000.000.000-00' : '00.000.000/0000-00'} {...controle} {...field} onChange={(evento) => field.onChange(formatarDocumentoDaEntidade(tipo, evento.target.value))} />}
            </Campo>
          )}
        />
        <Campo rotulo="Natureza jurídica / tipo societário" ajuda="Preenchido com o contador.">
          {(controle) => <Input autoComplete="off" {...controle} {...register('natureza_juridica')} />}
        </Campo>
        <Campo rotulo="Regime tributário" ajuda="Informativo: o sistema não calcula tributos.">
          {(controle) => <Input autoComplete="off" {...controle} {...register('regime_tributario')} />}
        </Campo>
        <Campo rotulo="Inscrição municipal">{(controle) => <Input autoComplete="off" {...controle} {...register('inscricao_municipal')} />}</Campo>
        <Campo rotulo="Inscrição estadual">{(controle) => <Input autoComplete="off" {...controle} {...register('inscricao_estadual')} />}</Campo>
        <CamposEndereco idBase="entidade-endereco" registrar={(campo) => register(`endereco.${campo}`)} erros={errors.endereco} />
        <div id="entidade-representantes" tabIndex={-1}>
          <Controller
            control={control}
            name="representantes"
            render={({ field }) => <PilulasMultiplas rotulo="Representantes legais" obrigatorio={situacao === 'ativa'} valores={field.value} aoMudar={field.onChange} opcoes={[...opcoesDePessoa.map((pessoa) => ({ valor: pessoa.id, rotulo: pessoa.nome_completo })), ...foraDaLista.map((id) => ({ valor: id, rotulo: `${nomeDoRepresentante(id)} (fora da lista)` }))]} />}
          />
          {errors.representantes?.message && <MensagemErro>{errors.representantes.message}</MensagemErro>}
          {foraDaLista.length > 0 && (
            <Faixa tipo="atencao" className="mt-2">
              {foraDaLista.map(nomeDoRepresentante).join(', ')} não está mais entre as pessoas internas ativas. Escolha outra pessoa e tire da lista.
            </Faixa>
          )}
        </div>
        <Campo id="entidade-abertura" rotulo="Data de abertura" obrigatorio={situacao === 'ativa'} erro={errors.data_abertura?.message}>
          {(controle) => <Input type="date" {...controle} {...register('data_abertura')} />}
        </Campo>
        <div id="entidade-padrao" tabIndex={-1}>
          <Controller
            control={control}
            name="entidade_padrao"
            render={({ field }) => <Pilulas rotulo="Entidade padrão" valor={field.value ? 'sim' : 'nao'} aoMudar={(valor) => field.onChange(valor === 'sim')} opcoes={SIM_NAO} />}
          />
          {errors.entidade_padrao?.message && <MensagemErro>{errors.entidade_padrao.message}</MensagemErro>}
        </div>
        <Controller
          control={control}
          name="contador_id"
          render={({ field }) => (
            <Campo rotulo="Contador responsável" ajuda="Uma contraparte cadastrada.">
              {(controle) => (
                <Selecao {...controle} {...field}>
                  <option value="">Não informado</option>
                  {dados.contrapartes
                    .filter((contraparte) => contraparte.situacao === 'ativa' || contraparte.id === field.value)
                    .map((contraparte) => (
                    <option key={contraparte.id} value={contraparte.id}>
                      {nomeDaContraparte(contraparte)}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          )}
        />
      </div>
    </PainelFormulario>
  );
}

/** T02.05 (P1 + formulário): sem ficha. As mudanças ficam no Histórico da aba Dados. */
export function TelaEntidades() {
  const consulta = useConsulta(carregarEntidades);
  const [painel, setPainel] = useState<{ aberto: boolean; entidade: Entidade | null }>({ aberto: false, entidade: null });
  const [verArquivadas, setVerArquivadas] = useState(false);
  const [arquivando, setArquivando] = useState<{ entidade: Entidade; vinculos: readonly string[] } | null>(null);

  const dados = consulta.dados;
  const todas = dados?.entidades;
  const linhas = useMemo(() => (todas ?? []).filter((entidade) => Boolean(entidade.arquivado_em) === verArquivadas), [todas, verArquivadas]);
  const arquivadas = useMemo(() => (todas ?? []).filter((entidade) => entidade.arquivado_em).length, [todas]);
  const ativas = (todas ?? []).length - arquivadas;

  async function executar(acao: () => Promise<void>, mensagem: string) {
    try {
      await acao();
      aviso(mensagem);
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  }

  async function pedirArquivo(entidade: Entidade) {
    setArquivando({ entidade, vinculos: await vinculosDaEntidade(entidade.id) });
  }

  const nomeDaLinha = nomeDaEntidade;

  const acoes = (entidade: Entidade) =>
    entidade.arquivado_em ? (
      <Button variante="icone" tamanho="icone" aria-label={`Restaurar ${nomeDaLinha(entidade)}`} onClick={() => void executar(() => restaurarEntidade(entidade.id), 'Entidade restaurada.')}>
        <ArchiveRestore aria-hidden />
      </Button>
    ) : (
      <span className="inline-flex">
        <Button variante="icone" tamanho="icone" aria-label={`Editar ${nomeDaLinha(entidade)}`} onClick={() => setPainel({ aberto: true, entidade })}>
          <Pencil aria-hidden />
        </Button>
        <Button variante="icone" tamanho="icone" aria-label={`Arquivar ${nomeDaLinha(entidade)}`} onClick={() => void pedirArquivo(entidade)}>
          <Archive aria-hidden />
        </Button>
      </span>
    );

  const colunas: readonly Coluna<Entidade>[] = [
    {
      id: 'nome',
      titulo: 'Entidade',
      essencial: true,
      celula: (entidade) => (
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{nomeDaLinha(entidade)}</span>
          {entidade.entidade_padrao && <EtiquetaLivre>Padrão</EtiquetaLivre>}
        </span>
      ),
    },
    { id: 'tipo', titulo: 'Tipo', celula: (entidade) => ROTULOS_TIPO_ENTIDADE[entidade.tipo_pessoa] },
    { id: 'documento', titulo: 'Documento', celula: (entidade) => <span className="whitespace-nowrap tabular-nums">{entidade.documento ? formatarDocumentoDaEntidade(entidade.tipo_pessoa, entidade.documento) : '—'}</span> },
    { id: 'abertura', titulo: 'Abertura', celula: (entidade) => (entidade.data_abertura ? formatarDiaISO(entidade.data_abertura) : '—') },
    { id: 'situacao', titulo: 'Situação', essencial: true, celula: (entidade) => <SituacaoDaEntidade situacao={entidade.situacao} /> },
  ];

  return (
    <>
      <CabecalhoPagina
        migalhas={['Central Numa', 'Configurações', 'Cadastros base', 'Entidades']}
        kicker="Configurações"
        titulo="Entidades"
        resumo={todas ? `${formatarNumero(ativas)} ${ativas === 1 ? 'entidade' : 'entidades'}: quem assina pela Numa` : undefined}
        acoes={
          <Button onClick={() => setPainel({ aberto: true, entidade: null })} disabled={!dados}>
            <Plus aria-hidden />
            Nova entidade
          </Button>
        }
      />
      <AbasConfiguracoes ativa="cadastros" />
      <SubabasCadastros ativa="entidades" />

      <div className="mt-5 space-y-4">
        {consulta.estado === 'carregando' && <EstadoCarregando />}
        {consulta.estado === 'erro' && <EstadoErro titulo="Não deu para ler as entidades." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos na aba Dados." aoTentarDeNovo={consulta.recarregar} />}
        {consulta.estado === 'pronto' && dados && (
          <>
            <div className="flex justify-end">
              <Button variante="terciario" tamanho="pequeno" aria-pressed={verArquivadas} onClick={() => setVerArquivadas((atual) => !atual)}>
                <Archive aria-hidden />
                {verArquivadas ? 'Voltar às entidades ativas' : `Arquivados (${formatarNumero(arquivadas)})`}
              </Button>
            </div>
            <Lista
              rotulo={verArquivadas ? 'Entidades arquivadas' : 'Entidades'}
              linhas={linhas}
              colunas={colunas}
              chave={(entidade) => entidade.id}
              acoesDaLinha={acoes}
              cartao={(entidade) => (
                <div className="flex items-start justify-between gap-2">
                  <div className="grid min-w-0 gap-1.5">
                    <p className="font-semibold break-words">{nomeDaLinha(entidade)}</p>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <SituacaoDaEntidade situacao={entidade.situacao} />
                      {entidade.entidade_padrao && <EtiquetaLivre>Padrão</EtiquetaLivre>}
                    </span>
                  </div>
                  <div className="shrink-0">{acoes(entidade)}</div>
                </div>
              )}
              vazio={
                verArquivadas ? (
                  <EstadoVazio icone={Archive} titulo="Nenhuma entidade arquivada." texto="As arquivadas aparecem aqui, e dá para restaurar quando precisar." />
                ) : (
                  <EstadoVazio icone={Landmark} titulo="Nenhuma entidade ainda." texto="Que tal cadastrar a primeira?" acao={<Button onClick={() => setPainel({ aberto: true, entidade: null })}>Nova entidade</Button>} />
                )
              }
            />
            <FormularioDaEntidade aberto={painel.aberto} aoFechar={() => setPainel((atual) => ({ ...atual, aberto: false }))} entidade={painel.entidade} dados={dados} />
          </>
        )}
      </div>

      {arquivando?.vinculos.length ? (
        <Confirmacao
          aberto
          aoFechar={() => setArquivando(null)}
          titulo={`Não dá para arquivar ${nomeDaLinha(arquivando.entidade)}`}
          texto={`Esta entidade está em uso: ${arquivando.vinculos.join(', ')}. Troque a entidade desses produtos antes.`}
          rotuloConfirmar="Entendi"
          soInforma
          aoConfirmar={() => setArquivando(null)}
        />
      ) : (
        <Confirmacao
          aberto={arquivando !== null}
          aoFechar={() => setArquivando(null)}
          titulo={`Arquivar ${arquivando ? nomeDaLinha(arquivando.entidade) : ''}?`}
          texto="Ela sai das listas e dos seletores. Dá para restaurar quando precisar, em Arquivados."
          rotuloConfirmar="Arquivar entidade"
          perigo
          aoConfirmar={() => {
            const alvo = arquivando?.entidade;
            setArquivando(null);
            if (alvo) void executar(() => arquivarEntidade(alvo.id), 'Entidade arquivada.');
          }}
        />
      )}
    </>
  );
}
