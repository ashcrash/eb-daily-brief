// publish/run.mjs — CLI entry for the publisher.
// Usage: node publish/run.mjs [briefPath]   (default: <repo>/incoming-brief.json)
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publish, loadConfig } from './publish.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(HERE, '..');
const briefPath = process.argv[2] || resolve(repoRoot, 'incoming-brief.json');
const configPath = resolve(HERE, 'config', 'brief-destinations.json');

const brief = JSON.parse(readFileSync(briefPath, 'utf8'));
const config = loadConfig(configPath);
const results = publish(brief, config, { repoRoot });
console.log(JSON.stringify(results, null, 2));
