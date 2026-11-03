/**
 * Convert a CORS origin pattern such as `https://my-app-*-team.vercel.app`
 * into an anchored RegExp. `*` matches one DNS-label fragment only
 * (lowercase letters, digits, hyphens), never dots or slashes, so a pattern
 * cannot be satisfied by an attacker-controlled subdomain or path.
 */
export function wildcardPatternToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '[a-z0-9-]+');
  return new RegExp(`^${escaped}$`);
}
