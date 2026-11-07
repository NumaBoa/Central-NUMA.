'use client';

import { CampoEtiquetas } from '@/componentes/campos/etiquetas';
import { CampoParticipantes } from '@/componentes/campos/campo-participantes';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { SelecaoPessoa } from '@/componentes/campos/selecao-pessoa';
import { SeletorContextos } from '@/componentes/campos/seletor-contextos';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, Check, Ellipsis, ExternalLink, Info, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { CampoRepeticao, type ErrosDaRepeticao } from '@/componentes/atividades/campo-repeticao';
import { useAvisoDeCredencial } from '@/componentes/campos/aviso-credencial';
import { Campo, MensagemErro } from '@/componentes/campos/campo';
import { EntradaLinkDrive } from '@/componentes/campos/link-drive';
import { Selecao } from '@/componentes/campos/selecao';
import { useCentral } from '@/componentes/layout/central-provider';
import { LinkCentral, useAlteracoesPendentes } from '@/componentes/layout/protecao-saida';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { EstadoCarregando, EstadoErro } from '@/componentes/padroes/estados';
import { EtiquetaSituacao } from '@/componentes/padroes/etiquetas';
import { Faixa } from '@/componentes/padroes/faixa';
import { ListaHistorico } from '@/componentes/padroes/historico';
import { CLASSE_LINHA_MENU, MenuSobreposto } from '@/componentes/padroes/menu-sobreposto';
import { Avatar } from '@/componentes/padroes/pessoa';
import { Button } from '@/componentes/ui/button';
import { BotaoFechar, Dialog, DialogContent, DialogDescription, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/componentes/ui/tabs';
import { Textarea } from '@/componentes/ui/textarea';
import { mensagemDoErro } from '@/dados/erros';
import type { Atividade } from '@/dados/tipos/atividade';
import { useConsulta } from '@/dados/use-consulta';
import { carregarFormularioAtividade } from '@/dominio/atividades-formulario';
import { acaoDoAlerta, estaAberta, MAXIMO_NO_TITULO, ROTULOS_ORIGEM_ALERTA, ROTULOS_PRIORIDADE_ATIVIDADE, ROTULOS_SITUACAO_ATIVIDADE, type AtividadeDoDia, type DadosMeuDia } from '@/dominio/atividades';
import {
  adicionarAnexo,
  adicionarItem,
  adicionarVinculo,
  CAMINHO_DA_ATIVIDADE,
  carregarPainel,
  comentar,
  converterAtividade,
  definirResponsavelDoItem,
  duplicarAtividade,
  editarComentario,
  marcarItem,
  podeEditarComentario,
  removerAnexo,
  removerComentario,
  removerItem,
  removerVinculo,
  type DadosDoPainel,
} from '@/dominio/atividades-painel';
import { errosDoRascunho, mudancasDoRascunho, rascunhoDoPainel, salvarRascunho, temMudancas, type ErrosDoRascunho, type RascunhoDaAtividade } from '@/dominio/atividades-rascunho';
import { historicoDaAtividade } from '@/dominio/historico';
import { pessoasDoSeletor } from '@/dominio/pessoa-atual';
import { repetirAtividade, type EscopoDaEdicao } from '@/dominio/recorrencias';
import { errosDaRepeticao, regraDoFormulario, regraPorExtenso, repeticaoPadrao, fimPorExtenso } from '@/dominio/repeticao';
import { AVISO_CREDENCIAL, pareceCredencial } from '@/dominio/segredos';
import { diaEHoraNoFuso, hojeISO, rotuloDoFuso } from '@/lib/datas';
import { formatarData, formatarDataHora, formatarDiaISO, formatarHora } from '@/lib/formatacao';
import { useEhCelular } from '@/lib/use-eh-celular';
import { cn } from '@/lib/utils';
import type { AcoesDaAtividade } from './acoes-atividade';
import { PrazoDaAtividade, TipoDaAtividade } from './cartao-atividade';

/** Salvar na hora, e dizer quando não deu. */
async function salvar(acao: () => Promise<unknown>): Promise<string | null> {
  try {
    await acao();
    return null;
  } catch (erro) {
    return mensagemDoErro(erro);
  }
}

/** Para as ações sem um campo onde mostrar a mensagem. */
function salvarComAviso(acao: () => Promise<unknown>) {
  void salvar(acao).then((falha) => {
    if (falha) aviso(falha);
  });
}

const Secao = ({ titulo, children }: { titulo: string; children: ReactNode }) => (
  <section>
    <h3 className="mb-3 font-body text-[13px] leading-[18px] font-semibold tracking-normal text-ink-soft">{titulo}</h3>
    {children}
  </section>
);

type Aba = 'geral' | 'checklist' | 'agendamento' | 'vinculos' | 'comentarios' | 'historico';

type Mudar = (parcial: Partial<RascunhoDaAtividade>) => void;

const ID_DO_CAMPO: Partial<Record<keyof RascunhoDaAtividade, string>> = {
  titulo: 'painel-titulo',
  responsavel_id: 'painel-responsavel',
  solicitante_texto: 'painel-solicitante-texto',
  inicio: 'painel-inicio',
  prazo: 'painel-prazo',
  aviso_dia: 'painel-aviso-dia',
  aviso_hora: 'painel-aviso-hora',
};

/** Onde está o campo com erro: no lembrete, o aviso é o essencial e fica em Geral. */
function abaDoCampo(campo: keyof RascunhoDaAtividade, tipo: Atividade['tipo']): Aba {
  if (campo === 'inicio') return 'agendamento';
  if ((campo === 'aviso_dia' || campo === 'aviso_hora') && tipo !== 'lembrete') return 'agendamento';
  return 'geral';
}

const LinhaDoMenu = ({ rotulo, aoClicar, fechar }: { rotulo: string; aoClicar: () => void; fechar: () => void }) => (
  <button
    type="button"
    className={cn(CLASSE_LINHA_MENU, 'hover:bg-hover md:min-h-9 md:py-1.5')}
    onClick={() => {
      fechar();
      aoClicar();
    }}
  >
    {rotulo}
  </button>
);

function MenuDaJanela({ atividade, doDia, acoes, aoAbrir }: { atividade: Atividade; doDia: AtividadeDoDia; acoes: AcoesDaAtividade; aoAbrir: (id: string) => void }) {
  const { pessoa } = useCentral();
  const aberta = estaAberta(atividade);
  const alerta = atividade.tipo === 'alerta';
  return (
    <MenuSobreposto
      titulo="Mais ações"
      largura={270}
      alinhar="end"
      gatilho={
        <Button variante="icone" tamanho="icone" aria-label="Mais ações da atividade">
          <Ellipsis aria-hidden />
        </Button>
      }
    >
      {(fechar) => (
        <div className="grid gap-0.5">
          {aberta && !atividade.bloqueada && <LinhaDoMenu rotulo="Marcar bloqueada" fechar={fechar} aoClicar={() => acoes.pedir('bloquear', doDia)} />}
          {aberta && <LinhaDoMenu rotulo="Adiar" fechar={fechar} aoClicar={() => acoes.pedir('adiar', doDia)} />}
          {!alerta && <LinhaDoMenu rotulo="Duplicar" fechar={fechar} aoClicar={() => void duplicarAtividade(atividade.id).then((nova) => { aviso('Atividade duplicada.'); aoAbrir(nova.id); }, (falha: unknown) => aviso(mensagemDoErro(falha)))} />}
          {aberta && atividade.tipo === 'tarefa' && <LinhaDoMenu rotulo="Converter em demanda" fechar={fechar} aoClicar={() => void converterAtividade(atividade.id, 'demanda', pessoa.id).then(() => aviso('Convertida em demanda.'))} />}
          {aberta && atividade.tipo === 'demanda' && <LinhaDoMenu rotulo="Converter em tarefa" fechar={fechar} aoClicar={() => void converterAtividade(atividade.id, 'tarefa', pessoa.id).then(() => aviso('Convertida em tarefa.'))} />}
          {aberta && !alerta && <LinhaDoMenu rotulo="Cancelar" fechar={fechar} aoClicar={() => acoes.pedir('cancelar', doDia)} />}
          <LinhaDoMenu rotulo="Copiar link" fechar={fechar} aoClicar={() => void navigator.clipboard?.writeText(`${window.location.origin}${CAMINHO_DA_ATIVIDADE(atividade.id)}`).then(() => aviso('Link copiado.'), () => aviso('Não deu para copiar o link.'))} />
        </div>
      )}
    </MenuSobreposto>
  );
}

/** O título, com o lápis para editar (T03.02). Alerta vem do sistema e não se edita. */
function TituloDaJanela({ atividade, valor, erro, aoMudar }: { atividade: Atividade; valor: string; erro?: string; aoMudar: (titulo: string) => void }) {
  const [editando, setEditando] = useState(false);
  const editavel = estaAberta(atividade) && atividade.tipo !== 'alerta';
  const mostrarCampo = editavel && (editando || Boolean(erro) || !valor.trim());
  const classe = 'font-display text-[22px] leading-7 font-semibold tracking-[-.02em] break-words md:text-[26px] md:leading-8 md:tracking-[-.025em]';
  if (!mostrarCampo) {
    return (
      <div className="flex items-start gap-1">
        <DialogTitle className={cn(classe, 'min-w-0')}>{valor}</DialogTitle>
        {editavel && (
          <Button variante="icone" tamanho="icone" aria-label="Editar o título" className="-mt-0.5 shrink-0 md:size-9" onClick={() => setEditando(true)}>
            <Pencil aria-hidden />
          </Button>
        )}
      </div>
    );
  }
  return (
    <div>
      <DialogTitle className="sr-only">{valor}</DialogTitle>
      <Campo id={ID_DO_CAMPO.titulo} rotulo="Título" obrigatorio erro={erro} ajuda={valor.length > MAXIMO_NO_TITULO - 20 ? `${valor.length} de ${MAXIMO_NO_TITULO} caracteres.` : undefined}>
        {(controle) => (
          <Input
            autoFocus
            autoComplete="off"
            {...controle}
            value={valor}
            onChange={(evento) => aoMudar(evento.target.value)}
            onFocus={() => setEditando(true)}
            onBlur={() => setEditando(false)}
            onKeyDown={(evento) => {
              if (evento.key === 'Enter') {
                evento.preventDefault();
                evento.currentTarget.blur();
              }
            }}
          />
        )}
      </Campo>
    </div>
  );
}

/** O alerta: de onde vem, o botão da ação e o que concluir ou dispensar não fazem (RN-03.12 e RN-03.13). */
function SecaoAlerta({ atividade, acoes, doDia }: { atividade: Atividade; acoes: AcoesDaAtividade; doDia: AtividadeDoDia }) {
  const acao = acaoDoAlerta(atividade);
  return (
    <div className="rounded-md bg-warn-wash p-3.5 text-[13px] leading-[20px] md:col-span-2" data-alerta>
      <p className="font-semibold">
        Origem: {ROTULOS_ORIGEM_ALERTA[atividade.origem_tipo ?? ''] ?? 'Sistema'}
        {atividade.alerta_motivo ? ` · ${atividade.alerta_motivo}` : ''}
        {atividade.alerta_data_referencia ? ` · Data de referência: ${formatarDiaISO(atividade.alerta_data_referencia)}` : ''}
      </p>
      <p className="text-ink-soft">Concluir aqui não executa a ação de origem. Dispensar pede um motivo e também não muda a origem.</p>
      {estaAberta(atividade) && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {acao && (
            <Button asChild tamanho="pequeno">
              <LinkCentral href={acao.href}>{acao.rotulo}</LinkCentral>
            </Button>
          )}
          <Button variante="secundario" tamanho="pequeno" onClick={() => acoes.pedir('dispensar', doDia)}>
            Dispensar alerta
          </Button>
        </div>
      )}
      {atividade.dispensada_motivo && <p className="mt-2">Dispensado: {atividade.dispensada_motivo}</p>}
    </div>
  );
}

