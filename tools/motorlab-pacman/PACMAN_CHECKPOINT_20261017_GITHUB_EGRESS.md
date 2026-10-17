# Pac-Man LAB — GitHub egress recovery, 17 October 2026

Status: `REAL_OWNER_BIOMETRIC_GITHUB_CYCLE_VERIFIED_WAITING_PROTECTED_FINAL_D1_READBACK`. The owner completed a fresh Android passkey assertion and the actual GitHub create/read/delete/read LAB cycle. Independent GitHub inspection confirms both commits, exact approved content, probe removal, and restoration of the whole pre-cycle repository tree. Do not execute this operation again.
Session release pin: `2026.10.14-r37`. R38 continuity rules remain applicable as recorded by the canonical CORE; this is not an r38 release promotion.

## Identity and verified baseline

- Repository: `Br174/Chatgpt`.
- LAB branch: `motorlab/pacman-execution-v2-lab-20261014`.
- Parent HEAD: `fbd1359823722061b2f96a989a785a9485c5c9b5`.
- Owner cycle operation ID: `pacman-webauthn-lab-20261017-ff59959a-01`.
- Exact allowed probe: `tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt`.
- No project hook or `.motorlab/` satellite was found in the complete, non-truncated LAB tree. No satellite was invented or created during this repair.

## Actual owner-approved cycle — 17 October 2026, 21:23 Europe/Rome

- Operation: `pacman-webauthn-lab-20261017-ff59959a-01`, unchanged throughout recovery.
- Owner screenshot at 21:23 shows `Operazione verificata e completata.` for the exact authorized LAB branch, probe and content.
- Pre-cycle HEAD: `3f6a40a790295469114b9af025b402c6be0fa508`.
- Create commit at 19:23:26 UTC: https://github.com/Br174/Chatgpt/commit/ed5a4cc61063f73349ddd6f7935bc626d9160149
- Cleanup commit at 19:23:27 UTC: https://github.com/Br174/Chatgpt/commit/bf2bea705188d2c01be462e514c8c385c8342a72
- Each commit changes only `tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt`; creation content was independently checked byte-for-byte, including the final newline, against the approved JSON below.
- Pre-cycle and cleanup trees are identical: `173894b405655186296d6a58c1c6e742bcf67d07`. GitHub comparison contains two commits and zero net changed files. The probe is absent after cleanup.
- The deployed relay emits `PACMAN_OPERATION_VERIFIED` only for a matching `VERIFIED_AND_REMOVED` Execution receipt. Execution awaits successful D1 persistence (`success:true`, exactly one changed row) before returning that receipt. This is strong receipt-path evidence; a separate protected GET readback of the post-cycle D1 state remains pending.
- The existing read-only audit workflow now additionally reads the already deployed fixed-operation recovery endpoint. It requires final checkpoint `VERIFIED_AND_REMOVED`, an existing single-use approval claim, valid consumed challenge counts, exact D1 schema, current GitHub readiness and probe absence. It never starts WebAuthn, executes a cycle, changes a schema, deploys a Worker, clears claims or emits credentials.
- Final-audit regression verification: 12/12 targeted tests and 750/750 full local tests passed; YAML and GET-only protected boundaries passed. Independent code review reported no findings. This verification covers the audit code, not yet the live post-cycle D1 readback.
- Current user-action boundary: GitHub environment review for this final read-only audit. The GitHub connector cannot approve protected deployments. No further biometric assertion is needed for this completed operation.

## New POST relay failure and verified local correction

Successful repair rollout: https://github.com/Br174/Chatgpt/actions/runs/39061359612

- Deployed source: `efc4dfd973489b430949fa1b2ae6d56cf70ffd64`.
- WebAuthn Worker version: `23428a1c-920d-4d63-9514-49eb92fc04bf`.
- Execution Worker version: `8e5680ab-ce88-4785-9fc4-dbc84604f0ba`.
- Real recovery readback: checkpoint `NONE`, approval claim absent, challenge count `3`, consumed count `3`. Previous challenges must not be replayed; the next owner click must create a fresh challenge for the same exact operation.
- `PACMAN_PRIVATE_POST_TRANSPORT_VERIFIED_NO_MUTATIONS` passed on the real staging Service Binding after deployment.
- `PACMAN_EXECUTION_READY_FOR_SEPARATE_OWNER_BIOMETRIC_APPROVAL` and `PACMAN_LAB_PROBE_WAS_NOT_CREATED_OR_DELETED` both passed.
- The historical initial WebAuthn deployment workflow is now manual-only, preserving its already-activated abort guard. It no longer auto-competes on WebAuthn source changes. An older pending run is not a continuation target and must not be approved.

