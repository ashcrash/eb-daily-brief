// Cloudflare Worker — Basic Auth gate in front of the static dashboard.
// With assets.run_worker_first=true, this runs on EVERY request, so
// briefs/latest.json (the sensitive data) is gated too — not just index.html.
// Password comes from the DASH_PASSWORD env var (Workers project → Settings →
// Variables and Secrets). It MUST be stored as an encrypted "Secret", NOT a
// "Text" var: Workers Builds runs `wrangler deploy` on every git push, which
// preserves Secrets but DROPS dashboard plaintext vars that aren't declared in
// wrangler.jsonc — a plaintext DASH_PASSWORD gets wiped on the next daily
// publish and fail-closes the dashboard to 503. Username is ignored; only the
// password is checked.
export default {
  async fetch(request, env) {
    const expected = env.DASH_PASSWORD;

    // Fail closed: never serve content if no password is configured.
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
        return env.ASSETS.fetch(request); // authed → serve the static asset
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
  }
};
