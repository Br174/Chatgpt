import sodium from "libsodium-wrappers";

// Fixed private repository: caller cannot override the target via MCP or HTTP.
// The token must be a user-created, fine-grained PAT restricted to this repository
// with GitHub Actions Secrets repository permission "Read and write".
export const REPOSITORY = "Br174/Chatgpt";
export const ALLOWED_SECRETS = Object.freeze([
  "MOTORLAB_MAIN_KEYSTORE_B64",
  "MOTORLAB_MAIN_STORE_PASSWORD",
  "MOTORLAB_MAIN_KEY_ALIAS",
  "MOTORLAB_MAIN_KEY_PASSWORD",
  "MOTORLAB_MAIN_CERT_SHA256"
]);
const API = "https://api.github.com/repos/Br174/Chatgpt/actions/secrets";
const SHA256_PATTERN = /^[0-9a-fA-F]{64}$/;
const MAX_PLAINTEXT_BYTES = 131072;

export class PublicSafeError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function assertToken(token) {
  if (typeof token !== "string" || token.length < 20 || token.length > 1024 ||
      /[\s\r\n]/.test(token)) throw new PublicSafeError("AUTH_REQUIRED");
}
function assertName(name) {
  if (!ALLOWED_SECRETS.includes(name)) throw new PublicSafeError("SECRET_NAME_FORBIDDEN");
}
function assertValue(name, value) {
  if (typeof value !== "string" || value.length < 1 ||
      Buffer.byteLength(value, "utf8") > MAX_PLAINTEXT_BYTES) {
    throw new PublicSafeError("INVALID_SECRET_VALUE");
  }
  if (name === "MOTORLAB_MAIN_CERT_SHA256" && !SHA256_PATTERN.test(value)) {
    throw new PublicSafeError("INVALID_CERT_FINGERPRINT");
  }
  if (name === "MOTORLAB_MAIN_KEY_ALIAS" && !/^[a-zA-Z0-9_.-]{1,128}$/.test(value)) {
    throw new PublicSafeError("INVALID_KEY_ALIAS");
  }
}
function headers(token) {
  return {
    "Authorization": "Bearer " + token,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "MotorLab-AutoSetup-SecureBridge-LAB06"
  };
}
async function request(fetchImpl, url, options) {
  // The only allowed URLs are this repository's GitHub Actions Secrets routes.
  if (!url.startsWith(API + "/")) throw new PublicSafeError("TARGET_FORBIDDEN");
  let response;
  try {
    response = await fetchImpl(url, { ...options, redirect: "error",
      signal: AbortSignal.timeout(12000) });
  } catch (_) {
    throw new PublicSafeError("GITHUB_CONNECTION_FAILED");
  }
  return response;
}
export async function getPublicKey({ token, fetchImpl = fetch }) {
  assertToken(token);
  const res = await request(fetchImpl, API + "/public-key",
    { method: "GET", headers: headers(token) });
  if (res.status === 401 || res.status === 403 || res.status === 404) {
    throw new PublicSafeError("GITHUB_PERMISSION_MISSING");
  }
  if (!res.ok) throw new PublicSafeError("GITHUB_KEY_UNAVAILABLE");
  let data;
  try { data = await res.json(); } catch (_) {
    throw new PublicSafeError("GITHUB_KEY_INVALID");
  }
  if (!data || typeof data.key_id !== "string" || typeof data.key !== "string" ||
      !/^[a-zA-Z0-9+/=]{40,100}$/.test(data.key)) {
    throw new PublicSafeError("GITHUB_KEY_INVALID");
  }
  await sodium.ready;
  const publicKey = sodium.from_base64(data.key, sodium.base64_variants.ORIGINAL);
  if (publicKey.length !== sodium.crypto_box_PUBLICKEYBYTES) {
    throw new PublicSafeError("GITHUB_KEY_INVALID");
  }
  return { key_id: data.key_id, key: data.key };
}

/** Pure bytes -> sealed box for testing. Never put plaintext in a tool result. */
export async function encryptForGitHub(plaintext, keyBase64) {
  await sodium.ready;
  const key = sodium.from_base64(keyBase64, sodium.base64_variants.ORIGINAL);
  if (key.length !== sodium.crypto_box_PUBLICKEYBYTES)
    throw new PublicSafeError("GITHUB_KEY_INVALID");
  const bytes = sodium.from_string(plaintext);
  try {
    const cipher = sodium.crypto_box_seal(bytes, key);
    return sodium.to_base64(cipher, sodium.base64_variants.ORIGINAL);
  } finally {
    sodium.memzero(bytes);
  }
}

