// The latest-brief.json contract + a dependency-free validator.
// Core fields are required; the richer dashboard fields (northStar, kpis,
// charts, socials, competitors, landscape) are OPTIONAL so old briefs still
// validate and new sections can be added without breaking anything.
export const SCHEMA_VERSION = 2;
export const LENSES = ['cmo', 'cfo', 'cto', 'inbox'];

export function validateBrief(b) {
  const errors = [];
  const req = (cond, msg) => { if (!cond) errors.push(msg); };
  const optArray = (key) => { if (key in b) req(Array.isArray(b[key]), `${key} must be an array if present`); };

  if (!b || typeof b !== 'object') return { valid: false, errors: ['brief must be an object'] };

  // --- core (required) ---
  req(Number.isInteger(b.edition), 'edition must be an integer');
  req(typeof b.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.date), 'date must be YYYY-MM-DD');
  req(typeof b.generatedAt === 'string' && b.generatedAt.length > 0, 'generatedAt must be a non-empty string');
  req(Array.isArray(b.headline), 'headline must be an array');
  req(Array.isArray(b.needsDecision), 'needsDecision must be an array');
  req(Array.isArray(b.actionStack), 'actionStack must be an array');
  req(b.sources && typeof b.sources === 'object' && !Array.isArray(b.sources), 'sources must be an object');

  if (!b.lenses || typeof b.lenses !== 'object') {
    errors.push('lenses must be an object');
  } else {
    for (const k of LENSES) req(b.lenses[k], `lenses.${k} is required`);
  }

  // --- rich dashboard sections (optional) ---
  optArray('kpis');
  optArray('charts');
  optArray('socials');
  optArray('competitors');
  if ('northStar' in b) req(b.northStar && typeof b.northStar === 'object', 'northStar must be an object if present');
  if ('landscape' in b) req(typeof b.landscape === 'string', 'landscape must be a string if present');

  return { valid: errors.length === 0, errors };
}
