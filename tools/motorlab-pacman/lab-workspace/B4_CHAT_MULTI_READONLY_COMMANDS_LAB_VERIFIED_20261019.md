# MotorLab / Pac-Man | Chat multi-command READ-ONLY LAB expansion VERIFIED
Date: 2026-10-19 (Europe/Rome)
State: SOURCE_AND_TESTS_VERIFIED / NO_LIVE_TRIGGER / NO_DEPLOY / NO_CLOUDFLARE_CALLS
Native ChatGPT MCP host tool: STILL OPEN (B4 15/16, 93.75%)

## 1. Scope and previous checkpoint
- User authorized strictly LAB-only source/code, tests, checkpoint for read-only extension of the EXISTING ChatGPT -> GitHub Actions protected -> existing Pac-Man Worker bridge. No Worker build/deploy, main/MADRE/production changes, D1 SQL, Cloudflare external calls, plugin updates, secrets, token/permission changes, paid service, challenge, GitHub provider PUT or live request trigger.
- Starting checkpoint `B4_CHAT_D1_RECEIPT003_REUSABLE_PROTECTED_BRIDGE_REAL_GET_VERIFIED_20261019.md`, at commit `22537a5d3fb0fdf8aefe2754369dd7e623dcab1c`. Existing real protected operation 003 remains complete and must not be replayed.
- Repository `Br174/Chatgpt`, branch `motorlab/pacman-real-operations-lab-20261017` only. `main` protected at `8615e8321bf9896f28826a09aa0c9f61ce5ecbb7`.
- Existing deployed Execution Worker remains at previously verified `8e527e98-efc2-424f-b9e0-349a15513970`; NOT re-queried remotely in this phase.
- Owner's earlier Cloudflare screenshots confirmed Workers Free active, no stored payment method, Workers 120/100000 daily requests, and D1 428 rows read/35 written over previous 24h. These are HISTORICAL screenshots, not current API data, no billing access or new expense added.

## 2. Single Pac-Man read-only bridge: new LAB source
- `tools/motorlab-pacman/candidates/chat-readonly-multiplex-guard-lab.mjs`
- `tools/motorlab-pacman/candidates/chat-readonly-multiplex-guard-lab.test.mjs`
- `tools/motorlab-pacman/candidates/chat-readonly-multiplex-workflow-safety-lab.test.mjs`
- `.github/workflows/pacman-chat-readonly-multiplex-protected-lab.yml`
- No changes to existing Execution Worker, D1 schema, WebAuthn Worker, MCP endpoint, plugin, or old receipt003 workflow. No new Worker, token, secret, scheduler, service or execution core.
- HEAD source commits:
  - `6c07679a8daaed6b30a8a3cade82dbdbcaade0a9`: guarded five-command router, 13 synthetic positive/negative tests, protected workflow source.
  - `91a32b28499bfbc69fc38c6d351ca0d51d00ae11`: 10 static workflow scope and anti-regression tests.

