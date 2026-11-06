'use client';

import { useMemo, useState } from 'react';
import { Campo, MensagemErro } from '@/componentes/campos/campo';
import { Selecao } from '@/componentes/campos/selecao';
import { useCentral } from '@/componentes/layout/central-provider';
import { aviso } from '@/componentes/padroes/aviso';
import { Confirmacao } from '@/componentes/padroes/confirmacao';
import { Input } from '@/componentes/ui/input';
import { mensagemDoErro } from '@/dados/erros';
import {
  adiarAtividade,
  bloquearAtividade,
  cancelarAtividade,
  concluirAtividade,
  desbloquearAtividade,
  desfazerAdiamento,
  desfazerConclusao,
  dispensarAlerta,
  moverAtividade,
  moverParaAguardando,
  novaDataDoAdiamento,
  prazoEfetivo,
  reabrirAtividade,
  trocarResponsavel,
  type AtividadeDoDia,
  type ColunaDoQuadro,
  type DadosMeuDia,
} from '@/dominio/atividades';
import { formatarDiaISO } from '@/lib/formatacao';

export type PedidoDeAcao = 'aguardando' | 'adiar' | 'bloquear' | 'cancelar' | 'dispensar' | 'reabrir';

export type AcoesDaAtividade = {
  abrir: (atividade: AtividadeDoDia) => void;
  concluir: (atividade: AtividadeDoDia) => void;
  /** A mesma ação do arrastar e do menu: pede o que a regra exigir. */
  mover: (atividade: AtividadeDoDia, coluna: ColunaDoQuadro) => void;
  adiarEm: (atividade: AtividadeDoDia, dias: number) => void;
  pedir: (pedido: PedidoDeAcao, atividade: AtividadeDoDia) => void;
  desbloquear: (atividade: AtividadeDoDia) => void;
  trocarResponsavel: (atividade: AtividadeDoDia, pessoaId: string) => void;
};

async function tentar(acao: () => Promise<unknown>): Promise<boolean> {
  try {
    await acao();
    return true;
  } catch (erro) {
    aviso(mensagemDoErro(erro));
    return false;
  }
}

