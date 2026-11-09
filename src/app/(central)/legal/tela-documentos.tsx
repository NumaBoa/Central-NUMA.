'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { CircleDot, FileText, Layers, Plus, TriangleAlert } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { Campo } from '@/componentes/campos/campo';
import { Selecao } from '@/componentes/campos/selecao';
import { SelecaoPessoa } from '@/componentes/campos/selecao-pessoa';
import { AbasLegal } from '@/componentes/f1/abas-modulos';
import { errosDoFormulario, paraOpcoes, seletorDeOpcoes } from '@/componentes/f1/apoio';
import { aviso } from '@/componentes/padroes/aviso';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaSituacao, type TipoSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { FiltrosEmLinha } from '@/componentes/padroes/filtros-em-linha';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { Button } from '@/componentes/ui/button';
import { mensagemDoErro } from '@/dados/erros';
import { idDaPessoaAtual } from '@/dados/sessao';
import type { DocumentoLegalVersao } from '@/dados/tipos/legal';
import { useConsulta } from '@/dados/use-consulta';
import { carregarDocumentosLegais, criarDocumentoLegal, esquemaNovoDocumento, filtrarDocumentos, FILTROS_DOCUMENTOS_INICIAIS, ID_NUMA_INSTITUCIONAL, produtosComPendenciaLegal, ROTULOS_SITUACAO_DOCUMENTO_LEGAL, ROTULOS_TIPO_DOCUMENTO_LEGAL, type DadosDocumentos, type FiltrosDocumentos, type FormularioNovoDocumento, type LinhaDocumentoLegal } from '@/dominio/legal';
import { pessoasDoSeletor } from '@/dominio/pessoa-atual';
import { formatarDiaISO } from '@/lib/formatacao';

export const TIPOS_SITUACAO_DOCUMENTO: Readonly<Record<DocumentoLegalVersao['situacao'], TipoSituacao>> = { rascunho: 'neutro', em_validacao: 'atencao', validado: 'info', publicado: 'sucesso', substituido: 'neutro', devolvido: 'erro', cancelado: 'neutro' };

export function SituacaoDoDocumento({ situacao }: { situacao: DocumentoLegalVersao['situacao'] }) {
  return <EtiquetaSituacao tipo={TIPOS_SITUACAO_DOCUMENTO[situacao]}>{ROTULOS_SITUACAO_DOCUMENTO_LEGAL[situacao]}</EtiquetaSituacao>;
}

