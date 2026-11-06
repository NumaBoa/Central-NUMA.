import type { UseFormRegisterReturn } from 'react-hook-form';
import { Campo } from '@/componentes/campos/campo';
import { Selecao } from '@/componentes/campos/selecao';
import { Input } from '@/componentes/ui/input';
import { UFS } from '@/dados/referencia/municipios';
import { formatarCep, type CamposEndereco as Campos } from '@/dominio/endereco';

type CamposEnderecoProps = {
  /** Para o resumo de erros poder levar o foco até o campo. */
  idBase: string;
  /** Fora do Brasil, o estado é texto livre e o código postal não tem máscara. */
  brasil?: boolean;
  registrar: (campo: keyof Campos) => UseFormRegisterReturn;
  erros?: Partial<Record<keyof Campos, { message?: string }>>;
};

/** Endereço estruturado (T02.05 e T02.06): CEP, logradouro, número, complemento, bairro, cidade e UF. */
export function CamposEndereco({ idBase, brasil = true, registrar, erros }: CamposEnderecoProps) {
  const cep = registrar('cep');
  return (
    <fieldset className="grid grid-cols-1 gap-[18px] rounded-md border border-line p-3.5 md:grid-cols-2">
      <legend className="px-1 texto-rotulo">Endereço</legend>
      <Campo id={`${idBase}-cep`} rotulo={brasil ? 'CEP' : 'Código postal'} erro={erros?.cep?.message}>
        {(controle) => (
          <Input
            inputMode={brasil ? 'numeric' : 'text'}
            autoComplete="off"
            {...controle}
            {...cep}
            onChange={(evento) => {
              if (brasil) evento.target.value = formatarCep(evento.target.value);
              void cep.onChange(evento);
            }}
          />
        )}
      </Campo>
      <Campo id={`${idBase}-uf`} rotulo={brasil ? 'Estado' : 'Estado ou região'} erro={erros?.uf?.message}>
        {(controle) =>
          brasil ? (
            <Selecao {...controle} {...registrar('uf')}>
              <option value="">Não informado</option>
              {UFS.map((uf) => (
                <option key={uf.sigla} value={uf.sigla}>
                  {uf.nome} · {uf.sigla}
                </option>
              ))}
            </Selecao>
          ) : (
            <Input autoComplete="off" {...controle} {...registrar('uf')} />
          )
        }
      </Campo>
      <Campo id={`${idBase}-logradouro`} rotulo="Logradouro" erro={erros?.logradouro?.message} className="md:col-span-2">
        {(controle) => <Input autoComplete="off" {...controle} {...registrar('logradouro')} />}
      </Campo>
      <Campo id={`${idBase}-numero`} rotulo="Número" erro={erros?.numero?.message}>
        {(controle) => <Input autoComplete="off" {...controle} {...registrar('numero')} />}
      </Campo>
      <Campo id={`${idBase}-complemento`} rotulo="Complemento">
        {(controle) => <Input autoComplete="off" {...controle} {...registrar('complemento')} />}
      </Campo>
      <Campo id={`${idBase}-bairro`} rotulo="Bairro" erro={erros?.bairro?.message}>
        {(controle) => <Input autoComplete="off" {...controle} {...registrar('bairro')} />}
      </Campo>
      <Campo id={`${idBase}-cidade`} rotulo="Cidade" erro={erros?.cidade?.message}>
        {(controle) => <Input autoComplete="off" {...controle} {...registrar('cidade')} />}
      </Campo>
    </fieldset>
  );
}
