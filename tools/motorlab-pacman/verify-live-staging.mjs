// Pacman live staging health probe. Read-only, no credentials, no mutations.
// Usage: node tools/motorlab-pacman/verify-live-staging.mjs
export const PACMAN_HEALTH_URL = "https://motorlab-pacman-staging-lab.motorlab-staging.workers.dev/health";
export async function verifyPacmanStaging({fetchImpl = fetch, url = PACMAN_HEALTH_URL} = {}) {
  if (url !== PACMAN_HEALTH_URL) throw new Error("STAGING_URL_MISMATCH");
  const response = await fetchImpl(url, {method:"GET", headers:{accept:"application/json"}, signal:AbortSignal.timeout(10000)});
  if (!response.ok) throw new Error("HEALTH_HTTP_" + response.status);
  const data = await response.json();
  if (data?.service !== "motorlab-pacman-staging" || data?.database !== "CONNECTED")
    throw new Error("STAGING_D1_NOT_CONNECTED");
  return {status:"VERIFIED", service:data.service, database:data.database, scope:"read-only"};
}
if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  verifyPacmanStaging().then(result => {
    console.log(JSON.stringify(result));
  }).catch(error => { console.error(error.message); process.exitCode=1; });
}
