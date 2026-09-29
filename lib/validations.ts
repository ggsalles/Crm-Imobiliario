import { z } from 'zod';

/**
 * Helper para validar dados de forma segura com mensagens formatadas em português
 */
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
} {
  const result = schema.safeParse(data);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const fieldName = firstIssue?.path.join('.') || 'campo';
    const message = firstIssue?.message || 'Dados inválidos';
    return {
      success: false,
      error: `${message} (${fieldName})`,
    };
  }
  return {
    success: true,
    data: result.data,
  };
}

/**
 * Schema para captura pública de leads na Vitrine ou Página de Imóvel (/api/public-capture)
 */
export const publicLeadCaptureSchema = z.object({
  propertyId: z.string().min(1, 'Identificador do imóvel é obrigatório'),
  name: z.string()
    .trim()
    .min(2, 'O nome deve ter pelo menos 2 caracteres')
    .max(120, 'O nome não pode exceder 120 caracteres'),
  email: z.string()
    .trim()
    .email('Formato de e-mail inválido')
    .toLowerCase(),
  phone: z.string()
    .trim()
    .min(8, 'Telefone deve conter no mínimo 8 dígitos')
    .max(30, 'Telefone inválido'),
  message: z.string()
    .trim()
    .max(1000, 'Mensagem não pode exceder 1000 caracteres')
    .optional(),
});

/**
 * Schema para redefinição de senha com palavra-chave de segurança (/api/auth/keyword-reset)
 */
export const keywordResetSchema = z.object({
  email: z.string()
    .trim()
    .email('Formato de e-mail inválido')
    .toLowerCase(),
  securityKeyword: z.string()
    .trim()
    .min(2, 'A palavra-chave secreta é obrigatória'),
  newPassword: z.string()
    .min(6, 'A nova senha deve ter no mínimo 6 caracteres')
    .max(128, 'A nova senha não pode exceder 128 caracteres'),
});

/**
 * Schema para atualização cadastral ou limites de plano de imobiliárias (/api/tenants)
 */
export const tenantUpdateSchema = z.object({
  name: z.string().trim().min(2, 'Nome da imobiliária deve ter no mínimo 2 caracteres').optional(),
  cnpj: z.string().trim().max(25, 'CNPJ inválido').optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(20).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  contactEmail: z.string().trim().email('E-mail de contato inválido').optional().or(z.literal('')).nullable(),
  brokerLimit: z.number().int().min(1, 'Limite mínimo de 1 corretor').optional(),
  adminLimit: z.number().int().min(1, 'Limite mínimo de 1 gestor').optional(),
  userLimit: z.number().int().min(1, 'Limite de usuários inválido').optional(),
  extraBrokerPrice: z.number().min(0, 'Preço de corretor extra inválido').optional(),
  extraAdminPrice: z.number().min(0, 'Preço de gestor extra inválido').optional(),
  dueDay: z.number().int().min(1).max(31).optional(),
  isBlocked: z.boolean().optional(),
  isManuallyUnlocked: z.boolean().optional(),
}).passthrough();
