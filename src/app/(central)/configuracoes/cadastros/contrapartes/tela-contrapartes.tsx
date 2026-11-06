'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, Building2, Plus, TriangleAlert } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { Pilulas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { aviso } from '@/componentes/padroes/aviso';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaLivre, EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { BarraFiltros, type FiltroAtivo } from '@/componentes/padroes/filtros';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { Pessoa as NomeDaPessoa } from '@/componentes/padroes/pessoa';
import { Button } from '@/componentes/ui/button';
import { UFS } from '@/dados/referencia/municipios';
import type { Contraparte } from '@/dados/tipos/contraparte';
import { useConsulta } from '@/dados/use-consulta';
import {
  carregarContrapartes,
  cidadesDasContrapartes,
  filtrarContrapartes,
  FILTROS_CONTRAPARTES_INICIAIS,
  formatarDocumento,
  nomeDaContraparte,
  ORIGENS_DO_FORMULARIO,
  pessoasParaContraparte,
  responsavelDaContraparteDisponivel,
  ROTULOS_ORIGEM,
  ROTULOS_PAPEL_CONTRAPARTE,
  ROTULOS_TIPO_PESSOA,
  type FiltrosContrapartes,
} from '@/dominio/contrapartes';
import { formatarNumero } from '@/lib/formatacao';
import { AbasConfiguracoes, SubabasCadastros } from '../../abas';
import { FormularioContraparte } from './formulario-contraparte';

export const CAMINHO_DE_CONTRAPARTES = '/configuracoes/cadastros/contrapartes';

export function SituacaoDaContraparte({ situacao }: { situacao: Contraparte['situacao'] }) {
  return <EtiquetaSituacao tipo={situacao === 'ativa' ? 'sucesso' : 'neutro'}>{situacao === 'ativa' ? 'Ativa' : 'Inativa'}</EtiquetaSituacao>;
}

export function PapeisDaContraparte({ papeis }: { papeis: Contraparte['papeis'] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {papeis.map((papel) => (
        <EtiquetaLivre key={papel}>{ROTULOS_PAPEL_CONTRAPARTE[papel]}</EtiquetaLivre>
      ))}
    </span>
  );
}

function plural(quantidade: number): string {
  return `${formatarNumero(quantidade)} ${quantidade === 1 ? 'contraparte' : 'contrapartes'}`;
}

