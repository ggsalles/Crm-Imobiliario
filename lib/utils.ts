import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrencyBRL(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "R$ 0,00";
  
  let cents: number;
  if (typeof value === "string") {
    // Para inputs de digitação, pegamos apenas os dígitos
    const numeric = value.replace(/\D/g, "");
    cents = numeric ? parseInt(numeric, 10) : 0;
  } else {
    // Para valores numéricos (ex: do banco), convertemos para centavos
    cents = Math.round(Number(value) * 100);
  }
  
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function parseCurrencyBRLToNumber(formattedValue: string | number | null | undefined) {
  if (formattedValue === null || formattedValue === undefined || formattedValue === "") return 0;
  if (typeof formattedValue === "number") return formattedValue;
  
  const numericString = formattedValue.replace(/\D/g, "");
  return numericString ? parseInt(numericString, 10) / 100 : 0;
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
