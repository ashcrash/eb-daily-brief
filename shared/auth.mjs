// Constant-time string comparison + Basic-Auth password extraction.
// Timing-safe to avoid leaking password length/prefix via response timing.
export function timingSafeEqualStr(a, b) {
  const sa = String(a ?? ''), sb = String(b ?? '');
  const len = Math.max(sa.length, sb.length);
  let diff = sa.length ^ sb.length;
  for (let i = 0; i < len; i++) {
    diff |= (sa.charCodeAt(i) || 0) ^ (sb.charCodeAt(i) || 0);
  }
  return diff === 0;
}

// True when the request's Basic-Auth password matches `expected`. Username ignored.
export function basicAuthOk(authHeader, expected) {
  if (!expected) return false;
  const [scheme, encoded] = String(authHeader || '').split(' ');
  if (scheme !== 'Basic' || !encoded) return false;
  let decoded = '';
  try { decoded = atob(encoded); } catch { return false; }
  const password = decoded.slice(decoded.indexOf(':') + 1);
  return timingSafeEqualStr(password, expected);
}
