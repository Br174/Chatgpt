# MotorLab / Pac-Man | CHAT bridge existing Worker D1 003 read-only LAB checkpoint
Date: 2026-10-19 Italy / 2026-10-18 UTC.
STATUS=LAB_CODE_VERIFIED / NO_DEPLOY / NO_PLUGIN_UPDATE / NO_REMOTE_D1_RUN / B4_NATIVE_STILL_OPEN.

## User request and strict boundaries
Owner: "Ok procedi utilizzando motorlab completo più pacman per i lavori manuali in piu aggiungere le percentuali".
Interpretation: continue safe MotorLab/Pac-Man LAB-only development; automate repetitive manual D1 verification when a future explicitly authorized and reviewed staging deployment and private bridge invocation become possible. No authorization to pay, upgrade subscription, expose existing private Worker bearer, modify main/MADRE/production/Cloudflare, install/update existing private plugin, generate new passkey, replay 003, or deploy without a precise review.
Source of truth: `Br174/Chatgpt`, branch `motorlab/pacman-real-operations-lab-20261017`; pre-change HEAD `313cb7edc4a1f44269bb11a57d0719cc8bf5df99`. Protected main pinned `8615e8321bf9896f28826a09aa0c9f61ce5ecbb7`.

## Verified capability and new LAB source
- The existing private personal plugin `motorlab-pacman-control` v0.1.0 exists, source inventory `plugin.json`, `.codex-plugin/plugin.json`, `skills/pacman-control/SKILL.md`. It exposes orchestration skill instructions but no native MCP tools; plugin release `pluginrel_6ad4f58832a88191bd3a56e41b6c49dc` unchanged.
- The same existing Execution Worker source already has source-only MCP `/mcp` read-only tool `pacman_receipt_003_readonly`, tested in 986/986 earlier. This source is NOT deployed and cannot currently be invoked as a native ChatGPT MCP plugin.
- GitHub commit `608f3bbd5e26f5b2fd6805450a29efbffccd2d97` changed exactly two LAB files: `tools/motorlab-pacman/worker-execution-staging.mjs` and new `tools/motorlab-pacman/candidates/chat-bridge-private-receipt-003-lab.test.mjs`.
- Implemented fixed authenticated private `GET /__motorlab_lab/diagnostics/terminal-receipt-003` in the ONE existing Worker Execution, using the already implemented `inspectPacmanReceipt003D1` with only 3 parameterized SELECT queries.
- Exact D1 operation `pacman-chat-passkey-sample-20261018-003`; checks previously independently verified receipt `VERIFIED_UPDATED`, commit `0ed64fcd3bb693d88d89e789ac8c3effe97946da`, prior Git blob, content SHA256, exactly 1 consumed challenge bound to WebAuthn request digest `5bc0a496be64b397aa14dfc3339c67dadef0435e1192dbf682e85dea2cfb0f92`, exactly one nonce claim.
- Denies unauthenticated callers before D1, non-GET HTTP methods, browser Origin and query strings; returns fixed PASS/HOLD metadata, never credentials or arbitrary SQL rows. No D1 .run, no external GitHub fetch/PUT, no new challenge, no deployment. Does not modify `/mcp`, `/execute` or existing diagnostics.
- This private GET can later be driven by the ALREADY EXISTING ChatGPT GitHub connector -> GitHub Actions protected environment `pacman-execution-staging` -> Worker authenticated GET bridge. The user's GitHub reviewer approval remains mandatory, not bypassed. This is a practical ChatGPT bridge, NOT native MCP tool B4.

## Real test evidence
- GitHub Actions run: https://github.com/Br174/Chatgpt/actions/runs/39175706421; head `608f3bbd5e26f5b2fd6805450a29efbffccd2d97`; COMPLETED SUCCESS; attempt 1.
- 992/992 Node tests PASS, 0 FAIL and 0 SKIPPED (prior 986, delta +6 tests).
- Actual Miniflare/workerd smoke logs:
  - `PACMAN_MCP_READONLY_REAL_WORKER_RUNTIME_NO_WRITE_GUARDS_VERIFIED`
  - `PACMAN_WORKERS_RUNTIME_POST_CYCLE_REDIRECT_AND_INERT_DIAGNOSTIC_VERIFIED`
- Six additional negative/positive tests cover exact receipt and no side effects, duplicate safe read, missing and wrong auth, wrong method/browser/query, missing or duplicate receipt/challenge/nonce evidence, and unchanged legacy `/mcp` and `/execute` routes.
- No GitHub Actions protected deploy dispatched; GitHub Actions test workflow carries read-only GitHub permissions, synthetic bearer, no provider secrets.
- The user's prior official D1 screenshot checks for 003 yielded receipt 1, exact receipt 1, nonce 1, challenge 1 with matching request digest and consumed_at=NOT NULL, PASS. This is historical evidence, not a new remote query during this session.
- `tools/motorlab-pacman/lab-workspace/SAMPLE.md` blob remained `6d60cd1fb974bf51d563eb9b025df4f7347330bd`; protected main remains unchanged.

## Product plan / cost feasibility
- Current official OpenAI Help Center: https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt (accessed 2026-10-19). Custom MCP server connections currently documented for Business and Enterprise/Edu on web; mobile cannot configure custom servers. Some plugin workflows vary by plan; do not assume this personal Plus/Android account has native custom server entitlement. No new subscription is allowed or suggested.
- Plugin packaging: https://developers.openai.com/plugins/build/plugins ; current installed private plugin is instruction-only, not a connected server. Do not update it, install/create a second plugin or include bearer secrets in package.
- Existing GitHub connector and protected Actions are an already verified practical bridge without OpenAI API billing. Cloudflare Worker Free quota evidence historically exists; live quota/billing API not rechecked. Cost additional is constrained to zero and no further service was purchased.
- Existing Worker secret PACMAN_EXECUTION_KEY is NOT a safe general-purpose ChatGPT OAuth credential. Do not place in plugin package, logs, chat, or unreviewed third-party connection.

## Progress and next boundary
- Focused new activity `PRIVATE_GET_003_LAB_CODE_AND_TESTS` = 100%, delta +100 percentage points from unimplemented; 992/992 all regressions pass.
- Live automatic D1 result delivery through this new endpoint = NOT VERIFIED (no deploy).
- Historic Real Operations hierarchy: A GitHub 4/4=100% delta 0, B Chat/WebAuthn 3/4=75% delta 0, C Cloudflare staging 4/4=100% delta 0, D recovery 4/4=100% delta 0. Overall 15/16=93.75%, delta +0. Native tool gate B4 remains not complete. Do not count LAB source as 16/16.
- Next: exact one-shot staging-only protected deployment plan with HEAD/binding/version/cloud free limit checks, separate explicitly scoped user consent, no Worker WebAuthn or prod/main changes. Then a single owner GitHub environment reviewer approval and protected exact authenticated GET with only allowlisted PASS/HOLD output, no D1 write or provider PUT. Do not replay old workflows.
- Platform-native plugin connection remains distinct future task, gated on actual account entitlement and secure owner-bound OAuth flow; Plus Android currently not a verified route. Do not bypass host restrictions.
CHECKPOINT_END.
