// MotorLab Pacman LAB: offline policy contract regression; Node builtin test runner.
// No remote providers, no secrets, no writes/deploy. One owner: canonical CORE EntryPoint.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('../..', import.meta.url)));
const read=name=>readFileSync(resolve(root,name),'utf8');
const core=read('MOTORLAB_CORE_ENTRYPOINT_V1.txt');
const boot=read('MOTORLAB_AUTO_BOOTSTRAP_V1.txt');
const reentry=read('MOTORLAB_REENTRY_GATE_V1.txt');
const capsule=read('MOTORLAB_BOOT_CAPSULE_V1.txt');
const manifest=read('MOTORLAB_RELEASE_MANIFEST_V1.txt');
const guard=read('MOTORLAB_CHANGE_COMPATIBILITY_GUARD_V1.txt');
const approval=read('MOTORLAB_PRE_CHANGE_APPROVAL_GATE_V1.txt');
const canonical=core.split('PACMAN (FORMER AUTOSETUP)')[1]?.split('REGISTERED PROJECT BOOT ORDER - MANDATORY')[0]??'';
const start=boot.split('0AB. PACMAN AUTOMATIC EXTERNAL-WORK ACTIVATION')[1]?.split('0A. EVERY-TURN')[0]??'';
const resume=reentry.split('1B. PACMAN AUTOMATIC EXTERNAL-WORK RE-ENTRY')[1]?.split('2. RESUME')[0]??'';

test('canonical public name Pacman and legacy technical AutoSetup refer to ONE feature',()=>{
 assert.match(canonical,/Canonical public feature name: Pacman/);
 assert.match(canonical,/backward-compatible alias: AutoSetup/);
 assert.match(canonical,/not another agent, app, scheduler/);
 assert.match(canonical,/Do not duplicate its connector, backend/);
});
test('external account/site/provider operations implicitly activate without keyword',()=>{
 assert.match(canonical,/at EVERY supported first-boot and project-turn\/re-entry/i);
 assert.match(canonical,/website, provider account, hosted dashboard, integration, permission, API, cloud resource or service/i);
 assert.match(canonical,/without requiring Bruno to say "Pacman" or "AutoSetup"/);
});
test('informational browsing does not start a second orchestration workflow',()=>{
 assert.match(canonical,/Normal informational browsing\/search with no account\/workflow action/);
 assert.match(start,/Ordinary informational web research with no external account operation/);
});
test('first turn Auto Bootstrap uses the one canonical Pacman contract',()=>{
 assert.match(start,/MOTORLAB_CORE_ENTRYPOINT_V1\.txt/);
 assert.match(start,/MUST route it automatically/);
 assert.match(start,/existing MotorLab AutoSetup feature/);
 assert.match(start,/Do NOT create a competing classifier/);
});
test('reentry activation is not limited to brand-new chats',()=>{
 assert.match(resume,/EVERY supported MotorLab UserPromptSubmit, resume, compact or clear/);
 assert.match(resume,/without expecting a "Pacman" command/);
 assert.match(resume,/original operation ID, user approval, checkpoint and single-writer lock/);
});
test('minimal user intervention on unavailable tools, never fake browser or provider access',()=>{
 assert.match(canonical,/first prefer verified available connected provider\/plugin actions/);
 assert.match(canonical,/present the shortest safe user action/);
 assert.match(canonical,/Never fabricate provider access/);
 assert.match(resume,/PENDING_PROVIDER_ACCESS \/ HOST_LIMITED/);
});
test('approval, scope and paid services cannot be skipped',()=>{
 assert.match(canonical,/PRE-CHANGE APPROVAL GATE/);
 assert.match(canonical,/obtain new consent for expanded scope, destructive writes, paid changes/);
 assert.match(canonical,/No new provider or paid tier/);
 assert.match(approval,/A REQUEST TO CHANGE IS NOT THE APPROVAL TO WRITE/);
});
test('credential hygiene excludes chat, logs and checkpoints',()=>{
 assert.match(canonical,/NEVER solicit in chat, repo, GitHub Actions logs, tool-call fields, Notion or checkpoints/);
 assert.match(canonical,/only within its proven scope/);
 assert.match(canonical,/NEVER solicit in chat/);
});
test('single-writer, one existing coordinator, sole Velocity scheduler unchanged',()=>{
 assert.match(canonical,/Velocity remains the sole scheduler/);
 assert.match(guard,/ONE RESPONSIBILITY = ONE ACTIVE COORDINATOR/);
 assert.match(resume,/No duplicate writer, second scheduler/);
});
test('existing AutoSetup PR49 is lineage not asserted live',()=>{
 assert.match(canonical,/PR #49 remains authoritative implementation lineage/);
 assert.match(canonical,/still DRAFT, not a live connected ChatGPT app or deployed Worker/);
 assert.match(manifest,/PACMAN_LIVE_WORKER_MCP_CONNECTION=NOT_VERIFIED_PR49_DRAFT/);
});
test('Android stays single app and is not changed in this LAB',()=>{
 assert.match(canonical,/SINGLE original MotorLab Android APK/);
 assert.match(canonical,/nor modifies production, MADRE, APK or native engines/);
});
test('boot capsule and manifest point to canonical owner + callers',()=>{
 for(const [s,needle] of [
  [capsule,'PACMAN=AutoSetup'],
  [core,'PACMAN (FORMER AUTOSETUP)'],
  [boot,'0AB. PACMAN AUTOMATIC EXTERNAL-WORK ACTIVATION'],
  [reentry,'1B. PACMAN AUTOMATIC EXTERNAL-WORK RE-ENTRY'],
  [manifest,'PACMAN_CANONICAL_POLICY=MOTORLAB_CORE_ENTRYPOINT_V1.txt'],
  [manifest,'PACMAN_FIRST_TURN_ROUTING=MOTORLAB_AUTO_BOOTSTRAP_V1.txt'],
  [manifest,'PACMAN_REENTRY_ROUTING=MOTORLAB_REENTRY_GATE_V1.txt']
 ])assert(s.includes(needle),needle);
 assert(Buffer.byteLength(capsule,'utf8')<4000,'critical capsule must fit hard 4KB regression bound');
});
test('r37 release remains awaiting verified fanout and cannot fabricate host memory',()=>{
 assert.match(manifest,/CURRENT_RELEASE=2026\.10\.22-r38/);
 assert.match(manifest,/PACMAN_RELEASE_ACTIVATION=VERIFIED_CORE_AND_SIX_ACTIVE_MAINS/);
 assert.match(canonical,/not a claim to have modified ChatGPT's personal Memory/);
 assert.match(canonical,/an isolated LAB policy candidate/);
});
test('legacy AutoSetup technical paths are explicitly retained, not rewritten',()=>{
 assert.match(canonical,/Keep URL paths, API flags, technical names and file names "autosetup" compatible/);
 assert.match(resume,/AutoSetup" stays a compatible technical alias/);
});
test('negative: no second scheduler, Worker deploy or embedded secrets in policy routing',()=>{
 const newPolicy=[canonical,start,resume,capsule.match(/^PACMAN=AutoSetup$/m)?.[0]??''].join('\n');
 assert(!/CLOUDFLARE_API_TOKEN\s*=/.test(newPolicy));
 assert(!/github_pat_[0-9A-Za-z]/.test(newPolicy));
 assert(!/wrangler deploy --remote/.test(newPolicy));
 assert(!/second scheduler is required/i.test(newPolicy));
});
