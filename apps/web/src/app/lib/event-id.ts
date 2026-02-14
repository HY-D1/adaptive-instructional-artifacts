let eventCounter = 0;

function sanitizePart(part: string): string {
  return part
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function randomSuffix(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

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
