import { createHash } from 'node:crypto';
import { generateApiKey, hashApiKey } from './api-key';

describe('api-key', () => {
  it('generates keys with ipam- prefix and 32 hex chars', () => {
    expect(generateApiKey()).toMatch(/^ipam-[0-9a-f]{32}$/);
  });

  it('generates unique keys', () => {
    const keys = new Set(Array.from({ length: 50 }, () => generateApiKey()));
    expect(keys.size).toBe(50);
  });

  it('hashes with sha256 hex', () => {
    const key = 'ipam-abcdef0123456789abcdef0123456789';
    const expected = createHash('sha256').update(key).digest('hex');
    expect(hashApiKey(key)).toBe(expected);
    expect(hashApiKey(key)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic', () => {
    expect(hashApiKey('ipam-x')).toBe(hashApiKey('ipam-x'));
  });

  it('produces different hashes for different keys', () => {
    expect(hashApiKey('ipam-a')).not.toBe(hashApiKey('ipam-b'));
  });
});
