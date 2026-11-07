'use client';

import { EntradaData } from '@/componentes/campos/entrada-data';
import { useState } from 'react';
import { useAvisoDeCredencial } from '@/componentes/campos/aviso-credencial';
import { Campo, MensagemErro } from '@/componentes/campos/campo';
import { EntradaLinkDrive } from '@/componentes/campos/link-drive';
import { Pilulas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { aviso } from '@/componentes/padroes/aviso';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';
import { mensagemDoErro } from '@/dados/erros';
import type { ContaFinanceira } from '@/dados/tipos/financeiro';
import { erroDoLote, registrarBaixaEmLote } from '@/dominio/baixas';
import type { LinhaDoTitulo } from '@/dominio/lancamentos';
import { linkDoDriveValido, MENSAGEM_LINK_DRIVE } from '@/dominio/link-drive';
import { ROTULOS_TRATAMENTO } from '@/dominio/titulos';
import { hojeISO } from '@/lib/datas';
import { formatarDinheiro } from '@/lib/formatacao';

/** T05.01: o saldo inteiro de cada título, com a mesma conta e a mesma data. Ou todos, ou nenhum. */
export function DialogoDeBaixaEmLote({ titulos, contas, aoFechar }: { titulos: readonly LinhaDoTitulo[]; contas: readonly ContaFinanceira[]; aoFechar: (feito: boolean) => void }) {
  const hoje = hojeISO();
  const [data, setData] = useState(hoje);
  const [contaId, setContaId] = useState('');
  const [comprovante, setComprovante] = useState('');
  const [semComprovante, setSemComprovante] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [tratamento, setTratamento] = useState<'' | 'aporte' | 'reembolso'>('');
  const [vencimento, setVencimento] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const credencial = useAvisoDeCredencial([motivo]);
  const ativas = contas.filter((conta) => !conta.arquivado_em && conta.situacao === 'ativa');
  const deSocia = ativas.find((conta) => conta.id === contaId)?.tipo === 'pessoal_socia';
  const impedimento = erroDoLote(titulos, deSocia);
  const total = titulos.reduce((soma, titulo) => soma + titulo.saldo, 0);

  async function confirmar() {
    if (!contaId) return setErro('Escolha a conta.');
    if (deSocia && !tratamento) return setErro('Conta de sócia: escolha entre aporte e reembolso.');
    if (deSocia && tratamento === 'reembolso' && !vencimento) return setErro('Informe quando a Numa vai reembolsar.');
    if (semComprovante && !motivo.trim()) return setErro('Diga por que não tem comprovante.');
    if (!semComprovante && !comprovante.trim()) return setErro('Cole o link do comprovante, ou marque que não tem.');
    if (!semComprovante && !linkDoDriveValido(comprovante)) return setErro(MENSAGEM_LINK_DRIVE);
    if (!credencial.podeGravar()) return setErro(null);
    try {
      const feitos = await registrarBaixaEmLote(
        titulos.map((titulo) => titulo.id),
        { data, contaId, comprovanteUrl: semComprovante ? null : comprovante.trim(), semComprovanteMotivo: semComprovante ? motivo.trim() : null, tratamento: deSocia ? tratamento || null : null, vencimentoReembolso: vencimento || null },
        hoje,
      );
      aviso(feitos === 1 ? '1 baixa registrada.' : `${feitos} baixas registradas.`);
      aoFechar(true);
    } catch (falha) {
      setErro(mensagemDoErro(falha));
    }
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar(false)}>
      <DialogContent telaCheia semFechar comDescricao>
        <DialogTitle>Registrar baixa em lote</DialogTitle>
        <DialogDescription className="mt-3 leading-[1.6]">
          {titulos.length === 1 ? '1 título' : `${titulos.length} títulos`}, com o saldo inteiro de cada um{impedimento ? '.' : `: ${formatarDinheiro(total, 'BRL')}.`}
        </DialogDescription>
        <div className="mt-4 grid gap-4">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
            <Campo id="lote-data" rotulo="Data" obrigatorio>
              {(controle) => <EntradaData max={hoje} {...controle} value={data} onChange={(evento) => setData(evento.target.value)} />}
            </Campo>
            <Campo id="lote-conta" rotulo="Conta" obrigatorio>
              {(controle) => (
                <Selecao {...controle} value={contaId} onChange={(evento) => setContaId(evento.target.value)}>
                  <option value="">Escolha</option>
                  {ativas.map((conta) => (
                    <option key={conta.id} value={conta.id}>
                      {conta.nome}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          </div>
          {deSocia && <Pilulas rotulo="Conta de sócia: como tratar?" obrigatorio valor={tratamento} aoMudar={(valor) => setTratamento(valor as typeof tratamento)} opcoes={Object.entries(ROTULOS_TRATAMENTO).map(([valor, rotulo]) => ({ valor, rotulo }))} />}
          {deSocia && tratamento === 'reembolso' && (
            <Campo id="lote-vencimento" rotulo="Vencimento do reembolso" obrigatorio>
              {(controle) => <EntradaData {...controle} value={vencimento} onChange={(evento) => setVencimento(evento.target.value)} />}
            </Campo>
          )}
          {!semComprovante && (
            <Campo id="lote-comprovante" rotulo="Comprovante" obrigatorio>
              {(controle) => <EntradaLinkDrive link={comprovante} {...controle} value={comprovante} onChange={(evento) => setComprovante(evento.target.value)} />}
            </Campo>
          )}
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[13px] md:min-h-0">
            <input type="checkbox" className="size-[18px] accent-[var(--ok)]" checked={semComprovante} onChange={(evento) => setSemComprovante(evento.target.checked)} />
            Não tenho comprovante
          </label>
          {semComprovante && (
            <Campo id="lote-motivo" rotulo="Por que não tem?" obrigatorio>
              {(controle) => <Input autoComplete="off" {...controle} value={motivo} onChange={(evento) => setMotivo(evento.target.value)} />}
            </Campo>
          )}
          {credencial.aviso}
          {(impedimento || erro) && <MensagemErro>{impedimento ?? erro}</MensagemErro>}
        </div>
        <div className="acoes-dialogo">
          <Button variante="secundario" onClick={() => aoFechar(false)}>
            Voltar
          </Button>
          <Button disabled={Boolean(impedimento)} onClick={() => void confirmar()}>
            Registrar baixas
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
