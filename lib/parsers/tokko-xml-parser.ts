import { PropertyType } from '../db/types';

/**
 * Parser especializado para exportações XML do Tokko Broker.
 * Suporta XML de Imóveis (<properties>) e XML de Contatos/Leads (<contacts>).
 * Roda de forma ultrarrápida no navegador via DOMParser.
 */

export interface ParsedTokkoContact {
  externalId: string;
  name: string;
  email: string;
  phone: string;
  leadStatus: string;
  source: string;
  tags: string[];
  agentName: string;
  agentEmail: string;
  featuredPropertyRef: string;
  isOwner: boolean;
  isDeleted: boolean;
  createdAt: string;
}

export interface ParsedTokkoProperty {
  externalId: string;
  referenceCode: string;
  title: string;
  type: PropertyType;
  status: 'disponível' | 'reservado' | 'vendido' | 'alugado';
  operationType: 'venda' | 'locacao' | 'ambos';
  price: number;
  condoFee: number;
  iptu: number;
  area: number;
  bedrooms: number;
  suites: number;
  bathrooms: number;
  parkingSpots: number;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  cep: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  buildingName: string;
  description: string;
  tags: string[];
  imageUrls: string[];
  ownerName: string;
  ownerPhone: string;
  realtorName: string;
  isDeleted: boolean;
  createdAt: string;
}

export interface TokkoParseResult {
  kind: 'properties' | 'contacts' | 'unknown';
  totalCountInMeta: number;
  totalParsed: number;
  activeCount: number;
  deletedCount: number;
  contacts?: ParsedTokkoContact[];
  properties?: ParsedTokkoProperty[];
  sampleItems: Array<ParsedTokkoContact | ParsedTokkoProperty>;
}

function getText(element: Element, tagName: string): string {
  const node = element.getElementsByTagName(tagName)[0];
  if (!node) return '';
  if (node.getAttribute('nil') === 'true' || node.getAttribute('xsi:nil') === 'true') return '';
  const text = node.textContent?.trim() || '';
  const lower = text.toLowerCase();
  return (lower === 'null' || lower === 'nil' || lower === 'none' || lower === 'undefined') ? '' : text;
}

function getDirectChildText(element: Element, tagName: string): string {
  for (let i = 0; i < element.children.length; i++) {
    const child = element.children[i];
    if (child.tagName.toLowerCase() === tagName.toLowerCase()) {
      if (child.getAttribute('nil') === 'true' || child.getAttribute('xsi:nil') === 'true') {
        return '';
      }
      const text = child.textContent?.trim() || '';
      const lower = text.toLowerCase();
      if (lower === 'null' || lower === 'nil' || lower === 'none' || lower === 'undefined') {
        return '';
      }
      return text;
    }
  }
  return '';
}

function isRealDeletedTimestamp(val: string): boolean {
  if (!val) return false;
  const cleaned = val.toLowerCase().trim();
  if (['none', 'null', 'nil', 'false', '0', 'undefined', 'n/a', 'no', '0000-00-00', '0000-00-00 00:00:00'].includes(cleaned)) {
    return false;
  }
  // Deve conter formato de data real (ex: 2021-05-10 ou 2024/02/01)
  return /(?:19|20)\d{2}[-/.]\d{1,2}[-/.]\d{1,2}/.test(cleaned);
}

