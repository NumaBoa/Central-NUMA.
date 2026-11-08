'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { CircleDot, Layers, Megaphone, Plus } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { Selecao } from '@/componentes/campos/selecao';
import { paraOpcoes, seletorDeOpcoes } from '@/componentes/f1/apoio';
import { useCentral } from '@/componentes/layout/central-provider';
import { AbasOperacao } from '@/componentes/operacao/abas-operacao';
import { aviso } from '@/componentes/padroes/aviso';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { FiltrosEmLinha } from '@/componentes/padroes/filtros-em-linha';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import type { Produto } from '@/dados/tipos/marca';
import type { NotaLiberacao } from '@/dados/tipos/operacao';
import { useConsulta } from '@/dados/use-consulta';
import { ID_CONSOLIDADA } from '@/dominio/contextos';
import { carregarNotas, criarNota, ROTULOS_CANAL_NOTA, ROTULOS_PUBLICO_NOTA } from '@/dominio/notas';
import { formatarDiaISO } from '@/lib/formatacao';

type Filtros = { busca: string; produto: string; situacao: string; publico: string };
const INICIAIS: Filtros = { busca: '', produto: '', situacao: '', publico: '' };
const ROTULOS_SITUACAO = { rascunho: 'Rascunho', publicada: 'Publicada' } as const;

/** T12.07: as notas por produto e versão, só Rascunho e Publicada. */
export function TelaNotas() {
  const roteador = useRouter();
  const { contexto } = useCentral();
  const consulta = useConsulta(() => carregarNotas());
  const dados = consulta.dados;
  const [filtros, setFiltros] = useState<Filtros>(INICIAIS);
  const [criando, setCriando] = useState(false);
  const produto = (id: string) => dados?.produtos.find((linha) => linha.id === id)?.nome ?? 'Produto removido';
  const doContexto = useMemo(() => (dados?.notas ?? []).filter((linha) => contexto.id === ID_CONSOLIDADA || linha.produto_id === contexto.id), [dados, contexto.id]);
  const linhas = doContexto.filter((linha) => (!filtros.produto || linha.produto_id === filtros.produto) && (!filtros.situacao || linha.situacao === filtros.situacao) && (!filtros.publico || linha.publico === filtros.publico) && (!filtros.busca.trim() || `${produto(linha.produto_id)} ${linha.versao} ${linha.codigo}`.toLowerCase().includes(filtros.busca.trim().toLowerCase())));
  const quantos = (id: string) => dados?.itens.filter((item) => item.nota_id === id).length ?? 0;
  const colunas: readonly Coluna<NotaLiberacao>[] = [
    { id: 'versao', titulo: 'Versão', essencial: true, celula: (linha) => <span className="grid"><span className="font-medium">{produto(linha.produto_id)} {linha.versao}</span><span className="text-xs text-ink-soft">{linha.codigo}</span></span> },
    { id: 'data', titulo: 'Data', essencial: true, celula: (linha) => (linha.data ? formatarDiaISO(linha.data) : 'Sem data') },
    { id: 'publico', titulo: 'Público', celula: (linha) => ROTULOS_PUBLICO_NOTA[linha.publico] },
    { id: 'itens', titulo: 'Itens', numerica: true, celula: (linha) => String(quantos(linha.id)) },
    { id: 'situacao', titulo: 'Situação', essencial: true, celula: (linha) => <EtiquetaSituacao tipo={linha.situacao === 'publicada' ? 'sucesso' : 'neutro'}>{ROTULOS_SITUACAO[linha.situacao]}</EtiquetaSituacao> },
    { id: 'canais', titulo: 'Comunicada em', celula: (linha) => (linha.canais.length ? linha.canais.map((canal) => ROTULOS_CANAL_NOTA[canal]).join(', ') : '—') },
  ];
  const botaoNovo = <Button onClick={() => setCriando(true)}><Plus aria-hidden />Nova nota</Button>;
  return (
    <>
      <CabecalhoPagina kicker="Operação" titulo="Notas de liberação" resumo="O que mudou em cada versão, para dentro ou para os clientes." acoes={botaoNovo} />
      <AbasOperacao ativa="notas" />
      <div className="mt-5 space-y-4">
        {consulta.estado === 'erro' && <EstadoErro titulo="Não deu para ler as notas." aoTentarDeNovo={consulta.recarregar} />}
        <FiltrosEmLinha
          filtros={filtros}
          aoMudar={(parcial) => setFiltros((atuais) => ({ ...atuais, ...parcial }))}
          aoLimpar={() => setFiltros(INICIAIS)}
          rotuloBusca="Buscar produto ou versão"
          seletores={[
            seletorDeOpcoes<Filtros>({ id: 'produto', rotulo: 'Produto', icone: Layers, campo: 'produto', opcoes: (dados?.produtos ?? []).filter((linha) => doContexto.some((nota) => nota.produto_id === linha.id)).map((linha) => ({ valor: linha.id, rotulo: linha.nome })) }),
            seletorDeOpcoes<Filtros>({ id: 'situacao', rotulo: 'Situação', icone: CircleDot, campo: 'situacao', opcoes: paraOpcoes(ROTULOS_SITUACAO), todos: 'Todas' }),
          ]}
          avancados={(valor, mudar) => (
            <Campo id="notas-publico" rotulo="Público">
              {(controle) => (
                <select {...controle} className="campo" value={valor.publico} onChange={(evento) => mudar({ publico: evento.target.value })}>
                  <option value="">Todos</option>
                  {paraOpcoes(ROTULOS_PUBLICO_NOTA).map((opcao) => <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>)}
                </select>
              )}
            </Campo>
          )}
          quantosAvancados={(valor) => (valor.publico ? 1 : 0)}
          ativos={[...(filtros.produto ? [{ id: 'produto', rotulo: `Produto: ${produto(filtros.produto)}` }] : []), ...(filtros.situacao ? [{ id: 'situacao', rotulo: `Situação: ${ROTULOS_SITUACAO[filtros.situacao as keyof typeof ROTULOS_SITUACAO]}` }] : []), ...(filtros.publico ? [{ id: 'publico', rotulo: `Público: ${ROTULOS_PUBLICO_NOTA[filtros.publico as keyof typeof ROTULOS_PUBLICO_NOTA]}` }] : [])]}
          aoRemoverAtivo={(id) => setFiltros((atuais) => ({ ...atuais, [id]: '' }))}
        />
        <Lista
          rotulo="Notas de liberação"
          linhas={linhas}
          colunas={colunas}
          chave={(linha) => linha.id}
          estado={consulta.estado === 'carregando' ? 'carregando' : 'pronto'}
          filtrando={Boolean(filtros.produto || filtros.situacao || filtros.publico || filtros.busca.trim())}
          aoLimparFiltros={() => setFiltros(INICIAIS)}
          aoAbrir={(linha) => roteador.push(`/operacao/notas/${linha.id}`)}
          cartao={(linha) => (
            <span className="grid gap-1.5">
              <span className="font-semibold">{produto(linha.produto_id)} {linha.versao}</span>
              <span className="text-[13px] text-ink-soft">{linha.codigo} · {linha.data ? formatarDiaISO(linha.data) : 'Sem data'} · {quantos(linha.id)} itens</span>
              <EtiquetaSituacao tipo={linha.situacao === 'publicada' ? 'sucesso' : 'neutro'}>{ROTULOS_SITUACAO[linha.situacao]}</EtiquetaSituacao>
            </span>
          )}
          vazio={<EstadoVazio icone={Megaphone} titulo="Nenhuma nota de liberação ainda." texto="Uma por produto e versão. Os itens podem vir das solicitações resolvidas e das tarefas concluídas." acao={botaoNovo} />}
        />
      </div>
      {criando && dados && <JanelaNovaNota produtos={dados.produtos} produtoInicial={contexto.id !== ID_CONSOLIDADA ? contexto.id : ''} aoFechar={() => setCriando(false)} aoCriar={(id) => roteador.push(`/operacao/notas/${id}`)} />}
    </>
  );
}

