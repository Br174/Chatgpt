import nacl from "tweetnacl";
import { blake2b } from "@noble/hashes/blake2.js";

// Pure JavaScript crypto_box_seal compatible with libsodium (GitHub Actions):
// ephemeral Curve25519 public key || XSalsa20-Poly1305 box;
// nonce = BLAKE2b-192(ephemeral public key || recipient public key).
const SEAL_HEADER_BYTES = 48;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
function decodePublicKey(keyBase64) {
  if (typeof keyBase64 !== "string" ||
      !/^[A-Za-z0-9+/]{43}=$/.test(keyBase64))
    throw new PublicSafeError("GITHUB_KEY_INVALID");
  let data;
  try { data = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0)); }
  catch { throw new PublicSafeError("GITHUB_KEY_INVALID"); }
  if (data.length !== nacl.box.publicKeyLength) throw new PublicSafeError("GITHUB_KEY_INVALID");
  return data;
}
function encodeBase64(bytes) {
  // Worker / Node modern runtimes support btoa. Do not log plaintext or bytes.
  let value = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    value += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(value);
}
function sealedBox(plaintextBytes, recipientPublicKey) {
  const entropy = globalThis.crypto?.getRandomValues?.bind(globalThis.crypto);
  if (typeof entropy !== "function")
    throw new PublicSafeError("CRYPTO_ENTROPY_UNAVAILABLE");
  // Explicitly require WebCrypto CSPRNG; no Math.random, no Node-only polyfill.
  nacl.setPRNG((output, length) => {
    for (let at = 0; at < length; at += 65536)
      entropy(output.subarray(at, Math.min(at + 65536, length)));
  });
  const ephemeral = nacl.box.keyPair();
  let nonce, authBox;
  try {
    const input = new Uint8Array(64);
    input.set(ephemeral.publicKey);
    input.set(recipientPublicKey, 32);
    nonce = blake2b(input, { dkLen: 24 });
    input.fill(0);
    authBox = nacl.box(plaintextBytes, nonce, recipientPublicKey, ephemeral.secretKey);
    const result = new Uint8Array(ephemeral.publicKey.length + authBox.length);
    result.set(ephemeral.publicKey);
    result.set(authBox, ephemeral.publicKey.length);
    if (result.length !== plaintextBytes.length + SEAL_HEADER_BYTES)
      throw new PublicSafeError("CRYPTO_SEAL_FAILED");
    return result;
  } finally {
    ephemeral.secretKey.fill(0);
    if (nonce) nonce.fill(0);
    if (authBox) authBox.fill(0);
  }
}


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
// Only server-authored stage names: never expose URL data, exception messages,
// token contents, or upstream response bodies in any user-visible diagnostic.
const READ_STAGES = new Set([
  "KEY_FETCH","SIGN_READBACK","PROBE_PRECHECK","PROBE_READBACK","PROBE_CLEANUP_VERIFY"
]);
const REQUEST_STAGES = new Set([
  ...READ_STAGES,"SIGN_CREATE","PROBE_CREATE","PROBE_DELETE"
]);
async function request(fetchImpl, url, options, stage) {
  if (!url.startsWith(API + "/")) throw new PublicSafeError("TARGET_FORBIDDEN");
  if (!REQUEST_STAGES.has(stage)) throw new PublicSafeError("BRIDGE_UNAVAILABLE");
  const isRead = options?.method === "GET";
  const attempts = isRead && READ_STAGES.has(stage) ? 2 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    let response;
    try {
      response = await fetchImpl(url, { ...options, redirect: "manual",
        signal: AbortSignal.timeout(12000) });
    } catch (error) {
      const timeout = error?.name === "TimeoutError" || error?.name === "AbortError";
      if (attempt + 1 < attempts) continue;
      throw new PublicSafeError("GITHUB_" + stage + "_" + (timeout ? "TIMEOUT" : "TRANSPORT"));
    }
    // Cloudflare Workers rejects redirect:"error" at runtime, even without a 3xx.
    // redirect:"manual" avoids following redirects with the PAT; reject every 3xx.
    if (response.status >= 300 && response.status <= 399)
      throw new PublicSafeError("GITHUB_" + stage + "_REDIRECT");
    return response;
  }
  throw new PublicSafeError("BRIDGE_UNAVAILABLE");
}
export async function getPublicKey({ token, fetchImpl = fetch }) {
  assertToken(token);
  const res = await request(fetchImpl, API + "/public-key",
    { method: "GET", headers: headers(token) }, "KEY_FETCH");
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
  decodePublicKey(data.key);
  return { key_id: data.key_id, key: data.key };
}

/** Pure JS/libsodium-compatible sealed box. Never expose or log plaintext. */
export async function encryptForGitHub(plaintext, keyBase64) {
  const key = decodePublicKey(keyBase64);
  const bytes = encoder.encode(plaintext);
  let ciphertext;
  try {
    ciphertext = sealedBox(bytes, key);
    return encodeBase64(ciphertext);
  } finally {
    bytes.fill(0);
    key.fill(0);
    if (ciphertext) ciphertext.fill(0);
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
  }, "SIGN_CREATE");
  if (![201, 204].includes(put.status)) {
    throw new PublicSafeError(put.status === 401 || put.status === 403 ?
      "GITHUB_PERMISSION_MISSING" : "GITHUB_REJECTED_WRITE");
  }
  const get = await request(fetchImpl, url, {
    method: "GET", headers: headers(token)
  }, "SIGN_READBACK");
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


