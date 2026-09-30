import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateSnapshot } from '../src/index.js';

const path = resolve(process.cwd(), process.argv[2] || '../../MOTORLAB_CLOUDFLARE_OUTBOX.json');
const payload = JSON.parse(await readFile(path, 'utf8'));
validateSnapshot(payload);
console.log(payload.snapshot_id);
