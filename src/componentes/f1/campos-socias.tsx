'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Campo, MensagemErro } from '@/componentes/campos/campo';
import { Selecao } from '@/componentes/campos/selecao';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import type { Pessoa } from '@/dados/tipos/pessoa';
import type { FormularioLicenciante } from '@/dominio/entidades';
import { formatarCpf } from '@/dominio/pessoas';

const NOVA: FormularioLicenciante = { pessoa_id: '', nome_civil: '', nacionalidade: '', cpf: '', endereco: '', email: '', responsabilidade_pct: '' };

/** T02.05, tipo "Sócias pessoas físicas" (19 §8): sem solidariedade, cada sócia com a sua proporção (D-CTR-01). */
export function CamposDasSocias({ valor, aoMudar, pessoas, erro }: { valor: readonly FormularioLicenciante[]; aoMudar: (novo: FormularioLicenciante[]) => void; pessoas: readonly Pick<Pessoa, 'id' | 'nome_completo' | 'cpf' | 'email'>[]; erro?: string }) {
  const mudar = (indice: number, parcial: Partial<FormularioLicenciante>) => aoMudar(valor.map((socia, i) => (i === indice ? { ...socia, ...parcial } : socia)));
  return (
    <div id="entidade-socias" tabIndex={-1} className="grid gap-3">
      <p className="texto-rotulo">Sócias *</p>
      {valor.map((socia, indice) => {
        const prefixo = `socia-${indice}`;
        return (
          <fieldset key={indice} className="grid gap-3 rounded-md border border-line p-3.5">
            <legend className="px-1 text-[13px] font-semibold">Sócia {indice + 1}</legend>
            <Campo id={`${prefixo}-pessoa`} rotulo="Pessoa" obrigatorio>
              {(controle) => (
                <Selecao
                  {...controle}
                  value={socia.pessoa_id}
                  onChange={(evento) => {
                    const pessoa = pessoas.find((item) => item.id === evento.target.value);
                    mudar(indice, { pessoa_id: evento.target.value, nome_civil: socia.nome_civil || pessoa?.nome_completo || '', cpf: socia.cpf || (pessoa?.cpf ? formatarCpf(pessoa.cpf) : ''), email: socia.email || pessoa?.email || '' });
                  }}
                >
                  <option value="">Escolha</option>
                  {pessoas.map((pessoa) => (
                    <option key={pessoa.id} value={pessoa.id}>
                      {pessoa.nome_completo}
                    </option>
                  ))}
                </Selecao>
              )}
            </Campo>
            <Campo id={`${prefixo}-nome`} rotulo="Nome civil" obrigatorio>
              {(controle) => <Input {...controle} autoComplete="off" value={socia.nome_civil} onChange={(evento) => mudar(indice, { nome_civil: evento.target.value })} />}
            </Campo>
            <Campo id={`${prefixo}-nacionalidade`} rotulo="Nacionalidade">
              {(controle) => <Input {...controle} autoComplete="off" value={socia.nacionalidade} onChange={(evento) => mudar(indice, { nacionalidade: evento.target.value })} />}
            </Campo>
            <Campo id={`${prefixo}-cpf`} rotulo="CPF" obrigatorio>
              {(controle) => <Input {...controle} autoComplete="off" spellCheck={false} placeholder="000.000.000-00" value={socia.cpf} onChange={(evento) => mudar(indice, { cpf: formatarCpf(evento.target.value) })} />}
            </Campo>
            <Campo id={`${prefixo}-endereco`} rotulo="Endereço" obrigatorio ajuda="Comercial ou residencial: sai como escrito no contrato (D-CTR-03).">
              {(controle) => <Input {...controle} autoComplete="off" value={socia.endereco} onChange={(evento) => mudar(indice, { endereco: evento.target.value })} />}
            </Campo>
            <Campo id={`${prefixo}-email`} rotulo="E-mail">
              {(controle) => <Input {...controle} type="email" autoComplete="off" spellCheck={false} value={socia.email} onChange={(evento) => mudar(indice, { email: evento.target.value })} />}
            </Campo>
            <Campo id={`${prefixo}-proporcao`} rotulo="Proporção de responsabilidade (%)" obrigatorio ajuda="Definida no acordo de sócias. Não há padrão: vazia, bloqueia a emissão final.">
              {(controle) => <Input {...controle} inputMode="decimal" autoComplete="off" value={socia.responsabilidade_pct} onChange={(evento) => mudar(indice, { responsabilidade_pct: evento.target.value })} />}
            </Campo>
            <Button variante="terciario" tamanho="pequeno" className="justify-self-start" onClick={() => aoMudar(valor.filter((_, i) => i !== indice))}>
              <Trash2 aria-hidden />
              Tirar sócia
            </Button>
          </fieldset>
        );
      })}
      <Button variante="secundario" className="justify-self-start" onClick={() => aoMudar([...valor, { ...NOVA }])}>
        <Plus aria-hidden />
        Incluir sócia
      </Button>
      {erro && <MensagemErro>{erro}</MensagemErro>}
    </div>
  );
}
