import { CircleHelp } from 'lucide-react';
import { LinkCentral } from '@/componentes/layout/protecao-saida';
import { Button } from '@/componentes/ui/button';

/**
 * "Como usar": abre o manual do módulo, ou direto o artigo da tela. Discreto, ao lado das ações do cabeçalho.
 * `compacto`: no celular, só o ícone, com o nome para o leitor de tela e a área de toque de 44px.
 */
export function BotaoComoUsar({ href, compacto = false, className }: { href: string; compacto?: boolean; className?: string }) {
  return (
    <Button asChild variante={compacto ? 'icone' : 'terciario'} tamanho={compacto ? 'icone' : 'padrao'} className={className}>
      <LinkCentral href={href} aria-label={compacto ? 'Como usar' : undefined} title={compacto ? 'Como usar' : undefined}>
        <CircleHelp aria-hidden />
        {!compacto && 'Como usar'}
      </LinkCentral>
    </Button>
  );
}
