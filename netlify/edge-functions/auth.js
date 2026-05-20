// HTTP Basic Auth gate for the EB dashboard (Netlify edge function, free tier).
// Runs on every route, so dashboard/briefs/latest.json is protected too.
// Password comes from the DASH_PASSWORD env var (set via the Netlify MCP /
// dashboard). Username is ignored; only the password is checked.
export default async (req, context) => {
  const expected = Netlify.env.get("DASH_PASSWORD");

  // Fail closed: never serve content if no password is configured.
  if (!expected) {
    return new Response("Dashboard locked: DASH_PASSWORD is not configured.", {
      status: 503,
      headers: { "X-Robots-Tag": "noindex, nofollow" }
    });
  }

  const header = req.headers.get("Authorization") || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    let decoded = "";
    try { decoded = atob(encoded); } catch { decoded = ""; }
    const password = decoded.slice(decoded.indexOf(":") + 1);
    if (password && password === expected) {
      return context.next();
    }
  }

  return new Response("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="EB Brief", charset="UTF-8"',
      "X-Robots-Tag": "noindex, nofollow",
      "Content-Type": "text/plain"
    }
  });
};

export const config = { path: "/*" };
