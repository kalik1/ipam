import { createHash, randomBytes } from 'node:crypto';

export function generateApiKey(): string {
  return `ipam-${randomBytes(16).toString('hex')}`;
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}
