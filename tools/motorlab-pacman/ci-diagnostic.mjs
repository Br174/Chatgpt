// CI diagnostic is read-only and has no cloud/provider side effects.
import {assessStagingReadiness} from "./staging-readiness.mjs";
import {capabilityStatus} from "./execution-v2.mjs";
const staging=assessStagingReadiness();
const github=capabilityStatus("github.lab-file-cycle");
if(staging.ready || staging.mutationAllowed || github.available) {
  throw Error("UNEXPECTED_WRITE_READINESS");
}
console.log(JSON.stringify({
  schema:1,mode:"READ_ONLY",stagingReady:staging.ready,
  mutationAllowed:staging.mutationAllowed,
  stagingMissing:staging.missing,
  githubAdapterAvailable:github.available
},null,2));
