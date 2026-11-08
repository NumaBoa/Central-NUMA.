'use client';

/** RN-11.26 (F2): os termos de repasse de um item de contrato de parceiro: percentual, base e retenção. */
import { useState } from 'react';
import { Campo } from '@/componentes/campos/campo';
import { Selecao } from '@/componentes/campos/selecao';
import { aviso } from '@/componentes/padroes/aviso';
import { JanelaFormulario } from '@/componentes/padroes/janela-formulario';
import { Input } from '@/componentes/ui/input';
import { mensagemDoErro } from '@/dados/erros';
import type { ItemContrato } from '@/dados/tipos/contrato';
import { salvarTermosDeRepasse, type TermosDeRepasse } from '@/dominio/repasses';

const numero = (valor: number | null | undefined) => (valor === null || valor === undefined ? '' : String(valor).replace('.', ','));

export function DialogoTermosDeRepasse({ item, aoFechar }: { item: ItemContrato; aoFechar: () => void }) {
  const inicial: TermosDeRepasse = { percentual: numero(item.percentual_repasse), base: item.base_repasse ?? '', retencao: numero(item.retencao) };
  const [termos, setTermos] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  const mudar = (parcial: Partial<TermosDeRepasse>) => setTermos((atual) => ({ ...atual, ...parcial }));
  return (
    <JanelaFormulario
      aberto
      aoFechar={aoFechar}
      titulo="Termos de repasse"
      descricao={`${item.descricao}: quanto da venda cabe ao parceiro. Valem para as vendas a partir da data de efeito desta versão.`}
      alterado={JSON.stringify(termos) !== JSON.stringify(inicial)}
      rotuloSalvar="Salvar termos"
      salvando={salvando}
      aoEnviar={(evento) => {
        evento.preventDefault();
        setSalvando(true);
        void salvarTermosDeRepasse(item.id, termos)
          .then(() => {
            aviso('Termos de repasse salvos.');
            aoFechar();
          })
          .catch((erro) => aviso(mensagemDoErro(erro)))
          .finally(() => setSalvando(false));
      }}
    >
      <Campo id="repasse-percentual" rotulo="Repasse ao parceiro (%)" ajuda="Vazio: o item não gera repasse.">
        {(controle) => <Input {...controle} inputMode="decimal" autoComplete="off" value={termos.percentual} onChange={(evento) => mudar({ percentual: evento.target.value })} />}
      </Campo>
      <Campo id="repasse-base" rotulo="Base de cálculo">
        {(controle) => (
          <Selecao {...controle} value={termos.base} onChange={(evento) => mudar({ base: evento.target.value as TermosDeRepasse['base'] })}>
            <option value="">Escolha</option>
            <option value="bruta">Venda bruta</option>
            <option value="liquida">Venda líquida de taxas</option>
          </Selecao>
        )}
      </Campo>
      <Campo id="repasse-retencao" rotulo="Retenção para estornos (%)" ajuda="Parte do repasse que fica retida para cobrir estornos.">
        {(controle) => <Input {...controle} inputMode="decimal" autoComplete="off" value={termos.retencao} onChange={(evento) => mudar({ retencao: evento.target.value })} />}
      </Campo>
    </JanelaFormulario>
  );
}