// PAT-free diagnostic executed INSIDE isolated Cloudflare Worker Preview.
// Ephemeral keypair and synthetic plaintext only; no GitHub requests or secrets.
export async function checkGatewayCrypto() {
  let stage = "ENTROPY";
  let recipient, decoded, cipher, nonce, opened;
  try {
    if (typeof globalThis.crypto?.getRandomValues !== "function")
      throw new Error("WebCrypto CSPRNG is unavailable");
    const seed = new Uint8Array(32);
    globalThis.crypto.getRandomValues(seed);
    recipient = nacl.box.keyPair.fromSecretKey(seed);
    seed.fill(0);
    const publicKey = encodeBase64(recipient.publicKey);
    stage = "ENCRYPT";
    const ciphertextBase64 = await encryptForGitHub("MotorLab-LAB06-offline-crypto-test", publicKey);
    cipher = Uint8Array.from(atob(ciphertextBase64), ch => ch.charCodeAt(0));
    stage = "DECRYPT";
    const nonceInput = new Uint8Array(64);
    nonceInput.set(cipher.subarray(0,32));
    nonceInput.set(recipient.publicKey,32);
    nonce = blake2b(nonceInput, { dkLen: 24 });
    nonceInput.fill(0);
    opened = nacl.box.open(cipher.subarray(32),nonce,cipher.subarray(0,32),recipient.secretKey);
    if (!opened || decoder.decode(opened) !== "MotorLab-LAB06-offline-crypto-test")
      throw new Error("Sealed box did not round-trip");
    stage = "RANDOM_UUID";
    if (typeof globalThis.crypto.randomUUID !== "function")
      throw new Error("Missing randomUUID");
    globalThis.crypto.randomUUID();
    return {crypto_ready:true,stage:"READY"};
  } catch {
    return {crypto_ready:false,stage};
  } finally {
    if (recipient?.secretKey) recipient.secretKey.fill(0);
    if (opened) opened.fill(0);
    if (cipher) cipher.fill(0);
    if (nonce) nonce.fill(0);
  }
}

export const PROBE_SECRET_NAME = "MOTORLAB_AUTOSETUP_LAB06_PROBE";
export async function probeRepositorySecrets({
  token, approval, fetchImpl = fetch, liveEnabled = false
}) {
  if (!liveEnabled) throw new PublicSafeError("LIVE_WRITES_DISABLED");
  if (approval !== true) throw new PublicSafeError("USER_APPROVAL_REQUIRED");
  assertToken(token);
  const url = API + "/" + PROBE_SECRET_NAME;
  const before = await request(fetchImpl, url,
    { method: "GET", headers: headers(token) }, "PROBE_PRECHECK");
  if (before.status !== 404) {
    if (before.ok) throw new PublicSafeError("PROBE_SECRET_ALREADY_EXISTS");
    if (before.status === 401 || before.status === 403)
      throw new PublicSafeError("GITHUB_PERMISSION_MISSING");
    throw new PublicSafeError("PROBE_PRECHECK_FAILED");
  }

  // Read the public key before trying to write anything.
  const pub = await getPublicKey({ token, fetchImpl });
  const syntheticValue = "motorlab-lab06-probe-" + crypto.randomUUID();
  const encrypted = await encryptForGitHub(syntheticValue, pub.key);

  let receipt, failure;
  let cleanupRequired = false;
  try {
    // A failed PUT may still have reached GitHub: do not retry the PUT.
    cleanupRequired = true;
    const put = await request(fetchImpl, url, {
      method: "PUT",
      headers: { ...headers(token), "Content-Type": "application/json" },
      body: JSON.stringify({ encrypted_value: encrypted, key_id: pub.key_id })
    }, "PROBE_CREATE");
    if (put.status === 401 || put.status === 403) {
      // A definitive access denial could not have created the synthetic secret.
      cleanupRequired = false;
      throw new PublicSafeError("GITHUB_PERMISSION_MISSING");
    }
    if (![201, 204].includes(put.status))
      throw new PublicSafeError("GITHUB_REJECTED_WRITE");

    const get = await request(fetchImpl, url,
      { method: "GET", headers: headers(token) }, "PROBE_READBACK");
    if (!get.ok) throw new PublicSafeError("GITHUB_READBACK_FAILED");
    let metadata;
    try { metadata = await get.json(); }
    catch { throw new PublicSafeError("GITHUB_READBACK_FAILED"); }
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

  // Cleanup after acknowledged or ambiguous creation. Do not turn a clear
  // GitHub 401/403 response into an unrelated cleanup error.
  if (cleanupRequired) try {
    let del;
    try {
      del = await request(fetchImpl, url,
        { method: "DELETE", headers: headers(token) }, "PROBE_DELETE");
    } catch (error) {
      if (!(error instanceof PublicSafeError)) throw error;
      del = null; // delete might have succeeded; confirm with GET
    }
    if (del !== null && del.status !== 204 && del.status !== 404)
      throw new PublicSafeError("PROBE_CLEANUP_FAILED");
    const after = await request(fetchImpl, url,
      { method: "GET", headers: headers(token) }, "PROBE_CLEANUP_VERIFY");
    if (after.status !== 404) throw new PublicSafeError("PROBE_CLEANUP_FAILED");
  } catch {
    // Do not claim success unless absence has been verified.
    throw new PublicSafeError("PROBE_CLEANUP_UNVERIFIED");
  }
  if (failure) throw failure;
  return receipt;
}