function parseNumber(val: string): number {
  if (!val) return 0;
  const cleaned = val.replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function normalizePropertyType(rawType: string): ParsedTokkoProperty['type'] {
  const lower = rawType.toLowerCase();
  if (lower.includes('cobertura')) {
    return 'cobertura';
  }
  if (lower.includes('sobrado')) {
    return 'sobrado';
  }
  if (lower.includes('casa em condominio') || lower.includes('casa em condomínio') || lower.includes('condominio fechado') || lower.includes('condomínio fechado')) {
    return 'condomínio';
  }
  if (lower.includes('studio') || lower.includes('kitnet') || lower.includes('loft') || lower.includes('flat')) {
    return 'studio';
  }
  if (lower.includes('apartamento') || lower.includes('departamento') || lower.includes('apto')) {
    return 'apartamento';
  }
  if (lower.includes('casa') || lower.includes('residencia')) {
    return 'casa';
  }
  if (lower.includes('condom') || lower.includes('condominio') || lower.includes('condomínio')) {
    return 'condomínio';
  }
  if (lower.includes('terreno') || lower.includes('lote')) {
    return 'terreno';
  }
  if (lower.includes('galpao') || lower.includes('galpão') || lower.includes('deposito') || lower.includes('depósito') || lower.includes('barracao') || lower.includes('barracão')) {
    return 'galpão';
  }
  if (lower.includes('sala') || lower.includes('consultorio') || lower.includes('consultório')) {
    return 'sala';
  }
  if (lower.includes('predio') || lower.includes('prédio') || lower.includes('edificio') || lower.includes('edifício') || lower.includes('comercial') || lower.includes('loja') || lower.includes('ponto')) {
    return 'comercial';
  }
  if (lower.includes('sitio') || lower.includes('sítio')) {
    return 'sítio';
  }
  if (lower.includes('chacara') || lower.includes('chácara')) {
    return 'chácara';
  }
  if (lower.includes('fazenda') || lower.includes('haras')) {
    return 'fazenda';
  }
  if (lower.includes('ap')) {
    return 'apartamento';
  }
  return 'outros';
}

export function parseTokkoXml(xmlContent: string): TokkoParseResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'text/xml');

  // Check for XML parsing error
  const parserError = doc.getElementsByTagName('parsererror')[0];
  if (parserError) {
    throw new Error('O arquivo XML possui erros de sintaxe ou tags corrompidas: ' + parserError.textContent);
  }

  const root = doc.documentElement;
  const metaCountNode = root.querySelector('meta > total_count');
  const totalCountInMeta = metaCountNode ? parseInt(metaCountNode.textContent || '0', 10) : 0;

  // 1. Detectar se é XML de Contatos
  const contactNodes = root.getElementsByTagName('contact');
  if (contactNodes.length > 0 || root.tagName.toLowerCase() === 'contacts') {
    const contacts: ParsedTokkoContact[] = [];
    let deletedCount = 0;

    for (let i = 0; i < contactNodes.length; i++) {
      const node = contactNodes[i];
      const deletedAt = getDirectChildText(node, 'deleted_at');
      const isDeleted = isRealDeletedTimestamp(deletedAt);
      if (isDeleted) deletedCount++;

      // Tags & Origin
      const tagNodes = node.querySelectorAll('tags > tag > name');
      const tags: string[] = [];
      let source = 'Tokko Broker';
      for (let t = 0; t < tagNodes.length; t++) {
        const tagText = tagNodes[t].textContent?.trim() || '';
        if (tagText) {
          tags.push(tagText);
          const lower = tagText.toLowerCase();
          if (lower.includes('viva real') || lower.includes('vivareal')) source = 'Viva Real';
          else if (lower.includes('zap')) source = 'ZAP Imóveis';
          else if (lower.includes('imovelweb')) source = 'Imovelweb';
          else if (lower.includes('olx')) source = 'OLX';
          else if (lower.includes('web') || lower.includes('portal')) source = 'Portal Web';
          else if (lower.includes('facebook') || lower.includes('instagram')) source = 'Redes Sociais';
        }
      }

      // Featured property reference
      const featRefNode = node.querySelector('featured_properties > featured_property > reference');
      const featRef = featRefNode?.textContent?.trim() || '';

      // Phone
      const phone = getDirectChildText(node, 'phone') || getDirectChildText(node, 'cellphone') || '';
      
      // Agent
      const agentName = node.querySelector('agent > name')?.textContent?.trim() || '';
      const agentEmail = node.querySelector('agent > email')?.textContent?.trim() || '';

      contacts.push({
        externalId: getDirectChildText(node, 'id'),
        name: getDirectChildText(node, 'name') || 'Sem Nome',
        email: getDirectChildText(node, 'email'),
        phone: phone,
        leadStatus: getDirectChildText(node, 'lead_status') || 'Novo Lead',
        source,
        tags,
        agentName,
        agentEmail,
        featuredPropertyRef: featRef,
        isOwner: getDirectChildText(node, 'is_owner') === 'true',
        isDeleted,
        createdAt: getDirectChildText(node, 'created_at') || new Date().toISOString()
      });
    }

    return {
      kind: 'contacts',
      totalCountInMeta: totalCountInMeta || contacts.length,
      totalParsed: contacts.length,
      activeCount: contacts.length - deletedCount,
      deletedCount,
      contacts,
      sampleItems: contacts.slice(0, 3)
    };
  }

  // 2. Detectar se é XML de Imóveis
  const propertyNodes = root.getElementsByTagName('property');
  if (propertyNodes.length > 0 || root.tagName.toLowerCase() === 'properties') {
    const properties: ParsedTokkoProperty[] = [];
    let deletedCount = 0;

    for (let i = 0; i < propertyNodes.length; i++) {
      const node = propertyNodes[i];
      const deletedAt = getDirectChildText(node, 'deleted_at');
      const isDeleted = isRealDeletedTimestamp(deletedAt);
      if (isDeleted) deletedCount++;

      // Price & Operations
      const priceNode = node.querySelector('operations > operation > prices > price > price');
      const rawPrice = priceNode?.textContent?.trim() || '0';
      const price = parseNumber(rawPrice);

      const opTypeNode = node.querySelector('operations > operation > operation_type');
      const rawOp = opTypeNode?.textContent?.trim().toLowerCase() || 'venta';
      let operationType: ParsedTokkoProperty['operationType'] = 'venda';
      if (rawOp.includes('alquiler') || rawOp.includes('locacao') || rawOp.includes('locação')) {
        operationType = 'locacao';
      }

      // Photos
      const photoNodes = node.querySelectorAll('photos > photo > image');
      const imageUrls: string[] = [];
      for (let p = 0; p < photoNodes.length; p++) {
        const url = photoNodes[p].textContent?.trim() || '';
        if (url.startsWith('http')) {
          imageUrls.push(url);
        }
      }

      // Location
      const street = getDirectChildText(node, 'address') || getDirectChildText(node, 'real_address') || '';
      const neighborhood = node.querySelector('location > name')?.textContent?.trim() || '';
      const shortLocation = node.querySelector('location > short_location')?.textContent?.trim() || '';
      const locationParts = shortLocation.split('|').map(s => s.trim());
      const state = locationParts.length > 0 ? locationParts[0] : 'RJ';
      const city = locationParts.length > 1 ? locationParts[1] : (neighborhood ? 'São Gonçalo' : 'Rio de Janeiro');
      const cep = getDirectChildText(node, 'zip_code') || '';
      const fullLocation = [neighborhood, city, state].filter(Boolean).join(', ') || street;

      // Reference & Title
      const refCode = getDirectChildText(node, 'reference_code');
      const rawTitle = getDirectChildText(node, 'publication_title');

      // Type
      const typeCode = node.querySelector('type > code')?.textContent?.trim() || '';
      const typeName = node.querySelector('type > name')?.textContent?.trim() || '';
      const normalizedType = normalizePropertyType(`${typeName} ${typeCode} ${rawTitle} ${refCode}`);

      // Areas & Rooms
      const surface = parseNumber(getDirectChildText(node, 'surface')) || parseNumber(getDirectChildText(node, 'livable_area')) || parseNumber(getDirectChildText(node, 'total_area'));
      const bedrooms = Math.round(parseNumber(getDirectChildText(node, 'suite_amount')) || parseNumber(getDirectChildText(node, 'room_amount')));
      const bathrooms = Math.round(parseNumber(getDirectChildText(node, 'bathroom_amount')));
      const parking = Math.round(parseNumber(getDirectChildText(node, 'parking_lot_amount')) || parseNumber(getDirectChildText(node, 'covered_parking_lot')));
      const condoFee = parseNumber(getDirectChildText(node, 'expenses'));
      const iptu = parseNumber(getDirectChildText(node, 'iptu'));

      // Building name
      const buildingName = node.querySelector('extra_attributes > extra_attribute > name') ? (() => {
        const extraNodes = node.querySelectorAll('extra_attributes > extra_attribute');
        for (let e = 0; e < extraNodes.length; e++) {
          const name = extraNodes[e].querySelector('name')?.textContent?.trim();
          if (name?.toLowerCase().includes('edifício') || name?.toLowerCase().includes('edificio') || name?.toLowerCase().includes('empreendimento')) {
            return extraNodes[e].querySelector('value')?.textContent?.trim() || '';
          }
        }
        return '';
      })() : '';

      // Owner & Realtor
      const ownerName = node.querySelector('internal_data > property_owners > property_owner > name')?.textContent?.trim() || '';
      const ownerPhone = node.querySelector('internal_data > property_owners > property_owner > cellphone')?.textContent?.trim() || '';
      const realtorName = node.querySelector('producer > name')?.textContent?.trim() || '';

      // Tags
      const tagNodes = node.querySelectorAll('tags > tag > name');
      const tags: string[] = [];
      if (operationType === 'venda') tags.push('Venda');
      else tags.push('Locação');
      
      for (let t = 0; t < Math.min(tagNodes.length, 10); t++) {
        const tagText = tagNodes[t].textContent?.trim() || '';
        if (tagText && !tags.includes(tagText)) tags.push(tagText);
      }

      const title = getDirectChildText(node, 'publication_title') || 
                    `${normalizedType.toUpperCase()} em ${neighborhood || city} - Ref ${refCode}`;

      // Intelligent Status detection from Tokko XML fields & tags
      // ATENÇÃO: Em espanhol (Tokko), 'Alquiler' = Locação (tipo de operação), e NÃO 'Alugado' (status).
      const rawStatus = (
        getDirectChildText(node, 'status') ||
        getDirectChildText(node, 'status_id') ||
        getDirectChildText(node, 'publication_status') ||
        ''
      ).toLowerCase();

      let normalizedStatus: ParsedTokkoProperty['status'] = 'disponível';
      const isSold = getDirectChildText(node, 'is_sold') === 'true' || getDirectChildText(node, 'is_sold') === '1' || rawStatus === 'vendido' || rawStatus === 'vendida' || rawStatus === 'sold';
      const isReserved = getDirectChildText(node, 'is_reserved') === 'true' || getDirectChildText(node, 'is_reserved') === '1' || rawStatus === 'reservado' || rawStatus === 'reservada' || rawStatus === 'reserved';
      const isRented = getDirectChildText(node, 'is_rented') === 'true' || getDirectChildText(node, 'is_rented') === '1' || rawStatus === 'alugado' || rawStatus === 'alugada' || rawStatus === 'alquilado' || rawStatus === 'alquilada' || rawStatus === 'rented' || rawStatus === 'locado';

      if (isSold) {
        normalizedStatus = 'vendido';
      } else if (isReserved) {
        normalizedStatus = 'reservado';
      } else if (isRented) {
        normalizedStatus = 'alugado';
      } else {
        for (const tag of tags) {
          const lowerTag = tag.toLowerCase();
          if (lowerTag === 'reservado' || lowerTag === 'reservada') {
            normalizedStatus = 'reservado';
            break;
          } else if (lowerTag === 'vendido' || lowerTag === 'vendida' || lowerTag === 'escriturado') {
            normalizedStatus = 'vendido';
            break;
          } else if (lowerTag === 'alugado' || lowerTag === 'alugada' || lowerTag === 'locado') {
            normalizedStatus = 'alugado';
            break;
          }
        }
      }

      properties.push({
        externalId: getDirectChildText(node, 'id'),
        referenceCode: refCode,
        title,
        type: normalizedType,
        status: normalizedStatus,
        operationType,
        price,
        condoFee,
        iptu,
        area: surface || 50,
        bedrooms: bedrooms || 1,
        suites: 0,
        bathrooms: bathrooms || 1,
        parkingSpots: parking || 0,
        street,
        number: getDirectChildText(node, 'apartment_door') || '',
        neighborhood,
        city,
        state,
        cep,
        location: fullLocation,
        latitude: parseNumber(getDirectChildText(node, 'geo_lat')) || null,
        longitude: parseNumber(getDirectChildText(node, 'geo_long')) || null,
        buildingName,
        description: getDirectChildText(node, 'description') || getDirectChildText(node, 'rich_description'),
        tags,
        imageUrls,
        ownerName,
        ownerPhone,
        realtorName,
        isDeleted,
        createdAt: getDirectChildText(node, 'created_at') || new Date().toISOString()
      });
    }

    return {
      kind: 'properties',
      totalCountInMeta: totalCountInMeta || properties.length,
      totalParsed: properties.length,
      activeCount: properties.length - deletedCount,
      deletedCount,
      properties,
      sampleItems: properties.slice(0, 3)
    };
  }

  return {
    kind: 'unknown',
    totalCountInMeta: 0,
    totalParsed: 0,
    activeCount: 0,
    deletedCount: 0,
    sampleItems: []
  };
}
