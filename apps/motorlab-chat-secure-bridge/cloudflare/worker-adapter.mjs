// AutoSetup LAB06: Cloudflare adapter for the EXISTING MotorLab Worker.
// Uses the already tested secure panel and GitHub sealed-box gateway. No parallel authority.
// The feature remains inactive for writes unless explicitly enabled and origin-checked.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { panelHtml } from "../src/generated-panel.mjs";
import { setRepositorySecret, probeRepositorySecrets, checkGatewayCrypto, PublicSafeError } from "../src/github-gateway.mjs";

const PREFIX = "/autosetup/v1";
const URI = "ui://motorlab-autosetup/secure-secrets-v1.html";
const HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer"
};
const MAX_BODY = 180 * 1024;
const enc = new TextEncoder();
const errorResponse = (error, status) => new Response(JSON.stringify({ error }), {
  status, headers: { ...HEADERS, "Content-Type": "application/json; charset=utf-8" }
});
function originOnly(candidate) {
  if (typeof candidate !== "string") return null;
  try {
    const u = new URL(candidate);
    return u.protocol === "https:" && !u.username && !u.password &&
      u.pathname === "/" && !u.search && !u.hash ? u.origin : null;
  } catch { return null; }
}
function widgetOrigin(env, publicOrigin) {
  const origin = originOnly(env.MOTORLAB_AUTOSETUP_WIDGET_ORIGIN);
  return origin && origin !== publicOrigin ? origin : null;
}
function liveEnabled(env) {
  return env.MOTORLAB_AUTOSETUP_LIVE_GITHUB_WRITE === "true";
}
// Isolated LAB06 probe window. The five signing secrets NEVER inherit this gate.
// Missing/invalid flags, clock outside the window, or a window over 45 min => CLOSED.
function probeEnabled(env, now = Date.now()) {
  if (env.MOTORLAB_AUTOSETUP_PROBE_ONLY !== "true" || liveEnabled(env)) return false;
  const untilText = env.MOTORLAB_AUTOSETUP_PROBE_UNTIL;
  if (typeof untilText !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(untilText)) return false;
  const until = Date.parse(untilText);
  return Number.isFinite(until) && until > now && until - now <= 45 * 60 * 1000;
}
// Provider routing is deliberately read-only until an authenticated host and
// per-provider permission checks are independently verified.
function diagnoseProvider(provider, env) {
  const name = typeof provider === "string" ? provider.trim().toLowerCase() : "";
  const supported = ["github", "cloudflare"];
  if (!supported.includes(name)) return {
    schema: 1, provider: name || "unspecified", status: "UNSUPPORTED_PROVIDER",
    action_allowed: false,
    blocker: "PROVIDER_ADAPTER_MISSING",
    next_action: "Add a reviewed provider adapter; never request credentials in chat"
  };
  if (name === "cloudflare") return {
    schema: 1, provider: name, status: "READ_ONLY_PREVIEW_VERIFIED",
    action_allowed: false,
    blocker: "CLOUDFLARE_CONFIGURATION_ADAPTER_MISSING",
    next_action: "Implement an authorized Cloudflare configuration adapter in LAB; production changes remain forbidden"
  };
  return {
    schema: 1, provider: name, status: "GATEWAY_AVAILABLE",
    action_allowed: liveEnabled(env),
    blocker: liveEnabled(env) ? null : "GITHUB_WRITES_DISABLED",
    next_action: liveEnabled(env)
      ? "Use the existing protected secrets gateway with independent owner approval"
      : "Obtain separate owner authorization before enabling any GitHub secret writes"
  };
}
function securePanel(apiBase, { embedded = false } = {}) {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  const nonce = [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
  let html = panelHtml
    .replaceAll("__MOTORLAB_PUBLIC_ORIGIN__", apiBase)
    .replace("<style>", '<style nonce="' + nonce + '">')
    .replace("<script>", '<script nonce="' + nonce + '">');
  if (embedded) html = html
    .replace('"/api/repository-secret"', '"/autosetup/v1/api/repository-secret"')
    .replace('"/api/probe"', '"/autosetup/v1/api/probe"');
  return { html, nonce };
}
function panelResponse(publicOrigin) {
  const { html, nonce } = securePanel(publicOrigin + PREFIX);
  return new Response(html, {
    status: 200,
    headers: {
      ...HEADERS,
      "Content-Type": "text/html; charset=utf-8",
      "X-Frame-Options": "DENY",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Content-Security-Policy": "default-src 'none'; script-src 'nonce-" + nonce +
        "'; style-src 'nonce-" + nonce + "'; connect-src 'self'; form-action 'self'; " +
        "base-uri 'none'; frame-ancestors 'none'"
    }
  });
}
function createMcp(publicOrigin, env) {
  const mcp = new McpServer(
    { name: "motorlab-autosetup-cloudflare", version: "0.1.0-lab06" },
    { instructions: "Only open the secure embedded panel. NEVER receive or request secrets, PATs, keystore, passwords or OTP in chat messages or MCP tool calls. No write is permitted until the real owner separately enables the protected gateway." }
  );
  registerAppTool(mcp, "open_secure_secrets_panel", {
    title: "AutoSetup · pannello protetto",
    description: "Apri il pannello per gli Actions Secrets di firma MotorLab. Nessun valore segreto e' trasmesso al modello.",
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, openWorldHint: false },
    _meta: { ui: { resourceUri: URI } }
  }, async () => ({
    content: [{ type: "text", text: "Pannello AutoSetup protetto richiesto. Non inserire segreti nella chat; una scrittura non e' confermata senza verifica GitHub." }]
  }));
  registerAppTool(mcp, "diagnose_setup", {
    title: "Pacman · individua ostacolo configurazione",
    description: "Diagnosi senza credenziali per GitHub o Cloudflare; per altri provider indica adattatore mancante. Non modifica account o Worker.",
    inputSchema: z.object({ provider: z.string().min(1).max(80) }),
    annotations: { readOnlyHint: true, openWorldHint: false }
  }, async ({ provider }) => ({
    content: [{ type: "text", text: JSON.stringify(diagnoseProvider(provider, env)) }]
  }));
  registerAppResource(mcp, "MotorLab AutoSetup protected panel", URI, {}, async () => {
    const metadata = {
      prefersBorder: true,
      csp: { connectDomains: [publicOrigin], resourceDomains: [], frameDomains: [] }
    };
    const origin = widgetOrigin(env, publicOrigin);
    if (origin) metadata.domain = origin;
    const { html, nonce } = securePanel(publicOrigin, { embedded: true });
    return { contents: [{ uri: URI, mimeType: RESOURCE_MIME_TYPE, text: html,
      _meta: { ui: metadata } }] };
  });
  return mcp;
}
async function serveMcp(request, env, publicOrigin) {
  if (request.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", 405);
  const accept = request.headers.get("accept") || "";
  if (!accept.includes("application/json") || !accept.includes("text/event-stream"))
    return errorResponse("MCP_ACCEPT_REQUIRED", 406);
  const mcp = createMcp(publicOrigin, env);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, enableJsonResponse: true
  });
  try {
    await mcp.connect(transport);
    const response = await transport.handleRequest(request);
    const h = new Headers(response.headers);
    for (const [key, value] of Object.entries(HEADERS)) h.set(key, value);
    return new Response(response.body, { status: response.status, headers: h });
  } catch {
    return errorResponse("MCP_UNAVAILABLE", 500);
  } finally {
    await transport.close().catch(() => {});
    await mcp.close().catch(() => {});
  }
}
async function serveSecret(request, env, publicOrigin, gateway) {
  const requestOrigin = originOnly(request.headers.get("origin"));
  const approvedWidgetOrigin = widgetOrigin(env, publicOrigin);
  const originAllowed = requestOrigin === publicOrigin ||
    (approvedWidgetOrigin !== null && requestOrigin === approvedWidgetOrigin);
  if (!originAllowed) return errorResponse("REQUEST_ORIGIN_NOT_ALLOWED", 403);
  const cors = {
    ...HEADERS,
    "Access-Control-Allow-Origin": requestOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Vary": "Origin"
  };
  if (request.method === "OPTIONS") return new Response(null, {status: 204, headers: cors});
  if (request.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", 405);
  if (!liveEnabled(env))
    return new Response(JSON.stringify({error:"LIVE_WRITES_DISABLED"}), {
      status:423, headers:{...cors,"Content-Type":"application/json"}
    });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    return errorResponse("JSON_REQUIRED", 415);
  const size = Number(request.headers.get("content-length"));
  if (Number.isFinite(size) && size > MAX_BODY) return errorResponse("PAYLOAD_TOO_LARGE", 413);
  let raw, input;
  try {
    raw = await request.text();
    if (enc.encode(raw).byteLength > MAX_BODY) return errorResponse("PAYLOAD_TOO_LARGE", 413);
    input = JSON.parse(raw);
  } catch { return errorResponse("INVALID_REQUEST", 400); }
  const bearer = /^Bearer ([^\s]+)$/.exec(request.headers.get("authorization") || "");
  try {
    const receipt = await gateway({
      token: bearer?.[1], name: input?.secret_name, value: input?.value,
      approval: input?.approval === true, liveEnabled: true
    });
    return new Response(JSON.stringify(receipt), {
      status: 200, headers: {...cors, "Content-Type": "application/json"}
    });
  } catch (error) {
    // Never return/log upstream messages or request body.
    const code = error instanceof PublicSafeError ? error.code : "BRIDGE_UNAVAILABLE";
    const status = code === "AUTH_REQUIRED" || code === "GITHUB_PERMISSION_MISSING" ? 401
      : code === "BRIDGE_UNAVAILABLE" || code === "GITHUB_CONNECTION_FAILED" ? 502 : 400;
    return new Response(JSON.stringify({ error: code }), {
      status, headers: { ...cors, "Content-Type": "application/json" }
    });
  } finally {
    raw = null; input = null;
  }
}

async function serveProbe(request, env, publicOrigin, probeGateway) {
  const requestOrigin = originOnly(request.headers.get("origin"));
  const approvedWidgetOrigin = widgetOrigin(env, publicOrigin);
  const originAllowed = requestOrigin === publicOrigin ||
    (approvedWidgetOrigin !== null && requestOrigin === approvedWidgetOrigin);
  if (!originAllowed) return errorResponse("REQUEST_ORIGIN_NOT_ALLOWED", 403);
  const cors = {
    ...HEADERS,
    "Access-Control-Allow-Origin": requestOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Vary": "Origin"
  };
  if (request.method === "OPTIONS") return new Response(null, {status:204,headers:cors});
  if (request.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED",405);
  if (!probeEnabled(env))
    return new Response(JSON.stringify({error:"PROBE_WINDOW_CLOSED"}), {
      status:423,headers:{...cors,"Content-Type":"application/json"}
    });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    return errorResponse("JSON_REQUIRED",415);
  let raw,input;
  try {
    raw=await request.text();
    if(enc.encode(raw).byteLength>4096)return errorResponse("PAYLOAD_TOO_LARGE",413);
    input=JSON.parse(raw);
  } catch { return errorResponse("INVALID_REQUEST",400); }
  const bearer=/^Bearer ([^\s]+)$/.exec(request.headers.get("authorization")||"");
  try {
    const receipt=await probeGateway({
      token:bearer?.[1],approval:input?.approval===true,liveEnabled:true
    });
    return new Response(JSON.stringify(receipt),{
      status:200,headers:{...cors,"Content-Type":"application/json"}
    });
  } catch(error) {
    const code=error instanceof PublicSafeError?error.code:"BRIDGE_UNAVAILABLE";
    const status=code==="AUTH_REQUIRED"||code==="GITHUB_PERMISSION_MISSING"?401
      :code==="BRIDGE_UNAVAILABLE"||code==="GITHUB_CONNECTION_FAILED"?502:400;
    return new Response(JSON.stringify({error:code}),{
      status,headers:{...cors,"Content-Type":"application/json"}
    });
  } finally { raw=null;input=null; }
}

export async function handleAutoSetupCloudflare(request, env, {gateway = setRepositorySecret, probeGateway = probeRepositorySecrets} = {}) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith(PREFIX + "/") && url.pathname !== PREFIX)
    return null; // Let the existing MotorLab Worker handle every legacy route unchanged.
  const publicOrigin = originOnly(url.origin);
  if (!publicOrigin) return errorResponse("HTTPS_REQUIRED", 403);
  // Read-only capability diagnosis. Never expose credentials, account IDs or secret values.
  // A successful Worker preview does NOT prove that the ChatGPT host connected the MCP app.
  if (url.pathname === PREFIX + "/capabilities") {
    if (request.method !== "GET") return errorResponse("METHOD_NOT_ALLOWED", 405);
    const writes = liveEnabled(env);
    const probe = probeEnabled(env);
    const blockers = [];
    if (!writes) blockers.push({
      code: "GITHUB_WRITES_DISABLED",
      component: "github-secrets",
      next_action: "Explicit owner authorization and protected gateway enablement required"
    });
    if (!probe) blockers.push({
      code: "PROBE_WINDOW_CLOSED",
      component: "github-probe",
      next_action: "Do not reuse expired authorization; isolated preview remains available"
    });
    blockers.push({
      code: "CHAT_CONNECTION_UNVERIFIED",
      component: "chatgpt-mcp",
      next_action: "Connect the MCP app in a supported host and verify a real tool invocation"
    });
    blockers.push({
      code: "GENERAL_PROVIDER_ROUTING_NOT_IMPLEMENTED",
      component: "autosetup-router",
      next_action: "Implement provider discovery and provider-specific capability checks before claiming universal setup"
    });
    return new Response(JSON.stringify({
      schema: 1,
      service: "motorlab-autosetup-cloudflare",
      mode: "diagnostic-read-only",
      supported_provider_operations: ["github-actions-signing-secrets"],
      github_writes_enabled: writes,
      github_probe_enabled: probe,
      chat_connection_verified: false,
      general_provider_routing_implemented: false,
      blockers,
      providers: ["github", "cloudflare"].map(provider => diagnoseProvider(provider, env))
    }), { headers: { ...HEADERS, "Content-Type": "application/json; charset=utf-8" } });
  }
  if (url.pathname === PREFIX + "/diagnose") {
    if (request.method !== "GET") return errorResponse("METHOD_NOT_ALLOWED", 405);
    const provider = url.searchParams.get("provider");
    if (!provider || provider.length > 80) return errorResponse("PROVIDER_REQUIRED", 400);
    return new Response(JSON.stringify(diagnoseProvider(provider, env)), {
      headers: { ...HEADERS, "Content-Type": "application/json; charset=utf-8" }
    });
  }
  if (url.pathname === PREFIX + "/health") {
    if (request.method !== "GET") return errorResponse("METHOD_NOT_ALLOWED", 405);
    return new Response(JSON.stringify({
      service: "motorlab-autosetup-cloudflare",
      write_enabled: liveEnabled(env),
      probe_enabled: probeEnabled(env),
      github_write_verified: false,
      chat_connected_verified: false
    }), { headers: { ...HEADERS, "Content-Type": "application/json" } });
  }
  if (url.pathname === PREFIX + "/crypto-selftest") {
    // Read-only diagnostic runs only on isolated Cloudflare previews.
    // Never expose the diagnostic in the production Worker.
    if (env.MOTORLAB_AUTOSETUP_CRYPTO_DIAGNOSTIC !== "preview-only")
      return errorResponse("NOT_FOUND", 404);
    if (request.method !== "GET") return errorResponse("METHOD_NOT_ALLOWED", 405);
    const health = await checkGatewayCrypto();
    return new Response(JSON.stringify(health), {
      status: health.crypto_ready ? 200 : 503,
      headers: { ...HEADERS, "Content-Type": "application/json" }
    });
  }
  if (url.pathname === PREFIX + "/panel") {
    if (request.method !== "GET") return errorResponse("METHOD_NOT_ALLOWED", 405);
    return panelResponse(publicOrigin);
  }
  if (url.pathname === PREFIX + "/mcp") return serveMcp(request, env, publicOrigin);
  if (url.pathname === PREFIX + "/api/repository-secret")
    return serveSecret(request, env, publicOrigin, gateway);
  if (url.pathname === PREFIX + "/api/probe")
    return serveProbe(request, env, publicOrigin, probeGateway);
  return errorResponse("NOT_FOUND", 404);
}
