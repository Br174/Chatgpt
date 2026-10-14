# Pacman execution Worker: activation checklist (LAB only)

Deployment is **manual**, not automatic. It creates a **different Worker** from `motorlab-pacman-staging-lab`, leaving the existing health endpoint untouched.

## Required staging-only setup
1. In GitHub Actions environment `pacman-execution-staging`, require reviewer approval and store deployment secrets `PACMAN_CF_API_TOKEN` and `PACMAN_CF_ACCOUNT_ID`. Cloudflare token must be scoped only to the separate MotorLab-Staging account and Workers deployment. Do not paste secrets in chat.
2. In the **dedicated execution Worker**, configure Worker secrets `PACMAN_EXECUTION_KEY` (random >=32 characters) and `PACMAN_GITHUB_TOKEN` (fine-grained credential with Contents read/write on `Br174/Chatgpt`, short expiration). Do not configure them on the existing health Worker. The GitHub token is repo-scoped; branch/path restrictions are enforced by code, not by GitHub token permissions.
3. Verify the binding `DB` targets **only** D1 `eb834fc1-5589-4f75-bcb9-d311d0d72261`. Confirm account identity before deployment.
4. Manually dispatch `Pacman execution staging deploy (manual, gated)` on the LAB branch only, after credentials and reviewer approval.
5. Invoke POST /execute with Authorization Bearer execution key, JSON `{"operationId":"unique-8-plus-chars","content":"unique lab probe","approval":true}`. Never send keys or payloads containing secrets to the chat.
6. Read `pacman_operations` in the isolated D1 and verify `VERIFIED_AND_REMOVED`; independently confirm GitHub probe file absent. Preserve the receipt and stop on any recovery state.

## Caveats
- The current Worker execution endpoint is **not deployed** and **not verified on live Cloudflare**.
- GitHub Actions deployment does not automatically provision Worker secrets. They must exist on the separate Worker; if the deployment process overwrites them, stop and recheck before executing.
- No credential or permission configuration is verified remotely by these repository changes.
- No automatic rollback, distributed lock across different operation IDs, or external authentication service is claimed.
- If no staging-only deployment credential exists, do not trigger the workflow.
