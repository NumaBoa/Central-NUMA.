'use client';

import { Campo } from '@/componentes/campos/campo';
import { EntradaData } from '@/componentes/campos/entrada-data';
import { Pilulas, PilulasMultiplas } from '@/componentes/campos/pilulas';
import { Selecao } from '@/componentes/campos/selecao';
import { Faixa } from '@/componentes/padroes/faixa';
import { Input } from '@/componentes/ui/input';
import { Textarea } from '@/componentes/ui/textarea';
import { useConsulta } from '@/dados/use-consulta';
import { carregarOpcoesDaDecisao, novaDecisaoVazia, ROTULOS_ASSUNTO_DECISAO, type EntradaDecisao, type NovaDecisao, type RegrasDaDecisao } from '@/dominio/decisoes';
import { hojeISO } from '@/lib/datas';
import { formatarDiaISO } from '@/lib/formatacao';

type CampoDecisaoProps = {
  valor: EntradaDecisao;
  aoMudar: (valor: EntradaDecisao) => void;
  regras: RegrasDaDecisao;
  /** Com o prefixo `decisao_`, como devolvem as regras. */
  erros?: Readonly<Record<string, string>>;
  /** Para os ids dos campos, e o resumo de erros poder levar o foco até eles. */
  prefixo: string;
  /** Quem está em "Você é" já vem marcada, se for sócia. */
  pessoaId: string;
  rotulo?: string;
};

/**
 * Decisão obrigatória (RN-06.15): vincular uma existente ou registrar agora. É a tabela `decisao`, a mesma que a T06.09
 * vai usar: aqui não existe nenhuma outra base de decisões.
 */
export function CampoDecisao({ valor, aoMudar, regras, erros = {}, prefixo, pessoaId, rotulo = 'Decisão' }: CampoDecisaoProps) {
  const consulta = useConsulta(() => carregarOpcoesDaDecisao(regras), [regras.produto_id, regras.assunto, regras.exigirAssunto, regras.qualquerProduto]);
  const socias = consulta.dados?.socias ?? [];
  const decisoes = consulta.dados?.decisoes ?? [];
  const nova = valor.modo === 'registrar' ? valor : null;
  const mudar = (parcial: Partial<NovaDecisao>) => nova && aoMudar({ ...nova, ...parcial });

  return (
    <fieldset className="grid gap-3.5">
      <legend className="sr-only">{rotulo}</legend>
      <Pilulas
        rotulo={`${rotulo} *`}
        valor={valor.modo}
        aoMudar={(modo) => aoMudar(modo === 'vincular' ? { modo: 'vincular', decisao_id: '' } : novaDecisaoVazia(hojeISO(), socias.some((socia) => socia.id === pessoaId) ? [pessoaId] : []))}
        opcoes={[
          { valor: 'registrar', rotulo: 'Registrar agora' },
          { valor: 'vincular', rotulo: 'Vincular existente' },
        ]}
      />
      {regras.exigirAssunto && <Faixa tipo="atencao">Precisa ser uma decisão específica de {ROTULOS_ASSUNTO_DECISAO[regras.assunto].toLocaleLowerCase('pt-BR')}. Ao registrar agora, ela já entra assim.</Faixa>}
      {valor.modo === 'vincular' ? (
        decisoes.length ? (
          <Campo id={`${prefixo}-decisao_id`} rotulo="Decisão registrada" obrigatorio erro={erros.decisao_decisao_id}>
            {(controle) => (
              <Selecao {...controle} value={valor.decisao_id} onChange={(evento) => aoMudar({ modo: 'vincular', decisao_id: evento.target.value })}>
                <option value="">Escolha</option>
                {decisoes.map((decisao) => (
                  <option key={decisao.id} value={decisao.id}>
                    {decisao.codigo} · {decisao.titulo} · {formatarDiaISO(decisao.data)}
                  </option>
                ))}
              </Selecao>
            )}
          </Campo>
        ) : (
          <p id={`${prefixo}-decisao_id`} tabIndex={-1} className="text-[13px] text-ink-soft">
            Nenhuma decisão serve aqui. Registre agora.
          </p>
        )
      ) : (
        nova && (
          <>
            <Campo id={`${prefixo}-titulo`} rotulo="Título da decisão" obrigatorio erro={erros.decisao_titulo}>
              {(controle) => <Input {...controle} value={nova.titulo} onChange={(evento) => mudar({ titulo: evento.target.value })} autoComplete="off" />}
            </Campo>
            <Campo id={`${prefixo}-descricao`} rotulo="O que foi decidido" obrigatorio erro={erros.decisao_descricao}>
              {(controle) => <Textarea {...controle} value={nova.descricao} onChange={(evento) => mudar({ descricao: evento.target.value })} />}
            </Campo>
            <div id={`${prefixo}-decisores`} tabIndex={-1}>
              <PilulasMultiplas rotulo="Decidido por" obrigatorio valores={nova.decisores} aoMudar={(decisores) => mudar({ decisores })} opcoes={socias.map((socia) => ({ valor: socia.id, rotulo: socia.nome_completo }))} />
              {erros.decisao_decisores && <p className="mt-1.5 text-xs text-err">{erros.decisao_decisores}</p>}
            </div>
            <Campo id={`${prefixo}-data`} rotulo="Data da decisão" obrigatorio erro={erros.decisao_data}>
              {(controle) => <EntradaData {...controle} value={nova.data} max={hojeISO()} onChange={(evento) => mudar({ data: evento.target.value })} />}
            </Campo>
            <details className="rounded-md border border-line px-3 py-2">
              <summary className="flex min-h-11 cursor-pointer items-center text-[13px] font-semibold md:min-h-8">Motivo, alternativas e impacto</summary>
              <div className="grid gap-3.5 py-2">
                <Campo rotulo="Motivo">{(controle) => <Textarea {...controle} value={nova.motivo} onChange={(evento) => mudar({ motivo: evento.target.value })} />}</Campo>
                <Campo rotulo="Alternativas consideradas">{(controle) => <Textarea {...controle} value={nova.alternativas} onChange={(evento) => mudar({ alternativas: evento.target.value })} />}</Campo>
                <Campo rotulo="Impacto">{(controle) => <Textarea {...controle} value={nova.impacto} onChange={(evento) => mudar({ impacto: evento.target.value })} />}</Campo>
              </div>
            </details>
            <p className="text-xs text-ink-soft">Depois de registrada, a decisão não muda: só pode ser substituída por outra.</p>
          </>
        )
      )}
    </fieldset>
  );
}
