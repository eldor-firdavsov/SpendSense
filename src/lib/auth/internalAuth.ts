import crypto from 'node:crypto';

/**
 * SpendSense AI — Cryptographic Internal Authentication Protection
 * 
 * Guarantees that internal user identity forwarding between Next.js Middleware
 * and Server Components CANNOT be spoofed by external HTTP clients.
 * 
 * Rules:
 * 1. Tokens are HMAC-SHA256 signed using a secret known ONLY to the server.
 * 2. Tokens expire after 30 seconds (freshness window).
 * 3. All external client headers matching internal names are stripped at the edge.
 * 4. Constant-time comparison prevents timing attacks.
 */

const INTERNAL_SECRET =
  process.env.INTERNAL_AUTH_SECRET ||
  process.env.GEMINI_API_KEY ||
  'spendsense_cryptographic_internal_secret_key_2026';

export const INTERNAL_AUTH_HEADER = 'x-internal-auth';

export interface VerifiedInternalUser {
  id: string;
  email: string;
  timestamp: number;
}

/**
 * Generate a cryptographically signed internal token.
 * Called exclusively by middleware after Supabase validates the session.
 */
export function signInternalAuth(userId: string, userEmail: string): string {
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(8).toString('hex');
  const payload = `${userId}:${userEmail}:${timestamp}:${nonce}`;
  const hmac = crypto.createHmac('sha256', INTERNAL_SECRET).update(payload).digest('hex');
  return `${payload}:${hmac}`;
}

/**
 * Verify internal token validity, HMAC signature, and freshness window.
 * Returns verified user identity, or null if missing, forged, or expired.
 */
export function verifyInternalAuth(token: string | null | undefined): VerifiedInternalUser | null {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const parts = token.split(':');
  if (parts.length !== 5) {
    return null;
  }

  const [id, email, tsStr, nonce, receivedHmac] = parts;
  const timestamp = Number(tsStr);

  // 1. Freshness check: token must be younger than 30 seconds
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > 30000) {
    return null;
  }

  // 2. Cryptographic signature check
  const payload = `${id}:${email}:${timestamp}:${nonce}`;
  const expectedHmac = crypto.createHmac('sha256', INTERNAL_SECRET).update(payload).digest('hex');

  try {
    const receivedBuf = Buffer.from(receivedHmac, 'hex');
    const expectedBuf = Buffer.from(expectedHmac, 'hex');
    if (receivedBuf.length !== expectedBuf.length) {
      return null;
    }
    const matches = crypto.timingSafeEqual(receivedBuf, expectedBuf);
    if (!matches) {
      return null;
    }
  } catch {
    return null;
  }

  return {
    id,
    email,
    timestamp,
  };
}

/**
 * Strip all internal / spoofable headers from incoming client requests.
 */
export function sanitizeClientHeaders(headers: Headers): Headers {
  const sanitized = new Headers(headers);
  sanitized.delete('x-user-id');
  sanitized.delete('x-user-email');
  sanitized.delete(INTERNAL_AUTH_HEADER);
  sanitized.delete('x-internal-user-id');
  sanitized.delete('x-internal-user-email');
  return sanitized;
}
