import { createHmac } from 'node:crypto';

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/**
 * One CSV cell. Every cell is escaped (commas, quotes, CR/LF), and string
 * values that a spreadsheet would execute as a formula get a leading quote.
 * Numbers are left as-is so negative values stay numeric.
 */
export function toCsvCell(value: unknown, fallback = ''): string {
  let text: string;
  if (value === null || value === undefined) {
    text = fallback;
  } else if (typeof value === 'string') {
    text = FORMULA_PREFIX.test(value) ? `'${value}` : value;
  } else if (value instanceof Date) {
    text = Number.isFinite(value.getTime()) ? value.toISOString() : '';
  } else if (typeof value === 'object') {
    text = JSON.stringify(value);
  } else {
    text = String(value);
  }
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Research exports are shared beyond the instructor, so by default learners
 * are identified by their generated username, not their real name, and email
 * hashes are re-keyed with RESEARCH_EXPORT_HASH_SECRET (dropped if unset,
 * because an unsalted SHA-256 of an institutional email is guessable).
 */
export function pseudonymizeLearner<T extends { id: string; name?: string; username?: string | null }>(
  learner: T,
  includeNames: boolean,
): Omit<T, 'name'> & { name?: string } {
  if (includeNames) return learner;
  const { name: _name, ...rest } = learner;
  return rest;
}

export function rekeyEmailHash(emailHash: string | null | undefined, secret = process.env.RESEARCH_EXPORT_HASH_SECRET): string | null {
  if (!emailHash || !secret?.trim()) return null;
  return createHmac('sha256', secret).update(emailHash).digest('hex');
}
