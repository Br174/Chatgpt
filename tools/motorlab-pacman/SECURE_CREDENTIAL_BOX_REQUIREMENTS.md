# Pac-Man Secure Credential Box — product requirement and trust boundary

Status: REQUIRED / NOT IMPLEMENTED IN CHATGPT HOST.

User experience: a compact MotorLab panel in the ChatGPT conversation selects provider (GitHub or Cloudflare), credential type (token, secret, password), securely accepts a masked value, submits it to a trusted credential receiver, and shows only provider + verified/rejected + timestamp. No original provider dashboard navigation required after credential creation, where provider APIs permit it.

NON-NEGOTIABLE: The ordinary ChatGPT input, DIL text input, form submission, GenUI.issueNewTurn, or chat tool arguments must never be used to carry secret values. A masked field alone is not sufficient. Do not implement a fake Submit button that posts a token as conversation text. No credentials in GitHub, Worker logs, telemetry, URLs, browser storage, or assistant-visible outputs.

Implementation prerequisite: ChatGPT host support for a privileged secret-entry control or an installed connector that exposes a verified secret-submission interaction with secure transport directly to a dedicated receiver. Such an interface is not currently available to this agent. Without it, keep Submit disabled and display 'secure channel unavailable'. Never silently fall back to chat.

Receiver requirements: dedicated staging Worker, HTTPS, strict Origin/CSRF protection appropriate to the hosting model, authenticated user-to-session binding, least-privilege provider scopes, encrypted-at-rest credential storage or provider-native vault, no logging of values, length and rate limits, TTL/rotation/revocation, explicit consent and audit of non-sensitive metadata. Prefer OAuth/provider-native delegated auth to handling account passwords. Reject ordinary account passwords where delegated authorization is supported.

Activation acceptance criteria:
1. Host-provided secure field demonstrated not to surface value in conversation or model-visible tool calls.
2. Receiver identity and transport independently verified.
3. End-to-end secret handling and revocation tested with a disposable staging credential.
4. Failed/expired/unauthorized requests rejected; no side effects in production.
5. A real user submits a disposable staging token via the in-chat control and sees only verification status.
6. No deployment to production or modification to MADRE until explicitly approved.

Current working alternative: GitHub connector is already authorized; direct chat GitHub LAB operations need no pasted token. Worker remote execution remains fail-closed until trusted approval issuer and credential channel exist.
