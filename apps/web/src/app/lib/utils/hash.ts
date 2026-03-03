/**
 * Create a deterministic JSON string from a value
 * Objects are sorted by key to ensure consistent output
 * @param value - Value to stringify
 * @returns Deterministic JSON string
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => [key, sortValue(nested)]);
    return Object.fromEntries(entries);
  }

  return value;
}

/**
 * Compute FNV-1a 32-bit hash of a string
 * @param input - String to hash
 * @returns 8-character hex hash string
 */
export function stableHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Create a stable hash from any payload object
 * @param payload - Object to hash
 * @returns Hash string with algorithm prefix
 */
export function createInputHash(payload: unknown): string {
  return `fnv1a32:${stableHash(stableStringify(payload))}`;
}
