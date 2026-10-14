// Isolated Cloudflare staging entrypoint. No deployment or credential handling.
// The host must provide an authenticated GitHub adapter and explicit approval.
// The DB binding is injected by Cloudflare; no production fallback is allowed.
import {createD1Ledger} from "./d1-ledger.mjs";
import {runGithubLabFileCycle, PacmanDenied} from "./execution-v2.mjs";

export function makePacmanStagingRunner({env, githubAdapter, onCheckpoint}) {
  if (!env || !env.DB || typeof env.DB.prepare !== "function")
    throw new PacmanDenied("STAGING_D1_BINDING_REQUIRED");
  if (!githubAdapter || ["read","create","remove"].some(k => typeof githubAdapter[k] !== "function"))
    throw new PacmanDenied("GITHUB_ADAPTER_REQUIRED");
  if (typeof onCheckpoint !== "function")
    throw new PacmanDenied("CHECKPOINT_WRITER_REQUIRED");
  const ledger = createD1Ledger(env.DB);
  return Object.freeze({
    async execute({operationId, branch, path, content, approval = false} = {}) {
      return runGithubLabFileCycle({
        operationId, branch, path, content,
        approval, adapter: githubAdapter, ledger, onCheckpoint
      });
    },
    async readReceipt(operationId) { return ledger.get(operationId); }
  });
}
