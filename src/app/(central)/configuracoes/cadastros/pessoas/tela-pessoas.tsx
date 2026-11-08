'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, Plus, Users } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { Pilulas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { aviso } from '@/componentes/padroes/aviso';
import { CabecalhoPagina } from '@/componentes/padroes/cabecalho-pagina';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaLivre, EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { BarraFiltros } from '@/componentes/padroes/filtros';
import { Lista, type Coluna } from '@/componentes/padroes/lista';
import { Pessoa as NomeDaPessoa } from '@/componentes/padroes/pessoa';
import { Button } from '@/componentes/ui/button';
import { useConsulta } from '@/dados/use-consulta';
import type { Pessoa } from '@/dados/tipos/pessoa';
import { carregarPessoas, filtrarPessoas, FILTROS_PESSOAS_INICIAIS, formatarTelefone, ROTULOS_SITUACAO, ROTULOS_TIPO, type FiltrosPessoas } from '@/dominio/pessoas';
import { formatarNumero } from '@/lib/formatacao';
import { AbasConfiguracoes, SubabasCadastros } from '../../abas';
import { FormularioPessoa } from './formulario-pessoa';

const CAMINHO = '/configuracoes/cadastros/pessoas';

export function EtiquetaDaSituacao({ situacao }: { situacao: Pessoa['situacao'] }) {
  return <EtiquetaSituacao tipo={situacao === 'ativa' ? 'sucesso' : 'neutro'}>{ROTULOS_SITUACAO[situacao]}</EtiquetaSituacao>;
}

const emOrdem = (a: string, b: string) => a.localeCompare(b, 'pt-BR');

const colunasDePessoas = (nomeDoVinculo: (pessoa: Pessoa) => string): readonly Coluna<Pessoa>[] => [
  {
    id: 'nome',
    titulo: 'Nome',
    essencial: true,
    ordenar: (a, b) => emOrdem(a.nome_completo, b.nome_completo),
    celula: (pessoa) => (
      <span className="flex min-w-0 items-center gap-2">
        <NomeDaPessoa nome={pessoa.nome_completo} className="font-medium" />
        {pessoa.eh_socia && <EtiquetaLivre>Sócia</EtiquetaLivre>}
      </span>
    ),
  },
  { id: 'tipo', titulo: 'Tipo', essencial: true, ordenar: (a, b) => emOrdem(a.tipo, b.tipo), celula: (pessoa) => ROTULOS_TIPO[pessoa.tipo] },
  { id: 'vinculo', titulo: 'Vínculo', celula: (pessoa) => nomeDoVinculo(pessoa) || '—' },
  { id: 'funcao', titulo: 'Função', ordenar: (a, b) => emOrdem(a.funcao ?? '', b.funcao ?? ''), celula: (pessoa) => pessoa.funcao ?? '—' },
  { id: 'email', titulo: 'E-mail', celula: (pessoa) => pessoa.email ?? '—' },
  { id: 'telefone', titulo: 'Telefone', celula: (pessoa) => (pessoa.telefone ? formatarTelefone(pessoa.telefone) : '—') },
  { id: 'situacao', titulo: 'Situação', essencial: true, ordenar: (a, b) => emOrdem(a.situacao, b.situacao), celula: (pessoa) => <EtiquetaDaSituacao situacao={pessoa.situacao} /> },
];

function plural(quantidade: number): string {
  return `${formatarNumero(quantidade)} ${quantidade === 1 ? 'pessoa' : 'pessoas'}`;
}

