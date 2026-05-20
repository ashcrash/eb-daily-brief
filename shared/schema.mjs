// The latest-brief.json contract + a dependency-free validator.
export const SCHEMA_VERSION = 1;
export const LENSES = ['cmo', 'cfo', 'cto', 'inbox'];

export function validateBrief(b) {
  const errors = [];
  const req = (cond, msg) => { if (!cond) errors.push(msg); };

  if (!b || typeof b !== 'object') return { valid: false, errors: ['brief must be an object'] };

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

  return { valid: errors.length === 0, errors };
}
