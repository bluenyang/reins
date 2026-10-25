import { matchesAny } from './glob.js';

/** Default secret-file patterns (design C4). A project adds its own in gates.yaml `secrets:`. */
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

/** Files that look like secrets but are templates, and are fine to commit. */
const ALLOWED: readonly string[] = ['.env.example', '*.example', '*.example.*', '*.sample'];

export function isSecretPath(
  path: string,
  patterns: readonly string[] = DEFAULT_SECRET_PATTERNS,
): string | null {
  if (matchesAny(path, ALLOWED)) return null;
  return matchesAny(path, patterns);
}
