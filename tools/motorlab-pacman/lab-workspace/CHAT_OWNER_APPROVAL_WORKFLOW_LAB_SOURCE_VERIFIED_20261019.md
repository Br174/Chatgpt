# MotorLab/Pac-Man | Trusted owner chat approval -> protected GitHub workflow, LAB PROTOTYPE VERIFIED
Date: 2026-10-19 Europe/Rome
Status: LAB_SOURCE_AND_CI_VERIFIED / HOST_ISSUER_NOT_CONNECTED / NO_LIVE_TRIGGER
Release pin: r37 unchanged
Repository: Br174/Chatgpt
Branch: motorlab/pacman-real-operations-lab-20261017
Pre-change HEAD: 3f03977b66dcefd7de928a22a78dfb05e215afc7
Final LAB source/test HEAD: a883d69ce5489c8edc99b597eab40d573ad8c156
Protected main: 8615e8321bf9896f28826a09aa0c9f61ce5ecbb7 (unchanged)

## Authorized scope / user goal
Owner authorized source-only LAB development of chat approval followed by guarded workflow start.
No main/MADRE/production, no Worker/D1 deployment or write, no live trigger, no GitHub environment reviewer bypass, no token, secret, new provider permissions, plugin edits or paid services.
Future desired UX: clear authorize/deny decision in ChatGPT -> verified host owner authorization -> single protected request JSON -> existing GitHub Actions -> existing Worker -> sanitized evidence and checkpoint.
IMPORTANT: ordinary chat text or client-side button callback is NOT a trusted cryptographic issuer. The connected ChatGPT host currently does not expose an authenticated owner attestation issuer or GitHub environment approval action for this plugin. The proof in this checkpoint is a LAB software prototype and simulated host tests, NOT an operational chat-host approval system.

## Change Compatibility Guard OLD -> NEW
- OLD coordinator tools/motorlab-pacman/chat-coordinator.mjs: EXTENDED, not duplicated; existing WebAuthn/controlled-update and legacy execute paths left intact.
- OLD commands tools/motorlab-pacman/candidates/chat-readonly-multiplex-guard-lab.mjs: REUSED unchanged; exactly five GET-only commands, strict request and source SHA guard.
- OLD GitHub Actions .github/workflows/pacman-chat-readonly-multiplex-protected-lab.yml: REUSED unchanged; push-on-single new LAB request; existing required GitHub environment pacman-execution-staging reviewer remains mandatory.
- NEW helper tools/motorlab-pacman/candidates/chat-owner-approval-handoff-lab.mjs: complementary trusted-host approval verification and single trigger handoff seam, not a Worker, issuer, database, scheduler or independent coordinator.
- NEW 15 negative/positive tests tools/motorlab-pacman/candidates/chat-owner-approval-handoff-lab.test.mjs: synthetic host HMAC and mocked connector, no real provider writes.

## Functional prototype
- Coordinator has prepareReadOnlyWorkflowApproval (inert) and submitReadOnlyWorkflowApproval (fail closed unless host injects authenticated trusted signing-verification secret, owner subject, existing durable atomic ledger, existing authenticated GitHub connector and durable checkpoint callback).
- Owner attestation HMAC-SHA256 binds domain, owner subject, new request ID/nonce, issued/expiry <=120 seconds, exact command, LAB branch/path, GitHub parent SHA, existing workflow and guard blob SHA, pinned Worker version, protected main SHA, GET-only method, mandatory GitHub reviewer and decision authorize.
- Denied/expired/tampered/unknown command/changed source/main branch/duplicated nonce/request fails closed. Claims are made in existing atomic durable ledger; an ambiguous create never retries or replays. No chat-provided approved:true or arbitrary SQL, URL, token or provider writes.
- Host connector contract only allows existing GitHub branch read, one new request file create and exact readback. Trigger creation returns TRIGGER_CREATED_AWAITING_GITHUB_REVIEW, NOT workflow execution success. Existing GitHub protected reviewer cannot be bypassed.
- Host integration and credentials are not provisioned; model must NOT claim operational in-chat approval or secretly emulate one.

