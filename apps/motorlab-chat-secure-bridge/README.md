# MotorLab LAB06 — AutoSetup Secure Bridge, ChatGPT first

This is a private isolated LAB implementation. Nothing in this folder replaces MotorLab's CORE r36, Android APK, or MADRE.

## Implemented
- MCP Apps-compatible streamable HTTP service at /mcp, with tool open_secure_secrets_panel and a ui:// resource containing the inline form for ChatGPT.
- NO password, token, private key, or secret value is accepted by any MCP tool. The form submits directly from its isolated iframe over HTTPS to /api/repository-secret. No secret enters the model, prompt or chat transcript through this application.
- The HTTPS API destination is locked to GitHub Actions Secrets in the ONE repository Br174/Chatgpt. The backend accepts exactly the five signing-secret names already specified by the workflow.
- User authorizes each write via an explicit checkbox. Backend checks exact form origin, requested name, token and approval. It fetches GitHub's repository public key, encrypts with libsodium sealed box, sends encrypted_value to GitHub and requests secret metadata readback. GitHub does not reveal stored values; the result verifies metadata only.
- Fine-grained GitHub personal access token is entered by the owner ONLY in the isolated form and used for that single request. The token and value are never persisted by the application, and both fields are cleared immediately after an attempt. Values exist transiently in browser and backend runtime memory; do not promise full zeroization of JavaScript strings.
- Real GitHub write is disabled by default (HTTP 423). GitHub authorization, plugin installation, HTTPS deployment and real site tests are NOT yet verified.
- Synthetic tests use locally generated libsodium keypairs, dummy tokens and secrets, with mocked GitHub request/response handling. These tests never modify GitHub.

## Before real use — owner's explicit interventions
1. Deploy the Node 22 server on private/trusted infrastructure, via an HTTPS domain that supports streamable HTTP POST requests. Choose deployment and hosting terms first. Set environment variable MOTORLAB_PUBLIC_ORIGIN=https://your-host.example; also set MOTORLAB_WIDGET_ORIGIN to the unique ChatGPT MCP App sandbox origin approved for the plugin.
2. Connect the resulting remote MCP server to ChatGPT as an authorized custom plugin. It is not installed by merging source into GitHub. Verify that the tool actually opens the embedded secure form on the user's device.
3. One-time authorization: **the owner personally creates** a fine-grained PAT at https://github.com/settings/personal-access-tokens/new with repository owner Br174, ONLY selected repository Chatgpt, repository permission Secrets = Read and write, short expiry and NO unrelated permissions. Never paste this PAT into ChatGPT messages. This v0 uses PAT rather than GitHub App OAuth. Native GitHub App OAuth would require owner registration and installation plus user-session binding, and is **not** implemented or silently authorized here.
4. After end-to-end demo and review, explicitly set MOTORLAB_LIVE_GITHUB_WRITE=true on the trusted host, and separately approve the first real write. Only enter secrets in the actual registered embedded MCP panel. The UI will not write while the server remains in dry-run mode.
5. After GitHub confirms each secret metadata update, confirm all five keys are present and that the release workflow signs with the owner certificate. DO NOT mix temporary test keystores with the production signing identity.

## Runtime environment
- PORT, default 8787
- MOTORLAB_PUBLIC_ORIGIN, e.g. https://secure-bridge.example
- MOTORLAB_WIDGET_ORIGIN, dedicated ChatGPT MCP App sandbox origin
- MOTORLAB_LIVE_GITHUB_WRITE, default false, must be explicitly true to allow GitHub requests
- NODE_ENV, set production to enforce HTTPS and a distinct widget origin
- No GitHub tokens in environment variables or source code are needed by the gateway; owner types a scoped PAT in the protected panel

## Tests and safety
- npm install --no-audit --no-fund
- npm test
- node --check src/server.mjs
- node --check src/github-gateway.mjs
- The server does not log API bodies, upstream errors or secrets.
- CORS exact origin is an additional browser guard, not a substitute for the GitHub PAT. There are no cookies.
- No broad GitHub repository scopes, no external destination from user input, no implicit site navigation, no secret-related GitHub tool calls.
- Real server should be exposed only behind TLS and with provider monitoring; test responsive mobile UI and verify domain ownership, caching, CSP and network policies before live writes.

## Status 13 Oct 2026
Repository source: implementation in isolated LAB.
Synthetic tests: see the GitHub Actions gate outcome.
Hosted MCP endpoint: not deployed or linked to ChatGPT.
Owner PAT: not created.
GitHub Actions secrets write: not attempted.
Real production signing artifact: not produced.

References:
- https://developers.openai.com/plugins/build/chatgpt-ui
- https://developers.openai.com/plugins/build/app-quickstart
- https://docs.github.com/en/rest/actions/secrets