- At approximately 21:00 Europe/Rome the owner's portal reported `PACMAN_EXECUTOR_UNREACHABLE` after the passkey step.
- At the time of that failed attempt, remote HEAD was `f94456c2db0aee0731c42209c4c311903414ed4d` and contained no probe create/delete. The required pre-retry D1 recovery gate subsequently passed in run `39061359612`.
- The exact source relay reproduced the same failure in workerd through Miniflare `4.20260730.0`: `redirect:"error"` throws during Request construction. Node's Request accepted it, so Node-only tests had missed this runtime incompatibility.
- The actual runtime error requires `follow` or `manual`; the correction uses `manual`, rejects all 3xx explicitly, never retries an ambiguous call, and retains the private Service Binding without public fallback.
- One request constructor is shared by real execution and the protected diagnostic. The diagnostic sends only empty JSON `{}` to the existing `/execute` gate, which must return HTTP400 `INVALID_REQUEST` before approval, D1 or GitHub mutation paths.
- The workerd test uses the actual relay and actual Execution validation handler with synthetic credentials, no real D1, and external network disabled by the test harness. RED500 `PACMAN_EXECUTOR_UNREACHABLE` became GREEN; internal redirects are rejected and the inert POST diagnostic passes.
- Local regression suite after final legacy-trigger retirement: 745 passed, 0 failed. The runtime test runs separately and is mandatory in CI before protected deployment; it also passed in the successful repair run.
- The single canonical rollout now deploys the WebAuthn Worker only when its current private POST proof/revision is missing; it preserves existing secrets, owner enrollment and parity marker. Preflight checks the real recovery state, then postdeploy requires private POST proof plus HMAC, D1 schema and GitHub GET readiness.
- A consumed WebAuthn challenge is not a reusable approval. Do not repeat the actual file cycle, create a new operation ID, clear claims, or bypass recovery merely because the previous Request failed.

## Previous successful GET readiness verification

Successful protected rollout: https://github.com/Br174/Chatgpt/actions/runs/39058170571

- Deployed source: `3d1dea52a8d0c09a77a6edc6d988cf59c4ac03c7`.
- Execution Worker version: `e0abdad8-ad8f-432f-9ddb-a952240e8950`.
- Fresh HMAC before deployment and private HMAC after deployment both succeeded.
- WebAuthn deployment and parity-marker rewrite were correctly skipped.
- `PACMAN_EXECUTION_READY_FOR_SEPARATE_OWNER_BIOMETRIC_APPROVAL` confirmed exact schema and successful real GitHub readiness.
- `PACMAN_LAB_PROBE_WAS_NOT_CREATED_OR_DELETED` confirmed no probe mutation.
- Independent public GET readback: `/webauthn/status` HTTP200, `configured:true`, `enrolled:true`; `/webauthn/approve` HTTP200 with the expected approval button.

Historical approved operation: the complete approval link contained the base64url UTF-8 JSON below in its `#` fragment. The payload is non-secret and was round-trip validated against the canonical WebAuthn intent policy. The actual operation is now completed; retain the payload for audit, never offer it as a fresh execution link.

```json
{"intent":{"capability":"github.lab-file-cycle","operationId":"pacman-webauthn-lab-20261017-ff59959a-01","branch":"motorlab/pacman-execution-v2-lab-20261014","path":"tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt"},"content":"MotorLab Pac-Man: collaudo WebAuthn staging LAB del 17 ottobre 2026. File temporaneo da verificare e rimuovere.\n"}
```

Approval-page base: `https://motorlab-pacman-webauthn-staging-lab.motorlab-staging.workers.dev/webauthn/approve#`.
The challenge is created only when the owner presses the approval button. No assertion or authorization token is embedded in this checkpoint.

## Earlier diagnostic evidence

Read-only audit: https://github.com/Br174/Chatgpt/actions/runs/39053150909

The workflow completed successfully as a diagnostic, not as proof of readiness:

- `PACMAN_POSTPARITY_GITHUB_ACTIONS_PROBE_ABSENT`.
- Category `EXECUTION_GITHUB_EGRESS_READ_FAILURE`.
- Schema verified `true`; readiness HTTP `503`, error `STAGING_GITHUB_READ_UNAVAILABLE`.
- WebAuthn authenticated and public GitHub diagnostics both HTTP `200`.
- No deploy, GitHub create/delete, or D1 mutation occurred in that audit.

