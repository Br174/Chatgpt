# Pacman Steel Guard — activation boundary

State: LAB only. No GitHub administrative permission granted or assumed.

## Secure authorization
1. Preferred long-term route: GitHub App installation scoped **only** to `Br174/Chatgpt`, with repository Administration **read/write** and minimal additional permissions. The account owner must approve installation through GitHub's authenticated HTTPS UI. Never send credentials, private keys, tokens or OTP through chat, repository, issues, PRs, Actions logs, or tool calls.
2. A GitHub App installation token should be minted server-side only in an already authorized, secured backend; store app private key in a secret manager, never in Git. Use short-lived tokens and audit actions.
3. Current LAB implementation accepts `PACMAN_GITHUB_ADMIN_TOKEN` in process environment for a single explicit invocation; it does **not** implement a GitHub App installation, OAuth authorization, browser UI, or automatic scheduling. Do not claim otherwise.
4. Do not activate an automatic write-capable workflow or add an administrative token to a GitHub Actions workflow. First conduct independent security review and an explicit owner-approved activation.

## Activation gates
- Verify authorized identity, target repository, exact branch `main`, active ruleset contents and existing rules before any write.
- Dry-run audit first; require explicit `--apply` only in a secure administrative execution environment.
- Apply only after security review; audit via GitHub API after creation and confirm protection. Refuse on errors; do not weaken other rules.
- Do not alter MADRE/main, APK, Cloudflare production, native project engines, or signing secrets as part of this LAB.
- Revoke admin authorization after one-time use if no ongoing automation is required.

## Current known limitation
The connected ChatGPT GitHub toolset exposes no ruleset creation/update operation. This document does not change connector permissions. Initial owner authorization is unavoidable.
