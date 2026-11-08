'use client';

import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useAvisoDeCredencial } from '@/componentes/campos/aviso-credencial';
import { aviso } from '@/componentes/padroes/aviso';
import type { ErroDeCampo } from '@/componentes/padroes/janela-formulario';
import { mensagemDoErro } from '@/dados/erros';

type Opcoes<T> = {
  /** O prefixo dos ids dos campos: o resumo de erros leva o foco até eles. */
  prefixo: string;
  inicial: () => T;
  /** As regras do domínio, por campo. Só aparecem depois da primeira tentativa, e somem conforme são corrigidas. */
  validar: (valores: T) => Readonly<Record<string, string>>;
  salvar: (valores: T) => Promise<void>;
  /** O que pode parecer credencial (RT-14). */
  textos?: (valores: T) => readonly string[];
  mensagem?: string;
  aoSalvar: () => void;
};

/** O miolo dos formulários do M06. Quem usa monta a janela só quando ela abre, para começar sempre do que está salvo. */
export function useFormulario<T extends object>({ prefixo, inicial, validar, salvar, textos, mensagem, aoSalvar }: Opcoes<T>) {
  const [valores, setValores] = useState<T>(inicial);
  const [base] = useState(() => JSON.stringify(valores));
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const credencial = useAvisoDeCredencial(textos ? textos(valores) : []);

  const erros = useMemo(() => (tentou ? validar(valores) : {}), [tentou, valores, validar]);
  const lista: ErroDeCampo[] = Object.entries(erros).map(([campo, texto]) => ({ campoId: `${prefixo}-${campo.replace(/^decisao_/, 'decisao-')}`, mensagem: texto }));
  const mudar = (parcial: Partial<T>) => setValores((atuais) => ({ ...atuais, ...parcial }));

  async function enviar(evento?: FormEvent<HTMLFormElement>) {
    evento?.preventDefault();
    setTentou(true);
    if (Object.keys(validar(valores)).length || !credencial.podeGravar()) return;
    setSalvando(true);
    try {
      await salvar(valores);
      if (mensagem) aviso(mensagem);
      aoSalvar();
    } catch (erro) {
      aviso(mensagemDoErro(erro));
    } finally {
      setSalvando(false);
    }
  }

  return {
    valores,
    mudar,
    erros,
    lista,
    salvando,
    alterado: JSON.stringify(valores) !== base,
    avisoDeCredencial: credencial.aviso,
    enviar: (evento: FormEvent<HTMLFormElement>) => void enviar(evento),
    /** O `id` e o `erro` de um `Campo`. */
    campo: (nome: string) => {
      const texto = erros[nome];
      return { id: `${prefixo}-${nome}`, ...(texto ? { erro: texto } : {}) };
    },
    /** `value` e `onChange` de um campo de texto, data ou seleção. */
    entrada: (nome: keyof T & string) => ({
      value: String(valores[nome] ?? ''),
      onChange: (evento: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => mudar({ [nome]: evento.target.value } as unknown as Partial<T>),
    }),
  };
}
