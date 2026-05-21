// Cookie-session + login-form helpers so the gated dashboard works in ANY
// browser (incl. mobile in-app webviews that suppress the Basic-Auth dialog).
// Basic Auth still works in parallel (curl, cached desktop sessions).
export const COOKIE = 'eb_auth';

export function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > -1) {
      const k = p.slice(0, i).trim();
      if (k) { try { out[k] = decodeURIComponent(p.slice(i + 1).trim()); } catch { out[k] = p.slice(i + 1).trim(); } }
    }
  });
  return out;
}

// A browser navigation (link tap / address bar) sends Accept: text/html → show
// the login form. API/asset/curl requests get a 401 instead (Basic-Auth friendly).
export function wantsHtml(acceptHeader) {
  return String(acceptHeader || '').includes('text/html');
}

// Self-contained login page (no external assets, inline brand styling, noindex).
export function loginPageHTML(error = '') {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="robots" content="noindex, nofollow"><title>EB Daily Brief — Sign in</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;
    background:radial-gradient(900px 480px at 78% -8%,rgba(32,188,243,.12),transparent 60%),#0a0e15;
    color:#eaf0f7;font-family:'Chakra Petch',system-ui,-apple-system,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased}
  .card{width:min(94vw,360px);background:#111827;border:1px solid #1f2a3d;border-radius:18px;padding:30px 26px;text-align:center}
  .logo{font-family:'Orbitron',system-ui,sans-serif;font-weight:800;font-size:21px;letter-spacing:.04em;
    background:linear-gradient(135deg,#20BCF3,#FA800E);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:6px}
  h1{font-size:16px;margin:0 0 4px;font-weight:600}
  p{color:#93a3b8;font-size:13px;margin:0 0 18px}
  input{width:100%;padding:12px 14px;border-radius:10px;border:1px solid #2a3a55;background:#0b1018;color:#eaf0f7;font-size:16px;font-family:inherit}
  input:focus{outline:none;border-color:#20BCF3}
  button{width:100%;margin-top:12px;padding:12px;border:none;border-radius:10px;background:#20BCF3;color:#04222e;font-weight:700;font-size:15px;font-family:inherit;cursor:pointer}
  .err{color:#f0625a;font-size:13px;margin-bottom:12px}
</style></head>
<body><form class="card" method="POST" action="/__login">
  <div class="logo">EASI BREEZI</div>
  <h1>Daily Brief Dashboard</h1>
  <p>Enter the dashboard password to continue.</p>
  ${error ? `<div class="err">${error}</div>` : ''}
  <input type="password" name="password" placeholder="Password" autocomplete="current-password" autofocus required>
  <button type="submit">Sign in</button>
</form></body></html>`;
}
