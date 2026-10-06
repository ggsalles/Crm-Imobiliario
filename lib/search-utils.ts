/**
 * Utilitários de normalização e busca inteligente multi-termo para imóveis e endereços.
 */

export function normalizeSearchText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentuação
    .replace(/[,;.\-\/ºª#]/g, " ")    // substitui pontuações por espaço
    .replace(/\s+/g, " ")             // unifica múltiplos espaços
    .trim();
}

export function matchSearchTerms(
  targetText: string | null | undefined,
  searchQuery: string | null | undefined
): boolean {
  if (!searchQuery || !searchQuery.trim()) return true;
  if (!targetText) return false;

  const normQuery = normalizeSearchText(searchQuery);
  if (!normQuery) return true;

  const normTarget = normalizeSearchText(targetText);
  if (!normTarget) return false;

  if (normTarget.includes(normQuery)) return true;

  const queryTokens = normQuery.split(" ").filter((t) => t.length > 0);
  if (queryTokens.length === 0) return true;

  return queryTokens.every((token) => normTarget.includes(token));
}
