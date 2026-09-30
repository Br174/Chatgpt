import { readFile, writeFile } from 'node:fs/promises';

const d1 = process.env.MOTORLAB_D1_ID;
const kv = process.env.MOTORLAB_KV_ID;
if (!/^[0-9a-f-]{36}$/i.test(d1 || '')) throw new Error('invalid MOTORLAB_D1_ID');
if (!/^[0-9a-f]{32}$/i.test(kv || '')) throw new Error('invalid MOTORLAB_KV_ID');
let text = await readFile(new URL('../wrangler.template.jsonc', import.meta.url), 'utf8');
text = text.replace('__D1_DATABASE_ID__', d1).replace('__KV_NAMESPACE_ID__', kv);
if (text.includes('__D1_DATABASE_ID__') || text.includes('__KV_NAMESPACE_ID__')) throw new Error('unresolved wrangler placeholders');
await writeFile(new URL('../wrangler.generated.jsonc', import.meta.url), text);
