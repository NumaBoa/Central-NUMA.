import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Ensina ao tailwind-merge os nomes de raio e sombra da identidade Numa.
const mesclar = extendTailwindMerge({
  extend: {
    theme: {
      radius: ['pill', 'campo'],
      shadow: ['e1', 'e2', 'btn'],
    },
  },
});

export function cn(...entradas: ClassValue[]) {
  return mesclar(clsx(entradas));
}
