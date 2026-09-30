import { readFile } from 'node:fs/promises';
import { validateSnapshot } from '../src/index.js';

const path = process.argv[2] || '../../MOTORLAB_CLOUDFLARE_OUTBOX.json';
const payload = JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
validateSnapshot(payload);
console.log(payload.snapshot_id);