Previous signing workflow: https://github.com/Br174/Chatgpt/actions/runs/39037378193

Its private HMAC proof and independent gate activation succeeded. The later GitHub readiness check failed. Do not repeat enrollment, bootstrap, or initial gate activation.

## Root-cause hypothesis and verification

The existing Execution Contents adapter omitted `User-Agent`; the working WebAuthn GitHub path includes it. GitHub requires a valid explicit application User-Agent:
https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api#user-agent-required

Two new regression tests first failed with `GITHUB_READ_FAILED_403` and readiness `503`, respectively. Adding `User-Agent: motorlab-pacman-execution` made both pass. The subsequent real staging readback also passed. This closes the missing-header defect; full WebAuthn-to-GitHub end-to-end acceptance still requires the owner's new biometric and actual file-cycle verification.

- Clean baseline: 726 tests passed, 0 failed.
- Final local suite: 739 tests passed, 0 failed, including 11 workflow refresh tests.
- YAML parsed; GitHub `contents: read`, protected environment, branch constraints, manual redirect handling, and `--keep-vars` preserved.

## Change Compatibility Guard — existing owners reused

| Responsibility | Previous behavior | Current behavior | Classification |
|---|---|---|---|
| Existing Contents adapter | No explicit application User-Agent | Adds only the required header to the same fixed-host, fixed-branch, fixed-path requests | Complementary extension |
| Canonical issuer-parity rollout | Any pre-existing parity marker required a separate manual audit | Exact secret marker plus verified live schema and fresh private HMAC allow Execution-only refresh | Narrow supersession after the completed audit |
| First activation | Gate absent; deploy both Workers, prove HMAC, enable gate | Same initial sequence retained | Independent protected path |
| Refresh after proven parity | Initial-only rollout, then Execution-only refresh | Deploy WebAuthn only when current inert POST proof is missing; preserve the parity marker and reverify private POST/HMAC/readiness after deploy | Same rollout owner, no second writer |
| Historical Execution deployment/refresh workflows | Manual-only or disabled push triggers | Unchanged | Preserved, not reactivated |
| Existing post-parity read-only audit | Diagnostic categories could produce a green run while readiness failed | Final acceptance requires healthy readiness plus a GET-only readback of the completed operation in the existing recovery endpoint | Narrow extension of the same protected audit owner; no runtime/deploy route added |

Negative tests block wrong HMAC, public transport, duplicate/non-secret marker, relocked runtime, consumed approval, changed HEAD, and an existing probe. None of these cases emits permission to deploy.

## Resume sequence

1. Recheck current LAB HEAD before any source ref update; reconcile concurrent changes.
2. The canonical repair run `39061359612` and real owner-approved GitHub cycle have completed successfully. Do not repeat registration, bootstrap, deployment, passkey assertion or file cycle.
3. Continue only the current `.github/workflows/pacman-execution-postparity-readonly.yml` final audit after its protected environment review. Do not approve historical pending deployment runs.
4. Require GET-only final D1 readback: `VERIFIED_AND_REMOVED`, claim present, sane consumed challenge counts; also require current GitHub probe absence, exact schema and healthy readiness.
5. Read the actual final-audit logs, record the run ID and verified values in this checkpoint, and close the authorized staging LAB milestone. A green source test alone does not close the audit.
6. Preserve the consumed claim and completed checkpoint. Any broader capability, promotion, main/MADRE/production change or new operation needs its own authorized scope.

## Scope and progress

No main, MADRE, production, D1 schema, Cloudflare Access, new token, paid service, or permission expansion is authorized. Existing protected staging deploys and necessary LAB repairs remain within the approved scope. Do not approve old run `39037125095`.

Progress since the previous checkpoint: WebAuthn/passkey `100%` (delta `+1%`); actual owner-approved GitHub LAB cycle `100%` (previously incomplete); Pac-Man global historical estimate `99%` (delta `+1%`), pending the independent protected final D1 readback. The last two points of the earlier 98% estimate are tracked as one point for the actual biometric GitHub cycle and one for final persisted-state verification. These are continuity estimates, not a newly reconstructed weighted inventory of every possible Pac-Man capability. Global 100% remains unavailable before the final audit, and completion will apply only to the authorized staging LAB milestone, never unrestricted provider administration or production promotion.