function JanelaNovaNota({ produtos, produtoInicial, aoFechar, aoCriar }: { produtos: readonly Produto[]; produtoInicial: string; aoFechar: () => void; aoCriar: (id: string) => void }) {
  const [valores, setValores] = useState({ produto_id: produtos.some((linha) => linha.id === produtoInicial) ? produtoInicial : '', versao: '', data: '', publico: 'todos' as NotaLiberacao['publico'], resumo: '' });
  const [salvando, setSalvando] = useState(false);
  const mudar = (parcial: Partial<typeof valores>) => setValores((atuais) => ({ ...atuais, ...parcial }));
  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvando(true);
    try {
      const nota = await criarNota(valores);
      aviso(`Nota ${nota.codigo} criada, em rascunho.`);
      aoCriar(nota.id);
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    } finally {
      setSalvando(false);
    }
  }
  return (
    <JanelaFormulario aberto aoFechar={aoFechar} titulo="Nova nota de liberação" descricao="Começa em rascunho. Publicar exige pelo menos um item e a data." alterado={Boolean(valores.versao || valores.resumo)} aoEnviar={enviar} salvando={salvando} rotuloSalvar="Criar nota">
      <div className="grid gap-[18px] md:grid-cols-2">
        <Campo id="nota-produto" rotulo="Produto" obrigatorio>
          {(controle) => (
            <Selecao {...controle} value={valores.produto_id} onChange={(evento) => mudar({ produto_id: evento.target.value })}>
              <option value="">Escolha</option>
              {produtos.filter((linha) => !linha.arquivado_em).map((linha) => <option key={linha.id} value={linha.id}>{linha.nome}</option>)}
            </Selecao>
          )}
        </Campo>
        <Campo id="nota-versao" rotulo="Versão" obrigatorio ajuda="Como 1.4.0. Uma nota por versão.">
          {(controle) => <Input {...controle} autoComplete="off" value={valores.versao} onChange={(evento) => mudar({ versao: evento.target.value })} />}
        </Campo>
        <Campo id="nota-data" rotulo="Data da versão" ajuda="Obrigatória para publicar.">
          {(controle) => <EntradaData {...controle} value={valores.data} onChange={(evento) => mudar({ data: evento.target.value })} />}
        </Campo>
        <Campo id="nota-publico" rotulo="Público" obrigatorio>
          {(controle) => <Selecao {...controle} value={valores.publico} onChange={(evento) => mudar({ publico: evento.target.value as NotaLiberacao['publico'] })}>{paraOpcoes(ROTULOS_PUBLICO_NOTA).map((opcao) => <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>)}</Selecao>}
        </Campo>
        <Campo id="nota-resumo" rotulo="Resumo" className="md:col-span-2" ajuda="Opcional: uma frase sobre a versão.">
          {(controle) => <Textarea {...controle} rows={2} value={valores.resumo} onChange={(evento) => mudar({ resumo: evento.target.value })} />}
        </Campo>
      </div>
    </JanelaFormulario>
  );
}
