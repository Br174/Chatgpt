# Pacman AutoSetup — Cloudflare production read-only token (LAB06)

Status: design/implementation gate only. No live authorization, token creation, secret update or production deploy is implied.

## Minimum user interaction
1. Show a chat-hosted status/configuration card. Never ask for a token in ordinary chat, chat inputs, model-visible app bindings, logs, URL, or GitHub source.
2. Cloudflare account is production `5781b597517f6f7fe25751170a99b9ab`. Preselect only Account/D1/Read and Account/Account Settings/Read. No optional IP restriction, expiration, write permission, other accounts, or other services.
3. Creation must be delegated to an authenticated Cloudflare flow or an already-authorized scoped broker; the chat card cannot grant Cloudflare permissions or create tokens itself. If browser authorization is required, explain it and keep it to one action. Do not claim in-chat Cloudflare authorization exists until proven.
4. Only after a trusted HTTPS secret-entry surface is actually deployed and verified, allow user to paste the raw token there. No raw token is passed to the model, chat UI state, client-side model bindings or repo. Broker may update only existing GitHub Actions secret `CLOUDFLARE_PRODUCTION_READ_TOKEN`, with strict origin/session/CSRF checks, scoped GitHub authorization, encrypted transit, no secret logging, and fail-closed errors.
5. Verify token shape locally without exposing the value; verify via Cloudflare read-only endpoints and confirm GitHub secret metadata update, then run the existing main-only read-only identity workflow once. Do not run tests against production until secret and authorization gates pass.
6. No main/MADRE/APK/Worker/D1/KV production changes, deploy, writes, or additional cost. Keep work on LAB06 PR #49; explicit approval required for production deployment.

## Existing implementation gap
`src/generated-panel.mjs` currently exposes Android signing secrets and a GitHub PAT, not Cloudflare token creation. Do not present that panel as if it creates Cloudflare tokens. Implement a dedicated, verified, protected Cloudflare flow before requesting any real token. Never embed raw secret fields in a DIL/AppBlock because they may become model-visible.

## Acceptance
User can complete Cloudflare authorization with minimum manual action; secure transfer and GitHub update verified; read-only identity test passes; no secret disclosure; no production modifications other than explicit GitHub Actions secret replacement. Until then status is BLOCKED, not complete.

## Checkpoint 2026-10-14 — Cloudflare authorization (no credential values)
- User confirmed GitHub Actions `CLOUDFLARE_API_TOKEN` repository secret was updated; Cloudflare Worker edit permission is shown for the intended account. Secret contents remain inaccessible and must never be logged.
- Production/staging D1 read-only identities independently verified (4 GET, zero writes) in run 38564888755; this does not prove Worker deployment authorization.
- OIDC r37 manifest compatibility corrected on LAB branch; seven CI gates succeeded at commit 522212c6dcf5a8d5a376e177a1ef9ebafe23da16.
- Next automatic push triggers isolated LAB06 preview; preview must verify token, panel CSP, crypto and unchanged production version, or fail closed. Production deploy remains blocked by its distinct approval commit gate. No APK, main, MADRE, production D1/KV or Worker deployment authorized here.


## LAB06 recovery checkpoint — 2026-10-14, expired probe authorization
- Verified in LAB06: `.github/autosetup/LAB06_PROBE_APPROVAL.json` has `expires_at=2026-10-13T22:18:55Z`, and `cloudflare/motorlab-state-bridge/wrangler.jsonc` has the same expired `MOTORLAB_AUTOSETUP_PROBE_UNTIL`.
- GitHub signing writes remain explicitly disabled (`MOTORLAB_AUTOSETUP_LIVE_GITHUB_WRITE=false`). The expired marker MUST NOT be treated as a fresh production authorization.
- No production deploy, new token, D1/KV write, or Worker mutation performed during this checkpoint.
- Next safe work: check current CI/preview evidence and production identity, then prepare a NEW short-lived probe window only after verifying its independent production approval gate and fresh source-head binding. A new one-shot approval commit must contain only `.github/autosetup/LAB06_PROBE_APPROVAL.json` and must match the workflow's exact authorized subject; never reuse the expired approval.
- Do not silently enable GitHub signing writes, broaden token scope, or deploy from ordinary push/PR. If required provider capability is unavailable, report the exact blocker without claiming live end-to-end functionality.

## LAB06 verified isolated-preview checkpoint — 2026-10-14
- The old approval was explicitly revoked in commit `366c55640455b1ec378c883fd836a4025c0a1750`: `approved=false`, `deploy_production=false`, and the expired timestamp remains historical only.
- The Wrangler LAB configuration is fail-closed: `MOTORLAB_AUTOSETUP_PROBE_ONLY=false`, `MOTORLAB_AUTOSETUP_PROBE_UNTIL=""`, `MOTORLAB_AUTOSETUP_LIVE_GITHUB_WRITE=false`.
- GitHub Actions run `38597655652` on the revocation commit completed successfully: `verify=success`, isolated `preview=success`, `deploy=skipped`. This is the final verified outcome of the user-authorized preview-only operation.
- User explicitly authorized ONLY isolated preview and explicitly did NOT authorize production changes. Do not create a new production approval, change the production Worker, activate signing writes, or bypass the deploy gate as a continuation of this checkpoint.
- Next permitted work: improve isolated preview tests or documentation in LAB06; rerun preview CI after LAB changes and confirm `deploy=skipped`. Production deployment requires a new, separate explicit user authorization.
- Preview success does not prove that the live production AutoSetup service is deployed or functional.
