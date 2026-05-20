// latest-brief.json contract + dependency-free validator (v3).
// Minimal required core keeps the file identifiable; every presentation
// section is OPTIONAL and type-checked only if present, so the dashboard
// stays flexible — add/remove sections, channels, charts, KPIs via the JSON
// with no code change.
export const SCHEMA_VERSION = 3;

export function validateBrief(b) {
  const errors = [];
  const req = (cond, msg) => { if (!cond) errors.push(msg); };
  const optArr = (k) => { if (k in b) req(Array.isArray(b[k]), `${k} must be an array if present`); };
  const optObj = (k) => { if (k in b) req(b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]), `${k} must be an object if present`); };
  const optStr = (k) => { if (k in b) req(typeof b[k] === 'string', `${k} must be a string if present`); };

  if (!b || typeof b !== 'object') return { valid: false, errors: ['brief must be an object'] };

  // --- required core ---
  req(Number.isInteger(b.edition), 'edition must be an integer');
  req(typeof b.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.date), 'date must be YYYY-MM-DD');
  req(typeof b.generatedAt === 'string' && b.generatedAt.length > 0, 'generatedAt must be a non-empty string');
  req(b.sources && typeof b.sources === 'object' && !Array.isArray(b.sources), 'sources must be an object');

  // --- optional presentation sections ---
  optArr('headline'); optArr('executiveSummary'); optArr('kpis'); optArr('charts'); optArr('channels');
  optArr('competitors'); optArr('needsDecision'); optArr('actionStack'); optArr('contentAngle'); optArr('toolIssues');
  optObj('northStar'); optObj('store'); optObj('onlinePresence'); optObj('manufacturing'); optObj('lenses'); optObj('inbox');
  optStr('landscape');

  return { valid: errors.length === 0, errors };
}
