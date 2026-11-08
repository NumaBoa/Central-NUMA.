'use client';

import { AvisoDaMarcaProvisoria } from '@/componentes/empresa/aviso-da-marca';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Archive, ArchiveRestore, ArrowLeft, Box, Pencil } from 'lucide-react';
import { AbaAtividades } from '@/componentes/atividades/aba-atividades';
import { AbaFerramentas } from '@/componentes/ferramentas/aba-ferramentas';
import { ferramentasDoProduto } from '@/dominio/ferramentas';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { Dado, ListaDeDados } from '@/componentes/padroes/dado';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaLivre } from '@/componentes/padroes/etiquetas';
import { Ficha } from '@/componentes/padroes/ficha';
import { ListaHistorico } from '@/componentes/padroes/historico';
import { Button } from '@/componentes/ui/button';
import { mensagemDoErro } from '@/dados/erros';
import { useConsulta } from '@/dados/use-consulta';
import { atividadesDoRegistro } from '@/dominio/atividades-painel';
import { historicoDoRegistro } from '@/dominio/historico';
import { carregarMarcas } from '@/dominio/marcas';
import { arquivarProduto, responsavelDisponivel, restaurarProduto, ROTULOS_ESTAGIO, ROTULOS_TIPO_PRODUTO } from '@/dominio/produtos';
import { formatarDiaISO } from '@/lib/formatacao';
import { ChipDaMarca, SituacaoDoProduto } from '../../aparencia';
import { FormularioProduto } from '../../formulario-produto';
import { FONTE_DA_MARCA } from './fontes';

function AbaHistorico({ id }: { id: string }) {
  const consulta = useConsulta(() => historicoDoRegistro('produto', id), [id]);
  return (
    <div className="rounded-lg border border-line bg-paper p-4 md:p-5">
      <ListaHistorico consulta={consulta} comFiltros />
    </div>
  );
}

