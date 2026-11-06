import { z } from 'zod';
import type { Endereco } from '@/dados/tipos/contraparte';
import { soDigitos } from './duplicidade';

export const CAMPOS_ENDERECO_VAZIOS = { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' };

export type CamposEndereco = typeof CAMPOS_ENDERECO_VAZIOS;

export const esquemaCamposEndereco = z.object({
  cep: z.string().trim(),
  logradouro: z.string().trim(),
  numero: z.string().trim(),
  complemento: z.string().trim(),
  bairro: z.string().trim(),
  cidade: z.string().trim(),
  uf: z.string().trim(),
});

/** 00000-000, enquanto se digita. */
export function formatarCep(texto: string): string {
  const digitos = soDigitos(texto).slice(0, 8);
  return digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos;
}

export function cepValido(cep: string): boolean {
  return /^\d{5}-?\d{3}$/.test(cep.trim());
}

/** Vazio é vazio (RT-08): sem nenhum campo preenchido, não há endereço. */
export function enderecoDosCampos(campos: CamposEndereco): Endereco | null {
  const preenchido = Object.values(campos).some((valor) => valor.trim());
  if (!preenchido) return null;
  return {
    cep: campos.cep.trim() || null,
    logradouro: campos.logradouro.trim() || null,
    numero: campos.numero.trim() || null,
    complemento: campos.complemento.trim() || null,
    bairro: campos.bairro.trim() || null,
    cidade: campos.cidade.trim() || null,
    uf: campos.uf.trim() || null,
  };
}

export function camposDoEndereco(endereco: Endereco | null): CamposEndereco {
  return {
    cep: endereco?.cep ?? '',
    logradouro: endereco?.logradouro ?? '',
    numero: endereco?.numero ?? '',
    complemento: endereco?.complemento ?? '',
    bairro: endereco?.bairro ?? '',
    cidade: endereco?.cidade ?? '',
    uf: endereco?.uf ?? '',
  };
}

/** Para ativar uma entidade: só o complemento é dispensável. */
export function enderecoCompleto(campos: CamposEndereco): boolean {
  return Boolean(campos.cep.trim() && campos.logradouro.trim() && campos.numero.trim() && campos.bairro.trim() && campos.cidade.trim() && campos.uf.trim());
}

export function enderecoEmLinha(endereco: Endereco | null): string | null {
  if (!endereco) return null;
  const rua = [endereco.logradouro, endereco.numero, endereco.complemento].filter(Boolean).join(', ');
  const local = [endereco.bairro, endereco.cidade, endereco.uf].filter(Boolean).join(', ');
  const texto = [rua, local, endereco.cep].filter(Boolean).join(' · ');
  return texto || null;
}
