export class UrlPolicyError extends Error {
  constructor(public readonly code: 'INVALID_URL' | 'INVALID_ALLOWLIST' | 'ORIGIN_DENIED' | 'PRIVATE_HOST_DENIED') {
    super(code);
    this.name = 'UrlPolicyError';
  }
}

export type UrlPolicyOptions = { liveMode?: boolean };

export function assertAllowedUrl(
  input: string,
  allowedOrigins: readonly string[],
  options: UrlPolicyOptions = {},
): string {
  const liveMode = options.liveMode === true;
  if (!Array.isArray(allowedOrigins) || allowedOrigins.length === 0) {
    throw new UrlPolicyError('INVALID_ALLOWLIST');
  }

  const origins = allowedOrigins.map((entry) => {
    let url: URL;
    try {
      url = new URL(entry);
    } catch {
      throw new UrlPolicyError('INVALID_ALLOWLIST');
    }
    // The exact-origin allowlist concept holds in both modes: an entry must equal
    // its own URL origin and carry no path, query, fragment, or user info. Live
    // mode only widens the permitted host set from loopback to any public host.
    if (
      entry !== url.origin ||
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      (!liveMode && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    ) {
      throw new UrlPolicyError('INVALID_ALLOWLIST');
    }
    return url.origin;
  });

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new UrlPolicyError('INVALID_URL');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new UrlPolicyError('INVALID_URL');
  }
  if (!origins.includes(url.origin)) {
    throw new UrlPolicyError('ORIGIN_DENIED');
  }
  return url.href;
}

// SSRF guard for live mode. The submitted URL's origin becomes the per-run
// allowlist, so any public origin is accepted — but a URL that targets the
// operator's own private/internal/loopback network must be rejected before a
// browser ever opens it. Hostnames are matched by literal form; this does not
// resolve DNS (see the spec's out-of-scope note on DNS rebinding).
function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  // Strip brackets Playwright/URL keep around IPv6 literals.
  const bare = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;

  if (bare === 'localhost' || bare.endsWith('.localhost')) return true;

  // IPv4 dotted-quad ranges.
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(bare);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 0) return true; // 0.0.0.0/8 (incl. 0.0.0.0)
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local (incl. 169.254.169.254)
    return false;
  }

  // IPv6 literals.
  if (bare === '::1' || bare === '::') return true; // loopback / unspecified
  if (bare.startsWith('::ffff:')) {
    // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1) — re-check the embedded IPv4.
    return isPrivateHost(bare.slice('::ffff:'.length));
  }
  const firstHextet = bare.includes(':') ? bare.split(':')[0] : '';
  if (firstHextet) {
    const value = parseInt(firstHextet, 16);
    if (!Number.isNaN(value)) {
      if ((value & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local (fc00..fdff)
      if ((value & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
    }
  }
  return false;
}

// Validate a user-submitted URL for a live-mode run and derive the single-origin
// allowlist from it. Any public HTTP(S) origin is accepted; private/internal
// hosts are rejected (SSRF protection). Scheme and credential rules match
// assertAllowedUrl. Returns the normalized URL and the origin to lock the run to.
export function assertLiveUrl(input: string): { url: string; origin: string } {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new UrlPolicyError('INVALID_URL');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new UrlPolicyError('INVALID_URL');
  }
  if (isPrivateHost(url.hostname)) {
    throw new UrlPolicyError('PRIVATE_HOST_DENIED');
  }
  // Re-run the exact-origin check against the derived origin so the normalized
  // URL and run lock go through the same gate every later navigation uses.
  const normalized = assertAllowedUrl(input, [url.origin], { liveMode: true });
  return { url: normalized, origin: url.origin };
}
