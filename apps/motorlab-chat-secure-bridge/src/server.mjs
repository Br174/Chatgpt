import express from "express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE }
  from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { ALLOWED_SECRETS, PublicSafeError, REPOSITORY,
  setRepositorySecret } from "./github-gateway.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const uri = "ui://motorlab-autosetup/secure-secrets-v1.html";
const template = readFileSync(resolve(here, "../public/secure-secrets.html"), "utf8");

function checkedOrigin(value, name, requiredHttps) {
  let url;
  try { url = new URL(value); } catch (_) { throw new Error(name + "_INVALID"); }
  if (!["http:","https:"].includes(url.protocol) ||
      (requiredHttps && url.protocol !== "https:") ||
      url.username || url.password || url.pathname !== "/" ||
      url.search || url.hash)
    throw new Error(name + "_INVALID");
  return url.origin;
}

export function createBridge(options = {}) {
  const publicUrl = checkedOrigin(
    options.publicUrl ?? process.env.MOTORLAB_PUBLIC_ORIGIN ?? "http://localhost:8787",
    "PUBLIC_ORIGIN", options.production ?? process.env.NODE_ENV === "production"
  );
  const widgetOrigin = checkedOrigin(
    options.widgetOrigin ?? process.env.MOTORLAB_WIDGET_ORIGIN ?? publicUrl,
    "WIDGET_ORIGIN", options.production ?? process.env.NODE_ENV === "production"
  );
  if ((options.production ?? process.env.NODE_ENV === "production") &&
      widgetOrigin === publicUrl)
    throw new Error("WIDGET_ORIGIN_MUST_BE_DISTINCT");
  const liveEnabled = options.liveEnabled ??
    (process.env.MOTORLAB_LIVE_GITHUB_WRITE === "true");
  const gateway = options.gateway ?? setRepositorySecret;
  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });

  // Only the exact MCP App widget origin may make browser secret submissions.
  // Deliberately NO cookies, wildcard CORS, or request-body logging.
  app.use("/api", (req, res, next) => {
    if (req.headers.origin !== widgetOrigin) {
      res.status(403).json({ error: "ORIGIN_NOT_AUTHORIZED" }); return;
    }
    res.setHeader("Access-Control-Allow-Origin", widgetOrigin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
    if (req.method === "OPTIONS") { res.status(204).end(); return; }
    next();
  });
  app.use("/api", express.json({ limit: "180kb", strict: true }));
  app.post("/api/repository-secret", async (req, res) => {
    // Live writes cannot be activated from MCP tool arguments or by the widget.
    if (!liveEnabled) {
      res.status(423).json({ error: "LIVE_WRITES_DISABLED" }); return;
    }
    const tokenMatch = /^Bearer ([^\s]+)$/.exec(req.headers.authorization ?? "");
    try {
      const result = await gateway({
        token: tokenMatch?.[1], name: req.body?.secret_name,
        value: req.body?.value, approval: req.body?.approval === true,
        liveEnabled: true
      });
      res.status(200).json(result);
    } catch (error) {
      const code = error instanceof PublicSafeError ? error.code : "BRIDGE_UNAVAILABLE";
      const status = code === "AUTH_REQUIRED" || code === "GITHUB_PERMISSION_MISSING" ? 401
        : code === "GITHUB_CONNECTION_FAILED" || code === "BRIDGE_UNAVAILABLE" ? 502
        : 400;
      // Never log exception messages: upstream/SDK errors may contain sensitive data.
      res.status(status).json({ error: code });
    }
  });
  app.use("/api", (_err, _req, res, _next) => {
    res.status(400).json({ error: "INVALID_JSON_OR_SIZE" });
  });
  app.get("/healthz", (_req, res) =>
    res.json({ service: "motorlab-autosetup-secure-bridge", repo: REPOSITORY,
      liveWriteEnabled: liveEnabled, status: "HEALTH_ONLY" }));

  function createMcp() {
    const mcp = new McpServer(
      { name: "motorlab-autosetup-secure-bridge", version: "0.1.0" },
      { instructions: "Never ask users to paste tokens, passwords, keystores or GitHub Actions secrets in chat. Call open_secure_secrets_panel to render the user-only secure UI. No MCP tool receives secret values. The gateway is fixed to Br174/Chatgpt and requires explicit owner consent." }
    );
    registerAppTool(mcp, "open_secure_secrets_panel", {
      title: "AutoSetup: apri pannello GitHub protetto",
      description: "Mostra il pannello ChatGPT per la gestione assistita dei cinque Actions Secrets di MotorLab; nessuna password o token nei messaggi e nessuna scrittura automatica.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: { ui: { resourceUri: uri } }
    }, async () => ({
      content: [{ type: "text",
        text: "Pannello protetto AutoSetup disponibile. Non inserire credenziali nella chat. Lo stato delle scritture deve essere letto soltanto dal pannello e da GitHub." }]
    }));
    registerAppResource(mcp, "MotorLab Secure Secret Entry", uri, {}, async () => ({
      contents: [{
        uri, mimeType: RESOURCE_MIME_TYPE,
        text: template.replace("__MOTORLAB_PUBLIC_ORIGIN__", publicUrl),
        _meta: { ui: { prefersBorder: true,
          domain: widgetOrigin,
          csp: { connectDomains: [publicUrl], resourceDomains: [], frameDomains: [] } } }
      }]
    }));
    return mcp;
  }

  app.all("/mcp", async (req, res) => {
    if (!["POST", "GET", "DELETE"].includes(req.method)) {
      res.status(405).end(); return;
    }
    // The MCP transport deliberately offers only the read-only UI launcher.
    // No secrets are accepted on any MCP tool or resource.
    const mcp = createMcp();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, enableJsonResponse: true
    });
    res.on("close", () => { transport.close(); mcp.close(); });
    try {
      await mcp.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (_) {
      if (!res.headersSent) res.status(500).json({ error: "MCP_UNAVAILABLE" });
    }
  });

  return { app, liveEnabled, publicUrl, widgetOrigin };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const bridge = createBridge();
  const port = Number(process.env.PORT ?? 8787);
  bridge.app.listen(port, "0.0.0.0", () => {
    // Do not log endpoint configuration, auth headers or values.
    process.stdout.write("MotorLab Secure Bridge listening on port " + port + "\n");
  });
}
