import { randomBytes } from 'node:crypto';
import type { UserRole } from '../types.js';

const USERNAME_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function generateUsername(role: UserRole): string {
  const suffix = Array.from(randomBytes(6), (byte) =>
    USERNAME_ALPHABET[byte % USERNAME_ALPHABET.length],
  ).join('');
  return `${role}-${suffix}`;
}
