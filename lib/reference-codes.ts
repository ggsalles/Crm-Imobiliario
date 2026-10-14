/**
 * Regras e validações centralizadas para Códigos de Referência de Imóveis no CRM.
 * Garante padronização rigorosa de siglas e numerações em toda a aplicação.
 */

export interface PrefixInfo {
  prefix: string;
  typeId: string;
  label: string;
}

export const OFFICIAL_PREFIX_MAP: Record<string, PrefixInfo> = {
  AP: { prefix: 'AP', typeId: 'apartamento', label: 'Apartamento' },
  CA: { prefix: 'CA', typeId: 'casa', label: 'Casa' },
  CD: { prefix: 'CD', typeId: 'condomínio', label: 'Casa em Condomínio' },
  CO: { prefix: 'CO', typeId: 'cobertura', label: 'Cobertura' },
  SO: { prefix: 'SO', typeId: 'sobrado', label: 'Sobrado' },
  ST: { prefix: 'ST', typeId: 'studio', label: 'Studio / Loft / Flat' },
  SL: { prefix: 'SL', typeId: 'sala', label: 'Sala Comercial' },
  CM: { prefix: 'CM', typeId: 'comercial', label: 'Prédio / Ponto Comercial' },
  GP: { prefix: 'GP', typeId: 'galpão', label: 'Galpão / Depósito' },
  PR: { prefix: 'PR', typeId: 'prédio', label: 'Prédio Inteiro' },
  TR: { prefix: 'TR', typeId: 'terreno', label: 'Terreno / Lote' },
  CH: { prefix: 'CH', typeId: 'chácara', label: 'Chácara' },
  SI: { prefix: 'SI', typeId: 'sítio', label: 'Sítio' },
  FZ: { prefix: 'FZ', typeId: 'fazenda', label: 'Fazenda' },
  IM: { prefix: 'IM', typeId: 'outros', label: 'Imóvel Geral' },
};

export const TYPE_TO_PREFIX_MAP: Record<string, string> = {
  apartamento: 'AP',
  casa: 'CA',
  'condomínio': 'CD',
  condominio: 'CD',
  cobertura: 'CO',
  sobrado: 'SO',
  studio: 'ST',
  sala: 'SL',
  comercial: 'CM',
  'galpão': 'GP',
  galpao: 'GP',
  'prédio': 'PR',
  predio: 'PR',
  terreno: 'TR',
  'chácara': 'CH',
  chacara: 'CH',
  'sítio': 'SI',
  sitio: 'SI',
  fazenda: 'FZ',
  outros: 'IM',
};

/**
 * Normaliza o código de referência removendo espaços, hífens e convertendo em maiúsculas.
 */
export function normalizeReferenceCode(code: string | null | undefined): string {
  if (!code) return '';
  return String(code).trim().replace(/\s+/g, '').replace(/-/g, '').toUpperCase();
}

/**
 * Retorna a sigla oficial correspondente ao tipo de imóvel informado.
 */
export function getOfficialPrefixForType(type: string | undefined | null): string {
  if (!type) return 'IM';
  const clean = String(type).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [key, prefix] of Object.entries(TYPE_TO_PREFIX_MAP)) {
    const cleanKey = key.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (clean === cleanKey) return prefix;
  }
  return 'IM';
}

export interface ReferenceValidationResult {
  isValid: boolean;
  normalizedCode: string;
  prefix: string | null;
  number: number | null;
  error?: string;
  warning?: string;
  suggestion?: string;
}

/**
 * Validação rigorosa da estrutura e sigla do código de referência.
 */
export function validateReferenceCodeStructure(
  rawCode: string | null | undefined,
  selectedType?: string | null
): ReferenceValidationResult {
  const normalized = normalizeReferenceCode(rawCode);

  // Se vazio, é considerado válido para auto-geração
  if (!normalized) {
    return {
      isValid: true,
      normalizedCode: '',
      prefix: null,
      number: null,
    };
  }

  // 1. Rejeita caracteres inválidos (símbolos, pontuações, etc.)
  if (!/^[A-Za-z0-9]+$/.test(normalized)) {
    return {
      isValid: false,
      normalizedCode: normalized,
      prefix: null,
      number: null,
      error: 'O código de referência deve conter apenas letras e números, sem símbolos ou pontuações (ex: AP2186).'
    };
  }

  // 2. Rejeita códigos sem sigla (somente números, ex: 2186)
  if (/^\d+$/.test(normalized)) {
    const expectedPrefix = selectedType ? getOfficialPrefixForType(selectedType) : 'AP';
    return {
      isValid: false,
      normalizedCode: normalized,
      prefix: null,
      number: parseInt(normalized, 10),
      error: `Código sem sigla! Adicione a sigla do imóvel antes do número (ex: ${expectedPrefix}${normalized}).`,
      suggestion: `${expectedPrefix}${normalized}`
    };
  }

  // 3. Rejeita códigos sem número (somente letras, ex: AP ou TESTE)
  if (/^[A-Za-z]+$/.test(normalized)) {
    return {
      isValid: false,
      normalizedCode: normalized,
      prefix: normalized,
      number: null,
      error: `Falta a numeração após a sigla (ex: ${normalized}0001 ou ${normalized}2186).`
    };
  }

  // 4. Extrai a sigla e o número (formato padrão: SIGLA + NÚMERO)
  const match = normalized.match(/^([A-Za-z]+)(\d+)$/);
  if (!match) {
    return {
      isValid: false,
      normalizedCode: normalized,
      prefix: null,
      number: null,
      error: 'Formato inválido. O código deve ser composto por sigla seguida de números (ex: AP2186, CA0150).'
    };
  }

  const prefix = match[1].toUpperCase();
  const numPart = parseInt(match[2], 10);

  // 5. Valida se a sigla existe no catálogo oficial de siglas homologadas
  const prefixConfig = OFFICIAL_PREFIX_MAP[prefix];
  if (!prefixConfig) {
    const allowedList = Object.keys(OFFICIAL_PREFIX_MAP).join(', ');
    return {
      isValid: false,
      normalizedCode: normalized,
      prefix,
      number: numPart,
      error: `A sigla "${prefix}" não é uma sigla válida de imóvel. Siglas oficiais permitidas: ${allowedList}.`
    };
  }

  // 6. Alerta de divergência entre a sigla digitada e o tipo selecionado no formulário
  let warning: string | undefined = undefined;
  if (selectedType) {
    const expectedPrefix = getOfficialPrefixForType(selectedType);
    if (expectedPrefix && expectedPrefix !== 'IM' && prefix !== expectedPrefix) {
      const typeLabel = OFFICIAL_PREFIX_MAP[expectedPrefix]?.label || selectedType;
      warning = `Atenção: A sigla "${prefix}" é de ${prefixConfig.label}, mas o tipo selecionado é "${typeLabel}" (sigla esperada: ${expectedPrefix}).`;
    }
  }

  return {
    isValid: true,
    normalizedCode: normalized,
    prefix,
    number: numPart,
    warning
  };
}
