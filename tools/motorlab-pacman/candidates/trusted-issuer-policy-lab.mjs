// LAB-only pure authorization policy prototype. No Cloudflare bindings, network, D1 or signing.
import {LAB_BRANCH,LAB_PROBE} from "../chat-approval.mjs";
const OP_ID=/^[a-zA-Z0-9][a-zA-Z0-9._-]{7,119}$/;
const DIGEST=/^[a-f0-9]{64}$/;
const reject=()=>{throw Error("ISSUER_AUTHORIZATION_DENIED");};
export function validateIssuerApproval({identity,confirmation,intent,contentSha256,now=Date.now()}={}){
 // Identity must originate from a trusted authenticated host; a user-provided identity
 // object is NOT proof. Caller is responsible for validating its source and session.
 if(identity?.authenticated!==true || identity?.source!=="trusted-host" ||
    typeof identity.subject!=="string" || !identity.subject ||
    identity.ownerAuthorized!==true || identity.sessionFresh!==true)reject();
 if(!intent || !OP_ID.test(intent.operationId||"") ||
    intent.capability!=="github.lab-file-cycle" ||
    intent.branch!==LAB_BRANCH || intent.path!==LAB_PROBE)reject();
 if(typeof contentSha256!=="string" || !DIGEST.test(contentSha256))reject();
 if(confirmation?.decision!=="authorize" ||
    confirmation.operationId!==intent.operationId ||
    confirmation.capability!==intent.capability ||
    confirmation.branch!==intent.branch ||
    confirmation.path!==intent.path ||
    confirmation.contentSha256!==contentSha256 ||
    confirmation.subject!==identity.subject ||
    !Number.isSafeInteger(confirmation.issuedAt) ||
    confirmation.issuedAt>now ||
    confirmation.issuedAt<now-120000 ||
    typeof confirmation.nonce!=="string" ||
    !OP_ID.test(confirmation.nonce))reject();
 return Object.freeze({operationId:intent.operationId,subject:identity.subject,
  capability:intent.capability,branch:LAB_BRANCH,path:LAB_PROBE,contentSha256});
}