/** As ações do cartão e os diálogos que elas pedem, no mesmo lugar para o quadro e a lista. */
export function useAcoesDaAtividade(dados: DadosMeuDia | undefined, hoje: string, abrirPainel: (id: string) => void) {
  const { pessoa } = useCentral();
  const [pedido, setPedido] = useState<{ tipo: PedidoDeAcao; atividade: AtividadeDoDia } | null>(null);

  const acoes = useMemo<AcoesDaAtividade>(() => {
    const concluir: AcoesDaAtividade['concluir'] = (atividade) => {
      void concluirAtividade(atividade.id, pessoa.id).then(
        (anterior) =>
          aviso('Atividade concluída.', {
            acao: { rotulo: 'Desfazer', aoClicar: () => void tentar(() => desfazerConclusao(atividade.id, anterior)) },
          }),
        (erro: unknown) => aviso(mensagemDoErro(erro)),
      );
    };
    const pedir: AcoesDaAtividade['pedir'] = (tipo, atividade) => setPedido({ tipo, atividade });
    return {
      abrir: (atividade) => abrirPainel(atividade.id),
      concluir,
      pedir,
      mover: (atividade, coluna) => {
        if (atividade.situacao === coluna) return;
        if (atividade.situacao === 'concluida') return pedir('reabrir', atividade);
        if (coluna === 'concluida') return concluir(atividade);
        if (coluna === 'aguardando') return pedir('aguardando', atividade);
        void tentar(() => moverAtividade(atividade.id, coluna)).then((certo) => {
          if (certo) aviso('Atividade movida.');
        });
      },
      adiarEm: (atividade, dias) => {
        const novaData = novaDataDoAdiamento(atividade, dias, hoje);
        void adiarAtividade(atividade.id, novaData, hoje).then(
          (antes) =>
            aviso(`Adiada para ${formatarDiaISO(novaData).slice(0, 5)}.`, {
              acao: { rotulo: 'Desfazer', aoClicar: () => void tentar(() => desfazerAdiamento(atividade.id, antes)) },
            }),
          (erro: unknown) => aviso(mensagemDoErro(erro)),
        );
      },
      desbloquear: (atividade) => {
        void tentar(() => desbloquearAtividade(atividade.id)).then((certo) => {
          if (certo) aviso('Bloqueio removido.');
        });
      },
      trocarResponsavel: (atividade, pessoaId) => {
        if (pessoaId === atividade.responsavel_id) return;
        void tentar(() => trocarResponsavel(atividade.id, pessoaId)).then((certo) => {
          if (certo) aviso('Responsável alterada.');
        });
      },
    };
  }, [pessoa.id, hoje, abrirPainel]);

  const fechar = () => setPedido(null);

  async function executar(acao: () => Promise<unknown>, mensagem: string) {
    fechar();
    if (await tentar(acao)) aviso(mensagem);
  }

  const dialogos = (
    <>
      {pedido?.tipo === 'aguardando' && dados && <DialogoDeAguardando atividade={pedido.atividade} dados={dados} hoje={hoje} aoFechar={fechar} />}
      {pedido?.tipo === 'adiar' && <DialogoDeAdiar atividade={pedido.atividade} hoje={hoje} aoFechar={fechar} />}
      <Confirmacao
        aberto={pedido?.tipo === 'bloquear'}
        aoFechar={fechar}
        titulo={`Marcar bloqueada: ${pedido?.atividade.titulo ?? ''}`}
        texto="Ela sobe para o topo da coluna, com o motivo à vista."
        pedirMotivo
        mensagemSemMotivo="Informe o motivo do bloqueio."
        rotuloConfirmar="Marcar bloqueada"
        aoConfirmar={(motivo) => {
          const alvo = pedido?.atividade;
          if (alvo) void executar(() => bloquearAtividade(alvo.id, motivo), 'Atividade bloqueada.');
        }}
      />
      <Confirmacao
        aberto={pedido?.tipo === 'cancelar'}
        aoFechar={fechar}
        titulo={`Cancelar ${pedido?.atividade.titulo ?? ''}?`}
        texto="Ela sai do quadro e fica no histórico, com o motivo."
        pedirMotivo
        mensagemSemMotivo="Informe o motivo para cancelar."
        rotuloConfirmar="Cancelar atividade"
        rotuloCancelar="Voltar"
        perigo
        aoConfirmar={(motivo) => {
          const alvo = pedido?.atividade;
          if (alvo) void executar(() => cancelarAtividade(alvo.id, motivo), 'Atividade cancelada.');
        }}
      />
      <Confirmacao
        aberto={pedido?.tipo === 'dispensar'}
        aoFechar={fechar}
        titulo={`Dispensar o alerta: ${pedido?.atividade.titulo ?? ''}?`}
        texto="O alerta sai do quadro. Isto não muda o registro de origem, e o mesmo motivo não volta a ser criado."
        pedirMotivo
        mensagemSemMotivo="Informe o motivo para dispensar."
        rotuloConfirmar="Dispensar alerta"
        aoConfirmar={(motivo) => {
          const alvo = pedido?.atividade;
          if (alvo) void executar(() => dispensarAlerta(alvo.id, motivo), 'Alerta dispensado.');
        }}
      />
      <Confirmacao
        aberto={pedido?.tipo === 'reabrir'}
        aoFechar={fechar}
        titulo={`Reabrir ${pedido?.atividade.titulo ?? ''}?`}
        texto="Ela volta para A fazer. O motivo fica no histórico."
        pedirMotivo
        mensagemSemMotivo="Informe o motivo para reabrir."
        rotuloConfirmar="Reabrir atividade"
        aoConfirmar={(motivo) => {
          const alvo = pedido?.atividade;
          if (alvo) void executar(() => reabrirAtividade(alvo.id, motivo), 'Atividade reaberta.');
        }}
      />
    </>
  );

  return { acoes, dialogos };
}

