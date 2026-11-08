'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Archive, ArchiveRestore, CalendarDays, ExternalLink, Gavel, ListTodo, Pencil, Plus } from 'lucide-react';
import { Campo } from '@/componentes/campos/campo';
import { AbaArquivosDoRegistro } from '@/componentes/empresa/aba-arquivos';
import { AvisoDeFaseDaEmpresa, VoltarPara } from '@/componentes/empresa/aparencia';
import { FormularioDaDecisao, FormularioDaReuniao, JanelaDaAcao } from '@/componentes/empresa/formularios-reuniao';
import { MenuDeAcoes } from '@/componentes/empresa/menu-de-acoes';
import { useCentral } from '@/componentes/layout/central-provider';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { EstadoCarregando, EstadoErro, EstadoVazio } from '@/componentes/padroes/estados';
import { EtiquetaSituacao, type TipoSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { Ficha } from '@/componentes/padroes/ficha';
import { ListaHistorico } from '@/componentes/padroes/historico';
import { Avatar } from '@/componentes/padroes/pessoa';
import { CartaoDaFicha } from '@/componentes/produtos/aparencia';
import { Button } from '@/componentes/ui/button';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import type { Atividade } from '@/dados/tipos/atividade';
import type { Reuniao } from '@/dados/tipos/sociedade';
import { useConsulta } from '@/dados/use-consulta';
import { CAMINHO_DA_ATIVIDADE, concluirAtividade, desfazerConclusao, estaAberta, ROTULOS_SITUACAO_ATIVIDADE, textoDoPrazo } from '@/dominio/atividades';
import { historicoDaReuniao } from '@/dominio/historico';
import { acoesDaReuniao, arquivarReuniao, carregarReunioes, nomeDoContexto, nomesDosDecisores, restaurarReuniao, salvarNotasDaReuniao, type DadosDasReunioes } from '@/dominio/reunioes';
import { nomeDaPessoa } from '@/dominio/sociedade';
import { diaEHoraNoFuso, hojeISO } from '@/lib/datas';
import { formatarDiaISO } from '@/lib/formatacao';
import { SituacaoDaDecisao } from '../../decisoes/situacao-da-decisao';

const TIPOS_DA_ACAO: Readonly<Record<Atividade['situacao'], TipoSituacao>> = { a_fazer: 'neutro', em_andamento: 'info', aguardando: 'atencao', concluida: 'sucesso', cancelada: 'neutro' };

function AbaDaReuniao({ reuniao, somenteLeitura }: { reuniao: Reuniao; somenteLeitura: boolean }) {
  const [notas, setNotas] = useState(reuniao.notas ?? '');
  const alterado = notas.trim() !== (reuniao.notas ?? '');
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <CartaoDaFicha titulo="Pauta">
        {reuniao.pauta.length ? (
          <ul className="grid list-disc gap-1 pl-5 text-sm">
            {reuniao.pauta.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-soft">Sem pauta registrada.</p>
        )}
      </CartaoDaFicha>
      <CartaoDaFicha titulo="Notas">
        <Campo id="reuniao-notas-rapidas" rotulo="Notas da reunião">
          {(controle) => <Textarea {...controle} rows={4} disabled={somenteLeitura} value={notas} onChange={(evento) => setNotas(evento.target.value)} />}
        </Campo>
        {alterado && !somenteLeitura && (
          <Button
            variante="secundario"
            tamanho="pequeno"
            className="mt-2"
            onClick={() =>
              void salvarNotasDaReuniao(reuniao.id, notas).then(
                () => aviso('Notas salvas.'),
                (erro: unknown) => aviso(mensagemDoErro(erro)),
              )
            }
          >
            Salvar notas
          </Button>
        )}
      </CartaoDaFicha>
    </div>
  );
}

function AbaDasDecisoes({ reuniao, dados, somenteLeitura }: { reuniao: Reuniao; dados: DadosDasReunioes; somenteLeitura: boolean }) {
  const [nova, setNova] = useState(false);
  const decisoes = dados.decisoes.filter((decisao) => decisao.reuniao_id === reuniao.id);
  return (
    <div className="grid gap-3">
      {decisoes.length ? (
        <ul className="grid gap-2">
          {decisoes.map((decisao) => (
            <li key={decisao.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-paper p-3.5 text-[13px]">
              <span className="min-w-0">
                <LinkCentral href={`/empresa/decisoes/${decisao.id}`} className="inline-flex min-h-11 items-center font-semibold underline-offset-2 hover:underline md:min-h-0">
                  {decisao.codigo} · {decisao.titulo}
                </LinkCentral>
                <span className="block text-ink-soft">
                  {formatarDiaISO(decisao.data)} · {nomesDosDecisores(decisao.id, dados).join(' e ')}
                </span>
              </span>
              <SituacaoDaDecisao situacao={decisao.situacao} />
            </li>
          ))}
        </ul>
      ) : (
        <EstadoVazio icone={Gavel} titulo="Nenhuma decisão registrada." texto="Registre as decisões tomadas nesta reunião." />
      )}
      {!somenteLeitura && (
        <Button className="justify-self-start" onClick={() => setNova(true)}>
          <Plus aria-hidden />
          Adicionar decisão
        </Button>
      )}
      {nova && <FormularioDaDecisao dados={dados} reuniaoId={reuniao.id} aoFechar={() => setNova(false)} />}
    </div>
  );
}

function AbaDasAcoes({ reuniao, dados, somenteLeitura }: { reuniao: Reuniao; dados: DadosDasReunioes; somenteLeitura: boolean }) {
  const { pessoa } = useCentral();
  const [nova, setNova] = useState(false);
  const consulta = useConsulta(() => acoesDaReuniao(reuniao.id), [reuniao.id]);
  const hoje = hojeISO();

  async function concluir(acao: Atividade) {
    try {
      const anterior = await concluirAtividade(acao.id, pessoa.id);
      aviso('Atividade concluída.', { acao: { rotulo: 'Desfazer', aoClicar: () => void desfazerConclusao(acao.id, anterior) } });
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    }
  }

  if (consulta.estado === 'carregando') return <EstadoCarregando linhas={2} />;
  if (consulta.estado === 'erro') return <EstadoErro titulo="Não deu para ler as ações." aoTentarDeNovo={consulta.recarregar} />;
  return (
    <div className="grid gap-3">
      {consulta.dados.length ? (
        <ul className="grid gap-2">
          {consulta.dados.map((acao) => {
            const prazo = textoDoPrazo(acao, hoje);
            const nome = nomeDaPessoa(dados.pessoas, acao.responsavel_id);
            return (
              <li key={acao.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-paper p-3.5 text-[13px]">
                <label className="flex min-h-11 min-w-[200px] flex-1 cursor-pointer items-center gap-2.5 md:min-h-0">
                  <input type="checkbox" aria-label={`Concluir ${acao.titulo}`} className="size-[18px] shrink-0 accent-[var(--ok)]" checked={!estaAberta(acao)} disabled={!estaAberta(acao)} onChange={() => void concluir(acao)} />
                  <span className="min-w-0 font-medium break-words">{acao.titulo}</span>
                </label>
                <span className="inline-flex items-center gap-1.5">
                  <Avatar nome={nome} className="size-7 text-[12px]" />
                  {nome}
                </span>
                <span className={prazo.atrasada ? 'font-semibold text-err' : 'text-ink-soft'}>{prazo.texto}</span>
                <EtiquetaSituacao tipo={TIPOS_DA_ACAO[acao.situacao]}>{ROTULOS_SITUACAO_ATIVIDADE[acao.situacao]}</EtiquetaSituacao>
                <LinkCentral href={CAMINHO_DA_ATIVIDADE(acao.id)} className="inline-flex min-h-11 items-center gap-1 underline underline-offset-2 md:min-h-0 [&_svg]:size-3.5">
                  <ExternalLink aria-hidden />
                  Abrir no Meu dia
                </LinkCentral>
              </li>
            );
          })}
        </ul>
      ) : (
        <EstadoVazio icone={ListTodo} titulo="Nenhuma ação registrada." texto="Cada ação vira uma atividade no Meu dia, com o vínculo desta reunião." />
      )}
      {!somenteLeitura && (
        <Button variante="secundario" className="justify-self-start" onClick={() => setNova(true)}>
          <Plus aria-hidden />
          Adicionar ação
        </Button>
      )}
      <Faixa tipo="info">As ações compartilham a mesma atividade com o Meu dia: concluir em qualquer lugar vale para os dois.</Faixa>
      {nova && <JanelaDaAcao dados={dados} reuniaoId={reuniao.id} aoFechar={() => setNova(false)} />}
    </div>
  );
}

function HistoricoDaReuniao({ id }: { id: string }) {
  const consulta = useConsulta(() => historicoDaReuniao(id), [id]);
  return (
    <div className="rounded-lg border border-line bg-paper p-4 md:p-5">
      <ListaHistorico consulta={consulta} comFiltros />
    </div>
  );
}

/** T06.09: a reunião, com pauta, notas, decisões, ações, arquivos e histórico. */
export function FichaDaReuniao() {
  const { id } = useParams<{ id: string }>();
  const consulta = useConsulta(carregarReunioes);
  const [editando, setEditando] = useState(false);
  const voltar = <VoltarPara href="/empresa/reunioes" rotulo="Reuniões" />;

  if (consulta.estado === 'carregando') return <EstadoCarregando />;
  if (consulta.estado === 'erro') {
    return (
      <>
        {voltar}
        <EstadoErro titulo="Não deu para ler esta reunião." aoTentarDeNovo={consulta.recarregar} />
      </>
    );
  }
  const dados = consulta.dados;
  const reuniao = dados.reunioes.find((item) => item.id === id);
  if (!reuniao) {
    return (
      <>
        {voltar}
        <EstadoVazio icone={CalendarDays} titulo="Essa reunião não existe mais." texto="Ela pode ter sido removida ao importar um arquivo." />
      </>
    );
  }
  const arquivada = Boolean(reuniao.arquivado_em);
  const { dia, hora } = diaEHoraNoFuso(reuniao.data_hora);
  const participantes = dados.participantes.filter((linha) => linha.reuniao_id === reuniao.id).map((linha) => nomeDaPessoa(dados.pessoas, linha.pessoa_id));
  const contexto = nomeDoContexto(reuniao.produto_id, dados.produtos);
  const decisoes = dados.decisoes.filter((decisao) => decisao.reuniao_id === reuniao.id).length;
  const acoes = arquivada ? null : (
    <>
      <Button variante="secundario" onClick={() => setEditando(true)}>
        <Pencil aria-hidden />
        Editar
      </Button>
      <MenuDeAcoes
        rotulo="Mais ações da reunião"
        acoes={[
          {
            rotulo: 'Arquivar',
            icone: Archive,
            aoClicar: () =>
              void arquivarReuniao(reuniao.id).then(
                () => aviso('Reunião arquivada.'),
                (erro: unknown) => aviso(mensagemDoErro(erro)),
              ),
          },
        ]}
      />
    </>
  );

  return (
    <div className="space-y-4">
      {voltar}
      <AvisoDeFaseDaEmpresa />
      <Ficha
        tituloDePagina
        codigo={reuniao.codigo}
        titulo={reuniao.titulo}
        responsavel={`${formatarDiaISO(dia)} · ${hora} · Participantes: ${participantes.join(', ') || 'nenhum'} · Contexto: ${contexto}`}
        acoes={acoes}
        acoesCelular={acoes}
        {...(arquivada
          ? {
              arquivado: {
                texto: 'Esta reunião está arquivada.',
                acao: (
                  <Button
                    variante="secundario"
                    tamanho="pequeno"
                    onClick={() =>
                      void restaurarReuniao(reuniao.id).then(
                        () => aviso('Reunião restaurada.'),
                        (erro: unknown) => aviso(mensagemDoErro(erro)),
                      )
                    }
                  >
                    <ArchiveRestore aria-hidden />
                    Restaurar
                  </Button>
                ),
              },
            }
          : {})}
        abas={[
          { id: 'reuniao', rotulo: 'Reunião', conteudo: <AbaDaReuniao key={reuniao.versao_registro} reuniao={reuniao} somenteLeitura={arquivada} /> },
          { id: 'decisoes', rotulo: `Decisões (${decisoes})`, conteudo: <AbaDasDecisoes reuniao={reuniao} dados={dados} somenteLeitura={arquivada} /> },
          { id: 'acoes', rotulo: 'Ações', conteudo: <AbaDasAcoes reuniao={reuniao} dados={dados} somenteLeitura={arquivada} /> },
          { id: 'arquivos', rotulo: 'Arquivos', conteudo: <AbaArquivosDoRegistro tipo="reuniao" id={reuniao.id} somenteLeitura={arquivada} /> },
          { id: 'historico', rotulo: 'Histórico', conteudo: <HistoricoDaReuniao id={reuniao.id} /> },
        ]}
      />
      {editando && <FormularioDaReuniao dados={dados} reuniao={reuniao} aoFechar={() => setEditando(false)} />}
    </div>
  );
}
