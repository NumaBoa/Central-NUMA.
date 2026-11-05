'use client';

import type { ComponentProps } from 'react';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

/** Abas de ficha (18 §9.3): pílulas de texto, com rolagem horizontal no celular. */
export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn('faixa-rolagem flex items-center gap-1', className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'min-h-11 shrink-0 rounded-pill px-3.5 text-[13px] font-medium whitespace-nowrap text-ink-soft transition-colors duration-150 hover:text-ink data-[state=active]:bg-active data-[state=active]:font-semibold data-[state=active]:text-ink md:min-h-9',
        className,
      )}
      {...props}
    />
  );
}

export const TabsContent = TabsPrimitive.Content;
