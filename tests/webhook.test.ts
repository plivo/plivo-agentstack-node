import { describe, it, expect } from 'bun:test';
import { createHmac } from 'node:crypto';
import { validateSignatureV3 } from '../src/webhook.js';

const AUTH_TOKEN = 'test-auth-token-secret';
const NONCE = 'test-nonce-12345';

/** Helper: compute the expected HMAC-SHA256 signature for a payload string. */
function computeSignature(payload: string, token: string): string {
  return createHmac('sha256', token).update(payload).digest('base64');
}

describe('validateSignatureV3', () => {
  describe('POST requests', () => {
    it('valid POST signature returns true', () => {
      const uri = 'https://example.com/webhook';
      const params = { CallUUID: 'call-123', From: '+14155551234' };

      // For POST: sorted params appended to URI, then nonce
      // Sorted keys: CallUUID, From
      const sortedParams = `CallUUID=call-123&From=%2B14155551234`;
      const payload = `${uri}.${sortedParams}.${NONCE}`;
      const signature = computeSignature(payload, AUTH_TOKEN);

      const result = validateSignatureV3(
        'POST',
        uri,
        NONCE,
        AUTH_TOKEN,
        signature,
        params,
      );
      expect(result).toBe(true);
    });

    it('invalid POST signature returns false', () => {
      const uri = 'https://example.com/webhook';
      const params = { CallUUID: 'call-123' };

      const result = validateSignatureV3(
        'POST',
        uri,
        NONCE,
        AUTH_TOKEN,
        'invalid-signature',
        params,
      );
      expect(result).toBe(false);
    });

    it('POST with no params', () => {
      const uri = 'https://example.com/webhook';
      // No params: payload is just uri.nonce
      const payload = `${uri}.${NONCE}`;
      const signature = computeSignature(payload, AUTH_TOKEN);

      const result = validateSignatureV3(
        'POST',
        uri,
        NONCE,
        AUTH_TOKEN,
        signature,
      );
      expect(result).toBe(true);
    });
  });

  describe('GET requests', () => {
    it('valid GET signature returns true', () => {
      const uri = 'https://example.com/webhook?Status=completed';

      // For GET: parse URL, merge query params, sort, build baseUrl
      const baseUrl = `https://example.com/webhook?Status=completed`;
      const payload = `${baseUrl}.${NONCE}`;
      const signature = computeSignature(payload, AUTH_TOKEN);

      const result = validateSignatureV3(
        'GET',
        uri,
        NONCE,
        AUTH_TOKEN,
        signature,
      );
      expect(result).toBe(true);
    });
  });

  describe('multiple signatures', () => {
    it('accepts comma-separated signatures if one matches', () => {
      const uri = 'https://example.com/webhook';
      const payload = `${uri}.${NONCE}`;
      const validSig = computeSignature(payload, AUTH_TOKEN);
      const combined = `invalid-sig, ${validSig}, another-invalid`;

      const result = validateSignatureV3(
        'POST',
        uri,
        NONCE,
        AUTH_TOKEN,
        combined,
      );
      expect(result).toBe(true);
    });
  });
});
