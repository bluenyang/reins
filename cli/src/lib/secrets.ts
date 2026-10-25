import { matchesAny } from './glob.js';

/** Fallback secret-file patterns (red line C4) when no harness policy is present. */
export const DEFAULT_SECRET_PATTERNS: readonly string[] = [
  '.env',
  '.env.*',
  'secrets/**',
  '*.key',
  '*.pem',
  '*.p12',
  '*.pfx',
  '*.properties',
  'id_rsa',
  'id_rsa.*',
  'id_ed25519',
  'id_ed25519.*',
];

/** Templates that look like secrets but are fine to commit. */
export const DEFAULT_ALLOWED: readonly string[] = [
  '.env.example',
  '*.example',
  '*.example.*',
  '*.sample',
];

export function isSecretPath(
  path: string,
  patterns: readonly string[] = DEFAULT_SECRET_PATTERNS,
  allowed: readonly string[] = DEFAULT_ALLOWED,
): string | null {
  if (matchesAny(path, allowed)) return null;
  return matchesAny(path, patterns);
}
