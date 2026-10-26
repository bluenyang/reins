import { describe, expect, it } from 'vitest';
import { isSecretPath } from '../src/lib/secrets.js';

describe('secret patterns (C4)', () => {
  it('flags env files, keys and java properties anywhere in the tree', () => {
    expect(isSecretPath('.env')).toBe('.env');
    expect(isSecretPath('apps/api/.env.production.local')).toBe('.env.*');
    expect(isSecretPath('deploy/secrets/db.yaml')).toBe('secrets/**');
    expect(isSecretPath('certs/server.pem')).toBe('*.pem');
    expect(isSecretPath('src/main/resources/application.properties')).toBe('*.properties');
  });
  it('lets templates through', () => {
    expect(isSecretPath('.env.example')).toBeNull();
    expect(isSecretPath('config/secret.example.yaml')).toBeNull();
    expect(isSecretPath('src/index.ts')).toBeNull();
  });
  it('catches any *.env file, but not templates (012 S-12)', () => {
    expect(isSecretPath('langfuse.env')).toBe('*.env');
    expect(isSecretPath('a/b.env')).toBe('*.env');
    expect(isSecretPath('x.env.example')).toBeNull();
    expect(isSecretPath('x.example.env')).toBeNull();
    expect(isSecretPath('.env.sample')).toBeNull();
  });
});
