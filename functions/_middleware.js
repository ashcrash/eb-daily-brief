// functions/_middleware.js — HTTP Basic Auth gate for the EB dashboard.
// Cardless, $0. The password comes from the DASH_PASSWORD env var set in
// Cloudflare Pages (Settings → Environment variables). Username is ignored;
// only the password is checked. Runs on EVERY route, so briefs/latest.json
// is protected too (not just index.html).
export const onRequest = async (context) => {
  const { request, env, next } = context;
  const expected = env.DASH_PASSWORD;

  // Fail closed: if no password is configured, never serve content.
  if (!expected) {
    return new Response('Dashboard locked: DASH_PASSWORD is not configured.', {
      status: 503,
      headers: { 'X-Robots-Tag': 'noindex, nofollow' }
    });
  }

  const header = request.headers.get('Authorization') || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    let decoded = '';
    try { decoded = atob(encoded); } catch { decoded = ''; }
    const password = decoded.slice(decoded.indexOf(':') + 1);
    if (password && password === expected) {
      return next();
    }
  }

  return new Response('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="EB Brief", charset="UTF-8"',
      'X-Robots-Tag': 'noindex, nofollow',
      'Content-Type': 'text/plain'
    }
  });
};
