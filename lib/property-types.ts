/**
 * Definição centralizada e unificada dos Tipos de Imóveis no SalesScore CRM.
 * Garante 100% de paridade entre a combo do formulário de cadastro/edição,
 * os botões de filtro do inventário e a vitrine pública.
 */

export interface PropertyTypeConfig {
  id: string;
  label: string;
  aliases: string[];
}

export const PROPERTY_TYPES_LIST: PropertyTypeConfig[] = [
  { 
    id: 'apartamento', 
    label: 'Apartamento', 
    aliases: ['apartamento', 'apartamentos', 'ap', 'departamento'] 
  },
  { 
    id: 'casa', 
    label: 'Casa', 
    aliases: ['casa', 'casas', 'residencia'] 
  },
  { 
    id: 'condomínio', 
    label: 'Casa em Condomínio', 
    aliases: ['condominio', 'condomínio', 'casa em condominio', 'casa em condomínio'] 
  },
  { 
    id: 'cobertura', 
    label: 'Cobertura', 
    aliases: ['cobertura', 'coberturas'] 
  },
  { 
    id: 'sobrado', 
    label: 'Sobrado', 
    aliases: ['sobrado', 'sobrados'] 
  },
  { 
    id: 'studio', 
    label: 'Studio / Loft / Flat', 
    aliases: ['studio', 'studios', 'loft', 'lofts', 'flat', 'flats', 'kitnet', 'kitnets', 'kit'] 
  },
  { 
    id: 'sala', 
    label: 'Sala Comercial', 
    aliases: ['sala', 'salas', 'sala comercial', 'salas comerciais', 'consultorio', 'consultório'] 
  },
  { 
    id: 'comercial', 
    label: 'Prédio / Ponto Comercial', 
    aliases: ['comercial', 'predio', 'prédio', 'ponto comercial', 'predio comercial', 'prédio comercial', 'loja', 'lojas'] 
  },
  { 
    id: 'galpão', 
    label: 'Galpão / Depósito', 
    aliases: ['galpao', 'galpão', 'galpoes', 'galpões', 'deposito', 'depósito', 'barracao', 'barracão'] 
  },
  { 
    id: 'terreno', 
    label: 'Terreno / Lote', 
    aliases: ['terreno', 'terrenos', 'lote', 'lotes', 'loteamento'] 
  },
  { 
    id: 'chácara', 
    label: 'Chácara', 
    aliases: ['chacara', 'chácara', 'chacaras', 'chácaras'] 
  },
  { 
    id: 'sítio', 
    label: 'Sítio', 
    aliases: ['sitio', 'sítio', 'sitios', 'sítios'] 
  },
  { 
    id: 'fazenda', 
    label: 'Fazenda', 
    aliases: ['fazenda', 'fazendas', 'haras'] 
  },
  { 
    id: 'outros', 
    label: 'Outro Tipo', 
    aliases: ['outros', 'outro', 'outro tipo'] 
  },
];

/**
 * Validador inteligente de tipo de imóvel:
 * Compara o tipo do imóvel com o ID do filtro considerando acentuação e variantes.
 */
export function matchPropertyType(propertyType: string | undefined | null, filterTypeId: string): boolean {
  if (!filterTypeId || filterTypeId === 'all') return true;
  if (!propertyType) return filterTypeId === 'outros';

  const normP = propertyType.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  if (filterTypeId === 'outros') {
    // Se for 'outros', confere se não bate com nenhum dos tipos específicos
    const matchesKnown = PROPERTY_TYPES_LIST
      .filter(t => t.id !== 'outros')
      .some(t => {
        const normId = t.id.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        if (normP === normId) return true;
        return t.aliases.some(alias => {
          const normAlias = alias.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
          return normP === normAlias;
        });
      });
    return !matchesKnown || normP === 'outros' || normP === 'outro' || normP === 'outro tipo';
  }

  const config = PROPERTY_TYPES_LIST.find(t => t.id === filterTypeId);
  if (!config) {
    const normFilter = filterTypeId.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    return normP === normFilter;
  }

  const normId = config.id.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (normP === normId) return true;

  return config.aliases.some(alias => {
    const normAlias = alias.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    return normP === normAlias;
  });
}

/**
 * Retorna o rótulo amigável (label) correspondente ao tipo de imóvel.
 */
export function getPropertyTypeLabel(typeId: string | undefined | null): string {
  if (!typeId) return 'Não informado';
  const norm = typeId.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const found = PROPERTY_TYPES_LIST.find(t => {
    const normId = t.id.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (norm === normId) return true;
    return t.aliases.some(a => a.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() === norm);
  });
  return found ? found.label : typeId;
}
