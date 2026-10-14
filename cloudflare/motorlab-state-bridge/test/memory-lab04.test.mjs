import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=resolve(fileURLToPath(new URL('../../..',import.meta.url)));
const read=(path)=>readFileSync(resolve(root,path),'utf8');
const local=JSON.parse(read('tools/memory-core-lab04/wrangler.local.jsonc'));
const production=JSON.parse(read('cloudflare/motorlab-state-bridge/wrangler.jsonc'));
const runner=read('tools/memory-core-lab04/d1-local-check.mjs');
test('LAB04 uses only synthetic local D1 ID and never production binding',()=>{
 assert.equal(local.name,'motorlab-memory-core-lab04-local-only');
 assert.deepEqual(Object.keys(local).sort(),['compatibility_date','d1_databases','name']);
 assert.equal(local.d1_databases.length,1);
 assert.equal(local.d1_databases[0].binding,'MEMORY_LAB_DB');
 assert.equal(local.d1_databases[0].database_id,'00000000-0000-4000-8000-000000000044');
 assert(!production.d1_databases.some(p=>p.database_id===local.d1_databases[0].database_id));
 assert(!production.d1_databases.some(p=>p.database_name===local.d1_databases[0].database_name));
});
test('LAB04 configuration cannot contact or deploy production Worker and KV',()=>{
 for(const blocked of ['kv_namespaces','account_id','vars','routes','route','durable_objects','workers_dev','main','triggers','placement'])assert(!(blocked in local),'forbidden key '+blocked);
 assert(!JSON.stringify(local).includes('motorlab-operational-state-db'));
 assert(!JSON.stringify(local).includes('POLLICINO_SENTINEL'));
 assert(!JSON.stringify(local).includes('987774db498241aba75e6e30880dbb10'));
});
test('CLI does not provide remote/cloud write path',()=>{
 assert.match(runner,/--local/);
 assert.match(runner,/--persist-to/);
 assert.match(runner,/WRANGLER_D1_LOCAL_VERIFIED/);
 assert.match(runner,/acquireVerifiedGithubMemory/);
 assert.doesNotMatch(runner,/wrangler\s+(?:deploy|d1\s+create|d1\s+delete|secret\s+put)/);
 assert.doesNotMatch(runner,/fetch\(\s*['"]https:\/\/api\.cloudflare\.com/);
});
test('canonical memory schema is reused, never copied into second independent ledger',()=>{
 assert.match(runner,/canonical_schema/);
 assert.match(runner,/memory_source_links/);
 assert.match(runner,/operation_events/);
 assert.match(runner,/velocity_lessons/);
 assert(!/CREATE TABLE (?!IF NOT EXISTS)/.test(runner));
});
test('production entry, prod schema, OIDC and guard remain unmodified/unused in LAB04',()=>{
 const entry=read('cloudflare/motorlab-state-bridge/src/entry.js');
 const schema=read('cloudflare/motorlab-state-bridge/src/schema.js');
 const oidc=read('.github/workflows/motorlab-d1-oidc-relay.yml');
 assert(!entry.includes('memory-core-lab04')&&!entry.includes('d1-local-check'));
 assert(!schema.includes('memory-core-lab04'));
 assert(!oidc.includes('memory-core-lab04'));
});