## 3. Exactly FIVE finite commands (all GET, source only)
1. `worker-health` -> existing public `/health` on Execution Worker, required service/revision and D1 binding CONNECTED, after pinned deployed Worker version check.
2. `execution-schema` -> existing authenticated `/__motorlab_lab/diagnostics/execution-schema-audit`, requires existing D1 schema EXACT, controlled ledger EXACT, four explicit safety flags MATCH, owner issuer parity unlocked; only sanitised PASS/HOLD output, not raw flags.
3. `receipt-003` -> existing authenticated `/__motorlab_lab/diagnostics/terminal-receipt-003`, requires exact verified receipt, consumed challenge and one nonce via previously tested verifier.
4. `checkpoint-status` -> GitHub Contents GET of the exact, pinned, previously verified checkpoint blob `a5b8a0f9e71b770867ed648f88f86c0cf82a91c9`. It is an integrity check of that historical checkpoint, NOT an arbitrary latest-checkpoint navigator.
5. `test-status` -> read-only GitHub Actions GET listing the latest observed run of the existing LAB test workflow among a bounded set of recent runs. Requires latest matching completed SUCCESS and attempt 1. Reports run ID/checked SHA only; does NOT claim to have run new CI when invoked.
- Each command has a fixed, code-owned HTTPS URL; no dynamic input URL, arbitrary SQL, content or token in request JSON.
- All future requests use **NEW** exact path `.github/pacman-b4/read-command-requests/request-YYYYMMDD-NNN.json`; guard must validate only one new file diff, `expectedParentSha`, workflow and module blob SHAs, exact immutable scope flags and command enum. This directory has NOT been created at this checkpoint. Owner must authorize each future new request individually. No repeat of any previous request ID.
- Github protected review environment `pacman-execution-staging` is mandatory before any remote read; after owner approval recheck LAB HEAD, protected main. For a Worker command, one Cloudflare deployments metadata GET verifies pinned Worker version, and exactly one further Worker GET follows. For checkpoint/tests, one public GitHub GET follows; all fail closed on drift, 403, malformed results, stale CI, missing/changed pinned checkpoint, no retries.
- Protected GitHub environment is the sole holder of existing `PACMAN_CF_API_TOKEN`, `PACMAN_CF_ACCOUNT_ID` and `PACMAN_EXECUTION_KEY`. No secret copying into chat, source, trigger JSON, logs or plugin.
- Returning only minimal allowlisted `PACMAN_CHAT_MULTI_RESULT=PASS`, `PACMAN_CHAT_MULTI_PROOF=...`, `PACMAN_CHAT_MULTI_COMMAND=...` and optional safe CI run ID; never raw D1 data.
- This is a GitHub-protected bridge, not the as-yet unverified native ChatGPT MCP host integration.

## 4. Verified tests and no-side-effect proof
- GitHub Actions `https://github.com/Br174/Chatgpt/actions/runs/39181392971`, commit 6c07679a, SUCCESS: 1025/1025, failures 0, skipped 0; workerd regression green.
- GitHub Actions `https://github.com/Br174/Chatgpt/actions/runs/39181585507`, commit 91a32b28, SUCCESS: **1035/1035**, failures 0, skipped 0.
- Runtime evidence: `PACMAN_MCP_READONLY_REAL_WORKER_RUNTIME_NO_WRITE_GUARDS_VERIFIED` and `PACMAN_WORKERS_RUNTIME_POST_CYCLE_REDIRECT_AND_INERT_DIAGNOSTIC_VERIFIED`.
- New tests 23/23: 13 request, URL and evidence validation positives/negatives; 10 workflow review, trigger, permissions, no-write, no-leak, anti-replay scope.
- All CI work uses GitHub public repo with standard included runners. GitHub workflows were triggered solely for synthetic unit and runtime tests by LAB source writes, not by new request files.
- Zero calls to live Cloudflare, zero private Worker GETs, zero D1 queries, zero deploys, zero WebAuthn challenges, zero GitHub provider PUTs, zero plugin updates in this phase.

## 5. Status and progress accounting
- Focused activity: multi-command read-only LAB implementation and tests: **100%**, delta +100 pp from not implemented to source/CI validated.
- Future live trial: **0% verified for any of the five NEW commands**, delta +0 pp. Existing single receipt003 bridge real trial remained PASS; don't conflate with new five-command bridge.
- Historic MotorLab/Pac-Man A GitHub 4/4=100%; B chat/WebAuthn 3/4=75%; C staging 4/4=100%; D audit/recovery 4/4=100%. Overall 15/16 = **93.75%**, delta +0 pp; B4 native ChatGPT MCP tool remains NOT VERIFIED.
- Do not falsely call host-native integration complete, give secret to the personal plugin, duplicate Execution Worker or re-run old actions.

## 6. Next explicit authorization boundary
A separate scoped consent is required to create ONE new `read-command-requests/request-YYYYMMDD-NNN.json` file for ONE named command; this is a real trigger. Then owner manually reviews protected GitHub environment; after review, one GET to specified provider target (and optionally one Execution Worker deployment metadata GET) may run. Independently retrieve job logs in ChatGPT and checkpoint outcome, never retry ambiguous calls.
No authorization to deploy, change plugin, add privilege or write D1.
CHECKPOINT_STATE=MULTI_READONLY_COMMANDS_LAB_TESTS_VERIFIED; NATIVE_B4_OPEN; AWAITING_EXPLICIT_ONE_COMMAND_AUTHORIZATION.