function NovoDocumento({ dados, aoFechar }: { dados: DadosDocumentos; aoFechar: () => void }) {
  const roteador = useRouter();
  const { control, handleSubmit, formState } = useForm<FormularioNovoDocumento>({ resolver: zodResolver(esquemaNovoDocumento), defaultValues: { produto_id: '', tipo: 'termos_uso', responsavel_id: idDaPessoaAtual() ?? '' }, mode: 'onTouched' });
  const pessoas = useMemo(() => pessoasDoSeletor(dados.pessoas), [dados.pessoas]);
  const enviar = handleSubmit(async (formulario) => {
    try {
      const documento = await criarDocumentoLegal(formulario);
      aviso('Documento criado em rascunho.');
      roteador.push(`/legal/documentos/${documento.id}`);
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  });
  return (
    <JanelaFormulario aberto aoFechar={aoFechar} titulo="Novo documento legal" descricao="O texto fica sempre no sistema; o link do Drive é só anexo." alterado={formState.isDirty} aoEnviar={enviar} rotuloSalvar="Criar rascunho" salvando={formState.isSubmitting} erros={errosDoFormulario(formState.errors, { tipo: 'documento-tipo', responsavel_id: 'documento-responsavel' })}>
      <div className="grid gap-[18px]">
        <Controller
          control={control}
          name="produto_id"
          render={({ field }) => (
            <Campo id="documento-produto" rotulo="Contexto">
              {(controle) => (
                <Selecao {...controle} {...field}>
                  <option value="">Numa (institucional)</option>
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
        <Controller
          control={control}
          name="tipo"
          render={({ field }) => (
            <Campo id="documento-tipo" rotulo="Tipo" obrigatorio erro={formState.errors.tipo?.message}>
              {(controle) => (
                <Selecao {...controle} {...field}>
                  {paraOpcoes(ROTULOS_TIPO_DOCUMENTO_LEGAL).map((opcao) => (
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
          name="responsavel_id"
          render={({ field }) => (
            <Campo id="documento-responsavel" rotulo="Responsável" obrigatorio erro={formState.errors.responsavel_id?.message}>
              {(controle) => <SelecaoPessoa {...controle} {...field} pessoas={pessoas} vazio="Escolha" />}
            </Campo>
          )}
        />
      </div>
    </JanelaFormulario>
  );
}

/** T09.02, lista (11-M09). */
export function TelaDocumentosLegais() {
  const roteador = useRouter();
  const consulta = useConsulta(carregarDocumentosLegais);
  const [filtros, setFiltros] = useState<FiltrosDocumentos>(FILTROS_DOCUMENTOS_INICIAIS);
  const [novo, setNovo] = useState(false);
  const dados = consulta.dados;

  const nomeDoProduto = (id: string | null) => (id ? (dados?.produtos.find((produto) => produto.id === id)?.nome ?? 'Produto removido') : 'Numa');
  const nomeDaPessoa = (id: string) => dados?.pessoas.find((pessoa) => pessoa.id === id)?.nome_completo ?? 'Pessoa removida';
  const linhas = useMemo(() => filtrarDocumentos(dados?.documentos ?? [], filtros, nomeDoProduto), [dados, filtros]); // eslint-disable-line react-hooks/exhaustive-deps -- `nomeDoProduto` só lê `dados`
  const pendentes = useMemo(() => (dados ? produtosComPendenciaLegal(dados.produtos, dados.documentos) : []), [dados]);

  const mudar = (parcial: Partial<FiltrosDocumentos>) => setFiltros((atuais) => ({ ...atuais, ...parcial }));
  const opcoesProduto = [{ valor: ID_NUMA_INSTITUCIONAL, rotulo: 'Numa (institucional)' }, ...(dados?.produtos ?? []).filter((produto) => !produto.arquivado_em).map((produto) => ({ valor: produto.id, rotulo: produto.nome }))];
  const opcoesTipo = paraOpcoes(ROTULOS_TIPO_DOCUMENTO_LEGAL);
  const opcoesSituacao = [...paraOpcoes(ROTULOS_SITUACAO_DOCUMENTO_LEGAL).filter((opcao) => opcao.valor !== 'devolvido'), { valor: 'revisao', rotulo: 'Revisão necessária' }];

  const colunas: readonly Coluna<LinhaDocumentoLegal>[] = [
    { id: 'produto', titulo: 'Contexto', essencial: true, ordenar: (a, b) => nomeDoProduto(a.produto_id).localeCompare(nomeDoProduto(b.produto_id), 'pt-BR'), celula: (linha) => <span className="font-medium">{nomeDoProduto(linha.produto_id)}</span> },
    { id: 'tipo', titulo: 'Tipo', essencial: true, celula: (linha) => ROTULOS_TIPO_DOCUMENTO_LEGAL[linha.tipo] },
    { id: 'vigente', titulo: 'Vigente', celula: (linha) => (linha.vigente ? `V${linha.vigente.numero}` : '—') },
    {
      id: 'situacao',
      titulo: 'Situação',
      essencial: true,
      celula: (linha) => (
        <span className="flex flex-wrap gap-1">
          <SituacaoDoDocumento situacao={linha.atual.situacao} />
          {linha.revisao_necessaria && (
            <EtiquetaSituacao tipo="atencao" icone={TriangleAlert}>
              Revisão necessária
            </EtiquetaSituacao>
          )}
        </span>
      ),
    },
    { id: 'publicado', titulo: 'Publicado em', celula: (linha) => (linha.vigente?.publicado_em ? formatarDiaISO(linha.vigente.publicado_em) : '—') },
    { id: 'url', titulo: 'URL', celula: (linha) => (linha.vigente?.url_publica ? <span className="block max-w-44 truncate">{linha.vigente.url_publica}</span> : '—') },
    { id: 'revisao', titulo: 'Próxima revisão', celula: (linha) => (linha.proxima_revisao ? formatarDiaISO(linha.proxima_revisao) : '—') },
    { id: 'responsavel', titulo: 'Responsável', celula: (linha) => nomeDaPessoa(linha.responsavel_id) },
  ];

  return (
    <>
      <CabecalhoPagina
        comoUsar="/ajuda/legal"
        kicker="Legal e privacidade"
        titulo="Documentos legais"
        resumo={dados ? `${dados.documentos.length} ${dados.documentos.length === 1 ? 'documento' : 'documentos'}` : undefined}
        acoes={
          <Button disabled={!dados} onClick={() => setNovo(true)}>
            <Plus aria-hidden />
            Novo documento
          </Button>
        }
      />
      <AbasLegal ativa="documentos" />
      <div className="mt-5 space-y-4">
        {consulta.estado === 'erro' && <EstadoErro titulo="Não deu para ler os documentos." aoTentarDeNovo={consulta.recarregar} />}
        {pendentes.map(({ produto, faltando }) => (
          <Faixa key={produto.id} tipo="erro">
            {produto.nome} tem usuários reais e está sem {faltando.map((tipo) => ROTULOS_TIPO_DOCUMENTO_LEGAL[tipo]).join(' e ')} publicados (RN-09.02).
          </Faixa>
        ))}
        {consulta.estado !== 'erro' && (
          <FiltrosEmLinha
            filtros={filtros}
            aoMudar={mudar}
            aoLimpar={() => setFiltros(FILTROS_DOCUMENTOS_INICIAIS)}
            rotuloBusca="Buscar documentos"
            seletores={[seletorDeOpcoes<FiltrosDocumentos>({ id: 'produto', rotulo: 'Contexto', icone: Layers, campo: 'produto', opcoes: opcoesProduto }), seletorDeOpcoes<FiltrosDocumentos>({ id: 'tipo', rotulo: 'Tipo', icone: FileText, campo: 'tipo', opcoes: opcoesTipo, largura: 130 }), seletorDeOpcoes<FiltrosDocumentos>({ id: 'situacao', rotulo: 'Situação', icone: CircleDot, campo: 'situacao', opcoes: opcoesSituacao, todos: 'Todas' })]}
            avancados={() => null}
            quantosAvancados={() => 0}
            ativos={[
              ...(filtros.produto ? [{ id: 'produto', rotulo: `Contexto: ${opcoesProduto.find((opcao) => opcao.valor === filtros.produto)?.rotulo ?? ''}` }] : []),
              ...(filtros.tipo ? [{ id: 'tipo', rotulo: `Tipo: ${opcoesTipo.find((opcao) => opcao.valor === filtros.tipo)?.rotulo ?? ''}` }] : []),
              ...(filtros.situacao ? [{ id: 'situacao', rotulo: `Situação: ${opcoesSituacao.find((opcao) => opcao.valor === filtros.situacao)?.rotulo ?? ''}` }] : []),
            ]}
            aoRemoverAtivo={(id) => mudar({ [id]: '' } as Partial<FiltrosDocumentos>)}
          />
        )}
        <Lista
          rotulo="Documentos legais"
          linhas={linhas}
          colunas={colunas}
          chave={(linha) => linha.id}
          estado={consulta.estado === 'carregando' ? 'carregando' : 'pronto'}
          filtrando={Boolean(filtros.busca.trim() || filtros.produto || filtros.tipo || filtros.situacao)}
          aoLimparFiltros={() => setFiltros(FILTROS_DOCUMENTOS_INICIAIS)}
          aoAbrir={(linha) => roteador.push(`/legal/documentos/${linha.id}`)}
          cartao={(linha) => (
            <span className="grid gap-1.5">
              <span className="font-semibold">
                {ROTULOS_TIPO_DOCUMENTO_LEGAL[linha.tipo]} · {nomeDoProduto(linha.produto_id)}
              </span>
              <span className="flex flex-wrap gap-1">
                <SituacaoDoDocumento situacao={linha.atual.situacao} />
                {linha.revisao_necessaria && <EtiquetaSituacao tipo="atencao">Revisão necessária</EtiquetaSituacao>}
              </span>
            </span>
          )}
          vazio={<EstadoVazio icone={FileText} titulo="Nenhum documento legal ainda." texto="Comece pelos Termos de Uso e pela Política de Privacidade dos produtos com usuários reais." acao={<Button onClick={() => setNovo(true)}>Novo documento</Button>} />}
        />
      </div>
      {novo && dados && <NovoDocumento dados={dados} aoFechar={() => setNovo(false)} />}
    </>
  );
}
