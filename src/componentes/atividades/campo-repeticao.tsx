'use client';

import { EntradaData } from '@/componentes/campos/entrada-data';
import { Campo, MensagemErro } from '@/componentes/campos/campo';
import { Pilulas, PilulasMultiplas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { Input } from '@/componentes/ui/input';
import { formatarDiaISO } from '@/lib/formatacao';
import { avisoDoDia, DIAS_DA_SEMANA, errosDaRepeticao, fimPorExtenso, NOMES_DOS_MESES, proximasDatas, regraDoFormulario, regraPorExtenso, ROTULOS_FREQUENCIA, type FormularioRepeticao } from '@/dominio/repeticao';

const FREQUENCIAS = Object.entries(ROTULOS_FREQUENCIA).map(([valor, rotulo]) => ({ valor, rotulo }));
const UNIDADES = { diaria: ['dia', 'dias'], semanal: ['semana', 'semanas'], mensal: ['mês', 'meses'], anual: ['ano', 'anos'] } as const;
const MODOS_DO_MES = [
  { valor: 'dia', rotulo: 'Em um dia' },
  { valor: 'ultimo', rotulo: 'No último dia' },
];
const FINS = [
  { valor: 'sem', rotulo: 'Sem fim' },
  { valor: 'data', rotulo: 'Em uma data' },
  { valor: 'vezes', rotulo: 'Depois de algumas vezes' },
];

export type ErrosDaRepeticao = Partial<Record<keyof FormularioRepeticao, string>>;

/** Ids de cada campo, para o resumo de erros levar o foco até ele. */
export const idDoCampoDaRepeticao = (base: string, campo: keyof FormularioRepeticao) => `${base}-${campo.replaceAll('_', '-')}`;

type CampoRepeticaoProps = {
  /** Base dos ids: `atividade-repeticao`, `rotina-repeticao`. */
  id: string;
  valor: FormularioRepeticao;
  aoMudar: (novo: FormularioRepeticao) => void;
  erros?: ErrosDaRepeticao;
  lembrete: boolean;
  /** Hoje: é de onde contam as próximas datas. */
  hoje: string;
};

/** O componente de recorrência (02 §5): frequência, dias, hora, início e fim, com a regra por extenso. */
export function CampoRepeticao({ id, valor, aoMudar, erros = {}, lembrete, hoje }: CampoRepeticaoProps) {
  const mudar = (parcial: Partial<FormularioRepeticao>) => aoMudar({ ...valor, ...parcial });
  const idDe = (campo: keyof FormularioRepeticao) => idDoCampoDaRepeticao(id, campo);
  const usaDia = valor.frequencia === 'mensal' || valor.frequencia === 'anual';
  const regra = regraDoFormulario(valor);
  const valida = Object.keys(errosDaRepeticao(valor, { lembrete })).length === 0;
  const proximas = valida ? proximasDatas(regra, valor.inicio > hoje ? valor.inicio : hoje, 3) : [];
  const fim = valida ? fimPorExtenso(regra) : null;
  const aviso = usaDia ? avisoDoDia(regra) : null;

  return (
    <div className="grid gap-[18px] rounded-md border border-line p-3.5">
      <Pilulas rotulo="Frequência" obrigatorio valor={valor.frequencia} aoMudar={(frequencia) => mudar({ frequencia: frequencia as FormularioRepeticao['frequencia'] })} opcoes={FREQUENCIAS} />

      <Campo id={idDe('intervalo')} rotulo="A cada" erro={erros.intervalo} className="max-w-52">
        {(controle) => (
          <span className="flex items-center gap-2">
            <Input {...controle} inputMode="numeric" autoComplete="off" className="w-20" value={valor.intervalo} onChange={(evento) => mudar({ intervalo: evento.target.value })} />
            <span className="text-[13px] text-ink-soft">{valor.intervalo.trim() === '1' ? UNIDADES[valor.frequencia][0] : UNIDADES[valor.frequencia][1]}</span>
          </span>
        )}
      </Campo>

      {valor.frequencia === 'semanal' && (
        <div id={idDe('dias_semana')} tabIndex={-1}>
          <PilulasMultiplas rotulo="Nos dias" obrigatorio valores={valor.dias_semana.map(String)} aoMudar={(dias) => mudar({ dias_semana: dias.map(Number) })} opcoes={DIAS_DA_SEMANA.map((dia) => ({ valor: String(dia.valor), rotulo: dia.curto }))} />
          {erros.dias_semana && <MensagemErro>{erros.dias_semana}</MensagemErro>}
        </div>
      )}

      {usaDia && <Pilulas rotulo="Quando" valor={valor.modo_mes} aoMudar={(modo) => mudar({ modo_mes: modo as FormularioRepeticao['modo_mes'] })} opcoes={MODOS_DO_MES} />}

      {usaDia && (
        <div className="grid grid-cols-2 gap-3">
          {valor.modo_mes === 'dia' && (
            <Campo id={idDe('dia_mes')} rotulo="Dia" obrigatorio erro={erros.dia_mes}>
              {(controle) => <Input {...controle} inputMode="numeric" autoComplete="off" value={valor.dia_mes} onChange={(evento) => mudar({ dia_mes: evento.target.value })} />}
            </Campo>
          )}
          {valor.frequencia === 'anual' && (
            <Campo id={idDe('mes')} rotulo="Mês" obrigatorio erro={erros.mes}>
              {(controle) => (
                <Selecao {...controle} value={valor.mes} onChange={(evento) => mudar({ mes: evento.target.value })}>
                  {NOMES_DOS_MESES.map((nome, indice) => (
                    <option key={nome} value={String(indice + 1)}>
                      {nome}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
          )}
        </div>
      )}
      {aviso && <p className="-mt-3 text-xs text-ink-soft">{aviso}</p>}

      <div className="grid grid-cols-2 gap-3">
        <Campo id={idDe('inicio')} rotulo="Começa em" obrigatorio erro={erros.inicio}>
          {(controle) => <EntradaData {...controle} value={valor.inicio} onChange={(evento) => mudar({ inicio: evento.target.value })} />}
        </Campo>
        <Campo id={idDe('hora')} rotulo={lembrete ? 'Hora do aviso' : 'Hora (opcional)'} obrigatorio={lembrete} erro={erros.hora}>
          {(controle) => <Input type="time" {...controle} value={valor.hora} onChange={(evento) => mudar({ hora: evento.target.value })} />}
        </Campo>
      </div>

      <Pilulas rotulo="Termina" valor={valor.fim} aoMudar={(fimEscolhido) => mudar({ fim: fimEscolhido as FormularioRepeticao['fim'] })} opcoes={FINS} />
      {valor.fim === 'data' && (
        <Campo id={idDe('fim_data')} rotulo="Última data" obrigatorio erro={erros.fim_data}>
          {(controle) => <EntradaData {...controle} value={valor.fim_data} onChange={(evento) => mudar({ fim_data: evento.target.value })} />}
        </Campo>
      )}
      {valor.fim === 'vezes' && (
        <Campo id={idDe('fim_ocorrencias')} rotulo="Quantas vezes" obrigatorio erro={erros.fim_ocorrencias} className="max-w-52">
          {(controle) => <Input {...controle} inputMode="numeric" autoComplete="off" value={valor.fim_ocorrencias} onChange={(evento) => mudar({ fim_ocorrencias: evento.target.value })} />}
        </Campo>
      )}

      {valida && (
        <p data-resumo-regra className="rounded-sm bg-mist px-3 py-2 text-[13px] leading-[20px]">
          <span className="font-semibold">{regraPorExtenso(regra)}</span>
          {fim ? `, ${fim}` : ''}.
          {proximas.length > 0 ? ` Próximas: ${proximas.map((dia) => formatarDiaISO(dia).slice(0, 5)).join(', ')}.` : ' Com esse fim, não haveria nenhuma ocorrência.'}
        </p>
      )}
    </div>
  );
}