/** RN-03.09: de quem (pessoa ou texto livre) e, se quiser, a data de acompanhamento. */
function DialogoDeAguardando({ atividade, dados, hoje, aoFechar }: { atividade: AtividadeDoDia; dados: DadosMeuDia; hoje: string; aoFechar: () => void }) {
  const [pessoaId, setPessoaId] = useState('');
  const [texto, setTexto] = useState('');
  const [acompanhamento, setAcompanhamento] = useState('');
  const [erro, setErro] = useState('');
  const pessoas = dados.pessoas.filter((pessoa) => !pessoa.arquivado_em && pessoa.situacao === 'ativa');

  return (
    <Confirmacao
      aberto
      aoFechar={aoFechar}
      titulo={`Aguardando retorno: ${atividade.titulo}`}
      texto={
        <div className="grid gap-4">
          <Campo id="aguardando-pessoa" rotulo="Aguardando de quem" obrigatorio>
            {(controle) => (
              <Selecao {...controle} value={pessoaId} onChange={(evento) => setPessoaId(evento.target.value)}>
                <option value="">Outra: escrever o nome</option>
                {pessoas.map((pessoa) => (
                  <option key={pessoa.id} value={pessoa.id}>
                    {pessoa.nome_completo}
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>
          {!pessoaId && (
            <Campo id="aguardando-texto" rotulo="Nome de quem vai responder">
              {(controle) => <Input autoComplete="off" {...controle} value={texto} onChange={(evento) => setTexto(evento.target.value)} />}
            </Campo>
          )}
          <Campo id="aguardando-acompanhamento" rotulo="Acompanhar em" ajuda="Nesse dia, a atividade aparece em Para hoje.">
            {(controle) => <Input type="date" min={hoje} {...controle} value={acompanhamento} onChange={(evento) => setAcompanhamento(evento.target.value)} />}
          </Campo>
          {erro && <MensagemErro id="aguardando-erro">{erro}</MensagemErro>}
        </div>
      }
      rotuloConfirmar="Mover para Aguardando"
      aoConfirmar={() => {
        void moverParaAguardando(atividade.id, { pessoaId, texto, acompanhamento }, hoje).then(
          () => {
            aoFechar();
            aviso('Atividade movida.');
          },
          (falha: unknown) => setErro(mensagemDoErro(falha)),
        );
      }}
    />
  );
}

/** RN-03.08: adiar exige nova data, e a anterior fica no histórico. */
function DialogoDeAdiar({ atividade, hoje, aoFechar }: { atividade: AtividadeDoDia; hoje: string; aoFechar: () => void }) {
  const [novaData, setNovaData] = useState('');
  const [erro, setErro] = useState('');
  const atual = prazoEfetivo(atividade);

  return (
    <Confirmacao
      aberto
      aoFechar={aoFechar}
      titulo={`Adiar ${atividade.titulo}`}
      texto={
        <div className="grid gap-3">
          <p>{atual ? `A data atual é ${formatarDiaISO(atual)} e fica no histórico.` : 'Ela ainda está sem prazo.'}</p>
          <Campo id="adiar-data" rotulo="Nova data" obrigatorio erro={erro}>
            {(controle) => <Input type="date" min={hoje} {...controle} value={novaData} onChange={(evento) => setNovaData(evento.target.value)} />}
          </Campo>
        </div>
      }
      rotuloConfirmar="Adiar"
      aoConfirmar={() => {
        void adiarAtividade(atividade.id, novaData, hoje).then(
          (antes) => {
            aoFechar();
            aviso(`Adiada para ${formatarDiaISO(novaData).slice(0, 5)}.`, {
              acao: { rotulo: 'Desfazer', aoClicar: () => void tentar(() => desfazerAdiamento(atividade.id, antes)) },
            });
          },
          (falha: unknown) => setErro(mensagemDoErro(falha)),
        );
      }}
    />
  );
}