/** O que a atividade está passando: bloqueio, aguardando, cancelada ou concluída. */
function SituacoesDaAtividade({ atividade, painel, dados, acoes, doDia }: { atividade: Atividade; painel: DadosDoPainel; dados: DadosMeuDia; acoes: AcoesDaAtividade; doDia: AtividadeDoDia }) {
  const nomeDe = (id: string | null) => dados.pessoas.find((pessoa) => pessoa.id === id)?.nome_completo;
  const aguardandoDe = atividade.aguardando_de_pessoa_id ? (nomeDe(atividade.aguardando_de_pessoa_id) ?? 'Pessoa removida') : atividade.aguardando_de_texto;
  const quemBloqueou = nomeDe(painel.quemBloqueou);
  return (
    <>
      {atividade.tipo === 'alerta' && <SecaoAlerta atividade={atividade} acoes={acoes} doDia={doDia} />}
      {atividade.bloqueada && estaAberta(atividade) && (
        <Faixa tipo="erro" className="md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 break-words">
              <span className="font-semibold">Bloqueada: {atividade.bloqueio_motivo}</span>
              {atividade.bloqueada_em ? ` · Desde ${formatarData(atividade.bloqueada_em)}` : ''}
              {quemBloqueou ? `, por ${quemBloqueou}` : ''}
            </p>
            <Button variante="secundario" tamanho="pequeno" onClick={() => acoes.desbloquear(doDia)}>
              Desbloquear
            </Button>
          </div>
        </Faixa>
      )}
      {atividade.situacao === 'aguardando' && (
        <p className="rounded-md bg-mist px-3.5 py-2.5 text-[13px] md:col-span-2">
          Aguardando de {aguardandoDe}
          {atividade.aguardando_desde ? `, desde ${formatarDiaISO(atividade.aguardando_desde)}` : ''}.
        </p>
      )}
      {atividade.situacao === 'cancelada' && atividade.cancelada_motivo && !atividade.dispensada_motivo && (
        <Faixa className="md:col-span-2">Cancelada: {atividade.cancelada_motivo}</Faixa>
      )}
      {atividade.concluida_em && (
        <p className="rounded-md bg-mist px-3.5 py-2.5 text-[13px] md:col-span-2">
          Concluída em {formatarDataHora(atividade.concluida_em)}
          {` por ${atividade.concluida_por ? (nomeDe(atividade.concluida_por) ?? 'Pessoa removida') : 'Sistema'}`}
          {atividade.conclusao_nota ? `. ${atividade.conclusao_nota}` : ''}
        </p>
      )}
    </>
  );
}

