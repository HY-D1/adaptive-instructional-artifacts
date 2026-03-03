/**
 * Counter for generating unique event IDs within the session
 */
let eventCounter = 0;

/**
 * Sanitize a string part for use in event IDs
 * @param part - The string to sanitize
 * @returns Sanitized string safe for ID use
 */
function sanitizePart(part: string): string {
  return part
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generate a random suffix for collision-resistant IDs
 * Uses crypto.randomUUID when available, falls back to timestamp+entropy
 * @returns Random suffix string
 */
function randomSuffix(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID().slice(0, 8);
  }
  // Fallback: use high-entropy timestamp + random for collision resistance
  // Add performance.now() for sub-millisecond precision to prevent collisions
  const timeEntropy = Date.now().toString(36);
  const perfEntropy = typeof performance !== 'undefined' 
    ? Math.floor(performance.now() % 1000).toString(36) 
    : Math.random().toString(36).slice(2, 5);
  const randomPart = Math.random().toString(36).slice(2, 7);
  const extraRandom = Math.random().toString(36).slice(2, 7);
  return `${timeEntropy}-${perfEntropy}-${randomPart}-${extraRandom}`;
}

/**
 * Create a unique event ID with timestamp and random suffix
 * @param prefix - Event type prefix (e.g., 'exec', 'hint', 'error')
 * @param parts - Additional identifier parts
 * @returns Unique event ID string
 * 
 * @example
 * createEventId('exec', 'user-123', 'problem-456')
 * // Returns: 'exec-1234567890000-abc123-user-123-problem-456'
 */
export function createEventId(prefix: string, ...parts: Array<string | number | undefined | null>): string {
  eventCounter = (eventCounter + 1) % 1_000_000_000;
  const base = [
    sanitizePart(prefix || 'event') || 'event',
    Date.now().toString(),
    eventCounter.toString(36),
    randomSuffix()
  ];

  const normalizedParts = parts
    .map((part) => (part === undefined || part === null ? '' : sanitizePart(String(part))))
    .filter(Boolean);

  return [...base, ...normalizedParts].join('-');
}
