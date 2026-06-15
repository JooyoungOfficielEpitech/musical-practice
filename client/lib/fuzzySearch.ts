/**
 * Simple fuzzy search utilities for score filtering.
 * Uses case-insensitive substring matching with diacritic normalization.
 */

interface Searchable {
  title: string;
  artist: string;
}

/**
 * Normalizes a string by removing diacritics and converting to lowercase.
 * @param text The text to normalize
 * @returns Normalized text
 */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // Remove diacritics
    .toLowerCase()
    .trim();
}

/**
 * Filters an item by search query using case-insensitive substring matching.
 * @param item The item to filter (must have title and artist)
 * @param query The search query
 * @returns true if item matches query, false otherwise
 */
export function fuzzySearchFilter(item: Searchable, query: string): boolean {
  if (!query || query.trim().length === 0) {
    return true;
  }

  const normalizedQuery = normalize(query);
  const normalizedTitle = normalize(item.title);
  const normalizedArtist = normalize(item.artist);

  return normalizedTitle.includes(normalizedQuery) || normalizedArtist.includes(normalizedQuery);
}