type AbaGeralProps = {
  atividade: Atividade;
  painel: DadosDoPainel;
  dados: DadosMeuDia;
  acoes: AcoesDaAtividade;
  doDia: AtividadeDoDia;
  rascunho: RascunhoDaAtividade;
  erros: ErrosDoRascunho;
  mudar: Mudar;
  aoMudarSituacao: (situacao: 'a_fazer' | 'em_andamento' | 'aguardando' | 'concluida') => void;
};

/** Geral (protótipo aprovado): o essencial em duas colunas, sem rolar. */
function AbaGeral({ atividade, painel, dados, acoes, doDia, rascunho, erros, mudar, aoMudarSituacao }: AbaGeralProps) {
  const aberta = estaAberta(atividade);
  const alerta = atividade.tipo === 'alerta';
  const lembrete = atividade.tipo === 'lembrete';
  const demanda = atividade.tipo === 'demanda';
  const internas = pessoasDoSeletor(dados.pessoas);
  const responsaveis = internas.some((item) => item.id === atividade.responsavel_id) ? internas : [...internas, ...dados.pessoas.filter((item) => item.id === atividade.responsavel_id)];
  const ativas = dados.pessoas.filter((pessoa) => !pessoa.arquivado_em && pessoa.situacao === 'ativa' && pessoa.id !== rascunho.responsavel_id);
  const solicitantes = dados.pessoas.filter((pessoa) => !pessoa.arquivado_em || pessoa.id === atividade.solicitante_pessoa_id);
  const produtos = dados.produtos.filter((produto) => !produto.arquivado_em && produto.situacao === 'ativo');
  const areas = dados.areas.filter((area) => !area.arquivado_em || area.id === atividade.area_id);

  return (
    <div className="grid gap-4 md:grid-cols-2 md:gap-x-7">
      <SituacoesDaAtividade atividade={atividade} painel={painel} dados={dados} acoes={acoes} doDia={doDia} />
      <div className="grid content-start gap-4">
        <Campo id="painel-descricao" rotulo="Descrição">
          {(controle) => <Textarea {...controle} disabled={!aberta} className="md:min-h-[76px]" value={rascunho.descricao} onChange={(evento) => mudar({ descricao: evento.target.value })} />}
        </Campo>
        {demanda && (
          <>
            <Campo id="painel-solicitante" rotulo="Solicitante" obrigatorio ajuda="Pessoa cadastrada ou nome informado.">
              {(controle) => (
                <SelecaoPessoa
                  {...controle}
                  pessoas={solicitantes}
                  disabled={!aberta}
                  value={rascunho.solicitante_pessoa_id}
                  onChange={(evento) => mudar({ solicitante_pessoa_id: evento.target.value })}
                  extra={<option value="">Outra: escrever o nome</option>}
                />
              )}
            </Campo>
            {!rascunho.solicitante_pessoa_id && (
              <Campo id={ID_DO_CAMPO.solicitante_texto} rotulo="Quem pediu" obrigatorio erro={erros.solicitante_texto}>
                {(controle) => <Input autoComplete="off" {...controle} disabled={!aberta} value={rascunho.solicitante_texto} onChange={(evento) => mudar({ solicitante_texto: evento.target.value })} />}
              </Campo>
            )}
          </>
        )}
        <Campo id={ID_DO_CAMPO.responsavel_id} rotulo="Responsável" obrigatorio erro={erros.responsavel_id}>
          {(controle) => <SelecaoPessoa {...controle} pessoas={responsaveis} disabled={!aberta} vazio="Escolha uma pessoa" value={rascunho.responsavel_id} onChange={(evento) => mudar({ responsavel_id: evento.target.value, participantes: rascunho.participantes.filter((id) => id !== evento.target.value) })} />}
        </Campo>
        <CampoParticipantes pessoas={ativas} todas={dados.pessoas} desativado={!aberta} valores={rascunho.participantes} aoMudar={(participantes) => mudar({ participantes })} />
      </div>
      <div className="grid content-start gap-4 md:border-l md:border-line md:pl-7">
        <div className="grid grid-cols-2 gap-3">
          <Campo id="painel-situacao" rotulo="Situação" obrigatorio>
            {(controle) =>
              atividade.situacao === 'cancelada' ? (
                <EtiquetaSituacao tipo="neutro">{ROTULOS_SITUACAO_ATIVIDADE.cancelada}</EtiquetaSituacao>
              ) : (
                <Selecao {...controle} value={atividade.situacao} onChange={(evento) => aoMudarSituacao(evento.target.value as 'a_fazer')}>
                  {(['a_fazer', 'em_andamento', 'aguardando', 'concluida'] as const).map((situacao) => (
                    <option key={situacao} value={situacao}>
                      {ROTULOS_SITUACAO_ATIVIDADE[situacao]}
                    </option>
                  ))}
                </Selecao>
              )
            }
          </Campo>
          <Campo id="painel-prioridade" rotulo="Prioridade">
            {(controle) => (
              <Selecao {...controle} disabled={!aberta} value={rascunho.prioridade} onChange={(evento) => mudar({ prioridade: evento.target.value as Atividade['prioridade'] })}>
                {Object.entries(ROTULOS_PRIORIDADE_ATIVIDADE).map(([valor, rotulo]) => (
                  <option key={valor} value={valor}>
                    {rotulo}
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo id="painel-area" rotulo="Área">
            {(controle) => (
              <Selecao {...controle} disabled={!aberta} value={rascunho.area_id} onChange={(evento) => mudar({ area_id: evento.target.value })}>
                <option value="">Nenhuma</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.nome}
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>
          <Campo id="painel-contexto" rotulo="Contexto">
            {(controle) => <SeletorContextos curto id={controle.id} desativado={!aberta} valores={rascunho.produtos} aoMudar={(novos) => mudar({ produtos: novos })} produtos={produtos} todosOsProdutos={dados.produtos} marcas={dados.marcas} />}
          </Campo>
        </div>
        {lembrete && (
          <div>
            <div className="grid grid-cols-[1.45fr_1fr] gap-3">
              <Campo id={ID_DO_CAMPO.aviso_dia} rotulo="Data do aviso" obrigatorio erro={erros.aviso_dia}>
                {(controle) => <EntradaData {...controle} disabled={!aberta} value={rascunho.aviso_dia} onChange={(evento) => mudar({ aviso_dia: evento.target.value })} />}
              </Campo>
              <Campo id={ID_DO_CAMPO.aviso_hora} rotulo="Hora do aviso" obrigatorio erro={erros.aviso_hora}>
                {(controle) => <Input type="time" {...controle} disabled={!aberta} value={rascunho.aviso_hora} onChange={(evento) => mudar({ aviso_hora: evento.target.value })} />}
              </Campo>
            </div>
            <p className="mt-1.5 text-xs text-ink-soft">{rotuloDoFuso()}. Lembrete não tem prazo separado.</p>
          </div>
        )}
        {!lembrete && !alerta && (
          <div>
            <div className="grid grid-cols-[1.45fr_1fr] gap-3">
              <Campo id={ID_DO_CAMPO.prazo} rotulo="Prazo" erro={erros.prazo}>
                {(controle) => <EntradaData {...controle} disabled={!aberta} value={rascunho.prazo} onChange={(evento) => mudar({ prazo: evento.target.value, ...(evento.target.value ? {} : { prazo_hora: '' }) })} />}
              </Campo>
              <Campo id="painel-prazo-hora" rotulo="Hora (opcional)">
                {(controle) => <Input type="time" {...controle} disabled={!aberta || !rascunho.prazo} value={rascunho.prazo_hora} onChange={(evento) => mudar({ prazo_hora: evento.target.value })} />}
              </Campo>
            </div>
            <p className="mt-1.5 text-xs text-ink-soft">{atividade.recorrencia_id && aberta ? 'A data muda só nesta ocorrência. Para mudar as próximas, edite a rotina.' : `Opcional para ${demanda ? 'demandas' : 'tarefas'}. Sem data, fica sem prazo.`}</p>
          </div>
        )}
        {alerta && atividade.prazo && <p className="text-[13px]">Prazo: {formatarDiaISO(atividade.prazo)}</p>}
        {demanda && (
          <Campo id="painel-resultado" rotulo="Resultado esperado">
            {(controle) => <Textarea {...controle} disabled={!aberta} className="md:min-h-[76px]" value={rascunho.resultado_esperado} onChange={(evento) => mudar({ resultado_esperado: evento.target.value })} />}
          </Campo>
        )}
        {atividade.situacao === 'aguardando' && (
          <Campo id="painel-acompanhamento" rotulo="Acompanhar em" ajuda="Nesse dia, a atividade aparece em Para hoje.">
            {(controle) => <EntradaData {...controle} value={rascunho.acompanhamento_em} onChange={(evento) => mudar({ acompanhamento_em: evento.target.value })} />}
          </Campo>
        )}
        <CampoEtiquetas etiquetas={dados.etiquetas} modulo="atividades" desativado={!aberta} valores={rascunho.etiquetas} aoMudar={(etiquetas) => mudar({ etiquetas })} />
      </div>
      {!alerta && (
        <p className="flex items-center gap-2 rounded-md bg-mist px-3.5 py-2.5 text-[13px] text-ink-soft md:col-span-2 [&_svg]:size-4 [&_svg]:shrink-0">
          <Info aria-hidden />
          {lembrete ? 'A repetição fica em Agendamento.' : 'Início, lembrete e repetição ficam em Agendamento.'}
        </p>
      )}
    </div>
  );
}

/** Agendamento: o que completa as datas. A repetição vale na hora, porque vira uma rotina. */
function AbaAgendamento({ atividade, painel, rascunho, erros, mudar }: Pick<AbaGeralProps, 'atividade' | 'painel' | 'rascunho' | 'erros' | 'mudar'>) {
  const aberta = estaAberta(atividade);
  const lembrete = atividade.tipo === 'lembrete';
  return (
    <div className="grid gap-4 md:grid-cols-2 md:gap-x-7">
      {!lembrete && (
        <div className="grid content-start gap-4">
          <Campo id={ID_DO_CAMPO.inicio} rotulo="Início" erro={erros.inicio}>
            {(controle) => <EntradaData {...controle} disabled={!aberta} value={rascunho.inicio} onChange={(evento) => mudar({ inicio: evento.target.value })} />}
          </Campo>
          <div>
            <div className="grid grid-cols-[1.45fr_1fr] gap-3">
              <Campo id={ID_DO_CAMPO.aviso_dia} rotulo="Avisar no dia" erro={erros.aviso_dia}>
                {(controle) => <EntradaData {...controle} disabled={!aberta} value={rascunho.aviso_dia} onChange={(evento) => mudar({ aviso_dia: evento.target.value })} />}
              </Campo>
              <Campo id={ID_DO_CAMPO.aviso_hora} rotulo="Às" erro={erros.aviso_hora}>
                {(controle) => <Input type="time" {...controle} disabled={!aberta} value={rascunho.aviso_hora} onChange={(evento) => mudar({ aviso_hora: evento.target.value })} />}
              </Campo>
            </div>
            <p className="mt-1.5 text-xs text-ink-soft">O aviso aparece no sino, antes do prazo.</p>
          </div>
        </div>
      )}
      <div className={cn('content-start', !lembrete && 'md:border-l md:border-line md:pl-7')}>
        <RepeticaoDaAtividade atividade={atividade} painel={painel} />
      </div>
    </div>
  );
}

/** "Recorrência (resumo + editar)" (T03.02). Quem não repete pode passar a repetir. */
function RepeticaoDaAtividade({ atividade, painel }: { atividade: Atividade; painel: DadosDoPainel }) {
  const [repetindo, setRepetindo] = useState(false);
  const { rotina } = painel;
  const aberta = estaAberta(atividade);
  const fim = rotina ? fimPorExtenso(rotina) : null;
  return (
    <div>
      <p className="mb-[7px] texto-rotulo">Repetição</p>
      {rotina ? (
        <div className="grid gap-1 text-[13px]" data-repeticao>
          <p className="flex flex-wrap items-center gap-x-2">
            <span>
              {regraPorExtenso(rotina)}
              {fim ? `, ${fim}` : ''}
              {atividade.ocorrencia_numero ? ` · Ocorrência ${atividade.ocorrencia_numero}` : ''}
            </span>
            <LinkCentral href={`/meu-dia/rotinas?rotina=${rotina.id}`} className="inline-flex min-h-11 items-center font-semibold text-indigo-dk underline-offset-2 hover:underline md:min-h-0">
              Ver rotina
            </LinkCentral>
          </p>
        </div>
      ) : (
        <p className="flex flex-wrap items-center gap-x-2 text-[13px]">
          <span className="text-ink-soft">Não repete.</span>
          {aberta && (
            <Button variante="terciario" tamanho="pequeno" onClick={() => setRepetindo(true)}>
              Repetir
            </Button>
          )}
        </p>
      )}
      {repetindo && <DialogoDeRepetir atividade={atividade} aoFechar={() => setRepetindo(false)} />}
    </div>
  );
}

function DialogoDeRepetir({ atividade, aoFechar }: { atividade: Atividade; aoFechar: () => void }) {
  const hoje = hojeISO();
  const lembrete = atividade.tipo === 'lembrete';
  const aviso_ = atividade.aviso_em ? diaEHoraNoFuso(atividade.aviso_em) : null;
  const dia = atividade.prazo ?? aviso_?.dia ?? hoje;
  const [valor, setValor] = useState(() => ({ ...repeticaoPadrao(dia > hoje ? dia : hoje), hora: atividade.prazo_hora ?? aviso_?.hora ?? '' }));
  const [erros, setErros] = useState<ErrosDaRepeticao>({});
  const [falha, setFalha] = useState<string | null>(null);

  async function confirmar() {
    const encontrados = errosDaRepeticao(valor, { lembrete, minimoInicio: hoje });
    setErros(encontrados);
    if (Object.keys(encontrados).length) return;
    try {
      await repetirAtividade(atividade.id, regraDoFormulario(valor));
      aviso('Agora esta atividade faz parte de uma rotina.');
      aoFechar();
    } catch (erro) {
      setFalha(mensagemDoErro(erro));
    }
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent semFechar comDescricao>
        <DialogTitle>Repetir esta atividade</DialogTitle>
        <DialogDescription className="mt-2">Ela vira a primeira ocorrência, na primeira data da regra. As próximas nascem no Meu dia, até 30 dias à frente.</DialogDescription>
        <div className="mt-4">
          <CampoRepeticao id="painel-repeticao" valor={valor} aoMudar={setValor} erros={erros} lembrete={lembrete} hoje={hoje} />
        </div>
        {falha && <MensagemErro>{falha}</MensagemErro>}
        <div className="acoes-dialogo">
          <Button variante="secundario" onClick={aoFechar}>
            Voltar
          </Button>
          <Button onClick={() => void confirmar()}>Repetir</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SecaoChecklist({ atividade, painel, dados }: { atividade: Atividade; painel: DadosDoPainel; dados: DadosMeuDia }) {
  const { pessoa } = useCentral();
  const [novo, setNovo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const aberta = estaAberta(atividade);
  const internas = pessoasDoSeletor(dados.pessoas);

  async function adicionar() {
    const falha = await salvar(() => adicionarItem(atividade.id, novo));
    setErro(falha);
    if (!falha) setNovo('');
  }

  const feitos = painel.itens.filter((item) => item.feito).length;
  return (
    <Secao titulo={painel.itens.length ? `Checklist (${feitos} de ${painel.itens.length})` : 'Checklist'}>
      <ul className="grid gap-1">
        {painel.itens.map((item) => {
          const quem = dados.pessoas.find((itemPessoa) => itemPessoa.id === item.feito_por)?.nome_completo;
          const responsavel = dados.pessoas.find((itemPessoa) => itemPessoa.id === item.responsavel_id)?.nome_completo;
          return (
            <li key={item.id} className="flex flex-wrap items-start gap-x-2 gap-y-1 rounded-sm py-1 md:flex-nowrap">
              <label className={cn('flex min-h-11 w-full min-w-0 items-start gap-2.5 py-1 md:min-h-0 md:w-auto md:flex-1', aberta && 'cursor-pointer')}>
                <input type="checkbox" className="mt-0.5 size-[18px] shrink-0 accent-[var(--ok)]" disabled={!aberta} checked={item.feito} aria-label={item.texto} onChange={(evento) => salvarComAviso(() => marcarItem(item.id, evento.target.checked, pessoa.id))} />
                <span className="min-w-0 text-[13px] leading-[20px] break-words">
                  <span className={item.feito ? 'text-ink-soft line-through' : undefined}>{item.texto}</span>
                  {item.feito && quem && item.feito_em && <span className="block text-xs text-ink-soft">Feito por {quem} em {formatarData(item.feito_em)}</span>}
                  {!aberta && responsavel && <span className="block text-xs text-ink-soft">Responsável: {responsavel}</span>}
                </span>
              </label>
              {aberta && (
                <>
                  <span className="ml-7 min-w-0 flex-1 md:ml-0 md:w-32 md:flex-none">
                    <Selecao aria-label={`Responsável por ${item.texto}`} value={item.responsavel_id ?? ''} onChange={(evento) => salvarComAviso(() => definirResponsavelDoItem(item.id, evento.target.value))} className="min-h-9 text-[13px] max-md:min-h-11 max-md:text-base">
                      <option value="">Ninguém</option>
                      {internas.map((itemPessoa) => (
                        <option key={itemPessoa.id} value={itemPessoa.id}>
                          {itemPessoa.nome_completo}
                        </option>
                      ))}
                    </Selecao>
                  </span>
                  <Button variante="icone" tamanho="icone" aria-label={`Tirar ${item.texto}`} onClick={() => salvarComAviso(() => removerItem(item.id))}>
                    <Trash2 aria-hidden />
                  </Button>
                </>
              )}
            </li>
          );
        })}
      </ul>
      {aberta && (
        <div className="mt-2">
          <div className="flex items-center gap-2">
            <Input
              id="painel-novo-item"
              aria-label="Novo item"
              placeholder="Novo item"
              autoComplete="off"
              value={novo}
              onChange={(evento) => setNovo(evento.target.value)}
              onKeyDown={(evento) => {
                if (evento.key === 'Enter') {
                  evento.preventDefault();
                  void adicionar();
                }
              }}
              className="min-w-0 flex-1"
            />
            <Button variante="secundario" onClick={() => void adicionar()}>
              <Plus aria-hidden />
              Adicionar
            </Button>
          </div>
          {erro && <MensagemErro>{erro}</MensagemErro>}
        </div>
      )}
    </Secao>
  );
}

function SecaoVinculos({ atividade, painel, dados }: { atividade: Atividade; painel: DadosDoPainel; dados: DadosMeuDia }) {
  const [erro, setErro] = useState<string | null>(null);
  const consulta = useConsulta(carregarFormularioAtividade);
  const aberta = estaAberta(atividade);
  const contrapartes = consulta.dados?.contrapartes ?? [];

  async function escolher(valor: string) {
    const [tipo, id] = valor.split(':');
    if (tipo && id) setErro(await salvar(() => adicionarVinculo(atividade.id, tipo, id)));
  }

  return (
    <Secao titulo="Vínculos">
      {painel.vinculos.length > 0 && (
        <ul className="mb-2 grid gap-1">
          {painel.vinculos.map((vinculo) => (
            <li key={vinculo.id} className="flex items-center justify-between gap-2 text-[13px]">
              <span className="min-w-0 break-words">
                <span className="text-ink-soft">{vinculo.rotulo}: </span>
                {vinculo.href ? (
                  <LinkCentral href={vinculo.href} className="inline-flex min-h-11 items-center underline underline-offset-2 md:min-h-0">
                    {vinculo.nome}
                  </LinkCentral>
                ) : (
                  vinculo.nome
                )}
              </span>
              {aberta && (
                <Button variante="icone" tamanho="icone" aria-label={`Tirar o vínculo com ${vinculo.nome}`} onClick={() => salvarComAviso(() => removerVinculo(vinculo.id))}>
                  <Trash2 aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {aberta && (
        <Campo id="painel-vinculo" rotulo="Vincular a" erro={erro ?? undefined}>
          {(controle) => (
            <Selecao {...controle} value="" onChange={(evento) => void escolher(evento.target.value)}>
              <option value="">Escolha um registro</option>
              <optgroup label="Contrapartes">
                {contrapartes.map((contraparte) => (
                  <option key={contraparte.id} value={`contraparte:${contraparte.id}`}>
                    {contraparte.nome_fantasia || contraparte.nome}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Produtos">
                {dados.produtos
                  .filter((produto) => !produto.arquivado_em)
                  .map((produto) => (
                    <option key={produto.id} value={`produto:${produto.id}`}>
                      {produto.nome}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Ferramentas">
                {(consulta.dados?.ferramentas ?? []).map((ferramenta) => (
                  <option key={ferramenta.id} value={`ferramenta:${ferramenta.id}`}>
                    {ferramenta.nome}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Lançamentos">
                {(consulta.dados?.titulos ?? []).map((titulo) => (
                  <option key={titulo.id} value={`titulo:${titulo.id}`}>
                    {titulo.codigo} · {titulo.descricao}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Ativos digitais">
                {(consulta.dados?.ativos ?? []).map((ativo) => (
                  <option key={ativo.id} value={`ativo_digital:${ativo.id}`}>
                    {ativo.identificador}
                  </option>
                ))}
              </optgroup>
            </Selecao>
          )}
        </Campo>
      )}
    </Secao>
  );
}

function SecaoArquivos({ atividade, painel }: { atividade: Atividade; painel: DadosDoPainel }) {
  const [link, setLink] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const aberta = estaAberta(atividade);

  async function adicionar() {
    const falha = await salvar(() => adicionarAnexo(atividade.id, link, ''));
    setErro(falha);
    if (!falha) setLink('');
  }

  return (
    <Secao titulo="Arquivos">
      {painel.anexos.length > 0 && (
        <ul className="mb-2 grid gap-1">
          {painel.anexos.map((anexo) => (
            <li key={anexo.id} className="flex items-center justify-between gap-2 text-[13px]">
              <a href={anexo.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 min-w-0 items-center gap-1.5 underline underline-offset-2 md:min-h-0 [&_svg]:size-[14px] [&_svg]:shrink-0">
                <ExternalLink aria-hidden />
                <span className="truncate">{anexo.titulo}</span>
              </a>
              {aberta && (
                <Button variante="icone" tamanho="icone" aria-label={`Tirar ${anexo.titulo}`} onClick={() => salvarComAviso(() => removerAnexo(anexo.id))}>
                  <Trash2 aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {aberta && (
        <Campo id="painel-arquivo" rotulo="Link do Drive" erro={erro ?? undefined}>
          {(controle) => (
            <div className="grid gap-2">
              <EntradaLinkDrive
                link={link}
                {...controle}
                value={link}
                onChange={(evento) => setLink(evento.target.value)}
                onKeyDown={(evento) => {
                  if (evento.key === 'Enter') {
                    evento.preventDefault();
                    void adicionar();
                  }
                }}
              />
              <Button variante="secundario" tamanho="pequeno" className="justify-self-start" onClick={() => void adicionar()}>
                <Plus aria-hidden />
                Adicionar link
              </Button>
            </div>
          )}
        </Campo>
      )}
    </Secao>
  );
}

function SecaoComentarios({ atividade, painel, dados, aoMudarRascunho }: { atividade: Atividade; painel: DadosDoPainel; dados: DadosMeuDia; aoMudarRascunho: (temRascunho: boolean) => void }) {
  const { pessoa } = useCentral();
  const [texto, setTexto] = useState('');
  useEffect(() => () => aoMudarRascunho(false), [aoMudarRascunho]);

  function mudarTexto(novo: string) {
    setTexto(novo);
    aoMudarRascunho(Boolean(novo.trim()));
  }
  const [avisado, setAvisado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<{ id: string; texto: string } | null>(null);
  const internas = pessoasDoSeletor(dados.pessoas);
  const nome = (id: string) => dados.pessoas.find((item) => item.id === id)?.nome_completo ?? 'Pessoa removida';
  const ativos = painel.comentarios.filter((comentario) => !comentario.removido_em);

  async function enviar() {
    const limpo = texto.trim();
    if (pareceCredencial(limpo) && avisado !== limpo) {
      setAvisado(limpo);
      return;
    }
    const falha = await salvar(() => comentar(atividade.id, limpo, pessoa.id, internas));
    setErro(falha);
    if (!falha) {
      mudarTexto('');
      setAvisado(null);
    }
  }

  return (
    <Secao titulo={ativos.length ? `Comentários (${ativos.length})` : 'Comentários'}>
      <ul className="grid gap-3">
        {painel.comentarios.map((comentario) => (
          <li key={comentario.id} className="flex items-start gap-2.5">
            <Avatar nome={nome(comentario.autor_id)} className="size-7 text-[12px]" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-ink-soft">
                <span className="font-semibold text-ink">{nome(comentario.autor_id)}</span> · {formatarData(comentario.criado_em)} às {formatarHora(comentario.criado_em)}
                {comentario.editado_em ? ' · editado' : ''}
              </p>
              {editando?.id === comentario.id ? (
                <div className="mt-1 grid gap-2">
                  <Textarea aria-label="Editar comentário" value={editando.texto} onChange={(evento) => setEditando({ id: comentario.id, texto: evento.target.value })} />
                  <div className="flex gap-2">
                    <Button
                      tamanho="pequeno"
                      onClick={() => {
                        void salvar(() => editarComentario(comentario.id, editando.texto, internas, pessoa.id)).then((falha) => {
                          setErro(falha);
                          if (!falha) setEditando(null);
                        });
                      }}
                    >
                      Salvar
                    </Button>
                    <Button variante="terciario" tamanho="pequeno" onClick={() => setEditando(null)}>
                      Voltar
                    </Button>
                  </div>
                </div>
              ) : (
                <p className={cn('mt-0.5 text-[13px] leading-[20px] whitespace-pre-wrap break-words', comentario.removido_em && 'text-ink-soft italic')}>{comentario.texto}</p>
              )}
              {comentario.autor_id === pessoa.id && !comentario.removido_em && editando?.id !== comentario.id && (
                <div className="mt-0.5 flex gap-1">
                  {podeEditarComentario(comentario, pessoa.id) && (
                    <Button variante="terciario" tamanho="pequeno" onClick={() => setEditando({ id: comentario.id, texto: comentario.texto })}>
                      Editar
                    </Button>
                  )}
                  <Button variante="terciario" tamanho="pequeno" onClick={() => salvarComAviso(() => removerComentario(comentario.id))}>
                    Remover
                  </Button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className={cn('grid gap-2', painel.comentarios.length > 0 && 'mt-3')}>
        <Campo id="painel-comentario" rotulo="Novo comentário" erro={erro ?? undefined}>
          {(controle) => <Textarea {...controle} value={texto} onChange={(evento) => mudarTexto(evento.target.value)} />}
        </Campo>
        {avisado !== null && avisado === texto.trim() && <Faixa tipo="atencao">{AVISO_CREDENCIAL}</Faixa>}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-ink-soft">Mencionar:</span>
          {internas.map((item) => {
            const primeiro = item.nome_completo.split(' ')[0] ?? item.nome_completo;
            return (
              <Button key={item.id} variante="secundario" tamanho="pequeno" aria-label={`Mencionar ${item.nome_completo}`} onClick={() => mudarTexto(`${texto}${texto && !texto.endsWith(' ') ? ' ' : ''}@${primeiro} `)}>
                @{primeiro}
              </Button>
            );
          })}
        </div>
        <Button variante="secundario" className="justify-self-start" onClick={() => void enviar()}>
          Comentar
        </Button>
      </div>
    </Secao>
  );
}

function SecaoHistorico({ id }: { id: string }) {
  const consulta = useConsulta(() => historicoDaAtividade(id), [id]);
  return (
    <Secao titulo="Histórico">
      <ListaHistorico consulta={consulta} comFiltros />
    </Secao>
  );
}

type JanelaAtividadeProps = {
  /** O id vem do endereço: dá para copiar o link e abrir direto (T03.02). */
  id: string | null;
  dados: DadosMeuDia;
  acoes: AcoesDaAtividade;
  aoFechar: () => void;
  aoAbrir: (id: string) => void;
};

const CLASSE_ABA = 'border border-line data-[state=active]:border-espresso data-[state=active]:bg-espresso data-[state=active]:text-linen';

const Contador = ({ valor }: { valor: number }) => (valor ? <span className="ml-1.5 rounded-pill bg-hover px-1.5 text-xs leading-[18px] tabular-nums group-data-[state=active]/aba:bg-[var(--sobre-espresso)]">{valor}</span> : null);

/** T03.02: janela central (protótipo aprovado), mantendo o Meu dia e os filtros atrás; no celular, tela inteira. */
export function JanelaAtividade({ id, dados, acoes, aoFechar, aoAbrir }: JanelaAtividadeProps) {
  // Guarda o último id para o conteúdo continuar na tela enquanto a janela sai.
  const [atual, setAtual] = useState(id);
  useEffect(() => {
    if (id) setAtual(id);
  }, [id]);
  const consulta = useConsulta(() => (atual ? carregarPainel(atual) : Promise.resolve(null)), [atual]);
  const painel = consulta.dados;
  const atividade = painel?.atividade;
  const celular = useEhCelular();
  const [aba, setAba] = useState<Aba>('geral');
  // Só o que a pessoa mudou: o resto continua acompanhando o que está gravado.
  const [edicoes, setEdicoes] = useState<Partial<RascunhoDaAtividade>>({});
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const [temComentario, setTemComentario] = useState(false);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);
  const [pergunta, setPergunta] = useState<{ responder: (resposta: EscopoDaEdicao | null) => void } | null>(null);

  useEffect(() => {
    if (!id) return;
    setAba('geral');
    setEdicoes({});
    setTentou(false);
    setFalha(null);
  }, [id]);

  const base = useMemo(() => (painel ? rascunhoDoPainel(painel) : null), [painel]);
  const rascunho = useMemo(() => (base ? { ...base, ...edicoes } : null), [base, edicoes]);
  const aberta = atividade ? estaAberta(atividade) : false;
  const mudancas = painel && rascunho ? mudancasDoRascunho(painel, rascunho) : null;
  const alterado = aberta && mudancas !== null && temMudancas(mudancas);
  const erros: ErrosDoRascunho = tentou && rascunho && atividade ? errosDoRascunho(rascunho, atividade.tipo) : {};
  const credencial = useAvisoDeCredencial(rascunho ? [rascunho.titulo, rascunho.descricao, rascunho.resultado_esperado, rascunho.solicitante_texto] : []);
  const mudar = useCallback<Mudar>((parcial) => setEdicoes((atuais) => ({ ...atuais, ...parcial })), []);

  // Link para fora e fechar a aba também perguntam, enquanto houver algo sem salvar (P3).
  useAlteracoesPendentes(Boolean(id) && (alterado || temComentario));

  // Encerrada fica só para leitura: o que ainda não tinha sido salvo não continua na tela como se valesse.
  useEffect(() => {
    if (!aberta) setEdicoes({});
  }, [aberta]);

  /** O comentário só existe depois de enviado, e as alterações depois de salvas: as duas perguntam antes (P3). */
  function pedirFechar() {
    if (alterado || temComentario) setConfirmandoSaida(true);
    else aoFechar();
  }

  function responderEscopo(resposta: EscopoDaEdicao | null) {
    pergunta?.responder(resposta);
    setPergunta(null);
  }

  /** Falso: faltou corrigir algo, a pessoa desistiu ou não deu para gravar. A janela continua, mostrando o motivo. */
  async function gravarRascunho(): Promise<boolean> {
    if (!painel || !rascunho || !atividade || !mudancas) return false;
    const encontrados = errosDoRascunho(rascunho, atividade.tipo);
    setTentou(true);
    setFalha(null);
    const [primeiro] = Object.keys(encontrados) as (keyof RascunhoDaAtividade)[];
    if (primeiro) {
      setAba(abaDoCampo(primeiro, atividade.tipo));
      window.setTimeout(() => document.getElementById(ID_DO_CAMPO[primeiro] ?? '')?.focus(), 60);
      return false;
    }
    if (!credencial.podeGravar()) return false;
    // RN-03.17: só o que a rotina guarda pergunta. As datas de uma ocorrência valem só para ela.
    let escopo: EscopoDaEdicao = 'esta';
    if (atividade.recorrencia_id && Object.keys(mudancas.campos).length) {
      const resposta = await new Promise<EscopoDaEdicao | null>((responder) => setPergunta({ responder }));
      if (!resposta) return false;
      escopo = resposta;
    }
    setSalvando(true);
    try {
      await salvarRascunho(atividade.id, painel, rascunho, escopo);
      setEdicoes({});
      setTentou(false);
      return true;
    } catch (erro) {
      setFalha(mensagemDoErro(erro));
      return false;
    } finally {
      setSalvando(false);
    }
  }

  async function salvarAlteracoes() {
    if (!(await gravarRascunho())) return;
    aviso('Alterações salvas.');
    aoFechar();
  }

  /** Concluir não joga fora o que foi escrito: salva antes. Se não der para salvar, continua aberta. */
  async function concluirNaJanela(atividadeDoDia: AtividadeDoDia) {
    if (alterado && !(await gravarRascunho())) return;
    acoes.concluir(atividadeDoDia);
  }

  const doDia: AtividadeDoDia | null = atividade && painel ? { ...atividade, produtos: painel.produtos, participantes: painel.participantes, itensFeitos: 0, itensTotal: 0, comentarios: 0, etiquetas: painel.etiquetas } : null;
  const alerta = atividade?.tipo === 'alerta';
  const ativos = painel?.comentarios.filter((comentario) => !comentario.removido_em).length ?? 0;
  const rotuloConcluir = alerta ? 'Concluir alerta' : 'Concluir atividade';
  const botaoConcluir = doDia && (
    aberta ? (
      <Button variante="secundario" disabled={salvando} onClick={() => void concluirNaJanela(doDia)}>
        <Check aria-hidden />
        {rotuloConcluir}
      </Button>
    ) : (
      <Button variante="secundario" onClick={() => acoes.pedir('reabrir', doDia)}>
        Reabrir
      </Button>
    )
  );
  const botaoSalvar = (
    <Button carregando={salvando} disabled={!alterado} onClick={() => void salvarAlteracoes()}>
      <Save aria-hidden />
      Salvar alterações
    </Button>
  );
  const naEdicao = aba === 'geral' || aba === 'agendamento';
  const mudarSituacao: AbaGeralProps['aoMudarSituacao'] = (situacao) => {
    if (!doDia) return;
    if (situacao === 'concluida' && aberta) void concluirNaJanela(doDia);
    else acoes.mover(doDia, situacao);
  };
  const titulo = atividade && rascunho && <TituloDaJanela atividade={atividade} valor={rascunho.titulo} erro={erros.titulo} aoMudar={(novo) => mudar({ titulo: novo })} />;

  return (
    <>
      <Dialog open={Boolean(id)} onOpenChange={(abrir) => !abrir && pedirFechar()}>
        <DialogContent variante="janela" semFechar data-largura="larga" className="md:h-[min(88dvh,720px)]" aria-describedby={undefined}>
          {consulta.estado === 'carregando' && (
            <div className="p-6">
              <DialogTitle className="sr-only">Carregando a atividade</DialogTitle>
              <EstadoCarregando />
            </div>
          )}
          {consulta.estado === 'erro' && (
            <div className="p-6">
              <DialogTitle className="sr-only">Erro ao ler a atividade</DialogTitle>
              <EstadoErro titulo="Não deu para ler esta atividade." aoTentarDeNovo={consulta.recarregar} />
            </div>
          )}
          {consulta.estado === 'pronto' && !atividade && (
            <div className="p-6">
              <DialogTitle className="font-display text-xl">Esta atividade não existe mais</DialogTitle>
              <p className="mt-2 text-sm text-ink-soft">Ela pode ter sido removida ao limpar os exemplos ou ao importar um arquivo.</p>
              <Button variante="secundario" className="mt-4" onClick={aoFechar}>
                Voltar ao Meu dia
              </Button>
            </div>
          )}
          {atividade && painel && doDia && rascunho && (
            <Tabs key={atividade.id} value={aba} onValueChange={(valor) => setAba(valor as Aba)} className="flex min-h-0 flex-1 flex-col">
              <header className="shrink-0 px-4 pt-2 md:px-7 md:pt-5">
                <div className="flex items-center gap-2 md:items-start">
                  <Button variante="icone" tamanho="icone" aria-label="Voltar" className="md:hidden" onClick={pedirFechar}>
                    <ArrowLeft aria-hidden />
                  </Button>
                  <div className="min-w-0 flex-1">
                    <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-ink-soft">
                      <TipoDaAtividade tipo={atividade.tipo} />
                      <span className="tabular-nums">· {atividade.codigo}</span>
                      {atividade.adiamentos >= 2 && <span>· Adiada {atividade.adiamentos} vezes</span>}
                    </p>
                    {!celular && <div className="mt-1">{titulo}</div>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!celular && botaoConcluir}
                    <MenuDaJanela atividade={atividade} doDia={doDia} acoes={acoes} aoAbrir={aoAbrir} />
                    <BotaoFechar className="hidden md:inline-grid" onClick={pedirFechar} />
                  </div>
                </div>
                {celular && <div className="mt-1">{titulo}</div>}
                <p className="mt-1 text-[13px] leading-[18px]">
                  <PrazoDaAtividade atividade={doDia} hoje={hojeISO()} />
                </p>
              </header>
              <TabsList aria-label="Partes da atividade" className="mt-3 shrink-0 border-b border-line px-4 pb-3 md:gap-1.5 md:px-7">
                <TabsTrigger value="geral" className={CLASSE_ABA}>
                  Geral
                </TabsTrigger>
                {atividade.tipo !== 'lembrete' && (
                  <TabsTrigger value="checklist" className={cn('group/aba', CLASSE_ABA)}>
                    Checklist
                    <Contador valor={painel.itens.length} />
                  </TabsTrigger>
                )}
                {!alerta && (
                  <TabsTrigger value="agendamento" className={CLASSE_ABA}>
                    Agendamento
                  </TabsTrigger>
                )}
                <TabsTrigger value="vinculos" className={CLASSE_ABA}>
                  Vínculos e arquivos
                </TabsTrigger>
                <TabsTrigger value="comentarios" className={cn('group/aba', CLASSE_ABA)}>
                  Comentários
                  <Contador valor={ativos} />
                </TabsTrigger>
                <TabsTrigger value="historico" className={CLASSE_ABA}>
                  Histórico
                </TabsTrigger>
              </TabsList>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-7">
                {credencial.aviso && <div className="mb-3">{credencial.aviso}</div>}
                {falha && <MensagemErro className="mb-3">{falha}</MensagemErro>}
                <TabsContent value="geral" tabIndex={-1}>
                  <AbaGeral atividade={atividade} painel={painel} dados={dados} acoes={acoes} doDia={doDia} rascunho={rascunho} erros={erros} mudar={mudar} aoMudarSituacao={mudarSituacao} />
                </TabsContent>
                {atividade.tipo !== 'lembrete' && (
                  <TabsContent value="checklist" tabIndex={-1}>
                    <SecaoChecklist atividade={atividade} painel={painel} dados={dados} />
                  </TabsContent>
                )}
                {!alerta && (
                  <TabsContent value="agendamento" tabIndex={-1}>
                    <AbaAgendamento atividade={atividade} painel={painel} rascunho={rascunho} erros={erros} mudar={mudar} />
                  </TabsContent>
                )}
                <TabsContent value="vinculos" tabIndex={-1} className="grid gap-5 data-[state=inactive]:hidden md:grid-cols-2 md:gap-x-7">
                  <SecaoVinculos atividade={atividade} painel={painel} dados={dados} />
                  <SecaoArquivos atividade={atividade} painel={painel} />
                </TabsContent>
                {/* Fica montada: trocar de aba não perde o comentário que está sendo escrito. */}
                <TabsContent value="comentarios" tabIndex={-1} forceMount className="data-[state=inactive]:hidden">
                  <SecaoComentarios atividade={atividade} painel={painel} dados={dados} aoMudarRascunho={setTemComentario} />
                </TabsContent>
                <TabsContent value="historico" tabIndex={-1}>
                  <SecaoHistorico id={atividade.id} />
                </TabsContent>
              </div>
              {celular ? (
                <footer className="flex shrink-0 gap-2 border-t border-line px-4 pt-3 pb-[calc(12px+var(--area-segura-baixo))] [&>*]:flex-1">
                  {alterado ? (
                    <>
                      <Button variante="secundario" onClick={pedirFechar}>
                        Cancelar
                      </Button>
                      {botaoSalvar}
                    </>
                  ) : (
                    botaoConcluir
                  )}
                </footer>
              ) : (
                aberta &&
                (naEdicao || alterado) && (
                  <footer className="flex shrink-0 items-center gap-3 border-t border-line px-7 py-4">
                    <span role="status" className="text-[13px] text-ink-soft">
                      {alterado ? 'Alterações não salvas' : ''}
                    </span>
                    <div className="ml-auto flex gap-2">
                      <Button variante="secundario" onClick={pedirFechar}>
                        Cancelar
                      </Button>
                      {botaoSalvar}
                    </div>
                  </footer>
                )
              )}
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(pergunta)} onOpenChange={(abrir) => !abrir && responderEscopo(null)}>
        <DialogContent semFechar comDescricao>
          <DialogTitle>Esta atividade faz parte de uma rotina</DialogTitle>
          <DialogDescription className="mt-3">A mudança vale só para esta ocorrência, ou também para as próximas? As anteriores não mudam.</DialogDescription>
          <div className="acoes-dialogo">
            <Button variante="secundario" onClick={() => responderEscopo(null)}>
              Voltar
            </Button>
            <Button variante="secundario" onClick={() => responderEscopo('esta')}>
              Somente esta
            </Button>
            <Button onClick={() => responderEscopo('proximas')}>Esta e as próximas</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Confirmacao
        aberto={confirmandoSaida}
        aoFechar={() => setConfirmandoSaida(false)}
        titulo={alterado ? 'Descartar as alterações?' : 'Descartar o comentário?'}
        texto={alterado ? 'O que você mudou nesta atividade ainda não foi salvo.' : 'O comentário que você escreveu ainda não foi enviado.'}
        rotuloConfirmar={alterado ? 'Descartar alterações' : 'Descartar comentário'}
        rotuloCancelar={alterado ? 'Continuar editando' : 'Continuar escrevendo'}
        perigo
        aoConfirmar={() => {
          setConfirmandoSaida(false);
          setEdicoes({});
          aoFechar();
        }}
      />
    </>
  );
}
