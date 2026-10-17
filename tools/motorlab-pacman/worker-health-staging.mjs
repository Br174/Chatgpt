// Pacman staging: read-only binding check. Never writes to D1 or GitHub.
// Intended only for motorlab-pacman-staging-lab on MotorLab-Staging account.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "GET" || url.pathname !== "/health")
      return new Response("Not found", {status:404});
    try {
      if (!env.DB || typeof env.DB.prepare !== "function")
        throw new Error("D1_BINDING_MISSING");
      const result = await env.DB.prepare(
        "SELECT COUNT(*) AS total FROM sqlite_master WHERE type = 'table' AND name = 'pacman_operations'"
      ).first();
      return Response.json({
        service:"motorlab-pacman-staging",
        database:result?.total === 1 ? "CONNECTED" : "SCHEMA_MISSING"
      }, {headers:{"Cache-Control":"no-store"}});
    } catch {
      return Response.json({service:"motorlab-pacman-staging",database:"ERROR"},
        {status:503,headers:{"Cache-Control":"no-store"}});
    }
  }
};
