'use client';

import { useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { Archive, ArrowLeft, ArchiveRestore, Ellipsis, Pencil, UserCheck, UserMinus, UserX } from 'lucide-react';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { Dado, ListaDeDados } from '@/componentes/padroes/dado';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaLivre } from '@/componentes/padroes/etiquetas';
import { Ficha } from '@/componentes/padroes/ficha';
import { ListaHistorico } from '@/componentes/padroes/historico';
import { CLASSE_LINHA_MENU, MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import { Button } from '@/componentes/ui/button';
import { mensagemDoErro } from '@/dados/erros';
import type { Pessoa } from '@/dados/tipos/pessoa';
import { useConsulta } from '@/dados/use-consulta';
import { historicoDaPessoa } from '@/dominio/historico';
import { areasDaPessoa, arquivarPessoa, carregarPessoas, formatarCpf, formatarTelefone, inativarPessoa, nomeDeExibicaoPadrao, reativarPessoa, restaurarPessoa, ROTULOS_PAPEL, ROTULOS_TIPO, vinculosDaPessoa } from '@/dominio/pessoas';
import { FormularioPessoa } from '../formulario-pessoa';
import { EtiquetaDaSituacao } from '../tela-pessoas';

const CAMINHO_DA_LISTA = '/configuracoes/cadastros/pessoas';

/** Toque de 44px no celular (CA-18.05), sem aumentar o texto. */
const CLASSE_LINK = 'inline-flex min-h-11 items-center underline md:min-h-0';

async function carregarFicha(id: string) {
  const [dados, vinculos] = await Promise.all([carregarPessoas(), vinculosDaPessoa(id)]);
  return { dados, vinculos, pessoa: dados.pessoas.find((item) => item.id === id) ?? null };
}

type AcaoEmConfirmacao = 'inativar' | 'arquivar' | null;

function Resumo({ pessoa, areas }: { pessoa: Pessoa; areas: readonly string[] }) {
  return (
    <ListaDeDados>
      <Dado rotulo="Nome de exibição">{pessoa.nome_exibicao ?? nomeDeExibicaoPadrao(pessoa.nome_completo)}</Dado>
      <Dado rotulo="Tipo">{ROTULOS_TIPO[pessoa.tipo]}</Dado>
      {pessoa.tipo === 'interna' ? <Dado rotulo="Áreas em que atua">{areas.length ? areas.join(', ') : null}</Dado> : <Dado rotulo="Papel do contato">{pessoa.papeis_contato.length ? pessoa.papeis_contato.map((papel) => ROTULOS_PAPEL[papel]).join(', ') : null}</Dado>}
      <Dado rotulo="Função / cargo">{pessoa.funcao}</Dado>
      <Dado rotulo="E-mail">{pessoa.email && <a className={CLASSE_LINK} href={`mailto:${pessoa.email}`}>{pessoa.email}</a>}</Dado>
      <Dado rotulo="Telefone / WhatsApp">{pessoa.telefone && <a className={CLASSE_LINK} href={`tel:+55${pessoa.telefone}`}>{formatarTelefone(pessoa.telefone)}</a>}</Dado>
      <Dado rotulo="CPF">{pessoa.cpf && formatarCpf(pessoa.cpf)}</Dado>
      <Dado rotulo="Observações">{pessoa.observacoes && <span className="whitespace-pre-wrap">{pessoa.observacoes}</span>}</Dado>
    </ListaDeDados>
  );
}

function AbaHistorico({ id }: { id: string }) {
  const consulta = useConsulta(() => historicoDaPessoa(id), [id]);
  return (
    <div className="rounded-lg border border-line bg-paper p-4 md:p-5">
      <ListaHistorico consulta={consulta} />
    </div>
  );
}

/** T02.02: ficha da pessoa (P2). Atividades entra com o Meu dia, Vínculos quando houver o que vincular. */
export function FichaPessoa() {
  const { id } = useParams<{ id: string }>();
  const consulta = useConsulta(() => carregarFicha(id), [id]);
  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState<AcaoEmConfirmacao>(null);

  const voltar = (
    <LinkCentral href={CAMINHO_DA_LISTA} className="mb-5 inline-flex min-h-11 items-center gap-1.5 rounded-pill pr-3 text-[13px] font-medium text-ink-soft hover:text-ink md:min-h-9 [&_svg]:size-4">
      <ArrowLeft aria-hidden />
      Pessoas
    </LinkCentral>
  );

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro') {
    return (
      <>
        {voltar}
        <EstadoErro titulo="Não deu para ler esta pessoa." texto="Os dados deste navegador podem estar danificados. Importe um backup ou restaure os exemplos em Configurações › Dados." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }

  const { pessoa, dados, vinculos } = consulta.dados;
  if (!pessoa) {
    return (
      <>
        {voltar}
        <EstadoVazio icone={UserX} titulo="Essa pessoa não existe mais." texto="Ela pode ter sido removida ao limpar os exemplos ou ao importar um arquivo." />
      </>
    );
  }

  const areas = areasDaPessoa(pessoa.id, dados).map((area) => area.nome);
  const ativa = pessoa.situacao === 'ativa';
  const arquivada = Boolean(pessoa.arquivado_em);
  const temVinculos = vinculos.length > 0;

  async function executar(acao: () => Promise<void>, mensagem: string) {
    setConfirmando(null);
    try {
      await acao();
      aviso(mensagem);
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  }

  const reativar = () => executar(() => reativarPessoa(pessoa.id), 'Pessoa reativada.');
  const restaurar = () => executar(() => restaurarPessoa(pessoa.id), 'Pessoa restaurada.');

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
      <nav aria-label="Caminho" className="sr-only">
        Central Numa, Configurações, Cadastros base, Pessoas
      </nav>
      {voltar}
      <Ficha
        tituloDePagina
        titulo={pessoa.nome_completo}
        etiquetas={
          <>
            <EtiquetaDaSituacao situacao={pessoa.situacao} />
            <EtiquetaLivre>{ROTULOS_TIPO[pessoa.tipo]}</EtiquetaLivre>
            {pessoa.eh_socia && <EtiquetaLivre>Sócia</EtiquetaLivre>}
          </>
        }
        arquivado={
          arquivada
            ? {
                texto: 'Esta pessoa está arquivada: não aparece nas listas nem nos seletores.',
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
                  <UserMinus aria-hidden />
                  Inativar
                </Button>
              ) : (
                <Button variante="secundario" onClick={reativar}>
                  <UserCheck aria-hidden />
                  Reativar
                </Button>
              )}
              <Button variante="terciario" onClick={() => setConfirmando('arquivar')}>
                <Archive aria-hidden />
                Arquivar
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
                    {ativa ? linhaDoMenu(fechar, <UserMinus aria-hidden />, 'Inativar', () => setConfirmando('inativar')) : linhaDoMenu(fechar, <UserCheck aria-hidden />, 'Reativar', () => void reativar())}
                    {linhaDoMenu(fechar, <Archive aria-hidden />, 'Arquivar', () => setConfirmando('arquivar'))}
                  </div>
                )}
              </MenuSobreposto>
            </>
          )
        }
        abas={[
          { id: 'resumo', rotulo: 'Resumo', conteudo: <Resumo pessoa={pessoa} areas={areas} /> },
          { id: 'historico', rotulo: 'Histórico', conteudo: <AbaHistorico id={pessoa.id} /> },
        ]}
      />

      <FormularioPessoa aberto={editando} aoFechar={() => setEditando(false)} pessoa={pessoa} dados={dados} />

      <Confirmacao
        aberto={confirmando === 'inativar'}
        aoFechar={() => setConfirmando(null)}
        titulo={`Inativar ${pessoa.nome_completo}?`}
        texto={
          <>
            <p>Ela deixa de aparecer nos seletores de novos registros, mas continua nos registros antigos.</p>
            {temVinculos && (
              <>
                <p className="mt-3 font-semibold text-ink">Hoje ela é:</p>
                <ul className="mt-1.5 grid gap-1">
                  {vinculos.map((vinculo) => (
                    <li key={vinculo}>{vinculo}</li>
                  ))}
                </ul>
                <p className="mt-3">As telas vão avisar e pedir outra pessoa onde ela for responsável.</p>
              </>
            )}
          </>
        }
        rotuloConfirmar="Inativar pessoa"
        aoConfirmar={() => void executar(() => inativarPessoa(pessoa.id), 'Pessoa inativada.')}
      />

      {temVinculos ? (
        <Confirmacao
          aberto={confirmando === 'arquivar'}
          aoFechar={() => setConfirmando(null)}
          titulo={`Não dá para arquivar ${pessoa.nome_completo}`}
          texto={
            <>
              <p>Esta pessoa tem vínculos:</p>
              <ul className="mt-1.5 grid gap-1">
                {vinculos.map((vinculo) => (
                  <li key={vinculo}>{vinculo}</li>
                ))}
              </ul>
              <p className="mt-3">Se ela saiu, inative: o histórico e os registros antigos continuam com o nome dela.</p>
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
          titulo={`Arquivar ${pessoa.nome_completo}?`}
          texto="Ela sai das listas e dos seletores. Dá para restaurar quando precisar, em Arquivados."
          rotuloConfirmar="Arquivar pessoa"
          perigo
          aoConfirmar={() => void executar(() => arquivarPessoa(pessoa.id), 'Pessoa arquivada.')}
        />
      )}
    </>
  );
}
