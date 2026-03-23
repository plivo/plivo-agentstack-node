import { createHmac } from 'node:crypto';
import { URL } from 'node:url';

/**
 * Validate a Plivo webhook signature (v3).
 *
 * @param method - HTTP method ("GET" or "POST")
 * @param uri - Full callback URL
 * @param nonce - Value of X-Plivo-Signature-V3-Nonce header
 * @param authToken - Your Plivo auth token
 * @param v3Signature - Value of X-Plivo-Signature-V3 header
 * @param params - Callback parameters (query params for GET, body for POST)
 * @returns true if signature is valid
 */
export function validateSignatureV3(
  method: string,
  uri: string,
  nonce: string,
  authToken: string,
  v3Signature: string,
  params: Record<string, string> = {},
): boolean {
  let baseUrl: string;

  if (method.toUpperCase() === 'GET') {
    const parsed = new URL(uri);
    // Merge existing query params with provided params
    const merged = new Map<string, string>();
    for (const [k, v] of parsed.searchParams.entries()) {
      merged.set(k, v);
    }
    for (const [k, v] of Object.entries(params)) {
      merged.set(k, v);
    }
    const sortedParams = sortedUrlEncode(Object.fromEntries(merged));
    baseUrl = `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
    if (sortedParams) {
      baseUrl = `${baseUrl}?${sortedParams}`;
    }
  } else {
    const sortedParams = sortedUrlEncode(params);
    baseUrl = sortedParams ? `${uri}.${sortedParams}` : uri;
  }

  const payload = `${baseUrl}.${nonce}`;
  const computed = createHmac('sha256', authToken)
    .update(payload)
    .digest('base64');

  // The signature header may contain multiple comma-separated signatures
  const signatures = v3Signature.split(',').map((s) => s.trim());
  return signatures.includes(computed);
}

function sortedUrlEncode(params: Record<string, string>): string {
  const keys = Object.keys(params).sort();
  if (keys.length === 0) return '';
  return keys
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&');
}
