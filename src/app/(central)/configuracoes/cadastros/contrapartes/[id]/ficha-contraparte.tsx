'use client';

import { useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { Archive, ArchiveRestore, ArrowLeft, Building2, Ellipsis, Pencil, Plus, Power, PowerOff, UserRound, Handshake } from 'lucide-react';
import { AbaAtividades } from '@/componentes/atividades/aba-atividades';
import { AbaFerramentas } from '@/componentes/ferramentas/aba-ferramentas';
import { AbaLancamentos } from '@/componentes/financeiro/aba-lancamentos';
import { titulosDaContraparte } from '@/dominio/titulos';
import { ferramentasDaContraparte } from '@/dominio/ferramentas';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { Dado, ListaDeDados } from '@/componentes/padroes/dado';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaLivre } from '@/componentes/padroes/etiquetas';
import { Ficha } from '@/componentes/padroes/ficha';
import { ListaHistorico } from '@/componentes/padroes/historico';
import { CLASSE_LINHA_MENU, MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import { Pessoa as NomeDaPessoa } from '@/componentes/padroes/pessoa';
import { Button } from '@/componentes/ui/button';
import { mensagemDoErro } from '@/dados/erros';
import type { Contraparte } from '@/dados/tipos/contraparte';
import { useConsulta } from '@/dados/use-consulta';
import { atividadesDoRegistro } from '@/dominio/atividades-painel';
import { arquivarContraparte, formatarDocumento, inativarContraparte, nomeDaContraparte, reativarContraparte, responsavelDaContraparteDisponivel, restaurarContraparte, ROTULOS_ORIGEM, ROTULOS_TIPO_PESSOA, vinculosDaContraparte } from '@/dominio/contrapartes';
import { enderecoEmLinha } from '@/dominio/endereco';
import { historicoDoRegistro } from '@/dominio/historico';
import { nomeDoPais, PAIS_BRASIL } from '@/dominio/paises';
import { carregarPessoas, formatarTelefone, ROTULOS_PAPEL } from '@/dominio/pessoas';
import { FormularioPessoa } from '../../pessoas/formulario-pessoa';
import { FormularioContraparte } from '../formulario-contraparte';
import { CAMINHO_DE_CONTRAPARTES, PapeisDaContraparte, SituacaoDaContraparte } from '@/componentes/contrapartes/etiquetas-contraparte';

/** Toque de 44px no celular (CA-18.05), sem aumentar o texto. */
const CLASSE_LINK = 'inline-flex min-h-11 items-center underline md:min-h-0';

async function carregarFicha(id: string) {
  const [dados, vinculos] = await Promise.all([carregarPessoas(), vinculosDaContraparte(id)]);
  return { dados, vinculos, contraparte: dados.contrapartes.find((item) => item.id === id) ?? null };
}

function AbaHistorico({ id }: { id: string }) {
  const consulta = useConsulta(() => historicoDoRegistro('contraparte', id), [id]);
  return (
    <div className="rounded-lg border border-line bg-paper p-4 md:p-5">
      <ListaHistorico consulta={consulta} comFiltros />
    </div>
  );
}

function Resumo({ contraparte, responsavel }: { contraparte: Contraparte; responsavel: ReactNode }) {
  const brasil = contraparte.pais === PAIS_BRASIL;
  return (
    <ListaDeDados>
      <Dado rotulo="Razão social">{contraparte.nome}</Dado>
      <Dado rotulo="Nome fantasia">{contraparte.nome_fantasia}</Dado>
      <Dado rotulo="Tipo de pessoa">{ROTULOS_TIPO_PESSOA[contraparte.tipo_pessoa]}</Dado>
      <Dado rotulo="Documento">{contraparte.documento && formatarDocumento(contraparte.tipo_pessoa, contraparte.documento)}</Dado>
      <Dado rotulo="Papéis">
        <PapeisDaContraparte papeis={contraparte.papeis} />
      </Dado>
      <Dado rotulo="Site">
        {contraparte.site && (
          <a className={CLASSE_LINK} href={contraparte.site} target="_blank" rel="noopener noreferrer">
            {contraparte.site}
          </a>
        )}
      </Dado>
      <Dado rotulo="E-mail geral">
        {contraparte.email && (
          <a className={CLASSE_LINK} href={`mailto:${contraparte.email}`}>
            {contraparte.email}
          </a>
        )}
      </Dado>
      <Dado rotulo="Telefone">{contraparte.telefone && (brasil ? formatarTelefone(contraparte.telefone) : contraparte.telefone)}</Dado>
      <Dado rotulo="País">{nomeDoPais(contraparte.pais)}</Dado>
      <Dado rotulo="Endereço">{enderecoEmLinha(contraparte.endereco)}</Dado>
      <Dado rotulo="Origem">{contraparte.origem && ROTULOS_ORIGEM[contraparte.origem]}</Dado>
      <Dado rotulo="Responsável interno">{responsavel}</Dado>
      <Dado rotulo="Observações">{contraparte.observacoes && <span className="whitespace-pre-wrap">{contraparte.observacoes}</span>}</Dado>
    </ListaDeDados>
  );
}

/** T02.06: ficha da contraparte (P2). Ferramentas e Lançamentos entram com T04 e T05; Arquivos, com M08. */
export function FichaContraparte() {
  const { id } = useParams<{ id: string }>();
  const consulta = useConsulta(() => carregarFicha(id), [id]);
  const [editando, setEditando] = useState(false);
  const [novoContato, setNovoContato] = useState(false);
  const [confirmando, setConfirmando] = useState<'inativar' | 'arquivar' | null>(null);

  const voltar = (
    <LinkCentral href={CAMINHO_DE_CONTRAPARTES} className="mb-5 inline-flex min-h-11 items-center gap-1.5 rounded-pill pr-3 text-[13px] font-medium text-ink-soft hover:text-ink md:min-h-9 [&_svg]:size-4">
      <ArrowLeft aria-hidden />
      Contrapartes
    </LinkCentral>
  );

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro') {
    return (
      <>
        {voltar}
        <EstadoErro titulo="Não deu para ler esta contraparte." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos em Configurações › Dados." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }

  const { contraparte, dados, vinculos } = consulta.dados;
  if (!contraparte) {
    return (
      <>
        {voltar}
        <EstadoVazio icone={Building2} titulo="Essa contraparte não existe mais." texto="Ela pode ter sido removida ao limpar os exemplos ou ao importar um arquivo." />
      </>
    );
  }

  const ativa = contraparte.situacao === 'ativa';
  const arquivada = Boolean(contraparte.arquivado_em);
  const temVinculos = vinculos.length > 0;
  const nome = nomeDaContraparte(contraparte);
  const contatos = dados.pessoas.filter((pessoa) => pessoa.contraparte_id === contraparte.id && !pessoa.arquivado_em);
  const nomeDoResponsavel = dados.pessoas.find((pessoa) => pessoa.id === contraparte.responsavel_id)?.nome_completo;

  async function executar(acao: () => Promise<void>, mensagem: string) {
    setConfirmando(null);
    try {
      await acao();
      aviso(mensagem);
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  }

  const reativar = () => executar(() => reativarContraparte(contraparte.id), 'Contraparte reativada.');
  const restaurar = () => executar(() => restaurarContraparte(contraparte.id), 'Contraparte restaurada.');

  const linhaDoMenu = (fechar: () => void, icone: ReactNode, rotulo: string, aoClicar: () => void) => (
    <button
      type="button"
      className={`${CLASSE_LINHA_MENU} hover:bg-hover`}
      onClick={() => {
        fechar();
        aoClicar();
      }}
    >
      {icone}
      {rotulo}
    </button>
  );

  return (
    <>
      {voltar}
      <Ficha
        tituloDePagina
        titulo={nome}
        etiquetas={
          <>
            <SituacaoDaContraparte situacao={contraparte.situacao} />
            <EtiquetaLivre>{ROTULOS_TIPO_PESSOA[contraparte.tipo_pessoa]}</EtiquetaLivre>
          </>
        }
        arquivado={
          arquivada
            ? {
                texto: 'Esta contraparte está arquivada: não aparece nas listas nem nos seletores.',
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
          arquivada ? undefined : (
            <>
              <Button onClick={() => setEditando(true)}>
                <Pencil aria-hidden />
                Editar
              </Button>
              {ativa ? (
                <Button variante="secundario" onClick={() => setConfirmando('inativar')}>
                  <PowerOff aria-hidden />
                  Inativar
                </Button>
              ) : (
                <Button variante="secundario" onClick={reativar}>
                  <Power aria-hidden />
                  Reativar
                </Button>
              )}
              <Button variante="terciario" onClick={() => setConfirmando('arquivar')}>
                <Archive aria-hidden />
                Arquivar
              </Button>
              <Button variante="terciario" asChild>
                <LinkCentral href={`/comercial/contrapartes/${id}`}>
                  <Handshake aria-hidden />
                  Visão comercial
                </LinkCentral>
              </Button>
            </>
          )
        }
        acoesCelular={
          arquivada ? undefined : (
            <>
              <Button className="flex-1" onClick={() => setEditando(true)}>
                <Pencil aria-hidden />
                Editar
              </Button>
              <MenuSobreposto
                titulo="Mais ações"
                gatilho={
                  <Button variante="secundario" className="flex-1">
                    <Ellipsis aria-hidden />
                    Mais ações
                  </Button>
                }
              >
                {(fechar) => (
                  <div className="grid gap-0.5">
                    {ativa ? linhaDoMenu(fechar, <PowerOff aria-hidden />, 'Inativar', () => setConfirmando('inativar')) : linhaDoMenu(fechar, <Power aria-hidden />, 'Reativar', () => void reativar())}
                    {linhaDoMenu(fechar, <Archive aria-hidden />, 'Arquivar', () => setConfirmando('arquivar'))}
                  </div>
                )}
              </MenuSobreposto>
            </>
          )
        }
        abas={[
          {
            id: 'resumo',
            rotulo: 'Resumo',
            conteudo: <Resumo contraparte={contraparte} responsavel={responsavelDaContraparteDisponivel(contraparte, dados.pessoas) ? nomeDoResponsavel : <span className="text-warn">{nomeDoResponsavel ?? 'Pessoa removida'}: edite e escolha outra pessoa</span>} />,
          },
          {
            id: 'contatos',
            rotulo: `Contatos (${contatos.length})`,
            conteudo: (
              <div className="space-y-3">
                {!arquivada && (
                  <div className="flex justify-end">
                    <Button variante="secundario" tamanho="pequeno" onClick={() => setNovoContato(true)}>
                      <Plus aria-hidden />
                      Novo contato
                    </Button>
                  </div>
                )}
                {contatos.length === 0 ? (
                  <EstadoVazio icone={UserRound} titulo="Nenhum contato ainda." texto="As pessoas desta contraparte aparecem aqui, com o papel de cada uma." />
                ) : (
                  <ul className="grid gap-2">
                    {contatos.map((pessoa) => (
                      <li key={pessoa.id} className="rounded-lg border border-line bg-paper p-4">
                        <LinkCentral href={`/configuracoes/cadastros/pessoas/${pessoa.id}`} className="inline-flex min-h-11 items-center underline-offset-2 hover:underline md:min-h-0">
                          <NomeDaPessoa nome={pessoa.nome_completo} className="font-medium" />
                        </LinkCentral>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          {pessoa.papeis_contato.map((papel) => (
                            <EtiquetaLivre key={papel}>{ROTULOS_PAPEL[papel]}</EtiquetaLivre>
                          ))}
                        </div>
                        {(pessoa.funcao || pessoa.email || pessoa.telefone) && <p className="mt-1.5 text-[13px] break-words text-ink-soft">{[pessoa.funcao, pessoa.email, pessoa.telefone && formatarTelefone(pessoa.telefone)].filter(Boolean).join(' · ')}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ),
          },
          { id: 'ferramentas', rotulo: 'Ferramentas fornecidas', conteudo: <AbaFerramentas consultar={() => ferramentasDaContraparte(contraparte.id)} dependencia={contraparte.id} vazio="As ferramentas fornecidas por esta contraparte aparecem aqui." /> },
          { id: 'lancamentos', rotulo: 'Lançamentos', conteudo: <AbaLancamentos consultar={() => titulosDaContraparte(contraparte.id)} dependencia={contraparte.id} vazio="As despesas com esta contraparte aparecem aqui." /> },
          { id: 'atividades', rotulo: 'Atividades', conteudo: <AbaAtividades consultar={() => atividadesDoRegistro('contraparte', contraparte.id)} dependencia={contraparte.id} vazio="As atividades vinculadas a esta contraparte aparecem aqui." /> },
          { id: 'historico', rotulo: 'Histórico', conteudo: <AbaHistorico id={contraparte.id} /> },
        ]}
      />

      <FormularioContraparte aberto={editando} aoFechar={() => setEditando(false)} contraparte={contraparte} pessoas={dados.pessoas} />
      <FormularioPessoa aberto={novoContato} aoFechar={() => setNovoContato(false)} dados={dados} contraparteInicial={contraparte.id} aoCadastrar={() => aviso('Contato cadastrado.')} />

      <Confirmacao
        aberto={confirmando === 'inativar'}
        aoFechar={() => setConfirmando(null)}
        titulo={`Inativar ${nome}?`}
        texto="Ela deixa de aparecer nos seletores de novos registros, mas continua nos registros antigos."
        rotuloConfirmar="Inativar contraparte"
        aoConfirmar={() => void executar(() => inativarContraparte(contraparte.id), 'Contraparte inativada.')}
      />
      {temVinculos ? (
        <Confirmacao
          aberto={confirmando === 'arquivar'}
          aoFechar={() => setConfirmando(null)}
          titulo={`Não dá para arquivar ${nome}`}
          texto={
            <>
              <p>Esta contraparte tem vínculos:</p>
              <ul className="mt-1.5 grid gap-1">
                {vinculos.map((vinculo) => (
                  <li key={vinculo}>{vinculo}</li>
                ))}
              </ul>
              <p className="mt-3">Se não for mais usada, inative: os registros antigos continuam com o nome dela.</p>
            </>
          }
          rotuloConfirmar="Entendi"
          soInforma
          aoConfirmar={() => setConfirmando(null)}
        />
      ) : (
        <Confirmacao
          aberto={confirmando === 'arquivar'}
          aoFechar={() => setConfirmando(null)}
          titulo={`Arquivar ${nome}?`}
          texto="Ela sai das listas e dos seletores. Dá para restaurar quando precisar, em Arquivados."
          rotuloConfirmar="Arquivar contraparte"
          perigo
          aoConfirmar={() => void executar(() => arquivarContraparte(contraparte.id), 'Contraparte arquivada.')}
        />
      )}
    </>
  );
}
