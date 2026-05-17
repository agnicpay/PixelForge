import crypto from 'node:crypto';

export function generateCodeVerifier() {
  return crypto.randomBytes(64).toString('base64url');
}

export function codeChallengeFor(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export function generateState() {
  return crypto.randomBytes(24).toString('base64url');
}
