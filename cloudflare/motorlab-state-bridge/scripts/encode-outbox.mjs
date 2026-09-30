import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateSnapshot } from '../src/index.js';

const file = resolve(process.cwd(), process.argv[2] || 'MOTORLAB_CLOUDFLARE_OUTBOX.json');
const payload = JSON.parse(await readFile(file, 'utf8'));
validateSnapshot(payload);
const raw = JSON.stringify(payload);
const encoded = Buffer.from(raw, 'utf8').toString('base64url');
process.stdout.write(`MOTORLAB_SNAPSHOT_B64:${encoded}\n`);
