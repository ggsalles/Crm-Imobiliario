import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface CurrencyFormatOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

export function formatCurrencyBRL(
  value: string | number | null | undefined,
  options?: CurrencyFormatOptions
) {
  if (value === null || value === undefined || value === "") {
    return options?.maximumFractionDigits === 0 ? "R$ 0" : "R$ 0,00";
  }
  
  let amount: number = 0;
  if (typeof value === "number") {
    amount = isNaN(value) ? 0 : value;
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    const num = Number(trimmed);
    if (!isNaN(num)) {
      amount = num;
    } else {
      // Formato pt-BR com vírgula ou separadores (ex: "1.500,50" ou "R$ 1.500")
      const cleaned = trimmed.replace(/[^\d,-]/g, "").replace(",", ".");
      const parsed = parseFloat(cleaned);
      amount = isNaN(parsed) ? 0 : parsed;
    }
  }
  
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: options?.minimumFractionDigits ?? (options?.maximumFractionDigits === 0 ? 0 : 2),
      maximumFractionDigits: options?.maximumFractionDigits ?? 2,
    }).format(amount);
  } catch {
    return `R$ ${amount.toFixed(2)}`;
  }
}

export function parseCurrencyBRLToNumber(formattedValue: string | number | null | undefined) {
  if (formattedValue === null || formattedValue === undefined || formattedValue === "") return 0;
  if (typeof formattedValue === "number") return formattedValue;
  
  const numericString = formattedValue.replace(/\D/g, "");
  return numericString ? parseInt(numericString, 10) / 100 : 0;
}

/**
 * Formata entradas de moeda em tempo real durante a digitação no padrão centavos/BRL.
 * Permite digitar zeros, deletar e preencher valores com máscara fluida.
 */
export function formatCurrencyInput(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number") {
    return value === 0 ? "" : formatCurrencyBRL(value);
  }
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return "";
  const num = parseInt(digits, 10) / 100;
  if (num === 0) return "";
  return formatCurrencyBRL(num);
}

export function formatPhone(v: string) {
  v = v.replace(/\D/g, "");
  if (v.length > 13) v = v.substring(0, 13);
  
  if (v.length <= 2) return v;
  if (v.length <= 4) return v.replace(/(\d{2})(\d{0,2})/, "$1 $2");
  if (v.length <= 9) return v.replace(/(\d{2})(\d{2})(\d{0,5})/, "$1 $2 $3");
  return v.replace(/(\d{2})(\d{2})(\d{5})(\d{0,4})/, "$1 $2 $3-$4").trim();
}

export function formatCEP(v: string) {
  v = v.replace(/\D/g, "");
  if (v.length > 8) v = v.substring(0, 8);
  if (v.length <= 5) return v;
  return v.replace(/(\d{5})(\d{0,3})/, "$1-$2");
}