/** T02.04: o cadastro básico do produto. A ficha completa (ofertas, simulações, KPIs) é a T07.02, na F0b. */
export function FichaProduto() {
  const { id } = useParams<{ id: string }>();
  const consulta = useConsulta(carregarMarcas);
  const [editando, setEditando] = useState(false);
  const [arquivando, setArquivando] = useState(false);

  const voltarPara = (marcaId?: string) => (
    <LinkCentral href={`/produtos/marcas${marcaId ? `?marca=${marcaId}` : ''}`} className="mb-5 inline-flex min-h-11 items-center gap-1.5 rounded-pill pr-3 text-[13px] font-medium text-ink-soft hover:text-ink md:min-h-9 [&_svg]:size-4">
      <ArrowLeft aria-hidden />
      Marcas e produtos
    </LinkCentral>
  );

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro') {
    return (
      <>
        {voltarPara()}
        <EstadoErro titulo="Não deu para ler este produto." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos em Configurações › Dados." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }

  const { marcas, produtos, pessoas, entidades } = consulta.dados;
  const produto = produtos.find((item) => item.id === id);
  const marca = marcas.find((item) => item.id === produto?.marca_id);
  if (!produto || !marca) {
    return (
      <>
        {voltarPara()}
        <EstadoVazio icone={Box} titulo="Esse produto não existe mais." texto="Ele pode ter sido removido ao importar um arquivo." />
      </>
    );
  }

  const responsavel = pessoas.find((pessoa) => pessoa.id === produto.responsavel_id);
  const entidadeDoProduto = entidades.find((entidade) => entidade.id === produto.entidade_id);
  const arquivado = Boolean(produto.arquivado_em);

  async function executar(acao: () => Promise<void>, mensagem: string) {
    setArquivando(false);
    try {
      await acao();
      aviso(mensagem);
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  }

  const restaurar = () => executar(() => restaurarProduto(produto.id), 'Produto restaurado.');

  return (
    <>
      {voltarPara(marca.id)}
      <div className="mb-4 empty:hidden">
        <AvisoDaMarcaProvisoria marcaId={marca?.id} />
      </div>
      <Ficha
        tituloDePagina
        titulo={produto.nome}
        classeDoTitulo={FONTE_DA_MARCA[marca.id]}
        etiquetas={
          <>
            <ChipDaMarca marca={marca} className="size-7 [&_svg]:size-[15px]" />
            <SituacaoDoProduto situacao={produto.situacao} />
            <EtiquetaLivre>{ROTULOS_ESTAGIO[produto.estagio]}</EtiquetaLivre>
            {marca.provisorio && <EtiquetaLivre>provisório</EtiquetaLivre>}
          </>
        }
        arquivado={
          arquivado
            ? {
                texto: 'Este produto está arquivado: não aparece nas listas nem no seletor de contexto.',
                acao: (
                  <Button variante="secundario" tamanho="pequeno" onClick={restaurar}>
                    <ArchiveRestore aria-hidden />
                    Restaurar
                  </Button>
                ),
              }
            : undefined
        }
        acoes={
          arquivado ? undefined : (
            <>
              <Button onClick={() => setEditando(true)}>
                <Pencil aria-hidden />
                Editar
              </Button>
              <Button variante="terciario" onClick={() => setArquivando(true)}>
                <Archive aria-hidden />
                Arquivar
              </Button>
            </>
          )
        }
        acoesCelular={
          arquivado ? undefined : (
            <>
              <Button className="flex-1" onClick={() => setEditando(true)}>
                <Pencil aria-hidden />
                Editar
              </Button>
              <Button variante="secundario" className="flex-1" onClick={() => setArquivando(true)}>
                <Archive aria-hidden />
                Arquivar
              </Button>
            </>
          )
        }
        abas={[
          {
            id: 'resumo',
            rotulo: 'Resumo',
            conteudo: (
              <ListaDeDados>
                <Dado rotulo="Marca">{marca.nome}</Dado>
                <Dado rotulo="Código curto">{produto.codigo_curto}</Dado>
                <Dado rotulo="Tipo">{ROTULOS_TIPO_PRODUTO[produto.tipo]}</Dado>
                <Dado rotulo="Descrição curta">{produto.descricao_curta}</Dado>
                <Dado rotulo="Estágio">{ROTULOS_ESTAGIO[produto.estagio]}</Dado>
                {produto.ordem_fila !== null && <Dado rotulo="Ordem na fila">{produto.ordem_fila}</Dado>}
                <Dado rotulo="Responsável">{responsavelDisponivel(produto, pessoas) ? responsavel?.nome_completo : <span className="text-warn">A definir: edite e escolha uma pessoa</span>}</Dado>
                <Dado rotulo="Entidade responsável">{entidadeDoProduto ? entidadeDoProduto.nome_fantasia || entidadeDoProduto.nome : 'A definir'}</Dado>
                <Dado rotulo="Tem usuários reais">{produto.tem_usuarios_reais ? 'Sim' : 'Não'}</Dado>
                <Dado rotulo="Data de início">{produto.data_inicio && formatarDiaISO(produto.data_inicio)}</Dado>
              </ListaDeDados>
            ),
          },
          { id: 'ferramentas', rotulo: 'Ferramentas', conteudo: <AbaFerramentas consultar={() => ferramentasDoProduto(produto.id)} dependencia={produto.id} vazio="As ferramentas ligadas a este produto aparecem aqui." /> },
          { id: 'atividades', rotulo: 'Atividades', conteudo: <AbaAtividades consultar={() => atividadesDoRegistro('produto', produto.id)} dependencia={produto.id} vazio="As atividades deste produto aparecem aqui." /> },
          { id: 'historico', rotulo: 'Histórico', conteudo: <AbaHistorico id={produto.id} /> },
        ]}
      />

      <FormularioProduto aberto={editando} aoFechar={() => setEditando(false)} produto={produto} marcas={marcas} pessoas={pessoas} entidades={entidades} />
      <Confirmacao
        aberto={arquivando}
        aoFechar={() => setArquivando(false)}
        titulo={`Arquivar ${produto.nome}?`}
        texto="Ele sai das listas e do seletor de contexto. Dá para restaurar quando precisar, em Arquivados."
        rotuloConfirmar="Arquivar produto"
        perigo
        aoConfirmar={() => void executar(() => arquivarProduto(produto.id), 'Produto arquivado.')}
      />
    </>
  );
}