## Tests and evidence
- First attempt CI run 39187319120 FAILED at the new test file (syntax: await inside non-async lambda). 1035 earlier tests passed; no Worker/provider action performed. Failure repaired by changing only a test fixture in commit a883d69ce5489c8edc99b597eab40d573ad8c156.
- FINAL official CI GitHub Actions run https://github.com/Br174/Chatgpt/actions/runs/39187390099: completed SUCCESS on exact source/test SHA a883d69ce5489c8edc99b597eab40d573ad8c156, run_attempt=1.
- Node 22 tests 1050/1050 PASS, 0 FAIL, 0 SKIP; 15 new tests vs earlier 1035/1035.
- Existing actual Miniflare/workerd runtime smoke passed with markers PACMAN_MCP_READONLY_REAL_WORKER_RUNTIME_NO_WRITE_GUARDS_VERIFIED and PACMAN_WORKERS_RUNTIME_POST_CYCLE_REDIRECT_AND_INERT_DIAGNOSTIC_VERIFIED.
- Scope compare old HEAD..new HEAD shows ONLY 3 changed LAB files: new helper, new tests, existing coordinator; 4 commits total including syntax repair. main remains protected and unchanged.
- No new JSON in .github/pacman-b4/read-command-requests; prior request-20261019-001 is spent. No GH owner review was initiated, no additional Worker GET, no Cloudflare SQL, no D1 mutation, no deploy, no plugin edit.

## Progress, truth boundaries
- Focus activity LAB approved code + regression + checkpoint: 100% when this checkpoint is verified, source/CI evidence 100%, +100 percentage points from not implemented.
- Added test cases: 15, 1050/1050 total, +15 cases vs 1035; first failed revision retained as historical evidence.
- Actual ChatGPT native authenticated consent issuer: NOT CONNECTED / 0% live, delta 0.
- Automatic GitHub environment reviewer approval: NOT CONNECTED / 0% live, delta 0; mandatory review remains until separately approved, tested and authorized alternative.
- Existing five-command live bridge: 1/5 (20%) separately verified by worker-health run 39185764446; no new live commands verified in this project phase.
- Global Pac-Man/MotorLab cross-client project percentage remains NOT DERIVABLE until updated acceptance scope covers APK HTTPS and other AI interoperability.
- Previous Workers Free screenshots historical; no new account billing entitlement verified. No additional paid service used.

## Safe next step and authorization boundary
1. Assess whether authenticated owner identity and signed consent can be issued via this actual ChatGPT plan/plugin surface WITHOUT new paid services; if host does not expose this, use an explicitly authenticated owner-hosted HTTPS consent channel or manual protected GitHub review until a separate approved design is verified.
2. Design secure host integration for LAB-only GET command requests using existing Pac-Man owner authentication and credential storage; never put secrets in chat or GitHub repository. Require fresh owner approval, signed nonce, short TTL, atomic ledger, connected GitHub connector, exact safe readback.
3. GitHub environment approval delegation is SEPARATE: only if owner and GitHub permission model securely authorize verified reviewer identity; never lower protections or self-approve with an untrusted chat boolean.
4. Only after explicitly scoped authorization and verified account permissions, run a fresh LAB end-to-end trial; NEVER replay receipt003 or worker-health request-20261019-001.
5. Preserve a single Worker, existing Pac-Man coordinator, unchanged main and cost-additional-zero preference.

CHECKPOINT_STATE=LAB_CHAT_OWNER_APPROVAL_PROTO_SOURCE_CI_VERIFIED; ACTUAL_HOST_ISSUER=NOT_CONNECTED; LIVE_WORKFLOW_WITH_CHAT_ONLY_APPROVAL=NOT_VERIFIED.
