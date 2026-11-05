import { useId, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

type PropsDoControle = {
  id: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
};

type CampoProps = {
  rotulo: string;
  obrigatorio?: boolean;
  ajuda?: ReactNode;
  erro?: string;
  /** Para o resumo de erros poder levar o foco até o campo. */
  id?: string;
  className?: string;
  children: (controle: PropsDoControle) => ReactNode;
};

/** Rótulo acima, ajuda e erro abaixo (18 §9.2). Obrigatório com "*" (P3). */
export function Campo({ rotulo, obrigatorio = false, ajuda, erro, id, className, children }: CampoProps) {
  const gerado = useId();
  const idCampo = id ?? gerado;
  const idAjuda = `${idCampo}-ajuda`;
  const idErro = `${idCampo}-erro`;
  const descritores = [erro ? idErro : null, ajuda ? idAjuda : null].filter(Boolean).join(' ');

  return (
    <div className={className}>
      <label htmlFor={idCampo} className="mb-[7px] block texto-rotulo">
        {rotulo}
        {obrigatorio && ' *'}
      </label>
      {children({
        id: idCampo,
        ...(erro ? { 'aria-invalid': true as const } : {}),
        ...(descritores ? { 'aria-describedby': descritores } : {}),
      })}
      {erro && <MensagemErro id={idErro}>{erro}</MensagemErro>}
      {ajuda && (
        <p id={idAjuda} className="mt-1.5 text-xs leading-normal text-ink-soft">
          {ajuda}
        </p>
      )}
    </div>
  );
}

export function MensagemErro({ id, className, children }: { id?: string; className?: string; children: ReactNode }) {
  return (
    <p id={id} className={cn('mt-1.5 flex items-center gap-1.5 text-xs leading-normal text-err', className)}>
      <CircleAlert className="size-[13px] shrink-0" aria-hidden />
      {children}
    </p>
  );
}