/** T02.02: lista de pessoas (P1). "Usuária" entra com o login, na etapa com servidor. */
export function TelaPessoas() {
  const roteador = useRouter();
  const consulta = useConsulta(carregarPessoas);
  const [filtros, setFiltros] = useState<FiltrosPessoas>(FILTROS_PESSOAS_INICIAIS);
  const [cadastrando, setCadastrando] = useState(false);

  const pessoas = consulta.dados?.pessoas;
  const visiveis = useMemo(() => filtrarPessoas(pessoas ?? [], filtros), [pessoas, filtros]);
  const contagem = useMemo(() => {
    const semTipo = filtrarPessoas(pessoas ?? [], { ...filtros, tipo: 'todas' });
    return { todas: semTipo.length, interna: semTipo.filter((pessoa) => pessoa.tipo === 'interna').length, externa: semTipo.filter((pessoa) => pessoa.tipo === 'externa').length };
  }, [pessoas, filtros]);
  const arquivadas = useMemo(() => (pessoas ?? []).filter((pessoa) => pessoa.arquivado_em).length, [pessoas]);
  const ativas = (pessoas ?? []).length - arquivadas;

  const mudar = (parcial: Partial<FiltrosPessoas>) => setFiltros((atuais) => ({ ...atuais, ...parcial }));
  const limpar = () => setFiltros((atuais) => ({ ...FILTROS_PESSOAS_INICIAIS, arquivadas: atuais.arquivadas }));
  const filtrando = Boolean(filtros.busca.trim()) || filtros.tipo !== 'todas' || filtros.situacao !== 'todas' || Boolean(filtros.contraparte);
  const contrapartes = consulta.dados?.contrapartes;
  const nomeDaContraparte = (id: string | null) => {
    const contraparte = contrapartes?.find((item) => item.id === id);
    return contraparte ? contraparte.nome_fantasia || contraparte.nome : '';
  };
  const colunas = useMemo(() => colunasDePessoas((pessoa) => nomeDaContraparte(pessoa.contraparte_id)), [contrapartes]); // eslint-disable-line react-hooks/exhaustive-deps -- a função só depende das contrapartes
  const abrir = (pessoa: Pessoa) => roteador.push(`${CAMINHO}/${pessoa.id}`);

  return (
    <>
      <CabecalhoPagina
        comoUsar="/ajuda/cadastros/pessoas"
        migalhas={['Central Numa', 'Configurações', 'Cadastros base', 'Pessoas']}
        kicker="Configurações"
        titulo="Pessoas"
        resumo={pessoas ? plural(ativas) : undefined}
        acoes={
          <Button onClick={() => setCadastrando(true)} disabled={!consulta.dados}>
            <Plus aria-hidden />
            Nova pessoa
          </Button>
        }
      />
      <AbasConfiguracoes ativa="cadastros" />
      <SubabasCadastros ativa="pessoas" />

      <div className="mt-5 space-y-4">
        {consulta.estado === 'carregando' && <EstadoCarregando />}
        {consulta.estado === 'erro' && <EstadoErro titulo="Não deu para ler as pessoas." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos na aba Dados." aoTentarDeNovo={consulta.recarregar} />}
        {consulta.estado === 'pronto' && (
          <>
            <BarraFiltros
              busca={filtros.busca}
              aoBuscar={(busca) => mudar({ busca })}
              rotuloBusca="Buscar por nome, e-mail ou telefone"
              rapidos={[
                { id: 'todas', rotulo: 'Todas', contador: contagem.todas },
                { id: 'interna', rotulo: 'Internas', contador: contagem.interna },
                { id: 'externa', rotulo: 'Externas', contador: contagem.externa },
              ]}
              rapidoAtivo={filtros.tipo}
              aoEscolherRapido={(tipo) => mudar({ tipo: tipo as FiltrosPessoas['tipo'] })}
              ativos={[...(filtros.situacao === 'todas' ? [] : [{ id: 'situacao', rotulo: `Situação: ${ROTULOS_SITUACAO[filtros.situacao]}` }]), ...(filtros.contraparte ? [{ id: 'contraparte', rotulo: `Contraparte: ${nomeDaContraparte(filtros.contraparte)}` }] : [])]}
              aoRemoverAtivo={(id) => mudar(id === 'situacao' ? { situacao: 'todas' } : { contraparte: '' })}
              aoLimpar={limpar}
              filtrosDetalhados={
                <div className="grid gap-4 px-1 pb-2 md:px-3">
                  <Pilulas
                    rotulo="Situação"
                    valor={filtros.situacao}
                    aoMudar={(situacao) => mudar({ situacao: situacao as FiltrosPessoas['situacao'] })}
                    opcoes={[
                      { valor: 'todas', rotulo: 'Todas' },
                      { valor: 'ativa', rotulo: 'Ativas' },
                      { valor: 'inativa', rotulo: 'Inativas' },
                    ]}
                  />
                  <Campo rotulo="Contraparte" id="filtro-contraparte">
                    {(controle) => (
                      <Selecao {...controle} value={filtros.contraparte} onChange={(evento) => mudar({ contraparte: evento.target.value })}>
                        <option value="">Todas</option>
                        {(contrapartes ?? []).map((contraparte) => (
                          <option key={contraparte.id} value={contraparte.id}>
                            {contraparte.nome_fantasia || contraparte.nome}
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
                {filtros.arquivadas ? 'Voltar às pessoas ativas' : `Arquivados (${formatarNumero(arquivadas)})`}
              </Button>
            </div>
            <Lista
              rotulo={filtros.arquivadas ? 'Pessoas arquivadas' : 'Pessoas'}
              linhas={visiveis}
              colunas={colunas}
              chave={(pessoa) => pessoa.id}
              aoAbrir={abrir}
              filtrando={filtrando}
              aoLimparFiltros={limpar}
              cartao={(pessoa) => (
                <div className="grid gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <NomeDaPessoa nome={pessoa.nome_completo} className="font-semibold" />
                    <EtiquetaDaSituacao situacao={pessoa.situacao} />
                  </div>
                  <p className="text-[13px] text-ink-soft">
                    {ROTULOS_TIPO[pessoa.tipo]}
                    {pessoa.eh_socia ? ' · Sócia' : ''}
                    {pessoa.funcao ? ` · ${pessoa.funcao}` : ''}
                  </p>
                  {(pessoa.email || pessoa.telefone) && <p className="text-[13px] break-words text-ink-soft">{[pessoa.email, pessoa.telefone && formatarTelefone(pessoa.telefone)].filter(Boolean).join(' · ')}</p>}
                </div>
              )}
              vazio={
                filtros.arquivadas ? (
                  <EstadoVazio icone={Archive} titulo="Nenhuma pessoa arquivada." texto="Quem for arquivado aparece aqui, e dá para restaurar quando precisar." />
                ) : (
                  <EstadoVazio icone={Users} titulo="Nenhuma pessoa ainda." texto="Que tal cadastrar a primeira?" acao={<Button onClick={() => setCadastrando(true)}>Nova pessoa</Button>} />
                )
              }
            />
            <FormularioPessoa
              aberto={cadastrando}
              aoFechar={() => setCadastrando(false)}
              dados={consulta.dados}
              aoCadastrar={(pessoa) => aviso('Pessoa cadastrada.', { acao: { rotulo: 'Abrir', aoClicar: () => abrir(pessoa) } })}
            />
          </>
        )}
      </div>
    </>
  );
}
