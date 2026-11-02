export class UrlPolicyError extends Error {
  constructor(public readonly code: 'INVALID_URL' | 'INVALID_ALLOWLIST' | 'ORIGIN_DENIED') {
    super(code);
    this.name = 'UrlPolicyError';
  }
}

export function assertAllowedUrl(input: string, allowedOrigins: readonly string[]): string {
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
    if (
      entry !== url.origin ||
      !['http:', 'https:'].includes(url.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
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
