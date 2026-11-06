import type { ComponentProps } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { linkDoDriveValido } from '@/dominio/link-drive';

type EntradaLinkDriveProps = Omit<ComponentProps<'input'>, 'value'> & {
  /** O link digitado até agora: o botão "Abrir" só aparece quando ele é válido. */
  link: string;
};

/** Campo link do Drive (02): com um link válido, oferece o botão "Abrir". */
export function EntradaLinkDrive({ link, ...props }: EntradaLinkDriveProps) {
  const valido = linkDoDriveValido(link);
  return (
    <div className="flex items-center gap-2">
      <Input type="url" inputMode="url" autoComplete="off" spellCheck={false} className="min-w-0 flex-1" {...props} />
      {valido && (
        <Button asChild variante="secundario" className="shrink-0">
          <a href={link.trim()} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden />
            Abrir
          </a>
        </Button>
      )}
    </div>
  );
}
