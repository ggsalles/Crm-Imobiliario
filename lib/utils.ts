import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrencyBRL(value: string | number) {
  const amount = typeof value === 'string' 
    ? value.replace(/\D/g, '') 
    : Math.round(Number(value) * 100).toString();
  
  if (!amount || amount === '0') return 'R$ 0,00';
  
  const numberValue = parseInt(amount, 10) / 100;
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numberValue);
}

export function parseCurrencyBRLToNumber(formattedValue: string) {
  if (!formattedValue) return 0;
  const numericString = formattedValue.replace(/\D/g, '');
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
