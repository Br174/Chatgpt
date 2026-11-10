// Pacman LAB07 r37 compatibility gate. Static read-only tests; no Cloudflare API, no GitHub writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const read=p=>readFileSync(resolve(root,p),'utf8');
const old=read('cloudflare/motorlab-state-bridge/wrangler.jsonc');
const preview=read('cloudflare/motorlab-state-bridge/wrangler.lab07.staging.jsonc');
const main=read('cloudflare/motorlab-state-bridge/src/entry.js');
const core=read('MOTORLAB_CORE_ENTRYPOINT_V1.txt');
const manifest=read('MOTORLAB_RELEASE_MANIFEST_V1.txt');
const workflow=read('.github/workflows/motorlab-pacman-lab07.yml');
const body=main.split('async fetch(request, env)')[1]??'';

test('MotorLab r37 is the actual baseline and Pacman is canonical alias, not a new engine',()=>{
 assert.match(manifest,/^CURRENT_RELEASE=2026\.10\.14-r37$/m);
 assert.match(core,/PACMAN \(FORMER AUTOSETUP\)/);
 assert.match(core,/not another agent, app, scheduler/);
});
test('AutoSetup LAB06 handler is imported just once; one route delegates safely',()=>{
 assert.equal((main.match(/import \{ handleAutoSetupCloudflare \}/g)||[]).length,1);
 assert.equal((body.match(/handleAutoSetupCloudflare\(request, env\)/g)||[]).length,1);
 assert.match(body,/url\.pathname\.startsWith\('\/autosetup\/v1\/'\)/);
});
test('Pacman route precedes all pre-existing Worker handlers without altering ownership',()=>{
 const routes=[
  '/github-webhook','/control/v1/oidc-relay','/control/v1/project-feedback-oidc',
  '/continuity/v1/enroll','/continuity/v1/pulse','/continuity/v1/seal',
  '/continuity/v1/status','/continuity/v1/context','/continuity/v1/resume-ready'
 ];
 const prefix=body.indexOf("url.pathname.startsWith('/autosetup/v1/')");
 assert(prefix>=0);
 for(const route of routes){const idx=body.indexOf(route);assert(idx>prefix,'existing route changed or missing '+route)}
 assert.match(body,/return core\.fetch\(request, env\)/);
});
test('the original PRODUCTION Wrangler remains unchanged in meaning, no Pacman flags',()=>{
 assert.match(old,/"name": "motorlab-state-bridge"/);
 assert.match(old,/"d1_databases"/);
 assert.match(old,/"kv_namespaces"/);
 assert.doesNotMatch(old,/MOTORLAB_AUTOSETUP_/);
});
test('isolated LAB07 template has no production data plane resources or routes',()=>{
 for(const term of ['"d1_databases"','"kv_namespaces"','"routes"','"route"','"migrations"','"durable_objects"','"account_id"','"zone_id"','"workers_dev"']){
  assert(!preview.includes(term),'forbidden stage binding '+term);
 }
 assert.doesNotMatch(preview,/9d94db34-2d3d-45be-8335-eae1b75d60b4|987774db498241aba75e6e30880dbb10/);
 assert.match(preview,/"nodejs_compat"/);
 assert.match(preview,/"MOTORLAB_AUTOSETUP_LIVE_GITHUB_WRITE": "false"/);
 assert.match(preview,/"MOTORLAB_AUTOSETUP_PROBE_ONLY": "false"/);
});
test('workflow has no deploy, preview network invocation, dispatch, permissions for writes or secrets',()=>{
 assert.match(workflow,/pull_request:/);
 assert.doesNotMatch(workflow,/workflow_dispatch:/);
 assert.doesNotMatch(workflow,/^\s*(?:deploy|preview):\s*$/m);
 assert.match(workflow,/contents: read/);
 assert.doesNotMatch(workflow,/secrets\./);
 assert.doesNotMatch(workflow,/CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID/);
 const commands=workflow.split('\n').filter(x=>/^\s*(?:npx\s+--yes\s+)?wrangler\b/.test(x)||/^\s*npx\s+--yes\s+wrangler/.test(x));
 assert.equal(commands.length,1,'only one Wrangler invocation allowed');
 assert(commands[0].includes('deploy --dry-run'),'Wrangler must be dry-run only');
});
test('no active probe window or live token is embedded in the isolated preview',()=>{
 assert.doesNotMatch(preview,/PROBE_UNTIL|expires_at|Bearer\s+\S+/);
 assert.doesNotMatch(workflow,/GITHUB_TOKEN|GH_TOKEN|AUTHORIZATION=Bearer/);
});
test('planned staging verification cannot be represented as already performed',()=>{
 const doc=read('docs/pacman-lab07/STAGING_GATE.md');
 assert.match(doc,/STAGING_API_IDENTITY=NOT_VERIFIED/);
 assert.match(doc,/STAGING_PERMISSIONS=NOT_VERIFIED/);
 assert.match(doc,/ZERO_ADDITIONAL_COST=NOT_VERIFIED/);
 assert.match(doc,/REMOTE_PREVIEW=NOT_EXECUTED/);
 assert.match(doc,/NO_PRODUCTION_DEPLOY=TRUE/);
});