/** T02.06 (P1). "Produtos relacionados" entra com os contratos, na F1; ferramentas e lançamentos, com T04 e T05. */
export function TelaContrapartes() {
  const roteador = useRouter();
  const consulta = useConsulta(carregarContrapartes);
  const [filtros, setFiltros] = useState<FiltrosContrapartes>(FILTROS_CONTRAPARTES_INICIAIS);
  const [cadastrando, setCadastrando] = useState(false);

  const dados = consulta.dados;
  const contrapartes = dados?.contrapartes;
  const visiveis = useMemo(() => filtrarContrapartes(contrapartes ?? [], filtros), [contrapartes, filtros]);
  const contagem = useMemo(() => {
    const semPapel = filtrarContrapartes(contrapartes ?? [], { ...filtros, papel: 'todos' });
    const de = (papel: Contraparte['papeis'][number]) => semPapel.filter((contraparte) => contraparte.papeis.includes(papel)).length;
    return { todos: semPapel.length, fornecedor: de('fornecedor'), cliente: de('cliente'), parceiro: de('parceiro'), prospect: de('prospect'), institucional: de('institucional') };
  }, [contrapartes, filtros]);
  const arquivadas = useMemo(() => (contrapartes ?? []).filter((contraparte) => contraparte.arquivado_em).length, [contrapartes]);
  const cidades = useMemo(() => cidadesDasContrapartes((contrapartes ?? []).filter((contraparte) => !contraparte.arquivado_em)), [contrapartes]);
  const ativas = (contrapartes ?? []).length - arquivadas;

  const mudar = (parcial: Partial<FiltrosContrapartes>) => setFiltros((atuais) => ({ ...atuais, ...parcial }));
  const limpar = () => setFiltros((atuais) => ({ ...FILTROS_CONTRAPARTES_INICIAIS, arquivadas: atuais.arquivadas }));
  const filtrando = Boolean(filtros.busca.trim()) || filtros.papel !== 'todos' || filtros.situacao !== 'todas' || Boolean(filtros.responsavel || filtros.uf || filtros.cidade || filtros.origem);
  const abrir = (contraparte: Contraparte) => roteador.push(`${CAMINHO_DE_CONTRAPARTES}/${contraparte.id}`);

  const nomeDaPessoa = (id: string) => dados?.pessoas.find((pessoa) => pessoa.id === id)?.nome_completo;

  const ativos: FiltroAtivo[] = [
    ...(filtros.situacao !== 'todas' ? [{ id: 'situacao', rotulo: `Situação: ${filtros.situacao === 'ativa' ? 'Ativa' : 'Inativa'}` }] : []),
    ...(filtros.responsavel ? [{ id: 'responsavel', rotulo: `Responsável: ${nomeDaPessoa(filtros.responsavel) ?? ''}` }] : []),
    ...(filtros.uf ? [{ id: 'uf', rotulo: `Estado: ${filtros.uf}` }] : []),
    ...(filtros.cidade ? [{ id: 'cidade', rotulo: `Cidade: ${filtros.cidade}` }] : []),
    ...(filtros.origem ? [{ id: 'origem', rotulo: `Origem: ${ROTULOS_ORIGEM[filtros.origem as keyof typeof ROTULOS_ORIGEM]}` }] : []),
  ];

  function ResponsavelDaContraparte({ contraparte }: { contraparte: Contraparte }) {
    const nome = nomeDaPessoa(contraparte.responsavel_id);
    if (dados && responsavelDaContraparteDisponivel(contraparte, dados.pessoas) && nome) return <NomeDaPessoa nome={nome} />;
    return (
      <span className="flex flex-wrap items-center gap-2">
        {nome && <NomeDaPessoa nome={nome} />}
        <EtiquetaSituacao tipo="atencao" icone={TriangleAlert}>
          Escolha outra pessoa
        </EtiquetaSituacao>
      </span>
    );
  }

  const colunas: readonly Coluna<Contraparte>[] = [
    {
      id: 'nome',
      titulo: 'Nome',
      essencial: true,
      ordenar: (a, b) => nomeDaContraparte(a).localeCompare(nomeDaContraparte(b), 'pt-BR'),
      celula: (contraparte) => (
        <span className="grid">
          <span className="font-medium">{nomeDaContraparte(contraparte)}</span>
          {contraparte.nome_fantasia && <span className="text-xs text-ink-soft">{contraparte.nome}</span>}
        </span>
      ),
    },
    { id: 'tipo', titulo: 'Tipo de pessoa', ordenar: (a, b) => a.tipo_pessoa.localeCompare(b.tipo_pessoa), celula: (contraparte) => ROTULOS_TIPO_PESSOA[contraparte.tipo_pessoa] },
    { id: 'documento', titulo: 'Documento', celula: (contraparte) => <span className="whitespace-nowrap tabular-nums">{contraparte.documento ? formatarDocumento(contraparte.tipo_pessoa, contraparte.documento) : '—'}</span> },
    { id: 'papeis', titulo: 'Papéis', essencial: true, celula: (contraparte) => <PapeisDaContraparte papeis={contraparte.papeis} /> },
    { id: 'responsavel', titulo: 'Responsável', celula: (contraparte) => <ResponsavelDaContraparte contraparte={contraparte} /> },
    { id: 'situacao', titulo: 'Situação', essencial: true, ordenar: (a, b) => a.situacao.localeCompare(b.situacao), celula: (contraparte) => <SituacaoDaContraparte situacao={contraparte.situacao} /> },
  ];

  return (
    <>
      <CabecalhoPagina
        migalhas={['Central Numa', 'Configurações', 'Cadastros base', 'Contrapartes']}
        kicker="Configurações"
        titulo="Contrapartes"
        resumo={contrapartes ? plural(ativas) : undefined}
        acoes={
          <Button onClick={() => setCadastrando(true)} disabled={!dados}>
            <Plus aria-hidden />
            Nova contraparte
          </Button>
        }
      />
      <AbasConfiguracoes ativa="cadastros" />
      <SubabasCadastros ativa="contrapartes" />

      <div className="mt-5 space-y-4">
        {consulta.estado === 'carregando' && <EstadoCarregando />}
        {consulta.estado === 'erro' && <EstadoErro titulo="Não deu para ler as contrapartes." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos na aba Dados." aoTentarDeNovo={consulta.recarregar} />}
        {consulta.estado === 'pronto' && dados && (
          <>
            <BarraFiltros
              busca={filtros.busca}
              aoBuscar={(busca) => mudar({ busca })}
              rotuloBusca="Buscar por nome, documento ou e-mail"
              rapidos={[
                { id: 'todos', rotulo: 'Todas', contador: contagem.todos },
                { id: 'fornecedor', rotulo: 'Fornecedores', contador: contagem.fornecedor },
                { id: 'cliente', rotulo: 'Clientes', contador: contagem.cliente },
                { id: 'parceiro', rotulo: 'Parceiros', contador: contagem.parceiro },
                { id: 'prospect', rotulo: 'Prospects', contador: contagem.prospect },
                { id: 'institucional', rotulo: 'Institucionais', contador: contagem.institucional },
              ]}
              rapidoAtivo={filtros.papel}
              aoEscolherRapido={(papel) => mudar({ papel: papel as FiltrosContrapartes['papel'] })}
              ativos={ativos}
              aoRemoverAtivo={(id) => mudar(id === 'situacao' ? { situacao: 'todas' } : { [id]: '' })}
              aoLimpar={limpar}
              filtrosDetalhados={
                <div className="grid gap-4 px-1 pb-2 md:px-3">
                  <Pilulas
                    rotulo="Situação"
                    valor={filtros.situacao}
                    aoMudar={(situacao) => mudar({ situacao: situacao as FiltrosContrapartes['situacao'] })}
                    opcoes={[
                      { valor: 'todas', rotulo: 'Todas' },
                      { valor: 'ativa', rotulo: 'Ativas' },
                      { valor: 'inativa', rotulo: 'Inativas' },
                    ]}
                  />
                  <Campo rotulo="Responsável" id="filtro-responsavel">
                    {(controle) => (
                      <Selecao {...controle} value={filtros.responsavel} onChange={(evento) => mudar({ responsavel: evento.target.value })}>
                        <option value="">Todas</option>
                        {pessoasParaContraparte(dados.pessoas).map((pessoa) => (
                          <option key={pessoa.id} value={pessoa.id}>
                            {pessoa.nome_completo}
                          </option>
                        ))}
                      </Selecao>
                    )}
                  </Campo>
                  <Campo rotulo="Estado" id="filtro-uf">
                    {(controle) => (
                      <Selecao {...controle} value={filtros.uf} onChange={(evento) => mudar({ uf: evento.target.value })}>
                        <option value="">Todos</option>
                        {UFS.map((uf) => (
                          <option key={uf.sigla} value={uf.sigla}>
                            {uf.nome} · {uf.sigla}
                          </option>
                        ))}
                      </Selecao>
                    )}
                  </Campo>
                  <Campo rotulo="Cidade" id="filtro-cidade">
                    {(controle) => (
                      <Selecao {...controle} value={filtros.cidade} onChange={(evento) => mudar({ cidade: evento.target.value })}>
                        <option value="">Todas</option>
                        {cidades.map((cidade) => (
                          <option key={cidade} value={cidade}>
                            {cidade}
                          </option>
                        ))}
                      </Selecao>
                    )}
                  </Campo>
                  <Campo rotulo="Origem" id="filtro-origem">
                    {(controle) => (
                      <Selecao {...controle} value={filtros.origem} onChange={(evento) => mudar({ origem: evento.target.value })}>
                        <option value="">Todas</option>
                        {ORIGENS_DO_FORMULARIO.map((origem) => (
                          <option key={origem} value={origem}>
                            {ROTULOS_ORIGEM[origem]}
                          </option>
                        ))}
                      </Selecao>
                    )}
                  </Campo>
                </div>
              }
            />
            <div className="flex justify-end">
              <Button variante="terciario" tamanho="pequeno" aria-pressed={filtros.arquivadas} onClick={() => mudar({ arquivadas: !filtros.arquivadas })}>
                <Archive aria-hidden />
                {filtros.arquivadas ? 'Voltar às contrapartes ativas' : `Arquivados (${formatarNumero(arquivadas)})`}
              </Button>
            </div>
            <Lista
              rotulo={filtros.arquivadas ? 'Contrapartes arquivadas' : 'Contrapartes'}
              linhas={visiveis}
              colunas={colunas}
              chave={(contraparte) => contraparte.id}
              aoAbrir={abrir}
              filtrando={filtrando}
              aoLimparFiltros={limpar}
              cartao={(contraparte) => (
                <div className="grid gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold break-words">{nomeDaContraparte(contraparte)}</p>
                      <p className="text-[13px] text-ink-soft">{ROTULOS_TIPO_PESSOA[contraparte.tipo_pessoa]}</p>
                    </div>
                    <SituacaoDaContraparte situacao={contraparte.situacao} />
                  </div>
                  <PapeisDaContraparte papeis={contraparte.papeis} />
                </div>
              )}
              vazio={
                filtros.arquivadas ? (
                  <EstadoVazio icone={Archive} titulo="Nenhuma contraparte arquivada." texto="As arquivadas aparecem aqui, e dá para restaurar quando precisar." />
                ) : (
                  <EstadoVazio icone={Building2} titulo="Nenhuma contraparte ainda." texto="Que tal cadastrar a primeira?" acao={<Button onClick={() => setCadastrando(true)}>Nova contraparte</Button>} />
                )
              }
            />
            <FormularioContraparte
              aberto={cadastrando}
              aoFechar={() => setCadastrando(false)}
              pessoas={dados.pessoas}
              aoCadastrar={(contraparte) => aviso('Contraparte cadastrada.', { acao: { rotulo: 'Abrir', aoClicar: () => abrir(contraparte) } })}
            />
          </>
        )}
      </div>
    </>
  );
}