export async function setRepositorySecret({
  token, name, value, approval, fetchImpl = fetch, liveEnabled = false
}) {
  // All gates must pass before even reading the GitHub public key.
  if (!liveEnabled) throw new PublicSafeError("LIVE_WRITES_DISABLED");
  if (approval !== true) throw new PublicSafeError("USER_APPROVAL_REQUIRED");
  assertToken(token);
  assertName(name);
  assertValue(name, value);

  const pub = await getPublicKey({ token, fetchImpl });
  const encrypted = await encryptForGitHub(value, pub.key);
  const url = API + "/" + encodeURIComponent(name);
  const put = await request(fetchImpl, url, {
    method: "PUT",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify({ encrypted_value: encrypted, key_id: pub.key_id })
  });
  if (![201, 204].includes(put.status)) {
    throw new PublicSafeError(put.status === 401 || put.status === 403 ?
      "GITHUB_PERMISSION_MISSING" : "GITHUB_REJECTED_WRITE");
  }
  const get = await request(fetchImpl, url, {
    method: "GET", headers: headers(token)
  });
  if (!get.ok) throw new PublicSafeError("GITHUB_READBACK_FAILED");
  let metadata;
  try { metadata = await get.json(); } catch (_) {
    throw new PublicSafeError("GITHUB_READBACK_FAILED");
  }
  if (!metadata || metadata.name !== name || !metadata.updated_at) {
    throw new PublicSafeError("GITHUB_READBACK_MISMATCH");
  }
  // GitHub intentionally will not return the secret value; we verify metadata only.
  return { status: "GITHUB_METADATA_VERIFIED", name,
    updated_at: String(metadata.updated_at).slice(0, 40),
    value_readable: false, destination: REPOSITORY };
}


export const PROBE_SECRET_NAME = "MOTORLAB_AUTOSETUP_LAB06_PROBE";
export async function probeRepositorySecrets({
  token, approval, fetchImpl = fetch, liveEnabled = false
}) {
  if (!liveEnabled) throw new PublicSafeError("LIVE_WRITES_DISABLED");
  if (approval !== true) throw new PublicSafeError("USER_APPROVAL_REQUIRED");
  assertToken(token);
  const url = API + "/" + PROBE_SECRET_NAME;
  const before = await request(fetchImpl, url, { method: "GET", headers: headers(token) });
  if (before.status !== 404) {
    if (before.ok) throw new PublicSafeError("PROBE_SECRET_ALREADY_EXISTS");
    if (before.status === 401 || before.status === 403)
      throw new PublicSafeError("GITHUB_PERMISSION_MISSING");
    throw new PublicSafeError("PROBE_PRECHECK_FAILED");
  }

  const syntheticValue = "motorlab-lab06-probe-" + crypto.randomUUID();
  const pub = await getPublicKey({ token, fetchImpl });
  const encrypted = await encryptForGitHub(syntheticValue, pub.key);
  const put = await request(fetchImpl, url, {
    method: "PUT",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify({ encrypted_value: encrypted, key_id: pub.key_id })
  });
  if (![201, 204].includes(put.status)) {
    throw new PublicSafeError(put.status === 401 || put.status === 403
      ? "GITHUB_PERMISSION_MISSING" : "GITHUB_REJECTED_WRITE");
  }

  let receipt, failure;
  try {
    const get = await request(fetchImpl, url, { method: "GET", headers: headers(token) });
    if (!get.ok) throw new PublicSafeError("GITHUB_READBACK_FAILED");
    let metadata;
    try { metadata = await get.json(); } catch {
      throw new PublicSafeError("GITHUB_READBACK_FAILED");
    }
    if (!metadata || metadata.name !== PROBE_SECRET_NAME || !metadata.updated_at)
      throw new PublicSafeError("GITHUB_READBACK_MISMATCH");
    receipt = {
      status: "GITHUB_PROBE_VERIFIED_AND_REMOVED",
      name: PROBE_SECRET_NAME,
      updated_at: String(metadata.updated_at).slice(0, 40),
      value_readable: false,
      destination: REPOSITORY
    };
  } catch (error) {
    failure = error instanceof PublicSafeError ? error : new PublicSafeError("BRIDGE_UNAVAILABLE");
  }

  // Always remove the temporary secret after a successful GitHub create/update response.
  const del = await request(fetchImpl, url, { method: "DELETE", headers: headers(token) });
  if (del.status !== 204) throw new PublicSafeError("PROBE_CLEANUP_FAILED");
  const after = await request(fetchImpl, url, { method: "GET", headers: headers(token) });
  if (after.status !== 404) throw new PublicSafeError("PROBE_CLEANUP_FAILED");
  if (failure) throw failure;
  return receipt;
}
