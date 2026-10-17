# Pac-Man LAB — GitHub egress recovery, 17 October 2026

Status: `LIVE_PRIVATE_POST_AND_RECOVERY_VERIFIED_WAITING_FRESH_OWNER_ASSERTION`. The corrected private POST transport, D1 recovery, HMAC and GitHub GET readiness have all passed the protected staging rollout. The actual owner-approved GitHub file cycle remains pending.
Session release pin: `2026.10.14-r37`. R38 continuity rules remain applicable as recorded by the canonical CORE; this is not an r38 release promotion.

## Identity and verified baseline

- Repository: `Br174/Chatgpt`.
- LAB branch: `motorlab/pacman-execution-v2-lab-20261014`.
- Parent HEAD: `fbd1359823722061b2f96a989a785a9485c5c9b5`.
- Owner cycle operation ID: `pacman-webauthn-lab-20261017-ff59959a-01`.
- Exact allowed probe: `tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt`.
- No project hook or `.motorlab/` satellite was found in the complete, non-truncated LAB tree. No satellite was invented or created during this repair.

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
- Current remote HEAD was `f94456c2db0aee0731c42209c4c311903414ed4d`; the latest commit history contained no probe create/delete. The live D1 state must still be read through the protected recovery gate before another attempt.
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

The complete approval link must contain the base64url UTF-8 JSON below in its `#` fragment. Opening the bare approval page has no operation and is not a valid continuation link. The payload is non-secret and has been round-trip validated against the canonical WebAuthn intent policy.

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

Negative tests block wrong HMAC, public transport, duplicate/non-secret marker, relocked runtime, consumed approval, changed HEAD, and an existing probe. None of these cases emits permission to deploy.

## Resume sequence

1. Recheck current LAB HEAD before any source ref update; reconcile concurrent changes.
2. The canonical repair run `39061359612` has completed successfully. Do not rerun enrollment, deployment or environment review merely to resume this operation. The earlier successful run `39058170571` proved GET readiness only and is historical.
3. Real D1 recovery with no existing claim or uncertain checkpoint, fresh private HMAC, preserved enrollment/secrets/parity, successful private POST diagnostic, exact D1 schema, and GitHub GET readiness are now verified. No schema changes occurred.
4. Prepare the full approval link from the exact non-secret operation JSON above; preserve the same operation ID, branch, path and content.
5. Request a separate fresh owner passkey assertion; the three consumed challenges from prior failed attempts must not be replayed. The owner button performs the existing create/read/delete/read LAB cycle after successful passkey verification. Do not invoke it on the owner's behalf.
6. Preserve checkpoint/claim integrity; do not retry an uncertain mutation blindly.

## Scope and progress

No main, MADRE, production, D1 schema, Cloudflare Access, new token, paid service, or permission expansion is authorized. Existing protected staging deploys and necessary LAB repairs remain within the approved scope. Do not approve old run `39037125095`.

Carry forward Pac-Man global `98%` and WebAuthn `99%`, both delta `0%`, pending the actual biometric GitHub cycle. Root Cause Closure for the missing-header defect is verified; overall end-to-end acceptance remains pending. Neither green source tests nor readiness alone are global completion.
